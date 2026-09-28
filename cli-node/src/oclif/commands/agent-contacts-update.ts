import { Args, Command } from "@oclif/core";
import {
  contactAgentFlag,
  contactFlags,
  contactPreferenceFlags,
  contactVersionFlag,
  runContactsCommand,
} from "./contacts-shared.js";

export default class AgentContactsUpdateCommand extends Command {
  static description =
    "Update agent contact memberships. Uses a single version-checked write and never retries conflicts.";
  static summary = "Update agent contact memberships";
  static args = {
    address: Args.string({
      description: "Contact email address",
      required: true,
    }),
  };
  static flags = {
    ...contactFlags,
    ...contactAgentFlag,
    ...contactVersionFlag,
    ...contactPreferenceFlags,
  };
  async run(): Promise<void> {
    const { args, flags } = await this.parse(AgentContactsUpdateCommand);
    await runContactsCommand(
      this,
      { target: "agent", action: "update", address: args.address },
      flags,
    );
  }
}
