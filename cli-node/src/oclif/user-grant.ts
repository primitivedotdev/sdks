/**
 * CLI user logins: a login as the person, not bound to one organization,
 * that switches between the person's organizations without logging in again.
 *
 * The saved login holds the person's identity token (`prim_uat_`, short
 * lived) and refresh token (`prim_urt_`). Neither calls the API: the
 * identity token only lists organizations (`GET /v1/cli/orgs`) and is
 * exchanged (RFC 8693, at `/oauth/token`) for a short-lived access token in
 * one organization. That per-org token is what every other command sends.
 * It cannot be refreshed, so the CLI exchanges again when it expires or
 * when the API answers 401.
 *
 * Saved logins made by older CLIs, and logins against servers without this
 * feature, keep their org-bound OAuth format (`auth_method: "oauth"`) and
 * never reach this module.
 */
import { Errors } from "@oclif/core";
import {
  acquireCliCredentialsLock,
  cliAccessTokenExpiresAt,
  deleteCliCredentials,
  loadCliCredentials,
  type StoredCliCredentials,
  type StoredCliOrgToken,
  type StoredCliUserGrant,
  saveCliCredentials,
} from "./auth.js";

export { ORG_SELECTION_ENV } from "./global-org-flag.js";

export const TOKEN_EXCHANGE_GRANT_TYPE =
  "urn:ietf:params:oauth:grant-type:token-exchange";
export const ACCESS_TOKEN_TYPE =
  "urn:ietf:params:oauth:token-type:access_token";

/** Exchange or refresh this long before a token's stated expiry. */
const TOKEN_SKEW_MS = 60 * 1000;
/** Cached tokens for organizations other than the current one. */
const MAX_CACHED_ORG_TOKENS = 20;

export const USER_LOGIN_EXPIRED_MESSAGE =
  "Saved Primitive CLI login expired or was revoked. Run `primitive login` to sign in again.";

export const NO_CURRENT_ORG_MESSAGE =
  "No organization is selected for this login. Run `primitive orgs` to see where you can use the CLI, then `primitive org use <org>`.";

/** Why the CLI cannot be used in an organization, as the server names it. */
export type CliOrgRefusalReason =
  | "not_a_member"
  | "cli_access_disabled_by_org"
  | "role_insufficient"
  | "cli_access_revoked";

const REFUSAL_FALLBACK_MESSAGES: Record<string, string> = {
  not_a_member: "You are not a member of this organization.",
  cli_access_disabled_by_org: "This organization does not allow CLI access.",
  role_insufficient:
    "Your role in this organization does not allow CLI access. Ask an owner or admin to allow CLI access for members.",
  cli_access_revoked:
    "Your CLI access to this organization was revoked. Run `primitive login` again to sign in afresh.",
  grant_not_available:
    "The requested grant is not available for CLI logins on this server.",
};

type FetchFn = typeof fetch;

export type CliOrgAccessToken = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope?: string;
  org_id: string;
  org_name: string | null;
  role: string;
  oauth_grant_id: string;
};

export type CliOrgEntry = {
  id: string;
  name: string | null;
  role?: string | null;
  available: boolean;
  reason: string | null;
  message?: string | null;
};

export type CliOrgList = {
  user: { id: string; email: string | null };
  user_grant_id: string;
  orgs: CliOrgEntry[];
};

/** A refusal from the exchange or the org list, with the server's reason. */
export class CliOrgRefusedError extends Errors.CLIError {
  readonly reason: string;
  readonly orgId: string | null;

