import { accessSync, constants, existsSync, realpathSync } from "node:fs";
import { basename, delimiter, dirname, join, resolve } from "node:path";
import { loadConnectedAgentProfile } from "./connected-agent-profile.js";
import { acquireListenLock } from "./listen-state.js";
import {
  jsonIndentation,
  MachineFileError,
  type ManagedFileRead,
  readManagedFile,
  writeManagedFile,
} from "./machine-files.js";

type RecordValue = Record<string, unknown>;

function record(value: unknown): value is RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Where this CLI is installed, as written into Claude hooks. */
export type CliLocation = {
  /** Node binary written into new hooks; a stable PATH link when one resolves to the same file. */
  node: string;
  /** Real path of bin/run.js. */
  entry: string;
  /** Real path of bin/claude-wake.mjs. */
  wake: string;
  /** Real path of bin/claude-pending-mail.mjs. */
  pending: string;
};

function realpathOrNull(path: string): string | null {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
}

/** Two paths name the same existing file. */
export function samePath(a: unknown, b: string): boolean {
  if (typeof a !== "string" || !a) return false;
  if (a === b) return existsSync(a);
  const left = realpathOrNull(a);
  return left !== null && left === realpathOrNull(b);
}

function executable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** The first PATH entry for a command, without running a shell. */
export function findOnPath(
  name: string,
  env: Record<string, string | undefined>,
): string | null {
  for (const directory of (env.PATH ?? "").split(delimiter)) {
    if (!directory) continue;
    const candidate = join(directory, name);
    if (existsSync(candidate) && executable(candidate)) return candidate;
  }
  return null;
}

/**
 * Prefer a PATH link (for example a package manager's `bin/node`) over a
 * versioned install directory when both are the same binary, so a hook keeps
 * working after the versioned directory is replaced by an upgrade.
 */
export function stableNodePath(
  env: Record<string, string | undefined>,
  execPath = process.execPath,
): string {
  const onPath = findOnPath("node", env);
  if (onPath && onPath !== execPath && samePath(onPath, execPath))
    return onPath;
  return execPath;
}

/** Locate the running CLI. Null when its files are not where a package install puts them. */
export function currentCliLocation(
  entryArg: string,
  env: Record<string, string | undefined>,
  execPath = process.execPath,
): CliLocation | null {
  const entry = realpathOrNull(entryArg);
  if (!entry) return null;
  const wake = realpathOrNull(join(dirname(entry), "claude-wake.mjs"));
  const pending = realpathOrNull(
    join(dirname(entry), "claude-pending-mail.mjs"),
  );
  if (!wake || !pending) return null;
  return { node: stableNodePath(env, execPath), entry, wake, pending };
}

/** Package-runner caches are cleaned up behind the user's back. */
export function ephemeralCliReason(entry: string): string | null {
  if (/[\\/]_npx[\\/]/.test(entry)) return "an npx cache";
  if (/[\\/]dlx[-\\/]/.test(entry)) return "a pnpm dlx cache";
  if (/[\\/]bunx-/.test(entry)) return "a bunx cache";
  return null;
}

export function claudeConfigDir(
  env: Record<string, string | undefined>,
  home: string,
): string {
  return resolve(env.CLAUDE_CONFIG_DIR || join(home, ".claude"));
}

export type ClaudeSettingsRead =
  | {
      ok: true;
      read: Extract<ManagedFileRead, { state: "absent" | "present" }>;
      settings: RecordValue;
    }
  | { ok: false; detail: string };

function jsonErrorDetail(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const position = /position (\d+)/.exec(message)?.[1];
  const line = /line (\d+)/.exec(message)?.[1];
  return line
    ? ` near line ${line}`
    : position
      ? ` near character ${position}`
      : "";
}

