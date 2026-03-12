/**
 * Zod schemas for Primitive webhook payloads
 *
 * This module provides runtime validation for webhook payloads using Zod.
 * Import from `@primitivedotdev/sdk-node/zod` to use these schemas.
 *
 * @example
 * ```typescript
 * import { validateEmailReceivedEvent, emailReceivedEventSchema } from '@primitivedotdev/sdk-node/zod';
 *
 * // Validate with helpful errors
 * const event = validateEmailReceivedEvent(JSON.parse(rawBody));
 *
 * // Or use the schema directly
 * const result = emailReceivedEventSchema.safeParse(data);
 * if (result.success) {
 *   // result.data is typed as EmailReceivedEvent
 * }
 * ```
 *
 * @packageDocumentation
 */

import { type ZodError, type ZodIssue, z } from "zod";
import type { EmailReceivedEvent } from "./types.js";
import {
  WebhookValidationError,
  type WebhookValidationErrorCode,
} from "./webhook/errors.js";
import { WEBHOOK_VERSION, type WebhookVersion } from "./webhook/version.js";

/** Pattern for valid webhook version (YYYY-MM-DD date format) */
const VERSION_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Re-export the validation error for convenience
export { WebhookValidationError, type WebhookValidationErrorCode };

// -----------------------------------------------------------------------------
// Common Schema Helpers
// -----------------------------------------------------------------------------

/**
 * Schema for HTTPS URLs only.
 * Rejects http://, javascript:, data:, file://, etc.
 */
const httpsUrlSchema = z
  .string()
  .url()
  .refine((url) => url.startsWith("https://"), {
    message: "URL must use HTTPS protocol",
  });

/**
 * Schema for SHA-256 hash (64 lowercase hex characters).
 */
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i, {
  message: "Must be a valid SHA-256 hash (64 hex characters)",
});

// -----------------------------------------------------------------------------
// Email Address Schema
// -----------------------------------------------------------------------------

export const emailAddressSchema = z.object({
  address: z.string(),
  name: z.string().nullable(),
});

// -----------------------------------------------------------------------------
// Attachment Schema
// -----------------------------------------------------------------------------

export const webhookAttachmentSchema = z.object({
  filename: z.string().nullable(),
  content_type: z.string(),
  size_bytes: z.number().int().nonnegative(),
  sha256: sha256Schema,
  part_index: z.number().int().nonnegative(),
  tar_path: z.string(),
});

// -----------------------------------------------------------------------------
// Parsed Content Schemas
// -----------------------------------------------------------------------------

export const parsedErrorSchema = z.object({
  code: z.enum(["PARSE_FAILED", "ATTACHMENT_EXTRACTION_FAILED"]),
  message: z.string(),
  retryable: z.boolean(),
});

export const parsedDataCompleteSchema = z.object({
  status: z.literal("complete"),
  error: z.null(),
  body_text: z.string().nullable(),
  body_html: z.string().nullable(),
  reply_to: z.array(emailAddressSchema).nullable(),
  cc: z.array(emailAddressSchema).nullable(),
  bcc: z.array(emailAddressSchema).nullable(),
  in_reply_to: z.array(z.string()).nullable(),
  references: z.array(z.string()).nullable(),
  attachments: z.array(webhookAttachmentSchema),
  attachments_download_url: httpsUrlSchema.nullable(),
});

export const parsedDataFailedSchema = z.object({
  status: z.literal("failed"),
  error: parsedErrorSchema,
  body_text: z.null(),
  body_html: z.null(),
  reply_to: z.null(),
  cc: z.null(),
  bcc: z.null(),
  in_reply_to: z.null(),
  references: z.null(),
  attachments: z.array(webhookAttachmentSchema),
  attachments_download_url: z.null(),
});

export const parsedDataSchema = z.discriminatedUnion("status", [
  parsedDataCompleteSchema,
  parsedDataFailedSchema,
]);

// -----------------------------------------------------------------------------
// Raw Content Schemas
// -----------------------------------------------------------------------------

