import { join } from "node:path";
import type { CliLocation, HookContext } from "./claude-machine-hooks.js";
import {
  jsonIndentation,
  type ManagedFileRead,
  readManagedFile,
  writeManagedFile,
} from "./machine-files.js";

type RecordValue = Record<string, unknown>;

function record(value: unknown): value is RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Codex hook commands are shell strings, so every path is single-quoted. */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

const MANAGED_SUFFIX = /\bagent session-register --runtime codex --hook\s*$/;

export function codexHookCommand(cli: CliLocation): string {
  return `${shellQuote(cli.node)} ${shellQuote(cli.entry)} agent session-register --runtime codex --hook`;
}

/** A SessionStart hook this CLI installed, from any CLI path or version. */
function isManaged(hook: unknown): hook is RecordValue {
  return (
    record(hook) &&
    hook.type === "command" &&
    typeof hook.command === "string" &&
    MANAGED_SUFFIX.test(hook.command)
  );
}

export type CodexHooksRead =
  | {
      ok: true;
      path: string;
      read: Extract<ManagedFileRead, { state: "absent" | "present" }>;
      settings: RecordValue;
    }
  | { ok: false; path: string; detail: string };

/** Parse hooks.json. Anything unexpected is reported, never repaired. */
export function readCodexHooks(codexHome: string): CodexHooksRead {
  const path = join(codexHome, "hooks.json");
  const read = readManagedFile(path);
  if (read.state === "invalid") return { ok: false, path, detail: read.detail };
  if (read.state === "absent") return { ok: true, path, read, settings: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(read.text);
  } catch {
    return {
      ok: false,
      path,
      detail: `${path} is not valid JSON. Fix it by hand; it was not modified.`,
    };
  }
  if (!record(parsed) || (parsed.hooks !== undefined && !record(parsed.hooks)))
    return {
      ok: false,
      path,
      detail: `${path} must be a JSON object with a "hooks" object. Fix it by hand; it was not modified.`,
    };
  const entries = record(parsed.hooks) ? parsed.hooks.SessionStart : undefined;
  if (entries !== undefined && !Array.isArray(entries))
    return {
      ok: false,
      path,
      detail: `hooks.SessionStart in ${path} is not a list. Fix it by hand; it was not modified.`,
    };
  return { ok: true, path, read, settings: parsed };
}

function sessionStartEntries(settings: RecordValue): unknown[] {
  const hooks = record(settings.hooks) ? settings.hooks : {};
  return Array.isArray(hooks.SessionStart) ? hooks.SessionStart : [];
}

/** Where each managed hook sits, as Codex numbers hooks for trust records. */
function managedPositions(
  settings: RecordValue,
): Array<{ entry: number; hook: number; value: RecordValue }> {
  const found: Array<{ entry: number; hook: number; value: RecordValue }> = [];
  sessionStartEntries(settings).forEach((entry, entryIndex) => {
    if (!record(entry) || !Array.isArray(entry.hooks)) return;
    entry.hooks.forEach((hook: unknown, hookIndex: number) => {
      if (isManaged(hook))
        found.push({ entry: entryIndex, hook: hookIndex, value: hook });
    });
  });
  return found;
}

export type CodexHookFinding = {
  status: "ok" | "warn" | "fail";
  detail: string;
  fixable: boolean;
};

/**
 * Codex runs a hooks.json hook only after the person trusts it, recording
 * that under `[hooks.state."<file>:session_start:<entry>:<hook>"]` in
 * config.toml. A missing record means the hook is installed but not yet
 * running.
 */
function trustRecorded(
  configToml: string | null,
  hooksPath: string,
  entry: number,
  hook: number,
): boolean {
  if (configToml === null) return false;
  return configToml.includes(
    `[hooks.state."${hooksPath}:session_start:${entry}:${hook}"]`,
  );
}

export function inspectCodexHook(
  read: Extract<CodexHooksRead, { ok: true }>,
  context: HookContext,
  configToml: string | null,
): CodexHookFinding {
  const canFix = context.cli !== null && context.blocked === null;
  const blockedNote = context.blocked ? ` ${context.blocked}` : "";
  const managed = managedPositions(read.settings);
  const [first] = managed;
  if (!first)
    return {
      status: "fail",
      detail: `No SessionStart hook in ${read.path} runs \`primitive agent session-register --runtime codex --hook\`.${blockedNote}`,
      fixable: canFix,
    };
  if (managed.length > 1)
    return {
      status: "fail",
      detail: `${managed.length} SessionStart hooks run \`primitive agent session-register\`; expected exactly one.${blockedNote}`,
      fixable: canFix,
    };
  if (!context.cli || first.value.command !== codexHookCommand(context.cli))
    return {
      status: "fail",
      detail: `The Codex SessionStart hook runs ${String(first.value.command)}, not this CLI.${blockedNote}`,
      fixable: canFix,
    };
  if (!trustRecorded(configToml, read.path, first.entry, first.hook))
    return {
      status: "warn",
      detail:
        "The Codex SessionStart hook is installed, but Codex has no trust record for it yet; Codex asks once before running a new hook.",
      fixable: false,
    };
  return {
    status: "ok",
    detail: `SessionStart runs \`primitive agent session-register --runtime codex --hook\` from ${context.cli.entry}.`,
    fixable: false,
  };
}

/**
 * Keep the first managed hook where it is (Codex keys trust by position),
 * fix its command, drop extra copies, and append one when none exists.
 * Nothing else in the file changes.
 */
export function repairCodexHook(
  settings: RecordValue,
  cli: CliLocation,
): { settings: RecordValue; changed: boolean } {
  const desired = codexHookCommand(cli);
  let placed = false;
  let changed = false;
  const entries = sessionStartEntries(settings).flatMap((entry) => {
    if (!record(entry) || !Array.isArray(entry.hooks)) return [entry];
    let touched = false;
    const kept = entry.hooks.flatMap((hook: unknown) => {
      if (!isManaged(hook)) return [hook];
      if (placed) {
        touched = true;
        return [];
      }
      placed = true;
      if (hook.command === desired) return [hook];
      touched = true;
      return [{ ...hook, command: desired }];
    });
    if (!touched) return [entry];
    changed = true;
    return kept.length ? [{ ...entry, hooks: kept }] : [];
  });
  if (!placed) {
    entries.push({ hooks: [{ type: "command", command: desired }] });
    changed = true;
  }
  if (!changed) return { settings, changed };
  const hooks = record(settings.hooks) ? settings.hooks : {};
  return {
    settings: { ...settings, hooks: { ...hooks, SessionStart: entries } },
    changed,
  };
}

export function writeCodexHooks(params: {
  read: Extract<ManagedFileRead, { state: "absent" | "present" }>;
  settings: RecordValue;
  now?: () => Date;
}): void {
  const original = params.read.state === "present" ? params.read.text : null;
  const indent = original === null ? 2 : jsonIndentation(original);
  const trailing = original === null || original.endsWith("\n") ? "\n" : "";
  writeManagedFile({
    read: params.read,
    content: `${JSON.stringify(params.settings, null, indent)}${trailing}`,
    now: params.now,
    newFileMode: 0o600,
  });
}
