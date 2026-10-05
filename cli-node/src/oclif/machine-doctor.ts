import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
} from "node:fs";
import { join, resolve } from "node:path";
import {
  refreshStoredCliCredentials,
  SAVED_CLI_OAUTH_SESSION_EXPIRED_MESSAGE,
} from "./api-client.js";
import { loadCliCredentials, type StoredCliCredentials } from "./auth.js";
import {
  boundSessionProfiles,
  claudeConfigDir,
  currentCliLocation,
  ensureHookLauncher,
  ephemeralCliReason,
  findOnPath,
  type HookCheckId,
  hasMachineSessionHooks,
  inspectClaudeHooks,
  readClaudeSettings,
  repairClaudeHooks,
  type SessionHookChange,
  type SessionHookItem,
  samePath,
  writeClaudeSettings,
} from "./claude-machine-hooks.js";
import {
  hasCodexSessionHook,
  inspectCodexHook,
  readCodexHooks,
  repairCodexHook,
  writeCodexHooks,
} from "./codex-machine-hooks.js";
import {
  type AgentRuntime,
  type BundledConnectSkill,
  connectSkillTarget,
  installConnectSkill,
  installedVersion,
  readBundledConnectSkill,
} from "./connect-skill.js";
import {
  agentProfileDirectory,
  agentProfileName,
  agentProfilesDirectory,
  type ConnectedAgentProfile,
  loadConnectedAgentProfile,
} from "./connected-agent-profile.js";
import { readHookLauncherWarning } from "./hook-launcher.js";
import {
  type BackgroundListenStatus,
  type BackgroundListenTarget,
  stopBackgroundListen,
} from "./listen-background.js";
import { acquireListenLock } from "./listen-state.js";
import {
  inspectManagedBlock,
  MachineFileError,
  readManagedFile,
  upsertManagedBlock,
  writeManagedFile,
} from "./machine-files.js";
import {
  agentConnectionState,
  MACHINE_RUNTIMES,
  type MachineRuntime,
  pendingSessionDisconnects,
  retryPendingDisconnects,
  type SessionDisconnectDependencies,
} from "./machine-session.js";
import { notificationScope } from "./notify-session.js";
import { SESSION_UUID } from "./notify-session-native.js";
import { readMailJson } from "./shared-mail-files.js";

export const DOCTOR_REPORT_VERSION = 1;

export const DOCTOR_CHECK_IDS = [
  "cli.installed",
  "cli.version",
  "cli.path_stable",
  "auth.member_login",
  "claude.settings_valid",
  "claude.hook.session_start",
  "claude.hook.session_end",
  "claude.hook.stop",
  "claude.instructions",
  "codex.hook.session_start",
  "codex.instructions",
  "omp.instructions",
  "skill.claude",
  "skill.codex",
  "profiles.orphaned",
] as const;
export type DoctorCheckId = (typeof DOCTOR_CHECK_IDS)[number];

export type DoctorStatus = "ok" | "warn" | "fail" | "skip";

/** Something only the person (or the app on their behalf) can do. */
export type DoctorAction = "login" | "install_cli" | "update_cli" | "edit_file";

export type DoctorCheck = {
  id: DoctorCheckId;
  title: string;
  status: DoctorStatus;
  detail: string;
  fixable: boolean;
  fixed?: boolean;
  action?: DoctorAction;
  path?: string;
  /** claude.hook.stop: each per-session receive hook a repair would change. */
  items?: SessionHookItem[];
  /** claude.hook.stop after --fix: each per-session receive hook it changed. */
  changes?: SessionHookChange[];
};

export type DoctorReport = {
  version: 1;
  cliVersion: string;
  checks: DoctorCheck[];
  summary: { ok: number; warn: number; fail: number; skip: number };
  fixedCount: number;
  /** Set when --fix could not take the repair lock, so nothing was changed. */
  repair?: "skipped_busy";
};

const TITLES: Record<DoctorCheckId, string> = {
  "cli.installed": "Primitive CLI installed",
  "cli.version": "Primitive CLI version",
  "cli.path_stable": "CLI location is stable",
  "auth.member_login": "Member login",
  "claude.settings_valid": "Claude Code settings file",
  "claude.hook.session_start": "Claude SessionStart hook",
  "claude.hook.session_end": "Claude SessionEnd hook",
  "claude.hook.stop": "Claude per-session receive hooks",
  "claude.instructions": "Claude Code instructions",
  "codex.hook.session_start": "Codex SessionStart hook",
  "codex.instructions": "Codex instructions",
  "omp.instructions": "omp instructions",
  "skill.claude": "primitive-connect skill for Claude Code",
  "skill.codex": "primitive-connect skill for Codex",
  "profiles.orphaned": "Saved agent profiles",
};

const SKILL_LINE =
  "Load the `primitive-connect` skill before running any `primitive` command, including in a session that is already connected. It covers replies, `--fyi` acknowledgements, automatic signals, work claims, thread muting and peer presence; this block only points to it.";
// Runtimes without the installed skill keep these short rules instead.
const REPLY_LINE =
  "Answer Primitive mail on Primitive with `primitive reply`; read receipts are automatic.";
const WORKING_LINE =
  'Keep AGENT_WORKING current: `primitive agent working set "<task>: <files>"` when work starts and `primitive agent working clear` when it ends.';
const SECRET_LINE = "Never print invitation tokens or credentials.";

/**
 * The managed instruction block for one runtime. Kept short on purpose: where
 * machine doctor installs the primitive-connect skill, the block points to it
 * rather than summarizing it, since agents follow a summary in always-loaded
 * instructions over a skill that is only listed. Without a bundled skill to
 * install, every runtime keeps the short rules.
 */
