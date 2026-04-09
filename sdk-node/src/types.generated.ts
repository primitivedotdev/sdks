/**
 * Types for Primitive webhook payloads.
 *
 * AUTO-GENERATED - DO NOT EDIT
 * Run `pnpm generate:types` to regenerate.
 */

/**
 * Result for a single forwarded email detected in the message.
 * 
 * Use the `type` and `analyzed` fields to narrow the type:
 * - `type: 'inline'` - Inline forward, always analyzed
 * - `type: 'attachment'` + `analyzed: true` - Analyzed attachment
 * - `type: 'attachment'` + `analyzed: false` - Skipped attachment
 * 
 * This interface was referenced by `EmailReceivedEvent`'s JSON-Schema
 * via the `definition` "ForwardResult".
 */
export type ForwardResult = (ForwardResultInline | ForwardResultAttachmentAnalyzed | ForwardResultAttachmentSkipped)
/**
 * Valid webhook version format (YYYY-MM-DD date string). The SDK accepts any valid date-formatted version, not just the current one, for forward and backward compatibility.
 * 
 * This interface was referenced by `EmailReceivedEvent`'s JSON-Schema
 * via the `definition` "WebhookVersion".
 */
export type WebhookVersion = string
/**
 * Raw email content - a discriminated union on `included`.
 * 
 * This interface was referenced by `EmailReceivedEvent`'s JSON-Schema
 * via the `definition` "RawContent".
 */
export type RawContent = (RawContentInline | RawContentDownloadOnly)
/**
 * Parsed email content - a discriminated union on `status`.
 * 
 * This interface was referenced by `EmailReceivedEvent`'s JSON-Schema
 * via the `definition` "ParsedData".
 */
export type ParsedData = (ParsedDataComplete | ParsedDataFailed)
/**
 * Verdict for forwarded email verification.
 * 
 * - `legit`: DKIM signature verified the original sender
 * - `unknown`: Could not verify the forwarded email's authenticity
 * 
 * This interface was referenced by `EmailReceivedEvent`'s JSON-Schema
 * via the `definition` "ForwardVerdict".
 */
export type ForwardVerdict = ("legit" | "unknown")
/**
 * Confidence level for the authentication verdict.
 * 
 * - `high`: Strong cryptographic evidence (DKIM aligned + DMARC pass)
 * - `medium`: Good evidence but with caveats (SPF-only alignment)
 * - `low`: Weak evidence (missing authentication or unclear results)
 * 
 * This interface was referenced by `EmailReceivedEvent`'s JSON-Schema
 * via the `definition` "AuthConfidence".
 */
export type AuthConfidence = ("high" | "medium" | "low")
/**
 * DMARC policy action specified in the domain's DMARC record.
 * 
 * - `reject`: The domain owner requests that receivers reject failing emails
 * - `quarantine`: The domain owner requests that failing emails be treated as suspicious
 * - `none`: The domain owner is only monitoring (no action requested)
 * - `null`: No DMARC policy was found for the domain
 * 
 * This interface was referenced by `EmailReceivedEvent`'s JSON-Schema
 * via the `definition` "DmarcPolicy".
 */
export type DmarcPolicy = ("reject" | "quarantine" | "none" | null)
/**
 * SPF verification result.
 * 
 * This interface was referenced by `EmailReceivedEvent`'s JSON-Schema
 * via the `definition` "SpfResult".
 */
export type SpfResult = ("pass" | "fail" | "softfail" | "neutral" | "none" | "temperror" | "permerror")
/**
 * DMARC verification result.
 * 
 * This interface was referenced by `EmailReceivedEvent`'s JSON-Schema
 * via the `definition` "DmarcResult".
 */
export type DmarcResult = ("pass" | "fail" | "none" | "temperror" | "permerror")
/**
 * DKIM signature verification result for a single signature.
 * 
 * This interface was referenced by `EmailReceivedEvent`'s JSON-Schema
 * via the `definition` "DkimResult".
 */
export type DkimResult = ("pass" | "fail" | "temperror" | "permerror")

/**
 * Webhook payload for the `email.received` event.
 * 
 * This is delivered to your webhook endpoint when Primitive receives an email matching your domain configuration.
 */
