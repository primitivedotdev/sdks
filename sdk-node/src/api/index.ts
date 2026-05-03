/**
 * Primitive API client module.
 *
 * Generated operations are exported directly, and `PrimitiveApiClient`
 * provides a configured fetch client for those operations.
 */

import type { ReceivedEmail } from "../webhook/received-email.js";
import { formatAddress } from "../webhook/received-email.js";
import {
  createClient,
  createConfig,
  type Client as GeneratedClient,
  type Config as GeneratedConfig,
} from "./generated/client/index.js";
import type {
  GateDenial,
  ErrorResponse as GeneratedErrorResponse,
  ReplyInput as GeneratedReplyInput,
  SendMailInput as GeneratedSendMailInput,
  SendMailResult as GeneratedSendMailResult,
} from "./generated/index.js";
import * as generatedOperations from "./generated/sdk.gen.js";

export const DEFAULT_BASE_URL = "https://www.primitive.dev/api/v1";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_THREAD_REFERENCES = 100;
const MAX_THREAD_HEADER_BYTES = 8 * 1024;
const MAX_FROM_HEADER_LENGTH = 998;
const MAX_TO_HEADER_LENGTH = 320;

export interface PrimitiveApiClientOptions
  extends Omit<GeneratedConfig, "auth" | "baseUrl"> {
  apiKey?: string;
  auth?: GeneratedConfig["auth"];
  baseUrl?: string;
}

function createDefaultAuth(apiKey?: string): GeneratedConfig["auth"] {
  return (security) => {
    if (security.type === "http" && security.scheme === "bearer") {
      return apiKey;
    }

    return undefined;
  };
}

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

export type PrimitiveApiErrorDetails = NonNullable<
  GeneratedErrorResponse["error"]["details"]
>;

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

export class PrimitiveApiError extends Error {
  readonly status: number | undefined;
  readonly code: string | undefined;
  readonly gates: GateDenial[] | undefined;
  readonly requestId: string | undefined;
  readonly retryAfter: number | undefined;
  readonly details: PrimitiveApiErrorDetails | undefined;
  readonly payload: unknown;

  constructor(
    message: string,
    options: {
      payload: unknown;
      status?: number;
      code?: string;
      gates?: GateDenial[];
      requestId?: string;
      retryAfter?: number;
      details?: PrimitiveApiErrorDetails;
    },
  ) {
    super(message);
    this.name = "PrimitiveApiError";
    this.payload = options.payload;
    this.status = options.status;
    this.code = options.code;
    this.gates = options.gates;
    this.requestId = options.requestId;
    this.retryAfter = options.retryAfter;
    this.details = options.details;
  }
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

export class PrimitiveApiClient {
  readonly client: GeneratedClient;

  constructor(options: PrimitiveApiClientOptions = {}) {
    const { apiKey, auth, baseUrl = DEFAULT_BASE_URL, ...config } = options;

    this.client = createClient(
      createConfig({
        ...config,
        auth: auth ?? createDefaultAuth(apiKey),
        baseUrl,
      }),
    );
  }

  getConfig() {
    return this.client.getConfig();
  }

  setConfig(config: GeneratedConfig) {
    return this.client.setConfig(config);
  }
}

export type PrimitiveClientOptions = PrimitiveApiClientOptions;

export class PrimitiveClient extends PrimitiveApiClient {
  async send(input: SendInput): Promise<SendResult> {
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
      ...(input.idempotencyKey
        ? { headers: { "Idempotency-Key": input.idempotencyKey } }
        : {}),
      client: this.client,
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
  async reply(email: ReceivedEmail, input: ReplyInput): Promise<SendResult> {
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
      client: this.client,
      responseStyle: "fields",
    });
    return unwrapSendResult(result);
  }

  async forward(
    email: ReceivedEmail,
    input: ForwardInput,
  ): Promise<SendResult> {
    validateForwardInput(input);

    return this.send({
      from: input.from ?? email.receivedBy,
      to: input.to,
      subject: input.subject ?? email.forwardSubject,
      bodyText: buildForwardText(email, input.bodyText),
    });
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

export function createPrimitiveApiClient(
  options: PrimitiveApiClientOptions = {},
) {
  return new PrimitiveApiClient(options);
}

export function createPrimitiveClient(options: PrimitiveClientOptions = {}) {
  return new PrimitiveClient(options);
}

export function client(options: PrimitiveClientOptions = {}) {
  return new PrimitiveClient(options);
}

export const operations = generatedOperations;

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
} from "./generated/client/index.js";
export * from "./generated/index.js";
