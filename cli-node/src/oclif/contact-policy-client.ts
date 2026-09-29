import {
  getAgentContactPolicy,
  listAgentContacts,
  type PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import { ListenStateError } from "./listen-state.js";
import {
  ContactPolicyReadRetryError,
  createNotificationContactPolicy,
} from "./notification-contact-policy.js";

function bodyTransportFailure(error: unknown): boolean {
  const seen = new Set<Error>();
  while (error instanceof Error && !seen.has(error)) {
    seen.add(error);
    if (
      "code" in error &&
      [
        "ECONNRESET",
        "ETIMEDOUT",
        "EPIPE",
        "UND_ERR_SOCKET",
        "UND_ERR_BODY_TIMEOUT",
      ].includes(String(error.code))
    )
      return true;
    error = error.cause;
  }
  return false;
}

function readFailure(
  result: { response?: Response; request?: Request; error?: unknown },
  signal: AbortSignal,
): never {
  signal.throwIfAborted();
  const status = result.response?.status;
  if (
    status === 429 ||
    (status !== undefined && status >= 500 && status <= 599) ||
    (!result.response && result.request !== undefined) ||
    (status !== undefined &&
      status >= 200 &&
      status < 300 &&
      (result.request?.signal.aborted || bodyTransportFailure(result.error)))
  )
    throw new ContactPolicyReadRetryError();
  throw new ListenStateError(
    "Contact notification policy could not be read or was invalid.",
  );
}

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
        throwOnError: false,
      });
      if (result.error || result.data?.success !== true || !result.data.data)
        readFailure(result, signal);
      return result.data.data;
    },
    async readPage(cursor, signal) {
      const result = await listAgentContacts({
        client,
        path: { agent_address: recipient },
        query: { limit: 100, ...(cursor ? { cursor } : {}) },
        signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
        responseStyle: "fields",
        throwOnError: false,
      });
      if (result.error || result.data?.success !== true)
        readFailure(result, signal);
      return { data: result.data.data, cursor: result.data.meta?.cursor };
    },
  });
}