export interface EmailReceivedEvent {
/**
 * Unique delivery event ID.
 * 
 * This ID is stable across retries to the same endpoint - use it as your idempotency/dedupe key. Note that the same email delivered to different endpoints will have different event IDs.
 * 
 * Format: `evt_` prefix followed by a SHA-256 hash (64 hex characters). Example: `evt_a1b2c3d4e5f6...` (68 characters total)
 */
id: string
/**
 * Event type identifier. Always `"email.received"` for this event type.
 */
event: "email.received"
/**
 * API version in date format (YYYY-MM-DD). Use this to detect version mismatches between webhook and SDK.
 */
version: string
/**
 * Metadata about this webhook delivery.
 */
delivery: {
/**
 * ID of the webhook endpoint receiving this event. Matches the endpoint ID from your Primitive dashboard.
 */
endpoint_id: string
/**
 * Delivery attempt number, starting at 1. Increments with each retry if previous attempts failed.
 */
attempt: number
/**
 * ISO 8601 timestamp (UTC) when this delivery was attempted.
 */
attempted_at: string
}
/**
 * The email that triggered this event.
 */
email: {
/**
 * Unique email ID in Primitive. Use this ID when calling Primitive APIs to reference this email.
 */
id: string
/**
 * ISO 8601 timestamp (UTC) when Primitive received the email.
 */
received_at: string
/**
 * SMTP envelope information. This is the "real" sender/recipient info from the SMTP transaction, which may differ from the headers (e.g., BCC recipients).
 */
smtp: {
/**
 * HELO/EHLO hostname from the sending server. Null if not provided during SMTP transaction.
 */
helo: (string | null)
/**
 * SMTP envelope sender (MAIL FROM command). This is the bounce address, which may differ from the From header.
 */
mail_from: string
/**
 * SMTP envelope recipients (RCPT TO commands). All addresses that received this email in a single delivery.
 * 
 * @minItems 1
 */
rcpt_to: [string, ...(string)[]]
}
/**
 * Parsed email headers. These are extracted from the email content, not the SMTP envelope.
 */
headers: {
/**
 * Message-ID header value. Null if the email had no Message-ID header.
 */
message_id: (string | null)
/**
 * Subject header value. Null if the email had no Subject header.
 */
subject: (string | null)
/**
 * From header value. May include display name: `"John Doe" <john@example.com>`
 */
from: string
/**
 * To header value. May include multiple addresses or display names.
 */
to: string
/**
 * Date header value as it appeared in the email. Null if the email had no Date header.
 */
date: (string | null)
}
/**
 * Raw email content and download information.
 */
content: {
/**
 * Raw email in RFC 5322 format. May be inline (base64) or download-only depending on size.
 */
raw: (RawContentInline | RawContentDownloadOnly)
/**
 * Download information for the raw email. Always present, even if raw content is inline.
 */
download: {
/**
 * HTTPS URL to download the raw email. Returns the email as-is in RFC 5322 format.
 */
url: string
/**
 * ISO 8601 timestamp (UTC) when this URL expires. Download before this time or the URL will return 403.
 */
expires_at: string
}
}
/**
 * Parsed email content (body text, HTML, attachments). Check `status` to determine if parsing succeeded.
 */
parsed: (ParsedDataComplete | ParsedDataFailed)
analysis: EmailAnalysis
auth: EmailAuth
}
}
/**
 * Raw email content included inline (base64 encoded).
 * 
 * When the raw email is small enough (under  {@link  max_inline_bytes } ), it's included directly in the webhook payload for convenience.
 * 
 * This interface was referenced by `EmailReceivedEvent`'s JSON-Schema
 * via the `definition` "RawContentInline".
 */
