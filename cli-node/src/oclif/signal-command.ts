import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  getEmail,
  type PrimitiveApiClient,
  type SentEmailStatus,
  sendEmail,
} from "@primitivedotdev/api-core";
import {
  type PreparedSignal,
  prepareSignalEmail,
  type SignalInput,
  type SignalParent,
  type SignalSendResult,
  sendPreparedSignal,
} from "@primitivedotdev/sdk/interactions";
import { extractErrorPayload } from "./api-command.js";
import { recordSentSignal } from "./auto-signals.js";
import type { ConnectedAgentIdentity } from "./connected-agent-profile.js";
import { acquireListenLock } from "./listen-state.js";
import { reconcileChatSend } from "./reconcile-chat-send.js";
import { isPlainChatReply, scopedChatSenderTrust } from "./scoped-chat.js";
import { classifySendError, successfulSendOutcome } from "./send-outcome.js";
import {
  mailId,
  mailObject,
  privateMailDirectory,
  readMailJson,
  writeMailJson,
} from "./shared-mail-files.js";
import { sharedMailScope } from "./shared-mail-receiver.js";

export type SignalKind = "read" | "ack" | "working" | "typing";
export type SignalStatus = "received" | "will_process" | "will_not_process";
export type SignalOptions = {
  id: string;
  kind: SignalKind;
  status?: SignalStatus;
  expiresIn?: number;
  /**
   * Distinguishes successive automatic renewals of the same activity so each
   * is its own durable intent. Explicit invocations never set it, which keeps
   * their deduplication keys unchanged.
   */
  slot?: string;
  /** Checked immediately before submission; false leaves the intent unsent. */
  shouldSend?: () => boolean;
};
type State = {
  version: 1;
  prepared: PreparedSignal;
  phase:
    | "prepared"
    | "submitting"
    | "sent"
    | "not_sent"
    | "uncertain"
    | "expired";
  sentId: string | null;
};
type Context = {
  apiClient: PrimitiveApiClient;
  apiKey?: string;
  configDir: string;
  identity: ConnectedAgentIdentity;
  now?: () => number;
};
const sendStatuses = new Set<SentEmailStatus>([
  "queued",
  "submitted_to_agent",
  "agent_failed",
  "gate_denied",
  "unknown",
  "delivered",
  "bounced",
  "deferred",
  "wait_timeout",
  "scheduled",
  "canceled",
]);
const validSendStatus = (value: unknown): value is SentEmailStatus =>
  typeof value === "string" && sendStatuses.has(value as SentEmailStatus);
const invalid = () =>
  new Error("Saved signal state is invalid. Preserve it; do not resend.");
function input(
  options: SignalOptions,
  parent: SignalParent,
  now: number,
  expires = now + (options.expiresIn ?? 30) * 1000,
): SignalInput {
  if (options.kind === "ack")
    return { kind: "ack", parent, status: options.status as SignalStatus };
  if (options.kind === "read") return { kind: "read", parent };
  return { kind: options.kind, parent, expiresAtMs: expires };
}
function parseState(
  raw: unknown,
  options: SignalOptions,
  parent: SignalParent,
): State {
  try {
    const row = mailObject(raw, ["version", "prepared", "phase", "sentId"]);
    if (
      row.version !== 1 ||
      ![
        "prepared",
        "submitting",
        "sent",
        "not_sent",
        "uncertain",
        "expired",
      ].includes(String(row.phase))
    )
      throw invalid();
    const p = mailObject(row.prepared, [
      "accountScope",
      "preparedAtMs",
      "expiresAtMs",
      "idempotencyKey",
      "requestJson",
    ]);
    if (
      typeof p.requestJson !== "string" ||
      typeof p.preparedAtMs !== "number" ||
      (p.expiresAtMs !== null && typeof p.expiresAtMs !== "number")
    )
      throw invalid();
    const body = JSON.parse(p.requestJson);
    const control = JSON.parse(
      Buffer.from(body.attachments[0].content_base64, "base64").toString(
        "utf8",
      ),
    );
    const ids = [control.interaction_id.split("@")[0], control.step_id];
    const rebuilt = prepareSignalEmail(
      input(options, parent, p.preparedAtMs, p.expiresAtMs ?? undefined),
      { now: () => p.preparedAtMs as number, uuid: () => ids.shift() },
    );
    if (
      rebuilt.status !== "prepared" ||
      JSON.stringify(rebuilt.prepared) !== JSON.stringify(row.prepared)
    )
      throw invalid();
    return {
      version: 1,
      prepared: rebuilt.prepared,
      phase: row.phase as State["phase"],
      sentId: row.sentId === null ? null : mailId(row.sentId),
    };
  } catch {
    throw invalid();
  }
}
function report(state: State, repeated = false) {
  const outcome =
    state.phase === "sent"
      ? repeated
        ? "already_sent"
        : "sent"
      : state.phase === "submitting"
        ? "uncertain"
        : state.phase;
  return {
    exitCode: outcome === "uncertain" ? 4 : outcome === "not_sent" ? 1 : 0,
    data: {
      outcome,
      sent_id: state.sentId,
      expires_at:
        state.prepared.expiresAtMs === null
          ? null
          : new Date(state.prepared.expiresAtMs).toISOString(),
      guidance:
        outcome === "uncertain"
          ? "Outcome unknown. Repeat this exact command to reconcile the saved intent; never resend with a new key or profile."
          : outcome === "expired"
            ? "The saved activity expired without dispatch. A new explicit invocation may prepare fresh activity."
            : "Signals report communication state only; they do not grant task or tool authority.",
    },
  };
}

