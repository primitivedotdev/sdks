import { Command, Flags } from "@oclif/core";
import { AGENT_PROFILE_ENV } from "../connected-agent-profile.js";
import {
  statusProfile,
  statusProfileMissingDetail,
} from "../session-address-guard.js";
import AgentConnectCommand from "./agent-connect.js";

export { statusProfile };

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
      const detail = statusProfileMissingDetail(picked.bound);
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
