// What an empty inbound email list tells the caller. "No inbound emails
// received yet on this account" is true only for a credential that reads every
// mailbox and asked for everything. A key limited to email rules reads only
// mail its rules granted it, and a filtered list is empty because nothing
// matched, so each is told that instead. The credential's reach comes from
// GET /whoami/grant, read only when a list comes back empty and a hint will be
// printed. A connected agent's key may not ask it; such a key reads the address
// it was connected for, which the CLI already knows.
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
export const GRANT_TIMEOUT_MS = 2_000;

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
  timeoutMs = GRANT_TIMEOUT_MS,
): Promise<CallerMail | undefined> {
  try {
    const result = await getOwnGrant({
      client,
      responseStyle: "fields",
      signal: AbortSignal.timeout(timeoutMs),
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

/**
 * What the caller reads, for the hint: a connected agent's key from the
 * address it was connected for (it may not ask GET /whoami/grant), any other
 * credential from GET /whoami/grant.
 */
export async function readCallerMailFor(
  auth: {
    apiKey?: string | undefined;
    connectedAgent?: { agentAddress?: string } | undefined;
  },
  client: GrantClient,
): Promise<CallerMail | undefined> {
  const address = auth.connectedAgent?.agentAddress;
  if (address) {
    return {
      credentialKind: "connected_key",
      mailScope: { addresses: [address], domains: [] },
    };
  }
  if (auth.apiKey?.startsWith("pconn_")) {
    return { credentialKind: "connected_key", mailScope: undefined };
  }
  return readCallerMail(client);
}

/** The query parameters the caller set that narrow which emails are listed. */
export function listFilters(query: Record<string, unknown>): string[] {
  return Object.keys(query).filter((name) => {
    const value = query[name];
    if (NOT_FILTERS.has(name) || value === undefined) return false;
    const off = value === false || value === "false";
    // Turning an exclusion off narrows nothing; leaving presence mail out does.
    if (name.startsWith("exclude_")) return !off;
    if (name === "include_presence") return off;
    return true;
  });
}

type Reach =
  | { kind: "org" }
  | { kind: "unknown" }
  | { kind: "unreadable" }
  | { kind: "outbound_only" }
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
  // Mail a rule granted is read whatever the direction, so only a scope with no rules reads no received mail.
  if (record.direction === "outbound" && rules.length === 0)
    return { kind: "outbound_only" };
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
          ? `addresses at ${d} other than other members' personal mailboxes`
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

/**
 * How a rule grants mail, and who can look at it: a key cannot read rules
 * itself. An id a key lists is an email rule, or a rule shared with the key's
 * holder, which its holder checks as a share.
 */
function rulesSentence(rules: string[]): string {
  return `A rule grants an email it matches when the email is evaluated, shortly after it arrives, while the rule is active, and the key reads that mail only while the rule stays active. Each id (${named(rules)}) is an email rule or a rule shared with the key's holder: a rule's author, signed in as themselves, can check it with \`primitive email-rules get-email-rule --id <id>\`, and a share's holder with \`primitive email-rules get-email-rule-share --id <id>\`.`;
}

/** Who holds the credential, which decides what else it reads beside its grant. */
type Holder = "key" | "connection" | "person" | "unknown";

function holderOf(kind: unknown): Holder {
  if (kind === "org_key" || kind === "function_key") return "key";
  if (kind === "connected_key") return "connection";
  return typeof kind === "string" ? "person" : "unknown";
}

const NOUN: Record<Holder, string> = {
  key: "This key",
  connection: "This connection key",
  person: "This login",
  unknown: "This credential",
};

/** A person also reads mail through rules colleagues shared with them, which sit beside the grant, not in it. */
const SHARED =
  "mail from email rules colleagues shared with you (`primitive email-rules list-email-rule-shares` lists them)";

/** A connection key also reads member mailboxes its owner gave it, asked for by name. */
const GIVEN =
  "any member mailbox its owner gave it (pass that mailbox with --recipient)";

/** What the credential reads, as sentences for the hint, or null when it reads every mailbox. */
function reachSentence(reach: Reach, holder: Holder): string | null {
  const noun = NOUN[holder];
  switch (reach.kind) {
    case "org":
      return null;
    case "unknown":
      return holder === "connection"
        ? `${noun} reads the address it was connected for, and ${GIVEN}.`
        : `${noun} may not read every mailbox; ${GRANT_POINTER}`;
    case "outbound_only":
      return holder === "person"
        ? `${noun} reads no received mail through its grant, which covers sent mail only, but does read ${SHARED}. ${GRANT_POINTER}`
        : `${noun} reads no received mail: its grant covers sent mail only. ${GRANT_POINTER}`;
    case "unreadable":
      return `The server could not read this credential's stored mail scope, so it reaches no mail through it. ${GRANT_POINTER}`;
    case "none":
      return holder === "person"
        ? `${noun} reads no mailbox through its grant, only ${SHARED}. ${GRANT_POINTER}`
        : `${noun} reads no mail: its grant names no mailbox or domain, and no email rule or live share. ${GRANT_POINTER}`;
    case "rules_only":
      return `${noun} reads only mail its ${plural(reach.rules.length, "email rule")} granted. ${rulesSentence(reach.rules)}`;
    case "mailboxes": {
      const parts = [
        named(reach.names),
        ...(reach.rules.length > 0
          ? [`mail its ${plural(reach.rules.length, "email rule")} granted`]
          : []),
        ...(holder === "connection" ? [GIVEN] : []),
        ...(holder === "person" ? [SHARED] : []),
      ];
      const all =
        parts.length === 1
          ? parts[0]
          : `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
      return holder === "connection"
        ? `${noun} reads only ${all}.`
        : `${noun} reads ${holder === "person" ? "" : "only "}${all}; other mail is not listed.`;
    }
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
  const holder = holderOf(input.caller?.credentialKind);
  const scope = reachSentence(reach, holder);
  const withScope = (lead: string) => `${lead}${scope ? ` ${scope}` : ""}`;
  // A connection key leaves presence mail out by default, so asking it to narrows nothing.
  const filters =
    holder === "connection"
      ? input.filterFlags.filter((f) => !f.startsWith("--include-presence"))
      : input.filterFlags;
  if (filters.length > 0) {
    return withScope(
      `(no results) No inbound emails match the filters given (${filters.join(", ")}).`,
    );
  }
  if (input.pastFlag) {
    // A page past the last of the history, or a tail with nothing newer.
    return withScope(
      input.pastFlag === "--cursor"
        ? "(no results) No more inbound emails past the given --cursor."
        : "(no results) No inbound emails after the given --since.",
    );
  }
  if (!scope) return input.orgHint ?? ORG_EMPTY_HINT;
  const noun = NOUN[holder].replace(/^This/, "this");
  if (reach.kind === "rules_only") {
    return `(no results) No mail ${noun}'s rules granted is readable now. ${scope}`;
  }
  if (reach.kind === "mailboxes") {
    return `(no results) No inbound emails yet in the mail ${noun} reads. ${scope}`;
  }
  return `(no results) No inbound emails to show. ${scope}`;
}
