package primitive

// x402 agent-to-agent payments.
//
// The payer signs an EIP-3009 transferWithAuthorization with the customer's own
// key; the key never leaves them. This file derives the interaction-bound nonce,
// assembles the EIP-712 typed data and the wire payload, and exposes a small
// HTTP client over the platform's /v1/x402 endpoints. The byte layout here MUST
// match the platform verifier exactly; a normative test vector (see
// x402_test.go) locks the nonce derivation to the same value the server
// recomputes.
//
// This mirrors the Node SDK's x402 module (sdk-node/src/x402), which is the
// source of truth. The signing primitives are intentionally raw net/http rather
// than the generated ogen client so the success/data envelope, error shape, and
// validation semantics match the Node implementation byte-for-byte.

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/common/math"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/signer/core/apitypes"
	"github.com/google/uuid"
)

// DefaultX402BaseURL is the production API host for x402 operations. Mirrors the
// Node SDK's DEFAULT_BASE_URL.
const DefaultX402BaseURL = "https://api.primitive.dev"

// chainIDs maps a network name to its EVM chain id. Mirrors the Node SDK.
var x402ChainIDs = map[string]int64{
	"base-sepolia": 84532,
	"base":         8453,
}

// Generous past-dating for clock skew + headroom past challenge expiry so a
// verified payment still has time to settle. Mirrors the server's window.
const (
	x402ClockSkewSec        = 5 * 60
	x402SettlementMarginSec = 5 * 60
)

// A challenge nonce is 32 bytes rendered as 64 lowercase hex chars, no 0x.
var x402ChallengeNonceRe = regexp.MustCompile(`^[0-9a-f]{64}$`)

// A 0x-prefixed 20-byte EVM address.
var x402AddressRe = regexp.MustCompile(`^0x[0-9a-fA-F]{40}$`)

// A positive integer amount string in token base units, e.g. "10000".
var x402AmountRe = regexp.MustCompile(`^[1-9][0-9]{0,38}$`)

// A non-negative decimal amount string, e.g. "0.01" or "5". Matched before the
// >6-decimal precision check.
var x402UsdcRe = regexp.MustCompile(`^[0-9]+(\.[0-9]+)?$`)

// usdcToBaseUnits converts a human USDC amount ("0.01") to token base units
// ("10000") with integer/big.Int math so there is no float rounding. USDC has 6
// decimals. Returns an error on a non-positive, malformed, or over-precise (>6
// decimals) value. Mirrors the Node SDK's usdcToBaseUnits.
func usdcToBaseUnits(human string) (string, error) {
	trimmed := strings.TrimSpace(human)
	if !x402UsdcRe.MatchString(trimmed) {
		return "", errors.New("amountUsdc must be a positive decimal USDC amount, e.g. \"0.01\"")
	}
	whole, frac, _ := strings.Cut(trimmed, ".")
	if len(frac) > 6 {
		return "", errors.New("amountUsdc has more than 6 decimal places; USDC supports at most 6")
	}
	wholeInt, ok := new(big.Int).SetString(whole, 10)
	if !ok {
		return "", errors.New("amountUsdc has an invalid whole part")
	}
	fracInt, ok := new(big.Int).SetString(frac+strings.Repeat("0", 6-len(frac)), 10)
	if !ok {
		return "", errors.New("amountUsdc has an invalid fractional part")
	}
	base := new(big.Int).Add(new(big.Int).Mul(wholeInt, big.NewInt(1_000_000)), fracInt)
	if base.Sign() <= 0 {
		return "", errors.New("amountUsdc must be greater than zero")
	}
	return base.String(), nil
}

// ---------------------------------------------------------------------------
// Signing primitives (mirror sdk-node/src/x402/sign.ts)
// ---------------------------------------------------------------------------

// NonceBinding binds an EIP-3009 nonce to a specific interaction step.
type NonceBinding struct {
	// InteractionID is the interaction id, including its @domain. Lowercased
	// before hashing.
	InteractionID string
	// ChallengeStepID is the challenge step id (a UUID). Lowercased before
	// hashing.
	ChallengeStepID string
	// ChallengeNonce is the challenger's per-challenge random nonce: 64
	// lowercase hex chars.
	ChallengeNonce string
}

// DeriveEIP3009Nonce derives the EIP-3009 nonce bound to a specific interaction
// step:
//
//	keccak256( utf8(lower(interaction_id)) || 0x00
//	         || utf8(lower(challenge_step_id)) || 0x00
//	         || hexdecode(challenge_nonce) )
//
// The 0x00 separators pin the field boundaries (undelimited concatenation of
// variable-length strings is collision-ambiguous), and the challenge nonce is
// decoded to its 32 raw bytes before hashing. The platform recomputes this and
// rejects a mismatch. Returns the 0x-prefixed 32-byte hash.
func DeriveEIP3009Nonce(input NonceBinding) (string, error) {
	if !x402ChallengeNonceRe.MatchString(input.ChallengeNonce) {
		return "", errors.New("challengeNonce must be exactly 64 lowercase hex chars (32 bytes), no 0x prefix")
	}
	rawNonce, err := hex.DecodeString(input.ChallengeNonce)
	if err != nil {
		return "", fmt.Errorf("challengeNonce is not valid hex: %w", err)
	}
	var buf bytes.Buffer
	buf.WriteString(strings.ToLower(input.InteractionID))
	buf.WriteByte(0x00)
	buf.WriteString(strings.ToLower(input.ChallengeStepID))
	buf.WriteByte(0x00)
	buf.Write(rawNonce)
	sum := ethcrypto.Keccak256(buf.Bytes())
	return hexutil.Encode(sum), nil
}

// TokenDomain is the token's EIP-712 domain. name/version MUST be the actual
// token's domain params; they come from the challenge's payment requirements
// extra. A wrong name/version produces a signature the verifier rejects.
type TokenDomain struct {
	Name              string
	Version           string
	ChainID           int64
	VerifyingContract string
}

// TransferAuthorization is the EIP-3009 TransferWithAuthorization message.
type TransferAuthorization struct {
	From        string
	To          string
	Value       *big.Int
	ValidAfter  *big.Int
	ValidBefore *big.Int
	// Nonce is the 0x-prefixed 32-byte interaction-bound nonce.
	Nonce string
}

// transferWithAuthorizationTypedData builds the EIP-712 typed-data structure for
// an EIP-3009 TransferWithAuthorization. The field order and types are part of
// the on-chain contract and MUST NOT change.
func transferWithAuthorizationTypedData(domain TokenDomain, auth TransferAuthorization) apitypes.TypedData {
	return apitypes.TypedData{
		Types: apitypes.Types{
			"EIP712Domain": {
				{Name: "name", Type: "string"},
				{Name: "version", Type: "string"},
				{Name: "chainId", Type: "uint256"},
				{Name: "verifyingContract", Type: "address"},
			},
			"TransferWithAuthorization": {
				{Name: "from", Type: "address"},
				{Name: "to", Type: "address"},
				{Name: "value", Type: "uint256"},
				{Name: "validAfter", Type: "uint256"},
				{Name: "validBefore", Type: "uint256"},
				{Name: "nonce", Type: "bytes32"},
			},
		},
		PrimaryType: "TransferWithAuthorization",
		Domain: apitypes.TypedDataDomain{
			Name:              domain.Name,
			Version:           domain.Version,
			ChainId:           math.NewHexOrDecimal256(domain.ChainID),
			VerifyingContract: domain.VerifyingContract,
		},
		Message: apitypes.TypedDataMessage{
			"from":        auth.From,
			"to":          auth.To,
			"value":       auth.Value.String(),
			"validAfter":  auth.ValidAfter.String(),
			"validBefore": auth.ValidBefore.String(),
			"nonce":       auth.Nonce,
		},
	}
}

