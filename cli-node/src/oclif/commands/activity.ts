import { Command, Flags } from "@oclif/core";
import {
  type ListActivityObjectsResult,
  listActivityObjects,
} from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  networkErrorHint,
  surfaceUnauthorizedHint,
  writeErrorWithHints,
} from "../api-command.js";
import {
  backoffDelay,
  pauseForTransientFailure,
  transientFailure,
} from "../transient-retry.js";

// What you created, or what other members asked of you (relation=asked), read
// from GET /activity/objects. A key, an app or an agent sees what it created
// itself; a person signed in with `primitive login` sees what they created
// through any credential of theirs, the rule requests made to them and the
// objections to rules they wrote (relation=asked), and the coverage notices
// about rules over their own mail (relation=concerning). Ids, names and states
// only: never a webhook URL or mail content.

const API_KEY_FLAG = Flags.string({
  description:
    "Primitive API key override (defaults to PRIMITIVE_API_KEY or saved OAuth login credentials)",
  env: "PRIMITIVE_API_KEY",
});

const API_BASE_URL_FLAG = Flags.string({
  description: API_BASE_URL_FLAG_DESCRIPTION,
  env: "PRIMITIVE_API_BASE_URL",
  hidden: true,
});

/** The most pages `--all` follows before it stops and prints where to resume. */
export const ALL_PAGES_LIMIT = 50;

const DEFAULT_LIMIT = 50;

type Page = ListActivityObjectsResult;
export type ActivityItem = Page["items"][number];
export type WithheldKind = Page["withheld"][number];

type SdkResult = { data?: unknown; error?: unknown; response?: Response };

/** How long a read of the feed keeps retrying a transient failure. */
export const ACTIVITY_RETRY_MS = 15_000;
/** The most times one page is asked for. */
export const ACTIVITY_ATTEMPTS = 4;

/** The message printed when Primitive could not be reached at all. */
export const NETWORK_ERROR_MESSAGE =
  "Could not reach Primitive (network error). Try again in a moment.";

/**
 * The error for a read that got no answer at all: always a plain object, so
 * it prints the same with and without --json. The transport's own code (a
 * host that does not resolve, say) is kept as `cause`, as a word, with no
 * local detail.
 */
export function networkErrorPayload(error: unknown): {
  code: string;
  message: string;
  cause?: string;
} {
  const cause =
    error instanceof Error ? (error as { cause?: unknown }).cause : undefined;
  const code =
    cause && typeof cause === "object"
      ? (cause as { code?: unknown }).code
      : undefined;
  return {
    code: "network_error",
    message: NETWORK_ERROR_MESSAGE,
    ...(typeof code === "string" && /^[A-Z0-9_]+$/.test(code)
      ? { cause: code }
      : {}),
  };
}

/**
 * One page read, retried as the CLI's waits retry a read: a rate limit, a
 * 502, 503 or 504, or a network error is tried again with backoff, up to
 * ACTIVITY_ATTEMPTS times within ACTIVITY_RETRY_MS. A read that throws is
 * taken as the network error it is. A wait (a Retry-After, or the backoff)
 * longer than the time left is not slept on: the failure is returned at once.
 */
async function readWithRetry(
  read: () => Promise<SdkResult>,
): Promise<SdkResult> {
  const deadline = Date.now() + ACTIVITY_RETRY_MS;
  for (let attempt = 0; ; attempt += 1) {
    let result: SdkResult;
    try {
      result = await read();
    } catch (error) {
      result = { error };
    }
    const failure = transientFailure(result);
    if (!failure || attempt + 1 >= ACTIVITY_ATTEMPTS) return result;
    const wait = failure.retryAfterMs ?? backoffDelay(attempt);
    if (wait > deadline - Date.now()) return result;
    // The wait worked out here is the one slept, so the check above holds.
    await pauseForTransientFailure(
      { ...failure, retryAfterMs: wait },
      attempt,
      { deadline },
    );
  }
}

type CallResult =
  | { ok: true; data: Page }
  | { ok: false; payload: unknown; response?: Response };

