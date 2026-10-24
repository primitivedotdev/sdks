import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import {
  currentCliLocation,
  ensureHookLauncher,
  foldedReceiver,
  hasSessionReceiveHook,
  hasSharedHook,
  otherSessionReceivers,
  parseReceiveHook,
  profileStillConnected,
  sharedHookEntry,
  stableNodePath,
} from "./claude-machine-hooks.js";
import {
  addSessionReceiver,
  pruneSessionReceivers,
  removeSessionReceiver,
} from "./claude-session-receivers.js";
import {
  agentProfileDirectory,
  agentProfileName,
} from "./connected-agent-profile.js";
import { hookLauncherPath, hookLauncherSupported } from "./hook-launcher.js";
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

const RECEIVE_EVENTS = ["Stop", "SessionStart", "PostToolUse"] as const;

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
  platform?: NodeJS.Platform;
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
    // A hook is current when it runs through the hook launcher, or (from an
    // older CLI, or on Windows) names this machine's Node directly, which
    // still runs while that Node exists.
    const commands = [
      ...(hookLauncherSupported(options.platform)
        ? [hookLauncherPath(configDir)]
        : []),
      stableNodePath(env),
    ];
    const installed = (["Stop", "SessionStart", "PostToolUse"] as const).every(
      (event) =>
        commands.some((node) =>
          hasSessionReceiveHook(hooks, event, target, node),
        ),
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

/**
 * Record this profile as a receiver for the session and make sure the one
 * shared set of receive hooks is installed, preserving unrelated settings.
 * Per-session hooks written by earlier versions for this config directory
 * are folded in: a still-bound profile becomes a recorded receiver and its
 * hooks are removed; hooks for disconnected profiles or removed config
 * directories are pruned. Hooks of other tools are never touched.
 */
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
   * another connected profile and this profile is not a receiver there,
   * nothing is added: it was removed on purpose, or adding it would give the
   * session a second address. Commands that name the profile (agent connect,
   * agent enroll) leave it unset and always install.
   */
  yieldToOtherProfiles?: boolean;
  platform?: NodeJS.Platform;
}): ClaudeWakeHookResult {
  try {
    const configDir = resolve(options.configDir);
    const env = options.env ?? process.env;
    const cli = currentCliLocation(options.cliPath, env, process.execPath, {
      configDir,
      platform: options.platform,
    });
    if (!cli) return "unavailable";
    const profileName = agentProfileName(options.profileName);
    const agentAddress = mailAddress(options.agentAddress);
    if (!SESSION_UUID.test(options.sessionId)) return "unavailable";
    const sessionId = options.sessionId.toLowerCase();
    const claudeDir = resolve(
      env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"),
    );
    // Hooks run through the launcher, which survives the removal of the Node
    // version or package-runner cache this CLI runs from. Should it not be
    // writable, the hook names Node directly (a PATH link such as a package
    // manager's bin/node when one resolves to the same file).
    let node = cli.node;
    try {
      ensureHookLauncher(cli);
    } catch {
      node = cli.runtimeNode;
    }
    // Receivers whose profile was disconnected or removed are dropped first,
    // so they never hold a session for another profile.
    pruneSessionReceivers(configDir);
    let held = false;
    const installed = editClaudeSettings(claudeDir, (settings) => {
      const hooks = settings.hooks ?? {};
      if (!record(hooks)) throw new Error("Invalid hook settings");
      for (const event of RECEIVE_EVENTS)
        if (!Array.isArray(hooks[event] ?? []))
          throw new Error(`Invalid ${event} hooks`);
      // Judged under the settings lock on the file as read, so a concurrent
      // install for the other profile cannot slip between check and write.
      held =
        options.yieldToOtherProfiles === true &&
        otherSessionReceivers(hooks, {
          configDir,
          profile: profileName,
          session: sessionId,
        }).length > 0;
      const isOwnLegacyHook = (parsed: ReturnType<typeof parseReceiveHook>) => {
        // An old profile-bearing hook without a session is removable only
        // when its saved setup proves it belongs to this same session.
        // Generic legacy hooks have no recoverable target and may still
        // serve other sessions.
        if (
          !parsed ||
          parsed.shared ||
          parsed.session !== null ||
          parsed.profile !== profileName ||
          resolve(parsed.configDir) !== configDir
        )
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
      const perSession = (parsed: ReturnType<typeof parseReceiveHook>) =>
        parsed !== null &&
        !parsed.shared &&
        parsed.profile !== null &&
        parsed.session !== null;
      if (!held)
        addSessionReceiver(configDir, sessionId, {
          profile: profileName,
          address: agentAddress,
        });
      const nextHooks: RecordValue = { ...hooks };
      for (const event of RECEIVE_EVENTS) {
        const entries = (hooks[event] as unknown[] | undefined) ?? [];
        const ownShared = (candidate: unknown) => {
          const parsed = parseReceiveHook(candidate);
          return (
            parsed?.shared === true && resolve(parsed.configDir) === configDir
          );
        };
        const wanted = sharedHookEntry(event, cli, configDir, node);
        const [wantedHook] = wanted.hooks as unknown[];
        const existing = entries.flatMap((entry) =>
          record(entry) && Array.isArray(entry.hooks)
            ? entry.hooks.filter(ownShared)
            : [],
        );
        // A current shared hook stays where it is, so a repeat install
        // leaves the file unchanged.
        const reuse =
          held ||
          (existing.length === 1 &&
            JSON.stringify(existing[0]) === JSON.stringify(wantedHook) &&
            hasSharedHook(hooks, event, configDir, node));
        const keep = (candidate: unknown): boolean => {
          const parsed = parseReceiveHook(candidate);
          if (!parsed) return true;
          if (isOwnLegacyHook(parsed)) return false;
          if (!existsSync(parsed.configDir)) return false;
          if (parsed.shared)
            return resolve(parsed.configDir) !== configDir || reuse;
          if (!perSession(parsed)) return true;
          // A held install removes only this profile's own hook for this
          // session; every other receiving hook stays as it is.
          if (
            held &&
            !(
              parsed.profile === profileName &&
              parsed.session?.toLowerCase() === sessionId &&
              resolve(parsed.configDir) === configDir
            )
          )
            return true;
          // Hooks of another config directory are folded in by that
          // directory's own CLI; only dead ones are pruned here.
          if (resolve(parsed.configDir) !== configDir)
            return profileStillConnected(
              parsed.configDir,
              parsed.profile ?? "",
            );
          const current = foldedReceiver(parsed);
          if (current && !held)
            addSessionReceiver(configDir, current.session, {
              profile: current.profile,
              address: current.address,
            });
          return false;
        };
        const retained = entries.flatMap((entry) => {
          if (!record(entry) || !Array.isArray(entry.hooks)) return [entry];
          const siblings = entry.hooks.filter(keep);
          if (siblings.length === entry.hooks.length) return [entry];
          return siblings.length ? [{ ...entry, hooks: siblings }] : [];
        });
        if (hooks[event] !== undefined || !reuse)
          nextHooks[event] = reuse ? retained : [...retained, wanted];
      }
      if (JSON.stringify(nextHooks) === JSON.stringify(hooks)) return null;
      return { ...settings, hooks: nextHooks };
    });
    if (!installed) return "unavailable";
    return held ? "held_for_other_profile" : "installed_unverified";
  } catch {
    return "unavailable";
  }
}

/**
 * Stop receiving as this profile in the session after disconnection: its
 * receiver record goes, with any per-session hooks an earlier version wrote
 * for it. The shared hooks stay; for a session with no receivers they exit
 * at once.
 */
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
    removeSessionReceiver(configDir, sessionId, profileName);
    if (!existsSync(join(claudeDir, "settings.json"))) return true;
    return editClaudeSettings(claudeDir, (settings) => {
      const hooks = settings.hooks ?? {};
      if (!record(hooks)) throw new Error("Invalid hook settings");
      for (const event of RECEIVE_EVENTS)
        if (!Array.isArray(hooks[event] ?? []))
          throw new Error(`Invalid ${event} hooks`);
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
        const parsed = parseReceiveHook(candidate);
        return (
          parsed !== null &&
          !parsed.shared &&
          resolve(parsed.configDir) === configDir &&
          parsed.profile === profileName &&
          parsed.address === agentAddress &&
          (parsed.session === null
            ? legacySessionMatches()
            : parsed.session.toLowerCase() === sessionId)
        );
      };
      let removed = false;
      const nextHooks: RecordValue = { ...hooks };
      for (const event of RECEIVE_EVENTS) {
        const entries = hooks[event] as unknown[] | undefined;
        if (!entries) continue;
        nextHooks[event] = entries.flatMap((entry) => {
          if (!record(entry) || !Array.isArray(entry.hooks)) return [entry];
          const siblings = entry.hooks.filter(
            (candidate) => !isOwnHook(candidate),
          );
          if (siblings.length === entry.hooks.length) return [entry];
          removed = true;
          return siblings.length ? [{ ...entry, hooks: siblings }] : [];
        });
      }
      return removed ? { ...settings, hooks: nextHooks } : null;
    });
  } catch {
    return false;
  }
}
