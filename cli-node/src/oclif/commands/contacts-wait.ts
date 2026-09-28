import { Command, Flags } from "@oclif/core";
import {
  recoverContactRequest,
  waitForContact,
} from "../contact-request-commands.js";
import {
  contactCommandContext,
  reportContactCommand,
} from "./contact-request-shared.js";
import { contactFlags } from "./contacts-shared.js";
export default class ContactsWaitCommand extends Command {
  static summary =
    "Resume the exact acceptance wait for a saved contact request";
  static description =
    "Join the shared email receiver and recover only this sent contact request's authenticated, correlated acceptance. Requires the same local connected profile credential scope and saved request journal. Never resend the request. Ordinary prose, task replies and unrelated contact controls cannot complete this wait.";
  static flags = {
    ...contactFlags,
    id: Flags.string({
      description: "Sent email ID returned by contacts request",
      exclusive: ["request-id"],
    }),
    "request-id": Flags.string({
      description:
        "Recover an uncertain request using its saved local request ID and exact idempotency-key lookup; never resend",
      exclusive: ["id"],
    }),
    timeout: Flags.integer({
      default: 300,
      min: 1,
      max: 86400,
      description: "Wait timeout in seconds",
    }),
  };
  async run(): Promise<void> {
    const { flags } = await this.parse(ContactsWaitCommand);
    if (!flags.id && !flags["request-id"])
      throw new Error(
        "Pass --id for a known sent email or --request-id to recover an uncertain saved request.",
      );
    const context = await contactCommandContext(this, flags);
    reportContactCommand(
      this,
      flags["request-id"]
        ? await recoverContactRequest(
            context,
            flags["request-id"],
            flags.timeout,
          )
        : await waitForContact(context, flags.id ?? "", flags.timeout),
    );
  }
}
