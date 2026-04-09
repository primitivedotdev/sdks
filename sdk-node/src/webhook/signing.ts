/**
 * Webhook HMAC Signing (Stripe-style format)
 *
 * Implements HMAC-SHA256 signature for webhook security with timestamp validation.
 * Prevents replay attacks by including timestamp in signature.
 *
 * Header format:
 *   Primitive-Signature: t=<unix_seconds>,v1=<hex_hmac_sha256>
 *
 * Signed payload format: "{timestamp}.{raw_body}"
 *
 * This format matches Stripe's webhook signature scheme, which is widely understood
 * and easy to implement in any language with ~15 lines of code.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { bufferToString } from "./encoding.js";
import { WebhookVerificationError } from "./errors.js";

// -----------------------------------------------------------------------------
// Signature Cache
// -----------------------------------------------------------------------------

/**
 * Cache entry for computed HMAC signatures.
 * Keyed by Buffer body, stores the computed signature along with
 * the inputs used to compute it (for validation on cache hit).
 */
interface SignatureCacheEntry {
  /** Hash of the secret (to verify same secret without storing it) */
  secretHash: string;
  /** Timestamp from the signature header */
  timestamp: number;
  /** The computed HMAC signature (hex) */
  computed: string;
}

/**
 * WeakMap cache for computed signatures.
 * Only works for Buffer bodies (strings cannot be WeakMap keys).
 * Automatically garbage collected when Buffer is no longer referenced.
 */
const signatureCache = new WeakMap<Buffer, SignatureCacheEntry>();

/**
 * Hash a secret for cache key comparison.
 * @internal
 */
function hashSecret(secret: string | Buffer): string {
  return createHash("sha256").update(secret).digest("hex");
}

/** Header name for incoming webhook signature */
export const PRIMITIVE_SIGNATURE_HEADER = "Primitive-Signature";

/** Header name to confirm webhook was processed (prevents retries) */
export const PRIMITIVE_CONFIRMED_HEADER = "X-Primitive-Confirmed";

/** Default max age for webhook requests (5 minutes) */
const DEFAULT_TOLERANCE_SECONDS = 5 * 60;

/** Future clock skew tolerance (1 minute) */
const FUTURE_TOLERANCE_SECONDS = 60;

/** Valid hex pattern for signature verification */
const HEX_PATTERN = /^[0-9a-f]+$/i;

/**
 * Result from signing a webhook payload
 */
export interface SignResult {
  /** Full header value ready to set on Primitive-Signature */
  header: string;
  /** Unix timestamp used for signing */
  timestamp: number;
  /** Raw hex signature (useful for debugging/tests) */
  v1: string;
}

/**
 * Options for verifying a webhook signature
 */
export interface VerifyOptions {
  /** The raw HTTP request body (must be the exact bytes, not re-serialized JSON) */
  rawBody: string | Buffer;
  /** The full Primitive-Signature header value */
  signatureHeader: string;
  /** Your webhook secret */
  secret: string | Buffer;
  /** Max age in seconds (default: 300) */
  toleranceSeconds?: number;
  /** Override current time for testing (unix seconds) */
  nowSeconds?: number;
}

/**
 * Sign a webhook payload using HMAC-SHA256.
 *
 * Useful for:
 * - Internal testing and dogfooding
 * - Generating test vectors
 * - Integration tests
 *
 * @param rawBody - The raw JSON body string to sign
 * @param secret - The webhook secret key
 * @param timestamp - Unix timestamp in seconds (defaults to current time)
 */
export function signWebhookPayload(
  rawBody: string | Buffer,
  secret: string | Buffer,
  timestamp?: number,
): SignResult {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const body =
    typeof rawBody === "string" ? rawBody : bufferToString(rawBody, "rawBody");

  // Signed payload format: "{timestamp}.{raw_body}"
  const signedPayloadString = `${ts}.${body}`;

  const hmac = createHmac("sha256", secret);
  hmac.update(signedPayloadString);
  const v1 = hmac.digest("hex");

  return {
    header: `t=${ts},v1=${v1}`,
    timestamp: ts,
    v1,
  };
}

