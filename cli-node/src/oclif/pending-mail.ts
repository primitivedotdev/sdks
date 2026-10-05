import {
  lstatSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import {
  agentProfileDirectory,
  agentProfilesDirectory,
} from "./connected-agent-profile.js";
import { isWakeInteractionLabel } from "./interaction-actions.js";
import {
  privateMailPermissions,
  syncMailDirectory,
  withMailLock,
  writeMailJson,
} from "./shared-mail-files.js";
import type { WakeRelationship } from "./wake-context.js";

const RELATIONSHIPS: readonly string[] = [
  "owner",
  "member",
  "agent",
  "contact",
  "other",
];

/**
 * Durable per-session notices for mail a wake listener accepted. A notice is
 * written before the wake event is acknowledged, so a crash after the
 * acknowledgement cannot lose it, and stays until the session reads that
 * exact email (`primitive emails get --id <id>`). Notices carry only
 * server-derived metadata, never subject or body text.
 *
 * File: <configDir>/agent-connections/profiles/<profile>/pending-mail-<session>.json
 * Shape: {"version":1,"session_id":"<id>","notices":[PendingMailNotice, ...]}
 */
export type PendingMailNotice = {
  /** `mail` for a received email to read; `status` for a peer signal on our send. */
  kind: "mail" | "status";
  email_id: string;
  received_at: string;
  sender: string;
  thread_id: string | null;
  in_thread: boolean;
  newer: number | null;
  /** Status notices only: the sent email the signal refers to. */
  ref_sent_email_id?: string;
  /**
   * Mail notices only: the server's interaction kind for an interaction card,
   * or `fyi`. Absent for ordinary mail.
   */
  interaction?: string;
  /**
   * Mail notices only: the sender relationship the live wake reported, so a
   * replayed notice prints the same line (and load-the-skill line) as the
   * live wake did. Absent on notices written before it was recorded.
   */
  relationship?: WakeRelationship;
  /** Mail notices only: whether the email has attachments, as the live wake reported. */
  attachments?: boolean;
  /**
   * Mail notices only: consecutive reads of this email by its own profile
   * that the API answered not_found. Absent until the first such read.
   */
  not_found_reads?: number;
};

export const PENDING_MAIL_LIMIT = 50;
/**
 * Extra room kept for status notices, so a status notice can always be
 * journaled even when unread mail fills PENDING_MAIL_LIMIT. Beyond it the
 * oldest status notice gives way, never mail.
 */
export const PENDING_STATUS_HEADROOM = 10;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const FILE =
  /^pending-mail-([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\.json$/;

function sessionId(value: string): string {
  const id = value.toLowerCase();
  if (!UUID.test(id)) throw new Error("A pending mail session must be a UUID.");
  return id;
}

export function pendingMailPath(
  configDir: string,
  profileName: string,
  session: string,
): string {
  return join(
    agentProfileDirectory(configDir, profileName),
    `pending-mail-${sessionId(session)}.json`,
  );
}

function lockDirectory(configDir: string, profileName: string): string {
  return join(
    agentProfileDirectory(configDir, profileName),
    ".pending-mail-lock",
  );
}

function notice(value: unknown): PendingMailNotice | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  // Notices written before `kind` existed are mail notices.
  const kind = row.kind ?? "mail";
  if (
    (kind !== "mail" && kind !== "status") ||
    (kind === "status"
      ? typeof row.ref_sent_email_id !== "string" ||
        !UUID.test(row.ref_sent_email_id)
      : row.ref_sent_email_id !== undefined) ||
    typeof row.email_id !== "string" ||
    !UUID.test(row.email_id) ||
    typeof row.received_at !== "string" ||
    !Number.isFinite(Date.parse(row.received_at)) ||
    typeof row.sender !== "string" ||
    row.sender.length > 254 ||
    !/^[^\s<>@"]+@[^\s<>@"]+\.[^\s<>@"]+$/.test(row.sender) ||
    !(
      row.thread_id === null ||
      (typeof row.thread_id === "string" && UUID.test(row.thread_id))
    ) ||
    typeof row.in_thread !== "boolean" ||
    !(
      row.newer === null ||
      (typeof row.newer === "number" &&
        Number.isSafeInteger(row.newer) &&
        row.newer >= 0)
    )
  )
    return null;
  return {
    kind,
    email_id: row.email_id,
    received_at: row.received_at,
    sender: row.sender,
    thread_id: row.thread_id as string | null,
    in_thread: row.in_thread,
    newer: row.newer as number | null,
    ...(kind === "status"
      ? { ref_sent_email_id: row.ref_sent_email_id as string }
      : {}),
    // An unreadable label is dropped, never the notice.
    ...(kind === "mail" && isWakeInteractionLabel(row.interaction)
      ? { interaction: row.interaction }
      : {}),
    ...(kind === "mail" &&
    typeof row.relationship === "string" &&
    RELATIONSHIPS.includes(row.relationship)
      ? { relationship: row.relationship as WakeRelationship }
      : {}),
    ...(kind === "mail" && typeof row.attachments === "boolean"
      ? { attachments: row.attachments }
      : {}),
    ...(kind === "mail" &&
    typeof row.not_found_reads === "number" &&
    Number.isSafeInteger(row.not_found_reads) &&
    row.not_found_reads > 0
      ? { not_found_reads: row.not_found_reads }
      : {}),
  };
}

/**
 * Read one session's notices without taking the lock. Writers replace the
 * file atomically, so a reader sees a whole old or new file, never a partial
 * one. A corrupt or foreign file reads as empty; only a writer holding the
 * lock (`repair`) sets it aside with a `.corrupt-<time>` suffix.
 */
export function readPendingMail(
  configDir: string,
  profileName: string,
  session: string,
  repair = false,
): PendingMailNotice[] {
  const path = pendingMailPath(configDir, profileName, session);
  let text: string;
  try {
    const info = lstatSync(path);
    if (!info.isFile() || !privateMailPermissions(info)) throw new Error();
    text = readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    return repair ? setAside(path) : [];
  }
  try {
    const value = JSON.parse(text) as Record<string, unknown>;
    if (
      value?.version !== 1 ||
      value.session_id !== sessionId(session) ||
      !Array.isArray(value.notices)
    )
      throw new Error();
    const notices = value.notices.map(notice);
    if (notices.some((row) => row === null)) throw new Error();
    return notices as PendingMailNotice[];
  } catch {
    return repair ? setAside(path) : [];
  }
}

function setAside(path: string): PendingMailNotice[] {
  try {
    renameSync(path, `${path}.corrupt-${Date.now()}`);
  } catch {
    /* A file that cannot be moved is retried on the next write. */
  }
  return [];
}

function write(
  configDir: string,
  profileName: string,
  session: string,
  notices: PendingMailNotice[],
): void {
  const path = pendingMailPath(configDir, profileName, session);
  if (notices.length === 0) {
    try {
      unlinkSync(path);
      syncMailDirectory(agentProfileDirectory(configDir, profileName));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return;
  }
  writeMailJson(path, {
    version: 1,
    session_id: sessionId(session),
    notices,
  });
}

/**
 * The notice list is full of unread mail. Nothing is dropped: the caller
 * leaves the event unacknowledged, so the mail stays queued and is
 * recorded once the session reads some of its notices.
 */
export class PendingMailFullError extends Error {
  constructor() {
    super(
      `This session already has ${PENDING_MAIL_LIMIT} unread pending notices. Read some with primitive emails get --id <id>; newer mail stays queued until then.`,
    );
  }
}

/**
 * Add or refresh one notice, deduplicated by email id. Unread mail is never
 * evicted: a mail notice past PENDING_MAIL_LIMIT fails with
 * PendingMailFullError. A status notice always fits, using the headroom
 * above that cap and replacing the oldest status notice when it is full.
 */
export async function recordPendingMail(
  configDir: string,
  profileName: string,
  session: string,
  value: PendingMailNotice,
): Promise<PendingMailNotice[]> {
  const row = notice({
    ...value,
    email_id: value.email_id.toLowerCase(),
    ...(value.ref_sent_email_id
      ? { ref_sent_email_id: value.ref_sent_email_id.toLowerCase() }
      : {}),
  });
  if (!row) throw new Error("Pending mail notice is invalid.");
  return withMailLock(lockDirectory(configDir, profileName), () => {
    const next = [
      ...readPendingMail(configDir, profileName, session, true).filter(
        (existing) => existing.email_id !== row.email_id,
      ),
      row,
    ];
    // Unread mail is capped and never evicted; a new mail notice past the
    // cap is refused so its event stays queued.
    if (
      row.kind !== "status" &&
      next.filter((existing) => existing.kind !== "status").length >
        PENDING_MAIL_LIMIT
    )
      throw new PendingMailFullError();
    // Status notices use the headroom above the mail cap, so one can always
    // be journaled; past it the oldest other status notice gives way.
    while (next.length > PENDING_MAIL_LIMIT + PENDING_STATUS_HEADROOM) {
      const status = next.findIndex(
        (existing) => existing !== row && existing.kind === "status",
      );
      if (status === -1) throw new PendingMailFullError();
      next.splice(status, 1);
    }
    write(configDir, profileName, session, next);
    return next;
  });
}

/** Remove exact email ids from one session's notices; deletes the file when empty. */
export async function removePendingMail(
  configDir: string,
  profileName: string,
  session: string,
  emailIds: string[],
): Promise<PendingMailNotice[]> {
  const remove = new Set(emailIds.map((id) => id.toLowerCase()));
  return withMailLock(lockDirectory(configDir, profileName), () => {
    const current = readPendingMail(configDir, profileName, session, true);
    const next = current.filter((row) => !remove.has(row.email_id));
    if (next.length !== current.length)
      write(configDir, profileName, session, next);
    return next;
  });
}

/** Session ids that currently have a pending-mail file in the profile. */
export function pendingMailSessions(
  configDir: string,
  profileName: string,
): string[] {
  try {
    return readdirSync(agentProfileDirectory(configDir, profileName))
      .map((name) => FILE.exec(name)?.[1])
      .filter((id): id is string => id !== undefined);
  } catch {
    return [];
  }
}

/**
 * Clear one email after a session read it, from that session's file only.
 * A read with no known runtime session (a terminal or script) clears
 * nothing: it is not evidence that any session has seen the email, and each
 * session keeps its notice until it reads the email itself.
 */
export async function clearReadPendingMail(
  configDir: string,
  profileName: string,
  session: string | null,
  emailId: string,
): Promise<void> {
  if (!session) return;
  const sessions = pendingMailSessions(configDir, profileName).filter(
    (id) => id === sessionId(session),
  );
  for (const id of sessions)
    await removePendingMail(configDir, profileName, id, [emailId]);
}

/**
 * Clear one email's notices for a session after the session consumed it
 * without reading it by id: an exact reply that `primitive chat` or
 * `primitive emails wait` returned. Every profile of the session holding a
 * notice for the email is cleared, so a restarted wake does not announce a
 * reply the session already has. A key with no runtime session clears
 * nothing.
 */
export async function clearConsumedPendingMail(
  configDir: string,
  sessionKey: string | null | undefined,
  emailId: string,
): Promise<void> {
  const session = sessionKey?.slice(sessionKey.indexOf(":") + 1).toLowerCase();
  if (!session || !UUID.test(session)) return;
  for (const profile of pendingMailProfiles(configDir, session, emailId))
    await removePendingMail(configDir, profile, session, [emailId]);
}

/**
 * Consecutive not_found reads after which a mail notice is dropped. The
 * notice is otherwise cleared only by a successful read, so an email that
 * was deleted or is no longer visible to the profile would be announced
 * after every tool call for as long as the session lives.
 */
export const PENDING_NOT_FOUND_LIMIT = 3;

export type NotFoundReadOutcome =
  | { kind: "absent" }
  | { kind: "counted"; reads: number }
  | { kind: "dropped"; reads: number };

/**
 * Record that this profile read one of its own pending emails and the API
 * answered not_found. At PENDING_NOT_FOUND_LIMIT consecutive misses the
 * notice is removed. A successful read removes the notice outright, so the
 * count never spans a success.
 */
export async function recordPendingNotFoundRead(
  configDir: string,
  profileName: string,
  session: string,
  emailId: string,
  limit = PENDING_NOT_FOUND_LIMIT,
): Promise<NotFoundReadOutcome> {
  const id = emailId.toLowerCase();
  return withMailLock(lockDirectory(configDir, profileName), () => {
    const current = readPendingMail(configDir, profileName, session, true);
    const index = current.findIndex(
      (row) => row.kind === "mail" && row.email_id === id,
    );
    const row = current[index];
    if (!row) return { kind: "absent" } as const;
    const reads = (row.not_found_reads ?? 0) + 1;
    if (reads >= limit) {
      write(
        configDir,
        profileName,
        session,
        current.filter((_, at) => at !== index),
      );
      return { kind: "dropped", reads } as const;
    }
    const next = [...current];
    next[index] = { ...row, not_found_reads: reads };
    write(configDir, profileName, session, next);
    return { kind: "counted", reads } as const;
  });
}

/**
 * Profiles in this config directory that hold a pending mail notice for
 * the email in the given session. A session can carry several connected
 * profiles, each with its own notices.
 */
export function pendingMailProfiles(
  configDir: string,
  session: string,
  emailId: string,
): string[] {
  const id = emailId.toLowerCase();
  let names: string[];
  try {
    names = readdirSync(join(agentProfilesDirectory(configDir), "profiles"));
  } catch {
    return [];
  }
  return names
    .filter((name) => {
      try {
        return readPendingMail(configDir, name, session).some(
          (row) => row.kind === "mail" && row.email_id === id,
        );
      } catch {
        return false;
      }
    })
    .sort();
}
