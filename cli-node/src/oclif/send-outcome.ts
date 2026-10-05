import { createHash } from "node:crypto";
import { Errors } from "@oclif/core";
import type {
  EmailDetail,
  EmailDetailReply,
  GetEmailResponse,
  SendMailResult,
  ThreadMessage,
} from "@primitivedotdev/api-core";
import { getEmail, getThread } from "@primitivedotdev/api-core";
import { extractErrorPayload } from "./api-command.js";
import { formatAlreadySentNotice } from "./idempotent-replay-banner.js";

/**
 * One outcome vocabulary for every command that puts mail on the wire
 * (`chat`, `chat reply`, `send`, `reply`).
 *
 * Agents read exit codes and JSON, not prose. Before this existed a
 * successful send whose reply wait timed out exited 1, the same code
 * as a request the API rejected, so callers resent (often reworded)
 * and a second real email went out. Each outcome below answers the
 * one question a caller has to get right: did a message leave, and
 * is it safe to send again?
 *
 * Exit 2 is deliberately unused: oclif exits 2 for invalid flags and
 * arguments, which never send anything.
 */
export type SendOutcome =
  | "already_sent"
  | "not_sent"
  | "replied"
  | "sent"
  | "sent_awaiting_reply"
  | "uncertain";

export const SEND_OUTCOME_EXIT_CODES = {
  replied: 0,
  sent: 0,
  already_sent: 0,
  not_sent: 1,
  sent_awaiting_reply: 3,
  uncertain: 4,
} as const satisfies Record<SendOutcome, number>;

export type FailedSendOutcome = "not_sent" | "uncertain";

// These HTTP statuses reject the request before anything is sent.
// Transport failures, conflicts, timeouts and server errors remain
// uncertain: the request may have been accepted before the failure.
export const DEFINITIVE_SEND_REJECTION_STATUSES: readonly number[] = [
  400, 401, 402, 403, 404, 413, 422, 429,
];

export const SEND_OUTCOME_HELP = `Outcomes and exit codes, shared by chat, chat reply, send and reply (JSON output carries the name as "outcome"):
  - exit 0 replied: chat only. The message was sent and a reply arrived.
  - exit 0 sent: accepted for delivery. A queued status counts as sent.
  - exit 0 already_sent: an identical earlier send exists (or was deleted: HTTP 410 sent_email_deleted). Nothing new went out. Do not resend.
  - exit 1 not_sent: the API rejected the request (HTTP 400, 401, 402, 403, 404, 413, 422 or 429), the command failed before sending, or the send record has status agent_failed, gate_denied or canceled. Nothing went out.
  - exit 2: invalid flags or arguments. Nothing went out.
  - exit 3 sent_awaiting_reply: chat only. Sent, but no reply before the timeout. Wait; do not resend.
  - exit 4 uncertain: transport error, conflict, server error, or a send record with status unknown. It may or may not have gone out. Reconcile with primitive sent get --idempotency-key <key> (the key is in the --json envelope) before retrying.`;

export function sendOutcomeExitCode(outcome: SendOutcome): number {
  return SEND_OUTCOME_EXIT_CODES[outcome];
}

export function sendFailureOutcome(
  httpStatus: number | undefined,
): FailedSendOutcome {
  return httpStatus !== undefined &&
    DEFINITIVE_SEND_REJECTION_STATUSES.includes(httpStatus)
    ? "not_sent"
    : "uncertain";
}

// HTTP 410 `sent_email_deleted`: an earlier send this request matches
// went out and was later deleted from history. Its idempotency key (or
// the reply suppression for the inbound) stays reserved, so the API
// refused this request. Something already went out, nothing new did,
// and the earlier send no longer shows in sent history.
const SENT_EMAIL_DELETED_CODE = "sent_email_deleted";

