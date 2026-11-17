// Readable stderr tables for the email rule listings: the rules a caller can
// see (list, with --all every rule in the organization) and a
// rule's decisions (list-decisions, and the decisions about your
// own mail, list-decisions-on-my-mail). stdout keeps the JSON.
//
// This module does not import api-command.ts, which imports it.

import type { OperationExtension } from "./operation-extension.js";
import { shownLine, shownText, terminalLine } from "./terminal-text.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Rows as a table: every column padded to its widest cell but the last. */
export function tableLines(rows: readonly (readonly string[])[]): string[] {
  const header = rows[0] ?? [];
  const widths = header.map((_, column) =>
    Math.max(...rows.map((cells) => (cells[column] ?? "").length)),
  );
  return rows.map((cells) =>
    terminalLine(
      cells
        .map((cell, column) =>
          column === cells.length - 1 ? cell : cell.padEnd(widths[column] ?? 0),
        )
        .join("  ")
        .trimEnd(),
    ),
  );
}

/** A time an answer gives, to the minute, in UTC; the value as given when it is not a time. */
function minuteUtc(value: unknown): string {
  if (typeof value !== "string" || value === "") return "-";
  const at = new Date(value);
  return Number.isNaN(at.getTime())
    ? shownLine(value)
    : `${at.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

// Decisions

/** What a decision decided: matched, near miss or no match. */
function decisionOutcome(decision: Record<string, unknown>): string {
  if (decision.matched === true) return "matched";
  if (decision.near_miss === true) return "near miss";
  return decision.matched === false ? "no match" : "-";
}

/**
 * A table of a rule's decisions (listEmailRuleDecisions and
 * listEmailRuleDecisionsOnMyMail): when each was decided, what it decided,
 * the email, the mailbox it was received in, its sender and subject. An email
 * you are not shown shows `-` for those. Nothing for an empty list.
 */
export function decisionLines(data: unknown): string[] {
  const rows = Array.isArray(data) ? data.filter(isRecord) : [];
  if (rows.length === 0) return [];
  const cell = (value: unknown) => shownText(value) || "-";
  return tableLines([
    ["DECIDED", "OUTCOME", "EMAIL", "RECIPIENT", "FROM", "SUBJECT"],
    ...rows.map((row) => [
      minuteUtc(row.decided_at),
      decisionOutcome(row),
      cell(row.email_id),
      cell(row.recipient),
      cell(row.from_address),
      cell(row.subject),
    ]),
  ]);
}

// Rules

/** At most this many scope addresses and domains are named in COVERS. */
const COVERS_NAMED = 3;

function ruleAuthor(rule: Record<string, unknown>): string {
  const author = isRecord(rule.author) ? rule.author : {};
  const name =
    shownText(author.name) ||
    shownText(author.email) ||
    shownLine(author.user_id).slice(0, 8) ||
    "-";
  return rule.is_author === true ? `${name} (you)` : name;
}

/** Whose mail a rule covers, from its evaluation_scope and scope_selection. */
function ruleCovers(rule: Record<string, unknown>): string {
  switch (rule.evaluation_scope) {
    case "own_mailboxes":
      return "author's own mailboxes";
    case "author":
      return "all mail the author reads";
    case "selected": {
      const selection = isRecord(rule.scope_selection)
        ? rule.scope_selection
        : {};
      const names = [
        ...(Array.isArray(selection.addresses) ? selection.addresses : []).map(
          (address) => shownLine(address),
        ),
        ...(Array.isArray(selection.domains) ? selection.domains : []).map(
          (domain) => `@${shownLine(domain)}`,
        ),
      ].filter((name) => name !== "" && name !== "@");
      if (names.length === 0) return "selected";
      const named = names.slice(0, COVERS_NAMED).join(", ");
      return names.length > COVERS_NAMED
        ? `${named} +${names.length - COVERS_NAMED} more`
        : named;
    }
    default:
      return shownLine(rule.evaluation_scope) || "-";
  }
}

function countSum(list: unknown): number {
  return Array.isArray(list)
    ? list.reduce<number>(
        (sum, entry) =>
          sum +
          (isRecord(entry) && typeof entry.count === "number"
            ? entry.count
            : 0),
        0,
      )
    : 0;
}

/**
 * Who receives what a rule matches now, from receivers (the --all list
 * only): keys, webhooks and shares summed; `-` when there are none, and
 * `unknown` when it could not be read in time.
 */
function ruleReceivers(rule: Record<string, unknown>): string {
  if (!isRecord(rule.receivers)) return "unknown";
  const keys = countSum(rule.receivers.keys);
  const webhooks = countSum(rule.receivers.webhooks);
  const shares = countSum(rule.receivers.shares);
  if (keys + webhooks + shares === 0) return "-";
  return `${keys} ${keys === 1 ? "key" : "keys"}, ${webhooks} ${webhooks === 1 ? "webhook" : "webhooks"}, ${shares} ${shares === 1 ? "share" : "shares"}`;
}

/**
 * A table of an email rules list (listEmailRules), one line per rule: its
 * name, author, kind, state, current version and whose mail it covers, and
 * with --all who receives what it matches. Nothing for an empty list.
 */
export function ruleListLines(data: unknown, all: boolean): string[] {
  const rows = Array.isArray(data) ? data.filter(isRecord) : [];
  if (rows.length === 0) return [];
  return tableLines([
    [
      "NAME",
      "AUTHOR",
      "KIND",
      "STATE",
      "VERSION",
      "COVERS",
      ...(all ? ["RECEIVERS"] : []),
    ],
    ...rows.map((rule) => [
      shownText(rule.name) || "-",
      ruleAuthor(rule),
      rule.kind === "do_not_share"
        ? "do not share"
        : shownLine(rule.kind) || "grant",
      shownLine(rule.state) || "-",
      typeof rule.current_version === "number"
        ? `v${rule.current_version}`
        : "-",
      ruleCovers(rule),
      ...(all ? [ruleReceivers(rule)] : []),
    ]),
  ]);
}

/**
 * Why a list request was refused, in the words a person can act
 * on, or undefined to keep the generic hint for the error code.
 */
export function listEmailRulesErrorHint(
  code: string | undefined,
  payload: unknown,
  flags: Record<string, unknown> = {},
): string | undefined {
  if (code !== "grant_forbidden") return undefined;
  const error =
    isRecord(payload) && isRecord(payload.error) ? payload.error : payload;
  const details =
    isRecord(error) && isRecord(error.details) ? error.details : {};
  switch (details.reason) {
    case "owner_or_admin_only":
      return "Only owners and admins can list every rule. Run without --all to list the rules you can see.";
    case "person_credential":
      return "Listing every rule needs your own CLI login, not an API key or agent sign-in.";
    case "permission_missing":
      if (
        details.param === "author" ||
        (details.param === undefined && typeof flags.author === "string")
      )
        return "Filtering by address needs permission to list members. Use the author's user id instead.";
      if (details.param === "mailbox")
        return "Filtering by another member's mailbox needs permission to list members, or --all.";
      return undefined;
    default:
      return undefined;
  }
}

/** The empty-list note of list, by whether --all was given. */
export function emptyRuleListHint(all: boolean): string {
  return all
    ? "(no results) No rules in the organization match these filters."
    : "(no results) No rules you can see match. Owners and admins can list every rule in the organization with --all.";
}

/** The API's page cap and default page size on list. */
const RULE_LIST_PAGE_MAX = 100;
const RULE_LIST_DEFAULT_LIMIT = 50;

export const EMAIL_RULE_LISTING_EXTENSIONS: Record<string, OperationExtension> =
  {
    listEmailRules: {
      flags: {},
      report: (data, { flags, meta }) => {
        const rows = Array.isArray(data) ? data : [];
        const lines = ruleListLines(data, flags.all === true);
        // A page filtered by mailbox may hold fewer rules than --limit while
        // more remain; say so rather than let it read as the end.
        // Only for one page: a --limit fetched in several pages has its own
        // note when it stops short.
        const limit =
          typeof flags.limit === "number" && flags.limit <= RULE_LIST_PAGE_MAX
            ? flags.limit
            : typeof flags.limit === "number"
              ? undefined
              : RULE_LIST_DEFAULT_LIMIT;
        const cursor = isRecord(meta) ? meta.cursor : undefined;
        if (
          typeof flags.mailbox === "string" &&
          typeof cursor === "string" &&
          cursor !== "" &&
          limit !== undefined &&
          rows.length < limit
        )
          lines.push(
            "Scanned part of the rules; run again with --cursor to continue.",
          );
        return { lines };
      },
    },
    listEmailRuleDecisions: {
      flags: {},
      report: (data) => ({ lines: decisionLines(data) }),
    },
    listEmailRuleDecisionsOnMyMail: {
      flags: {},
      report: (data) => ({ lines: decisionLines(data) }),
    },
  };
