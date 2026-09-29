import { Command, Errors, Flags } from "@oclif/core";
import { AgentDisconnectError, disconnectAgent } from "../agent-disconnect.js";

export default class AgentDisconnectCommand extends Command {
  static description =
    "Disconnect exactly one saved connected-agent profile. Stop its tracked bound receiver, revoke only that address's bound credential at its pinned Primitive origin, then remove only the local credential after confirmed revocation. Mail, notes, setup evidence and notification receipts remain. This does not permanently remove the connection record; an owner or admin can do that separately.";
  static summary = "Disconnect one connected agent";
  static examples = [
    "<%= config.bin %> agent disconnect --profile work",
    "<%= config.bin %> agent disconnect --profile work --json",
  ];
  static flags = {
    profile: Flags.string({
      required: true,
      description: "Exact saved agent profile to disconnect",
    }),
    json: Flags.boolean({ description: "Print JSON (already the default)" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(AgentDisconnectCommand);
    try {
      const result = await disconnectAgent({
        configDir: this.config.configDir,
        profileName: flags.profile,
      });
      this.log(JSON.stringify(result, null, 2));
    } catch (error) {
      throw new Errors.CLIError(
        error instanceof AgentDisconnectError
          ? error.message
          : "Disconnect could not safely complete. The credential and local evidence were preserved.",
        { exit: 1 },
      );
    }
  }
}