async function call(read: () => Promise<SdkResult>): Promise<CallResult> {
  try {
    const result = await readWithRetry(read);
    // No answer at all: Primitive was not reached. Say so in words, not as
    // the transport's error object.
    if (transientFailure(result)?.reason === "network")
      return { ok: false, payload: networkErrorPayload(result.error) };
    if (result.error !== undefined || !result.response?.ok) {
      const status = result.response?.status;
      // An answer whose body could not be read (cut off, or not JSON).
      if (result.error instanceof Error)
        return {
          ok: false,
          response: result.response,
          payload: {
            code: "response_error",
            message: `The answer could not be read${status ? ` (HTTP ${status})` : ""}. Try again in a moment.`,
          },
        };
      const extracted =
        result.error === undefined ||
        result.error === null ||
        typeof result.error === "string"
          ? undefined
          : extractErrorPayload(result.error);
      // An error with no code of its own (an empty body, say) is named by
      // its status, never printed as {}.
      const coded =
        extracted !== null &&
        typeof extracted === "object" &&
        typeof (extracted as { code?: unknown }).code === "string";
      return {
        ok: false,
        response: result.response,
        payload: coded
          ? extracted
          : {
              code: "http_error",
              message:
                (typeof result.error === "string" && result.error.trim()) ||
                `HTTP ${status ?? ""}`.trim(),
            },
      };
    }
    const data = result.data as { data?: Page } | Page | undefined;
    return {
      ok: true,
      data: ((data as { data?: Page })?.data ?? data) as Page,
    };
  } catch (error) {
    return { ok: false, payload: networkErrorPayload(error) };
  }
}

/** A time as "YYYY-MM-DD HH:MM" in UTC; anything that is not a time, as given. */
export function minute(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toISOString().slice(0, 16).replace("T", " ");
}

/** The credential an item came through, in words. */
export function throughLabel(through: ActivityItem["created_through"]): string {
  if (through.kind === "member") return "you";
  const kind =
    through.kind === "org_key"
      ? "key"
      : through.kind === "connected_key"
        ? "agent"
        : through.kind === "function_key"
          ? "Function key"
          : through.kind === "agent_delegate"
            ? "agent delegate"
            : "app";
  return through.name ? `${kind} ${through.name}` : kind;
}

/** One line per item: kind, state, when it was created, its name, and what it was created through. */
export function formatActivityRows(
  covers: string,
  items: readonly ActivityItem[],
): string {
  if (items.length === 0) return "Nothing to show.";
  const rows = items.map((item) => [
    item.kind,
    item.owned_now === "someone_else"
      ? `${item.state} (transferred)`
      : item.state,
    minute(item.created_at),
    item.name ?? item.id,
    ...(covers === "you" ? [throughLabel(item.created_through)] : []),
  ]);
  const header = [
    "KIND",
    "STATE",
    "CREATED (UTC)",
    "NAME",
    ...(covers === "you" ? ["THROUGH"] : []),
  ];
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((row) => (row[i] ?? "").length)),
  );
  const line = (cells: readonly string[]) =>
    cells
      .map((cell, i) =>
        i === cells.length - 1 ? cell : cell.padEnd(widths[i] ?? 0),
      )
      .join("  ");
  return [line(header), ...rows.map(line)].join("\n");
}

/**
 * One line per thing asked of you (a rule request made to you, or an
 * objection to a rule you wrote): its kind, its state, when it was asked, its
 * name, and who asked. `complete` says the listing is the whole of it (every
 * state, from the first page to the last, nothing withheld), the only time an
 * empty one means nobody has asked.
 */
export function formatAskedRows(
  items: readonly ActivityItem[],
  complete = false,
): string {
  if (items.length === 0)
    return complete ? "Nobody has asked you for anything." : "Nothing to show.";
  const rows = items.map((item) => [
    item.kind,
    item.state,
    minute(item.created_at),
    item.name ?? item.id,
    item.created_through.name ?? item.created_through.id ?? "",
    item.id,
  ]);
  const header = ["KIND", "STATE", "ASKED (UTC)", "NAME", "FROM", "ID"];
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((row) => (row[i] ?? "").length)),
  );
  const line = (cells: readonly string[]) =>
    cells
      .map((cell, i) =>
        i === cells.length - 1 ? cell : cell.padEnd(widths[i] ?? 0),
      )
      .join("  ");
  return [line(header), ...rows.map(line)].join("\n");
}

/** Totals of who receives a rule's matches, as a receivers_changed notice carries them before and after. */
type ReceiverTotals = {
  keys: number;
  reads_in_full: number;
  webhooks: number;
  shares: number;
};

