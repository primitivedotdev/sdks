import { getThread } from "@primitivedotdev/api-core";

type ThreadClient = Parameters<typeof getThread>[0]["client"];

export type LatestInboundResolution = {
  emailId: string;
  /** `latest_inbound_id` when the API reports it, otherwise the message list. */
  resolvedBy: "latest_inbound_id" | "messages";
};

export class ThreadResolutionError extends Error {}

type ThreadMessageView = {
  direction?: unknown;
  id?: unknown;
  timestamp?: unknown;
};

/**
 * Find the newest inbound email in a thread. Uses the thread's
 * `latest_inbound_id` when the API returns it and otherwise picks the
 * newest inbound entry from the thread's message list.
 */
export async function resolveLatestInboundInThread(params: {
  client: ThreadClient;
  threadId: string;
}): Promise<LatestInboundResolution> {
  let result: Awaited<ReturnType<typeof getThread>>;
  try {
    result = await getThread({
      client: params.client,
      path: { id: params.threadId },
      responseStyle: "fields",
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ThreadResolutionError(
      `Could not read thread ${params.threadId}: ${detail}. No reply was sent.`,
    );
  }
  if (result.error !== undefined || !result.data?.data) {
    const status = result.response?.status;
    throw new ThreadResolutionError(
      `Could not read thread ${params.threadId}${status ? ` (HTTP ${status})` : ""}. No reply was sent.`,
    );
  }
  const thread = result.data.data as {
    latest_inbound_id?: unknown;
    messages?: unknown;
  };
  if (
    typeof thread.latest_inbound_id === "string" &&
    thread.latest_inbound_id.length > 0
  )
    return {
      emailId: thread.latest_inbound_id,
      resolvedBy: "latest_inbound_id",
    };
  if ("latest_inbound_id" in thread && thread.latest_inbound_id === null)
    throw new ThreadResolutionError(
      `Thread ${params.threadId} has no inbound email to reply to. No reply was sent.`,
    );

  const messages = Array.isArray(thread.messages)
    ? (thread.messages as ThreadMessageView[])
    : [];
  let latest: { id: string; at: number } | null = null;
  for (const message of messages) {
    if (message.direction !== "inbound" || typeof message.id !== "string")
      continue;
    const parsed =
      typeof message.timestamp === "string"
        ? Date.parse(message.timestamp)
        : Number.NaN;
    const at = Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
    // The list is oldest first, so a later entry wins a timestamp tie.
    if (latest === null || at >= latest.at) latest = { id: message.id, at };
  }
  if (latest === null)
    throw new ThreadResolutionError(
      `Thread ${params.threadId} has no inbound email to reply to. No reply was sent.`,
    );
  return { emailId: latest.id, resolvedBy: "messages" };
}
