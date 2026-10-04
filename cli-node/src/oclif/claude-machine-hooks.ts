import {
  accessSync,
  constants,
  existsSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { basename, delimiter, dirname, join, resolve } from "node:path";
import {
  agentProfileDirectory,
  agentProfileName,
  agentProfilesDirectory,
  loadConnectedAgentProfile,
} from "./connected-agent-profile.js";
import { acquireListenLock } from "./listen-state.js";
import {
  jsonIndentation,
  MachineFileError,
  type ManagedFileRead,
  readManagedFile,
  writeManagedFile,
} from "./machine-files.js";
import { SESSION_UUID } from "./notify-session-native.js";
import { readMailJson } from "./shared-mail-files.js";

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

/**
 * A hook's Node command is current when it is the chosen Node path itself,
 * or another link to the same binary. A command that pins the versioned file
 * behind the stable link stops working once an upgrade replaces that file,
 * so it is not current and gets rewritten to the stable path.
 */
export function nodeCommandCurrent(command: unknown, node: string): boolean {
  if (!samePath(command, node)) return false;
  if (command === node) return true;
  return realpathOrNull(String(command)) !== command;
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
  /** For claude.hook.stop: each per-session receive hook a repair would change. */
  items?: SessionHookItem[];
};

/** Why a per-session receive hook needs a repair. */
export type SessionHookState =
  | "missing"
  | "stale"
  | "duplicate"
  | "outdated"
  | "old_address";

/** One per-session receive hook that --fix would add, remove or rewrite. */
export type SessionHookItem = {
  /** Null for hooks written by old CLI versions that did not record one. */
  profile: string | null;
  session: string | null;
  hook: SessionEvent;
  state: SessionHookState;
  /** With --fix --profile: false when this run leaves the hook alone. */
  selected?: boolean;
};

/** One per-session receive hook a repair actually changed. */
export type SessionHookChange = SessionHookItem & {
  action: "added" | "removed" | "updated";
};

const STATE_PHRASES: Record<SessionHookState, string> = {
  missing: "missing",
  stale: "session disconnected or removed",
  duplicate: "duplicate",
  outdated: "old CLI path",
  old_address: "old agent address",
};

/** "profile my-agent, session 1234...": who a session hook serves. */
export function describeSessionHookOwner(item: {
  profile: string | null;
  session: string | null;
}): string {
  const profile = item.profile
    ? `profile ${item.profile}`
    : "a profile an old CLI did not record";
  return item.session ? `${profile}, session ${item.session}` : profile;
}

/** One short line naming a hook, its owner and its state. */
export function describeSessionHookItem(item: SessionHookItem): string {
  return `${item.hook} hook for ${describeSessionHookOwner(item)}: ${STATE_PHRASES[item.state]}`;
}

/** One short line naming what a repair did to a hook. */
export function describeSessionHookChange(change: SessionHookChange): string {
  const verb =
    change.action === "added"
      ? "Added"
      : change.action === "removed"
        ? "Removed"
        : "Rewrote";
  return `${verb} ${change.hook} hook for ${describeSessionHookOwner(change)} (${STATE_PHRASES[change.state]})`;
}

/** Group items by owner, at most `limit` owners, for a one-line detail. */
function summarizeOwners(items: readonly SessionHookItem[], limit = 3): string {
  const owners: string[] = [];
  for (const item of items) {
    const owner = describeSessionHookOwner(item);
    if (!owners.includes(owner)) owners.push(owner);
  }
  const shown = owners.slice(0, limit).join("; ");
  return owners.length > limit
    ? `${shown}; and ${owners.length - limit} more`
    : shown;
}

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
  return (
    nodeCommandCurrent(hook.command, cli.node) && samePath(args[0], cli.entry)
  );
}

const WAKE_MARKER = "primitive-agent-wake-v1";
const PENDING_MARKER = "primitive-pending-mail-v1";
const SESSION_EVENTS = ["Stop", "SessionStart", "PostToolUse"] as const;
export type SessionEvent = (typeof SESSION_EVENTS)[number];

