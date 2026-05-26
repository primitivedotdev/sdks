import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { normalizeApiBaseUrl1 } from "./auth.js";
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
  apiBaseUrl1: string;
};

type RootAccount = {
  email: string;
  id: string;
};

type RootRequestConfig = {
  apiBaseUrl1: string;
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
    if (parsed.auth_method !== "oauth") return null;
    if (
      typeof parsed.access_token !== "string" ||
      !parsed.access_token.trim()
    ) {
      return null;
    }
    if (
      typeof parsed.api_base_url_1 !== "string" ||
      !parsed.api_base_url_1.trim()
    ) {
      return null;
    }
    return {
      accessToken: parsed.access_token,
      apiBaseUrl1: parsed.api_base_url_1.replace(/\/+$/, ""),
    };
  } catch {
    return null;
  }
}

function accountEndpoint(apiBaseUrl1: string): string {
  return `${apiBaseUrl1.replace(/\/+$/, "")}/account`;
}

function parseRootAccount(payload: unknown): RootAccount | null {
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
  const account = data as { email?: unknown; id?: unknown };
  if (typeof account.email !== "string" || !account.email.trim()) return null;
  if (typeof account.id !== "string" || !account.id.trim()) return null;
  return { email: account.email, id: account.id };
}

function rootAuthLine(account: RootAccount): string {
  return `Signed in as ${account.email} (org ${account.id})\n\n`;
}

function rootRequestConfig(
  configDir: string,
  env: NodeJS.ProcessEnv,
): RootRequestConfig | null {
  const config = loadCliConfig(configDir);
  const currentEnvironment = resolveConfigEnvironment(config);
  const configuredApiBaseUrl1 = currentEnvironment?.config.api_base_url_1;
  const envApiBaseUrl1 = env.PRIMITIVE_API_BASE_URL_1?.trim();

  if (
    currentEnvironment !== null &&
    currentEnvironment.name !== DEFAULT_ENVIRONMENT &&
    !envApiBaseUrl1 &&
    !configuredApiBaseUrl1
  ) {
    return null;
  }

  return {
    apiBaseUrl1: normalizeApiBaseUrl1(envApiBaseUrl1 || configuredApiBaseUrl1),
    headers: currentEnvironment?.config.headers,
  };
}

async function fetchRootAccount(params: {
  apiBaseUrl1: string;
  apiKey: string;
  fetch: typeof fetch;
  headers?: Record<string, string>;
  timeoutMs: number;
}): Promise<RootAccount | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);
  try {
    const response = await params.fetch(accountEndpoint(params.apiBaseUrl1), {
      headers: {
        ...(params.headers ?? {}),
        accept: "application/json",
        authorization: `Bearer ${params.apiKey}`,
      },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return parseRootAccount(await response.json().catch(() => null));
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

  const account = await fetchRootAccount({
    apiBaseUrl1: stored?.apiBaseUrl1 ?? requestConfig.apiBaseUrl1,
    apiKey,
    fetch: options.fetch ?? fetch,
    headers: requestConfig.headers,
    timeoutMs: options.timeoutMs ?? ROOT_AUTH_TIMEOUT_MS,
  });
  return account ? rootAuthLine(account) : null;
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
    "  Run `primitive signup <email> --signup-code <invite-code> --accept-terms`",
    "  to create an account, get your own domain, and get started now.",
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
