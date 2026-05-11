/**
 * Workers-safe webhook signature verification.
 *
 * Mirrors `verifyWebhookSignature` from `@primitivedotdev/sdk` but
 * implements the HMAC-SHA256 step with the Web Crypto API
 * (`crypto.subtle`) instead of `node:crypto`. The Node version is
 * still the right choice for server-side handlers running on Node
 * (it's measurably faster and supports Buffer bodies); this one
 * exists so a Primitive Function handler can bundle the verifier
 * without dragging in a `node:crypto` polyfill that inflates the
 * deploy artifact past the size cap.
 *
 * Available natively in Workers, Node 22+, browsers, Deno, and Bun.
 * Zero polyfill weight, zero new runtime dependencies.
 *
 * Surface contract matches the Node verifier exactly: same input
 * shape, same `WebhookVerificationError` class, same set of error
 * codes. Existing callers can swap the import path with no other
 * code changes:
 *
 *   // Node (existing):
 *   import { verifyWebhookSignature } from '@primitivedotdev/sdk';
 *
 *   // Workers / in-handler (this file):
 *   import { verifyWebhookSignature } from '@primitivedotdev/sdk/api';
 */

import { WebhookVerificationError } from "../webhook/errors.js";

// Header name carrying the timestamp + signature. Must match the
// constant of the same name in `../webhook/signing.ts`. Kept in two
// places intentionally so this file has no dependency on the Node
// signing module (which would drag `node:crypto` into the bundle).
export const PRIMITIVE_SIGNATURE_HEADER = "Primitive-Signature";

// Re-export so consumers can `import { verifyWebhookSignature,
// WebhookVerificationError } from '@primitivedotdev/sdk/api'`
// without a second import statement against `/webhook`.
export { WebhookVerificationError } from "../webhook/errors.js";
export type { WebhookVerificationErrorCode } from "../webhook/errors.js";

// 5 minute max-age tolerance matches `webhook/signing.ts`.
const DEFAULT_TOLERANCE_SECONDS = 5 * 60;
// 60 second future tolerance for clock skew.
const FUTURE_TOLERANCE_SECONDS = 60;
// HMAC-SHA256 hex digest is 64 characters. Accept either case to
// stay byte-for-byte compatible with the Node verifier in
// `../webhook/signing.ts`, which uses the same pattern with the `/i`
// flag. Canonical Primitive signers emit lowercase, but tolerating
// uppercase keeps third-party signers (and tests that hand-build
// fixtures) from silently failing through to SIGNATURE_MISMATCH.
const HEX_PATTERN = /^[0-9a-f]+$/i;
const HEX_LENGTH = 64;
const UNIX_SECONDS_PATTERN = /^\d{1,10}$/;

export interface VerifyOptions {
  /**
   * The raw request body string. MUST be the exact bytes Primitive
   * signed; re-serializing parsed JSON produces a different string
   * and the verification will fail.
   */
  rawBody: string;
  /** Value of the `Primitive-Signature` header. */
  signatureHeader: string;
  /** Webhook signing secret. Auto-injected into Function handlers as `env.PRIMITIVE_WEBHOOK_SECRET`. */
  secret: string;
  /** Max age in seconds (default: 300). */
  toleranceSeconds?: number;
  /** Override current time for testing (unix seconds). */
  nowSeconds?: number;
}

function parseSignatureHeader(
  signatureHeader: string,
): { timestamp: number; signatures: string[] } | null {
  if (!signatureHeader || typeof signatureHeader !== "string") {
    return null;
  }

  const parts = signatureHeader.split(",");
  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;

    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();

    if (!key || !value) continue;

    if (key === "t") {
      if (!UNIX_SECONDS_PATTERN.test(value)) continue;
      const parsed = Number(value);
      if (Number.isSafeInteger(parsed)) {
        timestamp = parsed;
      }
    } else if (key === "v1") {
      signatures.push(value);
    }
  }

  if (timestamp === null || signatures.length === 0) {
    return null;
  }

  return { timestamp, signatures };
}

