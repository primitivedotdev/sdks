import { randomUUID } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_API_BASE_URL_1,
  DEFAULT_API_BASE_URL_2,
} from "@primitivedotdev/api-core";

const CREDENTIALS_FILE = "credentials.json";
const CREDENTIALS_LOCK_DIR = "credentials.lock";
const CREDENTIALS_LOCK_OWNER_FILE = "owner.json";
const CREDENTIALS_LOCK_STALE_MS = 30 * 60 * 1000;
const MALFORMED_CREDENTIALS_HINT =
  "Run `primitive logout` and then `primitive signin`.";
const CREDENTIALS_LOCK_CLEANUP_SIGNALS = [
  "SIGINT",
  "SIGTERM",
  "SIGHUP",
] as const;

// Disk shape for saved CLI credentials. Only persists the primary
// API host (api_base_url_1) because login is itself an operation on
// that host; the secondary host (api_base_url_2) is for /send-mail
// and isn't part of the login flow, so it never gets stored. At call
// time api_base_url_2 falls back to env / production default.
export type StoredCliCredentials = {
  auth_method: "oauth";
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_at: string;
  oauth_grant_id: string;
  oauth_client_id: string;
  org_id: string;
  org_name: string | null;
  api_base_url_1: string;
  created_at: string;
};

export type ResolvedCliAuth = {
  apiKey: string | undefined;
  apiBaseUrl1: string;
  apiBaseUrl2: string;
  source: "flag-or-env" | "stored" | "none";
  credentials: StoredCliCredentials | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireString(
  value: Record<string, unknown>,
  key: keyof StoredCliCredentials,
): string {
  const raw = value[key];
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new Error(
      `Stored Primitive CLI credentials are malformed: ${key} must be a non-empty string. ${MALFORMED_CREDENTIALS_HINT}`,
    );
  }
  return raw;
}

/**
 * Sentinel returned by parseCredentials when the on-disk credentials were
 * written by an API-key-based CLI. The caller treats this as "not logged in"
 * after clearing the local file. The backing API key is intentionally not
 * revoked; API keys still work when passed explicitly via --api-key/env.
 */
class LegacyApiKeyCredentialFormatError extends Error {
  constructor() {
    super("legacy_api_key_credential_format");
    this.name = "LegacyApiKeyCredentialFormatError";
  }
}

function parseCredentials(raw: unknown): StoredCliCredentials {
  if (!isRecord(raw)) {
    throw new Error(
      `Stored Primitive CLI credentials are malformed: expected a JSON object. ${MALFORMED_CREDENTIALS_HINT}`,
    );
  }

  if (raw.auth_method !== "oauth") {
    if (
      typeof raw.api_key === "string" ||
      typeof raw.key_id === "string" ||
      typeof (raw as { base_url?: unknown }).base_url === "string"
    ) {
      throw new LegacyApiKeyCredentialFormatError();
    }
    throw new Error(
      `Stored Primitive CLI credentials are malformed: auth_method must be oauth. ${MALFORMED_CREDENTIALS_HINT}`,
    );
  }

  const orgName = raw.org_name;
  if (orgName !== null && typeof orgName !== "string") {
    throw new Error(
      `Stored Primitive CLI credentials are malformed: org_name must be a string or null. ${MALFORMED_CREDENTIALS_HINT}`,
    );
  }

  const tokenType = requireString(raw, "token_type");
  if (tokenType !== "Bearer") {
    throw new Error(
      `Stored Primitive CLI credentials are malformed: token_type must be Bearer. ${MALFORMED_CREDENTIALS_HINT}`,
    );
  }

  return {
    auth_method: "oauth",
    access_token: requireString(raw, "access_token"),
    refresh_token: requireString(raw, "refresh_token"),
    token_type: "Bearer",
    expires_at: requireString(raw, "expires_at"),
    oauth_grant_id: requireString(raw, "oauth_grant_id"),
    oauth_client_id: requireString(raw, "oauth_client_id"),
    org_id: requireString(raw, "org_id"),
    org_name: orgName,
    api_base_url_1: requireString(raw, "api_base_url_1"),
    created_at: requireString(raw, "created_at"),
  };
}

export function credentialsPath(configDir: string): string {
  return join(configDir, CREDENTIALS_FILE);
}

export function credentialsLockPath(configDir: string): string {
  return join(configDir, CREDENTIALS_LOCK_DIR);
}

