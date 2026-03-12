// attachment-parser: main email+attachment parser and utilities
export {
  parseEmailWithAttachments,
  normalizeContentType,
  sha256Hex,
  sanitizeFilename,
  sanitizeHtml,
} from "./attachment-parser.js";

export type {
  ParsedAttachment,
  ParsedEmailWithAttachments,
} from "./attachment-parser.js";

// attachment-bundler: tar.gz bundling for downloadable attachments
export {
  bundleAttachments,
  extractAttachmentMetadata,
  getAttachmentsStorageKey,
} from "./attachment-bundler.js";

export type {
  BundleResult,
  AttachmentMetadata,
} from "./attachment-bundler.js";

// email-parser: lightweight .eml parser
export { parseEmail } from "./email-parser.js";

export type { ParsedEmail } from "./email-parser.js";

// mapping: parser output → canonical snake_case types
export {
  toParsedDataComplete,
  toWebhookAttachments,
  attachmentMetadataToWebhookAttachments,
  toCanonicalHeaders,
} from "./mapping.js";
