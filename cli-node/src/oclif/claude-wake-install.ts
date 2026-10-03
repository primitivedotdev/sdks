import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { samePath } from "./claude-machine-hooks.js";
import {
  agentProfileDirectory,
  agentProfileName,
} from "./connected-agent-profile.js";
import { acquireListenLock } from "./listen-state.js";
import { backupManagedFile, pruneManagedBackups } from "./machine-files.js";
import { SESSION_UUID } from "./notify-session-native.js";
import { mailAddress, readMailJson } from "./shared-mail-files.js";

const HOOK_MARKER = "primitive-agent-wake-v1";
const WAKE_EVENTS = ["Stop", "SessionStart"] as const;
const PENDING_MARKER = "primitive-pending-mail-v1";
const PENDING_EVENT = "PostToolUse";

type RecordValue = Record<string, unknown>;

const LOCK_WAIT = new Int32Array(new SharedArrayBuffer(4));

function record(value: unknown): value is RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export type ClaudeWakeHookResult = "installed_unverified" | "unavailable";

export function claudeWakeHookStatus(options: {
  configDir: string;
  profileName: string;
  agentAddress: string;
  sessionId: string;
  env?: NodeJS.ProcessEnv;
}): { installed: boolean; lastFiredAt: string | null; liveness: "unknown" } {
  const unavailable = {
    installed: false,
    lastFiredAt: null,
    liveness: "unknown" as const,
  };
  try {
    const configDir = resolve(options.configDir);
    const profileName = agentProfileName(options.profileName);
    const agentAddress = mailAddress(options.agentAddress);
    if (!SESSION_UUID.test(options.sessionId)) return unavailable;
    const sessionId = options.sessionId.toLowerCase();
    const claudeDir = resolve(
      options.env?.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"),
    );
    const settings = readMailJson(join(claudeDir, "settings.json"));
    if (!record(settings) || !record(settings.hooks)) return unavailable;
    const hooks = settings.hooks;
    const owns = (event: string, script: string, marker: string) => {
      const entries = hooks[event];
      return (
        Array.isArray(entries) &&
        entries.some(
          (entry) =>
            record(entry) &&
            Array.isArray(entry.hooks) &&
            entry.hooks.some((candidate: unknown) => {
              if (!record(candidate) || !Array.isArray(candidate.args))
                return false;
              const args = candidate.args;
              const offset = 2;
              return (
                candidate.type === "command" &&
                // Doctor writes a stable PATH link to the same Node binary,
                // so compare files rather than spellings.
                samePath(candidate.command, process.execPath) &&
                args.length === 7 &&
                typeof args[0] === "string" &&
                basename(args[0]) === script &&
                args[offset] === configDir &&
                args[offset + 1] === profileName &&
                args[offset + 2] === agentAddress &&
                args[offset + 3] === sessionId &&
                args[offset + 4] === marker
              );
            }),
        )
      );
    };
    const installed =
      owns("Stop", "claude-wake.mjs", HOOK_MARKER) &&
      owns("SessionStart", "claude-wake.mjs", HOOK_MARKER) &&
      owns(PENDING_EVENT, "claude-pending-mail.mjs", PENDING_MARKER);
    let lastFiredAt: string | null = null;
    const fired = readMailJson(
      join(
        agentProfileDirectory(configDir, profileName),
        `pending-mail-${sessionId}.fired.json`,
      ),
    );
    if (
      record(fired) &&
      fired.version === 1 &&
      typeof fired.at === "string" &&
      Number.isFinite(Date.parse(fired.at))
    )
      lastFiredAt = fired.at;
    return { installed, lastFiredAt, liveness: "unknown" };
  } catch {
    return unavailable;
  }
}

function editClaudeSettings(
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
      let original: string | null = null;
      let settings: RecordValue = {};
      if (existsSync(settingsPath)) {
        const stat = lstatSync(settingsPath);
        if (!stat.isFile() || stat.size > 1_048_576) return false;
        original = readFileSync(settingsPath, "utf8");
        const parsed: unknown = JSON.parse(original);
        if (!record(parsed)) return false;
        settings = parsed;
      }
      const next = edit(settings);
      if (next === null) return true;
      const rendered = `${JSON.stringify(next, null, 2)}\n`;
      // Rewriting identical settings would only churn backups.
      if (original !== null && rendered === original) return true;
      const temporary = join(claudeDir, `.settings.json.${randomUUID()}.tmp`);
      const fd = openSync(temporary, "wx", 0o600);
      try {
        writeFileSync(fd, rendered, "utf8");
      } finally {
        closeSync(fd);
      }
      try {
        // Other tools do not share our lock. Retry if one wrote settings
        // while we prepared this replacement.
        const current = existsSync(settingsPath)
          ? readFileSync(settingsPath, "utf8")
          : null;
        if (current !== original) continue;
        // Keep the previous settings beside the file, as machine doctor
        // does, so every hook change can be traced and undone.
        const backup =
          original === null
            ? null
            : backupManagedFile(
                settingsPath,
                lstatSync(settingsPath).mode & 0o777,
                new Date(),
              );
        renameSync(temporary, settingsPath);
        if (backup) pruneManagedBackups(settingsPath);
        return true;
      } finally {
        if (existsSync(temporary)) unlinkSync(temporary);
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
    const installed = editClaudeSettings(claudeDir, (settings) => {
      const hooks = settings.hooks ?? {};
      if (!record(hooks)) throw new Error("Invalid hook settings");
      for (const event of WAKE_EVENTS)
        if (!Array.isArray(hooks[event] ?? []))
          throw new Error(`Invalid ${event} hooks`);
      if (!Array.isArray(hooks[PENDING_EVENT] ?? []))
        throw new Error(`Invalid ${PENDING_EVENT} hooks`);
      const hook = {
        type: "command",
        command: process.execPath,
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
        command: process.execPath,
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
        nextHooks[event] = [
          ...retained,
          event === "SessionStart"
            ? { matcher: "resume", hooks: [hook] }
            : { hooks: [hook] },
        ];
      }
      const pendingEntries = hooks[PENDING_EVENT] as unknown[] | undefined;
      nextHooks[PENDING_EVENT] = [
        ...(pendingEntries ?? []).flatMap((entry) => {
          if (!record(entry) || !Array.isArray(entry.hooks)) return [entry];
          const siblings = entry.hooks.filter(
            (candidate) => !isOwnPendingHook(candidate),
          );
          if (siblings.length === entry.hooks.length) return [entry];
          return siblings.length ? [{ ...entry, hooks: siblings }] : [];
        }),
        { hooks: [pendingHook] },
      ];
      return {
        ...settings,
        hooks: nextHooks,
      };
    });
    return installed ? "installed_unverified" : "unavailable";
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
