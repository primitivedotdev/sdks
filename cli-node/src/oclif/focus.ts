// Domain focus: which of the credential's domains mail listings and searches
// show. A person or agent on an account with several domains chooses once,
// with `primitive focus set <domain...>` or `primitive focus set --all`; the
// choice is saved per profile (the member login in the CLI config directory,
// a connected agent in its own profile directory, never in a credential file)
// and every filtered command says so on stderr, or in `meta.focus` under
// --json. `--domain <name...>` and `--all-domains` override it for one
// command, PRIMITIVE_FOCUS_DOMAINS for a session.
//
// Focus narrows listings and searches only. Reads by id, notifications (listen,
// wait-for-mail, check-mail wake-ups) and the CLI's own bookkeeping never
// follow it, so they are built without this module.
import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { Errors, Flags } from "@oclif/core";
import { listDomains } from "@primitivedotdev/api-core";
import { agentProfileDirectory } from "./connected-agent-profile.js";

export const FOCUS_ENV = "PRIMITIVE_FOCUS_DOMAINS";

/**
 * The request parameter each kind of listing filters domains with, a list of
 * domain ids, or null where the server has none. A command whose parameter is
 * null runs unfiltered and says the focus was not applied.
 *
 * inbound: GET /emails and GET /emails/search (the receiving domain). sent:
 * GET /sent-emails (the sending domain). semantic: the POST /semantic-search
 * body, which then searches received mail only. `many` says a focus may name
 * several domains; while false it names one at a time.
 */
export const FOCUS_SERVER_SUPPORT: {
  inbound: string | null;
  sent: string | null;
  semantic: string | null;
  many: boolean;
} = {
  inbound: "domain_ids",
  sent: "domain_ids",
  semantic: "domain_ids",
  many: true,
};

/** Which kind of listing a command is, for FOCUS_SERVER_SUPPORT. */
export type FocusSurface = "inbound" | "sent" | "semantic";

/** The most domain ids one filter takes. */
export const MAX_FOCUS_DOMAINS = 50;

export type FocusDomain = { name: string; id: string };

export type FocusChoice = { all: true } | { domains: FocusDomain[] };

/** What one profile saved for one organization. */
export type SavedFocus = {
  choice: FocusChoice | null;
  chosen_at?: string;
};

export type FocusSource = "flag" | "env" | "profile" | "none";

/** `meta.focus` under --json. */
export type FocusMeta = {
  /** The focused domain names; empty when every domain is shown. */
  domains: string[];
  all: boolean;
  source: FocusSource;
  /** False when this command cannot filter by domain yet. */
  applied: boolean;
  /** Semantic search with a focus searches received mail only. */
  received_only?: boolean;
  widen: string[];
};

/** How a listing is focused: what to send, and what to tell the caller. */
export type FocusOutcome = {
  /** Query (or body) fields that narrow the request. */
  params: Record<string, unknown>;
  meta: FocusMeta | null;
  /** The stderr line in text mode, or null for none. */
  line: string | null;
  /** The focused domains when a filter was sent. */
  focused: FocusDomain[] | null;
  /** The credential's domains, when they were read. */
  readable: FocusDomain[] | null;
};

export const NO_FOCUS: FocusOutcome = {
  params: {},
  meta: null,
  line: null,
  focused: null,
  readable: null,
};

export const DOMAIN_FLAG_DESCRIPTION =
  "Only mail on this domain, by name, for this command (overrides the saved focus and PRIMITIVE_FOCUS_DOMAINS). See `primitive focus`.";
export const ALL_DOMAINS_FLAG_DESCRIPTION =
  "Mail on every domain this credential reads, for this command, ignoring the saved focus and PRIMITIVE_FOCUS_DOMAINS.";

/** The two focus flags every focused listing takes. */
/**
 * The two focus flags every focused listing takes. `unfiltered` marks a
 * command the server cannot filter by domain yet, whose --domain is refused.
 */
export function focusFlags(unfiltered = false) {
  return {
    domain: Flags.string({
      description: unfiltered
        ? "Not available here yet: this command cannot filter by domain, so it lists every domain. See `primitive focus`."
        : DOMAIN_FLAG_DESCRIPTION,
      // Repeatable, but never greedy: a positional query after it stays one.
      multiple: true,
      multipleNonGreedy: true,
    }),
    "all-domains": Flags.boolean({
      description: ALL_DOMAINS_FLAG_DESCRIPTION,
    }),
  };
}

