import { createHash, randomUUID } from "node:crypto";
import type {
  EmailDetail,
  PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import type { ContactRequestReference } from "./contact-interactions.js";
import { followEmailConversation } from "./conversation-follow.js";
import { clearConsumedPendingMail } from "./pending-mail.js";
import {
  openSharedMailReceiver,
  sharedMailScope,
} from "./shared-mail-receiver.js";
import {
  createSharedMailWaiter,
  openSharedMailStore,
} from "./shared-mail-state.js";
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
  sessionKey?: string | null;
  contactRequest?: ContactRequestReference;
  apiClient: PrimitiveApiClient;
  apiKey: string | undefined;
  baseUrl: string;
  configDir: string;
  from: string;
  recipient: string;
  sentId?: string;
  requestId?: string;
  resumeReply?: { emailId: string; requestId: string };
  idempotencyKey?: string;
  createdAt?: string;
  since?: string;
  pageSize: number;
  deadline?: number | null;
  notice?: (message: string) => void;
}) {
  options = {
    ...options,
    from: options.from.trim().toLowerCase(),
    recipient: options.recipient.trim().toLowerCase(),
  };
  const waiter = createSharedMailWaiter();
  const receiver = await openSharedMailReceiver({
    ...options,
    recipient: options.from,
  });
  const store = receiver.store;
  let requestId = options.requestId ?? randomUUID();
  let sentId = options.sentId;
  let newlyRegisteredId: string | undefined;
  let ownershipAttempted = false;
  try {
    if (options.resumeReply) {
      const saved = await store.readWait(options.resumeReply.requestId);
      const email = await store.readEmail(options.resumeReply.emailId);
      if (
        !sentId ||
        !saved ||
        !["bound", "completed"].includes(saved.status) ||
        saved.sentEmailId !== sentId ||
        saved.peer !== options.recipient ||
        (saved.sessionKey !== null &&
          options.sessionKey != null &&
          saved.sessionKey !== options.sessionKey) ||
        JSON.stringify(saved.contactRequest ?? null) !==
          JSON.stringify(options.contactRequest ?? null) ||
        email?.route?.kind !== "wait" ||
        email.route.requestId !== saved.requestId
      )
        throw new Error(
          "The saved reply does not match its durable wait claim.",
        );
      requestId = saved.requestId;
      ownershipAttempted = true;
      await store.joinWait(requestId, waiter);
    } else {
      const prior = sentId ? await store.findWaitByParent(sentId) : null;
      if (
        prior?.sessionKey &&
        options.sessionKey &&
        prior.sessionKey !== options.sessionKey
      )
        throw new Error("This conversation belongs to another native session.");
      if (
        prior &&
        JSON.stringify(prior.contactRequest ?? null) !==
          JSON.stringify(options.contactRequest ?? null)
      )
        throw new Error(
          "The existing wait has a different reply type. Resume it with the matching contact or task command.",
        );
      if (prior?.status === "bound") {
        if (prior.peer !== options.recipient.toLowerCase())
          throw new Error(
            "The existing wait for this send belongs to a different peer.",
          );
        requestId = prior.requestId;
        if (
          JSON.stringify(prior.contactRequest ?? null) !==
          JSON.stringify(options.contactRequest ?? null)
        )
          throw new Error(
            "The existing wait has a different reply type. Resume it with the matching contact or task command.",
          );
        ownershipAttempted = true;
        await store.joinWait(requestId, waiter);
      } else {
        if (prior?.requestId === requestId) requestId = randomUUID();
        const existing = await store.readWait(requestId);
        if (!existing) newlyRegisteredId = requestId;
        ownershipAttempted = true;
        await store.registerWait({
          ...(options.contactRequest
            ? { contactRequest: options.contactRequest }
            : {}),
          requestId,
          sessionKey: options.sessionKey ?? null,
          peer: options.recipient,
          idempotencyKey: options.idempotencyKey ?? `wait-${requestId}`,
          createdAt: options.createdAt ?? new Date().toISOString(),
          waiter,
        });
        if (sentId)
          requestId = (await store.bindWait(requestId, sentId)).requestId;
      }
    }
  } catch (error) {
    try {
      if (ownershipAttempted) {
        // Setup may fail after registration or after the receive signal expires.
        // Never cancel an intent that existed before this construction attempt.
        const cleanup = await openSharedMailStore({
          configDir: options.configDir,
          scope: sharedMailScope(options.apiKey, options.baseUrl),
          recipient: options.from,
          signal: AbortSignal.timeout(2000),
        });
        if (await cleanup.readWait(requestId))
          await cleanup.releaseWaiter(requestId, waiter.token);
        if (newlyRegisteredId) {
          const registered = await cleanup.readWait(newlyRegisteredId);
          if (registered?.status === "unbound")
            await cleanup.cancelWaitBeforeSend(newlyRegisteredId);
        }
      }
    } finally {
      await receiver.close();
    }
    throw error;
  }
  const settled = new Set<string>();
  const notices = new Set<string>();
  const pending = new Set<string>();
  let recoveryNeeded = true;
  let cursor: string | undefined;
  let localCursor: string | undefined;
  let cursors = new Set<string>();
  let generation: string | undefined;
  let gapCount: number | undefined;
  let released = false;
  let closed = false;
  let closing: Promise<void> | undefined;
  const timedOut = () =>
    options.deadline != null && Date.now() >= options.deadline;
  async function release() {
    if (released) return;
    // The receiver's signal has already expired on the normal timeout path.
    const cleanup = await openSharedMailStore({
      configDir: options.configDir,
      scope: sharedMailScope(options.apiKey, options.baseUrl),
      recipient: options.from,
      signal: AbortSignal.timeout(2000),
    });
    await cleanup.releaseWaiter(requestId, waiter.token);
    released = true;
  }
  async function inspect(id: string): Promise<EmailDetail | null> {
    if (closed || released || timedOut()) return null;
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
      ...(email.thread_id ? { threadId: email.thread_id } : {}),
      receivedAt: email.received_at,
      authorization: "trusted",
    });
    if (result.kind === "inspection") {
      if (!notices.has(id)) {
        notices.add(id);
        options.notice?.(
          options.contactRequest
            ? `Reply ${id} does not complete this contact acceptance wait; inspect it with primitive emails get --id ${id}.`
            : `Reply ${id} contains an interaction attachment. Waiting for a plain reply; no extra fetch is needed for activity updates. Inspect only if your task explicitly expects a structured result.`,
        );
      }
      settled.add(id);
      return null;
    }
    if (closed || released || timedOut()) return null;
    const claim = await store.claimForWait(id, requestId, waiter.token);
    if (options.contactRequest && claim.email.route?.kind === "notification") {
      if (["selected", "submitting"].includes(claim.email.route.state)) {
        pending.add(id);
        return null;
      }
    }
    settled.add(id);
    const observed =
      claim.status === "claimed" ||
      (claim.status === "already_observed" &&
        options.resumeReply?.emailId === id);
    if (observed && options.sessionKey && !options.contactRequest) {
      const intent = await store.readWait(requestId);
      if (!intent)
        throw new Error(
          "The conversation's initiating request is unavailable.",
        );
      await followEmailConversation(
        {
          configDir: options.configDir,
          scope: sharedMailScope(options.apiKey, options.baseUrl),
          recipient: options.from,
          peer: options.recipient,
          sessionKey: options.sessionKey,
          since: intent.createdAt,
        },
        email,
      );
    }
    return observed ? email : null;
  }
  return {
    receiver,
    get requestId() {
      return requestId;
    },
    ready: () => receiver.ready(options.deadline),
    async bind(id: string) {
      if (options.resumeReply) {
        if (id !== sentId)
          throw new Error("The saved reply belongs to a different send.");
        return;
      }
      const bound = await store.bindWait(requestId, id);
      requestId = bound.requestId;
      sentId = bound.sentEmailId ?? undefined;
      recoveryNeeded = true;
    },
    uncertain: () => store.markWaitUncertain(requestId),
    async cancelBeforeSend() {
      // Definite pre-send cleanup must remain possible after the receive deadline.
      const cleanup = await openSharedMailStore({
        configDir: options.configDir,
        scope: sharedMailScope(options.apiKey, options.baseUrl),
        recipient: options.from,
        signal: AbortSignal.timeout(2000),
      });
      return cleanup.cancelWaitBeforeSend(requestId);
    },
    async cancelRejectedSend() {
      // A classified refusal is authoritative even if the receive deadline elapsed.
      const cleanup = await openSharedMailStore({
        configDir: options.configDir,
        scope: sharedMailScope(options.apiKey, options.baseUrl),
        recipient: options.from,
        signal: AbortSignal.timeout(2000),
      });
      return cleanup.cancelRejectedSend(requestId);
    },
    async observed(emailId: string) {
      if (
        options.contactRequest &&
        (await store.observeNotifiedContactReply(
          emailId,
          requestId,
          waiter.token,
        ))
      )
        return;
      await store.markWaitObserved(emailId, requestId);
      // The session now has this reply; a wake notice a listener journaled
      // for it would only announce it again after a restart.
      try {
        await clearConsumedPendingMail(
          options.configDir,
          options.sessionKey,
          emailId,
        );
      } catch {
        // Best effort: the reply was consumed either way.
      }
    },
    finish: () => store.finishWait(requestId),
    close() {
      closed = true;
      closing ??= (async () => {
        try {
          await release();
        } finally {
          await receiver.close();
        }
      })();
      return closing;
    },
    async next(): Promise<EmailDetail | null> {
      try {
        if (!sentId)
          throw new Error("Bind the sent email before waiting for a reply.");
        while (!closed && !released && !timedOut()) {
          const owner = await receiver.ready(options.deadline);
          if (!owner) return null;
          if (options.resumeReply) {
            const reply = await inspect(options.resumeReply.emailId);
            if (reply) return reply;
            await receiver.changed(options.deadline);
            continue;
          }
          if (generation !== owner.generation || gapCount !== owner.gapCount) {
            generation = owner.generation;
            gapCount = owner.gapCount;
            recoveryNeeded = true;
            cursor = undefined;
            cursors = new Set();
          }
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
            } else {
              recoveryNeeded = false;
            }
          }
          for (const id of [...pending]) {
            const reply = await inspect(id);
            if (reply) return reply;
          }
          // Search the exact parent before historical mail. Interleave at most
          // one local page so retained history cannot delay the next search page.
          const local = await store.listEmails({
            limit: options.pageSize,
            cursor: localCursor,
          });
          for (const row of local.emails) {
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
          localCursor = local.nextCursor ?? undefined;
          if (recoveryNeeded || localCursor) continue;
          await receiver.changed(options.deadline);
        }
        return null;
      } catch (error) {
        if (closed || released || timedOut()) return null;
        throw error;
      } finally {
        if (timedOut()) await release();
      }
    },
  };
}
export type ConnectedReplyWait = Awaited<
  ReturnType<typeof openConnectedReplyWait>
>;
