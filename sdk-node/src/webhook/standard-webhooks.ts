/**
 * Standard Webhooks Verification & Signing
 *
 * Implements the Standard Webhooks spec (standardwebhooks.com) for webhook
 * signature verification and payload signing.
 *
 * Header format:
 *   webhook-id: <msg_id>
 *   webhook-timestamp: <unix_seconds>
 *   webhook-signature: v1,<base64_hmac_sha256> [v1,<base64_2> ...]
 *
 * Signed payload format: "{msg_id}.{timestamp}.{raw_body}"
 *
 * Secrets are base64-encoded, optionally prefixed with "whsec_".
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { bufferToString } from "./encoding.js";
import { WebhookVerificationError } from "./errors.js";

const WHSEC_PREFIX = "whsec_";
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

/** Default max age for webhook requests (5 minutes) */
const DEFAULT_TOLERANCE_SECONDS = 5 * 60;

/** Future clock skew tolerance (1 minute) */
const FUTURE_TOLERANCE_SECONDS = 60;

/** Standard Webhooks header names */
export const STANDARD_WEBHOOK_ID_HEADER = "webhook-id";
export const STANDARD_WEBHOOK_TIMESTAMP_HEADER = "webhook-timestamp";
export const STANDARD_WEBHOOK_SIGNATURE_HEADER = "webhook-signature";

/**
 * Result from signing a payload in Standard Webhooks format.
 */
export interface StandardWebhooksSignResult {
  /** The webhook-signature header value (e.g. "v1,<base64>") */
  signature: string;
  /** The message ID used for signing */
  msgId: string;
  /** Unix timestamp used for signing */
  timestamp: number;
}

/**
 * Options for verifying a Standard Webhooks signature.
 */
export interface StandardWebhooksVerifyOptions {
  /** The raw HTTP request body */
  rawBody: string | Buffer;
  /** The webhook-id header value */
  msgId: string;
  /** The webhook-timestamp header value (string, parsed to number internally) */
  timestamp: string;
  /** The webhook-signature header value */
  signatureHeader: string;
  /** Your webhook secret (with or without whsec_ prefix) */
  secret: string | Buffer;
  /** Max age in seconds (default: 300) */
  toleranceSeconds?: number;
  /** Override current time for testing (unix seconds) */
  nowSeconds?: number;
}

/**
 * Prepare a Standard Webhooks secret for HMAC computation.
 *
 * Strips the "whsec_" prefix if present, then base64-decodes the remainder
 * to produce the raw HMAC key bytes.
 *
 * @internal
 */
export function prepareStandardWebhooksSecret(secret: string | Buffer): Buffer {
  if (Buffer.isBuffer(secret)) {
    if (secret.length === 0) {
      throw new WebhookVerificationError(
        "MISSING_SECRET",
        "Webhook secret is required but was empty or not provided",
      );
    }
    return secret;
  }

  let keyStr = secret;
  if (keyStr.startsWith(WHSEC_PREFIX)) {
    keyStr = keyStr.slice(WHSEC_PREFIX.length);
  }

  if (!keyStr || !BASE64_PATTERN.test(keyStr)) {
    throw new WebhookVerificationError(
      "MISSING_SECRET",
      "Standard Webhooks secret must be base64-encoded (optionally with whsec_ prefix)",
    );
  }

  const decoded = Buffer.from(keyStr, "base64");
  if (decoded.length === 0) {
    throw new WebhookVerificationError(
      "MISSING_SECRET",
      "Webhook secret is required but was empty or not provided",
    );
  }
  return decoded;
}

/**
 * Parse the webhook-signature header into base64 signature strings.
 *
 * The header format is space-delimited entries like "v1,<base64>".
 * Only v1 entries are returned.
 *
 * @internal
 */