// BuildPayoutRegistrationMessage builds the payout-address ownership message.
// This MUST be byte-identical to the platform's buildPayoutRegistrationMessage,
// or registration fails the ownership proof. The org id is in the signed bytes,
// so a captured signature can never register the address under a different org.
func BuildPayoutRegistrationMessage(org, address, network, issuedAt string) string {
	return strings.Join([]string{
		"Primitive x402 payout address authorization",
		"",
		"I authorize this address as a payout destination for my Primitive organization.",
		"",
		"org: " + org,
		"address: " + strings.ToLower(address),
		"network: " + network,
		"issued: " + issuedAt,
	}, "\n")
}

// X402PaymentPayload is the x402 wire payload (validated server-side against the
// x402 schema).
type X402PaymentPayload struct {
	X402Version int    `json:"x402Version"`
	Scheme      string `json:"scheme"`
	Network     string `json:"network"`
	Payload     struct {
		Signature     string `json:"signature"`
		Authorization struct {
			From        string `json:"from"`
			To          string `json:"to"`
			Value       string `json:"value"`
			ValidAfter  string `json:"validAfter"`
			ValidBefore string `json:"validBefore"`
			Nonce       string `json:"nonce"`
		} `json:"authorization"`
	} `json:"payload"`
}

// toPaymentPayload assembles the wire payload from a signed authorization.
func toPaymentPayload(network string, auth TransferAuthorization, signature string) X402PaymentPayload {
	p := X402PaymentPayload{X402Version: 1, Scheme: "exact", Network: network}
	p.Payload.Signature = signature
	p.Payload.Authorization.From = auth.From
	p.Payload.Authorization.To = auth.To
	p.Payload.Authorization.Value = auth.Value.String()
	p.Payload.Authorization.ValidAfter = auth.ValidAfter.String()
	p.Payload.Authorization.ValidBefore = auth.ValidBefore.String()
	p.Payload.Authorization.Nonce = auth.Nonce
	return p
}

// X402InteractionProtocol / X402InteractionProtocolVersion identify the protocol
// the email-native payment interaction runs (x402.payment/1). The payer's reply
// carries the payment step of this protocol.
const (
	X402InteractionProtocol        = "x402.payment"
	X402InteractionProtocolVersion = 1
)