export type FocusFlagValues = {
  domain?: string[] | undefined;
  allDomains?: boolean | undefined;
};

export function focusFlagValues(
  flags: Record<string, unknown>,
): FocusFlagValues {
  const domain = flags.domain;
  return {
    domain: Array.isArray(domain)
      ? domain.filter((d): d is string => typeof d === "string")
      : typeof domain === "string"
        ? [domain]
        : undefined,
    allDomains: flags["all-domains"] === true,
  };
}

// ---------------------------------------------------------------------------
// Storage

/** Where a profile's focus is saved. */
export type FocusProfile =
  | { kind: "member"; path: string }
  | { kind: "agent"; name: string; path: string };

const FOCUS_FILE = "focus.json";

export function focusProfile(
  configDir: string,
  auth: { connectedAgent?: { profileName: string } | undefined },
): FocusProfile {
  const name = auth.connectedAgent?.profileName;
  if (name) {
    return {
      kind: "agent",
      name,
      path: join(agentProfileDirectory(configDir, name), FOCUS_FILE),
    };
  }
  return { kind: "member", path: join(configDir, FOCUS_FILE) };
}

type FocusFile = { version: 1; orgs: Record<string, SavedFocus> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseChoice(value: unknown): FocusChoice | null {
  if (!isRecord(value)) return null;
  if (value.all === true) return { all: true };
  if (!Array.isArray(value.domains)) return null;
  const domains: FocusDomain[] = [];
  for (const entry of value.domains) {
    if (
      !isRecord(entry) ||
      typeof entry.name !== "string" ||
      typeof entry.id !== "string"
    )
      return null;
    domains.push({ name: entry.name, id: entry.id });
  }
  return domains.length > 0 ? { domains } : null;
}

function parseSaved(value: unknown): SavedFocus | null {
  if (!isRecord(value)) return null;
  return {
    choice: parseChoice(value.choice),
    ...(typeof value.chosen_at === "string"
      ? { chosen_at: value.chosen_at }
      : {}),
  };
}

function readFocusFile(path: string): FocusFile {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return { version: 1, orgs: {} };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !isRecord(parsed.orgs))
      return { version: 1, orgs: {} };
    const orgs: Record<string, SavedFocus> = {};
    for (const [org, saved] of Object.entries(parsed.orgs)) {
      const value = parseSaved(saved);
      if (value) orgs[org] = value;
    }
    return { version: 1, orgs };
  } catch {
    // A damaged file reads as no focus; the next choice rewrites it.
    return { version: 1, orgs: {} };
  }
}