/** Explicit one-shot signal send. The complete intent is durable before POST. */
export async function sendSignal(context: Context, options: SignalOptions) {
  const id = mailId(options.id);
  if (!["read", "ack", "working", "typing"].includes(options.kind))
    throw new Error("Unknown signal kind.");
  if (
    options.kind === "ack"
      ? !["received", "will_process", "will_not_process"].includes(
          options.status ?? "",
        )
      : options.status !== undefined
  )
    throw new Error(
      "Only ack requires --status received, will_process, or will_not_process.",
    );
  if (
    options.expiresIn !== undefined &&
    (!["working", "typing"].includes(options.kind) ||
      !Number.isInteger(options.expiresIn) ||
      options.expiresIn < 1 ||
      options.expiresIn > (options.kind === "typing" ? 30 : 60))
  )
    throw new Error(
      "--expires-in applies only to working/typing and must be 1-30 seconds for typing or 1-60 for working.",
    );
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
    detail.recipient.toLowerCase() !==
      context.identity.agentAddress.toLowerCase() ||
    detail.to_email.toLowerCase() !==
      context.identity.agentAddress.toLowerCase() ||
    !["accepted", "completed"].includes(detail.status)
  )
    throw new Error(
      "The parent email is unavailable for this connected profile.",
    );
  const trust = scopedChatSenderTrust(detail, detail.from_email);
  if (!trust.trusted)
    throw new Error(
      `Parent sender authentication rejected (reason: ${trust.reason}; retryable: ${trust.retryable}).`,
    );
  if (
    detail.from_email.trim().toLowerCase() ===
    context.identity.agentAddress.toLowerCase()
  )
    throw new Error(
      "Do not send a signal in response to this profile's own email.",
    );
  if (!isPlainChatReply(detail))
    throw new Error(
      "Signals require a fully parsed plain email. Signals, interactions, and unknown content cannot trigger another signal.",
    );
  if (!detail.message_id)
    throw new Error(
      "The parent Message-ID is not available. Nothing was sent; retry this exact email after processing completes.",
    );
  const scope = sharedMailScope(context.apiKey, context.identity.apiBaseUrl);
  const parent: SignalParent = {
    accountScope: scope,
    from: detail.from_email.trim().toLowerCase(),
    to: context.identity.agentAddress,
    messageId: detail.message_id,
    subject: detail.subject ?? null,
    references: detail.parsed.references ?? [],
  };
  const key = createHash("sha256")
    .update(
      JSON.stringify([
        scope,
        context.identity.orgId,
        parent.to,
        id,
        options.kind,
        options.status ?? null,
        ...(options.slot === undefined ? [] : [options.slot]),
      ]),
    )
    .digest("hex");
  const directory = join(context.configDir, "signals", key);
  privateMailDirectory(directory, true);
  const release = acquireListenLock(directory, "signal-send");
  const path = join(directory, "intent.json"),
    now = context.now ?? Date.now;
  try {
    const raw = readMailJson(path, 256 * 1024);
    let state = raw === null ? null : parseState(raw, options, parent);
    if (state?.phase === "submitting" || state?.phase === "uncertain") {
      let prior: Awaited<ReturnType<typeof reconcileChatSend>>;
      try {
        prior = await reconcileChatSend({
          apiClient: context.apiClient,
          idempotencyKey: state.prepared.idempotencyKey,
          from: parent.to,
          recipient: parent.from,
          deadline: Date.now() + 5000,
        });
      } catch {
        return report(state);
      }
      if (!prior || !validSendStatus(prior.status)) return report(state);
      const outcome = successfulSendOutcome({
        status: prior.status,
        idempotent_replay: true,
      });
      state.phase =
        outcome === "uncertain"
          ? "uncertain"
          : outcome === "not_sent"
            ? "not_sent"
            : "sent";
      try {
        state.sentId = mailId(prior.id);
      } catch {
        state.phase = "uncertain";
        writeMailJson(path, state);
        return report(state);
      }
      writeMailJson(path, state);
      if (state.sentId) recordSentSignal(context.configDir, state.sentId);
      if (state.phase === "uncertain") return report(state);
    }
    const expired =
      state?.prepared.expiresAtMs !== null &&
      state?.prepared.expiresAtMs !== undefined &&
      now() >= state.prepared.expiresAtMs;
    if (state && ["sent", "not_sent", "expired"].includes(state.phase)) {
      if (state.sentId) recordSentSignal(context.configDir, state.sentId);
      if (!expired) return report(state, true);
      state = null; // A new explicit invocation may renew only a known, expired outcome.
    }
    if (!state) {
      const prepared = prepareSignalEmail(input(options, parent, now()), {
        now,
        uuid: randomUUID,
      });
      if (prepared.status !== "prepared")
        throw new Error("The parent is not ready. Nothing was sent.");
      state = {
        version: 1,
        prepared: prepared.prepared,
        phase: "prepared",
        sentId: null,
      };
      writeMailJson(path, state);
    }
    if (
      state.prepared.expiresAtMs !== null &&
      now() >= state.prepared.expiresAtMs
    ) {
      state.phase = "expired";
      writeMailJson(path, state);
      return report(state);
    }
    if (options.shouldSend && !options.shouldSend()) return report(state);
    state.phase = "submitting";
    writeMailJson(path, state);
    let outcome: SignalSendResult<Awaited<ReturnType<typeof sendEmail<false>>>>;
    try {
      outcome = await sendPreparedSignal(
        async (body, idempotencyKey) =>
          sendEmail({
            client: context.apiClient.client,
            body,
            headers: { "Idempotency-Key": idempotencyKey },
            responseStyle: "fields",
            signal: AbortSignal.timeout(5000),
          }),
        state.prepared,
        { accountScope: scope, now },
      );
    } catch {
      state.phase = "uncertain";
      writeMailJson(path, state);
      return report(state);
    }
    let alreadySent = false;
    if (outcome.status === "expired") state.phase = "expired";
    else {
      try {
        const result = outcome.result,
          sent = result.data?.data;
        if (sent && !validSendStatus(sent.status)) throw invalid();
        const sentId = sent ? mailId(sent.id) : null;
        const classification = result.error
          ? classifySendError(
              result.response?.status,
              extractErrorPayload(result.error),
            )
          : sent
            ? successfulSendOutcome(sent)
            : "uncertain";
        alreadySent = classification === "already_sent";
        state.phase =
          classification === "not_sent"
            ? "not_sent"
            : classification === "uncertain"
              ? "uncertain"
              : "sent";
        state.sentId = sentId;
      } catch {
        state.phase = "uncertain";
        state.sentId = null;
      }
    }
    writeMailJson(path, state);
    if (state.sentId) recordSentSignal(context.configDir, state.sentId);
    return report(state, alreadySent);
  } finally {
    release();
  }
}
