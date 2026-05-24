import { Errors } from "@oclif/core";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import {
  normalizeApiBaseUrl1,
  normalizeApiBaseUrl2,
  resolveCliAuth,
} from "./auth.js";
import {
  DEFAULT_ENVIRONMENT,
  loadCliConfig,
  resolveConfigEnvironment,
  validateCliHeaderName,
  validateCliHeaderValue,
} from "./cli-config.js";

const API_HEADERS_ENV = "PRIMITIVE_API_HEADERS";

type Env = Record<string, string | undefined>;

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

export function createAuthenticatedCliApiClient(params: {
  configDir: string;
  apiKey?: string;
  apiBaseUrl1?: string;
  apiBaseUrl2?: string;
  env?: Env;
}) {
  const requestConfig = resolveCliApiRequestConfig(params);
  const auth = resolveCliAuth({
    apiKey: params.apiKey,
    apiBaseUrl1: requestConfig.apiBaseUrl1,
    apiBaseUrl2: requestConfig.apiBaseUrl2,
    configDir: params.configDir,
  });
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
