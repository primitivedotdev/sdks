import {
  type EmailDetail,
  getEmail,
  listAgentContacts,
} from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "./api-client.js";
import type { ListenOptions } from "./listen-runner.js";
import { ListenStateError } from "./listen-state.js";
import { createNotificationContactPolicy } from "./notification-contact-policy.js";
import { openSessionNotifications } from "./notify-session.js";
import {
  NotificationRetryError,
  notificationPartReader,
} from "./notify-session-content.js";
import { scopedChatSenderTrust } from "./scoped-chat.js";
import {
  openSharedMailReceiver,
  sharedMailScope,
} from "./shared-mail-receiver.js";
import {
  reserveSharedMailSubscription,
  type SharedMailEmail,
  type SharedMailStore,
} from "./shared-mail-state.js";
import { ensureSharedMailSubscription } from "./shared-mail-transport.js";

/** Notification delivery consumes the shared ID journal, never a second remote lease. */
export async function runSharedNotificationListen(
  options: ListenOptions,
): Promise<number> {
  if (!options.notifySession)
    throw new ListenStateError("A native notification target is required.");
  const notify = options.notifySession;
  if (notify.contactPreferences && notify.senders.length)
    throw new ListenStateError(
      "Contact preferences and explicit notification senders cannot be combined.",
    );
  const approvedSenders = new Set(
    notify.senders
      .flatMap((sender) => sender.split(","))
      .map((sender) => sender.trim().toLowerCase()),
  );
  if (options.transport === "poll")
    throw new ListenStateError(
      "Session notifications require WebSocket transport.",
    );
  if (options.subscription !== undefined)
    throw new ListenStateError(
      "Session notifications use the shared address subscription; omit --subscription.",
    );
  if (
    options.events !== undefined &&
    (options.events.length !== 1 || options.events[0] !== "email.received")
  )
    throw new ListenStateError(
      "Session notifications require --events email.received only.",
    );
  if (
    options.number !== undefined &&
    (!Number.isSafeInteger(options.number) || options.number < 1)
  )
    throw new ListenStateError("--number must be a positive integer.");
  const auth = await createAuthenticatedCliApiClient({
    configDir: options.configDir,
    apiKey: options.apiKey,
    apiBaseUrl: options.apiBaseUrl,
  });
  const scope = sharedMailScope(auth.auth.apiKey, auth.auth.apiBaseUrl),
    signal = options.signal;
  const native = await openSessionNotifications({
    ...notify,
    configDir: options.configDir,
    scope,
    signal,
    readPart: notificationPartReader(async () => auth.apiClient.client),
  });
  let receiver: Awaited<ReturnType<typeof openSharedMailReceiver>> | undefined;
  let processed = 0;
  const settled = new Set<string>();
  const sessionKey = `codex:${notify.threadId.toLowerCase()}`;
  try {
    const reserved = await reserveSharedMailSubscription({
      configDir: options.configDir,
      scope,
      signal,
    });
    const recipient =
      reserved.recipient ??
      (
        await ensureSharedMailSubscription({
          apiClient: auth.apiClient,
          subscription: reserved.name,
          signal,
        })
      ).recipient;
    if (
      auth.auth.connectedAgent &&
      auth.auth.connectedAgent.agentAddress !== recipient
    )
      throw new ListenStateError(
        "The receiving address does not match the selected connected-agent profile.",
      );
    const contactPolicy = notify.contactPreferences
      ? createNotificationContactPolicy({
          recipient,
          async readPage(cursor, nextSignal) {
            const result = await listAgentContacts({
              client: auth.apiClient.client,
              path: { agent_address: recipient },
              query: { limit: 100, ...(cursor ? { cursor } : {}) },
              signal: AbortSignal.any([nextSignal, AbortSignal.timeout(5000)]),
              responseStyle: "fields",
            });
            if (result.error || !result.data)
              throw new ListenStateError(
                "Contact notification preferences could not be read.",
              );
            return { data: result.data.data, cursor: result.data.meta?.cursor };
          },
        })
      : undefined;
    if (contactPolicy) await contactPolicy.refresh(signal);
    receiver = await openSharedMailReceiver({
      configDir: options.configDir,
      apiClient: auth.apiClient,
      apiKey: auth.auth.apiKey,
      baseUrl: auth.auth.apiBaseUrl,
      recipient,
      signal,
    });
    native.bindRecipient(recipient);
    const store = receiver.store;
    async function reconcile(row: SharedMailEmail) {
      const receipt = native.receipt(row.emailId, row.eventId);
      if (!receipt) return;
      const current = await store.readEmail(row.emailId);
      if (
        current?.route?.kind !== "notification" ||
        current.route.sessionKey !== sessionKey
      )
        throw new ListenStateError(
          "Native notification receipt conflicts with shared mail ownership.",
        );
      if (current.route.state === "selected")
        await store.markNotification(row.emailId, "submitting");
      await store.markNotification(
        row.emailId,
        receipt.state === "accepted" ? "accepted" : "unknown",
      );
      if (receipt.state !== "accepted")
        throw new ListenStateError(
          `Notification for email ${row.emailId} has an unknown outcome. Inspect the exact session; it will not be resent automatically.`,
        );
    }
    async function processMail(row: SharedMailEmail): Promise<boolean> {
      if (row.route?.kind === "wait") return true;
      if (row.route?.kind === "notification") {
        if (row.route.sessionKey !== sessionKey) return true;
        if (native.receipt(row.emailId, row.eventId)) {
          await reconcile(row);
          return true;
        }
        if (row.route.state !== "selected")
          throw new ListenStateError(
            `Notification for email ${row.emailId} is held with ${row.route.state} outcome.`,
          );
      }
      if (!contactPolicy && row.details?.authorization === "trusted") {
        if (!approvedSenders.has(row.details.peer)) return true;
        const existing = await store.claimForNotification(
          row.emailId,
          sessionKey,
        );
        if (existing.status === "held") return false;
        if (existing.status === "already_observed") return true;
      }
      const result = await getEmail({
        client: auth.apiClient.client,
        path: { id: row.emailId },
        signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
        responseStyle: "fields",
      });
      const detail = result.data?.data;
      if (result.error || !detail) {
        if (result.response?.status === 404) return true;
        if ([401, 403].includes(result.response?.status ?? 0))
          throw new ListenStateError(
            "Shared notification authorization was revoked.",
          );
        throw new NotificationRetryError(
          `Email ${row.emailId} is not available yet.`,
        );
      }
      if (
        detail.id !== row.emailId ||
        detail.recipient?.toLowerCase() !== recipient ||
        detail.to_email?.toLowerCase() !== recipient
      )
        throw new ListenStateError(
          "Email detail does not match the shared recipient and identity.",
        );
      if (detail.status === "rejected") return true;
      if (
        !["accepted", "completed"].includes(detail.status) ||
        detail.parsed?.status !== "complete"
      )
        return false;
      const admission = contactPolicy
        ? await contactPolicy.admit(
            detail.from_email,
            detail.received_at,
            signal,
          )
        : undefined;
      if (contactPolicy && !admission) return true;
      const choices = (
        admission ? [admission.sender] : [...approvedSenders]
      ).map((peer) => ({
        peer,
        trust: scopedChatSenderTrust(detail, peer),
      }));
      const trusted = choices.find((choice) => choice.trust.trusted);
      if (!trusted) return !choices.some((choice) => choice.trust.retryable);
      await hydrateNotification(store, detail, trusted.peer);
      const claim = await store.claimForNotification(row.emailId, sessionKey);
      if (claim.status === "held") return false;
      if (claim.status === "already_observed") return true;
      try {
        if (contactPolicy && admission)
          await native.handleDetail(detail, row.eventId, signal, {
            sender: admission.sender,
            recheck: (nextSignal) =>
              contactPolicy.recheck(admission, nextSignal),
          });
        else await native.handleDetail(detail, row.eventId, signal);
      } finally {
        // Only the native write-before-dispatch journal establishes submission.
        // Socket/thread preflight errors leave the shared reservation selected.
        await reconcile(row);
      }
      return true;
    }
    await receiver.ready();
    (options.stderr ?? process.stderr).write(
      `Listening for session notifications on shared subscription ${store.subscriptionName}. Reply waits retain priority; Ctrl-C disconnects.\n`,
    );
    while (
      !signal.aborted &&
      (options.number === undefined || processed < options.number)
    ) {
      await receiver.ready();
      let cursor: string | undefined;
      do {
        const page = await store.listEmails({ cursor, limit: 100 });
        for (const row of page.emails) {
          if (settled.has(row.emailId)) continue;
          try {
            const historical =
              row.route?.kind === "wait" ||
              (row.route?.kind === "notification" &&
                row.route.state === "accepted") ||
              native.receipt(row.emailId, row.eventId)?.state === "accepted";
            if (await processMail(row)) {
              settled.add(row.emailId);
              if (!historical) processed++;
            }
          } catch (error) {
            if (!(error instanceof NotificationRetryError)) throw error;
          }
          if (options.number !== undefined && processed >= options.number)
            return processed;
        }
        cursor = page.nextCursor ?? undefined;
      } while (cursor && !signal.aborted);
      await receiver.changed();
    }
  } catch (error) {
    if (!signal.aborted) throw error;
  } finally {
    try {
      await receiver?.close();
    } finally {
      native.close();
    }
  }
  return processed;
}

async function hydrateNotification(
  store: SharedMailStore,
  detail: EmailDetail,
  peer: string,
) {
  await store.hydrate(detail.id, {
    recipient: store.recipient,
    peer,
    replyToSentEmailId: detail.reply_to_sent_email_id ?? null,
    receivedAt: detail.received_at,
    authorization: "trusted",
  });
}