export interface RawContentInline {
/**
 * Discriminant indicating raw content is included inline.
 */
included: true
/**
 * Encoding used for the data field. Always "base64".
 */
encoding: "base64"
/**
 * Maximum size in bytes for inline inclusion. Emails larger than this threshold require download.
 */
max_inline_bytes: number
/**
 * Actual size of the raw email in bytes.
 */
size_bytes: number
/**
 * SHA-256 hash of the raw email content (hex-encoded). Use this to verify integrity after base64 decoding.
 */
sha256: string
/**
 * Base64-encoded raw email (RFC 5322 format). Decode with `Buffer.from(data, 'base64')` in Node.js.
 */
data: string
}
/**
 * Raw email content not included (must be downloaded).
 * 
 * When the raw email exceeds  {@link  max_inline_bytes } , it's not included in the webhook payload. Use the download URL from  {@link  EmailReceivedEvent.email.content.download  }  to fetch it.
 * 
 * This interface was referenced by `EmailReceivedEvent`'s JSON-Schema
 * via the `definition` "RawContentDownloadOnly".
 */
export interface RawContentDownloadOnly {
/**
 * Discriminant indicating raw content must be downloaded.
 */
included: false
/**
 * Reason the content wasn't included inline.
 */
reason_code: "size_exceeded"
/**
 * Maximum size in bytes for inline inclusion. The email exceeded this threshold.
 */
max_inline_bytes: number
/**
 * Actual size of the raw email in bytes.
 */
size_bytes: number
/**
 * SHA-256 hash of the raw email content (hex-encoded). Use this to verify integrity after download.
 */
sha256: string
}
/**
 * Parsed email content when parsing succeeded.
 * 
 * Use the discriminant `status: "complete"` to narrow from  {@link  ParsedData } .
 * 
 * This interface was referenced by `EmailReceivedEvent`'s JSON-Schema
 * via the `definition` "ParsedDataComplete".
 */
export interface ParsedDataComplete {
/**
 * Discriminant indicating successful parsing.
 */
status: "complete"
/**
 * Always null when parsing succeeds.
 */
error: null
/**
 * Plain text body of the email. Null if the email had no text/plain part.
 */
body_text: (string | null)
/**
 * HTML body of the email (sanitized via DOMPurify). Null if the email had no text/html part.
 */
body_html: (string | null)
/**
 * Parsed Reply-To header addresses. Null if the email had no Reply-To header.
 */
reply_to: (EmailAddress[] | null)
/**
 * Parsed CC header addresses. Null if the email had no CC header.
 */
cc: (EmailAddress[] | null)
/**
 * Parsed BCC header addresses. Null if the email had no BCC header. Note: BCC is only available for outgoing emails or when explicitly provided.
 */
bcc: (EmailAddress[] | null)
/**
 * In-Reply-To header values (Message-IDs of the email(s) being replied to). Null if the email had no In-Reply-To header. Per RFC 5322, this can contain multiple Message-IDs, though typically just one.
 */
in_reply_to: (string[] | null)
/**
 * References header values (Message-IDs of the email thread). Null if the email had no References header.
 */
references: (string[] | null)
/**
 * List of attachments with metadata. Use  {@link  attachments_download_url }  to download the actual files.
 */
attachments: WebhookAttachment[]
/**
 * HTTPS URL to download all attachments as a tar.gz archive. Null if the email had no attachments. URL expires - check the expiration before downloading.
 */
attachments_download_url: (string | null)
}
/**
 * A parsed email address with optional display name.
 * 
 * This structure is used in the `parsed` section of the webhook payload (e.g., `reply_to`, `cc`, `bcc`). For unparsed header strings, see the `headers` section (e.g., `event.email.headers.from`).
 * 
 * This interface was referenced by `EmailReceivedEvent`'s JSON-Schema
 * via the `definition` "EmailAddress".
 */
export interface EmailAddress {
/**
 * The email address portion (e.g., "john@example.com").
 * 
 * This is the raw value from the email header with no validation applied. May contain unusual but valid formats like quoted local parts.
 */
address: string
/**
 * The display name portion, if present. Null if the address had no display name.
 * 
 * May contain any characters including unicode, emoji, or special characters as they appeared in the original email header.
 */
name: (string | null)
}
/**
 * Metadata for an email attachment.
 * 
 * Attachment content is not included directly in the webhook payload. Use the `attachments_download_url` from  {@link  ParsedDataComplete }  to download all attachments as a tar.gz archive.
 * 
 * This interface was referenced by `EmailReceivedEvent`'s JSON-Schema
 * via the `definition` "WebhookAttachment".
 */