const TOTAL_KEYS = ["keys", "reads_in_full", "webhooks", "shares"] as const;

/** `value` as receiver totals: an object whose four counts are all non-negative integers. */
function receiverTotals(value: unknown): ReceiverTotals | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const totals = value as Record<string, unknown>;
  return TOTAL_KEYS.every((key) => {
    const count = totals[key];
    return typeof count === "number" && Number.isInteger(count) && count >= 0;
  })
    ? (totals as ReceiverTotals)
    : null;
}

/**
 * What a receivers_changed notice says changed, from its totals before and
 * after: "keys 3 to 2 (1 to 0 also reading your mail beyond the rule),
 * webhooks 2 to 1",
 * or, when the totals are equal (an owner or a webhook site changed), that
 * they are. Null for any other notice, and for one whose totals are missing
 * or not counts (an older server).
 */
export function receiversChangeText(item: ActivityItem): string | null {
  if (item.state !== "receivers_changed") return null;
  const change = (
    item as { receivers_change?: { before?: unknown; after?: unknown } }
  ).receivers_change;
  const before = receiverTotals(change?.before);
  const after = receiverTotals(change?.after);
  if (!before || !after) return null;
  const moved = (key: keyof ReceiverTotals) => before[key] !== after[key];
  const span = (key: keyof ReceiverTotals) => `${before[key]} to ${after[key]}`;
  // Keys also reading your mail beyond the rule are some of the keys, so they are told with them.
  const full = moved("reads_in_full")
    ? ` (${span("reads_in_full")} also reading your mail beyond the rule)`
    : "";
  const changed = [
    ...(moved("keys")
      ? [`keys ${span("keys")}${full}`]
      : full
        ? [`keys ${after.keys}${full}`]
        : []),
    ...(moved("webhooks") ? [`webhooks ${span("webhooks")}`] : []),
    ...(moved("shares") ? [`shares ${span("shares")}`] : []),
  ];
  return changed.length > 0
    ? changed.join(", ")
    : "same totals, an owner or webhook site changed";
}

/** Where to see what covers you now, whatever the notices have caught up with. */
const COVERING_NOW = `\`primitive email-rule-oversight list-email-rules-covering-me\` shows what covers you now.`;

/**
 * One line per coverage notice: what it told (started, new_version,
 * receivers_changed, or baseline for a rule that already covered you when
 * notices began), when, the rule's name then, and its author; and, first,
 * each rule that covers you now whose notice is not written yet (pending,
 * dated when the rule last changed), then the rule's id (rule_id; a pending
 * row's own id is the rule's), never the notice's own id, which no command
 * takes; and, when any row is a receivers_changed notice with its totals,
 * what changed in them (CHANGE).
 * `complete` says the listing is the whole of it (from the first page to the
 * last, nothing withheld). Even then an empty one is no promise that nothing
 * covers you: notices can lag, so it
 * says how far they go (`asOf`, when the server says) and where to look now.
 */
