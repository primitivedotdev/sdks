import { randomUUID } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  copyFileSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

/** Hand-edited files larger than this are reported, never rewritten. */
const MAX_MANAGED_FILE_BYTES = 1_048_576;
/** Backups kept per file; older Primitive backups of the same file are pruned. */
const BACKUPS_KEPT = 10;
const BACKUP_INFIX = ".primitive-bak-";

/** A safe, user-facing reason a file was not changed. */
export class MachineFileError extends Error {}

export type ManagedFileRead =
  | { state: "absent"; path: string; target: string }
  | {
      state: "present";
      path: string;
      target: string;
      text: string;
      mode: number;
    }
  | { state: "invalid"; path: string; detail: string };

/**
 * Read a user-owned text file without following it anywhere surprising. A
 * symlink is followed to its real file so a later write updates the file the
 * user linked instead of replacing the link.
 */
export function readManagedFile(path: string): ManagedFileRead {
  let info: ReturnType<typeof lstatSync>;
  try {
    info = lstatSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { state: "absent", path, target: path };
    return {
      state: "invalid",
      path,
      detail: `${path} cannot be read (${(error as NodeJS.ErrnoException).code ?? "error"}).`,
    };
  }
  let target = path;
  if (info.isSymbolicLink()) {
    try {
      target = realpathSync(path);
      info = statSync(target);
    } catch {
      return {
        state: "invalid",
        path,
        detail: `${path} is a symlink to a missing file; it was left unchanged.`,
      };
    }
  }
  if (!info.isFile())
    return {
      state: "invalid",
      path,
      detail: `${path} is not a regular file; it was left unchanged.`,
    };
  if (info.size > MAX_MANAGED_FILE_BYTES)
    return {
      state: "invalid",
      path,
      detail: `${path} is larger than 1 MiB; it was left unchanged.`,
    };
  let raw: Buffer;
  try {
    raw = readFileSync(target);
  } catch (error) {
    return {
      state: "invalid",
      path,
      detail: `${path} cannot be read (${(error as NodeJS.ErrnoException).code ?? "error"}).`,
    };
  }
  const text = raw.toString("utf8");
  if (text.includes("\u0000") || !Buffer.from(text, "utf8").equals(raw))
    return {
      state: "invalid",
      path,
      detail: `${path} is not UTF-8 text; it was left unchanged.`,
    };
  return { state: "present", path, target, text, mode: info.mode & 0o777 };
}

function backupStamp(now: Date): string {
  return now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
}

function syncDirectory(directory: string): void {
  if (process.platform === "win32") return;
  try {
    const fd = openSync(directory, "r");
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  } catch {
    /* Durability of the rename is best effort on unusual file systems. */
  }
}

/** Keep only the newest Primitive backups of one file. */
export function pruneManagedBackups(target: string): void {
  const directory = dirname(target);
  const prefix = `${basename(target)}${BACKUP_INFIX}`;
  try {
    const backups = readdirSync(directory)
      .filter((name) => name.startsWith(prefix))
      .sort();
    for (const name of backups.slice(
      0,
      Math.max(0, backups.length - BACKUPS_KEPT),
    ))
      unlinkSync(join(directory, name));
  } catch {
    /* Old backups are harmless; pruning never blocks a repair. */
  }
}

