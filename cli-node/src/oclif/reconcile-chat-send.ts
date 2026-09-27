import { Errors } from "@oclif/core";
import type {
  PrimitiveApiClient,
  SentEmailSummary,
} from "@primitivedotdev/api-core";
import { listSentEmails } from "@primitivedotdev/api-core";
import { readBeforeDeadline } from "./scoped-chat.js";

/** Lookup only. An empty result never authorizes another send. */
export async function reconcileChatSend(params: {
  apiClient: PrimitiveApiClient;
  idempotencyKey: string;
  from: string;
  recipient: string;
  deadline?: number | null;
}): Promise<SentEmailSummary | null> {
  const result = await readBeforeDeadline(params.deadline, (signal) =>
    listSentEmails({
      client: params.apiClient.client,
      query: { idempotency_key: params.idempotencyKey, limit: 2 },
      signal,
      responseStyle: "fields",
    }),
  );
  if (result === null) return null;
  const page = result.data;
  if (
    result.error ||
    !page ||
    !Array.isArray(page.data) ||
    !page.meta ||
    page.meta.cursor !== null ||
    page.data.length > 1
  )
    throw new Errors.CLIError(
      "Could not reconcile the saved send intent. Its outcome remains unknown; do not send again.",
      { exit: 1 },
    );
  const sent = page.data[0];
  if (!sent) return null;
  if (
    sent.client_idempotency_key !== params.idempotencyKey ||
    typeof sent.from_address !== "string" ||
    sent.from_address.trim().toLowerCase() !==
      params.from.trim().toLowerCase() ||
    typeof sent.to_address !== "string" ||
    sent.to_address.trim().toLowerCase() !==
      params.recipient.trim().toLowerCase() ||
    typeof sent.id !== "string" ||
    !sent.id
  )
    throw new Errors.CLIError(
      "The saved send lookup returned conflicting identity metadata. Inspect the existing send before retrying.",
      { exit: 1 },
    );
  return sent;
}
