import { Command, Flags } from "@oclif/core";
import type {
  Conversation,
  ConversationMessage,
  PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import {
  getConversation,
  getEmail,
  listEmails,
} from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorCode,
  extractErrorPayload,
  surfaceUnauthorizedHint,
  writeErrorWithHints,
} from "../api-command.js";
import {
  AUTOMATED_REASON_DESCRIPTIONS,
  type AutomatedMailInput,
  type AutomatedVerdict,
  type AutomationHeaders,
  classifyAutomatedMail,
} from "../automated-mail.js";
import {
  assertReplyState,
  awaitingRejectedError,
  hasReplyState,
  isAwaitingRejectedError,
  REPLY_STATE_UNSUPPORTED_CODE,
  type ReplyStateFields,
  ReplyStateUnsupportedError,
} from "../reply-state.js";

// `primitive inbox next` is the agent-loop verb: hand me the one email
// that is waiting on my reply, with its whole conversation, and tell me
// the command that answers it. The loop is
//
//   inbox next  ->  reply --id <id>  ->  inbox next  ->  ...
//
// It reads server-side reply state (`awaiting`), not a local cursor.
// An email stays "awaiting you" until a reply to its thread is sent or
// queued, so mail that arrives while the agent is composing is still
// there on the next call, and a reply that fails or is canceled puts
// the email back. Nothing is claimed or locked: this is not a work
// queue (see the help text).

/** Exit codes. 2 is oclif's invalid-flags exit and is never used here. */
export const INBOX_NEXT_EXIT_CODES = {
  email: 0,
  error: 1,
  empty: 5,
} as const;

export const INBOX_NEXT_EXIT_CODE_HELP = `Exit codes:
  - 0: an email awaits your reply; it is printed.
  - 1: error (API failure, auth, or a server without reply state). Nothing is printed as the next email.
  - 2: invalid flags or arguments.
  - 5: nothing awaits your reply (with --wait: still nothing when --timeout elapsed).`;

export const INBOX_NEXT_JSON_VERSION = 1;

const SCAN_PAGE_SIZE = 100;
const DEFAULT_WAIT_TIMEOUT_SECONDS = 300;
const MAX_LONG_POLL_SECONDS = 30;

// The forward tail (`GET /emails?since=`) returns rows strictly after
// this cursor, oldest first, so starting at the epoch walks awaiting
// mail from the oldest. The id only has to be a well-formed UUID.
export const EPOCH_CURSOR =
  "1970-01-01T00:00:00.000000Z|00000000-0000-4000-8000-000000000000";

type LooseRecord = Record<string, unknown>;

export type InboxNextEmail = {
  id: string;
  thread_id: string | null;
  message_id: string | null;
  received_at: string | null;
  from: string | null;
  from_email: string | null;
  to: string | null;
  subject: string | null;
  awaiting: ReplyStateFields["awaiting"];
  reply_count: number;
  last_replied_at: string | null;
  body_text: string | null;
};

export type InboxNextSkipped = {
  id: string;
  reasons: AutomatedVerdict["reasons"];
};

export type InboxNextResult =
  | {
      outcome: "email";
      email: InboxNextEmail;
      automated: AutomatedVerdict;
      conversation: Conversation;
      skipped_automated: InboxNextSkipped[];
    }
  | { outcome: "empty"; skipped_automated: InboxNextSkipped[] };

export type InboxNextJson = {
  version: number;
  outcome: "email" | "empty" | "error";
  email: InboxNextEmail | null;
  automated: AutomatedVerdict | null;
  conversation: Conversation | null;
  reply_command: string | null;
  skipped_automated: InboxNextSkipped[];
  error?: { code: string; message: string };
};

/** An API call failed; carries the error payload for printing. */
export class InboxNextApiError extends Error {
  constructor(
    readonly surface: string,
    readonly payload: unknown,
  ) {
    super(`${surface} failed`);
    this.name = "InboxNextApiError";
  }
}

function str(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

// to_addresses / smtp_rcpt_to come back as strings, arrays of strings,
// or arrays of { address } objects depending on the surface.
function addressStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(addressStrings);
  if (value !== null && typeof value === "object") {
    const address = (value as { address?: unknown }).address;
    return typeof address === "string" ? [address] : [];
  }
  return [];
}

