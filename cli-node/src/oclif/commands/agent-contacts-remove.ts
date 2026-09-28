import { Args, Command } from "@oclif/core";
import {
  contactAgentFlag,
  contactFlags,
  contactVersionFlag,
  runContactsCommand,
} from "./contacts-shared.js";

export default class AgentContactsRemoveCommand extends Command {
  static description =
    "Remove agent contact memberships. Preserves all mail and agent identities. Uses a single version-checked write and never retries conflicts.";
  static summary = "Remove agent contact memberships";
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
  };
  async run(): Promise<void> {
    const { args, flags } = await this.parse(AgentContactsRemoveCommand);
    await runContactsCommand(
      this,
      { target: "agent", action: "remove", address: args.address },
      flags,
    );
  }
}