export const rawContentInlineSchema = z.object({
  included: z.literal(true),
  encoding: z.literal("base64"),
  max_inline_bytes: z.number().int().positive(),
  size_bytes: z.number().int().nonnegative(),
  sha256: sha256Schema,
  data: z.string(),
});

export const rawContentDownloadOnlySchema = z.object({
  included: z.literal(false),
  reason_code: z.literal("size_exceeded"),
  max_inline_bytes: z.number().int().positive(),
  size_bytes: z.number().int().nonnegative(),
  sha256: sha256Schema,
});

export const rawContentSchema = z.discriminatedUnion("included", [
  rawContentInlineSchema,
  rawContentDownloadOnlySchema,
]);

// -----------------------------------------------------------------------------
// Email Authentication Schemas
// -----------------------------------------------------------------------------

export const spfResultSchema = z.enum([
  "pass",
  "fail",
  "softfail",
  "neutral",
  "none",
  "temperror",
  "permerror",
]);

export const dmarcResultSchema = z.enum([
  "pass",
  "fail",
  "none",
  "temperror",
  "permerror",
]);

export const dmarcPolicySchema = z
  .enum(["reject", "quarantine", "none"])
  .nullable();

export const dkimSignatureResultSchema = z.enum([
  "pass",
  "fail",
  "temperror",
  "permerror",
]);

export const dkimSignatureSchema = z.object({
  domain: z.string(),
  selector: z.string().nullable().optional(),
  result: dkimSignatureResultSchema,
  aligned: z.boolean(),
  // Key sizes: 512-4096 for RSA, 256 for Ed25519. 16384 is a generous upper bound.
  keyBits: z.number().int().positive().max(16384).nullable().optional(),
  algo: z.string().nullable().optional(),
});

export const emailAuthSchema = z.object({
  spf: spfResultSchema,
  dmarc: dmarcResultSchema,
  dmarcPolicy: dmarcPolicySchema,
  dmarcFromDomain: z.string().nullable(),
  dmarcSpfAligned: z.boolean().optional(),
  dmarcDkimAligned: z.boolean().optional(),
  dmarcSpfStrict: z.boolean().nullable(),
  dmarcDkimStrict: z.boolean().nullable(),
  dkimSignatures: z.array(dkimSignatureSchema),
});

// -----------------------------------------------------------------------------
// Forward Analysis Schemas
// -----------------------------------------------------------------------------

export const forwardVerdictSchema = z.enum(["legit", "unknown"]);

export const forwardVerificationSchema = z.object({
  verdict: forwardVerdictSchema,
  confidence: z.enum(["high", "medium", "low"]),
  dkim_verified: z.boolean(),
  dkim_domain: z.string().nullable(),
  dmarc_policy: dmarcPolicySchema,
});

export const forwardOriginalSenderSchema = z.object({
  email: z.string(),
  domain: z.string(),
});

export const forwardResultInlineSchema = z.object({
  type: z.literal("inline"),
  original_sender: forwardOriginalSenderSchema.nullable(),
  verification: forwardVerificationSchema,
  summary: z.string(),
});

export const forwardResultAttachmentAnalyzedSchema = z.object({
  type: z.literal("attachment"),
  attachment_tar_path: z.string(),
  attachment_filename: z.string().nullable(),
  analyzed: z.literal(true),
  original_sender: forwardOriginalSenderSchema.nullable(),
  verification: forwardVerificationSchema,
  summary: z.string(),
});

export const forwardResultAttachmentSkippedSchema = z.object({
  type: z.literal("attachment"),
  attachment_tar_path: z.string(),
  attachment_filename: z.string().nullable(),
  analyzed: z.literal(false),
  original_sender: z.null(),
  verification: z.null(),
  summary: z.string(),
});

export const forwardResultSchema = z.union([
  forwardResultInlineSchema,
  forwardResultAttachmentAnalyzedSchema,
  forwardResultAttachmentSkippedSchema,
]);

export const forwardAnalysisSchema = z.object({
  detected: z.boolean(),
  results: z.array(forwardResultSchema),
  attachments_found: z.number().int().nonnegative(),
  attachments_analyzed: z.number().int().nonnegative(),
  attachments_limit: z.number().int().positive().nullable(),
});

