package primitive

import (
	"context"
	"encoding/json"
	"errors"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/common/hexutil"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/signer/core/apitypes"
)

// Canonical binding + the NORMATIVE nonce the platform verifier recomputes. This
// value MUST stay identical to the server's vector (and the Node SDK's
// sign.test.ts), or every payment fails verification.
const (
	canonicalInteractionID   = "a1b2c3d4-0000-0000-0000-000000000001@payer.example"
	canonicalChallengeStepID = "f00dface-0000-0000-0000-0000000000aa"
	canonicalChallengeNonce  = "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899"
	normativeNonce           = "0xc955a08812ab83f9e25c92e5162267b913957c3cc8678de1cf1449f77b516c6e"
)

func canonicalBinding() NonceBinding {
	return NonceBinding{
		InteractionID:   canonicalInteractionID,
		ChallengeStepID: canonicalChallengeStepID,
		ChallengeNonce:  canonicalChallengeNonce,
	}
}

func TestDeriveEIP3009Nonce_NormativeVector(t *testing.T) {
	got, err := DeriveEIP3009Nonce(canonicalBinding())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != normativeNonce {
		t.Fatalf("nonce mismatch:\n got  %s\n want %s", got, normativeNonce)
	}
}

func TestDeriveEIP3009Nonce_CaseInsensitiveIdentifiers(t *testing.T) {
	b := canonicalBinding()
	b.InteractionID = strings.ToUpper(b.InteractionID)
	b.ChallengeStepID = strings.ToUpper(b.ChallengeStepID)
	got, err := DeriveEIP3009Nonce(b)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != normativeNonce {
		t.Fatalf("uppercased identifiers should produce the same nonce: got %s", got)
	}
}

func TestDeriveEIP3009Nonce_ChangesWithBinding(t *testing.T) {
	b := canonicalBinding()
	b.ChallengeStepID = "f00dface-0000-0000-0000-0000000000ab"
	got, err := DeriveEIP3009Nonce(b)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got == normativeNonce {
		t.Fatal("changing a binding field should change the nonce")
	}
}

func TestDeriveEIP3009Nonce_RejectsMalformedNonce(t *testing.T) {
	for _, bad := range []string{"xyz", strings.ToUpper(canonicalChallengeNonce)} {
		b := canonicalBinding()
		b.ChallengeNonce = bad
		if _, err := DeriveEIP3009Nonce(b); err == nil {
			t.Fatalf("expected error for malformed nonce %q", bad)
		}
	}
}

func TestBuildPayoutRegistrationMessage_ByteIdentical(t *testing.T) {
	msg := BuildPayoutRegistrationMessage(
		"11111111-1111-4111-8111-111111111111",
		"0x2222222222222222222222222222222222222222",
		"base-sepolia",
		"2026-01-01T00:00:00.000Z",
	)
	want := "Primitive x402 payout address authorization\n\n" +
		"I authorize this address as a payout destination for my Primitive organization.\n\n" +
		"org: 11111111-1111-4111-8111-111111111111\n" +
		"address: 0x2222222222222222222222222222222222222222\n" +
		"network: base-sepolia\n" +
		"issued: 2026-01-01T00:00:00.000Z"
	if msg != want {
		t.Fatalf("payout message mismatch:\n got  %q\n want %q", msg, want)
	}
}

func TestBuildPayoutRegistrationMessage_LowercasesAddress(t *testing.T) {
	msg := BuildPayoutRegistrationMessage("o", "0xAbCdEf0000000000000000000000000000000000", "base", "t")
	if !strings.Contains(msg, "address: 0xabcdef0000000000000000000000000000000000") {
		t.Fatalf("address not lowercased in message: %q", msg)
	}
}

// The canonical anvil/hardhat test key and its address. Used to prove signatures
// recover to the expected signer.
const (
	testPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
	testAddress    = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
)