/** Build the automated-mail input from a list row or an email detail. */
export function automatedInputFromEmail(row: LooseRecord): AutomatedMailInput {
  const headers = row.automation_headers;
  return {
    envelopeSender: str(row.smtp_mail_from) ?? str(row.sender),
    fromHeaders: [str(row.from_header), str(row.from_email)],
    inboundAddresses: [
      str(row.recipient),
      str(row.to_email),
      ...addressStrings(row.to_addresses),
      ...addressStrings(row.smtp_rcpt_to),
    ],
    automationHeaders:
      headers !== null && typeof headers === "object"
        ? (headers as AutomationHeaders)
        : null,
    daemonScope: "any",
  };
}

export function classifyEmail(row: LooseRecord): AutomatedVerdict {
  return classifyAutomatedMail(automatedInputFromEmail(row));
}

export function toInboxNextEmail(
  detail: LooseRecord & ReplyStateFields,
): InboxNextEmail {
  return {
    id: String(detail.id),
    thread_id: str(detail.thread_id),
    message_id: str(detail.message_id),
    received_at: str(detail.received_at),
    from: str(detail.from_header) ?? str(detail.from_email),
    from_email: str(detail.from_email),
    to: str(detail.recipient) ?? str(detail.to_email),
    subject: typeof detail.subject === "string" ? detail.subject : null,
    awaiting: detail.awaiting,
    reply_count: detail.reply_count,
    last_replied_at: detail.last_replied_at,
    body_text: typeof detail.body_text === "string" ? detail.body_text : null,
  };
}

export function replyCommand(bin: string, id: string): string {
  return `${bin} reply --id ${id}`;
}

export type InboxNextApi = {
  getConversation: typeof getConversation;
  getEmail: typeof getEmail;
  listEmails: typeof listEmails;
};

const DEFAULT_API: InboxNextApi = { getConversation, getEmail, listEmails };

type ListPage = { rows: LooseRecord[]; cursor: string | null };

async function listPage(
  api: InboxNextApi,
  apiClient: PrimitiveApiClient,
  query: {
    awaiting?: "you";
    limit: number;
    since?: string;
    wait?: number;
  },
): Promise<ListPage> {
  const result = await api.listEmails({
    client: apiClient.client,
    query,
    responseStyle: "fields",
  });
  if (result.error) {
    const payload = extractErrorPayload(result.error);
    if (query.awaiting && isAwaitingRejectedError(payload)) {
      throw awaitingRejectedError("GET /emails");
    }
    throw new InboxNextApiError("GET /emails", payload);
  }
  const envelope = result.data as
    | { data?: unknown[]; meta?: { cursor?: string | null } }
    | undefined;
  const rows = (envelope?.data ?? []).filter(
    (row): row is LooseRecord => row !== null && typeof row === "object",
  );
  return { rows, cursor: envelope?.meta?.cursor ?? null };
}

/**
 * Find the oldest inbound email awaiting your reply. Walks the
 * `awaiting=you` forward tail from the oldest row, skipping automated
 * mail unless `includeAutomated`, and re-reads the chosen email so a
 * reply sent a moment ago (by this or another agent) is honoured.
 */
export async function findNextAwaiting(params: {
  apiClient: PrimitiveApiClient;
  includeAutomated: boolean;
  api?: InboxNextApi;
}): Promise<InboxNextResult> {
  const api = params.api ?? DEFAULT_API;
  const skipped: InboxNextSkipped[] = [];
  let since = EPOCH_CURSOR;

  for (;;) {
    const page = await listPage(api, params.apiClient, {
      awaiting: "you",
      limit: SCAN_PAGE_SIZE,
      since,
    });
    // An older server that ignored the filter would hand back every
    // email without reply state. Never read that as "awaiting you".
    assertReplyState(page.rows, "GET /emails");

    for (const row of page.rows) {
      if (row.awaiting !== "you" || row.status === "rejected") continue;
      const id = str(row.id);
      if (!id) continue;

      const listVerdict = classifyEmail(row);
      if (listVerdict.automated && !params.includeAutomated) {
        skipped.push({ id, reasons: listVerdict.reasons });
        continue;
      }

      const detailResult = await api.getEmail({
        client: params.apiClient.client,
        path: { id },
        responseStyle: "fields",
      });
      if (detailResult.error) {
        const payload = extractErrorPayload(detailResult.error);
        // Deleted between the list and this read: move on.
        if (extractErrorCode(payload) === "not_found") continue;
        throw new InboxNextApiError(`GET /emails/${id}`, payload);
      }
      const detail = (detailResult.data as { data?: unknown } | undefined)
        ?.data;
      if (detail === null || typeof detail !== "object") {
        throw new InboxNextApiError(`GET /emails/${id}`, {
          code: "empty_response",
          message: `GET /emails/${id} returned no email.`,
        });
      }
      if (!hasReplyState(detail)) {
        throw new ReplyStateUnsupportedError(
          `GET /emails/${id} returned the email without the \`awaiting\` and \`reply_count\` fields.`,
        );
      }
      // Answered since the list was read.
      if (detail.awaiting !== "you") continue;

      const verdict = classifyEmail(detail as LooseRecord);
      if (verdict.automated && !params.includeAutomated) {
        skipped.push({ id, reasons: verdict.reasons });
        continue;
      }

      const conversationResult = await api.getConversation({
        client: params.apiClient.client,
        path: { id },
        responseStyle: "fields",
      });
      if (conversationResult.error) {
        throw new InboxNextApiError(
          `GET /emails/${id}/conversation`,
          extractErrorPayload(conversationResult.error),
        );
      }
      const conversation = (
        conversationResult.data as { data?: Conversation } | undefined
      )?.data;
      if (!conversation) {
        throw new InboxNextApiError(`GET /emails/${id}/conversation`, {
          code: "empty_response",
          message: "The conversation response carried no data.",
        });
      }

      return {
        outcome: "email",
        email: toInboxNextEmail(detail as LooseRecord & ReplyStateFields),
        automated: verdict,
        conversation,
        skipped_automated: skipped,
      };
    }

    // The forward tail signals "caught up" with an empty page (and a
    // null cursor); a short page is not final, so keep following it.
    if (page.rows.length === 0 || !page.cursor || page.cursor === since) {
      return { outcome: "empty", skipped_automated: skipped };
    }
    since = page.cursor;
  }
}

