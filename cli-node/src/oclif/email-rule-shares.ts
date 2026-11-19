// Readable stderr reports for email rule shares: the shares you receive
// (list-shares), the ones you gave (list-given-shares) and one share
// (get-share). stdout keeps the JSON.
//
// A share shows its rule's id to whoever is shown the rule: the person who
// shared it, and while it is live the person it is shared with. That id names
// the rule in webhook deliveries (understanding.rules[].id, with
// through_share). A key takes the share's id, from the dashboard.
//
// This module does not import api-command.ts, which imports it.

import { tableLines } from "./email-rule-listings.js";
import type { OperationExtension } from "./operation-extension.js";
import { shownLine, shownText } from "./terminal-text.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** A person on a share: their name, else their email, else `-`. */
function person(value: unknown): string {
  if (!isRecord(value)) return "-";
  return shownText(value.name) || shownText(value.email) || "-";
}

/** The rule's name: the live rule's, else the name the share recorded. */
function ruleName(share: Record<string, unknown>): string {
  const rule = isRecord(share.rule) ? share.rule : null;
  return shownText(rule?.name) || shownText(share.rule_name) || "-";
}

/** The rule's id, or `-` when the share does not show it to you. */
function ruleId(share: Record<string, unknown>): string {
  return shownLine(share.rule_id) || "-";
}

/** Live, or why not: ended (with its reason) or not live because someone left. */
function shareState(share: Record<string, unknown>): string {
  if (share.live === true) return "live";
  const reason = shownLine(share.end_reason);
  if (typeof share.ended_at === "string")
    return reason ? `ended (${reason})` : "ended";
  return "not live";
}

/** The other person on the share, from the caller's side of it. */
function otherSide(share: Record<string, unknown>): string {
  if (share.is_granter === true) return `to ${person(share.beneficiary)}`;
  if (share.is_beneficiary === true) return `from ${person(share.granter)}`;
  return `${person(share.granter)} to ${person(share.beneficiary)}`;
}

/**
 * A table of shares (listEmailRuleShares, listGivenEmailRuleShares): each
 * share's id, its rule's name and id (`-` where the share does not show the
 * id), who it is with and whether it is live. Nothing for an empty list.
 */
export function shareListLines(data: unknown): string[] {
  const rows = Array.isArray(data) ? data.filter(isRecord) : [];
  if (rows.length === 0) return [];
  return [
    ...tableLines([
      ["SHARE ID", "RULE", "RULE ID", "WITH", "STATE"],
      ...rows.map((share) => [
        shownLine(share.id) || "-",
        ruleName(share),
        ruleId(share),
        otherSide(share),
        shareState(share),
      ]),
    ]),
    ...(rows.some((share) => share.is_beneficiary === true) ? [KEY_NOTE] : []),
  ];
}

/** Said under a share made with the caller: which id goes where. */
const KEY_NOTE =
  "RULE ID names the rule in your webhook deliveries (understanding.rules[].id, with through_share). A key reads a share by the SHARE ID, added from the dashboard's API keys page.";

/** One share (getEmailRuleShare): the same facts as a list row, one per line. */
export function shareLines(data: unknown): string[] {
  if (!isRecord(data)) return [];
  return [
    `Share ${shownLine(data.id) || "-"}: ${shareState(data)}, ${otherSide(data)}`,
    `Rule: ${ruleName(data)} (${typeof data.rule_id === "string" ? `id ${ruleId(data)}` : "id not shown to you"})`,
    ...(data.is_beneficiary === true ? [KEY_NOTE] : []),
  ];
}

export const EMAIL_RULE_SHARE_EXTENSIONS: Record<string, OperationExtension> = {
  listEmailRuleShares: {
    flags: {},
    report: (data) => ({ lines: shareListLines(data) }),
  },
  listGivenEmailRuleShares: {
    flags: {},
    report: (data) => ({ lines: shareListLines(data) }),
  },
  getEmailRuleShare: {
    flags: {},
    report: (data) => ({ lines: shareLines(data) }),
  },
};