// A UUID (used for the interaction id's local part and the step ids).
var x402UUIDRe = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// An interaction id is uuid@domain.
var x402WireIDRe = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}@[^\s@]+$`)

// InteractionEnvelope is the interaction.json envelope for one step of an
// email-carried interaction. The payer's payment step is sent as an
// interaction.json MIME attachment in the reply; the platform parses this
// envelope, validates the step against the x402.payment protocol, and
// re-verifies the embedded payment.
type InteractionEnvelope struct {
	InteractionVersion int    `json:"interaction_version"`
	InteractionID      string `json:"interaction_id"`
	Protocol           string `json:"protocol"`
	ProtocolVersion    int    `json:"protocol_version"`
	Step               string `json:"step"`
	StepID             string `json:"step_id"`
	// PrevStepID is the id of the step this one answers (the challenge step), or
	// null. A pointer so it serializes to JSON null when unset.
	PrevStepID *string `json:"prev_step_id"`
	// ExpiresAt is an optional ISO-8601 step expiry; null when unset.
	ExpiresAt *string                `json:"expires_at"`
	Payload   X402PaymentStepPayload `json:"payload"`
}

// X402PaymentStepPayload is the payload of an x402.payment payment step: the
// signed x402 payload.
type X402PaymentStepPayload struct {
	Payment X402PaymentPayload `json:"payment"`
}

// BuiltPaymentStep is a built, signed payment-step envelope plus its canonical
// JSON bytes. The caller attaches JSON as the interaction.json part of the reply
// email; the platform reads Envelope back from those exact bytes.
type BuiltPaymentStep struct {
	Envelope InteractionEnvelope
	// JSON is the canonical interaction.json body (what to attach to the reply).
	JSON string
}

// BuildPaymentStepEnvelopeInput configures BuildPaymentStepEnvelope.
type BuildPaymentStepEnvelopeInput struct {
	// InteractionID is the thread id (uuid@domain).
	InteractionID string
	// StepID is a fresh UUID identifying this payment step.
	StepID string
	// PrevStepID is the challenge step id this payment answers.
	PrevStepID string
	Payment    X402PaymentPayload
	// ExpiresAt is an optional ISO-8601 step expiry.
	ExpiresAt string
}

// BuildPaymentStepEnvelope builds the section-2.3 interaction.json envelope for a
// payment step. Pure: no I/O. Payment is the signed exact-EVM payload (from
// BuildExactEvmPaymentPayload); PrevStepID is the challenge step id this payment
// answers, and StepID is a fresh UUID for the payment step. Returns the envelope
// and its canonical JSON, so the bytes the platform reads back are exactly the
// ones produced here.
func BuildPaymentStepEnvelope(input BuildPaymentStepEnvelopeInput) (BuiltPaymentStep, error) {
	if !x402WireIDRe.MatchString(input.InteractionID) {
		return BuiltPaymentStep{}, errors.New("BuildPaymentStepEnvelope: InteractionID must be uuid@domain")
	}
	if !x402UUIDRe.MatchString(input.StepID) {
		return BuiltPaymentStep{}, errors.New("BuildPaymentStepEnvelope: StepID must be a uuid")
	}
	if !x402UUIDRe.MatchString(input.PrevStepID) {
		return BuiltPaymentStep{}, errors.New("BuildPaymentStepEnvelope: PrevStepID must be a uuid")
	}
	prev := input.PrevStepID
	var expires *string
	if input.ExpiresAt != "" {
		expires = &input.ExpiresAt
	}
	envelope := InteractionEnvelope{
		InteractionVersion: 1,
		InteractionID:      input.InteractionID,
		Protocol:           X402InteractionProtocol,
		ProtocolVersion:    X402InteractionProtocolVersion,
		Step:               "payment",
		StepID:             input.StepID,
		PrevStepID:         &prev,
		ExpiresAt:          expires,
		Payload:            X402PaymentStepPayload{Payment: input.Payment},
	}
	encoded, err := json.Marshal(envelope)
	if err != nil {
		return BuiltPaymentStep{}, fmt.Errorf("BuildPaymentStepEnvelope: failed to encode envelope: %w", err)
	}
	return BuiltPaymentStep{Envelope: envelope, JSON: string(encoded)}, nil
}

// DefaultMaxWindowSec is the absolute ceiling on the total signed window
// (validBefore - validAfter). A signed EIP-3009 authorization stays settleable
// on-chain until validBefore regardless of the interaction state, so an
// unbounded window is a standing "funds committed" risk. The real window is
// minutes; this 24h cap is the hard safety ceiling, enforced so a
// caller-supplied window cannot bypass it.
const DefaultMaxWindowSec int64 = 24 * 60 * 60

// ValidityWindowInput configures ComputePaymentValidityWindow. The optional
// fields default when left zero: SettlementMarginSec and ClockSkewSec to 5
// minutes, MaxWindowSec to DefaultMaxWindowSec.
type ValidityWindowInput struct {
	ChallengeExpiresAtSec int64
	NowSec                int64
	SettlementMarginSec   int64
	ClockSkewSec          int64
	MaxWindowSec          int64
}

// ComputePaymentValidityWindow computes the EIP-3009 (validAfter, validBefore)
// window for a payment. validBefore governs on-chain validity, so it MUST cover
// the challenge's expires_at plus a settlement margin; validAfter is set
// generously in the past for clock skew. The total window is hard-capped at
// MaxWindowSec so neither a far-future expiry nor a widened margin can produce a
// window the platform verifier would later reject.
func ComputePaymentValidityWindow(input ValidityWindowInput) (validAfter, validBefore *big.Int, err error) {
	margin := input.SettlementMarginSec
	if margin == 0 {
		margin = x402SettlementMarginSec
	}
	skew := input.ClockSkewSec
	if skew == 0 {
		skew = x402ClockSkewSec
	}
	maxWindow := input.MaxWindowSec
	if maxWindow == 0 {
		maxWindow = DefaultMaxWindowSec
	}
	vb := big.NewInt(input.ChallengeExpiresAtSec + margin)
	va := big.NewInt(input.NowSec - skew)
	if vb.Cmp(va) <= 0 {
		return nil, nil, fmt.Errorf(
			"invalid validity window: validBefore must be after validAfter (challenge already expired?)")
	}
	if new(big.Int).Sub(vb, va).Cmp(big.NewInt(maxWindow)) > 0 {
		return nil, nil, fmt.Errorf(
			"invalid validity window: total window exceeds the %ds cap (challenge expiry too far out?)", maxWindow)
	}
	return va, vb, nil
}

// SignInteractionPaymentInput configures SignInteractionPayment.
type SignInteractionPaymentInput struct {
	// Sign signs the EIP-712 typed data with the caller's own key and returns a
	// 0x hex signature (e.g. PrivateKeySigner.SignTypedData).
	Sign func(typedData apitypes.TypedData) (string, error)
	// Payer is the from address.
	Payer  string
	Domain TokenDomain
	// PayTo is the recipient (the challenger's payTo).
	PayTo string
	// Amount is in token base units.
	Amount       *big.Int
	NonceBinding NonceBinding
	ValidAfter   *big.Int
	ValidBefore  *big.Int
}

// SignInteractionPayment derives the bound nonce, assembles the authorization,
// and signs it. This is the one piece a stock x402 signer cannot do (it
// generates the nonce internally with no injection point). The key never leaves
// the caller.
func SignInteractionPayment(input SignInteractionPaymentInput) (TransferAuthorization, string, error) {
	nonce, err := DeriveEIP3009Nonce(input.NonceBinding)
	if err != nil {
		return TransferAuthorization{}, "", err
	}
	auth := TransferAuthorization{
		From:        input.Payer,
		To:          input.PayTo,
		Value:       input.Amount,
		ValidAfter:  input.ValidAfter,
		ValidBefore: input.ValidBefore,
		Nonce:       nonce,
	}
	signature, err := input.Sign(transferWithAuthorizationTypedData(input.Domain, auth))
	if err != nil {
		return TransferAuthorization{}, "", err
	}
	return auth, signature, nil
}

// A shape-valid EIP signature is 65 bytes (r,s,v) rendered as 130 hex chars.
var x402SignatureRe = regexp.MustCompile(`^0x[0-9a-fA-F]{130}$`)

// An EIP-3009 nonce is 32 bytes rendered as 64 hex chars.
var x402NonceRe = regexp.MustCompile(`^0x[0-9a-fA-F]{64}$`)

// BuildExactEvmPaymentPayload assembles (and validates) the exact-EVM x402 wire
// payload. The numeric authorization fields are decimal strings in the wire
// schema, so the big.Ints are stringified; the nonce passes through as hex.
// Validation rejects a malformed nonce or signature loudly rather than emitting
// a payload the platform will reject.
func BuildExactEvmPaymentPayload(network string, auth TransferAuthorization, signature string) (X402PaymentPayload, error) {
	if network != "base" && network != "base-sepolia" {
		return X402PaymentPayload{}, fmt.Errorf("BuildExactEvmPaymentPayload: unsupported network %s", network)
	}
	if !x402SignatureRe.MatchString(signature) {
		return X402PaymentPayload{}, fmt.Errorf(
			"BuildExactEvmPaymentPayload: signature must be a 0x-prefixed 65-byte (130 hex char) EIP signature")
	}
	if !x402NonceRe.MatchString(auth.Nonce) {
		return X402PaymentPayload{}, fmt.Errorf(
			"BuildExactEvmPaymentPayload: authorization nonce must be a 0x-prefixed 32-byte (64 hex char) value")
	}
	return toPaymentPayload(network, auth, signature), nil
}

// ---------------------------------------------------------------------------
// Signer
// ---------------------------------------------------------------------------

// X402Signer is a customer-held signer. The key never leaves the caller. A
// PrivateKeySigner (built from a hex private key) satisfies this directly; any
// key source (hardware wallet, remote KMS) can be adapted by implementing the
// interface.
type X402Signer interface {
	// Address returns the signer's 0x-prefixed checksummed EVM address.
	Address() string
	// SignTypedData signs an EIP-712 typed-data structure and returns the
	// 0x-prefixed 65-byte signature.
	SignTypedData(typedData apitypes.TypedData) (string, error)
	// SignMessage signs a UTF-8 string via Ethereum personal_sign (EIP-191).
	// Only needed for RegisterPayoutAddress (the ownership proof).
	SignMessage(message string) (string, error)
}

// PrivateKeySigner is an X402Signer backed by an in-memory secp256k1 key.
type PrivateKeySigner struct {
	key  *ecdsa.PrivateKey
	addr string
}

// NewPrivateKeySigner builds a signer from a hex-encoded private key (with or
// without the 0x prefix). The key stays in process memory; it is never sent to
// the platform.
func NewPrivateKeySigner(hexKey string) (*PrivateKeySigner, error) {
	cleaned := strings.TrimPrefix(strings.TrimSpace(hexKey), "0x")
	key, err := ethcrypto.HexToECDSA(cleaned)
	if err != nil {
		return nil, fmt.Errorf("invalid private key: %w", err)
	}
	addr := ethcrypto.PubkeyToAddress(key.PublicKey)
	return &PrivateKeySigner{key: key, addr: addr.Hex()}, nil
}

// Address returns the signer's checksummed EVM address.
func (s *PrivateKeySigner) Address() string { return s.addr }

// SignTypedData signs the EIP-712 digest of the typed data. The returned
// signature has its recovery id in canonical Ethereum form (v ∈ {27, 28}).
func (s *PrivateKeySigner) SignTypedData(typedData apitypes.TypedData) (string, error) {
	digest, _, err := apitypes.TypedDataAndHash(typedData)
	if err != nil {
		return "", fmt.Errorf("failed to hash typed data: %w", err)
	}
	sig, err := ethcrypto.Sign(digest, s.key)
	if err != nil {
		return "", fmt.Errorf("failed to sign typed data: %w", err)
	}
	// go-ethereum returns v ∈ {0, 1}; EIP-712 / personal_sign signatures use
	// v ∈ {27, 28} on the wire.
	sig[64] += 27
	return hexutil.Encode(sig), nil
}

// SignMessage signs a UTF-8 string with Ethereum personal_sign (EIP-191):
// keccak256("\x19Ethereum Signed Message:\n" + len(message) + message), then
// secp256k1 sign.
func (s *PrivateKeySigner) SignMessage(message string) (string, error) {
	digest := ethcrypto.Keccak256(
		[]byte(fmt.Sprintf("\x19Ethereum Signed Message:\n%d%s", len(message), message)),
	)
	sig, err := ethcrypto.Sign(digest, s.key)
	if err != nil {
		return "", fmt.Errorf("failed to sign message: %w", err)
	}
	sig[64] += 27
	return hexutil.Encode(sig), nil
}

// ---------------------------------------------------------------------------
// Wire types (mirror sdk-node/src/x402/client.ts response shapes)
// ---------------------------------------------------------------------------

// X402PaymentRequirements is the x402 PaymentRequirements the payer signs over.
type X402PaymentRequirements struct {
	Scheme            string `json:"scheme"`
	Network           string `json:"network"`
	MaxAmountRequired string `json:"maxAmountRequired"`
	PayTo             string `json:"payTo"`
	Asset             string `json:"asset"`
	Extra             struct {
		Name    string `json:"name"`
		Version string `json:"version"`
	} `json:"extra"`
}

// X402NonceBinding is the server-supplied nonce binding for a challenge.
type X402NonceBinding struct {
	InteractionID   string `json:"interaction_id"`
	ChallengeStepID string `json:"challenge_step_id"`
	ChallengeNonce  string `json:"challenge_nonce"`
}

// X402Challenge is a request for payment, as returned by Charge / the platform.
type X402Challenge struct {
	ID                  string                  `json:"id"`
	Network             string                  `json:"network"`
	Amount              string                  `json:"amount"`
	PayTo               string                  `json:"pay_to"`
	NonceBinding        X402NonceBinding        `json:"nonce_binding"`
	PaymentRequirements X402PaymentRequirements `json:"payment_requirements"`
	ExpiresAt           string                  `json:"expires_at"`
}

// X402EmailChallengeDetails is the challenge the payer signs and pays, carried
// inside an email-native challenge response.
type X402EmailChallengeDetails struct {
	PaymentRequirements X402PaymentRequirements `json:"payment_requirements"`
	NonceBinding        X402NonceBinding        `json:"nonce_binding"`
	ExpiresAt           string                  `json:"expires_at"`
}

// X402EmailChallenge is the result of issuing an email-native payment challenge.
// InteractionID is the real email thread id (uuid@domain) the payment is bound
// to. Hand the whole object to the payer, who calls PayEmailChallenge with it to
// build the signed payment step.
type X402EmailChallenge struct {
	InteractionID string                    `json:"interaction_id"`
	ChallengeID   string                    `json:"challenge_id"`
	Challenge     X402EmailChallengeDetails `json:"challenge"`
}

// X402Receipt is the result of paying a challenge.
type X402Receipt struct {
	ID       string  `json:"id"`
	Status   string  `json:"status"`
	SettleTx *string `json:"settle_tx"`
}

// X402PayoutAddress is a registered payout address (read shape).
type X402PayoutAddress struct {
	ID         string  `json:"id"`
	Address    string  `json:"address"`
	Network    string  `json:"network"`
	Label      *string `json:"label"`
	IsDefault  bool    `json:"is_default"`
	VerifiedAt *string `json:"verified_at"`
}

// X402SpendPolicy is the org's spend policy (read shape; also accepted by
// SetSpendPolicy as a partial update via X402SpendPolicyUpdate).
type X402SpendPolicy struct {
	// Paused is a kill-switch: when true, all outbound payments are refused.
	Paused bool `json:"paused"`
	// MaxPerPayment is the per-payment cap in token base units, or nil for no cap.
	MaxPerPayment *string `json:"max_per_payment"`
	// MaxPerDay is the daily cap in token base units, or nil for no cap.
	MaxPerDay *string `json:"max_per_day"`
	// Allowlist is the allowed payee org ids; nil = any on-net payee,
	// [] = deny all.
	Allowlist []string `json:"allowlist"`
}

// X402DeclinedPayment is a payment the org's spend policy refused (read shape).
// Mirrors the Node SDK's X402DeclinedPayment.
type X402DeclinedPayment struct {
	ID              string  `json:"id"`
	ChallengeID     *string `json:"challenge_id"`
	CounterpartyOrg *string `json:"counterparty_org"`
	Network         string  `json:"network"`
	Amount          string  `json:"amount"`
	Reason          string  `json:"reason"`
	DeclinedAt      string  `json:"declined_at"`
}

// X402ChargeInput is the input shape for [X402Client.Charge].
type X402ChargeInput struct {
	// Amount in token base units (USDC has 6 decimals, so "10000" = 0.01).
	// Provide exactly one of Amount or AmountUsdc.
	Amount string
	// AmountUsdc is the amount as human USDC (e.g. "0.01"), converted to base
	// units for you. Provide exactly one of Amount or AmountUsdc.
	AmountUsdc string
	// Network defaults to "base-sepolia".
	Network string
	// PayerOrg is the org id allowed to pay this challenge (on-net binding).
	PayerOrg    string
	Description string
	// Resource is a URL identifying the thing being paid for.
	Resource string
	// ExpiresIn is seconds until the challenge expires (default 1h server-side).
	// A pointer so 0 ("never"/server-default) is distinguishable from unset.
	ExpiresIn *int
	// IdempotencyKey, when set, is sent as the Idempotency-Key HTTP header on the
	// create-challenge request. Retrying Charge with the same key returns the
	// original challenge instead of creating a duplicate. Mirrors the Node SDK.
	IdempotencyKey string
}

// X402EmailChargeInput is the input shape for [X402Client.CreateEmailChallenge].
type X402EmailChargeInput struct {
	// From is your sending address (the payee / funds receiver).
	From string
	// To is the payer's email address the challenge is sent to.
	To string
	// Amount in token base units (USDC has 6 decimals, so "10000" = 0.01).
	// Provide exactly one of Amount or AmountUsdc.
	Amount string
	// AmountUsdc is the amount as human USDC (e.g. "0.01"), converted to base
	// units for you. Provide exactly one of Amount or AmountUsdc.
	AmountUsdc string
	// Network defaults to "base-sepolia".
	Network     string
	Description string
	// Resource is a URL identifying the thing being paid for.
	Resource string
	// ExpiresIn is seconds until the challenge expires (defaults to 300s /
	// 5 minutes server-side). A pointer so 0 is distinguishable from unset.
	ExpiresIn *int
	// IdempotencyKey, when set, is sent as the Idempotency-Key HTTP header.
	// Retrying with the same key returns the original challenge without sending a
	// second email.
	IdempotencyKey string
}

// X402PayoutRegistrationInput is the input shape for
// [X402Client.RegisterPayoutAddress].
type X402PayoutRegistrationInput struct {
	// Org is the org id the address is being authorized for. Optional: when
	// empty it is resolved from your authenticated account (GET /v1/account), so
	// most callers never need to supply it.
	Org string
	// Network defaults to "base-sepolia".
	Network string
	// IssuedAt is an ISO-8601 timestamp; defaults to time.Now() in UTC.
	IssuedAt string
	// Label is an optional human label. A pointer so "" can be sent explicitly.
	Label *string
}

// X402SpendPolicyUpdate is a partial spend-policy update for
// [X402Client.SetSpendPolicy]. Only non-nil fields are sent; the server merges,
// so omitted fields keep their current value. Set a *cap pointer to a pointer to
// nil... use the helper constructors or build the JSON-ready map yourself.
type X402SpendPolicyUpdate struct {
	Paused        *bool
	MaxPerPayment *string
	MaxPerDay     *string
	Allowlist     *[]string
	// clearMaxPerPayment / clearMaxPerDay force the field to JSON null (clear a
	// cap) rather than omitting it.
	clearMaxPerPayment bool
	clearMaxPerDay     bool
}

// SetPaused sets the kill-switch field on the update.
func (u *X402SpendPolicyUpdate) SetPaused(v bool) *X402SpendPolicyUpdate {
	u.Paused = &v
	return u
}

// SetMaxPerPayment sets the per-payment cap on the update.
func (u *X402SpendPolicyUpdate) SetMaxPerPayment(v string) *X402SpendPolicyUpdate {
	u.MaxPerPayment = &v
	u.clearMaxPerPayment = false
	return u
}

// ClearMaxPerPayment sends null for the per-payment cap (removes the cap).
func (u *X402SpendPolicyUpdate) ClearMaxPerPayment() *X402SpendPolicyUpdate {
	u.MaxPerPayment = nil
	u.clearMaxPerPayment = true
	return u
}

// SetMaxPerDay sets the daily cap on the update.
func (u *X402SpendPolicyUpdate) SetMaxPerDay(v string) *X402SpendPolicyUpdate {
	u.MaxPerDay = &v
	u.clearMaxPerDay = false
	return u
}

// ClearMaxPerDay sends null for the daily cap (removes the cap).
func (u *X402SpendPolicyUpdate) ClearMaxPerDay() *X402SpendPolicyUpdate {
	u.MaxPerDay = nil
	u.clearMaxPerDay = true
	return u
}

// SetAllowlist sets the payee allowlist on the update.
func (u *X402SpendPolicyUpdate) SetAllowlist(v []string) *X402SpendPolicyUpdate {
	u.Allowlist = &v
	return u
}

// body builds the JSON-ready map for the PUT, including explicit nulls for
// cleared caps and omitting untouched fields.
func (u *X402SpendPolicyUpdate) body() map[string]any {
	out := map[string]any{}
	if u.Paused != nil {
		out["paused"] = *u.Paused
	}
	if u.clearMaxPerPayment {
		out["max_per_payment"] = nil
	} else if u.MaxPerPayment != nil {
		out["max_per_payment"] = *u.MaxPerPayment
	}
	if u.clearMaxPerDay {
		out["max_per_day"] = nil
	} else if u.MaxPerDay != nil {
		out["max_per_day"] = *u.MaxPerDay
	}
	if u.Allowlist != nil {
		out["allowlist"] = *u.Allowlist
	}
	return out
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

// X402Error is returned by every X402Client method on a client-side, transport,
// or non-2xx server error. Mirrors the Node SDK's X402Error.
type X402Error struct {
	Message string
	// Status is the HTTP status, or 0 for a client-side / transport error that
	// never reached the server.
	Status int
	// Body is the parsed error envelope or raw text, when available.
	Body any
	// RetryAfter is the Retry-After response header, if the server sent one.
	RetryAfter string
	// Cause is the wrapped transport error, if any.
	Cause error
}

func (e *X402Error) Error() string { return e.Message }

func (e *X402Error) Unwrap() error { return e.Cause }

func newX402Error(message string, status int) *X402Error {
	return &X402Error{Message: message, Status: status}
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

// X402ClientOptions configures a [NewX402Client] call.
type X402ClientOptions struct {
	// APIKey defaults to the PRIMITIVE_API_KEY environment variable.
	APIKey string
	// BaseURL defaults to the production host (DefaultX402BaseURL).
	BaseURL string
	// HTTPClient overrides the http.Client (e.g. for testing). Defaults to a
	// client with Timeout set from TimeoutMs.
	HTTPClient *http.Client
	// TimeoutMs is the per-request timeout in milliseconds. Defaults to 30000.
	// Ignored when HTTPClient is supplied.
	TimeoutMs int
}

// X402Client is a non-custodial client for x402 agent-to-agent payments. Charge
// (payee) asks for a payment; Pay (payer) signs and settles it with the
// customer's own key. Mirrors the Node SDK's X402Client.
type X402Client struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
}

// NewX402Client builds an X402Client. With zero options it reads PRIMITIVE_API_KEY
// from the environment and targets the production host.
func NewX402Client(options X402ClientOptions) *X402Client {
	apiKey := options.APIKey
	if apiKey == "" {
		apiKey = os.Getenv("PRIMITIVE_API_KEY")
	}
	baseURL := options.BaseURL
	if baseURL == "" {
		baseURL = DefaultX402BaseURL
	}
	baseURL = strings.TrimRight(baseURL, "/")

	httpClient := options.HTTPClient
	if httpClient == nil {
		timeout := time.Duration(options.TimeoutMs) * time.Millisecond
		if options.TimeoutMs == 0 {
			timeout = 30 * time.Second
		}
		httpClient = &http.Client{Timeout: timeout}
	}

	return &X402Client{apiKey: apiKey, baseURL: baseURL, httpClient: httpClient}
}

// request performs an authenticated JSON request and unmarshals data from the
// {success, data} envelope into out. Mirrors the Node SDK's #request, including
// the status-0 transport error and Retry-After surfacing. Any entries in headers
// are set on the outgoing request (e.g. Idempotency-Key on Charge).
func (c *X402Client) request(ctx context.Context, method, path string, body any, out any, headers map[string]string) error {
	if c.apiKey == "" {
		return newX402Error("no API key configured; set PRIMITIVE_API_KEY or pass APIKey to the client", 0)
	}

	var reqBody io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return newX402Error(fmt.Sprintf("failed to encode request body: %v", err), 0)
		}
		reqBody = bytes.NewReader(encoded)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reqBody)
	if err != nil {
		return newX402Error(fmt.Sprintf("failed to build request to %s: %v", path, err), 0)
	}
	req.Header.Set("authorization", "Bearer "+c.apiKey)
	req.Header.Set("content-type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	res, err := c.httpClient.Do(req)
	if err != nil {
		// A failed round-trip (DNS, connection refused, TLS, timeout/context
		// cancel) must not escape as a raw error: callers rely on
		// errors.As(&X402Error), and on Pay a status-0 error signals an
		// indeterminate (maybe-unsent) request.
		return &X402Error{
			Message: fmt.Sprintf("request to %s failed: %v", path, err),
			Status:  0,
			Cause:   err,
		}
	}
	defer res.Body.Close()

	retryAfter := res.Header.Get("retry-after")
	text, _ := io.ReadAll(res.Body)

	var envelope struct {
		Success *bool           `json:"success"`
		Data    json.RawMessage `json:"data"`
		Error   *struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	hasJSON := false
	if len(bytes.TrimSpace(text)) > 0 {
		if err := json.Unmarshal(text, &envelope); err != nil {
			return &X402Error{
				Message:    fmt.Sprintf("non-JSON response (%d) from %s: %s", res.StatusCode, path, truncate(string(text), 200)),
				Status:     res.StatusCode,
				Body:       truncate(string(text), 500),
				RetryAfter: retryAfter,
			}
		}
		hasJSON = true
	}

	if res.StatusCode < 200 || res.StatusCode >= 300 || (envelope.Success != nil && !*envelope.Success) {
		msg := fmt.Sprintf("request failed with %d", res.StatusCode)
		if envelope.Error != nil && envelope.Error.Message != "" {
			msg = envelope.Error.Message
		}
		var bodyVal any = truncate(string(text), 500)
		if hasJSON {
			bodyVal = json.RawMessage(text)
		}
		return &X402Error{Message: msg, Status: res.StatusCode, Body: bodyVal, RetryAfter: retryAfter}
	}

	if !hasJSON || envelope.Success == nil || !*envelope.Success || envelope.Data == nil {
		return &X402Error{
			Message:    fmt.Sprintf("unexpected response shape (%d) from %s: missing success/data envelope", res.StatusCode, path),
			Status:     res.StatusCode,
			RetryAfter: retryAfter,
		}
	}

	if out != nil {
		if err := json.Unmarshal(envelope.Data, out); err != nil {
			return &X402Error{
				Message: fmt.Sprintf("failed to decode response data from %s: %v", path, err),
				Status:  res.StatusCode,
			}
		}
	}
	return nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

// Charge requests a payment (payee side). Returns the challenge to hand to the
// payer. POST /v1/x402/challenges.
func (c *X402Client) Charge(ctx context.Context, input X402ChargeInput) (*X402Challenge, error) {
	// Require exactly one of Amount (base units) or AmountUsdc (human USDC).
	if input.Amount != "" && input.AmountUsdc != "" {
		return nil, newX402Error("charge takes exactly one of Amount (base units) or AmountUsdc (human USDC), not both", 0)
	}
	if input.Amount == "" && input.AmountUsdc == "" {
		return nil, newX402Error(`charge requires Amount as a positive integer string in token base units (e.g. "10000"), or AmountUsdc as a positive USDC amount with at most 6 decimals (e.g. "0.01")`, 0)
	}
	amount := input.Amount
	if input.AmountUsdc != "" {
		converted, err := usdcToBaseUnits(input.AmountUsdc)
		if err != nil {
			return nil, newX402Error("charge: "+err.Error(), 0)
		}
		amount = converted
	}
	if !x402AmountRe.MatchString(amount) {
		return nil, newX402Error(`charge requires Amount as a positive integer string in token base units, e.g. "10000"`, 0)
	}
	network := input.Network
	if network == "" {
		network = "base-sepolia"
	}
	body := map[string]any{
		"amount":  amount,
		"network": network,
	}
	if input.PayerOrg != "" {
		body["payer_org"] = input.PayerOrg
	}
	if input.Description != "" {
		body["description"] = input.Description
	}
	if input.Resource != "" {
		body["resource"] = input.Resource
	}
	if input.ExpiresIn != nil {
		body["expires_in"] = *input.ExpiresIn
	}

	// An idempotency key (when set) goes on the HTTP header, never in the body:
	// retrying with the same key returns the original challenge instead of
	// creating a duplicate. Mirrors the Node SDK.
	var headers map[string]string
	if input.IdempotencyKey != "" {
		headers = map[string]string{"Idempotency-Key": input.IdempotencyKey}
	}

	var challenge X402Challenge
	if err := c.request(ctx, http.MethodPost, "/v1/x402/challenges", body, &challenge, headers); err != nil {
		return nil, err
	}
	return &challenge, nil
}

// CreateEmailChallenge issues a payment challenge over an email thread (payee
// side). Sends the challenge as an email from From to To and binds the payment
// to that thread. Returns the challenge (including the real InteractionID);
// deliver it to the payer, who calls PayEmailChallenge to build the signed
// payment step. Provide exactly one of Amount (base units) or AmountUsdc (human
// USDC). POST /v1/x402/email-challenges.
func (c *X402Client) CreateEmailChallenge(ctx context.Context, input X402EmailChargeInput) (*X402EmailChallenge, error) {
	if input.From == "" {
		return nil, newX402Error("createEmailChallenge requires From", 0)
	}
	if input.To == "" {
		return nil, newX402Error("createEmailChallenge requires To", 0)
	}
	if input.Amount != "" && input.AmountUsdc != "" {
		return nil, newX402Error("createEmailChallenge takes exactly one of Amount (base units) or AmountUsdc (human USDC), not both", 0)
	}
	if input.Amount == "" && input.AmountUsdc == "" {
		return nil, newX402Error(`createEmailChallenge requires Amount as a positive integer string in token base units (e.g. "10000"), or AmountUsdc as a positive USDC amount with at most 6 decimals (e.g. "0.01")`, 0)
	}
	amount := input.Amount
	if input.AmountUsdc != "" {
		converted, err := usdcToBaseUnits(input.AmountUsdc)
		if err != nil {
			return nil, newX402Error("createEmailChallenge: "+err.Error(), 0)
		}
		amount = converted
	}
	if !x402AmountRe.MatchString(amount) {
		return nil, newX402Error(`createEmailChallenge requires Amount as a positive integer string in token base units, e.g. "10000"`, 0)
	}
	network := input.Network
	if network == "" {
		network = "base-sepolia"
	}
	body := map[string]any{
		"from":    input.From,
		"to":      input.To,
		"amount":  amount,
		"network": network,
	}
	if input.Description != "" {
		body["description"] = input.Description
	}
	if input.Resource != "" {
		body["resource"] = input.Resource
	}
	if input.ExpiresIn != nil {
		body["expires_in"] = *input.ExpiresIn
	}

	var headers map[string]string
	if input.IdempotencyKey != "" {
		headers = map[string]string{"Idempotency-Key": input.IdempotencyKey}
	}

	var challenge X402EmailChallenge
	if err := c.request(ctx, http.MethodPost, "/v1/x402/email-challenges", body, &challenge, headers); err != nil {
		return nil, err
	}
	return &challenge, nil
}

// validatePaymentRequirements asserts the x402 PaymentRequirements shared by
// both challenge shapes is fully hydrated. bad wraps the field name into a named
// X402Error.
func validatePaymentRequirements(pr X402PaymentRequirements, bad func(string) error) error {
	if pr.MaxAmountRequired == "" {
		return bad("payment_requirements.maxAmountRequired")
	}
	if !x402AmountRe.MatchString(pr.MaxAmountRequired) {
		return bad("payment_requirements.maxAmountRequired (expected a positive integer string in token base units)")
	}
	if !x402AddressRe.MatchString(pr.PayTo) {
		return bad("payment_requirements.payTo (expected a 0x address)")
	}
	if !x402AddressRe.MatchString(pr.Asset) {
		return bad("payment_requirements.asset (expected a 0x address)")
	}
	if pr.Extra.Name == "" || pr.Extra.Version == "" {
		return bad("payment_requirements.extra (name/version)")
	}
	return nil
}

// validateChallenge asserts a challenge is fully hydrated before signing, so a
// missing field fails with a named X402Error instead of an opaque crypto error
// mid-sign. Mirrors the Node SDK's validateChallenge.
func validateChallenge(ch *X402Challenge) error {
	bad := func(field string) error {
		return newX402Error("challenge is missing or malformed: "+field, 0)
	}
	if ch == nil {
		return bad("challenge")
	}
	if ch.ID == "" {
		return bad("id")
	}
	if ch.Network == "" {
		return bad("network")
	}
	if ch.ExpiresAt == "" {
		return bad("expires_at")
	}
	nb := ch.NonceBinding
	if nb.InteractionID == "" || nb.ChallengeStepID == "" || nb.ChallengeNonce == "" {
		return bad("nonce_binding")
	}
	return validatePaymentRequirements(ch.PaymentRequirements, bad)
}

// validateEmailChallenge asserts an email-native challenge is fully hydrated
// before signing, so a missing field fails with a named X402Error instead of an
// opaque crypto error mid-sign.
func validateEmailChallenge(ch *X402EmailChallenge) error {
	bad := func(field string) error {
		return newX402Error("email challenge is missing or malformed: "+field, 0)
	}
	if ch == nil {
		return bad("email challenge")
	}
	if ch.InteractionID == "" {
		return bad("interaction_id")
	}
	d := ch.Challenge
	if d.ExpiresAt == "" {
		return bad("challenge.expires_at")
	}
	nb := d.NonceBinding
	if nb.InteractionID == "" || nb.ChallengeStepID == "" || nb.ChallengeNonce == "" {
		return bad("challenge.nonce_binding")
	}
	// The envelope's interaction_id must agree with the binding's, or the
	// platform would re-derive a nonce that doesn't match what we signed.
	if nb.InteractionID != ch.InteractionID {
		return bad("interaction_id (mismatch with challenge.nonce_binding.interaction_id)")
	}
	return validatePaymentRequirements(d.PaymentRequirements, bad)
}

// PayEmailChallenge builds the signed payment step for an email-native challenge
// (payer side). Given a received X402EmailChallenge and the caller's signer, it
// derives the interaction-bound authorization, signs it locally, and returns the
// signed interaction.json payment-step envelope plus its canonical JSON bytes.
// It does NOT send anything.
//
// The caller sends BuiltPaymentStep.JSON back as an interaction.json attachment
// on a reply to the challenge email; the platform reads the envelope from those
// exact bytes, re-derives the bound nonce, and settles.
func (c *X402Client) PayEmailChallenge(challenge *X402EmailChallenge, signer X402Signer) (*BuiltPaymentStep, error) {
	if signer == nil || signer.Address() == "" {
		return nil, newX402Error("payEmailChallenge requires a signer with a non-empty Address (e.g. a PrivateKeySigner)", 0)
	}
	if err := validateEmailChallenge(challenge); err != nil {
		return nil, err
	}
	d := challenge.Challenge
	pr := d.PaymentRequirements
	network := pr.Network
	chainID, ok := x402ChainIDs[network]
	if !ok {
		return nil, newX402Error("unsupported network: "+network, 0)
	}
	if pr.Scheme != "exact" {
		return nil, newX402Error("unsupported payment scheme: "+pr.Scheme, 0)
	}

	nowSec := time.Now().Unix()
	expiresAt, err := time.Parse(time.RFC3339Nano, d.ExpiresAt)
	if err != nil {
		return nil, newX402Error("challenge has an invalid expires_at: "+d.ExpiresAt, 0)
	}
	expiresAtSec := expiresAt.Unix()
	if expiresAtSec <= nowSec {
		return nil, newX402Error(
			"challenge has already expired (expires_at "+d.ExpiresAt+"); not signing", 0)
	}

	value, ok := new(big.Int).SetString(pr.MaxAmountRequired, 10)
	if !ok {
		return nil, newX402Error("payment_requirements.maxAmountRequired is not an integer: "+pr.MaxAmountRequired, 0)
	}
	validAfter, validBefore, err := ComputePaymentValidityWindow(ValidityWindowInput{
		ChallengeExpiresAtSec: expiresAtSec,
		NowSec:                nowSec,
	})
	if err != nil {
		return nil, newX402Error(err.Error(), 0)
	}

	auth, signature, err := SignInteractionPayment(SignInteractionPaymentInput{
		Sign:  signer.SignTypedData,
		Payer: signer.Address(),
		Domain: TokenDomain{
			Name:              pr.Extra.Name,
			Version:           pr.Extra.Version,
			ChainID:           chainID,
			VerifyingContract: pr.Asset,
		},
		PayTo:  pr.PayTo,
		Amount: value,
		NonceBinding: NonceBinding{
			InteractionID:   d.NonceBinding.InteractionID,
			ChallengeStepID: d.NonceBinding.ChallengeStepID,
			ChallengeNonce:  d.NonceBinding.ChallengeNonce,
		},
		ValidAfter:  validAfter,
		ValidBefore: validBefore,
	})
	if err != nil {
		return nil, newX402Error("failed to sign authorization: "+err.Error(), 0)
	}

	payment, err := BuildExactEvmPaymentPayload(network, auth, signature)
	if err != nil {
		return nil, newX402Error("failed to build payment payload: "+err.Error(), 0)
	}

	// A fresh UUID identifies the payment step; PrevStepID binds it to the
	// challenge step so the platform threads the interaction correctly.
	built, err := BuildPaymentStepEnvelope(BuildPaymentStepEnvelopeInput{
		InteractionID: challenge.InteractionID,
		StepID:        uuid.NewString(),
		PrevStepID:    d.NonceBinding.ChallengeStepID,
		Payment:       payment,
	})
	if err != nil {
		return nil, newX402Error("failed to build payment step envelope: "+err.Error(), 0)
	}
	return &built, nil
}

// Pay pays a challenge (payer side). Derives the interaction-bound
// authorization, signs it locally with the caller's key, and submits it for
// settlement. POST /v1/x402/challenges/{id}/pay.
func (c *X402Client) Pay(ctx context.Context, challenge *X402Challenge, signer X402Signer) (*X402Receipt, error) {
	if signer == nil || signer.Address() == "" {
		return nil, newX402Error("pay requires a signer with a non-empty Address (e.g. a PrivateKeySigner)", 0)
	}
	if err := validateChallenge(challenge); err != nil {
		return nil, err
	}
	chainID, ok := x402ChainIDs[challenge.Network]
	if !ok {
		return nil, newX402Error("unsupported network: "+challenge.Network, 0)
	}
	pr := challenge.PaymentRequirements
	// The chainId is derived from challenge.Network but the token domain
	// (contract/name/version) comes from payment_requirements; cross-check they
	// agree so we never sign a chainId mismatched to the asset.
	if pr.Network != challenge.Network {
		return nil, newX402Error(
			fmt.Sprintf("challenge network mismatch: %s vs payment_requirements %s", challenge.Network, pr.Network), 0)
	}
	if pr.Scheme != "exact" {
		return nil, newX402Error("unsupported payment scheme: "+pr.Scheme, 0)
	}

	nowSec := time.Now().Unix()
	// The server sends millisecond-precision ISO-8601 (e.g. "...T00:00:00.000Z"),
	// so parse with RFC3339Nano to make the fractional-second intent explicit.
	expiresAt, err := time.Parse(time.RFC3339Nano, challenge.ExpiresAt)
	if err != nil {
		return nil, newX402Error("challenge has an invalid expires_at: "+challenge.ExpiresAt, 0)
	}
	expiresAtSec := expiresAt.Unix()
	// Refuse a challenge that's already past its expires_at. Check expires_at
	// itself, NOT validBefore (which carries the settlement margin), so a
	// challenge that expired within the last settlement margin is still caught.
	if expiresAtSec <= nowSec {
		return nil, newX402Error(
			"challenge has already expired (expires_at "+challenge.ExpiresAt+"); not signing", 0)
	}

	value, ok := new(big.Int).SetString(pr.MaxAmountRequired, 10)
	if !ok {
		return nil, newX402Error("payment_requirements.maxAmountRequired is not an integer: "+pr.MaxAmountRequired, 0)
	}
	validAfter, validBefore, err := ComputePaymentValidityWindow(ValidityWindowInput{
		ChallengeExpiresAtSec: expiresAtSec,
		NowSec:                nowSec,
	})
	if err != nil {
		return nil, newX402Error(err.Error(), 0)
	}

	auth, signature, err := SignInteractionPayment(SignInteractionPaymentInput{
		Sign:  signer.SignTypedData,
		Payer: signer.Address(),
		Domain: TokenDomain{
			Name:              pr.Extra.Name,
			Version:           pr.Extra.Version,
			ChainID:           chainID,
			VerifyingContract: pr.Asset,
		},
		PayTo:  pr.PayTo,
		Amount: value,
		NonceBinding: NonceBinding{
			InteractionID:   challenge.NonceBinding.InteractionID,
			ChallengeStepID: challenge.NonceBinding.ChallengeStepID,
			ChallengeNonce:  challenge.NonceBinding.ChallengeNonce,
		},
		ValidAfter:  validAfter,
		ValidBefore: validBefore,
	})
	if err != nil {
		return nil, newX402Error("failed to sign authorization: "+err.Error(), 0)
	}

	payment, err := BuildExactEvmPaymentPayload(challenge.Network, auth, signature)
	if err != nil {
		return nil, newX402Error("failed to build payment payload: "+err.Error(), 0)
	}
	body := map[string]any{"payment": payment}
	var receipt X402Receipt
	if err := c.request(ctx, http.MethodPost, "/v1/x402/challenges/"+challenge.ID+"/pay", body, &receipt, nil); err != nil {
		return nil, err
	}
	return &receipt, nil
}

// GetChallenge fetches a challenge by id (scoped to the challenger org that
// created it). GET /v1/x402/challenges/{id}.
func (c *X402Client) GetChallenge(ctx context.Context, id string) (*X402Challenge, error) {
	if id == "" {
		return nil, newX402Error("getChallenge requires a challenge id", 0)
	}
	var challenge X402Challenge
	if err := c.request(ctx, http.MethodGet, "/v1/x402/challenges/"+escapePathSegment(id), nil, &challenge, nil); err != nil {
		return nil, err
	}
	return &challenge, nil
}

// resolveOrgID resolves the caller's own organization id from the account
// endpoint (GET /v1/account, reading data.id). Mirrors the Node SDK's
// resolveOrgId. Returns an error if the id is missing.
func (c *X402Client) resolveOrgID(ctx context.Context) (string, error) {
	var account struct {
		ID string `json:"id"`
	}
	if err := c.request(ctx, http.MethodGet, "/v1/account", nil, &account, nil); err != nil {
		return "", err
	}
	if account.ID == "" {
		return "", newX402Error("could not resolve your organization id from /v1/account; pass Org explicitly", 0)
	}
	return account.ID, nil
}

// RegisterPayoutAddress registers a payout address for your org (payee side).
// The signer proves control of its own address with an org-bound personal_sign;
// the proven address becomes (or updates to) the default payout destination for
// the network. POST /v1/x402/payout-addresses.
//
// Org is optional: when input.Org is empty it is resolved from your
// authenticated account (GET /v1/account), so most callers never need to supply
// it.
func (c *X402Client) RegisterPayoutAddress(ctx context.Context, input X402PayoutRegistrationInput, signer X402Signer) (*X402PayoutAddress, error) {
	if signer == nil || signer.Address() == "" {
		return nil, newX402Error("registerPayoutAddress requires a signer with a non-empty Address", 0)
	}
	org := input.Org
	if org == "" {
		resolved, err := c.resolveOrgID(ctx)
		if err != nil {
			return nil, err
		}
		org = resolved
	}
	network := input.Network
	if network == "" {
		network = "base-sepolia"
	}
	issuedAt := input.IssuedAt
	if issuedAt == "" {
		issuedAt = time.Now().UTC().Format("2006-01-02T15:04:05.000Z07:00")
	}
	address := signer.Address()
	message := BuildPayoutRegistrationMessage(org, address, network, issuedAt)
	signature, err := signer.SignMessage(message)
	if err != nil {
		return nil, newX402Error("failed to sign payout registration message: "+err.Error(), 0)
	}

	body := map[string]any{
		"address":   address,
		"network":   network,
		"signature": signature,
		"issued_at": issuedAt,
	}
	if input.Label != nil {
		body["label"] = *input.Label
	}

	var payout X402PayoutAddress
	if err := c.request(ctx, http.MethodPost, "/v1/x402/payout-addresses", body, &payout, nil); err != nil {
		return nil, err
	}
	return &payout, nil
}

// ListPayoutAddresses lists your org's registered payout addresses.
// GET /v1/x402/payout-addresses.
func (c *X402Client) ListPayoutAddresses(ctx context.Context) ([]X402PayoutAddress, error) {
	var addresses []X402PayoutAddress
	if err := c.request(ctx, http.MethodGet, "/v1/x402/payout-addresses", nil, &addresses, nil); err != nil {
		return nil, err
	}
	return addresses, nil
}

// ListDeclinedPayments lists the most recent payments your org's spend policy
// refused (newest first). Use it to see why an outbound payment was declined.
// GET /v1/x402/declined-payments.
func (c *X402Client) ListDeclinedPayments(ctx context.Context) ([]X402DeclinedPayment, error) {
	var declined []X402DeclinedPayment
	if err := c.request(ctx, http.MethodGet, "/v1/x402/declined-payments", nil, &declined, nil); err != nil {
		return nil, err
	}
	return declined, nil
}

// GetSpendPolicy reads your org's spend policy (kill-switch + caps + allowlist).
// GET /v1/x402/spend-policy.
func (c *X402Client) GetSpendPolicy(ctx context.Context) (*X402SpendPolicy, error) {
	var policy X402SpendPolicy
	if err := c.request(ctx, http.MethodGet, "/v1/x402/spend-policy", nil, &policy, nil); err != nil {
		return nil, err
	}
	return &policy, nil
}

// SetSpendPolicy updates your org's spend policy. The endpoint is a PUT, but the
// server applies it as a merge: only the fields you set are changed and omitted
// fields keep their current value, so a partial update can't silently reset the
// kill-switch. Use ClearMaxPerPayment / ClearMaxPerDay to remove a cap.
// PUT /v1/x402/spend-policy.
func (c *X402Client) SetSpendPolicy(ctx context.Context, update X402SpendPolicyUpdate) (*X402SpendPolicy, error) {
	var policy X402SpendPolicy
	if err := c.request(ctx, http.MethodPut, "/v1/x402/spend-policy", update.body(), &policy, nil); err != nil {
		return nil, err
	}
	return &policy, nil
}

// escapePathSegment percent-encodes a single path segment the way the Node SDK's
// encodeURIComponent does for the challenge id, without pulling in net/url for
// the common case. It encodes everything outside the unreserved set.
func escapePathSegment(s string) string {
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		ch := s[i]
		if (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') ||
			(ch >= '0' && ch <= '9') ||
			ch == '-' || ch == '_' || ch == '.' || ch == '~' {
			b.WriteByte(ch)
		} else {
			b.WriteString(fmt.Sprintf("%%%02X", ch))
		}
	}
	return b.String()
}

// compile-time check that PrivateKeySigner satisfies X402Signer.
var _ X402Signer = (*PrivateKeySigner)(nil)
