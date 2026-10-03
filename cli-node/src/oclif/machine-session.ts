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
import { installClaudeWakeHook } from "./claude-wake-install.js";
import {
  AgentConnectionSetupError,
  agentProfileDirectory,
  agentProfileName,
  agentProfilesDirectory,
  type ConnectedAgentProfile,
  loadConnectedAgentProfile,
} from "./connected-agent-profile.js";
import { acquireListenLock, ListenStateError } from "./listen-state.js";
import { SESSION_UUID } from "./notify-session-native.js";
import {
  privateMailDirectory,
  readMailJson,
  writeMailJson,
} from "./shared-mail-files.js";

export const MACHINE_RUNTIMES = ["claude", "codex", "omp"] as const;
export type MachineRuntime = (typeof MACHINE_RUNTIMES)[number];

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
  detail: string;
};

export type SessionEndResult = {
  status:
    | "disconnected"
    | "disconnect_pending"
    | "already_ended"
    | "not_managed"
    | "no_session"
    | "skipped_headless"
    | "started"
    | "failed";
  runtime: MachineRuntime;
  session: string | null;
  address: string | null;
  detail: string;
};

/** The machine's record of a session it registered. Never holds credentials. */
type SessionRecord = {
  version: 1;
  runtime: MachineRuntime;
  session: string;
  profile: string;
  name: string;
  createdBy: "session-register" | "existing";
  address: string | null;
  agentInfo: "created" | "already_present" | null;
  registeredAt: string;
  endedAt: string | null;
  /** Whether disconnecting an ended session's agent is confirmed. */
  disconnect: "done" | "pending" | "pending_enrollment" | null;
};

function sessionRecordPath(configDir: string, session: string): string {
  return join(configDir, "machine", "sessions", `${session}.json`);
}

function readSessionRecord(
  configDir: string,
  session: string,
): SessionRecord | null {
  try {
    const value = readMailJson(sessionRecordPath(configDir, session));
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const row = value as Partial<SessionRecord>;
    if (
      row.version !== 1 ||
      row.session !== session ||
      typeof row.profile !== "string" ||
      typeof row.name !== "string" ||
      !MACHINE_RUNTIMES.includes(row.runtime as MachineRuntime) ||
      (row.createdBy !== "session-register" && row.createdBy !== "existing")
    )
      return null;
    return {
      version: 1,
      runtime: row.runtime as MachineRuntime,
      session,
      profile: row.profile,
      name: row.name,
      createdBy: row.createdBy,
      address: typeof row.address === "string" ? row.address : null,
      agentInfo:
        row.agentInfo === "created" || row.agentInfo === "already_present"
          ? row.agentInfo
          : null,
      registeredAt:
        typeof row.registeredAt === "string"
          ? row.registeredAt
          : new Date(0).toISOString(),
      endedAt: typeof row.endedAt === "string" ? row.endedAt : null,
      disconnect:
        row.disconnect === "done" ||
        row.disconnect === "pending" ||
        row.disconnect === "pending_enrollment"
          ? row.disconnect
          : // Records written before this field existed ended with a disconnect.
            typeof row.endedAt === "string"
            ? "done"
            : null,
    };
  } catch {
    return null;
  }
}

function saveSessionRecord(configDir: string, row: SessionRecord): void {
  writeMailJson(sessionRecordPath(configDir, row.session), row);
}

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

type ProcessInfo = { ppid: number; started: string; command: string };

