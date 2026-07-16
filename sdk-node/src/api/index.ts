/**
 * Primitive API client module.
 *
 * The generated API surface (operations, types, host-aware client,
 * shared error type) lives in the workspace-internal
 * `@primitivedotdev/api-core` package. The bundler inlines that
 * code into the published `@primitivedotdev/sdk` tarball, so
 * consumers see a single package; the split exists only to keep
 * sdk-node and cli-node decoupled at the source level.
 *
 * This module re-exports the api-core surface and adds the
 * higher-level `PrimitiveClient` (send / reply / forward) on top.
 * Those high-level methods depend on the parsed `ReceivedEmail`
 * shape from sdk-node's webhook module, which is why they live
 * here rather than in api-core.
 */

import { readFile, stat } from "node:fs/promises";
import {
  type AgentAccountResult,
  type AgentClaimLinkResult,
  type AgentClaimResult,
  type AgentClaimStartResult,
  type CreateAgentAccountInput,
  type CreateAgentClaimLinkInput,
  type GateDenial,
  type Account as GeneratedAccount,
  type DeleteMemoryData as GeneratedDeleteMemoryData,
  type DeleteMemoryResult as GeneratedDeleteMemoryResult,
  type EmailStatus as GeneratedEmailStatus,
  type EmailSummary as GeneratedEmailSummary,
  type ErrorResponse as GeneratedErrorResponse,
  type GetMemoryData as GeneratedGetMemoryData,
  type MemoryRecord as GeneratedMemoryRecord,
  type MemoryRecordWithValue as GeneratedMemoryRecordWithValue,
  type PaginationMeta as GeneratedPaginationMeta,
  type ReplyInput as GeneratedReplyInput,
  type SearchMemoriesData as GeneratedSearchMemoriesData,
  type SemanticSearchInput as GeneratedSemanticSearchInput,
  type SemanticSearchMeta as GeneratedSemanticSearchMeta,
  type SemanticSearchResult as GeneratedSemanticSearchResult,
  type SendMailAttachment as GeneratedSendMailAttachment,
  type SendMailInput as GeneratedSendMailInput,
  type SendMailResult as GeneratedSendMailResult,
  type SetMemoryInput as GeneratedSetMemoryInput,
  operations as generatedOperations,
  isMemoryJsonValue,
  PrimitiveApiClient,
  type PrimitiveApiClientOptions,
  PrimitiveApiError,
  type PrimitiveApiErrorDetails,
  type StartAgentClaimInput,
  type VerifyAgentClaimInput,
} from "@primitivedotdev/api-core";
import { type PushResult, pushBytes, pushFile } from "../payloads/index.js";
import type { ReceivedEmail } from "../webhook/received-email.js";
import { formatAddress } from "../webhook/received-email.js";

// EmailReceivedEvent is the parsed JSON shape Functions handlers
// receive in `await req.json()`. Re-exported from `/api` (Workers-safe)
// so scaffolded handlers can type the request body without importing
// from `@primitivedotdev/sdk` root or `/webhook` (both of which pull
// node:crypto via the Node-crypto signing helpers).
export type { EmailReceivedEvent, ValidateEmailAuthResult } from "../types.js";
// NOTE: the webhook-shaped `EmailAuth` type is deliberately NOT
// re-exported here. The `export *` from api-core below already exports
// a generated `EmailAuth` (the REST email-detail auth shape), and an
// explicit re-export would shadow it and change the type existing
// `/api` imports resolve to.
export { AuthConfidence, AuthVerdict } from "../types.js";
// Email-auth verdict computation and the domain-anchored trust check
// (isTrustedSender below), re-exported from the Workers-safe `/api`
// subpath for the same reason as `normalizeReceivedEmail`: Functions
// handlers import from
// `/api` only (the root and `/webhook` entries pull `node:crypto`), and
// deciding whether to trust an inbound email is core handler logic.
// Both modules import only types and the pure address parser, so they
// are safe in Workers-style bundles.
export { validateEmailAuth } from "../webhook/auth.js";
// Re-export the inbound-email normalizer and its types from the
// Workers-safe `/api` subpath so handler authors can pass the inbound
// event into `client.reply()` without importing from
// `@primitivedotdev/sdk` (root) or `@primitivedotdev/sdk/webhook`,
// either of which pulls `node:crypto` (via `handleWebhook` and the
// Node-crypto signing helpers in the webhook entry) and breaks
// Workers-style bundles. The function and its types live in
// `webhook/received-email.ts` purely for proximity to other
// inbound-shape helpers; the file itself has no node:crypto
// dependency, so re-exporting it here is safe.
export type {
  ReceivedEmail,
  ReceivedEmailAddress,
  ReceivedEmailThread,
} from "../webhook/received-email.js";
export { normalizeReceivedEmail } from "../webhook/received-email.js";
export {
  isTrustedSender,
  type TrustedSenderOptions,
  type TrustedSenderResult,
  type TrustReason,
} from "../webhook/trust.js";

// Domain is dot-separated labels (each label excludes '.', '@', whitespace) so
// the quantifiers don't overlap — a plain `[^\s@]+\.[^\s@]+` is a polynomial
// ReDoS on inputs with many dots.
const EMAIL_REGEX = /^[^\s@]+@[^\s.@]+(?:\.[^\s.@]+)+$/;
const MAX_THREAD_REFERENCES = 100;
const MAX_THREAD_HEADER_BYTES = 8 * 1024;
const MAX_FROM_HEADER_LENGTH = 998;
const MAX_TO_HEADER_LENGTH = 320;

function validateAddressHeader(field: "from" | "to", value: string): void {
  const trimmed = value.trim();
  const maxLength =
    field === "from" ? MAX_FROM_HEADER_LENGTH : MAX_TO_HEADER_LENGTH;

  if (trimmed.length < 3) {
    throw new TypeError(`${field} must be at least 3 characters`);
  }
  if (trimmed.length > maxLength) {
    throw new TypeError(`${field} must be at most ${maxLength} characters`);
  }
}

function validateEmailAddress(field: "to", value: string): void {
  if (
    !EMAIL_REGEX.test(value) &&
    // Display-name form: `Name <addr>`. `[^<]+` (not `.+`) before the bracket
    // and the same dot-separated-domain shape keep this ReDoS-free.
    !/^[^<]+<[^\s@]+@[^\s.@]+(?:\.[^\s.@]+)+>$/.test(value)
  ) {
    throw new TypeError(`${field} must be a valid email address`);
  }
}

export interface SendThreadInput {
  inReplyTo?: string;
  references?: string[];
}

export type SendAttachment = GeneratedSendMailAttachment;