export function parseStandardWebhooksSignatures(header: string): string[] {
  if (!header) return [];

  const signatures: string[] = [];
  for (const entry of header.split(" ")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const commaIdx = trimmed.indexOf(",");
    if (commaIdx === -1) continue;

    const version = trimmed.slice(0, commaIdx);
    const sig = trimmed.slice(commaIdx + 1);

    if (version === "v1" && sig) {
      signatures.push(sig);
    }
  }

  return signatures;
}

/**
 * Sign a webhook payload using the Standard Webhooks format.
 *
 * @param rawBody - The raw JSON body string to sign
 * @param secret - The webhook secret (with or without whsec_ prefix)
 * @param msgId - The message ID (used in webhook-id header)
 * @param timestamp - Unix timestamp in seconds (defaults to current time)
 */
export function signStandardWebhooksPayload(
  rawBody: string | Buffer,
  secret: string | Buffer,
  msgId: string,
  timestamp?: number,
): StandardWebhooksSignResult {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const body =
    typeof rawBody === "string" ? rawBody : bufferToString(rawBody, "rawBody");
  const key = prepareStandardWebhooksSecret(secret);
  if (key.length === 0) {
    throw new WebhookVerificationError(
      "MISSING_SECRET",
      "Webhook secret is required but was empty or not provided",
    );
  }

  const signedPayload = `${msgId}.${ts}.${body}`;
  const sig = createHmac("sha256", key).update(signedPayload).digest("base64");

  return {
    signature: `v1,${sig}`,
    msgId,
    timestamp: ts,
  };
}

/**
 * Verify a Standard Webhooks signature.
 *
 * Throws `WebhookVerificationError` on failure with a specific error code.
 */
export function verifyStandardWebhooksSignature(
  opts: StandardWebhooksVerifyOptions,
): true {
  const {
    rawBody,
    msgId,
    timestamp: timestampStr,
    signatureHeader,
    secret,
    toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
    nowSeconds,
  } = opts;

  // Validate secret
  const key = prepareStandardWebhooksSecret(secret);
  if (key.length === 0) {
    throw new WebhookVerificationError(
      "MISSING_SECRET",
      "Webhook secret is required but was empty or not provided",
    );
  }

  // Parse timestamp
  if (!timestampStr || !/^\d+$/.test(timestampStr)) {
    throw new WebhookVerificationError(
      "INVALID_SIGNATURE_HEADER",
      `Invalid webhook-timestamp header: "${timestampStr}". Expected a unix timestamp in seconds`,
    );
  }
  const timestamp = Number(timestampStr);
  if (!Number.isInteger(timestamp) || timestamp < 0) {
    throw new WebhookVerificationError(
      "INVALID_SIGNATURE_HEADER",
      `Invalid webhook-timestamp header: "${timestampStr}". Expected a unix timestamp in seconds`,
    );
  }

  // Timestamp tolerance checks
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

  // Compute expected signature
  const body =
    typeof rawBody === "string"
      ? rawBody
      : bufferToString(rawBody, "request body");

  const signedPayload = `${msgId}.${timestamp}.${body}`;
  const expectedSig = createHmac("sha256", key)
    .update(signedPayload)
    .digest("base64");

  // Parse and compare signatures
  const signatures = parseStandardWebhooksSignatures(signatureHeader);
  if (signatures.length === 0) {
    throw new WebhookVerificationError(
      "INVALID_SIGNATURE_HEADER",
      'Invalid webhook-signature header format. Expected: "v1,<base64>"',
    );
  }

  const expectedBytes = Buffer.from(expectedSig, "base64");

  for (const sig of signatures) {
    if (!BASE64_PATTERN.test(sig)) {
      continue;
    }
    const sigBytes = Buffer.from(sig, "base64");
    if (
      sigBytes.length === expectedBytes.length &&
      timingSafeEqual(sigBytes, expectedBytes)
    ) {
      return true;
    }
  }

  throw new WebhookVerificationError(
    "SIGNATURE_MISMATCH",
    "No valid signature found. Verify the webhook secret matches and you're using the raw request body (not re-serialized JSON).",
  );
}