function writeFocusFile(path: string, file: FocusFile): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(file, null, 2)}\n`, {
      mode: 0o600,
    });
    renameSync(temporary, path);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

export function loadSavedFocus(
  profile: FocusProfile,
  orgId: string,
): SavedFocus | null {
  return readFocusFile(profile.path).orgs[orgId] ?? null;
}

export function saveFocus(
  profile: FocusProfile,
  orgId: string,
  update: (current: SavedFocus | null) => SavedFocus | null,
): void {
  const file = readFocusFile(profile.path);
  const next = update(file.orgs[orgId] ?? null);
  if (next === null) delete file.orgs[orgId];
  else file.orgs[orgId] = next;
  writeFocusFile(profile.path, file);
}

// ---------------------------------------------------------------------------
// The credential's domains

type DomainsClient = NonNullable<Parameters<typeof listDomains>[0]>["client"];

export type ReadableDomains = { orgId: string | null; domains: FocusDomain[] };

/** How long reading the domains may take before focus gives up on them. */
export const DOMAINS_TIMEOUT_MS = 5_000;

/**
 * The verified domains this credential can read mail on, from GET /domains,
 * which lists only the domains a credential confined to some mailboxes
 * reaches. Null when they cannot be read.
 */
export async function readReadableDomains(
  client: DomainsClient,
  timeoutMs = DOMAINS_TIMEOUT_MS,
): Promise<ReadableDomains | null> {
  try {
    const result = await listDomains({
      client,
      responseStyle: "fields",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (result.error) return null;
    const rows = (result.data as { data?: unknown } | undefined)?.data;
    if (!Array.isArray(rows)) return null;
    let orgId: string | null = null;
    const domains: FocusDomain[] = [];
    for (const row of rows) {
      if (!isRecord(row) || row.verified !== true) continue;
      if (typeof row.id !== "string" || typeof row.domain !== "string")
        continue;
      if (typeof row.org_id === "string") orgId ??= row.org_id;
      domains.push({ name: row.domain.toLowerCase(), id: row.id });
    }
    domains.sort((a, b) => a.name.localeCompare(b.name));
    return { orgId, domains };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Errors

function focusError(
  message: string,
  code: string,
  exit: number,
  details?: Record<string, unknown>,
): Errors.CLIError {
  const error = new Errors.CLIError(message, { exit, code });
  if (details)
    (error as Errors.CLIError & { details?: unknown }).details = details;
  return error;
}

export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The refusal a multi-domain credential sees once before it chooses. */
export function focusRequiredError(domains: FocusDomain[]): Errors.CLIError {
  const names = domains.map((d) => d.name);
  const example = names[0] ?? "<domain>";
  return focusError(
    `This credential reads mail on ${names.length} domains: ${joinNames(names)}. Choose which this profile lists and searches: \`primitive focus set ${example}\` (one or more domains) or \`primitive focus set --all\` (every domain). The choice is saved for this profile, and listings and searches are refused until it is made; for one command, pass --domain <name> or --all-domains.`,
    "focus_required",
    2,
    {
      domains: names,
      choices: ["primitive focus set <domain...>", "primitive focus set --all"],
    },
  );
}

/** Refused while the server filters one domain at a time. */
export function oneDomainAtATimeError(names: string[]): Errors.CLIError {
  return focusError(
    `A focus names one domain for now (got ${joinNames(names)}): mail listings filter one domain at a time. Name one, or use --all-domains.`,
    "usage_error",
    2,
  );
}

/** Whether a focus may name more than one domain. */
export function manyDomainsSupported(): boolean {
  return FOCUS_SERVER_SUPPORT.many;
}

/** Names normalized: trimmed, lower case, without duplicates. */
export function normalizeDomainNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const raw of names) {
    for (const part of raw.split(/[\s,]+/)) {
      const name = part.trim().toLowerCase().replace(/\.$/, "");
      if (name) seen.add(name);
    }
  }
  return [...seen];
}

/** The named domains, looked up among the readable ones, or an error naming those missing. */
export function resolveDomainNames(
  names: readonly string[],
  readable: readonly FocusDomain[],
  origin: string,
): FocusDomain[] {
  const byName = new Map(readable.map((d) => [d.name, d]));
  const missing = names.filter((n) => !byName.has(n));
  if (missing.length > 0) {
    throw focusError(
      `${origin} names ${joinNames(missing)}, which ${missing.length === 1 ? "is not a domain" : "are not domains"} this credential reads mail on. ${
        readable.length > 0
          ? `It reads ${joinNames(readable.map((d) => d.name))}.`
          : "It reads no verified domain."
      }`,
      "focus_domain_unknown",
      2,
      { unknown: missing, domains: readable.map((d) => d.name) },
    );
  }
  return names.map((n) => byName.get(n) as FocusDomain);
}

/** A saved domain the credential no longer reads (deleted, or access removed). */
export function focusDomainGoneError(
  gone: FocusDomain[],
  profile: FocusProfile,
): Errors.CLIError {
  const names = gone.map((d) => d.name);
  return focusError(
    `The saved focus${profile.kind === "agent" ? ` of agent profile ${profile.name}` : ""} names ${joinNames(names)}, which this credential no longer reads mail on (the domain may have been deleted). Choose again with \`primitive focus set <domain...>\` or \`primitive focus set --all\`, or run \`primitive focus clear\`.`,
    "focus_domain_missing",
    1,
    { missing: names },
  );
}

// ---------------------------------------------------------------------------
// Resolution

