/**
 * Primitive Node.js SDK
 *
 * Official SDK for verifying Primitive webhook signatures and parsing webhook payloads.
 *
 * @example
 * ```typescript
 * import { handleWebhook, PrimitiveWebhookError } from '@primitivedotdev/sdk';
 *
 * app.post('/webhooks/email', express.raw({ type: 'application/json' }), (req, res) => {
 *   try {
 *     const event = handleWebhook({
 *       body: req.body,
 *       headers: req.headers,
 *       secret: process.env.PRIMITIVE_WEBHOOK_SECRET!,
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
// Download Tokens
export {
  type GenerateDownloadTokenOptions,
  generateDownloadToken,
  type VerifyDownloadTokenOptions,
  type VerifyDownloadTokenResult,
  verifyDownloadToken,
} from "./download-tokens.js";
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
// Event catalog, typed payment/interaction events, and type guards
export {
  EMAIL_EVENT_TYPES,
  INTERACTION_EVENT_TYPES,
  type InteractionEvent,
  type InteractionX402Event,
  type InteractionX402Suffix,
  isEmailReceivedEvent,
  isInteractionX402Event,
  isKnownWebhookEventType,
  isPaymentEvent,
  isPaymentFailedEvent,
  isPaymentSettledEvent,
  PAYMENT_EVENT_TYPES,
  type PaymentEvent,
  type PaymentFailedEvent,
  type PaymentSettledEvent,
  WEBHOOK_EVENT_TYPES,
  type WebhookEventType,
} from "./events.js";
export {
  buildForwardSubject,
  buildReplySubject,
  formatAddress,
  normalizeReceivedEmail,
  parseHeaderAddress,
  type ReceivedEmail,
  type ReceivedEmailAddress,
  type ReceivedEmailThread,
} from "./received-email.js";
// Signing & Verification
export {
  LEGACY_CONFIRMED_HEADER,
  LEGACY_SIGNATURE_HEADER,
  PRIMITIVE_CONFIRMED_HEADER,
  PRIMITIVE_SIGNATURE_HEADER,
  type SignResult,
  signWebhookPayload,
  type VerifyOptions,
  verifyWebhookSignature,
} from "./signing.js";
// Standard Webhooks
export {
  STANDARD_WEBHOOK_ID_HEADER,
  STANDARD_WEBHOOK_SIGNATURE_HEADER,
  STANDARD_WEBHOOK_TIMESTAMP_HEADER,
  type StandardWebhooksSignResult,
  type StandardWebhooksVerifyOptions,
  signStandardWebhooksPayload,
  verifyStandardWebhooksSignature,
} from "./standard-webhooks.js";

import { validateEmailReceivedEvent } from "../validation.js";
import {
  LEGACY_CONFIRMED_HEADER,
  PRIMITIVE_CONFIRMED_HEADER,
  verifyWebhookSignature,
} from "./signing.js";
import { verifyStandardWebhooksSignature } from "./standard-webhooks.js";

const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

// JSON Schema
export { emailReceivedEventJsonSchema } from "../schema.generated.js";
// Types
export type {
  BounceAnalysis,
  DkimSignature,
  DmarcReportAnalysis,
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
  // Recipient-routing decision
  RoutingDecision,
  TlsReportAnalysis,
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
// Domain-anchored sender trust
export {
  isTrustedSender,
  type TrustedSenderOptions,
  type TrustedSenderResult,
  type TrustReason,
} from "./trust.js";
// Version
export { WEBHOOK_VERSION } from "./version.js";

import { createHash } from "node:crypto";
import type {
  EmailReceivedEvent,
  UnknownEvent,
  WebhookEvent,
} from "../types.js";
import {
  RawEmailDecodeError,
  WebhookPayloadError,
  WebhookVerificationError,
} from "./errors.js";
import { isKnownWebhookEventType } from "./events.js";
import { parseJsonBody } from "./parsing.js";
import {
  normalizeReceivedEmail,
  type ReceivedEmail,
} from "./received-email.js";

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
 * import { parseWebhookEvent } from '@primitivedotdev/sdk';
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
export function parseWebhookEvent(
  input: unknown,
  eventType?: string | null,
): WebhookEvent {
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

  // The event name is carried in the `X-Webhook-Event` HEADER for every event
  // family. The stored body is sent verbatim with no envelope: email.* bodies
  // carry `event`, payment.* bodies carry the name in `type`, and interaction.*
  // bodies are just `{ interaction: { ... } }` with no event/type field. So the
  // header is the PRIMARY discriminator; we fall back to a top-level `event`
  // string in the body only for backward-compat with any sender that embeds it.
  const resolvedEvent =
    (typeof eventType === "string" && eventType) ||
    (typeof obj.event === "string" ? obj.event : undefined);

  if (!resolvedEvent) {
    // No `X-Webhook-Event` header AND no in-body `event` field: we cannot
    // classify this payload at all. Preserve the legacy contract and throw,
    // so a genuinely malformed call is still surfaced. The real sender always
    // sets the header, so the handle* entry points never hit this.
    throw new WebhookPayloadError(
      "PAYLOAD_MISSING_EVENT",
      "Missing event discriminator: no X-Webhook-Event header and no 'event' field in payload",
      "Pass the X-Webhook-Event header (the canonical discriminator) or call handleWebhookEvent, which reads it for you.",
    );
  }

  // Route to specific handler for known events.
  switch (resolvedEvent) {
    case "email.received":
      return validateEmailReceivedEvent(input);

    case "payment.settled":
    case "payment.failed":
      // Payment bodies carry the name in `type`; overlay a canonical `event`
      // (mirrored from the header) so consumers branch on a single field.
      return { ...obj, event: resolvedEvent } as WebhookEvent;

    default:
      if (isKnownWebhookEventType(resolvedEvent)) {
        // Known interaction.* (and any other catalog) event: the body has no
        // event/type field, so overlay the canonical name from the header.
        return { ...obj, event: resolvedEvent } as WebhookEvent;
      }
      // Unknown event type: return as UnknownEvent for forward compatibility.
      return { ...obj, event: resolvedEvent } as unknown as UnknownEvent;
  }
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
 * The header that names the webhook event for ALL event families
 * (`email.*`, `payment.*`, `interaction.*`). It is the primary discriminator
 * the parser keys on, because the stored body is sent verbatim with no envelope.
 */
