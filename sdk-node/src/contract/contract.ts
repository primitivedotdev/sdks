/**
 * Primitive Contract
 *
 * This module exposes the exact functions used by Primitive servers to construct
 * webhook payloads. It serves two purposes:
 *
 * 1. **Build-time type safety**: Primitive producer code can import these types
 *    and functions so schema changes surface as TypeScript errors instead of
 *    runtime contract drift.
 *
 * 2. **Debugging transparency**: If you receive a malformed payload, you can
 *    compare it against these exact types and builder functions to identify
 *    which side broke the contract.
 *
 * This package is also useful for building test fixtures that match real
 * payloads exactly.
 *
 * @module @primitivedotdev/sdk-node/contract
 */

import { createHash } from "node:crypto";
import { sanitizeHtml } from "../parser/attachment-parser.js";
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
} from "../types.js";
import {
  type SignResult,
  signWebhookPayload,
  validateEmailReceivedEvent,
  WEBHOOK_VERSION,
} from "../webhook/index.js";

export type {
  EmailAddress,
  EmailAnalysis,
  EmailAuth,
  EmailReceivedEvent,
  ParsedDataComplete,
  ParsedDataFailed,
  ParsedError,
  RawContentDownloadOnly,
  RawContentInline,
  SignResult,
  WebhookAttachment,
};

export { signWebhookPayload, WEBHOOK_VERSION };

/** Maximum raw email size for inline inclusion (256 KB). */
export const RAW_EMAIL_INLINE_THRESHOLD = 262144;

/** Parsed content input when parsing succeeded. */
export interface ParsedInputComplete {
  status: "complete";
  body_text: string | null;
  body_html: string | null;
  /** Parsed Reply-To header addresses. Defaults to `null` when omitted. */
  reply_to?: EmailAddress[] | null;
  /** Parsed CC header addresses. Defaults to `null` when omitted. */
  cc?: EmailAddress[] | null;
  /** Parsed BCC header addresses. Defaults to `null` when omitted. */
  bcc?: EmailAddress[] | null;
  /** In-Reply-To header values. Defaults to `null` when omitted. */
  in_reply_to?: string[] | null;
  /** References header values. Defaults to `null` when omitted. */
  references?: string[] | null;
  attachments: WebhookAttachment[];
  /** Storage key for the attachments tarball, if attachments were persisted. Ignored by the canonical payload builder. */
  attachments_storage_key?: string | null;
}

/** Parsed content input when parsing failed. */
export interface ParsedInputFailed {
  status: "failed";
  error: ParsedError;
}

/** Parsed content input (discriminated union on `status`). */
export type ParsedInput = ParsedInputComplete | ParsedInputFailed;

/**
 * Input for building an `EmailReceivedEvent`.
 *
 * This is the strict producer-side shape required to construct a canonical
 * Primitive `email.received` webhook payload.
 */
export interface EmailReceivedEventInput {
  /** Unique email ID in Primitive. */
  email_id: string;
  /** ID of the webhook endpoint receiving this event. */
  endpoint_id: string;
  /** Message-ID header value, if present. */
  message_id: string | null;
  /** From header value. */
  sender: string;
  /** To header value. */
  recipient: string;
  /** Subject header value, if present. */
  subject: string | null;
  /** ISO 8601 timestamp when Primitive received the email. */
  received_at: string;
  /** HELO/EHLO hostname from the sending server. */
  smtp_helo: string | null;
  /** SMTP envelope sender (MAIL FROM). */
  smtp_mail_from: string;
  /** SMTP envelope recipients (RCPT TO). Must contain at least one recipient. */
  smtp_rcpt_to: [string, ...string[]];
  /** Raw email bytes. These are base64 encoded when inlined into the payload. */
  raw_bytes: Buffer;
  /** SHA-256 hash of the raw email as a 64-character hex string. */
  raw_sha256: string;
  /** Size of the raw email in bytes. */
  raw_size_bytes: number;
  /** Delivery attempt number, starting at 1. */
  attempt_count: number;
  /** Date header parsed from the raw email, if present. */
  date_header: string | null;
  /** HTTPS download URL for the raw email. */
  download_url: string;
  /** ISO 8601 timestamp when the raw-email download URL expires. */
  download_expires_at: string;
  /** HTTPS download URL for the attachments tarball, if one exists. */
  attachments_download_url: string | null;
  /** Parsed email content. Defaults to a failed parse state when omitted. */
  parsed?: ParsedInput;
  /** Email authentication results (SPF, DKIM, DMARC). */
  auth: EmailAuth;
  /** Email analysis results. */
  analysis: EmailAnalysis;
}

/**
 * ISO 8601 timestamp pattern.
 *
 * Matches RFC 3339 date-time strings with either `Z` or an explicit UTC offset,
 * but rejects loose formats like `Tuesday` that `Date.parse()` would otherwise accept.
 */
const ISO_8601_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * Validate that a timestamp is a valid RFC 3339 date-time string.
 *
 * The original string is preserved so callers retain their chosen precision.
 *
 * @param timestamp - Timestamp string to validate.
 * @param fieldName - Logical field name used in error messages.
 * @returns The validated timestamp, unchanged.
 * @throws Error if the timestamp is not a valid RFC 3339 date-time string.
 */
