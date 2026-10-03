import { existsSync, renameSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { disconnectAgent } from "./agent-disconnect.js";
import {
  AgentConnectionSetupError,
  agentProfileDirectory,
  loadConnectedAgentProfile,
} from "./connected-agent-profile.js";
import { connectedProfilesForSession } from "./machine-session.js";
import { SESSION_UUID } from "./notify-session-native.js";

/** Exit code for a connect or enroll refused because the session already has an address. */
export const ALREADY_CONNECTED_EXIT_CODE = 3;

export type BoundAddress = { profile: string; address: string };

export type AlreadyConnectedResult = {
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
  continuation?: string,
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
    ...(continuation ? [continuation] : []),
  ].join(" ");
}

export type SessionAddressCheck = {
  session: string;
  /** Connected profiles bound to this session other than the target. */
  others: BoundAddress[];
  /** The target profile, when it already holds a connected credential bound to this session. */
  target: (BoundAddress & { invitationHash: string }) | null;
};

/**
 * Every connected profile bound to this session, with the profile about to
 * be connected or enrolled reported separately: whether it is a second
 * address depends on what is being set up (the same invitation or enrollment
 * resumes it; anything else replaces it). Offline and read-only.
 */
export function inspectSessionAddresses(params: {
  configDir: string;
  session: string;
  targetProfile?: string;
}): SessionAddressCheck {
  const bound = connectedProfilesForSession(params.configDir, params.session);
  let target: SessionAddressCheck["target"] = null;
  const others: BoundAddress[] = [];
  for (const row of bound) {
    if (row.profile !== params.targetProfile) {
      others.push(row);
      continue;
    }
    try {
      const saved = loadConnectedAgentProfile(params.configDir, row.profile);
      if (saved) target = { ...row, invitationHash: saved.invitation_hash };
    } catch {
      /* connectedProfilesForSession already loaded it; treat a race as absent. */
    }
  }
  return { session: params.session.trim().toLowerCase(), others, target };
}

export function alreadyConnected(
  session: string,
  bound: BoundAddress[],
  command: "connect" | "enroll",
  continuation?: string,
): AlreadyConnectedResult {
  const rows = bound.map(({ profile, address }) => ({ profile, address }));
  return {
    status: "already_connected",
    session,
    existing: rows[0] as BoundAddress,
    bound: rows,
    detail: alreadyConnectedDetail(rows, command, continuation),
  };
}

/**
 * How to continue the target profile's own connection when the refusal is
 * only about it: a setup with saved progress resumes without reading stdin,
 * while a claim-only profile (no saved setup) is refreshed by rerunning the
 * same claim with --keep-existing. Null when neither path applies.
 */
export function targetContinuation(
  configDir: string,
  profile: string,
  claimOnly: boolean,
): string | null {
  if (existsSync(join(agentProfileDirectory(configDir, profile), "setup.json")))
    return `If ${profile} is this same setup continuing, rerun with --resume instead; it reads no invitation.`;
  if (claimOnly)
    return `If ${profile} was claimed from this same invitation, rerun this command with --keep-existing to refresh it; the same invitation is not claimed again.`;
  return null;
}

/** Move a file aside so a fresh setup can start, keeping it for recovery. */
function archive(path: string, stamp: string): void {
  try {
    renameSync(
      path,
      join(dirname(path), `replaced-${stamp}-${basename(path)}`),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

/**
 * With --replace-existing: disconnect every listed profile. Call it only once
 * every local check for the new setup has passed, immediately before the
 * claim or creation. When the target profile itself is replaced, its saved
 * setup and enrollment state are moved aside after the disconnect so the new
 * setup can use the same profile name.
 */
export async function replaceSessionAddresses(params: {
  configDir: string;
  rows: BoundAddress[];
  targetProfile?: string;
  disconnect?: typeof disconnectAgent;
  now?: () => Date;
}): Promise<BoundAddress[]> {
  const disconnect = params.disconnect ?? disconnectAgent;
  const replaced: BoundAddress[] = [];
  for (const { profile, address } of params.rows) {
    try {
      await disconnect({ configDir: params.configDir, profileName: profile });
      if (profile === params.targetProfile) {
        const stamp = (params.now ?? (() => new Date()))()
          .toISOString()
          .replace(/[^0-9]/g, "");
        const directory = agentProfileDirectory(params.configDir, profile);
        archive(join(directory, "setup.json"), stamp);
        archive(join(directory, "enrollment", "state.json"), stamp);
      }
    } catch (error) {
      const done = replaced.length
        ? ` Already disconnected: ${replaced.map((r) => r.address).join(", ")}.`
        : "";
      throw new AgentConnectionSetupError(
        `Could not disconnect the existing agent ${address} (profile ${profile}): ${error instanceof Error ? error.message : "unknown error"}${done} No new address was claimed or created.`,
      );
    }
    replaced.push({ profile, address });
  }
  return replaced;
}
