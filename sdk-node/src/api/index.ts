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
  SendMailInput as GeneratedSendMailInput,
  SendMailResult as GeneratedSendMailResult,
} from "./generated/index.js";
import * as generatedOperations from "./generated/sdk.gen.js";

export const DEFAULT_BASE_URL = "https://www.primitive.dev/api/v1";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_THREAD_REFERENCES = 100;
const MAX_THREAD_HEADER_BYTES = 8 * 1024;

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

function validateEmailAddress(field: "from" | "to", value: string): void {
  if (!EMAIL_REGEX.test(value)) {
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
}

export type ReplyInput =
  | string
  | {
      text: string;
      subject?: string;
    };

export interface ForwardInput {
  to: string;
  bodyText?: string;
  subject?: string;
  from?: string;
}

export interface SendResult {
  queueId?: string;
  accepted: string[];
  rejected: string[];
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
  validateEmailAddress("from", input.from);
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
}

function validateForwardInput(input: ForwardInput): void {
  validateEmailAddress("to", input.to);

  if (input.subject !== undefined && input.subject.trim().length === 0) {
    throw new TypeError("subject must be a non-empty string");
  }
}

function extractApiErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "Primitive API request failed";
  }

  if (
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }

  if ("message" in payload && typeof payload.message === "string") {
    return payload.message;
  }

  return "Primitive API request failed";
}

export class PrimitiveApiError extends Error {
  readonly status: number | undefined;
  readonly payload: unknown;

  constructor(message: string, options: { payload: unknown; status?: number }) {
    super(message);
    this.name = "PrimitiveApiError";
    this.payload = options.payload;
    this.status = options.status;
  }
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
    };

    const result = await generatedOperations.sendEmail({
      body,
      client: this.client,
      responseStyle: "fields",
    });
    const response = (result as { response?: Response }).response;

    if (result.error) {
      throw new PrimitiveApiError(extractApiErrorMessage(result.error), {
        payload: result.error,
        status: response?.status,
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

  async reply(email: ReceivedEmail, input: ReplyInput): Promise<SendResult> {
    const resolved = typeof input === "string" ? { text: input } : input;

    return this.send({
      from: email.receivedBy,
      to: email.replyTarget.address,
      subject: resolved.subject ?? email.replySubject,
      bodyText: resolved.text,
      thread: {
        ...(email.thread.messageId
          ? { inReplyTo: email.thread.messageId }
          : {}),
        references: email.thread.messageId
          ? [...email.thread.references, email.thread.messageId]
          : email.thread.references,
      },
    });
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

function mapSendResult(result: GeneratedSendMailResult): SendResult {
  return {
    ...(result.queue_id !== undefined ? { queueId: result.queue_id } : {}),
    accepted: result.accepted,
    rejected: result.rejected,
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