/** What the caller asked for, before it is checked against the domains. */
type Requested =
  | { source: "flag" | "env"; all: true }
  | { source: "flag" | "env"; names: string[] };

function requested(
  flags: FocusFlagValues,
  env: Record<string, string | undefined>,
): Requested | null {
  if (flags.allDomains && flags.domain && flags.domain.length > 0) {
    throw focusError(
      "Pass --domain or --all-domains, not both.",
      "usage_error",
      2,
    );
  }
  if (flags.allDomains) return { source: "flag", all: true };
  if (flags.domain && flags.domain.length > 0) {
    const names = normalizeDomainNames(flags.domain);
    if (names.length === 0)
      throw focusError("--domain needs a domain name.", "usage_error", 2);
    return { source: "flag", names };
  }
  const fromEnv = env[FOCUS_ENV]?.trim();
  if (fromEnv) {
    if (fromEnv.toLowerCase() === "all") return { source: "env", all: true };
    return { source: "env", names: normalizeDomainNames([fromEnv]) };
  }
  return null;
}

const SOURCE_TEXT: Record<Exclude<FocusSource, "none">, string> = {
  flag: "from --domain",
  env: `from ${FOCUS_ENV}`,
  profile: "saved focus",
};

function widenFor(source: FocusSource): string[] {
  if (source === "flag") return ["drop --domain", "--all-domains"];
  if (source === "env") return ["--all-domains", `unset ${FOCUS_ENV}`];
  return ["--all-domains", "primitive focus clear"];
}

export type ResolveFocusParams = {
  surface: FocusSurface;
  configDir: string;
  auth: {
    credentials?: { org_id?: string } | null | undefined;
    connectedAgent?: { profileName: string; orgId?: string } | undefined;
  };
  client: DomainsClient;
  flags: FocusFlagValues;
  /**
   * Set when the command was given a scope of its own, such as --domain-id or
   * an exact recipient: the session's and the profile's focus then neither
   * apply nor ask.
   */
  explicitScope?: boolean;
  /** A flag of the command's own that --domain cannot be given with, such as --domain-id. */
  conflictingFlag?: string | undefined;
  env?: Record<string, string | undefined>;
  /** Read the domains (tests replace it). */
  readDomains?: (client: DomainsClient) => Promise<ReadableDomains | null>;
  now?: () => Date;
};

/**
 * How this listing is focused: from --domain or --all-domains, then
 * PRIMITIVE_FOCUS_DOMAINS, then the profile's saved focus. A credential that
 * reads mail on more than one domain and never chose is refused once with
 * `focus_required` (exit 2); after that refusal, or once it chose, it is
 * never asked again. A credential with one domain never sees any of it.
 */
