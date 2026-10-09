import { createHash } from "node:crypto";
import { renameSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { uninstallClaudeWakeHook } from "./claude-wake-install.js";
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
  /**
   * `already_revoked`: Primitive refused the credential as unauthorized and
   * then confirmed, with the same credential, that it no longer authenticates
   * (revoked in the app or from another machine).
   */
  revocation: "confirmed" | "previously_confirmed" | "already_revoked";
  externalHook: "removed" | "unavailable" | null;
};

type DisconnectDependencies = {
  fetch?: typeof fetch;
  stopReceiver?: (
    target: BackgroundListenTarget,
  ) => Promise<BackgroundListenStatus>;
  now?: () => Date;
  env?: NodeJS.ProcessEnv;
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
  // Poll receiving binds no session and runs no receiver to stop.
  if (
    row.receiverMode === "poll" &&
    row.session === null &&
    row.invitationHash === profile.invitation_hash
  )
    return null;
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

/** The saved setup's disconnect marker, when it is a well-formed record. */
function markerRecord(
  directory: string,
  invitationHash: string,
): Record<string, unknown> | null {
  const raw = readMailJson(
    join(directory, `disconnected-${invitationHash}.json`),
  );
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  return row.version === 1 &&
    typeof row.revoked_at === "string" &&
    Number.isFinite(Date.parse(row.revoked_at))
    ? row
    : null;
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

/** The API error code from an error envelope, when it has one. */
function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const inner = (error as Record<string, unknown>).error;
  const code =
    inner && typeof inner === "object"
      ? (inner as Record<string, unknown>).code
      : (error as Record<string, unknown>).code;
  return typeof code === "string" && /^[a-z0-9_]{1,64}$/.test(code)
    ? code
    : undefined;
}

/**
 * Whether Primitive confirms, with this same credential, that it no longer
 * authenticates: a definite 401 from the connection's own record, or that
 * record reporting the connection revoked. A server error, a timeout, a
 * network failure or any other answer is not a confirmation.
 */
export async function credentialRevokedByServer(
  profile: ConnectedAgentProfile,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const response = await fetcher(
      `${profile.api_base_url}/agent-connections/me`,
      {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
        headers: {
          authorization: `Bearer ${profile.api_key}`,
          accept: "application/json",
        },
      },
    );
    if (response.status !== 200) {
      await response.body?.cancel().catch(() => undefined);
      return response.status === 401;
    }
    const text = await response.text();
    if (text.length > 65_536) return false;
    const body = JSON.parse(text) as {
      success?: unknown;
      data?: { connection?: { address?: unknown; status?: unknown } };
    } | null;
    const connection = body?.data?.connection;
    return (
      body?.success === true &&
      typeof connection?.address === "string" &&
      connection.address.toLowerCase() ===
        profile.agent_address.toLowerCase() &&
      connection.status === "revoked"
    );
  } catch {
    return false;
  }
}

