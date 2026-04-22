/**
 * Primitive API client module.
 *
 * Generated operations are exported directly, and `PrimitiveApiClient`
 * provides a configured fetch client for those operations.
 */

import {
  createClient,
  createConfig,
  type Client as GeneratedClient,
  type Config as GeneratedConfig,
} from "./generated/client/index.js";
import type { SendInput, SendResult } from "./generated/index.js";
import * as generatedOperations from "./generated/sdk.gen.js";

export const DEFAULT_BASE_URL = "https://www.primitive.dev/api/v1";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function validateSendInput(input: SendInput): void {
  validateEmailAddress("from", input.from);
  validateEmailAddress("to", input.to);

  if (input.subject.trim().length === 0) {
    throw new TypeError("subject must be a non-empty string");
  }

  if (input.body.length === 0) {
    throw new TypeError("body must be a non-empty string");
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

    const result = await generatedOperations.sendEmail({
      body: input,
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

    return result.data.data;
  }
}

export function createPrimitiveApiClient(
  options: PrimitiveApiClientOptions = {},
) {
  return new PrimitiveApiClient(options);
}

export function createPrimitiveClient(options: PrimitiveClientOptions = {}) {
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