/** Parse settings.json. Anything unexpected is reported, never repaired. */
export function readClaudeSettings(claudeDir: string): ClaudeSettingsRead {
  const path = join(claudeDir, "settings.json");
  const read = readManagedFile(path);
  if (read.state === "invalid") return { ok: false, detail: read.detail };
  if (read.state === "absent") return { ok: true, read, settings: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(read.text);
  } catch (error) {
    return {
      ok: false,
      detail: `${path} is not valid JSON${jsonErrorDetail(error)}. Fix it by hand; it was not modified.`,
    };
  }
  if (!record(parsed))
    return {
      ok: false,
      detail: `${path} must contain a JSON object. Fix it by hand; it was not modified.`,
    };
  if (parsed.hooks !== undefined && !record(parsed.hooks))
    return {
      ok: false,
      detail: `${path} has a "hooks" value that is not an object. Fix it by hand; it was not modified.`,
    };
  return { ok: true, read, settings: parsed };
}

const LOCK_WAIT = new Int32Array(new SharedArrayBuffer(4));

/**
 * Write settings under the same lock every Primitive hook installer uses,
 * keeping the file's indentation, after a timestamped backup.
 */
export function writeClaudeSettings(params: {
  claudeDir: string;
  read: Extract<ManagedFileRead, { state: "absent" | "present" }>;
  settings: RecordValue;
  now?: () => Date;
}): { backup: string | null } {
  let release: (() => void) | undefined;
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      release = acquireListenLock(
        params.claudeDir,
        "primitive-claude-settings",
      );
      break;
    } catch {
      Atomics.wait(LOCK_WAIT, 0, 0, 25);
    }
  }
  if (!release)
    throw new MachineFileError(
      "Another Primitive command is editing Claude settings; try again shortly.",
    );
  try {
    const original = params.read.state === "present" ? params.read.text : null;
    const indent = original === null ? 2 : jsonIndentation(original);
    const trailing = original === null || original.endsWith("\n") ? "\n" : "";
    return writeManagedFile({
      read: params.read,
      content: `${JSON.stringify(params.settings, null, indent)}${trailing}`,
      now: params.now,
      newFileMode: 0o600,
    });
  } finally {
    release();
  }
}

export type HookCheckId =
  | "claude.hook.session_start"
  | "claude.hook.session_end"
  | "claude.hook.stop";

export type HookFinding = {
  status: "ok" | "fail";
  detail: string;
  fixable: boolean;
};

type GlobalSpec = {
  event: "SessionStart" | "SessionEnd";
  subcommand: "session-register" | "session-end";
  timeout: number;
};

const GLOBAL_HOOKS: Record<
  "claude.hook.session_start" | "claude.hook.session_end",
  GlobalSpec
> = {
  "claude.hook.session_start": {
    event: "SessionStart",
    subcommand: "session-register",
    timeout: 15,
  },
  "claude.hook.session_end": {
    event: "SessionEnd",
    subcommand: "session-end",
    timeout: 10,
  },
};

/** A hook this CLI installed for every Claude session, from any CLI path or version. */
function isGlobalManaged(hook: unknown, spec: GlobalSpec): hook is RecordValue {
  if (!record(hook) || hook.type !== "command" || !Array.isArray(hook.args))
    return false;
  const args = hook.args;
  return (
    args.length === 6 &&
    typeof args[0] === "string" &&
    args[1] === "agent" &&
    args[2] === spec.subcommand &&
    args[3] === "--runtime" &&
    args[4] === "claude" &&
    args[5] === "--hook"
  );
}

function globalHookArgs(cli: CliLocation, spec: GlobalSpec): string[] {
  return [cli.entry, "agent", spec.subcommand, "--runtime", "claude", "--hook"];
}

function globalHookCurrent(hook: RecordValue, cli: CliLocation): boolean {
  const args = hook.args as unknown[];
  return samePath(hook.command, cli.node) && samePath(args[0], cli.entry);
}

