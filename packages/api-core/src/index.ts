/**
 * @primitivedotdev/api-core — workspace-internal package.
 *
 * Owns the TypeScript OpenAPI surface (generated fetch client,
 * operation manifest, OpenAPI document constant, request/response
 * types) plus the host-aware `PrimitiveApiClient` used by both
 * `@primitivedotdev/sdk` and `@primitivedotdev/cli`.
 *
 * This package is never published. Consumers bundle it inline at
 * build time so the public tarballs declare neither a dependency
 * on this package nor on each other.
 */

export {};
