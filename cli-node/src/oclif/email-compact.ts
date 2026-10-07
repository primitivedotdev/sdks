import type { EmailDetail } from "@primitivedotdev/api-core";

export type CompactAttachment = {
  /** Sender-authored and untrusted. */
  filename: string | null;
  /** Sender-authored and untrusted. */
  content_type: string | null;
  size_bytes: number;
  part_index: number | null;
};

export type EmailCompact = {
  id: string;
  thread_id: string | null;
  received_at: string;
  from: string;
  to: string;
  /** Sender-authored and untrusted. */
  subject: string | null;
  /**
   * Sender-authored and untrusted. The new text of this message: quoted
   * history is removed, and an HTML-only message is reduced to its text.
   */
  body_text: string;
  /** Where body_text came from. `none` means the email carries no body. */
  body_source: "text" | "html" | "none";
  /**
   * Characters of quoted history left out of body_text. When above zero the
   * earlier messages are in the thread, and `emails get` without --compact
   * returns this email whole.
   */
  quoted_chars_removed: number;
  attachments: CompactAttachment[];
};

const ORIGINAL_MESSAGE = /^\s*-{2,}\s*Original Message\s*-{2,}\s*$/i;
const OUTLOOK_RULE = /^\s*_{20,}\s*$/;
const WROTE_ONE_LINE = /^\s*On\b.{1,300}\bwrote:\s*$/i;
const WROTE_FIRST_LINE = /^\s*On\b.{1,300}$/i;
const WROTE_LAST_LINE = /^.{0,300}\bwrote:\s*$/i;
const HEADER_FROM = /^\s*\*?From:\*?\s+\S/i;
const HEADER_OTHER = /^\s*\*?(Sent|Date|To|Subject):\*?\s/i;
const QUOTED_LINE = /^\s*>/;
const FORWARDED =
  /^\s*(?:-{2,}\s*Forwarded message\s*-{2,}|Begin forwarded message:)\s*$/i;

/**
 * Whether line `i` opens a copied header block ("From:", then "Sent:" or
 * "Date:", "To:" and "Subject:" lines), the way Outlook introduces the message
 * being answered. Two further header lines are required so a sentence that
 * merely starts with "From:" is never taken for one.
 */
function opensHeaderBlock(lines: string[], i: number): boolean {
  if (!HEADER_FROM.test(lines[i] ?? "")) return false;
  let headers = 0;
  for (let j = i + 1; j < Math.min(lines.length, i + 6); j++)
    if (HEADER_OTHER.test(lines[j] ?? "")) headers++;
  return headers >= 2;
}

function nextNonEmpty(lines: string[], from: number): number {
  for (let j = from; j < lines.length; j++)
    if ((lines[j] ?? "").trim() !== "") return j;
  return -1;
}

/**
 * Whether everything from line `from` on is quoted (">") or blank. Text of the
 * sender's own below an attribution means they answered inline or below the
 * quote, so the attribution does not start history to remove.
 */
function onlyQuotedAfter(lines: string[], from: number): boolean {
  for (let j = from; j < lines.length; j++) {
    const line = lines[j] ?? "";
    if (line.trim() !== "" && !QUOTED_LINE.test(line)) return false;
  }
  return true;
}

/**
 * Index of the line where quoted history starts, or -1 when there is none.
 */
function quotedHistoryStart(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (ORIGINAL_MESSAGE.test(line)) return i;
    if (WROTE_ONE_LINE.test(line) && onlyQuotedAfter(lines, i + 1)) return i;
    // Clients wrap a long attribution ("On <date>, <name> <address>" then
    // "wrote:") across two lines.
    if (
      WROTE_FIRST_LINE.test(line) &&
      WROTE_LAST_LINE.test(lines[i + 1] ?? "") &&
      !WROTE_LAST_LINE.test(line) &&
      onlyQuotedAfter(lines, i + 2)
    )
      return i;
    if (OUTLOOK_RULE.test(line)) {
      const next = nextNonEmpty(lines, i + 1);
      if (next !== -1 && opensHeaderBlock(lines, next)) return i;
    }
    if (opensHeaderBlock(lines, i)) return i;
  }
  return -1;
}

