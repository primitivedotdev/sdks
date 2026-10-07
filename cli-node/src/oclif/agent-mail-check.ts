import { join } from "node:path";
import {
  type EmailSummary,
  type ListEmailsData,
  listEmails,
  type PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import { loadSkillLine } from "./agent-identity-suggestions.js";
import {
  type AgentRuntime,
  installedConnectSkillFile,
} from "./connect-skill.js";
import {
  agentProfileDirectory,
  type ConnectedAgentIdentity,
} from "./connected-agent-profile.js";
import { acquireListenLock } from "./listen-state.js";
import { currentMailSessionKey } from "./mail-session.js";
import { refreshOwnerMemberAddressPeriodically } from "./owner-member-address.js";
import { presenceDisposition } from "./presence-provenance.js";
import {
  privateMailDirectory,
  readMailJson,
  writeMailJson,
} from "./shared-mail-files.js";

/**
 * One check for mail that arrived since this profile's previous check. It is
 * the receiver for runtimes that nothing can wake (poll receiving): the agent
 * runs it at the start of each turn and after it sends.
 *
 * It tails `GET /emails?since=<cursor>`, which returns mail newer than the
 * cursor oldest first, without mail marked fyi (acknowledgements) or in
 * threads this address muted. The first check starts before the address's
 * first email. The cursor is saved privately per profile, only after the
 * result was handed to `emit`, so a failed or interrupted check repeats mail
 * rather than losing it. Reads also show this address's receiver as live.
 */

const CURSOR_FILE = "mail-check.json";
export const MAIL_CHECK_PAGE_SIZE = 100;
export const MAIL_CHECK_MAX_PAGES = 5;

export class MailCheckApiError extends Error {
  constructor(readonly payload: unknown) {
    super("The mail check request failed.");
  }
}

export type MailCheckItem = {
  id: string;
  received_at: string;
  sender: string;
  thread_id: string | null;
  /** The address that received this email: the checked profile's own. */
  to: string;
  /** Reads this email under the profile that received it. */
  read_command: string;
};

export type MailCheckResult = {
  /**
   * Present only with mail: one line, ahead of the emails, that loads the
   * rules for handling them. Agents act on this output even when they have
   * not loaded the skill.
   */
  guidance?: string;
  outcome: "mail" | "empty";
  emails: MailCheckItem[];
  /** More new mail remains; run the check again after handling these. */
  more: boolean;
  /**
   * Presence probes and this profile's setup challenge, handled by the CLI.
   * Other mail from the control address is listed in `emails`.
   */
  control_skipped: number;
  /**
   * The owner's personal address, where reports and questions go; null when
   * none is known. Read from the server at most every few minutes and saved
   * with the profile, so it follows an owner who sets one up after pairing.
   */
  owner_member_address: string | null;
  /** The checked profile and the address it receives for. */
  profile: string;
  to: string;
  /** Template of each email's `read_command`, with `<id>` for the email ID. */
  read_command: string;
};

type ListQuery = NonNullable<ListEmailsData["query"]> & {
  exclude_fyi?: "true";
  exclude_muted?: "true";
};

function readCursor(path: string): string | null {
  try {
    const saved = readMailJson(path);
    if (
      saved &&
      typeof saved === "object" &&
      !Array.isArray(saved) &&
      (saved as { version?: unknown }).version === 1
    ) {
      const cursor = (saved as { cursor?: unknown }).cursor;
      if (typeof cursor === "string" && cursor.length > 0) return cursor;
    }
  } catch {
    /* An unreadable cursor starts again from the beginning. */
  }
  return null;
}

/**
 * Mail the CLI handles itself: a presence probe whose authenticated
 * projection marks it as control mail (verified, or pending while its proof
 * settles; a rejected one is ordinary mail), and the exact setup challenge
 * this profile's setup recorded. Nothing is judged by sender or subject: the
 * owner can write from the control address, and that email is listed like
 * any other.
 */
export function isControlMail(
  email: Pick<EmailSummary, "id" | "presence_control">,
  setupChallengeId: string | null,
): boolean {
  return (
    presenceDisposition(email) !== "ordinary" ||
    (setupChallengeId !== null && email.id === setupChallengeId)
  );
}

/** The setup challenge's email ID saved by this profile's setup, if any. */
function savedSetupChallengeId(directory: string): string | null {
  try {
    const saved = readMailJson(join(directory, "setup.json")) as {
      challenge?: { id?: unknown } | null;
    } | null;
    const id = saved?.challenge?.id;
    return typeof id === "string" && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

export async function checkAgentMail(options: {
  configDir: string;
  identity: ConnectedAgentIdentity;
  client: PrimitiveApiClient;
  /** How the agent invokes this CLI, used in `read_command`. */
  invocation?: string;
  maxPages?: number;
  /** Reads the owner's personal address; defaults to a throttled refresh. */
  ownerMemberAddress?: () => Promise<string | null>;
  /** Delivers the result; the cursor advances only after it returns. */
  emit(result: MailCheckResult): void;
}): Promise<MailCheckResult> {
  const { identity } = options;
  const directory = agentProfileDirectory(
    options.configDir,
    identity.profileName,
  );
  privateMailDirectory(directory, true);
  const release = acquireListenLock(directory, "mail-check");
  // Every command selects the profile explicitly: a session can carry several
  // connected profiles, and an email is readable only under the one that
  // received it.
  const readCommand = (id: string) =>
    `PRIMITIVE_AGENT_PROFILE=${identity.profileName} ${options.invocation ?? "primitive"} emails get --id ${id} --context`;
  const to = identity.agentAddress.toLowerCase();
  // Runs beside the mail read; it never throws and is bounded by its timeout.
  const ownerMember = (
    options.ownerMemberAddress ??
    (() =>
      refreshOwnerMemberAddressPeriodically({
        configDir: options.configDir,
        profileName: identity.profileName,
      }))
  )().catch(() => identity.ownerMemberAddress ?? null);
  try {
    const path = join(directory, CURSOR_FILE);
    const saved = readCursor(path);
    const setupChallenge = savedSetupChallengeId(directory);
    let cursor = saved;
    const emails: MailCheckItem[] = [];
    let controlSkipped = 0;
    let more = false;
    const maxPages = options.maxPages ?? MAIL_CHECK_MAX_PAGES;
    for (let page = 0; page < maxPages; page++) {
      const query: ListQuery = {
        since: cursor ?? "start",
        limit: MAIL_CHECK_PAGE_SIZE,
        exclude_fyi: "true",
        exclude_muted: "true",
      };
      const result = await listEmails({
        client: options.client.client,
        query,
        responseStyle: "fields",
      });
      if (result.error || !result.data)
        throw new MailCheckApiError(result.error);
      const rows = result.data.data ?? [];
      for (const row of rows) {
        if (isControlMail(row, setupChallenge)) controlSkipped++;
        else
          emails.push({
            id: row.id,
            received_at: row.received_at,
            sender: row.sender,
            thread_id: row.thread_id ?? null,
            to,
            read_command: readCommand(row.id),
          });
      }
      // The tail is caught up only on an empty page, which returns a null
      // cursor; keep the previous one then. A short page with a cursor may
      // still be followed by more mail, so paging follows the cursor.
      const next = result.data.meta?.cursor ?? null;
      if (rows.length === 0 || !next) break;
      cursor = next;
      more = page === maxPages - 1;
    }
    const output: MailCheckResult = {
      ...(emails.length > 0
        ? {
            guidance: loadSkillLine(
              installedConnectSkillFile({ runtime: mailCheckRuntime() }),
            ),
          }
        : {}),
      outcome: emails.length > 0 ? "mail" : "empty",
      emails,
      more,
      control_skipped: controlSkipped,
      owner_member_address: await ownerMember,
      profile: identity.profileName,
      to,
      read_command: readCommand("<id>"),
    };
    options.emit(output);
    if (cursor && cursor !== saved) writeMailJson(path, { version: 1, cursor });
    return output;
  } finally {
    release();
  }
}

/** The runtime this mail check runs in, from the runtime's own session variable. */
function mailCheckRuntime(): AgentRuntime | null {
  const key = currentMailSessionKey();
  return key?.startsWith("claude:")
    ? "claude"
    : key?.startsWith("codex:")
      ? "codex"
      : null;
}
