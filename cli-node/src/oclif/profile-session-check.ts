import { join } from "node:path";
import { agentProfileDirectory } from "./connected-agent-profile.js";
import { currentMailSessionKey } from "./mail-session.js";
import { readMailJson } from "./shared-mail-files.js";

const SESSION_UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/**
 * A warning when a connected agent profile set up for one runtime session
 * is used to send from a different one. The saved setup records the session
 * the profile was connected in; the current session comes from the same
 * runtime ids exact-session receiving uses. Returns null when the profile
 * has no recorded session, no runtime session is present, or they match.
 * Reuse can be legitimate, so this only warns.
 */
export function sharedProfileWarning(params: {
  configDir: string;
  connectedAgent?: { profileName: string; agentAddress: string };
  env?: Record<string, string | undefined>;
}): string | null {
  const agent = params.connectedAgent;
  if (!agent) return null;
  const runtime = currentMailSessionKey(params.env)?.split(":")[1];
  if (!runtime) return null;
  let bound: unknown;
  try {
    const setup = readMailJson(
      join(
        agentProfileDirectory(params.configDir, agent.profileName),
        "setup.json",
      ),
    );
    bound =
      setup && typeof setup === "object" && !Array.isArray(setup)
        ? (setup as Record<string, unknown>).session
        : undefined;
  } catch {
    return null;
  }
  if (typeof bound !== "string" || !SESSION_UUID.test(bound)) return null;
  if (bound.toLowerCase() === runtime) return null;
  return `This profile belongs to another session (${bound.slice(0, 8).toLowerCase()}); sending as ${agent.agentAddress}.`;
}

/** Print the shared-profile warning on stderr when it applies. */
export function warnIfSharedProfile(params: {
  configDir: string;
  connectedAgent?: { profileName: string; agentAddress: string };
}): void {
  const warning = sharedProfileWarning(params);
  if (warning) process.stderr.write(`Warning: ${warning}\n`);
}
