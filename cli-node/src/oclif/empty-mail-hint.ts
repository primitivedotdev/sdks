// What an empty inbound email list tells the caller. "No inbound emails
// received yet on this account" is true only for a credential that reads every
// mailbox and asked for everything. A key limited to email rules reads only
// mail its rules granted it, and a filtered list is empty because nothing
// matched, so each is told that instead. The credential's reach comes from
// GET /whoami/grant, which any credential may ask about itself, read only when
// a list comes back empty and a hint will be printed.
import { getOwnGrant } from "@primitivedotdev/api-core";

type GrantClient = NonNullable<Parameters<typeof getOwnGrant>[0]>["client"];

/**
 * Query parameters that page, shape or modify a list without narrowing which
 * emails it holds on their own. Any other one the caller set is a filter.
 */
const NOT_FILTERS = new Set([
  "cursor",
  "since",
  "limit",
  "include",
  "include_presence",
  "wait",
  "group",
  // These change how --search matches; --search is the filter.
  "search_regex",
  "search_case_sensitive",
  "search_negate",
]);

/** How many addresses, domains or rules the hint names before "and N more". */
const NAMED_MAX = 3;

/** How long the hint waits for the grant before leaving it out. */
const GRANT_TIMEOUT_MS = 2_000;

export const ORG_EMPTY_HINT =
  "(no results) No inbound emails received yet on this account. Send one to a verified domain to populate this list. For a compact view, prefer `primitive emails latest`.";

/** What the hint needs of the caller's grant: what it is, and which mail it reads. */
export type CallerMail = { credentialKind: unknown; mailScope: unknown };

/**
 * The caller's grant from GET /whoami/grant, or undefined when it cannot be
 * read in time: the hint then says only that the credential may be narrowed.
 * Reading mail follows `mail:read`'s own scope where it reaches fewer
 * mailboxes than the grant's.
 */
export async function readCallerMail(
  client: GrantClient,
): Promise<CallerMail | undefined> {
  try {
    const result = await getOwnGrant({
      client,
      responseStyle: "fields",
      signal: AbortSignal.timeout(GRANT_TIMEOUT_MS),
    });
    if (result.error) return undefined;
    const grant = (result.data as { data?: { grant?: unknown } } | undefined)
      ?.data?.grant;
    if (!grant || typeof grant !== "object") return undefined;
    const g = grant as {
      credential_kind?: unknown;
      mail_scope?: unknown;
      scoped_permissions?: unknown;
    };
    const scoped =
      g.scoped_permissions && typeof g.scoped_permissions === "object"
        ? (g.scoped_permissions as Record<string, unknown>)["mail:read"]
        : undefined;
    return {
      credentialKind: g.credential_kind,
      mailScope: scoped ?? g.mail_scope,
    };
  } catch {
    return undefined;
  }
}

/** The query parameters the caller set that narrow which emails are listed. */
export function listFilters(query: Record<string, unknown>): string[] {
  return Object.keys(query).filter((name) => {
    const value = query[name];
    if (NOT_FILTERS.has(name) || value === undefined) return false;
    // Turning an exclusion off narrows nothing.
    return !(name.startsWith("exclude_") && value === false);
  });
}

type Reach =
  | { kind: "org" }
  | { kind: "unknown" }
  | { kind: "unreadable" }
  | { kind: "none" }
  | { kind: "rules_only"; rules: string[] }
  | { kind: "mailboxes"; names: string[]; rules: string[] };

function strings(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((v) => typeof v === "string")
    ? value
    : null;
}

/** What a mail scope from GET /whoami/grant reaches, as far as the hint needs. */
export function mailReach(scope: unknown): Reach {
  if (scope === "org") return { kind: "org" };
  if (scope === "unreadable") return { kind: "unreadable" };
  if (!scope || typeof scope !== "object" || Array.isArray(scope))
    return { kind: "unknown" };
  const record = scope as Record<string, unknown>;
  const addresses = strings(record.addresses ?? []);
  const domains = strings(record.domains ?? []);
  const rules = strings(record.rules ?? []);
  if (!addresses || !domains || !rules) return { kind: "unknown" };
  if (addresses.length === 0 && domains.length === 0) {
    return rules.length > 0 ? { kind: "rules_only", rules } : { kind: "none" };
  }
  // A domain entry that leaves out personal mailboxes says so.
  const exceptPersonal =
    typeof record.excluded_personal_mailboxes === "number" &&
    record.excluded_personal_mailboxes > 0;
  return {
    kind: "mailboxes",
    names: [
      ...addresses,
      ...domains.map((d) =>
        exceptPersonal
          ? `addresses at ${d} other than personal mailboxes`
          : `any address at ${d}`,
      ),
    ],
    rules,
  };
}