function normalize(url: string | undefined, fallback: string): string {
  const trimmed = url?.trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/\/+$/, "");
}

export function normalizeApiBaseUrl1(url: string | undefined): string {
  return normalize(url, DEFAULT_API_BASE_URL_1);
}

export function normalizeApiBaseUrl2(url: string | undefined): string {
  return normalize(url, DEFAULT_API_BASE_URL_2);
}

export function cliAccessTokenExpiresAt(
  expiresInSeconds: number,
  now: () => number = Date.now,
): string {
  return new Date(now() + expiresInSeconds * 1000).toISOString();
}

export function loadCliCredentials(
  configDir: string,
): StoredCliCredentials | null {
  const path = credentialsPath(configDir);
  let contents: string;
  try {
    contents = readFileSync(path, "utf8");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      (error as { code?: unknown }).code === "ENOENT"
    ) {
      return null;
    }
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read Primitive CLI credentials: ${detail}`);
  }

  try {
    return parseCredentials(JSON.parse(contents));
  } catch (error) {
    if (error instanceof LegacyApiKeyCredentialFormatError) {
      try {
        rmSync(path, { force: true });
      } catch {
        // Best-effort cleanup; if unlink fails, the next CLI invocation
        // will hit this path again and try once more.
      }
      process.stderr.write(
        "Removed local Primitive CLI API-key login state. API keys are still valid when passed explicitly, but saved CLI auth now uses OAuth. Run `primitive signin` to create an OAuth session. No API key was revoked.\n",
      );
      return null;
    }
    if (error instanceof SyntaxError) {
      throw new Error(
        "Stored Primitive CLI credentials are not valid JSON. Run `primitive logout` and then `primitive signin`.",
      );
    }
    throw error;
  }
}

export function saveCliCredentials(
  configDir: string,
  credentials: StoredCliCredentials,
): void {
  mkdirSync(configDir, { mode: 0o700, recursive: true });
  const path = credentialsPath(configDir);
  const tempPath = join(
    configDir,
    `${CREDENTIALS_FILE}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    writeFileSync(tempPath, `${JSON.stringify(credentials, null, 2)}\n`, {
      mode: 0o600,
    });
    chmodSync(tempPath, 0o600);
    renameSync(tempPath, path);
    chmodSync(path, 0o600);
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw error;
  }
}

export function deleteCliCredentials(configDir: string): void {
  rmSync(credentialsPath(configDir), { force: true });
}

export function deleteCliCredentialsLock(configDir: string): void {
  rmSync(credentialsLockPath(configDir), { force: true, recursive: true });
}

function errorCode(error: unknown): unknown {
  return error && typeof error === "object"
    ? (error as { code?: unknown }).code
    : undefined;
}

function removeStaleCliCredentialsLock(
  lockPath: string,
  staleMs: number,
  now: () => number,
): boolean {
  try {
    const stats = statSync(lockPath);
    if (now() - stats.mtimeMs < staleMs) return false;
  } catch (error) {
    if (errorCode(error) === "ENOENT") return true;
    throw error;
  }

  rmSync(lockPath, { force: true, recursive: true });
  return true;
}

function readCliCredentialsLockOwner(lockPath: string): { pid: number } | null {
  let raw: string;
  try {
    raw = readFileSync(join(lockPath, CREDENTIALS_LOCK_OWNER_FILE), "utf8");
  } catch (error) {
    if (errorCode(error) === "ENOENT") return null;
    throw error;
  }

  try {
    const parsed = JSON.parse(raw);
    const pid = parsed?.pid;
    return Number.isInteger(pid) && pid > 0 ? { pid } : null;
  } catch {
    return null;
  }
}

function processIsRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = errorCode(error);
    if (code === "ESRCH") return false;
    // EPERM means another live process exists but cannot be signaled.
    return true;
  }
}

function removeDeadCliCredentialsLock(
  lockPath: string,
  isRunning: (pid: number) => boolean,
): boolean {
  const owner = readCliCredentialsLockOwner(lockPath);
  if (!owner) return false;
  if (isRunning(owner.pid)) return false;

  rmSync(lockPath, { force: true, recursive: true });
  return true;
}