export function managedInstructions(
  runtime: MachineRuntime,
  options: { skillBundled?: boolean } = {},
): string {
  const register =
    runtime === "claude" || runtime === "codex"
      ? `A Primitive SessionStart hook registers this session with \`primitive agent session-register --runtime ${runtime} --quiet\`; if it has not run, run that command once.`
      : `At session start, if this session is not registered yet, run \`primitive agent session-register --runtime ${runtime} --quiet\`.`;
  const rules =
    (runtime === "claude" || runtime === "codex") &&
    options.skillBundled !== false
      ? [SKILL_LINE, register]
      : [register, REPLY_LINE, WORKING_LINE];
  return [
    "## Primitive",
    "",
    ...[...rules, SECRET_LINE].map((line) => `- ${line}`),
  ].join("\n");
}

type Env = Record<string, string | undefined>;

export type MachineDoctorOptions = {
  fix: boolean;
  /** With --fix, repair only these checks; every check is still reported. */
  only?: ReadonlySet<string>;
  /** With --fix, change per-session receive hooks only for these profiles. */
  profiles?: ReadonlySet<string>;
  runtimes?: ReadonlySet<MachineRuntime>;
  configDir: string;
  home: string;
  env: Env;
  packageRoot: string;
  cliVersion: string;
  /** process.argv[1] of the running CLI. */
  cliEntry: string;
  execPath?: string;
  /** Platform hooks are written for; Windows hooks name Node directly. */
  platform?: NodeJS.Platform;
  minCliVersion?: string;
  fetch?: typeof fetch;
  now?: () => Date;
  /** Latest published version, or null when it cannot be read. */
  latestVersion?: () => Promise<string | null>;
  stopReceiver?: (
    target: BackgroundListenTarget,
  ) => Promise<BackgroundListenStatus>;
  bundle?: () => BundledConnectSkill;
  /** How ended sessions' agents are disconnected when a retry is due. */
  sessionDisconnect?: Partial<SessionDisconnectDependencies>;
};