/**
 * A reference to an already-uploaded Primitive Payloads object, delivered as an
 * attachment without inlining the bytes — the way to send an attachment larger
 * than the inline cap. Upload the object with `payloads.pushFile` / `pushBytes`
 * (client-held CEK), then reference it here. Prefer {@link PrimitiveClient.sendAttachment},
 * which picks inline-vs-reference by size for you.
 */
export interface SendPayloadReference {
  /** 64-char lowercase-hex Merkle root of the finalized object (`PushResult.merkleRoot`). */
  root: string;
  /** Filename presented to the recipient. */
  filename: string;
  /** Optional MIME content type. */
  contentType?: string;
  /**
   * Base64url-encoded (unpadded) content-encryption key the recipient uses to
   * decrypt. Note `PushResult.cek` is hex — convert with
   * `Buffer.from(cek, "hex").toString("base64url")`.
   */
  cek: string;
}

export interface SendInput {
  from: string;
  to: string;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  thread?: SendThreadInput;
  /** Inline attachments (base64 content). Combined raw bytes must stay under the inline cap (~30 MiB). */
  attachments?: SendAttachment[];
  /** Deliver already-uploaded payloads objects by reference (v1: at most one). No size ceiling. */
  payloadAttachments?: SendPayloadReference[];
  wait?: boolean;
  waitTimeoutMs?: number;
}

/** Attachments at or below this size are sent inline; larger ones are uploaded + referenced. */
const DEFAULT_INLINE_ATTACHMENT_MAX = 25 * 1024 * 1024;

/**
 * Input for {@link PrimitiveClient.sendAttachment}: the normal send fields plus
 * one attachment, given as in-memory `content` OR a file `path`. The SDK sends
 * it inline when it's small and uploads-then-references it when it's large, so
 * the caller never has to choose the mechanism. Provide exactly one of
 * `content` / `path`.
 */
export type SendAttachmentInput = Omit<
  SendInput,
  "attachments" | "payloadAttachments"
> & {
  attachment: {
    filename: string;
    contentType?: string;
    /** In-memory bytes. Use `path` for large files that shouldn't be resident. */
    content?: Uint8Array;
    /** Path to a file streamed from disk (bounded memory) — for large attachments. */
    path?: string;
  };
  /**
   * Size at or below which the attachment goes inline; larger ones are uploaded
   * as an E2E-encrypted payloads object and delivered by reference. Defaults to
   * 25 MiB (the server's inline/offload threshold).
   */
  inlineThreshold?: number;
};

export interface RequestOptions {
  /** Cancel the in-flight request when this signal fires. Surfaces as AbortError. */
  signal?: AbortSignal;
  /** Per-call timeout in milliseconds. Composed with `signal` via AbortSignal.any so either fires AbortError. */
  timeout?: number;
  /** Per-call headers merged on top of client-level headers. Last write wins. */
  headers?: Record<string, string>;
  /** Idempotency key for safe retries. Sent as the Idempotency-Key request header. */
  idempotencyKey?: string;
}

/**
 * Input shape for `client.reply(email, input)`.
 *
 * Can be a bare string (treated as `text`) or an object. The reply
 * operation calls the server's `/emails/{id}/reply` endpoint, which
 * derives recipients, subject (`Re: <parent>`), and threading headers
 * from the inbound row. The shape here is the small subset of fields
 * the customer can still control:
 *
 * - `text` / `html`: the reply body. At least one is required.
 * - `from`: optional override for the From header. Defaults server-
 *   side to the address that received the inbound. Use to add a
 *   display name (`"Acme Support" <agent@company.com>`) or to reply
 *   from a different verified outbound address. The from-domain must
 *   be a verified outbound domain for your org.
 * - `attachments`: optional inline MIME attachments, using base64
 *   content. The SDK routes replies to the attachment-capable host.
 * - `wait`: when true, wait for the first downstream SMTP delivery
 *   outcome before resolving. Mirrors send-mail's `wait` semantics.
 *
 * `subject` is intentionally not accepted: a custom subject silently
 * breaks Gmail's threading because Gmail's Conversation View requires
 * both a References match and a normalized-subject match. Always
 * sends `Re: <parent>` with idempotent prefixing.
 */
export type ReplyInput =
  | string
  | {
      text?: string;
      html?: string;
      from?: string;
      attachments?: SendAttachment[];
      wait?: boolean;
    };

export interface ForwardInput {
  to: string;
  bodyText?: string;
  subject?: string;
  from?: string;
}

export interface SendResult {
  id: string;
  status: GeneratedSendMailResult["status"];
  /**
   * The bare from-address actually written on the wire. Load-bearing on the
   * server-derived reply path, where `from` is derived from the inbound rather
   * than anything the caller passed.
   */
  from: string;
  queueId: string | null;
  accepted: string[];
  rejected: string[];
  clientIdempotencyKey: string;
  requestId: string;
  contentHash: string;
  /**
   * True when the response replays a previously-recorded send keyed by
   * `clientIdempotencyKey` (same key, same canonical payload). False on
   * a fresh send and on gate-denied responses.
   */
  idempotentReplay: boolean;
  deliveryStatus?: GeneratedSendMailResult["delivery_status"];
  smtpResponseCode?: number | null;
  smtpResponseText?: string;
}

/**
 * Page of semantic-search results plus pagination meta. Returned by
 * `PrimitiveClient.semanticSearch`. `data` is the ranked rows (newest
 * tiebreak first within equal scores); `meta.cursor` is non-null when
 * there's another page.
 */
export interface SemanticSearchResponse {
  data: GeneratedSemanticSearchResult[];
  meta: GeneratedSemanticSearchMeta;
}

export type MemoryJsonValue =
  | null
  | string
  | number
  | boolean
  | MemoryJsonValue[]
  | { [key: string]: MemoryJsonValue };
export type MemorySetInput = Omit<GeneratedSetMemoryInput, "value"> & {
  value: MemoryJsonValue;
};
export type MemoryGetInput = GeneratedGetMemoryData["query"];
export type MemoryDeleteInput = GeneratedDeleteMemoryData["query"];
export type MemoryRecord = Omit<GeneratedMemoryRecord, "value"> & {
  value?: MemoryJsonValue;
};
export type MemoryRecordWithValue = Omit<
  GeneratedMemoryRecordWithValue,
  "value"
> & {
  value: MemoryJsonValue;
};

export type MemorySearchInput = Omit<
  NonNullable<GeneratedSearchMemoriesData["query"]>,
  "include_value"
> & {
  /**
   * Return memory values with each record. Defaults to true. Use false for
   * metadata-only key scans.
   */
  includeValue?: boolean;
  /**
   * Wire-compatible spelling for callers that already use generated query
   * field names. Boolean values are accepted for convenience and normalized
   * to the API's `"true"` / `"false"` strings.
   */
  include_value?: "true" | "false" | boolean;
};

