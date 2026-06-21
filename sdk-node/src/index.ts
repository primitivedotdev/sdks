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

// Agent-account surface: the `client.agent` methods are reachable from the
// root client, so their request/response types belong at the root too (the
// `AgentResource` itself lives behind the `/api` subpath via the generated
// re-export). Keeps `import type { AgentAccountResult } from "@primitivedotdev/sdk"`
// consistent with the root-level SendResult / SendInput types.
export type {
  AgentAccountResult,
  AgentAccountUpgradeHint,
  AgentClaimLinkResult,
  AgentClaimResult,
  AgentClaimStartResult,
  CreateAgentAccountInput,
  CreateAgentClaimLinkInput,
  PlanLimits,
  StartAgentClaimInput,
  VerifyAgentClaimInput,
} from "./api/index.js";
export {
  client,
  createPrimitiveClient,
  type ForwardInput,
  PrimitiveApiError,
  PrimitiveClient,
  type PrimitiveClientOptions,
  type ReplyInput,
  type SendAttachment,
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
