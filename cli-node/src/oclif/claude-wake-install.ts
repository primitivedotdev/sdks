import { existsSync, mkdirSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import {
  hasSessionReceiveHook,
  otherSessionReceivers,
  stableNodePath,
} from "./claude-machine-hooks.js";
import {
  agentProfileDirectory,
  agentProfileName,
} from "./connected-agent-profile.js";
import { acquireListenLock } from "./listen-state.js";
import {
  MachineFileError,
  readManagedFile,
  writeManagedFile,
} from "./machine-files.js";
import { SESSION_UUID } from "./notify-session-native.js";
import {
  mailAddress,
  readMailJson,
  writeMailJson,
} from "./shared-mail-files.js";

const HOOK_MARKER = "primitive-agent-wake-v1";
const WAKE_EVENTS = ["Stop", "SessionStart"] as const;
const PENDING_MARKER = "primitive-pending-mail-v1";
const PENDING_EVENT = "PostToolUse";

type RecordValue = Record<string, unknown>;

const LOCK_WAIT = new Int32Array(new SharedArrayBuffer(4));

function record(value: unknown): value is RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * `held_for_other_profile`: nothing was written, because the session already
 * receives as another connected profile and this profile has no receive
 * hook there (only when `yieldToOtherProfiles` is set).
 */
export type ClaudeWakeHookResult =
  | "installed_unverified"
  | "held_for_other_profile"
  | "unavailable";

/**
 * How long a hook run or a hook mail check still counts as recent. It
 * matches the longest validity the server gives a presence proof
 * (`valid_for_ms` is at most 600000), so the CLI never calls a hook receiver
 * recent for longer than the server would call the session present.
 */
export const HOOK_RECENT_MS = 10 * 60_000;

/** Clock skew tolerated for a record written slightly in the future. */
const RECORD_CLOCK_SKEW_MS = 60_000;

function hookMailCheckPath(
  configDir: string,
  profileName: string,
  sessionId: string,
): string {
  return join(
    agentProfileDirectory(configDir, profileName),
    `pending-mail-${sessionId}.mail-check.json`,
  );
}

/**
 * Record that a listener run by this session's receive hook just completed a
 * mail check with the server. Fails open: receiving never depends on it.
 */
export function recordHookMailCheck(options: {
  configDir: string;
  profileName: string;
  sessionId: string;
  at?: number;
}): void {
  try {
    if (!SESSION_UUID.test(options.sessionId)) return;
    writeMailJson(
      hookMailCheckPath(
        resolve(options.configDir),
        agentProfileName(options.profileName),
        options.sessionId.toLowerCase(),
      ),
      {
        version: 1,
        at: new Date(options.at ?? Date.now()).toISOString(),
      },
    );
  } catch {
    /* Status falls back to unverified. */
  }
}

function recordedAt(value: unknown): string | null {
  return record(value) &&
    value.version === 1 &&
    typeof value.at === "string" &&
    Number.isFinite(Date.parse(value.at))
    ? value.at
    : null;
}

/**
 * `checked_recently`: a listener run by this session's receive hook
 * completed a mail check with the server within HOOK_RECENT_MS. It shows the
 * hook receiver works; it does not prove a wake from idle, which only
 * arriving mail shows.
 */
export type ClaudeWakeHookLiveness = "checked_recently" | "unknown";

export function claudeWakeHookStatus(options: {
  configDir: string;
  profileName: string;
  agentAddress: string;
  sessionId: string;
  env?: NodeJS.ProcessEnv;
  now?: number;
}): {
  installed: boolean;
  /** When the session's PostToolUse receive hook last started. */
  lastFiredAt: string | null;
  /** When a hook-run listener last completed a mail check. */
  lastMailCheckAt: string | null;
  firedRecently: boolean;
  liveness: ClaudeWakeHookLiveness;
} {
  const unavailable = {
    installed: false,
    lastFiredAt: null,
    lastMailCheckAt: null,
    firedRecently: false,
    liveness: "unknown" as const,
  };
  try {
    const configDir = resolve(options.configDir);
    const profileName = agentProfileName(options.profileName);
    const agentAddress = mailAddress(options.agentAddress);
    if (!SESSION_UUID.test(options.sessionId)) return unavailable;
    const sessionId = options.sessionId.toLowerCase();
    const env = options.env ?? process.env;
    const claudeDir = resolve(
      env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"),
    );
    // Claude's own settings file is user-owned: it is often readable by
    // others and larger than Primitive's private records, so it is read
    // the way machine doctor reads it.
    const read = readManagedFile(join(claudeDir, "settings.json"));
    if (read.state !== "present") return unavailable;
    const settings: unknown = JSON.parse(read.text);
    if (!record(settings) || !record(settings.hooks)) return unavailable;
    const hooks = settings.hooks;
    const target = {
      configDir,
      profile: profileName,
      address: agentAddress,
      session: sessionId,
    };
    // The same test machine doctor uses to decide a hook is missing.
    const node = stableNodePath(env);
    const installed = (["Stop", "SessionStart", "PostToolUse"] as const).every(
      (event) => hasSessionReceiveHook(hooks, event, target, node),
    );
    const lastFiredAt = recordedAt(
      readMailJson(
        join(
          agentProfileDirectory(configDir, profileName),
          `pending-mail-${sessionId}.fired.json`,
        ),
      ),
    );
    const lastMailCheckAt = recordedAt(
      readMailJson(hookMailCheckPath(configDir, profileName, sessionId)),
    );
    const now = options.now ?? Date.now();
    const recent = (at: string | null) => {
      if (at === null) return false;
      const age = now - Date.parse(at);
      return age >= -RECORD_CLOCK_SKEW_MS && age <= HOOK_RECENT_MS;
    };
    return {
      installed,
      lastFiredAt,
      lastMailCheckAt,
      firedRecently: installed && recent(lastFiredAt),
      // A hook that runs is not enough: its mail check may fail. Only a
      // completed check counts.
      liveness:
        installed && recent(lastMailCheckAt) ? "checked_recently" : "unknown",
    };
  } catch {
    return unavailable;
  }
}

/**
 * Apply one edit to Claude's settings under the shared lock, backing up the
 * previous file. Exported for tests.
 */
export function editClaudeSettings(
  claudeDir: string,
  edit: (settings: RecordValue) => RecordValue | null,
): boolean {
  mkdirSync(claudeDir, { recursive: true, mode: 0o700 });
  let release: (() => void) | undefined;
  // All Primitive installers and removers serialize writes to this shared
  // Claude settings file. A short wait lets two sessions enroll together.
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      release = acquireListenLock(claudeDir, "primitive-claude-settings");
      break;
    } catch {
      Atomics.wait(LOCK_WAIT, 0, 0, 25);
    }
  }
  if (!release) return false;
  try {
    const settingsPath = join(claudeDir, "settings.json");
    for (let attempt = 0; attempt < 3; attempt++) {
      const read = readManagedFile(settingsPath);
      if (read.state === "invalid") return false;
      let settings: RecordValue = {};
      if (read.state === "present") {
        const parsed: unknown = JSON.parse(read.text);
        if (!record(parsed)) return false;
        settings = parsed;
      }
      const next = edit(settings);
      if (next === null) return true;
      const content = `${JSON.stringify(next, null, 2)}\n`;
      // Rewriting identical settings would only churn backups.
      if (read.state === "present" && content === read.text) return true;
      try {
        // The same writer machine doctor uses: it backs up the previous
        // settings, and refuses to replace them if another tool, which does
        // not share our lock, changed the file since it was read. The edit
        // is then applied again to the newer content.
        writeManagedFile({ read, content, newFileMode: 0o600 });
        return true;
      } catch (error) {
        if (!(error instanceof MachineFileError)) throw error;
      }
    }
    return false;
  } finally {
    release();
  }
}

