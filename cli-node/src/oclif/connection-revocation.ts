import { EventReceiverError } from "@primitivedotdev/sdk/api";
import { credentialRevokedByServer } from "./agent-disconnect.js";
import type { ConnectedAgentProfile } from "./connected-agent-profile.js";
import { ListenError } from "./listen-runner.js";
import {
  ConnectionRevokedError,
  ListenUnauthorizedError,
} from "./listen-state.js";
import { agentConnectionState } from "./machine-session.js";

/** The parts of a saved connection needed to ask Primitive about it. */
export type ConnectionCredential = Pick<
  ConnectedAgentProfile,
  "api_base_url" | "api_key" | "agent_address"
>;

/**
 * What Primitive says about a saved connection right now.
 *
 * - `live`: the server answered for this connection with its own credential.
 * - `revoked`: the server confirmed, twice and with the same credential, that
 *   the connection no longer authenticates.
 * - `offline`: no confirmed answer. `unreachable` means the server could not
 *   be reached or gave no usable answer (network error, timeout, server
 *   error); `unconfirmed` means it refused the credential once but did not
 *   confirm a revocation when asked again.
 */
export type ServerConnectionCheck =
  | { verification: "live"; state: "connected" | "pending" }
  | { verification: "revoked" }
  | { verification: "offline"; reason: "unreachable" | "unconfirmed" };

export const CONNECTION_REVOKED_GUIDANCE =
  "This agent's connection was revoked, so no mail reaches it and its API calls are refused. Ask the owner to copy a fresh setup instruction from the app and run it here to connect again.";

export function connectionRevokedMessage(address: string): string {
  return `Primitive no longer accepts the connection for ${address}. ${CONNECTION_REVOKED_GUIDANCE}`;
}

export async function checkConnectionWithServer(
  credential: ConnectionCredential,
  fetchImpl: typeof fetch = fetch,
): Promise<ServerConnectionCheck> {
  const state = await agentConnectionState(credential, fetchImpl);
  if (state === "connected" || state === "pending")
    return { verification: "live", state };
  if (state === "unavailable")
    return { verification: "offline", reason: "unreachable" };
  // A single refusal may be transient; only a second, confirming answer
  // with the same credential counts.
  return (await credentialRevokedByServer(credential, fetchImpl))
    ? { verification: "revoked" }
    : { verification: "offline", reason: "unconfirmed" };
}

/** Whether a listener failure was Primitive refusing the credential (HTTP 401). */
export function unauthorizedListenFailure(error: unknown): boolean {
  return (
    (error instanceof ListenUnauthorizedError ||
      error instanceof ListenError ||
      error instanceof EventReceiverError) &&
    (error as { status?: unknown }).status === 401
  );
}

/**
 * A listener failure, replaced by ConnectionRevokedError when it was a 401
 * and Primitive then confirms the same credential was revoked. Any other
 * failure, or an unconfirmed 401, is returned unchanged.
 */
export async function confirmRevokedListenFailure(
  error: unknown,
  credential: ConnectionCredential | null,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  if (error instanceof ConnectionRevokedError) return error;
  if (!credential || !unauthorizedListenFailure(error)) return error;
  try {
    return (await credentialRevokedByServer(credential, fetchImpl))
      ? new ConnectionRevokedError(
          connectionRevokedMessage(credential.agent_address),
        )
      : error;
  } catch {
    return error;
  }
}
