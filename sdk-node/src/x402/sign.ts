/**
 * x402 client-side signing.
 *
 * The payer signs an EIP-3009 `transferWithAuthorization` over the customer's
 * own key; the key never leaves them. This module derives the interaction-bound
 * nonce and assembles the EIP-712 typed data and the wire payload. The byte
 * layout here MUST match the platform verifier exactly; a normative test vector
 * (see sign.test.ts) locks the nonce derivation to the same value the server
 * recomputes.
 */
import {
  type Address,
  concat,
  getAddress,
  type Hex,
  hexToBytes,
  keccak256,
  stringToBytes,
} from "viem";

/** A challenge nonce is 32 bytes rendered as 64 lowercase hex chars, no 0x. */
const CHALLENGE_NONCE_RE = /^[0-9a-f]{64}$/;

/** Single-byte domain separator between the variable-length string fields. */
const FIELD_SEPARATOR = new Uint8Array([0x00]);

export interface NonceBinding {
  /** The interaction id, including its `@domain`. Lowercased before hashing. */
  interactionId: string;
  /** The challenge step id (a UUID). Lowercased before hashing. */
  challengeStepId: string;
  /** The challenger's per-challenge random nonce: 64 lowercase hex chars. */
  challengeNonce: string;
}

/**
 * Derive the EIP-3009 nonce bound to a specific interaction step:
 *
 *   keccak256( utf8(lower(interaction_id)) || 0x00
 *            || utf8(lower(challenge_step_id)) || 0x00
 *            || hexdecode(challenge_nonce) )
 *
 * The `0x00` separators pin the field boundaries (undelimited concatenation of
 * variable-length strings is collision-ambiguous), and the challenge nonce is
 * decoded to its 32 raw bytes before hashing. The platform recomputes this and
 * rejects a mismatch.
 */
export function deriveEip3009Nonce(input: NonceBinding): Hex {
  if (!CHALLENGE_NONCE_RE.test(input.challengeNonce)) {
    throw new Error(
      "challengeNonce must be exactly 64 lowercase hex chars (32 bytes), no 0x prefix",
    );
  }
  return keccak256(
    concat([
      stringToBytes(input.interactionId.toLowerCase()),
      FIELD_SEPARATOR,
      stringToBytes(input.challengeStepId.toLowerCase()),
      FIELD_SEPARATOR,
      hexToBytes(`0x${input.challengeNonce}`),
    ]),
  );
}

/**
 * The EIP-3009 `TransferWithAuthorization` EIP-712 type. The field order and
 * types are part of the on-chain contract and MUST NOT change.
 */
export const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

/**
 * The token's EIP-712 domain. `name`/`version` MUST be the actual token's domain
 * params (Base mainnet USDC reports `name: "USD Coin"`, Base Sepolia `"USDC"`;
 * both `version: "2"`); they come from the challenge's payment requirements
 * `extra`. A wrong name/version produces a signature the verifier rejects.
 */
export interface TokenDomain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: Address;
}

export interface TransferAuthorization {
  from: Address;
  to: Address;
  /** Token base units (USDC has 6 decimals), as a bigint. */
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: Hex;
}

export interface TransferWithAuthorizationTypedData {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: Address;
  };
  types: typeof TRANSFER_WITH_AUTHORIZATION_TYPES;
  primaryType: "TransferWithAuthorization";
  message: TransferAuthorization;
}

export function transferWithAuthorizationTypedData(
  domain: TokenDomain,
  auth: TransferAuthorization,
): TransferWithAuthorizationTypedData {
  return {
    domain: {
      name: domain.name,
      version: domain.version,
      chainId: domain.chainId,
      verifyingContract: domain.verifyingContract,
    },
    types: TRANSFER_WITH_AUTHORIZATION_TYPES,
    primaryType: "TransferWithAuthorization",
    message: auth,
  };
}

/**
 * A customer-held signer. A viem `LocalAccount` satisfies this directly; any
 * key source (hardware wallet, injected provider) can be adapted. The key never
 * leaves the caller.
 */
export interface X402Signer {
  address: Address;
  signTypedData(typedData: TransferWithAuthorizationTypedData): Promise<Hex>;
  /**
   * `personal_sign` over a UTF-8 string. Only needed for
   * `registerPayoutAddress()` (the ownership proof); a viem `LocalAccount`
   * provides it directly.
   */
  signMessage?(args: { message: string }): Promise<Hex>;
}

export interface PayoutRegistrationMessageInput {
  /** The org id the address is being authorized for. Bound into the signature. */
  org: string;
  /** The payout address (the signer's own address). Lowercased in the message. */
  address: string;
  network: string;
  /** ISO-8601 timestamp; the server enforces a freshness window against replay. */
  issuedAt: string;
}

/**
 * Build the payout-address ownership message. This MUST be byte-identical to the
 * platform's `buildPayoutRegistrationMessage`, or registration fails the
 * ownership proof. The org id is in the signed bytes, so a captured signature
 * can never register the address under a different org.
 */
