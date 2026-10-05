import { join } from "node:path";
import {
  type EmailSummary,
  type ListEmailsData,
  listEmails,
  type PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import { SETUP_CHALLENGE_SUBJECT } from "./agent-setup.js";
import {
  agentProfileDirectory,
  type ConnectedAgentIdentity,
} from "./connected-agent-profile.js";
import { acquireListenLock } from "./listen-state.js";
import { refreshOwnerMemberAddressPeriodically } from "./owner-member-address.js";
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
  outcome: "mail" | "empty";
  emails: MailCheckItem[];
  /** More new mail remains; run the check again after handling these. */
  more: boolean;
  /**
   * Setup challenges and presence probes from the control address, handled
   * by the CLI. Other mail from that address is listed in `emails`.
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

/** Subject of the receiver presence probes the control address sends. */
const PRESENCE_PROBE_SUBJECT = "Receiver presence check";

/**
 * Setup challenges and presence probes, which the CLI handles. A presence
 * probe carries `presence_control`; a setup challenge, or a probe the server
 * no longer recognises, is the control address writing with its fixed
 * subject. Anything else from the control address is mail a person wrote
 * (the owner can send from it), so it is reported like any other email.
 */
export function isControlMail(
  email: Pick<EmailSummary, "sender" | "subject" | "presence_control">,
  identity: Pick<ConnectedAgentIdentity, "ownerAddress">,
): boolean {
  if (email.presence_control !== undefined && email.presence_control !== null)
    return true;
  if (
    email.sender.trim().toLowerCase() !==
    identity.ownerAddress.trim().toLowerCase()
  )
    return false;
  const subject = email.subject?.trim();
  return (
    subject === SETUP_CHALLENGE_SUBJECT || subject === PRESENCE_PROBE_SUBJECT
  );
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
    `PRIMITIVE_AGENT_PROFILE=${identity.profileName} ${options.invocation ?? "primitive"} emails get --id ${id} --brief`;
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
        if (isControlMail(row, identity)) controlSkipped++;
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