/**
 * Remove the quoted history a reply carries below its new text: everything
 * from an attribution line, an "Original Message" rule or a copied header
 * block onward, and any run of ">" lines the message ends with. Quoted lines
 * with the sender's own text after them (an inline reply) are kept. A body
 * that forwards a message is returned whole, since the forwarded text is what
 * the sender wants read, and so is one where removing the history would leave
 * nothing.
 */
export function stripQuotedHistory(body: string): {
  text: string;
  removed: number;
} {
  const original = body.replace(/\r\n?/g, "\n").trim();
  let lines = original.split("\n");
  if (lines.some((line) => FORWARDED.test(line)))
    return { text: original, removed: 0 };
  const start = quotedHistoryStart(lines);
  if (start !== -1) lines = lines.slice(0, start);
  while (lines.length > 0) {
    const last = lines[lines.length - 1] ?? "";
    if (last.trim() !== "" && !QUOTED_LINE.test(last)) break;
    lines.pop();
  }
  const text = lines.join("\n").trim();
  if (text === "") return { text: original, removed: 0 };
  return { text, removed: original.length - text.length };
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name) => {
    const key = String(name).toLowerCase();
    if (key.startsWith("#")) {
      const code = key.startsWith("#x")
        ? Number.parseInt(key.slice(2), 16)
        : Number.parseInt(key.slice(1), 10);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    }
    return NAMED_ENTITIES[key] ?? match;
  });
}

/** Apply a removal until the text stops changing, so no nested match survives. */
function removeAll(text: string, pattern: RegExp, replacement = " "): string {
  let current = text;
  for (;;) {
    const next = current.replace(pattern, replacement);
    if (next === current) return next;
    current = next;
  }
}

/**
 * The readable text of an HTML body, for an email that has no text part. The
 * result is printed as plain text for a reader, never rendered as HTML.
 */
export function htmlToText(html: string): string {
  let text = removeAll(html, /<!--[\s\S]*?-->/g);
  text = removeAll(text, /<(script|style|head|title)\b[\s\S]*?<\/\1\s*>/gi);
  // A link keeps its destination beside its label: "Reset password" alone
  // cannot be followed.
  text = text.replace(
    /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a\s*>/gi,
    (
      _match,
      double: string | undefined,
      single: string | undefined,
      label: string,
    ) => {
      const url = (double ?? single ?? "").trim();
      const shown = removeAll(label, /<[^>]*>/g, "").trim();
      if (!/^(https?:|mailto:)/i.test(url)) return label;
      if (shown === url || `mailto:${shown}` === url) return label;
      return shown === "" ? url : `${label} (${url})`;
    },
  );
  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table|blockquote)\s*>/gi, "\n");
  text = text.replace(/<\/(td|th)\s*>/gi, " ");
  // Inline markup (<b>, <a>, <span>) sits inside words and sentences, so it
  // is removed without leaving a gap.
  text = removeAll(text, /<[^>]*>/g, "");
  return decodeEntities(text)
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * The compact view of one received email: who, when, the subject, the new
 * text and what is attached. Built from the email alone, with no further
 * request.
 */
export function buildEmailCompact(detail: EmailDetail): EmailCompact {
  const text = detail.body_text?.trim() ? detail.body_text : null;
  const html =
    text === null && detail.body_html?.trim() ? detail.body_html : null;
  const source = text !== null ? "text" : html !== null ? "html" : "none";
  const stripped = stripQuotedHistory(
    text ?? (html !== null ? htmlToText(html) : ""),
  );
  return {
    id: detail.id,
    thread_id: detail.thread_id ?? null,
    received_at: detail.received_at,
    from: detail.from_header?.trim() || detail.from_email,
    to: detail.to_email,
    subject: detail.subject ?? null,
    body_text: stripped.text,
    body_source: source,
    quoted_chars_removed: stripped.removed,
    attachments: (detail.parsed?.attachments ?? []).map((part) => ({
      filename: typeof part.filename === "string" ? part.filename : null,
      content_type:
        typeof part.content_type === "string" ? part.content_type : null,
      size_bytes: part.size_bytes,
      part_index: typeof part.part_index === "number" ? part.part_index : null,
    })),
  };
}
