import { Command } from "@oclif/core";
import {
  contactAgentFlag,
  contactFlags,
  contactPageFlags,
  runContactsCommand,
} from "./contacts-shared.js";

export default class AgentContactsListCommand extends Command {
  static description = "List agent contact memberships.";
  static summary = "List agent contact memberships";
  static flags = { ...contactFlags, ...contactAgentFlag, ...contactPageFlags };
  async run(): Promise<void> {
    const { flags } = await this.parse(AgentContactsListCommand);
    await runContactsCommand(this, { target: "agent", action: "list" }, flags);
  }
}