  constructor(params: {
    message: string;
    reason: string;
    orgId: string | null;
  }) {
    super(params.message, { code: params.reason, exit: 1 });
    this.reason = params.reason;
    this.orgId = params.orgId;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function apiOrigin(apiBaseUrl: string): URL {
  const url = new URL(apiBaseUrl);
  url.search = "";
  url.hash = "";
  return url;
}

export function oauthEndpoint(apiBaseUrl: string, path: string): string {
  const url = apiOrigin(apiBaseUrl);
  url.pathname = path;
  return url.toString();
}

function cliOrgsEndpoint(apiBaseUrl: string): string {
  const url = apiOrigin(apiBaseUrl);
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/cli/orgs`;
  return url.toString();
}

function expiringSoon(expiresAt: string, now: () => number): boolean {
  const at = Date.parse(expiresAt);
  return !Number.isFinite(at) || at <= now() + TOKEN_SKEW_MS;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isOrgAccessToken(value: unknown): value is CliOrgAccessToken {
  return (
    isRecord(value) &&
    typeof value.access_token === "string" &&
    value.access_token.length > 0 &&
    value.token_type === "Bearer" &&
    typeof value.expires_in === "number" &&
    value.expires_in > 0 &&
    typeof value.org_id === "string" &&
    (value.org_name === null || typeof value.org_name === "string") &&
    typeof value.oauth_grant_id === "string"
  );
}

export function orgTokenFromResponse(
  token: CliOrgAccessToken,
  now: () => number = Date.now,
): StoredCliOrgToken {
  return {
    access_token: token.access_token,
    expires_at: cliAccessTokenExpiresAt(token.expires_in, now),
    oauth_grant_id: token.oauth_grant_id,
    org_id: token.org_id,
    org_name: token.org_name ?? null,
    role: typeof token.role === "string" ? token.role : null,
  };
}

/**
 * The org-bound view every other command reads: the per-org token in the
 * standard fields, the person's grant kept alongside.
 */
export function credentialsForOrg(
  credentials: StoredCliCredentials,
  org: StoredCliOrgToken,
): StoredCliCredentials {
  return {
    ...credentials,
    access_token: org.access_token,
    expires_at: org.expires_at,
    oauth_grant_id: org.oauth_grant_id,
    org_id: org.org_id,
    org_name: org.org_name,
  };
}

function requireUserGrant(
  credentials: StoredCliCredentials,
): StoredCliUserGrant {
  if (credentials.auth_method !== "user_grant" || !credentials.user_grant) {
    throw new Errors.CLIError(
      "This saved login is bound to one organization. Run `primitive logout`, then `primitive login`, to sign in as yourself and switch between organizations.",
      { exit: 1 },
    );
  }
  return credentials.user_grant;
}

type TokenEndpointResult =
  | { ok: true; payload: Record<string, unknown> }
  | {
      ok: false;
      status: number;
      error: string | null;
      description: string | null;
      reason: string | null;
    };

async function postTokenEndpoint(params: {
  apiBaseUrl: string;
  body: Record<string, string>;
  fetch?: FetchFn;
  headers?: Record<string, string>;
  path?: string;
  /** Revocation answers 200 with an empty or non-JSON body. */
  allowEmptySuccess?: boolean;
}): Promise<TokenEndpointResult> {
  const fetchImpl = params.fetch ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(
      oauthEndpoint(params.apiBaseUrl, params.path ?? "/oauth/token"),
      {
        body: new URLSearchParams(params.body),
        headers: {
          ...(params.headers ?? {}),
          "content-type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Errors.CLIError(
      `Could not reach the Primitive OAuth token endpoint: ${detail}`,
      { exit: 1 },
    );
  }
  const payload: unknown = await response.json().catch(() => null);
  if (response.ok && isRecord(payload)) return { ok: true, payload };
  if (response.ok && params.allowEmptySuccess) return { ok: true, payload: {} };
  const record = isRecord(payload) ? payload : {};
  return {
    ok: false,
    status: response.status,
    error: typeof record.error === "string" ? record.error : null,
    description:
      typeof record.error_description === "string"
        ? record.error_description
        : null,
    reason: typeof record.reason === "string" ? record.reason : null,
  };
}

/**
 * Refresh the identity token when it is about to expire. The refresh token
 * rotates on every use, so the new pair is saved before it is used.
 * `invalid_grant` means the login is gone: the saved login is removed.
 */
async function freshIdentity(params: {
  apiBaseUrl: string;
  configDir: string;
  credentials: StoredCliCredentials;
  fetch?: FetchFn;
  force?: boolean;
  headers?: Record<string, string>;
  now: () => number;
}): Promise<StoredCliCredentials> {
  const grant = requireUserGrant(params.credentials);
  if (!params.force && !expiringSoon(grant.expires_at, params.now)) {
    return params.credentials;
  }
  const result = await postTokenEndpoint({
    apiBaseUrl: params.apiBaseUrl,
    body: {
      client_id: params.credentials.oauth_client_id,
      grant_type: "refresh_token",
      refresh_token: params.credentials.refresh_token,
    },
    fetch: params.fetch,
    headers: params.headers,
  });
  if (!result.ok) {
    if (result.error === "invalid_grant") {
      deleteCliCredentials(params.configDir);
      throw new Errors.CLIError(USER_LOGIN_EXPIRED_MESSAGE, { exit: 1 });
    }
    throw new Errors.CLIError(
      `Could not refresh the saved Primitive CLI login${result.description ? `: ${result.description}` : "."}`,
      { exit: 1 },
    );
  }
  const payload = result.payload;
  if (
    typeof payload.access_token !== "string" ||
    typeof payload.refresh_token !== "string" ||
    typeof payload.expires_in !== "number" ||
    payload.expires_in <= 0
  ) {
    throw new Errors.CLIError(
      "Primitive OAuth token endpoint returned an unexpected refresh response.",
      { exit: 1 },
    );
  }
  const next: StoredCliCredentials = {
    ...params.credentials,
    refresh_token: payload.refresh_token,
    user_grant: {
      ...grant,
      access_token: payload.access_token,
      expires_at: cliAccessTokenExpiresAt(payload.expires_in, params.now),
    },
  };
  saveCliCredentials(params.configDir, next);
  return next;
}

function refusalMessage(
  reason: string | null,
  description: string | null,
): string {
  return (
    description ??
    (reason ? REFUSAL_FALLBACK_MESSAGES[reason] : undefined) ??
    "Primitive refused access to this organization."
  );
}

/** One exchange of the identity token for an access token in `orgId`. */
export async function exchangeForOrg(params: {
  apiBaseUrl: string;
  clientId: string;
  fetch?: FetchFn;
  headers?: Record<string, string>;
  identityToken: string;
  orgId: string;
  requestedGrant?: string | null;
}): Promise<
  | { ok: true; token: CliOrgAccessToken }
  | {
      ok: false;
      status: number;
      error: string | null;
      description: string | null;
      reason: string | null;
    }
> {
  const body: Record<string, string> = {
    client_id: params.clientId,
    grant_type: TOKEN_EXCHANGE_GRANT_TYPE,
    org: params.orgId,
    subject_token: params.identityToken,
    subject_token_type: ACCESS_TOKEN_TYPE,
  };
  if (params.requestedGrant) body.requested_grant = params.requestedGrant;
  const result = await postTokenEndpoint({
    apiBaseUrl: params.apiBaseUrl,
    body,
    fetch: params.fetch,
    headers: params.headers,
  });
  if (!result.ok) return result;
  if (!isOrgAccessToken(result.payload)) {
    throw new Errors.CLIError(
      "Primitive OAuth token endpoint returned an unexpected token exchange response.",
      { exit: 1 },
    );
  }
  return { ok: true, token: result.payload };
}

/**
 * Exchange for `orgId`, refreshing the identity token first when needed and
 * once more if the exchange says it expired. Saves the result: as the
 * current organization when `makeCurrent`, otherwise in the per-org cache.
 * Must run while the credentials lock is held.
 */
async function exchangeAndSave(params: {
  apiBaseUrl: string;
  configDir: string;
  credentials: StoredCliCredentials;
  fetch?: FetchFn;
  headers?: Record<string, string>;
  makeCurrent: boolean;
  now: () => number;
  orgId: string;
}): Promise<{ credentials: StoredCliCredentials; org: StoredCliOrgToken }> {
  let credentials = await freshIdentity(params);
  let attempt = 0;
  for (;;) {
    const grant = requireUserGrant(credentials);
    const result = await exchangeForOrg({
      apiBaseUrl: params.apiBaseUrl,
      clientId: credentials.oauth_client_id,
      fetch: params.fetch,
      headers: params.headers,
      identityToken: grant.access_token,
      orgId: params.orgId,
      requestedGrant: grant.requested_grant ?? null,
    });
    if (result.ok) {
      const org = orgTokenFromResponse(result.token, params.now);
      const saved = saveOrgToken(credentials, org, params.makeCurrent);
      saveCliCredentials(params.configDir, saved);
      return { credentials: saved, org };
    }
    if (result.error === "invalid_grant" && attempt === 0) {
      attempt += 1;
      credentials = await freshIdentity({
        ...params,
        credentials,
        force: true,
      });
      continue;
    }
    if (result.error === "invalid_grant") {
      deleteCliCredentials(params.configDir);
      throw new Errors.CLIError(USER_LOGIN_EXPIRED_MESSAGE, { exit: 1 });
    }
    if (result.error === "unsupported_grant_type") {
      throw new Errors.CLIError(
        "This Primitive server does not support switching organizations for CLI logins. Run `primitive logout`, then `primitive login`, to sign in to one organization.",
        { exit: 1 },
      );
    }
    if (result.reason) {
      throw new CliOrgRefusedError({
        message: refusalMessage(result.reason, result.description),
        orgId: params.orgId,
        reason: result.reason,
      });
    }
    throw new Errors.CLIError(
      `Could not get an access token for organization ${params.orgId}${result.description ? `: ${result.description}` : "."}`,
      { exit: 1 },
    );
  }
}

function saveOrgToken(
  credentials: StoredCliCredentials,
  org: StoredCliOrgToken,
  makeCurrent: boolean,
): StoredCliCredentials {
  const grant = requireUserGrant(credentials);
  const cache = { ...grant.org_tokens };
  if (makeCurrent) {
    // The previous current organization's token stays usable through --org.
    if (credentials.org_id && credentials.access_token) {
      cache[credentials.org_id] = {
        access_token: credentials.access_token,
        expires_at: credentials.expires_at,
        oauth_grant_id: credentials.oauth_grant_id,
        org_id: credentials.org_id,
        org_name: credentials.org_name,
        role: grant.org_role ?? null,
      };
    }
    delete cache[org.org_id];
    return {
      ...credentialsForOrg(credentials, org),
      user_grant: {
        ...grant,
        org_role: org.role,
        org_tokens: pruneOrgTokens(cache),
      },
    };
  }
  if (org.org_id === credentials.org_id) {
    return {
      ...credentialsForOrg(credentials, org),
      user_grant: { ...grant, org_role: org.role },
    };
  }
  cache[org.org_id] = org;
  return {
    ...credentials,
    user_grant: { ...grant, org_tokens: pruneOrgTokens(cache) },
  };
}

function pruneOrgTokens(
  cache: Record<string, StoredCliOrgToken>,
): Record<string, StoredCliOrgToken> {
  const entries = Object.entries(cache).sort(
    ([, left], [, right]) =>
      Date.parse(right.expires_at) - Date.parse(left.expires_at),
  );
  return Object.fromEntries(entries.slice(0, MAX_CACHED_ORG_TOKENS));
}

/** The organizations the person can switch to. */
export async function fetchCliOrgs(params: {
  apiBaseUrl: string;
  configDir: string;
  credentials: StoredCliCredentials;
  credentialsLockHeld?: boolean;
  fetch?: FetchFn;
  headers?: Record<string, string>;
  now?: () => number;
}): Promise<CliOrgList> {
  const now = params.now ?? Date.now;
  let credentials = params.credentials;
  requireUserGrant(credentials);
  const grant = credentials.user_grant as StoredCliUserGrant;
  if (expiringSoon(grant.expires_at, now)) {
    credentials = await withLock(params, () => {
      const current = loadCliCredentials(params.configDir) ?? credentials;
      return freshIdentity({ ...params, credentials: current, now });
    });
  }
  const request = async (token: string) =>
    (params.fetch ?? fetch)(cliOrgsEndpoint(params.apiBaseUrl), {
      headers: { ...(params.headers ?? {}), authorization: `Bearer ${token}` },
      method: "GET",
    });
  let response = await request(
    (credentials.user_grant as StoredCliUserGrant).access_token,
  );
  if (response.status === 401) {
    credentials = await withLock(params, () => {
      const current = loadCliCredentials(params.configDir) ?? credentials;
      return freshIdentity({
        ...params,
        credentials: current,
        force: true,
        now,
      });
    });
    response = await request(
      (credentials.user_grant as StoredCliUserGrant).access_token,
    );
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error =
      isRecord(payload) && isRecord(payload.error) ? payload.error : {};
    if (response.status === 404 && error.code === "feature_disabled") {
      throw new Errors.CLIError(
        "This Primitive server does not support switching organizations for CLI logins.",
        { exit: 1 },
      );
    }
    throw new Errors.CLIError(
      `Could not list organizations${typeof error.message === "string" ? `: ${error.message}` : ` (HTTP ${response.status}).`}`,
      { exit: 1 },
    );
  }
  const data = isRecord(payload) ? payload.data : null;
  if (!isRecord(data) || !Array.isArray(data.orgs)) {
    throw new Errors.CLIError(
      "Primitive API returned an unexpected organization list.",
      { exit: 1 },
    );
  }
  return data as unknown as CliOrgList;
}

/** How long a command waits for another CLI process to finish with the saved login. */
const LOCK_WAIT_MS = 15_000;
const LOCK_RETRY_MS = 100;

function isLockBusy(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.startsWith(
      "Another Primitive CLI credential operation is already in progress",
    )
  );
}

/**
 * Run `fn` holding the credentials lock. Exchanges happen every few minutes
 * and from parallel commands, so a busy lock is waited for (briefly) rather
 * than refused; callers re-read the saved login once they hold it.
 */
async function withLock<T>(
  params: {
    configDir: string;
    credentialsLockHeld?: boolean;
    now?: () => number;
  },
  fn: () => Promise<T>,
): Promise<T> {
  let release: (() => void) | undefined;
  if (!params.credentialsLockHeld) {
    const deadline = Date.now() + LOCK_WAIT_MS;
    for (;;) {
      try {
        release = acquireCliCredentialsLock(params.configDir);
        break;
      } catch (error) {
        if (isLockBusy(error) && Date.now() < deadline) {
          await new Promise((done) => setTimeout(done, LOCK_RETRY_MS));
          continue;
        }
        if (isLockBusy(error)) {
          throw new Errors.CLIError(
            "Another Primitive CLI command is still updating the saved login. Retry in a moment.",
            { exit: 1 },
          );
        }
        const detail = error instanceof Error ? error.message : String(error);
        throw new Errors.CLIError(detail, { exit: 1 });
      }
    }
  }
  try {
    return await fn();
  } finally {
    release?.();
  }
}

/**
 * Match `selection` (an organization id, or a name) against the person's
 * organizations. Ids pass through without a lookup.
 */
export function matchOrg(
  selection: string,
  orgs: readonly CliOrgEntry[],
): CliOrgEntry {
  const wanted = selection.trim();
  const byId = orgs.find(
    (org) => org.id.toLowerCase() === wanted.toLowerCase(),
  );
  if (byId) return byId;
  const byName = orgs.filter(
    (org) => (org.name ?? "").trim().toLowerCase() === wanted.toLowerCase(),
  );
  if (byName.length === 1) return byName[0] as CliOrgEntry;
  if (byName.length > 1) {
    throw new Errors.CLIError(
      `More than one organization is named ${JSON.stringify(wanted)}. Use its id: ${byName.map((org) => org.id).join(", ")}.`,
      { exit: 1 },
    );
  }
  throw new Errors.CLIError(
    `No organization matches ${JSON.stringify(wanted)}. Run \`primitive orgs\` to list yours.`,
    { exit: 1 },
  );
}

/** Resolve an `--org` value to an organization id, listing orgs only for a name. */
export async function resolveOrgSelection(params: {
  apiBaseUrl: string;
  configDir: string;
  credentials: StoredCliCredentials;
  credentialsLockHeld?: boolean;
  fetch?: FetchFn;
  headers?: Record<string, string>;
  now?: () => number;
  selection: string;
}): Promise<string> {
  const selection = params.selection.trim();
  if (isUuid(selection)) return selection.toLowerCase();
  // Names are always matched against the full list, so a name two
  // organizations share is refused rather than resolved to whichever one
  // happens to be cached.
  requireUserGrant(params.credentials);
  const list = await fetchCliOrgs(params);
  return matchOrg(selection, list.orgs).id;
}

/**
 * The org-bound credentials for this command: the current organization, or
 * `orgSelection` (from `--org`) when given. Exchanges when the token for
 * that organization is missing or about to expire.
 */
export async function ensureUserGrantSession(params: {
  apiBaseUrl: string;
  configDir: string;
  credentials: StoredCliCredentials;
  credentialsLockHeld?: boolean;
  fetch?: FetchFn;
  forceExchange?: boolean;
  headers?: Record<string, string>;
  now?: () => number;
  orgSelection?: string | null;
  /**
   * With `forceExchange`: the token the API just rejected. If another
   * process has already replaced it, that replacement is used.
   */
  staleToken?: string;
}): Promise<StoredCliCredentials> {
  const now = params.now ?? Date.now;
  requireUserGrant(params.credentials);
  const raw = params.orgSelection?.trim() || null;
  const selection =
    raw === null
      ? null
      : await resolveOrgSelection({
          ...params,
          credentials: params.credentials,
          now,
          selection: raw,
        });
  const fast = usableOrgToken(params.credentials, selection, now);
  if (fast && !params.forceExchange) return fast;

  return withLock(params, async () => {
    const current = loadCliCredentials(params.configDir);
    if (!current) {
      throw new Errors.CLIError(USER_LOGIN_EXPIRED_MESSAGE, { exit: 1 });
    }
    requireUserGrant(current);
    const orgId = selection ?? (current.org_id || null);
    if (!orgId) throw new Errors.CLIError(NO_CURRENT_ORG_MESSAGE, { exit: 1 });
    const saved = usableOrgToken(current, orgId, now);
    if (
      saved &&
      (!params.forceExchange ||
        (params.staleToken !== undefined &&
          saved.access_token !== params.staleToken))
    ) {
      return saved;
    }
    const { credentials, org } = await exchangeAndSave({
      apiBaseUrl: params.apiBaseUrl,
      configDir: params.configDir,
      credentials: current,
      fetch: params.fetch,
      headers: params.headers,
      makeCurrent: false,
      now,
      orgId,
    });
    return credentialsForOrg(credentials, org);
  });
}

function usableOrgToken(
  credentials: StoredCliCredentials,
  selection: string | null,
  now: () => number,
): StoredCliCredentials | null {
  const grant = credentials.user_grant;
  if (!grant) return null;
  // `selection` is an organization id (names are resolved first), or null
  // for the current organization.
  const wanted = selection?.toLowerCase() ?? null;
  const matchesCurrent =
    wanted === null || wanted === credentials.org_id.toLowerCase();
  if (matchesCurrent) {
    if (!credentials.org_id || !credentials.access_token) return null;
    return expiringSoon(credentials.expires_at, now) ? null : credentials;
  }
  const cached = Object.values(grant.org_tokens).find(
    (token) => token.org_id.toLowerCase() === wanted,
  );
  if (!cached || expiringSoon(cached.expires_at, now)) return null;
  return credentialsForOrg(credentials, cached);
}

/** `primitive org use`: exchange for `selection` and make it the current organization. */
export async function switchCurrentOrg(params: {
  apiBaseUrl: string;
  configDir: string;
  credentialsLockHeld?: boolean;
  fetch?: FetchFn;
  headers?: Record<string, string>;
  now?: () => number;
  selection: string;
}): Promise<{ credentials: StoredCliCredentials; org: StoredCliOrgToken }> {
  const now = params.now ?? Date.now;
  return withLock(params, async () => {
    const current = loadCliCredentials(params.configDir);
    if (!current) {
      throw new Errors.CLIError("Not logged in. Run `primitive login` first.", {
        exit: 1,
      });
    }
    requireUserGrant(current);
    const orgId = await resolveOrgSelection({
      ...params,
      credentials: current,
      credentialsLockHeld: true,
      now,
    });
    // Resolving a name can refresh the identity token, which rotates the
    // refresh token on disk; exchange from what is saved now.
    const latest = loadCliCredentials(params.configDir);
    if (!latest) {
      throw new Errors.CLIError(USER_LOGIN_EXPIRED_MESSAGE, { exit: 1 });
    }
    return exchangeAndSave({
      apiBaseUrl: params.apiBaseUrl,
      configDir: params.configDir,
      credentials: latest,
      fetch: params.fetch,
      headers: params.headers,
      makeCurrent: true,
      now,
      orgId,
    });
  });
}

/**
 * Wrap `fetch` so a 401 on a per-org token is answered by one fresh
 * exchange and one retry, as the server asks. If the exchange is refused,
 * the caller sees a 403 carrying the refusal's reason as its error code.
 */
export function reexchangingFetch(params: {
  base?: FetchFn;
  reexchange: (
    staleToken: string,
  ) => Promise<
    | { ok: true; token: string }
    | { ok: false; status: number; code: string; message: string }
  >;
  token: { current: string };
}): FetchFn {
  const base: FetchFn = (input, init) =>
    (params.base ?? globalThis.fetch)(input, init);
  let pending: Promise<
    | { ok: true; token: string }
    | { ok: false; status: number; code: string; message: string }
  > | null = null;
  const wrapped = async (
    input: Parameters<FetchFn>[0],
    init?: Parameters<FetchFn>[1],
  ): Promise<Response> => {
    const request = new Request(input, init);
    const sent = /^Bearer\s+(\S+)$/i.exec(
      request.headers.get("authorization") ?? "",
    )?.[1];
    const retry = request.clone();
    const response = await base(request);
    if (response.status !== 401 || !sent) return response;
    // One exchange for every request that saw the same stale token; a
    // request whose token was already replaced just retries with the new one.
    if (params.token.current === sent) {
      pending ??= params.reexchange(sent).finally(() => {
        pending = null;
      });
      const outcome = await pending;
      if (!outcome.ok) {
        return Response.json(
          {
            success: false,
            error: { code: outcome.code, message: outcome.message },
          },
          { status: outcome.status },
        );
      }
      params.token.current = outcome.token;
    }
    retry.headers.set("authorization", `Bearer ${params.token.current}`);
    return base(retry);
  };
  return wrapped as FetchFn;
}

/** The reexchange callback for `reexchangingFetch`, for a saved user login. */
export function savedLoginReexchange(params: {
  apiBaseUrl: string;
  configDir: string;
  fetch?: FetchFn;
  headers?: Record<string, string>;
  now?: () => number;
  orgId: string;
}): (
  staleToken: string,
) => Promise<
  | { ok: true; token: string }
  | { ok: false; status: number; code: string; message: string }
> {
  return async (staleToken) => {
    try {
      const current = loadCliCredentials(params.configDir);
      if (!current?.user_grant) {
        return {
          ok: false,
          status: 401,
          code: "unauthorized",
          message: USER_LOGIN_EXPIRED_MESSAGE,
        };
      }
      const next = await ensureUserGrantSession({
        apiBaseUrl: params.apiBaseUrl,
        configDir: params.configDir,
        credentials: current,
        fetch: params.fetch,
        forceExchange: true,
        headers: params.headers,
        now: params.now,
        orgSelection: params.orgId,
        staleToken,
      });
      return { ok: true, token: next.access_token };
    } catch (error) {
      if (error instanceof CliOrgRefusedError) {
        return {
          ok: false,
          status: 403,
          code: error.reason,
          message: error.message,
        };
      }
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, status: 401, code: "unauthorized", message };
    }
  };
}

