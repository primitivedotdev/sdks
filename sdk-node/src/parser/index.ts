// attachment-parser: main email+attachment parser and utilities

export type {
  AttachmentMetadata,
  BundleResult,
} from "./attachment-bundler.js";
// attachment-bundler: tar.gz bundling for downloadable attachments
export {
  bundleAttachments,
  extractAttachmentMetadata,
  getAttachmentsStorageKey,
} from "./attachment-bundler.js";
export type {
  ParsedAttachment,
  ParsedEmailWithAttachments,
} from "./attachment-parser.js";
export {
  normalizeContentType,
  parseEmailWithAttachments,
  sanitizeFilename,
  sha256Hex,
} from "./attachment-parser.js";
export type { ParsedEmail } from "./email-parser.js";
// email-parser: lightweight .eml parser
export { parseEmail } from "./email-parser.js";

// mapping: parser output → canonical snake_case types
export {
  attachmentMetadataToWebhookAttachments,
  toCanonicalHeaders,
  toParsedDataComplete,
  toWebhookAttachments,
} from "./mapping.js";

// sanitize-html: DOMPurify-based email HTML sanitizer
export { sanitizeHtml } from "./sanitize-html.js";
