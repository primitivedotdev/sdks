import { createHash } from "node:crypto";
import { join } from "node:path";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import {
  agentProfileDirectory,
  agentProfileName,
  agentProfilesDirectory,
  type ConnectedAgentProfile,
  connectedAgentIdentity,
  loadConnectedAgentProfile,
} from "./connected-agent-profile.js";
import {
  type BackgroundListenStatus,
  type BackgroundListenTarget,
  stopBackgroundListen,
} from "./listen-background.js";
import { acquireListenLock } from "./listen-state.js";
import { notificationScope } from "./notify-session.js";
import { SESSION_UUID } from "./notify-session-native.js";
import {
  readMailJson,
  removeMailFile,
  writeMailJson,
} from "./shared-mail-files.js";

export class AgentDisconnectError extends Error {}

type DisconnectResult = {
  status: "disconnected";
  identity: ReturnType<typeof connectedAgentIdentity>;
  receiver: BackgroundListenStatus | null;
  revocation: "confirmed" | "previously_confirmed";
};

type DisconnectDependencies = {
  fetch?: typeof fetch;
  stopReceiver?: (
    target: BackgroundListenTarget,
  ) => Promise<BackgroundListenStatus>;
  now?: () => Date;
};

function credentialDigest(profile: ConnectedAgentProfile): string {
  return createHash("sha256")
    .update("primitive-agent-disconnect-v1\0")
    .update(profile.api_key)
    .digest("hex");
}

function boundSession(
  directory: string,
  profile: ConnectedAgentProfile,
): string | null {
  const raw = readMailJson(join(directory, "setup.json"));
  if (raw === null) return null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new AgentDisconnectError(
      "Saved session setup is invalid. The connection was not changed.",
    );
  const row = raw as Record<string, unknown>;
  if (
    typeof row.session !== "string" ||
    !SESSION_UUID.test(row.session) ||
    row.invitationHash !== profile.invitation_hash
  )
    throw new AgentDisconnectError(
      "Saved session binding does not match this profile. The connection was not changed.",
    );
  return row.session.toLowerCase();
}

function receiverStopped(status: BackgroundListenStatus): boolean {
  return (
    status.phase === null ||
    status.phase === "stopped" ||
    status.phase === "failed" ||
    status.reason === "exited"
  );
}

function confirmationPath(
  directory: string,
  profile: ConnectedAgentProfile,
): string {
  return join(directory, `disconnected-${profile.invitation_hash}.json`);
}

function confirmedLocally(
  directory: string,
  profile: ConnectedAgentProfile,
): boolean {
  const raw = readMailJson(confirmationPath(directory, profile));
  if (raw === null) return false;
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new AgentDisconnectError(
      "Saved revocation confirmation is invalid. The credential was preserved.",
    );
  const row = raw as Record<string, unknown>;
  if (
    row.version !== 1 ||
    row.address !== profile.agent_address ||
    row.api_base_url !== profile.api_base_url ||
    row.credential_digest !== credentialDigest(profile) ||
    typeof row.revoked_at !== "string" ||
    !Number.isFinite(Date.parse(row.revoked_at))
  )
    throw new AgentDisconnectError(
      "Saved revocation confirmation does not match this credential. The credential was preserved.",
    );
  return true;
}

