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
  // Characters an address or a local part can continue with.
  const before = "(?<![\\w.+%-])";
  const after = "(?![\\w%+-]|\\.[\\w-]|@)";
  const full = new RegExp(`${before}${escapeRegExp(bare)}${after}`, "i");
  const handle = new RegExp(
    `(?<![\\w.+%@-])@${escapeRegExp(local)}${after}`,
    "i",
  );
  return full.test(text) || handle.test(text);
}

/**
 * The mention rule for group email. In an email that names this agent and at
 * least one other address in To or Cc (see otherParticipants), a body that
 * mentions any of those addresses wakes only the agents it mentions. Mail
 * that mentions none of them, and every email addressed to this agent alone,
 * keeps waking as before.
 *
 * A mention is the full address or `@local-part` in the new text of the
 * message: quoted history is removed first, so an earlier message's mention
 * does not count again, and an HTML-only message is read as text. Mentions of
 * addresses the email was not sent to are ignored.
 *
 * Returns true when this agent should not be woken. Like a muted thread, the
 * email is still received and readable; only the wake is skipped.
 */
export function mentionsOnlyOthers(detail: EmailDetail, self: string): boolean {
  const me = bareAddress(self);
  if (!me) return false;
  const others = otherParticipants(detail, me);
  if (!others.length) return false;
  const text = buildEmailCompact(detail).body_text;
  if (!text.includes("@")) return false;
  if (mentionsAddress(text, me)) return false;
  return others.some((address) => mentionsAddress(text, address));
}
