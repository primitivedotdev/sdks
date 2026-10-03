import { disconnectAgent } from "./agent-disconnect.js";
import { AgentConnectionSetupError } from "./connected-agent-profile.js";
import { connectedProfilesForSession } from "./machine-session.js";
import { SESSION_UUID } from "./notify-session-native.js";

/** Exit code for a connect or enroll refused because the session already has an address. */
export const ALREADY_CONNECTED_EXIT_CODE = 3;

export type BoundAddress = { profile: string; address: string };

export type SessionAddressGuardResult =
  | { status: "clear"; replaced: BoundAddress[] }
  | {
      status: "already_connected";
      session: string;
      existing: BoundAddress;
      bound: BoundAddress[];
      detail: string;
    };

/**
 * The session a connect or enroll runs in: the explicit --session, else the
 * runtime's own session ID from the environment. Null when neither is a UUID.
 */
export function guardedSession(
  explicit: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  for (const value of [
    explicit,
    env.CLAUDE_CODE_SESSION_ID,
    env.CODEX_THREAD_ID,
    env.CODEX_SESSION_ID,
  ]) {
    const trimmed = value?.trim();
    if (trimmed && SESSION_UUID.test(trimmed)) return trimmed.toLowerCase();
  }
  return null;
}

export function alreadyConnectedDetail(
  bound: BoundAddress[],
  command: "connect" | "enroll",
): string {
  const list = bound
    .map((row) => `${row.address} (profile ${row.profile})`)
    .join(", ");
  const noun = bound.length === 1 ? "address" : "addresses";
  const action =
    command === "connect"
      ? "No invitation was claimed"
      : "No address was created";
  return [
    `This session already has a Primitive ${noun}: ${list}. ${action} and nothing was changed.`,
    `Ask the user whether to keep the existing ${noun} and not connect a new one, or to disconnect the existing agent first. Do not decide for them.`,
    `If they want to replace it, rerun this command with --replace-existing, which disconnects the existing agent and then continues. If they want this session to have more than one address on purpose, rerun with --keep-existing.`,
  ].join(" ");
}

/**
 * Refuse, or with --replace-existing disconnect, every other connected profile
 * bound to this session before a new address is claimed or created. Nothing
 * is claimed, created or sent when this refuses.
 */
export async function guardSessionAddress(params: {
  configDir: string;
  session: string | null;
  targetProfile?: string;
  replaceExisting?: boolean;
  keepExisting?: boolean;
  command: "connect" | "enroll";
  disconnect?: typeof disconnectAgent;
}): Promise<SessionAddressGuardResult> {
  if (!params.session || params.keepExisting)
    return { status: "clear", replaced: [] };
  const bound = connectedProfilesForSession(
    params.configDir,
    params.session,
    params.targetProfile,
  );
  if (bound.length === 0) return { status: "clear", replaced: [] };
  if (!params.replaceExisting)
    return {
      status: "already_connected",
      session: params.session,
      existing: bound[0],
      bound,
      detail: alreadyConnectedDetail(bound, params.command),
    };
  const disconnect = params.disconnect ?? disconnectAgent;
  const replaced: BoundAddress[] = [];
  for (const row of bound) {
    try {
      await disconnect({
        configDir: params.configDir,
        profileName: row.profile,
      });
    } catch (error) {
      const done = replaced.length
        ? ` Already disconnected: ${replaced.map((r) => r.address).join(", ")}.`
        : "";
      throw new AgentConnectionSetupError(
        `Could not disconnect the existing agent ${row.address} (profile ${row.profile}): ${error instanceof Error ? error.message : "unknown error"}${done} No new address was claimed or created.`,
      );
    }
    replaced.push(row);
  }
  return { status: "clear", replaced };
}