const WAKE_MARKER = "primitive-agent-wake-v1";
const PENDING_MARKER = "primitive-pending-mail-v1";
const SESSION_EVENTS = ["Stop", "SessionStart", "PostToolUse"] as const;

type SessionHook = {
  kind: "wake" | "pending";
  configDir: string;
  profile: string | null;
  session: string | null;
};

/** A per-session receive hook written by `agent connect` or `agent enroll`, any version. */
function parseSessionHook(hook: unknown): SessionHook | null {
  if (!record(hook) || hook.type !== "command" || !Array.isArray(hook.args))
    return null;
  const args = hook.args;
  if (!args.every((value) => typeof value === "string")) return null;
  const strings = args as string[];
  const script = basename(strings[0] ?? "");
  if (script === "claude-pending-mail.mjs")
    return strings.length === 7 && strings[6] === PENDING_MARKER
      ? {
          kind: "pending",
          configDir: strings[2] ?? "",
          profile: strings[3] ?? null,
          session: strings[5] ?? null,
        }
      : null;
  if (script !== "claude-wake.mjs") return null;
  if (strings.length === 7 && strings[6] === WAKE_MARKER)
    return {
      kind: "wake",
      configDir: strings[2] ?? "",
      profile: strings[3] ?? null,
      session: strings[5] ?? null,
    };
  if (strings.length === 6 && strings[5] === WAKE_MARKER)
    return {
      kind: "wake",
      configDir: strings[2] ?? "",
      profile: strings[3] ?? null,
      session: null,
    };
  if (strings.length === 4 && strings[3] === WAKE_MARKER)
    return {
      kind: "wake",
      configDir: strings[2] ?? "",
      profile: null,
      session: null,
    };
  return null;
}

/** A saved connected profile still holds a credential. Unreadable counts as live. */
export function profileStillConnected(
  configDir: string,
  profile: string,
): boolean {
  try {
    return loadConnectedAgentProfile(configDir, profile) !== null;
  } catch {
    return true;
  }
}

type SessionHookVerdict = "keep" | "stale" | "duplicate" | "outdated";

function sessionHookPathsCurrent(
  hook: RecordValue,
  parsed: SessionHook,
  cli: CliLocation | null,
): boolean {
  const args = hook.args as string[];
  if (!cli)
    return (
      existsSync(String(hook.command)) &&
      existsSync(args[0] ?? "") &&
      existsSync(args[1] ?? "")
    );
  return (
    samePath(hook.command, cli.node) &&
    samePath(args[0], parsed.kind === "wake" ? cli.wake : cli.pending) &&
    samePath(args[1], cli.entry)
  );
}

function judgeSessionHooks(
  hooks: RecordValue,
  cli: CliLocation | null,
): Map<unknown, SessionHookVerdict> {
  const verdicts = new Map<unknown, SessionHookVerdict>();
  const seen = new Set<string>();
  for (const event of SESSION_EVENTS) {
    const entries = hooks[event];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!record(entry) || !Array.isArray(entry.hooks)) continue;
      for (const hook of entry.hooks) {
        const parsed = parseSessionHook(hook);
        if (!parsed || !record(hook)) continue;
        const pathsExist =
          existsSync(String(hook.command)) &&
          existsSync(String((hook.args as string[])[0])) &&
          existsSync(String((hook.args as string[])[1]));
        const live = parsed.profile
          ? existsSync(parsed.configDir) &&
            profileStillConnected(parsed.configDir, parsed.profile)
          : existsSync(parsed.configDir) && pathsExist;
        if (!live) {
          verdicts.set(hook, "stale");
          continue;
        }
        const key = [
          event,
          parsed.kind,
          resolve(parsed.configDir),
          parsed.profile ?? "",
          parsed.session?.toLowerCase() ?? "",
        ].join("\0");
        if (seen.has(key)) {
          verdicts.set(hook, "duplicate");
          continue;
        }
        seen.add(key);
        verdicts.set(
          hook,
          sessionHookPathsCurrent(hook, parsed, cli) ? "keep" : "outdated",
        );
      }
    }
  }
  return verdicts;
}

