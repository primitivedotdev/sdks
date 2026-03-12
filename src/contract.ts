/**
 * Primitive Contract
 *
 * This module exposes the exact functions used by Primitive servers to construct
 * webhook payloads. It serves two purposes:
 *
 * 1. **Build-time type safety**: The Primitive server imports these types and functions,
 *    ensuring that any schema changes in the SDK cause compile-time errors in the
 *    server code. This makes it impossible to accidentally break the webhook contract.
 *
 * 2. **Debugging transparency**: If you ever receive a malformed payload, you can
 *    verify your handler against these exact types and report issues with confidence
 *    about which side broke the contract.
 *
 * This is also useful for building test fixtures that match real payloads exactly.
 *
 * @module @primitivedotdev/sdk-node/contract
 */

import { createHash } from "node:crypto";
import type {
  EmailAddress,
  EmailAnalysis,
  EmailAuth,
  EmailReceivedEvent,
  ParsedDataComplete,
  ParsedDataFailed,
  ParsedError,
  RawContentDownloadOnly,
  RawContentInline,
  WebhookAttachment,
} from "./types.js";

// Re-export types that consumers need
export type {
  EmailAddress,
  EmailAnalysis,
  EmailAuth,
  EmailReceivedEvent,
  WebhookAttachment,
  ParsedError,
  ParsedDataComplete,
  ParsedDataFailed,
  RawContentInline,
  RawContentDownloadOnly,
} from "./types.js";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Maximum raw email size for inline inclusion (256 KB) */
export const RAW_EMAIL_INLINE_THRESHOLD = 262144;

// Import and re-export version from single source of truth
import { WEBHOOK_VERSION } from "./webhook/version.js";
export { WEBHOOK_VERSION };

// Re-export signing for test fixture generation
export { signWebhookPayload, type SignResult } from "./webhook/signing.js";

// -----------------------------------------------------------------------------
// Input Types
// -----------------------------------------------------------------------------

/**
 * Parsed content input when parsing succeeded.
 */
export interface ParsedInputComplete {
  status: "complete";
  body_text: string | null;
  body_html: string | null;
  /** Parsed Reply-To header addresses (optional, defaults to null) */
  reply_to?: EmailAddress[] | null;
  /** Parsed CC header addresses (optional, defaults to null) */
  cc?: EmailAddress[] | null;
  /** Parsed BCC header addresses (optional, defaults to null) */
  bcc?: EmailAddress[] | null;
  /** In-Reply-To header values (optional, defaults to null) */
  in_reply_to?: string[] | null;
  /** References header values (optional, defaults to null) */
  references?: string[] | null;
  attachments: WebhookAttachment[];
  /** Storage key for attachments tarball (used to generate download URL) */
  attachments_storage_key: string | null;
}

/**
 * Parsed content input when parsing failed.
 */
export interface ParsedInputFailed {
  status: "failed";
  error: ParsedError;
}

/**
 * Parsed content input (discriminated union on status).
 */
export type ParsedInput = ParsedInputComplete | ParsedInputFailed;

/**
 * Input for building an EmailReceivedEvent.
 *
 * This is the strict input shape that the Primitive server must provide.
 * TypeScript will enforce this at build time, ensuring the server
 * cannot construct a payload that doesn't match the SDK's expectations.
 */
export interface EmailReceivedEventInput {
  /** Unique email ID in Primitive */
  email_id: string;

  /** ID of the webhook endpoint receiving this event */
  endpoint_id: string;

  /** Message-ID header (may be null) */
  message_id: string | null;

  /** From header value */
  sender: string;

  /** To header value */
  recipient: string;

  /** Subject header (may be null) */
  subject: string | null;

  /** ISO 8601 timestamp when Primitive received the email */
  received_at: string;

  /** HELO/EHLO hostname from the sending server */
  smtp_helo: string | null;

  /** SMTP envelope sender (MAIL FROM) */
  smtp_mail_from: string;

  /** SMTP envelope recipients (RCPT TO) */
  smtp_rcpt_to: string[];