export interface MemorySearchResponse {
  data: Array<GeneratedMemoryRecord | GeneratedMemoryRecordWithValue>;
  meta: GeneratedPaginationMeta;
}

function validateThreadHeaderValue(field: string, value: string): void {
  if (value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  if (
    [...value].some((char) => {
      const code = char.charCodeAt(0);
      return code <= 0x1f || code === 0x7f;
    })
  ) {
    throw new TypeError(`${field} must not contain control characters`);
  }
  if (value.length > 998) {
    throw new TypeError(`${field} must be at most 998 characters`);
  }
}

function validateSendInput(input: SendInput): void {
  validateAddressHeader("from", input.from);
  validateAddressHeader("to", input.to);
  validateEmailAddress("to", input.to);

  if (input.subject.trim().length === 0) {
    throw new TypeError("subject must be a non-empty string");
  }

  if (!input.bodyText && !input.bodyHtml) {
    throw new TypeError("one of bodyText or bodyHtml is required");
  }

  if (input.thread?.inReplyTo) {
    validateThreadHeaderValue("thread.inReplyTo", input.thread.inReplyTo);
  }

  if (input.thread?.references) {
    if (input.thread.references.length > MAX_THREAD_REFERENCES) {
      throw new TypeError(
        `thread.references must contain at most ${MAX_THREAD_REFERENCES} values`,
      );
    }
    for (const [index, reference] of input.thread.references.entries()) {
      validateThreadHeaderValue(`thread.references[${index}]`, reference);
    }
    if (input.thread.references.join(" ").length > MAX_THREAD_HEADER_BYTES) {
      throw new TypeError(
        `thread.references header must be at most ${MAX_THREAD_HEADER_BYTES} characters`,
      );
    }
  }

  if (input.waitTimeoutMs !== undefined) {
    if (!Number.isInteger(input.waitTimeoutMs)) {
      throw new TypeError("waitTimeoutMs must be an integer");
    }
    if (input.waitTimeoutMs < 1000 || input.waitTimeoutMs > 30000) {
      throw new TypeError("waitTimeoutMs must be between 1000 and 30000");
    }
  }
}

function validateForwardInput(input: ForwardInput): void {
  validateEmailAddress("to", input.to);

  if (input.subject !== undefined && input.subject.trim().length === 0) {
    throw new TypeError("subject must be a non-empty string");
  }
}

function isAbortLikeError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "AbortError" || error.name === "TimeoutError";
}

function parseRetryAfterHeader(
  response: Response | undefined,
): number | undefined {
  if (!response) return undefined;
  const raw = response.headers.get("retry-after");
  if (!raw) return undefined;
  const seconds = Number.parseInt(raw, 10);
  return Number.isFinite(seconds) ? seconds : undefined;
}

interface ParsedApiError {
  message: string;
  code: string | undefined;
  gates: GateDenial[] | undefined;
  requestId: string | undefined;
  details: PrimitiveApiErrorDetails | undefined;
}

function parseApiErrorPayload(payload: unknown): ParsedApiError {
  const fallback: ParsedApiError = {
    message: "Primitive API request failed",
    code: undefined,
    gates: undefined,
    requestId: undefined,
    details: undefined,
  };

  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  if (
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object"
  ) {
    const err = payload.error as {
      message?: unknown;
      code?: unknown;
      gates?: unknown;
      request_id?: unknown;
      details?: unknown;
    };
    return {
      message: typeof err.message === "string" ? err.message : fallback.message,
      code: typeof err.code === "string" ? err.code : undefined,
      gates: Array.isArray(err.gates) ? (err.gates as GateDenial[]) : undefined,
      requestId:
        typeof err.request_id === "string" ? err.request_id : undefined,
      details:
        err.details && typeof err.details === "object"
          ? (err.details as PrimitiveApiErrorDetails)
          : undefined,
    };
  }

  if ("message" in payload && typeof payload.message === "string") {
    return { ...fallback, message: payload.message };
  }

  return fallback;
}

export type PrimitiveClientOptions = PrimitiveApiClientOptions;