function eventEntries(
  hooks: RecordValue,
  event: string,
): unknown[] | "invalid" {
  const entries = hooks[event];
  if (entries === undefined) return [];
  return Array.isArray(entries) ? entries : "invalid";
}

export type HookContext = {
  /** Null when the running CLI cannot be referenced by hooks. */
  cli: CliLocation | null;
  /** Why hooks cannot be written now, shown in fixable checks. */
  blocked: string | null;
};

/** Inspect every Primitive-owned Claude hook without changing anything. */
export function inspectClaudeHooks(
  settings: RecordValue,
  context: HookContext,
): Record<HookCheckId, HookFinding> {
  const hooks = record(settings.hooks) ? settings.hooks : {};
  const canFix = context.cli !== null && context.blocked === null;
  const blockedNote = context.blocked ? ` ${context.blocked}` : "";
  const findings = {} as Record<HookCheckId, HookFinding>;
  for (const [id, spec] of Object.entries(GLOBAL_HOOKS) as Array<
    [keyof typeof GLOBAL_HOOKS, GlobalSpec]
  >) {
    const entries = eventEntries(hooks, spec.event);
    if (entries === "invalid") {
      findings[id] = {
        status: "fail",
        detail: `hooks.${spec.event} is not a list. Fix settings.json by hand; it was not modified.`,
        fixable: false,
      };
      continue;
    }
    const managed = entries.flatMap((entry) =>
      record(entry) && Array.isArray(entry.hooks)
        ? entry.hooks.filter((hook) => isGlobalManaged(hook, spec))
        : [],
    ) as RecordValue[];
    const [first] = managed;
    if (!first)
      findings[id] = {
        status: "fail",
        detail: `No ${spec.event} hook runs \`primitive agent ${spec.subcommand}\`.${blockedNote}`,
        fixable: canFix,
      };
    else if (managed.length > 1)
      findings[id] = {
        status: "fail",
        detail: `${managed.length} ${spec.event} hooks run \`primitive agent ${spec.subcommand}\`; expected exactly one.${blockedNote}`,
        fixable: canFix,
      };
    else if (!context.cli || !globalHookCurrent(first, context.cli))
      findings[id] = {
        status: "fail",
        detail: `The ${spec.event} hook runs ${String((first.args as unknown[])[0])}, which ${
          existsSync(String((first.args as unknown[])[0]))
            ? "is not this CLI"
            : "no longer exists"
        }.${blockedNote}`,
        fixable: canFix,
      };
    else
      findings[id] = {
        status: "ok",
        detail: `${spec.event} runs \`primitive agent ${spec.subcommand}\` from ${context.cli.entry}.`,
        fixable: false,
      };
  }
  const invalid = SESSION_EVENTS.find(
    (event) => eventEntries(hooks, event) === "invalid",
  );
  if (invalid) {
    findings["claude.hook.stop"] = {
      status: "fail",
      detail: `hooks.${invalid} is not a list. Fix settings.json by hand; it was not modified.`,
      fixable: false,
    };
    return findings;
  }
  const counts = { keep: 0, stale: 0, duplicate: 0, outdated: 0 };
  for (const verdict of judgeSessionHooks(hooks, context.cli).values())
    counts[verdict]++;
  const problems = [
    counts.stale ? `${counts.stale} for disconnected or removed sessions` : "",
    counts.duplicate ? `${counts.duplicate} duplicates` : "",
    counts.outdated ? `${counts.outdated} pointing at an old CLI path` : "",
  ].filter(Boolean);
  findings["claude.hook.stop"] = problems.length
    ? {
        status: "fail",
        detail: `Per-session receive hooks need cleanup: ${problems.join(", ")}.${blockedNote}`,
        // Removing hooks for dead sessions never needs a CLI path.
        fixable: canFix || (counts.outdated === 0 && context.blocked === null),
      }
    : {
        status: "ok",
        detail: counts.keep
          ? `${counts.keep} per-session receive hooks, each present once and current.`
          : "No per-session receive hooks; each registered session adds its own exact-session hooks.",
        fixable: false,
      };
  return findings;
}

