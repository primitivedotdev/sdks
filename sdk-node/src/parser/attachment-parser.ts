import { createHash } from "node:crypto";
import type { ParsedMail } from "mailparser";
import type { EmailAddress } from "../types.js";

async function loadMailparser() {
  return import("mailparser");
}

// Signature/artifact MIME types to filter out - these are not "real" attachments
const SIGNATURE_ARTIFACTS = new Set([
  "application/pkcs7-signature",
  "application/x-pkcs7-signature",
  "application/pgp-signature",
  "application/pgp-keys",
  "application/pgp-encrypted",
  "application/ms-tnef", // winmail.dat
]);

// Safe MIME types that can be served inline (in img tags)
const SAFE_INLINE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
]);

export interface ParsedAttachment {
  // Identity
  id: string;
  partIndex: number;

  // From mailparser
  filename: string | null;
  contentType: string | null; // Raw content-type header value
  contentTypeNorm: string; // Normalized (lowercase, no params)
  contentDispositionRaw: string | null; // Raw header
  disposition: "attachment" | "inline" | null;
  contentTransferEncoding: string | null;
  contentIdRaw: string | null; // With angle brackets
  contentIdNorm: string | null; // Without angle brackets, lowercased

  // Computed
  downloadName: string; // Sanitized filename for Content-Disposition
  tarPath: string; // Path inside tar.gz: {partIndex}_{sanitized_filename}
  sizeBytes: number;
  sha256: string;
  isInline: boolean; // Referenced by CID in HTML
  isDownloadable: boolean; // Should appear in attachment list
  isSafeForInlineServing: boolean; // Can be served with Content-Disposition: inline

  // The actual bytes (for upload to storage)
  content: Buffer;
}

export interface ParsedEmailWithAttachments {
  // Body
  bodyText: string | null;
  bodyHtml: string | null; // Raw HTML from mailparser (inline images as data: URLs)

  // Attachments
  attachments: ParsedAttachment[];

  // Metadata
  subject: string | null;
  messageId: string | null;
  date: Date | null;
  dateHeader: string | null;
  from: string | null;
  to: string | null;

  // Additional headers for threading and replies
  replyTo: EmailAddress[] | null;
  cc: EmailAddress[] | null;
  bcc: EmailAddress[] | null;
  inReplyTo: string[] | null;
  references: string[] | null;
}

/**
 * Parse a raw email buffer and extract body + attachments.
 * Uses mailparser for the heavy lifting.
 *
 * - Mailparser's default converts CID refs to data: URLs in body_html
 * - Inline images (related=true) are embedded in body_html, NOT in attachments list
 * - Only "real" attachments are returned for tar.gz bundling
 */
export async function parseEmailWithAttachments(
  emlBuffer: Buffer,
  options?: {
    generateAttachmentId?: () => string; // Optional custom ID generator
  },
): Promise<ParsedEmailWithAttachments> {
  const generateId =
    options?.generateAttachmentId ?? (() => crypto.randomUUID());
  const { simpleParser } = await loadMailparser();

  // Parse with default options - mailparser converts CID refs to data: URLs
  const parsed: ParsedMail = await simpleParser(emlBuffer);

  // Process attachments
  const attachments: ParsedAttachment[] = [];

  for (let i = 0; i < (parsed.attachments?.length ?? 0); i++) {
    const att = parsed.attachments[i];
    const contentTypeNorm = normalizeContentType(att.contentType);

    // Skip signature artifacts
    if (SIGNATURE_ARTIFACTS.has(contentTypeNorm)) {
      continue;
    }

    const id = generateId();
    const contentIdNorm = att.cid?.toLowerCase() ?? null;

    const isInline = att.related === true;
    const isDownloadable =
      !isInline &&
      (att.contentDisposition === "attachment" ||
        !!att.filename ||
        contentTypeNorm === "message/rfc822" ||
        contentTypeNorm === "text/calendar");

    const downloadName = sanitizeFilename(att.filename ?? null, i);
    const tarPath = `${i}_${downloadName}`;

    attachments.push({
      id,
      partIndex: i,
      filename: att.filename ?? null,
      contentType: getHeaderString(att.headers.get("content-type")),
      contentTypeNorm,
      contentDispositionRaw: getHeaderString(
        att.headers.get("content-disposition"),
      ),
      disposition: parseDisposition(att.contentDisposition),
      contentTransferEncoding: getHeaderString(
        att.headers.get("content-transfer-encoding"),
      ),
      contentIdRaw: att.contentId ?? null,
      contentIdNorm,
      downloadName,
      tarPath,
      sizeBytes: att.content.length,
      sha256: sha256Hex(att.content),
      isInline,
      isDownloadable,
      isSafeForInlineServing:
        isInline && SAFE_INLINE_TYPES.has(contentTypeNorm),
      content: att.content,
    });
  }

  // Get body HTML (mailparser already converted CID refs to data: URLs)
  let bodyHtml: string | null = null;

  if (parsed.html && typeof parsed.html === "string") {
    bodyHtml = parsed.html;
  }

  return {
    bodyText: parsed.text ?? null,
    bodyHtml,
    attachments,
    subject: parsed.subject ?? null,
    messageId: parsed.messageId ?? null,
    date: parsed.date ?? null,
    dateHeader: getOriginalHeaderValue(parsed, "date"),
    from: parsed.from?.text ?? null,
    to: Array.isArray(parsed.to)
      ? parsed.to.map((a) => a.text).join(", ")
      : (parsed.to?.text ?? null),

    // Additional headers
    replyTo: extractAddresses(parsed.replyTo),
    cc: extractAddresses(parsed.cc),
    bcc: extractAddresses(parsed.bcc),
    inReplyTo: normalizeReferences(parsed.inReplyTo),
    references: normalizeReferences(parsed.references),
  };
}

