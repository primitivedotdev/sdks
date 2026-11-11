import type {
  EmailSearchResult,
  PrimitiveApiClient,
  SearchEmailsData,
  SearchEmailsResponse,
} from "@primitivedotdev/api-core";
import { searchEmails } from "@primitivedotdev/api-core";
import {
  AUTOMATED_VALUES,
  assertAutomatedVerdict,
  automatedRejectedError,
  ensureSearchReportsAutomated,
  expectedAutomatedVerdicts,
  isAutomatedRejectedError,
  queryUsesAutomated,
} from "../automated-filter.js";
import {
  type Awaiting,
  assertAwaitingFilterRows,
  awaitingRejectedError,
  ensureSearchReportsReplyState,
  isAwaitingRejectedError,
  queryUsesAwaiting,
} from "../reply-state.js";

export const DEFAULT_EMAIL_POLL_INTERVAL_SECONDS = 2;
export const DEFAULT_EMAIL_POLL_PAGE_SIZE = 50;
export const MAX_EMAIL_POLL_PAGE_SIZE = 100;

export type EmailPollFilters = {
  automated?: boolean;
  awaiting?: Awaiting;
  body?: string;
  domain?: string;
  domainId?: string;
  from?: string;
  hasAttachment?: boolean;
  q?: string;
  replyToSentEmailId?: string;
  spamScoreGte?: number;
  spamScoreLt?: number;
  subject?: string;
  to?: string;
};

export type EmailPollFilterFlags = {
  automated?: string;
  awaiting?: string;
  body?: string;
  domain?: string;
  "domain-id"?: string;
  from?: string;
  "has-attachment"?: boolean;
  q?: string;
  "reply-to-sent-email-id"?: string;
  "spam-score-gte"?: number;
  "spam-score-lt"?: number;
  subject?: string;
  to?: string;
};

export type EmailSearchPageResult =
  | {
      ok: true;
      cursor: string | null;
      /** Whether the server says there is a further page. Readers that do not say leave it out. */
      more?: boolean;
      rows: EmailSearchResult[];
    }
  | { ok: false; error: unknown; response?: Response };

type SearchQuery = NonNullable<SearchEmailsData["query"]>;

