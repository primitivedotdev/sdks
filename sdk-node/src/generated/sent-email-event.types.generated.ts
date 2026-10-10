/**
 * Types for Primitive sent_email.* webhook payloads.
 *
 * AUTO-GENERATED - DO NOT EDIT
 * Run `pnpm generate:types` to regenerate.
 */

/**
 * The body of a sent_email.* webhook delivery: events about mail you send through Primitive. A separate payload family from the inbound email.* events, with its own version. Keys that do not apply to an event are absent, not null. Fields marked open take values beyond the ones listed; treat unknown values as newer additions.
 */
export type SentEmailEvent = (SentEmailAcceptedEvent | SentEmailRecipientResultEvent | SentEmailRollupResultEvent | SentEmailLegacyMessageResultEvent | SentEmailCompletedEvent)
/**
 * The list that names the recipient. On a mail relay send every hidden recipient is bcc.
 */
export type SentEmailRecipientType = ("to" | "cc" | "bcc")
/**
 * rejected: the receiving server refused the message permanently. expired: it kept asking to retry until the retry period ran out. Closed for this version.
 */
export type SentEmailFailureKind = ("rejected" | "expired")

/**
 * Exactly once for every send Primitive accepted, whatever state the send has reached when the event is created.
 */
export interface SentEmailAcceptedEvent {
/**
 * The event id. The same on every retry and at every endpoint, and equal to the X-Webhook-Id header. Deduplicate on it.
 */
id: string
event: "sent_email.accepted"
/**
 * The version of the sent_email.* payload family. Not an event date.
 */
version: string
/**
 * When the event happened, as far as Primitive knows it: a result's time for result events, the last result's time for sent_email.completed.
 */
created_at: string
delivery: SentEmailEventDelivery
sent_email: SentEmailRecord
}
/**
 * This webhook attempt. Not the email's delivery.
 */
export interface SentEmailEventDelivery {
/**
 * The endpoint this attempt was sent to. Every endpoint is signed with the organization's secret, so check this is the endpoint that received the request.
 */
endpoint_id: string
/**
 * 1 for the first attempt, higher on retries.
 */
attempt: number
/**
 * When this attempt was sent.
 */
attempted_at: string
}
/**
 * The send's current state when this attempt was made, with the same fields as GET /v1/sent-emails/{id}. Not a snapshot of when the event was created, and not this event's result.
 */
export interface SentEmailRecord {
/**
 * The sent email id. For mail relay sends there is no API call, and the id first appears in these events.
 */
id: string
/**
 * The send's overall status (open): queued, scheduled, submitted_to_agent, deferred, delivered, bounced, wait_timeout, unknown, agent_failed, gate_denied, canceled. Never a recipient's result.
 */
status: string
status_changed_at: string
created_at: string
/**
 * How the mail entered Primitive (open): api or mail_relay.
 */
source: string
from_address: string
to_addresses: (string[] | null)
/**
 * Null when the send had no Cc recipients.
 */
cc: (string[] | null)
/**
 * Null when the send had no Bcc recipients. On a mail relay send, every recipient no To or Cc header names.
 */
bcc: (string[] | null)
/**
 * Every recipient of the send, To, Cc and Bcc together, each address counted once. On a relay send, recipients the relay never received (mail kept inside the sender's own mail system) get no result events.
 */
recipient_count: (number | null)
subject: (string | null)
message_id: (string | null)
thread_id: (string | null)
/**
 * The tags given on the send request. Null or empty when there are none; relay sends carry none.
 */
tags: (SentEmailTag[] | null)
/**
 * The mail relay that took a relay send, or null for API sends.
 */
relay: (null | SentEmailRelay)
}
export interface SentEmailTag {
name: string
value: string
}
/**
 * The mail relay that took a relay send.
 */
export interface SentEmailRelay {
/**
 * The Primitive relay that took the message.
 */
hostname: string
via: "mail_relay"
}
/**
 * One recipient's final result: exactly one delivered or failed event per recipient, for the first 100 recipients.
 */
export interface SentEmailRecipientResultEvent {
/**
 * The event id. The same on every retry and at every endpoint, and equal to the X-Webhook-Id header. Deduplicate on it.
 */
id: string
event: ("sent_email.delivered" | "sent_email.failed")
/**
 * The version of the sent_email.* payload family. Not an event date.
 */
version: string
/**
 * When the event happened, as far as Primitive knows it: a result's time for result events, the last result's time for sent_email.completed.
 */
created_at: string
delivery: SentEmailEventDelivery
sent_email: SentEmailRecord
scope: "recipient"
recipient: SentEmailRecipient
outcome: SentEmailOutcome
}
export interface SentEmailRecipient {
address: string
type: SentEmailRecipientType
}
/**
 * This event's result.
 */
