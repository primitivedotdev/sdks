import { randomUUID } from "node:crypto";
import { type EmailDetail, getEmail } from "@primitivedotdev/api-core";
import {
  isEmailReceivedEvent,
  parseWebhookEvent,
} from "@primitivedotdev/sdk/webhook";
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
  type ConversationStatus,
  readBoundSentMessageId,
  reserveConversationStatus,
} from "./conversation-status.js";
import { ListenStateError } from "./listen-state.js";
import type { ListenHandler } from "./listen-types.js";
import {
  type ContactNotificationAdmission,
  ContactPolicyReadRetryError,
} from "./notification-contact-policy.js";
import {
  isRoutineNotificationContent,
  NotificationRetryError,
  notificationPartReader,
  readConversationStatusContent,
} from "./notify-session-content.js";
import { SESSION_UUID } from "./notify-session-native.js";
import { openPresenceControls } from "./presence-control.js";
import { isPlainChatReply, scopedChatSenderTrust } from "./scoped-chat.js";
import { sharedMailScope } from "./shared-mail-receiver.js";
import { openSharedMailStore } from "./shared-mail-state.js";

/** A hook receives only an ID, never email-authored text or a synthetic user turn. */
export async function createWakeMail(options: {
  configDir: string;
  apiKey?: string;
  apiBaseUrl?: string;
  sessionKey: string | null;
  sessionId?: string;
  contactRequests: boolean;
  signal?: AbortSignal;
  onWake?: () => void;
}) {
  const { apiClient, auth } = await createAuthenticatedCliApiClient({
    configDir: options.configDir,
    apiKey: options.apiKey,
    apiBaseUrl: options.apiBaseUrl,
  });
  const identity = auth.connectedAgent;
  const recipient = identity?.agentAddress;
  const policy = recipient
    ? apiContactPolicy(apiClient.client, recipient, options.contactRequests)
    : undefined;
  const notices =
    identity && options.contactRequests
      ? openContactRequestNotices(options.configDir, identity)
      : undefined;
  const activatedAt = notices ? Date.parse(notices.activate()) : 0;
  const scope =
    recipient && auth.apiKey
      ? sharedMailScope(auth.apiKey, auth.apiBaseUrl)
      : undefined;
  const store =
    recipient && scope
      ? await openSharedMailStore({
          configDir: options.configDir,
          scope,
          recipient,
        })
      : undefined;
  const readPart = notificationPartReader(async () => apiClient.client);
  let wakeId: string | undefined;
  let statusEvent: ConversationStatus | undefined;
  let pendingRequest:
    | {
        sender: string;
        emailId: string;
        eventId: string;
        decidedSenders: string[];
      }
    | undefined;
  const outcome = (accepted: boolean) => ({
    succeeded: accepted,
    outcome: { mode: "sdk" as const, accepted, duration_ms: 0 },
  });
  const parentPid = process.ppid;
  let receiving = false;
  const presence = openPresenceControls({
    configDir: options.configDir,
    apiClient,
    apiKey: auth.apiKey,
    baseUrl: auth.apiBaseUrl,
    identity,
    sessionKey: options.sessionKey,
    signal: options.signal ?? new AbortController().signal,
    eligible: async () =>
      Boolean(
        options.sessionId &&
          options.sessionKey === `claude:${options.sessionId}` &&
          parentPid > 1 &&
          process.ppid === parentPid &&
          receiving,
      ),
    onOrdinary: async (detail, eventId) => {
      const result = await processDetail(
        detail,
        eventId,
        options.signal ?? new AbortController().signal,
      );
      if (!result.succeeded) return false;
      completePending();
      if (wakeId || statusEvent) options.onWake?.();
      return true;
    },
  });
  function completePending() {
    if (!pendingRequest || !notices || !options.sessionId || !policy) return;
    const request = pendingRequest;
    pendingRequest = undefined;
    const reserve = notices.reserve(
      request.sender,
      options.sessionId,
      {
        emailId: request.emailId,
        eventId: request.eventId,
        clientId: randomUUID(),
        state: "accepted",
      },
      request.decidedSenders,
    );
    if (reserve === "reserved") wakeId = request.emailId;
  }
  const handler: ListenHandler = async (delivery, signal) => {
    try {
      signal.throwIfAborted();
      if (delivery.event_type !== "email.received")
        throw new ListenStateError("Wake received an unrelated event.");
      let event: ReturnType<typeof parseWebhookEvent>;
      try {
        event = parseWebhookEvent(
          JSON.parse(delivery.body),
          delivery.event_type,
        );
      } catch {
        throw new ListenStateError("Wake received an invalid email event.");
      }
      if (!isEmailReceivedEvent(event) || !SESSION_UUID.test(event.email.id))
        throw new ListenStateError("Wake received an invalid email ID.");
      if (!recipient || !policy || !scope || !store || !options.sessionKey)
        throw new ListenStateError("Wake requires a verified session profile.");
      if (
        !event.email.smtp.rcpt_to.some(
          (address) => address.toLowerCase() === recipient,
        )
      )
        throw new ListenStateError(
          "Wake email recipient does not match the profile.",
        );
      const observedAt = performance.now();
      const response = await getEmail({
        client: apiClient.client,
        path: { id: event.email.id },
        signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
        responseStyle: "fields",
      });
      const detail = response.data?.data;
      if (response.error || !detail) {
        if (response.response?.status === 404)
          return {
            ...outcome(true),
            countTowardLimit: !presence.knownControl(event.email.id),
          };
        return outcome(false);
      }
      if (
        detail.id !== event.email.id ||
        detail.recipient?.toLowerCase() !== recipient ||
        detail.to_email?.toLowerCase() !== recipient
      )
        throw new ListenStateError("Wake email detail has another recipient.");
      const control = await presence.handle(
        detail,
        delivery.event_id,
        observedAt,
      );
      if (control !== "ordinary")
        return { ...outcome(true), countTowardLimit: false };
      return await processDetail(detail, delivery.event_id, signal);
    } catch (error) {
      if (
        error instanceof NotificationRetryError ||
        error instanceof ContactPolicyReadRetryError
      )
        return outcome(false);
      throw error;
    }
  };
  async function processDetail(
    detail: EmailDetail,
    eventId: string,
    signal: AbortSignal,
  ) {
    if (!recipient || !policy || !scope || !store || !options.sessionKey)
      throw new ListenStateError("Wake requires a verified session profile.");
    if (
      detail.recipient?.toLowerCase() !== recipient ||
      detail.to_email?.toLowerCase() !== recipient
    )
      throw new ListenStateError("Wake email detail has another recipient.");
    signal.throwIfAborted();
    try {
      if (detail.status === "rejected") return outcome(true);
      if (
        !["accepted", "completed"].includes(detail.status) ||
        detail.parsed?.status !== "complete"
      )
        return outcome(false);
      const sender = detail.from_email.trim().toLowerCase();
      const trust = scopedChatSenderTrust(detail, sender);
      if (trust.retryable) return outcome(false);
      if (!trust.trusted) return outcome(true);
      const requested = detail.reply_to_sent_email_id
        ? await store.findWaitByParent(detail.reply_to_sent_email_id)
        : null;
      if (requested?.sessionKey && requested.sessionKey !== options.sessionKey)
        return outcome(true);
      // A bare CLI profile may manually wait for acceptance, but its unbound
      // contact request does not grant any coding session a wake target.
      if (
        requested?.contactRequest &&
        requested.sessionKey === null &&
        requested.sentEmailId === detail.reply_to_sent_email_id &&
        requested.peer === sender &&
        Date.parse(detail.received_at) >= Date.parse(requested.createdAt) &&
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
        return outcome(true);
      const followed = detail.thread_id
        ? readConversationFollow(
            { configDir: options.configDir, scope, recipient },
            detail.thread_id,
          )
        : null;
      if (followed && followed.sessionKey !== options.sessionKey)
        return outcome(true);
      const statusContent =
        requested?.status === "bound"
          ? await readConversationStatusContent(detail, readPart, signal)
          : null;
      const sentMessageId =
        requested && statusContent
          ? await readBoundSentMessageId(apiClient, requested, signal)
          : null;
      if (statusContent && !sentMessageId) return outcome(false);
      const status = requested
        ? boundConversationStatus(
            detail,
            statusContent,
            requested,
            sentMessageId,
            options.sessionKey,
          )
        : null;
      let admission: ContactNotificationAdmission | null | undefined;
      let admissionRetry: NotificationRetryError | undefined;
      try {
        admission = await policy.admit(
          sender,
          detail.received_at,
          signal,
          detail.id,
        );
      } catch (error) {
        signal.throwIfAborted();
        if (!(error instanceof NotificationRetryError)) throw error;
        // Exact local replies have separate permission from network wake.
        admissionRetry = error;
      }
      if (status) {
        if (!admission || admission.kind === "request")
          admission = await policy.admitResponse(
            sender,
            detail.received_at,
            signal,
          );
        if (admissionRetry && admission?.kind !== "response")
          throw admissionRetry;
        if (!admission || admission.kind === "request") return outcome(true);
        const check = await policy.recheck(admission, signal);
        check();
        if (
          await reserveConversationStatus(
            {
              configDir: options.configDir,
              scope,
              recipient,
              sessionKey: options.sessionKey,
            },
            status,
          )
        )
          statusEvent = status;
        return outcome(true);
      }
      if (
        (!admission || admission.kind === "request") &&
        requested &&
        detail.reply_to_sent_email_id
      ) {
        const exact =
          ["bound", "completed"].includes(requested.status) &&
          requested.sentEmailId === detail.reply_to_sent_email_id &&
          requested.peer === sender &&
          (requested.sessionKey === null ||
            requested.sessionKey === options.sessionKey) &&
          Date.parse(detail.received_at) >= Date.parse(requested.createdAt);
        if (exact) {
          const isResponse = requested.contactRequest
            ? isContactAcceptance(
                await readContactInteraction(
                  detail,
                  readPart,
                  signal,
                  Date.parse(detail.received_at),
                ),
                requested.contactRequest,
              )
            : isPlainChatReply(detail);
          if (isResponse) {
            admission = await policy.admitResponse(
              sender,
              detail.received_at,
              signal,
            );
            if (admission) {
              const disposition = await store.wakeDisposition(
                detail.id,
                detail.reply_to_sent_email_id,
              );
              if (disposition === "observed") return outcome(true);
              if (disposition === "waiting") return outcome(false);
            }
          }
        }
      }
      if (
        (!admission || admission.kind === "request") &&
        followed &&
        followed.peer === sender &&
        Date.parse(detail.received_at) >= Date.parse(followed.since) &&
        isPlainChatReply(detail)
      )
        admission = await policy.admitResponse(
          sender,
          detail.received_at,
          signal,
        );
      if (admissionRetry && admission?.kind !== "response")
        throw admissionRetry;
      if (!admission) return outcome(true);
      if (admission.kind === "request") {
        if (
          !notices ||
          !options.sessionId ||
          Date.parse(detail.received_at) < activatedAt
        )
          return outcome(true);
        const interaction = await readContactInteraction(
          detail,
          readPart,
          signal,
          Date.parse(detail.received_at),
        );
        if (interaction?.step !== "request") return outcome(true);
      }
      try {
        if (await isRoutineNotificationContent(detail, readPart, signal))
          return outcome(true);
      } catch (error) {
        if (error instanceof NotificationRetryError) return outcome(false);
        throw error;
      }
      try {
        const check = await policy.recheck(admission, signal);
        check();
      } catch (error) {
        if (error instanceof NotificationRetryError) return outcome(false);
        throw error;
      }
      if (
        requested &&
        !requested.contactRequest &&
        ["bound", "completed"].includes(requested.status) &&
        requested.sessionKey === options.sessionKey &&
        requested.sentEmailId === detail.reply_to_sent_email_id &&
        requested.peer === sender &&
        Date.parse(detail.received_at) >= Date.parse(requested.createdAt) &&
        isPlainChatReply(detail)
      ) {
        await followEmailConversation(
          {
            configDir: options.configDir,
            scope,
            recipient,
            peer: sender,
            sessionKey: options.sessionKey,
            since: requested.createdAt,
          },
          detail,
        );
      }
      if (admission.kind === "request")
        pendingRequest = {
          sender,
          emailId: detail.id,
          eventId: eventId,
          decidedSenders: [...policy.members()],
        };
      else wakeId = detail.id;
      return outcome(true);
    } catch (error) {
      if (
        error instanceof NotificationRetryError ||
        error instanceof ContactPolicyReadRetryError
      )
        return outcome(false);
      throw error;
    }
  }
  return {
    handler,
    wakeId: () => wakeId,
    status: () => statusEvent,
    completed: completePending,
    receiving: (ready: boolean) => {
      receiving = ready;
    },
    close: () => presence.close(),
  };
}
