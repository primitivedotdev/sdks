import { hostname } from "node:os";
import { basename, resolve } from "node:path";
import { controlCharacter } from "./agent-rename.js";
import {
  OMP_MAIN,
  type ProcessInfo,
  psProcessInfo,
} from "./machine-session.js";

/** The address note that says where an agent runs and what it is. */
export const RUNTIME_NOTE_NAME = "AGENT_RUNTIME";

export const RUNTIME_NOTE_MAX_LENGTH = 500;

type Env = Record<string, string | undefined>;

export type RuntimeNoteContext = {
  env?: Env;
  hostname?: string;
  cwd?: string;
  /** Whether this command runs inside omp, which sets no marker variable. */
  insideOmp?: () => boolean;
};

/**
 * Whether a parent process is omp. omp exports no variable to the commands
 * it runs, so this walks the process ancestry the way session registration
 * does.
 */
export function insideOmp(
  options: {
    startPid?: number;
    processInfo?: (pid: number) => ProcessInfo | null;
    platform?: NodeJS.Platform;
  } = {},
): boolean {
  if ((options.platform ?? process.platform) === "win32") return false;
  const info = options.processInfo ?? psProcessInfo;
  let pid = options.startPid ?? process.ppid;
  for (let hop = 0; hop < 16 && pid > 1; hop++) {
    const row = info(pid);
    if (!row) return false;
    if (OMP_MAIN.test(row.command)) return true;
    pid = row.ppid;
  }
  return false;
}

const present = (value: string | undefined) => Boolean(value?.trim());

/** The coding runtime this command runs in, from its marker variables. */
export function detectRuntimeLabel(
  env: Env,
  omp: () => boolean = insideOmp,
): string {
  if (present(env.CLAUDE_CODE_SESSION_ID) || present(env.CLAUDECODE))
    return "Claude Code";
  if (present(env.CODEX_THREAD_ID) || present(env.CODEX_SESSION_ID))
    return "Codex";
  if (omp()) return "omp";
  return "CLI";
}

/** The machine name, lowercased, without a trailing `.local`. */
export function runtimeHostLabel(name: string): string {
  const host = name
    .trim()
    .toLowerCase()
    .replace(/\.local\.?$/, "");
  return host || "unknown-host";
}

/**
 * The working directory's folder name only, never its full path, with any
 * control characters dropped so the note stays one line.
 */
export function runtimeFolderLabel(cwd: string): string {
  const folder = Array.from(basename(resolve(cwd)))
    .filter((character) => !controlCharacter(character))
    .join("")
    .trim();
  return folder || "/";
}

/**
 * The default AGENT_RUNTIME value: `<Runtime> on <host> in <folder>`. It is
 * built only from the runtime's name, the machine name and the working
 * directory's folder name; no environment values, paths or credentials are
 * included.
 */
export function defaultRuntimeNote(context: RuntimeNoteContext = {}): string {
  const runtime = detectRuntimeLabel(
    context.env ?? process.env,
    context.insideOmp ?? (() => insideOmp()),
  );
  const host = runtimeHostLabel(context.hostname ?? hostname());
  const folder = runtimeFolderLabel(context.cwd ?? process.cwd());
  const prefix = `${runtime} on ${host} in `;
  // An unusually long folder name keeps its end so the line still fits.
  const room = RUNTIME_NOTE_MAX_LENGTH - prefix.length;
  const shown =
    folder.length <= room ? folder : `...${textTail(folder, room - 3)}`;
  return runtimeNoteValue(`${prefix}${shown}`);
}

/** The end of a text, at most `limit` UTF-16 units, never splitting a character. */
function textTail(text: string, limit: number): string {
  const characters = Array.from(text);
  let tail = "";
  for (let index = characters.length - 1; index >= 0; index--) {
    const next = `${characters[index]}${tail}`;
    if (next.length > limit) break;
    tail = next;
  }
  return tail;
}

/** Validate a one-line AGENT_RUNTIME value. */
export function runtimeNoteValue(value: string): string {
  const text = value.trim();
  if (text === "") throw new Error("The runtime note must not be empty.");
  if (Array.from(text).some(controlCharacter))
    throw new Error(
      "Keep the runtime note to one line without control characters.",
    );
  if (text.length > RUNTIME_NOTE_MAX_LENGTH)
    throw new Error(
      `The runtime note must be at most ${RUNTIME_NOTE_MAX_LENGTH} characters.`,
    );
  return text;
}