function rewriteEntries(
  entries: unknown[],
  transform: (hook: unknown) => unknown | undefined,
): { entries: unknown[]; changed: boolean } {
  let changed = false;
  const next = entries.flatMap((entry) => {
    if (!record(entry) || !Array.isArray(entry.hooks)) return [entry];
    let touched = false;
    const kept = entry.hooks.flatMap((hook: unknown) => {
      const replacement = transform(hook);
      if (replacement === hook) return [hook];
      touched = true;
      return replacement === undefined ? [] : [replacement];
    });
    if (!touched) return [entry];
    changed = true;
    return kept.length ? [{ ...entry, hooks: kept }] : [];
  });
  return { entries: next, changed };
}

/**
 * Apply fixes for the requested checks to a copy of the settings. Only
 * Primitive-owned hooks are added, rewritten or removed; every other key,
 * entry and sibling hook is carried over unchanged.
 */
export function repairClaudeHooks(
  settings: RecordValue,
  context: HookContext,
  checks: ReadonlySet<HookCheckId>,
): { settings: RecordValue; changed: Set<HookCheckId> } {
  const changed = new Set<HookCheckId>();
  const hooks: RecordValue = record(settings.hooks)
    ? { ...settings.hooks }
    : {};
  const cli = context.blocked === null ? context.cli : null;
  for (const [id, spec] of Object.entries(GLOBAL_HOOKS) as Array<
    [keyof typeof GLOBAL_HOOKS, GlobalSpec]
  >) {
    if (!checks.has(id) || !cli) continue;
    const entries = eventEntries(hooks, spec.event);
    if (entries === "invalid") continue;
    let placed = false;
    const result = rewriteEntries(entries, (hook) => {
      if (!isGlobalManaged(hook, spec)) return hook;
      if (placed) return undefined;
      placed = true;
      if (globalHookCurrent(hook, cli)) return hook;
      // Keep any field the user tuned (a longer timeout, say); fix the paths.
      return { ...hook, command: cli.node, args: globalHookArgs(cli, spec) };
    });
    let next = result.entries;
    if (!placed)
      next = [
        ...next,
        {
          hooks: [
            {
              type: "command",
              command: cli.node,
              args: globalHookArgs(cli, spec),
              timeout: spec.timeout,
            },
          ],
        },
      ];
    if (result.changed || !placed) {
      hooks[spec.event] = next;
      changed.add(id);
    }
  }
  if (checks.has("claude.hook.stop") && context.blocked === null) {
    const invalid = SESSION_EVENTS.some(
      (event) => eventEntries(hooks, event) === "invalid",
    );
    if (!invalid) {
      const verdicts = judgeSessionHooks(hooks, context.cli);
      for (const event of SESSION_EVENTS) {
        const entries = eventEntries(hooks, event);
        if (entries === "invalid" || entries.length === 0) continue;
        const result = rewriteEntries(entries, (hook) => {
          const verdict = verdicts.get(hook);
          if (verdict === "stale" || verdict === "duplicate") return undefined;
          if (verdict !== "outdated" || !cli || !record(hook)) return hook;
          const parsed = parseSessionHook(hook);
          const args = [...(hook.args as string[])];
          args[0] = parsed?.kind === "pending" ? cli.pending : cli.wake;
          args[1] = cli.entry;
          return { ...hook, command: cli.node, args };
        });
        if (result.changed) {
          hooks[event] = result.entries;
          changed.add("claude.hook.stop");
        }
      }
    }
  }
  if (!changed.size) return { settings, changed };
  return { settings: { ...settings, hooks }, changed };
}