func TestPrivateKeySigner_Address(t *testing.T) {
	s, err := NewPrivateKeySigner(testPrivateKey)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if s.Address() != testAddress {
		t.Fatalf("address mismatch:\n got  %s\n want %s", s.Address(), testAddress)
	}
	// also accepts the key without the 0x prefix
	s2, err := NewPrivateKeySigner(strings.TrimPrefix(testPrivateKey, "0x"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if s2.Address() != testAddress {
		t.Fatalf("address mismatch (no 0x prefix): got %s", s2.Address())
	}
}

// recoverPersonalSign recovers the signer address from a personal_sign signature.
func recoverPersonalSign(t *testing.T, message, sigHex string) string {
	t.Helper()
	sig, err := hexutil.Decode(sigHex)
	if err != nil {
		t.Fatalf("bad signature hex: %v", err)
	}
	if len(sig) != 65 {
		t.Fatalf("expected 65-byte signature, got %d", len(sig))
	}
	if sig[64] >= 27 {
		sig[64] -= 27
	}
	digest := ethcrypto.Keccak256([]byte("\x19Ethereum Signed Message:\n" + strconv.Itoa(len(message)) + message))
	pub, err := ethcrypto.SigToPub(digest, sig)
	if err != nil {
		t.Fatalf("failed to recover pubkey: %v", err)
	}
	return ethcrypto.PubkeyToAddress(*pub).Hex()
}

func TestPrivateKeySigner_PersonalSignRoundTrip(t *testing.T) {
	s, err := NewPrivateKeySigner(testPrivateKey)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	message := BuildPayoutRegistrationMessage(
		"11111111-1111-4111-8111-111111111111",
		s.Address(),
		"base-sepolia",
		"2026-01-01T00:00:00.000Z",
	)
	sig, err := s.SignMessage(message)
	if err != nil {
		t.Fatalf("sign failed: %v", err)
	}
	if !strings.HasPrefix(sig, "0x") {
		t.Fatalf("signature should be 0x-prefixed: %s", sig)
	}
	recovered := recoverPersonalSign(t, message, sig)
	if recovered != testAddress {
		t.Fatalf("personal_sign did not round-trip:\n got  %s\n want %s", recovered, testAddress)
	}
}

func TestPrivateKeySigner_EIP712RoundTrip(t *testing.T) {
	s, err := NewPrivateKeySigner(testPrivateKey)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	auth := TransferAuthorization{
		From:        s.Address(),
		To:          "0x1111111111111111111111111111111111111111",
		Value:       big.NewInt(10000),
		ValidAfter:  big.NewInt(1),
		ValidBefore: big.NewInt(99999),
		Nonce:       normativeNonce,
	}
	td := transferWithAuthorizationTypedData(TokenDomain{
		Name:              "USDC",
		Version:           "2",
		ChainID:           84532,
		VerifyingContract: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
	}, auth)

	sigHex, err := s.SignTypedData(td)
	if err != nil {
		t.Fatalf("sign typed data failed: %v", err)
	}

	// Recompute the EIP-712 digest and recover the signer.
	digest, _, err := apitypes.TypedDataAndHash(td)
	if err != nil {
		t.Fatalf("hash typed data failed: %v", err)
	}
	sig, err := hexutil.Decode(sigHex)
	if err != nil {
		t.Fatalf("bad signature hex: %v", err)
	}
	if len(sig) != 65 {
		t.Fatalf("expected 65-byte signature, got %d", len(sig))
	}
	if sig[64] >= 27 {
		sig[64] -= 27
	}
	pub, err := ethcrypto.SigToPub(digest, sig)
	if err != nil {
		t.Fatalf("recover failed: %v", err)
	}
	recovered := ethcrypto.PubkeyToAddress(*pub).Hex()
	if recovered != testAddress {
		t.Fatalf("EIP-712 signature did not round-trip:\n got  %s\n want %s", recovered, testAddress)
	}
}

func TestComputePaymentValidityWindow_ExpiryPlusMarginAndNowMinusSkew(t *testing.T) {
	va, vb, err := ComputePaymentValidityWindow(ValidityWindowInput{
		ChallengeExpiresAtSec: 2000,
		NowSec:                1000,
		SettlementMarginSec:   300,
		ClockSkewSec:          120,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if vb.Cmp(big.NewInt(2300)) != 0 {
		t.Fatalf("validBefore: got %s want 2300", vb)
	}
	if va.Cmp(big.NewInt(880)) != 0 {
		t.Fatalf("validAfter: got %s want 880", va)
	}
}

func TestComputePaymentValidityWindow_Defaults(t *testing.T) {
	va, vb, err := ComputePaymentValidityWindow(ValidityWindowInput{
		ChallengeExpiresAtSec: 2000,
		NowSec:                1000,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if vb.Cmp(big.NewInt(2300)) != 0 {
		t.Fatalf("validBefore: got %s want 2300", vb)
	}
	if va.Cmp(big.NewInt(700)) != 0 {
		t.Fatalf("validAfter: got %s want 700", va)
	}
}

func TestComputePaymentValidityWindow_Degenerate(t *testing.T) {
	_, _, err := ComputePaymentValidityWindow(ValidityWindowInput{
		ChallengeExpiresAtSec: 1000,
		NowSec:                100000,
		SettlementMarginSec:   60,
		ClockSkewSec:          60,
	})
	if err == nil {
		t.Fatal("expected an error for a degenerate window")
	}
	if !strings.Contains(err.Error(), "invalid validity window") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestComputePaymentValidityWindow_ExceedsCap(t *testing.T) {
	_, _, err := ComputePaymentValidityWindow(ValidityWindowInput{
		ChallengeExpiresAtSec: 1000 + 48*60*60,
		NowSec:                1000,
	})
	if err == nil {
		t.Fatal("expected an error for an over-cap window")
	}
	if !strings.Contains(err.Error(), "exceeds the") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestSignInteractionPayment_InjectsBoundNonce(t *testing.T) {
	s, err := NewPrivateKeySigner(testPrivateKey)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	domain := TokenDomain{
		Name:              "USDC",
		Version:           "2",
		ChainID:           84532,
		VerifyingContract: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
	}
	auth, sigHex, err := SignInteractionPayment(SignInteractionPaymentInput{
		Sign:         s.SignTypedData,
		Payer:        s.Address(),
		Domain:       domain,
		PayTo:        "0x1111111111111111111111111111111111111111",
		Amount:       big.NewInt(10000),
		NonceBinding: canonicalBinding(),
		ValidAfter:   big.NewInt(1),
		ValidBefore:  big.NewInt(99999999),
	})
	if err != nil {
		t.Fatalf("sign failed: %v", err)
	}
	// The bound nonce for the canonical binding is the locked normative vector.
	if auth.Nonce != normativeNonce {
		t.Fatalf("nonce mismatch:\n got  %s\n want %s", auth.Nonce, normativeNonce)
	}
	if auth.From != s.Address() {
		t.Fatalf("from: got %s want %s", auth.From, s.Address())
	}
	if auth.Value.Cmp(big.NewInt(10000)) != 0 {
		t.Fatalf("value: got %s want 10000", auth.Value)
	}

	// The signature recovers to the signer.
	td := transferWithAuthorizationTypedData(domain, auth)
	digest, _, err := apitypes.TypedDataAndHash(td)
	if err != nil {
		t.Fatalf("hash typed data failed: %v", err)
	}
	sig, err := hexutil.Decode(sigHex)
	if err != nil {
		t.Fatalf("bad signature hex: %v", err)
	}
	if sig[64] >= 27 {
		sig[64] -= 27
	}
	pub, err := ethcrypto.SigToPub(digest, sig)
	if err != nil {
		t.Fatalf("recover failed: %v", err)
	}
	if recovered := ethcrypto.PubkeyToAddress(*pub).Hex(); recovered != testAddress {
		t.Fatalf("signature did not recover to the payer:\n got  %s\n want %s", recovered, testAddress)
	}
}

func TestBuildExactEvmPaymentPayload_WrapsWithVersionAndDecimalStrings(t *testing.T) {
	auth := TransferAuthorization{
		From:        "0x2222222222222222222222222222222222222222",
		To:          "0x1111111111111111111111111111111111111111",
		Value:       big.NewInt(10000),
		ValidAfter:  big.NewInt(1),
		ValidBefore: big.NewInt(99999),
		Nonce:       normativeNonce,
	}
	sig := "0x" + strings.Repeat("ab", 65)
	p, err := BuildExactEvmPaymentPayload("base-sepolia", auth, sig)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if p.X402Version != 1 || p.Scheme != "exact" || p.Network != "base-sepolia" {
		t.Fatalf("unexpected envelope: %+v", p)
	}
	if p.Payload.Signature != sig {
		t.Fatalf("signature: got %s", p.Payload.Signature)
	}
	if p.Payload.Authorization.Value != "10000" {
		t.Fatalf("value: got %s want 10000", p.Payload.Authorization.Value)
	}
	if p.Payload.Authorization.ValidAfter != "1" || p.Payload.Authorization.ValidBefore != "99999" {
		t.Fatalf("window strings: %+v", p.Payload.Authorization)
	}
	if p.Payload.Authorization.Nonce != normativeNonce {
		t.Fatalf("nonce: got %s", p.Payload.Authorization.Nonce)
	}
}

func TestBuildExactEvmPaymentPayload_RejectsMalformedInputs(t *testing.T) {
	auth := TransferAuthorization{
		From:        "0x2222222222222222222222222222222222222222",
		To:          "0x1111111111111111111111111111111111111111",
		Value:       big.NewInt(10000),
		ValidAfter:  big.NewInt(1),
		ValidBefore: big.NewInt(99999),
		Nonce:       normativeNonce,
	}
	goodSig := "0x" + strings.Repeat("ab", 65)
	if _, err := BuildExactEvmPaymentPayload("ethereum", auth, goodSig); err == nil {
		t.Fatal("expected an error for an unsupported network")
	}
	if _, err := BuildExactEvmPaymentPayload("base-sepolia", auth, "not-hex"); err == nil {
		t.Fatal("expected an error for a malformed signature")
	}
	bad := auth
	bad.Nonce = "0xdeadbeef"
	if _, err := BuildExactEvmPaymentPayload("base-sepolia", bad, goodSig); err == nil {
		t.Fatal("expected an error for a malformed nonce")
	}
}

// ---------------------------------------------------------------------------
// Client tests
// ---------------------------------------------------------------------------

func sampleChallenge() *X402Challenge {
	ch := &X402Challenge{
		ID:      "11111111-1111-4111-8111-111111111111",
		Network: "base-sepolia",
		Amount:  "10000",
		PayTo:   "0x1111111111111111111111111111111111111111",
		NonceBinding: X402NonceBinding{
			InteractionID:   "11111111-1111-4111-8111-111111111111@x402.primitive",
			ChallengeStepID: "f00dface-0000-0000-0000-0000000000aa",
			ChallengeNonce:  canonicalChallengeNonce,
		},
		ExpiresAt: time.Now().Add(time.Hour).UTC().Format(time.RFC3339),
	}
	ch.PaymentRequirements.Scheme = "exact"
	ch.PaymentRequirements.Network = "base-sepolia"
	ch.PaymentRequirements.MaxAmountRequired = "10000"
	ch.PaymentRequirements.PayTo = "0x1111111111111111111111111111111111111111"
	ch.PaymentRequirements.Asset = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
	ch.PaymentRequirements.Extra.Name = "USDC"
	ch.PaymentRequirements.Extra.Version = "2"
	return ch
}

func envelope(t *testing.T, data any) []byte {
	t.Helper()
	raw, err := json.Marshal(data)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	out, err := json.Marshal(map[string]any{"success": true, "data": json.RawMessage(raw)})
	if err != nil {
		t.Fatalf("marshal envelope: %v", err)
	}
	return out
}

func newTestSigner(t *testing.T) *PrivateKeySigner {
	t.Helper()
	s, err := NewPrivateKeySigner(testPrivateKey)
	if err != nil {
		t.Fatalf("signer: %v", err)
	}
	return s
}

func TestX402Client_Charge(t *testing.T) {
	var gotBody map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/v1/x402/challenges" {
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		if auth := r.Header.Get("authorization"); auth != "Bearer k" {
			t.Errorf("bad auth header: %q", auth)
		}
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		w.Write(envelope(t, sampleChallenge()))
	}))
	defer srv.Close()

	client := NewX402Client(X402ClientOptions{APIKey: "k", BaseURL: srv.URL})
	ch, err := client.Charge(context.Background(), X402ChargeInput{Amount: "10000", Network: "base-sepolia", Description: "demo"})
	if err != nil {
		t.Fatalf("charge failed: %v", err)
	}
	if ch.ID != sampleChallenge().ID {
		t.Fatalf("bad challenge id: %s", ch.ID)
	}
	if gotBody["amount"] != "10000" || gotBody["network"] != "base-sepolia" || gotBody["description"] != "demo" {
		t.Fatalf("unexpected request body: %v", gotBody)
	}
}

func TestX402Client_Charge_RejectsBadAmount(t *testing.T) {
	client := NewX402Client(X402ClientOptions{APIKey: "k", BaseURL: "http://unused"})
	for _, amount := range []string{"", "1.5", "abc", "0"} {
		if _, err := client.Charge(context.Background(), X402ChargeInput{Amount: amount}); err == nil {
			t.Fatalf("expected error for amount %q", amount)
		}
	}
}

func TestX402Client_Charge_AmountUsdcConversion(t *testing.T) {
	cases := []struct {
		usdc string
		want string
	}{
		{"0.01", "10000"},
		{"1", "1000000"},
		{"1.5", "1500000"},
		{"0.000001", "1"},
		{"  0.01  ", "10000"},
		{"1234.567890", "1234567890"},
	}
	for _, tc := range cases {
		var gotBody map[string]any
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_ = json.NewDecoder(r.Body).Decode(&gotBody)
			w.Write(envelope(t, sampleChallenge()))
		}))
		client := NewX402Client(X402ClientOptions{APIKey: "k", BaseURL: srv.URL})
		if _, err := client.Charge(context.Background(), X402ChargeInput{AmountUsdc: tc.usdc}); err != nil {
			srv.Close()
			t.Fatalf("charge with AmountUsdc %q failed: %v", tc.usdc, err)
		}
		srv.Close()
		if gotBody["amount"] != tc.want {
			t.Fatalf("AmountUsdc %q: expected base-unit amount %q, got %v", tc.usdc, tc.want, gotBody["amount"])
		}
	}
}

func TestX402Client_Charge_RejectsBadAmountUsdc(t *testing.T) {
	client := NewX402Client(X402ClientOptions{APIKey: "k", BaseURL: "http://unused"})
	// Non-positive, malformed, and over-precise (>6 decimals) values.
	for _, usdc := range []string{"0", "0.0", "-1", "abc", "1.5e3", "0.0000001", "1.1234567", ""} {
		if _, err := client.Charge(context.Background(), X402ChargeInput{AmountUsdc: usdc}); err == nil {
			t.Fatalf("expected error for AmountUsdc %q", usdc)
		}
	}
}

func TestX402Client_Charge_RejectsBothAmountAndUsdc(t *testing.T) {
	client := NewX402Client(X402ClientOptions{APIKey: "k", BaseURL: "http://unused"})
	_, err := client.Charge(context.Background(), X402ChargeInput{Amount: "10000", AmountUsdc: "0.01"})
	if err == nil || !strings.Contains(err.Error(), "not both") {
		t.Fatalf("expected both-set error, got %v", err)
	}
}

func TestX402Client_Charge_RejectsNeitherAmountNorUsdc(t *testing.T) {
	client := NewX402Client(X402ClientOptions{APIKey: "k", BaseURL: "http://unused"})
	_, err := client.Charge(context.Background(), X402ChargeInput{})
	if err == nil {
		t.Fatal("expected error when neither Amount nor AmountUsdc is set")
	}
}

func TestX402Client_Pay(t *testing.T) {
	var gotBody map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		wantPath := "/v1/x402/challenges/" + sampleChallenge().ID + "/pay"
		if r.URL.Path != wantPath {
			t.Errorf("unexpected path: %s want %s", r.URL.Path, wantPath)
		}
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		w.Write(envelope(t, map[string]any{"id": sampleChallenge().ID, "status": "settled", "settle_tx": "0x" + strings.Repeat("a", 64)}))
	}))
	defer srv.Close()

	client := NewX402Client(X402ClientOptions{APIKey: "k", BaseURL: srv.URL})
	receipt, err := client.Pay(context.Background(), sampleChallenge(), newTestSigner(t))
	if err != nil {
		t.Fatalf("pay failed: %v", err)
	}
	if receipt.Status != "settled" {
		t.Fatalf("bad status: %s", receipt.Status)
	}

	payment, _ := gotBody["payment"].(map[string]any)
	if payment == nil {
		t.Fatalf("missing payment in body: %v", gotBody)
	}
	if payment["x402Version"].(float64) != 1 || payment["scheme"] != "exact" {
		t.Fatalf("bad payment envelope: %v", payment)
	}
	pl := payment["payload"].(map[string]any)
	authz := pl["authorization"].(map[string]any)
	if !strings.EqualFold(authz["from"].(string), testAddress) {
		t.Fatalf("from should be the signer: %v", authz["from"])
	}
	if authz["to"] != sampleChallenge().PaymentRequirements.PayTo {
		t.Fatalf("to should be payTo: %v", authz["to"])
	}
	if authz["value"] != "10000" {
		t.Fatalf("value should be a string: %v", authz["value"])
	}
	if sig, _ := pl["signature"].(string); !strings.HasPrefix(sig, "0x") {
		t.Fatalf("signature should be 0x-prefixed: %v", pl["signature"])
	}
}

