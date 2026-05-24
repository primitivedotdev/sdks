import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { Errors } from "@oclif/core";
import { normalizeApiBaseUrl1, normalizeApiBaseUrl2 } from "./auth.js";

const CONFIG_FILE = "config.json";
const CONFIG_VERSION = 1;
const DEFAULT_ENVIRONMENT = "default";

export type CliEnvironmentConfig = {
  api_base_url_1?: string;
  api_base_url_2?: string;
  headers?: Record<string, string>;
};

export type StoredCliConfig = {
  version: typeof CONFIG_VERSION;
  current_environment: string | null;
  environments: Record<string, CliEnvironmentConfig>;
};

export function cliConfigPath(configDir: string): string {
  return join(configDir, CONFIG_FILE);
}

function cliConfigError(message: string): Errors.CLIError {
  return new Errors.CLIError(
    `${message} Run \`primitive config reset\` to clear the local CLI config.`,
    { exit: 1 },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function normalizeCliEnvironmentName(name: string | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed) {
    throw new Errors.CLIError("Environment name must be a non-empty string.", {
      exit: 1,
    });
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/.test(trimmed)) {
    throw new Errors.CLIError(
      "Environment name must start with a letter or number and may only contain letters, numbers, '.', '_', or '-'.",
      { exit: 1 },
    );
  }
  return trimmed;
}

export function validateCliHeaderName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Errors.CLIError("Header name must be a non-empty string.", {
      exit: 1,
    });
  }
  if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(trimmed)) {
    throw new Errors.CLIError(`Invalid header name: ${name}`, { exit: 1 });
  }
  if (trimmed.toLowerCase() === "authorization") {
    throw new Errors.CLIError(
      "The Authorization header is managed by PRIMITIVE_API_KEY or saved OAuth CLI credentials.",
      { exit: 1 },
    );
  }
  return trimmed;
}

export function validateCliHeaderValue(value: string, name: string): string {
  if (value.length === 0) {
    throw new Errors.CLIError(`Header ${name} value must not be empty.`, {
      exit: 1,
    });
  }
  if (/[\r\n\0]/.test(value)) {
    throw new Errors.CLIError(
      `Header ${name} value must not contain CR, LF, or NUL characters.`,
      { exit: 1 },
    );
  }
  return value;
}

export function parseHeaderAssignment(
  assignment: string,
): [name: string, value: string] {
  const separator = assignment.indexOf("=");
  if (separator <= 0) {
    throw new Errors.CLIError(
      "Header values must use name=value syntax, for example `x-custom=secret`.",
      { exit: 1 },
    );
  }
  const name = validateCliHeaderName(assignment.slice(0, separator));
  const value = validateCliHeaderValue(assignment.slice(separator + 1), name);
  return [name, value];
}

function parseHeaders(raw: unknown, context: string): Record<string, string> {
  if (raw === undefined) return {};
  if (!isRecord(raw)) {
    throw cliConfigError(`${context} headers must be a JSON object.`);
  }
  const headers: Record<string, string> = {};
  for (const [rawName, rawValue] of Object.entries(raw)) {
    const name = validateCliHeaderName(rawName);
    if (typeof rawValue !== "string") {
      throw cliConfigError(`${context} header ${name} must be a string.`);
    }
    headers[name] = validateCliHeaderValue(rawValue, name);
  }
  return headers;
}

function parseEnvironmentConfig(
  raw: unknown,
  context: string,
): CliEnvironmentConfig {
  if (!isRecord(raw)) {
    throw cliConfigError(`${context} must be a JSON object.`);
  }

  const env: CliEnvironmentConfig = {};
  if (raw.api_base_url_1 !== undefined) {
    if (typeof raw.api_base_url_1 !== "string") {
      throw cliConfigError(`${context}.api_base_url_1 must be a string.`);
    }
    env.api_base_url_1 = normalizeApiBaseUrl1(raw.api_base_url_1);
  }
  if (raw.api_base_url_2 !== undefined) {
    if (typeof raw.api_base_url_2 !== "string") {
      throw cliConfigError(`${context}.api_base_url_2 must be a string.`);
    }
    env.api_base_url_2 = normalizeApiBaseUrl2(raw.api_base_url_2);
  }

  const headers = parseHeaders(raw.headers, context);
  if (Object.keys(headers).length > 0) env.headers = headers;
  return env;
}

