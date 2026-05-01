/**
 * @primitivedotdev/sdk
 *
 * Official Primitive Node.js SDK.
 *
 * The default export provides the small, high-level platform surface:
 * receive inbound email locally and send/reply/forward outbound email
 * synchronously through the Primitive API.
 *
 * Lower-level webhook helpers, generated API operations, and Node-only extras
 * are still exported as named exports and subpath imports for advanced use.
 *
 * @packageDocumentation
 */

export {
  client,
  createPrimitiveClient,
  type ForwardInput,
  PrimitiveApiError,
  PrimitiveClient,
  type PrimitiveClientOptions,
  type ReplyInput,
  type SendInput,
  type SendResult,
  type SendThreadInput,
} from "./api/index.js";
export * from "./webhook/index.js";

import { client } from "./api/index.js";
import { receive } from "./webhook/index.js";

const primitive = {
  client,
  receive,
};

export default primitive;