export const emailAnalysisSchema = z.object({
  spamassassin: z
    .object({
      score: z.number(),
    })
    .optional(),
  forward: forwardAnalysisSchema.optional(),
});

// -----------------------------------------------------------------------------
// Email Received Event Schema (Managed Webhooks — strict)
// -----------------------------------------------------------------------------

export const emailReceivedEventSchema = z.object({
  id: z.string(),
  event: z.literal("email.received"),
  version: z.string().regex(VERSION_PATTERN, {
    message: "Version must be a date in YYYY-MM-DD format",
  }),
  delivery: z.object({
    endpoint_id: z.string(),
    attempt: z.number().int().positive(),
    attempted_at: z.string(),
  }),
  email: z.object({
    id: z.string(),
    received_at: z.string(),
    smtp: z.object({
      helo: z.string().nullable(),
      mail_from: z.string(),
      rcpt_to: z.array(z.string()).min(1, "At least one recipient is required"),
    }),
    headers: z.object({
      message_id: z.string().nullable(),
      subject: z.string().nullable(),
      from: z.string(),
      to: z.string(),
      date: z.string().nullable(),
    }),
    content: z.object({
      raw: rawContentSchema,
      download: z.object({
        url: httpsUrlSchema,
        expires_at: z.string(),
      }),
    }),
    parsed: parsedDataSchema,
    analysis: emailAnalysisSchema,
    auth: emailAuthSchema,
  }),
}) satisfies z.ZodType<EmailReceivedEvent>;

// -----------------------------------------------------------------------------
// Local Email Schema (Self-Hosted — relaxed)
// -----------------------------------------------------------------------------

/**
 * Relaxed parsed data schema for self-hosted: allows local file paths
 * instead of HTTPS URLs for attachments_download_url.
 */
const localParsedDataCompleteSchema = z.object({
  status: z.literal("complete"),
  error: z.null(),
  body_text: z.string().nullable(),
  body_html: z.string().nullable(),
  reply_to: z.array(emailAddressSchema).nullable(),
  cc: z.array(emailAddressSchema).nullable(),
  bcc: z.array(emailAddressSchema).nullable(),
  in_reply_to: z.array(z.string()).nullable(),
  references: z.array(z.string()).nullable(),
  attachments: z.array(webhookAttachmentSchema),
  attachments_download_url: z.string().nullable(),
});

const localParsedDataSchema = z.discriminatedUnion("status", [
  localParsedDataCompleteSchema,
  parsedDataFailedSchema,
]);

/**
 * Relaxed schema for self-hosted email JSON files.
 *
 * Differences from the strict managed webhook schema:
 * - `event`, `version`, `delivery` fields are optional (not present in local files)
 * - `content.download` is optional (no signed URLs locally)
 * - `attachments_download_url` accepts any string (local file paths)
 * - `analysis` is optional (no SpamAssassin locally)
 */
export const localEmailSchema = z.object({
  id: z.string(),
  event: z.literal("email.received").optional(),
  version: z.string().optional(),
  delivery: z
    .object({
      endpoint_id: z.string(),
      attempt: z.number().int().positive(),
      attempted_at: z.string(),
    })
    .optional(),
  email: z.object({
    id: z.string(),
    received_at: z.string(),
    smtp: z.object({
      helo: z.string().nullable(),
      mail_from: z.string(),
      rcpt_to: z.array(z.string()).min(1, "At least one recipient is required"),
    }),
    headers: z.object({
      message_id: z.string().nullable(),
      subject: z.string().nullable(),
      from: z.string(),
      to: z.string(),
      date: z.string().nullable(),
    }),
    content: z.object({
      raw: rawContentSchema.optional(),
      raw_path: z.string().optional(),
      download: z
        .object({
          url: z.string(),
          expires_at: z.string(),
        })
        .optional(),
    }),
    parsed: localParsedDataSchema,
    analysis: emailAnalysisSchema.optional(),
    auth: emailAuthSchema,
  }),
});

// -----------------------------------------------------------------------------
// Human-Friendly Error Formatting
// -----------------------------------------------------------------------------

