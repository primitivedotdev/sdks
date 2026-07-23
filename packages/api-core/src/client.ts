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
  createClient,
  createConfig,
  type Client as GeneratedClient,
  type Config as GeneratedConfig,
} from "./api/client/index.js";
import type {
  GateDenial,
  ErrorResponse as GeneratedErrorResponse,
} from "./api/index.js";

// Default production host. Override is for internal staging/local testing;
// it is not part of the publicly-supported surface.
export const DEFAULT_API_BASE_URL = "https://api.primitive.dev/v1";

export interface PrimitiveApiClientOptions
  extends Omit<GeneratedConfig, "auth" | "baseUrl"> {
  apiKey?: string;
  auth?: GeneratedConfig["auth"];
  /** @internal Override for the API host. Production default is correct; this exists for staging/local testing only. */
  apiBaseUrl?: string;
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
      /**
       * The underlying error this wraps, when there is one (e.g. a
       * transport-level `fetch` rejection). Chained onto the standard
       * `Error.cause` so callers logging `err.cause` see the original
       * failure — including a network error's `code`/`errno`/`syscall`,
       * which a bare "fetch failed" message hides.
       */
      cause?: unknown;
    },
  ) {
    super(
      message,
      options.cause !== undefined ? { cause: options.cause } : undefined,
    );
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
  readonly client: GeneratedClient;

  constructor(options: PrimitiveApiClientOptions = {}) {
    const {
      apiKey,
      auth,
      apiBaseUrl = DEFAULT_API_BASE_URL,
      ...config
    } = options;

    const resolvedAuth = auth ?? createDefaultAuth(apiKey);

    this.client = createClient(
      createConfig({
        ...config,
        auth: resolvedAuth,
        baseUrl: apiBaseUrl,
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
