import { randomUUID } from "node:crypto";
import {
  closeSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  type Stats,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { acquireListenLock, ListenStateError } from "./listen-state.js";

export class SharedMailStateError extends ListenStateError {}
export const invalidSharedMail = () =>
  new SharedMailStateError(
    "Shared mail state is invalid or inconsistent. Preserve it before retrying to avoid duplicate delivery.",
  );
// Windows uses the existing CLI user-config directory and inherited user ACLs.
// POSIX ownership/mode checks do not describe Windows ACLs.
export function privateMailPermissions(
  info: Pick<Stats, "uid" | "mode">,
  platform = process.platform,
): boolean {
  return (
    platform === "win32" ||
    (info.uid === process.getuid?.() && (info.mode & 0o077) === 0)
  );
}
export function privateMailDirectory(path: string, create = false): void {
  if (create) {
    const created = mkdirSync(path, { recursive: true, mode: 0o700 });
    if (created !== undefined) {
      // Each newly linked directory must survive alongside its durable records.
      let current = path;
      for (;;) {
        syncMailDirectory(current);
        syncMailDirectory(dirname(current));
        if (current === created) break;
        current = dirname(current);
      }
    }
  }
  const stat = lstatSync(path);
  if (!stat.isDirectory() || !privateMailPermissions(stat))
    throw invalidSharedMail();
}
export function syncMailDirectory(
  path: string,
  platform = process.platform,
): void {
  // Same portability policy as the existing listener subscription store.
  if (platform === "win32") return;
  const fd = openSync(path, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
export function readMailJson(path: string, maxBytes = 16_384): unknown | null {
  try {
    const info = lstatSync(path);
    if (!info.isFile() || !privateMailPermissions(info) || info.size > maxBytes)
      throw invalidSharedMail();
    const value: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (value === null) throw invalidSharedMail();
    return value;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    const invalid = invalidSharedMail();
    // Keep only the errno so callers can tell a failing disk from bad
    // content; the message and path stay private.
    if (typeof code === "string")
      (invalid as Error & { cause?: unknown }).cause = { code };
    throw invalid;
  }
}
export function writeMailJson(path: string, value: unknown): void {
  privateMailDirectory(dirname(path), true);
  const temporary = join(dirname(path), `.write-${randomUUID()}`);
  try {
    const fd = openSync(temporary, "wx", 0o600);
    try {
      writeFileSync(fd, `${JSON.stringify(value)}\n`);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(temporary, path);
    syncMailDirectory(dirname(path));
  } finally {
    try {
      unlinkSync(temporary);
    } catch {
      /* Temporary files cannot authorize replay. */
    }
  }
}
export function removeMailFile(path: string): void {
  try {
    unlinkSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  syncMailDirectory(dirname(path));
}
export function mailLockBusy(error: unknown): boolean {
  return (
    error instanceof ListenStateError &&
    /^(Another listener|Subscription lock changed)/.test(error.message)
  );
}
export async function withMailLock<T>(
  directory: string,
  action: () => T,
  signal?: AbortSignal,
): Promise<T> {
  const deadline = performance.now() + 5000;
  for (;;) {
    signal?.throwIfAborted();
    let release: (() => void) | undefined;
    try {
      release = acquireListenLock(directory, "shared-mail-state");
    } catch (error) {
      if (!mailLockBusy(error) || performance.now() >= deadline) throw error;
      await delay(25, undefined, { signal });
      continue;
    }
    try {
      signal?.throwIfAborted();
      return action();
    } finally {
      release();
    }
  }
}
export function mailObject(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw invalidSharedMail();
  const result = value as Record<string, unknown>;
  if (
    Object.keys(result).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(result, key))
  )
    throw invalidSharedMail();
  return result;
}
export function mailId(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)
  )
    throw invalidSharedMail();
  return value.toLowerCase();
}
export function mailString(value: unknown, max = 256): string {
  if (
    typeof value !== "string" ||
    !value ||
    value.length > max ||
    Array.from(value).some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    throw invalidSharedMail();
  return value;
}
export function mailAddress(value: unknown): string {
  const address = mailString(value, 254).toLowerCase();
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(address))
    throw invalidSharedMail();
  return address;
}
export function mailTime(value: unknown): string {
  const time = mailString(value, 40);
  if (!Number.isFinite(Date.parse(time))) throw invalidSharedMail();
  return new Date(time).toISOString();
}