interface ResolvedRequestOptions {
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

function resolveRequestOptions(
  options: RequestOptions | undefined,
): ResolvedRequestOptions {
  const signals: AbortSignal[] = [];
  if (options?.signal) signals.push(options.signal);
  if (options?.timeout !== undefined) {
    signals.push(AbortSignal.timeout(options.timeout));
  }

  const signal =
    signals.length === 0
      ? undefined
      : signals.length === 1
        ? signals[0]
        : AbortSignal.any(signals);

  const headers: Record<string, string> = {
    ...(options?.headers ?? {}),
    ...(options?.idempotencyKey
      ? { "Idempotency-Key": options.idempotencyKey }
      : {}),
  };

  const resolved: ResolvedRequestOptions = {};
  if (signal) resolved.signal = signal;
  if (Object.keys(headers).length > 0) resolved.headers = headers;
  return resolved;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function rejectGeneratedOptionsShape(
  value: unknown,
  method: "set" | "get" | "delete" | "search",
): void {
  if (!isRecord(value)) return;
  if ("client" in value || "body" in value || "query" in value) {
    const example =
      method === "set"
        ? "client.memories.set({ key, value })"
        : method === "search"
          ? "client.memories.search({ prefix })"
          : `client.memories.${method}({ key })`;
    throw new TypeError(
      `client.memories.${method} takes the memory fields directly; use ${example}, not the generated operation options shape.`,
    );
  }
}

function assertMemoryJsonValue(
  value: unknown,
): asserts value is MemoryJsonValue {
  if (isMemoryJsonValue(value)) return;
  throw new TypeError(
    "client.memories.set value must be a JSON value: string, finite number, boolean, null, array, or plain object. Undefined, bigint, symbol, function, NaN, Infinity, sparse arrays, class instances, and cyclic values are not valid memory values.",
  );
}

function assertMemorySetInput(input: unknown): asserts input is MemorySetInput {
  if (!isRecord(input)) {
    throw new TypeError(
      "client.memories.set takes the memory fields directly; use client.memories.set({ key, value }).",
    );
  }
  if (!("value" in input)) {
    throw new TypeError("client.memories.set requires a value field.");
  }
  assertMemoryJsonValue(input.value);
}

function assertMemoryQueryInput(
  input: unknown,
  method: "get" | "delete" | "search",
): asserts input is Record<string, unknown> {
  if (isRecord(input)) return;
  const example =
    method === "search"
      ? "client.memories.search({ prefix })"
      : `client.memories.${method}({ key })`;
  throw new TypeError(
    `client.memories.${method} takes the memory fields directly; use ${example}.`,
  );
}

function normalizeMemorySearchInput(
  input: MemorySearchInput | undefined,
): GeneratedSearchMemoriesData["query"] {
  if (input === undefined) return undefined;
  assertMemoryQueryInput(input, "search");
  if (isRecord(input) && "query" in input) {
    if (typeof input.query !== "string") {
      rejectGeneratedOptionsShape(input, "search");
    }
    throw new TypeError(
      "client.memories.search is key-prefix search; pass { prefix } directly. For free-text mail search, use client.semanticSearch(...).",
    );
  }
  rejectGeneratedOptionsShape(input, "search");

  const { includeValue, include_value, ...rest } = input;
  const normalized: NonNullable<GeneratedSearchMemoriesData["query"]> = {
    ...rest,
  };
  const includeValueRaw =
    include_value !== undefined ? include_value : includeValue;
  if (includeValueRaw !== undefined) {
    normalized.include_value =
      typeof includeValueRaw === "boolean"
        ? includeValueRaw
          ? "true"
          : "false"
        : includeValueRaw;
  }
  return normalized;
}

/**
 * Generic `{ success, data }` envelope unwrap for the simple
 * data-returning agent operations. Mirrors the error-mapping path of
 * `unwrapSendResult` so every agent call surfaces a `PrimitiveApiError`
 * with code / status / request id / retry-after, and re-throws abort and
 * timeout errors untouched. `label` names the resource in the
 * empty-body error message.
 */
function unwrapData<T>(
  result: {
    data?: { data?: T } | undefined;
    error?: GeneratedErrorResponse | unknown;
    response?: Response;
  },
  label: string,
): T {
  const response = (result as { response?: Response }).response;

  if (result.error) {
    if (isAbortLikeError(result.error)) {
      throw result.error;
    }
    const parsed = parseApiErrorPayload(result.error);
    throw new PrimitiveApiError(parsed.message, {
      payload: result.error,
      status: response?.status,
      code: parsed.code,
      gates: parsed.gates,
      requestId: parsed.requestId,
      retryAfter: parseRetryAfterHeader(response),
      details: parsed.details,
      cause: result.error instanceof Error ? result.error : undefined,
    });
  }

  if (result.data?.data === undefined) {
    throw new PrimitiveApiError(`Primitive API returned no ${label}`, {
      payload: result,
      status: response?.status,
    });
  }

  return result.data.data;
}

/**
 * Agent-account operations, grouped under `client.agent`.
 *
 * These cover the emailless agent lifecycle: create a zero-touch account
 * (no auth required), then later upgrade it to a full developer account by
 * confirming an email (the claim flow, authenticated by the agent's own
 * API key). Field shapes are the generated request/response types, matching
 * the documented API surface.
 */
export class AgentResource {
  constructor(private readonly client: PrimitiveApiClient["client"]) {}

  /**
   * Create an emailless agent account. Unauthenticated: call this on a
   * client constructed without an API key. Returns a one-time `api_key`
   * (prefixed `prim_`, shown once) plus a provisioned managed inbox. The
   * account is on the reply-only `agent` plan and can be upgraded later via
   * the claim flow.
   */
  async createAccount(
    input: CreateAgentAccountInput,
    options?: RequestOptions,
  ): Promise<AgentAccountResult> {
    const result = await generatedOperations.createAgentAccount({
      body: input,
      ...resolveRequestOptions(options),
      client: this.client,
      responseStyle: "fields",
    });
    return unwrapData<AgentAccountResult>(result, "agent account");
  }

  /**
   * Start the email-claim upgrade for the authenticated agent account.
   * Sends a verification code to `email` and returns the claim session id
   * plus resend timing. Authenticated by the agent's own API key.
   */
  async claimStart(
    input: StartAgentClaimInput,
    options?: RequestOptions,
  ): Promise<AgentClaimStartResult> {
    const result = await generatedOperations.startAgentClaim({
      body: input,
      ...resolveRequestOptions(options),
      client: this.client,
      responseStyle: "fields",
    });
    return unwrapData<AgentClaimStartResult>(result, "claim start result");
  }

  /**
   * Confirm the claim verification code and upgrade the account to the
   * `developer` plan. The org id, API key, and managed inbox carry over;
   * the send cap lifts.
   */
  async claimVerify(
    input: VerifyAgentClaimInput,
    options?: RequestOptions,
  ): Promise<AgentClaimResult> {
    const result = await generatedOperations.verifyAgentClaim({
      body: input,
      ...resolveRequestOptions(options),
      client: this.client,
      responseStyle: "fields",
    });
    return unwrapData<AgentClaimResult>(result, "claim result");
  }

  /**
   * Mint a browser claim link to hand to a human for the email-confirmation
   * upgrade. `claim_url` is null when the API host has no web origin to
   * build the link.
   */
  async claimLink(
    input: CreateAgentClaimLinkInput = {},
    options?: RequestOptions,
  ): Promise<AgentClaimLinkResult> {
    const result = await generatedOperations.createAgentClaimLink({
      body: input,
      ...resolveRequestOptions(options),
      client: this.client,
      responseStyle: "fields",
    });
    return unwrapData<AgentClaimLinkResult>(result, "claim link result");
  }
}

// A `since` cursor strictly before any real row, used when a caller streams the
// inbox without supplying a starting cursor: the stream then yields the org's
// inbound mail oldest-first and tails new arrivals. (To process only mail that
// arrives from now on, persist a cursor and pass it as `since`.)
const INBOX_EPOCH_CURSOR =
  "1970-01-01T00:00:00.000000Z|00000000-0000-0000-0000-000000000000";
const DEFAULT_WAIT_SECONDS = 30;

/**
 * One inbound email from the forward tail, plus the cursor positioned just
 * after it and a bound `reply()`. Persist `cursor` after processing to resume
 * the stream exactly where you left off; the stream advances one email at a
 * time, so the cursor is per-email exact.
 */
export interface InboundEmail {
  id: string;
  messageId: string | null;
  /** SMTP envelope sender (return-path) of the inbound mail. */
  from: string;
  to: string;
  subject: string | null;
  status: GeneratedEmailStatus;
  domain: string;
  spamScore: number | null;
  threadId: string | null;
  createdAt: string;
  receivedAt: string;
  /** Forward-tail cursor positioned just after this email (persist to resume). */
  cursor: string;
  /** Reply to this email. Reply-only agents may reply to senders that mailed them. */
  reply(input: ReplyInput, options?: RequestOptions): Promise<SendResult>;
}

export interface InboxStreamOptions {
  /** Resume cursor. Omit to stream from the beginning (oldest-first) then tail. */
  since?: string;
  /** Per-request long-poll hold in seconds (1-30). Default 30. */
  waitSeconds?: number;
  /** Stop the stream when this fires. */
  signal?: AbortSignal;
}

export interface WaitForNextOptions {
  since?: string;
  waitSeconds?: number;
  signal?: AbortSignal;
}

function buildReplyBody(input: ReplyInput): GeneratedReplyInput {
  const resolved = typeof input === "string" ? { text: input } : input;
  // Reject a subject override loudly (mirrors PrimitiveClient.reply): a custom
  // subject silently breaks Gmail threading, so it is never accepted.
  if ("subject" in resolved) {
    throw new TypeError(
      "reply does not support a subject override; the server prepends 'Re:' to the parent's subject for thread continuity",
    );
  }
  if (!resolved.text && !resolved.html) {
    throw new TypeError("reply requires text or html");
  }
  return {
    ...(resolved.text !== undefined ? { body_text: resolved.text } : {}),
    ...(resolved.html !== undefined ? { body_html: resolved.html } : {}),
    ...(resolved.from !== undefined ? { from: resolved.from } : {}),
    ...(resolved.attachments !== undefined
      ? { attachments: resolved.attachments }
      : {}),
    ...(resolved.wait !== undefined ? { wait: resolved.wait } : {}),
  };
}

async function replyById(
  client: PrimitiveApiClient["client"],
  id: string,
  input: ReplyInput,
  options?: RequestOptions,
): Promise<SendResult> {
  const result = await generatedOperations.replyToEmail({
    body: buildReplyBody(input),
    path: { id },
    ...resolveRequestOptions(options),
    client,
    responseStyle: "fields",
  });
  return unwrapSendResult(result);
}

function toInboundEmail(
  row: GeneratedEmailSummary,
  cursor: string,
  client: PrimitiveApiClient["client"],
): InboundEmail {
  return {
    id: row.id,
    messageId: row.message_id ?? null,
    from: row.sender,
    to: row.recipient,
    subject: row.subject ?? null,
    status: row.status,
    domain: row.domain,
    spamScore: row.spam_score ?? null,
    threadId: row.thread_id ?? null,
    createdAt: row.created_at,
    receivedAt: row.received_at,
    cursor,
    reply: (input, options) => replyById(client, row.id, input, options),
  };
}

/** Unwrap a `listEmails` page into rows + the next forward-tail cursor. */
function unwrapInboxPage(result: {
  data?:
    | { data?: GeneratedEmailSummary[]; meta?: { cursor?: string | null } }
    | undefined;
  error?: GeneratedErrorResponse | unknown;
  response?: Response;
}): { emails: GeneratedEmailSummary[]; cursor: string | null } {
  const response = (result as { response?: Response }).response;
  if (result.error) {
    if (isAbortLikeError(result.error)) throw result.error;
    const parsed = parseApiErrorPayload(result.error);
    throw new PrimitiveApiError(parsed.message, {
      payload: result.error,
      status: response?.status,
      code: parsed.code,
      gates: parsed.gates,
      requestId: parsed.requestId,
      retryAfter: parseRetryAfterHeader(response),
      details: parsed.details,
      cause: result.error instanceof Error ? result.error : undefined,
    });
  }
  return {
    emails: result.data?.data ?? [],
    cursor: result.data?.meta?.cursor ?? null,
  };
}

/**
 * Inbound mail, grouped under `client.inbox`. Wraps the GET /v1/emails forward
 * tail (`?since` + `?wait` long-poll) so an agent's receive loop is a single
 * `for await`, with the cursor advanced for you.
 */
export class InboxResource {
  constructor(private readonly client: PrimitiveApiClient["client"]) {}

  /**
   * Stream inbound emails as they arrive. Long-polls the forward tail, yielding
   * one email at a time and advancing the cursor. Resumes from `since` (omit to
   * start oldest-first); stops when `signal` aborts.
   *
   *   for await (const email of client.inbox.stream()) {
   *     await email.reply("got it");
   *   }
   */
  async *stream(
    options: InboxStreamOptions = {},
  ): AsyncGenerator<InboundEmail, void, void> {
    let since = options.since ?? INBOX_EPOCH_CURSOR;
    const wait = options.waitSeconds ?? DEFAULT_WAIT_SECONDS;
    while (!options.signal?.aborted) {
      const result = await generatedOperations.listEmails({
        // limit 1 makes each page exactly one email, so meta.cursor is the
        // per-email resume position (yielded as email.cursor).
        query: { since, wait, limit: 1 },
        ...resolveRequestOptions({ signal: options.signal }),
        client: this.client,
        responseStyle: "fields",
      });
      const { emails, cursor } = unwrapInboxPage(result);
      // The forward tail always returns a cursor when it returns rows. Guard
      // the contract: a null cursor with rows would leave `since` unadvanced,
      // re-fetching and re-yielding the same mail forever. Fail loudly instead.
      if (emails.length > 0 && cursor === null) {
        throw new PrimitiveApiError(
          "Forward tail returned emails without a continuation cursor; refusing to advance to avoid re-yielding the same mail.",
          { payload: result },
        );
      }
      for (const row of emails) {
        // cursor is non-null here (guarded above when emails is non-empty).
        yield toInboundEmail(row, cursor ?? since, this.client);
      }
      // Advance past what we yielded; an empty page (caught up) loops and
      // re-issues the long-poll, which blocks until the next arrival.
      if (cursor) since = cursor;
    }
  }

  /**
   * Resolve with the next inbound email after `since`, or null if none arrives
   * within the wait window. One-shot form of `stream`; pass your current cursor
   * as `since` to wait for genuinely new mail.
   */
  async waitForNext(
    options: WaitForNextOptions = {},
  ): Promise<InboundEmail | null> {
    const since = options.since ?? INBOX_EPOCH_CURSOR;
    const wait = options.waitSeconds ?? DEFAULT_WAIT_SECONDS;
    const result = await generatedOperations.listEmails({
      query: { since, wait, limit: 1 },
      ...resolveRequestOptions({ signal: options.signal }),
      client: this.client,
      responseStyle: "fields",
    });
    const { emails, cursor } = unwrapInboxPage(result);
    if (emails.length === 0) return null;
    // A row with no cursor would make a caller persisting email.cursor re-fetch
    // the same email on its next call. Surface the contract break instead.
    if (cursor === null) {
      throw new PrimitiveApiError(
        "Forward tail returned an email without a continuation cursor.",
        { payload: result },
      );
    }
    return toInboundEmail(emails[0], cursor, this.client);
  }
}

/** Account introspection, grouped under `client.account`. */
export class AccountResource {
  constructor(private readonly client: PrimitiveApiClient["client"]) {}

  /**
   * The authenticated account: plan, limits, granted `entitlements` (e.g. an
   * emailless agent sees only reply-only keys), and `managed_inbox_address`
   * (the From address to reply as).
   */
  async get(options?: RequestOptions): Promise<GeneratedAccount> {
    const result = await generatedOperations.getAccount({
      ...resolveRequestOptions(options),
      client: this.client,
      responseStyle: "fields",
    });
    return unwrapData<GeneratedAccount>(result, "account");
  }
}

/**
 * Durable JSON key-value state, grouped under `client.memories`.
 *
 * This wraps the generated `setMemory`, `getMemory`, `deleteMemory`, and
 * `searchMemories` operations with the shape most Function authors expect:
 * pass the memory fields directly instead of the generated `{ client, body }`
 * or `{ client, query }` operation wrapper. Search is key-prefix search, not
 * free-text retrieval; use `client.semanticSearch` for mail search.
 */
export class MemoriesResource {
  constructor(private readonly client: PrimitiveApiClient["client"]) {}

  async set(
    input: MemorySetInput,
    options?: RequestOptions,
  ): Promise<GeneratedMemoryRecordWithValue> {
    rejectGeneratedOptionsShape(input, "set");
    assertMemorySetInput(input);
    const result = await generatedOperations.setMemory({
      body: input,
      ...resolveRequestOptions(options),
      client: this.client,
      responseStyle: "fields",
    });
    return unwrapData<GeneratedMemoryRecordWithValue>(result, "memory");
  }

  async get(
    input: string | MemoryGetInput,
    options?: RequestOptions,
  ): Promise<GeneratedMemoryRecordWithValue> {
    const query = typeof input === "string" ? { key: input } : input;
    rejectGeneratedOptionsShape(query, "get");
    assertMemoryQueryInput(query, "get");
    const result = await generatedOperations.getMemory({
      query,
      ...resolveRequestOptions(options),
      client: this.client,
      responseStyle: "fields",
    });
    return unwrapData<GeneratedMemoryRecordWithValue>(result, "memory");
  }

  async delete(
    input: string | MemoryDeleteInput,
    options?: RequestOptions,
  ): Promise<GeneratedDeleteMemoryResult> {
    const query = typeof input === "string" ? { key: input } : input;
    rejectGeneratedOptionsShape(query, "delete");
    assertMemoryQueryInput(query, "delete");
    const result = await generatedOperations.deleteMemory({
      query,
      ...resolveRequestOptions(options),
      client: this.client,
      responseStyle: "fields",
    });
    return unwrapData<GeneratedDeleteMemoryResult>(result, "memory delete");
  }

  async search(
    input?: MemorySearchInput,
    options?: RequestOptions,
  ): Promise<MemorySearchResponse> {
    const result = await generatedOperations.searchMemories({
      query: normalizeMemorySearchInput(input),
      ...resolveRequestOptions(options),
      client: this.client,
      responseStyle: "fields",
    });
    return unwrapMemorySearchResult(result);
  }
}

export class PrimitiveClient extends PrimitiveApiClient {
  /** Agent-account lifecycle operations (create, claim/upgrade). */
  readonly agent: AgentResource = new AgentResource(this.client);
  /** Inbound mail: long-poll stream + waitForNext over the forward tail. */
  readonly inbox: InboxResource = new InboxResource(this.client);
  /** Account introspection (plan, limits, entitlements, managed inbox). */
  readonly account: AccountResource = new AccountResource(this.client);
  /** Durable JSON key-value state for agents and Functions. */
  readonly memories: MemoriesResource = new MemoriesResource(this.client);

  // Captured for sendAttachment's upload path, which talks to /v1/payloads
  // directly (streaming, content-addressed) rather than through the generated
  // operation client.
  readonly #payloadApiKey: string | undefined;
  readonly #payloadBaseUrl: string;

  constructor(options: PrimitiveClientOptions = {}) {
    super(options);
    this.#payloadApiKey = options.apiKey;
    // The generated config's baseUrl carries a trailing "/v1"; the payloads
    // client appends "/v1/payloads" itself, so strip it (string ops, not a
    // regex — the payloads module avoids regex on URLs for ReDoS safety).
    let base = this.getConfig().baseUrl ?? "https://api.primitive.dev/v1";
    while (base.endsWith("/")) base = base.slice(0, -1);
    if (base.endsWith("/v1")) base = base.slice(0, -3);
    this.#payloadBaseUrl = base;
  }

  async send(input: SendInput, options?: RequestOptions): Promise<SendResult> {
    validateSendInput(input);

    const body: GeneratedSendMailInput = {
      from: input.from,
      to: input.to,
      subject: input.subject,
      ...(input.bodyText !== undefined ? { body_text: input.bodyText } : {}),
      ...(input.bodyHtml !== undefined ? { body_html: input.bodyHtml } : {}),
      ...(input.thread?.inReplyTo
        ? { in_reply_to: input.thread.inReplyTo }
        : {}),
      ...(input.thread?.references?.length
        ? { references: input.thread.references }
        : {}),
      ...(input.attachments?.length ? { attachments: input.attachments } : {}),
      ...(input.payloadAttachments?.length
        ? {
            payload_attachments: input.payloadAttachments.map((ref) => ({
              root: ref.root,
              filename: ref.filename,
              cek: ref.cek,
              ...(ref.contentType !== undefined
                ? { content_type: ref.contentType }
                : {}),
            })),
          }
        : {}),
      ...(input.wait !== undefined ? { wait: input.wait } : {}),
      ...(input.waitTimeoutMs !== undefined
        ? { wait_timeout_ms: input.waitTimeoutMs }
        : {}),
    };

    const result = await generatedOperations.sendEmail({
      body,
      ...resolveRequestOptions(options),
      client: this.client,
      responseStyle: "fields",
    });
    return unwrapSendResult(result);
  }

  /**
   * Send an attachment of any size in one call. Small attachments are delivered
   * inline; large ones are uploaded as an E2E-encrypted, content-addressed
   * Primitive Payloads object and delivered by reference — unbounded size, and
   * streamed from disk (bounded memory) when given a `path`. Either way the
   * recipient gets a normal attachment (Primitive agents, via the DKIM-signed
   * reference) or a download link (any mailbox). The SDK never sees a smaller
   * ceiling than the object model itself.
   *
   *   // in-memory
   *   await client.sendAttachment({ from, to, subject, bodyText,
   *     attachment: { filename: "note.txt", content: bytes } });
   *   // large file, streamed
   *   await client.sendAttachment({ from, to, subject, bodyText,
   *     attachment: { filename: "video.mp4", path: "./video.mp4" } });
   */
  async sendAttachment(
    input: SendAttachmentInput,
    options?: RequestOptions,
  ): Promise<SendResult> {
    const { attachment, inlineThreshold, ...rest } = input;
    if (attachment.content !== undefined && attachment.path !== undefined) {
      throw new TypeError(
        "sendAttachment accepts either attachment.content or attachment.path, not both",
      );
    }
    const threshold = inlineThreshold ?? DEFAULT_INLINE_ATTACHMENT_MAX;
    const meta = {
      filename: attachment.filename,
      contentType: attachment.contentType,
    };

    if (attachment.content !== undefined) {
      return attachment.content.length <= threshold
        ? this.#sendInline(rest, meta, attachment.content, options)
        : this.#sendByReference(
            rest,
            meta,
            await pushBytes(attachment.content, this.#pushOptions()),
            options,
          );
    }
    if (attachment.path !== undefined) {
      const { size } = await stat(attachment.path);
      return size <= threshold
        ? this.#sendInline(rest, meta, await readFile(attachment.path), options)
        : this.#sendByReference(
            rest,
            meta,
            await pushFile(attachment.path, this.#pushOptions()),
            options,
          );
    }
    throw new TypeError(
      "sendAttachment requires exactly one of attachment.content or attachment.path",
    );
  }

  #pushOptions(): { apiKey: string; baseUrl: string } {
    if (this.#payloadApiKey === undefined) {
      throw new TypeError(
        "sendAttachment requires an API key to upload a large attachment",
      );
    }
    return { apiKey: this.#payloadApiKey, baseUrl: this.#payloadBaseUrl };
  }

  #sendInline(
    rest: Omit<SendInput, "attachments" | "payloadAttachments">,
    meta: { filename: string; contentType?: string },
    bytes: Uint8Array,
    options?: RequestOptions,
  ): Promise<SendResult> {
    return this.send(
      {
        ...rest,
        attachments: [
          {
            filename: meta.filename,
            content_base64: Buffer.from(bytes).toString("base64"),
            ...(meta.contentType !== undefined
              ? { content_type: meta.contentType }
              : {}),
          },
        ],
      },
      options,
    );
  }

  #sendByReference(
    rest: Omit<SendInput, "attachments" | "payloadAttachments">,
    meta: { filename: string; contentType?: string },
    pushed: PushResult,
    options?: RequestOptions,
  ): Promise<SendResult> {
    return this.send(
      {
        ...rest,
        payloadAttachments: [
          {
            root: pushed.merkleRoot,
            filename: meta.filename,
            // PushResult.cek is hex; the reference carries base64url.
            cek: Buffer.from(pushed.cek, "hex").toString("base64url"),
            ...(meta.contentType !== undefined
              ? { contentType: meta.contentType }
              : {}),
          },
        ],
      },
      options,
    );
  }

