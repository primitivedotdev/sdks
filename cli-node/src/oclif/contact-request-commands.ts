import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  getEmail,
  type PrimitiveApiClient,
  replyToEmail,
  type SendMailResult,
  sendEmail,
} from "@primitivedotdev/api-core";
import type { ConnectedAgentIdentity } from "./connected-agent-profile.js";
import {
  agentProfileDirectory,
  loadConnectedAgentProfile,
} from "./connected-agent-profile.js";
import { openConnectedReplyWait } from "./connected-reply-wait.js";
import {
  type ContactInteraction,
  contactReference,
  prepareContactAcceptance,
  prepareContactRequest,
  readContactInteraction,
} from "./contact-interactions.js";
import { evaluateContactPolicy } from "./contact-policy.js";
import { apiContactPolicy } from "./contact-policy-client.js";
import { canonicalContactSelector } from "./contact-rule-matcher.js";
import { runContactRequest } from "./contacts.js";
import { currentMailSessionKey } from "./mail-session.js";
import { notificationPartReader } from "./notify-session-content.js";
import { reconcileChatSend } from "./reconcile-chat-send.js";
import { scopedChatSenderTrust } from "./scoped-chat.js";
import {
  classifySendError,
  sendOutcomeExitCode,
  successfulSendOutcome,
} from "./send-outcome.js";
import {
  mailId,
  mailObject,
  privateMailDirectory,
  readMailJson,
  withMailLock,
  writeMailJson,
} from "./shared-mail-files.js";
import { sharedMailScope } from "./shared-mail-receiver.js";
import { openSharedMailStore } from "./shared-mail-state.js";

type Context = {
  apiClient: PrimitiveApiClient;
  apiKey: string | undefined;
  identity: ConnectedAgentIdentity;
  configDir: string;
};
type Result = { exitCode: number; data: Record<string, unknown> };
const signal = () => new AbortController().signal;
const attachment = (value: ContactInteraction) => ({
  filename: "interaction.json",
  content_type: "application/json",
  content_base64: Buffer.from(JSON.stringify(value)).toString("base64"),
});
const timeout = (seconds: number) => {
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 86400)
    throw new Error("Contact wait timeout must be 1-86400 seconds.");
  return Date.now() + seconds * 1000;
};
const sessionRequired = () =>
  new Error(
    "This contact request needs the selected profile's verified setup for this exact coding session. No request was sent. Reconnect this session, then start a new contact request.",
  );

/** A saved profile binds one runtime session; a missing Claude Bash ID uses only its verified external setup. */
export function contactRequestSessionKey(
  context: Pick<Context, "apiKey" | "configDir" | "identity">,
  env: Record<string, string | undefined> = process.env,
): string | null {
  try {
    const profile = loadConnectedAgentProfile(
      context.configDir,
      context.identity.profileName,
    );
    const raw = readMailJson(
      join(
        agentProfileDirectory(context.configDir, context.identity.profileName),
        "setup.json",
      ),
    );
    if (
      !profile ||
      context.apiKey !== profile.api_key ||
      profile.org_id !== context.identity.orgId ||
      profile.agent_address !== context.identity.agentAddress ||
      profile.owner_address !== context.identity.ownerAddress ||
      profile.api_base_url !== context.identity.apiBaseUrl
    )
      throw sessionRequired();
    const runtime = currentMailSessionKey(env);
    const hasRuntime = Boolean(
      env.CODEX_SESSION_ID || env.CODEX_THREAD_ID || env.CLAUDE_CODE_SESSION_ID,
    );
    // A bare CLI profile can request and manually wait for contact acceptance.
    // It has no session to wake, even when invoked inside a coding runtime.
    if (raw === null) {
      if (hasRuntime && !runtime) throw sessionRequired();
      return null;
    }
    if (typeof raw !== "object" || Array.isArray(raw)) throw sessionRequired();
    const setup = raw as Record<string, unknown>;
    // Poll receiving binds no session: like a bare profile, it requests and
    // waits manually, and its agent checks for the acceptance itself.
    if (
      setup.receiverMode === "poll" &&
      setup.session === null &&
      setup.invitationHash === profile.invitation_hash
    )
      return null;
    const session = mailId(setup.session);
    const receiverMode = setup.receiverMode ?? "native";
    const receipt = setup.receipt;
    if (
      setup.version !== 1 ||
      setup.invitationHash !== profile.invitation_hash ||
      setup.phase !== "sent" ||
      !["native", "external"].includes(String(receiverMode)) ||
      !receipt ||
      typeof receipt !== "object" ||
      Array.isArray(receipt) ||
      ![
        "queued",
        "submitted_to_agent",
        "delivered",
        "deferred",
        "scheduled",
      ].includes(String((receipt as Record<string, unknown>).status))
    )
      throw sessionRequired();
    mailId((receipt as Record<string, unknown>).id);
    const key = `${receiverMode === "external" ? "claude" : "codex"}:${session}`;
    if (
      (hasRuntime && runtime !== key) ||
      (!hasRuntime && receiverMode !== "external")
    )
      throw sessionRequired();
    return key;
  } catch {
    throw sessionRequired();
  }
}
function sentResult(sent: SendMailResult): Result {
  const outcome = successfulSendOutcome(sent);
  return {
    exitCode: sendOutcomeExitCode(outcome),
    data: {
      outcome,
      sent_id: sent.id,
      delivery_status: sent.status,
    },
  };
}