/**
 * Human-friendly field descriptions for error messages.
 * Maps field paths to readable descriptions.
 */
const FIELD_DESCRIPTIONS: Record<string, string> = {
  id: "unique event identifier",
  event: "event type",
  version: "API version",
  delivery: "delivery metadata",
  "delivery.endpoint_id": "webhook endpoint ID",
  "delivery.attempt": "delivery attempt number",
  "delivery.attempted_at": "delivery timestamp",
  email: "email data",
  "email.id": "email identifier",
  "email.received_at": "email received timestamp",
  "email.smtp": "SMTP envelope data",
  "email.smtp.helo": "HELO hostname",
  "email.smtp.mail_from": "sender address (MAIL FROM)",
  "email.smtp.rcpt_to": "recipient addresses (RCPT TO) - at least one required",
  "email.headers": "email headers",
  "email.headers.from": "From header",
  "email.headers.to": "To header",
  "email.headers.subject": "email subject",
  "email.headers.message_id": "Message-ID header",
  "email.headers.date": "Date header",
  "email.content": "email content",
  "email.content.raw": "raw email data",
  "email.content.raw.data": "raw email content (base64)",
  "email.content.raw.included": "whether raw content is inline",
  "email.content.raw.encoding": "raw content encoding",
  "email.content.raw.size_bytes": "raw email size",
  "email.content.raw.sha256": "raw email hash",
  "email.content.raw.max_inline_bytes": "inline size threshold",
  "email.content.raw.reason_code": "exclusion reason",
  "email.content.download": "download information",
  "email.content.download.url": "download URL",
  "email.content.download.expires_at": "download URL expiration",
  "email.parsed": "parsed email content",
  "email.parsed.status": "parsing status",
  "email.parsed.error": "parsing error details",
  "email.parsed.body_text": "plain text body",
  "email.parsed.body_html": "HTML body",
  "email.parsed.reply_to": "Reply-To addresses",
  "email.parsed.cc": "CC addresses",
  "email.parsed.bcc": "BCC addresses",
  "email.parsed.in_reply_to": "In-Reply-To header",
  "email.parsed.references": "References header",
  "email.parsed.attachments": "attachment list",
  "email.parsed.attachments_download_url": "attachments download URL",
  "email.analysis": "email analysis results",
  "email.analysis.spamassassin": "SpamAssassin analysis",
  "email.analysis.spamassassin.score": "spam score",
  "email.analysis.forward": "forward detection results",
  "email.analysis.forward.detected": "whether forwards were detected",
  "email.analysis.forward.results": "forward analysis results",
  "email.analysis.forward.results.*.type":
    "forward type (inline or attachment)",
  "email.analysis.forward.results.*.attachment_tar_path":
    "attachment path in tar",
  "email.analysis.forward.results.*.attachment_filename": "attachment filename",
  "email.analysis.forward.results.*.analyzed":
    "whether attachment was analyzed",
  "email.analysis.forward.results.*.original_sender": "original sender info",
  "email.analysis.forward.results.*.original_sender.email":
    "original sender email",
  "email.analysis.forward.results.*.original_sender.domain":
    "original sender domain",
  "email.analysis.forward.results.*.verification":
    "forward verification result",
  "email.analysis.forward.results.*.verification.verdict":
    "verification verdict",
  "email.analysis.forward.results.*.verification.confidence":
    "verification confidence",
  "email.analysis.forward.results.*.verification.dkim_verified":
    "DKIM verification status",
  "email.analysis.forward.results.*.verification.dkim_domain":
    "DKIM signing domain",
  "email.analysis.forward.results.*.verification.dmarc_policy":
    "original sender DMARC policy",
  "email.analysis.forward.results.*.summary": "forward analysis summary",
  "email.analysis.forward.attachments_found": "total .eml attachments found",
  "email.analysis.forward.attachments_analyzed": "analyzed attachments count",
  "email.analysis.forward.attachments_limit": "attachment analysis limit",
  "email.auth": "email authentication results",
  "email.auth.spf": "SPF verification result",
  "email.auth.dmarc": "DMARC verification result",
  "email.auth.dmarcPolicy": "DMARC policy",
  "email.auth.dmarcFromDomain": "DMARC organizational domain",
  "email.auth.dmarcSpfAligned": "SPF DMARC alignment",
  "email.auth.dmarcDkimAligned": "DKIM DMARC alignment",
  "email.auth.dmarcSpfStrict": "SPF alignment mode",
  "email.auth.dmarcDkimStrict": "DKIM alignment mode",
  "email.auth.dkimSignatures": "DKIM signature list",
  "email.auth.dkimSignatures.*.domain": "DKIM signing domain",
  "email.auth.dkimSignatures.*.selector": "DKIM selector",
  "email.auth.dkimSignatures.*.result": "DKIM verification result",
  "email.auth.dkimSignatures.*.aligned": "DKIM alignment status",
  "email.auth.dkimSignatures.*.keyBits": "DKIM key size",
  "email.auth.dkimSignatures.*.algo": "DKIM signing algorithm",
  // Array element fields
  "email.parsed.attachments.*.filename": "attachment filename",
  "email.parsed.attachments.*.content_type": "attachment content type",
  "email.parsed.attachments.*.size_bytes": "attachment size",
  "email.parsed.attachments.*.sha256": "attachment hash",
  "email.parsed.attachments.*.part_index": "attachment part index",
  "email.parsed.attachments.*.tar_path": "attachment tar path",
  "email.parsed.reply_to.*.address": "email address",
  "email.parsed.reply_to.*.name": "display name",
  "email.parsed.cc.*.address": "email address",
  "email.parsed.cc.*.name": "display name",
  "email.parsed.bcc.*.address": "email address",
  "email.parsed.bcc.*.name": "display name",
  "email.parsed.in_reply_to.*": "In-Reply-To message ID",
  "email.parsed.references.*": "message reference ID",
  "email.smtp.rcpt_to.*": "recipient address",
};