  /**
   * Semantic / hybrid / keyword search across received and sent mail.
   *
   * `POST /v1/semantic-search`. Returns ranked rows
   * with matched fields, match-centered excerpts, and an additive
   * `score_breakdown`. See `SemanticSearchInput` for request fields and
   * `SemanticSearchResult` for the row shape.
   *
   * Requires the Pro plan and the `semantic_search_enabled` entitlement;
   * otherwise the call throws `PrimitiveApiError` with `status: 403`.
   */
  async semanticSearch(
    input: GeneratedSemanticSearchInput,
    options?: RequestOptions,
  ): Promise<SemanticSearchResponse> {
    const result = await generatedOperations.semanticSearch({
      body: input,
      ...resolveRequestOptions(options),
      client: this.client,
      responseStyle: "fields",
    });
    return unwrapSemanticSearchResult(result);
  }

  /**
   * Reply to an inbound email.
   *
   * Calls `POST /emails/{id}/reply`. The server derives recipients
   * (Reply-To, then From, then sender), subject (`Re: <parent>` with
   * idempotent prefix), and threading headers (`In-Reply-To`,
   * `References`) from the stored inbound row. The customer controls
   * only the body, an optional `from` override, and the `wait` flag.
   *
   * Subject overrides are intentionally not supported: Gmail's
   * Conversation View needs both a References match and a normalized-
   * subject match to thread, so a custom subject silently breaks the
   * thread for half the recipient population.
   */
  async reply(
    email: ReceivedEmail,
    input: ReplyInput,
    options?: RequestOptions,
  ): Promise<SendResult> {
    return replyById(this.client, email.id, input, options);
  }

