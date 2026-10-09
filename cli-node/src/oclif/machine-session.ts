import { execFileSync, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { seedAgentInfoNote } from "./agent-connect-flow.js";
import { AgentDisconnectError, disconnectAgent } from "./agent-disconnect.js";
import { enrollAgent } from "./agent-enroll.js";
import { verificationReplySubmitted } from "./agent-setup.js";
import { refreshStoredCliCredentials } from "./api-client.js";
import { loadCliCredentials } from "./auth.js";
import {
  installClaudeWakeHook,
  uninstallClaudeWakeHook,
} from "./claude-wake-install.js";
import {
  AgentConnectionSetupError,
  agentProfileDirectory,
  agentProfileName,
  agentProfilesDirectory,
  type ConnectedAgentProfile,
  loadConnectedAgentProfile,
} from "./connected-agent-profile.js";
import { ListenStateError } from "./listen-state.js";
import { SESSION_UUID } from "./notify-session-native.js";
import {
  listSessionRecords,
  MACHINE_RUNTIMES,
  type MachineRuntime,
  readSessionRecord,
  releasedRecord,
  type SessionRecord,
  updateSessionRecord,
} from "./session-records.js";
import { privateMailDirectory, readMailJson } from "./shared-mail-files.js";

export { MACHINE_RUNTIMES, type MachineRuntime };

type Env = Record<string, string | undefined>;

export type SessionRegisterStatus =
  | "registered"
  | "already_registered"
  | "pending"
  | "started"
  | "ended"
  | "removed"
  | "revoked"
  | "owner_inactive"
  | "not_logged_in"
  | "no_session"
  | "skipped_headless"
  | "offline"
  | "busy"
  | "failed";

export type SessionRegisterResult = {
  status: SessionRegisterStatus;
  runtime: MachineRuntime;
  session: string | null;
  profile: string | null;
  address: string | null;
  /** How mail reaches this session: Claude hooks, Codex native receiver, or not supported. */
  receiving: "external_hook" | "native" | "unsupported" | null;
  /** The connection name, on a registration this run completed. */
  name?: string;
  /** Whether that name is still the one this command generated. */
  nameIsDefault?: boolean;
  detail: string;
};

export type SessionEndResult = {
  status:
    | "disconnected"
    | "disconnect_pending"
    | "already_ended"
    | "not_managed"
    | "resumed"
    | "left_connected"
    | "no_session"
    | "skipped_headless"
    | "started"
    | "failed";
  runtime: MachineRuntime;
  session: string | null;
  address: string | null;
  detail: string;
};

/** The repository (or directory) a session works in, for its default name. */
export function workspaceName(cwd: string): string {
  let current = resolve(cwd);
  for (let depth = 0; depth < 64; depth++) {
    if (existsSync(join(current, ".git"))) return basename(current);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return basename(resolve(cwd));
}

export function defaultSessionName(
  runtime: MachineRuntime,
  cwd: string,
): string {
  const cleaned = Array.from(`${runtime}-${workspaceName(cwd)}`)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .trim();
  return cleaned || runtime;
}

/** A short private role note. Never transcript content. */
export function agentInfoForSession(
  runtime: MachineRuntime,
  cwd: string,
): string {
  const label =
    runtime === "claude"
      ? "Claude Code"
      : runtime === "codex"
        ? "Codex"
        : "omp";
  return `${label} coding session. Repository: ${workspaceName(cwd)}. Directory: ${basename(resolve(cwd))}.`.slice(
    0,
    1000,
  );
}

export type ProcessInfo = { ppid: number; started: string; command: string };

export function psProcessInfo(pid: number): ProcessInfo | null {
  try {
    const line = execFileSync(
      "ps",
      ["-o", "ppid=,lstart=,command=", "-p", String(pid)],
      {
        encoding: "utf8",
        timeout: 2_000,
        env: { ...process.env, LC_ALL: "C" },
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();
    const match =
      /^(\d+)\s+(\w{3}\s+\w{3}\s+\d+\s+\d\d:\d\d:\d\d\s+\d{4})\s+(.*)$/.exec(
        line,
      );
    if (!match) return null;
    return {
      ppid: Number(match[1]),
      started: match[2] ?? "",
      command: match[3] ?? "",
    };
  } catch {
    return null;
  }
}

export const OMP_MAIN =
  /(?:^|[\s/\\])omp(?:\s|$)|pi-coding-agent[\\/]dist[\\/]cli\.js(?:\s|$)/;

/**
 * omp does not expose a session ID to the commands it runs. Use one generated
 * ID per running omp process, keyed by its PID and start time so a reused PID
 * never inherits another process's identity. A command reached through one of
 * omp's shared worker processes gets no ID rather than a guessed one.
 */
export function ompProcessSession(
  configDir: string,
  options: {
    startPid?: number;
    processInfo?: (pid: number) => ProcessInfo | null;
    platform?: NodeJS.Platform;
  } = {},
): string | null {
  if ((options.platform ?? process.platform) === "win32") return null;
  const info = options.processInfo ?? psProcessInfo;
  let pid = options.startPid ?? process.ppid;
  for (let hop = 0; hop < 16 && pid > 1; hop++) {
    const row = info(pid);
    if (!row) return null;
    if (row.command.includes("__omp_worker")) return null;
    if (OMP_MAIN.test(row.command)) {
      const key = createHash("sha256")
        .update(`${pid}\0${row.started}`)
        .digest("hex")
        .slice(0, 32);
      const directory = join(configDir, "machine", "omp-processes");
      const path = join(directory, `${key}.json`);
      privateMailDirectory(directory, true);
      try {
        const fd = openSync(path, "wx", 0o600);
        try {
          writeFileSync(
            fd,
            `${JSON.stringify({ version: 1, session: randomUUID() })}\n`,
          );
          fsyncSync(fd);
        } finally {
          closeSync(fd);
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") return null;
      }
      const saved = readMailJson(path) as { session?: unknown } | null;
      return typeof saved?.session === "string" &&
        SESSION_UUID.test(saved.session)
        ? saved.session
        : null;
    }
    pid = row.ppid;
  }
  return null;
}

/** The session this runtime says the command is running in. */
export function runtimeSessionId(
  runtime: MachineRuntime,
  env: Env,
  configDir: string,
  ompSession: (configDir: string) => string | null = ompProcessSession,
): string | null {
  const value =
    runtime === "claude"
      ? env.CLAUDE_CODE_SESSION_ID
      : runtime === "codex"
        ? env.CODEX_THREAD_ID?.trim() || env.CODEX_SESSION_ID
        : ompSession(configDir);
  return value?.trim() || null;
}

/**
 * Claude sets CLAUDE_CODE_ENTRYPOINT to "cli" for an interactive session and
 * to "sdk-cli" for `claude -p`; SDK hosts set "sdk-ts" or "sdk-py", and the
 * GitHub action and MCP server modes have their own values. Those runs are
 * not sessions a person works in, so they get no address. Any other or
 * missing value is treated as interactive.
 */
const HEADLESS_CLAUDE_ENTRYPOINTS = new Set([
  "sdk-cli",
  "sdk-ts",
  "sdk-py",
  "claude-code-github-action",
  "mcp",
]);

export function headlessClaudeRun(env: Env): boolean {
  return HEADLESS_CLAUDE_ENTRYPOINTS.has(
    env.CLAUDE_CODE_ENTRYPOINT?.trim() ?? "",
  );
}

const HEADLESS_DETAIL =
  "This is a non-interactive Claude run (CLAUDE_CODE_ENTRYPOINT), so no address is used for it.";

type ConnectionState =
  | "connected"
  | "pending"
  | "revoked"
  | "rejected"
  | "unavailable";

/** Read the connection's own record with its credential. */
export async function agentConnectionState(
  profile: ConnectedAgentProfile,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 5_000,
): Promise<ConnectionState> {
  try {
    const response = await fetchImpl(
      `${profile.api_base_url}/agent-connections/me`,
      {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          authorization: `Bearer ${profile.api_key}`,
          accept: "application/json",
        },
      },
    );
    if (response.status === 401 || response.status === 403) {
      await response.body?.cancel().catch(() => undefined);
      return "rejected";
    }
    if (response.status !== 200) {
      await response.body?.cancel().catch(() => undefined);
      return "unavailable";
    }
    const text = await response.text();
    if (text.length > 65_536) return "unavailable";
    const body = JSON.parse(text) as {
      success?: unknown;
      data?: { connection?: { address?: unknown; status?: unknown } };
    } | null;
    const connection = body?.data?.connection;
    if (
      body?.success !== true ||
      typeof connection?.address !== "string" ||
      connection.address.toLowerCase() !== profile.agent_address.toLowerCase()
    )
      return "unavailable";
    if (connection.status === "connected") return "connected";
    if (connection.status === "revoked") return "revoked";
    if (connection.status === "claimed" || connection.status === "pending")
      return "pending";
    return "unavailable";
  } catch {
    return "unavailable";
  }
}

function receiverMode(setupDirectory: string): "native" | "external" | null {
  try {
    const saved = readMailJson(join(setupDirectory, "setup.json")) as {
      receiverMode?: unknown;
    } | null;
    if (!saved) return null;
    return saved.receiverMode === "external" ? "external" : "native";
  } catch {
    return null;
  }
}

/** The address an interrupted enrollment saved, when there is one. */
function enrollmentAddress(
  configDir: string,
  profileName: string,
): { exists: boolean; address: string | null } {
  try {
    const state = readMailJson(
      join(
        agentProfileDirectory(configDir, profileName),
        "enrollment",
        "state.json",
      ),
      65_536,
    ) as { address?: unknown } | null;
    if (state === null) return { exists: false, address: null };
    return {
      exists: true,
      address: typeof state.address === "string" ? state.address : null,
    };
  } catch {
    return { exists: true, address: null };
  }
}

/**
 * Saved profiles, other than the session's own, whose setup says they were
 * connected for this exact session. Sorted for a stable choice.
 */
function profilesBoundToSession(
  configDir: string,
  sessionId: string,
  ownProfile: string,
  mode: "native" | "external",
): Array<{ name: string; profile: ConnectedAgentProfile }> {
  let names: string[];
  try {
    names = readdirSync(join(agentProfilesDirectory(configDir), "profiles"));
  } catch {
    return [];
  }
  const bound: Array<{ name: string; profile: ConnectedAgentProfile }> = [];
  for (const name of names.sort()) {
    if (name === ownProfile) continue;
    try {
      const setup = readMailJson(
        join(agentProfileDirectory(configDir, name), "setup.json"),
      ) as { session?: unknown; receiverMode?: unknown } | null;
      // Only a profile that receives the way this runtime's own profile
      // would is a substitute for it; a polling profile wakes nothing.
      const saved =
        setup?.receiverMode === undefined ? "native" : setup.receiverMode;
      if (
        typeof setup?.session !== "string" ||
        setup.session.toLowerCase() !== sessionId ||
        saved !== mode
      )
        continue;
      const profile = loadConnectedAgentProfile(configDir, name);
      if (profile) bound.push({ name, profile });
    } catch {
      /* An unreadable or invalid profile is never reused. */
    }
  }
  return bound;
}

/**
 * Every saved profile that still holds a credential and is bound to this
 * session: the session's own `session-<id>` profile, the profile its session
 * record names, and any profile whose setup names the session, in any
 * receiver mode. Mail to any of them wakes the session, so a second one
 * splits its mail across two addresses. Offline and read-only.
 */
export function connectedProfilesForSession(
  configDir: string,
  session: string,
  exclude?: string,
): Array<{ profile: string; address: string }> {
  const sessionId = session.trim().toLowerCase();
  if (!SESSION_UUID.test(sessionId)) return [];
  const candidates = new Set<string>([`session-${sessionId}`]);
  const record = readSessionRecord(configDir, sessionId);
  if (record) candidates.add(record.profile);
  try {
    for (const name of readdirSync(
      join(agentProfilesDirectory(configDir), "profiles"),
    ).sort()) {
      try {
        const setup = readMailJson(
          join(agentProfileDirectory(configDir, name), "setup.json"),
        ) as { session?: unknown } | null;
        if (
          typeof setup?.session === "string" &&
          setup.session.toLowerCase() === sessionId
        )
          candidates.add(name);
      } catch {
        /* An unreadable setup binds nothing. */
      }
    }
  } catch {
    /* No saved profiles. */
  }
  const bound: Array<{ profile: string; address: string }> = [];
  for (const name of [...candidates].sort()) {
    if (name === exclude) continue;
    try {
      const profile = loadConnectedAgentProfile(configDir, name);
      // A disconnect marker counts only for this credential's invitation, so
      // a profile reused for a new connection after a replacement is found.
      if (
        profile &&
        !existsSync(
          join(
            agentProfileDirectory(configDir, name),
            `disconnected-${profile.invitation_hash}.json`,
          ),
        )
      )
        bound.push({ profile: name, address: profile.agent_address });
    } catch {
      /* An invalid profile name or credential is not a connected address. */
    }
  }
  return bound;
}

/** `agent disconnect` already confirmed revocation of this profile's credential. */
function disconnectConfirmedLocally(
  configDir: string,
  profileName: string,
): boolean {
  try {
    return readdirSync(agentProfileDirectory(configDir, profileName)).some(
      (name) => /^disconnected-[a-f0-9]{64}\.json$/.test(name),
    );
  } catch {
    return false;
  }
}

/**
 * Revoke a connection by address with the saved member login, for a session
 * whose local credential is gone. True only when Primitive confirms it.
 */
export async function revokeWithMemberLogin(
  configDir: string,
  address: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const saved = loadCliCredentials(configDir);
    if (!saved) return false;
    const credentials = await refreshStoredCliCredentials({
      apiBaseUrl: saved.api_base_url,
      configDir,
      credentials: saved,
      fetch: fetchImpl,
    });
    const response = await fetchImpl(
      `${credentials.api_base_url}/agent-connections/${encodeURIComponent(address)}`,
      {
        method: "DELETE",
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
        headers: {
          authorization: `Bearer ${credentials.access_token}`,
          accept: "application/json",
        },
      },
    );
    if (response.status !== 200) {
      await response.body?.cancel().catch(() => undefined);
      return false;
    }
    const text = await response.text();
    if (text.length > 65_536) return false;
    const body = JSON.parse(text) as {
      success?: unknown;
      data?: { connection?: { address?: unknown; status?: unknown } };
    } | null;
    return (
      body?.success === true &&
      body.data?.connection?.address === address &&
      body.data.connection.status === "revoked"
    );
  } catch {
    return false;
  }
}

export type SessionDisconnectDependencies = {
  disconnect: typeof disconnectAgent;
  revokeByAddress: (
    configDir: string,
    address: string,
    fetchImpl?: typeof fetch,
  ) => Promise<boolean>;
  /** Removes one agent's exact-session Claude receive hooks. */
  uninstallHook: typeof uninstallClaudeWakeHook;
  now: () => Date;
};

const DISCONNECT_DEFAULTS: SessionDisconnectDependencies = {
  disconnect: disconnectAgent,
  revokeByAddress: revokeWithMemberLogin,
  uninstallHook: (options) => uninstallClaudeWakeHook(options),
  now: () => new Date(),
};

/**
 * Disconnect whatever agent a session's record points at: through its local
 * credential when present, otherwise by address with the member login.
 * "pending" means it must be retried; "pending_enrollment" means a
 * registration may still create an agent; "released" means the profile now
 * holds a credential the registration did not create, which is left
 * connected. It is never reported as done without a confirmed disconnect or
 * proof that no agent was created.
 */
type DisconnectOutcome = "done" | "pending" | "pending_enrollment" | "released";

/** Enrollment saves its state before any request, so a quiet record this old created nothing. */
const ENROLLMENT_SETTLED_MS = 10 * 60_000;

function sameAddress(a: string | null, b: string | null): boolean {
  return a !== null && b !== null && a.toLowerCase() === b.toLowerCase();
}

/**
 * Whether the profile's current credential is the one this registration
 * created. Another credential can sit in the same profile after `agent
 * connect` or a replacement, and that one must never be disconnected here.
 */
function holdsRegisteredCredential(
  configDir: string,
  record: SessionRecord,
  current: ConnectedAgentProfile,
): boolean {
  if (record.invitationHash)
    return (
      record.invitationHash === current.invitation_hash &&
      (record.address === null ||
        sameAddress(record.address, current.agent_address))
    );
  if (record.address) return sameAddress(record.address, current.agent_address);
  // No address recorded yet: only this registration's own enrollment counts.
  return sameAddress(
    enrollmentAddress(configDir, record.profile).address,
    current.agent_address,
  );
}

/** A saved revocation confirmation in the profile names this address. */
function addressRevokedLocally(
  configDir: string,
  profileName: string,
  address: string,
): boolean {
  try {
    const directory = agentProfileDirectory(configDir, profileName);
    return readdirSync(directory).some((name) => {
      if (!/^disconnected-[a-f0-9]{64}\.json$/.test(name)) return false;
      try {
        const row = readMailJson(join(directory, name)) as {
          address?: unknown;
        } | null;
        return (
          typeof row?.address === "string" && sameAddress(row.address, address)
        );
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

/**
 * The profile holds another credential now. Leave it connected; remove only
 * the registered agent's own exact-session hooks (they are keyed by its
 * address, so the current agent's hooks are untouched), and revoke the
 * registered agent by address if nothing confirms it is already revoked.
 */
async function cleanUpReplacedRegistration(
  configDir: string,
  record: SessionRecord,
  deps: SessionDisconnectDependencies,
  env: Env,
  fetchImpl?: typeof fetch,
): Promise<void> {
  const address = record.address;
  if (!address) return;
  if (record.runtime === "claude")
    try {
      deps.uninstallHook({
        configDir,
        profileName: record.profile,
        agentAddress: address,
        sessionId: record.session,
        env: env as NodeJS.ProcessEnv,
      });
    } catch {
      /* Hook cleanup never blocks the end. */
    }
  if (addressRevokedLocally(configDir, record.profile, address)) return;
  try {
    await deps.revokeByAddress(configDir, address, fetchImpl);
  } catch {
    /* Best effort: the registered credential is no longer on this machine. */
  }
}

async function disconnectSessionAgent(
  configDir: string,
  record: SessionRecord,
  deps: SessionDisconnectDependencies,
  env: Env,
  fetchImpl?: typeof fetch,
  enrollmentSettled = false,
): Promise<DisconnectOutcome> {
  try {
    const current = loadConnectedAgentProfile(configDir, record.profile);
    if (current) {
      if (!holdsRegisteredCredential(configDir, record, current)) {
        await cleanUpReplacedRegistration(
          configDir,
          record,
          deps,
          env,
          fetchImpl,
        );
        return "released";
      }
      await deps.disconnect({
        configDir,
        profileName: record.profile,
        fetch: fetchImpl,
        env: env as NodeJS.ProcessEnv,
      });
      return "done";
    }
    if (disconnectConfirmedLocally(configDir, record.profile)) return "done";
    const enrollment = enrollmentAddress(configDir, record.profile);
    const address = record.address ?? enrollment.address;
    if (!address) {
      if (enrollment.exists) return "pending";
      // No enrollment state: either nothing was ever requested, or a
      // registration has not reached its first request yet.
      const settled =
        enrollmentSettled ||
        Date.now() - Date.parse(record.registeredAt) > ENROLLMENT_SETTLED_MS;
      return settled ? "done" : "pending_enrollment";
    }
    return (await deps.revokeByAddress(configDir, address, fetchImpl))
      ? "done"
      : "pending";
  } catch {
    return "pending";
  }
}

async function finishSessionDisconnect(
  configDir: string,
  record: SessionRecord,
  deps: SessionDisconnectDependencies,
  env: Env,
  fetchImpl?: typeof fetch,
  enrollmentSettled = false,
): Promise<DisconnectOutcome> {
  const outcome = await disconnectSessionAgent(
    configDir,
    record,
    deps,
    env,
    fetchImpl,
    enrollmentSettled,
  );
  // Compare-and-set: a concurrent attempt may already have confirmed the
  // disconnect, and "done" is never replaced by a weaker result.
  const saved = await updateSessionRecord(
    configDir,
    record.session,
    (current) => {
      if (
        current?.createdBy !== "session-register" ||
        current.disconnect === "done"
      )
        return current;
      if (outcome === "released")
        return releasedRecord(current, "credential_changed", deps.now());
      return current.disconnect === outcome
        ? current
        : { ...current, disconnect: outcome };
    },
  );
  if (saved?.createdBy === "existing" && outcome === "released")
    return "released";
  return saved?.disconnect === "done" ? "done" : outcome;
}

export type SessionRegisterDependencies = SessionDisconnectDependencies & {
  enroll: typeof enrollAgent;
  installClaudeHook: typeof installClaudeWakeHook;
  seedAgentInfo: (
    configDir: string,
    profileName: string,
    value: string,
  ) => Promise<"created" | "already_present" | "failed" | string>;
  connectionState: (profile: ConnectedAgentProfile) => Promise<ConnectionState>;
  ompSession: (configDir: string) => string | null;
  now: () => Date;
};

export type SessionRegisterOptions = {
  configDir: string;
  runtime: MachineRuntime;
  session?: string;
  cwd?: string;
  env?: Env;
  /** Real path of the running CLI, written into Claude receive hooks. */
  cliPath: string;
  /**
   * The session ID came from the runtime itself (Claude hook input), so it is
   * the exact loaded session even though the hook's environment lacks it.
   */
  trustedSession?: boolean;
  fetch?: typeof fetch;
  dependencies?: Partial<SessionRegisterDependencies>;
};

const RECEIVING: Record<MachineRuntime, SessionRegisterResult["receiving"]> = {
  claude: "external_hook",
  codex: "native",
  omp: "unsupported",
};

function withDefined<T extends object>(
  defaults: T,
  overrides: Partial<T> | undefined,
): T {
  return {
    ...defaults,
    ...Object.fromEntries(
      Object.entries(overrides ?? {}).filter(
        ([, value]) => value !== undefined,
      ),
    ),
  } as T;
}

const HELD_DETAIL =
  "This session already receives as another connected profile, so this profile's receive hooks were not added. Run `primitive machine doctor --fix --profile <profile>` to bind it deliberately.";
const ENDED_DETAIL =
  "This session ended, so its agent was disconnected. A new address is never created for the same session.";
const ENDED_DEFERRED_DETAIL =
  "This session ended moments ago. Its agent is disconnected after a short wait unless the session starts again first.";
const RELEASED_DETAIL =
  "This session's profile now holds an agent connected some other way, so it was left connected.";
const ENDED_PENDING_DETAIL =
  "This session ended, but disconnecting its agent has not been confirmed yet; `primitive machine doctor --fix` retries it.";

/**
 * Give this session an address once. Safe to run on every start and resume:
 * a session already bound to a profile is only re-verified, and a session
 * whose agent was disconnected or removed is never given a second address.
 * Never throws; every failure is a status.
 */
export async function registerSession(
  options: SessionRegisterOptions,
): Promise<SessionRegisterResult> {
  const env = options.env ?? process.env;
  const deps = withDefined<SessionRegisterDependencies>(
    {
      enroll: enrollAgent,
      installClaudeHook: installClaudeWakeHook,
      seedAgentInfo: (configDir, profileName, value) =>
        seedAgentInfoNote(configDir, profileName, value, options.fetch),
      connectionState: (profile) =>
        agentConnectionState(profile, options.fetch),
      ompSession: ompProcessSession,
      ...DISCONNECT_DEFAULTS,
    },
    options.dependencies,
  );
  const runtime = options.runtime;
  const base = {
    runtime,
    session: null,
    profile: null,
    address: null,
    receiving: null,
  } as const;
  if (runtime === "claude" && headlessClaudeRun(env))
    return { ...base, status: "skipped_headless", detail: HEADLESS_DETAIL };
  let session: string | null;
  try {
    session =
      options.session?.trim() ||
      runtimeSessionId(runtime, env, options.configDir, deps.ompSession);
  } catch {
    session = null;
  }
  if (!session)
    return {
      ...base,
      status: "no_session",
      detail:
        runtime === "omp"
          ? "omp does not expose a session ID to commands, and no running omp process was found. Pass --session."
          : `No ${runtime === "claude" ? "CLAUDE_CODE_SESSION_ID" : "CODEX_THREAD_ID"} in this environment. Pass --session.`,
    };
  if (!SESSION_UUID.test(session))
    return {
      ...base,
      status: "failed",
      detail: "The session ID is not a UUID. Nothing was changed.",
    };
  const sessionId = session.toLowerCase();
  const ownProfile = `session-${sessionId}`;
  let profileName = ownProfile;
  // A profile already connected for this session (for example by `agent
  // connect`) is reused, so the session never gets a second address.
  try {
    const saved = readSessionRecord(options.configDir, sessionId);
    if (saved?.createdBy === "existing" && saved.profile !== ownProfile)
      profileName = agentProfileName(saved.profile);
    else if (
      !saved &&
      !loadConnectedAgentProfile(options.configDir, ownProfile) &&
      !enrollmentAddress(options.configDir, ownProfile).exists
    ) {
      let offline = false;
      for (const candidate of profilesBoundToSession(
        options.configDir,
        sessionId,
        ownProfile,
        runtime === "codex" ? "native" : "external",
      )) {
        const state = await deps.connectionState(candidate.profile);
        if (state === "connected") {
          profileName = candidate.name;
          offline = false;
          break;
        }
        if (state === "unavailable") offline = true;
      }
      if (offline)
        return {
          ...base,
          session: sessionId,
          receiving: RECEIVING[runtime],
          status: "offline",
          detail:
            "A saved profile is connected for this session, but its status could not be checked right now. No new address was created.",
        };
    }
  } catch {
    profileName = ownProfile;
  }
  const reused = profileName !== ownProfile;
  const known = { ...base, session: sessionId, profile: profileName };
  const cwd = resolve(options.cwd ?? process.cwd());
  const ended = async (
    current: SessionRecord,
    enrolledNow = false,
  ): Promise<SessionRegisterResult> => {
    // A hook's end waits out its grace period in its own process, which
    // also disconnects whatever this run's enrollment created.
    if (current.disconnect === "deferred")
      return {
        ...known,
        address: current.address,
        status: "ended",
        detail: ENDED_DEFERRED_DETAIL,
      };
    // After this run's own enrollment returned or failed, whatever it
    // created is disconnected, even if the end found nothing earlier.
    const outcome =
      current.disconnect === "done" && !enrolledNow
        ? "done"
        : await finishSessionDisconnect(
            options.configDir,
            current,
            deps,
            env,
            options.fetch,
            enrolledNow,
          );
    if (outcome === "released")
      return {
        ...known,
        status: "already_registered",
        detail: RELEASED_DETAIL,
      };
    return {
      ...known,
      address: current.address,
      status: "ended",
      detail: outcome === "done" ? ENDED_DETAIL : ENDED_PENDING_DETAIL,
    };
  };
  const newRecord = (
    createdBy: SessionRecord["createdBy"],
    address: string | null,
    invitationHash: string | null = null,
  ): SessionRecord => ({
    version: 1,
    runtime,
    session: sessionId,
    profile: profileName,
    name: defaultSessionName(runtime, cwd),
    createdBy,
    address,
    invitationHash,
    agentInfo: null,
    registeredAt: deps.now().toISOString(),
    endedAt: null,
    disconnect: null,
    deferredUntil: null,
    endReason: null,
    release: null,
  });
  try {
    // A start (or resume) while a hook's end is still waiting means the
    // session did not end after all, for example a restart: cancel it.
    let record = await updateSessionRecord(
      options.configDir,
      sessionId,
      (current) =>
        current?.endedAt && current.disconnect === "deferred"
          ? {
              ...current,
              endedAt: null,
              disconnect: null,
              deferredUntil: null,
              endReason: null,
            }
          : current,
    );
    if (record?.endedAt) return await ended(record);
    const finishAgentInfo = async () => {
      // A reused profile's notes belong to whoever connected it.
      if (reused || record?.agentInfo) return;
      const seeded = await deps.seedAgentInfo(
        options.configDir,
        profileName,
        agentInfoForSession(runtime, cwd),
      );
      if (seeded !== "created" && seeded !== "already_present") return;
      record = await updateSessionRecord(
        options.configDir,
        sessionId,
        (current) => (current ? { ...current, agentInfo: seeded } : current),
      );
    };
    // Runs on every start and resume without anyone naming the profile, so
    // it never binds this profile beside another one the session already
    // receives as (the owner may have removed these hooks on purpose).
    type HookOutcome = "installed" | "held" | "failed";
    const claudeHook = (agentAddress: string): HookOutcome => {
      const outcome = deps.installClaudeHook({
        cliPath: options.cliPath,
        configDir: options.configDir,
        profileName,
        agentAddress,
        sessionId,
        env: env as NodeJS.ProcessEnv,
        yieldToOtherProfiles: true,
      });
      return outcome === "installed_unverified"
        ? "installed"
        : outcome === "held_for_other_profile"
          ? "held"
          : "failed";
    };
    const installHook = (profile: ConnectedAgentProfile): HookOutcome =>
      runtime !== "claude" ||
      receiverMode(agentProfileDirectory(options.configDir, profileName)) !==
        "external"
        ? "installed"
        : claudeHook(profile.agent_address);

    const existing = loadConnectedAgentProfile(options.configDir, profileName);
    if (existing) {
      record = await updateSessionRecord(
        options.configDir,
        sessionId,
        (current) =>
          current ??
          newRecord(
            "existing",
            existing.agent_address,
            existing.invitation_hash,
          ),
      );
      if (!record) throw new Error("session record unavailable");
      if (record.endedAt) return await ended(record);
      const state = await deps.connectionState(existing);
      const withAddress = { ...known, address: existing.agent_address };
      if (state === "revoked" || state === "rejected")
        return {
          ...withAddress,
          status: "revoked",
          detail:
            "This session's agent was disconnected in Primitive. No new address was created. `primitive machine doctor --fix` removes the stale local profile.",
        };
      if (state === "unavailable")
        return {
          ...withAddress,
          receiving: RECEIVING[runtime],
          status: "offline",
          detail:
            "This session already has an address; its status could not be checked right now.",
        };
      if (state === "pending" && record.createdBy !== "session-register")
        return {
          ...withAddress,
          status: "pending",
          detail:
            "This session's agent is waiting for pairing confirmation. Finish it with the command that started it.",
        };
      if (state === "connected") {
        const hooked = installHook(existing);
        await finishAgentInfo();
        return {
          ...withAddress,
          receiving: RECEIVING[runtime],
          status: "already_registered",
          detail:
            hooked === "installed"
              ? "This session is already connected."
              : hooked === "held"
                ? HELD_DETAIL
                : "This session is already connected, but its receive hook could not be installed. Run `primitive machine doctor`.",
        };
      }
      // A pending enrollment this command started resumes below.
    } else if (
      (record?.address &&
        record.createdBy === "session-register" &&
        !enrollmentAddress(options.configDir, profileName).exists) ||
      record?.createdBy === "existing"
    )
      return {
        ...known,
        address: record.address,
        status: "removed",
        detail:
          "This session's local profile was removed. No new address was created for the same session.",
      };

    let credentials: ReturnType<typeof loadCliCredentials>;
    try {
      credentials = loadCliCredentials(options.configDir);
    } catch {
      credentials = null;
    }
    if (!credentials)
      return {
        ...known,
        status: "not_logged_in",
        detail:
          "No saved member login on this machine. Run `primitive signin`, then start the session again.",
      };
    // Recorded before enrollment so an interrupted run resumes with the same
    // name, and so a SessionEnd that arrives meanwhile can mark it ended.
    record = await updateSessionRecord(
      options.configDir,
      sessionId,
      (current) => current ?? newRecord("session-register", null),
    );
    if (!record) throw new Error("session record unavailable");
    if (record.endedAt) return await ended(record);
    const enrollEnv: NodeJS.ProcessEnv = { ...env };
    // Enrollment uses only the saved member login; per-shell overrides would
    // otherwise make it refuse on every session start.
    delete enrollEnv.PRIMITIVE_AGENT_PROFILE;
    delete enrollEnv.PRIMITIVE_API_KEY;
    delete enrollEnv.PRIMITIVE_KEY;
    if (runtime === "claude" && options.trustedSession)
      enrollEnv.CLAUDE_CODE_SESSION_ID = sessionId;
    let result: Awaited<ReturnType<typeof deps.enroll>> | null = null;
    let enrollError: unknown = null;
    try {
      result = await deps.enroll({
        configDir: options.configDir,
        session: sessionId,
        name: record.name,
        receiverMode: runtime === "codex" ? "native" : "external",
        contactRequests: false,
        env: enrollEnv,
        fetch: options.fetch,
        // omp has no receiver this CLI can drive, so there is nothing to probe.
        ...(runtime === "omp" ? { preflight: async () => undefined } : {}),
      });
    } catch (error) {
      // Another run holds this session's enrollment; it finishes the job.
      if (error instanceof ListenStateError) throw error;
      enrollError = error;
    }
    // Whatever the outcome, an agent enrollment created is recorded first,
    // under the lock. The session may have ended meanwhile: its end marker is
    // kept and that agent is disconnected.
    let created: string | null = result?.identity.agentAddress ?? null;
    let saved: ConnectedAgentProfile | null = null;
    try {
      saved = loadConnectedAgentProfile(options.configDir, profileName);
    } catch {
      saved = null;
    }
    created ??=
      saved?.agent_address ??
      enrollmentAddress(options.configDir, profileName).address;
    // The credential's invitation hash identifies exactly what this
    // registration created, so a session end can tell it from a credential
    // connected into the same profile later.
    const createdHash =
      saved && created && sameAddress(saved.agent_address, created)
        ? saved.invitation_hash
        : null;
    record = await updateSessionRecord(
      options.configDir,
      sessionId,
      (current) =>
        current &&
        current.createdBy === "session-register" &&
        created &&
        (current.address !== created ||
          (createdHash !== null && current.invitationHash !== createdHash))
          ? {
              ...current,
              address: created,
              invitationHash: createdHash ?? current.invitationHash,
            }
          : current,
    );
    if (!record) throw new Error("session record unavailable");
    if (record.endedAt) return await ended(record, true);
    if (enrollError || !result) throw enrollError;
    const address = result.identity.agentAddress;
    const submitted = verificationReplySubmitted(result.verification.state);
    const status = result.connection.status;
    let hooked: HookOutcome = "installed";
    if (runtime === "claude" && submitted && status !== "owner_inactive")
      hooked = claudeHook(address);
    if (status === "connected") await finishAgentInfo();
    const withAddress = { ...known, address, receiving: RECEIVING[runtime] };
    // Every name this command records is generated, so the connection still
    // has a default name unless it was renamed while setup was pending.
    const name = result.name ?? record.name;
    if (status === "connected")
      return {
        ...withAddress,
        status: "registered",
        name,
        nameIsDefault: name === record.name,
        detail:
          hooked === "installed"
            ? `Connected as ${address}.`
            : hooked === "held"
              ? `Connected as ${address}. ${HELD_DETAIL}`
              : `Connected as ${address}, but the receive hook could not be installed. Run \`primitive machine doctor\`.`,
      };
    if (status === "revoked" || status === "owner_inactive")
      return {
        ...withAddress,
        status,
        detail:
          status === "revoked"
            ? "The new agent was disconnected in Primitive before setup finished."
            : "The member who owns this login is no longer active in the organization.",
      };
    return {
      ...withAddress,
      status: "pending",
      detail:
        "The address exists and pairing is not confirmed yet. The next session start resumes it; no second address is created.",
    };
  } catch (error) {
    if (error instanceof ListenStateError)
      return {
        ...known,
        status: "busy",
        detail: "Another registration for this session is already running.",
      };
    return {
      ...known,
      status: "failed",
      detail:
        error instanceof AgentConnectionSetupError
          ? error.message
          : "Registration stopped before finishing. The session continues normally; the next start resumes it.",
    };
  }
}

export type SessionEndDependencies = SessionDisconnectDependencies & {
  /** Waits out a deferred end's grace period. */
  sleep: (milliseconds: number) => Promise<unknown>;
};

/**
 * How long an end from a runtime hook waits before disconnecting. A runtime
 * reports the same end for a restart, a switch to another session and a real
 * exit, so the hook cannot tell them apart; a start of the same session
 * within this window cancels the end and keeps its agent.
 */
export const HOOK_END_GRACE_MS = 5 * 60_000;

/** The end of this record is a hook's, still waiting. */
function deferredEnd(record: SessionRecord | null): boolean {
  return Boolean(record?.endedAt) && record?.disconnect === "deferred";
}

/**
 * Disconnect the agent a session got from `session-register`. Agents
 * connected any other way are left alone, including a credential connected
 * later into the same profile. The end is recorded first, under the record's
 * lock, so a registration still enrolling sees it and disconnects the agent
 * it creates. With `graceMs` (an end reported by a runtime hook) the
 * disconnect waits that long, and a start of the same session meanwhile
 * cancels it. Never throws.
 */
export async function endSession(options: {
  configDir: string;
  runtime: MachineRuntime;
  session?: string;
  env?: Env;
  fetch?: typeof fetch;
  graceMs?: number;
  reason?: string | null;
  dependencies?: Partial<SessionEndDependencies>;
}): Promise<SessionEndResult> {
  const env = options.env ?? process.env;
  const deps = withDefined<SessionEndDependencies>(
    { ...DISCONNECT_DEFAULTS, sleep: (milliseconds) => sleep(milliseconds) },
    options.dependencies,
  );
  const runtime = options.runtime;
  const base = { runtime, session: null, address: null };
  if (runtime === "claude" && headlessClaudeRun(env))
    return { ...base, status: "skipped_headless", detail: HEADLESS_DETAIL };
  let session: string | null;
  try {
    session =
      options.session?.trim() ||
      runtimeSessionId(runtime, env, options.configDir, () => null);
  } catch {
    session = null;
  }
  if (!session || !SESSION_UUID.test(session))
    return {
      ...base,
      status: "no_session",
      detail: "No session ID was given or found. Nothing was changed.",
    };
  const sessionId = session.toLowerCase();
  const graceMs = Math.max(0, options.graceMs ?? 0);
  const reason =
    options.reason && /^[a-z_]{1,40}$/.test(options.reason)
      ? options.reason
      : null;
  try {
    let managed = false;
    let alreadyDone = false;
    let deferred = false;
    let record = await updateSessionRecord(
      options.configDir,
      sessionId,
      (current) => {
        if (current?.createdBy !== "session-register") return current;
        managed = true;
        if (current.endedAt && current.disconnect === "done") {
          alreadyDone = true;
          return current;
        }
        const now = deps.now();
        // A committed end is never turned back into a waiting one.
        if (graceMs > 0 && (!current.endedAt || deferredEnd(current))) {
          deferred = true;
          return {
            ...current,
            endedAt: now.toISOString(),
            disconnect: "deferred",
            deferredUntil: new Date(now.getTime() + graceMs).toISOString(),
            endReason: reason,
          };
        }
        return {
          ...current,
          endedAt: current.endedAt ?? now.toISOString(),
          disconnect:
            current.disconnect === "pending_enrollment"
              ? "pending_enrollment"
              : "pending",
          deferredUntil: null,
          endReason: current.endReason ?? reason,
        };
      },
    );
    const known = {
      ...base,
      session: sessionId,
      address: record?.address ?? null,
    };
    if (!record || !managed)
      return {
        ...known,
        status: "not_managed",
        detail:
          "This session's agent was not created by `agent session-register`, so it was left connected.",
      };
    if (alreadyDone)
      return {
        ...known,
        status: "already_ended",
        detail: "This session's agent was already disconnected.",
      };
    if (deferred) {
      const marked = record.endedAt;
      await deps.sleep(graceMs);
      let resumed = false;
      record = await updateSessionRecord(
        options.configDir,
        sessionId,
        (current) => {
          if (
            current?.createdBy !== "session-register" ||
            current.endedAt !== marked ||
            current.disconnect !== "deferred"
          ) {
            resumed = true;
            return current;
          }
          return { ...current, disconnect: "pending", deferredUntil: null };
        },
      );
      if (resumed || !record)
        return {
          ...known,
          status: "resumed",
          detail:
            "The session started again (or was ended again) before its end took effect, so this end left its agent connected.",
        };
    }
    const outcome = await finishSessionDisconnect(
      options.configDir,
      record,
      deps,
      env,
      options.fetch,
    );
    if (outcome === "released")
      return {
        ...known,
        status: "left_connected",
        detail:
          "This session's profile now holds an agent that `agent session-register` did not create, so it was left connected. Only the registered agent's own receive hooks were removed.",
      };
    return outcome === "done"
      ? {
          ...known,
          status: "disconnected",
          detail: "This session's agent was disconnected.",
        }
      : {
          ...known,
          status: "disconnect_pending",
          detail:
            "The session is marked ended, but disconnecting its agent is not confirmed yet. The next `primitive machine doctor --fix` (or a registration still finishing) retries it.",
        };
  } catch (error) {
    return {
      ...base,
      session: sessionId,
      status: "failed",
      detail:
        error instanceof AgentDisconnectError
          ? error.message
          : "Disconnect did not finish. The agent was left as it was.",
    };
  }
}

/**
 * Ended sessions whose agent disconnect still needs confirming, including a
 * hook's end whose grace period is over but whose own process never finished
 * it (for example because the machine shut down).
 */
export function pendingSessionDisconnects(
  configDir: string,
  now: Date = new Date(),
): SessionRecord[] {
  return listSessionRecords(configDir).filter(
    (record) =>
      record.createdBy === "session-register" &&
      record.endedAt &&
      (record.disconnect === "pending" ||
        record.disconnect === "pending_enrollment" ||
        (record.disconnect === "deferred" &&
          !(Date.parse(record.deferredUntil ?? "") > now.getTime()))),
  );
}

/**
 * Retry every pending disconnect. Each goes through the same credential check
 * as a session end, so a profile reconnected some other way is left connected
 * (and counts as resolved). Returns how many are now resolved.
 */
export async function retryPendingDisconnects(
  configDir: string,
  options: {
    env?: Env;
    fetch?: typeof fetch;
    dependencies?: Partial<SessionDisconnectDependencies>;
  } = {},
): Promise<number> {
  const deps = withDefined<SessionDisconnectDependencies>(
    DISCONNECT_DEFAULTS,
    options.dependencies,
  );
  let done = 0;
  for (const listed of pendingSessionDisconnects(configDir, deps.now())) {
    let record: SessionRecord | null = listed;
    if (listed.disconnect === "deferred") {
      // Commit the overdue end only if nothing restarted the session since.
      let changed = false;
      record = await updateSessionRecord(
        configDir,
        listed.session,
        (current) => {
          if (
            !current ||
            current.endedAt !== listed.endedAt ||
            current.disconnect !== "deferred"
          ) {
            changed = true;
            return current;
          }
          return { ...current, disconnect: "pending", deferredUntil: null };
        },
      );
      if (changed || !record) continue;
    }
    const outcome = await finishSessionDisconnect(
      configDir,
      record,
      deps,
      options.env ?? process.env,
      options.fetch,
    );
    if (outcome === "done" || outcome === "released") done++;
  }
  return done;
}

/** Claude hook input: the only fields these hooks read. */
export type ClaudeHookInput = {
  sessionId: string;
  cwd: string | null;
  /** SessionEnd's reason, such as "clear", "resume", "logout" or "other". */
  reason: string | null;
};

/** Read Claude's hook JSON from stdin within a short budget. */
export async function readClaudeHookInput(
  stdin: NodeJS.ReadableStream,
  timeoutMs = 2_000,
): Promise<ClaudeHookInput | null> {
  let input = "";
  const read = (async () => {
    for await (const chunk of stdin) {
      input += String(chunk);
      if (input.length > 65_536) return false;
    }
    return true;
  })().catch(() => false);
  let timer: NodeJS.Timeout | undefined;
  const complete = await Promise.race([
    read,
    new Promise<boolean>((done) => {
      timer = setTimeout(() => done(false), timeoutMs);
      timer.unref();
    }),
  ]);
  if (timer) clearTimeout(timer);
  if (!complete) return null;
  try {
    const value = JSON.parse(input) as {
      session_id?: unknown;
      cwd?: unknown;
      reason?: unknown;
    };
    if (
      typeof value?.session_id !== "string" ||
      !SESSION_UUID.test(value.session_id)
    )
      return null;
    return {
      sessionId: value.session_id.toLowerCase(),
      cwd: typeof value.cwd === "string" && value.cwd ? value.cwd : null,
      reason:
        typeof value.reason === "string" && /^[a-z_]{1,40}$/.test(value.reason)
          ? value.reason
          : null,
    };
  } catch {
    return null;
  }
}

/**
 * Run the real work in a detached process so a hook never holds up the
 * session; wait for it only up to the budget.
 */
export async function runDetached(params: {
  node: string;
  entry: string;
  args: string[];
  env: NodeJS.ProcessEnv;
  cwd?: string;
  waitMs: number;
}): Promise<"finished" | "detached" | "failed"> {
  try {
    const child = spawn(params.node, [params.entry, ...params.args], {
      detached: true,
      stdio: "ignore",
      env: params.env,
      ...(params.cwd && existsSync(params.cwd) ? { cwd: params.cwd } : {}),
    });
    child.unref();
    return await new Promise((done) => {
      // This timer, not the unreferenced child, keeps the hook alive until
      // the budget runs out.
      const timer = setTimeout(() => done("detached"), params.waitMs);
      child.once("error", () => {
        clearTimeout(timer);
        done("failed");
      });
      child.once("exit", () => {
        clearTimeout(timer);
        done("finished");
      });
    });
  } catch {
    return "failed";
  }
}
