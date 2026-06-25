import {
  type BuiltPaymentStep,
  createX402Client,
  type X402EmailChallenge,
  X402Error,
} from "@primitivedotdev/sdk/x402";
import { privateKeyToAccount } from "viem/accounts";
import {
  surfaceUnauthorizedHint,
  writeErrorWithHints,
} from "../api-command.js";
import type { ResolvedCliAuth } from "../auth.js";

// The two payments commands that sign (register-payout-address, pay) need the
// caller's wallet key locally. We read it from an env var by default so it
// never lands in shell history or the process list; a hidden --private-key
// flag is offered as an escape hatch for scripted/testing use.
export const PRIVATE_KEY_ENV = "PRIMITIVE_X402_PRIVATE_KEY";

export const PRIVATE_KEY_FLAG_DESCRIPTION = `Hex private key (0x-prefixed) of the wallet that signs. Prefer the ${PRIVATE_KEY_ENV} environment variable so the key is not exposed in shell history or the process list. The key is used locally to sign and never sent to Primitive.`;

// The CLI resolves its API base URL to the canonical `https://host/v1`, but the
// x402 client appends `/v1/x402/...` itself, so hand it the host without the
// trailing `/v1`. Keeps payments aligned with every other command's base-URL
// resolution (default host + --api-base-url / PRIMITIVE_API_BASE_URL overrides).
export function x402BaseUrl(resolvedApiBaseUrl: string): string {
  return resolvedApiBaseUrl.replace(/\/v1\/?$/, "");
}

/**
 * Build the x402 signing client. Returns null (after writing a hint) when no
 * API key resolved, so a not-signed-in caller gets the same guidance as any
 * other command rather than an opaque "no API key" throw from the SDK.
 */
export function buildX402Client(params: {
  apiKey: string | undefined;
  resolvedApiBaseUrl: string;
}): ReturnType<typeof createX402Client> | null {
  if (!params.apiKey) {
    process.stderr.write(
      "Not signed in. Set PRIMITIVE_API_KEY or run `primitive signin`, then retry.\n",
    );
    return null;
  }
  return createX402Client({
    apiKey: params.apiKey,
    baseUrl: x402BaseUrl(params.resolvedApiBaseUrl),
  });
}

// USDC has 6 decimals. We do the decimal->base-units conversion with string and
// BigInt math (never floats) so "0.01" is exactly "10000" with no rounding.
const USDC_DECIMALS = 6;

/**
 * Convert a human USDC amount ("0.01") to token base units ("10000"). Returns
 * null for a non-positive, malformed, or over-precise value (more than 6
 * fractional digits), so the caller can show a clear error instead of sending
 * a wrong amount.
 */
export function usdcToBaseUnits(human: string): string | null {
  const trimmed = human.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > USDC_DECIMALS) return null;
  const padded = frac.padEnd(USDC_DECIMALS, "0");
  const base = BigInt(whole) * 10n ** BigInt(USDC_DECIMALS) + BigInt(padded);
  if (base <= 0n) return null;
  return base.toString();
}