/** Which receive hook each event carries. */
const SESSION_HOOK_KIND = {
  Stop: "wake",
  SessionStart: "wake",
  PostToolUse: "pending",
} as const;

/** The profile and session one set of receive hooks serves. */
export type SessionHookTarget = {
  configDir: string;
  profile: string;
  address: string;
  session: string;
};

/**
 * The one test of whether an event already carries a current receive hook
 * for this exact profile, address and session, run by the Node binary at
 * `node` (compared as files). `agent connect --status` and machine doctor
 * both use it, so they never disagree about a hook being present.
 */
export function hasSessionReceiveHook(
  hooks: RecordValue,
  event: SessionEvent,
  target: SessionHookTarget,
  node: string,
): boolean {
  const entries = hooks[event];
  if (!Array.isArray(entries)) return false;
  const pending = SESSION_HOOK_KIND[event] === "pending";
  const configDir = resolve(target.configDir);
  const session = target.session.toLowerCase();
  return entries.some(
    (entry) =>
      record(entry) &&
      Array.isArray(entry.hooks) &&
      entry.hooks.some((hook: unknown) => {
        if (!record(hook) || hook.type !== "command") return false;
        const args = hook.args;
        return (
          Array.isArray(args) &&
          args.length === 7 &&
          args.every((value) => typeof value === "string") &&
          basename(args[0]) ===
            (pending ? "claude-pending-mail.mjs" : "claude-wake.mjs") &&
          resolve(args[2]) === configDir &&
          args[3] === target.profile &&
          args[4] === target.address &&
          args[5].toLowerCase() === session &&
          args[6] === (pending ? PENDING_MARKER : WAKE_MARKER) &&
          samePath(hook.command, node)
        );
      }),
  );
}

type SessionHook = {
  kind: "wake" | "pending";
  configDir: string;
  profile: string | null;
  address: string | null;
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
          address: strings[4] ?? null,
          session: strings[5] ?? null,
        }
      : null;
  if (script !== "claude-wake.mjs") return null;
  if (strings.length === 7 && strings[6] === WAKE_MARKER)
    return {
      kind: "wake",
      configDir: strings[2] ?? "",
      profile: strings[3] ?? null,
      address: strings[4] ?? null,
      session: strings[5] ?? null,
    };
  if (strings.length === 6 && strings[5] === WAKE_MARKER)
    return {
      kind: "wake",
      configDir: strings[2] ?? "",
      profile: strings[3] ?? null,
      address: strings[4] ?? null,
      session: null,
    };
  if (strings.length === 4 && strings[3] === WAKE_MARKER)
    return {
      kind: "wake",
      configDir: strings[2] ?? "",
      profile: null,
      address: null,
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

type SessionHookVerdict =
  | "keep"
  | "stale"
  | "duplicate"
  | "outdated"
  | "old_address";

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
    nodeCommandCurrent(hook.command, cli.node) &&
    samePath(args[0], parsed.kind === "wake" ? cli.wake : cli.pending) &&
    samePath(args[1], cli.entry)
  );
}