/**
 * Get field description, handling array indices.
 */
function getFieldDescription(path: string): string | undefined {
  // Direct match
  if (FIELD_DESCRIPTIONS[path]) {
    return FIELD_DESCRIPTIONS[path];
  }

  // Handle array indices: "email.parsed.attachments.0.filename" -> "email.parsed.attachments.*.filename"
  const wildcardPath = path.replace(/\.\d+\./g, ".*.");
  if (FIELD_DESCRIPTIONS[wildcardPath]) {
    return FIELD_DESCRIPTIONS[wildcardPath];
  }

  // Handle trailing array index: "email.parsed.attachments.0" -> "email.parsed.attachments"
  const parentPath = path.replace(/\.\d+$/, "");
  if (FIELD_DESCRIPTIONS[parentPath]) {
    return `element in ${FIELD_DESCRIPTIONS[parentPath]}`;
  }

  return undefined;
}

/**
 * Format a Zod error into a human-friendly message with actionable suggestion.
 */
function formatZodError(error: ZodError): {
  field: string;
  message: string;
  suggestion: string;
} {
  const issue = error.issues[0];
  const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
  const fieldDesc = getFieldDescription(path);
  const fieldLabel = fieldDesc ? `${path} (${fieldDesc})` : path;

  // For root-level type errors, give a more specific message
  if (issue.path.length === 0 && issue.code === "invalid_type") {
    return {
      field: "(root)",
      message: `Expected webhook payload object but received ${issue.received}`,
      suggestion:
        issue.received === "undefined"
          ? "No payload was provided. Make sure you're passing the parsed JSON body."
          : issue.received === "null"
            ? "Received null instead of payload object. Did you forget to parse the JSON?"
            : `Received ${issue.received} instead of object. Webhook payloads must be objects.`,
    };
  }

  let message: string;
  let suggestion: string;

  switch (issue.code) {
    case "invalid_type":
      if (issue.received === "undefined") {
        message = `Missing required field: ${fieldLabel}`;
        suggestion = `The field "${path}" is required but was not provided.`;
      } else {
        message = `Invalid type for ${path}: expected ${issue.expected} but got ${issue.received}`;
        suggestion = `Check that "${path}" is a ${issue.expected}, not a ${issue.received}.`;
        if (issue.expected === "number" && issue.received === "string") {
          suggestion += " Don't quote numeric values in JSON.";
        }
      }
      break;

    case "invalid_literal":
      message = `Invalid value for ${path}: expected "${issue.expected}" but got "${issue.received}"`;
      if (path === "event") {
        suggestion = `This SDK handles "${issue.expected}" events. The webhook sent "${issue.received}" instead.`;
      } else {
        suggestion = `Expected the literal value "${issue.expected}" for ${fieldLabel}.`;
      }
      break;

    case "invalid_string":
      if (path === "version") {
        message = `Invalid version format: "${(issue as ZodIssue & { received?: unknown }).received || "unknown"}"`;
        suggestion = `Version must be a date in YYYY-MM-DD format (e.g., "${WEBHOOK_VERSION}").`;
      } else {
        message = `Invalid string for ${path}: ${issue.message}`;
        suggestion = `Check the format of "${path}".`;
      }
      break;

    case "invalid_enum_value":
      message = `Invalid value for ${path}: got "${(issue as ZodIssue & { received: unknown }).received}", expected one of: ${issue.options.join(", ")}`;
      suggestion = `The ${fieldDesc || path} must be one of: ${issue.options.join(", ")}`;
      break;

    case "invalid_union":
      message = `Invalid value for ${path}: doesn't match any expected format`;
      suggestion = `Check the structure of "${path}" matches the expected schema.`;
      break;

    case "invalid_union_discriminator":
      message = `Invalid discriminator value for ${path}`;
      suggestion =
        "The field used to determine the type variant has an unexpected value. Check the schema documentation.";
      break;

    default:
      message = `Validation failed for ${path}: ${issue.message}`;
      suggestion = `Check the value of "${path}" in the webhook payload.`;
  }

  return { field: path, message, suggestion };
}

