/**
 * Mapping layer: parser camelCase output → canonical snake_case types
 *
 * This module bridges the gap between the parser's internal representation
 * (camelCase, Buffers, internal fields) and the canonical webhook SDK types
 * (snake_case, JSON-safe, public fields only).
 *
 * @packageDocumentation
 */

import type { ParsedDataComplete, WebhookAttachment } from "../types.js";
import type { AttachmentMetadata } from "./attachment-bundler.js";
import type {
  ParsedAttachment,
  ParsedEmailWithAttachments,
} from "./attachment-parser.js";

/**
 * Convert parser output to canonical ParsedDataComplete (snake_case).
 *
 * Maps `bodyHtmlSanitized` → `body_html` (matching production behavior).
 * Converts Date objects to ISO strings.
 * Coerces nullable `from`/`to` to non-nullable strings.
 *
 * @param parsed - Output from parseEmailWithAttachments()
 * @param attachmentsDownloadUrl - URL or local path for attachment download (null if no attachments)
 * @returns Canonical ParsedDataComplete ready for JSON serialization
 */
export function toParsedDataComplete(
  parsed: ParsedEmailWithAttachments,
  attachmentsDownloadUrl: string | null,
): ParsedDataComplete {
  return {
    status: "complete",
    error: null,
    body_text: parsed.bodyText,
    body_html: parsed.bodyHtmlSanitized,
    reply_to: parsed.replyTo,
    cc: parsed.cc,
    bcc: parsed.bcc,
    in_reply_to: parsed.inReplyTo,
    references: parsed.references,
    attachments: toWebhookAttachments(parsed.attachments),
    attachments_download_url: attachmentsDownloadUrl,
  };
}

/**
 * Convert parser attachments to canonical WebhookAttachment[] (JSON-safe subset).
 *
 * Filters to only downloadable attachments and strips internal fields
 * (content Buffer, contentId, disposition, etc.).
 *
 * @param attachments - ParsedAttachment[] from the parser
 * @returns WebhookAttachment[] with only public metadata
 */
export function toWebhookAttachments(
  attachments: ParsedAttachment[],
): WebhookAttachment[] {
  return attachments
    .filter((att) => att.isDownloadable)
    .map((att) => ({
      filename: att.filename,
      content_type: att.contentTypeNorm,
      size_bytes: att.sizeBytes,
      sha256: att.sha256,
      part_index: att.partIndex,
      tar_path: att.tarPath,
    }));
}

/**
 * Convert AttachmentMetadata[] (from extractAttachmentMetadata) to WebhookAttachment[].
 *
 * AttachmentMetadata is already in snake_case and JSON-safe, so this is
 * essentially a type assertion. Useful when you have metadata from the bundler
 * rather than raw ParsedAttachment[].
 */
export function attachmentMetadataToWebhookAttachments(
  metadata: AttachmentMetadata[],
): WebhookAttachment[] {
  return metadata.map((m) => ({
    filename: m.filename,
    content_type: m.content_type,
    size_bytes: m.size_bytes,
    sha256: m.sha256,
    part_index: m.part_index,
    tar_path: m.tar_path,
  }));
}

/**
 * Extract canonical email headers from parser output.
 *
 * Converts camelCase parser fields to the shape expected by
 * EmailReceivedEvent.email.headers.
 *
 * @param parsed - Output from parseEmailWithAttachments()
 * @returns Headers object matching the canonical schema
 */
export function toCanonicalHeaders(parsed: ParsedEmailWithAttachments): {
  message_id: string | null;
  subject: string | null;
  from: string;
  to: string;
  date: string | null;
} {
  return {
    message_id: parsed.messageId,
    subject: parsed.subject,
    from: parsed.from ?? "",
    to: parsed.to ?? "",
    date: parsed.date?.toISOString() ?? null,
  };
}