export function buildPayoutRegistrationMessage(
  input: PayoutRegistrationMessageInput,
): string {
  return [
    "Primitive x402 payout address authorization",
    "",
    "I authorize this address as a payout destination for my Primitive organization.",
    "",
    `org: ${input.org}`,
    `address: ${input.address.toLowerCase()}`,
    `network: ${input.network}`,
    `issued: ${input.issuedAt}`,
  ].join("\n");
}

/** The x402 wire payload (validated server-side against the x402 schema). */
export interface X402PaymentPayload {
  x402Version: 1;
  scheme: "exact";
  network: string;
  payload: {
    signature: Hex;
    authorization: {
      from: Address;
      to: Address;
      value: string;
      validAfter: string;
      validBefore: string;
      nonce: Hex;
    };
  };
}

/**
 * The protocol the email-native payment interaction runs (`x402.payment/1`).
 * The payer's reply carries the `payment` step of this protocol.
 */
export const X402_INTERACTION_PROTOCOL = "x402.payment";
export const X402_INTERACTION_PROTOCOL_VERSION = 1;

/** A UUID (used for `interaction_id`'s local part and the step ids). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** An interaction id is `uuid@domain`. */
const WIRE_ID_RE = new RegExp(`^${UUID_RE.source.slice(1, -1)}@[^\\s@]+$`, "i");

/**
 * The interaction.json envelope for one step of an email-carried interaction.
 * The payer's `payment` step is sent as an `interaction.json` MIME attachment
 * in the reply; the platform parses this envelope, validates the step against
 * the `x402.payment` protocol, and re-verifies the embedded payment.
 */
export interface InteractionEnvelope<P = unknown> {
  interaction_version: 1;
  /** The thread id (`uuid@domain`) the step belongs to. */
  interaction_id: string;
  protocol: string;
  protocol_version: number;
  /** The protocol step name (e.g. `"payment"`). */
  step: string;
  /** This step's id (a fresh UUID). */
  step_id: string;
  /** The id of the step this one answers (the challenge step), or null. */
  prev_step_id: string | null;
  expires_at: string | null;
  payload: P;
}

/** The `payload` of an `x402.payment` `payment` step: the signed x402 payload. */
export interface X402PaymentStepPayload {
  payment: X402PaymentPayload;
}

/**
 * A built, signed payment-step envelope plus its canonical JSON bytes. The
 * caller attaches `json` as the `interaction.json` part of the reply email; the
 * platform reads `envelope` back from those exact bytes.
 */
export interface BuiltPaymentStep {
  envelope: InteractionEnvelope<X402PaymentStepPayload>;
  /** The canonical interaction.json body (what to attach to the reply). */
  json: string;
}

/**
 * Build the section-2.3 interaction.json envelope for a `payment` step. Pure: no
 * I/O. `payment` is the signed exact-EVM payload (from
 * `buildExactEvmPaymentPayload`); `prevStepId` is the challenge step id this
 * payment answers, and `stepId` is a fresh UUID for the payment step. Returns
 * the envelope and its canonical JSON, so the bytes the platform reads back are
 * exactly the ones produced here.
 */
export function buildPaymentStepEnvelope(params: {
  /** The thread id (`uuid@domain`). */
  interactionId: string;
  /** A fresh UUID identifying this payment step. */
  stepId: string;
  /** The challenge step id this payment answers. */
  prevStepId: string;
  payment: X402PaymentPayload;
  /** Optional ISO-8601 step expiry. */
  expiresAt?: string | null;
}): BuiltPaymentStep {
  if (!WIRE_ID_RE.test(params.interactionId)) {
    throw new Error(
      "buildPaymentStepEnvelope: interactionId must be uuid@domain",
    );
  }
  if (!UUID_RE.test(params.stepId)) {
    throw new Error("buildPaymentStepEnvelope: stepId must be a uuid");
  }
  if (!UUID_RE.test(params.prevStepId)) {
    throw new Error("buildPaymentStepEnvelope: prevStepId must be a uuid");
  }
  const envelope: InteractionEnvelope<X402PaymentStepPayload> = {
    interaction_version: 1,
    interaction_id: params.interactionId,
    protocol: X402_INTERACTION_PROTOCOL,
    protocol_version: X402_INTERACTION_PROTOCOL_VERSION,
    step: "payment",
    step_id: params.stepId,
    prev_step_id: params.prevStepId,
    expires_at: params.expiresAt ?? null,
    payload: { payment: params.payment },
  };
  return { envelope, json: JSON.stringify(envelope) };
}

/** Assemble the wire payload from a signed authorization. */
export function toPaymentPayload(
  network: string,
  auth: TransferAuthorization,
  signature: Hex,
): X402PaymentPayload {
  return {
    x402Version: 1,
    scheme: "exact",
    network,
    payload: {
      signature,
      authorization: {
        from: auth.from,
        to: auth.to,
        value: auth.value.toString(),
        validAfter: auth.validAfter.toString(),
        validBefore: auth.validBefore.toString(),
        nonce: auth.nonce,
      },
    },
  };
}

/**
 * Absolute ceiling on the total signed window (validBefore - validAfter). A
 * signed EIP-3009 authorization stays settleable on-chain until validBefore
 * regardless of the interaction state, so an unbounded window is a standing
 * "funds committed" risk. The real window is minutes; this 24h cap is the hard
 * safety ceiling, enforced so a caller-supplied window cannot bypass it.
 */