export function quoteDslValue(value: string): string {
  if (/^[^\s"]+$/.test(value)) return value;
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function combineQ(
  q: string | undefined,
  domain: string | undefined,
): string | undefined {
  const parts = [
    q?.trim(),
    domain ? `domain:${quoteDslValue(domain.trim())}` : undefined,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" ") : undefined;
}

export function filtersFromFlags(
  flags: EmailPollFilterFlags,
): EmailPollFilters {
  if (
    flags.automated !== undefined &&
    !(AUTOMATED_VALUES as readonly string[]).includes(flags.automated)
  ) {
    throw new Error("--automated must be true or false.");
  }
  return {
    automated:
      flags.automated === undefined ? undefined : flags.automated === "true",
    awaiting: flags.awaiting as Awaiting | undefined,
    body: flags.body,
    domain: flags.domain,
    domainId: flags["domain-id"],
    from: flags.from,
    hasAttachment: flags["has-attachment"],
    q: flags.q,
    replyToSentEmailId: flags["reply-to-sent-email-id"],
    spamScoreGte: flags["spam-score-gte"],
    spamScoreLt: flags["spam-score-lt"],
    subject: flags.subject,
    to: flags.to,
  };
}

const SINCE_DURATION = /^(\d+)\s*(s|m|h|d)$/i;
const SINCE_UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/** How --since reads: a date or timestamp, or a duration ago (`15m`). */
export const SINCE_VALUE_HELP =
  "an ISO-8601 timestamp or date, or a duration ago such as 30s, 15m, 2h or 1d";

/**
 * Read --since: an ISO-8601 timestamp or date, or a duration before `now`
 * (`30s`, `15m`, `2h`, `1d`).
 */
export function parseSince(value: string, now = Date.now()): string {
  // A bare number reads as a year or a month to Date ("5" is May 2001), so
  // it is almost always a duration missing its unit.
  if (/^\s*\d+\s*$/.test(value)) {
    throw new Error(
      `--since needs a unit on a duration, for example ${value.trim()}m; it takes ${SINCE_VALUE_HELP}.`,
    );
  }
  const duration = SINCE_DURATION.exec(value.trim());
  const unit = duration
    ? SINCE_UNIT_MS[(duration[2] as string).toLowerCase()]
    : undefined;
  const parsed =
    duration && unit !== undefined
      ? new Date(now - Number(duration[1]) * unit)
      : new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() < 0) {
    throw new Error(`--since must be ${SINCE_VALUE_HELP}.`);
  }
  return parsed.toISOString();
}

export function sinceFromFlags(
  flags: {
    "include-existing"?: boolean;
    since?: string;
  },
  now = Date.now(),
): string | undefined {
  if (flags.since) return parseSince(flags.since, now);
  return flags["include-existing"] ? undefined : new Date(now).toISOString();
}

export function buildEmailSearchQuery(params: {
  /** false: the server leaves the total match count, which a poll never shows, uncomputed. */
  count?: boolean;
  cursor?: string | null;
  filters: EmailPollFilters;
  /** Oldest first unless said, as a poll reads. */
  order?: "received_at_asc" | "received_at_desc";
  pageSize: number;
  since?: string;
}): SearchQuery {
  const query: SearchQuery = {
    include_facets: "false",
    limit: params.pageSize,
    snippet: "false",
    sort: params.order ?? "received_at_asc",
  };

  const q = combineQ(params.filters.q, params.filters.domain);
  if (q) query.q = q;
  if (params.filters.awaiting) query.awaiting = params.filters.awaiting;
  if (params.filters.automated !== undefined) {
    query.automated = params.filters.automated ? "true" : "false";
  }
  if (params.filters.body) query.body = params.filters.body;
  if (params.filters.domainId) query.domain_id = params.filters.domainId;
  if (params.filters.from) query.from = params.filters.from;
  if (params.filters.hasAttachment !== undefined) {
    query.has_attachment = params.filters.hasAttachment ? "true" : "false";
  }
  if (params.filters.spamScoreGte !== undefined) {
    query.spam_score_gte = params.filters.spamScoreGte;
  }
  if (params.filters.spamScoreLt !== undefined) {
    query.spam_score_lt = params.filters.spamScoreLt;
  }
  if (params.filters.replyToSentEmailId) {
    query.reply_to_sent_email_id = params.filters.replyToSentEmailId;
  }
  if (params.filters.subject) query.subject = params.filters.subject;
  if (params.filters.to) query.to = params.filters.to;
  if (params.since) query.date_from = params.since;
  if (params.cursor) query.cursor = params.cursor;
  if (params.count === false) query.count = "false";

  return query;
}

export function encodeReceivedAtSearchCursor(
  email: Pick<EmailSearchResult, "id" | "received_at">,
): string {
  const raw = `r|${new Date(email.received_at).toISOString()}|${email.id}`;
  return Buffer.from(raw, "utf8").toString("base64url");
}

export function cursorFromRows(rows: EmailSearchResult[]): string | null {
  const last = rows.at(-1);
  return last ? encodeReceivedAtSearchCursor(last) : null;
}

export function cursorFromAcceptedRows(
  rows: EmailSearchResult[],
): string | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (row.status === "accepted" || row.status === "completed") {
      return encodeReceivedAtSearchCursor(row);
    }
  }
  return null;
}

export function collectNewAcceptedEmails(
  rows: EmailSearchResult[],
  seenIds: Set<string>,
): EmailSearchResult[] {
  const fresh: EmailSearchResult[] = [];
  for (const row of rows) {
    if (row.status !== "accepted" && row.status !== "completed") continue;
    if (seenIds.has(row.id)) continue;
    seenIds.add(row.id);
    fresh.push(row);
  }
  return fresh;
}

/**
 * How long after arriving an email may become readable and still be reported
 * by an idle poll's re-read; how often a re-read comes; and the most pages, of
 * MAX_EMAIL_POLL_PAGE_SIZE each, one re-read reads.
 */
export const LATE_MAIL_WINDOW_MS = 10 * 60_000;
export const LATE_MAIL_REREAD_MS = 15_000;
export const LATE_MAIL_MAX_PAGES = 3;
/** A re-read also waits at least this many poll intervals, so a longer interval chosen to send fewer requests keeps doing so. */
export const LATE_MAIL_REREAD_POLLS = 3;
/** How far a re-read reads back at most, however long re-reads have been cut short, unless its interval needs more. */
export const LATE_MAIL_MAX_LOOKBACK_MS = 60 * 60_000;
/** Read back this much further, as this clock may run ahead of the server's. */
export const LATE_MAIL_CLOCK_SLACK_MS = 60_000;