/** Add exact-session fail-open receiving hooks while preserving unrelated settings. */
export function installClaudeWakeHook(options: {
  cliPath: string;
  configDir: string;
  profileName: string;
  agentAddress: string;
  sessionId: string;
  env?: NodeJS.ProcessEnv;
  /**
   * Set by automatic installs (session-register on every start and resume),
   * which nobody asked for by profile. When the session already receives as
   * another connected profile and this profile has no receive hook there,
   * nothing is written: its hooks were removed on purpose, or adding them
   * would give the session a second address. Commands that name the profile
   * (agent connect, agent enroll) leave it unset and always install.
   */
  yieldToOtherProfiles?: boolean;
}): ClaudeWakeHookResult {
  try {
    const cliPath = realpathSync(options.cliPath);
    const wrapperPath = realpathSync(join(dirname(cliPath), "claude-wake.mjs"));
    const pendingPath = realpathSync(
      join(dirname(cliPath), "claude-pending-mail.mjs"),
    );
    const configDir = resolve(options.configDir);
    const profileName = agentProfileName(options.profileName);
    const agentAddress = mailAddress(options.agentAddress);
    if (!SESSION_UUID.test(options.sessionId)) return "unavailable";
    const sessionId = options.sessionId.toLowerCase();
    const env = options.env ?? process.env;
    const claudeDir = resolve(
      env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"),
    );
    // A PATH link such as a package manager's bin/node survives an upgrade
    // that replaces the versioned directory process.execPath points into.
    const node = stableNodePath(env);
    let held = false;
    const installed = editClaudeSettings(claudeDir, (settings) => {
      const hooks = settings.hooks ?? {};
      if (!record(hooks)) throw new Error("Invalid hook settings");
      for (const event of WAKE_EVENTS)
        if (!Array.isArray(hooks[event] ?? []))
          throw new Error(`Invalid ${event} hooks`);
      if (!Array.isArray(hooks[PENDING_EVENT] ?? []))
        throw new Error(`Invalid ${PENDING_EVENT} hooks`);
      // Judged under the settings lock on the file as read, so a concurrent
      // install for the other profile cannot slip between check and write.
      // A held profile still loses any older hook of its own for this
      // session (such as a legacy hook without a session argument, which
      // the check cannot attribute), so the session ends up receiving only
      // as the other profile.
      held =
        options.yieldToOtherProfiles === true &&
        otherSessionReceivers(hooks, {
          configDir,
          profile: profileName,
          session: sessionId,
        }).length > 0;
      const hook = {
        type: "command",
        command: node,
        args: [
          wrapperPath,
          cliPath,
          configDir,
          profileName,
          agentAddress,
          sessionId,
          HOOK_MARKER,
        ],
        asyncRewake: true,
        timeout: 604800,
      };
      const pendingHook = {
        type: "command",
        command: node,
        args: [
          pendingPath,
          cliPath,
          configDir,
          profileName,
          agentAddress,
          sessionId,
          PENDING_MARKER,
        ],
        timeout: 10,
      };
      // A hook for this exact profile and session is replaced even when an
      // older CLI install (another path or Node binary) wrote it, so upgrades
      // never leave a second receive hook behind. One session can carry
      // several profiles, so hooks of any other profile are always kept.
      const isOwnPendingHook = (candidate: unknown) =>
        record(candidate) &&
        candidate.type === "command" &&
        Array.isArray(candidate.args) &&
        candidate.args.length === 7 &&
        typeof candidate.args[0] === "string" &&
        basename(candidate.args[0]) === "claude-pending-mail.mjs" &&
        candidate.args[2] === configDir &&
        candidate.args[3] === profileName &&
        candidate.args[5] === sessionId &&
        candidate.args[6] === PENDING_MARKER;
      const isOwnHook = (candidate: unknown) => {
        if (!record(candidate) || !Array.isArray(candidate.args)) return false;
        if (
          typeof candidate.args[0] !== "string" ||
          basename(candidate.args[0]) !== "claude-wake.mjs" ||
          candidate.args[2] !== configDir ||
          candidate.args[3] !== profileName
        )
          return false;
        if (
          candidate.args.length === 7 &&
          candidate.args[5] === sessionId &&
          candidate.args[6] === HOOK_MARKER
        )
          return true;
        // An old profile-bearing hook is removable only when its saved setup
        // proves it belongs to this same session. Generic legacy hooks have
        // no recoverable target and may still serve other sessions.
        if (candidate.args.length !== 6 || candidate.args[5] !== HOOK_MARKER)
          return false;
        try {
          const state = readMailJson(
            join(agentProfileDirectory(configDir, profileName), "setup.json"),
          );
          return record(state) && state.session === sessionId;
        } catch {
          return false;
        }
      };
      const nextHooks: RecordValue = { ...hooks };
      for (const event of WAKE_EVENTS) {
        const entries = hooks[event] as unknown[] | undefined;
        const retained = (entries ?? []).flatMap((entry) => {
          if (!record(entry) || !Array.isArray(entry.hooks)) return [entry];
          const siblings = entry.hooks.filter(
            (candidate) => !isOwnHook(candidate),
          );
          if (siblings.length === entry.hooks.length) return [entry];
          return siblings.length ? [{ ...entry, hooks: siblings }] : [];
        });
        if (held) {
          if (entries) nextHooks[event] = retained;
        } else
          nextHooks[event] = [
            ...retained,
            event === "SessionStart"
              ? { matcher: "resume", hooks: [hook] }
              : { hooks: [hook] },
          ];
      }
      const pendingEntries = hooks[PENDING_EVENT] as unknown[] | undefined;
      const pendingRetained = (pendingEntries ?? []).flatMap((entry) => {
        if (!record(entry) || !Array.isArray(entry.hooks)) return [entry];
        const siblings = entry.hooks.filter(
          (candidate) => !isOwnPendingHook(candidate),
        );
        if (siblings.length === entry.hooks.length) return [entry];
        return siblings.length ? [{ ...entry, hooks: siblings }] : [];
      });
      if (held) {
        if (pendingEntries) nextHooks[PENDING_EVENT] = pendingRetained;
      } else
        nextHooks[PENDING_EVENT] = [
          ...pendingRetained,
          { hooks: [pendingHook] },
        ];
      // A hold that removed nothing leaves the file untouched.
      if (held && JSON.stringify(nextHooks) === JSON.stringify(hooks))
        return null;
      return {
        ...settings,
        hooks: nextHooks,
      };
    });
    if (!installed) return "unavailable";
    return held ? "held_for_other_profile" : "installed_unverified";
  } catch {
    return "unavailable";
  }
}