function parseStoredCliConfig(raw: unknown): StoredCliConfig {
  if (!isRecord(raw)) {
    throw cliConfigError("Primitive CLI config must be a JSON object.");
  }
  if (raw.version !== CONFIG_VERSION) {
    throw cliConfigError(
      `Primitive CLI config version must be ${CONFIG_VERSION}.`,
    );
  }

  const currentRaw = raw.current_environment;
  const current_environment =
    currentRaw === null || currentRaw === undefined
      ? null
      : typeof currentRaw === "string"
        ? normalizeCliEnvironmentName(currentRaw)
        : (() => {
            throw cliConfigError(
              "Primitive CLI config current_environment must be a string or null.",
            );
          })();

  if (!isRecord(raw.environments)) {
    throw cliConfigError(
      "Primitive CLI config environments must be an object.",
    );
  }

  const environments: Record<string, CliEnvironmentConfig> = {};
  for (const [rawName, rawEnv] of Object.entries(raw.environments)) {
    const name = normalizeCliEnvironmentName(rawName);
    environments[name] = parseEnvironmentConfig(
      rawEnv,
      `Primitive CLI config environment ${name}`,
    );
  }

  if (current_environment && !environments[current_environment]) {
    throw cliConfigError(
      `Primitive CLI config current environment ${current_environment} does not exist.`,
    );
  }

  return {
    version: CONFIG_VERSION,
    current_environment,
    environments,
  };
}

export function emptyCliConfig(): StoredCliConfig {
  return {
    version: CONFIG_VERSION,
    current_environment: null,
    environments: {},
  };
}

export function loadCliConfig(configDir: string): StoredCliConfig | null {
  const path = cliConfigPath(configDir);
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
    throw cliConfigError(`Could not read Primitive CLI config: ${detail}.`);
  }

  try {
    return parseStoredCliConfig(JSON.parse(contents));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw cliConfigError("Primitive CLI config is not valid JSON.");
    }
    throw error;
  }
}

export function saveCliConfig(
  configDir: string,
  config: StoredCliConfig,
): void {
  mkdirSync(configDir, { mode: 0o700, recursive: true });
  const path = cliConfigPath(configDir);
  const tempPath = join(
    configDir,
    `${CONFIG_FILE}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    writeFileSync(tempPath, `${JSON.stringify(config, null, 2)}\n`, {
      mode: 0o600,
    });
    renameSync(tempPath, path);
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw error;
  }
}

export function deleteCliConfig(configDir: string): void {
  rmSync(cliConfigPath(configDir), { force: true });
}

export function resolveConfigEnvironment(
  config: StoredCliConfig | null,
): { name: string; config: CliEnvironmentConfig } | null {
  if (!config) return null;
  const current = config.current_environment;
  if (current) {
    const environment = config.environments[current];
    return environment ? { name: current, config: environment } : null;
  }
  const defaultEnvironment = config.environments[DEFAULT_ENVIRONMENT];
  return defaultEnvironment
    ? { name: DEFAULT_ENVIRONMENT, config: defaultEnvironment }
    : null;
}

export function upsertCliEnvironment(params: {
  config: StoredCliConfig;
  environmentName?: string;
  apiBaseUrl1?: string;
  apiBaseUrl2?: string;
  headers?: string[];
  unsetHeaders?: string[];
  use?: boolean;
}): StoredCliConfig {
  const name = normalizeCliEnvironmentName(
    params.environmentName ?? DEFAULT_ENVIRONMENT,
  );
  const existing = params.config.environments[name] ?? {};
  const nextHeaders = { ...(existing.headers ?? {}) };

  for (const assignment of params.headers ?? []) {
    const [headerName, value] = parseHeaderAssignment(assignment);
    nextHeaders[headerName] = value;
  }
  for (const rawName of params.unsetHeaders ?? []) {
    delete nextHeaders[validateCliHeaderName(rawName)];
  }

  const nextEnvironment: CliEnvironmentConfig = {
    ...existing,
    ...(params.apiBaseUrl1 !== undefined
      ? { api_base_url_1: normalizeApiBaseUrl1(params.apiBaseUrl1) }
      : {}),
    ...(params.apiBaseUrl2 !== undefined
      ? { api_base_url_2: normalizeApiBaseUrl2(params.apiBaseUrl2) }
      : {}),
    ...(Object.keys(nextHeaders).length > 0 ? { headers: nextHeaders } : {}),
  };

  if (Object.keys(nextHeaders).length === 0) {
    delete nextEnvironment.headers;
  }

  return {
    ...params.config,
    current_environment:
      params.use === false ? params.config.current_environment : name,
    environments: {
      ...params.config.environments,
      [name]: nextEnvironment,
    },
  };
}

export function removeCliEnvironment(
  config: StoredCliConfig,
  environmentName: string,
): StoredCliConfig {
  const name = normalizeCliEnvironmentName(environmentName);
  const environments = { ...config.environments };
  delete environments[name];
  return {
    ...config,
    current_environment:
      config.current_environment === name ? null : config.current_environment,
    environments,
  };
}

export function redactCliEnvironment(
  environment: CliEnvironmentConfig,
): CliEnvironmentConfig {
  const headers =
    environment.headers && Object.keys(environment.headers).length > 0
      ? Object.fromEntries(
          Object.keys(environment.headers).map((name) => [name, "***"]),
        )
      : undefined;
  return {
    ...environment,
    ...(headers ? { headers } : {}),
  };
}
