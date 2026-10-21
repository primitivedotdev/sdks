import { appendFileSync, readFileSync } from "node:fs";
import {
  AGENT_ADDRESS_ENV,
  AGENT_PROFILE_ENV,
  agentProfileName,
  loadConnectedAgentProfile,
} from "./connected-agent-profile.js";

/**
 * Claude Code gives SessionStart hooks a file in CLAUDE_ENV_FILE and runs its
 * contents before every later Bash command in the session.
 */
export const CLAUDE_ENV_FILE_ENV = "CLAUDE_ENV_FILE";

export type SessionAgentEnvOutcome =
  | "written"
  | "already_written"
  | "no_env_file"
  | "explicit_env"
  | "env_file_conflict"
  | "no_profile"
  | "failed";

// Plain addresses only, so the exported line needs no quoting in any shell.
const PLAIN_ADDRESS = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$/;
const ASSIGNS = (name: string) =>
  new RegExp(`^\\s*(?:export\\s+)?${name}=`, "m");

export function sessionAgentEnvLines(
  profileName: string,
  address: string,
): string[] {
  return [
    `export ${AGENT_PROFILE_ENV}=${profileName}`,
    `export ${AGENT_ADDRESS_ENV}=${address}`,
  ];
}

/**
 * Select a registered session's own agent for every later command in the
 * session by appending two export lines to CLAUDE_ENV_FILE. Writes only for a
 * profile that is saved and loads now, so a session is never pointed at a
 * profile that does not exist. Leaves the file alone when the session's
 * environment already sets PRIMITIVE_AGENT_PROFILE (even to the empty
 * opt-out value) or the file already assigns either variable. Never throws.
 */
export function exportSessionAgentEnv(params: {
  configDir: string;
  profileName: string;
  address: string;
  env?: Record<string, string | undefined>;
}): SessionAgentEnvOutcome {
  const env = params.env ?? process.env;
  const envFile = env[CLAUDE_ENV_FILE_ENV]?.trim();
  if (!envFile) return "no_env_file";
  if (Object.hasOwn(env, AGENT_PROFILE_ENV)) return "explicit_env";
  try {
    const profileName = agentProfileName(params.profileName);
    const profile = loadConnectedAgentProfile(params.configDir, profileName);
    if (
      !profile ||
      profile.agent_address.toLowerCase() !== params.address.toLowerCase() ||
      !PLAIN_ADDRESS.test(profile.agent_address)
    )
      return "no_profile";
    let existing = "";
    try {
      existing = readFileSync(envFile, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") return "failed";
    }
    const lines = sessionAgentEnvLines(profileName, profile.agent_address);
    const present = existing.split(/\r?\n/);
    if (lines.every((line) => present.includes(line))) return "already_written";
    if (
      ASSIGNS(AGENT_PROFILE_ENV).test(existing) ||
      ASSIGNS(AGENT_ADDRESS_ENV).test(existing)
    )
      return "env_file_conflict";
    const separator = existing && !existing.endsWith("\n") ? "\n" : "";
    appendFileSync(envFile, `${separator}${lines.join("\n")}\n`);
    return "written";
  } catch {
    return "failed";
  }
}

/** How the selected agent profile came to be selected. */
export type AgentIdentitySource = "session_hook" | "env";

/**
 * "session_hook" when the selected profile is this Claude Code session's own
 * agent and PRIMITIVE_AGENT_ADDRESS names its address, which is what the
 * SessionStart hook exports; "env" for any other PRIMITIVE_AGENT_PROFILE.
 */
export function agentIdentitySource(
  identity: { profileName: string; agentAddress: string },
  env: Record<string, string | undefined> = process.env,
): AgentIdentitySource {
  const session = env.CLAUDE_CODE_SESSION_ID?.trim().toLowerCase();
  return session &&
    identity.profileName === `session-${session}` &&
    env[AGENT_ADDRESS_ENV]?.trim().toLowerCase() ===
      identity.agentAddress.toLowerCase()
    ? "session_hook"
    : "env";
}