  async forward(
    email: ReceivedEmail,
    input: ForwardInput,
    options?: RequestOptions,
  ): Promise<SendResult> {
    validateForwardInput(input);

    return this.send(
      {
        from: input.from ?? email.receivedBy,
        to: input.to,
        subject: input.subject ?? email.forwardSubject,
        bodyText: buildForwardText(email, input.bodyText),
      },
      options,
    );
  }
}

function buildForwardText(email: ReceivedEmail, intro?: string): string {
  const lines = [
    ...(intro ? [intro.trim(), ""] : []),
    "---------- Forwarded message ----------",
    `From: ${formatAddress(email.sender)}`,
    `To: ${email.raw.email.headers.to}`,
    `Subject: ${email.subject ?? ""}`,
    ...(email.raw.email.headers.date
      ? [`Date: ${email.raw.email.headers.date}`]
      : []),
    ...(email.thread.messageId
      ? [`Message-ID: ${email.thread.messageId}`]
      : []),
    "",
    email.text ?? "",
  ];

  return lines.join("\n").trimEnd();
}

/**
 * Shared response handler for `send`, `reply`, and any future
 * operation that returns a SendMailResult envelope. Unifies the
 * error-mapping path so the network call sites only have to invoke
 * the generated operation.
 */
function unwrapSendResult(result: {
  data?: { data?: GeneratedSendMailResult } | undefined;
  error?: GeneratedErrorResponse | unknown;
  response?: Response;
}): SendResult {
  const response = (result as { response?: Response }).response;

  if (result.error) {
    if (isAbortLikeError(result.error)) {
      throw result.error;
    }
    const parsed = parseApiErrorPayload(result.error);
    throw new PrimitiveApiError(parsed.message, {
      payload: result.error,
      status: response?.status,
      code: parsed.code,
      gates: parsed.gates,
      requestId: parsed.requestId,
      retryAfter: parseRetryAfterHeader(response),
      details: parsed.details,
      // When the generated client surfaces a transport failure (a
      // rejected `fetch`), `result.error` is the thrown Error whose own
      // `cause` carries code/errno/syscall. Chain it so callers logging
      // `err.cause` get the real failure instead of a bare "fetch failed".
      // Parsed API error bodies are plain objects, not Errors, so this is
      // undefined for them (status/code/payload already capture those).
      cause: result.error instanceof Error ? result.error : undefined,
    });
  }

  if (!result.data?.data) {
    throw new PrimitiveApiError("Primitive API returned no send result", {
      payload: result,
      status: response?.status,
    });
  }

  return mapSendResult(result.data.data);
}

