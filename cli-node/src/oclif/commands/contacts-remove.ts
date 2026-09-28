import { Args, Command } from "@oclif/core";
import {
  contactFlags,
  contactVersionFlag,
  runContactsCommand,
} from "./contacts-shared.js";

export default class ContactsRemoveCommand extends Command {
  static description =
    "Remove organization directory contacts. Preserves all mail and agent identities. Directory removal also removes its agent memberships. Uses a single version-checked write and never retries conflicts.";
  static summary = "Remove organization directory contacts";
  static args = {
    address: Args.string({
      description: "Contact email address",
      required: true,
    }),
  };
  static flags = { ...contactFlags, ...contactVersionFlag };
  async run(): Promise<void> {
    const { args, flags } = await this.parse(ContactsRemoveCommand);
    await runContactsCommand(
      this,
      { target: "directory", action: "remove", address: args.address },
      flags,
    );
  }
}