/**
 * Mail received from `from` (LATE_MAIL_WINDOW_MS ago when not given, and
 * never before `since`), oldest first. Pages come in order of when an email
 * was received, but an email can become readable to this credential after one
 * received later: it was accepted more slowly, held while its sender was
 * checked, or granted to a key by an email rule once classified. By then the
 * cursor is past its place, so an idle poll re-reads recent mail and keeps
 * only rows it has not seen. It reads newest first, where late mail mostly
 * is, so a busy stretch that holds more than the pages read loses its oldest
 * part rather than its newest. Best effort: a page that fails ends the
 * re-read with what it has, and the poll goes on; so does reaching
 * `deadline`. `cutShort` says it did not reach as far back as it would have:
 * a page failed, the deadline came, or a search the server stopped early for
 * time returned short pages up to the page limit. `failed` is the page that
 * failed, so the caller can wait as long as the server asked (Retry-After).
 */
export async function fetchRecentEmails(params: {
  apiClient: PrimitiveApiClient;
  filters: EmailPollFilters;
  since?: string;
  /** The earliest received time to read, as a Date.now() time. */
  from?: number;
  /** When the caller stops waiting, as a Date.now() time; no further page is read after it. */
  deadline?: number | null;
  now?: number;
  /** The page reader the caller polls with, so the re-read reads as the poll does. */
  fetchPage?: typeof fetchEmailSearchPage;
}): Promise<{
  rows: EmailSearchResult[];
  cutShort: boolean;
  failed?: EmailSearchPageResult;
}> {
  const fetchPage = params.fetchPage ?? fetchEmailSearchPage;
  const now = params.now ?? Date.now();
  const sinceMs = params.since ? Date.parse(params.since) : Number.NaN;
  const wanted = params.from ?? now - LATE_MAIL_WINDOW_MS;
  const from = Number.isNaN(sinceMs) ? wanted : Math.max(wanted, sinceMs);
  const newestFirst: EmailSearchResult[] = [];
  const result = (cutShort: boolean) => ({
    rows: newestFirst.reverse(),
    cutShort,
  });
  let cursor: string | null = null;
  for (let pages = 0; pages < LATE_MAIL_MAX_PAGES; pages += 1) {
    if (
      params.deadline !== undefined &&
      params.deadline !== null &&
      Date.now() >= params.deadline
    )
      return result(true);
    let page: EmailSearchPageResult;
    try {
      page = await fetchPage({
        apiClient: params.apiClient,
        count: false,
        cursor,
        filters: params.filters,
        order: "received_at_desc",
        pageSize: MAX_EMAIL_POLL_PAGE_SIZE,
        since: new Date(from).toISOString(),
      });
    } catch {
      return result(true);
    }
    if (!page.ok) return { ...result(true), failed: page };
    newestFirst.push(...page.rows);
    if (!page.more || !page.cursor) return result(false);
    cursor = page.cursor;
  }
  // At the page limit with more to read. Only pages a search stopped early for time hold fewer rows than asked for.
  return result(
    newestFirst.length < LATE_MAIL_MAX_PAGES * MAX_EMAIL_POLL_PAGE_SIZE,
  );
}

/**
 * An idle poll's re-reads of recent mail (fetchRecentEmails), made once the
 * poll's cursor has passed some mail, with `start` when the poll that first
 * moved it was made.
 *
 * One is due an interval after `start`, as until then the poll has read the
 * same mail itself, and then an interval after the last one ended, so a slow
 * re-read is not followed straight away by another. The interval is
 * LATE_MAIL_REREAD_MS, or LATE_MAIL_REREAD_POLLS poll intervals when that is
 * longer. A re-read is made only on a poll that brought nothing new once it
 * is due, so a wait that ends before the next one is made does not report
 * mail that became readable since the last. `deadline` stops a re-read's
 * paging (fetchRecentEmails).
 *
 * Each re-read reads from LATE_MAIL_WINDOW_MS (and LATE_MAIL_CLOCK_SLACK_MS)
 * before the last one that was not cut short began (before `start`, at
 * first), so an email that becomes readable within LATE_MAIL_WINDOW_MS of
 * arriving is read however far apart re-reads come. That holds while it is
 * among the most one re-read reads, and while a re-read that is not cut short
 * comes within the look-back limit (LATE_MAIL_MAX_LOOKBACK_MS, or more for a
 * long interval) less LATE_MAIL_WINDOW_MS of it becoming readable.
 */
