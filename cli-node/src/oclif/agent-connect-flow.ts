import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import {
  AddressNotesApiError,
  runAddressNotesRequest,
} from "./address-notes.js";
import {
  agentConnectionStatus,
  parseAgentInvitation,
} from "./agent-connect.js";
import {
  externalReceivingState,
  nativeSessionPreflight,
  type ReceiverMode,
  setupAgent,
  verificationReplySubmitted,
} from "./agent-setup.js";
import {
  type ClaudeWakeHookResult,
  installClaudeWakeHook,
} from "./claude-wake-install.js";
import {
  type AgentRuntime,
  type ConnectSkillInstall,
  detectAgentRuntime,
  installConnectSkill,
  readBundledConnectSkill,
} from "./connect-skill.js";
import {
  AgentConnectionSetupError,
  agentProfileDirectory,
  agentProfileName,
  loadConnectedAgentProfile,
} from "./connected-agent-profile.js";
import { defaultSessionSocket, SESSION_UUID } from "./notify-session-native.js";
import {
  ownerReportGuidance,
  refreshOwnerMemberAddress,
} from "./owner-member-address.js";
import {
  readMailJson,
  removeMailFile,
  writeMailJson,
} from "./shared-mail-files.js";

/** What this CLI version can do in one `agent connect --session` call. */
export const AGENT_CONNECT_CAPABILITIES = [
  "invitation_claim_from_stdin",
  "verification_reply",
  "native_background_receiver",
  "claude_external_hooks",
  "bundled_skill_install",
  "agent_info_seed",
  "resume",
  "poll_receiver",
] as const;

export const AGENT_INFO_NOTE = "AGENT_INFO";
const MAX_NAME_LENGTH = 80;
const MAX_INFO_LENGTH = 1000;
const MAIL_CHECK_WAIT_MS = 20_000;
const PENDING_AGENT_INFO_FILE = "agent-info-pending.json";

/**
 * The first Codex release whose shared app-server daemon exposes the local
 * session socket that native receiving connects to.
 */
export const CODEX_NATIVE_MIN_VERSION = "0.158.0";

/** Why a defaulted native receiver became poll receiving. */
export type NativeFallbackReason =
  | "codex_version_unsupported"
  | "session_socket_missing";

/** The `major.minor.patch` triple in a `codex --version` line, if any. */
export function parseCodexVersion(text: string): string | null {
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(text);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : null;
}