async function revoke(
  profile: ConnectedAgentProfile,
  fetcher?: typeof fetch,
): Promise<"confirmed" | "already_revoked"> {
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
    if (status === undefined)
      throw new AgentDisconnectError(
        "Revocation outcome is unknown: no response was received from Primitive. The profile and credential were preserved. Check your connection, then retry or check the agent in the app.",
      );
    // A 401 alone may be a transient auth failure; it counts only when the
    // same credential is then confirmed dead.
    if (status === 401 && (await credentialRevokedByServer(profile, fetcher)))
      return "already_revoked";
    const code = errorCode(result.error);
    const label = `HTTP ${status}${code ? `, ${code}` : ""}`;
    throw new AgentDisconnectError(
      status === 401
        ? `Revocation was not confirmed (${label}). The credential was preserved; it may already be invalid. Check the agent in the app before retrying.`
        : status >= 500
          ? `Primitive returned a server error while revoking this agent (${label}), so revocation is unconfirmed. The profile was preserved. Retry the same command; a 401 on retry means the credential was already revoked.`
          : `Revocation was refused by Primitive (${label}). The credential was preserved. Check the agent in the app before retrying.`,
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
  return "confirmed";
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
    const revocation = previous
      ? "previously_confirmed"
      : await revoke(profile, params.fetch);
    if (!previous) {
      try {
        writeMailJson(confirmationPath(directory, profile), {
          version: 1,
          address: profile.agent_address,
          api_base_url: profile.api_base_url,
          credential_digest: credentialDigest(profile),
          revoked_at: (params.now ?? (() => new Date()))().toISOString(),
          ...(revocation === "already_revoked"
            ? { reason: "server_revoked" }
            : {}),
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
    const externalHook = session
      ? uninstallClaudeWakeHook({
          configDir: params.configDir,
          profileName,
          agentAddress: profile.agent_address,
          sessionId: session,
          env: params.env,
        })
        ? "removed"
        : "unavailable"
      : null;
    return {
      status: "disconnected",
      identity: connectedAgentIdentity(profileName, profile),
      receiver,
      revocation,
      externalHook,
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

/**
 * Whether the saved setup bound to `invitationHash` belongs to a credential
 * whose revocation is confirmed locally: its disconnect marker exists and,
 * when the credential file is still present, matches that credential. Such
 * a setup is evidence only; it no longer binds this profile to an address.
 */
export function savedSetupRevoked(
  configDir: string,
  profileName: string,
  invitationHash: string,
): boolean {
  if (!/^[a-f0-9]{64}$/.test(invitationHash)) return false;
  try {
    const directory = agentProfileDirectory(configDir, profileName);
    if (!markerRecord(directory, invitationHash)) return false;
    const profile = loadConnectedAgentProfile(configDir, profileName);
    if (!profile) return true;
    return (
      profile.invitation_hash === invitationHash &&
      confirmedLocally(directory, profile)
    );
  } catch {
    return false;
  }
}

/**
 * Move a revoked setup aside, the same way a replacement does, so a new
 * invitation can be claimed into the same profile. Files are renamed, never
 * deleted, and kept for recovery.
 */
export function archiveRevokedSetup(
  configDir: string,
  profileName: string,
  now: Date,
): void {
  const directory = agentProfileDirectory(configDir, profileName);
  const stamp = now.toISOString().replace(/[^0-9]/g, "");
  for (const path of [
    join(directory, "setup.json"),
    join(directory, "enrollment", "state.json"),
    join(directory, "connection.json"),
  ]) {
    try {
      renameSync(
        path,
        join(dirname(path), `replaced-${stamp}-${basename(path)}`),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

/**
 * Of the addresses bound to a session, clear the ones Primitive confirms are
 * already revoked: each is disconnected locally (receiver stopped, hooks
 * removed, credential removed, marker written) so it no longer counts as the
 * session's address. A live credential, or one whose state cannot be
 * confirmed, is kept and still counts.
 */
export async function clearRevokedAddresses(
  params: {
    configDir: string;
    rows: Array<{ profile: string; address: string }>;
    disconnect?: typeof disconnectAgent;
  } & DisconnectDependencies,
): Promise<{
  remaining: Array<{ profile: string; address: string }>;
  cleared: Array<{ profile: string; address: string }>;
}> {
  const remaining: Array<{ profile: string; address: string }> = [];
  const cleared: Array<{ profile: string; address: string }> = [];
  for (const row of params.rows) {
    let revoked = false;
    try {
      const profile = loadConnectedAgentProfile(params.configDir, row.profile);
      revoked =
        profile !== null &&
        (await credentialRevokedByServer(profile, params.fetch));
    } catch {
      revoked = false;
    }
    if (!revoked) {
      remaining.push(row);
      continue;
    }
    try {
      await (params.disconnect ?? disconnectAgent)({
        configDir: params.configDir,
        profileName: row.profile,
        fetch: params.fetch,
        stopReceiver: params.stopReceiver,
        now: params.now,
        env: params.env,
      });
      cleared.push(row);
    } catch {
      remaining.push(row);
    }
  }
  return { remaining, cleared };
}