export function formatConcerningRows(
  items: readonly ActivityItem[],
  complete = false,
  asOf?: string | null,
  pendingComplete?: boolean,
): string {
  // The server's check for rules covering you with no notice yet ran out of
  // time: some may be missing from the list, so say so rather than imply the
  // list is whole.
  const unfinished =
    pendingComplete === false
      ? "The check for rules that cover you with no notice written yet did not finish, so some may be missing: run this again in a moment."
      : null;
  if (items.length === 0)
    return complete
      ? `${asOf ? `Nothing recorded for you as of ${minute(asOf)} UTC.` : "Nothing recorded for you yet."} Notices can lag, so a rule that starts covering your mail may not appear here yet. ${COVERING_NOW}`
      : unfinished
        ? `${unfinished} ${COVERING_NOW}`
        : "Nothing to show.";
  const rows = items.map((item) => [
    item.state,
    minute(item.created_at),
    item.name ?? "(unnamed)",
    item.created_through.name ?? item.created_through.id ?? "",
    // An older server sends no rule_id; a pending row's id is the rule's.
    item.rule_id ?? (item.state === "pending" ? item.id : ""),
  ]);
  // Last, so it widens no other column, and only when a row has one.
  const changes = items.map((item) => receiversChangeText(item));
  const withChange = changes.some((change) => change !== null);
  if (withChange)
    for (const [i, row] of rows.entries()) row.push(changes[i] ?? "");
  const header = [
    "NOTICE",
    "WHEN (UTC)",
    "RULE",
    "AUTHOR",
    "RULE ID",
    ...(withChange ? ["CHANGE"] : []),
  ];
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((row) => (row[i] ?? "").length)),
  );
  const line = (cells: readonly string[]) =>
    cells
      .map((cell, i) =>
        i === cells.length - 1 ? cell : cell.padEnd(widths[i] ?? 0),
      )
      .join("  ")
      .trimEnd();
  const pending = items.some((item) => item.state === "pending")
    ? [
        "",
        `pending: the rule covers you now and its notice is not written yet. ${COVERING_NOW}`,
      ]
    : [];
  const receivers = items.some((item) => item.state === "receivers_changed")
    ? [
        "",
        "receivers_changed: who receives the rule's matches changed, with the totals before and after where the server sends them. `primitive email-rule-oversight get-email-rule-covering-me <rule-id>` shows who receives them now, by owner, while the rule covers you.",
      ]
    : [];
  return [
    line(header),
    ...rows.map(line),
    ...pending,
    ...receivers,
    // The pending line already says where to see what covers you now.
    ...(unfinished
      ? ["", pending.length > 0 ? unfinished : `${unfinished} ${COVERING_NOW}`]
      : []),
  ].join("\n");
}

/** What was left out, and why: no counts, only the kinds and what would show them. */
export function formatWithheld(
  withheld: readonly WithheldKind[],
): string | null {
  if (withheld.length === 0) return null;
  const parts = withheld.map((w) =>
    w.reason === "permission_missing" && w.permission
      ? `${w.kind} (needs ${w.permission})`
      : w.reason === "mail_scope"
        ? `${w.kind} (needs access to every mailbox)`
        : `${w.kind} (not for this credential)`,
  );
  return `Not shown: ${parts.join(", ")}.`;
}

const SHELL_SAFE = /^[A-Za-z0-9_][A-Za-z0-9_,.:=/-]*$/;

