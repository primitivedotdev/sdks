import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import {
  AddressNotesApiError,
  runAddressNotesRequest,
} from "./address-notes.js";
import { agentConnectionStatus } from "./agent-connect.js";
import { setupAgent, verificationReplySubmitted } from "./agent-setup.js";
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
import { SESSION_UUID } from "./notify-session-native.js";
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
] as const;

export const AGENT_INFO_NOTE = "AGENT_INFO";
const MAX_NAME_LENGTH = 80;
const MAX_INFO_LENGTH = 1000;
const MAIL_CHECK_WAIT_MS = 20_000;
const PENDING_AGENT_INFO_FILE = "agent-info-pending.json";

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
): { receiverMode: "native" | "external"; contactRequests: boolean } | null {
  try {
    const saved = readMailJson(
      join(agentProfileDirectory(configDir, profileName), "setup.json"),
    );
    if (!saved || typeof saved !== "object" || Array.isArray(saved))
      return null;
    const row = saved as { receiverMode?: unknown; contactRequests?: unknown };
    return {
      // Setups saved before receiver modes existed were native.
      receiverMode: row.receiverMode === "external" ? "external" : "native",
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
  session: string;
  profileName?: string;
  receiver?: "native" | "external";
  resume?: boolean;
  contactRequests?: boolean;
  name?: string;
  info?: string;
  skill?: boolean;
  project?: boolean;
  cwd?: string;
  env?: Record<string, string | undefined>;
  readInvitation(): Promise<string>;
  /** Bounded wait for the listener's first mail check. */
  mailCheckWaitMs?: number;
  dependencies?: Partial<AgentConnectFlowDependencies>;
};

export function defaultAgentProfileName(session: string): string {
  return `session-${session.toLowerCase()}`;
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
    async seedAgentInfo(profileName, value) {
      const profile = loadConnectedAgentProfile(options.configDir, profileName);
      if (!profile) return "failed";
      const client = new PrimitiveApiClient({
        apiKey: profile.api_key,
        apiBaseUrl: profile.api_base_url,
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
    },
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
  if (!SESSION_UUID.test(options.session))
    throw new AgentConnectionSetupError(
      "--session requires the exact loaded session UUID.",
    );
  const runtime = detectAgentRuntime(options.session, env);
  const profileName = agentProfileName(
    options.profileName ?? defaultAgentProfileName(options.session),
  );
  // A resumed setup keeps the receiver it was started with; only a new setup
  // takes the runtime's default.
  const receiver =
    options.receiver ??
    (options.resume
      ? (savedSetup(options.configDir, profileName)?.receiverMode ?? null)
      : null) ??
    (runtime === "claude" ? "external" : "native");
  if (
    receiver === "external" &&
    env.CLAUDE_CODE_SESSION_ID?.trim().toLowerCase() !==
      options.session.toLowerCase()
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

  const result: SetupResult = await dependencies.setupAgent({
    configDir: options.configDir,
    profileName,
    session: options.session,
    receiverMode: receiver,
    resume: options.resume,
    contactRequests: options.contactRequests,
    ...(options.resume ? {} : { invitation: await options.readInvitation() }),
  });
  const verified = verificationReplySubmitted(result.verification.state);
  const ownerMemberAddress = await dependencies.refreshOwnerMemberAddress(
    result.identity.profileName,
  );
  const identity = { ...result.identity, ownerMemberAddress };

  let externalHook: ClaudeWakeHookResult | null = null;
  if (receiver === "external") {
    if (verified)
      externalHook = dependencies.installClaudeWakeHook({
        cliPath: options.cliPath,
        configDir: options.configDir,
        profileName: result.identity.profileName,
        agentAddress: result.identity.agentAddress,
        sessionId: options.session,
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
          mode: "external" as const,
          hook: externalHook,
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
      : result.receiving.state === "healthy";
  // Every choice that changes what a resume touches is repeated, so following
  // the command never reverses a skill opt-out, a project install or the
  // receiver. Note text is never printed; a pending note is kept privately.
  const resumeCommand = [
    options.invocation ?? "primitive",
    "agent connect",
    `--profile ${result.identity.profileName}`,
    `--session ${options.session}`,
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
    sessionId: options.session,
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
