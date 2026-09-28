import { Command } from "@oclif/core";
import {
  contactFlags,
  contactPageFlags,
  runContactsCommand,
} from "./contacts-shared.js";

export default class ContactsListCommand extends Command {
  static description = "List organization directory contacts.";
  static summary = "List organization directory contacts";
  static flags = { ...contactFlags, ...contactPageFlags };
  async run(): Promise<void> {
    const { flags } = await this.parse(ContactsListCommand);
    await runContactsCommand(
      this,
      { target: "directory", action: "list" },
      flags,
    );
  }
}
