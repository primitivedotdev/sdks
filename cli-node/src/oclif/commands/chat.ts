import { Args, Command, Errors, Flags } from "@oclif/core";
import type {
  EmailDetail,
  GetEmailResponse,
  SendMailResult,
} from "@primitivedotdev/api-core";
import { getEmail, sendEmail } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import { deriveSubject, pickDefaultFromAddress } from "../outbound-defaults.js";
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

const DEFAULT_CHAT_TIMEOUT_SECONDS = 120;
const DEFAULT_STRICT_PHASE_SECONDS = 60;

function cliError(message: string): Errors.CLIError {
  return new Errors.CLIError(message, { exit: 1 });
}

async function readStdinToString(): Promise<string> {
  if (process.stdin.isTTY) {
    throw cliError(
      "No message provided. Pass the message as the second positional argument or pipe it via stdin.",
    );
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

type ChatMatchStrategy = "strict" | "fallback";
type ChatResponseBodyFormat = "empty" | "html" | "text";

type ChatReplyResult = {
  matchStrategy: ChatMatchStrategy;
  reply: EmailDetail;
};

type ChatFollowUpCommand = {
  argv: string[];
  description: string;
  command: string;
};

type ChatResponseBody = {
  body: string;
  format: ChatResponseBodyFormat;
};

type ChatBaseContext = {
  from: string;
  recipient: string;
  sent: SendMailResult;
  sentAtIso: string;
  strictOnly: boolean;
  strictPhaseSeconds: number;
  subject: string;
  timeoutSeconds: number;
};

type ChatOutputContext = ChatBaseContext & {
  matchStrategy: ChatMatchStrategy;
  reply: EmailDetail;
};

type ChatProgressStream = {
  isTTY?: boolean;
  write(chunk: string): unknown;
};

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
    this.stream.write(`${message}\n`);
  }

  update(message: string): void {
    this.currentMessage = message;
    if (this.stream.isTTY) {
      this.stopTimer();
      this.clearLine();
      this.render(message);
      this.timer = setInterval(() => this.render(message), 120);
      this.timer.unref?.();
      return;
    }
    this.stream.write(`${message}\n`);
  }

  notice(message: string): void {
    if (this.stream.isTTY) {
      const currentMessage = this.currentMessage;
      this.clearLine();
      this.stream.write(`${message}\n`);
      if (currentMessage !== null && this.timer !== null) {
        this.render(currentMessage);
      }
      return;
    }
    this.stream.write(`${message}\n`);
  }

  succeed(message: string): void {
    this.finish(
      `${message} after ${formatElapsed(this.now() - this.startedAt)}.`,
    );
  }

  fail(message: string): void {
    this.finish(message);
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
    const line = `${frame} ${message} (${formatElapsed(this.now() - this.startedAt)})`;
    this.lastLineLength = Math.max(this.lastLineLength, line.length);
    this.stream.write(`\r${line}`);
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

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function commandFromArgv(argv: string[]): string {
  return argv.map(shellQuote).join(" ");
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

function buildCommand(
  description: string,
  argv: string[],
): ChatFollowUpCommand {
  return {
    argv,
    description,
    command: commandFromArgv(argv),
  };
}

export function buildChatFollowUpCommands(
  context: ChatOutputContext,
): ChatFollowUpCommand[] {
  const commands: ChatFollowUpCommand[] = [];
  const continueParts = [
    "primitive",
    "chat",
    context.recipient,
    "<message>",
    "--from",
    context.from,
    "--subject",
    context.subject,
    "--timeout",
    String(context.timeoutSeconds),
  ];
  if (context.reply.message_id) {
    continueParts.push("--in-reply-to", context.reply.message_id);
  }
  if (context.strictOnly) {
    continueParts.push("--strict-only");
  } else if (context.strictPhaseSeconds !== DEFAULT_STRICT_PHASE_SECONDS) {
    continueParts.push(
      "--strict-phase-seconds",
      String(context.strictPhaseSeconds),
    );
  }
  commands.push(buildCommand("Continue this chat", continueParts));
  commands.push(
    buildCommand("Reply directly to the inbound email", [
      "primitive",
      "reply",
      "--id",
      context.reply.id,
      "--from",
      context.from,
      "--body",
      "<message>",
    ]),
  );
  commands.push(
    buildCommand("Inspect the full inbound email", [
      "primitive",
      "emails",
      "get",
      "--id",
      context.reply.id,
    ]),
  );
  commands.push(
    buildCommand("Wait for another reply to this send", [
      "primitive",
      "emails",
      "wait",
      "--reply-to-sent-email-id",
      context.sent.id,
      "--timeout",
      String(context.timeoutSeconds),
      "--table",
    ]),
  );
  return commands;
}

export function buildChatRecoveryCommands(
  context: ChatBaseContext,
): ChatFollowUpCommand[] {
  return [
    buildCommand("Wait for the threaded reply again", [
      "primitive",
      "emails",
      "wait",
      "--reply-to-sent-email-id",
      context.sent.id,
      "--timeout",
      String(context.timeoutSeconds),
      "--table",
    ]),
    buildCommand("Fallback wait by sender/time window", [
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
      "--table",
    ]),
    buildCommand("Inspect the outbound send", [
      "primitive",
      "sent",
      "get",
      "--id",
      context.sent.id,
    ]),
  ];
}

export function buildChatJsonEnvelope(context: ChatOutputContext): {
  follow_up_commands: ChatFollowUpCommand[];
  match: {
    description: string;
    reply_to_sent_email_id: string | null;
    strategy: ChatMatchStrategy;
  };
  reply: EmailDetail;
  response_body: string;
  response_body_format: ChatResponseBodyFormat;
  sent: SendMailResult;
} {
  const responseBody = resolveChatResponseBody(context.reply);
  return {
    sent: context.sent,
    reply: context.reply,
    response_body: responseBody.body,
    response_body_format: responseBody.format,
    match: {
      description: matchDescription(context.matchStrategy),
      reply_to_sent_email_id: context.reply.reply_to_sent_email_id ?? null,
      strategy: context.matchStrategy,
    },
    follow_up_commands: buildChatFollowUpCommands(context),
  };
}

export function formatChatResponse(context: ChatOutputContext): string {
  const accepted = context.sent.accepted.join(", ") || context.recipient;
  const responseBody = resolveChatResponseBody(context.reply);
  const lines = [
    "Reply received",
    "",
    "Sent",
    `  To: ${accepted}`,
    `  From: ${context.sent.from || context.from}`,
    `  Subject: ${context.subject}`,
    `  Sent email id: ${context.sent.id}`,
    `  Delivery status: ${context.sent.delivery_status ?? context.sent.status}`,
    "",
    "Reply",
    `  Email id: ${context.reply.id}`,
    `  From: ${context.reply.from_email}`,
    `  To: ${context.reply.to_email}`,
    `  Subject: ${context.reply.subject ?? "(no subject)"}`,
    `  Received: ${context.reply.received_at}`,
    `  Match: ${matchDescription(context.matchStrategy)}`,
  ];
  if (context.reply.reply_to_sent_email_id) {
    lines.push(
      `  Reply to sent email id: ${context.reply.reply_to_sent_email_id}`,
    );
  }
  if (context.reply.message_id) {
    lines.push(`  Message-Id: ${context.reply.message_id}`);
  }
  lines.push("Helpful follow-up commands");
  for (const { description, command } of buildChatFollowUpCommands(context)) {
    lines.push(`  ${description}:`, `    ${command}`);
  }
  lines.push(
    "",
    `Response body (${responseBody.format})`,
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
    "Sent message context",
    `  To: ${accepted}`,
    `  From: ${context.sent.from || context.from}`,
    `  Subject: ${context.subject}`,
    `  Sent email id: ${context.sent.id}`,
    `  Delivery status: ${context.sent.delivery_status ?? context.sent.status}`,
    `  Poll since: ${context.sentAtIso}`,
    "",
    "Helpful recovery commands",
  ];
  for (const { description, command } of buildChatRecoveryCommands(context)) {
    lines.push(`  ${description}:`, `    ${command}`);
  }
  return lines.join("\n");
}

class ChatCommand extends Command {
  static description = `Send a message to an address and wait for the reply.

  This is the first-party verb for talking to agents that live behind
  email addresses. \`primitive send\` is transport (fire-and-forget);
  \`primitive chat\` is semantic (send + wait for the threaded reply).

  The message body can be given as the second positional argument or
  piped via stdin. The default output confirms the reply was received,
  prints exchange metadata, shows the response body, and lists helpful
  follow-up commands. --json emits a structured envelope with both
  sides of the exchange, a direct response_body field, the match
  strategy, and follow-up commands.

  Matching the reply: the wait phase polls inbound mail filtered by
  the recipient as sender and the send time as a lower bound. The
  first match is taken; the full inbound row is then fetched for the
  body. Progress is written to stderr while the CLI waits. Exits
  non-zero on timeout and prints recovery commands when the send
  succeeded but no reply was returned.`;

  static summary =
    "Chat with an agent over email (send and wait for the reply)";

  static examples = [
    "<%= config.bin %> chat help@agent.acme.dev 'how do I rotate my API key?'",
    "cat error.log | <%= config.bin %> chat help@agent.acme.dev --subject 'webhook 401s'",
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
    "api-base-url-1": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL_1",
      hidden: true,
    }),
    "api-base-url-2": Flags.string({
      description:
        "Override the attachments-supporting send host base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL_2",
      hidden: true,
    }),
    from: Flags.string({
      description:
        "Sender address. Defaults to agent@<your-first-verified-outbound-domain>.",
    }),
    subject: Flags.string({
      description:
        "Subject line. Defaults to the first line of the message when omitted.",
    }),
    "in-reply-to": Flags.string({
      description:
        "Message-Id of the parent email to thread this against. Use when continuing a prior conversation from outside the CLI; for an inbound you received via Primitive, prefer `primitive reply --id <inbound-id>`.",
    }),
    json: Flags.boolean({
      description:
        "Emit a structured JSON envelope { sent, reply, response_body, response_body_format, match, follow_up_commands } on stdout instead of the human-readable transcript.",
    }),
    quiet: Flags.boolean({
      description:
        "Suppress stderr progress updates while sending and waiting. Errors and recovery commands are still written to stderr.",
    }),
    timeout: Flags.integer({
      default: DEFAULT_CHAT_TIMEOUT_SECONDS,
      description:
        "Seconds to wait for a reply before exiting non-zero; 0 waits forever.",
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
        "Disable the time-window fallback. Only accept inbounds whose threading headers (In-Reply-To / References) resolve to this send. Recommended when correctness matters more than success rate (e.g. agents talking to agents).",
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

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChatCommand);

    const message =
      args.message !== undefined && args.message !== ""
        ? args.message
        : await readStdinToString();
    if (!message.trim()) {
      throw cliError("Message body is empty.");
    }

    await runWithTiming(flags.time, async () => {
      const { apiClient, auth, baseUrlOverridden } =
        await createAuthenticatedCliApiClient({
          apiKey: flags["api-key"],
          apiBaseUrl1: flags["api-base-url-1"],
          apiBaseUrl2: flags["api-base-url-2"],
          configDir: this.config.configDir,
        });

      const authFailureContext = {
        auth,
        baseUrlOverridden,
        configDir: this.config.configDir,
      };
      const from =
        flags.from ??
        (await pickDefaultFromAddress(apiClient, authFailureContext));
      const subject = flags.subject ?? deriveSubject(message);

      // Capture send time BEFORE issuing the send so the inbound
      // poll's `since` filter cannot miss a reply that races back
      // faster than we record the timestamp. A few ms of overlap
      // with our own outbound row is fine: the search is scoped to
      // inbound by endpoint (`/emails`), not outbound.
      const sentAtIso = new Date().toISOString();

      const progress = flags.quiet
        ? null
        : new ChatProgressIndicator(process.stderr);
      progress?.start(`Sending message to ${args.recipient}`);

      const sendResult = await sendEmail({
        body: {
          from,
          to: args.recipient,
          subject,
          body_text: message,
          ...(flags["in-reply-to"] !== undefined
            ? { in_reply_to: flags["in-reply-to"] }
            : {}),
        },
        client: apiClient._sendClient,
        responseStyle: "fields",
      });

      if (sendResult.error) {
        progress?.fail("Message send failed.");
        const errorPayload = extractErrorPayload(sendResult.error);
        writeErrorWithHints(errorPayload);
        surfaceUnauthorizedHint({
          ...authFailureContext,
          payload: errorPayload,
        });
        process.exitCode = 1;
        return;
      }

      const sentEnvelope = sendResult.data as
        | { data?: SendMailResult }
        | undefined;
      const sent = sentEnvelope?.data;
      if (!sent) {
        progress?.fail("Send succeeded but the API returned no data.");
        throw cliError("Send succeeded but the API returned no data.");
      }

      progress?.update(
        `Message sent; waiting for reply from ${args.recipient}`,
      );

      const baseContext: ChatBaseContext = {
        from,
        recipient: args.recipient,
        sent,
        sentAtIso,
        strictOnly: flags["strict-only"],
        strictPhaseSeconds: flags["strict-phase-seconds"],
        subject,
        timeoutSeconds: flags.timeout,
      };

      let replyResult: ChatReplyResult | null;
      try {
        replyResult = await waitForReply({
          apiClient,
          authFailureContext,
          from,
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
        process.stderr.write(`${formatChatRecoveryContext(baseContext)}\n`);
        throw error;
      }
      if (replyResult === null) {
        const timeoutMessage = `Timed out after ${flags.timeout}s waiting for a reply from ${args.recipient}.`;
        progress?.fail(timeoutMessage);
        if (progress === null) {
          process.stderr.write(`${timeoutMessage}\n`);
        }
        process.stderr.write(`${formatChatRecoveryContext(baseContext)}\n`);
        process.exitCode = 1;
        return;
      }

      progress?.succeed(`Reply received from ${replyResult.reply.from_email}`);

      const outputContext: ChatOutputContext = {
        ...baseContext,
        matchStrategy: replyResult.matchStrategy,
        reply: replyResult.reply,
      };

      if (flags.json) {
        this.log(JSON.stringify(buildChatJsonEnvelope(outputContext), null, 2));
      } else {
        this.log(formatChatResponse(outputContext));
      }
    });
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
