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