export interface WebhookAttachment {
/**
 * Original filename from the email. May be null if the attachment had no filename specified.
 */
filename: (string | null)
/**
 * MIME content type (e.g., "application/pdf", "image/png").
 */
content_type: string
/**
 * Size of the attachment in bytes.
 */
size_bytes: number
/**
 * SHA-256 hash of the attachment content (hex-encoded). Use this to verify attachment integrity after download.
 */
sha256: string
/**
 * Zero-based index of this part in the MIME structure.
 */
part_index: number
/**
 * Path to this attachment within the downloaded tar.gz archive.
 */
tar_path: string
}
/**
 * Parsed email content when parsing failed.
 * 
 * Use the discriminant `status: "failed"` to narrow from  {@link  ParsedData } .
 * 
 * This interface was referenced by `EmailReceivedEvent`'s JSON-Schema
 * via the `definition` "ParsedDataFailed".
 */
export interface ParsedDataFailed {
/**
 * Discriminant indicating parsing failed.
 */
status: "failed"
error: ParsedError
/**
 * Always null when parsing fails.
 */
body_text: null
/**
 * Always null when parsing fails.
 */
body_html: null
/**
 * Always null when parsing fails.
 */
reply_to: null
/**
 * Always null when parsing fails.
 */
cc: null
/**
 * Always null when parsing fails.
 */
bcc: null
/**
 * Always null when parsing fails.
 */
in_reply_to: null
/**
 * Always null when parsing fails.
 */
references: null
/**
 * May contain partial attachment metadata even when parsing failed. Useful for debugging or recovering partial data.
 */
attachments: WebhookAttachment[]
/**
 * Always null when parsing fails.
 */
attachments_download_url: null
}
/**
 * Details about why parsing failed.
 */
export interface ParsedError {
/**
 * Error code indicating the type of failure.
 * - `PARSE_FAILED`: The email could not be parsed (e.g., malformed MIME)
 * - `ATTACHMENT_EXTRACTION_FAILED`: Email parsed but attachments couldn't be extracted
 */
code: ("PARSE_FAILED" | "ATTACHMENT_EXTRACTION_FAILED")
/**
 * Human-readable error message describing what went wrong.
 */
message: string
/**
 * Whether retrying might succeed. If true, the error was transient (e.g., timeout). If false, the email itself is problematic.
 */
retryable: boolean
}
/**
 * Email analysis and classification results.
 */
export interface EmailAnalysis {
/**
 * SpamAssassin analysis results.
 */
spamassassin?: {
/**
 * Overall spam score (sum of all rule scores). Higher scores indicate higher likelihood of spam. Unbounded - can be negative (ham) or very high (spam).
 */
score: number
}
forward?: ForwardAnalysis
}
/**
 * Forward detection and analysis results.
 */
export interface ForwardAnalysis {
/**
 * Whether any forwards were detected in the email.
 */
detected: boolean
/**
 * Analysis results for each detected forward.
 */
results: ForwardResult[]
/**
 * Total number of .eml attachments found.
 */
attachments_found: number
/**
 * Number of .eml attachments that were analyzed.
 */
attachments_analyzed: number
/**
 * Maximum number of attachments that will be analyzed, or null if unlimited.
 */
attachments_limit: (number | null)
}
/**
 * Result for an inline forward that was detected and analyzed. Inline forwards are always analyzed when forward detection is enabled.
 * 
 * This interface was referenced by `EmailReceivedEvent`'s JSON-Schema
 * via the `definition` "ForwardResultInline".
 */
export interface ForwardResultInline {
type: "inline"
/**
 * Original sender of the forwarded email, if extractable.
 */
original_sender: (ForwardOriginalSender | null)
verification: ForwardVerification
/**
 * Human-readable summary of the forward analysis.
 */
summary: string
}
/**
 * Original sender information extracted from the forwarded email.
 * 
 * This interface was referenced by `EmailReceivedEvent`'s JSON-Schema
 * via the `definition` "ForwardOriginalSender".
 */