function validateTimestamp(timestamp: string, fieldName: string): string {
  if (!ISO_8601_PATTERN.test(timestamp)) {
    throw new Error(
      `[@primitivedotdev/sdk-node/contract] Invalid ${fieldName}: "${timestamp}". Expected RFC 3339 date-time format (e.g., "2025-01-15T10:30:00.000Z" or "2025-01-15T10:30:00+00:00")`,
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

/**
 * Generate a stable event ID for webhook deduplication.
 *
 * Format: `evt_{sha256_hex}` where the hash is deterministic based on the
 * event type, endpoint ID, and email ID. The same email sent
 * to the same endpoint will always get the same event ID.
 *
 * @param endpoint_id - Webhook endpoint ID.
 * @param email_id - Primitive email ID.
 * @returns Stable event ID with `evt_` prefix.
 */
export function generateEventId(endpoint_id: string, email_id: string): string {
  const hashInput = `email.received:${endpoint_id}:${email_id}`;
  const hash = createHash("sha256").update(hashInput).digest("hex");
  return `evt_${hash}`;
}

/**
 * Build an `EmailReceivedEvent` from producer-side input.
 *
 * This is the contract package's primary builder. It assembles the canonical
 * payload shape, applies inline/download raw-content rules, and validates the
 * result against the generated JSON Schema before returning.
 *
 * @param input - Producer-side data for the webhook payload.
 * @param options - Optional overrides for event ID and attempted-at timestamp.
 * @returns A fully constructed, schema-valid `EmailReceivedEvent`.
 *
 * @example
 * ```typescript
 * import { buildEmailReceivedEvent } from "@primitivedotdev/sdk-node/contract";
 *
 * const event = buildEmailReceivedEvent({
 *   email_id: "email-123",
 *   endpoint_id: "endpoint-456",
 *   message_id: "<msg@example.com>",
 *   sender: "from@example.com",
 *   recipient: "to@example.com",
 *   subject: "Hello",
 *   received_at: "2025-01-01T00:00:00Z",
 *   smtp_helo: "mail.example.com",
 *   smtp_mail_from: "from@example.com",
 *   smtp_rcpt_to: ["to@example.com"],
 *   raw_bytes: Buffer.from("..."),
 *   raw_sha256: "a".repeat(64),
 *   raw_size_bytes: 1234,
 *   attempt_count: 1,
 *   date_header: "Mon, 1 Jan 2025 00:00:00 +0000",
 *   download_url: "https://example.com/download/email-123",
 *   download_expires_at: "2025-01-02T00:00:00Z",
 *   attachments_download_url: null,
 *   auth: { spf: "pass", dmarc: "pass", dkimSignatures: [] },
 *   analysis: {},
 * });
 * ```
 */
export function buildEmailReceivedEvent(
  input: EmailReceivedEventInput,
  options?: {
    /** Override the generated event ID, typically for tests. */
    event_id?: string;
    /** Override the attempted-at timestamp, typically for tests. */
    attempted_at?: string;
  },
): EmailReceivedEvent {
  const event_id =
    options?.event_id ?? generateEventId(input.endpoint_id, input.email_id);
  const attempted_at = options?.attempted_at
    ? validateTimestamp(options.attempted_at, "attempted_at")
    : new Date().toISOString();

  const raw_size_bytes = input.raw_bytes.length;
  if (input.raw_size_bytes !== raw_size_bytes) {
    throw new Error(
      `[@primitivedotdev/sdk-node/contract] Invalid raw_size_bytes: ${input.raw_size_bytes}. Expected ${raw_size_bytes} based on raw_bytes length`,
    );
  }

  const raw_sha256 = createHash("sha256").update(input.raw_bytes).digest("hex");
  if (input.raw_sha256 !== raw_sha256) {
    throw new Error(
      `[@primitivedotdev/sdk-node/contract] Invalid raw_sha256: "${input.raw_sha256}". Expected ${raw_sha256} based on raw_bytes`,
    );
  }

  const shouldInline = raw_size_bytes <= RAW_EMAIL_INLINE_THRESHOLD;

  const rawContent: RawContentInline | RawContentDownloadOnly = shouldInline
    ? {
        included: true,
        encoding: "base64",
        max_inline_bytes: RAW_EMAIL_INLINE_THRESHOLD,
        size_bytes: raw_size_bytes,
        sha256: raw_sha256,
        data: input.raw_bytes.toString("base64"),
      }
    : {
        included: false,
        reason_code: "size_exceeded",
        max_inline_bytes: RAW_EMAIL_INLINE_THRESHOLD,
        size_bytes: raw_size_bytes,
        sha256: raw_sha256,
      };

  let parsedData: ParsedDataComplete | ParsedDataFailed;

  if (input.parsed?.status === "complete") {
    parsedData = {
      status: "complete",
      error: null,
      body_text: input.parsed.body_text,
      body_html:
        input.parsed.body_html === null
          ? null
          : sanitizeHtml(input.parsed.body_html),
      reply_to: input.parsed.reply_to ?? null,
      cc: input.parsed.cc ?? null,
      bcc: input.parsed.bcc ?? null,
      in_reply_to: input.parsed.in_reply_to ?? null,
      references: input.parsed.references ?? null,
      attachments: input.parsed.attachments,
      attachments_download_url:
        input.parsed.attachments.length === 0
          ? null
          : input.attachments_download_url,
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

  const event = {
    id: event_id,
    event: "email.received",
    version: WEBHOOK_VERSION,
    delivery: {
      endpoint_id: input.endpoint_id,
      attempt: input.attempt_count,
      attempted_at,
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
  } satisfies EmailReceivedEvent;

  return validateEmailReceivedEvent(event);
}
