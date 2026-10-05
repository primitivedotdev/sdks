import { Command, Flags } from "@oclif/core";
import { AGENT_PROFILE_ENV } from "../connected-agent-profile.js";
import {
  guardedSession,
  inspectSessionAddresses,
} from "../session-address-guard.js";
import AgentConnectCommand from "./agent-connect.js";

/**
 * Picks the profile `agent status` reads: an explicit --profile, then
 * PRIMITIVE_AGENT_PROFILE, then the one address connected for this runtime
 * session. Null when none applies or the session has several addresses.
 */
export function statusProfile(params: {
  configDir: string;
  profile?: string;
  env?: NodeJS.ProcessEnv;
}): { profile: string } | { profile: null; bound: string[] } {
  const env = params.env ?? process.env;
  const chosen =
    params.profile ?? (env[AGENT_PROFILE_ENV]?.trim() || undefined);
  if (chosen) return { profile: chosen };
  const session = guardedSession(undefined, env);
  if (!session) return { profile: null, bound: [] };
  const { others } = inspectSessionAddresses({
    configDir: params.configDir,
    session,
  });
  const only = others.length === 1 ? others[0] : undefined;
  return only
    ? { profile: only.profile }
    : { profile: null, bound: others.map((row) => row.profile) };
}

/** A hidden alias of `agent connect --status`, for the command agents guess. */
export default class AgentStatusCommand extends Command {
  static hidden = true;
  static summary =
    "Show this agent's saved connection (agent connect --status)";
  static description =
    `Same as \`agent connect --status\`: read the saved identity and local receiver health offline. The profile is --profile, else ${AGENT_PROFILE_ENV}, else the one address connected for this runtime session.`;
  static flags = {
    profile: Flags.string({ description: "Local agent profile name" }),
    json: Flags.boolean({ description: "Print the status as JSON" }),
  };
  async run(): Promise<void> {
    const { flags } = await this.parse(AgentStatusCommand);
    const picked = statusProfile({
      configDir: this.config.configDir,
      profile: flags.profile,
    });
    if (picked.profile === null) {
      const detail =
        picked.bound.length > 1
          ? `This session has several connected profiles (${picked.bound.join(", ")}). Pass --profile <name>.`
          : `No Primitive address is connected for this session. Pass --profile <name> or set ${AGENT_PROFILE_ENV} to inspect a saved profile.`;
      this.log(
        flags.json
          ? JSON.stringify({
              status: "not_configured",
              profileName: null,
              ...(picked.bound.length > 1 ? { profiles: picked.bound } : {}),
              detail,
            })
          : detail,
      );
      process.exitCode = 1;
      return;
    }
    await AgentConnectCommand.run(
      [
        "--status",
        "--profile",
        picked.profile,
        ...(flags.json ? ["--json"] : []),
      ],
      this.config,
    );
  }
}