export interface ForwardOriginalSender {
/**
 * Email address of the original sender.
 */
email: string
/**
 * Domain of the original sender.
 */
domain: string
}
/**
 * Verification result for the forwarded email.
 */
export interface ForwardVerification {
/**
 * Overall verdict on whether the forward is authentic.
 */
verdict: ("legit" | "unknown")
/**
 * Confidence level for this verdict.
 */
confidence: ("high" | "medium" | "low")
/**
 * Whether a valid DKIM signature was found that verifies the original sender.
 */
dkim_verified: boolean
/**
 * Domain of the DKIM signature that verified the forward, if any.
 */
dkim_domain: (string | null)
/**
 * DMARC policy of the original sender's domain.
 */
dmarc_policy: ("reject" | "quarantine" | "none" | null)
}
/**
 * Result for an attachment forward that was analyzed.
 * 
 * This interface was referenced by `EmailReceivedEvent`'s JSON-Schema
 * via the `definition` "ForwardResultAttachmentAnalyzed".
 */
export interface ForwardResultAttachmentAnalyzed {
type: "attachment"
/**
 * Path to the attachment in the attachments tar archive.
 */
attachment_tar_path: string
/**
 * Original filename of the attachment, if available.
 */
attachment_filename: (string | null)
/**
 * Whether this attachment was analyzed.
 */
analyzed: true
/**
 * Original sender of the forwarded email, if extractable.
 */
original_sender: (ForwardOriginalSender | null)
verification: ForwardVerification1
/**
 * Human-readable summary of the forward analysis.
 */
summary: string
}
/**
 * Verification result for the forwarded email.
 */
export interface ForwardVerification1 {
/**
 * Overall verdict on whether the forward is authentic.
 */
verdict: ("legit" | "unknown")
/**
 * Confidence level for this verdict.
 */
confidence: ("high" | "medium" | "low")
/**
 * Whether a valid DKIM signature was found that verifies the original sender.
 */
dkim_verified: boolean
/**
 * Domain of the DKIM signature that verified the forward, if any.
 */
dkim_domain: (string | null)
/**
 * DMARC policy of the original sender's domain.
 */
dmarc_policy: ("reject" | "quarantine" | "none" | null)
}
/**
 * Result for an attachment forward that was detected but not analyzed. This occurs when attachment analysis is disabled or the limit was reached.
 * 
 * This interface was referenced by `EmailReceivedEvent`'s JSON-Schema
 * via the `definition` "ForwardResultAttachmentSkipped".
 */
export interface ForwardResultAttachmentSkipped {
type: "attachment"
/**
 * Path to the attachment in the attachments tar archive.
 */
attachment_tar_path: string
/**
 * Original filename of the attachment, if available.
 */
attachment_filename: (string | null)
/**
 * Whether this attachment was analyzed.
 */
analyzed: false
/**
 * Always null when not analyzed.
 */
original_sender: null
/**
 * Always null when not analyzed.
 */
verification: null
/**
 * Human-readable summary explaining why analysis was skipped.
 */
summary: string
}
/**
 * Email authentication results (SPF, DKIM, DMARC).
 */