/** Sign the person out of every organization by revoking the user login. */
export async function revokeUserLogin(params: {
  apiBaseUrl: string;
  credentials: StoredCliCredentials;
  fetch?: FetchFn;
  headers?: Record<string, string>;
}): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const result = await postTokenEndpoint({
    apiBaseUrl: params.apiBaseUrl,
    body: {
      client_id: params.credentials.oauth_client_id,
      token: params.credentials.refresh_token,
      token_type_hint: "refresh_token",
    },
    fetch: params.fetch,
    headers: params.headers,
    path: "/oauth/revoke",
    allowEmptySuccess: true,
  });
  if (result.ok) return { ok: true };
  return {
    ok: false,
    status: result.status,
    message:
      result.description ??
      result.error ??
      `The server answered HTTP ${result.status}.`,
  };
}

/** Build the saved credentials for a user login from the login poll. */
export function credentialsFromUserLogin(params: {
  apiBaseUrl: string;
  login: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    oauth_client_id: string;
    user_grant_id: string;
    user_id: string;
    org: unknown;
  };
  now?: () => number;
  requestedGrant?: string | null;
}): StoredCliCredentials {
  const now = params.now ?? Date.now;
  const org = isOrgAccessToken(params.login.org)
    ? orgTokenFromResponse(params.login.org, now)
    : null;
  return {
    access_token: org?.access_token ?? "",
    api_base_url: params.apiBaseUrl,
    auth_method: "user_grant",
    created_at: new Date(now()).toISOString(),
    expires_at: org?.expires_at ?? new Date(0).toISOString(),
    oauth_client_id: params.login.oauth_client_id,
    oauth_grant_id: org?.oauth_grant_id ?? "",
    org_id: org?.org_id ?? "",
    org_name: org?.org_name ?? null,
    refresh_token: params.login.refresh_token,
    token_type: "Bearer",
    user_grant: {
      access_token: params.login.access_token,
      expires_at: cliAccessTokenExpiresAt(params.login.expires_in, now),
      org_role: org?.role ?? null,
      org_tokens: {},
      requested_grant: params.requestedGrant ?? null,
      user_grant_id: params.login.user_grant_id,
      user_id: params.login.user_id,
    },
  };
}
