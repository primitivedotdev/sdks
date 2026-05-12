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
const CREDENTIALS_LOCK_STALE_MS = 30 * 60 * 1000;
const MALFORMED_CREDENTIALS_HINT =
  "Run `primitive logout` and then `primitive login`.";

// Disk shape for saved CLI credentials. Only persists the primary
// API host (api_base_url_1) because login is itself an operation on
// that host; the secondary host (api_base_url_2) is for /send-mail
// and isn't part of the login flow, so it never gets stored. At call
// time api_base_url_2 falls back to env / production default.
export type StoredCliCredentials = {
  api_key: string;
  key_id: string;
  key_prefix: string;
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
 * Sentinel returned by parseCredentials when the on-disk credentials
 * were written by a pre-dual-host CLI version (i.e. they have
 * `base_url` instead of `api_base_url_1`). The caller treats this as
 * "no saved credentials" after auto-cleaning the stale file. Defined
 * as a class-tagged error so loadCliCredentials can distinguish it
 * from a genuine malformed-credentials error.
 */
class StaleCredentialFormatError extends Error {
  constructor() {
    super("stale_credential_format");
    this.name = "StaleCredentialFormatError";
  }
}

function parseCredentials(raw: unknown): StoredCliCredentials {
  if (!isRecord(raw)) {
    throw new Error(
      `Stored Primitive CLI credentials are malformed: expected a JSON object. ${MALFORMED_CREDENTIALS_HINT}`,
    );
  }

  // Stored credentials from an older CLI version used the field name
  // `base_url`; the dual-host rename moved this to `api_base_url_1`.
  // Detect the old shape specifically so loadCliCredentials can wipe
  // the stale file and emit a clear "you've been logged out" notice
  // instead of every command hard-failing with a generic "malformed"
  // error that doesn't surface the actual fix (re-login).
  if (
    typeof raw.api_base_url_1 !== "string" &&
    typeof (raw as { base_url?: unknown }).base_url === "string"
  ) {
    throw new StaleCredentialFormatError();
  }

  const orgName = raw.org_name;
  if (orgName !== null && typeof orgName !== "string") {
    throw new Error(
      `Stored Primitive CLI credentials are malformed: org_name must be a string or null. ${MALFORMED_CREDENTIALS_HINT}`,
    );
  }

  return {
    api_key: requireString(raw, "api_key"),
    key_id: requireString(raw, "key_id"),
    key_prefix: requireString(raw, "key_prefix"),
    org_id: requireString(raw, "org_id"),
    org_name: orgName,
    api_base_url_1: requireString(raw, "api_base_url_1"),
    created_at: requireString(raw, "created_at"),
  };
}

export function credentialsPath(configDir: string): string {
  return join(configDir, CREDENTIALS_FILE);
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
    if (error instanceof StaleCredentialFormatError) {
      // Saved credentials were written by a pre-dual-host CLI version.
      // The format is incompatible (base_url vs api_base_url_1) and
      // cannot be recovered. Clear the file so the caller sees "no
      // saved credentials" and emit a one-shot notice telling the
      // user they need to log back in. Idempotent: once the file is
      // gone, this branch never fires again.
      try {
        rmSync(path, { force: true });
      } catch {
        // Best-effort cleanup; if the unlink fails (permissions,
        // racing process), the next CLI invocation will hit this
        // path again and try once more.
      }
      process.stderr.write(
        "You've been logged out: your saved Primitive CLI credentials were created by an older CLI version and are no longer compatible. Run `primitive login` to re-authenticate.\n",
      );
      return null;
    }
    if (error instanceof SyntaxError) {
      throw new Error(
        "Stored Primitive CLI credentials are not valid JSON. Run `primitive logout` and then `primitive login`.",
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

export function acquireCliCredentialsLock(
  configDir: string,
  options: { now?: () => number; staleMs?: number } = {},
): () => void {
  mkdirSync(configDir, { mode: 0o700, recursive: true });
  const lockPath = join(configDir, CREDENTIALS_LOCK_DIR);
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
      if (removeStaleCliCredentialsLock(lockPath, staleMs, now)) continue;
      throw new Error(
        "Another Primitive CLI credential operation is already in progress. Wait for it to finish, then retry.",
      );
    }
  }
  if (!acquired) {
    throw new Error(
      "Another Primitive CLI credential operation is already in progress. Wait for it to finish, then retry.",
    );
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
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
      apiKey: credentials.api_key,
      apiBaseUrl1: params.apiBaseUrl1
        ? normalizeApiBaseUrl1(params.apiBaseUrl1)
        : credentials.api_base_url_1,
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
