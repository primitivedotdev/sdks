/**
 * OpenAPI distribution module.
 *
 * Use this subpath when you need the canonical Primitive API specification,
 * for example to serve it from another application.
 */

export { openapiDocument } from "./openapi.generated.js";
export {
  operationManifest,
  type PrimitiveOperationManifest,
  type PrimitiveParameterManifest,
} from "./operations.generated.js";
