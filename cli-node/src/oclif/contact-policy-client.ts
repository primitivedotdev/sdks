import {
  getAgentContactPolicy,
  listAgentContacts,
  type PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import { ListenStateError } from "./listen-state.js";
import { createNotificationContactPolicy } from "./notification-contact-policy.js";

export function apiContactPolicy(
  client: PrimitiveApiClient["client"],
  recipient: string,
  contactRequests = false,
) {
  return createNotificationContactPolicy({
    recipient,
    contactRequests,
    async readPolicy(signal) {
      const result = await getAgentContactPolicy({
        client,
        path: { agent_address: recipient },
        signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
        responseStyle: "fields",
      });
      if (result.error || result.data?.success !== true || !result.data.data)
        throw new ListenStateError(
          "Contact approval policy could not be read.",
        );
      return result.data.data;
    },
    async readPage(cursor, signal) {
      const result = await listAgentContacts({
        client,
        path: { agent_address: recipient },
        query: { limit: 100, ...(cursor ? { cursor } : {}) },
        signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
        responseStyle: "fields",
      });
      if (result.error || result.data?.success !== true)
        throw new ListenStateError(
          "Contact notification preferences could not be read.",
        );
      return { data: result.data.data, cursor: result.data.meta?.cursor };
    },
  });
}
