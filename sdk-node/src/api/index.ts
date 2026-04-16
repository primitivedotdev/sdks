/**
 * Primitive API client module.
 *
 * Generated operations are exported directly, and `PrimitiveApiClient`
 * provides a configured fetch client for those operations.
 */

import {
  createClient,
  createConfig,
  type Client as GeneratedClient,
  type Config as GeneratedConfig,
} from "./generated/client/index.js";
import * as generatedOperations from "./generated/sdk.gen.js";

export const DEFAULT_BASE_URL = "https://www.primitive.dev/api/v1";

export interface PrimitiveApiClientOptions
  extends Omit<GeneratedConfig, "auth" | "baseUrl"> {
  apiKey?: string;
  auth?: GeneratedConfig["auth"];
  baseUrl?: string;
}

function createDefaultAuth(apiKey?: string): GeneratedConfig["auth"] {
  return (security) => {
    if (security.type === "http" && security.scheme === "bearer") {
      return apiKey;
    }

    return undefined;
  };
}

export class PrimitiveApiClient {
  readonly client: GeneratedClient;

  constructor(options: PrimitiveApiClientOptions = {}) {
    const { apiKey, auth, baseUrl = DEFAULT_BASE_URL, ...config } = options;

    this.client = createClient(
      createConfig({
        ...config,
        auth: auth ?? createDefaultAuth(apiKey),
        baseUrl,
      }),
    );
  }

  getConfig() {
    return this.client.getConfig();
  }

  setConfig(config: GeneratedConfig) {
    return this.client.setConfig(config);
  }
}

export function createPrimitiveApiClient(
  options: PrimitiveApiClientOptions = {},
) {
  return new PrimitiveApiClient(options);
}

export const operations = generatedOperations;

export type {
  Auth,
  Client as PrimitiveGeneratedApiClient,
  ClientOptions as PrimitiveGeneratedApiClientOptions,
  Config as PrimitiveGeneratedApiConfig,
  CreateClientConfig,
  Options as PrimitiveGeneratedApiOptions,
  RequestOptions as PrimitiveGeneratedApiRequestOptions,
  RequestResult as PrimitiveGeneratedApiRequestResult,
  ResponseStyle,
} from "./generated/client/index.js";
export * from "./generated/index.js";
