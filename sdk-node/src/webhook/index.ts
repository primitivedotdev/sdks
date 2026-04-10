/**
 * Primitive Node.js SDK
 *
 * Official SDK for verifying Primitive webhook signatures and parsing webhook payloads.
 *
 * @example
 * ```typescript
 * import { handleWebhook, PrimitiveWebhookError } from '@primitivedotdev/sdk-node';
 *
 * app.post('/webhooks/email', express.raw({ type: 'application/json' }), (req, res) => {
 *   try {
 *     const event = handleWebhook({
 *       body: req.body,
 *       headers: req.headers,
 *       secret: process.env.PRIMITIVE_WEBHOOK_SECRET,
 *     });
 *
 *     console.log('Email from:', event.email.headers.from);
 *     res.json({ received: true });
 *   } catch (err) {
 *     if (err instanceof PrimitiveWebhookError) {
 *       console.error(`[${err.code}] ${err.message}`);
 *       return res.status(400).json({ error: err.code });
 *     }
 *     throw err;
 *   }
 * });
 * ```
 *
 * @packageDocumentation
 */

export {
  safeValidateEmailReceivedEvent,
  validateEmailReceivedEvent,
} from "../validation.js";
// Errors
export {
  PAYLOAD_ERRORS,
  // Error classes
  PrimitiveWebhookError,
  RAW_EMAIL_ERRORS,
  RawEmailDecodeError,
  type RawEmailDecodeErrorCode,
  // Error definitions (for docs, dashboards, i18n)
  VERIFICATION_ERRORS,
  // Error code types
  type WebhookErrorCode,
  WebhookPayloadError,
  type WebhookPayloadErrorCode,
  WebhookValidationError,
  type WebhookValidationErrorCode,
  WebhookVerificationError,
  type WebhookVerificationErrorCode,
} from "./errors.js";
// Signing & Verification
export {
  PRIMITIVE_CONFIRMED_HEADER,
  PRIMITIVE_SIGNATURE_HEADER,
  type SignResult,
  signWebhookPayload,
  type VerifyOptions,
  verifyWebhookSignature,
} from "./signing.js";

import { validateEmailReceivedEvent } from "../validation.js";
import {
  PRIMITIVE_CONFIRMED_HEADER,
  verifyWebhookSignature,
} from "./signing.js";

const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

// JSON Schema
export { emailReceivedEventJsonSchema } from "../schema.generated.js";
// Types
export type {
  DkimSignature,
  EmailAddress,
  // Analysis types
  EmailAnalysis,
  // Auth types
  EmailAuth,
  EmailReceivedEvent,
  // Forward analysis types
  ForwardAnalysis,
  ForwardOriginalSender,
  ForwardResult,
  ForwardResultAttachmentAnalyzed,
  ForwardResultAttachmentSkipped,
  ForwardResultInline,
  ForwardVerification,
  KnownWebhookEvent,
  ParsedData,
  ParsedDataComplete,
  ParsedDataFailed,
  ParsedError,
  RawContent,
  RawContentDownloadOnly,
  RawContentInline,
  UnknownEvent,
  ValidateEmailAuthResult,
  WebhookAttachment,
  WebhookEvent,
} from "../types.js";
// Type-safe constants and their types (TypeScript merges const + type with same name)
// Use these instead of magic strings for autocomplete and refactor safety
export {
  AuthConfidence,
  // Auth validation
  AuthVerdict,
  DkimResult,
  DmarcPolicy,
  DmarcResult,
  // Event types
  EventType,
  // Forward verification
  ForwardVerdict,
  // Parsed status
  ParsedStatus,
  // Auth results
  SpfResult,
} from "../types.js";
// Auth Validation
export { validateEmailAuth } from "./auth.js";
// Version
export { WEBHOOK_VERSION } from "./version.js";

import { createHash } from "node:crypto";
import type {
  EmailReceivedEvent,
  UnknownEvent,
  WebhookEvent,
} from "../types.js";
import { RawEmailDecodeError, WebhookPayloadError } from "./errors.js";
import { parseJsonBody } from "./parsing.js";

/**
 * Parse a webhook payload, returning typed events for known types
 * and UnknownEvent for future event types.
 *
 * This provides forward-compatibility: when Primitive adds new event types,
 * your code won't break - you'll receive an UnknownEvent that you can
 * handle or ignore.
 *
 * Known event types are validated against the canonical schema. Unknown
 * event types are returned as-is for forward compatibility.
 *
 * For most use cases, prefer `handleWebhook()` which also verifies the
 * signature before parsing the payload.
 *
 * @param input - The parsed JSON payload
 * @returns Typed event for known types, UnknownEvent for unknown types
 * @throws WebhookPayloadError if the input is not a valid webhook structure
 * @throws WebhookValidationError if a known event fails schema validation
 *
 * @example
 * ```typescript
 * import { parseWebhookEvent } from '@primitivedotdev/sdk-node';
 *
 * const event = parseWebhookEvent(JSON.parse(rawBody));
 *
 * if (event.event === "email.received") {
 *   // TypeScript knows this is EmailReceivedEvent
 *   console.log(event.email.headers.subject);
 * } else {
 *   // Handle or log unknown event types
 *   console.log("Unknown event:", event.event);
 * }
 * ```
 */