function judgeSessionHooks(
  hooks: RecordValue,
  cli: CliLocation | null,
  bound: readonly BoundSessionProfile[] = [],
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
        // A hook for a connected session that names another address is
        // replaced by one with the profile's current address.
        const current = bound.find(
          (item) =>
            item.configDir === resolve(parsed.configDir) &&
            item.profile === parsed.profile &&
            item.session === parsed.session?.toLowerCase(),
        );
        if (current && parsed.address !== current.address) {
          verdicts.set(hook, "old_address");
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
  /** Connected profiles that receive through hooks in a live Claude session. */
  bound?: BoundSessionProfile[];
  /**
   * Profiles named explicitly (machine doctor --profile). Only these are
   * restored when their session already receives through another profile.
   */
  restoreProfiles?: ReadonlySet<string>;
};

/** A connected profile whose saved setup receives through Claude hooks. */
export type BoundSessionProfile = SessionHookTarget;

/**
 * Connected profiles whose setup binds an external (hook) receiver to a
 * Claude session that this machine has not recorded as ended.
 */
export function boundSessionProfiles(configDir: string): BoundSessionProfile[] {
  const root = resolve(configDir);
  let names: string[];
  try {
    names = readdirSync(join(agentProfilesDirectory(root), "profiles")).sort();
  } catch {
    return [];
  }
  const bound: BoundSessionProfile[] = [];
  for (const name of names) {
    try {
      agentProfileName(name);
      const setup = readMailJson(
        join(agentProfileDirectory(root, name), "setup.json"),
      ) as { session?: unknown; receiverMode?: unknown } | null;
      if (
        setup?.receiverMode !== "external" ||
        typeof setup.session !== "string" ||
        !SESSION_UUID.test(setup.session)
      )
        continue;
      const session = setup.session.toLowerCase();
      const ended = readMailJson(
        join(root, "machine", "sessions", `${session}.json`),
      ) as { endedAt?: unknown } | null;
      if (typeof ended?.endedAt === "string") continue;
      const profile = loadConnectedAgentProfile(root, name);
      if (profile)
        bound.push({
          configDir: root,
          profile: name,
          address: profile.agent_address,
          session,
        });
    } catch {
      /* An unreadable profile is reported by the profile checks. */
    }
  }
  return bound;
}

function boundKey(item: BoundSessionProfile): string {
  return [resolve(item.configDir), item.profile, item.session].join("\0");
}

/**
 * Bound profiles whose receive hooks are entirely absent while the same
 * session receives through another connected profile, or while several profiles are
 * bound to it and none receives. Such a profile is not restored without
 * being named: its hooks were removed on purpose, or it would give the
 * session a second address. A profile that still has any receive hook for
 * the session, or the only profile bound to a session, is restored as usual.
 */
/**
 * For each session, the connected profiles it receives as through the
 * per-session receive hooks in `hooks`, keyed like `boundKey`. A hook for a
 * disconnected or removed profile is stale (machine doctor removes it), so
 * the session does not receive through it.
 */
function receivingProfilesBySession(
  hooks: RecordValue,
  /** A key counted even when its profile is not saved as connected. */
  always?: string,
): Map<string, Set<string>> {
  const receiving = new Map<string, Set<string>>();
  for (const event of SESSION_EVENTS) {
    const entries = hooks[event];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!record(entry) || !Array.isArray(entry.hooks)) continue;
      for (const hook of entry.hooks) {
        const parsed = parseSessionHook(hook);
        if (!parsed?.profile || !parsed.session) continue;
        const session = parsed.session.toLowerCase();
        const key = [resolve(parsed.configDir), parsed.profile, session].join(
          "\0",
        );
        if (
          key !== always &&
          (!existsSync(parsed.configDir) ||
            !profileStillConnected(parsed.configDir, parsed.profile))
        )
          continue;
        const profiles = receiving.get(session) ?? new Set<string>();
        profiles.add(key);
        receiving.set(session, profiles);
      }
    }
  }
  return receiving;
}

/**
 * The other connected profiles a session already receives as, when `target`
 * itself has no receive hook for it. Adding `target`'s hooks then would give
 * the session a second address; an empty list means it would not (the
 * session receives as nobody else, or `target` already has hooks there and
 * only needs them repaired). Uses the same rule as machine doctor, so an
 * automatic install never binds a profile doctor would leave alone.
 */
export function otherSessionReceivers(
  hooks: RecordValue,
  target: { configDir: string; profile: string; session: string },
): string[] {
  const session = target.session.toLowerCase();
  const own = [resolve(target.configDir), target.profile, session].join("\0");
  const present =
    receivingProfilesBySession(hooks, own).get(session) ?? new Set<string>();
  if (present.has(own)) return [];
  return [...present].map((other) => other.split("\0")[1] ?? "").sort();
}

