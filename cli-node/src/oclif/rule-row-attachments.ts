// The attachments line under an email rule decision or result row: what an
// email carried, on one short line, so a reader judging a rule sees that an
// email had files without opening it. Shared by the decision tables, the
// rule results on one email and the rule test report.
//
// The answer gives `attachments` ([{ name, description }], the first few
// named files) and `attachment_count` (all of them). An empty list means the
// email has none; null means the caller is not shown whether it has any.

import { shownLine } from "./terminal-text.js";

/** The most files one line names; the rest are counted. */
export const ATTACHMENTS_LINE_NAMES = 3;
/** The longest file name and description shown, in characters. */
export const ATTACHMENT_NAME_SHOWN_MAX = 40;
export const ATTACHMENT_DESCRIPTION_SHOWN_MAX = 60;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Text a sender or a file reader wrote, on one line, cut at `max`. */
function cut(value: unknown, max: number): string {
  const line = shownLine(value);
  return line.length > max ? `${line.slice(0, max - 3)}...` : line;
}

/**
 * What a row's email carried, as one line without indentation: "2
 * attachments: rate-card.pdf (Contractor pay rates by role), logo.png",
 * "no attachments", or undefined when the row does not say (null or absent:
 * not known to the caller).
 */
export function attachmentsSummary(row: unknown): string | undefined {
  if (!isRecord(row) || !Array.isArray(row.attachments)) return undefined;
  const listed = row.attachments.filter(isRecord);
  const count =
    typeof row.attachment_count === "number" &&
    row.attachment_count >= listed.length
      ? row.attachment_count
      : listed.length;
  if (count === 0) return "no attachments";
  const shown = listed.slice(0, ATTACHMENTS_LINE_NAMES).map((file) => {
    const name = cut(file.name, ATTACHMENT_NAME_SHOWN_MAX) || "(no name)";
    const description = cut(file.description, ATTACHMENT_DESCRIPTION_SHOWN_MAX);
    return description ? `${name} (${description})` : name;
  });
  const more = count - shown.length;
  return `${count} ${count === 1 ? "attachment" : "attachments"}: ${[
    ...shown,
    ...(more > 0 ? [`+${more} more`] : []),
  ].join(", ")}`;
}

/** attachmentsSummary as lines under a row, indented by `indent`; none when it does not say. */
export function attachmentsLines(row: unknown, indent: string): string[] {
  const summary = attachmentsSummary(row);
  return summary === undefined ? [] : [`${indent}${summary}`];
}