function errorPayloadCode(payload: unknown): string | undefined {
  if (payload === null || typeof payload !== "object") return undefined;
  const code = (payload as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

export function isDeletedEarlierSend(
  httpStatus: number | undefined,
  errorPayload: unknown,
): boolean {
  return (
    httpStatus === 410 &&
    errorPayloadCode(errorPayload) === SENT_EMAIL_DELETED_CODE
  );
}

/** Classify an API error from a send request. */
export function classifySendError(
  httpStatus: number | undefined,
  errorPayload: unknown,
): FailedSendOutcome | "already_sent" {
  return isDeletedEarlierSend(httpStatus, errorPayload)
    ? "already_sent"
    : sendFailureOutcome(httpStatus);
}

export function formatDeletedEarlierSendNotice(): string {
  return "Already sent: an earlier send matching this request went out and its record was later deleted, so the API refused this one (HTTP 410 sent_email_deleted). Nothing new was sent. Do not resend or change the idempotency key to get around this.";
}

/** Read the HTTP status from a `responseStyle: "fields"` API result. */
export function apiResultHttpStatus(result: unknown): number | undefined {
  if (result === null || typeof result !== "object") return undefined;
  if (!("response" in result)) return undefined;
  const response = (result as { response?: { status?: unknown } }).response;
  return typeof response?.status === "number" ? response.status : undefined;
}

// Sent-email statuses for attempts that never left Primitive: the
// outbound agent rejected it, a recipient gate denied it, or a
// scheduled send was canceled. Every other status (queued, delivered,
// bounced, scheduled, ...) is a message that went out or will go out.
const SEND_STATUSES_THAT_DID_NOT_GO_OUT: ReadonlySet<string> = new Set([
  "agent_failed",
  "canceled",
  "gate_denied",
]);

// `unknown` is terminal but indeterminate: the delivery result could
// not be classified, so the caller cannot tell whether it went out.
const SEND_STATUSES_WITH_UNKNOWN_OUTCOME: ReadonlySet<string> = new Set([
  "unknown",
]);

/**
 * Classify a send record the API returned with a 2xx. A 2xx alone does
 * not mean a message went out: the record's status can show the
 * attempt was rejected or that its result is indeterminate. The same
 * holds for an idempotent replay, which returns the earlier attempt's
 * record as it stands.
 */
export function successfulSendOutcome(
  sent: Pick<SendMailResult, "idempotent_replay" | "status">,
): SendOutcome {
  if (SEND_STATUSES_THAT_DID_NOT_GO_OUT.has(sent.status)) return "not_sent";
  if (SEND_STATUSES_WITH_UNKNOWN_OUTCOME.has(sent.status)) return "uncertain";
  return sent.idempotent_replay === true ? "already_sent" : "sent";
}

/**
 * Summary for a 2xx send record whose status shows it did not go out
 * (`not_sent`) or that its result is indeterminate (`uncertain`).
 */
export function formatSendRecordFailureSummary(
  noun: "Message" | "Reply",
  outcome: FailedSendOutcome,
  sent: Pick<SendMailResult, "id" | "idempotent_replay" | "status">,
): string {
  const record =
    sent.idempotent_replay === true
      ? `the earlier identical attempt (sent id ${sent.id}) has status ${sent.status}`
      : `the send record (id ${sent.id}) has status ${sent.status}`;
  if (outcome === "not_sent") {
    return `${noun} not sent: ${record}. Nothing went out; fix the problem before retrying.`;
  }
  return `${noun} send outcome uncertain: ${record}. It may or may not have gone out. Do not resend blindly; check sent history first.`;
}

function describeSentStatus(status: string): string {
  if (status === "queued") return "queued for delivery";
  if (status === "delivered") return "delivered";
  return `status ${status}`;
}

export function formatSentSummary(
  noun: "Message" | "Reply",
  sent: Pick<SendMailResult, "id" | "status">,
): string {
  return `${noun} sent (${describeSentStatus(sent.status)}, id ${sent.id}). Do not resend.`;
}

export function formatSendFailureSummary(
  noun: "Message" | "Reply",
  outcome: FailedSendOutcome,
  httpStatus: number | undefined,
): string {
  if (outcome === "not_sent") {
    const reason =
      httpStatus === undefined
        ? "the request failed before sending"
        : `the API rejected the request (HTTP ${httpStatus})`;
    return `${noun} not sent: ${reason}. Nothing went out; fix the problem before retrying.`;
  }
  const reason =
    httpStatus === undefined
      ? "no response from the API"
      : `HTTP ${httpStatus}`;
  return `${noun} send outcome uncertain (${reason}): it may or may not have gone out. Do not resend blindly; check sent history first.`;
}

export function priorRepliesThatWentOut(
  replies: readonly EmailDetailReply[] | null | undefined,
  options: { excludeSentId?: string } = {},
): EmailDetailReply[] {
  return (replies ?? []).filter(
    (reply) =>
      !SEND_STATUSES_THAT_DID_NOT_GO_OUT.has(reply.status) &&
      reply.id !== options.excludeSentId,
  );
}

export function formatPriorRepliesWarning(
  prior: readonly EmailDetailReply[],
): string | null {
  const latest = prior.at(-1);
  if (!latest) return null;
  // Status signals are filtered out before this is called, so these are real
  // replies; still, a reply is not proof that the request was completed.
  const count =
    prior.length === 1 ? "1 outgoing email" : `${prior.length} outgoing emails`;
  return `This email already has ${count}, most recently at ${latest.created_at} (sent id ${latest.id}). Status signals are not counted, and an earlier reply does not prove the request was completed. Sending this reply.`;
}

export function formatPriorRepliesCheckSkipped(
  emailId: string,
  reason: string,
): string {
  return `Could not check whether you already replied to email ${emailId} (${reason}). Prior-reply check skipped; sending the reply anyway.`;
}

export type PriorRepliesCheck =
  | {
      status: "checked";
      prior: EmailDetailReply[];
      /**
       * Automatic status signals (read, working) and fyi acknowledgements
       * this CLI sent to the same email. They are not answers, so they are
       * counted here and left out of `prior`.
       */
      signals?: number;
      detail?: EmailDetail;
    }
  | { status: "skipped"; reason: string };

/**
 * Whether a reply entry is a status signal rather than an answer. The API's
 * own marking wins when it carries one; otherwise the CLI's private record
 * of the signals it sent decides.
 */
export function isSignalReply(
  reply: EmailDetailReply,
  isLocalSignal: (sentId: string) => boolean,
): boolean {
  const marked = reply as EmailDetailReply & {
    interaction_hint?: unknown;
    fyi?: unknown;
  };
  if (marked.interaction_hint === "status" || marked.fyi === true) return true;
  return isLocalSignal(reply.id);
}

type EmailFetchClient = Parameters<typeof getEmail>[0]["client"];

/**
 * IDs of the thread's outbound messages the server marks as status signals
 * or fyi acknowledgements. Best effort: an unreadable thread marks nothing.
 */
async function threadSignalIds(
  client: EmailFetchClient,
  threadId: string,
): Promise<Set<string>> {
  try {
    const result = await getThread({
      client,
      path: { id: threadId },
      responseStyle: "fields",
    });
    const messages = (
      result.data as { data?: { messages?: unknown } } | undefined
    )?.data?.messages;
    if (result.error || !Array.isArray(messages)) return new Set();
    return new Set(
      (messages as ThreadMessage[])
        .filter(
          (message) =>
            message.direction === "outbound" &&
            (message.fyi === true || message.interaction_hint === "status"),
        )
        .map((message) => message.id),
    );
  } catch {
    return new Set();
  }
}

/**
 * Look up the inbound email and report replies to it that already
 * went out. Never throws: the check is advisory and must not block a
 * send, so every failure comes back as `skipped` with a reason the
 * caller surfaces.
 */
export async function checkPriorReplies(params: {
  client: EmailFetchClient;
  emailId: string;
  /** Recognizes a send ID as one of this CLI's own status signals. */
  isLocalSignal?: (sentId: string) => boolean;
}): Promise<PriorRepliesCheck> {
  try {
    const result = await getEmail({
      client: params.client,
      path: { id: params.emailId },
      responseStyle: "fields",
    });
    if (result.error) {
      const status = apiResultHttpStatus(result);
      return {
        status: "skipped",
        reason:
          status === undefined
            ? "the email lookup failed"
            : `the email lookup returned HTTP ${status}`,
      };
    }
    const envelope = result.data as
      | { data?: EmailDetail }
      | GetEmailResponse
      | undefined;
    const detail =
      (envelope as { data?: EmailDetail } | undefined)?.data ??
      (envelope as EmailDetail | undefined);
    if (!detail || !Array.isArray(detail.replies)) {
      return {
        status: "skipped",
        reason: "the email lookup returned no reply history",
      };
    }
    const wentOut = priorRepliesThatWentOut(detail.replies);
    const isLocalSignal = params.isLocalSignal ?? (() => false);
    let prior = wentOut.filter((reply) => !isSignalReply(reply, isLocalSignal));
    // Reply entries carry no signal marking, and a signal sent from another
    // machine has no local record. The thread's outbound entries do carry
    // it, so one thread read settles whatever is left.
    if (prior.length > 0 && detail.thread_id) {
      const signals = await threadSignalIds(params.client, detail.thread_id);
      prior = prior.filter((reply) => !signals.has(reply.id));
    }
    return {
      status: "checked",
      prior,
      signals: wentOut.length - prior.length,
      detail,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { status: "skipped", reason: `the email lookup failed: ${detail}` };
  }
}

export type FollowUpCommandPlaceholder = {
  description: string;
  token: string;
};

export type FollowUpCommand<Kind extends string = string> = {
  argv: string[];
  description: string;
  command: string;
  kind: Kind;
  placeholders: FollowUpCommandPlaceholder[];
  requires_message: boolean;
};

export function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function commandFromArgv(argv: string[]): string {
  return argv.map(shellQuote).join(" ");
}

export function buildFollowUpCommand<Kind extends string>(
  kind: Kind,
  description: string,
  argv: string[],
  options: { requiresMessage?: boolean } = {},
): FollowUpCommand<Kind> {
  const requiresMessage = options.requiresMessage ?? false;
  return {
    argv,
    description,
    command: commandFromArgv(argv),
    kind,
    placeholders: requiresMessage
      ? [
          {
            description: "Replace with the message body before running.",
            token: "<message>",
          },
        ]
      : [],
    requires_message: requiresMessage,
  };
}

// Local and server clocks can disagree; widen the sent-history window
// so the attempt is not filtered out by a few seconds of skew.
const SENT_HISTORY_CLOCK_SKEW_MS = 5 * 60 * 1000;

export function sentHistoryWindowStart(attemptStartedAtIso: string): string {
  const started = Date.parse(attemptStartedAtIso);
  if (!Number.isFinite(started)) return attemptStartedAtIso;
  return new Date(started - SENT_HISTORY_CLOCK_SKEW_MS).toISOString();
}

export type SendCommandFollowUpKind =
  | "find_sent_email_by_idempotency_key"
  | "inspect_sent_email"
  | "list_recent_sent_emails";

/** Header rule for Idempotency-Key: 1 to 255 printable ASCII characters. */
export const IDEMPOTENCY_KEY_PATTERN = /^[\x21-\x7E]{1,255}$/;

export const IDEMPOTENCY_KEY_FLAG_DESCRIPTION =
  "Idempotency key for this send (1 to 255 printable ASCII characters). Retrying with the same key returns the original send instead of sending twice. Defaults to a key derived from the request content and the current five-minute window, so an identical retry within that window is deduplicated and a deliberate repeat later still sends. To retry an uncertain send after that, pass the key it reported. Look a send up later with `primitive sent get --idempotency-key <key>`.";

export function assertValidIdempotencyKey(key: string): string {
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new Errors.CLIError(
      "--idempotency-key must be 1 to 255 printable ASCII characters with no spaces.",
      { exit: 2 },
    );
  }
  return key;
}

/** The longest delivery wait the send endpoint accepts. */
export const MAX_SEND_WAIT_TIMEOUT_MS = 30_000;

/** Says a requested delivery wait was shortened, and how to wait for a reply. */
export function sendWaitClampNotice(requestedMs: number): string {
  return `--wait-timeout-ms ${requestedMs} is longer than the ${MAX_SEND_WAIT_TIMEOUT_MS}ms the server allows, so the delivery wait uses ${MAX_SEND_WAIT_TIMEOUT_MS}ms. --wait covers delivery only; to wait for a reply, run \`primitive emails wait --reply-to-sent-email-id <sent id> --from <recipient> --timeout ${Math.ceil(requestedMs / 1000)}\` after this send.`;
}

// Fields that change how long the CLI waits, not what is sent. They
// stay out of the derived key, so a retry that adds --wait is still
// recognised as the same send.
const NON_CONTENT_SEND_FIELDS: ReadonlySet<string> = new Set([
  "wait",
  "wait_timeout_ms",
]);

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item ?? null)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * How long a derived key stays the same. It matches the window the API
 * uses for the key it derives itself when a request carries none, so an
 * identical send repeated inside this window is deduplicated and a
 * deliberate repeat later (a digest, a heartbeat, the same short reply
 * on another day) still goes out, exactly as without a key. An explicit
 * --idempotency-key never expires.
 */
export const DERIVED_IDEMPOTENCY_WINDOW_MS = 5 * 60 * 1000;

/**
 * The idempotency key a send uses when the caller passes none. It is a
 * hash of what is sent (and, for a reply, of the email replied to) and
 * of the current five-minute window, so dedup matches what the API did
 * before the CLI sent a key, while the CLI knows the key before the
 * request starts. That lets an uncertain outcome still report the key to
 * reconcile with, and to retry under with --idempotency-key.
 */
export function deriveSendIdempotencyKey(
  kind: "chat" | "reply" | "send",
  request: Record<string, unknown>,
  now: number = Date.now(),
): string {
  const content = Object.fromEntries(
    Object.entries(request).filter(
      ([key]) => !NON_CONTENT_SEND_FIELDS.has(key),
    ),
  );
  const digest = createHash("sha256")
    .update(canonicalJson(content))
    .update(`:t${Math.floor(now / DERIVED_IDEMPOTENCY_WINDOW_MS)}`)
    .digest("hex");
  return `primitive-${kind}-${digest}`;
}

/**
 * Identity fields every send, reply and chat `--json` envelope carries,
 * whatever the outcome. `sent_email_id` is null until a send record is
 * known; `idempotency_key` is known before the request starts, so an
 * uncertain outcome can be reconciled with
 * `primitive sent get --idempotency-key <key>`.
 */
export function sendIdentityFields(params: {
  idempotencyKey: string | null | undefined;
  sent:
    | Pick<SendMailResult, "client_idempotency_key" | "id">
    | null
    | undefined;
}): { sent_email_id: string | null; idempotency_key: string | null } {
  return {
    sent_email_id: params.sent?.id ?? null,
    idempotency_key:
      params.idempotencyKey ?? params.sent?.client_idempotency_key ?? null,
  };
}

/**
 * Commands that inspect an existing send. None of them send again:
 * a caller that follows them after a failure cannot double-send.
 */
export function buildSendCommandFollowUps(params: {
  attemptStartedAtIso: string;
  idempotencyKey?: string | null;
  outcome: SendOutcome;
  sentId: string | null;
}): FollowUpCommand<SendCommandFollowUpKind>[] {
  const commands: FollowUpCommand<SendCommandFollowUpKind>[] = [];
  if (
    params.sentId === null &&
    params.outcome === "uncertain" &&
    params.idempotencyKey
  ) {
    commands.push(
      buildFollowUpCommand(
        "find_sent_email_by_idempotency_key",
        "Look up this attempt by its idempotency key before retrying",
        [
          "primitive",
          "sent",
          "get",
          "--idempotency-key",
          params.idempotencyKey,
        ],
      ),
    );
  }
  if (params.sentId !== null) {
    commands.push(
      buildFollowUpCommand(
        "inspect_sent_email",
        "Inspect the send and its delivery status",
        ["primitive", "sent", "get", "--id", params.sentId],
      ),
    );
  }
  if (params.outcome === "uncertain") {
    commands.push(
      buildFollowUpCommand(
        "list_recent_sent_emails",
        "Check sent history for this attempt before retrying",
        [
          "primitive",
          "sent",
          "list",
          "--date-from",
          sentHistoryWindowStart(params.attemptStartedAtIso),
        ],
      ),
    );
  }
  return commands;
}

export type SendCommandEnvelope = {
  outcome: SendOutcome;
  exit_code: number;
  outcome_message: string;
  sent_email_id: string | null;
  idempotency_key: string | null;
  sent: SendMailResult | null;
  http_status: number | null;
  error: unknown;
  follow_up_commands: FollowUpCommand<SendCommandFollowUpKind>[];
};

/**
 * Classify a `send` / `reply` API result, write the stderr summary,
 * and print stdout. Without `--json` stdout stays exactly what these
 * commands always printed (the SendMailResult, or `null`), so
 * existing `| jq` pipelines keep working; the outcome is on stderr
 * and in the exit code. With `--json` stdout is always an envelope,
 * whatever the outcome, and the summary is only its outcome_message.
 */
export function reportSendCommandResult(params: {
  attemptStartedAtIso: string;
  extraEnvelopeFields?: Record<string, unknown>;
  idempotencyKey?: string | null;
  json: boolean;
  log: (line: string) => void;
  noun: "Message" | "Reply";
  onApiError: (payload: unknown) => void;
  result: { data?: unknown; error?: unknown };
  writeStderr: (chunk: string) => void;
}): SendOutcome {
  const httpStatus = apiResultHttpStatus(params.result);
  let outcome: SendOutcome;
  let outcomeMessage: string;
  let sent: SendMailResult | null = null;
  let errorPayload: unknown = null;

  if (params.result.error) {
    errorPayload = extractErrorPayload(params.result.error);
    params.onApiError(errorPayload);
    const failure = classifySendError(httpStatus, errorPayload);
    outcome = failure;
    outcomeMessage =
      failure === "already_sent"
        ? formatDeletedEarlierSendNotice()
        : formatSendFailureSummary(params.noun, failure, httpStatus);
    if (!params.json) params.writeStderr(`${outcomeMessage}\n`);
  } else {
    sent =
      (params.result.data as { data?: SendMailResult } | undefined)?.data ??
      null;
    if (sent === null) {
      outcome = "uncertain";
      outcomeMessage = `${params.noun} send outcome uncertain: the API accepted the request but returned no send record. Do not resend blindly; check sent history first.`;
      errorPayload = { message: "The API returned no send record." };
    } else {
      outcome = successfulSendOutcome(sent);
      outcomeMessage =
        outcome === "not_sent" || outcome === "uncertain"
          ? formatSendRecordFailureSummary(params.noun, outcome, sent)
          : outcome === "already_sent"
            ? formatAlreadySentNotice(sent)
            : formatSentSummary(params.noun, sent);
    }
    if (!params.json) params.writeStderr(`${outcomeMessage}\n`);
  }

  if (params.json) {
    const envelope: SendCommandEnvelope & Record<string, unknown> = {
      outcome,
      exit_code: sendOutcomeExitCode(outcome),
      outcome_message: outcomeMessage,
      ...sendIdentityFields({ idempotencyKey: params.idempotencyKey, sent }),
      sent,
      http_status: httpStatus ?? null,
      error: serializeErrorPayload(errorPayload),
      follow_up_commands: buildSendCommandFollowUps({
        attemptStartedAtIso: params.attemptStartedAtIso,
        idempotencyKey: params.idempotencyKey,
        outcome,
        sentId: sent?.id ?? null,
      }),
      ...params.extraEnvelopeFields,
    };
    params.log(JSON.stringify(envelope, null, 2));
  } else if (!params.result.error) {
    params.log(JSON.stringify(sent, null, 2));
  }
  return outcome;
}

/** JSON-safe form of an API error payload; `Error` objects stringify to `{}`. */
export function serializeErrorPayload(payload: unknown): unknown {
  if (!(payload instanceof Error)) return payload ?? null;
  const serialized: Record<string, unknown> = {
    name: payload.name,
    message: payload.message,
  };
  const cause = payload.cause as { code?: unknown } | undefined;
  if (cause && typeof cause.code === "string") serialized.code = cause.code;
  return serialized;
}

/**
 * Envelope for a `send` / `reply` that threw instead of returning an
 * API result. Printed in --json mode so stdout carries an envelope for
 * every outcome. Before the request starts (bad input, missing auth,
 * unreadable attachment) nothing went out; after it starts the
 * outcome is unknown.
 */
export function buildThrownSendFailureEnvelope(params: {
  attemptStartedAtIso?: string | null;
  error: unknown;
  extraEnvelopeFields?: Record<string, unknown>;
  idempotencyKey?: string | null;
  noun: "Message" | "Reply";
  requestStarted: boolean;
}): SendCommandEnvelope & Record<string, unknown> {
  const message =
    params.error instanceof Error ? params.error.message : String(params.error);
  const outcome: FailedSendOutcome = params.requestStarted
    ? "uncertain"
    : "not_sent";
  return {
    outcome,
    exit_code: params.requestStarted
      ? sendOutcomeExitCode("uncertain")
      : thrownErrorExitCode(params.error),
    outcome_message: formatSendFailureSummary(params.noun, outcome, undefined),
    ...sendIdentityFields({
      idempotencyKey: params.idempotencyKey,
      sent: null,
    }),
    sent: null,
    http_status: null,
    error: { message },
    follow_up_commands:
      params.requestStarted && params.attemptStartedAtIso
        ? buildSendCommandFollowUps({
            attemptStartedAtIso: params.attemptStartedAtIso,
            idempotencyKey: params.idempotencyKey,
            outcome,
            sentId: null,
          })
        : [],
    ...params.extraEnvelopeFields,
  };
}

/** Exit code oclif will use for a thrown error (2 for usage errors). */
export function thrownErrorExitCode(error: unknown): number {
  const exit = (error as { oclif?: { exit?: unknown } } | null)?.oclif?.exit;
  return typeof exit === "number" ? exit : 1;
}
