/**
 * Host-aware Primitive API client and shared error type.
 *
 * Lives in api-core (instead of sdk-node) so the CLI can build a
 * configured request client without taking a dependency on sdk-node.
 * The higher-level `PrimitiveClient` (with `.send`, `.reply`,
 * `.forward`) still lives in sdk-node because it needs the
 * `ReceivedEmail` type from the webhook parsing surface.
 */

import {
  type Client as GeneratedClient,
  type Config as GeneratedConfig,
  createClient,
  createConfig,
} from "./api/client/index.js";
import type {
  GateDenial,
  ErrorResponse as GeneratedErrorResponse,
} from "./api/index.js";

// Default production hosts. Two-host split exists because message
// endpoints with inline attachments need a larger body cap than Vercel
// allows; host 2 is a Cloudflare Worker that accepts ~30 MiB raw. Host
// 1 carries everything else. Customers don't see this split:
// PrimitiveClient.send() and .reply() route to host 2 internally.
//
// Both base URLs are independently overridable via constructor options.
// Override is for internal staging/local testing; not part of the
// publicly-supported surface.
export const DEFAULT_API_BASE_URL_1 = "https://www.primitive.dev/api/v1";
export const DEFAULT_API_BASE_URL_2 = "https://api.primitive.dev/v1";

export interface PrimitiveApiClientOptions
  extends Omit<GeneratedConfig, "auth" | "baseUrl"> {
  apiKey?: string;
  auth?: GeneratedConfig["auth"];
  /** @internal Override for the primary API host. Production default is correct; this exists for staging/local testing only. */
  apiBaseUrl1?: string;
  /** @internal Override for the attachments-supporting send host. Production default is correct; this exists for staging/local testing only. */
  apiBaseUrl2?: string;
}

function createDefaultAuth(apiKey?: string): GeneratedConfig["auth"] {
  return (security) => {
    if (security.type === "http" && security.scheme === "bearer") {
      return apiKey;
    }

    return undefined;
  };
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

export type PrimitiveApiErrorDetails = NonNullable<
  GeneratedErrorResponse["error"]["details"]
>;

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

export class PrimitiveApiClient {
  /**
   * Generated client targeting the primary API host (apiBaseUrl1). Use
   * this when passing `client: ...` to a generated operation function
   * for every endpoint EXCEPT attachment-capable message sends. The
   * hand-written PrimitiveClient.send / .reply / .forward methods on
   * the subclass route those sends to the host-2 client internally.
   */
  readonly client: GeneratedClient;
  /**
   * @internal Generated client targeting the attachments-supporting
   * send host (apiBaseUrl2). Used by PrimitiveClient.send() and
   * PrimitiveClient.reply() under the hood. Exposed for the CLI's
   * hand-rolled send/reply commands, which call generated operations
   * directly; not part of the publicly-documented SDK surface.
   * Customer code should call .send() / .reply() on the subclass
   * instead.
   */
  readonly _sendClient: GeneratedClient;

  constructor(options: PrimitiveApiClientOptions = {}) {
    const {
      apiKey,
      auth,
      apiBaseUrl1 = DEFAULT_API_BASE_URL_1,
      apiBaseUrl2 = DEFAULT_API_BASE_URL_2,
      ...config
    } = options;

    const resolvedAuth = auth ?? createDefaultAuth(apiKey);

    this.client = createClient(
      createConfig({
        ...config,
        auth: resolvedAuth,
        baseUrl: apiBaseUrl1,
      }),
    );
    this._sendClient = createClient(
      createConfig({
        ...config,
        auth: resolvedAuth,
        baseUrl: apiBaseUrl2,
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

export function createPrimitiveApiClient(
  options: PrimitiveApiClientOptions = {},
) {
  return new PrimitiveApiClient(options);
}
