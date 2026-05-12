/**
 * OpenAPI distribution module.
 *
 * Use this subpath when you need the canonical Primitive API
 * specification, for example to serve it from another application.
 *
 * The underlying artifacts are generated and live in the workspace-
 * internal `@primitivedotdev/api-core` package; the bundler inlines
 * them into the published `@primitivedotdev/sdk` tarball so the
 * subpath import keeps working without an external dep.
 */

export {
  openapiDocument,
  operationManifest,
  type PrimitiveOperationManifest,
  type PrimitiveParameterManifest,
} from "@primitivedotdev/api-core";
