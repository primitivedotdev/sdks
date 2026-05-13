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

import {
  type GateDenial,
  type ErrorResponse as GeneratedErrorResponse,
  type ReplyInput as GeneratedReplyInput,
  type SendMailInput as GeneratedSendMailInput,
  type SendMailResult as GeneratedSendMailResult,
  operations as generatedOperations,
  PrimitiveApiClient,
  type PrimitiveApiClientOptions,
  PrimitiveApiError,
  type PrimitiveApiErrorDetails,
} from "@primitivedotdev/api-core";
import type { ReceivedEmail } from "../webhook/received-email.js";
import { formatAddress } from "../webhook/received-email.js";

// EmailReceivedEvent is the parsed JSON shape Functions handlers
// receive in `await req.json()`. Re-exported from `/api` (Workers-safe)
// so scaffolded handlers can type the request body without importing
// from `@primitivedotdev/sdk` root or `/webhook` (both of which pull
// node:crypto via the Node-crypto signing helpers).
export type { EmailReceivedEvent } from "../types.js";
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
    !/^.+<[^\s@]+@[^\s@]+\.[^\s@]+>$/.test(value)
  ) {
    throw new TypeError(`${field} must be a valid email address`);
  }
}

export interface SendThreadInput {
  inReplyTo?: string;
  references?: string[];
}

export interface SendInput {
  from: string;
  to: string;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  thread?: SendThreadInput;
  wait?: boolean;
  waitTimeoutMs?: number;
}

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

export class PrimitiveClient extends PrimitiveApiClient {
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
      ...(input.wait !== undefined ? { wait: input.wait } : {}),
      ...(input.waitTimeoutMs !== undefined
        ? { wait_timeout_ms: input.waitTimeoutMs }
        : {}),
    };

    const result = await generatedOperations.sendEmail({
      body,
      ...resolveRequestOptions(options),
      // /send-mail goes to the host that supports attachments. Same
      // request body shape on both hosts; the host swap is the only
      // difference. Callers don't see or configure this.
      client: this._sendClient,
      responseStyle: "fields",
    });
    return unwrapSendResult(result);
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
    const resolved = typeof input === "string" ? { text: input } : input;
    // Reject the subject override at runtime so a JS caller (no TS
    // types) gets the same loud error as a TS caller. Without this,
    // `client.reply(email, { text, subject: "Custom" })` silently
    // dropped subject and sent a "Re:" reply, breaking Gmail
    // threading without telling the caller. Mirrors Python's
    // ValueError. Checked before the empty-body check so passing
    // ONLY a subject surfaces the more informative error.
    if ("subject" in resolved) {
      throw new TypeError(
        "reply does not support a subject override; the server prepends 'Re:' to the parent's subject for thread continuity",
      );
    }
    if (!resolved.text && !resolved.html) {
      throw new TypeError("reply requires text or html");
    }

    const body: GeneratedReplyInput = {
      ...(resolved.text !== undefined ? { body_text: resolved.text } : {}),
      ...(resolved.html !== undefined ? { body_html: resolved.html } : {}),
      ...(resolved.from !== undefined ? { from: resolved.from } : {}),
      ...(resolved.wait !== undefined ? { wait: resolved.wait } : {}),
    };

    const result = await generatedOperations.replyToEmail({
      body,
      path: { id: email.id },
      ...resolveRequestOptions(options),
      client: this.client,
      responseStyle: "fields",
    });
    return unwrapSendResult(result);
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

export function createPrimitiveClient(options: PrimitiveClientOptions = {}) {
  return new PrimitiveClient(options);
}

export function client(options: PrimitiveClientOptions = {}) {
  return new PrimitiveClient(options);
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
// `DEFAULT_API_BASE_URL_1/2`, and `PrimitiveApiError`. The aliased
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