func TestX402Client_Pay_ServerErrorCarriesStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(422)
		w.Write([]byte(`{"success":false,"error":{"message":"payment_declined"}}`))
	}))
	defer srv.Close()

	client := NewX402Client(X402ClientOptions{APIKey: "k", BaseURL: srv.URL})
	_, err := client.Pay(context.Background(), sampleChallenge(), newTestSigner(t))
	var xerr *X402Error
	if !errors.As(err, &xerr) {
		t.Fatalf("expected X402Error, got %v", err)
	}
	if xerr.Status != 422 || xerr.Message != "payment_declined" {
		t.Fatalf("bad error: status=%d msg=%q", xerr.Status, xerr.Message)
	}
}

func TestX402Client_Pay_RejectsExpiredChallenge(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("should not reach server for an expired challenge")
	}))
	defer srv.Close()
	client := NewX402Client(X402ClientOptions{APIKey: "k", BaseURL: srv.URL})

	expired := sampleChallenge()
	expired.ExpiresAt = time.Now().Add(-time.Hour).UTC().Format(time.RFC3339)
	if _, err := client.Pay(context.Background(), expired, newTestSigner(t)); err == nil || !strings.Contains(err.Error(), "already expired") {
		t.Fatalf("expected already-expired error, got %v", err)
	}

	// Expired only 2 minutes ago, inside the settlement margin: must still be caught.
	recently := sampleChallenge()
	recently.ExpiresAt = time.Now().Add(-2 * time.Minute).UTC().Format(time.RFC3339)
	if _, err := client.Pay(context.Background(), recently, newTestSigner(t)); err == nil || !strings.Contains(err.Error(), "already expired") {
		t.Fatalf("expected already-expired error for recently expired, got %v", err)
	}
}