function named(names: string[]): string {
  const shown = names.slice(0, NAMED_MAX);
  const rest = names.length - shown.length;
  const all = rest > 0 ? [...shown, `${rest} more`] : shown;
  return all.length <= 1
    ? (all[0] ?? "")
    : `${all.slice(0, -1).join(", ")} and ${all[all.length - 1]}`;
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

const GRANT_POINTER =
  "`primitive whoami --json --grant` shows which mail it reaches.";

/** How a rule grants mail, and who can look at the rules: a key cannot read rules itself. */
function rulesSentence(rules: string[]): string {
  const one = rules.length === 1;
  return `A rule grants an email that matches it on arrival while the rule is active, and the key reads that mail only while the rule stays active. The ${one ? "rule's" : "rules'"} author, signed in as themselves, can check ${one ? "its" : "each one's"} state with \`primitive email-rules get-email-rule --id <rule-id>\` (${named(rules)}).`;
}

/** What the credential reads, as sentences for the hint, or null when it reads every mailbox. */
function reachSentence(reach: Reach, credential: string): string | null {
  switch (reach.kind) {
    case "org":
      return null;
    case "unknown":
      return `This credential may not read every mailbox; ${GRANT_POINTER}`;
    case "unreadable":
      return `The server could not read this credential's stored mail scope, so it reaches no mail. ${GRANT_POINTER}`;
    case "none":
      return `${credential} reads no mail: its grant names no mailbox, domain or email rule. ${GRANT_POINTER}`;
    case "rules_only":
      return `${credential} reads only mail its ${plural(reach.rules.length, "email rule")} granted. ${rulesSentence(reach.rules)}`;
    case "mailboxes":
      return `${credential} reads only ${named(reach.names)}${reach.rules.length > 0 ? `, and mail its ${plural(reach.rules.length, "email rule")} granted` : ""}; mail to the organization's other mailboxes is not listed.`;
  }
}

/**
 * The hint for an empty inbound email list: what was asked (the filter flags
 * given, or a page or tail past the last email), and what this credential
 * reads. `caller` is undefined when the grant could not be read, and null
 * when it was not asked for (a tail poll, which should not double its
 * requests).
 */
export function emptyEmailListHint(input: {
  filterFlags: readonly string[];
  /** The flag that read past the newest or last email, when one did. */
  pastFlag?: "--cursor" | "--since";
  caller: CallerMail | null | undefined;
  /** What to say for a credential that reads every mailbox and asked for everything. */
  orgHint?: string;
}): string {
  const reach: Reach =
    input.caller === null
      ? { kind: "org" }
      : mailReach(input.caller?.mailScope);
  const kind = input.caller?.credentialKind;
  const credential =
    kind === "org_key" || kind === "function_key"
      ? "This key"
      : "This credential";
  const scope = reachSentence(reach, credential);
  const withScope = (lead: string) => `${lead}${scope ? ` ${scope}` : ""}`;
  if (input.filterFlags.length > 0) {
    return withScope(
      `(no results) No inbound emails match the filters given (${input.filterFlags.join(", ")}).`,
    );
  }
  if (input.pastFlag) {
    return withScope(
      `(no results) No inbound emails after the given ${input.pastFlag}.`,
    );
  }
  if (!scope) return input.orgHint ?? ORG_EMPTY_HINT;
  if (reach.kind === "rules_only") {
    return `(no results) No mail ${credential === "This key" ? "this key's" : "this credential's"} rules granted is readable now. ${scope}`;
  }
  if (reach.kind === "mailboxes") {
    return `(no results) No inbound emails yet in the mail this credential reads. ${scope}`;
  }
  return `(no results) No inbound emails to show. ${scope}`;
}
