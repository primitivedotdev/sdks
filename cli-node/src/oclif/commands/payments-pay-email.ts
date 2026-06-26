import { Command, Flags } from "@oclif/core";
import type { SendMailResult } from "@primitivedotdev/api-core";
import { replyToEmail } from "@primitivedotdev/api-core";
import type { BuiltPaymentStep } from "@primitivedotdev/sdk/x402";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import { readEmailChallenge } from "./payments-pay-email-step.js";
import {
  PRIVATE_KEY_ENV,
  PRIVATE_KEY_FLAG_DESCRIPTION,
  reportX402Error,
  signEmailChallenge,
} from "./payments-shared.js";

// `primitive payments pay-email` is the one-shot payer side of an email-native
// x402 payment: it SIGNs the challenge and SENDs the signed `interaction.json`
// as an in-thread reply in a single step, so the payer does not have to run
// `pay-email-step` and then a separate `reply --attachment` by hand.
//
// Threading and addressing are derived from the inbound challenge email the
// payer received: --in-reply-to is that inbound email's id. The reply endpoint
// derives the recipient (the payee / challenge issuer) and the In-Reply-To /
// References threading headers from it, and defaults the reply's From to the
// inbound's recipient (the payer the challenge was addressed to). Pass --from
// only to override that default (e.g. a display name or alternate verified
// address).
//
// The signing path is shared byte-for-byte with `pay-email-step` via
// `signEmailChallenge`; the only addition here is delivering the result.

/** The exact part name + content type the inbound matcher requires. */
const INTERACTION_PART_FILENAME = "interaction.json";
const INTERACTION_PART_CONTENT_TYPE = "application/json";

// The reply endpoint requires one of body_text or body_html, so the one-shot
// must always carry a body even though the payload that matters travels in the
// `interaction.json` attachment. Default to a short human-readable note so the
// command works with no extra flags; `--body` overrides it.
const DEFAULT_REPLY_BODY_TEXT =
  "x402 payment authorization attached (interaction.json).";

/** Build the `interaction.json` attachment from a signed payment step. */
export function interactionAttachment(built: BuiltPaymentStep): {
  filename: string;
  content_type: string;
  content_base64: string;
} {
  return {
    filename: INTERACTION_PART_FILENAME,
    content_type: INTERACTION_PART_CONTENT_TYPE,
    content_base64: Buffer.from(built.json, "utf8").toString("base64"),
  };
}

class PaymentsPayEmailCommand extends Command {
  static description =
    `Pay an email-native x402 challenge in one step: sign it and send the signed interaction.json as an in-thread reply.

  Reads the email challenge the payee issued (the JSON from
  \`payments create-email-challenge\`), derives and signs the interaction-bound
  EIP-3009 authorization locally with your wallet key (read from
  ${PRIVATE_KEY_ENV} by default), and replies in-thread to the challenge email
  with the signed \`interaction.json\` attached as an \`application/json\` part.
  The key never leaves your machine.

  This is the recommended payer path. It replaces the two-step
  \`pay-email-step\` + \`reply --attachment interaction.json\` dance: no manual
  address or threading wrangling. Use \`pay-email-step\` only when you need the
  signed bytes as a portable artifact without sending.

  --in-reply-to is the id of the inbound challenge email you received; the reply
  endpoint derives the recipient (the payee) and threading headers from it, and
  defaults the From to the inbound's recipient (you, the payer). Pass --from
  only to override that default.

  Provide the challenge inline with --challenge, from a file with
  --challenge-file, or piped on stdin.`;

  static summary =
    "Sign an email x402 challenge and send it as an in-thread reply (one step)";