/**
 * Extract email addresses from mailparser's AddressObject format.
 * Handles both single AddressObject and arrays.
 */
function extractAddresses(
  addressObj: ParsedMail["replyTo"] | ParsedMail["cc"] | ParsedMail["bcc"],
): EmailAddress[] | null {
  if (!addressObj) return null;

  // Handle array of AddressObjects
  const objects = Array.isArray(addressObj) ? addressObj : [addressObj];
  const addresses: EmailAddress[] = [];

  for (const obj of objects) {
    // Each AddressObject has a 'value' array of addresses
    if (obj && "value" in obj && obj.value) {
      for (const addr of obj.value) {
        if (addr.address) {
          addresses.push({
            address: addr.address,
            name: addr.name || null,
          });
        }
      }
    }
  }

  return addresses.length > 0 ? addresses : null;
}

/**
 * Normalize References header to array of message IDs.
 * Can be a string (single ID or space-separated IDs) or array.
 */
function normalizeReferences(
  refs: string | string[] | undefined,
): string[] | null {
  if (!refs) return null;

  if (Array.isArray(refs)) {
    return refs.length > 0 ? refs : null;
  }

  // String - could be space-separated or single
  const parts = refs.split(/\s+/).filter(Boolean);
  return parts.length > 0 ? parts : null;
}

/**
 * Normalize a Content-Type to lowercase media type without parameters.
 */
export function normalizeContentType(
  contentType: string | undefined | null,
): string {
  if (!contentType?.trim()) {
    return "application/octet-stream";
  }
  const mediaType = contentType.split(";")[0].trim().toLowerCase();
  return mediaType || "application/octet-stream";
}

/**
 * Parse disposition string to typed value.
 */
function parseDisposition(
  disposition: string | undefined,
): "attachment" | "inline" | null {
  if (!disposition) return null;
  const lower = disposition.toLowerCase();
  if (lower === "attachment") return "attachment";
  if (lower === "inline") return "inline";
  return null;
}

/**
 * Get string representation of a header value.
 */
function getHeaderString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "value" in value) {
    const v = value as { value: string; params?: Record<string, string> };
    if (v.params && Object.keys(v.params).length > 0) {
      const params = Object.entries(v.params)
        .map(([k, val]) => `${k}="${val}"`)
        .join("; ");
      return `${v.value}; ${params}`;
    }
    return v.value;
  }
  return String(value);
}

function getOriginalHeaderValue(parsed: ParsedMail, key: string): string | null {
  const headerLines = (
    parsed as ParsedMail & {
      headerLines?: Array<{ key?: string; line?: string }>;
    }
  ).headerLines;

  const original = headerLines?.find(
    (header) => header.key?.toLowerCase() === key.toLowerCase(),
  )?.line;

  if (!original) {
    return null;
  }

  const separator = original.indexOf(":");
  return separator === -1 ? original : original.slice(separator + 1).trimStart();
}

/**
 * Compute SHA-256 hash of a buffer as hex string.
 */
export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Sanitize a filename for safe use in Content-Disposition headers.
 * Prevents path traversal, removes control characters, enforces length limits.
 */
export function sanitizeFilename(
  filename: string | null,
  partIndex: number,
): string {
  if (!filename) {
    return `attachment_${partIndex}`;
  }

  // Check for dangerous filenames BEFORE sanitization
  const trimmed = filename.trim();
  if (!trimmed || trimmed === "." || trimmed === "..") {
    return `attachment_${partIndex}`;
  }

  let safe = filename
    // Remove path separators (prevent path traversal)
    .replace(/[/\\]/g, "_")
    // Remove colons (archiver library treats them as drive letters and strips content before)
    .replace(/:/g, "-")
    // Remove .. sequences (path traversal)
    .replace(/\.\./g, "_")
    // Remove null bytes and control characters
    // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional — stripping control chars from filenames
    .replace(/[\x00-\x1f\x7f]/g, "")
    // Replace non-ASCII characters with underscore (archiver uses PaxHeader for these,
    // which our simple tar parser doesn't handle - original filename is preserved in metadata)
    .replace(/[^\x20-\x7E]/g, "_")
    // Normalize whitespace
    .replace(/\s+/g, " ")
    .trim();

  // Enforce max length (200 chars), preserving extension if possible
  if (safe.length > 200) {
    const lastDot = safe.lastIndexOf(".");
    if (lastDot > 0 && safe.length - lastDot <= 10) {
      // Preserve extension
      const ext = safe.substring(lastDot);
      safe = safe.substring(0, 200 - ext.length) + ext;
    } else {
      safe = safe.substring(0, 200);
    }
  }

  // Fallback if still empty after sanitization
  if (!safe) {
    return `attachment_${partIndex}`;
  }

  return safe;
}
