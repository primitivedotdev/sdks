// `sent list` (and `sending list-sent-emails`, the same command) lists your
// own sends by default: it sends mine=true unless --all-senders is given. A
// person sees the sends from their own addresses, a connected agent the
// sends from its address; for an API key or another app the API does not
// apply it, and says so in meta.mine. Without --json a table follows the JSON
// on stderr, sender first, so whose each send is reads at a glance.

import { shownText } from "./terminal-text.js";

export const ALL_SENDERS_FLAG = "all-senders";

export const ALL_SENDERS_FLAG_DESCRIPTION =
  "List every send this credential can read, not only those from your own addresses (sends mine=true without it).";

/** The query sent: mine=true unless --all-senders, or mine was given. */
export function withMineDefault(
  query: Record<string, unknown>,
  flags: Record<string, unknown>,
): Record<string, unknown> {
  if (flags[ALL_SENDERS_FLAG] === true || query.mine !== undefined)
    return query;
  return { ...query, mine: "true" };
}

/** A time to the minute, in UTC, as the activity tables print one. */
function minute(value: string): string {
  const at = new Date(value);
  return Number.isNaN(at.getTime())
    ? value
    : at.toISOString().slice(0, 16).replace("T", " ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** The line above the table: whose sends these are, when mine was applied. */
export function mineLine(meta: unknown): string | null {
  const mine = isRecord(meta) && isRecord(meta.mine) ? meta.mine : null;
  if (mine?.applied !== true) return null;
  const addresses = Array.isArray(mine.addresses)
    ? mine.addresses.map(shownText).filter(Boolean)
    : [];
  return `Sends from your own addresses${addresses.length > 0 ? ` (${addresses.join(", ")})` : ""}. --${ALL_SENDERS_FLAG} lists every send you can read.`;
}

/** One line per send, FROM first, then TO, STATUS, WHEN (UTC), SUBJECT and ID. */
export function sentListTable(rows: unknown): string[] {
  const list = Array.isArray(rows) ? rows.filter(isRecord) : [];
  if (list.length === 0) return [];
  const cells = list.map((row) =>
    [
      row.from_address,
      row.to_address,
      row.status,
      typeof row.created_at === "string" ? minute(row.created_at) : "",
      row.subject ?? "(no subject)",
      row.id,
    ].map((cell) => shownText(cell === undefined ? "" : String(cell))),
  );
  const header = ["FROM", "TO", "STATUS", "WHEN (UTC)", "SUBJECT", "ID"];
  const widths = header.map((h, i) =>
    Math.max(h.length, ...cells.map((row) => (row[i] ?? "").length)),
  );
  const line = (row: readonly string[]) =>
    row
      .map((cell, i) =>
        i === row.length - 1 ? cell : cell.padEnd(widths[i] ?? 0),
      )
      .join("  ");
  return [line(header), ...cells.map(line)];
}

/** What `sent list` prints on stderr after the JSON, without --json. */
export function sentListLines(envelope: unknown): string[] {
  const body = isRecord(envelope) ? envelope : {};
  const above = mineLine(body.meta);
  return [...(above ? [above] : []), ...sentListTable(body.data)];
}