  /** Raw email bytes (will be base64 encoded if small enough) */
  raw_bytes: Buffer;

  /** SHA-256 hash of raw email (hex) */
  raw_sha256: string;

  /** Size of raw email in bytes */
  raw_size_bytes: number;

  /** Delivery attempt number (starts at 1) */
  attempt_count: number;

  /** Date header value parsed from raw email (may be null) */
  date_header: string | null;

  /** Download URL for raw email */
  download_url: string;

  /** ISO 8601 timestamp when download URL expires */
  download_expires_at: string;

  /** URL to download attachments tarball (null if no attachments) */
  attachments_download_url: string | null;

  /** Parsed email content (optional, defaults to failed state) */
  parsed?: ParsedInput;

  /** Email authentication results (SPF, DKIM, DMARC) */
  auth: EmailAuth;

  /** Email analysis results */
  analysis: EmailAnalysis;
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Generate a stable event ID for webhook deduplication.
 *
 * Format: `evt_{sha256_hex}` where the hash is deterministic based on:
 * - event_type ("email.received")
 * - version (WEBHOOK_VERSION)
 * - endpoint_id
 * - email_id
 *
 * This ensures the same email delivered to the same endpoint always has
 * the same event ID, enabling idempotent processing.
 *
 * The full 64-character SHA-256 hash is used for maximum collision resistance.
 */
export function generateEventId(endpoint_id: string, email_id: string): string {
  const hashInput = `email.received:${WEBHOOK_VERSION}:${endpoint_id}:${email_id}`;
  const hash = createHash("sha256").update(hashInput).digest("hex");
  return `evt_${hash}`;
}

/**
 * ISO 8601 timestamp pattern.
 * Matches: YYYY-MM-DDTHH:mm:ss.sssZ or YYYY-MM-DDTHH:mm:ssZ
 * Does NOT match loose formats like "Tuesday" that Date.parse accepts.
 */
const ISO_8601_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

/**
 * Validate that a timestamp is a valid ISO 8601 string in UTC format.
 * Does NOT transform the input - preserves original format and precision.
 *
 * @param timestamp - The timestamp string to validate
 * @returns The validated timestamp (unchanged)
 * @throws Error if timestamp is not valid ISO 8601 UTC format
 */
function validateTimestamp(timestamp: string, fieldName: string): string {
  if (!ISO_8601_PATTERN.test(timestamp)) {
    throw new Error(
      `[@primitivedotdev/sdk-node/contract] Invalid ${fieldName}: "${timestamp}". Expected ISO 8601 UTC format (e.g., "2025-01-15T10:30:00.000Z")`,
    );
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    throw new Error(
      `[@primitivedotdev/sdk-node/contract] Invalid ${fieldName}: "${timestamp}" is not a valid date`,
    );
  }

  return timestamp;
}

// -----------------------------------------------------------------------------
// Builder Function
// -----------------------------------------------------------------------------

/**
 * Build an EmailReceivedEvent from server input.
 *
 * This is the exact function used by Primitive servers to construct webhook payloads.
 * By importing this from the SDK, the server gets build-time guarantees that
 * the payload will match what consumers expect.
 *
 * @param input - The server-side input data
 * @param options - Optional overrides for testing
 * @returns A fully constructed EmailReceivedEvent
 *
 * @example
 * ```typescript
 * import { buildEmailReceivedEvent } from '@primitivedotdev/sdk-node/contract';
 *
 * const event = buildEmailReceivedEvent({
 *   email_id: 'email-123',
 *   endpoint_id: 'endpoint-456',
 *   message_id: '<msg@example.com>',
 *   sender: 'from@example.com',
 *   recipient: 'to@example.com',
 *   subject: 'Hello',
 *   received_at: '2025-01-01T00:00:00Z',
 *   smtp_helo: 'mail.example.com',
 *   smtp_mail_from: 'from@example.com',
 *   smtp_rcpt_to: ['to@example.com'],
 *   raw_bytes: Buffer.from('...'),
 *   raw_sha256: 'abc123...',
 *   raw_size_bytes: 1234,
 *   attempt_count: 1,
 *   date_header: 'Mon, 1 Jan 2025 00:00:00 +0000',
 *   download_url: 'https://...',
 *   download_expires_at: '2025-01-02T00:00:00Z',
 *   attachments_download_url: null,
 * });
 * ```
 */
export function buildEmailReceivedEvent(
  input: EmailReceivedEventInput,
  options?: {
    /** Override event ID (for testing or custom ID generation) */
    event_id?: string;
    /** Override attempted_at timestamp (for testing) */
    attempted_at?: string;
  },
): EmailReceivedEvent {
  const event_id =
    options?.event_id ?? generateEventId(input.endpoint_id, input.email_id);
  const attempted_at = options?.attempted_at
    ? validateTimestamp(options.attempted_at, "attempted_at")
    : new Date().toISOString();

  // Determine if raw email should be inlined
  const shouldInline = input.raw_size_bytes <= RAW_EMAIL_INLINE_THRESHOLD;

  const rawContent: RawContentInline | RawContentDownloadOnly = shouldInline
    ? {
        included: true,
        encoding: "base64",
        max_inline_bytes: RAW_EMAIL_INLINE_THRESHOLD,
        size_bytes: input.raw_size_bytes,
        sha256: input.raw_sha256,
        data: input.raw_bytes.toString("base64"),
      }
    : {
        included: false,
        reason_code: "size_exceeded",
        max_inline_bytes: RAW_EMAIL_INLINE_THRESHOLD,
        size_bytes: input.raw_size_bytes,
        sha256: input.raw_sha256,
      };

  // Build parsed data for payload
  // If raw email exceeds inline threshold, null out body content too
  // (keeps webhook payload bounded - use download URL for large emails)
  let parsedData: ParsedDataComplete | ParsedDataFailed;

  if (input.parsed?.status === "complete") {
    parsedData = {
      status: "complete",
      error: null,
      body_text: shouldInline ? input.parsed.body_text : null,
      body_html: shouldInline ? input.parsed.body_html : null,
      reply_to: input.parsed.reply_to ?? null,
      cc: input.parsed.cc ?? null,
      bcc: input.parsed.bcc ?? null,
      in_reply_to: input.parsed.in_reply_to ?? null,
      references: input.parsed.references ?? null,
      attachments: input.parsed.attachments,
      attachments_download_url: input.attachments_download_url,
    };
  } else if (input.parsed?.status === "failed") {
    parsedData = {
      status: "failed",
      error: input.parsed.error,
      body_text: null,
      body_html: null,
      reply_to: null,
      cc: null,
      bcc: null,
      in_reply_to: null,
      references: null,
      attachments: [],
      attachments_download_url: null,
    };
  } else {
    // No parsed data provided - treat as failed
    parsedData = {
      status: "failed",
      error: {
        code: "PARSE_FAILED",
        message: "Parsing not attempted",
        retryable: false,
      },
      body_text: null,
      body_html: null,
      reply_to: null,
      cc: null,
      bcc: null,
      in_reply_to: null,
      references: null,
      attachments: [],
      attachments_download_url: null,
    };
  }

  return {
    id: event_id,
    event: "email.received",
    version: WEBHOOK_VERSION,
    delivery: {
      endpoint_id: input.endpoint_id,
      attempt: input.attempt_count,
      attempted_at: attempted_at,
    },
    email: {
      id: input.email_id,
      received_at: validateTimestamp(input.received_at, "received_at"),
      smtp: {
        helo: input.smtp_helo,
        mail_from: input.smtp_mail_from,
        rcpt_to: input.smtp_rcpt_to,
      },
      headers: {
        message_id: input.message_id,
        subject: input.subject,
        from: input.sender,
        to: input.recipient,
        date: input.date_header,
      },
      content: {
        raw: rawContent,
        download: {
          url: input.download_url,
          expires_at: validateTimestamp(
            input.download_expires_at,
            "download_expires_at",
          ),
        },
      },
      parsed: parsedData,
      analysis: input.analysis,
      auth: input.auth,
    },
  };
}
