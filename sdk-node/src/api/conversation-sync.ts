/**
 * Incremental conversation sync over `GET /emails/{id}/conversation?since=`.
 *
 * A `since` read returns the messages created or changed after a cursor, plus
 * the cursor to continue from and `has_more` when the delta stopped at its page
 * size. A message can come back in a later read with more `copies` listed, or
 * under another id when a better copy of it becomes visible. The merge rule,
 * shared by the Node, Python and Go SDKs and pinned by
 * `test-fixtures/conversation-sync.json`:
 *
 * 1. Upsert each returned message by `id`.
 * 2. Two entries are the same message when either one's id is in the other's
 *    `copies` or `sent_email_id`. The newer entry replaces the held one and
 *    takes its place.
 * 3. Order by `timestamp` (millisecond precision, a missing timestamp last),
 *    then by position in the held list, with new messages after held ones in
 *    the order they arrived.
 *
 * Each returned message's `timestamp` is normalized first: an RFC 3339
 * date-time with an offset is kept, one without an offset is read as UTC and
 * gets `Z`, and anything else becomes null. A sync stops with an error after
 * `MAX_CONVERSATION_SYNC_PAGES` pages.
 *
 * Deleted messages are not reported by a `since` read. Sync again without a
 * state now and then to reconcile.
 */

import {
  type Conversation,
  type ConversationMessage,
  PrimitiveApiError,
} from "@primitivedotdev/api-core";

/** What to keep between syncs: pass a previous result back as `state`. */
export interface ConversationSyncState {
  /** The cursor to send as `since` on the next sync. */
  cursor: string;
  /** The merged messages, oldest first. */
  messages: ConversationMessage[];
}

export interface ConversationSyncResult extends ConversationSyncState {
  /** From the last page read; describes the whole conversation. */
  threadId: string | null;
  subject: string | null;
  /** Absent when the last page omitted it, as an empty delta can. */
  messageCount?: number;
  truncated?: boolean;
}

/** The most pages one sync reads before it stops with an error. */
export const MAX_CONVERSATION_SYNC_PAGES = 1000;

type HeldEntry = { message: ConversationMessage; seq: number };

const RFC3339 =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})?$/;

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * The instant of an RFC 3339 date-time in epoch milliseconds (fraction
 * truncated), or null when it is not one. A missing offset is UTC. The same
 * checks run in the Python and Go SDKs, pinned by the `timestamps` cases of
 * `test-fixtures/conversation-sync.json`.
 */
function rfc3339Ms(value: string): number | null {
  const match = RFC3339.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi, s, fraction = "", zone = "Z"] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s);
  if (year < 1 || month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  let offsetMinutes = 0;
  if (zone !== "Z") {
    const offsetHours = Number(zone.slice(1, 3));
    const offsetMins = Number(zone.slice(4, 6));
    if (offsetHours > 23 || offsetMins > 59) return null;
    offsetMinutes =
      (zone[0] === "-" ? -1 : 1) * (offsetHours * 60 + offsetMins);
  }
  const utc = new Date(0);
  utc.setUTCFullYear(year, month - 1, day);
  utc.setUTCHours(
    hour,
    minute,
    second,
    Number(fraction.padEnd(3, "0").slice(0, 3)),
  );
  return utc.getTime() - offsetMinutes * 60_000;
}

/** A message timestamp as the sync keeps it: see the module comment. */
export function normalizeConversationTimestamp(
  value: string | null | undefined,
): string | null | undefined {
  if (typeof value !== "string") return value;
  if (rfc3339Ms(value) === null) return null;
  return RFC3339.exec(value)?.[8] ? value : `${value}Z`;
}

function timestampMs(message: ConversationMessage): number {
  if (typeof message.timestamp !== "string") return Number.POSITIVE_INFINITY;
  return rfc3339Ms(message.timestamp) ?? Number.POSITIVE_INFINITY;
}

/** The ids an entry stands for besides its own: its copies and its send. */
function linkedIds(message: ConversationMessage): Set<string> {
  const ids = new Set<string>();
  for (const copy of message.copies ?? []) ids.add(copy.id);
  if (message.sent_email_id) ids.add(message.sent_email_id);
  ids.delete(message.id);
  return ids;
}

/**
 * Merge a `since` delta into held messages and return the new ordered list.
 * Pure: neither input is modified.
 */
export function mergeConversationMessages(
  held: readonly ConversationMessage[],
  delta: readonly ConversationMessage[],
): ConversationMessage[] {
  let entries: HeldEntry[] = held.map((message, seq) => ({ message, seq }));
  let nextSeq = entries.length;
  for (const message of delta) {
    const linked = linkedIds(message);
    let inherited: number | undefined;
    entries = entries.filter((entry) => {
      if (entry.message.id === message.id) return true;
      const same =
        linked.has(entry.message.id) ||
        linkedIds(entry.message).has(message.id);
      if (!same) return true;
      inherited =
        inherited === undefined ? entry.seq : Math.min(inherited, entry.seq);
      return false;
    });
    const existing = entries.find((entry) => entry.message.id === message.id);
    if (existing) {
      existing.message = message;
    } else if (inherited !== undefined) {
      entries.push({ message, seq: inherited });
    } else {
      entries.push({ message, seq: nextSeq });
      nextSeq += 1;
    }
  }
  return entries
    .map((entry) => ({ entry, at: timestampMs(entry.message) }))
    .sort((a, b) => {
      if (a.at !== b.at) return a.at < b.at ? -1 : 1;
      return a.entry.seq - b.entry.seq;
    })
    .map(({ entry }) => entry.message);
}

/**
 * Run a sync with a caller-supplied page reader. `read(since)` returns the
 * conversation for one `since` read. Reads from `state.cursor` (or `start`
 * without a state) and follows `has_more` until it is false.
 */
export async function runConversationSync(
  read: (since: string) => Promise<Conversation>,
  state?: ConversationSyncState,
): Promise<ConversationSyncResult> {
  let since = state?.cursor || "start";
  let messages = state?.messages ? [...state.messages] : [];
  for (let pages = 1; ; pages += 1) {
    if (pages > MAX_CONVERSATION_SYNC_PAGES) {
      throw new PrimitiveApiError(
        `Conversation sync read ${MAX_CONVERSATION_SYNC_PAGES} pages without reaching the end; stopping.`,
        { payload: { since } },
      );
    }
    const page = await read(since);
    if (!page.cursor) {
      throw new PrimitiveApiError(
        "Conversation read returned no cursor; cannot continue the sync.",
        { payload: page },
      );
    }
    messages = mergeConversationMessages(
      messages,
      page.messages.map((message) =>
        message.timestamp === undefined
          ? message
          : {
              ...message,
              timestamp: normalizeConversationTimestamp(message.timestamp),
            },
      ),
    );
    if (page.has_more !== true) {
      return {
        cursor: page.cursor,
        messages,
        threadId: page.thread_id,
        subject: page.subject ?? null,
        ...(page.message_count !== undefined
          ? { messageCount: page.message_count }
          : {}),
        ...(page.truncated !== undefined ? { truncated: page.truncated } : {}),
      };
    }
    if (page.cursor === since) {
      throw new PrimitiveApiError(
        "Conversation read reported has_more without advancing the cursor.",
        { payload: page },
      );
    }
    since = page.cursor;
  }
}
