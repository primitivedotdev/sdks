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
  /** Control sender for the setup check and presence only. Never a report target. */
  ownerAddress: string;
  /**
   * The owner's personal mailbox, the one their apps show: where reports and
   * questions go. Null for shared connections, an owner without a personal
   * address, or a server that does not report it yet. Always set by
   * connectedAgentIdentity; optional only for identities built elsewhere.
   */
  ownerMemberAddress?: string | null;
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
  /** Absent when the server has not reported it; null when there is none. */
  owner_member_address?: string | null;
  invitation_hash: string;
  created_at: string;
  presence_profile?: PresenceProfile;
};

export type PresenceProfile = {
  protocol: "primitive.presence";
  version: 1;
  authentication_profile: "primitive-issued-v1";
  return_address: string;
};

export function parsePresenceProfile(
  value: unknown,
  owner: string,
): PresenceProfile {
  const row = mailObject(value, [
    "protocol",
    "version",
    "authentication_profile",
    "return_address",
  ]);
  if (
    row.protocol !== "primitive.presence" ||
    row.version !== 1 ||
    row.authentication_profile !== "primitive-issued-v1" ||
    mailAddress(row.return_address) !== owner
  )
    throw new AgentConnectionSetupError(
      "The presence authentication profile is not supported.",
    );
  return {
    protocol: "primitive.presence",
    version: 1,
    authentication_profile: "primitive-issued-v1",
    return_address: owner,
  };
}

function supportedPresenceProfile(value: unknown, owner: string) {
  if (value === undefined) return undefined;
  try {
    return parsePresenceProfile(value, owner);
  } catch {
    // An additive profile the adapter cannot authenticate disables presence,
    // without preventing the existing connection and ordinary mail setup.
    return undefined;
  }
}

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
    const keys = [
      "version",
      "auth_method",
      "api_key",
      "api_base_url",
      "org_id",
      "agent_address",
      "owner_address",
      "invitation_hash",
      "created_at",
    ];
    const has = (key: string) =>
      Boolean(value && typeof value === "object" && Object.hasOwn(value, key));
    const row = mailObject(value, [
      ...keys,
      ...(has("presence_profile") ? ["presence_profile"] : []),
      ...(has("owner_member_address") ? ["owner_member_address"] : []),
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
    const presence = supportedPresenceProfile(
      row.presence_profile,
      mailAddress(row.owner_address),
    );
    const ownerMember = has("owner_member_address")
      ? parseOwnerMemberAddress(
          row.owner_member_address,
          mailAddress(row.owner_address),
          mailAddress(row.agent_address),
        )
      : undefined;
    return {
      version: 1,
      auth_method: "agent_connection",
      api_key: apiKey,
      api_base_url: connectedApiBaseUrl(row.api_base_url),
      org_id: mailId(row.org_id),
      agent_address: mailAddress(row.agent_address),
      owner_address: mailAddress(row.owner_address),
      ...(ownerMember === undefined
        ? {}
        : { owner_member_address: ownerMember }),
      invitation_hash: invitationHash,
      created_at: mailTime(row.created_at),
      ...(presence === undefined ? {} : { presence_profile: presence }),
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
    ownerMemberAddress: profile.owner_member_address ?? null,
    apiBaseUrl: profile.api_base_url,
  };
}

/**
 * Validates a server-reported owner personal address. It is a person's
 * mailbox, so it can never be the control sender or the agent itself.
 */
export function parseOwnerMemberAddress(
  value: unknown,
  ownerAddress: string,
  agentAddress: string,
): string | null {
  if (value === null) return null;
  const address = mailAddress(value);
  if (address === ownerAddress || address === agentAddress) throw new Error();
  return address;
}

/**
 * Refusal text for a profile that is already connected (or mid-setup) with a
 * different invitation. It never tells the agent to pick another profile on
 * its own: whether this session keeps its address or replaces it is the
 * user's decision.
 */
export function profileAlreadyConnectedMessage(
  profileName: string,
  address: string | null,
): string {
  const who = address ? `already connected as ${address}` : "already set up";
  const it = address ?? "it";
  return [
    `Agent profile ${profileName} is ${who} with a different invitation. No invitation was claimed and nothing was changed.`,
    `Do not create a separate profile on your own. Ask the user whether to keep ${it} and not connect a new address, or to disconnect it first. Do not decide for them.`,
    `If they choose to disconnect it, run \`primitive agent disconnect --profile ${profileName}\` (or rerun this command with --replace-existing when it is bound to this session), then connect again. If they want a second address on purpose, rerun with a new --profile and --keep-existing.`,
  ].join(" ");
}
