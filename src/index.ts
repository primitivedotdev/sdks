/**
 * @primitivedotdev/sdk-node
 *
 * Official Primitive Node.js SDK — email parser, types, webhook verification.
 *
 * This root entry re-exports everything from the webhook SDK and parser.
 * Note: importing from this entry point will transitively load mailparser
 * and other parser dependencies. If you only need the webhook SDK, import
 * from `@primitivedotdev/sdk-node/webhook` instead.
 *
 * @packageDocumentation
 */

// Webhook SDK
export * from "./webhook/index.js";

// Parser
export * from "./parser/index.js";

// Shared types (re-export explicitly to avoid conflicts with webhook/index re-exports)
export type {
  EmailAddress,
  WebhookAttachment,
  ParsedData,
  ParsedDataComplete,
  ParsedDataFailed,
  ParsedError,
  RawContent,
  RawContentInline,
  RawContentDownloadOnly,
  EmailReceivedEvent,
  EmailAuth,
  EmailAnalysis,
  DkimSignature,
  DkimResult,
  SpfResult,
  DmarcResult,
  DmarcPolicy,
  AuthVerdict,
  AuthConfidence,
  ForwardVerdict,
  ValidateEmailAuthResult,
  ForwardVerification,
  ForwardOriginalSender,
  ForwardResult,
  ForwardResultInline,
  ForwardResultAttachmentAnalyzed,
  ForwardResultAttachmentSkipped,
  ForwardAnalysis,
  EventType,
  KnownWebhookEvent,
  WebhookEvent,
  UnknownEvent,
  ParsedStatus,
} from "./types.js";
