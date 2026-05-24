import { Errors } from "@oclif/core";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import {
  cliAccessTokenExpiresAt,
  deleteCliCredentials,
  normalizeApiBaseUrl1,
  normalizeApiBaseUrl2,
  resolveCliAuth,
  type StoredCliCredentials,
  saveCliCredentials,
} from "./auth.js";
import {
  DEFAULT_ENVIRONMENT,
  loadCliConfig,
  resolveConfigEnvironment,
  validateCliHeaderName,
  validateCliHeaderValue,
} from "./cli-config.js";

const API_HEADERS_ENV = "PRIMITIVE_API_HEADERS";
const OAUTH_REFRESH_SKEW_MS = 60 * 1000;

type Env = Record<string, string | undefined>;

type FetchFn = typeof fetch;

type OAuthRefreshSuccess = {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_in: number;
};

export type ResolvedCliApiRequestConfig = {
  apiBaseUrl1?: string;
  apiBaseUrl2?: string;
  resolvedApiBaseUrl1: string;
  resolvedApiBaseUrl2: string;
  baseUrlOverridden: boolean;
  environmentName: string | null;
  headers?: Record<string, string>;
};

function mergeHeaders(
  ...headers: Array<Record<string, string> | undefined>
): Record<string, string> | undefined {
  const merged: Record<string, string> = {};
  for (const headerSet of headers) {
    if (!headerSet) continue;
    for (const [name, value] of Object.entries(headerSet)) {
      merged[name] = value;
    }
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function parseHeadersJson(raw: string): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Errors.CLIError(
      `${API_HEADERS_ENV} must be valid JSON object syntax: ${detail}`,
      { exit: 1 },
    );
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Errors.CLIError(`${API_HEADERS_ENV} must be a JSON object.`, {
      exit: 1,
    });
  }

  const headers: Record<string, string> = {};
  for (const [rawName, rawValue] of Object.entries(parsed)) {
    const name = validateCliHeaderName(rawName);
    if (typeof rawValue !== "string") {
      throw new Errors.CLIError(
        `${API_HEADERS_ENV}.${name} must be a string.`,
        { exit: 1 },
      );
    }
    headers[name] = validateCliHeaderValue(rawValue, name);
  }
  return headers;
}

export function cliApiHeadersFromEnv(
  env: Env = process.env,
): Record<string, string> | undefined {
  const rawGenericHeaders = env[API_HEADERS_ENV]?.trim();
  return rawGenericHeaders ? parseHeadersJson(rawGenericHeaders) : undefined;
}

export function resolveCliApiRequestConfig(params: {
  configDir: string;
  apiBaseUrl1?: string;
  apiBaseUrl2?: string;
  env?: Env;
}): ResolvedCliApiRequestConfig {
  const cliConfig = loadCliConfig(params.configDir);
  const currentEnvironment = resolveConfigEnvironment(cliConfig);
  const configuredApiBaseUrl1 = currentEnvironment?.config.api_base_url_1;
  const configuredApiBaseUrl2 = currentEnvironment?.config.api_base_url_2;

  // Refuse to silently fall through to the production default when an
  // explicit non-default environment is active but does not specify
  // its own API base URL(s). This was a real footgun: a user on
  // `primitive config use staging` whose staging environment block
  // had no api_base_url_1 set could log in, talk to production by
  // default, and end up with a production URL persisted into
  // credentials.json - every subsequent command would then hit
  // production with a key minted against the wrong environment.
  if (
    currentEnvironment !== null &&
    currentEnvironment.name !== DEFAULT_ENVIRONMENT &&
    params.apiBaseUrl1 === undefined &&
    configuredApiBaseUrl1 === undefined
  ) {
    throw new Errors.CLIError(
      `The active Primitive CLI environment \`${currentEnvironment.name}\` does not specify an api_base_url_1. Set one with \`primitive config set --environment ${currentEnvironment.name} --api-base-url-1 https://...\`, or switch to a different environment with \`primitive config use <name>\`. Refusing to fall back to the production default for a non-default environment.`,
      { exit: 1 },
    );
  }

  const apiBaseUrl1 =
    params.apiBaseUrl1 !== undefined
      ? normalizeApiBaseUrl1(params.apiBaseUrl1)
      : configuredApiBaseUrl1;
  const apiBaseUrl2 =
    params.apiBaseUrl2 !== undefined
      ? normalizeApiBaseUrl2(params.apiBaseUrl2)
      : configuredApiBaseUrl2;

  return {
    apiBaseUrl1,
    apiBaseUrl2,
    baseUrlOverridden: apiBaseUrl1 !== undefined || apiBaseUrl2 !== undefined,
    environmentName: currentEnvironment?.name ?? null,
    headers: mergeHeaders(
      currentEnvironment?.config.headers,
      cliApiHeadersFromEnv(params.env),
    ),
    resolvedApiBaseUrl1: normalizeApiBaseUrl1(apiBaseUrl1),
    resolvedApiBaseUrl2: normalizeApiBaseUrl2(apiBaseUrl2),
  };
}

