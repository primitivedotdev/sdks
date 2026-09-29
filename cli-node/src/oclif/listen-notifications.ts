import { type EmailDetail, getEmail } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "./api-client.js";
import {
  isContactAcceptance,
  readContactInteraction,
} from "./contact-interactions.js";
import { apiContactPolicy } from "./contact-policy-client.js";
import { openContactRequestNotices } from "./contact-request-state.js";
import {
  followEmailConversation,
  readConversationFollow,
} from "./conversation-follow.js";
import {
  boundConversationStatus,
  conversationStatusDue,
  readBoundSentMessageId,
  reserveConversationStatus,
} from "./conversation-status.js";
import type { ListenOptions } from "./listen-runner.js";
import { ListenStateError } from "./listen-state.js";
import {
  NETWORK_ADMISSION_PENDING_RETRY_MS,
  NetworkAdmissionPendingError,
} from "./notification-contact-policy.js";
import {
  notificationScope,
  openSessionNotifications,
} from "./notify-session.js";
import {
  NotificationRetryError,
  notificationPartReader,
  readConversationStatusContent,
} from "./notify-session-content.js";
import {
  NativeSessionError,
  NotificationOutcomeUnknownError,
} from "./notify-session-errors.js";
import { openPresenceControls } from "./presence-control.js";
import { isPlainChatReply, scopedChatSenderTrust } from "./scoped-chat.js";
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
  if (notify.contactRequests && !notify.contactPreferences)
    throw new ListenStateError("--contact-requests requires --contacts.");
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
  if (
    options.expectedNotificationScope !== undefined &&
    notificationScope(auth.auth.apiBaseUrl, auth.auth.apiKey) !==
      options.expectedNotificationScope
  )
    throw new ListenStateError(
      "The selected connection changed. Stop this listener and start it again with the intended profile.",
    );
  const scope = sharedMailScope(auth.auth.apiKey, auth.auth.apiBaseUrl),
    signal = options.signal;
  const readPart = notificationPartReader(async () => auth.apiClient.client);
  const native = await openSessionNotifications({
    ...notify,
    configDir: options.configDir,
    scope,
    signal,
    readPart,
  });
  let receiver: Awaited<ReturnType<typeof openSharedMailReceiver>> | undefined;
  let processed = 0;
  let failure: unknown;
  const settled = new Set<string>();
  const deferredUntil = new Map<string, number>();
  const sessionKey = `codex:${notify.threadId.toLowerCase()}`;
  const controls = new Set<string>();
  const presence = openPresenceControls({
    configDir: options.configDir,
    apiClient: auth.apiClient,
    apiKey: auth.auth.apiKey,
    baseUrl: auth.auth.apiBaseUrl,
    identity: auth.auth.connectedAgent,
    sessionKey,
    signal,
    eligible: async () => {
      const status = receiver?.status();
      if (!status?.alive || !status.ready || !native.verify) return false;
      await native.verify();
      return !signal.aborted;
    },
  });
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
      ? apiContactPolicy(
          auth.apiClient.client,
          recipient,
          notify.contactRequests,
          Boolean(auth.auth.connectedAgent),
        )
      : undefined;
    if (contactPolicy) await contactPolicy.refresh(signal);
    if (notify.contactRequests && !auth.auth.connectedAgent)
      throw new ListenStateError(
        "Contact request notices require a saved connected-agent profile.",
      );
    const requestNotices =
      notify.contactRequests && auth.auth.connectedAgent
        ? openContactRequestNotices(options.configDir, auth.auth.connectedAgent)
        : undefined;
    const startedAt = requestNotices
      ? Date.parse(requestNotices.activate())
      : Date.now();
    let budgetWarned = false;
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
      if (!receipt || receipt.state === "not_submitted") return;
      const unknown =
        receipt.state !== "accepted"
          ? new NotificationOutcomeUnknownError(
              `Notification for email ${row.emailId} has an unknown outcome. Inspect the exact session; it will not be resent automatically.`,
            )
          : undefined;
      try {
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
      } catch (error) {
        // Cancellation may prevent shared journal reconciliation. The native
        // durable receipt still forbids replay and must remain the outcome.
        throw unknown ?? error;
      }
      if (unknown) throw unknown;
    }
    async function processMail(row: SharedMailEmail): Promise<boolean> {
      if (presence.knownControl(row.emailId)) controls.add(row.emailId);
      if (row.route?.kind === "wait") return true;
      if (row.route?.kind === "notification") {
        if (row.route.state === "skipped") return true;
        if (row.route.sessionKey !== sessionKey) return true;
        const existingReceipt = native.receipt(row.emailId, row.eventId);
        if (existingReceipt && existingReceipt.state !== "not_submitted") {
          await reconcile(row);
          return true;
        }
        if (row.route.state !== "selected")
          throw new NotificationOutcomeUnknownError(
            `Notification for email ${row.emailId} is held with ${row.route.state} outcome.`,
          );
      }
      if (!contactPolicy && row.details?.authorization === "trusted") {
        if (!approvedSenders.has(row.details.peer)) return true;
      }
      const observedAt = performance.now();
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
      const control = await presence.handle(detail, row.eventId, observedAt);
      if (control !== "ordinary") {
        controls.add(row.emailId);
        if (control === "pending")
          deferredUntil.set(
            row.emailId,
            presence.nextRetry(row.emailId) ?? performance.now() + 5000,
          );
        return control === "quiet";
      }
      controls.delete(row.emailId);
      if (detail.status === "rejected") return true;
      if (
        !["accepted", "completed"].includes(detail.status) ||
        detail.parsed?.status !== "complete"
      )
        return false;
      const requested = detail.reply_to_sent_email_id
        ? await store.findWaitByParent(detail.reply_to_sent_email_id)
        : null;
      if (requested?.sessionKey && requested.sessionKey !== sessionKey)
        return true;
      const followed = detail.thread_id
        ? readConversationFollow(
            { configDir: options.configDir, scope, recipient },
            detail.thread_id,
          )
        : null;
      if (followed && followed.sessionKey !== sessionKey) return true;
      const sender = detail.from_email.trim().toLowerCase();
      // Directory membership is never evidence that this email came from the
      // claimed sender. Verify the carrier before asking for network admission.
      const senderTrust = scopedChatSenderTrust(detail, sender);
      if (senderTrust.retryable) return false;
      if (!senderTrust.trusted) return true;
      // Manual-only contact waits have no coding session to notify, even if
      // this sender is otherwise approved for unsolicited mail.
      if (
        requested?.contactRequest &&
        requested.sessionKey === null &&
        requested.sentEmailId === detail.reply_to_sent_email_id &&
        requested.peer === sender &&
        Date.parse(detail.received_at) >= Date.parse(requested.createdAt)
      ) {
        const trust = scopedChatSenderTrust(detail, sender);
        if (trust.retryable) return false;
        if (
          trust.trusted &&
          isContactAcceptance(
            await readContactInteraction(
              detail,
              readPart,
              signal,
              Date.parse(detail.received_at),
            ),
            requested.contactRequest,
          )
        )
          return true;
      }
      let status = null;
      if (
        requested &&
        requested.status === "bound" &&
        requested.peer === sender &&
        requested.sessionKey === sessionKey &&
        requested.sentEmailId === detail.reply_to_sent_email_id
      ) {
        const statusTrust = scopedChatSenderTrust(detail, sender);
        if (statusTrust.retryable) return false;
        if (statusTrust.trusted) {
          const content = await readConversationStatusContent(
            detail,
            readPart,
            signal,
          );
          if (content) {
            const sentMessageId = await readBoundSentMessageId(
              auth.apiClient,
              requested,
              signal,
            );
            if (!sentMessageId) return false;
            status = boundConversationStatus(
              detail,
              content,
              requested,
              sentMessageId,
              sessionKey,
            );
          }
        }
      }
      let admission = contactPolicy
        ? await contactPolicy.admit(
            detail.from_email,
            detail.received_at,
            signal,
            detail.id,
          )
        : undefined;
      if (
        status &&
        contactPolicy &&
        (!admission || admission.kind === "request")
      )
        admission = await contactPolicy.admitResponse(
          sender,
          detail.received_at,
          signal,
        );
      if (status && admission?.kind === "request") return true;
      if (
        contactPolicy &&
        admission?.kind !== "allowed" &&
        detail.reply_to_sent_email_id
      ) {
        if (
          requested &&
          (requested.status === "bound" ||
            (requested.status === "completed" &&
              !requested.contactRequest &&
              requested.sessionKey === sessionKey)) &&
          requested.sentEmailId === detail.reply_to_sent_email_id &&
          requested.peer === detail.from_email.trim().toLowerCase() &&
          (requested.sessionKey === null ||
            requested.sessionKey === sessionKey) &&
          Date.parse(detail.received_at) >= Date.parse(requested.createdAt)
        ) {
          const trust = scopedChatSenderTrust(detail, requested.peer);
          if (trust.retryable) return false;
          if (trust.trusted) {
            const response = requested.contactRequest
              ? isContactAcceptance(
                  await readContactInteraction(
                    detail,
                    notificationPartReader(async () => auth.apiClient.client),
                    signal,
                    Date.parse(detail.received_at),
                  ),
                  requested.contactRequest,
                )
              : isPlainChatReply(detail);
            if (response)
              admission = await contactPolicy.admitResponse(
                requested.peer,
                detail.received_at,
                signal,
              );
          }
        }
      }
      if (
        contactPolicy &&
        admission?.kind !== "allowed" &&
        followed &&
        followed.peer === detail.from_email.trim().toLowerCase() &&
        Date.parse(detail.received_at) >= Date.parse(followed.since) &&
        isPlainChatReply(detail)
      ) {
        const trust = scopedChatSenderTrust(detail, followed.peer);
        if (trust.retryable) return false;
        if (trust.trusted)
          admission = await contactPolicy.admitResponse(
            followed.peer,
            detail.received_at,
            signal,
          );
      }
      if (contactPolicy && !admission) return true;
      const choices = (
        admission ? [admission.sender] : [...approvedSenders]
      ).map((peer) => ({
        peer,
        trust: scopedChatSenderTrust(detail, peer),
      }));
      const trusted = choices.find((choice) => choice.trust.trusted);
      if (!trusted) return !choices.some((choice) => choice.trust.retryable);
      let requestExpiry: number | undefined;
      if (admission?.kind === "request") {
        // Opting in never backfills the retained local journal or queued old mail.
        if (
          !requestNotices ||
          Date.parse(row.firstSeenAt) < startedAt ||
          Date.parse(detail.received_at) < startedAt
        )
          return true;
        const interaction = await readContactInteraction(
          detail,
          notificationPartReader(async () => auth.apiClient.client),
          signal,
        );
        if (interaction?.step !== "request") return true;
        requestExpiry = Date.parse(interaction.expires_at);
      }
      await hydrateNotification(store, detail, trusted.peer);
      const claim = await store.claimForNotification(row.emailId, sessionKey);
      if (claim.status === "held") return false;
      if (claim.status === "already_observed") return true;
      if (
        status &&
        !(await conversationStatusDue(
          {
            configDir: options.configDir,
            scope,
            recipient,
            sessionKey,
          },
          status,
        ))
      ) {
        await store.skipNotification(row.emailId, sessionKey);
        return true;
      }
      if (
        requested &&
        !requested.contactRequest &&
        ["bound", "completed"].includes(requested.status) &&
        requested.sessionKey === sessionKey &&
        requested.sentEmailId === detail.reply_to_sent_email_id &&
        requested.peer === trusted.peer &&
        Date.parse(detail.received_at) >= Date.parse(requested.createdAt) &&
        isPlainChatReply(detail)
      ) {
        // The first authenticated reply establishes interest in its exact server
        // thread even when an async chat has no waiter left to observe it.
        const check =
          contactPolicy && admission
            ? await contactPolicy.recheck(admission, signal)
            : undefined;
        check?.();
        await followEmailConversation(
          {
            configDir: options.configDir,
            scope,
            recipient,
            peer: trusted.peer,
            sessionKey,
            since: requested.createdAt,
          },
          detail,
        );
      }
      let dispatchFailure: unknown;
      let completed = true;
      try {
        const outcome =
          contactPolicy && admission
            ? await native.handleDetail(
                detail,
                row.eventId,
                signal,
                {
                  sender: admission.sender,
                  contactRequest: admission.kind === "request",
                  recheck: async (nextSignal) => {
                    const allowed = await contactPolicy.recheck(
                      admission,
                      nextSignal,
                    );
                    return () => {
                      allowed();
                    };
                  },
                  ...(admission.kind === "request" && requestNotices
                    ? {
                        reserve: (receipt) => {
                          if (
                            requestExpiry === undefined ||
                            Date.now() >= requestExpiry
                          )
                            return false;
                          const result = requestNotices.reserve(
                            admission.sender,
                            notify.threadId,
                            receipt,
                            contactPolicy.members(),
                          );
                          if (
                            (result === "full" || result === "exhausted") &&
                            !budgetWarned
                          ) {
                            budgetWarned = true;
                            (options.stderr ?? process.stderr).write(
                              result === "exhausted"
                                ? "First-contact sender retention limit reached. Known contacts continue; inspect new requests manually.\n"
                                : "First-contact notice capacity reached. Known contacts continue; review existing requests before admitting more.\n",
                            );
                          }
                          return result === "full"
                            ? "deferred"
                            : result === "reserved";
                        },
                      }
                    : {}),
                },
                status ?? undefined,
              )
            : await native.handleDetail(
                detail,
                row.eventId,
                signal,
                undefined,
                status ?? undefined,
              );
        if (outcome.disposition === "deferred") {
          await store.releaseNotification(row.emailId, sessionKey);
          // Local journal changes must not create a hot retry loop. Retry only
          // this known ID, with fresh policy, after a bounded cooldown.
          deferredUntil.set(row.emailId, performance.now() + 30_000);
          completed = false;
        }
        // Suppression is a terminal non-dispatch decision, not an unknown send.
        // Persist it separately from native receipts so restarts cannot reclaim it.
        if (outcome.disposition === "skipped")
          await store.skipNotification(row.emailId, sessionKey);
        if (outcome.disposition === "notified" && status)
          await reserveConversationStatus(
            {
              configDir: options.configDir,
              scope,
              recipient,
              sessionKey,
            },
            status,
          );
      } catch (error) {
        dispatchFailure = error;
      }
      // Only the native write-before-dispatch journal establishes submission.
      // Preserve its outcome even when abort prevents shared reconciliation.
      try {
        await reconcile(row);
      } catch (error) {
        if (!(dispatchFailure instanceof NotificationOutcomeUnknownError)) {
          if (error instanceof NotificationOutcomeUnknownError)
            dispatchFailure = error;
          else dispatchFailure ??= error;
        }
      }
      if (dispatchFailure !== undefined) throw dispatchFailure;
      return completed;
    }
    await receiver.ready();
    options.onReady?.();
    (options.stderr ?? process.stderr).write(
      `Listening for session notifications on shared subscription ${store.subscriptionName}. Reply waits retain priority; Ctrl-C disconnects.\n`,
    );
    receiving: while (
      !signal.aborted &&
      (options.number === undefined || processed < options.number)
    ) {
      await receiver.ready();
      let cursor: string | undefined;
      do {
        const page = await store.listEmails({ cursor, limit: 100 });
        for (const row of page.emails) {
          if (settled.has(row.emailId)) continue;
          if ((deferredUntil.get(row.emailId) ?? 0) > performance.now())
            continue;
          deferredUntil.delete(row.emailId);
          try {
            const historical =
              row.route?.kind === "wait" ||
              (row.route?.kind === "notification" &&
                (row.route.state === "accepted" ||
                  row.route.state === "skipped")) ||
              native.receipt(row.emailId, row.eventId)?.state === "accepted";
            if (await processMail(row)) {
              if (!historical) {
                // A previously selected request may expire or lose admission
                // before reaching native preflight on the next run.
                const current = await store.readEmail(row.emailId);
                if (
                  current?.route?.kind === "notification" &&
                  current.route.sessionKey === sessionKey &&
                  current.route.state === "selected" &&
                  !native.receipt(row.emailId, row.eventId)
                )
                  await store.skipNotification(row.emailId, sessionKey);
              }
              settled.add(row.emailId);
              if (!historical && !controls.has(row.emailId)) processed++;
            }
          } catch (error) {
            if (!(error instanceof NotificationRetryError)) throw error;
            if (error instanceof NetworkAdmissionPendingError)
              deferredUntil.set(
                row.emailId,
                performance.now() + NETWORK_ADMISSION_PENDING_RETRY_MS,
              );
          }
          if (options.number !== undefined && processed >= options.number)
            break receiving;
        }
        cursor = page.nextCursor ?? undefined;
      } while (cursor && !signal.aborted);
      await receiver.changed();
    }
  } catch (error) {
    // Only deliberate cancellation is a clean stop. A native disconnect or
    // unknown submission can abort this same signal and must reach supervision.
    const cancelled =
      signal.aborted &&
      !(signal.reason instanceof NativeSessionError) &&
      !(error instanceof NativeSessionError) &&
      (error === signal.reason ||
        (error instanceof Error && error.name === "AbortError"));
    if (!cancelled) failure = error;
  }
  if (signal.reason instanceof NativeSessionError) failure ??= signal.reason;
  try {
    await presence.close();
  } catch (error) {
    failure ??= error;
  }
  try {
    await receiver?.close();
  } catch (error) {
    failure ??= error;
  }
  try {
    native.close();
  } catch (error) {
    failure ??= error;
  }
  if (failure !== undefined) throw failure;
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
    ...(detail.thread_id ? { threadId: detail.thread_id } : {}),
    receivedAt: detail.received_at,
    authorization: "trusted",
  });
}
