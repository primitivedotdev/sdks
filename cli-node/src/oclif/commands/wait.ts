import { Command, Flags } from "@oclif/core";
import type {
  EmailDetail,
  PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import { getEmail, listEmails } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  extractErrorCode,
  extractErrorPayload,
  surfaceUnauthorizedHint,
  writeErrorWithHints,
} from "../api-command.js";
import { buildEmailCompact } from "../email-compact.js";
import { presenceDisposition } from "../presence-provenance.js";
import {
  extractVerificationCode,
  extractVerificationLink,
} from "../verification-extract.js";
import { sleep } from "./emails-poll.js";
import {
  baselineCursor,
  InboxNextApiError,
  sanitizeForTerminal,
} from "./inbox-next.js";

// `primitive wait` is the "sign up with your address, then read the code"
// verb: block until the next email to this identity arrives, optionally
// narrowed by sender, subject or thread, and print it, or only its code or
// sign-in link.
//
// It reads the inbound forward tail (`GET /emails?since=&wait=`), the same
// long-poll `inbox next --wait` and `agent check-mail` use, so it works under
// a connected agent profile (whose reads are scoped to its own address) and
// under a member login alike. The starting position is the newest email's,
// read before the wait begins, so nothing that lands after the command
// starts is missed.

/** Exit codes. 2 is oclif's invalid-flags exit. */
export const WAIT_EXIT_CODES = {
  found: 0,
  error: 1,
  timeout: 5,
  notFound: 6,
} as const;

export const DEFAULT_WAIT_TIMEOUT = "5m";
const MAX_LONG_POLL_SECONDS = 30;
const TAIL_PAGE_SIZE = 100;
const EXISTING_PAGE_SIZE = 50;
const PRINTED_BODY_CHARS = 1200;
const JSON_TEXT_CHARS = 4000;

/**
 * Seconds from "90", "90s", "5m", "1h" or "1m30s". 0 waits forever. Throws
 * on anything else.
 */
export function parseWaitDuration(value: string): number {
  const text = value.trim().toLowerCase();
  if (/^\d+$/.test(text)) return Number(text);
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(text);
  if (!match || text === "")
    throw new Error(
      `--timeout must be a duration such as 90s, 5m, 1h or plain seconds; got "${value}".`,
    );
  const [, h, m, s] = match;
  return Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0);
}

export type WaitFilters = {
  from?: string;
  subject?: string;
  thread?: string;
  replyTo?: string;
};

/**
 * Whether any of an email's sender addresses matches `--from`. A value with
 * an @ matches that address exactly; a bare domain ("github.com" or
 * "@github.com") matches any address at it or at its subdomains.
 */
export function senderMatches(
  filter: string,
  addresses: Array<string | null | undefined>,
): boolean {
  const wanted = filter.trim().toLowerCase();
  const domainOnly = wanted.startsWith("@") || !wanted.includes("@");
  const domain = wanted.replace(/^@/, "");
  return addresses.some((raw) => {
    const address = raw?.trim().toLowerCase();
    if (!address) return false;
    if (!domainOnly) return address === wanted;
    const at = address.lastIndexOf("@");
    const own = at >= 0 ? address.slice(at + 1) : "";
    return own === domain || own.endsWith(`.${domain}`);
  });
}

type Row = Record<string, unknown>;