export const DEFAULT_MAX_WINDOW_SEC = 24 * 60 * 60;

/**
 * Compute the EIP-3009 validity window for a payment. `validBefore` is the
 * value that governs on-chain validity, so it MUST cover the challenge's
 * `expires_at` plus a settlement margin; `validAfter` is set generously in the
 * past for clock skew. The total window is hard-capped at `maxWindowSec` so
 * neither a far-future `challengeExpiresAtSec` nor a widened margin can produce
 * a window the platform verifier would later reject.
 */
export function computePaymentValidityWindow(params: {
  /** The challenge's expires_at, unix seconds. */
  challengeExpiresAtSec: number;
  /** Current time, unix seconds. */
  nowSec: number;
  /** Headroom past expiry for verify+settle to complete. Default 5 min. */
  settlementMarginSec?: number;
  /** How far in the past to set validAfter for clock skew. Default 5 min. */
  clockSkewSec?: number;
  /** Hard ceiling on validBefore - validAfter. Default 24h. */
  maxWindowSec?: number;
}): { validAfter: bigint; validBefore: bigint } {
  const margin = params.settlementMarginSec ?? 5 * 60;
  const skew = params.clockSkewSec ?? 5 * 60;
  const validBefore = BigInt(params.challengeExpiresAtSec + margin);
  const validAfter = BigInt(params.nowSec - skew);
  if (validBefore <= validAfter) {
    throw new Error(
      "invalid validity window: validBefore must be after validAfter (challenge already expired?)",
    );
  }
  const maxWindow = BigInt(params.maxWindowSec ?? DEFAULT_MAX_WINDOW_SEC);
  if (validBefore - validAfter > maxWindow) {
    throw new Error(
      `invalid validity window: total window exceeds the ${maxWindow}s cap (challenge expiry too far out?)`,
    );
  }
  return { validAfter, validBefore };
}

/** The x402 named networks supported in v1 (testnet first). */
export type X402Network = "base-sepolia" | "base";

/**
 * The interaction-aware signer: derive the bound nonce, assemble the
 * authorization, and sign it. This is the one piece a stock x402 signer cannot
 * do (it generates the nonce internally with no injection point), so the payer
 * side needs this Primitive-provided helper. The key never leaves the caller.
 */
export async function signInteractionPayment(params: {
  /** Sign EIP-712 typed data with the caller's own key. */
  sign: (typedData: TransferWithAuthorizationTypedData) => Promise<Hex>;
  /** Payer (from) address. */
  payer: Address;
  domain: TokenDomain;
  /** Recipient (the challenger's payTo). */
  payTo: Address;
  /** Amount in token base units. */
  amount: bigint;
  /** Inputs that derive the interaction-bound EIP-3009 nonce. */
  nonceBinding: NonceBinding;
  validAfter: bigint;
  validBefore: bigint;
}): Promise<{ authorization: TransferAuthorization; signature: Hex }> {
  const authorization: TransferAuthorization = {
    from: getAddress(params.payer),
    to: getAddress(params.payTo),
    value: params.amount,
    validAfter: params.validAfter,
    validBefore: params.validBefore,
    nonce: deriveEip3009Nonce(params.nonceBinding),
  };
  const signature = await params.sign(
    transferWithAuthorizationTypedData(params.domain, authorization),
  );
  return { authorization, signature };
}

/** The authorization nonce is 32 bytes rendered as a 0x-prefixed 64-char hex string. */
const NONCE_HEX_RE = /^0x[0-9a-fA-F]{64}$/;

/** A shape-valid EIP signature is 65 bytes (r,s,v) rendered as 130 hex chars. */
const SIGNATURE_HEX_RE = /^0x[0-9a-fA-F]{130}$/;

/**
 * Assemble (and validate) the exact-EVM x402 wire payload from an
 * interaction-bound, locally-signed authorization. The numeric authorization
 * fields are decimal strings in the wire schema, so the bigints are stringified
 * here; the nonce passes through as hex. Validation rejects a malformed nonce or
 * signature loudly rather than emitting a payload the platform will reject.
 */
export function buildExactEvmPaymentPayload(params: {
  network: X402Network;
  authorization: TransferAuthorization;
  signature: Hex;
}): X402PaymentPayload {
  if (params.network !== "base" && params.network !== "base-sepolia") {
    throw new Error(
      `buildExactEvmPaymentPayload: unsupported network ${params.network}`,
    );
  }
  if (!SIGNATURE_HEX_RE.test(params.signature)) {
    throw new Error(
      "buildExactEvmPaymentPayload: signature must be a 0x-prefixed 65-byte (130 hex char) EIP signature",
    );
  }
  if (!NONCE_HEX_RE.test(params.authorization.nonce)) {
    throw new Error(
      "buildExactEvmPaymentPayload: authorization.nonce must be a 0x-prefixed 32-byte (64 hex char) value",
    );
  }
  return toPaymentPayload(
    params.network,
    params.authorization,
    params.signature,
  );
}