export async function resolveFocus(
  params: ResolveFocusParams,
): Promise<FocusOutcome> {
  const env = params.env ?? process.env;
  const asked = requested(params.flags, env);
  // A scope the command was given wins over the session's and the profile's
  // focus; only --domain or --all-domains on the same command still apply.
  if (params.explicitScope && asked?.source !== "flag") return NO_FOCUS;
  if (params.conflictingFlag && asked?.source === "flag" && "names" in asked)
    throw focusError(
      `Pass --domain or ${params.conflictingFlag}, not both.`,
      "usage_error",
      2,
    );
  // --all-domains needs no domains. The session variable does, so that a
  // credential with one domain never sees it.
  if (asked?.source === "flag" && "all" in asked) {
    return {
      ...NO_FOCUS,
      meta: {
        domains: [],
        all: true,
        source: asked.source,
        applied: true,
        widen: [],
      },
    };
  }

  const profile = focusProfile(params.configDir, params.auth);
  const read = params.readDomains ?? readReadableDomains;
  const readable = await read(params.client);
  const orgId =
    readable?.orgId ??
    params.auth.connectedAgent?.orgId ??
    params.auth.credentials?.org_id ??
    null;

  if (asked?.source === "env" && readable && readable.domains.length <= 1)
    return NO_FOCUS;
  if (asked && "all" in asked) {
    return {
      ...NO_FOCUS,
      meta: {
        domains: [],
        all: true,
        source: asked.source,
        applied: true,
        widen: [],
      },
    };
  }
  if (asked) {
    if (!readable) {
      throw focusError(
        `Could not read this credential's domains to look up ${joinNames(asked.names)}; retry, or pass --all-domains.`,
        "focus_lookup_failed",
        1,
      );
    }
    const domains = resolveDomainNames(
      asked.names,
      readable.domains,
      asked.source === "flag" ? "--domain" : FOCUS_ENV,
    );
    return focusedOutcome(params.surface, domains, asked.source, readable);
  }

  const saved = orgId ? loadSavedFocus(profile, orgId) : null;
  const choice = saved?.choice ?? null;
  // A saved domain that is gone fails first, even when one domain is left:
  // listing the one left in its place would read as the focused domain.
  if (readable && choice && "domains" in choice) {
    const ids = new Set(readable.domains.map((d) => d.id));
    const gone = choice.domains.filter((d) => !ids.has(d.id));
    if (gone.length > 0) throw focusDomainGoneError(gone, profile);
  }
  // One domain, or none: nothing to choose between.
  if (readable && readable.domains.length <= 1) return NO_FOCUS;

  if (choice) {
    if ("all" in choice) {
      return {
        ...NO_FOCUS,
        readable: readable?.domains ?? null,
        meta: {
          domains: [],
          all: true,
          source: "profile",
          applied: true,
          widen: [],
        },
      };
    }
    return focusedOutcome(params.surface, choice.domains, "profile", readable);
  }

  // Never chosen: refused until a choice is saved, so no listing ever shows
  // mail from a domain nobody chose. Without the domains there is nothing to
  // name, so no ask.
  if (!readable || !orgId) return NO_FOCUS;
  throw focusRequiredError(readable.domains);
}

/** The request fields for a focus on these domains, or null where the surface cannot filter. */
export function focusParams(
  surface: FocusSurface,
  domains: readonly FocusDomain[],
): Record<string, unknown> | null {
  const ids = domains.map((d) => d.id);
  const name = FOCUS_SERVER_SUPPORT[surface];
  if (!name) return null;
  if (ids.length > MAX_FOCUS_DOMAINS)
    throw focusError(
      `A focus names at most ${MAX_FOCUS_DOMAINS} domains (got ${ids.length}). Name fewer, or use --all-domains.`,
      "usage_error",
      2,
    );
  if (ids.length > 1 && !FOCUS_SERVER_SUPPORT.many)
    throw oneDomainAtATimeError(domains.map((d) => d.name));
  // The query routes take the ids comma-separated; the semantic body a list.
  return { [name]: surface === "semantic" ? ids : ids.join(",") };
}

function focusedOutcome(
  surface: FocusSurface,
  domains: FocusDomain[],
  source: Exclude<FocusSource, "none">,
  readable: ReadableDomains | null,
): FocusOutcome {
  const names = domains.map((d) => d.name);
  const params = focusParams(surface, domains);
  const widen = widenFor(source);
  if (params === null) {
    if (source === "flag")
      throw focusError(
        "--domain cannot filter this command yet: it lists every domain. Leave --domain out.",
        "usage_error",
        2,
      );
    return {
      params: {},
      focused: null,
      readable: readable?.domains ?? null,
      meta: { domains: names, all: false, source, applied: false, widen },
      line: `Focus on ${joinNames(names)} (${SOURCE_TEXT[source]}) not applied: this command cannot filter by domain yet, so it shows every domain.`,
    };
  }
  return {
    params,
    focused: domains,
    readable: readable?.domains ?? null,
    meta: {
      domains: names,
      all: false,
      source,
      applied: true,
      widen,
      ...(surface === "semantic" ? { received_only: true } : {}),
    },
    line: `Showing mail on ${joinNames(names)} only (${SOURCE_TEXT[source]})${surface === "semantic" ? ", received mail only" : ""}. Widen: ${widenFor(source).join(" or ")}.`,
  };
}

// ---------------------------------------------------------------------------
// Empty focused results

/**
 * A count of matching mail: exact, a lower bound (`atLeast`, such as a capped
 * total), or an upper bound (`upTo`, such as one that keeps rows a listing
 * skips).
 */
export type ElsewhereCount = {
  total: number;
  bound?: "atLeast" | "upTo" | undefined;
};