export interface SentEmailOutcome {
result: ("delivered" | "failed")
/**
 * Null when delivered.
 */
failure_kind: (null | SentEmailFailureKind)
smtp_response_code: (number | null)
smtp_enhanced_status_code: (string | null)
/**
 * Text from a third-party server: untrusted, never render it as HTML.
 */
smtp_response_text: (string | null)
/**
 * When the result was recorded.
 */
at: (string | null)
}
/**
 * Recipients past the first 100 (mail relay sends only). A failed roll-up lists the recipients it covers in recipients, each listed on exactly one failed roll-up; a delivered roll-up is a count, sent once every rolled-up recipient is final, and carries no recipients.
 */
export interface SentEmailRollupResultEvent {
/**
 * The event id. The same on every retry and at every endpoint, and equal to the X-Webhook-Id header. Deduplicate on it.
 */
id: string
event: ("sent_email.delivered" | "sent_email.failed")
/**
 * The version of the sent_email.* payload family. Not an event date.
 */
version: string
/**
 * When the event happened, as far as Primitive knows it: a result's time for result events, the last result's time for sent_email.completed.
 */
created_at: string
delivery: SentEmailEventDelivery
sent_email: SentEmailRecord
scope: "message"
recipient: null
recipient_count: number
reason: "rollup"
outcome: SentEmailRollupOutcome
/**
 * Present on failed roll-ups only: the recipients this roll-up covers.
 *
 * @minItems 1
 */
recipients?: [SentEmailRolledUpFailure, ...(SentEmailRolledUpFailure)[]]
}
/**
 * A roll-up's result. Roll-ups carry no SMTP answer.
 */
export interface SentEmailRollupOutcome {
result: ("delivered" | "failed")
/**
 * Null when delivered.
 */
failure_kind: (null | SentEmailFailureKind)
smtp_response_code: null
smtp_enhanced_status_code: null
smtp_response_text: null
/**
 * When the result was recorded.
 */
at: (string | null)
}
export interface SentEmailRolledUpFailure {
address: string
type: SentEmailRecipientType
smtp_response_code: (number | null)
smtp_enhanced_status_code: (string | null)
/**
 * Text from a third-party server: untrusted, never render it as HTML.
 */
smtp_response_text: (string | null)
at: (string | null)
}
/**
 * Only for sends recorded before Primitive kept each recipient's result: one result for the recipient_count recipients it covers.
 */
export interface SentEmailLegacyMessageResultEvent {
/**
 * The event id. The same on every retry and at every endpoint, and equal to the X-Webhook-Id header. Deduplicate on it.
 */
id: string
event: ("sent_email.delivered" | "sent_email.failed")
/**
 * The version of the sent_email.* payload family. Not an event date.
 */
version: string
/**
 * When the event happened, as far as Primitive knows it: a result's time for result events, the last result's time for sent_email.completed.
 */
created_at: string
delivery: SentEmailEventDelivery
sent_email: SentEmailRecord
scope: "message"
recipient: null
recipient_count: number
reason: "legacy_message_result"
outcome: SentEmailOutcome
}
/**
 * Once per send, after its last result event, when every recipient has a final result.
 */
export interface SentEmailCompletedEvent {
/**
 * The event id. The same on every retry and at every endpoint, and equal to the X-Webhook-Id header. Deduplicate on it.
 */
id: string
event: "sent_email.completed"
/**
 * The version of the sent_email.* payload family. Not an event date.
 */
version: string
/**
 * When the event happened, as far as Primitive knows it: a result's time for result events, the last result's time for sent_email.completed.
 */
created_at: string
delivery: SentEmailEventDelivery
sent_email: SentEmailRecord
summary: SentEmailCompletedSummary
}
/**
 * Totals over every recipient of the send: delivered + failed + not_relayed == recipient_count (when not_relayed is not null).
 */
export interface SentEmailCompletedSummary {
recipient_count: number
delivered: number
failed: number
failed_by_kind: SentEmailFailedByKind
/**
 * Mail relay sends: To or Cc recipients that never reached the relay because the mailbox provider delivered them internally. Primitive has no result for them. 0 for every other send. Null for a relay send recorded before Primitive kept the relay's envelope, when this cannot be known.
 */
not_relayed: (number | null)
/**
 * The not_relayed recipients. [] when there are none; null when not_relayed is null.
 */
not_relayed_recipients: (SentEmailRecipient[] | null)
}
export interface SentEmailFailedByKind {
rejected: number
expired: number
}