export function lateMailReread(options: {
  pollIntervalMs: number;
  deadline: number | null;
  start: number;
}): {
  due: (now?: number) => boolean;
  read: (
    params: Omit<
      Parameters<typeof fetchRecentEmails>[0],
      "from" | "now" | "deadline"
    >,
  ) => Promise<{ rows: EmailSearchResult[]; failed?: EmailSearchPageResult }>;
} {
  const { pollIntervalMs, deadline, start } = options;
  const intervalMs = Math.max(
    LATE_MAIL_REREAD_MS,
    LATE_MAIL_REREAD_POLLS * pollIntervalMs,
  );
  const maxLookBackMs = Math.max(
    LATE_MAIL_MAX_LOOKBACK_MS,
    LATE_MAIL_WINDOW_MS + 2 * intervalMs,
  );
  // When the last re-read not cut short began, and when the last re-read ended.
  let covered = start;
  let ended = start;
  return {
    due: (now = Date.now()) => now - ended >= intervalMs,
    read: async (params) => {
      const begun = Date.now();
      const { rows, cutShort, failed } = await fetchRecentEmails({
        ...params,
        deadline,
        from:
          Math.max(covered - LATE_MAIL_WINDOW_MS, begun - maxLookBackMs) -
          LATE_MAIL_CLOCK_SLACK_MS,
        now: begun,
      });
      if (!cutShort) covered = begun;
      ended = Date.now();
      return { rows, failed };
    },
  };
}

export type LateMailReread = ReturnType<typeof lateMailReread>;

export async function fetchEmailSearchPage(params: {
  apiClient: PrimitiveApiClient;
  count?: boolean;
  cursor?: string | null;
  filters: EmailPollFilters;
  order?: "received_at_asc" | "received_at_desc";
  pageSize: number;
  since?: string;
}): Promise<EmailSearchPageResult> {
  const result = await searchEmails({
    client: params.apiClient.client,
    query: buildEmailSearchQuery({
      count: params.count,
      cursor: params.cursor,
      filters: params.filters,
      order: params.order,
      pageSize: params.pageSize,
      since: params.since,
    }),
    responseStyle: "fields",
  });

  const wantsReplyState =
    Boolean(params.filters.awaiting) || queryUsesAwaiting(params.filters.q);
  const wantsAutomated =
    params.filters.automated !== undefined ||
    queryUsesAutomated(params.filters.q);
  if (result.error) {
    // An older server may reject the filter outright. Surface that as
    // the reply-state error rather than a generic validation failure.
    if (wantsReplyState && isAwaitingRejectedError(result.error)) {
      throw awaitingRejectedError("GET /emails/search");
    }
    if (wantsAutomated && isAutomatedRejectedError(result.error)) {
      throw automatedRejectedError("GET /emails/search");
    }
    return { ok: false, error: result.error, response: result.response };
  }

  const envelope = result.data as SearchEmailsResponse | undefined;
  const rows = envelope?.data ?? [];
  // Search ignores query parameters it does not know, so an older
  // server answers `awaiting=you` with unfiltered rows that lack the
  // reply-state fields. Throw instead of printing them as matches.
  if (wantsReplyState) {
    assertAwaitingFilterRows(rows, "GET /emails/search");
    if (rows.length === 0)
      await ensureSearchReportsReplyState(params.apiClient);
  }
  // Same for the automated filter: rows must carry the verdict and match it.
  if (wantsAutomated) {
    assertAutomatedVerdict(
      rows,
      "GET /emails/search",
      expectedAutomatedVerdicts(params.filters.automated, params.filters.q),
    );
    if (rows.length === 0) await ensureSearchReportsAutomated(params.apiClient);
  }
  return {
    ok: true,
    cursor: envelope?.meta.cursor ?? cursorFromRows(rows),
    more: Boolean(envelope?.meta.cursor),
    rows,
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
