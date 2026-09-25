import { Args, Command, Errors, Flags, type Interfaces, ux } from "@oclif/core";
import type {
  EmailDetail,
  EmailDetailReply,
  GetEmailResponse,
  SearchEmailsResponse,
  SendMailResult,
} from "@primitivedotdev/api-core";
import {
  getEmail,
  replyToEmail,
  searchEmails,
  sendEmail,
} from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import { readAttachmentFiles } from "../attachments.js";
import {
  acquireChatLock,
  acquireChatStateLock,
  ChatLockContentionError,
} from "../chat-lock.js";
import {
  beginChatReceipt,
  type ChatReceipt,
  chatCredentialIdentity,
  chatRequestHash,
  saveChatReceipt,
  UncertainChatSendError,
} from "../chat-receipt.js";
import {
  type ChatConversationState,
  loadActiveChatState,
  loadChatConversationByLocalId,
  saveActiveChatState,
} from "../chat-state.js";
import { formatAlreadySentNotice } from "../idempotent-replay-banner.js";
import { deriveSubject, pickDefaultFromAddress } from "../outbound-defaults.js";
import {
  apiResultHttpStatus,
  buildFollowUpCommand,
  classifySendError,
  type FollowUpCommand,
  formatDeletedEarlierSendNotice,
  formatPriorRepliesWarning,
  formatSendFailureSummary,
  priorRepliesThatWentOut,
  SEND_OUTCOME_HELP,
  type SendOutcome,
  sendOutcomeExitCode,
  sentHistoryWindowStart,
  serializeErrorPayload,
  thrownErrorExitCode,
} from "../send-outcome.js";
import {
  collectNewAcceptedEmails,
  DEFAULT_EMAIL_POLL_INTERVAL_SECONDS,
  DEFAULT_EMAIL_POLL_PAGE_SIZE,
  encodeReceivedAtSearchCursor,
  fetchEmailSearchPage,
  sleep,
} from "./emails-poll.js";

// `primitive chat` is the first-party verb for talking to an agent
// that lives behind an email address. It sends a message, waits for
// the reply, and prints a compact transcript with next commands.
//
// Why this is its own command and not a flag on `send`:
//
//   - `send` is transport: "put these bytes on the wire." It is
//     fire-and-forget by design; the existing `--wait` flag waits for
//     delivery confirmation (the receiving MTA's 250 OK), not for a
//     human or agent to respond.
//   - `chat` is semantic: "have a conversation with the address on
//     the other side, expecting a reply." Today the substrate is
//     email; future transports (Primitive-native fast-path, etc.)
//     can ride under the same verb without breaking callers.
//
// Reply-matching strategy. Two-phase, hybrid:
//
//   1. STRICT phase. Filter by reply_to_sent_email_id = <sent.id>.
//      The server resolves this FK at inbound ingest by matching the
//      parsed In-Reply-To header (or References as a fallback)
//      against sent_emails.message_id in the same org. Strict
//      threading: only an inbound that's a real reply to the
//      specific send we just made matches. Cheap and unambiguous.
//
//   2. FALLBACK phase. After STRICT_PHASE_SECONDS, if no strict
//      match landed, switch to a broader (from = recipient,
//      since = sent time) filter and take the first match. This
//      catches legitimate replies from mailing-list / forwarder
//      paths that strip In-Reply-To AND References, where the FK
//      never gets populated. There's a narrow correctness risk
//      (any second unrelated inbound from the same sender during
//      the fallback window would also match), but in practice the
//      window starts after most well-behaved replies would already
//      have hit the strict path.
//
// --strict-only opts out of the fallback for callers that need
// strict guarantees over success-rate.

export const DEFAULT_CHAT_TIMEOUT_SECONDS = 120;
export const DEFAULT_STRICT_PHASE_SECONDS = 60;

function cliError(message: string): Errors.CLIError {
  return new Errors.CLIError(message, { exit: 1 });
}