function psProcessInfo(pid: number): ProcessInfo | null {
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

const OMP_MAIN =
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

/** Serialize every read-modify-write of one session's record. */
async function withRecordLock<T>(
  configDir: string,
  session: string,
  action: () => T | Promise<T>,
): Promise<T> {
  const directory = join(configDir, "machine", "sessions");
  privateMailDirectory(directory, true);
  let release: (() => void) | undefined;
  for (let attempt = 0; attempt < 200 && !release; attempt++) {
    try {
      release = acquireListenLock(directory, `session-record-${session}`);
    } catch {
      await sleep(50);
    }
  }
  if (!release)
    throw new ListenStateError("The session record is locked by another run.");
  try {
    return await action();
  } finally {
    release();
  }
}

/** Read, change and save one record under its lock. Returns the saved record. */
function updateSessionRecord(
  configDir: string,
  session: string,
  change: (current: SessionRecord | null) => SessionRecord | null,
): Promise<SessionRecord | null> {
  return withRecordLock(configDir, session, () => {
    const current = readSessionRecord(configDir, session);
    const next = change(current);
    if (next && next !== current) saveSessionRecord(configDir, next);
    return next ?? current;
  });
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
      if (profile && !disconnectConfirmedLocally(configDir, name))
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
};

/**
 * Disconnect whatever agent a session's record points at: through its local
 * credential when present, otherwise by address with the member login.
 * "pending" means it must be retried; "pending_enrollment" means a
 * registration may still create an agent. It is never reported as done
 * without a confirmed disconnect or proof that no agent was created.
 */
type DisconnectOutcome = "done" | "pending" | "pending_enrollment";

/** Enrollment saves its state before any request, so a quiet record this old created nothing. */
const ENROLLMENT_SETTLED_MS = 10 * 60_000;

async function disconnectSessionAgent(
  configDir: string,
  record: SessionRecord,
  deps: SessionDisconnectDependencies,
  env: Env,
  fetchImpl?: typeof fetch,
  enrollmentSettled = false,
): Promise<DisconnectOutcome> {
  try {
    if (loadConnectedAgentProfile(configDir, record.profile)) {
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
    (current) =>
      !current ||
      current.disconnect === "done" ||
      current.disconnect === outcome
        ? current
        : { ...current, disconnect: outcome },
  );
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

const ENDED_DETAIL =
  "This session ended, so its agent was disconnected. A new address is never created for the same session.";
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
      now: () => new Date(),
      disconnect: disconnectAgent,
      revokeByAddress: revokeWithMemberLogin,
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
  const ended = async (current: SessionRecord, enrolledNow = false) => {
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
    return {
      ...known,
      address: current.address,
      status: "ended" as const,
      detail: outcome === "done" ? ENDED_DETAIL : ENDED_PENDING_DETAIL,
    };
  };
  const newRecord = (
    createdBy: SessionRecord["createdBy"],
    address: string | null,
  ): SessionRecord => ({
    version: 1,
    runtime,
    session: sessionId,
    profile: profileName,
    name: defaultSessionName(runtime, cwd),
    createdBy,
    address,
    agentInfo: null,
    registeredAt: deps.now().toISOString(),
    endedAt: null,
    disconnect: null,
  });
  try {
    let record = readSessionRecord(options.configDir, sessionId);
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
    const installHook = (profile: ConnectedAgentProfile): boolean =>
      runtime !== "claude" ||
      receiverMode(agentProfileDirectory(options.configDir, profileName)) !==
        "external" ||
      deps.installClaudeHook({
        cliPath: options.cliPath,
        configDir: options.configDir,
        profileName,
        agentAddress: profile.agent_address,
        sessionId,
        env: env as NodeJS.ProcessEnv,
      }) === "installed_unverified";

    const existing = loadConnectedAgentProfile(options.configDir, profileName);
    if (existing) {
      record = await updateSessionRecord(
        options.configDir,
        sessionId,
        (current) => current ?? newRecord("existing", existing.agent_address),
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
          detail: hooked
            ? "This session is already connected."
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
    if (!created) {
      try {
        created =
          loadConnectedAgentProfile(options.configDir, profileName)
            ?.agent_address ??
          enrollmentAddress(options.configDir, profileName).address;
      } catch {
        created = enrollmentAddress(options.configDir, profileName).address;
      }
    }
    record = await updateSessionRecord(
      options.configDir,
      sessionId,
      (current) =>
        current && created && current.address !== created
          ? { ...current, address: created }
          : current,
    );
    if (!record) throw new Error("session record unavailable");
    if (record.endedAt) return await ended(record, true);
    if (enrollError || !result) throw enrollError;
    const address = result.identity.agentAddress;
    const submitted = verificationReplySubmitted(result.verification.state);
    const status = result.connection.status;
    let hooked = true;
    if (runtime === "claude" && submitted && status !== "owner_inactive")
      hooked =
        deps.installClaudeHook({
          cliPath: options.cliPath,
          configDir: options.configDir,
          profileName,
          agentAddress: address,
          sessionId,
          env: env as NodeJS.ProcessEnv,
        }) === "installed_unverified";
    if (status === "connected") await finishAgentInfo();
    const withAddress = { ...known, address, receiving: RECEIVING[runtime] };
    if (status === "connected")
      return {
        ...withAddress,
        status: "registered",
        detail: hooked
          ? `Connected as ${address}.`
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
  now: () => Date;
};

/**
 * Disconnect the agent a session got from `session-register`. Agents
 * connected any other way are left alone. The end is recorded first, under
 * the record's lock, so a registration still enrolling sees it and
 * disconnects the agent it creates. Never throws.
 */
export async function endSession(options: {
  configDir: string;
  runtime: MachineRuntime;
  session?: string;
  env?: Env;
  fetch?: typeof fetch;
  dependencies?: Partial<SessionEndDependencies>;
}): Promise<SessionEndResult> {
  const env = options.env ?? process.env;
  const deps = withDefined<SessionEndDependencies>(
    {
      disconnect: disconnectAgent,
      revokeByAddress: revokeWithMemberLogin,
      now: () => new Date(),
    },
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
  try {
    let managed = false;
    let alreadyDone = false;
    const record = await updateSessionRecord(
      options.configDir,
      sessionId,
      (current) => {
        if (!current || current.createdBy !== "session-register")
          return current;
        managed = true;
        if (current.endedAt && current.disconnect === "done") {
          alreadyDone = true;
          return current;
        }
        return {
          ...current,
          endedAt: current.endedAt ?? deps.now().toISOString(),
          disconnect: "pending",
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
    const outcome = await finishSessionDisconnect(
      options.configDir,
      record,
      deps,
      env,
      options.fetch,
    );
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

/** Ended sessions whose agent disconnect still needs confirming. */
export function pendingSessionDisconnects(configDir: string): SessionRecord[] {
  const directory = join(configDir, "machine", "sessions");
  let names: string[];
  try {
    names = readdirSync(directory);
  } catch {
    return [];
  }
  return names.flatMap((name) => {
    const match = /^([0-9a-f-]{36})\.json$/.exec(name);
    if (!match?.[1]) return [];
    const record = readSessionRecord(configDir, match[1]);
    return record?.endedAt &&
      (record.disconnect === "pending" ||
        record.disconnect === "pending_enrollment")
      ? [record]
      : [];
  });
}

/** Retry every pending disconnect. Returns how many are now confirmed. */
export async function retryPendingDisconnects(
  configDir: string,
  options: {
    env?: Env;
    fetch?: typeof fetch;
    dependencies?: Partial<SessionDisconnectDependencies>;
  } = {},
): Promise<number> {
  const deps = withDefined<SessionDisconnectDependencies>(
    { disconnect: disconnectAgent, revokeByAddress: revokeWithMemberLogin },
    options.dependencies,
  );
  let done = 0;
  for (const record of pendingSessionDisconnects(configDir))
    if (
      (await finishSessionDisconnect(
        configDir,
        record,
        deps,
        options.env ?? process.env,
        options.fetch,
      )) === "done"
    )
      done++;
  return done;
}

/** Claude hook input: the only fields these hooks read. */
export type ClaudeHookInput = { sessionId: string; cwd: string | null };

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
    const value = JSON.parse(input) as { session_id?: unknown; cwd?: unknown };
    if (
      typeof value?.session_id !== "string" ||
      !SESSION_UUID.test(value.session_id)
    )
      return null;
    return {
      sessionId: value.session_id.toLowerCase(),
      cwd: typeof value.cwd === "string" && value.cwd ? value.cwd : null,
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
