import { Args, Command } from "@oclif/core";
import {
  contactFlags,
  contactNameFlags,
  runContactsCommand,
} from "./contacts-shared.js";

export default class ContactsAddCommand extends Command {
  static description = "Add organization directory contacts.";
  static summary = "Add organization directory contacts";
  static args = {
    address: Args.string({
      description: "Contact email address",
      required: true,
    }),
  };
  static flags = { ...contactFlags, ...contactNameFlags };
  async run(): Promise<void> {
    const { args, flags } = await this.parse(ContactsAddCommand);
    await runContactsCommand(
      this,
      { target: "directory", action: "add", address: args.address },
      flags,
    );
  }
}