async function readStdinToString(
  missingMessage = "No message provided. Pass the message as the second positional argument or pipe it via stdin.",
): Promise<string> {
  if (process.stdin.isTTY) {
    throw cliError(missingMessage);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

type ChatMatchStrategy = "strict" | "fallback";
type ChatResponseBodyFormat = "empty" | "html" | "text";
type ChatFollowUpCommandKind =
  | "continue_active_chat"
  | "continue_chat"
  | "continue_chat_explicit"
  | "inspect_reply"
  | "inspect_sent_email"
  | "list_recent_sent_emails"
  | "reply_direct"
  | "wait_existing_reply"
  | "wait_fallback_reply"
  | "wait_for_more"
  | "wait_threaded_reply";

type ChatReplyResult = {
  matchStrategy: ChatMatchStrategy;
  reply: EmailDetail;
};

type ChatFollowUpCommand = FollowUpCommand<ChatFollowUpCommandKind>;

type ChatResponseBody = {
  body: string;
  format: ChatResponseBodyFormat;
};

type ChatBaseContext = {
  from: string;
  json: boolean;
  parentReply?: EmailDetail;
  // Replies to parentReply that already went out before this turn;
  // null when not replying or when the history could not be read.
  priorReplies?: EmailDetailReply[] | null;
  quiet: boolean;
  recipient: string;
  sent: SendMailResult;
  sentAtIso: string;
  strictOnly: boolean;
  strictPhaseSeconds: number;
  subject: string;
  timeoutSeconds: number;
};

type ChatOutputContext = ChatBaseContext & {
  localChatId?: number;
  matchStrategy: ChatMatchStrategy;
  reply: EmailDetail;
};

type ChatProgressStream = {
  isTTY?: boolean;
  write(chunk: string): unknown;
};

type ChatProgressUpdateOptions = {
  heartbeatMs?: number;
  timeoutSeconds?: number;
};

type ChatAuthFailureContext = {
  auth: Awaited<ReturnType<typeof createAuthenticatedCliApiClient>>["auth"];
  baseUrlOverridden: boolean;
  configDir: string;
};

function chatColor(
  color: "bold" | "cyan" | "dim" | "green" | "greenBright" | "red" | "yellow",
  text: string,
): string {
  return ux.colorize(color, text);
}

function chatCommandText(command: string): string {
  return chatColor("cyan", command);
}

function chatDetailLine(line: string): string {
  return chatColor("dim", line);
}

function chatFailureText(message: string): string {
  return chatColor("red", message);
}

function chatHeading(text: string): string {
  return chatColor("bold", text);
}

function chatNoticeText(message: string): string {
  return chatColor("yellow", message);
}

function chatProgressText(message: string): string {
  return chatColor("cyan", message);
}

function chatSuccessText(message: string): string {
  return chatColor("greenBright", message);
}

export class ChatProgressIndicator {
  private currentMessage: string | null = null;
  private frameIndex = 0;
  private lastLineLength = 0;
  private readonly startedAt: number;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly stream: ChatProgressStream = process.stderr,
    private readonly now: () => number = Date.now,
  ) {
    this.startedAt = this.now();
  }

  start(message: string): void {
    this.stopTimer();
    this.currentMessage = message;
    if (this.stream.isTTY) {
      this.render(message);
      this.timer = setInterval(() => this.render(message), 120);
      this.timer.unref?.();
      return;
    }
    this.stream.write(`${chatProgressText(message)}\n`);
  }

  update(message: string, options: ChatProgressUpdateOptions = {}): void {
    this.currentMessage = message;
    if (this.stream.isTTY) {
      this.stopTimer();
      this.clearLine();
      this.render(message);
      this.timer = setInterval(() => this.render(message), 120);
      this.timer.unref?.();
      return;
    }
    this.stopTimer();
    this.stream.write(`${chatProgressText(message)}\n`);
    if (options.heartbeatMs !== undefined) {
      this.timer = setInterval(() => {
        this.stream.write(
          `${chatProgressText(
            formatWaitingHeartbeat(
              message,
              this.now() - this.startedAt,
              options.timeoutSeconds,
            ),
          )}\n`,
        );
      }, options.heartbeatMs);
      this.timer.unref?.();
    }
  }

  notice(message: string): void {
    if (this.stream.isTTY) {
      const currentMessage = this.currentMessage;
      this.clearLine();
      this.stream.write(`${chatNoticeText(message)}\n`);
      if (currentMessage !== null && this.timer !== null) {
        this.render(currentMessage);
      }
      return;
    }
    this.stream.write(`${chatNoticeText(message)}\n`);
  }

  succeed(message: string): void {
    this.finish(
      chatSuccessText(
        `${message} after ${formatElapsed(this.now() - this.startedAt)}.`,
      ),
    );
  }

  fail(message: string): void {
    this.finish(chatFailureText(message));
  }

  private finish(message: string): void {
    this.stopTimer();
    this.currentMessage = null;
    if (this.stream.isTTY) {
      this.clearLine();
    }
    this.stream.write(`${message}\n`);
  }

  private render(message: string): void {
    const frames = ["-", "\\", "|", "/"];
    const frame = frames[this.frameIndex % frames.length];
    this.frameIndex += 1;
    const elapsed = `(${formatElapsed(this.now() - this.startedAt)})`;
    const plainLine = `${frame} ${message} ${elapsed}`;
    this.lastLineLength = Math.max(this.lastLineLength, plainLine.length);
    this.stream.write(
      `\r${chatProgressText(`${frame} ${message}`)} ${chatColor(
        "dim",
        elapsed,
      )}`,
    );
  }

  private clearLine(): void {
    if (this.lastLineLength > 0) {
      this.stream.write(`\r${" ".repeat(this.lastLineLength)}\r`);
      this.lastLineLength = 0;
    }
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder === 0 ? `${minutes}m` : `${minutes}m ${remainder}s`;
}

function formatWaitingHeartbeat(
  message: string,
  elapsedMs: number,
  timeoutSeconds: number | undefined,
): string {
  const timeout =
    timeoutSeconds === undefined
      ? ""
      : timeoutSeconds === 0
        ? ", no timeout"
        : `, timeout ${formatElapsed(timeoutSeconds * 1000)}`;
  return `${message} (${formatElapsed(elapsedMs)} elapsed${timeout})`;
}

function parseLocalChatIdArg(value: string | undefined): number | null {
  if (value === undefined || !/^(0|[1-9]\d*)$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function resolveChatResponseBody(reply: EmailDetail): ChatResponseBody {
  if (reply.body_text && reply.body_text.length > 0) {
    return { body: reply.body_text, format: "text" };
  }
  if (reply.body_html && reply.body_html.length > 0) {
    return { body: reply.body_html, format: "html" };
  }
  if (reply.body_text !== null && reply.body_text !== undefined) {
    return { body: reply.body_text, format: "text" };
  }
  if (reply.body_html !== null && reply.body_html !== undefined) {
    return { body: reply.body_html, format: "html" };
  }
  return { body: "", format: "empty" };
}

function matchDescription(strategy: ChatMatchStrategy): string {
  return strategy === "strict"
    ? "strict, matched by reply_to_sent_email_id"
    : "fallback, matched by sender/time window";
}

// Exported so the reply-context recipient match can be unit-tested
// directly. The bare lowercase form is the comparison key everywhere
// addresses are matched in this command (assertParentMatchesRecipient,
// findLatestInboundFromRecipient, etc).
//
// RFC 5322 lets a From header carry a display name plus the bare
// address inside angle brackets ("Zork <zork@play.example.com>"). The
// CLI receives both shapes back from the API: `sender` is bare,
// `from_email` and `from_header` can carry the wrapper form. A literal
// string compare on the wrapped form against a bare recipient was
// rejecting every reply from a sender that sets a display name, which
// is basically every real service. Strip the angle-bracket wrapper
// before lowercasing so the two shapes round-trip to the same key.
export function normalizeEmailAddress(value: string): string {
  const angleMatch = value.match(/<([^>]+)>/);
  const bare = angleMatch?.[1] ?? value;
  return bare.trim().toLowerCase();
}

function derivedReplySubject(parent: EmailDetail): string {
  const subject = parent.subject?.trim();
  if (!subject) return "Re: (no subject)";
  return /^re:/i.test(subject) ? subject : `Re: ${subject}`;
}

function assertParentMatchesRecipient(
  parent: EmailDetail,
  recipient: string,
): void {
  if (
    normalizeEmailAddress(parent.from_email) ===
    normalizeEmailAddress(recipient)
  ) {
    return;
  }
  throw cliError(
    `Inbound email ${parent.id} is from ${parent.from_email}, not ${recipient}. Use \`primitive chat ${parent.from_email} --reply <message> --reply-to-email-id ${parent.id}\` or omit --reply-to-email-id to continue the latest inbound from ${recipient}.`,
  );
}

function emailDetailFromEnvelope(
  envelope: { data?: EmailDetail } | GetEmailResponse | undefined,
): EmailDetail | null {
  return (
    (envelope as { data?: EmailDetail } | undefined)?.data ??
    (envelope as EmailDetail | undefined) ??
    null
  );
}

function buildCommand(
  kind: ChatFollowUpCommandKind,
  description: string,
  argv: string[],
  options: { requiresMessage?: boolean } = {},
): ChatFollowUpCommand {
  return buildFollowUpCommand(kind, description, argv, options);
}

function shouldPreferStrictContinuation(context: ChatOutputContext): boolean {
  const hasCustomStrictPhase =
    context.strictPhaseSeconds !== DEFAULT_STRICT_PHASE_SECONDS;
  return (
    context.strictOnly ||
    (context.matchStrategy === "strict" && !hasCustomStrictPhase)
  );
}

export function buildChatFollowUpCommands(
  context: ChatOutputContext,
): ChatFollowUpCommand[] {
  const commands: ChatFollowUpCommand[] = [];
  const hasCustomStrictPhase =
    context.strictPhaseSeconds !== DEFAULT_STRICT_PHASE_SECONDS;
  const preferStrictContinuation = shouldPreferStrictContinuation(context);
  if (context.localChatId !== undefined) {
    const localContinueParts = [
      "primitive",
      "chat",
      "reply",
      String(context.localChatId),
      "<message>",
    ];
    if (context.json) {
      localContinueParts.push("--json");
    }
    if (context.quiet) {
      localContinueParts.push("--quiet");
    }
    commands.push(
      buildCommand("continue_chat", "Continue this chat", localContinueParts, {
        requiresMessage: true,
      }),
    );
    const activeContinueParts = ["primitive", "chat", "reply", "<message>"];
    if (context.json) {
      activeContinueParts.push("--json");
    }
    if (context.quiet) {
      activeContinueParts.push("--quiet");
    }
    commands.push(
      buildCommand(
        "continue_active_chat",
        "Continue the active chat",
        activeContinueParts,
        {
          requiresMessage: true,
        },
      ),
    );
  }
  const continueParts = [
    "primitive",
    "chat",
    context.recipient,
    "--reply",
    "<message>",
    "--from",
    context.from,
    "--reply-to-email-id",
    context.reply.id,
    "--timeout",
    String(context.timeoutSeconds),
  ];
  if (context.json) {
    continueParts.push("--json");
  }
  if (context.quiet) {
    continueParts.push("--quiet");
  }
  if (preferStrictContinuation) {
    continueParts.push("--strict-only");
  } else if (hasCustomStrictPhase) {
    continueParts.push(
      "--strict-phase-seconds",
      String(context.strictPhaseSeconds),
    );
  }
  commands.push(
    buildCommand(
      context.localChatId === undefined
        ? "continue_chat"
        : "continue_chat_explicit",
      context.localChatId === undefined
        ? "Continue this chat"
        : "Continue this chat explicitly",
      continueParts,
      {
        requiresMessage: true,
      },
    ),
  );
  commands.push(
    buildCommand(
      "reply_direct",
      "Reply directly to the inbound email",
      [
        "primitive",
        "reply",
        "--id",
        context.reply.id,
        "--from",
        context.from,
        "--body",
        "<message>",
      ],
      { requiresMessage: true },
    ),
  );
  commands.push(
    buildCommand("inspect_reply", "Inspect the full inbound email", [
      "primitive",
      "emails",
      "get",
      "--id",
      context.reply.id,
    ]),
  );
  commands.push(
    buildCommand("wait_for_more", "Wait for future replies to this send", [
      "primitive",
      "emails",
      "wait",
      "--reply-to-sent-email-id",
      context.sent.id,
      "--to",
      context.from,
      "--since",
      context.reply.received_at,
      "--timeout",
      String(context.timeoutSeconds),
    ]),
  );
  return commands;
}

export function buildChatRecoveryCommands(
  context: ChatBaseContext,
): ChatFollowUpCommand[] {
  const commands: ChatFollowUpCommand[] = [
    buildCommand("wait_threaded_reply", "Wait for the threaded reply again", [
      "primitive",
      "emails",
      "wait",
      "--reply-to-sent-email-id",
      context.sent.id,
      "--to",
      context.from,
      "--since",
      context.sentAtIso,
      "--timeout",
      String(context.timeoutSeconds),
    ]),
  ];
  if (!context.strictOnly) {
    commands.push(
      buildCommand(
        "wait_fallback_reply",
        "Fallback wait by sender/time window",
        [
          "primitive",
          "emails",
          "wait",
          "--from",
          context.recipient,
          "--to",
          context.from,
          "--since",
          context.sentAtIso,
          "--timeout",
          String(context.timeoutSeconds),
        ],
      ),
    );
  }
  commands.push(
    buildCommand("inspect_sent_email", "Inspect the outbound send", [
      "primitive",
      "sent",
      "get",
      "--id",
      context.sent.id,
    ]),
  );
  return commands;
}

type ChatMatchEnvelope = {
  description: string;
  reply_to_sent_email_id: string | null;
  strategy: ChatMatchStrategy;
};

// Fields every chat --json envelope carries, whatever the outcome.
// `outcome` and `exit_code` come from the shared send-outcome
// vocabulary so agents can branch on one field across chat, send and
// reply.
type ChatEnvelopeOutcomeFields = {
  outcome: SendOutcome;
  exit_code: number;
  outcome_message: string;
  follow_up_commands: ChatFollowUpCommand[];
  prior_replies: EmailDetailReply[] | null;
  http_status: number | null;
  error: unknown;
};

export type ChatReplyEnvelope = ChatEnvelopeOutcomeFields & {
  sent: SendMailResult;
  reply: EmailDetail;
  local_chat_id: number | null;
  response_body: string;
  response_body_format: ChatResponseBodyFormat;
  match: ChatMatchEnvelope;
};

export type ChatNoReplyEnvelope = ChatEnvelopeOutcomeFields & {
  sent: SendMailResult | null;
  reply: null;
  local_chat_id: null;
  response_body: null;
  response_body_format: null;
  match: null;
};

function chatNoun(context: { parentReply?: EmailDetail }): "Message" | "Reply" {
  return context.parentReply === undefined ? "Message" : "Reply";
}

export function formatChatRepliedMessage(
  context: ChatOutputContext,
  outcome: "already_sent" | "replied",
): string {
  if (outcome === "already_sent") {
    return `${formatAlreadySentNotice(context.sent)} Its existing reply from ${context.reply.from_email} is shown.`;
  }
  return `${chatNoun(context)} sent (id ${context.sent.id}) and a reply arrived from ${context.reply.from_email}.`;
}

export function buildChatJsonEnvelope(
  context: ChatOutputContext,
  outcome: "already_sent" | "replied" = "replied",
): ChatReplyEnvelope {
  const responseBody = resolveChatResponseBody(context.reply);
  return {
    outcome,
    exit_code: sendOutcomeExitCode(outcome),
    outcome_message: formatChatRepliedMessage(context, outcome),
    sent: context.sent,
    reply: context.reply,
    local_chat_id: context.localChatId ?? null,
    response_body: responseBody.body,
    response_body_format: responseBody.format,
    match: {
      description: matchDescription(context.matchStrategy),
      reply_to_sent_email_id: context.reply.reply_to_sent_email_id ?? null,
      strategy: context.matchStrategy,
    },
    follow_up_commands: buildChatFollowUpCommands(context),
    prior_replies: context.priorReplies ?? null,
    http_status: null,
    error: null,
  };
}

/**
 * The send went out and no reply is available yet: the wait timed
 * out, polling failed, or (for an idempotent replay) the earlier send
 * never got one. Every follow-up command waits on or inspects the
 * existing send; none of them sends again.
 */
export function buildChatAwaitingReplyEnvelope(
  context: ChatBaseContext,
  options: {
    outcome: "already_sent" | "sent_awaiting_reply";
    waitError?: string;
  },
): ChatNoReplyEnvelope {
  return {
    outcome: options.outcome,
    exit_code: sendOutcomeExitCode(options.outcome),
    outcome_message: formatChatAwaitingReplyMessage(context, options),
    sent: context.sent,
    reply: null,
    local_chat_id: null,
    response_body: null,
    response_body_format: null,
    match: null,
    follow_up_commands:
      options.outcome === "already_sent"
        ? buildChatExistingReplyCommands(context)
        : buildChatRecoveryCommands(context),
    prior_replies: context.priorReplies ?? null,
    http_status: null,
    error:
      options.waitError === undefined ? null : { message: options.waitError },
  };
}

export function formatChatAwaitingReplyMessage(
  context: ChatBaseContext,
  options: {
    outcome: "already_sent" | "sent_awaiting_reply";
    waitError?: string;
  },
): string {
  if (options.outcome === "already_sent") {
    const [wait] = buildChatExistingReplyCommands(context);
    const status =
      options.waitError === undefined
        ? "No reply to it yet."
        : `Loading its reply failed: ${options.waitError}.`;
    return `${formatAlreadySentNotice(context.sent)} ${status} Do NOT resend; wait with: ${wait.command}`;
  }
  const [wait] = buildChatRecoveryCommands(context);
  const status =
    options.waitError === undefined
      ? `No reply yet after ${context.timeoutSeconds}s.`
      : `Waiting for the reply failed: ${options.waitError}`;
  return `${chatNoun(context)} sent (id ${context.sent.id}). ${status} Do NOT resend; wait with: ${wait.command}`;
}

export function buildChatExistingReplyCommands(
  context: ChatBaseContext,
): ChatFollowUpCommand[] {
  return [
    buildCommand(
      "wait_existing_reply",
      "Wait for a reply to the earlier send",
      [
        "primitive",
        "emails",
        "wait",
        "--reply-to-sent-email-id",
        context.sent.id,
        "--to",
        context.from,
        "--include-existing",
        "--timeout",
        String(context.timeoutSeconds),
      ],
    ),
    buildCommand("inspect_sent_email", "Inspect the outbound send", [
      "primitive",
      "sent",
      "get",
      "--id",
      context.sent.id,
    ]),
  ];
}

/**
 * The send request did not produce a send record: it was rejected,
 * its result is unknown, or (already_sent) it was refused because a
 * matching earlier send exists but was deleted.
 */
export function buildChatSendFailureEnvelope(params: {
  error: unknown;
  exitCode?: number;
  httpStatus?: number;
  noun: "Message" | "Reply";
  outcome: "already_sent" | "not_sent" | "uncertain";
  outcomeMessage?: string;
  priorReplies?: EmailDetailReply[] | null;
  sentHistorySince?: string;
}): ChatNoReplyEnvelope {
  return {
    outcome: params.outcome,
    exit_code: params.exitCode ?? sendOutcomeExitCode(params.outcome),
    outcome_message:
      params.outcomeMessage ??
      (params.outcome === "already_sent"
        ? formatDeletedEarlierSendNotice()
        : formatSendFailureSummary(
            params.noun,
            params.outcome,
            params.httpStatus,
          )),
    sent: null,
    reply: null,
    local_chat_id: null,
    response_body: null,
    response_body_format: null,
    match: null,
    follow_up_commands:
      params.outcome === "uncertain" && params.sentHistorySince !== undefined
        ? [
            buildCommand(
              "list_recent_sent_emails",
              "Check sent history for this attempt before retrying",
              [
                "primitive",
                "sent",
                "list",
                "--date-from",
                sentHistoryWindowStart(params.sentHistorySince),
              ],
            ),
          ]
        : [],
    prior_replies: params.priorReplies ?? null,
    http_status: params.httpStatus ?? null,
    error: serializeErrorPayload(params.error),
  };
}

async function persistActiveChat(params: {
  configDir: string;
  context: ChatOutputContext;
  preferredLocalId?: number;
  writeWarning?: (message: string) => void;
}): Promise<number | null> {
  const release = await acquireChatStateLock(params.configDir);
  try {
    const saved = saveActiveChatState(
      params.configDir,
      {
        from: params.context.from,
        last_reply_email_id: params.context.reply.id,
        last_reply_received_at: params.context.reply.received_at,
        last_sent_email_id: params.context.sent.id,
        recipient: params.context.recipient,
        strict_only: shouldPreferStrictContinuation(params.context),
        strict_phase_seconds: params.context.strictPhaseSeconds,
        thread_id: params.context.reply.thread_id ?? null,
        timeout_seconds: params.context.timeoutSeconds,
      },
      { preferredLocalId: params.preferredLocalId },
    );
    return saved.local_id;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    params.writeWarning?.(
      `Warning: could not save local chat state: ${detail}\n`,
    );
    return null;
  } finally {
    release();
  }
}

/**
 * Pick the email id to surface from the one-shot strict search we run
 * when the server returned `idempotent_replay: true`. The search has
 * no `since` filter (the existing reply, if any, predates this
 * attempt's `sentAtIso`), so we may receive multiple historical
 * inbounds matching `reply_to_sent_email_id = sent.id` if the user
 * has been hammering the same content. Prefer the most recent
 * accepted/completed row; reject pending/processing rows the way the
 * normal poll does.
 */
export async function resolveIdempotentReplayReply(
  page: Awaited<ReturnType<typeof fetchEmailSearchPage>>,
): Promise<string | null> {
  if (!page.ok || page.rows.length === 0) return null;
  let latest: { id: string; receivedAt: string } | null = null;
  for (const row of page.rows) {
    if (row.status !== "accepted" && row.status !== "completed") continue;
    if (
      latest === null ||
      row.received_at.localeCompare(latest.receivedAt) > 0
    ) {
      latest = { id: row.id, receivedAt: row.received_at };
    }
  }
  return latest?.id ?? null;
}

export function formatChatResponse(context: ChatOutputContext): string {
  const accepted = context.sent.accepted.join(", ") || context.recipient;
  const responseBody = resolveChatResponseBody(context.reply);
  const lines = [
    chatSuccessText("Reply received"),
    "",
    chatHeading("Sent"),
    chatDetailLine(`  To: ${accepted}`),
    chatDetailLine(`  From: ${context.sent.from || context.from}`),
    chatDetailLine(`  Subject: ${context.subject}`),
    chatDetailLine(`  Sent email id: ${context.sent.id}`),
    chatColor(
      "green",
      `  Delivery status: ${context.sent.delivery_status ?? context.sent.status}`,
    ),
    "",
    chatHeading("Reply"),
    chatDetailLine(`  Email id: ${context.reply.id}`),
    chatDetailLine(`  From: ${context.reply.from_email}`),
    chatDetailLine(`  To: ${context.reply.to_email}`),
    chatDetailLine(`  Subject: ${context.reply.subject ?? "(no subject)"}`),
    chatDetailLine(`  Received: ${context.reply.received_at}`),
    chatDetailLine(`  Match: ${matchDescription(context.matchStrategy)}`),
  ];
  if (context.reply.reply_to_sent_email_id) {
    lines.push(
      chatDetailLine(
        `  Reply to sent email id: ${context.reply.reply_to_sent_email_id}`,
      ),
    );
  }
  if (context.reply.message_id) {
    lines.push(chatDetailLine(`  Message-Id: ${context.reply.message_id}`));
  }
  if (context.localChatId !== undefined) {
    lines.push(chatDetailLine(`  Local chat id: ${context.localChatId}`));
  }
  lines.push(
    "",
    chatHeading("Helpful follow-up commands"),
    chatDetailLine(
      "  Replace <message> before running commands that include it.",
    ),
    chatDetailLine(
      "  Commands are templates; use --json for parse-safe output.",
    ),
    chatDetailLine(
      "  When shown, --strict-only prefers timing out over matching the wrong reply.",
    ),
  );
  for (const { description, command } of buildChatFollowUpCommands(context)) {
    lines.push(
      chatHeading(`  ${description}:`),
      `    ${chatCommandText(command)}`,
    );
  }
  lines.push(
    "",
    chatHeading(
      `Response body (${responseBody.format}; use --json for parsing)`,
    ),
    "----- BEGIN RESPONSE -----",
    responseBody.body || "(empty response)",
    "----- END RESPONSE -----",
  );
  return lines.join("\n");
}

export function formatChatRecoveryContext(context: ChatBaseContext): string {
  const accepted = context.sent.accepted.join(", ") || context.recipient;
  const lines = [
    "",
    chatHeading("Sent message context"),
    chatDetailLine(`  To: ${accepted}`),
    chatDetailLine(`  From: ${context.sent.from || context.from}`),
    chatDetailLine(`  Subject: ${context.subject}`),
    chatDetailLine(`  Sent email id: ${context.sent.id}`),
    chatColor(
      "green",
      `  Delivery status: ${context.sent.delivery_status ?? context.sent.status}`,
    ),
    chatDetailLine(`  Poll since: ${context.sentAtIso}`),
    "",
    chatHeading("Helpful recovery commands"),
  ];
  for (const { description, command } of buildChatRecoveryCommands(context)) {
    lines.push(
      chatHeading(`  ${description}:`),
      `    ${chatCommandText(command)}`,
    );
  }
  return lines.join("\n");
}

async function loadInboundEmailDetail(params: {
  apiClient: Awaited<
    ReturnType<typeof createAuthenticatedCliApiClient>
  >["apiClient"];
  authFailureContext: ChatAuthFailureContext;
  id: string;
}): Promise<EmailDetail> {
  const result = await getEmail({
    client: params.apiClient.client,
    path: { id: params.id },
    responseStyle: "fields",
  });
  if (result.error) {
    const payload = extractErrorPayload(result.error);
    writeErrorWithHints(payload);
    surfaceUnauthorizedHint({
      ...params.authFailureContext,
      payload,
    });
    throw new Errors.CLIError(`Could not load inbound email ${params.id}.`, {
      exit: 1,
    });
  }
  const detail = emailDetailFromEnvelope(
    result.data as { data?: EmailDetail } | GetEmailResponse | undefined,
  );
  if (!detail) {
    throw new Errors.CLIError(
      `Could not load inbound email ${params.id}: the API returned no email body.`,
      { exit: 1 },
    );
  }
  return detail;
}

async function findLatestInboundFromRecipient(params: {
  apiClient: Awaited<
    ReturnType<typeof createAuthenticatedCliApiClient>
  >["apiClient"];
  authFailureContext: ChatAuthFailureContext;
  from: string;
  pageSize: number;
  recipient: string;
}): Promise<EmailDetail | null> {
  const result = await searchEmails({
    client: params.apiClient.client,
    query: {
      from: params.recipient,
      to: params.from,
      include_facets: "false",
      limit: params.pageSize,
      snippet: "false",
      sort: "received_at_desc",
    },
    responseStyle: "fields",
  });
  if (result.error) {
    const payload = extractErrorPayload(result.error);
    writeErrorWithHints(payload);
    surfaceUnauthorizedHint({
      ...params.authFailureContext,
      payload,
    });
    throw new Errors.CLIError("Could not find a prior chat reply.", {
      exit: 1,
    });
  }

  const envelope = result.data as SearchEmailsResponse | undefined;
  const row = (envelope?.data ?? []).find(
    (email) => email.status === "accepted" || email.status === "completed",
  );
  if (!row) return null;
  return loadInboundEmailDetail({
    apiClient: params.apiClient,
    authFailureContext: params.authFailureContext,
    id: row.id,
  });
}

class ChatCommand extends Command {
  static description = `Send a message to an address and wait for the reply.

  This is the first-party verb for talking to agents that live behind
  email addresses. \`primitive send\` is transport (fire-and-forget);
  \`primitive chat\` is semantic (send + wait for the threaded reply).

  The message body can be given as the second positional argument or
  piped via stdin. The default output confirms the reply was received,
  prints exchange metadata, shows the response body, and lists helpful
  follow-up commands as templates. The default transcript is for humans;
  agents and scripts should pass --json for parse-safe output.

  To continue an existing chat, pass --reply '<message>'. By default,
  the CLI replies to the latest inbound email from the recipient to
  your sender address. For exact continuation, pass
  --reply-to-email-id <inbound-email-id>. Reply mode uses Primitive's
  reply endpoint, so the reply subject and threading headers are
  derived from the inbound email instead of copied into CLI flags.
  Successful chat turns also save an active local chat, so the next
  follow-up can be sent with \`primitive chat reply '<message>'\`.

  --json emits a structured envelope with both sides of the exchange,
  a direct response_body field, match details, and follow-up command
  metadata such as kind, argv, placeholders, and requires_message.
  It is printed for every outcome, not only when a reply arrives: when
  the send went out but no reply came back, the envelope has
  "reply": null, the "sent" record, and follow_up_commands that wait on
  that existing send (never ones that send again).

  Matching the reply: chat first waits in strict threading mode by
  filtering inbound mail with reply_to_sent_email_id=<sent id>. If
  no strict match arrives before the strict phase ends, and
  --strict-only is not set, it falls back to a weaker sender/time
  window match: from=<recipient>, to=<sender>, and since=<send time>.
  The fallback can catch clients that strip threading headers, but it
  is less exact than strict matching. Use --strict-only when matching
  the wrong reply is worse than timing out. Progress is written to
  stderr while the CLI waits. When the send succeeded but no reply
  arrived before --timeout, the command exits 3 (sent_awaiting_reply)
  and says "Message sent (id X). No reply yet after Ns. Do NOT resend;
  wait with: <command>". The message already went out: wait, do not
  send it again.

  With --reply, the CLI warns on stderr when you already replied to
  the inbound email you are continuing. The warning never blocks the
  send.

  Independent addressed chats can run concurrently. Replies reserve their
  selected local chat. The last successfully saved reply becomes active.
  Retrying an interrupted or timed-out request resumes its recorded send;
  an uncertain send outcome requires inspection instead of a blind resend.

  ${SEND_OUTCOME_HELP}`;

  static summary =
    "Chat with an agent over email (send and wait for the reply)";

  static examples = [
    "<%= config.bin %> chat help@agent.acme.dev 'how do I rotate my API key?'",
    "cat error.log | <%= config.bin %> chat help@agent.acme.dev",
    "<%= config.bin %> chat reply 'one more thing'",
    "<%= config.bin %> chat reply 'see attached' --attachment ./report.pdf",
    "<%= config.bin %> chat help@agent.acme.dev --reply 'one more thing'",
    "<%= config.bin %> chat help@agent.acme.dev --reply 'one more thing' --reply-to-email-id <inbound-email-id>",
    "<%= config.bin %> chat help@agent.acme.dev 'can you review this?' --attachment ./report.pdf",
    "<%= config.bin %> chat help@agent.acme.dev 'follow up question' --json",
    "<%= config.bin %> chat help@agent.acme.dev 'one more thing' --timeout 300",
  ];

  static args = {
    recipient: Args.string({
      description: "Address to chat with (e.g. help@agent.acme.dev).",
      required: true,
    }),
    message: Args.string({
      description: "Message body. If omitted, read from stdin.",
    }),
  };

  static flags = {
    "api-key": Flags.string({
      description:
        "Primitive API key (defaults to PRIMITIVE_API_KEY or saved `primitive signin` credentials)",
      env: "PRIMITIVE_API_KEY",
    }),
    "api-base-url": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL",
      hidden: true,
    }),
    from: Flags.string({
      description:
        "Sender address. Defaults to agent@<your-first-verified-outbound-domain>.",
    }),
    subject: Flags.string({
      description:
        "Advanced email transport override. Usually omit; chat threading does not depend on the subject.",
      hidden: true,
    }),
    reply: Flags.string({
      description:
        "Reply body. Continues the latest inbound email from the recipient to your sender address; pass --reply-to-email-id for an exact thread.",
    }),
    "reply-to-email-id": Flags.string({
      description:
        "Inbound email id to continue exactly. Uses Primitive's reply endpoint, so recipient, subject, and threading headers are derived from the inbound email.",
    }),
    "in-reply-to": Flags.string({
      description:
        "Raw Message-Id of the parent email to thread a new send against. Prefer --reply-to-email-id with --reply when continuing an inbound email stored by Primitive.",
    }),
    attachment: Flags.string({
      char: "a",
      description:
        "Attach a file to this chat message. Repeat --attachment to attach multiple files.",
      multiple: true,
    }),
    "chat-local-id": Flags.integer({
      description:
        "Local chat id to update after this command succeeds. Internal plumbing for `primitive chat reply`.",
      hidden: true,
      min: 0,
    }),
    json: Flags.boolean({
      description:
        "Emit a structured JSON envelope { outcome, exit_code, outcome_message, sent, reply, response_body, response_body_format, match, follow_up_commands, prior_replies } on stdout instead of the human-readable transcript. Printed for every outcome; reply is null when no reply arrived.",
    }),
    quiet: Flags.boolean({
      description:
        "Suppress stderr progress updates while sending and waiting. Errors and recovery commands are still written to stderr.",
    }),
    timeout: Flags.integer({
      default: DEFAULT_CHAT_TIMEOUT_SECONDS,
      description:
        "Seconds to wait for a reply; 0 waits forever. When it passes without a reply the command exits 3 (sent_awaiting_reply): the message went out, so wait instead of resending.",
      min: 0,
    }),
    "strict-phase-seconds": Flags.integer({
      default: DEFAULT_STRICT_PHASE_SECONDS,
      description:
        "Seconds to wait in strict-threading mode (filter by reply_to_sent_email_id) before falling back to time-window matching. Set to the full --timeout to disable the fallback; --strict-only is the explicit way to do that.",
      min: 1,
    }),
    "strict-only": Flags.boolean({
      description:
        "Disable the time-window fallback. Only accept inbounds whose threading headers (In-Reply-To / References) resolve to this send. Use when matching the wrong reply is worse than timing out.",
    }),
    interval: Flags.integer({
      default: DEFAULT_EMAIL_POLL_INTERVAL_SECONDS,
      description: "Seconds between polls while waiting for the reply.",
      min: 1,
    }),
    "page-size": Flags.integer({
      default: DEFAULT_EMAIL_POLL_PAGE_SIZE,
      description:
        "Inbound emails to fetch per poll while waiting (1-100). Internal tuning knob.",
      max: 100,
      min: 1,
      hidden: true,
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  // Tracks how far this invocation got so a thrown error can be
  // reported with the right outcome: before the send request nothing
  // went out, during it the result is unknown, and after it the
  // message is out and only the reply is missing.
  private chatProgress: {
    baseContext: ChatBaseContext | null;
    replied: {
      context: ChatOutputContext;
      outcome: "already_sent" | "replied";
    } | null;
    outcomeReported: boolean;
    phase: "pre_send" | "sending" | "sent";
    priorReplies: EmailDetailReply[] | null;
    sendStartedAtIso: string | null;
  } = {
    baseContext: null,
    replied: null,
    outcomeReported: false,
    phase: "pre_send",
    priorReplies: null,
    sendStartedAtIso: null,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChatCommand);
    const replyMode =
      flags.reply !== undefined || flags["reply-to-email-id"] !== undefined;
    const noun = replyMode ? "Reply" : "Message";
    try {
      await this.runChat(args, flags);
    } catch (error) {
      if (this.chatProgress.outcomeReported) throw error;
      this.chatProgress.outcomeReported = true;
      const detail = error instanceof Error ? error.message : String(error);
      const { baseContext, phase, replied } = this.chatProgress;

      if (replied !== null) {
        // The reply is already in hand; a local bookkeeping failure
        // after that must not hide it or send the caller back to wait.
        process.stderr.write(`${chatFailureText(`Warning: ${detail}`)}\n`);
        this.reportReplied(replied.context, replied.outcome);
        return;
      }

      if (phase === "sent" && baseContext !== null) {
        // The message is out; only the reply wait broke. Reporting
        // this as a failure is what made callers send twice.
        process.stderr.write(`${chatFailureText(`Error: ${detail}`)}\n`);
        this.reportAwaitingReply(baseContext, {
          outcome: "sent_awaiting_reply",
          waitError: detail,
        });
        return;
      }

      const outcome =
        phase === "sending" || error instanceof UncertainChatSendError
          ? "uncertain"
          : "not_sent";
      if (flags.json) {
        this.log(
          JSON.stringify(
            buildChatSendFailureEnvelope({
              error: { message: detail },
              exitCode:
                outcome === "not_sent" ? thrownErrorExitCode(error) : undefined,
              noun,
              outcome,
              outcomeMessage:
                outcome === "not_sent"
                  ? formatSendFailureSummary(noun, "not_sent", undefined)
                  : `${noun} send outcome uncertain: ${detail}`,
              priorReplies: this.chatProgress.priorReplies,
              sentHistorySince: this.chatProgress.sendStartedAtIso ?? undefined,
            }),
            null,
            2,
          ),
        );
      }
      if (outcome === "uncertain") {
        throw new Errors.CLIError(detail, {
          exit: sendOutcomeExitCode("uncertain"),
        });
      }
      throw error;
    }
  }

  private reportAwaitingReply(
    context: ChatBaseContext,
    options: {
      outcome: "already_sent" | "sent_awaiting_reply";
      waitError?: string;
    },
  ): void {
    this.chatProgress.outcomeReported = true;
    const envelope = buildChatAwaitingReplyEnvelope(context, options);
    // The recovery transcript waits on this attempt's send time; an
    // idempotent replay's reply would predate it, so the replay
    // message carries its own wait command instead.
    if (options.outcome === "sent_awaiting_reply") {
      process.stderr.write(`${formatChatRecoveryContext(context)}\n`);
    }
    if (context.json) {
      process.stderr.write(`${chatNoticeText(envelope.outcome_message)}\n`);
      this.log(JSON.stringify(envelope, null, 2));
    } else {
      this.log(envelope.outcome_message);
    }
    if (envelope.exit_code !== 0) process.exitCode = envelope.exit_code;
  }

  private async runChat(
    args: Interfaces.InferredArgs<typeof ChatCommand.args>,
    flags: Interfaces.InferredFlags<typeof ChatCommand.flags>,
  ): Promise<void> {
    const replyMode =
      flags.reply !== undefined || flags["reply-to-email-id"] !== undefined;
    const noun = replyMode ? "Reply" : "Message";
    if (
      flags.reply !== undefined &&
      args.message !== undefined &&
      args.message !== ""
    ) {
      throw cliError(
        "Pass the reply body either as --reply or as the positional message, not both.",
      );
    }
    if (replyMode && flags.subject !== undefined) {
      throw cliError(
        "--subject is not used with --reply. Primitive derives the reply subject from the inbound email.",
      );
    }
    if (replyMode && flags["in-reply-to"] !== undefined) {
      throw cliError(
        "Use --reply-to-email-id with --reply instead of raw --in-reply-to.",
      );
    }

    const message =
      flags.reply !== undefined
        ? flags.reply
        : args.message !== undefined && args.message !== ""
          ? args.message
          : await readStdinToString();
    if (!message.trim()) {
      throw cliError(
        replyMode ? "Reply body is empty." : "Message body is empty.",
      );
    }

    await runWithTiming(flags.time, async () => {
      let releaseLock: (() => void) | undefined;
      try {
        const { apiClient, auth, baseUrlOverridden } =
          await createAuthenticatedCliApiClient({
            apiKey: flags["api-key"],
            apiBaseUrl: flags["api-base-url"],
            configDir: this.config.configDir,
          });

        const authFailureContext: ChatAuthFailureContext = {
          auth,
          baseUrlOverridden,
          configDir: this.config.configDir,
        };
        const progress = flags.quiet
          ? null
          : new ChatProgressIndicator(process.stderr);
        const attachments = readAttachmentFiles(flags.attachment);

        let from: string;
        let parentReply: EmailDetail | undefined;
        let subject: string;

        if (replyMode) {
          const replyContext = await (async (): Promise<{
            from: string;
            parentReply: EmailDetail;
          }> => {
            let replyContextFailureMessage = "Could not load reply context.";
            try {
              if (flags["reply-to-email-id"] !== undefined) {
                progress?.start(
                  `Loading reply context for ${flags["reply-to-email-id"]}`,
                );
                const exactParentReply = await loadInboundEmailDetail({
                  apiClient,
                  authFailureContext,
                  id: flags["reply-to-email-id"],
                });
                replyContextFailureMessage = `Inbound email ${flags["reply-to-email-id"]} does not match recipient ${args.recipient}.`;
                assertParentMatchesRecipient(exactParentReply, args.recipient);
                return {
                  from: flags.from ?? exactParentReply.to_email,
                  parentReply: exactParentReply,
                };
              }

              const replyFrom =
                flags.from ??
                (await pickDefaultFromAddress(apiClient, authFailureContext));
              progress?.start(
                `Finding latest inbound email from ${args.recipient}`,
              );
              const latestParentReply = await findLatestInboundFromRecipient({
                apiClient,
                authFailureContext,
                from: replyFrom,
                pageSize: flags["page-size"],
                recipient: args.recipient,
              });
              if (!latestParentReply) {
                replyContextFailureMessage = "No prior inbound email found.";
                throw cliError(
                  `No prior inbound email from ${args.recipient} to ${replyFrom}. Start a new chat with \`primitive chat ${args.recipient} <message>\`, pass --from, or pass --reply-to-email-id <inbound-email-id>.`,
                );
              }
              replyContextFailureMessage = `Inbound email ${latestParentReply.id} does not match recipient ${args.recipient}.`;
              assertParentMatchesRecipient(latestParentReply, args.recipient);
              return { from: replyFrom, parentReply: latestParentReply };
            } catch (error) {
              progress?.fail(replyContextFailureMessage);
              throw error;
            }
          })();
          from = replyContext.from;
          parentReply = replyContext.parentReply;
          subject = derivedReplySubject(replyContext.parentReply);
        } else {
          from =
            flags.from ??
            (await pickDefaultFromAddress(apiClient, authFailureContext));
          subject = flags.subject ?? deriveSubject(message);
        }

        const requestHash = chatRequestHash({
          api: auth.apiBaseUrl,
          account:
            auth.credentials?.org_id ??
            chatCredentialIdentity(auth.apiKey, auth.apiBaseUrl),
          from,
          recipient: args.recipient,
          subject,
          message,
          parent: parentReply?.id ?? flags["in-reply-to"],
          attachments,
        });
        const scope = parentReply
          ? chatRequestHash({
              api: auth.apiBaseUrl,
              from,
              parent: parentReply.id,
            })
          : requestHash;
        try {
          releaseLock = acquireChatLock(this.config.configDir, scope);
        } catch (error) {
          if (error instanceof ChatLockContentionError)
            throw cliError(error.message);
          throw error;
        }
        if (flags["chat-local-id"] !== undefined) {
          const releaseState = await acquireChatStateLock(
            this.config.configDir,
          );
          try {
            const current = loadChatConversationByLocalId(
              this.config.configDir,
              flags["chat-local-id"],
            );
            if (!current || current.last_reply_email_id !== parentReply?.id) {
              throw cliError(
                "This local chat advanced while preparing the reply. Retry to use its latest reply.",
              );
            }
          } finally {
            releaseState();
          }
        }
        const receipt = beginChatReceipt(
          this.config.configDir,
          scope,
          requestHash,
        );
        const sentAtIso = receipt.data.sent_at;
        process.stderr.write(`Chat receipt: ${receipt.path}\n`);
        const resumed = receipt.data.sent !== null;
        this.chatProgress.sendStartedAtIso = sentAtIso;

        if (parentReply !== undefined) {
          const priorReplies = Array.isArray(parentReply.replies)
            ? priorRepliesThatWentOut(parentReply.replies, {
                excludeSentId: receipt.data.sent?.id,
              })
            : null;
          this.chatProgress.priorReplies = priorReplies;
          // Resuming a recorded send puts nothing new on the wire, so
          // there is nothing to warn about.
          if (!resumed) {
            const warning =
              priorReplies === null
                ? `Could not check whether you already replied to email ${parentReply.id} (the API returned no reply history). Prior-reply check skipped; sending the reply anyway.`
                : formatPriorRepliesWarning(priorReplies);
            if (warning !== null) {
              if (progress) progress.notice(warning);
              else process.stderr.write(`${chatNoticeText(warning)}\n`);
            }
          }
        }

        if (resumed) {
          progress?.start("Resuming the recorded send without sending again");
        } else if (replyMode) {
          progress?.update(`Sending reply to ${args.recipient}`);
        } else {
          progress?.start(`Sending message to ${args.recipient}`);
        }

        if (!resumed) this.chatProgress.phase = "sending";
        const sendResult =
          receipt.data.sent !== null
            ? { data: { data: receipt.data.sent }, error: undefined }
            : parentReply !== undefined
              ? await replyToEmail({
                  body: {
                    body_text: message,
                    from,
                    ...(attachments !== undefined ? { attachments } : {}),
                  },
                  client: apiClient.client,
                  path: { id: parentReply.id },
                  responseStyle: "fields",
                })
              : await sendEmail({
                  body: {
                    from,
                    to: args.recipient,
                    subject,
                    body_text: message,
                    ...(flags["in-reply-to"] !== undefined
                      ? { in_reply_to: flags["in-reply-to"] }
                      : {}),
                    ...(attachments !== undefined ? { attachments } : {}),
                  },
                  client: apiClient.client,
                  responseStyle: "fields",
                });

        if (sendResult.error) {
          this.reportSendFailure({
            authFailureContext,
            json: flags.json,
            noun,
            progress,
            receipt,
            sendResult,
            sentAtIso,
          });
          return;
        }

        const sentEnvelope = sendResult.data as
          | { data?: SendMailResult }
          | undefined;
        const sent = sentEnvelope?.data;
        if (!sent) {
          progress?.fail("Send succeeded but the API returned no data.");
          throw cliError(
            "The API accepted the send but returned no send record, so it is unknown whether it went out. Check sent history before retrying.",
          );
        }

        const replyAddress = sent.from || from;
        const baseContext: ChatBaseContext = {
          from: replyAddress,
          json: flags.json,
          parentReply,
          priorReplies: this.chatProgress.priorReplies,
          quiet: flags.quiet,
          recipient: args.recipient,
          sent,
          sentAtIso,
          strictOnly: flags["strict-only"],
          strictPhaseSeconds: flags["strict-phase-seconds"],
          subject,
          timeoutSeconds: flags.timeout,
        };
        this.chatProgress.baseContext = baseContext;
        this.chatProgress.phase = "sent";

        receipt.data.sent = sent;
        saveChatReceipt(receipt);

        // Server-side idempotency dedup: when the same content
        // (from + to + subject + body) is sent within the dedup
        // window, /v1/send-mail (and /v1/emails/{id}/reply, which
        // wraps it) returns the original sent_email row with
        // `idempotent_replay: true` and no SMTP traffic. The reply,
        // if any, has `received_at` BEFORE this attempt's
        // `sentAtIso`, so the normal polling loop's `since` filter
        // would never find it and we'd time out at 120 s.
        //
        // Detect that here, do a one-shot strict-search WITHOUT the
        // `since` filter, surface the existing reply if it exists,
        // and report `already_sent` otherwise. The message went out
        // earlier, so the answer is to wait for that send's reply,
        // never to vary the content and send again.
        if (sent.idempotent_replay) {
          progress?.update(
            "Server returned idempotent_replay: looking up the existing reply",
          );
          const existing = await fetchEmailSearchPage({
            apiClient,
            cursor: null,
            filters: { replyToSentEmailId: sent.id },
            pageSize: flags["page-size"],
            // Intentionally NO `since`: the reply (if any) predates
            // this attempt.
          });
          const replyId = await resolveIdempotentReplayReply(existing);
          if (replyId) {
            const full = await getEmail({
              client: apiClient.client,
              path: { id: replyId },
              responseStyle: "fields",
            });
            const detail = full.error
              ? null
              : emailDetailFromEnvelope(
                  full.data as
                    | { data?: EmailDetail }
                    | GetEmailResponse
                    | undefined,
                );
            if (full.error) {
              const payload = extractErrorPayload(full.error);
              writeErrorWithHints(payload);
              surfaceUnauthorizedHint({
                ...authFailureContext,
                payload,
              });
            }
            if (!detail) {
              progress?.fail("Could not load the existing reply.");
              this.reportAwaitingReply(baseContext, {
                outcome: "already_sent",
                waitError: `its existing reply ${replyId} could not be loaded`,
              });
              return;
            }
            progress?.succeed(
              `Idempotent replay; surfacing existing reply from ${
                detail.from_email ?? args.recipient
              }`,
            );
            let outputContext: ChatOutputContext = {
              ...baseContext,
              matchStrategy: "strict",
              reply: detail,
            };
            this.chatProgress.replied = {
              context: outputContext,
              outcome: "already_sent",
            };
            const localChatId = await persistActiveChat({
              configDir: this.config.configDir,
              context: outputContext,
              preferredLocalId: flags["chat-local-id"],
              writeWarning: (message) => process.stderr.write(message),
            });
            if (localChatId !== null) {
              outputContext = { ...outputContext, localChatId };
              this.chatProgress.replied = {
                context: outputContext,
                outcome: "already_sent",
              };
            }
            receipt.data.completed = localChatId !== null;
            saveChatReceipt(receipt);
            this.reportReplied(outputContext, "already_sent");
            return;
          }
          // No reply to the earlier identical send yet. Sending it
          // again would not change that; waiting might.
          progress?.fail(
            "Server deduplicated this send (idempotent_replay: true).",
          );
          this.reportAwaitingReply(baseContext, { outcome: "already_sent" });
          return;
        }

        progress?.update(
          `${noun} sent; waiting for reply from ${args.recipient}`,
          { heartbeatMs: 15_000, timeoutSeconds: flags.timeout },
        );

        let replyResult: ChatReplyResult | null;
        try {
          replyResult = await waitForReply({
            apiClient,
            authFailureContext,
            from: replyAddress,
            interval: flags.interval,
            notice: (message) => {
              if (progress) {
                progress.notice(message);
                return;
              }
              process.stderr.write(`${message}\n`);
            },
            pageSize: flags["page-size"],
            recipient: args.recipient,
            sentAtIso,
            sentId: sent.id,
            strictOnly: flags["strict-only"],
            strictPhaseSeconds: flags["strict-phase-seconds"],
            timeoutSeconds: flags.timeout,
          });
        } catch (error) {
          progress?.fail("Reply polling failed.");
          throw error;
        }
        if (replyResult === null) {
          const timeoutMessage = `Timed out after ${flags.timeout}s waiting for a reply from ${args.recipient}.`;
          progress?.fail(timeoutMessage);
          if (progress === null) {
            process.stderr.write(`${timeoutMessage}\n`);
          }
          this.reportAwaitingReply(baseContext, {
            outcome: "sent_awaiting_reply",
          });
          return;
        }

        progress?.succeed(
          `Reply received from ${replyResult.reply.from_email}`,
        );

        let outputContext: ChatOutputContext = {
          ...baseContext,
          matchStrategy: replyResult.matchStrategy,
          reply: replyResult.reply,
        };
        this.chatProgress.replied = {
          context: outputContext,
          outcome: "replied",
        };

        const localChatId = await persistActiveChat({
          configDir: this.config.configDir,
          context: outputContext,
          preferredLocalId: flags["chat-local-id"],
          writeWarning: (message) => process.stderr.write(message),
        });
        if (localChatId !== null) {
          outputContext = { ...outputContext, localChatId };
          this.chatProgress.replied = {
            context: outputContext,
            outcome: "replied",
          };
        }

        receipt.data.completed = localChatId !== null;
        saveChatReceipt(receipt);
        this.reportReplied(outputContext, "replied");
      } finally {
        releaseLock?.();
      }
    });
  }

  private reportReplied(
    context: ChatOutputContext,
    outcome: "already_sent" | "replied",
  ): void {
    this.chatProgress.outcomeReported = true;
    if (outcome === "already_sent") {
      process.stderr.write(
        `${chatNoticeText(formatAlreadySentNotice(context.sent))}\n`,
      );
    }
    if (context.json) {
      this.log(
        JSON.stringify(buildChatJsonEnvelope(context, outcome), null, 2),
      );
    } else {
      this.log(formatChatResponse(context));
    }
  }

  private reportSendFailure(params: {
    authFailureContext: ChatAuthFailureContext;
    json: boolean;
    noun: "Message" | "Reply";
    progress: ChatProgressIndicator | null;
    receipt: ChatReceipt;
    sendResult: { error?: unknown };
    sentAtIso: string;
  }): void {
    this.chatProgress.outcomeReported = true;
    const httpStatus = apiResultHttpStatus(params.sendResult);
    const errorPayload = extractErrorPayload(params.sendResult.error);
    const outcome = classifySendError(httpStatus, errorPayload);
    // A definitive rejection sent nothing new, and a refusal because
    // the matching earlier send was deleted is settled too, so neither
    // leaves anything pending. Any other failure leaves the receipt
    // pending so a retry stops for inspection instead of sending
    // blindly.
    if (outcome !== "uncertain") {
      params.receipt.data.completed = true;
      saveChatReceipt(params.receipt);
    }
    params.progress?.fail(
      outcome === "already_sent"
        ? `${params.noun} already sent earlier.`
        : `${params.noun} send failed.`,
    );
    writeErrorWithHints(errorPayload);
    surfaceUnauthorizedHint({
      ...params.authFailureContext,
      payload: errorPayload,
    });
    const envelope = buildChatSendFailureEnvelope({
      error: errorPayload,
      httpStatus,
      noun: params.noun,
      outcome,
      outcomeMessage:
        outcome === "already_sent"
          ? formatDeletedEarlierSendNotice()
          : undefined,
      priorReplies: this.chatProgress.priorReplies,
      sentHistorySince: params.sentAtIso,
    });
    if (outcome === "already_sent") {
      process.stderr.write(`${chatNoticeText(envelope.outcome_message)}\n`);
      if (!params.json) this.log(envelope.outcome_message);
    } else {
      process.stderr.write(`${chatFailureText(envelope.outcome_message)}\n`);
    }
    if (params.json) {
      this.log(JSON.stringify(envelope, null, 2));
    }
    if (envelope.exit_code !== 0) process.exitCode = envelope.exit_code;
  }
}

export class ChatReplyCommand extends Command {
  static description = `Reply in the active chat.

  A successful \`primitive chat <email> <message>\` saves the latest
  inbound reply as a local chat and makes it active. Use
  \`primitive chat reply <message>\` for the active chat, or
  \`primitive chat reply <local-id> <message>\` / \`--id <local-id>\`
  for a specific local chat. The command uses Primitive's real reply
  endpoint against the stored inbound email id, so the recipient,
  subject, and threading headers are derived server-side from the
  thread.

  If no chat is open, start one with \`primitive chat <email> '<message>'\`.
  For explicit control, use \`primitive chat <email> --reply '<message>'
  --reply-to-email-id <inbound-email-id>\`.

  Output, --json envelopes and exit codes match \`primitive chat\`. In
  particular, exit 3 (sent_awaiting_reply) means the reply went out and
  no answer arrived in time: wait for it, do not send it again.

  ${SEND_OUTCOME_HELP}`;

  static summary = "Reply in the active chat";

  static examples = [
    "<%= config.bin %> chat reply 'one more thing'",
    "<%= config.bin %> chat reply 0 'one more thing'",
    "<%= config.bin %> chat reply --id 0 'one more thing'",
    "<%= config.bin %> chat reply 'see attached' --attachment ./report.pdf",
    "cat follow-up.txt | <%= config.bin %> chat reply",
  ];

  static args = {
    idOrMessage: Args.string({
      description:
        "Reply body, or a local chat id when followed by a separate message.",
    }),
    message: Args.string({
      description: "Reply body when the first positional argument is an id.",
    }),
  };

  static flags = {
    "api-key": Flags.string({
      description:
        "Primitive API key (defaults to PRIMITIVE_API_KEY or saved `primitive signin` credentials)",
      env: "PRIMITIVE_API_KEY",
    }),
    "api-base-url": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL",
      hidden: true,
    }),
    id: Flags.integer({
      description:
        "Local chat id to reply in. Omit to use the most recent active chat.",
      min: 0,
    }),
    json: Flags.boolean({
      description:
        "Emit a structured JSON envelope { outcome, exit_code, outcome_message, sent, reply, response_body, response_body_format, match, follow_up_commands, prior_replies } on stdout instead of the human-readable transcript. Printed for every outcome; reply is null when no reply arrived.",
    }),
    quiet: Flags.boolean({
      description:
        "Suppress stderr progress updates while sending and waiting. Errors and recovery commands are still written to stderr.",
    }),
    timeout: Flags.integer({
      description:
        "Seconds to wait for a reply before exiting 3 (sent_awaiting_reply). Defaults to the active chat's last timeout.",
      min: 0,
    }),
    "strict-phase-seconds": Flags.integer({
      description:
        "Seconds to wait in strict-threading mode before falling back. Defaults to the active chat's last setting.",
      min: 1,
    }),
    "strict-only": Flags.boolean({
      description:
        "Disable the time-window fallback. If the active chat was saved from a strict match, this is already the default.",
    }),
    attachment: Flags.string({
      char: "a",
      description:
        "Attach a file to the reply. Repeat --attachment to attach multiple files.",
      multiple: true,
    }),
    interval: Flags.integer({
      description: "Seconds between polls while waiting for the reply.",
      min: 1,
    }),
    "page-size": Flags.integer({
      description:
        "Inbound emails to fetch per poll while waiting (1-100). Internal tuning knob.",
      max: 100,
      min: 1,
      hidden: true,
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  private delegatedToChat = false;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChatReplyCommand);
    try {
      await this.runReply(args, flags);
    } catch (error) {
      // Once delegated, `primitive chat` reports its own outcome. Any
      // earlier failure (no open chat, busy chat, bad input) sent
      // nothing, and --json still owes stdout an envelope.
      if (flags.json && !this.delegatedToChat) {
        const detail = error instanceof Error ? error.message : String(error);
        this.log(
          JSON.stringify(
            buildChatSendFailureEnvelope({
              error: { message: detail },
              exitCode: thrownErrorExitCode(error),
              noun: "Reply",
              outcome: "not_sent",
            }),
            null,
            2,
          ),
        );
      }
      throw error;
    }
  }

  private async runReply(
    args: Interfaces.InferredArgs<typeof ChatReplyCommand.args>,
    flags: Interfaces.InferredFlags<typeof ChatReplyCommand.flags>,
  ): Promise<void> {
    const positionalLocalId =
      flags.id === undefined && args.message !== undefined
        ? parseLocalChatIdArg(args.idOrMessage)
        : undefined;
    if (
      flags.id === undefined &&
      args.message !== undefined &&
      positionalLocalId === null
    ) {
      throw cliError(
        "When passing two positional arguments to `primitive chat reply`, the first must be a local chat id. Use `primitive chat reply '<message>'` for the active chat or `primitive chat reply --id <id> '<message>'` for a specific chat.",
      );
    }
    if (flags.id !== undefined && args.message !== undefined) {
      throw cliError(
        "With --id, pass the reply body as a single positional argument or pipe it via stdin.",
      );
    }

    let release: (() => void) | undefined;
    try {
      const localId: number | undefined =
        flags.id ??
        (typeof positionalLocalId === "number" ? positionalLocalId : undefined);
      // Select the active chat once, then reserve only that local chat.
      const releaseState = await acquireChatStateLock(this.config.configDir);
      let state: ChatConversationState | null;
      try {
        state =
          localId === undefined
            ? loadActiveChatState(this.config.configDir)
            : loadChatConversationByLocalId(this.config.configDir, localId);
        if (state)
          release = acquireChatLock(
            this.config.configDir,
            `local:${state.local_id}`,
          );
      } catch (error) {
        if (error instanceof ChatLockContentionError)
          throw cliError(error.message);
        throw error;
      } finally {
        releaseState();
      }
      if (!state) {
        throw cliError(
          localId === undefined
            ? "No open chat. Start one with `primitive chat <email> '<message>'`."
            : `No local chat ${localId}. Start one with \`primitive chat <email> '<message>'\` or omit --id to use the active chat.`,
        );
      }

      const message =
        args.message !== undefined
          ? args.message
          : args.idOrMessage !== undefined && args.idOrMessage !== ""
            ? args.idOrMessage
            : await readStdinToString(
                "No reply body provided. Pass the reply body as a positional argument or pipe it via stdin.",
              );
      if (!message.trim()) {
        throw cliError("Reply body is empty.");
      }

      const argv = [
        state.recipient,
        "--reply",
        message,
        "--from",
        state.from,
        "--reply-to-email-id",
        state.last_reply_email_id,
        "--timeout",
        String(flags.timeout ?? state.timeout_seconds),
        "--strict-phase-seconds",
        String(flags["strict-phase-seconds"] ?? state.strict_phase_seconds),
        "--interval",
        String(flags.interval ?? DEFAULT_EMAIL_POLL_INTERVAL_SECONDS),
        "--page-size",
        String(flags["page-size"] ?? DEFAULT_EMAIL_POLL_PAGE_SIZE),
        "--chat-local-id",
        String(state.local_id),
      ];

      if (flags["api-key"] !== undefined) {
        argv.push("--api-key", flags["api-key"]);
      }
      if (flags["api-base-url"] !== undefined) {
        argv.push("--api-base-url", flags["api-base-url"]);
      }
      if (flags.json) argv.push("--json");
      if (flags.quiet) argv.push("--quiet");
      for (const attachment of flags.attachment ?? []) {
        argv.push("--attachment", attachment);
      }
      if (state.strict_only || flags["strict-only"]) argv.push("--strict-only");
      if (flags.time) argv.push("--time");

      this.delegatedToChat = true;
      await ChatCommand.run(argv, { root: this.config.root });
    } finally {
      release?.();
    }
  }
}

type WaitForReplyParams = {
  apiClient: Awaited<
    ReturnType<typeof createAuthenticatedCliApiClient>
  >["apiClient"];
  authFailureContext: {
    auth: Awaited<ReturnType<typeof createAuthenticatedCliApiClient>>["auth"];
    baseUrlOverridden: boolean;
    configDir: string;
  };
  from: string;
  interval: number;
  notice?: (message: string) => void;
  pageSize: number;
  recipient: string;
  sentAtIso: string;
  sentId: string;
  strictOnly: boolean;
  strictPhaseSeconds: number;
  timeoutSeconds: number;
};

async function waitForReply(
  params: WaitForReplyParams,
): Promise<ChatReplyResult | null> {
  const notice =
    params.notice ??
    ((message: string) => {
      process.stderr.write(`${message}\n`);
    });
  const totalDeadline =
    params.timeoutSeconds === 0
      ? null
      : Date.now() + params.timeoutSeconds * 1000;
  // Strict phase ends at min(strictPhaseSeconds, total timeout). If
  // --strict-only is set, the strict phase covers the entire wait
  // window and the fallback never runs.
  const strictDeadlineFromBudget =
    Date.now() + params.strictPhaseSeconds * 1000;
  const strictDeadline = params.strictOnly
    ? totalDeadline
    : totalDeadline === null
      ? strictDeadlineFromBudget
      : Math.min(strictDeadlineFromBudget, totalDeadline);
  type Phase = {
    label: "strict" | "fallback";
    filters: { from?: string; to?: string; replyToSentEmailId?: string };
    deadline: number | null;
  };
  const phases: Phase[] = [
    {
      label: "strict",
      filters: { replyToSentEmailId: params.sentId },
      deadline: strictDeadline,
    },
  ];
  if (!params.strictOnly) {
    phases.push({
      label: "fallback",
      filters: { from: params.recipient, to: params.from },
      deadline: totalDeadline,
    });
  }

  // If the server is older than the reply_to_sent_email_id rollout it
  // silently drops the unknown query param (Zod .strip() on the search
  // schema), so a strict-phase search will return any inbound from the
  // recipient. We detect that here by verifying the candidate's FK
  // post-fetch; if it doesn't match we abort strict phase early and let
  // the fallback handle it (or time out under --strict-only).
  let strictFilterUnsupported = false;

  for (const phase of phases) {
    if (phase.label === "strict" && strictFilterUnsupported) continue;
    // Per-phase seenIds: when the strict phase silently drops the
    // filter (old server), the actual reply may surface in both
    // phases' result sets. A shared Set would let strict's rejection
    // poison fallback's view of the same row.
    const seenIds = new Set<string>();
    let cursor: string | null = null;
    while (true) {
      if (phase.deadline !== null && Date.now() >= phase.deadline) break;
      const page = await fetchEmailSearchPage({
        apiClient: params.apiClient,
        cursor,
        filters: phase.filters,
        pageSize: params.pageSize,
        since: params.sentAtIso,
      });

      if (!page.ok) {
        const payload = extractErrorPayload(page.error);
        writeErrorWithHints(payload);
        surfaceUnauthorizedHint({
          ...params.authFailureContext,
          payload,
        });
        throw new Errors.CLIError("Failed to poll for reply.", { exit: 1 });
      }

      // Advance cursor only to the last accepted/completed row in the
      // page. If we instead used page.cursor we would skip past
      // pending/processing rows that we deliberately ignored in
      // collectNewAcceptedEmails; when those later flip to accepted,
      // our next poll would start past them and never see them.
      let lastAccepted: (typeof page.rows)[number] | undefined;
      for (let i = page.rows.length - 1; i >= 0; i--) {
        const row = page.rows[i];
        if (row.status === "accepted" || row.status === "completed") {
          lastAccepted = row;
          break;
        }
      }
      if (lastAccepted) {
        cursor = encodeReceivedAtSearchCursor(lastAccepted);
      }

      const matches = collectNewAcceptedEmails(page.rows, seenIds);
      for (const match of matches) {
        const full = await getEmail({
          client: params.apiClient.client,
          path: { id: match.id },
          responseStyle: "fields",
        });
        if (full.error) {
          const payload = extractErrorPayload(full.error);
          writeErrorWithHints(payload);
          surfaceUnauthorizedHint({
            ...params.authFailureContext,
            payload,
          });
          throw new Errors.CLIError(
            `Reply landed but fetching the full body failed (id=${match.id}).`,
            { exit: 1 },
          );
        }
        const envelope = full.data as
          | { data?: EmailDetail }
          | GetEmailResponse
          | undefined;
        const detail =
          (envelope as { data?: EmailDetail } | undefined)?.data ??
          (envelope as EmailDetail | undefined) ??
          null;
        if (!detail) {
          throw new Errors.CLIError(
            `Reply landed but the email body could not be loaded (id=${match.id}).`,
            { exit: 1 },
          );
        }
        if (
          phase.label === "strict" &&
          detail.reply_to_sent_email_id !== params.sentId
        ) {
          // Server returned a candidate that doesn't actually thread
          // back to our send. The most likely cause is the server
          // hasn't shipped reply_to_sent_email_id filtering yet and
          // silently dropped the param. Skip this candidate, mark
          // strict phase unsupported, and let fallback handle it (or
          // give up immediately when --strict-only is set, in which
          // case we say so plainly).
          if (!strictFilterUnsupported) {
            notice(
              params.strictOnly
                ? "Strict-phase reply matching is not supported by this Primitive API host; --strict-only requires server support so the command will exit without a match."
                : "Strict-phase reply matching is not supported by this Primitive API host; falling back to time-window matching.",
            );
          }
          strictFilterUnsupported = true;
          continue;
        }
        return { reply: detail, matchStrategy: phase.label };
      }

      if (strictFilterUnsupported && phase.label === "strict") break;
      // Skip the sleep only when the cursor actually advanced, i.e.
      // there are more accepted/completed rows to page through. If a
      // page is full of pending/processing rows, lastAccepted is
      // undefined and the cursor didn't move; fetching again
      // immediately would return the same page and spin until those
      // rows transition state.
      if (lastAccepted !== undefined) continue;
      if (phase.deadline !== null && Date.now() >= phase.deadline) break;
      if (totalDeadline !== null && Date.now() >= totalDeadline) return null;
      await sleep(params.interval * 1000);
    }
  }

  return null;
}

export default ChatCommand;
