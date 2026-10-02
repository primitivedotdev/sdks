import type { EmailDetail } from "@primitivedotdev/api-core";
import { bareAddress } from "./wake-context.js";

/**
 * Everyone else an email was addressed to: its parsed To and Cc, as bare
 * lowercase addresses, without `self` (the mailbox reading it) or the sender,
 * in header order and de-duplicated. Bcc is never read. These are the
 * addresses `primitive reply --all` copies, and a non-empty list is what makes
 * an email a group email.
 *
 * Empty unless To or Cc names `self`. Mail that reached you without naming you
 * (a blind copy, an alias, a list) is not treated as a group: a blind
 * recipient who replies to everyone reveals the blind copy.
 *
 * To and Cc are written by the sender, so treat the list as the sender's
 * claim about who else received it, not as proof. Display them through
 * displayAddress, which withholds anything outside a plain charset.
 */
export function otherParticipants(detail: EmailDetail, self: string): string[] {
  const parsed = detail.parsed as
    | { to_addresses?: unknown; cc?: unknown }
    | null
    | undefined;
  const me = bareAddress(self);
  const excluded = new Set(
    [me, bareAddress(detail.from_email)].filter(
      (value): value is string => value !== null,
    ),
  );
  const out: string[] = [];
  let named = false;
  for (const list of [parsed?.to_addresses, parsed?.cc]) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      const raw =
        typeof entry === "string"
          ? entry
          : entry && typeof entry === "object"
            ? (entry as { address?: unknown }).address
            : null;
      const address = bareAddress(raw);
      if (address !== null && address === me) named = true;
      if (!address || excluded.has(address)) continue;
      excluded.add(address);
      out.push(address);
    }
  }
  return named ? out : [];
}
