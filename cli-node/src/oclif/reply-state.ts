/**
 * Reply state on inbound email: `reply_count`, `last_replied_at` and
 * `awaiting` ('you' | 'them', whose turn it is in the thread).
 *
 * A server that predates reply state either rejects the `awaiting`
 * filter (GET /emails validates its query strictly) or ignores it and
 * returns rows without the fields (GET /emails/search). Both must fail
 * loudly: a CLI that treated a missing `awaiting` as "you" would tell an
 * agent that every email still needs an answer, and the agent would
 * reply twice.
 */

export type Awaiting = "you" | "them";

export const AWAITING_VALUES: readonly Awaiting[] = ["you", "them"];

export const AWAITING_FLAG_DESCRIPTION =
  "Only emails whose reply state is this value: `you` = waiting on your reply (the thread's latest message is inbound), `them` = you replied last. Queued and scheduled replies count as replied. Fails if the server does not report reply state yet.";

export const REPLY_STATE_UNSUPPORTED_CODE = "reply_state_unsupported";

/** True when a search DSL query uses the `awaiting:` term. */
export function queryUsesAwaiting(q: string | null | undefined): boolean {
  return typeof q === "string" && /(^|[\s(])-?awaiting:/i.test(q);
}

export class ReplyStateUnsupportedError extends Error {
  readonly code = REPLY_STATE_UNSUPPORTED_CODE;

  constructor(detail: string) {
    super(
      `The server does not support reply state yet: ${detail} Nothing was treated as awaiting your reply. Upgrade to a server that returns \`awaiting\` and \`reply_count\`, or run without reply-state options.`,
    );
    this.name = "ReplyStateUnsupportedError";
  }
}

export type ReplyStateFields = {
  awaiting: Awaiting;
  last_replied_at: string | null;
  reply_count: number;
};

export function hasReplyState(row: unknown): row is ReplyStateFields {
  if (row === null || typeof row !== "object") return false;
  const candidate = row as Record<string, unknown>;
  return (
    (candidate.awaiting === "you" || candidate.awaiting === "them") &&
    typeof candidate.reply_count === "number" &&
    (candidate.last_replied_at === null ||
      typeof candidate.last_replied_at === "string")
  );
}

/**
 * Throw unless every row carries reply state. An empty page passes: a
 * server that ignored the filter returned a superset of the filtered
 * result, so an empty superset means the filtered answer is empty too. `surface` names the
 * response for the error, e.g. "GET /emails".
 */
export function assertReplyState(rows: readonly unknown[], surface: string) {
  const missing = rows.filter((row) => !hasReplyState(row)).length;
  if (missing > 0) {
    throw new ReplyStateUnsupportedError(
      `${surface} returned ${missing} of ${rows.length} email${rows.length === 1 ? "" : "s"} without the \`awaiting\` and \`reply_count\` fields.`,
    );
  }
}

// Kept local rather than imported from api-command.ts, which imports
// this module for the generated list and search commands.
function errorBody(payload: unknown): { code?: unknown; message?: unknown } {
  if (payload === null || typeof payload !== "object") return {};
  const inner = (payload as { error?: unknown }).error;
  return inner !== null && typeof inner === "object"
    ? (inner as { code?: unknown; message?: unknown })
    : (payload as { code?: unknown; message?: unknown });
}

/**
 * True when an API error is an older server rejecting the `awaiting`
 * query parameter or the `awaiting:` search term as unknown. A current
 * server accepts both, and the CLI only ever sends valid values.
 */
export function isAwaitingRejectedError(payload: unknown): boolean {
  const body = errorBody(payload);
  if (body.code !== "validation_error") return false;
  const message =
    typeof body.message === "string" ? body.message : JSON.stringify(payload);
  return /awaiting/i.test(message) && /unrecogni[sz]ed|unknown/i.test(message);
}

export function awaitingRejectedError(surface: string): Error {
  return new ReplyStateUnsupportedError(
    `${surface} rejected the \`awaiting\` filter as unknown.`,
  );
}

/** Short column value for tables: "you", "them", or "-" when absent. */
export function formatAwaitingCell(row: unknown): string {
  if (!hasReplyState(row)) return "-";
  return row.awaiting;
}

/** Reply count for tables, or "-" when the server did not report it. */
export function formatRepliesCell(row: unknown): string {
  if (!hasReplyState(row)) return "-";
  return String(row.reply_count);
}

const REPLY_STATE_SURFACES: Record<string, string> = {
  listEmails: "GET /emails",
  searchEmails: "GET /emails/search",
};

/**
 * For the generated `emails list` / `emails search` commands: the
 * surface name when this call asked for reply state (an `awaiting`
 * parameter or an `awaiting:` search term), else null.
 */
export function replyStateSurfaceForOperation(
  sdkName: string,
  query: Record<string, unknown> | undefined,
): string | null {
  const surface = REPLY_STATE_SURFACES[sdkName];
  if (!surface || !query) return null;
  const q = typeof query.q === "string" ? query.q : undefined;
  return query.awaiting !== undefined || queryUsesAwaiting(q) ? surface : null;
}