function heldSessionProfiles(
  hooks: RecordValue,
  bound: readonly BoundSessionProfile[],
  restore: ReadonlySet<string> | undefined,
): Map<string, { item: BoundSessionProfile; receivingAs: string[] }> {
  const receiving = receivingProfilesBySession(hooks);
  const held = new Map<
    string,
    { item: BoundSessionProfile; receivingAs: string[] }
  >();
  for (const item of bound) {
    const key = boundKey(item);
    const present = receiving.get(item.session) ?? new Set<string>();
    if (present.has(key) || restore?.has(item.profile)) continue;
    const others = [...present].map((other) => other.split("\0")[1] ?? "");
    const siblings = bound.filter(
      (candidate) => candidate.session === item.session,
    );
    if (others.length > 0 || siblings.length > 1)
      held.set(key, { item, receivingAs: others.sort() });
  }
  return held;
}

/** Receive hooks each bound profile should have and does not. */
function missingSessionHooks(
  hooks: RecordValue,
  bound: readonly BoundSessionProfile[],
  node: string,
): Array<{ event: SessionEvent; bound: BoundSessionProfile }> {
  return bound.flatMap((item) =>
    SESSION_EVENTS.filter(
      (event) => !hasSessionReceiveHook(hooks, event, item, node),
    ).map((event) => ({ event, bound: item })),
  );
}

/** Every hook judged for repair, in settings order, then every missing one. */
function sessionHookItems(
  hooks: RecordValue,
  verdicts: Map<unknown, SessionHookVerdict>,
  missing: ReadonlyArray<{ event: SessionEvent; bound: BoundSessionProfile }>,
): SessionHookItem[] {
  const items: SessionHookItem[] = missing.map(({ event, bound }) => ({
    profile: bound.profile,
    session: bound.session,
    hook: event,
    state: "missing",
  }));
  for (const event of SESSION_EVENTS) {
    const entries = hooks[event];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!record(entry) || !Array.isArray(entry.hooks)) continue;
      for (const hook of entry.hooks) {
        const verdict = verdicts.get(hook);
        const parsed = parseSessionHook(hook);
        if (!verdict || verdict === "keep" || !parsed) continue;
        items.push({
          profile: parsed.profile,
          session: parsed.session?.toLowerCase() ?? null,
          hook: event,
          state: verdict,
        });
      }
    }
  }
  return items;
}