function shellWord(value: string): string {
  return SHELL_SAFE.test(value) ? value : `'${value.replaceAll("'", `'\\''`)}'`;
}

/** The command that continues this listing from `cursor`, with the same filters. */
export function resumeCommand(
  bin: string,
  flags: { kind?: string; state: string; limit: number; all?: boolean },
  cursor: string,
  subcommand: Relation = "created",
): string {
  return [
    `${bin} activity ${subcommand}`,
    ...(flags.kind ? [`--kind ${shellWord(flags.kind)}`] : []),
    ...(flags.state !== "all" ? [`--state ${flags.state}`] : []),
    ...(flags.limit !== DEFAULT_LIMIT ? [`--limit ${flags.limit}`] : []),
    ...(flags.all ? ["--all"] : []),
    `--cursor ${shellWord(cursor)}`,
  ].join(" ");
}

type ListFlags = {
  "api-key"?: string;
  "api-base-url"?: string;
  kind?: string;
  state: string;
  limit: number;
  cursor?: string;
  all?: boolean;
  json?: boolean;
};

type Relation = "created" | "asked" | "concerning";

/** List one page, or every page with --all, of what the caller created, was asked, or what concerns their mail. */
async function runActivityList(
  command: Command,
  flags: ListFlags,
  relation: Relation,
): Promise<void> {
  const auth = await createAuthenticatedCliApiClient({
    apiKey: flags["api-key"],
    apiBaseUrl: flags["api-base-url"],
    configDir: command.config.configDir,
  });
  const items: ActivityItem[] = [];
  let covers = "";
  let withheld: WithheldKind[] = [];
  // With relation=concerning, when the notices last looked, and whether the
  // check for rules covering you with no notice yet finished (both the first
  // page's).
  let asOf: string | null | undefined;
  let pendingComplete: boolean | undefined;
  let cursor = flags.cursor;
  for (let page = 0; page < (flags.all ? ALL_PAGES_LIMIT : 1); page += 1) {
    const result = await call(() =>
      listActivityObjects({
        client: auth.apiClient.client,
        query: {
          ...(relation !== "created" ? { relation } : {}),
          state: flags.state as "all" | "live" | "ended",
          limit: flags.limit,
          ...(flags.kind ? { kind: flags.kind } : {}),
          ...(cursor ? { cursor } : {}),
        },
      }),
    );
    if (!result.ok) {
      if (flags.json)
        process.stderr.write(`${JSON.stringify(result.payload)}\n`);
      else {
        writeErrorWithHints(result.payload, result.response);
        // A network error's own code can say what to check (a proxy, DNS).
        const cause = (result.payload as { cause?: unknown } | null)?.cause;
        const hint =
          typeof cause === "string" ? networkErrorHint(cause) : undefined;
        if (hint) process.stderr.write(`${hint}\n`);
      }
      surfaceUnauthorizedHint({
        auth: auth.auth,
        baseUrlOverridden: auth.baseUrlOverridden,
        configDir: command.config.configDir,
        payload: result.payload,
      });
      process.exitCode = 1;
      return;
    }
    covers = result.data.covers;
    withheld = result.data.withheld;
    if (page === 0) {
      const first = result.data as Page & {
        as_of?: string | null;
        pending_complete?: boolean;
      };
      asOf = first.as_of;
      pendingComplete = first.pending_complete;
    }
    items.push(...result.data.items);
    cursor = result.data.next_cursor ?? undefined;
    if (!cursor) break;
  }
  if (flags.json) {
    command.log(
      JSON.stringify(
        {
          covers,
          items,
          withheld,
          next_cursor: cursor ?? null,
          ...(asOf !== undefined ? { as_of: asOf } : {}),
          ...(pendingComplete !== undefined
            ? { pending_complete: pendingComplete }
            : {}),
        },
        null,
        2,
      ),
    );
    return;
  }
  // Every state, from the first page to the last, with nothing withheld, and
  // for relation=concerning the check for pending rows finished.
  const complete =
    flags.state === "all" &&
    !flags.cursor &&
    !cursor &&
    withheld.length === 0 &&
    pendingComplete !== false;
  command.log(
    relation === "asked"
      ? formatAskedRows(items, complete)
      : relation === "concerning"
        ? formatConcerningRows(items, complete, asOf, pendingComplete)
        : formatActivityRows(covers, items),
  );
  const notShown = formatWithheld(withheld);
  if (notShown) command.log(`\n${notShown}`);
  if (cursor)
    command.log(
      `\nMore: ${resumeCommand(command.config.bin, flags, cursor, relation)}`,
    );
}

export class ActivityCreatedCommand extends Command {
  static description =
    `List what you created, newest first, with where each object stands now: Functions, endpoints, pull subscriptions, routes, filters, wake schedules, repeating and scheduled sends, including ones since disabled, deleted or revoked.

  Signed in with \`primitive login\`, you see what you created through any credential of yours (yourself, this CLI, apps you connected, your API keys while they were yours, your agents), with each item naming the credential, plus your API keys, agents, email rules, rule requests and objections to rules over your mail. With an API key or an agent's key, you see what that key created.

  Only ids, names and states are shown, never a webhook URL or mail content. Kinds your access does not let you list are named at the end.`;

  static summary = "List what you created";

  static examples = [
    "<%= config.bin %> activity created",
    "<%= config.bin %> activity created --kind endpoint,api_key --state ended",
    "<%= config.bin %> activity created --all --json",
  ];

  static flags = {
    "api-key": API_KEY_FLAG,
    "api-base-url": API_BASE_URL_FLAG,
    kind: Flags.string({
      description:
        "Only these kinds, comma-separated (for example endpoint,recipient_route,api_key).",
    }),
    state: Flags.string({
      description:
        "all (default), live, or ended (deleted, replaced, revoked or finished).",
      options: ["all", "live", "ended"],
      default: "all",
    }),
    limit: Flags.integer({
      description: "Objects per page, 1 to 200.",
      min: 1,
      max: 200,
      default: DEFAULT_LIMIT,
    }),
    cursor: Flags.string({
      description: "Resume from a next_cursor an earlier page printed.",
    }),
    all: Flags.boolean({
      description: `Follow every page (at most ${ALL_PAGES_LIMIT}).`,
    }),
    json: Flags.boolean({ description: "Print the answer as JSON." }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ActivityCreatedCommand);
    await runActivityList(this, flags, "created");
  }
}