function removeRecoverableCliCredentialsLock(params: {
  isRunning: (pid: number) => boolean;
  lockPath: string;
  now: () => number;
  staleMs: number;
}): boolean {
  if (removeDeadCliCredentialsLock(params.lockPath, params.isRunning)) {
    return true;
  }
  return removeStaleCliCredentialsLock(
    params.lockPath,
    params.staleMs,
    params.now,
  );
}

function writeCliCredentialsLockOwner(lockPath: string): void {
  const ownerPath = join(lockPath, CREDENTIALS_LOCK_OWNER_FILE);
  writeFileSync(
    ownerPath,
    `${JSON.stringify({
      created_at: new Date().toISOString(),
      pid: process.pid,
    })}\n`,
    { mode: 0o600 },
  );
  chmodSync(ownerPath, 0o600);
}

function installCredentialsLockSignalCleanup(lockPath: string): () => void {
  let active = true;
  const listeners = CREDENTIALS_LOCK_CLEANUP_SIGNALS.map((signal) => {
    const listener = () => {
      if (!active) return;
      active = false;
      rmSync(lockPath, { force: true, recursive: true });
      process.exit(
        signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 129,
      );
    };
    process.once(signal, listener);
    return { listener, signal };
  });

  return () => {
    if (!active) return;
    active = false;
    for (const { listener, signal } of listeners) {
      process.removeListener(signal, listener);
    }
  };
}

function credentialsLockInProgressMessage(lockPath: string): string {
  return `Another Primitive CLI credential operation is already in progress. Wait for it to finish, then retry. If no Primitive auth command is still running, run \`primitive logout --force\` to clear local CLI auth state and remove ${lockPath}.`;
}

export function acquireCliCredentialsLock(
  configDir: string,
  options: {
    installSignalHandlers?: boolean;
    isProcessRunning?: (pid: number) => boolean;
    now?: () => number;
    staleMs?: number;
  } = {},
): () => void {
  mkdirSync(configDir, { mode: 0o700, recursive: true });
  const lockPath = credentialsLockPath(configDir);
  const installSignalHandlers = options.installSignalHandlers ?? true;
  const isRunning = options.isProcessRunning ?? processIsRunning;
  const now = options.now ?? Date.now;
  const staleMs = options.staleMs ?? CREDENTIALS_LOCK_STALE_MS;
  let acquired = false;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      mkdirSync(lockPath, { mode: 0o700 });
      acquired = true;
      break;
    } catch (error) {
      if (errorCode(error) !== "EEXIST") throw error;
      if (
        removeRecoverableCliCredentialsLock({
          isRunning,
          lockPath,
          now,
          staleMs,
        })
      ) {
        continue;
      }
      throw new Error(credentialsLockInProgressMessage(lockPath));
    }
  }
  if (!acquired) {
    throw new Error(credentialsLockInProgressMessage(lockPath));
  }

  try {
    writeCliCredentialsLockOwner(lockPath);
  } catch (error) {
    rmSync(lockPath, { force: true, recursive: true });
    throw error;
  }

  const removeSignalCleanup = installSignalHandlers
    ? installCredentialsLockSignalCleanup(lockPath)
    : () => undefined;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    removeSignalCleanup();
    rmSync(lockPath, { force: true, recursive: true });
  };
}

export function resolveCliAuth(params: {
  configDir: string;
  apiKey?: string;
  apiBaseUrl1?: string;
  apiBaseUrl2?: string;
}): ResolvedCliAuth {
  const apiKey = params.apiKey?.trim();
  // Host 2 (api_base_url_2) is never stored; either set by env/flag or
  // falls back to the production default. The login flow only deals
  // with host 1.
  const apiBaseUrl2 = normalizeApiBaseUrl2(params.apiBaseUrl2);

  if (apiKey) {
    return {
      apiKey,
      apiBaseUrl1: normalizeApiBaseUrl1(params.apiBaseUrl1),
      apiBaseUrl2,
      credentials: null,
      source: "flag-or-env",
    };
  }

  const credentials = loadCliCredentials(params.configDir);
  if (credentials) {
    return {
      apiKey: credentials.access_token,
      apiBaseUrl1: credentials.api_base_url_1,
      apiBaseUrl2,
      credentials,
      source: "stored",
    };
  }

  return {
    apiKey: undefined,
    apiBaseUrl1: normalizeApiBaseUrl1(params.apiBaseUrl1),
    apiBaseUrl2,
    credentials: null,
    source: "none",
  };
}