func TestX402Client_Pay_RejectsMalformedExpiresAt(t *testing.T) {
	client := NewX402Client(X402ClientOptions{APIKey: "k", BaseURL: "http://unused"})
	bad := sampleChallenge()
	bad.ExpiresAt = "not-a-date"
	if _, err := client.Pay(context.Background(), bad, newTestSigner(t)); err == nil || !strings.Contains(err.Error(), "invalid expires_at") {
		t.Fatalf("expected invalid expires_at error, got %v", err)
	}
}

func TestX402Client_Pay_RejectsNetworkMismatch(t *testing.T) {
	client := NewX402Client(X402ClientOptions{APIKey: "k", BaseURL: "http://unused"})
	mismatch := sampleChallenge()
	mismatch.PaymentRequirements.Network = "base"
	if _, err := client.Pay(context.Background(), mismatch, newTestSigner(t)); err == nil || !strings.Contains(err.Error(), "network mismatch") {
		t.Fatalf("expected network mismatch error, got %v", err)
	}
}

func TestX402Client_Pay_RejectsMalformedChallenge(t *testing.T) {
	client := NewX402Client(X402ClientOptions{APIKey: "k", BaseURL: "http://unused"})
	noPr := sampleChallenge()
	noPr.PaymentRequirements = X402PaymentRequirements{}
	if _, err := client.Pay(context.Background(), noPr, newTestSigner(t)); err == nil || !strings.Contains(err.Error(), "payment_requirements") {
		t.Fatalf("expected payment_requirements error, got %v", err)
	}
}

