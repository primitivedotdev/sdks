import { Command, Flags } from "@oclif/core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  runWithTiming,
  TIME_FLAG_DESCRIPTION,
} from "../api-command.js";
import { deriveEmailChallengeFromInbound } from "./payments-email-challenge.js";
import { reportX402Error } from "./payments-shared.js";

// `primitive payments challenge-from-email` prints the correctly-shaped email
// challenge object derived from an inbound payment-request email's
// `interaction.json` attachment.
//
// Why this exists: `pay-email` / `pay-email-step` consume a CHALLENGE OBJECT in
// the shape the payee's `create-email-challenge` API returns, but a real payer
// only ever has the inbound email's `interaction.json` attachment, which is the
// WIRE ENVELOPE shape with a different field layout. `pay-email --in-reply-to`
// now auto-derives the challenge, but SDK callers and anyone driving
// `pay-email-step` (sign-only, portable artifact) still need a way to GET the
// reshaped challenge without hand-mapping the envelope. This command does that
// reshape (via the SDK's canonical parseEmailChallengeFromPart) and prints the
// result, so it can be piped:
//
//   primitive payments challenge-from-email --id <inbound-id> \
//     | primitive payments pay-email-step > interaction.json

class PaymentsChallengeFromEmailCommand extends Command {
  static description =
    `Derive and print the email x402 challenge object from a received payment-request email.

  A payer receives an x402 payment request as an email carrying an
  \`interaction.json\` attachment (the wire envelope). The signing commands,
  however, take the challenge object the payee's \`create-email-challenge\` API
  returns, which has a different field layout. This command downloads the inbound
  email's \`interaction.json\` attachment and reshapes it into that challenge
  object, printing it to stdout.

  Use it when you want the challenge as a portable artifact (e.g. to feed
  \`pay-email-step\` for offline signing, or an SDK \`payEmailChallenge\` call).
  For the simple one-shot, prefer \`pay-email --in-reply-to <id>\`, which derives
  the challenge internally and needs no intermediate file.

      primitive payments challenge-from-email --id <inbound-id> > challenge.json
      primitive payments challenge-from-email --id <inbound-id> \\
        | primitive payments pay-email-step > interaction.json`;

  static summary =
    "Print the email x402 challenge object derived from a received payment-request email";

  static examples = [
    "<%= config.bin %> payments challenge-from-email --id <inbound-email-id>",
    "<%= config.bin %> payments challenge-from-email --id <inbound-email-id> | <%= config.bin %> payments pay-email-step > interaction.json",
  ];

  static flags = {
    "api-key": Flags.string({
      description:
        "Primitive API key override (defaults to PRIMITIVE_API_KEY or saved OAuth login credentials)",
      env: "PRIMITIVE_API_KEY",
    }),
    "api-base-url": Flags.string({
      description: API_BASE_URL_FLAG_DESCRIPTION,
      env: "PRIMITIVE_API_BASE_URL",
      hidden: true,
    }),
    id: Flags.string({
      description:
        "Id of the inbound payment-request email whose interaction.json attachment carries the challenge.",
      required: true,
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PaymentsChallengeFromEmailCommand);

    const { auth, baseUrlOverridden, requestConfig } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });

    await runWithTiming(flags.time, async () => {
      try {
        const challenge = await deriveEmailChallengeFromInbound({
          baseUrl: auth.apiBaseUrl,
          emailId: flags.id,
          apiKey: auth.apiKey,
          headers: requestConfig.headers,
        });
        this.log(JSON.stringify(challenge, null, 2));
      } catch (error) {
        reportX402Error(error, {
          auth,
          baseUrlOverridden,
          configDir: this.config.configDir,
        });
        process.exitCode = 1;
      }
    });
  }
}

export default PaymentsChallengeFromEmailCommand;