/** Compare dotted numeric versions; pre-release suffixes are ignored. */
export function compareVersions(a: string, b: string): number | null {
  const parse = (value: string) => {
    const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(value.trim());
    return match ? match.slice(1, 4).map(Number) : null;
  };
  const left = parse(a);
  const right = parse(b);
  if (!left || !right) return null;
  for (let index = 0; index < 3; index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

async function npmLatestVersion(
  fetchImpl: typeof fetch,
): Promise<string | null> {
  try {
    const response = await fetchImpl(
      "https://registry.npmjs.org/primitive/latest",
      {
        headers: { accept: "application/json" },
        redirect: "follow",
        signal: AbortSignal.timeout(3_000),
      },
    );
    if (!response.ok) return null;
    const text = await response.text();
    if (text.length > 1_048_576) return null;
    const version = (JSON.parse(text) as { version?: unknown }).version;
    return typeof version === "string" ? version : null;
  } catch {
    return null;
  }
}

const SKILL_BACKUPS_KEPT = 2;

/**
 * Skill backups are named <runtime>-<sequence>-<timestamp>. The sequence is
 * one past the highest existing one for the runtime, so names order strictly
 * by creation even when several are made within the same second. Backups
 * from the earlier <runtime>-<timestamp>[-<n>] naming have no sequence; they
 * sort before every sequenced backup, oldest first, so pruning removes them
 * first.
 */
function skillBackups(
  directory: string,
  runtime: string,
): Array<{ name: string; sequence: number }> {
  const sequenced = new RegExp(`^${runtime}-(\\d{6,})-\\d{8}T\\d{6}Z$`);
  const legacy = new RegExp(`^${runtime}-(\\d{8}T\\d{6}Z)(?:-(\\d+))?$`);
  let names: string[];
  try {
    names = readdirSync(directory);
  } catch {
    return [];
  }
  const legacyNames = names
    .flatMap((name) => {
      const match = legacy.exec(name);
      return match
        ? [{ name, stamp: match[1] ?? "", suffix: Number(match[2] ?? 0) }]
        : [];
    })
    .sort((left, right) =>
      left.stamp === right.stamp
        ? left.suffix - right.suffix
        : left.stamp < right.stamp
          ? -1
          : 1,
    )
    .map(({ name }, index, all) => ({ name, sequence: index - all.length }));
  const sequencedNames = names.flatMap((name) => {
    const match = sequenced.exec(name);
    return match ? [{ name, sequence: Number(match[1]) }] : [];
  });
  return [...legacyNames, ...sequencedNames].sort(
    (left, right) => left.sequence - right.sequence,
  );
}

function nextSkillBackupName(
  directory: string,
  runtime: string,
  now: Date,
): string {
  const last = Math.max(
    0,
    skillBackups(directory, runtime).at(-1)?.sequence ?? 0,
  );
  return `${runtime}-${String(last + 1).padStart(6, "0")}-${backupStamp(now)}`;
}

function pruneSkillBackups(directory: string, runtime: string): void {
  const backups = skillBackups(directory, runtime);
  for (const { name } of backups.slice(
    0,
    Math.max(0, backups.length - SKILL_BACKUPS_KEPT),
  ))
    try {
      rmSync(join(directory, name), { recursive: true, force: true });
    } catch {
      /* Old backups are harmless; pruning never fails a repair. */
    }
}

function backupStamp(now: Date): string {
  return now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
}

function runtimePresent(
  runtime: MachineRuntime,
  paths: RuntimePaths,
  env: Env,
): boolean {
  const directory =
    runtime === "claude"
      ? paths.claudeDir
      : runtime === "codex"
        ? paths.codexHome
        : paths.ompRoot;
  return existsSync(directory) || findOnPath(runtime, env) !== null;
}

type RuntimePaths = {
  claudeDir: string;
  codexHome: string;
  ompRoot: string;
  ompAgentDir: string;
};

function runtimePaths(env: Env, home: string): RuntimePaths {
  const ompRoot = resolve(home, env.PI_CONFIG_DIR || ".omp");
  return {
    claudeDir: claudeConfigDir(env, home),
    codexHome: resolve(env.CODEX_HOME || join(home, ".codex")),
    ompRoot,
    ompAgentDir: resolve(env.PI_CODING_AGENT_DIR || join(ompRoot, "agent")),
  };
}

/** Codex reads AGENTS.override.md instead of AGENTS.md when it has content. */
function codexInstructionsPath(codexHome: string): string {
  const override = join(codexHome, "AGENTS.override.md");
  const read = readManagedFile(override);
  if (read.state === "present" && read.text.trim()) return override;
  return join(codexHome, "AGENTS.md");
}

async function memberCredentialsFor(
  options: MachineDoctorOptions,
): Promise<StoredCliCredentials | null> {
  try {
    const saved = loadCliCredentials(options.configDir);
    if (!saved) return null;
    return await refreshStoredCliCredentials({
      apiBaseUrl: saved.api_base_url,
      configDir: options.configDir,
      credentials: saved,
      fetch: options.fetch,
    });
  } catch {
    return null;
  }
}

/** Pages to read before giving up on confirming absence (10,000 agents). */
const OWNER_LIST_MAX_PAGES = 200;

/**
 * The member's connection list, hidden agents included, as address to status.
 * Read once per run. `complete` is true only when every page was read and the
 * last one explicitly ended the list (`meta.cursor: null`): a status found on
 * any page stands, but absence is proof only from a complete list.
 */
async function ownerConnectionStatuses(
  credentials: StoredCliCredentials,
  fetchImpl: typeof fetch,
): Promise<{ statuses: Map<string, string>; complete: boolean }> {
  const statuses = new Map<string, string>();
  const partial = () => ({ statuses, complete: false });
  let cursor: string | undefined;
  for (let page = 0; page < OWNER_LIST_MAX_PAGES; page++) {
    const url = new URL(`${credentials.api_base_url}/agent-connections`);
    url.searchParams.set("limit", "50");
    url.searchParams.set("include_hidden", "true");
    if (cursor) url.searchParams.set("cursor", cursor);
    try {
      const response = await fetchImpl(url, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(5_000),
        headers: {
          authorization: `Bearer ${credentials.access_token}`,
          accept: "application/json",
        },
      });
      if (response.status !== 200) {
        await response.body?.cancel().catch(() => undefined);
        return partial();
      }
      const text = await response.text();
      if (text.length > 1_048_576) return partial();
      const body = JSON.parse(text) as {
        success?: unknown;
        data?: unknown;
        meta?: { cursor?: unknown };
      };
      if (body.success !== true || !Array.isArray(body.data)) return partial();
      for (const row of body.data as Array<Record<string, unknown>>)
        if (typeof row?.address === "string" && typeof row.status === "string")
          statuses.set(row.address, row.status);
      const next = body.meta?.cursor;
      if (next === null) return { statuses, complete: true };
      if (typeof next !== "string" || !next || next === cursor)
        return partial();
      cursor = next;
    } catch {
      return partial();
    }
  }
  return partial();
}

/** Whether any saved agent profile still holds a credential. */
function connectedProfileSaved(configDir: string): boolean {
  let names: string[];
  try {
    names = readdirSync(join(agentProfilesDirectory(configDir), "profiles"));
  } catch {
    return false;
  }
  return names.some((name) => {
    try {
      agentProfileName(name);
      return loadConnectedAgentProfile(configDir, name) !== null;
    } catch {
      return false;
    }
  });
}

/**
 * Why a machine-wide check does not apply: agents on this machine were
 * connected one session at a time with `agent connect`, and no member login
 * (which machine-wide session registration needs) is saved.
 */
const PER_CONNECTION_SKIP =
  "Not set up: agents on this machine were connected one session at a time with `primitive agent connect`, which does not need it. To register every session on this machine automatically, sign in with `primitive login`, then run `primitive machine doctor --fix`.";

type CheckRunner = {
  inspect: () => Promise<DoctorCheck> | DoctorCheck;
  repair?: (check: DoctorCheck) => Promise<boolean> | boolean;
};

function check(
  id: DoctorCheckId,
  status: DoctorStatus,
  detail: string,
  extra: Partial<DoctorCheck> = {},
): DoctorCheck {
  return { id, title: TITLES[id], status, detail, fixable: false, ...extra };
}

/**
 * Inspect this machine's Primitive setup for every agent runtime, and with
 * `fix`, repair what can be repaired without the person. Repairs only touch
 * Primitive-owned content, back up any file before changing it, write
 * atomically, and are no-ops when nothing drifted.
 */
export async function runMachineDoctor(
  options: MachineDoctorOptions,
): Promise<DoctorReport> {
  const env = options.env;
  const fetchImpl = options.fetch ?? fetch;
  const now = options.now ?? (() => new Date());
  const paths = runtimePaths(env, options.home);
  const selected = (runtime: MachineRuntime) =>
    !options.runtimes || options.runtimes.has(runtime);
  const present = Object.fromEntries(
    MACHINE_RUNTIMES.map((runtime) => [
      runtime,
      runtimePresent(runtime, paths, env),
    ]),
  ) as Record<MachineRuntime, boolean>;
  const skipRuntime = (runtime: MachineRuntime): string | null =>
    !selected(runtime)
      ? "Not selected with --runtime."
      : !present[runtime]
        ? `${runtime === "claude" ? "Claude Code" : runtime === "codex" ? "Codex" : "omp"} was not found on this machine.`
        : null;
  const cli = currentCliLocation(options.cliEntry, env, options.execPath, {
    configDir: options.configDir,
    platform: options.platform,
  });
  const ephemeral = cli ? ephemeralCliReason(cli.entry) : null;
  const ephemeralBlocked = ephemeral
    ? `This CLI runs from ${ephemeral}, which can be deleted; install it with \`npm install -g primitive\` before repairing hooks.`
    : null;
  // Claude hooks run through the hook launcher, which finds another copy of
  // the CLI when a package-runner cache is cleaned, so only a missing CLI or
  // a platform without the launcher blocks repairing them. Codex hooks name
  // the CLI directly.
  const hookBlocked = !cli
    ? "This CLI's hook scripts were not found next to it."
    : cli.launcher
      ? null
      : ephemeralBlocked;
  const codexBlocked = !cli
    ? "This CLI's hook scripts were not found next to it."
    : ephemeralBlocked;
  // Machine-wide setup (member login, session hooks, instruction blocks) is
  // only checked when it is in use or could be: a machine whose agents were
  // all connected per session, with no member login, has none of it by design.
  const memberLoginSaved = (() => {
    try {
      return loadCliCredentials(options.configDir) !== null;
    } catch {
      return true;
    }
  })();
  const perConnection =
    !memberLoginSaved && connectedProfileSaved(options.configDir);
  const skillEnv = {
    ...env,
    CLAUDE_CONFIG_DIR: paths.claudeDir,
    CODEX_HOME: paths.codexHome,
  };
  let bundle: BundledConnectSkill | null | undefined;
  const loadBundle = () => {
    if (bundle !== undefined) return bundle;
    try {
      bundle = (
        options.bundle ?? (() => readBundledConnectSkill(options.packageRoot))
      )();
    } catch {
      bundle = null;
    }
    return bundle;
  };

  const instruction = (
    id: "claude.instructions" | "codex.instructions" | "omp.instructions",
    runtime: MachineRuntime,
    path: () => string,
  ): CheckRunner => ({
    inspect: () => {
      const skip = skipRuntime(runtime);
      if (skip) return check(id, "skip", skip);
      const target = path();
      const body = managedInstructions(runtime, {
        skillBundled: loadBundle() !== null,
      });
      const read = readManagedFile(target);
      if (read.state === "invalid")
        return check(id, "fail", read.detail, {
          path: target,
          action: "edit_file",
        });
      if (
        perConnection &&
        (read.state === "absent" ||
          inspectManagedBlock(read.text, body).state === "missing")
      )
        return check(id, "skip", PER_CONNECTION_SKIP, { path: target });
      if (read.state === "absent")
        return check(id, "fail", `${target} does not exist yet.`, {
          path: target,
          fixable: true,
        });
      const state = inspectManagedBlock(read.text, body);
      if (state.state === "ok")
        return check(id, "ok", `The Primitive block in ${target} is current.`, {
          path: target,
        });
      if (state.state === "malformed")
        return check(
          id,
          "fail",
          `${target}: ${state.detail}. It was left unchanged.`,
          { path: target, action: "edit_file" },
        );
      return check(
        id,
        "fail",
        state.state === "missing"
          ? `${target} has no Primitive block.`
          : `The Primitive block in ${target} is out of date (v${state.version}).`,
        { path: target, fixable: true },
      );
    },
    repair: () => {
      const target = path();
      const read = readManagedFile(target);
      if (read.state === "invalid") return false;
      const text = read.state === "present" ? read.text : "";
      const next = upsertManagedBlock(
        text,
        managedInstructions(runtime, { skillBundled: loadBundle() !== null }),
      );
      if (read.state === "present" && next === read.text) return false;
      writeManagedFile({ read, content: next, now });
      return true;
    },
  });

  const skill = (
    id: "skill.claude" | "skill.codex",
    runtime: AgentRuntime,
  ): CheckRunner => ({
    inspect: () => {
      const skip = skipRuntime(runtime);
      if (skip) return check(id, "skip", skip);
      const current = loadBundle();
      if (!current)
        return check(
          id,
          "skip",
          "This CLI build does not include the bundled skill.",
        );
      const target = connectSkillTarget({ runtime, env: skillEnv });
      let info: ReturnType<typeof lstatSync> | null = null;
      try {
        info = lstatSync(target);
      } catch {
        info = null;
      }
      if (!info && perConnection)
        return check(id, "skip", PER_CONNECTION_SKIP, { path: target });
      if (!info)
        return check(id, "fail", `Not installed at ${target}.`, {
          path: target,
          fixable: true,
        });
      if (info.isSymbolicLink())
        return check(
          id,
          "warn",
          `${target} is a symlink you manage; it was left unchanged.`,
          { path: target },
        );
      const version = installedVersion(target);
      if (version === current.version)
        return check(id, "ok", `Version ${version} matches this CLI.`, {
          path: target,
        });
      return check(
        id,
        "fail",
        version
          ? `Installed version ${version} differs from this CLI's ${current.version}.`
          : `${target} is not a readable skill directory.`,
        { path: target, fixable: version !== null },
      );
    },
    repair: () => {
      const current = loadBundle();
      if (!current) return false;
      const target = connectSkillTarget({ runtime, env: skillEnv });
      const backups = join(options.configDir, "machine", "backups", "skills");
      if (existsSync(target)) {
        // Keep the whole replaced copy, installed helper packages included,
        // so restoring it brings back a working skill.
        mkdirSync(backups, { recursive: true, mode: 0o700 });
        const backup = join(
          backups,
          nextSkillBackupName(backups, runtime, now()),
        );
        // Created exclusively: a concurrent run cannot share the name.
        mkdirSync(backup, { mode: 0o700 });
        cpSync(target, backup, { recursive: true, verbatimSymlinks: true });
      }
      const result = installConnectSkill({
        bundle: current,
        runtime,
        env: skillEnv,
      });
      if (result.state === "failed")
        throw new MachineFileError(
          `The skill could not be installed (${result.reason ?? "unknown"}).`,
        );
      // Only after a successful replacement: keep the newest two backups for
      // this runtime and remove older ones by their exact paths.
      pruneSkillBackups(backups, runtime);
      return result.state === "installed" || result.state === "updated";
    },
  });

  const HOOK_CHECK_IDS: HookCheckId[] = [
    "claude.hook.session_start",
    "claude.hook.session_end",
    "claude.hook.stop",
  ];
  const repairedAhead = new Set<DoctorCheckId>();
  // Per-session receive hooks changed by any hook repair in this run.
  const sessionHookChanges: SessionHookChange[] = [];
  // Claude settings are parsed once; every hook check reads the same copy and
  // all hook repairs land in one backed-up write.
  let settingsRead = readClaudeSettings(paths.claudeDir);
  const hookContext = {
    cli,
    blocked: hookBlocked,
    // Read on every use: the profile checks may move a revoked profile
    // aside before the hooks are repaired, and its hooks must not return.
    get bound() {
      return boundSessionProfiles(options.configDir);
    },
    restoreProfiles: options.profiles,
  };
  // Claude hooks name the launcher, but the file itself is gone.
  const launcherMissing = (): boolean =>
    !!cli?.launcher &&
    settingsRead.ok &&
    !existsSync(cli.launcher.path) &&
    JSON.stringify(settingsRead.settings).includes(
      JSON.stringify(cli.launcher.path),
    );
  const hookCheck = (id: HookCheckId): CheckRunner => ({
    inspect: () => {
      const skip = skipRuntime("claude");
      if (skip) return check(id, "skip", skip);
      if (!settingsRead.ok)
        return check(
          id,
          "fail",
          "Claude settings.json is invalid; repair it first.",
          { path: join(paths.claudeDir, "settings.json") },
        );
      if (
        perConnection &&
        id !== "claude.hook.stop" &&
        !hasMachineSessionHooks(settingsRead.settings)
      )
        return check(id, "skip", PER_CONNECTION_SKIP, {
          path: join(paths.claudeDir, "settings.json"),
        });
      const inspected = inspectClaudeHooks(settingsRead.settings, hookContext)[
        id
      ];
      // A hook naming a deleted launcher is already reported as outdated;
      // say why, since its settings entry looks unchanged.
      const finding =
        inspected.status === "fail" && launcherMissing()
          ? {
              ...inspected,
              detail: `${inspected.detail} The hook launcher ${cli?.launcher?.path} is missing; a repair writes it again.`,
            }
          : inspected;
      // The launcher records when it last found no Node or CLI to run.
      const launcherWarning =
        id === "claude.hook.stop" && cli?.launcher
          ? readHookLauncherWarning(options.configDir)
          : null;
      if (launcherWarning && finding.status === "ok")
        return check(
          id,
          "warn",
          `${finding.detail} The last hook run reported: ${launcherWarning}`,
          { path: join(paths.claudeDir, "settings.json") },
        );
      return check(id, finding.status, finding.detail, {
        fixable: finding.fixable,
        path: join(paths.claudeDir, "settings.json"),
        ...(finding.status === "fail" && !finding.fixable && hookBlocked
          ? { action: "install_cli" as const }
          : {}),
        ...(finding.items?.length
          ? {
              items: finding.items.map((item) =>
                // With --fix --profile, say which hooks this run leaves alone.
                options.fix && options.profiles
                  ? {
                      ...item,
                      selected:
                        item.profile !== null &&
                        options.profiles.has(item.profile),
                    }
                  : item,
              ),
            }
          : {}),
        ...(id === "claude.hook.stop" && sessionHookChanges.length
          ? { changes: [...sessionHookChanges] }
          : {}),
      });
    },
    repair: () => {
      if (!settingsRead.ok) return false;
      // Repair every wanted, failing hook check in one backed-up write.
      const findings = inspectClaudeHooks(settingsRead.settings, hookContext);
      // Machine-wide session hooks a per-connection machine does not use
      // are skipped, so a repair never adds them either.
      const machineHooksSkipped =
        perConnection && !hasMachineSessionHooks(settingsRead.settings);
      const ids = HOOK_CHECK_IDS.filter(
        (hook) =>
          (hook === "claude.hook.stop" || !machineHooksSkipped) &&
          (hook === id || !options.only || options.only.has(hook)) &&
          findings[hook].status === "fail" &&
          findings[hook].fixable,
      );
      const repaired = repairClaudeHooks(
        settingsRead.settings,
        hookContext,
        new Set(ids),
        { profiles: options.profiles },
      );
      // Hooks run through the launcher, so it is in place before they name
      // it, and it is restored whenever hooks name it and it is gone, even
      // when no hook entry itself needs to change.
      const restoreLauncher = launcherMissing();
      if (!repaired.changed.size && !restoreLauncher) return false;
      if (cli && hookBlocked === null)
        try {
          ensureHookLauncher(cli);
        } catch {
          throw new MachineFileError(
            `The hook launcher ${cli.launcher?.path ?? ""} could not be written.`,
          );
        }
      if (!repaired.changed.size) return id === "claude.hook.stop";
      // A failed write throws before anything is recorded, so no later check
      // reports a change that was never saved.
      writeClaudeSettings({
        claudeDir: paths.claudeDir,
        read: settingsRead.read,
        settings: repaired.settings,
        now,
      });
      sessionHookChanges.push(...repaired.changes);
      for (const hook of repaired.changed) repairedAhead.add(hook);
      settingsRead = readClaudeSettings(paths.claudeDir);
      return repaired.changed.has(id);
    },
  });

  const codexHook: CheckRunner = {
    inspect: () => {
      const id = "codex.hook.session_start";
      const skip = skipRuntime("codex");
      if (skip) return check(id, "skip", skip);
      const read = readCodexHooks(paths.codexHome);
      if (!read.ok)
        return check(id, "fail", read.detail, {
          path: read.path,
          action: "edit_file",
        });
      if (perConnection && !hasCodexSessionHook(read.settings))
        return check(id, "skip", PER_CONNECTION_SKIP, { path: read.path });
      const configToml = readManagedFile(join(paths.codexHome, "config.toml"));
      const finding = inspectCodexHook(
        read,
        { cli, blocked: codexBlocked },
        configToml.state === "present" ? configToml.text : null,
      );
      return check(id, finding.status, finding.detail, {
        fixable: finding.fixable,
        path: read.path,
        ...(finding.status === "fail" && !finding.fixable && codexBlocked
          ? { action: "install_cli" as const }
          : {}),
      });
    },
    repair: () => {
      const read = readCodexHooks(paths.codexHome);
      if (!read.ok || !cli || codexBlocked) return false;
      const repaired = repairCodexHook(read.settings, cli);
      if (!repaired.changed) return false;
      writeCodexHooks({ read: read.read, settings: repaired.settings, now });
      return true;
    },
  };

  const orphans: Array<{ name: string; profile: ConnectedAgentProfile }> = [];
  const inspectProfiles = async (): Promise<DoctorCheck> => {
    orphans.length = 0;
    const directory = join(
      agentProfilesDirectory(options.configDir),
      "profiles",
    );
    let names: string[] = [];
    try {
      names = readdirSync(directory).filter((name) => {
        try {
          agentProfileName(name);
          return true;
        } catch {
          return false;
        }
      });
    } catch {
      names = [];
    }
    const profiles: Array<{
      name: string;
      profile: ConnectedAgentProfile;
    }> = [];
    let unreadable = 0;
    for (const name of names) {
      try {
        const profile = loadConnectedAgentProfile(options.configDir, name);
        if (profile) profiles.push({ name, profile });
      } catch {
        unreadable++;
      }
    }
    if (!profiles.length)
      return unreadable
        ? check(
            "profiles.orphaned",
            "warn",
            `${unreadable} saved profiles could not be read; they were left unchanged.`,
          )
        : check("profiles.orphaned", "ok", "No saved agent profiles.");
    let member: StoredCliCredentials | null | undefined;
    const unconfirmed: string[] = [];
    // Rejected profiles the saved sign-in cannot check at all: another
    // organization or another Primitive API (such as staging).
    let elsewhere = 0;
    let ownerList:
      | { statuses: Map<string, string>; complete: boolean }
      | undefined;
    let unknown = 0;
    let connected = 0;
    // A few requests at a time: this runs on a timer and a machine can
    // hold many old session profiles.
    const states: Array<
      (typeof profiles)[number] & {
        state: Awaited<ReturnType<typeof agentConnectionState>>;
      }
    > = [];
    for (let start = 0; start < profiles.length; start += 8)
      states.push(
        ...(await Promise.all(
          profiles.slice(start, start + 8).map(async (entry) => ({
            ...entry,
            state: await agentConnectionState(entry.profile, fetchImpl),
          })),
        )),
      );
    for (const entry of states) {
      if (entry.state === "revoked") orphans.push(entry);
      else if (entry.state === "rejected") {
        member ??= await memberCredentialsFor(options);
        const checkable =
          !!member &&
          member.org_id === entry.profile.org_id &&
          member.api_base_url === entry.profile.api_base_url;
        if (member && !checkable) elsewhere++;
        if (checkable && member && ownerList === undefined)
          ownerList = await ownerConnectionStatuses(member, fetchImpl);
        const listed =
          checkable && ownerList
            ? (ownerList.statuses.get(entry.profile.agent_address) ??
              (ownerList.complete ? "absent" : null))
            : null;
        // A rejected key whose agent is revoked, or gone from the complete
        // list (removed in the app), can never work again.
        if (listed === "revoked" || listed === "absent") orphans.push(entry);
        else unconfirmed.push(entry.profile.agent_address);
      } else if (entry.state === "unavailable") unknown++;
      else connected++;
    }
    if (orphans.length)
      return check(
        "profiles.orphaned",
        "fail",
        `${orphans.length} saved profiles were disconnected or removed in Primitive: ${orphans
          .map((entry) => entry.profile.agent_address)
          .join(
            ", ",
          )}. A repair moves them aside locally; nothing changes in Primitive.`,
        { fixable: true },
      );
    if (unconfirmed.length || unreadable)
      return check(
        "profiles.orphaned",
        "warn",
        [
          unconfirmed.length
            ? `${unconfirmed.length} saved profiles have credentials Primitive no longer accepts (${unconfirmed.slice(0, 5).join(", ")}${unconfirmed.length > 5 ? `, and ${unconfirmed.length - 5} more` : ""}). They cannot send or receive. To clean them up, sign in with \`primitive login --force\` as a member of their organization and run \`primitive machine doctor --fix\`, which confirms each one is disconnected before moving it aside${elsewhere ? `. ${elsewhere} of them belong to an organization or Primitive API your current sign-in is not for, so sign in there to check them` : ""}`
            : "",
          unreadable ? `${unreadable} profiles could not be read` : "",
        ]
          .filter(Boolean)
          .join("; ")
          .concat("; they were left unchanged."),
      );
    if (unknown && !connected)
      return check(
        "profiles.orphaned",
        "skip",
        "Primitive could not be reached to check saved profiles.",
      );
    return check(
      "profiles.orphaned",
      "ok",
      `${connected} saved profiles are connected${unknown ? `; ${unknown} could not be checked` : ""}.`,
    );
  };
  const moveOrphans = async (): Promise<boolean> => {
    let moved = 0;
    for (const entry of orphans) {
      const directory = agentProfileDirectory(options.configDir, entry.name);
      let session: string | null = null;
      try {
        const setup = readMailJson(join(directory, "setup.json")) as {
          session?: unknown;
        } | null;
        if (
          typeof setup?.session === "string" &&
          SESSION_UUID.test(setup.session)
        )
          session = setup.session.toLowerCase();
      } catch {
        session = null;
      }
      if (session) {
        const stopped = await (options.stopReceiver ?? stopBackgroundListen)({
          configDir: options.configDir,
          scope: notificationScope(
            entry.profile.api_base_url,
            entry.profile.api_key,
          ),
          threadId: session,
        }).catch(() => null);
        if (
          !stopped ||
          !(
            stopped.phase === null ||
            stopped.phase === "stopped" ||
            stopped.phase === "failed" ||
            stopped.reason === "exited"
          )
        )
          continue;
      }
      const aside = join(agentProfilesDirectory(options.configDir), "orphaned");
      mkdirSync(aside, { recursive: true, mode: 0o700 });
      renameSync(directory, join(aside, `${entry.name}-${backupStamp(now())}`));
      moved++;
    }
    return moved > 0;
  };
  const runners: Record<DoctorCheckId, CheckRunner> = {
    "cli.installed": {
      inspect: () =>
        cli
          ? check(
              "cli.installed",
              "ok",
              `primitive ${options.cliVersion} at ${cli.entry}.`,
              { path: cli.entry },
            )
          : check(
              "cli.installed",
              "fail",
              "The running CLI's files could not be located.",
              { action: "install_cli" },
            ),
    },
    "cli.version": {
      inspect: async () => {
        const version = options.cliVersion;
        if (options.minCliVersion) {
          const compared = compareVersions(version, options.minCliVersion);
          if (compared === null)
            return check(
              "cli.version",
              "warn",
              `Cannot compare ${version} with the required ${options.minCliVersion}.`,
            );
          if (compared < 0)
            return check(
              "cli.version",
              "fail",
              `${version} is older than the required ${options.minCliVersion}.`,
              { action: "update_cli" },
            );
        }
        const latest = await (
          options.latestVersion ?? (() => npmLatestVersion(fetchImpl))
        )();
        if (!latest)
          return options.minCliVersion
            ? check(
                "cli.version",
                "ok",
                `${version} meets the required ${options.minCliVersion}; the latest release could not be checked.`,
              )
            : check(
                "cli.version",
                "skip",
                `${version}; the latest release could not be checked.`,
              );
        const behind = compareVersions(version, latest);
        if (behind !== null && behind < 0)
          return check(
            "cli.version",
            "warn",
            `${version} is older than the latest release ${latest}.`,
            { action: "update_cli" },
          );
        return check("cli.version", "ok", `${version} is current.`);
      },
    },
    "cli.path_stable": {
      inspect: () => {
        if (!cli)
          return check(
            "cli.path_stable",
            "fail",
            "The running CLI's files could not be located.",
            { action: "install_cli" },
          );
        if (ephemeral && !cli.launcher)
          return check(
            "cli.path_stable",
            "fail",
            `This CLI runs from ${ephemeral}; hooks pointing at it would break. Install it globally with \`npm install -g primitive\`.`,
            { action: "install_cli", path: cli.entry },
          );
        if (ephemeral) {
          const launcherNote = `This CLI runs from ${ephemeral}. Claude Code hooks run through ${cli.launcher?.path}, which uses the \`primitive\` on PATH or fetches this version again with npx if the cache is removed.`;
          // Codex hooks name the CLI directly, so they still need a stable
          // install when this machine has (or is getting) one.
          const codexRead = readCodexHooks(paths.codexHome);
          const codexInUse =
            selected("codex") &&
            present.codex &&
            !(
              perConnection &&
              codexRead.ok &&
              !hasCodexSessionHook(codexRead.settings)
            );
          return codexInUse
            ? check(
                "cli.path_stable",
                "warn",
                `${launcherNote} The Codex SessionStart hook names the CLI directly; install it globally with \`npm install -g primitive\` so that hook keeps working.`,
                { action: "install_cli", path: cli.entry },
              )
            : check("cli.path_stable", "ok", launcherNote, { path: cli.entry });
        }
        const onPath = findOnPath("primitive", env);
        if (onPath && !samePath(onPath, cli.entry))
          return check(
            "cli.path_stable",
            "warn",
            `\`primitive\` on PATH is ${onPath}, but this run is ${cli.entry}; hooks follow the copy that runs the doctor.`,
            { path: cli.entry },
          );
        return check(
          "cli.path_stable",
          "ok",
          `Hooks use ${cli.node} and ${cli.entry}.`,
          { path: cli.entry },
        );
      },
    },
    "auth.member_login": {
      inspect: async () => {
        let saved: StoredCliCredentials | null;
        try {
          saved = loadCliCredentials(options.configDir);
        } catch {
          return check(
            "auth.member_login",
            "fail",
            "The saved login file is unreadable. Sign in again.",
            { action: "login" },
          );
        }
        if (!saved)
          return perConnection
            ? check(
                "auth.member_login",
                "skip",
                "No member login is saved. Agents on this machine were connected with `primitive agent connect` and use their own saved credentials; sign in with `primitive login` only to register every session on this machine automatically.",
              )
            : check(
                "auth.member_login",
                "fail",
                "No saved member login on this machine.",
                { action: "login" },
              );
        let credentials: StoredCliCredentials;
        try {
          credentials = await refreshStoredCliCredentials({
            apiBaseUrl: saved.api_base_url,
            configDir: options.configDir,
            credentials: saved,
            fetch: options.fetch,
          });
        } catch (error) {
          return error instanceof Error &&
            error.message === SAVED_CLI_OAUTH_SESSION_EXPIRED_MESSAGE
            ? check(
                "auth.member_login",
                "fail",
                "The saved login expired or was revoked.",
                { action: "login" },
              )
            : check(
                "auth.member_login",
                "warn",
                "The saved login could not be refreshed right now (offline?).",
              );
        }
        try {
          const response = await fetchImpl(
            `${credentials.api_base_url}/account`,
            {
              method: "GET",
              redirect: "error",
              signal: AbortSignal.timeout(5_000),
              headers: {
                authorization: `Bearer ${credentials.access_token}`,
                accept: "application/json",
              },
            },
          );
          await response.body?.cancel().catch(() => undefined);
          if (response.status === 401 || response.status === 403)
            return check(
              "auth.member_login",
              "fail",
              "The saved login was rejected.",
              { action: "login" },
            );
          if (!response.ok)
            return check(
              "auth.member_login",
              "warn",
              `The saved login could not be verified (HTTP ${response.status}).`,
            );
        } catch {
          return check(
            "auth.member_login",
            "warn",
            "The saved login could not be verified right now (offline?).",
          );
        }
        return check(
          "auth.member_login",
          "ok",
          `Signed in to ${credentials.org_name ?? credentials.org_id}.`,
        );
      },
    },
    "claude.settings_valid": {
      inspect: () => {
        const skip = skipRuntime("claude");
        if (skip) return check("claude.settings_valid", "skip", skip);
        const path = join(paths.claudeDir, "settings.json");
        if (!settingsRead.ok)
          return check("claude.settings_valid", "fail", settingsRead.detail, {
            path,
            action: "edit_file",
          });
        return check(
          "claude.settings_valid",
          "ok",
          settingsRead.read.state === "absent"
            ? `${path} does not exist yet; a repair creates it.`
            : `${path} is valid JSON.`,
          { path },
        );
      },
    },
    "claude.hook.session_start": hookCheck("claude.hook.session_start"),
    "claude.hook.session_end": hookCheck("claude.hook.session_end"),
    "claude.hook.stop": hookCheck("claude.hook.stop"),
    "codex.hook.session_start": codexHook,
    "claude.instructions": instruction("claude.instructions", "claude", () =>
      join(paths.claudeDir, "CLAUDE.md"),
    ),
    "codex.instructions": instruction("codex.instructions", "codex", () =>
      codexInstructionsPath(paths.codexHome),
    ),
    "omp.instructions": instruction("omp.instructions", "omp", () =>
      join(paths.ompAgentDir, "AGENTS.md"),
    ),
    "skill.claude": skill("skill.claude", "claude"),
    "skill.codex": skill("skill.codex", "codex"),
    "profiles.orphaned": {
      inspect: async () => {
        const result = await inspectProfiles();
        const pending = pendingSessionDisconnects(options.configDir);
        if (!pending.length) return result;
        const addresses = pending.flatMap((record) =>
          record.address ? [record.address] : [],
        );
        return check(
          "profiles.orphaned",
          "fail",
          `${pending.length} ended sessions still need their agent disconnected${
            addresses.length ? ` (${addresses.join(", ")})` : ""
          }; a repair retries it.${result.status === "ok" ? "" : ` ${result.detail}`}`,
          { fixable: true },
        );
      },
      repair: async () => {
        const retried = await retryPendingDisconnects(options.configDir, {
          env,
          fetch: options.fetch,
          ...(options.sessionDisconnect
            ? { dependencies: options.sessionDisconnect }
            : {}),
        });
        const moved = await moveOrphans();
        return moved || retried > 0;
      },
    },
  };

  let release: (() => void) | undefined;
  let busy = false;
  if (options.fix) {
    for (let attempt = 0; attempt < 40 && !release; attempt++) {
      try {
        release = acquireListenLock(
          join(options.configDir, "machine"),
          "machine-doctor",
        );
      } catch {
        await new Promise((done) => setTimeout(done, 250));
      }
    }
    busy = !release;
  }
  const results = new Map<DoctorCheckId, DoctorCheck>();
  try {
    // Profiles go first so hooks for profiles moved aside are cleaned up in
    // the same run.
    const order: DoctorCheckId[] = [
      "profiles.orphaned",
      ...DOCTOR_CHECK_IDS.filter((id) => id !== "profiles.orphaned"),
    ];
    for (const id of order) {
      const runner = runners[id];
      let result: DoctorCheck;
      try {
        result = await runner.inspect();
      } catch {
        result = check(id, "fail", "This check could not run.");
      }
      if (result.status === "ok" && repairedAhead.has(id))
        result = { ...result, fixed: true };
      const wanted = !options.only || options.only.has(id);
      if (
        options.fix &&
        !busy &&
        wanted &&
        result.fixable &&
        result.status !== "ok" &&
        runner.repair
      ) {
        try {
          const changed = await runner.repair(result);
          const after = await runner.inspect();
          // A Codex hook can be repaired yet still await the person's trust.
          result = { ...after, fixed: changed && after.status !== "fail" };
          if (changed && after.status === "fail")
            result.detail =
              id === "claude.hook.stop" && options.profiles
                ? `${after.detail} (Only the selected profiles were repaired.)`
                : `${after.detail} (A repair was applied but did not resolve this.)`;
        } catch (error) {
          result = {
            ...result,
            fixed: false,
            detail: `${result.detail} Repair failed: ${
              error instanceof MachineFileError
                ? error.message
                : "an unexpected error; nothing further was changed."
            }`,
          };
        }
      }
      results.set(id, result);
    }
  } finally {
    release?.();
  }
  const checks = DOCTOR_CHECK_IDS.map(
    (id) => results.get(id) ?? check(id, "fail", "This check did not run."),
  );
  const summary = { ok: 0, warn: 0, fail: 0, skip: 0 };
  for (const item of checks) summary[item.status]++;
  return {
    version: DOCTOR_REPORT_VERSION,
    cliVersion: options.cliVersion,
    checks,
    summary,
    fixedCount: checks.filter((item) => item.fixed).length,
    ...(busy ? { repair: "skipped_busy" as const } : {}),
  };
}