func TestX402Client_Pay_RejectsMalformedMaxAmountRequired(t *testing.T) {
	// A non-integer amount must surface as a named X402Error, not a panic.
	client := NewX402Client(X402ClientOptions{APIKey: "k", BaseURL: "http://unused"})
	bad := sampleChallenge()
	bad.PaymentRequirements.MaxAmountRequired = "not-a-number"
	if _, err := client.Pay(context.Background(), bad, newTestSigner(t)); err == nil || !strings.Contains(err.Error(), "maxAmountRequired") {
		t.Fatalf("expected maxAmountRequired error, got %v", err)
	}
}

func TestX402Client_NoAPIKey(t *testing.T) {
	t.Setenv("PRIMITIVE_API_KEY", "")
	client := NewX402Client(X402ClientOptions{BaseURL: "http://unused"})
	if _, err := client.Charge(context.Background(), X402ChargeInput{Amount: "10000"}); err == nil || !strings.Contains(err.Error(), "no API key") {
		t.Fatalf("expected no API key error, got %v", err)
	}
}

func TestX402Client_NonJSONResponse(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("<html>nope</html>"))
	}))
	defer srv.Close()
	client := NewX402Client(X402ClientOptions{APIKey: "k", BaseURL: srv.URL})
	if _, err := client.Charge(context.Background(), X402ChargeInput{Amount: "10000"}); err == nil || !strings.Contains(err.Error(), "non-JSON response") {
		t.Fatalf("expected non-JSON response error, got %v", err)
	}
}