// -----------------------------------------------------------------------------
// Validation Functions
// -----------------------------------------------------------------------------

/**
 * Validate and parse a webhook payload as an EmailReceivedEvent.
 *
 * Uses Zod for comprehensive schema validation. Throws WebhookValidationError
 * with human-friendly messages if validation fails.
 *
 * NOTE: This is the strict validation version. For lightweight parsing without
 * full schema validation, use `parseWebhookEvent` from the main export.
 *
 * @param input - The parsed JSON payload (use `JSON.parse(rawBody)`)
 * @returns The validated and typed event
 * @throws WebhookValidationError with actionable message if validation fails
 *
 * @example
 * ```typescript
 * import { validateEmailReceivedEvent, WebhookValidationError } from '@primitivedotdev/sdk-node/zod';
 *
 * try {
 *   const event = validateEmailReceivedEvent(JSON.parse(rawBody));
 *   // event is fully validated and typed
 * } catch (err) {
 *   if (err instanceof WebhookValidationError) {
 *     console.error(`[${err.code}] ${err.message}`);
 *     console.error(`Field: ${err.field}`);
 *     console.error(`Suggestion: ${err.suggestion}`);
 *   }
 * }
 * ```
 */
export function validateEmailReceivedEvent(input: unknown): EmailReceivedEvent {
  const result = emailReceivedEventSchema.safeParse(input);

  if (!result.success) {
    const { field, message, suggestion } = formatZodError(result.error);
    throw new WebhookValidationError(field, message, suggestion, result.error);
  }

  return result.data;
}

/**
 * Safely validate a webhook payload, returning a result object instead of throwing.
 *
 * @param input - The parsed JSON payload
 * @returns A Zod SafeParseResult with either the data or error
 *
 * @example
 * ```typescript
 * import { safeValidateEmailReceivedEvent } from '@primitivedotdev/sdk-node/zod';
 *
 * const result = safeValidateEmailReceivedEvent(payload);
 * if (result.success) {
 *   console.log('Valid event:', result.data.id);
 * } else {
 *   console.error('Validation failed:', result.error.issues);
 * }
 * ```
 */
export function safeValidateEmailReceivedEvent(
  input: unknown,
): z.SafeParseReturnType<unknown, EmailReceivedEvent> {
  return emailReceivedEventSchema.safeParse(input);
}
