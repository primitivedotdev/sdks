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

/**
 * The `ratelimit-*` headers on a 429. They describe the limiter that rejected
 * the request (the API limit, a send cap, or a per-resource limit), with that
 * limiter's own window, so `limit` and `policy` can differ from the API budget
 * that successful responses report. Each field is undefined when its header is
 * absent: some limiters report only a wait, in `Retry-After`.
 */
export interface PrimitiveRateLimit {
  /** `ratelimit-limit`: the rejecting limiter's limit. */
  readonly limit: number | undefined;
  /** `ratelimit-remaining`: requests left in that limiter. */
  readonly remaining: number | undefined;
  /** `ratelimit-reset`: Unix time in seconds when that limiter resets. */
  readonly reset: number | undefined;
  /** `ratelimit-policy`: that limiter as `limit;w=seconds`, e.g. `1000;w=3600`. */
  readonly policy: string | undefined;
}

export class PrimitiveApiError extends Error {
  readonly status: number | undefined;
  readonly code: string | undefined;
  readonly gates: GateDenial[] | undefined;
  readonly requestId: string | undefined;
  readonly retryAfter: number | undefined;
  /**
   * The rejecting limiter's `ratelimit-*` headers on a 429. Undefined on
   * other statuses, and on a 429 that carried none of those headers.
   */
  readonly rateLimit: PrimitiveRateLimit | undefined;
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
      rateLimit?: PrimitiveRateLimit;
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
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "PrimitiveApiError";
    this.payload = options.payload;
    this.status = options.status;
    this.code = options.code;
    this.gates = options.gates;
    this.requestId = options.requestId;
    this.retryAfter = options.retryAfter;
    this.rateLimit = options.rateLimit;
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

/** The `details` of a `403 grant_forbidden`. */
export type GrantForbiddenDetailsShape = {
  /** The permission the operation requires, such as `mail:send`. */
  readonly permission: string;
  /** The kind of credential that was refused, such as `org_key`. */
  readonly credential_kind: string;
  /** The grant template, when the credential holds one. */
  readonly grant_template_key?: string;
  /** The concrete grant id, when the credential holds one. */
  readonly credential_grant_id?: string;
  /** Version of the permission catalog the decision used. */
  readonly catalog_version: string;
  /** Why the grant refused, such as `permission_missing`. */
  readonly reason: string;
  /** A further permission the operation requires, when that one is missing. */
  readonly missing?: string;
  /** The resource the decision was about, when it named one. */
  readonly resource?: { readonly type: string; readonly id: string };
};

export const GRANT_FORBIDDEN_CODE = "grant_forbidden";

function readGrantForbiddenDetails(
  details: unknown,
): GrantForbiddenDetailsShape {
  const raw =
    details && typeof details === "object" && !Array.isArray(details)
      ? (details as Record<string, unknown>)
      : {};
  const text = (key: string): string | undefined =>
    typeof raw[key] === "string" ? (raw[key] as string) : undefined;
  const resourceRaw = raw.resource;
  const resource =
    resourceRaw &&
    typeof resourceRaw === "object" &&
    typeof (resourceRaw as { type?: unknown }).type === "string" &&
    typeof (resourceRaw as { id?: unknown }).id === "string"
      ? {
          type: (resourceRaw as { type: string }).type,
          id: (resourceRaw as { id: string }).id,
        }
      : undefined;
  const parsed: {
    -readonly [K in keyof GrantForbiddenDetailsShape]: GrantForbiddenDetailsShape[K];
  } = {
    permission: text("permission") ?? "",
    credential_kind: text("credential_kind") ?? "",
    catalog_version: text("catalog_version") ?? "",
    reason: text("reason") ?? "",
  };
  const templateKey = text("grant_template_key");
  if (templateKey !== undefined) parsed.grant_template_key = templateKey;
  const grantId = text("credential_grant_id");
  if (grantId !== undefined) parsed.credential_grant_id = grantId;
  const missing = text("missing");
  if (missing !== undefined) parsed.missing = missing;
  if (resource) parsed.resource = resource;
  return parsed;
}

/**
 * A `403 grant_forbidden`: returned when the credential's grant does not
 * include a permission the operation requires. `permission` and `reason`
 * say which one and why.
 *
 * It is a `PrimitiveApiError`, so existing `instanceof PrimitiveApiError`
 * checks keep matching.
 */
export class GrantForbiddenError extends PrimitiveApiError {
  /** The parsed `details`; fields the server omitted are empty strings. */
  readonly grant: GrantForbiddenDetailsShape;
  /** The permission the operation requires. */
  readonly permission: string;
  /** Why the grant refused, such as `permission_missing`. */
  readonly reason: string;

  constructor(
    message: string,
    options: ConstructorParameters<typeof PrimitiveApiError>[1],
  ) {
    super(message, { ...options, code: GRANT_FORBIDDEN_CODE });
    this.name = "GrantForbiddenError";
    this.grant = readGrantForbiddenDetails(options.details);
    this.permission = this.grant.permission;
    this.reason = this.grant.reason;
  }
}

/**
 * Build the error for an API failure: a `GrantForbiddenError` for
 * `grant_forbidden`, otherwise a `PrimitiveApiError`.
 */
export function createPrimitiveApiError(
  message: string,
  options: ConstructorParameters<typeof PrimitiveApiError>[1],
): PrimitiveApiError {
  if (options.code === GRANT_FORBIDDEN_CODE) {
    return new GrantForbiddenError(message, options);
  }
  return new PrimitiveApiError(message, options);
}

/** True when `error` is a `403 grant_forbidden` from the API. */
export function isGrantForbiddenError(
  error: unknown,
): error is GrantForbiddenError {
  return error instanceof GrantForbiddenError;
}