  static examples = [
    "<%= config.bin %> payments pay-email --challenge-file challenge.json --in-reply-to <inbound-email-id>",
    "cat challenge.json | <%= config.bin %> payments pay-email --in-reply-to <inbound-email-id> --wait",
    "<%= config.bin %> payments pay-email --challenge-file challenge.json --in-reply-to <inbound-email-id> --from 'Payer <payer@your-domain.example>'",
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
    "private-key": Flags.string({
      description: PRIVATE_KEY_FLAG_DESCRIPTION,
      env: PRIVATE_KEY_ENV,
    }),
    challenge: Flags.string({
      description: "The email challenge object as a JSON string.",
      exclusive: ["challenge-file"],
    }),
    "challenge-file": Flags.string({
      description: "Path to a file containing the email challenge JSON.",
      exclusive: ["challenge"],
    }),
    "in-reply-to": Flags.string({
      description:
        "Id of the inbound challenge email you received. The reply is threaded to it and addressed to the payee derived from it.",
      required: true,
    }),
    from: Flags.string({
      description:
        "Optional From header override. Defaults to the inbound's recipient (the payer the challenge was addressed to).",
    }),
    body: Flags.string({
      description: `Plain-text reply body. The signed authorization travels in the interaction.json attachment; this is the human-readable accompanying note. Defaults to "${DEFAULT_REPLY_BODY_TEXT}".`,
    }),
    wait: Flags.boolean({
      description:
        "Block until the receiving MTA returns an outcome. Without --wait, the call returns once Primitive has accepted the reply for delivery.",
    }),
    json: Flags.boolean({
      description:
        "Print a JSON object with the signed interaction step and the send result.",
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PaymentsPayEmailCommand);

    // Unlike `pay-email-step` (fully offline), this command sends, so it needs
    // an authenticated client. Build it first so a not-signed-in caller gets
    // the standard auth guidance before we do any signing work.
    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });
    const authFailureContext = {
      auth,
      baseUrlOverridden,
      configDir: this.config.configDir,
    };

    await runWithTiming(flags.time, async () => {
      // Sign locally. Signing failures (bad key, expired/invalid challenge)
      // surface through the x402 error reporter, the same as `pay-email-step`.
      let built: BuiltPaymentStep;
      try {
        const challenge = readEmailChallenge({
          inline: flags.challenge,
          file: flags["challenge-file"],
        });
        built = await signEmailChallenge({
          challenge,
          privateKey: flags["private-key"] ?? "",
          resolvedApiBaseUrl: auth.apiBaseUrl,
          apiKey: flags["api-key"],
        });
      } catch (error) {
        reportX402Error(error, authFailureContext);
        process.exitCode = 1;
        return;
      }

      // Send the signed envelope as an in-thread reply. The inbound matcher
      // requires a part named exactly `interaction.json` with content type
      // `application/json`; build it that way. The reply endpoint also requires
      // a body, so always include `body_text` (a sensible default, overridable
      // with `--body`) even though the payload of record is the attachment.
      const result = await replyToEmail({
        body: {
          // Fall back to the default note when --body is omitted OR blank /
          // whitespace-only, so an empty override can't re-trigger the reply
          // endpoint's "body required" validation this command guards against.
          body_text: flags.body?.trim() ? flags.body : DEFAULT_REPLY_BODY_TEXT,
          attachments: [interactionAttachment(built)],
          ...(flags.from !== undefined ? { from: flags.from } : {}),
          ...(flags.wait !== undefined ? { wait: flags.wait } : {}),
        },
        client: apiClient.client,
        path: { id: flags["in-reply-to"] },
        responseStyle: "fields",
      });

      if (result.error) {
        const errorPayload = extractErrorPayload(result.error);
        writeErrorWithHints(errorPayload);
        surfaceUnauthorizedHint({
          ...authFailureContext,
          payload: errorPayload,
        });
        process.exitCode = 1;
        return;
      }

      const envelope = result.data as { data?: SendMailResult } | undefined;
      const sent = envelope?.data ?? null;
      if (flags.json) {
        this.log(
          JSON.stringify({ interaction: built.envelope, sent }, null, 2),
        );
      } else {
        this.log(JSON.stringify(sent, null, 2));
      }
    });
  }
}

export default PaymentsPayEmailCommand;
