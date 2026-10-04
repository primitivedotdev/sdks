/**
 * `sent list` under a connected agent profile returns this address's own
 * sends and also delivered sends from other addresses in the organization
 * that were addressed to it. Those rows look like sends but are mail this
 * address received, so an agent scanning for its own message can conclude
 * it was never sent. This note says which rows are which.
 */

function bareAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const address = value.trim().toLowerCase();
  return address.includes("@") ? address : null;
}

/**
 * A one-line note when some rows were not sent by `self`, or null when every
 * row is this address's own send (or `self` is unknown).
 */
export function sentListOtherSendersNote(
  rows: unknown,
  self: string | undefined,
): string | null {
  const own = bareAddress(self);
  if (!own || !Array.isArray(rows) || rows.length === 0) return null;
  const others = new Set<string>();
  let count = 0;
  for (const row of rows) {
    const from = bareAddress(
      row && typeof row === "object"
        ? (row as { from_address?: unknown }).from_address
        : undefined,
    );
    if (!from || from === own) continue;
    count += 1;
    others.add(from);
  }
  if (count === 0) return null;
  const senders = [...others].sort();
  const named =
    senders.length > 3
      ? `${senders.slice(0, 3).join(", ")} and ${senders.length - 3} more`
      : senders.join(", ");
  return `${count} of ${rows.length} rows were sent by another address in this organization (${named}) to ${own}; they are mail ${own} received, not its own sends. Rows with from_address ${own} are this address's sends; pass --from ${own} to list only those.`;
}