/** The exact entry `agent connect` and `session-register` install. */
function sessionHookEntry(
  event: SessionEvent,
  item: BoundSessionProfile,
  cli: CliLocation,
): RecordValue {
  const pending = SESSION_HOOK_KIND[event] === "pending";
  const hook = {
    type: "command",
    command: cli.node,
    args: [
      pending ? cli.pending : cli.wake,
      cli.entry,
      item.configDir,
      item.profile,
      item.address,
      item.session,
      pending ? PENDING_MARKER : WAKE_MARKER,
    ],
    ...(pending ? { timeout: 10 } : { asyncRewake: true, timeout: 604800 }),
  };
  return event === "SessionStart"
    ? { matcher: "resume", hooks: [hook] }
    : { hooks: [hook] };
}

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
  const held = heldSessionProfiles(
    hooks,
    context.bound ?? [],
    context.restoreProfiles,
  );
  const bound = (context.bound ?? []).filter(
    (item) => !held.has(boundKey(item)),
  );
  const heldNote = held.size
    ? ` Left alone: ${[...held.values()]
        .map(
          ({ item, receivingAs }) =>
            `profile ${item.profile} is bound to session ${item.session}, which ${
              receivingAs.length
                ? `receives as ${receivingAs.join(", ")}`
                : "has several bound profiles and receives as none"
            }`,
        )
        .join(
          "; ",
        )}. Run \`primitive machine doctor --fix --profile <profile>\` to restore one deliberately.`
    : "";
  const counts = {
    keep: 0,
    stale: 0,
    duplicate: 0,
    outdated: 0,
    old_address: 0,
  };
  const verdicts = judgeSessionHooks(hooks, context.cli, bound);
  for (const verdict of verdicts.values()) counts[verdict]++;
  const missingHooks = missingSessionHooks(
    hooks,
    bound,
    context.cli?.node ?? process.execPath,
  );
  const missing = missingHooks.length;
  const items = sessionHookItems(hooks, verdicts, missingHooks);
  const problems = [
    missing ? `${missing} missing for connected sessions` : "",
    counts.old_address
      ? `${counts.old_address} naming an old agent address`
      : "",
    counts.stale ? `${counts.stale} for disconnected or removed sessions` : "",
    counts.duplicate ? `${counts.duplicate} duplicates` : "",
    counts.outdated ? `${counts.outdated} pointing at an old CLI path` : "",
  ].filter(Boolean);
  findings["claude.hook.stop"] = problems.length
    ? {
        status: "fail",
        detail: `Per-session receive hooks need cleanup: ${problems.join(", ")}. Affected: ${summarizeOwners(items)}.${blockedNote}${heldNote}`,
        // Removing hooks for dead sessions never needs a CLI path.
        fixable:
          canFix ||
          (counts.outdated === 0 && missing === 0 && context.blocked === null),
        items,
      }
    : {
        status: "ok",
        detail: `${
          counts.keep
            ? `${counts.keep} per-session receive hooks, each present once and current.`
            : "No per-session receive hooks; each registered session adds its own exact-session hooks."
        }${heldNote}`,
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
  options: {
    /** Only change per-session receive hooks for these profiles. */
    profiles?: ReadonlySet<string>;
  } = {},
): {
  settings: RecordValue;
  changed: Set<HookCheckId>;
  /** Each per-session receive hook added, removed or rewritten. */
  changes: SessionHookChange[];
} {
  const changed = new Set<HookCheckId>();
  const changes: SessionHookChange[] = [];
  const selected = (profile: string | null) =>
    !options.profiles || (profile !== null && options.profiles.has(profile));
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
      // Judged on the settings as found, before any hook below is removed
      // or rewritten, so a hook being replaced still counts as present.
      const held = heldSessionProfiles(
        hooks,
        context.bound ?? [],
        context.restoreProfiles,
      );
      const bound = (context.bound ?? []).filter(
        (item) => !held.has(boundKey(item)),
      );
      const verdicts = judgeSessionHooks(hooks, context.cli, bound);
      for (const event of SESSION_EVENTS) {
        const entries = eventEntries(hooks, event);
        if (entries === "invalid" || entries.length === 0) continue;
        const result = rewriteEntries(entries, (hook) => {
          const verdict = verdicts.get(hook);
          const parsed = parseSessionHook(hook);
          if (!verdict || verdict === "keep" || !parsed) return hook;
          if (!selected(parsed.profile)) return hook;
          const item = {
            profile: parsed.profile,
            session: parsed.session?.toLowerCase() ?? null,
            hook: event,
            state: verdict,
          };
          if (
            verdict === "stale" ||
            verdict === "duplicate" ||
            verdict === "old_address"
          ) {
            changes.push({ ...item, action: "removed" });
            return undefined;
          }
          if (!cli || !record(hook)) return hook;
          const args = [...(hook.args as string[])];
          args[0] = parsed.kind === "pending" ? cli.pending : cli.wake;
          args[1] = cli.entry;
          changes.push({ ...item, action: "updated" });
          return { ...hook, command: cli.node, args };
        });
        if (result.changed) {
          hooks[event] = result.entries;
          changed.add("claude.hook.stop");
        }
      }
      // A connected session whose hook was removed gets it back, exactly as
      // `agent connect` wrote it; mail would otherwise never wake it.
      if (cli)
        for (const missing of missingSessionHooks(hooks, bound, cli.node)) {
          if (!selected(missing.bound.profile)) continue;
          const entries = eventEntries(hooks, missing.event);
          if (entries === "invalid") continue;
          changes.push({
            profile: missing.bound.profile,
            session: missing.bound.session,
            hook: missing.event,
            state: "missing",
            action: "added",
          });
          hooks[missing.event] = [
            ...entries,
            sessionHookEntry(missing.event, missing.bound, cli),
          ];
          changed.add("claude.hook.stop");
        }
    }
  }
  if (!changed.size) return { settings, changed, changes };
  return { settings: { ...settings, hooks }, changed, changes };
}