function isValidHex(str: string): boolean {
  return str.length === HEX_LENGTH && HEX_PATTERN.test(str);
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: bytes[i] is always defined for valid index
    hex += bytes[i]!.toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Constant-time comparison of two equal-length hex strings. Returns
 * false if lengths differ (intentionally not a security issue: lengths
 * are public). Iterates the full length regardless of mismatch so the
 * timing signal does not reveal the position of the first divergence.
 */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function computeHmacHex(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  );
  return arrayBufferToHex(signature);
}

/**
 * Verify a webhook signature using the Web Crypto API.
 *
 * Throws `WebhookVerificationError` on failure with a specific error
 * code matching the Node verifier's set. Returns `true` on success.
 *
 * @example
 * ```typescript
 * import {
 *   verifyWebhookSignature,
 *   WebhookVerificationError,
 *   PRIMITIVE_SIGNATURE_HEADER,
 * } from '@primitivedotdev/sdk/api';
 *
 * export default {
 *   async fetch(request: Request, env: { PRIMITIVE_WEBHOOK_SECRET: string }) {
 *     const rawBody = await request.text();
 *     try {
 *       await verifyWebhookSignature({
 *         rawBody,
 *         signatureHeader: request.headers.get(PRIMITIVE_SIGNATURE_HEADER) ?? '',
 *         secret: env.PRIMITIVE_WEBHOOK_SECRET,
 *       });
 *     } catch (err) {
 *       if (err instanceof WebhookVerificationError) {
 *         return new Response('invalid signature', { status: 401 });
 *       }
 *       throw err;
 *     }
 *     // ... process the webhook
 *   },
 * };
 * ```
 */
export async function verifyWebhookSignature(opts: VerifyOptions): Promise<true> {
  const {
    rawBody,
    signatureHeader,
    secret,
    toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
    nowSeconds,
  } = opts;

  // `secret` is typed as `string` here (Node verifier also accepts
  // Buffer, but Buffer isn't a thing in Workers and we deliberately
  // don't include it in the Web Crypto API surface). `!secret` already
  // catches undefined, null, and "" cleanly; no extra type guard
  // needed.
  if (!secret) {
    throw new WebhookVerificationError(
      "MISSING_SECRET",
      "Webhook secret is required but was empty or not provided",
    );
  }

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) {
    throw new WebhookVerificationError(
      "INVALID_SIGNATURE_HEADER",
      "Invalid Primitive-Signature header format. Expected: t={timestamp},v1={signature}",
    );
  }

  const { timestamp, signatures } = parsed;

  const now = nowSeconds ?? Math.floor(Date.now() / 1000);
  const age = now - timestamp;

  if (age > toleranceSeconds) {
    throw new WebhookVerificationError(
      "TIMESTAMP_OUT_OF_RANGE",
      `Webhook timestamp too old (${age}s). Max age is ${toleranceSeconds}s.`,
    );
  }

  if (age < -FUTURE_TOLERANCE_SECONDS) {
    throw new WebhookVerificationError(
      "TIMESTAMP_OUT_OF_RANGE",
      "Webhook timestamp is too far in the future. Check server clock sync.",
    );
  }

  const signedPayloadString = `${timestamp}.${rawBody}`;
  const expectedHex = await computeHmacHex(secret, signedPayloadString);

  // Walk every provided signature so a key-rotation header carrying
  // [old, new] still verifies once the new key is live. Constant-time
  // comparison per candidate so a partial-match attacker can't binary
  // search hex characters by timing.
  //
  // Lowercase the candidate before comparing: HEX_PATTERN accepts
  // either case (to match the Node verifier, which decodes via
  // `Buffer.from(str, "hex")` and is case-insensitive), but
  // expectedHex from `arrayBufferToHex` is always lowercase.
  // Comparing raw `charCodeAt` would treat "AB" and "ab" as
  // different and silently fail through to SIGNATURE_MISMATCH.
  let anyMatch = false;
  for (const candidate of signatures) {
    if (!isValidHex(candidate)) continue;
    if (timingSafeEqualHex(candidate.toLowerCase(), expectedHex)) {
      anyMatch = true;
    }
  }

  if (!anyMatch) {
    throw new WebhookVerificationError(
      "SIGNATURE_MISMATCH",
      "Webhook signature did not match. The body may have been modified in transit, or the secret may be out of date.",
    );
  }

  return true;
}
