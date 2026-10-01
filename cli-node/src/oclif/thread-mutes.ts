import { lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { agentProfileDirectory } from "./connected-agent-profile.js";
import {
  mailId,
  privateMailPermissions,
  withMailLock,
  writeMailJson,
} from "./shared-mail-files.js";

/**
 * Local thread mutes, stored per connected profile beside its listener state.
 * A mute names one thread and either one runtime session (`claude:<id>` or
 * `codex:<id>`) or, with a null session, every session on the profile.
 */
export type ThreadMute = {
  thread_id: string;
  session: string | null;
  muted_at: string;
};

const MAX_MUTES = 500;
const SESSION =
  /^(?:claude|codex):[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

export class ThreadMuteStateError extends Error {}

function mutePath(configDir: string, profileName: string): string {
  return join(
    agentProfileDirectory(configDir, profileName),
    "muted-threads.json",
  );
}

function lockDirectory(configDir: string, profileName: string): string {
  return join(
    agentProfileDirectory(configDir, profileName),
    ".muted-threads-lock",
  );
}

function session(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !SESSION.test(value))
    throw new ThreadMuteStateError("Thread mute state is invalid.");
  return value;
}

/** Read the profile's mutes. A missing file means no mutes. */
export function readThreadMutes(
  configDir: string,
  profileName: string,
): ThreadMute[] {
  const path = mutePath(configDir, profileName);
  let text: string;
  try {
    const info = lstatSync(path);
    if (!info.isFile() || !privateMailPermissions(info))
      throw new ThreadMuteStateError(
        "Thread mute state must be a private file.",
      );
    text = readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    if (error instanceof ThreadMuteStateError) throw error;
    throw new ThreadMuteStateError("Thread mute state could not be read.");
  }
  try {
    const value = JSON.parse(text) as { version?: unknown; threads?: unknown };
    if (value?.version !== 1 || !Array.isArray(value.threads))
      throw new Error();
    return value.threads.map((row) => {
      const item = row as Record<string, unknown>;
      if (
        typeof item.muted_at !== "string" ||
        !Number.isFinite(Date.parse(item.muted_at))
      )
        throw new Error();
      return {
        thread_id: mailId(item.thread_id),
        session: session(item.session),
        muted_at: item.muted_at,
      };
    });
  } catch {
    throw new ThreadMuteStateError(
      "Thread mute state is invalid. Remove muted-threads.json from the agent profile directory to reset it.",
    );
  }
}

/** True when the thread is muted for this session or for the whole profile. */
export function isThreadMuted(
  configDir: string,
  profileName: string,
  threadId: string | null | undefined,
  sessionKey: string | null,
): boolean {
  if (!threadId) return false;
  const id = threadId.toLowerCase();
  return readThreadMutes(configDir, profileName).some(
    (mute) =>
      mute.thread_id === id &&
      (mute.session === null || mute.session === sessionKey),
  );
}

async function update(
  configDir: string,
  profileName: string,
  change: (mutes: ThreadMute[]) => ThreadMute[],
): Promise<ThreadMute[]> {
  return withMailLock(lockDirectory(configDir, profileName), () => {
    const next = change(readThreadMutes(configDir, profileName)).slice(
      -MAX_MUTES,
    );
    writeMailJson(mutePath(configDir, profileName), {
      version: 1,
      threads: next,
    });
    return next;
  });
}

export async function muteThread(
  configDir: string,
  profileName: string,
  threadId: string,
  sessionKey: string | null,
  now = new Date(),
): Promise<{ mute: ThreadMute; changed: boolean }> {
  const id = mailId(threadId);
  const scope = session(sessionKey);
  let changed = false;
  let mute: ThreadMute = {
    thread_id: id,
    session: scope,
    muted_at: now.toISOString(),
  };
  await update(configDir, profileName, (mutes) => {
    const existing = mutes.find(
      (row) => row.thread_id === id && row.session === scope,
    );
    if (existing) {
      mute = existing;
      return mutes;
    }
    changed = true;
    return [...mutes, mute];
  });
  return { mute, changed };
}

export async function unmuteThread(
  configDir: string,
  profileName: string,
  threadId: string,
  sessionKey: string | null,
): Promise<{ removed: boolean; remaining: ThreadMute[] }> {
  const id = mailId(threadId);
  const scope = session(sessionKey);
  let removed = false;
  const next = await update(configDir, profileName, (mutes) =>
    mutes.filter((row) => {
      const match = row.thread_id === id && row.session === scope;
      if (match) removed = true;
      return !match;
    }),
  );
  return { removed, remaining: next.filter((row) => row.thread_id === id) };
}
