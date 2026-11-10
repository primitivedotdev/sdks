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
  | { ok: true; cursor: string | null; rows: EmailSearchResult[] }
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
  cursor?: string | null;
  filters: EmailPollFilters;
  pageSize: number;
  since?: string;
}): SearchQuery {
  const query: SearchQuery = {
    include_facets: "false",
    limit: params.pageSize,
    snippet: "false",
    sort: "received_at_asc",
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

export async function fetchEmailSearchPage(params: {
  apiClient: PrimitiveApiClient;
  cursor?: string | null;
  filters: EmailPollFilters;
  pageSize: number;
  since?: string;
}): Promise<EmailSearchPageResult> {
  const result = await searchEmails({
    client: params.apiClient.client,
    query: buildEmailSearchQuery({
      cursor: params.cursor,
      filters: params.filters,
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
    rows,
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