/**
 * The wake-up cursor for --wait: the newest email's position, read
 * BEFORE the first state check. Anything that becomes visible after it
 * is returned by the long-poll, so there is no gap between "checked,
 * nothing awaits" and "started waiting". Built from the newest row the
 * way the API documents bootstrapping `since`; no client clock involved.
 */
export async function baselineCursor(params: {
  apiClient: PrimitiveApiClient;
  api?: InboxNextApi;
}): Promise<string> {
  const api = params.api ?? DEFAULT_API;
  const page = await listPage(api, params.apiClient, { limit: 1 });
  const newest = page.rows[0];
  const createdAt = str(newest?.created_at);
  const id = str(newest?.id);
  return createdAt && id ? `${createdAt}|${id}` : EPOCH_CURSOR;
}

/**
 * Hold one long-poll on the forward tail. Returns the advanced cursor
 * (unchanged when nothing arrived before the hold ended).
 */
export async function waitForActivity(params: {
  apiClient: PrimitiveApiClient;
  since: string;
  seconds: number;
  api?: InboxNextApi;
}): Promise<string> {
  const api = params.api ?? DEFAULT_API;
  const page = await listPage(api, params.apiClient, {
    limit: SCAN_PAGE_SIZE,
    since: params.since,
    wait: Math.max(0, Math.min(MAX_LONG_POLL_SECONDS, params.seconds)),
  });
  return page.cursor ?? params.since;
}

export function toJson(result: InboxNextResult, bin: string): InboxNextJson {
  if (result.outcome === "empty") {
    return {
      version: INBOX_NEXT_JSON_VERSION,
      outcome: "empty",
      email: null,
      automated: null,
      conversation: null,
      reply_command: null,
      skipped_automated: result.skipped_automated,
    };
  }
  return {
    version: INBOX_NEXT_JSON_VERSION,
    outcome: "email",
    email: result.email,
    automated: result.automated,
    conversation: result.conversation,
    reply_command: replyCommand(bin, result.email.id),
    skipped_automated: result.skipped_automated,
  };
}