/** A listing answer's total as an ElsewhereCount, or null when it has none. */
export function countFromMeta(
  data: unknown,
  bound?: ElsewhereCount["bound"],
): ElsewhereCount | null {
  const meta = isRecord(data) && isRecord(data.meta) ? data.meta : null;
  if (!meta || typeof meta.total !== "number") return null;
  return {
    total: meta.total,
    // A capped total is a lower bound, unless the count already over-counts.
    bound: bound ?? (meta.total_capped === true ? "atLeast" : undefined),
  };
}

/**
 * The note an empty focused result adds: how much matching mail the other
 * domains hold. `countElsewhere` runs the same request without the focus and
 * returns its count, or null when it cannot be read. Null when the result was
 * not focused.
 */
export async function focusEmptyHint(
  outcome: FocusOutcome,
  countElsewhere: () => Promise<ElsewhereCount | null>,
): Promise<string | null> {
  if (!outcome.focused) return null;
  const names = joinNames(outcome.focused.map((d) => d.name));
  let count: ElsewhereCount | null;
  try {
    count = await countElsewhere();
  } catch {
    count = null;
  }
  const total = count?.total ?? null;
  const prefix =
    count?.bound === "atLeast"
      ? "at least "
      : count?.bound === "upTo"
        ? "up to "
        : "";
  if (total === null)
    return `Nothing matched on ${names}. Other domains may hold matching mail: pass --all-domains to look.`;
  if (total === 0)
    return `Nothing matched on ${names}, and nothing matches on the other domains either.`;
  return `Nothing matched on ${names}; ${prefix}${total} matching email${total === 1 ? "" : "s"} on other domains. Pass --all-domains to see ${total === 1 && !count?.bound ? "it" : "them"}.`;
}

/**
 * Whether a search query scopes itself with a domain: or to: filter. Quoted
 * phrases are text, not filters, so they are left out.
 */
export function queryScopesItself(q: string | undefined): boolean {
  if (!q) return false;
  // As the server reads a phrase: only \" is an escape inside it.
  const unquoted = q.replace(/"(?:\\"|[^"])*"/g, " ");
  return /(?:^|\s)(?:domain|to):/i.test(unquoted);
}

/**
 * Semantic search filters domains on received mail only, and refuses a domain
 * filter with sent mail in --corpus. Such a search keeps every domain and says
 * the focus was not applied; a --domain given with it is refused.
 */
export function focusForCorpus(
  outcome: FocusOutcome,
  corpus: readonly string[] | undefined,
): FocusOutcome {
  if (!outcome.focused || !corpus?.includes("outbound")) return outcome;
  const names = outcome.focused.map((d) => d.name);
  const source = outcome.meta?.source ?? "profile";
  if (source === "flag")
    throw focusError(
      "--domain filters received mail only: drop --corpus outbound, or leave --domain out.",
      "usage_error",
      2,
    );
  return {
    ...outcome,
    params: {},
    focused: null,
    meta: outcome.meta
      ? { ...outcome.meta, applied: false, received_only: undefined }
      : null,
    line: `Focus on ${joinNames(names)} (${SOURCE_TEXT[source as Exclude<FocusSource, "none">]}) not applied: --corpus outbound includes sent mail, which a domain focus does not filter, so this search covers every domain.`,
  };
}

/** Remove the focus fields from a query, for the elsewhere count. */
export function withoutFocus(
  query: Record<string, unknown>,
  outcome: FocusOutcome,
): Record<string, unknown> {
  const rest = { ...query };
  for (const key of Object.keys(outcome.params)) delete rest[key];
  return rest;
}

/** Write the focus line to stderr unless --json. */
export function writeFocusLine(outcome: FocusOutcome, json: boolean): void {
  if (!json && outcome.line) process.stderr.write(`${outcome.line}\n`);
}

/** The envelope with `meta.focus` added, when there is a focus to report. */
export function withFocusMeta<T>(envelope: T, outcome: FocusOutcome): T {
  if (!outcome.meta || envelope === null || typeof envelope !== "object")
    return envelope;
  const record = envelope as Record<string, unknown>;
  const meta = isRecord(record.meta) ? record.meta : {};
  return { ...record, meta: { ...meta, focus: outcome.meta } } as T;
}
