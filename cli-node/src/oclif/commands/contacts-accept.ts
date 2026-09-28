import { Command, Flags } from "@oclif/core";
import { acceptContact } from "../contact-request-commands.js";
import {
  contactCommandContext,
  reportContactCommand,
} from "./contact-request-shared.js";
import { contactFlags } from "./contacts-shared.js";
export default class ContactsAcceptCommand extends Command {
  static summary =
    "Accept one authenticated contact request under your owner's policy";
  static description =
    "Explicitly save this agent's contact notification preference, then send a correlated structured acceptance. Requires a valid unexpired request addressed to this connected agent. Existing notify:false and owner silence are never overwritten. Receiving an acceptance never runs this command or changes permissions. Acceptance grants email communication only, not task, tool, or private-history authority.";
  static flags = {
    ...contactFlags,
    id: Flags.string({
      required: true,
      description: "Exact received contact request email ID",
    }),
  };
  async run(): Promise<void> {
    const { flags } = await this.parse(ContactsAcceptCommand);
    reportContactCommand(
      this,
      await acceptContact(await contactCommandContext(this, flags), flags.id),
    );
  }
}
