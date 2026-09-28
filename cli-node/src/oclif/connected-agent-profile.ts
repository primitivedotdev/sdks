import { join } from "node:path";
import {
  mailAddress,
  mailId,
  mailObject,
  mailString,
  mailTime,
  privateMailDirectory,
  readMailJson,
  writeMailJson,
} from "./shared-mail-files.js";

export const AGENT_PROFILE_ENV = "PRIMITIVE_AGENT_PROFILE";
export type ConnectedAgentIdentity = {
  profileName: string;
  orgId: string;
  agentAddress: string;
  ownerAddress: string;
  apiBaseUrl: string;
};
export type ConnectedAgentProfile = {
  version: 1;
  auth_method: "agent_connection";
  api_key: string;
  api_base_url: string;
  org_id: string;
  agent_address: string;
  owner_address: string;
  invitation_hash: string;
  created_at: string;
};

export class AgentConnectionSetupError extends Error {}

export function requireDefaultLoginProfile(): void {
  if (process.env[AGENT_PROFILE_ENV]?.trim()) {
    throw new AgentConnectionSetupError(
      "This command manages the default OAuth login. Unset PRIMITIVE_AGENT_PROFILE before using it; the connected-agent profile is unchanged.",
    );
  }
}

export function agentProfileName(value: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/.test(value)) {
    throw new AgentConnectionSetupError(
      "Agent profile must start with a letter or number and contain only letters, numbers, dots, underscores or hyphens (at most 63 characters).",
    );
  }
  return value;
}

export function connectedApiBaseUrl(value: unknown): string {
  if (
    value !== "https://api.primitive.dev/v1" &&
    value !== "https://api.primitive-staging-1.com/v1"
  ) {
    throw new AgentConnectionSetupError(
      "Agent setup requires an official Primitive API origin.",
    );
  }
  return value;
}

export function agentProfilesDirectory(configDir: string): string {
  return join(configDir, "agent-connections");
}

export function agentProfileDirectory(
  configDir: string,
  profileName: string,
): string {
  return join(
    agentProfilesDirectory(configDir),
    "profiles",
    agentProfileName(profileName),
  );
}

function profilePath(configDir: string, profileName: string): string {
  return join(agentProfileDirectory(configDir, profileName), "connection.json");
}

export function parseConnectedAgentProfile(
  value: unknown,
): ConnectedAgentProfile {
  try {
    const row = mailObject(value, [
      "version",
      "auth_method",
      "api_key",
      "api_base_url",
      "org_id",
      "agent_address",
      "owner_address",
      "invitation_hash",
      "created_at",
    ]);
    const apiKey = mailString(row.api_key, 4096);
    const invitationHash = mailString(row.invitation_hash, 64);
    if (
      row.version !== 1 ||
      row.auth_method !== "agent_connection" ||
      !apiKey.startsWith("pconn_") ||
      /\s/.test(apiKey) ||
      !/^[a-f0-9]{64}$/.test(invitationHash)
    )
      throw new Error();
    return {
      version: 1,
      auth_method: "agent_connection",
      api_key: apiKey,
      api_base_url: connectedApiBaseUrl(row.api_base_url),
      org_id: mailId(row.org_id),
      agent_address: mailAddress(row.agent_address),
      owner_address: mailAddress(row.owner_address),
      invitation_hash: invitationHash,
      created_at: mailTime(row.created_at),
    };
  } catch {
    throw new AgentConnectionSetupError(
      "Saved agent profile is invalid. Preserve its private files and request a fresh setup invitation.",
    );
  }
}

export function loadConnectedAgentProfile(
  configDir: string,
  profileName: string,
): ConnectedAgentProfile | null {
  agentProfileName(profileName);
  try {
    privateMailDirectory(agentProfilesDirectory(configDir));
    privateMailDirectory(join(agentProfilesDirectory(configDir), "profiles"));
    privateMailDirectory(agentProfileDirectory(configDir, profileName));
    const value = readMailJson(profilePath(configDir, profileName));
    return value === null ? null : parseConnectedAgentProfile(value);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new AgentConnectionSetupError(
      "Cannot read the private agent profile. Check its ownership and permissions without exposing its contents.",
    );
  }
}

export function saveConnectedAgentProfile(
  configDir: string,
  profileName: string,
  profile: ConnectedAgentProfile,
): void {
  const validated = parseConnectedAgentProfile(profile);
  privateMailDirectory(agentProfilesDirectory(configDir), true);
  privateMailDirectory(
    join(agentProfilesDirectory(configDir), "profiles"),
    true,
  );
  privateMailDirectory(agentProfileDirectory(configDir, profileName), true);
  writeMailJson(profilePath(configDir, profileName), validated);
}

export function connectedAgentIdentity(
  profileName: string,
  profile: ConnectedAgentProfile,
): ConnectedAgentIdentity {
  return {
    profileName,
    orgId: profile.org_id,
    agentAddress: profile.agent_address,
    ownerAddress: profile.owner_address,
    apiBaseUrl: profile.api_base_url,
  };
}
