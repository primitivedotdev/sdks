import { Args, Command } from "@oclif/core";
import { contactFlags, runContactsCommand } from "./contacts-shared.js";

export default class ContactsGetCommand extends Command {
  static description = "Get organization directory contacts.";
  static summary = "Get organization directory contacts";
  static args = {
    address: Args.string({
      description: "Contact email address",
      required: true,
    }),
  };
  static flags = { ...contactFlags };
  async run(): Promise<void> {
    const { args, flags } = await this.parse(ContactsGetCommand);
    await runContactsCommand(
      this,
      { target: "directory", action: "get", address: args.address },
      flags,
    );
  }
}