export function parseWebhookEvent(input: unknown): WebhookEvent {
  // Basic structure validation
  if (input === null) {
    throw new WebhookPayloadError(
      "PAYLOAD_NULL",
      "Received null instead of webhook payload",
      "Check that your request body variable is defined.",
    );
  }

  if (input === undefined) {
    throw new WebhookPayloadError(
      "PAYLOAD_UNDEFINED",
      "Received undefined instead of webhook payload",
      "Make sure you're passing the request body to parseWebhookEvent()",
    );
  }

  if (Array.isArray(input)) {
    throw new WebhookPayloadError(
      "PAYLOAD_IS_ARRAY",
      "Received array instead of webhook payload object",
      "Webhook payloads must be objects, not arrays.",
    );
  }

  if (typeof input !== "object") {
    throw new WebhookPayloadError(
      "PAYLOAD_WRONG_TYPE",
      `Received ${typeof input} instead of webhook payload object`,
      "Webhook payloads must be objects.",
    );
  }

  const obj = input as Record<string, unknown>;

  if (!("event" in obj) || typeof obj.event !== "string") {
    throw new WebhookPayloadError(
      "PAYLOAD_MISSING_EVENT",
      "Missing 'event' field in payload",
      "This doesn't look like a Primitive webhook payload.",
    );
  }

  // Route to specific handler for known events
  switch (obj.event) {
    case "email.received":
      return validateEmailReceivedEvent(input);

    default:
      // Return as UnknownEvent - user can handle it
      return input as UnknownEvent;
  }
}

/**
 * Type guard to check if a webhook event is an EmailReceivedEvent.
 *
 * @example
 * ```typescript
 * const event = parseWebhookEvent(payload);
 * if (isEmailReceivedEvent(event)) {
 *   // TypeScript knows event is EmailReceivedEvent
 *   console.log(event.email.headers.subject);
 * }
 * ```
 */
export function isEmailReceivedEvent(
  event: WebhookEvent | unknown,
): event is EmailReceivedEvent {
  return (
    typeof event === "object" &&
    event !== null &&
    "event" in event &&
    (event as { event: unknown }).event === "email.received"
  );
}

// -----------------------------------------------------------------------------
// High-Level API
// -----------------------------------------------------------------------------

/**
 * Request headers in any common format.
 *
 * Accepts:
 * - **Plain object** from Express/Node.js (`req.headers`)
 * - **Fetch API `Headers`** from Next.js App Router, Cloudflare Workers (`request.headers`)
 *
 * Header lookup is case-insensitive per RFC 7230.
 */
export type WebhookHeaders =
  | Record<string, string | string[] | undefined>
  | Headers;

/**
 * Options for the handleWebhook function.
 */
export interface HandleWebhookOptions {
  /**
   * The raw request body (before JSON parsing).
   * Must be the exact bytes received - do not re-serialize.
   */
  body: string | Buffer;

  /**
   * The request headers object.
   * Works with Express (req.headers), Fetch API (Request.headers), or any
   * object with string keys. The SDK will find the Primitive-Signature header.
   */
  headers: WebhookHeaders;

  /**
   * Your webhook secret from the Primitive dashboard.
   */
  secret: string;

  /**
   * Maximum age of the webhook in seconds.
   * Webhooks older than this will be rejected as potential replay attacks.
   * @default 300 (5 minutes)
   */
  toleranceSeconds?: number;
}

/**
 * Extract signature header from various header formats.
 */
