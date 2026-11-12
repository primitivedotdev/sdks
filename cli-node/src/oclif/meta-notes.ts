// Notes on stderr for what an answer's `meta` says about the data a generated
// command prints. Some answers set a meta field to true when the data needs a
// word of context: an empty email list whose --recipient the credential does
// not read, say, or a search page cut short by its time limit. Without --json
// the command prints the data alone, so these would go unseen; each is
// printed as one line on stderr. Under --json nothing is added: the document
// stays the data alone, and with --envelope its meta already carries them.
//
// Notes are keyed by the meta field's name, so any command whose answer
// carries one prints it. Only fields that change how the printed data reads
// are here. Fields that qualify meta.total or the facets (total_capped,
// total_unavailable, facets_capped, facets_unavailable) sit beside the value
// they qualify, which only --envelope prints.

/** The note for a meta field that is true, given the whole meta. */
type MetaNote = (meta: Record<string, unknown>) => string;

export const META_NOTES: Readonly<Record<string, MetaNote>> = {
  // listEmails: EmailListMeta.
  recipient_outside_access: () =>
    "Note: this credential does not read the mailbox --recipient names, so the list is empty however much mail that mailbox holds.",
  recipient_rules_only: () =>
    "Note: this credential reads the mailbox --recipient names only through email rules, so the list holds only the mail those rules give it there.",
  // searchEmails: EmailSearchMeta.
  partial: () =>
    "Note: the search stopped at its time limit before this page filled, so a short page is not the end of the results: continue with the next cursor until it is null.",
  // getSendPermissions: SendPermissionsMeta.
  replies_only: () =>
    "Note: this credential can only reply to mail it received (it holds mail:reply but not mail:send). These rules apply to its replies; it cannot start a new message.",
  truncated: (meta) =>
    typeof meta.address_cap === "number"
      ? `Note: the organization has more known addresses than the ${meta.address_cap} address rules listed here.`
      : "Note: the organization has more known addresses than the address rules listed here.",
};

/** One line per meta field in META_NOTES that is true, in that order. */
export function metaNoteLines(meta: unknown): string[] {
  if (meta === null || typeof meta !== "object" || Array.isArray(meta))
    return [];
  const record = meta as Record<string, unknown>;
  return Object.entries(META_NOTES)
    .filter(([field]) => record[field] === true)
    .map(([, note]) => note(record));
}

/**
 * Whether the answer's meta already says why a list is empty, so the generic
 * empty-list hint (and the grant read behind it) would only repeat it.
 */
export function metaExplainsEmptyList(meta: unknown): boolean {
  return (
    meta !== null &&
    typeof meta === "object" &&
    (meta as Record<string, unknown>).recipient_outside_access === true
  );
}
