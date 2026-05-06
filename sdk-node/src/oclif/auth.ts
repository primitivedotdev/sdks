import {
  chmodSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { DEFAULT_BASE_URL } from "../api/index.js";

const CREDENTIALS_FILE = "credentials.json";

export type StoredCliCredentials = {
  api_key: string;
  key_id: string;
  key_prefix: string;
  org_id: string;
  org_name: string | null;
  base_url: string;
  created_at: string;
};

export type ResolvedCliAuth = {
  apiKey: string | undefined;
  baseUrl: string;
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
      "Stored Primitive CLI credentials are malformed. Run `primitive logout` and then `primitive login`.",
    );
  }
  return raw;
}

function parseCredentials(raw: unknown): StoredCliCredentials {
  if (!isRecord(raw)) {
    throw new Error(
      "Stored Primitive CLI credentials are malformed. Run `primitive logout` and then `primitive login`.",
    );
  }

  const orgName = raw.org_name;
  if (orgName !== null && typeof orgName !== "string") {
    throw new Error(
      "Stored Primitive CLI credentials are malformed. Run `primitive logout` and then `primitive login`.",
    );
  }

  return {
    api_key: requireString(raw, "api_key"),
    key_id: requireString(raw, "key_id"),
    key_prefix: requireString(raw, "key_prefix"),
    org_id: requireString(raw, "org_id"),
    org_name: orgName,
    base_url: requireString(raw, "base_url"),
    created_at: requireString(raw, "created_at"),
  };
}

export function credentialsPath(configDir: string): string {
  return join(configDir, CREDENTIALS_FILE);
}

export function normalizeBaseUrl(baseUrl: string | undefined): string {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return DEFAULT_BASE_URL;
  return trimmed.replace(/\/+$/, "");
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
  writeFileSync(path, `${JSON.stringify(credentials, null, 2)}\n`, {
    mode: 0o600,
  });
  chmodSync(path, 0o600);
}

export function deleteCliCredentials(configDir: string): void {
  rmSync(credentialsPath(configDir), { force: true });
}

export function resolveCliAuth(params: {
  configDir: string;
  apiKey?: string;
  baseUrl?: string;
}): ResolvedCliAuth {
  const apiKey = params.apiKey?.trim();
  if (apiKey) {
    return {
      apiKey,
      baseUrl: normalizeBaseUrl(params.baseUrl),
      credentials: null,
      source: "flag-or-env",
    };
  }

  const credentials = loadCliCredentials(params.configDir);
  if (credentials) {
    return {
      apiKey: credentials.api_key,
      baseUrl: params.baseUrl
        ? normalizeBaseUrl(params.baseUrl)
        : credentials.base_url,
      credentials,
      source: "stored",
    };
  }

  return {
    apiKey: undefined,
    baseUrl: normalizeBaseUrl(params.baseUrl),
    credentials: null,
    source: "none",
  };
}