export interface EmailAuth {
/**
 * SPF verification result.
 * 
 * SPF checks if the sending IP is authorized by the envelope sender's domain. "pass" means the IP is authorized; "fail" means it's explicitly not allowed.
 */
spf: ("pass" | "fail" | "softfail" | "neutral" | "none" | "temperror" | "permerror")
/**
 * DMARC verification result.
 * 
 * DMARC passes if either SPF or DKIM passes AND aligns with the From: domain. "pass" means the email is authenticated according to the sender's policy.
 */
dmarc: ("pass" | "fail" | "none" | "temperror" | "permerror")
/**
 * DMARC policy from the sender's DNS record.
 * 
 * - `reject`: Domain wants receivers to reject failing emails
 * - `quarantine`: Domain wants failing emails marked as suspicious
 * - `none`: Domain is monitoring only (no action requested)
 * - `null`: No DMARC record found for this domain
 */
dmarcPolicy: ("reject" | "quarantine" | "none" | null)
/**
 * The organizational domain used for DMARC lookups.
 * 
 * For example, if the From: address is `user@mail.example.com`, the DMARC lookup checks `_dmarc.mail.example.com`, then falls back to `_dmarc.example.com`. This field shows which domain's policy was used.
 */
dmarcFromDomain: (string | null)
/**
 * Whether SPF aligned with the From: domain for DMARC purposes.
 * 
 * True if the envelope sender domain matches the From: domain (per alignment mode). Optional in self-hosted environments.
 */
dmarcSpfAligned?: boolean
/**
 * Whether DKIM aligned with the From: domain for DMARC purposes.
 * 
 * True if at least one DKIM signature's domain matches the From: domain. Optional in self-hosted environments.
 */
dmarcDkimAligned?: boolean
/**
 * Whether DMARC SPF alignment mode is strict.
 * 
 * - `true`: Strict alignment required (exact domain match)
 * - `false`: Relaxed alignment allowed (organizational domain match)
 * - `null`: No DMARC record found
 */
dmarcSpfStrict: (boolean | null)
/**
 * Whether DMARC DKIM alignment mode is strict.
 * 
 * - `true`: Strict alignment required (exact domain match)
 * - `false`: Relaxed alignment allowed (organizational domain match)
 * - `null`: No DMARC record found
 */
dmarcDkimStrict: (boolean | null)
/**
 * All DKIM signatures found in the email with their verification results.
 * 
 * May be empty if no DKIM signatures were present.
 */
dkimSignatures: DkimSignature[]
}
/**
 * Details about a single DKIM signature found in the email.
 * 
 * An email may have multiple DKIM signatures (e.g., one from the sending domain and one from the ESP). Each signature is verified independently.
 * 
 * Fields marked optional (`selector`, `keyBits`, `algo`) may be unavailable in self-hosted environments where the milter provides limited DKIM detail.
 * 
 * This interface was referenced by `EmailReceivedEvent`'s JSON-Schema
 * via the `definition` "DkimSignature".
 */
export interface DkimSignature {
/**
 * The domain that signed this DKIM signature (d= tag). This may differ from the From: domain (that's what alignment checks).
 */
domain: string
/**
 * The DKIM selector used to locate the public key (s= tag). Combined with the domain to form the DNS lookup: `selector._domainkey.domain`
 * 
 * Optional in self-hosted environments where the milter may not provide selector info.
 */
selector?: (string | null)
/**
 * Verification result for this specific signature.
 */
result: ("pass" | "fail" | "temperror" | "permerror")
/**
 * Whether this signature's domain aligns with the From: domain (for DMARC).
 * 
 * Alignment can be "strict" (exact match) or "relaxed" (organizational domain match). For example, if From: is `user@sub.example.com` and DKIM is signed by `example.com`:
 * - Relaxed alignment: true (same organizational domain)
 * - Strict alignment: false (not exact match)
 */
aligned: boolean
/**
 * Key size in bits (e.g., 1024, 2048). Null if the key size couldn't be determined.
 * 
 * Optional in self-hosted environments.
 */
keyBits?: (number | null)
/**
 * Signing algorithm (e.g., "rsa-sha256", "ed25519-sha256").
 * 
 * Optional in self-hosted environments.
 */
algo?: (string | null)
}
/**
 * Webhook payload for the `email.received` event.
 * 
 * This is delivered to your webhook endpoint when Primitive receives an email matching your domain configuration.
 * 
 * This interface was referenced by `EmailReceivedEvent`'s JSON-Schema
 * via the `definition` "EmailReceivedEvent".
 */
