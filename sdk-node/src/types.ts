/**
 * Primitive webhook event types derived from the canonical JSON schema.
 *
 * @packageDocumentation
 */

import type { EmailReceivedEvent as GeneratedEmailReceivedEvent } from "./types.generated.js";

export type EmailReceivedEvent = GeneratedEmailReceivedEvent;

export type EventType = EmailReceivedEvent["event"];

export const EventType = {
  EmailReceived: "email.received",
} as const satisfies Record<string, EventType>;

export type RawContent = EmailReceivedEvent["email"]["content"]["raw"];

export type RawContentInline = Extract<RawContent, { included: true }>;

export type RawContentDownloadOnly = Extract<RawContent, { included: false }>;

export type ParsedData = EmailReceivedEvent["email"]["parsed"];

export type ParsedDataComplete = Extract<ParsedData, { status: "complete" }>;

export type ParsedDataFailed = Extract<ParsedData, { status: "failed" }>;

export type ParsedStatus = ParsedData["status"];

export const ParsedStatus = {
  Complete: "complete",
  Failed: "failed",
} as const satisfies Record<string, ParsedStatus>;

export type ParsedError = ParsedDataFailed["error"];

export type EmailAddress = NonNullable<ParsedDataComplete["reply_to"]>[number];

export type WebhookAttachment = ParsedDataComplete["attachments"][number];

export type EmailAnalysis = EmailReceivedEvent["email"]["analysis"];

export type ForwardAnalysis = NonNullable<EmailAnalysis["forward"]>;

export type ForwardResult = ForwardAnalysis["results"][number];

export type ForwardResultInline = Extract<ForwardResult, { type: "inline" }>;

export type ForwardResultAttachmentAnalyzed = Extract<
  ForwardResult,
  { type: "attachment"; analyzed: true }
>;

export type ForwardResultAttachmentSkipped = Extract<
  ForwardResult,
  { type: "attachment"; analyzed: false }
>;

export type ForwardOriginalSender = NonNullable<
  ForwardResultInline["original_sender"]
>;

export type ForwardVerification = NonNullable<
  ForwardResultInline["verification"]
>;

export type ForwardVerdict = ForwardVerification["verdict"];

export const ForwardVerdict = {
  Legit: "legit",
  Unknown: "unknown",
} as const satisfies Record<string, ForwardVerdict>;

export type EmailAuth = EmailReceivedEvent["email"]["auth"];

export type DkimSignature = EmailAuth["dkimSignatures"][number];

export type SpfResult = EmailAuth["spf"];

export const SpfResult = {
  Pass: "pass",
  Fail: "fail",
  Softfail: "softfail",
  Neutral: "neutral",
  None: "none",
  Temperror: "temperror",
  Permerror: "permerror",
} as const satisfies Record<string, SpfResult>;

export type DmarcResult = EmailAuth["dmarc"];

export const DmarcResult = {
  Pass: "pass",
  Fail: "fail",
  None: "none",
  Temperror: "temperror",
  Permerror: "permerror",
} as const satisfies Record<string, DmarcResult>;

export type DmarcPolicy = EmailAuth["dmarcPolicy"];

export const DmarcPolicy = {
  Reject: "reject",
  Quarantine: "quarantine",
  None: "none",
} as const satisfies Record<string, Exclude<DmarcPolicy, null>>;

export type DkimResult = DkimSignature["result"];

export const DkimResult = {
  Pass: "pass",
  Fail: "fail",
  Temperror: "temperror",
  Permerror: "permerror",
} as const satisfies Record<string, DkimResult>;

export type AuthConfidence = ForwardVerification["confidence"];

export const AuthConfidence = {
  High: "high",
  Medium: "medium",
  Low: "low",
} as const satisfies Record<string, AuthConfidence>;

export type AuthVerdict = "legit" | "suspicious" | "unknown";

export const AuthVerdict = {
  Legit: "legit",
  Suspicious: "suspicious",
  Unknown: "unknown",
} as const satisfies Record<string, AuthVerdict>;

export interface ValidateEmailAuthResult {
  verdict: AuthVerdict;
  confidence: AuthConfidence;
  reasons: string[];
}

export interface UnknownEvent {
  event: string;
  id?: string;
  version?: string;
  [key: string]: unknown;
}

export type KnownWebhookEvent = EmailReceivedEvent;

export type WebhookEvent = KnownWebhookEvent | UnknownEvent;