/** Remove only this profile's exact-session hooks after disconnection. */
export function uninstallClaudeWakeHook(options: {
  configDir: string;
  profileName: string;
  agentAddress: string;
  sessionId: string;
  env?: NodeJS.ProcessEnv;
}): boolean {
  try {
    const configDir = resolve(options.configDir);
    const profileName = agentProfileName(options.profileName);
    const agentAddress = mailAddress(options.agentAddress);
    if (!SESSION_UUID.test(options.sessionId)) return false;
    const sessionId = options.sessionId.toLowerCase();
    const env = options.env ?? process.env;
    const claudeDir = resolve(
      env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"),
    );
    if (!existsSync(join(claudeDir, "settings.json"))) return true;
    return editClaudeSettings(claudeDir, (settings) => {
      const hooks = settings.hooks ?? {};
      if (!record(hooks)) throw new Error("Invalid hook settings");
      for (const event of WAKE_EVENTS)
        if (!Array.isArray(hooks[event] ?? []))
          throw new Error(`Invalid ${event} hooks`);
      if (!Array.isArray(hooks[PENDING_EVENT] ?? []))
        throw new Error(`Invalid ${PENDING_EVENT} hooks`);
      const legacySessionMatches = () => {
        try {
          const setup = readMailJson(
            join(agentProfileDirectory(configDir, profileName), "setup.json"),
          );
          return record(setup) && setup.session === sessionId;
        } catch {
          return false;
        }
      };
      const isOwnHook = (candidate: unknown) => {
        if (!record(candidate) || !Array.isArray(candidate.args)) return false;
        const args = candidate.args;
        return (
          candidate.type === "command" &&
          typeof candidate.command === "string" &&
          candidate.asyncRewake === true &&
          typeof args[0] === "string" &&
          basename(args[0]) === "claude-wake.mjs" &&
          typeof args[1] === "string" &&
          args[2] === configDir &&
          args[3] === profileName &&
          args[4] === agentAddress &&
          ((args.length === 7 &&
            args[5] === sessionId &&
            args[6] === HOOK_MARKER) ||
            (args.length === 6 &&
              args[5] === HOOK_MARKER &&
              legacySessionMatches()))
        );
      };
      const isOwnPendingHook = (candidate: unknown) => {
        if (!record(candidate) || !Array.isArray(candidate.args)) return false;
        const args = candidate.args;
        return (
          candidate.type === "command" &&
          typeof candidate.command === "string" &&
          typeof args[0] === "string" &&
          basename(args[0]) === "claude-pending-mail.mjs" &&
          args[2] === configDir &&
          args[3] === profileName &&
          args[4] === agentAddress &&
          args[5] === sessionId &&
          args[6] === PENDING_MARKER &&
          args.length === 7
        );
      };
      let removed = false;
      const nextHooks: RecordValue = { ...hooks };
      for (const event of WAKE_EVENTS) {
        const entries = hooks[event] as unknown[] | undefined;
        nextHooks[event] = (entries ?? []).flatMap((entry) => {
          if (!record(entry) || !Array.isArray(entry.hooks)) return [entry];
          const siblings = entry.hooks.filter(
            (candidate) => !isOwnHook(candidate),
          );
          if (siblings.length === entry.hooks.length) return [entry];
          removed = true;
          return siblings.length ? [{ ...entry, hooks: siblings }] : [];
        });
      }
      const pendingEntries = hooks[PENDING_EVENT] as unknown[] | undefined;
      nextHooks[PENDING_EVENT] = (pendingEntries ?? []).flatMap((entry) => {
        if (!record(entry) || !Array.isArray(entry.hooks)) return [entry];
        const siblings = entry.hooks.filter(
          (candidate) => !isOwnPendingHook(candidate),
        );
        if (siblings.length === entry.hooks.length) return [entry];
        removed = true;
        return siblings.length ? [{ ...entry, hooks: siblings }] : [];
      });
      return removed ? { ...settings, hooks: nextHooks } : null;
    });
  } catch {
    return false;
  }
}