/** Copy the current file beside itself before any change. Returns the copy's path. */
export function backupManagedFile(
  target: string,
  mode: number,
  now: Date,
): string {
  const base = `${target}${BACKUP_INFIX}${backupStamp(now)}`;
  for (let attempt = 0; attempt < 100; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt}`;
    try {
      copyFileSync(target, candidate, constants.COPYFILE_EXCL);
      chmodSync(candidate, mode);
      return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
  throw new MachineFileError(`Could not create a backup of ${target}.`);
}

/**
 * Replace a file atomically (temporary file plus rename in the same
 * directory), after backing up the existing content. The write is refused when
 * the file changed since it was read, so a concurrent edit is never lost.
 */
export function writeManagedFile(params: {
  read: Extract<ManagedFileRead, { state: "absent" | "present" }>;
  content: string;
  now?: () => Date;
  newFileMode?: number;
}): { backup: string | null } {
  const { read } = params;
  const target = read.target;
  const expected = read.state === "present" ? read.text : null;
  const directory = dirname(target);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const current = (): string | null => {
    try {
      return readFileSync(target, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  };
  if (current() !== expected)
    throw new MachineFileError(
      `${read.path} changed while it was being repaired; it was left unchanged.`,
    );
  const mode =
    read.state === "present" ? read.mode : (params.newFileMode ?? 0o644);
  const backup =
    read.state === "present"
      ? backupManagedFile(target, mode, (params.now ?? (() => new Date()))())
      : null;
  const temporary = join(directory, `.${basename(target)}.${randomUUID()}.tmp`);
  try {
    const fd = openSync(temporary, "wx", mode);
    try {
      writeFileSync(fd, params.content, "utf8");
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    chmodSync(temporary, mode);
    // Narrow the window for another writer that does not share our lock.
    if (current() !== expected)
      throw new MachineFileError(
        `${read.path} changed while it was being repaired; it was left unchanged.`,
      );
    renameSync(temporary, target);
    syncDirectory(directory);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
  if (backup) pruneManagedBackups(target);
  return { backup };
}

export const MANAGED_BLOCK_VERSION = 1;
const START = /^<!-- primitive:managed-block v=(\d+) START -->\r?$/;
const END = /^<!-- primitive:managed-block END -->\r?$/;

export type ManagedBlockInspection =
  | { state: "ok" }
  | { state: "missing" }
  | { state: "outdated"; version: number }
  | { state: "malformed"; detail: string };

type BlockLocation = { start: number; end: number; version: number };

/** Character offsets of the single managed block, or why the markers are unusable. */
function locateBlock(
  text: string,
): BlockLocation | null | { malformed: string } {
  const starts: Array<{ offset: number; version: number }> = [];
  const ends: Array<{ offset: number; length: number }> = [];
  let offset = 0;
  for (const line of text.split("\n")) {
    const start = START.exec(line);
    if (start) starts.push({ offset, version: Number(start[1]) });
    else if (END.test(line))
      ends.push({
        offset,
        length: line.endsWith("\r") ? line.length - 1 : line.length,
      });
    else if (line.includes("primitive:managed-block"))
      return {
        malformed:
          "a primitive:managed-block marker line was edited; fix or remove it by hand",
      };
    offset += line.length + 1;
  }
  if (starts.length === 0 && ends.length === 0) return null;
  if (starts.length !== 1 || ends.length !== 1)
    return {
      malformed: `found ${starts.length} START and ${ends.length} END markers; expected one of each`,
    };
  const [start] = starts;
  const [end] = ends;
  if (!start || !end || end.offset < start.offset)
    return { malformed: "the END marker comes before the START marker" };
  return {
    start: start.offset,
    end: end.offset + end.length,
    version: start.version,
  };
}

/** The exact block for a body, using the file's own line ending. */
export function renderManagedBlock(body: string, eol = "\n"): string {
  return [
    `<!-- primitive:managed-block v=${MANAGED_BLOCK_VERSION} START -->`,
    ...body.replace(/\r\n/g, "\n").replace(/\n+$/, "").split("\n"),
    "<!-- primitive:managed-block END -->",
  ].join(eol);
}

function lineEnding(text: string): string {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

export function inspectManagedBlock(
  text: string,
  body: string,
): ManagedBlockInspection {
  const found = locateBlock(text);
  if (found === null) return { state: "missing" };
  if ("malformed" in found)
    return { state: "malformed", detail: found.malformed };
  const current = text.slice(found.start, found.end).replace(/\r\n/g, "\n");
  return current === renderManagedBlock(body)
    ? { state: "ok" }
    : { state: "outdated", version: found.version };
}

/**
 * Replace only the managed block, or append it when absent. Text outside the
 * markers is preserved byte for byte. Throws for malformed markers.
 */
export function upsertManagedBlock(text: string, body: string): string {
  const found = locateBlock(text);
  if (found !== null && "malformed" in found)
    throw new MachineFileError(found.malformed);
  const eol = lineEnding(text);
  const block = renderManagedBlock(body, eol);
  if (found)
    return `${text.slice(0, found.start)}${block}${text.slice(found.end)}`;
  if (text.length === 0) return `${block}${eol}`;
  const separator = text.endsWith(`${eol}${eol}`)
    ? ""
    : text.endsWith(eol)
      ? eol
      : `${eol}${eol}`;
  return `${text}${separator}${block}${eol}`;
}

/** Indentation the file already uses, so a rewrite keeps its style. */
export function jsonIndentation(text: string): string | number {
  const match = /^[{[][^\n]*\n([ \t]+)\S/.exec(text);
  return match?.[1] ?? 2;
}
