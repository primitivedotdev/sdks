import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  renameSync,
} from "node:fs";
import { join, resolve } from "node:path";
import {
  refreshStoredCliCredentials,
  SAVED_CLI_OAUTH_SESSION_EXPIRED_MESSAGE,
} from "./api-client.js";
import { loadCliCredentials, type StoredCliCredentials } from "./auth.js";
import {
  claudeConfigDir,
  currentCliLocation,
  ephemeralCliReason,
  findOnPath,
  type HookCheckId,
  inspectClaudeHooks,
  readClaudeSettings,
  repairClaudeHooks,
  samePath,
  writeClaudeSettings,
} from "./claude-machine-hooks.js";
import {
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

const WORKING_LINE =
  'Keep AGENT_WORKING current: `primitive agent working set "<task>: <files>"` when work starts and `primitive agent working clear` when it ends.';
const REPLY_LINE =
  "Answer Primitive mail on Primitive with `primitive reply`; read receipts are automatic.";
const SECRET_LINE = "Never print invitation tokens or credentials.";

/** The managed instruction block for one runtime. Kept short on purpose. */
export function managedInstructions(runtime: MachineRuntime): string {
  const register =
    runtime === "claude" || runtime === "codex"
      ? `A Primitive SessionStart hook registers this session with \`primitive agent session-register --runtime ${runtime} --quiet\`; if it has not run, run that command once.`
      : `At session start, if this session is not registered yet, run \`primitive agent session-register --runtime ${runtime} --quiet\`.`;
  return [
    "## Primitive",
    "",
    `- ${register}`,
    `- ${REPLY_LINE}`,
    `- ${WORKING_LINE}`,
    `- ${SECRET_LINE}`,
  ].join("\n");
}

type Env = Record<string, string | undefined>;

export type MachineDoctorOptions = {
  fix: boolean;
  /** With --fix, repair only these checks; every check is still reported. */
  only?: ReadonlySet<string>;
  runtimes?: ReadonlySet<MachineRuntime>;
  configDir: string;
  home: string;
  env: Env;
  packageRoot: string;
  cliVersion: string;
  /** process.argv[1] of the running CLI. */
  cliEntry: string;
  execPath?: string;
  minCliVersion?: string;
  fetch?: typeof fetch;
  now?: () => Date;
  /** Latest published version, or null when it cannot be read. */
  latestVersion?: () => Promise<string | null>;
  stopReceiver?: (
    target: BackgroundListenTarget,
  ) => Promise<BackgroundListenStatus>;
  bundle?: () => BundledConnectSkill;
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

/** Find an address in the member's connection list; null when it cannot be confirmed. */
async function ownerListedStatus(
  credentials: StoredCliCredentials,
  address: string,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  let cursor: string | undefined;
  for (let page = 0; page < 10; page++) {
    const url = new URL(`${credentials.api_base_url}/agent-connections`);
    url.searchParams.set("limit", "50");
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
        return null;
      }
      const text = await response.text();
      if (text.length > 1_048_576) return null;
      const body = JSON.parse(text) as {
        success?: unknown;
        data?: unknown;
        meta?: { cursor?: unknown };
      };
      if (body.success !== true || !Array.isArray(body.data)) return null;
      for (const row of body.data as Array<Record<string, unknown>>)
        if (row?.address === address && typeof row.status === "string")
          return row.status;
      const next = body.meta?.cursor;
      if (typeof next !== "string" || !next || next === cursor) return null;
      cursor = next;
    } catch {
      return null;
    }
  }
  return null;
}

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
  const cli = currentCliLocation(options.cliEntry, env, options.execPath);
  const ephemeral = cli ? ephemeralCliReason(cli.entry) : null;
  const hookBlocked = !cli
    ? "This CLI's hook scripts were not found next to it."
    : ephemeral
      ? `This CLI runs from ${ephemeral}, which can be deleted; install it with \`npm install -g primitive\` before repairing hooks.`
      : null;
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
      const body = managedInstructions(runtime);
      const read = readManagedFile(target);
      if (read.state === "invalid")
        return check(id, "fail", read.detail, {
          path: target,
          action: "edit_file",
        });
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
      const next = upsertManagedBlock(text, managedInstructions(runtime));
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
      if (existsSync(target)) {
        // Keep the replaced copy (without installed helper packages) so a
        // local edit to the skill can be recovered.
        const backup = join(
          options.configDir,
          "machine",
          "backups",
          "skills",
          `${runtime}-${backupStamp(now())}`,
        );
        mkdirSync(backup, { recursive: true, mode: 0o700 });
        cpSync(target, backup, {
          recursive: true,
          filter: (source) => !/[\\/]node_modules(?:[\\/]|$)/.test(source),
        });
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
      return result.state === "installed" || result.state === "updated";
    },
  });

  const HOOK_CHECK_IDS: HookCheckId[] = [
    "claude.hook.session_start",
    "claude.hook.session_end",
    "claude.hook.stop",
  ];
  const repairedAhead = new Set<DoctorCheckId>();
  // Claude settings are parsed once; every hook check reads the same copy and
  // all hook repairs land in one backed-up write.
  let settingsRead = readClaudeSettings(paths.claudeDir);
  const hookContext = { cli, blocked: hookBlocked };
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
      const finding = inspectClaudeHooks(settingsRead.settings, hookContext)[
        id
      ];
      return check(id, finding.status, finding.detail, {
        fixable: finding.fixable,
        path: join(paths.claudeDir, "settings.json"),
        ...(finding.status === "fail" && !finding.fixable && hookBlocked
          ? { action: "install_cli" as const }
          : {}),
      });
    },
    repair: () => {
      if (!settingsRead.ok) return false;
      // Repair every wanted, failing hook check in one backed-up write.
      const findings = inspectClaudeHooks(settingsRead.settings, hookContext);
      const ids = HOOK_CHECK_IDS.filter(
        (hook) =>
          (hook === id || !options.only || options.only.has(hook)) &&
          findings[hook].status === "fail" &&
          findings[hook].fixable,
      );
      const repaired = repairClaudeHooks(
        settingsRead.settings,
        hookContext,
        new Set(ids),
      );
      if (!repaired.changed.size) return false;
      for (const hook of repaired.changed) repairedAhead.add(hook);
      writeClaudeSettings({
        claudeDir: paths.claudeDir,
        read: settingsRead.read,
        settings: repaired.settings,
        now,
      });
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
      const configToml = readManagedFile(join(paths.codexHome, "config.toml"));
      const finding = inspectCodexHook(
        read,
        hookContext,
        configToml.state === "present" ? configToml.text : null,
      );
      return check(id, finding.status, finding.detail, {
        fixable: finding.fixable,
        path: read.path,
        ...(finding.status === "fail" && !finding.fixable && hookBlocked
          ? { action: "install_cli" as const }
          : {}),
      });
    },
    repair: () => {
      const read = readCodexHooks(paths.codexHome);
      if (!read.ok || !cli || hookBlocked) return false;
      const repaired = repairCodexHook(read.settings, cli);
      if (!repaired.changed) return false;
      writeCodexHooks({ read: read.read, settings: repaired.settings, now });
      return true;
    },
  };

  const orphans: Array<{ name: string; profile: ConnectedAgentProfile }> = [];
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
        if (ephemeral)
          return check(
            "cli.path_stable",
            "fail",
            `This CLI runs from ${ephemeral}; hooks pointing at it would break. Install it globally with \`npm install -g primitive\`.`,
            { action: "install_cli", path: cli.entry },
          );
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
          return check(
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
        for (const name of names.slice(0, 200)) {
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
        let unconfirmed = 0;
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
            const listed =
              member &&
              member.org_id === entry.profile.org_id &&
              member.api_base_url === entry.profile.api_base_url
                ? await ownerListedStatus(
                    member,
                    entry.profile.agent_address,
                    fetchImpl,
                  )
                : null;
            if (listed === "revoked") orphans.push(entry);
            else unconfirmed++;
          } else if (entry.state === "unavailable") unknown++;
          else connected++;
        }
        if (orphans.length)
          return check(
            "profiles.orphaned",
            "fail",
            `${orphans.length} saved profiles were disconnected in Primitive: ${orphans
              .map((entry) => entry.profile.agent_address)
              .join(
                ", ",
              )}. A repair moves them aside locally; nothing changes in Primitive.`,
            { fixable: true },
          );
        if (unconfirmed || unreadable)
          return check(
            "profiles.orphaned",
            "warn",
            [
              unconfirmed
                ? `${unconfirmed} profiles' credentials were rejected but disconnection could not be confirmed`
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
      },
      repair: async () => {
        let moved = 0;
        for (const entry of orphans) {
          const directory = agentProfileDirectory(
            options.configDir,
            entry.name,
          );
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
            const stopped = await (
              options.stopReceiver ?? stopBackgroundListen
            )({
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
          const aside = join(
            agentProfilesDirectory(options.configDir),
            "orphaned",
          );
          mkdirSync(aside, { recursive: true, mode: 0o700 });
          renameSync(
            directory,
            join(aside, `${entry.name}-${backupStamp(now())}`),
          );
          moved++;
        }
        return moved > 0;
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
            result.detail = `${after.detail} (A repair was applied but did not resolve this.)`;
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
