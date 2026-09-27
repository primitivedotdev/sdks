import { createHash, randomUUID } from "node:crypto";
import type {
  EmailDetail,
  PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import { openSharedMailReceiver } from "./shared-mail-receiver.js";
import {
  inspectTargetedReply,
  readTargetedReplyPage,
} from "./targeted-replies.js";

function recoveryEventId(id: string): string {
  const h = createHash("sha256").update(`reply-recovery:${id}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/** A durable wait joins the address receiver before sending or recovering replies. */
export async function openConnectedReplyWait(options: {
  apiClient: PrimitiveApiClient;
  apiKey: string | undefined;
  baseUrl: string;
  configDir: string;
  from: string;
  recipient: string;
  sentId?: string;
  requestId?: string;
  idempotencyKey?: string;
  createdAt?: string;
  since?: string;
  pageSize: number;
  deadline?: number | null;
  notice?: (message: string) => void;
}) {
  const receiver = await openSharedMailReceiver({
    ...options,
    recipient: options.from,
  });
  const store = receiver.store;
  let requestId = options.requestId ?? randomUUID();
  let sentId = options.sentId;
  try {
    const prior = sentId ? await store.findWaitByParent(sentId) : null;
    if (prior) {
      if (prior.peer !== options.recipient.toLowerCase())
        throw new Error(
          "The existing wait for this send belongs to a different peer.",
        );
      requestId = prior.requestId;
    } else {
      await store.registerWait({
        requestId,
        peer: options.recipient,
        idempotencyKey: options.idempotencyKey ?? `wait-${requestId}`,
        createdAt: options.createdAt ?? new Date().toISOString(),
      });
      if (sentId)
        requestId = (await store.bindWait(requestId, sentId)).requestId;
    }
  } catch (error) {
    await receiver.close();
    throw error;
  }
  const settled = new Set<string>();
  const notices = new Set<string>();
  const pending = new Set<string>();
  let recoveryNeeded = true;
  let cursor: string | undefined;
  let cursors = new Set<string>();
  let generation: string | undefined;
  let gapCount: number | undefined;
  const timedOut = () =>
    options.deadline != null && Date.now() >= options.deadline;
  async function inspect(id: string): Promise<EmailDetail | null> {
    if (settled.has(id)) return null;
    if (!sentId)
      throw new Error("Bind the sent email before waiting for a reply.");
    const result = await inspectTargetedReply({ ...options, sentId, id });
    if (!result) return null;
    if (result.kind === "unrelated") {
      settled.add(id);
      return null;
    }
    if (result.kind === "pending") {
      pending.add(id);
      return null;
    }
    pending.delete(id);
    const email = result.email;
    if (!(await store.readEmail(id)))
      await store.ingest({
        eventId: recoveryEventId(id),
        emailId: id,
        receivedAt: email.received_at,
      });
    await store.hydrate(id, {
      recipient: options.from,
      peer: options.recipient,
      replyToSentEmailId: sentId,
      receivedAt: email.received_at,
      authorization: "trusted",
    });
    if (result.kind === "inspection") {
      if (!notices.has(id)) {
        notices.add(id);
        options.notice?.(
          `Reply ${id} contains an interaction attachment; inspect it with primitive emails get --id ${id}. Waiting for a plain reply.`,
        );
      }
      settled.add(id);
      return null;
    }
    const claim = await store.claimForWait(id, requestId);
    settled.add(id);
    return claim.status === "claimed" ? email : null;
  }
  return {
    receiver,
    get requestId() {
      return requestId;
    },
    ready: () => receiver.ready(options.deadline),
    async bind(id: string) {
      const bound = await store.bindWait(requestId, id);
      requestId = bound.requestId;
      sentId = bound.sentEmailId ?? undefined;
      recoveryNeeded = true;
    },
    uncertain: () => store.markWaitUncertain(requestId),
    cancelBeforeSend: () => store.cancelWaitBeforeSend(requestId),
    observed: (emailId: string) => store.markWaitObserved(emailId, requestId),
    finish: () => store.finishWait(requestId),
    close: () => receiver.close(),
    async next(): Promise<EmailDetail | null> {
      try {
        if (!sentId)
          throw new Error("Bind the sent email before waiting for a reply.");
        while (!timedOut()) {
          const owner = await receiver.ready(options.deadline);
          if (!owner) return null;
          if (generation !== owner.generation || gapCount !== owner.gapCount) {
            generation = owner.generation;
            gapCount = owner.gapCount;
            recoveryNeeded = true;
            cursor = undefined;
            cursors = new Set();
          }
          for (const id of pending) {
            const reply = await inspect(id);
            if (reply) return reply;
          }
          // Interleave pushed candidates with each history page so fresh replies
          // can complete a wait even while targeted recovery has more pages.
          let localCursor: string | undefined;
          do {
            const page = await store.listEmails({
              limit: options.pageSize,
              cursor: localCursor,
            });
            for (const row of page.emails) {
              if (
                row.details &&
                row.details.authorization !== "pending" &&
                (row.details.peer !== options.recipient ||
                  row.details.replyToSentEmailId !== sentId)
              )
                continue;
              const reply = await inspect(row.emailId);
              if (reply) return reply;
            }
            localCursor = page.nextCursor ?? undefined;
          } while (localCursor && !timedOut());
          if (recoveryNeeded) {
            const page = await readTargetedReplyPage({
              ...options,
              sentId,
              cursor,
            });
            if (!page) return null;
            for (const id of page.ids) {
              const reply = await inspect(id);
              if (reply) return reply;
            }
            if (page.cursor) {
              if (cursors.has(page.cursor))
                throw new Error(
                  "Targeted reply search returned a repeated cursor.",
                );
              cursors.add(page.cursor);
              cursor = page.cursor;
              continue;
            }
            recoveryNeeded = false;
          }
          await receiver.changed(options.deadline);
        }
        return null;
      } catch (error) {
        if (timedOut()) return null;
        throw error;
      }
    },
  };
}
export type ConnectedReplyWait = Awaited<
  ReturnType<typeof openConnectedReplyWait>
>;
