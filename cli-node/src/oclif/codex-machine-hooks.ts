import { createHash } from "node:crypto";
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
  return `${shellQuote(cli.runtimeNode)} ${shellQuote(cli.entry)} agent session-register --runtime codex --hook`;
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

type ManagedPosition = {
  entry: number;
  hook: number;
  value: RecordValue;
  last: boolean;
  matcher: string | null;
};

/** Where each managed hook sits, as Codex numbers hooks for trust records. */
function managedPositions(settings: RecordValue): ManagedPosition[] {
  const found: ManagedPosition[] = [];
  sessionStartEntries(settings).forEach((entry, entryIndex) => {
    if (!record(entry) || !Array.isArray(entry.hooks)) return;
    const hooks = entry.hooks as unknown[];
    hooks.forEach((hook, hookIndex) => {
      if (isManaged(hook))
        found.push({
          entry: entryIndex,
          hook: hookIndex,
          value: hook,
          last: hookIndex === hooks.length - 1,
          matcher: typeof entry.matcher === "string" ? entry.matcher : null,
        });
    });
  });
  return found;
}

export type CodexHookFinding = {
  status: "ok" | "warn" | "fail";
  detail: string;
  fixable: boolean;
};

/** Codex's default spill threshold; a hook set to it hashes as if unset. */
const DEFAULT_ADDITIONAL_CONTEXT_LIMIT = 2_500;

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (record(value))
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys(value[key])]),
    );
  return value;
}

/**
 * The trust hash Codex computes for a hooks.json command hook: SHA-256 of the
 * key-sorted JSON of its normalized identity (event, matcher, and the
 * handler with its default timeout filled in and unset options omitted).
 * Checked against the trust records Codex wrote on a real machine.
 */
export function codexHookTrustHash(
  event: string,
  matcher: string | null,
  hook: RecordValue,
): string {
  const timeout =
    typeof hook.timeout === "number" && Number.isInteger(hook.timeout)
      ? Math.max(1, hook.timeout)
      : 600;
  const handler: RecordValue = {
    type: "command",
    command: hook.command,
    timeout,
    async: hook.async === true,
  };
  if (typeof hook.statusMessage === "string")
    handler.statusMessage = hook.statusMessage;
  if (
    typeof hook.additionalContextLimit === "number" &&
    hook.additionalContextLimit !== DEFAULT_ADDITIONAL_CONTEXT_LIMIT
  )
    handler.additionalContextLimit = hook.additionalContextLimit;
  const identity: RecordValue = { event_name: event, hooks: [handler] };
  if (matcher !== null) identity.matcher = matcher;
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(sortKeys(identity)))
    .digest("hex")}`;
}

type TrustState = "trusted" | "modified" | "untrusted" | "disabled";

/**
 * Codex runs a hooks.json hook only once the person approves it. It records
 * the approval under `[hooks.state."<file>:session_start:<entry>:<hook>"]` in
 * config.toml with the hash of the hook as approved; a different current hash
 * means the approval no longer applies.
 */
function trustState(
  configToml: string | null,
  key: string,
  currentHash: string,
): TrustState {
  if (configToml === null) return "untrusted";
  const lines = configToml.split(/\r?\n/);
  const header = `[hooks.state."${key}"]`;
  const start = lines.findIndex((line) => line.trim() === header);
  if (start < 0) return "untrusted";
  let trusted: string | null = null;
  let disabled = false;
  for (const line of lines.slice(start + 1)) {
    if (line.trim().startsWith("[")) break;
    const hash = /^\s*trusted_hash\s*=\s*"([^"]*)"/.exec(line);
    if (hash) trusted = hash[1] ?? null;
    if (/^\s*enabled\s*=\s*false\b/.test(line)) disabled = true;
  }
  if (disabled) return "disabled";
  if (trusted === null) return "untrusted";
  return trusted === currentHash ? "trusted" : "modified";
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
  const desired = context.cli ? codexHookCommand(context.cli) : null;
  const extras = managed.slice(1);
  // Only a copy that is last in its entry can go without moving any other
  // hook; the others stay in place (as this hook) so approvals keep matching.
  const removable = extras.filter((copy) => copy.last).length;
  const stale = managed.filter((copy) => copy.value.command !== desired).length;
  if (removable || stale)
    return {
      status: "fail",
      detail: [
        stale
          ? `${stale} SessionStart hooks run \`primitive agent session-register\` from another CLI path.`
          : "",
        removable
          ? `${removable} extra copies can be removed without moving other hooks.`
          : "",
      ]
        .filter(Boolean)
        .join(" ")
        .concat(blockedNote),
      fixable: canFix,
    };
  if (extras.length)
    return {
      status: "warn",
      detail: `${extras.length} extra copies of the hook sit before other hooks in their entries; they were left in place so those hooks keep their Codex approval. Remove them by hand if you like.`,
      fixable: false,
    };
  const trust = trustState(
    configToml,
    `${read.path}:session_start:${first.entry}:${first.hook}`,
    codexHookTrustHash("session_start", first.matcher, first.value),
  );
  if (trust === "disabled")
    return {
      status: "warn",
      detail: "The Codex SessionStart hook is installed but disabled in Codex.",
      fixable: false,
    };
  if (trust !== "trusted")
    return {
      status: "warn",
      detail:
        trust === "modified"
          ? "The Codex SessionStart hook changed since it was approved; approval needs to be confirmed in Codex."
          : "The Codex SessionStart hook is installed; approval needs to be confirmed in Codex before it runs.",
      fixable: false,
    };
  return {
    status: "ok",
    detail: `SessionStart runs \`primitive agent session-register --runtime codex --hook\` from ${context.cli?.entry ?? "this CLI"}, approved in Codex.`,
    fixable: false,
  };
}

/**
 * Codex keys approvals by entry and hook position, so this never removes or
 * reorders an entry, and never moves a hook that is not Primitive's. Managed
 * hooks are rewritten in place; an extra copy is removed only when it is the
 * last hook in its entry (its entry stays, even if empty); a hook is appended
 * as a new last entry when none exists.
 */
export function repairCodexHook(
  settings: RecordValue,
  cli: CliLocation,
): { settings: RecordValue; changed: boolean } {
  const desired = codexHookCommand(cli);
  let placed = false;
  let changed = false;
  const entries = sessionStartEntries(settings).map((entry) => {
    if (!record(entry) || !Array.isArray(entry.hooks)) return entry;
    const hooks = entry.hooks as unknown[];
    let touched = false;
    const next = hooks.flatMap((hook, index) => {
      if (!isManaged(hook)) return [hook];
      const isLast = index === hooks.length - 1;
      if (placed && isLast) {
        touched = true;
        return [];
      }
      placed = true;
      if (hook.command === desired) return [hook];
      touched = true;
      return [{ ...hook, command: desired }];
    });
    if (!touched) return entry;
    changed = true;
    return { ...entry, hooks: next };
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

/** Whether Codex hooks.json carries the SessionStart hook, from any CLI path. */
export function hasCodexSessionHook(settings: RecordValue): boolean {
  return managedPositions(settings).length > 0;
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
