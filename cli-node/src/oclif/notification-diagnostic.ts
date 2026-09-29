import { type EmailDetail, getEmail } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "./api-client.js";
import { apiContactPolicy } from "./contact-policy-client.js";
import {
  type ConversationFollow,
  readConversationFollow,
} from "./conversation-follow.js";
import { isPlainChatReply, scopedChatSenderTrust } from "./scoped-chat.js";
import { mailId } from "./shared-mail-files.js";
import { sharedMailScope } from "./shared-mail-receiver.js";
import {
  openSharedMailStore,
  type SharedMailEmail,
  type SharedMailWait,
} from "./shared-mail-state.js";

/** Explain current evidence without submitting an event or changing permissions. */
export function notificationDecision(input: {
  row: SharedMailEmail | null;
  detail: EmailDetail;
  requested: SharedMailWait | null;
  followed?: ConversationFollow | null;
  sessionKey: string;
  policy: "allowed" | "request" | "response" | "silent";
}) {
  const { row, detail, requested, followed, sessionKey, policy } = input;
  if (!row) return "not_observed_locally";
  if (row.route?.kind === "wait")
    return row.route.observed
      ? "returned_to_reply_wait"
      : "claimed_by_reply_wait";
  if (row.route?.kind === "notification") {
    if (row.route.sessionKey !== sessionKey) return "claimed_by_other_session";
    return `native_event_${row.route.state}`;
  }
  if (requested?.sessionKey && requested.sessionKey !== sessionKey)
    return "conversation_belongs_to_other_session";
  if (followed && followed.sessionKey !== sessionKey)
    return "conversation_belongs_to_other_session";
  if (detail.status === "rejected") return "email_rejected";
  if (
    !["accepted", "completed"].includes(detail.status) ||
    detail.parsed?.status !== "complete"
  )
    return "email_processing";
  const trust = scopedChatSenderTrust(detail, detail.from_email);
  if (!trust.trusted)
    return trust.retryable
      ? "sender_authentication_pending"
      : "sender_authentication_failed";
  if (policy === "silent") return "sender_not_enabled_or_explicitly_silenced";
  if (policy === "request") return "contact_request_policy_only";
  if (!isPlainChatReply(detail))
    return "interaction_requires_protocol_handling";
  return "eligible_now";
}

export async function explainNotification(options: {
  configDir: string;
  apiKey?: string;
  apiBaseUrl?: string;
  emailId: string;
  sessionId: string;
}) {
  const emailId = mailId(options.emailId);
  const { auth, apiClient } = await createAuthenticatedCliApiClient(options);
  if (!auth.connectedAgent)
    throw new Error(
      "Email notification diagnostics require a connected-agent profile.",
    );
  const recipient = auth.connectedAgent.agentAddress;
  const signal = AbortSignal.timeout(10_000);
  const result = await getEmail({
    client: apiClient.client,
    path: { id: emailId },
    signal,
    responseStyle: "fields",
  });
  const detail = result.data?.data;
  if (
    result.error ||
    !detail ||
    detail.id !== emailId ||
    detail.recipient !== recipient ||
    detail.to_email !== recipient
  )
    throw new Error(
      "The requested email is unavailable for this connected identity.",
    );
  const store = await openSharedMailStore({
    configDir: options.configDir,
    scope: sharedMailScope(auth.apiKey, auth.apiBaseUrl),
    recipient,
    signal,
  });
  const row = await store.readEmail(emailId);
  const requested = detail.reply_to_sent_email_id
    ? await store.findWaitByParent(detail.reply_to_sent_email_id)
    : null;
  const followed = detail.thread_id
    ? readConversationFollow(
        {
          configDir: options.configDir,
          scope: sharedMailScope(auth.apiKey, auth.apiBaseUrl),
          recipient,
        },
        detail.thread_id,
      )
    : null;
  const sessionKey = `codex:${options.sessionId.toLowerCase()}`;
  const policy = apiContactPolicy(apiClient.client, recipient, true);
  let admission = await policy.admit(
    detail.from_email,
    detail.received_at,
    signal,
  );
  if (
    admission?.kind !== "allowed" &&
    requested &&
    (requested.status === "bound" ||
      (requested.status === "completed" &&
        !requested.contactRequest &&
        requested.sessionKey === sessionKey)) &&
    (requested.sessionKey === null || requested.sessionKey === sessionKey) &&
    requested.peer === detail.from_email.trim().toLowerCase() &&
    Date.parse(detail.received_at) >= Date.parse(requested.createdAt) &&
    isPlainChatReply(detail) &&
    !requested.contactRequest &&
    scopedChatSenderTrust(detail, requested.peer).trusted
  ) {
    admission = await policy.admitResponse(
      requested.peer,
      detail.received_at,
      signal,
    );
  }
  if (
    admission?.kind !== "allowed" &&
    followed &&
    followed.sessionKey === sessionKey &&
    followed.peer === detail.from_email.trim().toLowerCase() &&
    Date.parse(detail.received_at) >= Date.parse(followed.since) &&
    isPlainChatReply(detail) &&
    scopedChatSenderTrust(detail, followed.peer).trusted
  )
    admission = await policy.admitResponse(
      followed.peer,
      detail.received_at,
      signal,
    );
  return {
    emailId,
    reason: notificationDecision({
      row,
      detail,
      requested,
      followed,
      sessionKey,
      policy: admission?.kind ?? "silent",
    }),
    replyWait: requested
      ? { status: requested.status, sessionKey: requested.sessionKey }
      : null,
    conversationFollow: followed
      ? {
          threadId: followed.threadId,
          sessionKey: followed.sessionKey,
          since: followed.since,
        }
      : null,
    evaluatedPolicy: "saved_contacts",
    guidance:
      "Current saved contact policy and local receipts only. A receiver started with an explicit --sender list or with contact-request intake disabled can be narrower. No message was dispatched, and event acceptance does not prove reading.",
  };
}
