/**
 * @primitivedotdev/sdk
 *
 * Official Primitive Node.js SDK.
 *
 * The root entrypoint exposes the webhook helpers plus the convenience
 * `PrimitiveClient` for outbound API calls. Use subpath imports for the
 * generated API client, OpenAPI document, and Node-only extras.
 *
 * @packageDocumentation
 */

export {
  createPrimitiveClient,
  PrimitiveApiError,
  PrimitiveClient,
  type PrimitiveClientOptions,
} from "./api/index.js";
export * from "./webhook/index.js";
