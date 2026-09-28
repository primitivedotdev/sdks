import { Args, Command } from "@oclif/core";
import {
  contactFlags,
  contactNameFlags,
  contactVersionFlag,
  runContactsCommand,
} from "./contacts-shared.js";

export default class ContactsUpdateCommand extends Command {
  static description =
    "Update organization directory contacts. Uses a single version-checked write and never retries conflicts.";
  static summary = "Update organization directory contacts";
  static args = {
    address: Args.string({
      description: "Contact email address",
      required: true,
    }),
  };
  static flags = {
    ...contactFlags,
    ...contactVersionFlag,
    ...contactNameFlags,
  };
  async run(): Promise<void> {
    const { args, flags } = await this.parse(ContactsUpdateCommand);
    await runContactsCommand(
      this,
      { target: "directory", action: "update", address: args.address },
      flags,
    );
  }
}
