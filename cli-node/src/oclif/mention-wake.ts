import type { EmailDetail } from "@primitivedotdev/api-core";
import { buildEmailCompact } from "./email-compact.js";
import { otherParticipants } from "./email-participants.js";
import { bareAddress } from "./wake-context.js";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whether `text` mentions `address`: the full address, or `@` and its local
 * part, matched case-insensitively. A mention must stand on its own: it is
 * not part of a longer address or word, so `@ops` does not match `@ops2`,
 * `bob@ops.example` or `ops@example.test`, and `ops@example.test` does not
 * match `devops@example.test`.
 */
export function mentionsAddress(text: string, address: string): boolean {
  const bare = bareAddress(address);
  if (!bare) return false;
  const local = bare.slice(0, bare.lastIndexOf("@"));
  // Characters a longer local part can start with: the RFC 5322 atext set
  // plus the dot, except the apostrophe and backtick, which in mail almost
  // always quote an address rather than belong to it.
  const before = "(?<![\\w.!#$%&*+/=?^{|}~-])";
  // Characters an address or a local part can continue with.
  const after = "(?![\\w%+-]|\\.[\\w-]|@)";
  const full = new RegExp(`${before}${escapeRegExp(bare)}${after}`, "i");
  const handle = new RegExp(
    `(?<![\\w.!#$%&*+/=?^{|}~@-])@${escapeRegExp(local)}${after}`,
    "i",
  );
  return full.test(text) || handle.test(text);
}

// An opening or closing blockquote tag. Excluding "<" as well as ">" from
// the attributes keeps a scan linear even when a tag is never closed.
const BLOCKQUOTE_TAG = /<(\/?)blockquote\b[^<>]*>/gi;

/**
 * An HTML-only email with its blockquotes removed. HTML mail marks quoted
 * history with blockquote rather than ">", and the text conversion keeps
 * quoted lines as plain text, so an earlier message's mention would count
 * again. One pass tracks the nesting depth and keeps only text outside every
 * blockquote; an unclosed blockquote drops the rest of the body. A message
 * with a text part is returned unchanged.
 */
function withoutHtmlQuotes(detail: EmailDetail): EmailDetail {
  if (detail.body_text?.trim() || !detail.body_html) return detail;
  const html = detail.body_html;
  let kept = "";
  let depth = 0;
  let last = 0;
  for (const tag of html.matchAll(BLOCKQUOTE_TAG)) {
    if (depth === 0) kept += html.slice(last, tag.index);
    if (tag[1]) depth = Math.max(0, depth - 1);
    else {
      if (depth === 0) kept += "\n";
      depth += 1;
    }
    last = tag.index + tag[0].length;
  }
  if (depth === 0) kept += html.slice(last);
  return { ...detail, body_html: kept };
}

/**
 * The mention rule for group email. In an email that names this agent and at
 * least one other address in To or Cc (see otherParticipants), a body that
 * mentions any of those addresses wakes only the agents it mentions. Mail
 * that mentions none of them, and every email addressed to this agent alone,
 * keeps waking as before.
 *
 * A mention is the full address or `@local-part` in the new text of the
 * message: quoted history and quoted (`>`) lines are removed first, so an
 * earlier message's mention does not count again, and an HTML-only message
 * is read as text without its blockquotes. Mentions of addresses the email
 * was not sent to are ignored.
 *
 * Returns true when this agent should not be woken. Like a muted thread, the
 * email is still received and readable; only the wake is skipped.
 */
export function mentionsOnlyOthers(detail: EmailDetail, self: string): boolean {
  const me = bareAddress(self);
  if (!me) return false;
  const others = otherParticipants(detail, me);
  if (!others.length) return false;
  // The compact body drops trailing quoted history but keeps inline replies
  // whole; drop their quoted lines so only the sender's own words count.
  const text = buildEmailCompact(withoutHtmlQuotes(detail))
    .body_text.split("\n")
    .filter((line) => !/^\s*>/.test(line))
    .join("\n");
  if (!text.includes("@")) return false;
  if (mentionsAddress(text, me)) return false;
  return others.some((address) => mentionsAddress(text, address));
}
