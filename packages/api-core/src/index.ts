/**
 * @primitivedotdev/api-core — workspace-internal package.
 *
 * Owns the TypeScript OpenAPI surface (generated fetch client,
 * operation manifest, OpenAPI document constant, request/response
 * types) used by both `@primitivedotdev/sdk` and
 * `@primitivedotdev/cli`.
 *
 * This package is never published. Consumers bundle it inline at
 * build time so the public tarballs declare neither a dependency
 * on this package nor on each other.
 */

// Generated fetch client + operation functions + request/response
// type definitions. Re-exported flat so consumers import names
// directly off `@primitivedotdev/api-core` without remembering
// which generated file each name lives in.
export * from "./api/index.js";

// Re-export the generated client primitives explicitly. `./api/index`
// only re-exports the operations and types from sdk.gen / types.gen;
// the client factory and config primitives live in `./api/client/`.
export {
  type Auth,
  type Client,
  type ClientOptions,
  type Config,
  createClient,
  createConfig,
  type CreateClientConfig,
  type Options,
  type RequestOptions,
  type RequestResult,
  type ResponseStyle,
} from "./api/client/index.js";

// OpenAPI document + operation manifest used by tooling that needs
// to enumerate the API surface (CLI command generator, fish
// completion, `primitive describe`, future SDK consumers serving
// the spec from an app).
export { openapiDocument } from "./openapi/openapi.generated.js";
export {
  operationManifest,
  type PrimitiveOperationManifest,
  type PrimitiveParameterManifest,
} from "./openapi/operations.generated.js";

// Re-export operations as an `operations` object too, mirroring the
// historical SDK shape that the CLI's generated-command path relies
// on (`operations[sdkName]`). The named exports above remain for
// callers that want a specific operation function.
export * as operations from "./api/sdk.gen.js";

// Host-aware client used by the CLI and the higher-level
// `PrimitiveClient` in sdk-node. Lives here (not in sdk-node) so the
// CLI never has to depend on sdk-node to construct a request client.
export {
  createPrimitiveApiClient,
  DEFAULT_API_BASE_URL_1,
  DEFAULT_API_BASE_URL_2,
  PrimitiveApiClient,
  type PrimitiveApiClientOptions,
  PrimitiveApiError,
  type PrimitiveApiErrorDetails,
  type RequestOptions as PrimitiveRequestOptions,
} from "./client.js";
