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
  type Account,
  AccountResource,
  type AttachmentPartDownload,
  BUILTIN_ROLE_KEYS,
  type BuiltinRoleKey,
  type CreateAgentOptions,
  type CreatedAgent,
  CredentialsResource,
  client,
  createAgent,
  createPrimitiveClient,
  type ForwardInput,
  type GrantForbiddenDetailsShape,
  GrantForbiddenError,
  GrantSpec,
  type InboundEmail,
  InboxResource,
  type InboxStreamOptions,
  isGrantForbiddenError,
  type KeyStepUpOptions,
  KeysResource,
  MemoriesResource,
  type MemoryDeleteInput,
  type MemoryGetInput,
  type MemoryJsonValue,
  type MemoryRecord,
  type MemoryRecordWithValue,
  type MemorySearchInput,
  type MemorySearchResponse,
  type MemorySetInput,
  OPERATION_PERMISSIONS,
  PERMISSIONS,
  type Permission,
  PrimitiveApiError,
  PrimitiveClient,
  type PrimitiveClientOptions,
  type PrimitiveRateLimit,
  type RepeatingSendListInput,
  type RepeatingSendUpdateInput,
  type RepeatOptions,
  type RepeatStopInput,
  RepeatsResource,
  type ReplyInput,
  RolesResource,
  type SendAttachment,
  type SendIdempotency,
  type SendIdempotencyKeySource,
  type SendInput,
  type SendResult,
  type SendThreadInput,
  type WaitForNextOptions,
} from "./api/index.js";
export * from "./webhook/index.js";

import { client } from "./api/index.js";
import { receive } from "./webhook/index.js";

const primitive = {
  client,
  receive,
};

export default primitive;