async function revoke(
  profile: ConnectedAgentProfile,
  fetcher?: typeof fetch,
): Promise<void> {
  const client = new PrimitiveApiClient({
    apiKey: profile.api_key,
    apiBaseUrl: profile.api_base_url,
    ...(fetcher ? { fetch: fetcher } : {}),
  });
  let result: { data?: unknown; error?: unknown; response?: Response };
  try {
    result = (await client.client.delete({
      security: [{ scheme: "bearer", type: "http" }],
      url: "/agent-connections/{address}",
      path: { address: profile.agent_address },
      redirect: "error",
      signal: AbortSignal.timeout(25_000),
      responseStyle: "fields",
    })) as { data?: unknown; error?: unknown; response?: Response };
  } catch {
    throw new AgentDisconnectError(
      "Revocation outcome is unknown after a transport error. The profile and credential were preserved. Check the agent in the app before retrying.",
    );
  }
  if (result.error !== undefined) {
    const status = result.response?.status;
    throw new AgentDisconnectError(
      status === 401
        ? "Revocation was not confirmed (401). The credential was preserved; it may already be invalid. Check the agent in the app before retrying."
        : "Revocation was not confirmed by Primitive. The credential was preserved. Check the agent in the app before retrying.",
    );
  }
  const envelope = result.data;
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope))
    throw new AgentDisconnectError(
      "Revocation response was incomplete. The credential was preserved. Check the agent in the app before retrying.",
    );
  const row = envelope as Record<string, unknown>;
  const data = row.data;
  const connection =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>).connection
      : undefined;
  if (
    row.success !== true ||
    !connection ||
    typeof connection !== "object" ||
    Array.isArray(connection) ||
    (connection as Record<string, unknown>).address !== profile.agent_address ||
    (connection as Record<string, unknown>).owner_address !==
      profile.owner_address ||
    (connection as Record<string, unknown>).status !== "revoked"
  )
    throw new AgentDisconnectError(
      "Revocation response was incomplete. The credential was preserved. Check the agent in the app before retrying.",
    );
}

/** Revoke one selected connected credential; never alter OAuth login or mail evidence. */
export async function disconnectAgent(
  params: { configDir: string; profileName: string } & DisconnectDependencies,
): Promise<DisconnectResult> {
  const profileName = agentProfileName(params.profileName);
  if (!loadConnectedAgentProfile(params.configDir, profileName))
    throw new AgentDisconnectError(
      "This agent profile is not configured. Nothing was changed.",
    );
  const directory = agentProfileDirectory(params.configDir, profileName);
  let releaseSetup: (() => void) | undefined;
  let releaseClaim: (() => void) | undefined;
  try {
    // Setup takes these locks in the same order. Recheck the saved credential
    // while holding both so a concurrent claim cannot be cleaned up by mistake.
    releaseSetup = acquireListenLock(directory, "setup");
    releaseClaim = acquireListenLock(
      agentProfilesDirectory(params.configDir),
      "agent-connection-setup",
    );
    const profile = loadConnectedAgentProfile(params.configDir, profileName);
    if (!profile)
      throw new AgentDisconnectError(
        "The selected profile changed before disconnect. Nothing was changed.",
      );
    const session = boundSession(directory, profile);
    const receiver = session
      ? await (params.stopReceiver ?? stopBackgroundListen)({
          configDir: params.configDir,
          scope: notificationScope(profile.api_base_url, profile.api_key),
          threadId: session,
        })
      : null;
    if (receiver && !receiverStopped(receiver))
      throw new AgentDisconnectError(
        "The bound receiver has not confirmed stopping. The connection and credential were preserved. Check listener status before retrying.",
      );
    const previous = confirmedLocally(directory, profile);
    if (!previous) await revoke(profile, params.fetch);
    if (!previous) {
      try {
        writeMailJson(confirmationPath(directory, profile), {
          version: 1,
          address: profile.agent_address,
          api_base_url: profile.api_base_url,
          credential_digest: credentialDigest(profile),
          revoked_at: (params.now ?? (() => new Date()))().toISOString(),
        });
      } catch {
        throw new AgentDisconnectError(
          "Primitive confirmed revocation, but its local confirmation could not be saved. The credential was preserved. Keep this profile for recovery.",
        );
      }
    }
    const current = loadConnectedAgentProfile(params.configDir, profileName);
    if (!current || current.api_key !== profile.api_key)
      throw new AgentDisconnectError(
        "The selected profile changed after revocation. Its credential was preserved for inspection.",
      );
    try {
      removeMailFile(join(directory, "connection.json"));
    } catch {
      throw new AgentDisconnectError(
        "Primitive confirmed revocation, but the local credential could not be removed. Confirmation is saved; retry this command to finish local cleanup.",
      );
    }
    return {
      status: "disconnected",
      identity: connectedAgentIdentity(profileName, profile),
      receiver,
      revocation: previous ? "previously_confirmed" : "confirmed",
    };
  } catch (error) {
    if (error instanceof AgentDisconnectError) throw error;
    throw new AgentDisconnectError(
      "Disconnect could not safely complete. The credential and local evidence were preserved. Check this profile and listener status before retrying.",
    );
  } finally {
    releaseClaim?.();
    releaseSetup?.();
  }
}
