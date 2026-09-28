import { Args, Command } from "@oclif/core";
import {
  contactAgentFlag,
  contactFlags,
  contactPreferenceFlags,
  runContactsCommand,
} from "./contacts-shared.js";

export default class AgentContactsAddCommand extends Command {
  static description =
    "Add agent contact memberships. Creates an address-only directory contact if missing; existing shared labels are preserved.";
  static summary = "Add agent contact memberships";
  static args = {
    address: Args.string({
      description: "Contact email address",
      required: true,
    }),
  };
  static flags = {
    ...contactFlags,
    ...contactAgentFlag,
    ...contactPreferenceFlags,
  };
  async run(): Promise<void> {
    const { args, flags } = await this.parse(AgentContactsAddCommand);
    await runContactsCommand(
      this,
      { target: "agent", action: "add", address: args.address },
      flags,
    );
  }
}