export const WEBHOOK_EVENT_HEADER = "X-Webhook-Event";

const SIGNATURE_HEADER_NAMES = ["primitive-signature", "mymx-signature"];

/**
 * Read the `X-Webhook-Event` header value (case-insensitive). Returns null when
 * the header is absent.
 */
export function getEventHeader(headers: WebhookHeaders): string | null {
  if (headers instanceof Headers) {
    return headers.get("x-webhook-event");
  }
  const obj = headers as Record<string, string | string[] | undefined>;
  const key = Object.keys(obj).find(
    (k) => k.toLowerCase() === "x-webhook-event",
  );
  if (!key) return null;
  const value = obj[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
const STANDARD_WEBHOOKS_HEADER_NAMES = [
  "webhook-signature",
  "webhook-id",
  "webhook-timestamp",
] as const;

/**
 * Extract signature header from various header formats.
 * Checks for Primitive-Signature first, then falls back to the legacy
 * MyMX-Signature for backward compatibility with older servers.
 */
function getSignatureHeader(headers: WebhookHeaders): string {
  // Fetch API Headers object - already case-insensitive
  if (headers instanceof Headers) {
    for (const name of SIGNATURE_HEADER_NAMES) {
      const value = headers.get(name);
      if (value) return value;
    }
    return "";
  }

  // Plain object - do case-insensitive lookup per RFC 7230
  const obj = headers as Record<string, string | string[] | undefined>;
  const keys = Object.keys(obj);

  for (const name of SIGNATURE_HEADER_NAMES) {
    const key = keys.find((k) => k.toLowerCase() === name);
    if (!key) continue;

    const value = obj[key];
    if (Array.isArray(value)) return value[0] ?? "";
    if (value) return value;
  }

  return "";
}

/**
 * Extract Standard Webhooks headers from various header formats.
 *
 * Returns all three required headers if `webhook-signature` is present.
 * If `webhook-signature` is found but `webhook-id` or `webhook-timestamp`
 * is missing, throws an error (partial Standard Webhooks headers indicate
 * a misconfiguration, not a Primitive-format webhook).
 *
 * Returns null if `webhook-signature` is not present (fall through to Primitive).
 */
function getStandardWebhooksHeaders(
  headers: WebhookHeaders,
): { msgId: string; timestamp: string; signature: string } | null {
  let signature = "";
  let msgId = "";
  let timestamp = "";

  let hasSignatureKey = false;

  if (headers instanceof Headers) {
    hasSignatureKey = headers.has("webhook-signature");
    if (!hasSignatureKey) return null;
    signature = headers.get("webhook-signature") ?? "";
    msgId = headers.get("webhook-id") ?? "";
    timestamp = headers.get("webhook-timestamp") ?? "";
  } else {
    const obj = headers as Record<string, string | string[] | undefined>;
    const keys = Object.keys(obj);

    for (const name of STANDARD_WEBHOOKS_HEADER_NAMES) {
      const key = keys.find((k) => k.toLowerCase() === name);
      const raw = key ? obj[key] : undefined;
      const value = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");

      if (name === "webhook-signature") {
        hasSignatureKey = key !== undefined;
        signature = value;
      } else if (name === "webhook-id") msgId = value;
      else if (name === "webhook-timestamp") timestamp = value;
    }

    if (!hasSignatureKey) return null;
  }

  if (!signature) {
    throw new WebhookVerificationError(
      "INVALID_SIGNATURE_HEADER",
      'Empty webhook-signature header. Expected: "v1,<base64>"',
    );
  }

  if (!msgId || !timestamp) {
    throw new WebhookVerificationError(
      "INVALID_SIGNATURE_HEADER",
      `Found webhook-signature header but missing ${!msgId ? "webhook-id" : "webhook-timestamp"} header. ` +
        "Standard Webhooks requires all three headers: webhook-id, webhook-timestamp, webhook-signature.",
    );
  }

  return { msgId, timestamp, signature };
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
 * import { handleWebhook, PrimitiveWebhookError } from '@primitivedotdev/sdk';
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
function verifyWebhookRequest(options: HandleWebhookOptions): void {
  const { body, headers, secret, toleranceSeconds } = options;

  // Verify signature (Standard Webhooks or Primitive format). This runs on the
  // RAW body and is independent of the event type, so it works identically for
  // email.*, payment.*, and interaction.* bodies.
  const swHeaders = getStandardWebhooksHeaders(headers);
  if (swHeaders) {
    verifyStandardWebhooksSignature({
      rawBody: body,
      msgId: swHeaders.msgId,
      timestamp: swHeaders.timestamp,
      signatureHeader: swHeaders.signature,
      secret,
      toleranceSeconds,
    });
  } else {
    const signature = getSignatureHeader(headers);
    verifyWebhookSignature({
      rawBody: body,
      signatureHeader: signature,
      secret,
      toleranceSeconds,
    });
  }
}

/**
 * Verify, then parse any webhook event into a typed value.
 *
 * Unlike {@link handleWebhook}, this returns the full {@link WebhookEvent}
 * union, so it handles `payment.*` and `interaction.x402.*` events in addition
 * to `email.*`. The flow is:
 *
 * 1. Verify the signature over the RAW body (works for every event family).
 * 2. Parse the JSON body.
 * 3. Classify on the `X-Webhook-Event` HEADER (the primary discriminator),
 *    returning a typed event for known types and an UnknownEvent for the rest.
 *
 * @example
 * ```typescript
 * const event = handleWebhookEvent({ body, headers, secret });
 * if (isPaymentSettledEvent(event)) {
 *   // typed PaymentSettledEvent
 * } else if (isInteractionX402Event(event)) {
 *   // typed interaction.x402.* event
 * }
 * ```
 */
export function handleWebhookEvent(
  options: HandleWebhookOptions,
): WebhookEvent {
  verifyWebhookRequest(options);
  const parsed = parseJsonBody(options.body);
  return parseWebhookEvent(parsed, getEventHeader(options.headers));
}

export function handleWebhook(
  options: HandleWebhookOptions,
): EmailReceivedEvent {
  verifyWebhookRequest(options);

  // Parse JSON (shared helper handles UTF-8 validation, BOM stripping, etc.).
  const parsed = parseJsonBody(options.body);

  // handleWebhook is hard-typed to the email.received payload for backward
  // compatibility. Use handleWebhookEvent for payment/interaction events.
  return validateEmailReceivedEvent(parsed);
}

export interface ReceiveRequestOptions {
  secret: string;
  toleranceSeconds?: number;
}

export function receive(options: HandleWebhookOptions): ReceivedEmail;
export function receive(
  request: Request,
  options: ReceiveRequestOptions,
): Promise<ReceivedEmail>;
export function receive(
  input: HandleWebhookOptions | Request,
  options?: ReceiveRequestOptions,
): ReceivedEmail | Promise<ReceivedEmail> {
  if (input instanceof Request) {
    return receiveFromRequest(input, options);
  }

  return normalizeReceivedEmail(handleWebhook(input));
}

async function receiveFromRequest(
  request: Request,
  options?: ReceiveRequestOptions,
): Promise<ReceivedEmail> {
  if (!options?.secret) {
    throw new WebhookVerificationError(
      "MISSING_SECRET",
      "Webhook secret is required but was empty or not provided",
    );
  }

  const body = Buffer.from(await request.arrayBuffer());

  return normalizeReceivedEmail(
    handleWebhook({
      body,
      headers: request.headers,
      secret: options.secret,
      toleranceSeconds: options.toleranceSeconds,
    }),
  );
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
 * app.post('/webhook', async (req, res) => {
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
export function confirmedHeaders(): {
  "X-Primitive-Confirmed": "true";
  "X-MyMX-Confirmed": "true";
} {
  return {
    [PRIMITIVE_CONFIRMED_HEADER]: "true",
    [LEGACY_CONFIRMED_HEADER]: "true",
  };
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
 * import { handleWebhook, decodeRawEmail, isRawIncluded } from '@primitivedotdev/sdk';
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
    if (hash !== raw.sha256.toLowerCase()) {
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
 * import { handleWebhook, verifyRawEmailDownload, isRawIncluded } from '@primitivedotdev/sdk';
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

  if (hash !== expected.toLowerCase()) {
    throw new RawEmailDecodeError(
      "HASH_MISMATCH",
      `SHA-256 hash mismatch. Expected: ${expected}, got: ${hash}. The downloaded content may be corrupted.`,
    );
  }

  return buffer;
}