export interface EmailReceivedEvent1 {
/**
 * Unique delivery event ID.
 * 
 * This ID is stable across retries to the same endpoint - use it as your idempotency/dedupe key. Note that the same email delivered to different endpoints will have different event IDs.
 * 
 * Format: `evt_` prefix followed by a SHA-256 hash (64 hex characters). Example: `evt_a1b2c3d4e5f6...` (68 characters total)
 */
id: string
/**
 * Event type identifier. Always `"email.received"` for this event type.
 */
event: "email.received"
/**
 * API version in date format (YYYY-MM-DD). Use this to detect version mismatches between webhook and SDK.
 */
version: string
/**
 * Metadata about this webhook delivery.
 */
delivery: {
/**
 * ID of the webhook endpoint receiving this event. Matches the endpoint ID from your Primitive dashboard.
 */
endpoint_id: string
/**
 * Delivery attempt number, starting at 1. Increments with each retry if previous attempts failed.
 */
attempt: number
/**
 * ISO 8601 timestamp (UTC) when this delivery was attempted.
 */
attempted_at: string
}
/**
 * The email that triggered this event.
 */
email: {
/**
 * Unique email ID in Primitive. Use this ID when calling Primitive APIs to reference this email.
 */
id: string
/**
 * ISO 8601 timestamp (UTC) when Primitive received the email.
 */
received_at: string
/**
 * SMTP envelope information. This is the "real" sender/recipient info from the SMTP transaction, which may differ from the headers (e.g., BCC recipients).
 */
smtp: {
/**
 * HELO/EHLO hostname from the sending server. Null if not provided during SMTP transaction.
 */
helo: (string | null)
/**
 * SMTP envelope sender (MAIL FROM command). This is the bounce address, which may differ from the From header.
 */
mail_from: string
/**
 * SMTP envelope recipients (RCPT TO commands). All addresses that received this email in a single delivery.
 * 
 * @minItems 1
 */
rcpt_to: [string, ...(string)[]]
}
/**
 * Parsed email headers. These are extracted from the email content, not the SMTP envelope.
 */
headers: {
/**
 * Message-ID header value. Null if the email had no Message-ID header.
 */
message_id: (string | null)
/**
 * Subject header value. Null if the email had no Subject header.
 */
subject: (string | null)
/**
 * From header value. May include display name: `"John Doe" <john@example.com>`
 */
from: string
/**
 * To header value. May include multiple addresses or display names.
 */
to: string
/**
 * Date header value as it appeared in the email. Null if the email had no Date header.
 */
date: (string | null)
}
/**
 * Raw email content and download information.
 */
content: {
/**
 * Raw email in RFC 5322 format. May be inline (base64) or download-only depending on size.
 */
raw: (RawContentInline | RawContentDownloadOnly)
/**
 * Download information for the raw email. Always present, even if raw content is inline.
 */
download: {
/**
 * HTTPS URL to download the raw email. Returns the email as-is in RFC 5322 format.
 */
url: string
/**
 * ISO 8601 timestamp (UTC) when this URL expires. Download before this time or the URL will return 403.
 */
expires_at: string
}
}
/**
 * Parsed email content (body text, HTML, attachments). Check `status` to determine if parsing succeeded.
 */
parsed: (ParsedDataComplete | ParsedDataFailed)
analysis: EmailAnalysis
auth: EmailAuth
}
}
/**
 * Error details when email parsing fails.
 * 
 * This interface was referenced by `EmailReceivedEvent`'s JSON-Schema
 * via the `definition` "ParsedError".
 */
export interface ParsedError1 {
/**
 * Error code indicating the type of failure.
 * - `PARSE_FAILED`: The email could not be parsed (e.g., malformed MIME)
 * - `ATTACHMENT_EXTRACTION_FAILED`: Email parsed but attachments couldn't be extracted
 */
code: ("PARSE_FAILED" | "ATTACHMENT_EXTRACTION_FAILED")
/**
 * Human-readable error message describing what went wrong.
 */
message: string
/**
 * Whether retrying might succeed. If true, the error was transient (e.g., timeout). If false, the email itself is problematic.
 */
retryable: boolean
}
/**
 * Email analysis and classification results.
 * 
 * This interface was referenced by `EmailReceivedEvent`'s JSON-Schema
 * via the `definition` "EmailAnalysis".
 */
export interface EmailAnalysis1 {
/**
 * SpamAssassin analysis results.
 */
spamassassin?: {
/**
 * Overall spam score (sum of all rule scores). Higher scores indicate higher likelihood of spam. Unbounded - can be negative (ham) or very high (spam).
 */
score: number
}
forward?: ForwardAnalysis
}
/**
 * Forward detection and analysis results.
 * 
 * This interface was referenced by `EmailReceivedEvent`'s JSON-Schema
 * via the `definition` "ForwardAnalysis".
 */