export function createCliApiClient(params: {
  configDir: string;
  apiKey?: string;
  apiBaseUrl1?: string;
  apiBaseUrl2?: string;
  env?: Env;
}): {
  apiClient: PrimitiveApiClient;
  requestConfig: ResolvedCliApiRequestConfig;
} {
  const requestConfig = resolveCliApiRequestConfig(params);
  return {
    apiClient: new PrimitiveApiClient({
      apiKey: params.apiKey,
      apiBaseUrl1: requestConfig.resolvedApiBaseUrl1,
      apiBaseUrl2: requestConfig.resolvedApiBaseUrl2,
      headers: requestConfig.headers,
    }),
    requestConfig,
  };
}

function oauthTokenEndpoint(apiBaseUrl1: string): string {
  const url = new URL(apiBaseUrl1);
  url.pathname = "/oauth/token";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function shouldRefresh(
  credentials: StoredCliCredentials,
  now: () => number,
): boolean {
  const expiresAt = Date.parse(credentials.expires_at);
  if (!Number.isFinite(expiresAt)) return true;
  return expiresAt <= now() + OAUTH_REFRESH_SKEW_MS;
}

function isOAuthRefreshSuccess(value: unknown): value is OAuthRefreshSuccess {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.access_token === "string" &&
    typeof row.refresh_token === "string" &&
    row.token_type === "Bearer" &&
    typeof row.expires_in === "number" &&
    Number.isFinite(row.expires_in) &&
    row.expires_in > 0
  );
}

function oauthErrorCode(value: unknown): string | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const raw = (value as { error?: unknown }).error;
  return typeof raw === "string" ? raw : null;
}

function oauthErrorDescription(value: unknown): string | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const raw = (value as { error_description?: unknown }).error_description;
  return typeof raw === "string" && raw.trim() ? raw : null;
}

export async function refreshStoredCliCredentials(params: {
  apiBaseUrl1: string;
  configDir: string;
  credentials: StoredCliCredentials;
  headers?: Record<string, string>;
  fetch?: FetchFn;
  now?: () => number;
}): Promise<StoredCliCredentials> {
  const now = params.now ?? Date.now;
  if (!shouldRefresh(params.credentials, now)) return params.credentials;

  const fetchImpl = params.fetch ?? fetch;
  const body = new URLSearchParams({
    client_id: params.credentials.oauth_client_id,
    grant_type: "refresh_token",
    refresh_token: params.credentials.refresh_token,
  });

  let response: Response;
  try {
    response = await fetchImpl(oauthTokenEndpoint(params.apiBaseUrl1), {
      body,
      headers: {
        ...(params.headers ?? {}),
        "content-type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Errors.CLIError(
      `Could not refresh saved Primitive CLI OAuth credentials: ${detail}`,
      { exit: 1 },
    );
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const code = oauthErrorCode(payload);
    const description = oauthErrorDescription(payload);
    if (code === "invalid_grant") {
      deleteCliCredentials(params.configDir);
      throw new Errors.CLIError(
        "Saved Primitive CLI OAuth session expired or was revoked. Run `primitive login` to authenticate again.",
        { exit: 1 },
      );
    }
    throw new Errors.CLIError(
      `Could not refresh saved Primitive CLI OAuth credentials${description ? `: ${description}` : "."}`,
      { exit: 1 },
    );
  }

  if (!isOAuthRefreshSuccess(payload)) {
    throw new Errors.CLIError(
      "Primitive OAuth token endpoint returned an unexpected refresh response.",
      { exit: 1 },
    );
  }

  const next: StoredCliCredentials = {
    ...params.credentials,
    access_token: payload.access_token,
    expires_at: cliAccessTokenExpiresAt(payload.expires_in, now),
    refresh_token: payload.refresh_token,
    token_type: payload.token_type,
  };
  saveCliCredentials(params.configDir, next);
  return next;
}

export async function createAuthenticatedCliApiClient(params: {
  configDir: string;
  apiKey?: string;
  apiBaseUrl1?: string;
  apiBaseUrl2?: string;
  env?: Env;
  fetch?: FetchFn;
  now?: () => number;
}) {
  const requestConfig = resolveCliApiRequestConfig(params);
  let auth = resolveCliAuth({
    apiKey: params.apiKey,
    apiBaseUrl1: requestConfig.apiBaseUrl1,
    apiBaseUrl2: requestConfig.apiBaseUrl2,
    configDir: params.configDir,
  });
  if (auth.source === "stored" && auth.credentials) {
    const refreshed = await refreshStoredCliCredentials({
      apiBaseUrl1: auth.apiBaseUrl1,
      configDir: params.configDir,
      credentials: auth.credentials,
      fetch: params.fetch,
      headers: requestConfig.headers,
      now: params.now,
    });
    auth = {
      ...auth,
      apiKey: refreshed.access_token,
      credentials: refreshed,
    };
  }
  return {
    apiClient: new PrimitiveApiClient({
      apiKey: auth.apiKey,
      apiBaseUrl1: auth.apiBaseUrl1,
      apiBaseUrl2: auth.apiBaseUrl2,
      headers: requestConfig.headers,
    }),
    auth,
    baseUrlOverridden: requestConfig.baseUrlOverridden,
    requestConfig,
  };
}
