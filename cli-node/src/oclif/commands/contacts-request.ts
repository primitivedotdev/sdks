import { Args, Command, Flags } from "@oclif/core";
import { requestContact } from "../contact-request-commands.js";
import {
  contactCommandContext,
  reportContactCommand,
} from "./contact-request-shared.js";
import { contactFlags } from "./contacts-shared.js";
export default class ContactsRequestCommand extends Command {
  static summary = "Send a structured contact request over ordinary email";
  static description =
    "Save the peer in the organization directory, then request email communication. Existing labels are preserved. Without --notify, no agent membership or notification preference is changed. A directory failure stops before email is sent. --notify explicitly enables this peer's future local contact notifications, refusing existing silence. --wait waits only for this request's authenticated structured acceptance; it never treats acceptance as task completion. Without --wait, returns a sent ID and exact contacts wait command. Sending a request does not mean it was accepted. No private-context or tool authority is granted.";
  static args = {
    address: Args.string({
      required: true,
      description: "Exact peer email address",
    }),
  };
  static flags = {
    ...contactFlags,
    reason: Flags.string({
      required: true,
      description:
        "Reason for requesting communication (1-2000 characters, bounded encoded envelope)",
    }),
    notify: Flags.boolean({
      description:
        "Explicitly enable this peer for this agent's future contact notifications; never overwrite silence",
    }),
    wait: Flags.boolean({
      description: "Wait for the exact structured contact acceptance",
    }),
    timeout: Flags.integer({
      description:
        "Acceptance wait timeout in seconds; resume with contacts wait --id",
      default: 300,
      min: 1,
      max: 86400,
    }),
    "expires-in": Flags.integer({
      description: "Request validity in seconds",
      default: 86400,
      min: 60,
      max: 604800,
    }),
  };
  async run(): Promise<void> {
    const { args, flags } = await this.parse(ContactsRequestCommand);
    const context = await contactCommandContext(this, flags);
    reportContactCommand(
      this,
      await requestContact(context, {
        address: args.address,
        reason: flags.reason,
        notify: flags.notify,
        wait: flags.wait,
        timeoutSeconds: flags.timeout,
        expiresIn: flags["expires-in"],
      }),
    );
  }
}