/** Explicit local consent, never a write prompted merely by receiving acceptance. */
async function enablePeer(
  context: Context,
  peer: string,
  reason?: string,
): Promise<void> {
  // Consent changes inspect stored policy, not an invented delivered email.
  // Receiving still rechecks each exact email through member/network admission.
  const policy = apiContactPolicy(
    context.apiClient.client,
    context.identity.agentAddress,
    false,
    false,
  );
  const current = await policy.refresh(signal());
  const membership = current.senders.get(peer);
  const decision = evaluateContactPolicy({
    policy: current.policy,
    sender: peer,
    receivedAt: new Date().toISOString(),
    membership,
    contactRequests: false,
  });
  if (
    membership?.notify === false ||
    (decision.kind === "silent" && ["agent", "org"].includes(decision.source))
  )
    throw new Error(
      "This contact is silenced. Change the owner's explicit policy or existing preference first; no permission was overwritten.",
    );
  if (!membership)
    await runContactRequest(context.apiClient.client, {
      target: "agent",
      action: "add",
      agent: context.identity.agentAddress,
      address: peer,
      notify: true,
      ...(reason ? { purpose: reason } : {}),
    });
  await policy.refresh(signal());
  const allowed = await policy.admit(peer, new Date().toISOString(), signal());
  if (!allowed || allowed.kind !== "allowed")
    throw new Error(
      "Contact notification permission changed. No contact email was sent; inspect the saved preference before retrying.",
    );
}

