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
  type CreateAgentOptions,
  type CreatedAgent,
  client,
  createAgent,
  createPrimitiveClient,
  type ForwardInput,
  type InboundEmail,
  InboxResource,
  type InboxStreamOptions,
  MemoriesResource,
  type MemoryDeleteInput,
  type MemoryGetInput,
  type MemoryRecord,
  type MemoryRecordWithValue,
  type MemorySearchInput,
  type MemorySearchResponse,
  type MemorySetInput,
  PrimitiveApiError,
  PrimitiveClient,
  type PrimitiveClientOptions,
  type ReplyInput,
  type SendAttachment,
  type SendInput,
  type SendResult,
  type SendThreadInput,
  type WaitForNextOptions,
} from "./api/index.js";
export * from "./webhook/index.js";
export {
  buildPayoutRegistrationMessage,
  createX402Client,
  deriveEip3009Nonce,
  type NonceBinding,
  type PayoutRegistrationMessageInput,
  parseEmailChallengeFromPart,
  type TokenDomain,
  type TransferAuthorization,
  type X402Challenge,
  type X402ChargeInput,
  X402Client,
  type X402ClientOptions,
  type X402DeclinedPayment,
  X402Error,
  type X402PaymentPayload,
  type X402PaymentRequirements,
  type X402PayoutAddress,
  type X402Receipt,
  type X402Signer,
  type X402SpendPolicy,
} from "./x402/index.js";

import { client } from "./api/index.js";
import { receive } from "./webhook/index.js";
import { createX402Client } from "./x402/index.js";

const primitive = {
  client,
  receive,
  /** Construct an x402 payments client. See `X402Client`. */
  x402: createX402Client,
};

export default primitive;
