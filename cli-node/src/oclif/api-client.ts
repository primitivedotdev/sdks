import { Errors } from "@oclif/core";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import {
  acquireCliCredentialsLock,
  cliAccessTokenExpiresAt,
  deleteCliCredentials,
  loadCliCredentials,
  normalizeApiBaseUrl,
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
export const SAVED_CLI_OAUTH_SESSION_EXPIRED_MESSAGE =
  "Saved Primitive CLI OAuth session expired or was revoked. Run `primitive signin` to authenticate again.";

type Env = Record<string, string | undefined>;

type FetchFn = typeof fetch;

type OAuthRefreshSuccess = {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_in: number;
};

export type ResolvedCliApiRequestConfig = {
  apiBaseUrl?: string;
  resolvedApiBaseUrl: string;
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
  apiBaseUrl?: string;
  env?: Env;
}): ResolvedCliApiRequestConfig {
  const cliConfig = loadCliConfig(params.configDir);
  const currentEnvironment = resolveConfigEnvironment(cliConfig);
  const configuredApiBaseUrl = currentEnvironment?.config.api_base_url;

  // Refuse to silently fall through to the production default when an
  // explicit non-default environment is active but does not specify
  // its own API base URL. This was a real footgun: a user on
  // `primitive config use staging` whose staging environment block
  // had no api_base_url set could log in, talk to production by
  // default, and end up with a production URL persisted into
  // credentials.json - every subsequent command would then hit
  // production with a key minted against the wrong environment.
  if (
    currentEnvironment !== null &&
    currentEnvironment.name !== DEFAULT_ENVIRONMENT &&
    params.apiBaseUrl === undefined &&
    configuredApiBaseUrl === undefined
  ) {
    throw new Errors.CLIError(
      `The active Primitive CLI environment \`${currentEnvironment.name}\` does not specify an api_base_url. Set one with \`primitive config set --environment ${currentEnvironment.name} --api-base-url https://...\`, or switch to a different environment with \`primitive config use <name>\`. Refusing to fall back to the production default for a non-default environment.`,
      { exit: 1 },
    );
  }

  const apiBaseUrl =
    params.apiBaseUrl !== undefined
      ? normalizeApiBaseUrl(params.apiBaseUrl)
      : configuredApiBaseUrl;

  return {
    apiBaseUrl,
    baseUrlOverridden: apiBaseUrl !== undefined,
    environmentName: currentEnvironment?.name ?? null,
    headers: mergeHeaders(
      currentEnvironment?.config.headers,
      cliApiHeadersFromEnv(params.env),
    ),
    resolvedApiBaseUrl: normalizeApiBaseUrl(apiBaseUrl),
  };
}

export function createCliApiClient(params: {
  configDir: string;
  apiKey?: string;
  apiBaseUrl?: string;
  env?: Env;
}): {
  apiClient: PrimitiveApiClient;
  requestConfig: ResolvedCliApiRequestConfig;
} {
  const requestConfig = resolveCliApiRequestConfig(params);
  return {
    apiClient: new PrimitiveApiClient({
      apiKey: params.apiKey,
      apiBaseUrl: requestConfig.resolvedApiBaseUrl,
      headers: requestConfig.headers,
    }),
    requestConfig,
  };
}

function oauthTokenEndpoint(apiBaseUrl: string): string {
  const url = new URL(apiBaseUrl);
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
  apiBaseUrl: string;
  configDir: string;
  credentials: StoredCliCredentials;
  credentialsLockHeld?: boolean;
  headers?: Record<string, string>;
  fetch?: FetchFn;
  now?: () => number;
}): Promise<StoredCliCredentials> {
  const now = params.now ?? Date.now;
  if (!shouldRefresh(params.credentials, now)) return params.credentials;

  let releaseLock: (() => void) | undefined;
  try {
    if (!params.credentialsLockHeld) {
      try {
        releaseLock = acquireCliCredentialsLock(params.configDir);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Errors.CLIError(detail, { exit: 1 });
      }
    }

    const current = loadCliCredentials(params.configDir);
    if (!current) {
      throw new Errors.CLIError(
        "Saved Primitive CLI OAuth session is no longer available. Run `primitive signin` to authenticate again.",
        { exit: 1 },
      );
    }
    if (!shouldRefresh(current, now)) return current;

    const fetchImpl = params.fetch ?? fetch;
    const body = new URLSearchParams({
      client_id: current.oauth_client_id,
      grant_type: "refresh_token",
      refresh_token: current.refresh_token,
    });

    let response: Response;
    try {
      response = await fetchImpl(oauthTokenEndpoint(params.apiBaseUrl), {
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
        throw new Errors.CLIError(SAVED_CLI_OAUTH_SESSION_EXPIRED_MESSAGE, {
          exit: 1,
        });
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
      ...current,
      access_token: payload.access_token,
      expires_at: cliAccessTokenExpiresAt(payload.expires_in, now),
      refresh_token: payload.refresh_token,
      token_type: payload.token_type,
    };
    saveCliCredentials(params.configDir, next);
    return next;
  } finally {
    releaseLock?.();
  }
}

export async function createAuthenticatedCliApiClient(params: {
  configDir: string;
  apiKey?: string;
  apiBaseUrl?: string;
  env?: Env;
  fetch?: FetchFn;
  now?: () => number;
  credentialsLockHeld?: boolean;
}) {
  const requestConfig = resolveCliApiRequestConfig(params);
  let auth = resolveCliAuth({
    apiKey: params.apiKey,
    apiBaseUrl: requestConfig.apiBaseUrl,
    configDir: params.configDir,
  });
  if (auth.source === "stored" && auth.credentials) {
    const refreshed = await refreshStoredCliCredentials({
      apiBaseUrl: auth.apiBaseUrl,
      configDir: params.configDir,
      credentials: auth.credentials,
      credentialsLockHeld: params.credentialsLockHeld,
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
      apiBaseUrl: auth.apiBaseUrl,
      headers: requestConfig.headers,
    }),
    auth,
    baseUrlOverridden: requestConfig.baseUrlOverridden,
    requestConfig,
  };
}