function mapSendResult(result: GeneratedSendMailResult): SendResult {
  return {
    id: result.id,
    status: result.status,
    from: result.from,
    queueId: result.queue_id,
    accepted: result.accepted,
    rejected: result.rejected,
    clientIdempotencyKey: result.client_idempotency_key,
    requestId: result.request_id,
    contentHash: result.content_hash,
    // Default to false if the server omits the field (old-format
    // response, mocked partial response in a customer's tests). The
    // type signature claims `boolean`, so undefined would be a lie.
    idempotentReplay: result.idempotent_replay ?? false,
    ...(result.delivery_status !== undefined
      ? { deliveryStatus: result.delivery_status }
      : {}),
    ...(result.smtp_response_code !== undefined
      ? { smtpResponseCode: result.smtp_response_code }
      : {}),
    ...(result.smtp_response_text !== undefined
      ? { smtpResponseText: result.smtp_response_text }
      : {}),
  };
}

function unwrapSemanticSearchResult(result: {
  data?:
    | {
        data?: GeneratedSemanticSearchResult[];
        meta?: GeneratedSemanticSearchMeta;
      }
    | undefined;
  error?: GeneratedErrorResponse | unknown;
  response?: Response;
}): SemanticSearchResponse {
  const response = (result as { response?: Response }).response;

  if (result.error) {
    if (isAbortLikeError(result.error)) {
      throw result.error;
    }
    const parsed = parseApiErrorPayload(result.error);
    throw new PrimitiveApiError(parsed.message, {
      payload: result.error,
      status: response?.status,
      code: parsed.code,
      gates: parsed.gates,
      requestId: parsed.requestId,
      retryAfter: parseRetryAfterHeader(response),
      details: parsed.details,
      // When the generated client surfaces a transport failure (a
      // rejected `fetch`), `result.error` is the thrown Error whose own
      // `cause` carries code/errno/syscall. Chain it so callers logging
      // `err.cause` get the real failure instead of a bare "fetch failed".
      // Parsed API error bodies are plain objects, not Errors, so this is
      // undefined for them (status/code/payload already capture those).
      cause: result.error instanceof Error ? result.error : undefined,
    });
  }

  if (!result.data?.data || !result.data.meta) {
    throw new PrimitiveApiError(
      "Primitive API returned no semantic-search result",
      {
        payload: result,
        status: response?.status,
      },
    );
  }

  return { data: result.data.data, meta: result.data.meta };
}