/** Format token base units ("10000") back to a human USDC string ("0.01"). */
export function formatUsdc(baseUnits: string): string {
  if (!/^\d+$/.test(baseUnits)) return baseUnits;
  const padded = baseUnits.padStart(USDC_DECIMALS + 1, "0");
  const whole = padded.slice(0, -USDC_DECIMALS);
  const frac = padded.slice(-USDC_DECIMALS).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

/** Block-explorer URL for a settlement tx, or null for an unknown network/tx. */
export function explorerTxUrl(network: string, tx: string): string | null {
  if (!/^0x[0-9a-fA-F]{64}$/.test(tx)) return null;
  if (network === "base") return `https://basescan.org/tx/${tx}`;
  if (network === "base-sepolia")
    return `https://sepolia.basescan.org/tx/${tx}`;
  return null;
}

// Recovery hints keyed by the server's x402 error codes, so a failure tells the
// user what to do next instead of just what went wrong.
const X402_ERROR_HINTS: Record<string, string> = {
  no_payout_address:
    "Register a payout address first: `primitive payments register-payout-address --network <network>`.",
  feature_disabled: "x402 payments are not enabled for this organization yet.",
  payment_declined:
    "Your spend policy declined this payment. Check it with `primitive payments get-spend-policy`; if it is paused, re-enable with `primitive payments update-spend-policy --paused false`.",
  challenge_expired:
    "This challenge has expired. Ask the payee to create a new one (raise `--expires-in` when creating long-lived challenges).",
  settlement_failed:
    "On-chain settlement failed. The most common cause is insufficient USDC in the paying wallet on this network. Fund the wallet and retry.",
  payment_verification_failed:
    "The signed payment did not match the challenge. Make sure you are paying with the wallet and network the challenge was issued for.",
  ownership_proof_failed:
    "The signature did not prove control of the address. Make sure the wallet key matches the address you are registering.",
};

/**
 * Sign an email-native x402 challenge into a payment-step `interaction.json`
 * envelope, locally and with no network call. This is the exact signing path
 * shared by `payments pay-email-step` (sign only) and `payments pay-email`
 * (sign and send), so both produce byte-identical `interaction.json` bytes for
 * the same challenge + key. The EIP-3009 / nonce derivation lives in the SDK's
 * `payEmailChallenge`; this helper just wires the CLI's key handling to it.
 */
export async function signEmailChallenge(params: {
  challenge: X402EmailChallenge;
  privateKey: string;
  resolvedApiBaseUrl: string;
  apiKey?: string;
}): Promise<BuiltPaymentStep> {
  // The signing client makes no request for `payEmailChallenge` (it is fully
  // local), so the base URL and API key are only carried for parity with the
  // rest of the payments surface; the key never leaves the machine.
  const client = createX402Client({
    apiKey: params.apiKey || undefined,
    baseUrl: x402BaseUrl(params.resolvedApiBaseUrl),
  });
  const signer = signerFromPrivateKey(params.privateKey);
  return client.payEmailChallenge(params.challenge, { signer });
}

/** Turn a hex private key into a viem account (a valid X402Signer). */
export function signerFromPrivateKey(rawKey: string) {
  const trimmed = rawKey.trim();
  const hex = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) {
    throw new X402Error(
      `private key must be 32 bytes of hex (64 hex chars, optionally 0x-prefixed); set ${PRIVATE_KEY_ENV} or pass --private-key`,
      0,
    );
  }
  return privateKeyToAccount(hex as `0x${string}`);
}

/**
 * Map an X402Error onto the CLI's standard stderr error + hint surface, so a
 * payments failure reads like every other command's failure. Returns nothing;
 * the caller sets the exit code.
 */
export function reportX402Error(
  error: unknown,
  ctx: { auth: ResolvedCliAuth; baseUrlOverridden: boolean; configDir: string },
): void {
  if (!(error instanceof X402Error)) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    return;
  }
  // The server envelope (`{ success:false, error:{ code, message } }`) is the
  // most useful payload when present; fall back to a synthetic envelope for
  // transport/client-side errors (status 0) that never reached the server.
  const body = error.body;
  const payload =
    body && typeof body === "object" && "error" in body
      ? body
      : {
          success: false,
          error: {
            code: error.status === 0 ? "client_error" : "request_failed",
            message: error.message,
          },
        };
  writeErrorWithHints(payload);
  // Add an x402-specific recovery hint when we recognize the error code, so the
  // user gets a concrete next step (register an address, unpause, fund wallet).
  const code = (payload as { error?: { code?: string } }).error?.code;
  if (code && code in X402_ERROR_HINTS) {
    process.stderr.write(`${X402_ERROR_HINTS[code]}\n`);
  }
  surfaceUnauthorizedHint({
    auth: ctx.auth,
    baseUrlOverridden: ctx.baseUrlOverridden,
    configDir: ctx.configDir,
    payload,
  });
}