func TestX402Client_MissingEnvelope(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"ok":true}`))
	}))
	defer srv.Close()
	client := NewX402Client(X402ClientOptions{APIKey: "k", BaseURL: srv.URL})
	if _, err := client.Charge(context.Background(), X402ChargeInput{Amount: "10000"}); err == nil || !strings.Contains(err.Error(), "missing success/data envelope") {
		t.Fatalf("expected missing-envelope error, got %v", err)
	}
}

func TestX402Client_RetryAfter(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("retry-after", "12")
		w.WriteHeader(429)
		w.Write([]byte(`{"success":false,"error":{"message":"rate limited"}}`))
	}))
	defer srv.Close()
	client := NewX402Client(X402ClientOptions{APIKey: "k", BaseURL: srv.URL})
	_, err := client.Charge(context.Background(), X402ChargeInput{Amount: "10000"})
	var xerr *X402Error
	if !errors.As(err, &xerr) {
		t.Fatalf("expected X402Error, got %v", err)
	}
	if xerr.Status != 429 || xerr.RetryAfter != "12" {
		t.Fatalf("bad rate-limit error: status=%d retryAfter=%q", xerr.Status, xerr.RetryAfter)
	}
}

func TestX402Client_TransportErrorStatusZero(t *testing.T) {
	// Point at a closed server to force a transport failure.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	url := srv.URL
	srv.Close()
	client := NewX402Client(X402ClientOptions{APIKey: "k", BaseURL: url})
	_, err := client.Charge(context.Background(), X402ChargeInput{Amount: "10000"})
	var xerr *X402Error
	if !errors.As(err, &xerr) {
		t.Fatalf("expected X402Error, got %v", err)
	}
	if xerr.Status != 0 {
		t.Fatalf("transport error should have status 0, got %d", xerr.Status)
	}
}

func TestX402Client_GetChallenge(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		want := "/v1/x402/challenges/" + sampleChallenge().ID
		if r.Method != http.MethodGet || r.URL.Path != want {
			t.Errorf("unexpected request: %s %s want %s", r.Method, r.URL.Path, want)
		}
		w.Write(envelope(t, sampleChallenge()))
	}))
	defer srv.Close()
	client := NewX402Client(X402ClientOptions{APIKey: "k", BaseURL: srv.URL})
	ch, err := client.GetChallenge(context.Background(), sampleChallenge().ID)
	if err != nil {
		t.Fatalf("getChallenge failed: %v", err)
	}
	if ch.ID != sampleChallenge().ID {
		t.Fatalf("bad id: %s", ch.ID)
	}
}

func TestX402Client_RegisterPayoutAddress(t *testing.T) {
	var gotBody map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/v1/x402/payout-addresses" {
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		w.Write(envelope(t, map[string]any{
			"id": "p1", "address": strings.ToLower(testAddress), "network": "base-sepolia",
			"label": nil, "is_default": true, "verified_at": "2026-01-01T00:00:00.000Z",
		}))
	}))
	defer srv.Close()
	client := NewX402Client(X402ClientOptions{APIKey: "k", BaseURL: srv.URL})
	res, err := client.RegisterPayoutAddress(context.Background(), X402PayoutRegistrationInput{
		Org: "11111111-1111-4111-8111-111111111111", Network: "base-sepolia", IssuedAt: "2026-01-01T00:00:00.000Z",
	}, newTestSigner(t))
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}
	if !res.IsDefault {
		t.Fatal("expected is_default true")
	}
	if gotBody["address"] != testAddress || gotBody["network"] != "base-sepolia" || gotBody["issued_at"] != "2026-01-01T00:00:00.000Z" {
		t.Fatalf("unexpected body: %v", gotBody)
	}
	if sig, _ := gotBody["signature"].(string); !strings.HasPrefix(sig, "0x") {
		t.Fatalf("signature should be 0x-prefixed: %v", gotBody["signature"])
	}
	// The signature must recover to the signer over the exact registration message.
	msg := BuildPayoutRegistrationMessage("11111111-1111-4111-8111-111111111111", testAddress, "base-sepolia", "2026-01-01T00:00:00.000Z")
	if rec := recoverPersonalSign(t, msg, gotBody["signature"].(string)); rec != testAddress {
		t.Fatalf("registration signature did not recover to signer: %s", rec)
	}
}

func TestX402Client_RegisterPayoutAddress_ResolvesOrgFromAccount(t *testing.T) {
	const resolvedOrg = "99999999-9999-4999-8999-999999999999"
	var gotBody map[string]any
	accountHit := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/v1/account":
			accountHit = true
			w.Write(envelope(t, map[string]any{"id": resolvedOrg}))
		case r.Method == http.MethodPost && r.URL.Path == "/v1/x402/payout-addresses":
			_ = json.NewDecoder(r.Body).Decode(&gotBody)
			w.Write(envelope(t, map[string]any{
				"id": "p1", "address": strings.ToLower(testAddress), "network": "base-sepolia",
				"label": nil, "is_default": true, "verified_at": "2026-01-01T00:00:00.000Z",
			}))
		default:
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
	}))
	defer srv.Close()

	client := NewX402Client(X402ClientOptions{APIKey: "k", BaseURL: srv.URL})
	// Org left empty: should be resolved from GET /v1/account.
	res, err := client.RegisterPayoutAddress(context.Background(), X402PayoutRegistrationInput{
		Network: "base-sepolia", IssuedAt: "2026-01-01T00:00:00.000Z",
	}, newTestSigner(t))
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}
	if !accountHit {
		t.Fatal("expected GET /v1/account to be called for org resolution")
	}
	if !res.IsDefault {
		t.Fatal("expected is_default true")
	}
	// The signed message must bind the RESOLVED org, not an empty one.
	msg := BuildPayoutRegistrationMessage(resolvedOrg, testAddress, "base-sepolia", "2026-01-01T00:00:00.000Z")
	sig, _ := gotBody["signature"].(string)
	if sig == "" {
		t.Fatalf("missing signature in body: %v", gotBody)
	}
	if rec := recoverPersonalSign(t, msg, sig); rec != testAddress {
		t.Fatalf("registration signature did not recover to signer over the resolved-org message: %s", rec)
	}
}

func TestX402Client_RegisterPayoutAddress_ErrorsWhenAccountHasNoID(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/account" {
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		w.Write(envelope(t, map[string]any{}))
	}))
	defer srv.Close()
	client := NewX402Client(X402ClientOptions{APIKey: "k", BaseURL: srv.URL})
	_, err := client.RegisterPayoutAddress(context.Background(), X402PayoutRegistrationInput{}, newTestSigner(t))
	if err == nil || !strings.Contains(err.Error(), "could not resolve your organization id") {
		t.Fatalf("expected org-resolution error, got %v", err)
	}
}

func TestX402Client_ListPayoutAddresses(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/x402/payout-addresses" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		w.Write(envelope(t, []any{}))
	}))
	defer srv.Close()
	client := NewX402Client(X402ClientOptions{APIKey: "k", BaseURL: srv.URL})
	addrs, err := client.ListPayoutAddresses(context.Background())
	if err != nil {
		t.Fatalf("list failed: %v", err)
	}
	if len(addrs) != 0 {
		t.Fatalf("expected empty list, got %v", addrs)
	}
}

func TestX402Client_SpendPolicy(t *testing.T) {
	var putBody map[string]any
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.Method == http.MethodPut {
			_ = json.NewDecoder(r.Body).Decode(&putBody)
		}
		w.Write(envelope(t, map[string]any{"paused": false, "max_per_payment": "1000000", "max_per_day": nil, "allowlist": nil}))
	}))
	defer srv.Close()
	client := NewX402Client(X402ClientOptions{APIKey: "k", BaseURL: srv.URL})

	policy, err := client.GetSpendPolicy(context.Background())
	if err != nil {
		t.Fatalf("get policy failed: %v", err)
	}
	if policy.MaxPerPayment == nil || *policy.MaxPerPayment != "1000000" {
		t.Fatalf("bad max_per_payment: %v", policy.MaxPerPayment)
	}

	var update X402SpendPolicyUpdate
	update.SetPaused(true)
	if _, err := client.SetSpendPolicy(context.Background(), update); err != nil {
		t.Fatalf("set policy failed: %v", err)
	}
	if len(putBody) != 1 || putBody["paused"] != true {
		t.Fatalf("PUT body should be exactly {paused:true}, got %v", putBody)
	}
}

func TestEscapePathSegment_PadsLowBytes(t *testing.T) {
	// A byte below 0x10 must encode as two hex digits (e.g. tab -> %09), not a
	// single digit (%9), which is a malformed percent-escape.
	if got := escapePathSegment("\t"); got != "%09" {
		t.Fatalf("tab should encode as %%09, got %q", got)
	}
	// Also check a space (0x20) for good measure.
	if got := escapePathSegment(" "); got != "%20" {
		t.Fatalf("space should encode as %%20, got %q", got)
	}
}

func TestX402Client_Charge_IdempotencyKeyHeader(t *testing.T) {
	cases := []struct {
		name string
		key  string
		want string // expected Idempotency-Key header value
	}{
		{"set", "abc-123", "abc-123"},
		{"empty", "", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var gotHeader string
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				gotHeader = r.Header.Get("Idempotency-Key")
				w.Write(envelope(t, sampleChallenge()))
			}))
			defer srv.Close()
			client := NewX402Client(X402ClientOptions{APIKey: "k", BaseURL: srv.URL})
			_, err := client.Charge(context.Background(), X402ChargeInput{Amount: "10000", IdempotencyKey: tc.key})
			if err != nil {
				t.Fatalf("charge failed: %v", err)
			}
			if gotHeader != tc.want {
				t.Fatalf("Idempotency-Key header: got %q want %q", gotHeader, tc.want)
			}
		})
	}
}

func TestX402Client_ListDeclinedPayments(t *testing.T) {
	challengeID := "22222222-2222-4222-8222-222222222222"
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || r.URL.Path != "/v1/x402/declined-payments" {
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		w.Write(envelope(t, []any{
			map[string]any{
				"id":               "d1",
				"challenge_id":     challengeID,
				"counterparty_org": "33333333-3333-4333-8333-333333333333",
				"network":          "base-sepolia",
				"amount":           "10000",
				"reason":           "max_per_payment_exceeded",
				"declined_at":      "2026-01-01T00:00:00.000Z",
			},
		}))
	}))
	defer srv.Close()
	client := NewX402Client(X402ClientOptions{APIKey: "k", BaseURL: srv.URL})
	declined, err := client.ListDeclinedPayments(context.Background())
	if err != nil {
		t.Fatalf("list declined failed: %v", err)
	}
	if len(declined) != 1 {
		t.Fatalf("expected 1 declined payment, got %d", len(declined))
	}
	d := declined[0]
	if d.ID != "d1" || d.Network != "base-sepolia" || d.Amount != "10000" || d.Reason != "max_per_payment_exceeded" {
		t.Fatalf("unexpected declined payment: %+v", d)
	}
	if d.ChallengeID == nil || *d.ChallengeID != challengeID {
		t.Fatalf("bad challenge_id: %v", d.ChallengeID)
	}
	if d.DeclinedAt != "2026-01-01T00:00:00.000Z" {
		t.Fatalf("bad declined_at: %s", d.DeclinedAt)
	}
}

func TestX402SpendPolicyUpdate_ClearCap(t *testing.T) {
	var update X402SpendPolicyUpdate
	update.ClearMaxPerPayment()
	body := update.body()
	v, ok := body["max_per_payment"]
	if !ok || v != nil {
		t.Fatalf("ClearMaxPerPayment should send explicit null, got present=%v val=%v", ok, v)
	}
}