/** True when this Codex version has the session socket native receiving needs. */
export function codexSupportsNativeReceiving(version: string): boolean {
  const have = version.split(".").map(Number);
  const need = CODEX_NATIVE_MIN_VERSION.split(".").map(Number);
  for (let index = 0; index < need.length; index++) {
    const a = have[index] ?? 0;
    const b = need[index] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
}

async function installedCodexVersion(): Promise<string | null> {
  try {
    const { stdout } = await promisify(execFile)("codex", ["--version"], {
      timeout: 3_000,
      maxBuffer: 4_096,
    });
    return parseCodexVersion(String(stdout));
  } catch {
    return null;
  }
}

function readPendingAgentInfo(path: string): string | null {
  try {
    const saved = readMailJson(path);
    if (
      saved &&
      typeof saved === "object" &&
      !Array.isArray(saved) &&
      (saved as { version?: unknown }).version === 1
    ) {
      const value = (saved as { value?: unknown }).value;
      if (typeof value === "string" && value.length > 0) return value;
    }
  } catch {
    /* An unreadable pending note is treated as absent. */
  }
  return null;
}

function savedSetup(
  configDir: string,
  profileName: string,
): { receiverMode: ReceiverMode; contactRequests: boolean } | null {
  try {
    const saved = readMailJson(
      join(agentProfileDirectory(configDir, profileName), "setup.json"),
    );
    if (!saved || typeof saved !== "object" || Array.isArray(saved))
      return null;
    const row = saved as { receiverMode?: unknown; contactRequests?: unknown };
    return {
      // Setups saved before receiver modes existed were native.
      receiverMode:
        row.receiverMode === "external" || row.receiverMode === "poll"
          ? row.receiverMode
          : "native",
      contactRequests: row.contactRequests === true,
    };
  } catch {
    return null;
  }
}

/** Best effort: a lost pending note only means --name/--info must be passed again. */
function savePendingAgentInfo(path: string, value: string): void {
  try {
    writeMailJson(path, { version: 1, value });
  } catch {
    /* The result still reports the note as not written. */
  }
}

function clearPendingAgentInfo(path: string): void {
  try {
    removeMailFile(path);
  } catch {
    /* Nothing was saved, or the profile directory is unavailable. */
  }
}

type SetupResult = Awaited<ReturnType<typeof setupAgent>>;

/** A condition worth telling the owner about that does not fail the connection. */
export type ConnectWarning = {
  kind: "owner_member_address_missing";
  message: string;
};

/**
 * Warns when the connection's own record says the owner has no personal
 * address in the organization. An unknown value (an older server, or a
 * failed read) warns nothing.
 */
export function connectWarnings(
  configDir: string,
  profileName: string,
): ConnectWarning[] {
  let profile: ReturnType<typeof loadConnectedAgentProfile> = null;
  try {
    profile = loadConnectedAgentProfile(configDir, profileName);
  } catch {
    return [];
  }
  return profile?.owner_member_address === null
    ? [
        {
          kind: "owner_member_address_missing",
          message:
            "Your owner has no personal address in this organization, so mail they send from their own address will not wake this agent and reports have nowhere to go. Ask them to open the Primitive app once (it sets one), or to run `primitive account provision-member-address --address <their address>` signed in as themselves.",
        },
      ]
    : [];
}

export type AgentInfoSeed =
  | "created"
  | "already_present"
  | "not_requested"
  | "pending_verification"
  | "failed";

export type MailCheck = {
  state: "confirmed" | "pending";
  lastSuccessfulMailCheckAt: string | null;
};

export type AgentConnectFlowDependencies = {
  setupAgent: typeof setupAgent;
  /** Probe the exact session for native receiving before anything is claimed. */
  nativePreflight(session: string): Promise<void>;
  /** Whether the local session socket native receiving connects to exists. */
  nativeSocketPresent(): boolean;
  /** The installed Codex version, or null when it cannot be read. */
  codexVersion(): Promise<string | null>;
  installClaudeWakeHook: typeof installClaudeWakeHook;
  installSkill(runtime: AgentRuntime): ConnectSkillInstall;
  seedAgentInfo(profileName: string, value: string): Promise<AgentInfoSeed>;
  /** A check counts only when recorded at or after `since` (epoch ms). */
  awaitMailCheck(profileName: string, since: number): Promise<MailCheck>;
  /** The owner's personal mailbox from the connection's own record. */
  refreshOwnerMemberAddress(profileName: string): Promise<string | null>;
};

export type AgentConnectFlowOptions = {
  configDir: string;
  packageRoot: string;
  cliVersion: string;
  cliPath: string;
  /** How the agent invoked this CLI, used in the resume command. */
  invocation?: string;
  /** The exact loaded session UUID. Optional only for poll receiving. */
  session?: string;
  profileName?: string;
  receiver?: ReceiverMode;
  resume?: boolean;
  contactRequests?: boolean;
  name?: string;
  info?: string;
  skill?: boolean;
  project?: boolean;
  cwd?: string;
  env?: Record<string, string | undefined>;
  readInvitation(): Promise<string>;
  /**
   * Runs once every local check has passed, immediately before the
   * invitation is claimed. Not called on --resume.
   */
  beforeSetup?: () => Promise<void>;
  /** Bounded wait for the listener's first mail check. */
  mailCheckWaitMs?: number;
  dependencies?: Partial<AgentConnectFlowDependencies>;
};

export function defaultAgentProfileName(session: string): string {
  return `session-${session.toLowerCase()}`;
}

/**
 * The profile for a setup that binds no session. It is derived from the
 * invitation, so running the same invitation again finds the same profile and
 * its saved claim instead of claiming twice. A one-way hash prefix reveals
 * nothing usable about the invitation.
 */
export function invitationProfileName(invitation: string): string {
  const parsed = parseAgentInvitation(invitation);
  const hash = createHash("sha256")
    .update(parsed.apiBaseUrl)
    .update("\0")
    .update(parsed.token)
    .digest("hex");
  return `connection-${hash.slice(0, 12)}`;
}

/** The command that checks a poll-receiving profile for new mail. */
export function pollCheckCommand(
  invocation: string,
  profileName: string,
): string {
  return `PRIMITIVE_AGENT_PROFILE=${profileName} ${invocation} agent check-mail --json`;
}

/** A short private role note; never a transcript or secret. */
export function agentInfoValue(
  name: string | undefined,
  info: string | undefined,
): string | null {
  const clean = (value: string | undefined, max: number, label: string) => {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    if (
      !trimmed ||
      trimmed.length > max ||
      [...trimmed].some((character) => {
        const code = character.charCodeAt(0);
        return (code < 32 && character !== "\n") || code === 127;
      })
    )
      throw new AgentConnectionSetupError(
        `--${label} must be 1-${max} characters without control characters.`,
      );
    return trimmed;
  };
  const cleanName = clean(name, MAX_NAME_LENGTH, "name");
  const cleanInfo = clean(info, MAX_INFO_LENGTH, "info");
  if (cleanName && cleanInfo) return `${cleanName}: ${cleanInfo}`;
  return cleanName ?? cleanInfo ?? null;
}

function defaults(
  options: AgentConnectFlowOptions,
): AgentConnectFlowDependencies {
  return {
    setupAgent,
    nativePreflight: nativeSessionPreflight,
    nativeSocketPresent: () => existsSync(defaultSessionSocket()),
    codexVersion: installedCodexVersion,
    installClaudeWakeHook,
    installSkill(runtime) {
      const bundle = readBundledConnectSkill(options.packageRoot);
      return installConnectSkill({
        bundle,
        runtime,
        project: options.project,
        cwd: options.cwd,
        env: options.env,
      });
    },
    seedAgentInfo: (profileName, value) =>
      seedAgentInfoNote(options.configDir, profileName, value),
    refreshOwnerMemberAddress: (profileName) =>
      refreshOwnerMemberAddress({ configDir: options.configDir, profileName }),
    async awaitMailCheck(profileName, since) {
      const deadline =
        Date.now() + (options.mailCheckWaitMs ?? MAIL_CHECK_WAIT_MS);
      for (;;) {
        const status = agentConnectionStatus(options.configDir, profileName);
        const at =
          status.status === "configured"
            ? status.receiving.lastSuccessfulMailCheckAt
            : null;
        // A reused receiver may hold a check from before this setup began.
        if (at && Date.parse(at) >= since)
          return { state: "confirmed", lastSuccessfulMailCheckAt: at };
        if (Date.now() >= deadline)
          return { state: "pending", lastSuccessfulMailCheckAt: null };
        await delay(250);
      }
    },
  };
}

/** Create the private AGENT_INFO note only when the address has none. */
export async function seedAgentInfoNote(
  configDir: string,
  profileName: string,
  value: string,
  fetchImpl?: typeof fetch,
): Promise<AgentInfoSeed> {
  const profile = loadConnectedAgentProfile(configDir, profileName);
  if (!profile) return "failed";
  const client = new PrimitiveApiClient({
    apiKey: profile.api_key,
    apiBaseUrl: profile.api_base_url,
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
  });
  try {
    await runAddressNotesRequest(client.client, {
      action: "set",
      address: profile.agent_address,
      name: AGENT_INFO_NOTE,
      value,
      visibility: "private",
      ifAbsent: true,
    });
    return "created";
  } catch (error) {
    if (error instanceof AddressNotesApiError && error.status === 409)
      return "already_present";
    return "failed";
  }
}

type Skip = { step: string; reason: string };

/**
 * One call: self check, install the matching skill, claim and verify, start
 * receiving, seed AGENT_INFO, and report everything as one result. Every step
 * after the claim is safe to repeat with --resume.
 */
export async function runAgentConnect(options: AgentConnectFlowOptions) {
  const env = options.env ?? process.env;
  const dependencies = {
    ...defaults(options),
    ...Object.fromEntries(
      Object.entries(options.dependencies ?? {}).filter(
        ([, value]) => value !== undefined,
      ),
    ),
  } as AgentConnectFlowDependencies;
  const session = options.session?.trim() ? options.session : undefined;
  if (session !== undefined && !SESSION_UUID.test(session))
    throw new AgentConnectionSetupError(
      "--session requires the exact loaded session UUID.",
    );
  if (session === undefined && options.receiver && options.receiver !== "poll")
    throw new AgentConnectionSetupError(
      `--receiver ${options.receiver} requires the exact loaded session UUID. Without one, use --receiver poll. No invitation was claimed.`,
    );
  if (session === undefined && options.resume && !options.profileName)
    throw new AgentConnectionSetupError(
      "Pass --profile to resume a setup that binds no session.",
    );
  const runtime = session ? detectAgentRuntime(session, env) : null;
  // Without a session, the invitation names the profile, so it is read
  // before anything else. It is still claimed only once, below.
  const invitation =
    options.resume || session || options.profileName
      ? undefined
      : await options.readInvitation();
  const profileName = agentProfileName(
    options.profileName ??
      (session
        ? defaultAgentProfileName(session)
        : invitationProfileName(invitation ?? "")),
  );
  // A resumed setup keeps the receiver it was started with; only a new setup
  // takes the runtime's default. No session means nothing can be woken, so
  // the agent checks for mail itself.
  let receiver: ReceiverMode =
    options.receiver ??
    (options.resume
      ? (savedSetup(options.configDir, profileName)?.receiverMode ?? null)
      : null) ??
    (!session ? "poll" : runtime === "claude" ? "external" : "native");
  if (
    receiver === "external" &&
    env.CLAUDE_CODE_SESSION_ID?.trim().toLowerCase() !== session?.toLowerCase()
  )
    throw new AgentConnectionSetupError(
      "External receiving requires this exact Claude session ID. No invitation was claimed.",
    );
  const agentInfo = agentInfoValue(options.name, options.info);
  const skipped: Skip[] = [];

  let skill: ConnectSkillInstall;
  if (options.skill === false) {
    skill = {
      state: "skipped",
      runtime,
      path: null,
      version: null,
      reason: "not_requested",
    };
  } else if (!runtime) {
    skill = {
      state: "skipped",
      runtime: null,
      path: null,
      version: null,
      reason: "runtime_unknown",
    };
  } else {
    try {
      skill = dependencies.installSkill(runtime);
    } catch {
      skill = {
        state: "failed",
        runtime,
        path: null,
        version: null,
        reason: "bundled_skill_unavailable",
      };
    }
  }
  if (skill.state === "skipped" || skill.state === "failed")
    skipped.push({ step: "skill", reason: skill.reason ?? skill.state });

  const startedAt = Date.now();

  const invocation = options.invocation ?? "primitive";
  // Probe native receiving before the invitation is read or claimed, and
  // before a beforeSetup hook can change state (such as disconnecting the
  // agent this one replaces). When the runtime simply has no session socket
  // to connect to, a defaulted receiver falls back to poll receiving, which
  // needs no socket; any other failure is refused with the way forward.
  let fallback: {
    reason: NativeFallbackReason;
    detail: string;
    codexVersion: string | null;
  } | null = null;
  if (receiver === "native" && session && !options.resume) {
    try {
      await dependencies.nativePreflight(session);
    } catch {
      // A present socket means the runtime supports native receiving and
      // this exact session is the problem, which poll receiving would hide.
      // Only a missing socket falls back; the version only names the cause.
      const socketPresent = dependencies.nativeSocketPresent();
      const codexVersion =
        socketPresent || runtime === "claude"
          ? null
          : await dependencies.codexVersion();
      const reason: NativeFallbackReason | null = socketPresent
        ? null
        : codexVersion !== null && !codexSupportsNativeReceiving(codexVersion)
          ? "codex_version_unsupported"
          : "session_socket_missing";
      const why =
        reason === "codex_version_unsupported"
          ? `Native receiving needs Codex ${CODEX_NATIVE_MIN_VERSION} or newer; this machine has Codex ${codexVersion}.`
          : reason === "session_socket_missing"
            ? `Native receiving needs the local Codex session socket (Codex ${CODEX_NATIVE_MIN_VERSION} or newer with its shared app-server running), and none was found${codexVersion ? ` for Codex ${codexVersion}` : ""}.`
            : `The local session socket exists but did not accept session ${session}: it may not be loaded in this terminal, or the ID may not be this session's.`;
      if (reason && options.receiver === undefined) {
        receiver = "poll";
        fallback = {
          reason,
          codexVersion,
          detail: `${why} Connected with poll receiving instead: nothing wakes this session, so check for mail with receiving.checkCommand at the start of each turn and after sending.`,
        };
      } else
        throw new AgentConnectionSetupError(
          `This exact session is not available for native receiving. ${why} No invitation was claimed and nothing was changed. To connect with poll receiving instead, pipe the same invitation to: ${invocation} agent connect --session ${session} --receiver poll --json`,
        );
    }
  }
  if (fallback)
    skipped.push({ step: "native_receiver", reason: fallback.reason });
  const setupInvitation = options.resume
    ? undefined
    : (invitation ?? (await options.readInvitation()));
  if (options.beforeSetup) await options.beforeSetup();
  const result: SetupResult = await dependencies.setupAgent({
    configDir: options.configDir,
    profileName,
    ...(session ? { session } : {}),
    receiverMode: receiver,
    resume: options.resume,
    contactRequests: options.contactRequests,
    ...(setupInvitation === undefined ? {} : { invitation: setupInvitation }),
  });
  const verified = verificationReplySubmitted(result.verification.state);
  const ownerMemberAddress = await dependencies.refreshOwnerMemberAddress(
    result.identity.profileName,
  );
  const identity = { ...result.identity, ownerMemberAddress };
  const warnings = connectWarnings(
    options.configDir,
    result.identity.profileName,
  );

  let externalHook: ClaudeWakeHookResult | null = null;
  if (receiver === "external") {
    if (verified)
      externalHook = dependencies.installClaudeWakeHook({
        cliPath: options.cliPath,
        configDir: options.configDir,
        profileName: result.identity.profileName,
        agentAddress: result.identity.agentAddress,
        sessionId: session ?? "",
        env: env as NodeJS.ProcessEnv,
      });
    else skipped.push({ step: "receiver", reason: "pending_verification" });
  }

  let mailCheck: MailCheck | null = null;
  if (receiver === "native") {
    if (result.receiving.state === "healthy") {
      mailCheck = await dependencies.awaitMailCheck(profileName, startedAt);
      if (mailCheck.state === "pending")
        skipped.push({ step: "mail_check", reason: "not_yet_observed" });
    } else
      skipped.push({
        step: "receiver",
        reason: verified ? "not_ready" : "pending_verification",
      });
  }

  // A requested note survives a paused setup privately, so the printed
  // resume command never carries its text.
  const pendingPath = join(
    agentProfileDirectory(options.configDir, profileName),
    PENDING_AGENT_INFO_FILE,
  );
  const noteValue = agentInfo ?? readPendingAgentInfo(pendingPath);
  let agentInfoState: AgentInfoSeed = "not_requested";
  if (noteValue === null)
    skipped.push({ step: "agent_info", reason: "not_requested" });
  else if (!verified) {
    agentInfoState = "pending_verification";
    savePendingAgentInfo(pendingPath, noteValue);
    skipped.push({ step: "agent_info", reason: "pending_verification" });
  } else {
    agentInfoState = await dependencies.seedAgentInfo(profileName, noteValue);
    if (agentInfoState === "failed") {
      savePendingAgentInfo(pendingPath, noteValue);
      skipped.push({ step: "agent_info", reason: "failed" });
    } else clearPendingAgentInfo(pendingPath);
    if (agentInfoState === "already_present")
      skipped.push({ step: "agent_info", reason: "already_present" });
  }

  const receiving =
    receiver === "external"
      ? {
          ...result.receiving,
          state: externalReceivingState(externalHook),
          mode: "external" as const,
          hook: externalHook,
        }
      : receiver === "poll"
        ? {
            ...result.receiving,
            mode: "poll" as const,
            // Nothing wakes this session: the agent runs this at the start of
            // each turn and after it sends, and handles what it prints.
            checkCommand: pollCheckCommand(
              invocation,
              result.identity.profileName,
            ),
            ...(fallback
              ? {
                  fallbackReason: fallback.reason,
                  fallbackDetail: fallback.detail,
                  codexVersion: fallback.codexVersion,
                }
              : {}),
          }
        : {
            ...result.receiving,
            mode: "native" as const,
            mailCheck: mailCheck?.state ?? "not_started",
            lastSuccessfulMailCheckAt:
              mailCheck?.lastSuccessfulMailCheckAt ?? null,
          };
  const receiverReady =
    receiver === "external"
      ? externalHook === "installed_unverified"
      : receiver === "poll" || result.receiving.state === "healthy";
  // Every choice that changes what a resume touches is repeated, so following
  // the command never reverses a skill opt-out, a project install or the
  // receiver. Note text is never printed; a pending note is kept privately.
  const resumeCommand = [
    invocation,
    "agent connect",
    `--profile ${result.identity.profileName}`,
    ...(session ? [`--session ${session}`] : []),
    `--receiver ${receiver}`,
    "--resume",
    // A resume reuses the saved choice, so repeat the effective one.
    ...((options.contactRequests ??
    savedSetup(options.configDir, profileName)?.contactRequests)
      ? ["--contact-requests"]
      : []),
    ...(options.skill === false ? ["--no-skill"] : []),
    ...(options.project ? ["--project"] : []),
    "--json",
  ].join(" ");
  return {
    status:
      verified && receiverReady ? ("connected" as const) : ("pending" as const),
    address: result.identity.agentAddress,
    orgId: result.identity.orgId,
    ownerAddress: result.identity.ownerAddress,
    ownerMemberAddress,
    profile: result.identity.profileName,
    sessionId: session ?? null,
    runtime,
    cli: {
      version: options.cliVersion,
      capabilities: [...AGENT_CONNECT_CAPABILITIES],
    },
    skill,
    verification: result.verification,
    receiving,
    ...(result.ownerNotifications
      ? { ownerNotifications: result.ownerNotifications }
      : {}),
    agentInfo: agentInfoState,
    skipped,
    warnings,
    selectProfile: `PRIMITIVE_AGENT_PROFILE=${result.identity.profileName}`,
    resumeCommand,
    guidance: `${result.guidance} ${ownerReportGuidance(identity)}`,
    identity,
    externalHook,
  };
}

export type AgentConnectFlowResult = Awaited<
  ReturnType<typeof runAgentConnect>
>;
