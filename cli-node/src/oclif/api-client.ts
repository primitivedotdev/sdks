import { Errors } from "@oclif/core";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import {
  acquireCliCredentialsLock,
  cliAccessTokenExpiresAt,
  deleteCliCredentials,
  detectPrimitiveKeyEnvMisname,
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
import { AGENT_PROFILE_ENV } from "./connected-agent-profile.js";
import { ORG_SELECTION_ENV } from "./global-org-flag.js";
import {
  ensureUserGrantSession,
  reexchangingFetch,
  savedLoginReexchange,
} from "./user-grant.js";

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
  if ((params.env ?? process.env)[AGENT_PROFILE_ENV]?.trim()) {
    // A selected profile supplies its own trusted origin. Ambient environments
    // and headers belong to the default login, including malformed settings.
    const auth = resolveCliAuth(params);
    return {
      apiBaseUrl: auth.apiBaseUrl,
      resolvedApiBaseUrl: auth.apiBaseUrl,
      baseUrlOverridden: params.apiBaseUrl !== undefined,
      environmentName: null,
    };
  }
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

/** The organization the global `--org` flag (or PRIMITIVE_CLI_ORG) selects, if any. */
export function selectedOrgFromEnv(env: Env = process.env): string | null {
  return env[ORG_SELECTION_ENV]?.trim() || null;
}

/**
 * Refuse `--org` before a command acts with a connected agent profile's own
 * key: the profile belongs to one organization and cannot act in another.
 */
export function refuseOrgSelectionForProfile(
  profileName: string | undefined,
  env: Env = process.env,
): void {
  const selection = selectedOrgFromEnv(env);
  if (!selection) return;
  const who = profileName
    ? `Connected agent profile ${profileName}`
    : "A connected agent credential";
  throw new Errors.CLIError(
    `--org (PRIMITIVE_CLI_ORG=${selection}) selects an organization for a saved \`primitive login\`. ${who} belongs to one organization; drop --org, or unset PRIMITIVE_CLI_ORG.`,
    { exit: 1 },
  );
}

function orgMatches(credentials: StoredCliCredentials, selection: string) {
  const wanted = selection.toLowerCase();
  return (
    credentials.org_id.toLowerCase() === wanted ||
    (credentials.org_name ?? "").trim().toLowerCase() === wanted
  );
}

/**
 * Refuse `--org` for an org-bound login unless it names that login's own
 * organization: an org-bound login cannot act anywhere else.
 */
export function assertOrgBoundSelection(
  credentials: StoredCliCredentials,
  selection: string | null,
): void {
  if (!selection || orgMatches(credentials, selection)) return;
  const org = credentials.org_name
    ? `${credentials.org_name} (${credentials.org_id})`
    : credentials.org_id;
  throw new Errors.CLIError(
    `This saved login is bound to organization ${org}, so --org ${selection} cannot be used with it. Run \`primitive logout\`, then \`primitive login\`, to sign in as yourself and switch between organizations.`,
    { exit: 1 },
  );
}

export async function refreshStoredCliCredentials(params: {
  apiBaseUrl: string;
  configDir: string;
  credentials: StoredCliCredentials;
  credentialsLockHeld?: boolean;
  headers?: Record<string, string>;
  fetch?: FetchFn;
  now?: () => number;
  /**
   * The organization to act in. Undefined reads `--org` (PRIMITIVE_CLI_ORG);
   * null means the login's current organization.
   */
  orgSelection?: string | null;
}): Promise<StoredCliCredentials> {
  const now = params.now ?? Date.now;
  const orgSelection =
    params.orgSelection === undefined
      ? selectedOrgFromEnv()
      : params.orgSelection;
  if (params.credentials.auth_method === "user_grant") {
    return ensureUserGrantSession({
      apiBaseUrl: params.apiBaseUrl,
      configDir: params.configDir,
      credentials: params.credentials,
      credentialsLockHeld: params.credentialsLockHeld,
      fetch: params.fetch,
      headers: params.headers,
      now,
      orgSelection,
    });
  }
  assertOrgBoundSelection(params.credentials, orgSelection);
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
    if (current.auth_method === "user_grant") {
      // Replaced by a user login while this command waited for the lock.
      return ensureUserGrantSession({
        apiBaseUrl: params.apiBaseUrl,
        configDir: params.configDir,
        credentials: current,
        credentialsLockHeld: true,
        fetch: params.fetch,
        headers: params.headers,
        now,
        orgSelection,
      });
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

/** Thrown before any request or token refresh when a command needs a connected agent key. */
export class ConnectedAgentKeyRequiredError extends Error {}

export async function createAuthenticatedCliApiClient(params: {
  configDir: string;
  apiKey?: string;
  apiBaseUrl?: string;
  env?: Env;
  fetch?: FetchFn;
  now?: () => number;
  credentialsLockHeld?: boolean;
  /** Refuse any other credential before it is refreshed or sent. */
  requireConnectedAgentKey?: boolean;
}) {
  const requestConfig = resolveCliApiRequestConfig(params);
  let auth = resolveCliAuth({
    apiKey: params.apiKey,
    apiBaseUrl: requestConfig.apiBaseUrl,
    configDir: params.configDir,
    env: params.env,
  });
  // PRIMITIVE_KEY rename trap: if the user set PRIMITIVE_KEY (an older
  // / common mistake) but no PRIMITIVE_API_KEY, the resolver returns no
  // key and the API call below will 401 from the very first command.
  // Surface the rename hint to stderr proactively so the user does not
  // have to discover it via `primitive doctor` after the fact.
  if (auth.apiKey === undefined) {
    const hint = detectPrimitiveKeyEnvMisname(
      (params.env ?? process.env) as NodeJS.ProcessEnv,
    );
    if (hint) process.stderr.write(`${hint}\n`);
  }
  if (
    params.requireConnectedAgentKey &&
    (auth.source === "stored" || !auth.apiKey?.startsWith("pconn_"))
  )
    throw new ConnectedAgentKeyRequiredError(
      "A connected agent credential is required.",
    );
  const orgSelection = selectedOrgFromEnv(params.env ?? process.env);
  if (orgSelection && auth.source !== "stored") {
    throw new Errors.CLIError(
      `--org (PRIMITIVE_CLI_ORG=${orgSelection}) selects an organization for a saved \`primitive login\`. ${
        auth.source === "connected-profile"
          ? "A connected agent profile"
          : auth.source === "flag-or-env"
            ? "An API key"
            : "This command's credential"
      } belongs to one organization; drop --org, or unset PRIMITIVE_CLI_ORG.`,
      { exit: 1 },
    );
  }
  let userLoginToken: { current: string } | null = null;
  if (auth.source === "stored" && auth.credentials) {
    const refreshed = await refreshStoredCliCredentials({
      apiBaseUrl: auth.apiBaseUrl,
      configDir: params.configDir,
      credentials: auth.credentials,
      credentialsLockHeld: params.credentialsLockHeld,
      fetch: params.fetch,
      headers: requestConfig.headers,
      now: params.now,
      orgSelection,
    });
    auth = {
      ...auth,
      apiKey: refreshed.access_token,
      credentials: refreshed,
    };
    if (refreshed.auth_method === "user_grant") {
      userLoginToken = { current: refreshed.access_token };
    }
  }
  const tokenHolder = userLoginToken;
  return {
    apiClient: new PrimitiveApiClient({
      ...(tokenHolder && auth.credentials
        ? {
            // A per-org token from a user login: send whatever token the
            // last exchange produced, and exchange again on a 401.
            auth: (security: { type?: string; scheme?: string }) =>
              security.type === "http" && security.scheme === "bearer"
                ? tokenHolder.current
                : undefined,
            fetch: reexchangingFetch({
              reexchange: savedLoginReexchange({
                apiBaseUrl: auth.apiBaseUrl,
                configDir: params.configDir,
                fetch: params.fetch,
                headers: requestConfig.headers,
                now: params.now,
                orgId: auth.credentials.org_id,
              }),
              token: tokenHolder,
            }),
          }
        : { apiKey: auth.apiKey }),
      apiBaseUrl: auth.apiBaseUrl,
      // A connected profile is bound to its trusted claim origin; ambient
      // request-header configuration is not part of that private profile.
      headers: auth.connectedAgent ? undefined : requestConfig.headers,
    }),
    auth,
    baseUrlOverridden: requestConfig.baseUrlOverridden,
    requestConfig,
  };
}