function getSignatureHeader(headers: WebhookHeaders): string {
  // Fetch API Headers object - already case-insensitive
  if (headers instanceof Headers) {
    return headers.get("primitive-signature") ?? "";
  }

  // Plain object - do case-insensitive lookup per RFC 7230
  const obj = headers as Record<string, string | string[] | undefined>;

  const key = Object.keys(obj).find(
    (k) => k.toLowerCase() === "primitive-signature",
  );

  if (!key) {
    return "";
  }

  const value = obj[key];

  // Handle array values (rare but possible)
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

/**
 * Verify, parse, and validate a webhook in one call.
 *
 * This is the recommended way to handle Primitive webhooks. It:
 * 1. Verifies the signature to ensure the webhook is authentic
 * 2. Parses the JSON body
 * 3. Validates the payload against the canonical JSON schema
 * 4. Returns a fully typed EmailReceivedEvent
 *
 * @param options - The webhook data and secret
 * @returns A validated EmailReceivedEvent
 * @throws {WebhookVerificationError} If signature verification fails
 * @throws {WebhookPayloadError} If JSON parsing fails
 * @throws {WebhookValidationError} If schema validation fails
 *
 * @example
 * ```typescript
 * import { handleWebhook, PrimitiveWebhookError } from '@primitivedotdev/sdk-node';
 *
 * app.post('/webhooks/email', express.raw({ type: 'application/json' }), (req, res) => {
 *   try {
 *     const event = handleWebhook({
 *       body: req.body,
 *       headers: req.headers,
 *       secret: process.env.PRIMITIVE_WEBHOOK_SECRET,
 *     });
 *
 *     console.log('Email from:', event.email.headers.from);
 *     res.json({ received: true });
 *   } catch (err) {
 *     if (err instanceof PrimitiveWebhookError) {
 *       console.error(`[${err.code}] ${err.message}`);
 *       return res.status(400).json({ error: err.code });
 *     }
 *     throw err;
 *   }
 * });
 * ```
 */
export function handleWebhook(
  options: HandleWebhookOptions,
): EmailReceivedEvent {
  const { body, headers, secret, toleranceSeconds } = options;

  // Step 1: Verify signature
  const signature = getSignatureHeader(headers);
  verifyWebhookSignature({
    rawBody: body,
    signatureHeader: signature,
    secret,
    toleranceSeconds,
  });

  // Step 2: Parse JSON (shared helper handles UTF-8 validation, BOM stripping, etc.)
  const parsed = parseJsonBody(body);

  // Step 3: Validate against JSON Schema
  return validateEmailReceivedEvent(parsed);
}

// -----------------------------------------------------------------------------
// Response Helpers
// -----------------------------------------------------------------------------

/**
 * Returns headers for the optional "content discard" feature.
 *
 * If you have the "content discard" setting enabled in your Primitive dashboard,
 * returning this header tells Primitive to permanently delete the email content
 * after successful delivery. Requires BOTH the dashboard setting AND this header.
 *
 * **Warning:** Only use this if you can durably guarantee you've processed the email.
 * Once discarded, the email content is gone forever.
 *
 * @returns Headers object to spread into your response
 *
 * @example Express (only if using content discard)
 * ```typescript
 * app.post('/webhook', (req, res) => {
 *   const event = handleWebhook({ ... });
 *   // Durably save the email first!
 *   await db.saveEmail(event);
 *   res.set(confirmedHeaders()).json({ received: true });
 * });
 * ```
 *
 * @example Fetch API / Next.js (only if using content discard)
 * ```typescript
 * return new Response(JSON.stringify({ received: true }), {
 *   status: 200,
 *   headers: {
 *     'Content-Type': 'application/json',
 *     ...confirmedHeaders(),
 *   },
 * });
 * ```
 */
export function confirmedHeaders(): { "X-Primitive-Confirmed": "true" } {
  return { [PRIMITIVE_CONFIRMED_HEADER]: "true" };
}

// -----------------------------------------------------------------------------
// Download URL Helpers
// -----------------------------------------------------------------------------

/**
 * Check if the download URL for a webhook event has expired.
 *
 * @param event - The webhook event
 * @param now - Optional current time for testing (defaults to Date.now())
 * @returns true if the download URL has expired
 *
 * @example
 * ```typescript
 * if (isDownloadExpired(event)) {
 *   console.log("Download URL has expired, cannot fetch raw email");
 * } else {
 *   const response = await fetch(event.email.content.download.url);
 * }
 * ```
 */
export function isDownloadExpired(
  event: EmailReceivedEvent,
  now: number = Date.now(),
): boolean {
  const expiresAt = new Date(event.email.content.download.expires_at).getTime();
  return now >= expiresAt;
}

/**
 * Get the time remaining (in milliseconds) before the download URL expires.
 * Returns 0 if already expired.
 *
 * @param event - The webhook event
 * @param now - Optional current time for testing (defaults to Date.now())
 * @returns Milliseconds until expiration, or 0 if expired
 *
 * @example
 * ```typescript
 * const remaining = getDownloadTimeRemaining(event);
 * if (remaining > 60000) {
 *   // More than 1 minute left, safe to download
 * }
 * ```
 */
export function getDownloadTimeRemaining(
  event: EmailReceivedEvent,
  now: number = Date.now(),
): number {
  const expiresAt = new Date(event.email.content.download.expires_at).getTime();
  return Math.max(0, expiresAt - now);
}

// -----------------------------------------------------------------------------
// Raw Email Helpers
// -----------------------------------------------------------------------------

/**
 * Check if the raw email content is included inline in the event.
 *
 * Use this to check before calling `decodeRawEmail()` to avoid try/catch.
 *
 * @param event - The webhook event
 * @returns true if raw content is included inline, false if download required
 *
 * @example
 * ```typescript
 * if (isRawIncluded(event)) {
 *   const rawEmail = decodeRawEmail(event);
 * } else {
 *   const response = await fetch(event.email.content.download.url);
 * }
 * ```
 */
export function isRawIncluded(event: EmailReceivedEvent): boolean {
  return event.email.content.raw.included;
}

/**
 * Options for decoding raw email content.
 */
export interface DecodeRawEmailOptions {
  /**
   * Whether to verify the SHA-256 hash after decoding.
   * @default true
   */
  verify?: boolean;
}

/**
 * Decode the raw email content from an EmailReceivedEvent.
 *
 * Throws if the raw content is not included inline (i.e., must be downloaded).
 * By default, verifies the SHA-256 hash matches after decoding.
 *
 * NOTE: This function assumes a well-formed event from `handleWebhook()`.
 * Passing a manually constructed event with missing fields (e.g., `raw.data`
 * undefined when `raw.included` is true) will result in undefined behavior.
 *
 * @param event - The webhook event containing the raw email
 * @param options - Decoding options
 * @returns The decoded raw email as a Buffer
 * @throws {RawEmailDecodeError} If content not included or hash mismatch
 *
 * @example
 * ```typescript
 * import { handleWebhook, decodeRawEmail, isRawIncluded } from '@primitivedotdev/sdk-node';
 *
 * const event = handleWebhook({ body, headers, secret });
 *
 * if (isRawIncluded(event)) {
 *   const rawEmail = decodeRawEmail(event);
 *   // rawEmail is a Buffer containing the RFC 5322 email
 * } else {
 *   // Must download from event.email.content.download.url
 * }
 * ```
 */
export function decodeRawEmail(
  event: EmailReceivedEvent,
  options: DecodeRawEmailOptions = {},
): Buffer {
  const { verify = true } = options;
  const raw = event.email.content.raw;

  if (!raw.included) {
    throw new RawEmailDecodeError(
      "NOT_INCLUDED",
      `Raw email not included inline (size: ${raw.size_bytes} bytes, threshold: ${raw.max_inline_bytes} bytes). ` +
        `Download from: ${event.email.content.download.url}`,
    );
  }

  if (!BASE64_PATTERN.test(raw.data)) {
    throw new RawEmailDecodeError(
      "INVALID_BASE64",
      "Raw email data is not valid base64. The raw email data may be malformed.",
    );
  }

  const decoded = Buffer.from(raw.data, "base64");

  if (verify) {
    const hash = createHash("sha256").update(decoded).digest("hex");
    if (hash !== raw.sha256) {
      throw new RawEmailDecodeError(
        "HASH_MISMATCH",
        `SHA-256 hash mismatch. Expected: ${raw.sha256}, got: ${hash}. The raw email data may be corrupted.`,
      );
    }
  }

  return decoded;
}

/**
 * Verify downloaded raw email content against the SHA-256 hash in the event.
 *
 * Use this after fetching from `event.email.content.download.url` to ensure
 * the downloaded content matches what Primitive received.
 *
 * @param downloaded - The downloaded raw email content (Buffer, ArrayBuffer, or Uint8Array)
 * @param event - The webhook event containing the expected hash
 * @returns The verified content as a Buffer
 * @throws {RawEmailDecodeError} If hash doesn't match
 *
 * @example
 * ```typescript
 * import { handleWebhook, verifyRawEmailDownload, isRawIncluded } from '@primitivedotdev/sdk-node';
 *
 * const event = handleWebhook({ body, headers, secret });
 *
 * if (!isRawIncluded(event)) {
 *   const response = await fetch(event.email.content.download.url);
 *   const arrayBuffer = await response.arrayBuffer();
 *   const verified = verifyRawEmailDownload(arrayBuffer, event);
 *   // verified is a Buffer containing the RFC 5322 email
 * }
 * ```
 */
export function verifyRawEmailDownload(
  downloaded: Buffer | ArrayBuffer | Uint8Array,
  event: EmailReceivedEvent,
): Buffer {
  const buffer = Buffer.isBuffer(downloaded)
    ? downloaded
    : Buffer.from(downloaded as ArrayBuffer);

  const hash = createHash("sha256").update(buffer).digest("hex");
  const expected = event.email.content.raw.sha256;

  if (hash !== expected) {
    throw new RawEmailDecodeError(
      "HASH_MISMATCH",
      `SHA-256 hash mismatch. Expected: ${expected}, got: ${hash}. The downloaded content may be corrupted.`,
    );
  }

  return buffer;
}