export interface ForwardAnalysis1 {
/**
 * Whether any forwards were detected in the email.
 */
detected: boolean
/**
 * Analysis results for each detected forward.
 */
results: ForwardResult[]
/**
 * Total number of .eml attachments found.
 */
attachments_found: number
/**
 * Number of .eml attachments that were analyzed.
 */
attachments_analyzed: number
/**
 * Maximum number of attachments that will be analyzed, or null if unlimited.
 */
attachments_limit: (number | null)
}
/**
 * Verification result for a forwarded email.
 * 
 * This interface was referenced by `EmailReceivedEvent`'s JSON-Schema
 * via the `definition` "ForwardVerification".
 */
export interface ForwardVerification2 {
/**
 * Overall verdict on whether the forward is authentic.
 */
verdict: ("legit" | "unknown")
/**
 * Confidence level for this verdict.
 */
confidence: ("high" | "medium" | "low")
/**
 * Whether a valid DKIM signature was found that verifies the original sender.
 */
dkim_verified: boolean
/**
 * Domain of the DKIM signature that verified the forward, if any.
 */
dkim_domain: (string | null)
/**
 * DMARC policy of the original sender's domain.
 */
dmarc_policy: ("reject" | "quarantine" | "none" | null)
}
/**
 * Email authentication results for SPF, DKIM, and DMARC.
 * 
 * Use `validateEmailAuth()` to compute a verdict based on these results.
 * 
 * This interface was referenced by `EmailReceivedEvent`'s JSON-Schema
 * via the `definition` "EmailAuth".
 */
export interface EmailAuth1 {
/**
 * SPF verification result.
 * 
 * SPF checks if the sending IP is authorized by the envelope sender's domain. "pass" means the IP is authorized; "fail" means it's explicitly not allowed.
 */
spf: ("pass" | "fail" | "softfail" | "neutral" | "none" | "temperror" | "permerror")
/**
 * DMARC verification result.
 * 
 * DMARC passes if either SPF or DKIM passes AND aligns with the From: domain. "pass" means the email is authenticated according to the sender's policy.
 */
dmarc: ("pass" | "fail" | "none" | "temperror" | "permerror")
/**
 * DMARC policy from the sender's DNS record.
 * 
 * - `reject`: Domain wants receivers to reject failing emails
 * - `quarantine`: Domain wants failing emails marked as suspicious
 * - `none`: Domain is monitoring only (no action requested)
 * - `null`: No DMARC record found for this domain
 */
dmarcPolicy: ("reject" | "quarantine" | "none" | null)
/**
 * The organizational domain used for DMARC lookups.
 * 
 * For example, if the From: address is `user@mail.example.com`, the DMARC lookup checks `_dmarc.mail.example.com`, then falls back to `_dmarc.example.com`. This field shows which domain's policy was used.
 */
dmarcFromDomain: (string | null)
/**
 * Whether SPF aligned with the From: domain for DMARC purposes.
 * 
 * True if the envelope sender domain matches the From: domain (per alignment mode). Optional in self-hosted environments.
 */
dmarcSpfAligned?: boolean
/**
 * Whether DKIM aligned with the From: domain for DMARC purposes.
 * 
 * True if at least one DKIM signature's domain matches the From: domain. Optional in self-hosted environments.
 */
dmarcDkimAligned?: boolean
/**
 * Whether DMARC SPF alignment mode is strict.
 * 
 * - `true`: Strict alignment required (exact domain match)
 * - `false`: Relaxed alignment allowed (organizational domain match)
 * - `null`: No DMARC record found
 */
dmarcSpfStrict: (boolean | null)
/**
 * Whether DMARC DKIM alignment mode is strict.
 * 
 * - `true`: Strict alignment required (exact domain match)
 * - `false`: Relaxed alignment allowed (organizational domain match)
 * - `null`: No DMARC record found
 */
dmarcDkimStrict: (boolean | null)
/**
 * All DKIM signatures found in the email with their verification results.
 * 
 * May be empty if no DKIM signatures were present.
 */
dkimSignatures: DkimSignature[]
}