/**
 * Parse the Primitive-Signature header into its components.
 * Tolerant of whitespace around keys/values.
 *
 * @internal
 */
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
      const parsed = Number.parseInt(value, 10);
      if (!Number.isNaN(parsed)) {
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

/**
 * Check if a string is valid lowercase hex of expected length
 */
function isValidHex(str: string, expectedLength: number): boolean {
  return str.length === expectedLength && HEX_PATTERN.test(str);
}

/**
 * Verify a webhook signature.
 *
 * Throws `WebhookVerificationError` on failure with a specific error code.
 *
 * @example
 * ```typescript
 * import { verifyWebhookSignature, WebhookVerificationError } from '@primitivedotdev/sdk-node';
 *
 * try {
 *   verifyWebhookSignature({
 *     rawBody: req.body, // raw string, NOT parsed JSON
 *     signatureHeader: req.headers['primitive-signature'],
 *     secret: process.env.PRIMITIVE_WEBHOOK_SECRET,
 *   });
 *   // Signature is valid, process the webhook
 * } catch (err) {
 *   if (err instanceof WebhookVerificationError) {
 *     console.error('Invalid webhook:', err.code, err.message);
 *   }
 *   return res.status(400).send('Invalid signature');
 * }
 * ```
 */
export function verifyWebhookSignature(opts: VerifyOptions): true {
  const {
    rawBody,
    signatureHeader,
    secret,
    toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
    nowSeconds,
  } = opts;

  // Validate secret is provided and non-empty
  if (!secret || (typeof secret === "string" && secret.length === 0)) {
    throw new WebhookVerificationError(
      "MISSING_SECRET",
      "Webhook secret is required but was empty or not provided",
    );
  }

  // Parse header
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) {
    throw new WebhookVerificationError(
      "INVALID_SIGNATURE_HEADER",
      "Invalid Primitive-Signature header format. Expected: t={timestamp},v1={signature}",
    );
  }

  const { timestamp, signatures } = parsed;

  // Get current time
  const now = nowSeconds ?? Math.floor(Date.now() / 1000);
  const age = now - timestamp;

  // Reject if timestamp is too old (replay attack protection)
  if (age > toleranceSeconds) {
    throw new WebhookVerificationError(
      "TIMESTAMP_OUT_OF_RANGE",
      `Webhook timestamp too old (${age}s). Max age is ${toleranceSeconds}s.`,
    );
  }

  // Reject if timestamp is in the future (clock skew tolerance)
  if (age < -FUTURE_TOLERANCE_SECONDS) {
    throw new WebhookVerificationError(
      "TIMESTAMP_OUT_OF_RANGE",
      "Webhook timestamp is too far in the future. Check server clock sync.",
    );
  }

  // Compute expected signature (with caching for Buffer bodies)
  const body =
    typeof rawBody === "string"
      ? rawBody
      : bufferToString(rawBody, "request body");

  let expectedHex: string;

  // Check cache for Buffer bodies (WeakMap requires object keys)
  if (Buffer.isBuffer(rawBody)) {
    const cached = signatureCache.get(rawBody);
    const currentSecretHash = hashSecret(secret);

    if (
      cached &&
      cached.timestamp === timestamp &&
      cached.secretHash === currentSecretHash
    ) {
      // Cache hit - reuse computed signature
      expectedHex = cached.computed;
    } else {
      // Cache miss - compute and store
      const signedPayloadString = `${timestamp}.${body}`;
      const hmac = createHmac("sha256", secret);
      hmac.update(signedPayloadString);
      expectedHex = hmac.digest("hex");

      signatureCache.set(rawBody, {
        secretHash: currentSecretHash,
        timestamp,
        computed: expectedHex,
      });
    }
  } else {
    // String bodies - compute without caching (strings can't be WeakMap keys)
    const signedPayloadString = `${timestamp}.${body}`;
    const hmac = createHmac("sha256", secret);
    hmac.update(signedPayloadString);
    expectedHex = hmac.digest("hex");
  }

  // Check if any of the provided signatures match (supports key rotation)
  for (const receivedHex of signatures) {
    // Validate hex format (SHA-256 = 64 hex chars)
    if (!isValidHex(receivedHex, 64)) {
      continue;
    }

    // Compare as hex bytes using constant-time comparison
    const receivedBytes = Buffer.from(receivedHex, "hex");
    const expectedBytes = Buffer.from(expectedHex, "hex");

    if (timingSafeEqual(receivedBytes, expectedBytes)) {
      return true;
    }
  }

  // Check if body looks like it was re-serialized (common mistake)
  const reserializationHint = detectReserializedBody(body);
  const message = reserializationHint
    ? `No valid signature found. ${reserializationHint}`
    : "No valid signature found. Verify the webhook secret matches and you're using the raw request body (not re-serialized JSON).";

  throw new WebhookVerificationError("SIGNATURE_MISMATCH", message);
}

/**
 * Detect if a body looks like it was re-serialized by a framework.
 * Returns a helpful message if detected, null otherwise.
 * @internal
 */
function detectReserializedBody(body: string): string | null {
  // Check for pretty-printed JSON (newlines + indentation)
  // This is a common sign of JSON.stringify(parsed, null, 2) or similar
  if (/^\s*\{[\s\S]*\n\s{2,}/.test(body)) {
    return "Request body appears re-serialized (pretty-printed). Use the raw request body before any JSON.parse() or JSON.stringify() calls.";
  }

  return null;
}
