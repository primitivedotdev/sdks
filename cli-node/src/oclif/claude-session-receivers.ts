import { readdirSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  agentProfileName,
  agentProfilesDirectory,
  loadConnectedAgentProfile,
} from "./connected-agent-profile.js";
import { acquireListenLock } from "./listen-state.js";
import { SESSION_UUID } from "./notify-session-native.js";
import {
  mailAddress,
  readMailJson,
  syncMailDirectory,
  writeMailJson,
} from "./shared-mail-files.js";

/**
 * Which connected profiles each Claude Code session receives as. One shared
 * set of Claude hooks serves every session: each hook reads the session id
 * from its input, looks it up here, and exits at once when the session has
 * no receiver. Registering a session writes its entry; disconnecting a
 * profile removes it.
 *
 * File: <configDir>/agent-connections/claude-sessions/<session>.json
 * Shape: {"version":1,"session_id":"<id>","receivers":[{"profile","address"}]}
 */
export type SessionReceiver = { profile: string; address: string };

const FILE = /^([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\.json$/;
const LOCK_WAIT = new Int32Array(new SharedArrayBuffer(4));

export function sessionReceiversDirectory(configDir: string): string {
  return join(agentProfilesDirectory(resolve(configDir)), "claude-sessions");
}

function sessionId(value: string): string {
  const id = value.toLowerCase();
  if (!SESSION_UUID.test(id)) throw new Error("A session must be a UUID.");
  return id;
}

export function sessionReceiversPath(
  configDir: string,
  session: string,
): string {
  return join(
    sessionReceiversDirectory(configDir),
    `${sessionId(session)}.json`,
  );
}

function receiver(value: unknown): SessionReceiver | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  try {
    return {
      profile: agentProfileName(String(row.profile ?? "")),
      address: mailAddress(String(row.address ?? "")),
    };
  } catch {
    return null;
  }
}

/** The profiles one session receives as; empty when it has none. */
export function readSessionReceivers(
  configDir: string,
  session: string,
): SessionReceiver[] {
  let value: unknown;
  try {
    value = readMailJson(sessionReceiversPath(configDir, session));
  } catch {
    return [];
  }
  const row =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  if (
    row?.version !== 1 ||
    row.session_id !== sessionId(session) ||
    !Array.isArray(row.receivers)
  )
    return [];
  return row.receivers.flatMap((item) => {
    const parsed = receiver(item);
    return parsed ? [parsed] : [];
  });
}

/** Every session with an entry, and the profiles it receives as. */
export function listSessionReceivers(
  configDir: string,
): Map<string, SessionReceiver[]> {
  const sessions = new Map<string, SessionReceiver[]>();
  let names: string[];
  try {
    names = readdirSync(sessionReceiversDirectory(configDir));
  } catch {
    return sessions;
  }
  for (const name of names.sort()) {
    const session = FILE.exec(name)?.[1];
    if (!session) continue;
    const receivers = readSessionReceivers(configDir, session);
    if (receivers.length) sessions.set(session, receivers);
  }
  return sessions;
}

function withLock<T>(configDir: string, action: () => T): T {
  const directory = sessionReceiversDirectory(configDir);
  let release: (() => void) | undefined;
  for (let attempt = 0; attempt < 80 && !release; attempt++) {
    try {
      release = acquireListenLock(directory, "claude-session-receivers");
    } catch {
      Atomics.wait(LOCK_WAIT, 0, 0, 25);
    }
  }
  if (!release)
    throw new Error("Another Primitive command is editing session receivers.");
  try {
    return action();
  } finally {
    release();
  }
}

function write(
  configDir: string,
  session: string,
  receivers: SessionReceiver[],
): void {
  const path = sessionReceiversPath(configDir, session);
  if (receivers.length === 0) {
    try {
      unlinkSync(path);
      syncMailDirectory(sessionReceiversDirectory(configDir));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return;
  }
  writeMailJson(path, {
    version: 1,
    session_id: sessionId(session),
    receivers,
  });
}

/**
 * Add or update one profile for a session (its address follows the
 * profile). Returns whether the entry changed.
 */
export function addSessionReceiver(
  configDir: string,
  session: string,
  value: SessionReceiver,
): boolean {
  const next = receiver(value);
  if (!next) throw new Error("A session receiver needs a profile and address.");
  return withLock(configDir, () => {
    const current = readSessionReceivers(configDir, session);
    const existing = current.find((row) => row.profile === next.profile);
    if (existing?.address === next.address) return false;
    write(configDir, session, [
      ...current.filter((row) => row.profile !== next.profile),
      next,
    ]);
    return true;
  });
}

/** Remove one profile from a session. Returns whether it was there. */
export function removeSessionReceiver(
  configDir: string,
  session: string,
  profile: string,
): boolean {
  return withLock(configDir, () => {
    const current = readSessionReceivers(configDir, session);
    const next = current.filter((row) => row.profile !== profile);
    if (next.length === current.length) return false;
    write(configDir, session, next);
    return true;
  });
}

/**
 * Drop entries for profiles that are no longer saved as connected, or whose
 * saved address changed to another. Returns how many were dropped.
 */
export function pruneSessionReceivers(configDir: string): number {
  const live = (row: SessionReceiver) => {
    try {
      const profile = loadConnectedAgentProfile(
        resolve(configDir),
        row.profile,
      );
      return profile !== null && profile.agent_address === row.address;
    } catch {
      // An unreadable profile is kept; the profile checks report it.
      return true;
    }
  };
  let dropped = 0;
  for (const [session, receivers] of listSessionReceivers(configDir)) {
    // A cheap unlocked look first; the rows are judged again under the
    // lock, so a receiver added or updated meanwhile is never dropped.
    if (receivers.every(live)) continue;
    withLock(configDir, () => {
      const current = readSessionReceivers(configDir, session);
      const next = current.filter(live);
      dropped += current.length - next.length;
      if (next.length !== current.length) write(configDir, session, next);
    });
  }
  return dropped;
}