function str(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function subjectMatches(filter: string, subject: unknown): boolean {
  return (str(subject) ?? "").toLowerCase().includes(filter.toLowerCase());
}

/** Cheap checks on a list row, before its detail is read. */
export function rowMayMatch(row: Row, filters: WaitFilters): boolean {
  if (row.status !== "accepted" && row.status !== "completed") return false;
  // Presence probes are handled by the CLI, never handed to the agent.
  if (presenceDisposition(row) !== "ordinary") return false;
  if (filters.subject && !subjectMatches(filters.subject, row.subject))
    return false;
  if (filters.thread && str(row.thread_id) !== filters.thread) return false;
  // --from is decided on the detail: the row carries only the envelope
  // sender, which is often a bounce address at another domain.
  return true;
}

export function detailMatches(
  detail: EmailDetail,
  filters: WaitFilters,
): boolean {
  if (
    filters.from &&
    !senderMatches(filters.from, [detail.from_email, detail.sender])
  )
    return false;
  if (filters.subject && !subjectMatches(filters.subject, detail.subject))
    return false;
  if (filters.thread && (detail.thread_id ?? null) !== filters.thread)
    return false;
  if (
    filters.replyTo &&
    (detail.reply_to_sent_email_id ?? "").toLowerCase() !==
      filters.replyTo.toLowerCase()
  )
    return false;
  return true;
}

export type WaitJson = {
  id: string;
  thread_id: string | null;
  from: string;
  to: string;
  subject: string | null;
  received_at: string;
  text: string;
  text_truncated: boolean;
  code?: string | null;
  link?: string | null;
};

function truncate(text: string, max: number): { text: string; cut: boolean } {
  return text.length <= max
    ? { text, cut: false }
    : { text: `${text.slice(0, max).trimEnd()}...`, cut: true };
}

export function waitJson(
  detail: EmailDetail,
  options: { code?: boolean; link?: boolean },
): WaitJson {
  const compact = buildEmailCompact(detail);
  const body = truncate(compact.body_text, JSON_TEXT_CHARS);
  const extractInput = {
    subject: detail.subject,
    text: detail.body_text,
    html: detail.body_html,
  };
  return {
    id: detail.id,
    thread_id: compact.thread_id,
    from: compact.from,
    to: compact.to,
    subject: compact.subject,
    received_at: compact.received_at,
    text: body.text,
    text_truncated: body.cut,
    ...(options.code ? { code: extractVerificationCode(extractInput) } : {}),
    ...(options.link ? { link: extractVerificationLink(extractInput) } : {}),
  };
}

export function formatWaitEmail(email: WaitJson, bin: string): string {
  const body = truncate(email.text, PRINTED_BODY_CHARS);
  const lines = [
    `From: ${email.from}`,
    `Subject: ${email.subject ?? "(no subject)"}`,
    `Received: ${email.received_at}`,
    `ID: ${email.id}`,
    "",
    body.text || "(no text)",
  ];
  if (body.cut || email.text_truncated)
    lines.push("", `Full email: ${bin} emails get --id ${email.id}`);
  lines.push("", `Reply: ${bin} reply --id ${email.id} --body "..."`);
  return sanitizeForTerminal(lines.join("\n"));
}

type ListResult = { rows: Row[]; cursor: string | null };

async function listRows(
  apiClient: PrimitiveApiClient,
  query: { limit: number; since?: string; wait?: number },
): Promise<ListResult> {
  const result = await listEmails({
    client: apiClient.client,
    query,
    responseStyle: "fields",
  });
  if (result.error)
    throw new InboxNextApiError(
      "GET /emails",
      extractErrorPayload(result.error),
    );
  const envelope = result.data as
    | { data?: unknown[]; meta?: { cursor?: string | null } }
    | undefined;
  return {
    rows: (envelope?.data ?? []).filter(
      (row): row is Row => row !== null && typeof row === "object",
    ),
    cursor: envelope?.meta?.cursor ?? null,
  };
}

async function readDetail(
  apiClient: PrimitiveApiClient,
  id: string,
): Promise<EmailDetail | null> {
  const result = await getEmail({
    client: apiClient.client,
    path: { id },
    responseStyle: "fields",
  });
  if (result.error) {
    const payload = extractErrorPayload(result.error);
    // Deleted between the list and this read: not a match.
    if (extractErrorCode(payload) === "not_found") return null;
    throw new InboxNextApiError(`GET /emails/${id}`, payload);
  }
  const detail = (result.data as { data?: unknown } | undefined)?.data;
  return detail !== null && typeof detail === "object"
    ? (detail as EmailDetail)
    : null;
}

async function firstMatch(
  apiClient: PrimitiveApiClient,
  rows: Row[],
  filters: WaitFilters,
  seen: Set<string>,
): Promise<EmailDetail | null> {
  for (const row of rows) {
    const id = str(row.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (!rowMayMatch(row, filters)) continue;
    const detail = await readDetail(apiClient, id);
    if (detail && detailMatches(detail, filters)) return detail;
  }
  return null;
}

function arrivedSince(row: Row, threshold: number): boolean {
  const at = Date.parse(str(row.created_at) ?? str(row.received_at) ?? "");
  return Number.isFinite(at) && at >= threshold;
}

/**
 * Block until an email matching `filters` arrives (or, with
 * `includeExisting`, is among the newest already received). Returns null at
 * the deadline.
 */
export async function waitForEmail(params: {
  apiClient: PrimitiveApiClient;
  filters: WaitFilters;
  includeExisting: boolean;
  deadline: number | null;
  /** When the command started (client clock), before authentication. */
  startedAt: number;
}): Promise<EmailDetail | null> {
  const { apiClient, filters, deadline } = params;
  const seen = new Set<string>();
  // Taken before the recent page is read, so mail that lands during that
  // read is returned by the tail.
  let since = await baselineCursor({ apiClient });
  // Mail that arrived between the command starting and the baseline (during
  // authentication, say) sits at or before the baseline. Check it from the
  // newest page, oldest first, before tailing past it. The boundary is the
  // start time itself, with no allowance before it, so a retried login does
  // not pick up the previous attempt's email.
  const recent = await listRows(apiClient, { limit: EXISTING_PAGE_SIZE });
  const sinceStart = recent.rows
    .filter((row) => arrivedSince(row, params.startedAt))
    .reverse();
  const early = await firstMatch(apiClient, sinceStart, filters, seen);
  if (early) return early;
  if (params.includeExisting) {
    const found = await firstMatch(apiClient, recent.rows, filters, seen);
    if (found) return found;
  }
  for (;;) {
    const remainingMs =
      deadline === null ? MAX_LONG_POLL_SECONDS * 1000 : deadline - Date.now();
    if (remainingMs <= 0) return null;
    const startedAt = Date.now();
    const page = await listRows(apiClient, {
      limit: TAIL_PAGE_SIZE,
      since,
      wait: Math.max(
        0,
        Math.min(MAX_LONG_POLL_SECONDS, Math.floor(remainingMs / 1000)),
      ),
    });
    const found = await firstMatch(apiClient, page.rows, filters, seen);
    if (found) return found;
    if (page.rows.length > 0 && page.cursor) {
      since = page.cursor;
      continue;
    }
    // A long-poll that returns at once with nothing (a server or proxy that
    // does not hold the request) must not become a hot loop.
    if (Date.now() - startedAt < 1000)
      await sleep(Math.max(0, Math.min(1000, remainingMs)));
  }
}

function describeFilters(filters: WaitFilters): string {
  const parts = [
    filters.from ? `from ${filters.from}` : null,
    filters.subject ? `with subject containing "${filters.subject}"` : null,
    filters.thread ? `in thread ${filters.thread}` : null,
    filters.replyTo ? `replying to ${filters.replyTo}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

export default class WaitCommand extends Command {
  static summary =
    "Wait for the next email to you and print it, its code or its link";

  static description =
    `Wait for the next email to this identity and print it. Made for sign-ups and logins: use your address with a service, then let this command pick the code or link out of the email it sends.

Only mail that arrives after the command starts matches, unless --include-existing also lets one of the newest 50 emails match. The identity is the one the CLI resolves: a connected agent profile receives only its own address's mail; a member login receives any inbound mail in the organization.

--from takes an address (exact match) or a bare domain: github.com matches any sender at github.com or its subdomains. It is checked against the From address and the envelope sender, which the sender controls; it narrows the wait, it does not prove who sent the mail.

--code prints only the verification or one-time code, with spaces or dashes between its groups removed. --link prints only the most likely verification, sign-in, confirm, magic or reset link, with an obvious click-tracking wrapper removed. Without either, the email is printed: sender, subject, time, its ID and the start of its text, ready for \`primitive reply --id <id>\`. --json prints one object with id, thread_id, from, to, subject, received_at, text and, when asked, code and link (null when none was found).

Exit codes:
  - 0: a matching email arrived and was printed.
  - 1: error (API failure or authentication).
  - 2: invalid flags or arguments.
  - 5: no matching email arrived before --timeout.
  - 6: the email arrived but had no code (--code) or link (--link); its ID is printed on stderr.`;

  static examples = [
    {
      description: "Sign up with your address, then read the code",
      command: "<%= config.bin %> wait --from github.com --code",
    },
    {
      description: "Click through a magic sign-in link",
      command: "<%= config.bin %> wait --from vercel.com --link",
    },
    {
      description: "Wait up to 90 seconds for a specific subject",
      command:
        '<%= config.bin %> wait --subject "verify your email" --timeout 90s',
    },
    {
      description: "Machine-readable, code included",
      command: "<%= config.bin %> wait --from stripe.com --code --json",
    },
    {
      description: "The code already arrived before you started waiting",
      command:
        "<%= config.bin %> wait --from slack.com --code --include-existing",
    },
  ];

  static flags = {
    "api-key": Flags.string({
      description:
        "Primitive API key override (defaults to PRIMITIVE_API_KEY or saved OAuth login credentials)",
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
        "Sender address, or a domain matching any sender at it or its subdomains (github.com)",
    }),
    subject: Flags.string({
      description:
        "Only match emails whose subject contains this text (case-insensitive)",
    }),
    thread: Flags.string({
      description: "Only match emails in this thread ID",
    }),
    "reply-to": Flags.string({
      description: "Only match replies to this sent email ID",
    }),
    timeout: Flags.string({
      default: DEFAULT_WAIT_TIMEOUT,
      description:
        "How long to wait: 90s, 5m, 1h or plain seconds; 0 waits forever",
    }),
    code: Flags.boolean({
      description: "Print only the verification or one-time code",
    }),
    link: Flags.boolean({
      description: "Print only the verification or sign-in link",
    }),
    json: Flags.boolean({
      description: "Print one JSON object for the email",
    }),
    "include-existing": Flags.boolean({
      description: "Also match the newest 50 emails already received",
    }),
  };

  async run(): Promise<void> {
    const startedAt = Date.now();
    const { flags } = await this.parse(WaitCommand);
    let timeoutSeconds: number;
    try {
      timeoutSeconds = parseWaitDuration(flags.timeout);
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error), {
        exit: 2,
      });
    }
    const filters: WaitFilters = {
      from: flags.from?.trim() || undefined,
      subject: flags.subject?.trim() || undefined,
      thread: flags.thread?.trim() || undefined,
      replyTo: flags["reply-to"]?.trim() || undefined,
    };

    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });

    const deadline =
      timeoutSeconds === 0 ? null : Date.now() + timeoutSeconds * 1000;
    if (process.stderr.isTTY) {
      const to = auth.connectedAgent?.agentAddress;
      process.stderr.write(
        `Waiting${timeoutSeconds === 0 ? "" : ` up to ${flags.timeout}`} for mail${to ? ` to ${to}` : ""}${describeFilters(filters)}...\n`,
      );
    }

    let detail: EmailDetail | null;
    try {
      detail = await waitForEmail({
        apiClient,
        filters,
        includeExisting: flags["include-existing"],
        deadline,
        startedAt,
      });
    } catch (error) {
      if (!(error instanceof InboxNextApiError)) throw error;
      writeErrorWithHints(error.payload);
      surfaceUnauthorizedHint({
        auth,
        baseUrlOverridden,
        configDir: this.config.configDir,
        payload: error.payload,
      });
      process.exitCode = WAIT_EXIT_CODES.error;
      return;
    }

    if (!detail) {
      process.stderr.write(
        `Timed out after ${flags.timeout} with no matching email${describeFilters(filters)}.\n`,
      );
      process.exitCode = WAIT_EXIT_CODES.timeout;
      return;
    }

    const email = waitJson(detail, { code: flags.code, link: flags.link });
    const missing = [
      flags.code && !email.code ? "code" : null,
      flags.link && !email.link ? "link" : null,
    ].filter((item): item is string => item !== null);

    if (flags.json) this.log(JSON.stringify(email));
    else if (flags.code || flags.link) {
      if (flags.code && email.code) this.log(email.code);
      if (flags.link && email.link) this.log(sanitizeForTerminal(email.link));
    } else this.log(formatWaitEmail(email, this.config.bin));

    if (missing.length > 0) {
      process.stderr.write(
        `No verification ${missing.join(" or ")} found in email ${email.id}; read it with: ${this.config.bin} emails get --id ${email.id}\n`,
      );
      process.exitCode = WAIT_EXIT_CODES.notFound;
    }
  }
}
