import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { normalizeApiBaseUrl } from "./auth.js";
import {
  DEFAULT_ENVIRONMENT,
  loadCliConfig,
  resolveConfigEnvironment,
} from "./cli-config.js";

const CREDENTIALS_FILE = "credentials.json";
const ROOT_AUTH_TIMEOUT_MS = 1_000;

type RootSignupHintOptions = {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  fetch?: typeof fetch;
  home?: string;
  timeoutMs?: number;
  write?: (message: string) => void;
};

type RootCredentials = {
  accessToken: string;
  apiBaseUrl: string;
};

// Who is signed in, from GET /whoami: the caller's own member address and
// organization. The account's email is the email it was opened with, which
// is not necessarily the caller's.
type RootIdentity = {
  memberAddress: string | null;
  orgId: string;
};

type RootRequestConfig = {
  apiBaseUrl: string;
  headers?: Record<string, string>;
};

function activeConfigDir(env: NodeJS.ProcessEnv, home: string): string {
  if (env.PRIMITIVE_CONFIG_DIR) return env.PRIMITIVE_CONFIG_DIR;
  const base = env.XDG_CONFIG_HOME || join(home, ".config");
  return join(base, "primitive");
}

function readRootCredentials(configDir: string): RootCredentials | null {
  let raw: string;
  try {
    raw = readFileSync(join(configDir, CREDENTIALS_FILE), "utf8");
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // A login as yourself keeps the current organization's token in the
    // same field; it may be expired, which only drops the signed-in line.
    if (parsed.auth_method !== "oauth" && parsed.auth_method !== "user_grant")
      return null;
    if (
      typeof parsed.access_token !== "string" ||
      !parsed.access_token.trim()
    ) {
      return null;
    }
    const apiBaseUrl = parsed.api_base_url ?? parsed.api_base_url_1;
    if (typeof apiBaseUrl !== "string" || !apiBaseUrl.trim()) {
      return null;
    }
    return {
      accessToken: parsed.access_token,
      apiBaseUrl: apiBaseUrl.replace(/\/+$/, ""),
    };
  } catch {
    return null;
  }
}

function whoamiEndpoint(apiBaseUrl: string): string {
  return `${apiBaseUrl.replace(/\/+$/, "")}/whoami`;
}

function parseRootIdentity(payload: unknown): RootIdentity | null {
  if (
    payload === null ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return null;
  }
  const data = (payload as { data?: unknown }).data;
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  const identity = data as { member_address?: unknown; org_id?: unknown };
  if (typeof identity.org_id !== "string" || !identity.org_id.trim()) {
    return null;
  }
  const member = identity.member_address as { address?: unknown } | null;
  const address =
    member && typeof member.address === "string" && member.address.trim()
      ? member.address
      : null;
  return { memberAddress: address, orgId: identity.org_id };
}

function rootAuthLine(identity: RootIdentity): string {
  return identity.memberAddress
    ? `Signed in as ${identity.memberAddress} (org ${identity.orgId})\n\n`
    : `Signed in (org ${identity.orgId})\n\n`;
}

function rootRequestConfig(
  configDir: string,
  env: NodeJS.ProcessEnv,
): RootRequestConfig | null {
  const config = loadCliConfig(configDir);
  const currentEnvironment = resolveConfigEnvironment(config);
  const configuredApiBaseUrl = currentEnvironment?.config.api_base_url;
  const envApiBaseUrl = env.PRIMITIVE_API_BASE_URL?.trim();

  if (
    currentEnvironment !== null &&
    currentEnvironment.name !== DEFAULT_ENVIRONMENT &&
    !envApiBaseUrl &&
    !configuredApiBaseUrl
  ) {
    return null;
  }

  return {
    apiBaseUrl: normalizeApiBaseUrl(envApiBaseUrl || configuredApiBaseUrl),
    headers: currentEnvironment?.config.headers,
  };
}

async function fetchRootIdentity(params: {
  apiBaseUrl: string;
  apiKey: string;
  fetch: typeof fetch;
  headers?: Record<string, string>;
  timeoutMs: number;
}): Promise<RootIdentity | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);
  try {
    const response = await params.fetch(whoamiEndpoint(params.apiBaseUrl), {
      headers: {
        ...(params.headers ?? {}),
        accept: "application/json",
        authorization: `Bearer ${params.apiKey}`,
      },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return parseRootIdentity(await response.json().catch(() => null));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function rootSignedInSummary(
  options: RootSignupHintOptions = {},
): Promise<string | null> {
  const argv = options.argv ?? process.argv.slice(2);
  if (argv.length > 0) return null;

  const env = options.env ?? process.env;
  const configDir = activeConfigDir(env, options.home ?? homedir());
  let requestConfig: RootRequestConfig | null;
  try {
    requestConfig = rootRequestConfig(configDir, env);
  } catch {
    return null;
  }
  if (!requestConfig) return null;

  const explicitApiKey = env.PRIMITIVE_API_KEY?.trim();
  const stored = explicitApiKey ? null : readRootCredentials(configDir);
  const apiKey = explicitApiKey || stored?.accessToken;
  if (!apiKey) return null;

  const identity = await fetchRootIdentity({
    apiBaseUrl: stored?.apiBaseUrl ?? requestConfig.apiBaseUrl,
    apiKey,
    fetch: options.fetch ?? fetch,
    headers: requestConfig.headers,
    timeoutMs: options.timeoutMs ?? ROOT_AUTH_TIMEOUT_MS,
  });
  return identity ? rootAuthLine(identity) : null;
}

export function shouldShowLoggedOutSignupHint(
  options: RootSignupHintOptions = {},
): boolean {
  const argv = options.argv ?? process.argv.slice(2);
  if (argv.length > 0) return false;

  const env = options.env ?? process.env;
  if (env.PRIMITIVE_HIDE_SIGNUP_HINT === "1") return false;
  if (env.PRIMITIVE_API_KEY?.trim()) return false;

  const configDir = activeConfigDir(env, options.home ?? homedir());
  return !existsSync(join(configDir, CREDENTIALS_FILE));
}

export function loggedOutSignupHint(): string {
  return [
    "New to Primitive?",
    "  You or your user don't have an account yet?",
    "  Run `primitive signup <email> --accept-terms`",
    "  to create an account and get started.",
    "",
  ].join("\n");
}

export function writeLoggedOutSignupHintIfNeeded(
  options: RootSignupHintOptions = {},
): void {
  if (!shouldShowLoggedOutSignupHint(options)) return;
  const write = options.write ?? ((message) => process.stdout.write(message));
  write(loggedOutSignupHint());
}

export async function writeRootAuthContextIfNeeded(
  options: RootSignupHintOptions = {},
): Promise<void> {
  const write = options.write ?? ((message) => process.stdout.write(message));
  const signedIn = await rootSignedInSummary(options);
  if (signedIn) {
    write(signedIn);
    return;
  }
  writeLoggedOutSignupHintIfNeeded(options);
}