export class ActivityAskedCommand extends Command {
  static description =
    `List what other members asked of you, newest first, open or answered: rule requests made to you for an email rule over your own mail, and objections to rules you wrote, each with its kind, where it stands and who asked.

  Signed in with \`primitive login\`, you see what was asked of you under your current membership. A key, an app or an agent is asked nothing. Read a request (email_rule_request) with \`primitive email-rules get-email-rule-request --id <id>\`, and an objection (email_rule_objection) with \`primitive email-rule-oversight get-email-rule-objection --id <id>\`, then accept or decline it.`;

  static summary = "List what other members asked of you";

  static examples = [
    "<%= config.bin %> activity asked",
    "<%= config.bin %> activity asked --state live",
    "<%= config.bin %> activity asked --all --json",
  ];

  static flags = {
    "api-key": API_KEY_FLAG,
    "api-base-url": API_BASE_URL_FLAG,
    state: Flags.string({
      description:
        "all (default), live (still waiting on you), or ended (answered or withdrawn).",
      options: ["all", "live", "ended"],
      default: "all",
    }),
    limit: Flags.integer({
      description: "Items per page, 1 to 200.",
      min: 1,
      max: 200,
      default: DEFAULT_LIMIT,
    }),
    cursor: Flags.string({
      description: "Resume from a next_cursor an earlier page printed.",
    }),
    all: Flags.boolean({
      description: `Follow every page (at most ${ALL_PAGES_LIMIT}).`,
    }),
    json: Flags.boolean({ description: "Print the answer as JSON." }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ActivityAskedCommand);
    await runActivityList(this, flags, "asked");
  }
}

export class ActivityConcerningCommand extends Command {
  static description =
    `List what other members did that concerns your own mail, newest first: each time another member's rule started covering your mailboxes, that is, it was made or turned active over them or an active rule came to reach you, once per rule, not per mailbox (started), saved a new version while covering it (new_version), or changed who receives its matches: its keys, webhooks or share (receivers_changed, with the totals before and after in the table, and under receivers_change with --json, at most once every 15 minutes for a rule), named as the rule was then, with its author. A rule that already covered you when these notices began is listed once as baseline. A rule in draft or observe grants and blocks nothing and gets no notice while it stays there, though \`primitive email-rule-oversight list-email-rules-covering-me\` lists it; turning it active is what is listed, and a rule that covers you again within an hour of its last started or baseline notice gets no new one, though a version it saved meanwhile is listed as new_version, and a change in who receives its matches as receivers_changed. A rule that stops covering you and a rename are not listed.

  Notices can lag. Until a start is written, a rule that now covers you is listed first as pending, dated when the rule last changed, and with --json its id is the rule's. When the check for such rules did not finish, the listing says so and --json carries pending_complete: false; run it again in a moment.

  Signed in with \`primitive login\`, you see the notices about your own mail under your current membership. A key, an app or an agent has none. The rules that cover you now, with their ids, are listed by \`primitive email-rule-oversight list-email-rules-covering-me\`; ask a rule's author to turn it off with \`primitive email-rule-oversight create-email-rule-objection --rule-id <rule-id>\`. The table's RULE ID, and rule_id with --json, is the rule's id, which \`primitive email-rule-oversight get-email-rule-covering-me <rule-id>\` and create-email-rule-objection --rule-id take; with --json each notice's own id is the notice's, not the rule's.`;

  static summary = "List rules that started covering your mail or changed";

  static examples = [
    "<%= config.bin %> activity concerning",
    "<%= config.bin %> activity concerning --all --json",
  ];

  static flags = {
    "api-key": API_KEY_FLAG,
    "api-base-url": API_BASE_URL_FLAG,
    limit: Flags.integer({
      description: "Notices per page, 1 to 200.",
      min: 1,
      max: 200,
      default: DEFAULT_LIMIT,
    }),
    cursor: Flags.string({
      description: "Resume from a next_cursor an earlier page printed.",
    }),
    all: Flags.boolean({
      description: `Follow every page (at most ${ALL_PAGES_LIMIT}).`,
    }),
    json: Flags.boolean({ description: "Print the answer as JSON." }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ActivityConcerningCommand);
    // A notice never ends, so the listing is never filtered by state.
    await runActivityList(this, { ...flags, state: "all" }, "concerning");
  }
}
