// What an empty inbound email list tells the caller. "No inbound emails
// received yet on this account" is true only for a credential that reads every
// mailbox and asked for everything. A key limited to email rules reads only
// mail its rules granted it, and a filtered list is empty because nothing
// matched, so each is told that instead (the credential's reach comes from
// GET /whoami, read only when a list comes back empty).

type ApiClient = {
  get: (options: {
    responseStyle: "fields";
    security: Array<{ scheme: "bearer"; type: "http" }>;
    url: string;
  }) => Promise<{ data?: unknown; error?: unknown }>;
};

/**
 * Query parameters that page or shape a list without narrowing which emails
 * it holds. Any other one the caller set is a filter.
 */
const NOT_FILTERS = new Set([
  "cursor",
  "limit",
  "include",
  "include_presence",
  "wait",
]);

/** How many addresses and domains the hint names before "and N more". */
const NAMED_MAX = 3;

export const ORG_EMPTY_HINT =
  "(no results) No inbound emails received yet on this account. Send one to a verified domain to populate this list. For a compact view, prefer `primitive emails latest`.";

/** The credential's mail scope as GET /whoami describes it, or undefined when it could not be read. */
export async function readCallerMailScope(client: ApiClient): Promise<unknown> {
  try {
    const result = await client.get({
      responseStyle: "fields",
      security: [{ scheme: "bearer", type: "http" }],
      url: "/whoami",
    });
    if (result.error) return undefined;
    const data = (result.data as { data?: unknown } | undefined)?.data;
    const grant =
      data && typeof data === "object"
        ? (data as { grant?: unknown }).grant
        : undefined;
    if (!grant || typeof grant !== "object") return undefined;
    return (grant as { mail_scope?: unknown }).mail_scope;
  } catch {
    return undefined;
  }
}

/** The query parameters the caller set that narrow which emails are listed. */
export function listFilters(query: Record<string, unknown>): string[] {
  return Object.keys(query).filter(
    (name) => !NOT_FILTERS.has(name) && query[name] !== undefined,
  );
}

type Reach =
  | { kind: "org" }
  | { kind: "unknown" }
  | { kind: "none" }
  | { kind: "rules_only"; rules: number }
  | { kind: "mailboxes"; names: string[]; rules: number };

function strings(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((v) => typeof v === "string")
    ? value
    : null;
}

/** What a mail scope from GET /whoami reaches, as far as the hint needs. */
export function mailReach(scope: unknown): Reach {
  if (scope === "org") return { kind: "org" };
  if (scope === "unreadable") return { kind: "none" };
  if (!scope || typeof scope !== "object" || Array.isArray(scope))
    return { kind: "unknown" };
  const record = scope as Record<string, unknown>;
  const addresses = strings(record.addresses ?? []);
  const domains = strings(record.domains ?? []);
  const rules = strings(record.rules ?? []);
  if (!addresses || !domains || !rules) return { kind: "unknown" };
  if (addresses.length === 0 && domains.length === 0) {
    return rules.length > 0
      ? { kind: "rules_only", rules: rules.length }
      : { kind: "none" };
  }
  return {
    kind: "mailboxes",
    names: [...addresses, ...domains.map((d) => `any address at ${d}`)],
    rules: rules.length,
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

const RULES_GRANT =
  "A rule grants an email only when the email matches while the rule is active, and never mail that arrived before; check each rule's state with `primitive email-rules get-email-rule --id <rule-id>`.";

/** What the credential reads, as a sentence for the hint, or null when it reads every mailbox. */
function reachSentence(reach: Reach): string | null {
  switch (reach.kind) {
    case "org":
      return null;
    case "unknown":
      return "This credential may not read every mailbox; `primitive whoami` shows which mail it reaches.";
    case "none":
      return "This credential reads no mail: its grant names no mailbox, domain or email rule. `primitive whoami` shows its grant.";
    case "rules_only":
      return `This key reads only mail its ${plural(reach.rules, "email rule")} granted it. ${RULES_GRANT}`;
    case "mailboxes":
      return `This credential reads only ${named(reach.names)}${reach.rules > 0 ? `, and mail its ${plural(reach.rules, "email rule")} granted it` : ""}; mail to the organization's other mailboxes is not listed.`;
  }
}

/**
 * The hint for an empty inbound email list: what was asked (the filter flags
 * given, or a page past the last), and what this credential reads.
 */
export function emptyEmailListHint(input: {
  filterFlags: readonly string[];
  paged: boolean;
  mailScope: unknown;
  /** What to say for a credential that reads every mailbox and asked for everything. */
  orgHint?: string;
}): string {
  const reach = mailReach(input.mailScope);
  const scope = reachSentence(reach);
  if (input.filterFlags.length > 0) {
    return `(no results) No inbound emails match the filters given (${input.filterFlags.join(", ")}).${scope ? ` ${scope}` : ""}`;
  }
  if (input.paged) {
    return `(no results) No more inbound emails after this cursor.${scope ? ` ${scope}` : ""}`;
  }
  if (!scope) return input.orgHint ?? ORG_EMPTY_HINT;
  if (reach.kind === "rules_only") {
    return `(no results) No email has been granted to this key yet. ${scope}`;
  }
  if (reach.kind === "mailboxes") {
    return `(no results) No inbound emails yet in the mail this credential reads. ${scope}`;
  }
  return `(no results) No inbound emails to show. ${scope}`;
}