export function errorJson(code: string, message: string): InboxNextJson {
  return {
    version: INBOX_NEXT_JSON_VERSION,
    outcome: "error",
    email: null,
    automated: null,
    conversation: null,
    reply_command: null,
    skipped_automated: [],
    error: { code, message },
  };
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "unknown time";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

function formatMessage(message: ConversationMessage, index: number): string {
  const who = message.role === "user" ? "them" : "you";
  const header = `--- [${index + 1}] ${message.role} (${who}) ${message.from ?? "unknown"} -> ${message.to ?? "unknown"}, ${formatTimestamp(message.timestamp)}`;
  const body = message.text.trim() === "" ? "(no text body)" : message.text;
  return `${header}\n${body.replace(/\s+$/, "")}`;
}

export function formatVerdict(verdict: AutomatedVerdict): string {
  if (!verdict.automated) {
    return verdict.automation_headers_known
      ? "no"
      : "no (no automation headers recorded for this email, so a newsletter or auto-reply from an ordinary address cannot be ruled out; judge from its content)";
  }
  return `yes: ${verdict.reasons
    .map((reason) => AUTOMATED_REASON_DESCRIPTIONS[reason])
    .join("; ")}`;
}

/** The readable transcript printed without --json. */
export function formatTranscript(
  result: Extract<InboxNextResult, { outcome: "email" }>,
  bin: string,
): string {
  const { email, conversation, automated } = result;
  const lines = [
    "Awaiting your reply:",
    `  id:        ${email.id}`,
    `  from:      ${email.from ?? "unknown"}`,
    `  to:        ${email.to ?? "unknown"}`,
    `  subject:   ${email.subject ?? "(no subject)"}`,
    `  received:  ${formatTimestamp(email.received_at)}`,
    `  replies:   ${email.reply_count} to this email${email.last_replied_at ? `, last ${formatTimestamp(email.last_replied_at)}` : ""}`,
    `  automated: ${formatVerdict(automated)}`,
    "",
    `Conversation (${conversation.messages.length} of ${conversation.message_count} message${conversation.message_count === 1 ? "" : "s"}, oldest first${conversation.truncated ? "; older messages omitted" : ""}):`,
    "",
    ...conversation.messages.map((message, index) =>
      formatMessage(message, index),
    ),
    "",
    "Reply with:",
    `  ${replyCommand(bin, email.id)} --body "..."`,
    `Then run \`${bin} inbox next\` again.`,
  ];
  return lines.join("\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class InboxNextCommand extends Command {
  static summary = "Show the oldest email awaiting your reply";

  static description =
    `Show the oldest inbound email that is waiting on your reply, with its conversation and the command that answers it. The conversation comes from the API, which caps long threads; \`truncated\` (and the transcript header) says when older messages were left out. Built for agent loops:

    primitive inbox next            # read the email and its conversation
    primitive reply --id <id> ...   # answer it
    primitive inbox next            # the next one (exit 5 when none are left)

  "Waiting on your reply" is the server's reply state (\`awaiting=you\`): the latest message in the email's thread is inbound. Sending or queueing a reply with \`primitive reply\` moves the thread to \`awaiting=them\`, so the next call moves on. A reply that fails or is canceled puts the email back. Because this reads server state rather than a local cursor, mail that arrived while you were composing is never skipped.

  Automated mail is skipped by default: bounces (null envelope sender), mailer-daemon and postmaster, mail from this inbox's own addresses, and mail whose headers declare it automated (Auto-Submitted, Precedence bulk/list/junk, List-Unsubscribe, List-Id). Pass --include-automated to get it anyway; the \`automated\` verdict and its reasons are always reported.

  NOT A WORK QUEUE. Nothing is claimed or locked. Two agents running \`inbox next\` on the same inbox get the same email until one of them replies, and both may answer it. Run one agent per inbox, or coordinate outside Primitive.

  --wait blocks until something awaits you. It takes the inbox's newest position before checking, then long-polls from that position, re-checking reply state whenever mail arrives and at least every 30 seconds, so nothing that arrives between the check and the wait is missed.

  --json prints one stable envelope (version ${INBOX_NEXT_JSON_VERSION}): \`outcome\` ("email" | "empty" | "error"), \`email\` (id, thread_id, message_id, received_at, from, from_email, to, subject, awaiting, reply_count, last_replied_at, body_text), \`automated\` ({ automated, reasons[], automation_headers_known }), \`conversation\` (thread_id, subject, message_count, truncated, messages[] with role user|assistant), \`reply_command\`, \`skipped_automated\` ([{ id, reasons[] }]), and \`error\` ({ code, message }) on failure.

  Requires a server that reports reply state. Against an older server it fails with code \`${REPLY_STATE_UNSUPPORTED_CODE}\` rather than guessing.

  ${INBOX_NEXT_EXIT_CODE_HELP}`;

  static examples = [
    "<%= config.bin %> inbox next",
    "<%= config.bin %> inbox next --json | jq -r '.email.id'",
    "<%= config.bin %> inbox next --wait --timeout 600",
    "<%= config.bin %> inbox next --include-automated --json",
  ];

  static flags = {
    "api-key": Flags.string({
      description:
        "Primitive API key override (defaults to PRIMITIVE_API_KEY or saved OAuth login credentials)",
      env: "PRIMITIVE_API_KEY",
    }),
    "api-base-url": Flags.string({
      description: API_BASE_URL_FLAG_DESCRIPTION,
      env: "PRIMITIVE_API_BASE_URL",
      hidden: true,
    }),
    json: Flags.boolean({
      description:
        "Print one stable JSON envelope on STDOUT (see the description for its fields).",
    }),
    wait: Flags.boolean({
      description:
        "Block until an email awaits your reply (or --timeout elapses, exit 5).",
    }),
    timeout: Flags.integer({
      default: DEFAULT_WAIT_TIMEOUT_SECONDS,
      description: `Only with --wait: seconds to wait before exiting 5 (default ${DEFAULT_WAIT_TIMEOUT_SECONDS}); 0 waits forever. Ignored without --wait.`,
      min: 0,
    }),
    "include-automated": Flags.boolean({
      description:
        "Do not skip automated mail (bounces, mailer-daemon, own addresses, Auto-Submitted, bulk and list mail).",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(InboxNextCommand);
    const bin = this.config.bin || "primitive";
    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });

    const fail = (code: string, message: string, payload?: unknown): void => {
      if (flags.json) {
        this.log(JSON.stringify(errorJson(code, message), null, 2));
      }
      if (payload !== undefined) {
        writeErrorWithHints(payload);
        surfaceUnauthorizedHint({
          auth,
          baseUrlOverridden,
          configDir: this.config.configDir,
          payload,
        });
      } else {
        process.stderr.write(`${message}\n`);
      }
      process.exitCode = INBOX_NEXT_EXIT_CODES.error;
    };

    const deadline =
      flags.wait && flags.timeout > 0
        ? Date.now() + flags.timeout * 1000
        : null;

    try {
      // Taken before the first check so the wait cannot miss mail that
      // lands between the check and the long-poll.
      let since = flags.wait ? await baselineCursor({ apiClient }) : null;
      let announcedWait = false;

      for (;;) {
        const result = await findNextAwaiting({
          apiClient,
          includeAutomated: flags["include-automated"],
        });

        if (result.outcome === "email" || !flags.wait || since === null) {
          this.printResult(result, bin, flags.json);
          return;
        }

        const remainingMs =
          deadline === null
            ? MAX_LONG_POLL_SECONDS * 1000
            : deadline - Date.now();
        if (remainingMs <= 0) {
          this.printResult(result, bin, flags.json);
          return;
        }
        if (!announcedWait && !flags.json) {
          process.stderr.write(
            deadline === null
              ? "Nothing awaits your reply yet; waiting for new mail.\n"
              : `Nothing awaits your reply yet; waiting up to ${Math.ceil(remainingMs / 1000)}s for new mail.\n`,
          );
          announcedWait = true;
        }
        const before = since;
        const pollStartedAt = Date.now();
        since = await waitForActivity({
          apiClient,
          since,
          seconds: Math.max(1, Math.ceil(remainingMs / 1000)),
        });
        // A long-poll that comes back at once with nothing new (a server
        // or proxy that does not hold the request) must not turn this
        // into a hot loop.
        if (since === before && Date.now() - pollStartedAt < 1000) {
          await sleep(1000);
        }
      }
    } catch (error) {
      if (error instanceof ReplyStateUnsupportedError) {
        fail(error.code, error.message);
        return;
      }
      if (error instanceof InboxNextApiError) {
        const code = extractErrorCode(error.payload) ?? "api_error";
        const message =
          (error.payload as { message?: unknown } | null)?.message ??
          `${error.surface} failed`;
        fail(code, String(message), error.payload);
        return;
      }
      throw error;
    }
  }

  private printResult(
    result: InboxNextResult,
    bin: string,
    json: boolean,
  ): void {
    if (json) {
      this.log(JSON.stringify(toJson(result, bin), null, 2));
    } else if (result.outcome === "email") {
      this.log(formatTranscript(result, bin));
    } else {
      const skipped = result.skipped_automated.length;
      process.stderr.write(
        `Nothing awaits your reply.${skipped > 0 ? ` Skipped ${skipped} automated email${skipped === 1 ? "" : "s"}; pass --include-automated to see ${skipped === 1 ? "it" : "them"}.` : ""}\n`,
      );
    }
    if (
      result.outcome === "email" &&
      result.skipped_automated.length > 0 &&
      !json
    ) {
      const skipped = result.skipped_automated.length;
      process.stderr.write(
        `(skipped ${skipped} older automated email${skipped === 1 ? "" : "s"}; pass --include-automated to include ${skipped === 1 ? "it" : "them"})\n`,
      );
    }
    process.exitCode =
      result.outcome === "email"
        ? INBOX_NEXT_EXIT_CODES.email
        : INBOX_NEXT_EXIT_CODES.empty;
  }
}

export default InboxNextCommand;