function unwrapMemorySearchResult(result: {
  data?:
    | {
        data?: Array<GeneratedMemoryRecord | GeneratedMemoryRecordWithValue>;
        meta?: GeneratedPaginationMeta;
      }
    | undefined;
  error?: GeneratedErrorResponse | unknown;
  response?: Response;
}): MemorySearchResponse {
  const response = (result as { response?: Response }).response;

  if (result.error) {
    if (isAbortLikeError(result.error)) {
      throw result.error;
    }
    const parsed = parseApiErrorPayload(result.error);
    throw new PrimitiveApiError(parsed.message, {
      payload: result.error,
      status: response?.status,
      code: parsed.code,
      gates: parsed.gates,
      requestId: parsed.requestId,
      retryAfter: parseRetryAfterHeader(response),
      details: parsed.details,
      cause: result.error instanceof Error ? result.error : undefined,
    });
  }

  if (!result.data?.data || !result.data.meta) {
    throw new PrimitiveApiError("Primitive API returned no memories result", {
      payload: result,
      status: response?.status,
    });
  }

  return { data: result.data.data, meta: result.data.meta };
}

export function createPrimitiveClient(options: PrimitiveClientOptions = {}) {
  return new PrimitiveClient(options);
}

export function client(options: PrimitiveClientOptions = {}) {
  return new PrimitiveClient(options);
}

export interface CreateAgentOptions extends CreateAgentAccountInput {
  /** Base URL + transport overrides for the returned client. */
  client?: PrimitiveClientOptions;
}

export interface CreatedAgent {
  /** A PrimitiveClient already authenticated with the new agent's API key. */
  client: PrimitiveClient;
  /** The provisioned managed inbox FQDN (the address to receive + reply as). */
  address: string | null;
  /** The raw create-account result (api_key shown once, org_id, plan, limits). */
  account: AgentAccountResult;
}

/**
 * Zero-to-receiving in one call: create an emailless agent account (no auth)
 * and return a PrimitiveClient already wired with its one-time API key, plus
 * the provisioned managed inbox. From here `result.client.inbox.stream()` and
 * `result.client.send(...)` work immediately.
 *
 *   const { client, address } = await createAgent({ terms_accepted: true });
 */
export async function createAgent(
  options: CreateAgentOptions,
): Promise<CreatedAgent> {
  const { client: clientOptions, ...input } = options;
  // Account creation is unauthenticated; use a keyless client to make the call.
  const bootstrap = new PrimitiveClient(clientOptions);
  const account = await bootstrap.agent.createAccount(input);
  const authed = new PrimitiveClient({
    ...clientOptions,
    apiKey: account.api_key,
  });
  return { client: authed, address: account.address, account };
}

// ---------------------------------------------------------------------------
// Re-exports from @primitivedotdev/api-core.
//
// sdk-node's `./api` subpath has historically owned every generated
// operation, every generated type, the `operations` namespace, the
// host-aware `PrimitiveApiClient`, the dual-host base URL constants,
// and the shared error type. Customers import these as
// `@primitivedotdev/sdk/api` and depend on the surface staying
// stable. The implementations live in api-core now (so the CLI can
// pick them up without a sdk-node dependency), and this module
// passes them through unchanged.
// ---------------------------------------------------------------------------

export type {
  Auth,
  Client as PrimitiveGeneratedApiClient,
  ClientOptions as PrimitiveGeneratedApiClientOptions,
  Config as PrimitiveGeneratedApiConfig,
  CreateClientConfig,
  Options as PrimitiveGeneratedApiOptions,
  RequestOptions as PrimitiveGeneratedApiRequestOptions,
  RequestResult as PrimitiveGeneratedApiRequestResult,
  ResponseStyle,
} from "@primitivedotdev/api-core";
// The single `export *` covers every generated operation / type
// plus `operations`, `PrimitiveApiClient`, `createPrimitiveApiClient`,
// `DEFAULT_API_BASE_URL`, and `PrimitiveApiError`. The aliased
// re-exports below cover the historical `PrimitiveGeneratedApi*`
// names so existing customer imports keep resolving.
export * from "@primitivedotdev/api-core";
export type {
  VerifyOptions as VerifyWebhookSignatureOptions,
  WebhookVerificationErrorCode,
} from "./verify-signature.js";
// Web Crypto verifier for in-handler webhook verification. Mirrors
// the surface of `verifyWebhookSignature` from `@primitivedotdev/sdk`
// (the Node version) but implements HMAC-SHA256 with `crypto.subtle`
// so it can be bundled into a Primitive Function without pulling in
// a `node:crypto` polyfill.
export {
  PRIMITIVE_SIGNATURE_HEADER,
  verifyWebhookSignature,
  WebhookVerificationError,
} from "./verify-signature.js";
