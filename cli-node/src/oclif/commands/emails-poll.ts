import type {
  EmailSearchResult,
  PrimitiveApiClient,
  SearchEmailsData,
  SearchEmailsResponse,
} from "@primitivedotdev/api-core";
import { searchEmails } from "@primitivedotdev/api-core";

export const DEFAULT_EMAIL_POLL_INTERVAL_SECONDS = 2;
export const DEFAULT_EMAIL_POLL_PAGE_SIZE = 50;
export const MAX_EMAIL_POLL_PAGE_SIZE = 100;

export type EmailPollFilters = {
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
  | { ok: false; error: unknown };

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

export function normalizeIsoDate(value: string, label: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid date or ISO-8601 timestamp.`);
  }
  return parsed.toISOString();
}

export function filtersFromFlags(
  flags: EmailPollFilterFlags,
): EmailPollFilters {
  return {
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

export function sinceFromFlags(flags: {
  "include-existing"?: boolean;
  since?: string;
}): string | undefined {
  if (flags.since) return normalizeIsoDate(flags.since, "--since");
  return flags["include-existing"] ? undefined : new Date().toISOString();
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

  if (result.error) return { ok: false, error: result.error };

  const envelope = result.data as SearchEmailsResponse | undefined;
  const rows = envelope?.data ?? [];
  return {
    ok: true,
    cursor: envelope?.meta.cursor ?? cursorFromRows(rows),
    rows,
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
