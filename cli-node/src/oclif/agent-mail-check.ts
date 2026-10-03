import { join } from "node:path";
import {
  type EmailSummary,
  type ListEmailsData,
  listEmails,
  type PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import {
  agentProfileDirectory,
  type ConnectedAgentIdentity,
} from "./connected-agent-profile.js";
import { acquireListenLock } from "./listen-state.js";
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
};

export type MailCheckResult = {
  outcome: "mail" | "empty";
  emails: MailCheckItem[];
  /** More new mail remains; run the check again after handling these. */
  more: boolean;
  /** Setup and presence mail from the control address, handled by the CLI. */
  control_skipped: number;
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

/** Setup challenges and presence probes come from the control address. */
function isControlMail(
  email: EmailSummary,
  identity: ConnectedAgentIdentity,
): boolean {
  return (
    email.presence_control !== undefined ||
    email.sender.trim().toLowerCase() ===
      identity.ownerAddress.trim().toLowerCase()
  );
}

export async function checkAgentMail(options: {
  configDir: string;
  identity: ConnectedAgentIdentity;
  client: PrimitiveApiClient;
  /** How the agent invokes this CLI, used in `read_command`. */
  invocation?: string;
  maxPages?: number;
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
          });
      }
      // An empty page returns a null cursor: keep the previous one.
      const next = result.data.meta?.cursor ?? null;
      if (next) cursor = next;
      if (rows.length < MAIL_CHECK_PAGE_SIZE || !next) break;
      more = page === maxPages - 1;
    }
    const output: MailCheckResult = {
      outcome: emails.length > 0 ? "mail" : "empty",
      emails,
      more,
      control_skipped: controlSkipped,
      read_command: `PRIMITIVE_AGENT_PROFILE=${identity.profileName} ${options.invocation ?? "primitive"} emails get --id <id> --brief`,
    };
    options.emit(output);
    if (cursor && cursor !== saved) writeMailJson(path, { version: 1, cursor });
    return output;
  } finally {
    release();
  }
}