export async function requestContact(
  context: Context,
  options: {
    address: string;
    reason: string;
    notify: boolean;
    wait: boolean;
    timeoutSeconds: number;
    expiresIn: number;
  },
): Promise<Result> {
  const peer = canonicalContactSelector({
    kind: "address",
    value: options.address,
  }).value;
  if (peer === context.identity.agentAddress)
    throw new Error("Choose a different contact address.");
  const sessionKey = contactRequestSessionKey(context);
  const request = prepareContactRequest(
    context.identity.agentAddress,
    options.reason,
    options.expiresIn,
  );
  const deadline = Math.min(
    timeout(options.timeoutSeconds),
    Date.parse(request.expires_at),
  );
  if (options.notify) await enablePeer(context, peer, options.reason);
  else {
    // An owner-initiated request saves the address, not notification permission.
    // Finish this idempotent directory write before any email can be submitted.
    try {
      await runContactRequest(context.apiClient.client, {
        target: "directory",
        action: "add",
        address: peer,
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new Error(
        "The organization contact could not be confirmed. No contact email was sent. Retrying this request is safe; any saved contact will be reused unchanged.",
      );
    }
  }
  const wait = await openConnectedReplyWait({
    ...context,
    sessionKey,
    baseUrl: context.identity.apiBaseUrl,
    from: context.identity.agentAddress,
    recipient: peer,
    contactRequest: contactReference(request),
    idempotencyKey: `contact-${request.step_id}`,
    pageSize: 50,
    deadline,
  });
  let sendStarted = false;
  let knownSentId: string | undefined;
  try {
    if (!(await wait.ready())) {
      throw new Error("Contact receiver was not ready. No request was sent.");
    }
    sendStarted = true;
    const response = await sendEmail({
      client: context.apiClient.client,
      headers: { "Idempotency-Key": `contact-${request.step_id}` },
      body: {
        from: context.identity.agentAddress,
        to: peer,
        subject: "Contact request",
        body_text: `Contact request: ${options.reason.trim()}\n\nThis requests email communication only. It grants no task, tool, account, or private-history authority.`,
        attachments: [attachment(request)],
      },
      signal: AbortSignal.timeout(30_000),
      responseStyle: "fields",
    });
    if (response.error || !response.data?.data) {
      const outcome = classifySendError(
        response.response?.status,
        response.error,
      );
      if (outcome === "not_sent") await wait.cancelRejectedSend();
      else await wait.uncertain();
      return {
        exitCode: sendOutcomeExitCode(outcome),
        data: {
          outcome,
          request_id: wait.requestId,
          idempotency_key: `contact-${request.step_id}`,
          next_command: `primitive contacts wait --request-id ${wait.requestId}`,
          contact_accepted: false,
          guidance:
            outcome === "not_sent"
              ? "Request refused before sending."
              : "Do not resend. Inspect sent history using this idempotency key before recovering.",
        },
      };
    }
    const sent = response.data.data;
    const result = sentResult(sent);
    result.data.contact_accepted = false;
    if (result.data.outcome === "not_sent") {
      await wait.cancelRejectedSend();
      return result;
    }
    if (result.data.outcome === "uncertain") {
      await wait.uncertain();
      return {
        ...result,
        data: {
          ...result.data,
          request_id: wait.requestId,
          next_command: `primitive contacts wait --request-id ${wait.requestId}`,
          guidance:
            "The server recorded an uncertain send. Recover this exact saved request; do not resend.",
        },
      };
    }
    knownSentId = mailId(sent.id);
    await wait.bind(knownSentId);
    const pending = {
      ...result.data,
      request_id: wait.requestId,
      next_command: `primitive contacts wait --id ${sent.id}`,
      guidance:
        "Request sent, not yet accepted. An active session listener can notify you of a late acceptance. Continue independent work; use next_command when you need to resume this request. Do not send it again.",
    };
    if (!options.wait) return { exitCode: 0, data: pending };
    const accepted = await wait.next();
    if (!accepted)
      return {
        exitCode: 3,
        data: { ...pending, outcome: "sent_awaiting_reply" },
      };
    await wait.observed(accepted.id);
    await wait.finish();
    return {
      exitCode: 0,
      data: {
        ...result.data,
        outcome: "contact_accepted",
        contact_accepted: true,
        acceptance_email_id: accepted.id,
        guidance:
          "The peer accepted email communication. This is not task completion or permission to access private context. Send a separate task if authorized.",
      },
    };
  } catch (error) {
    if (!sendStarted) {
      await wait.cancelBeforeSend();
      throw error;
    }
    if (knownSentId)
      return {
        exitCode: 3,
        data: {
          outcome: "sent_awaiting_reply",
          sent_id: knownSentId,
          contact_accepted: false,
          request_id: wait.requestId,
          next_command: `primitive contacts wait --request-id ${wait.requestId}`,
          guidance:
            "The request was sent, but acceptance recovery did not finish. Do not resend the request.",
        },
      };
    // A transport failure after dispatch never becomes permission to resend.
    await wait.uncertain().catch(() => {});
    return {
      exitCode: 4,
      data: {
        outcome: "uncertain",
        request_id: wait.requestId,
        idempotency_key: `contact-${request.step_id}`,
        next_command: `primitive contacts wait --request-id ${wait.requestId}`,
        contact_accepted: false,
        guidance:
          "The request may have been sent. Do not resend; inspect sent history by idempotency key and resume the exact sent ID.",
      },
    };
  } finally {
    await wait.close();
  }
}

/** Recover an uncertain send by its saved idempotency key, never by resending. */
export async function recoverContactRequest(
  context: Context,
  requestId: string,
  timeoutSeconds: number,
): Promise<Result> {
  const id = mailId(requestId);
  const store = await openSharedMailStore({
    configDir: context.configDir,
    scope: sharedMailScope(context.apiKey, context.identity.apiBaseUrl),
    recipient: context.identity.agentAddress,
  });
  const saved = await store.readWait(id);
  if (!saved?.contactRequest)
    throw new Error(
      "No saved contact request matches this local request ID and connected profile.",
    );
  if (
    saved.sessionKey &&
    saved.sessionKey !== contactRequestSessionKey(context)
  )
    throw new Error(
      "This contact request belongs to another or an unbound session. No recovery was attempted; start a new request from this connected session.",
    );
  if (saved.sentEmailId)
    return waitForContact(context, saved.sentEmailId, timeoutSeconds);
  if (saved.status !== "uncertain" && saved.status !== "unbound")
    throw new Error("This contact request was not sent and cannot be resumed.");
  const sent = await reconcileChatSend({
    apiClient: context.apiClient,
    idempotencyKey: saved.idempotencyKey,
    from: context.identity.agentAddress,
    recipient: saved.peer,
    deadline: Math.min(timeout(timeoutSeconds), Date.now() + 5000),
  });
  if (!sent)
    return {
      exitCode: 4,
      data: {
        outcome: "uncertain",
        request_id: id,
        contact_accepted: false,
        next_command: `primitive contacts wait --request-id ${id}`,
        guidance:
          "No authoritative sent record was found yet. This does not prove nothing was sent. Retry this exact recovery command; do not resend.",
      },
    };
  const outcome = successfulSendOutcome({
    status: sent.status,
    idempotent_replay: false,
  });
  if (outcome === "not_sent" || outcome === "uncertain")
    return {
      exitCode: sendOutcomeExitCode(outcome),
      data: {
        outcome,
        sent_id: sent.id,
        request_id: id,
        contact_accepted: false,
        guidance:
          "Recovered the original send record. Its status does not establish successful sending; do not create a duplicate request.",
      },
    };
  await store.bindWait(id, mailId(sent.id));
  return waitForContact(context, sent.id, timeoutSeconds);
}

export async function waitForContact(
  context: Context,
  sentId: string,
  timeoutSeconds: number,
): Promise<Result> {
  const id = mailId(sentId);
  const store = await openSharedMailStore({
    configDir: context.configDir,
    scope: sharedMailScope(context.apiKey, context.identity.apiBaseUrl),
    recipient: context.identity.agentAddress,
  });
  const saved = await store.findWaitByParent(id);
  if (!saved?.contactRequest)
    throw new Error(
      "No saved contact request matches this sent ID and connected profile. Ordinary task waits use emails wait.",
    );
  const sessionKey = contactRequestSessionKey(context);
  if (saved.sessionKey && saved.sessionKey !== sessionKey)
    throw new Error(
      "This contact request belongs to another or an unbound session. No acceptance was consumed; start a new request from this connected session.",
    );
  if (saved.status === "completed")
    return {
      exitCode: 0,
      data: {
        outcome: "contact_accepted",
        sent_id: id,
        contact_accepted: true,
        guidance:
          "This contact acceptance was already observed. It is not task completion.",
      },
    };
  const wait = await openConnectedReplyWait({
    ...context,
    sessionKey,
    baseUrl: context.identity.apiBaseUrl,
    from: context.identity.agentAddress,
    recipient: saved.peer,
    sentId: id,
    contactRequest: saved.contactRequest,
    pageSize: 50,
    // Search for timely arrivals even when resuming after request expiry.
    deadline: timeout(timeoutSeconds),
  });
  try {
    const accepted = await wait.next();
    if (!accepted)
      return {
        exitCode: 3,
        data: {
          outcome: "sent_awaiting_reply",
          sent_id: id,
          contact_accepted: false,
          next_command: `primitive contacts wait --id ${id}`,
          guidance:
            "Still awaiting acceptance. An active session listener can notify you later. Continue independent work instead of immediately chaining another wait; resume this same request when needed, without resending.",
        },
      };
    await wait.observed(accepted.id);
    await wait.finish();
    return {
      exitCode: 0,
      data: {
        outcome: "contact_accepted",
        sent_id: id,
        contact_accepted: true,
        acceptance_email_id: accepted.id,
        guidance:
          "Communication accepted; no task or private-context authority granted.",
      },
    };
  } finally {
    await wait.close();
  }
}

export async function acceptContact(
  context: Context,
  emailId: string,
): Promise<Result> {
  const id = mailId(emailId);
  const result = await getEmail({
    client: context.apiClient.client,
    path: { id },
    responseStyle: "fields",
    signal: AbortSignal.timeout(5000),
  });
  const detail = result.data?.data;
  if (
    result.error ||
    !detail ||
    detail.id !== id ||
    detail.recipient !== context.identity.agentAddress ||
    detail.to_email !== context.identity.agentAddress ||
    !["accepted", "completed"].includes(detail.status)
  )
    throw new Error(
      "The contact request is not available for this connected agent.",
    );
  const peer = canonicalContactSelector({
    kind: "address",
    value: detail.from_email,
  }).value;
  const trust = scopedChatSenderTrust(detail, peer);
  if (!trust.trusted)
    throw new Error(
      `Contact request sender authentication rejected (reason: ${trust.reason}; retryable: ${trust.retryable}). No acceptance or contact preference was written.`,
    );
  const request = await readContactInteraction(
    detail,
    notificationPartReader(async () => context.apiClient.client),
    signal(),
  );
  if (request?.step !== "request")
    throw new Error("This email is not a valid unexpired contact request.");
  const key = createHash("sha256")
    .update(
      JSON.stringify([
        context.identity.apiBaseUrl,
        context.identity.orgId,
        context.identity.agentAddress,
        id,
      ]),
    )
    .digest("hex");
  const directory = join(context.configDir, "contact-acceptances", key);
  privateMailDirectory(directory, true);
  const path = join(directory, "acceptance.json");
  const previous = await withMailLock(directory, () => readMailJson(path));
  if (previous !== null) {
    const saved = mailObject(previous, ["sentId", "state"]);
    if (
      !["sent", "submitting", "not_sent"].includes(String(saved.state)) ||
      (saved.sentId !== null && typeof saved.sentId !== "string")
    )
      throw new Error(
        "The saved acceptance state is invalid. Preserve it before retrying.",
      );
    if (saved.sentId !== null) mailId(saved.sentId);
    if (saved.state !== "not_sent")
      return {
        exitCode: saved.state === "sent" ? 0 : 4,
        data: {
          outcome: saved.state === "sent" ? "already_sent" : "uncertain",
          sent_id: saved.sentId,
          local_preference_saved: true,
          acceptance_sent: saved.state === "sent" ? true : null,
          guidance:
            saved.state === "sent"
              ? "Acceptance email already submitted. No second email was sent. This does not prove delivery or grant task permission."
              : "Acceptance submission is uncertain. Do not resend; inspect sent history and this exact request.",
        },
      };
  }
  await enablePeer(context, peer, request.payload.reason);
  const acceptance = prepareContactAcceptance(request);
  const won = await withMailLock(directory, () => {
    const prior = readMailJson(path);
    if (
      prior !== null &&
      mailObject(prior, ["sentId", "state"]).state !== "not_sent"
    )
      return false;
    writeMailJson(path, { state: "submitting", sentId: null });
    return true;
  });
  if (!won)
    throw new Error(
      "Another acceptance attempt already reserved this request. No second reply was sent.",
    );
  try {
    const response = await replyToEmail({
      client: context.apiClient.client,
      path: { id },
      body: {
        body_text:
          "Contact request accepted for email communication. This does not grant task, tool, account, or private-history authority.",
        attachments: [attachment(acceptance)],
      },
      responseStyle: "fields",
      signal: AbortSignal.timeout(30_000),
    });
    if (response.error || !response.data?.data) {
      const outcome = classifySendError(
        response.response?.status,
        response.error,
      );
      if (outcome === "not_sent")
        await withMailLock(directory, () =>
          writeMailJson(path, { state: "not_sent", sentId: null }),
        );
      return {
        exitCode: sendOutcomeExitCode(outcome),
        data: {
          outcome,
          local_preference_saved: true,
          acceptance_sent: outcome === "not_sent" ? false : null,
          guidance:
            outcome === "not_sent"
              ? "The local preference was saved, but the acceptance email was refused before sending. Fix the reported API access or sending problem before retrying acceptance."
              : "The local preference was saved, but acceptance delivery is unconfirmed. Do not resend blindly.",
        },
      };
    }
    const sent = response.data.data;
    const output = sentResult(sent);
    await withMailLock(directory, () =>
      writeMailJson(path, {
        state:
          output.exitCode === 0
            ? "sent"
            : output.data.outcome === "not_sent"
              ? "not_sent"
              : "submitting",
        sentId: sent.id,
      }),
    );
    return {
      ...output,
      data: {
        ...output.data,
        local_preference_saved: true,
        acceptance_sent:
          output.exitCode === 0
            ? true
            : output.data.outcome === "not_sent"
              ? false
              : null,
        guidance:
          output.exitCode === 0
            ? "Local communication preference saved. Acceptance email submitted; delivery status is separate. No task or private-context permission granted."
            : output.data.outcome === "not_sent"
              ? "Local communication preference saved, but the acceptance email was not sent. Fix the sending problem before retrying acceptance."
              : "Local communication preference saved, but acceptance submission is uncertain. Inspect sent history; do not resend blindly.",
      },
    };
  } catch {
    return {
      exitCode: 4,
      data: {
        outcome: "uncertain",
        local_preference_saved: true,
        acceptance_sent: null,
        guidance:
          "Acceptance delivery is uncertain. Preserve the local journal and inspect sent history; do not resend blindly.",
      },
    };
  }
}
