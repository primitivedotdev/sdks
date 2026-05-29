import type { EmailSummary } from "@primitivedotdev/api-core";

// Shared compact email table formatting for commands that stream or
// wait on inbound mail. Subject is truncated for display only; the
// underlying JSON is unchanged.
// Truncation widths chosen so a row fits in ~140 columns total. Long
// values wrap to "..." rather than blowing out terminal layout.
const SUBJECT_DISPLAY_WIDTH = 50;
const ADDRESS_DISPLAY_WIDTH = 32;
// Two ID widths: the short prefix is for human eyes (interactive
// TTY), the full UUID is for piped output (a script reading the row
// as a feed). The short prefix is useless when piped because every
// other operation requires the full UUID, so the AGX walkthrough
// kept producing a re-run with `--json` just to recover the id.
// Auto-switching by `process.stdout.isTTY` makes the common piped
// case a one-call workflow.
const ID_DISPLAY_WIDTH_SHORT = 8;
const ID_DISPLAY_WIDTH_FULL = 36;
const RECEIVED_DISPLAY_WIDTH = 19;

// Truncate to width with right-padding; values longer than width are
// cut to width-3 with a "..." suffix so the output is exactly `width`
// chars (3 of which are the ellipsis). Display-only; never mutates
// the underlying value the caller passed in.
//
// Width-exact output matters here: formatRow relies on each column
// being exactly its declared width so columns line up across rows.
// An overflowing truncate would shift every later column to the
// right whenever truncation fired (e.g. a row with both addresses
// truncated would push SUBJECT 4 chars off).
export function truncate(value: string, width: number): string {
  if (value.length <= width) return value.padEnd(width);
  return `${value.slice(0, width - 3)}...`;
}

// Compact ISO timestamp for display: `YYYY-MM-DD HH:MM:SS` in UTC.
// The full ISO string with milliseconds and `T`/`Z` markers is too
// dense to scan at a glance; this is the same shape git log uses.
export function formatReceivedAt(value: string | undefined | null): string {
  if (!value) return "-".padEnd(RECEIVED_DISPLAY_WIDTH);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.padEnd(RECEIVED_DISPLAY_WIDTH);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

// Decide whether to print the full UUID or the short 8-char prefix
// based on whether stdout is a TTY. Piped/redirected stdout (the
// caller is consuming the rows programmatically) gets full UUIDs;
// interactive terminals get the compact prefix. Pulled out as a
// helper so tests can drive the rendering branch without touching
// process.stdout.
export function pickIdWidth(isTty: boolean): number {
  return isTty ? ID_DISPLAY_WIDTH_SHORT : ID_DISPLAY_WIDTH_FULL;
}

export function formatRow(email: EmailSummary, idWidth: number): string {
  // idWidth is one of ID_DISPLAY_WIDTH_SHORT or ID_DISPLAY_WIDTH_FULL.
  // For SHORT, slice the UUID to the prefix length and pad. For FULL,
  // pad to the full UUID width (UUIDs are already 36 chars, so this
  // is effectively just an alignment guarantee for any malformed
  // shorter id).
  const id = truncate(email.id.slice(0, idWidth), idWidth);
  const received = formatReceivedAt(email.received_at);
  const from = truncate(email.sender ?? "", ADDRESS_DISPLAY_WIDTH);
  const to = truncate(email.recipient ?? "", ADDRESS_DISPLAY_WIDTH);
  const subject = (email.subject ?? "").replace(/\s+/g, " ");
  const subjectCol = truncate(subject, SUBJECT_DISPLAY_WIDTH);
  return `${id}  ${received}  ${from}  ${to}  ${subjectCol}`;
}

export function formatHeader(idWidth: number): string {
  return `${"ID".padEnd(idWidth)}  ${"RECEIVED (UTC)".padEnd(RECEIVED_DISPLAY_WIDTH)}  ${"FROM".padEnd(ADDRESS_DISPLAY_WIDTH)}  ${"TO".padEnd(ADDRESS_DISPLAY_WIDTH)}  SUBJECT`;
}
