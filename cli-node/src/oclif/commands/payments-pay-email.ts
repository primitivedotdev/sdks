import { Command, Flags } from "@oclif/core";
import type { EmailDetail, SendMailResult } from "@primitivedotdev/api-core";
import { getEmail, sendEmail } from "@primitivedotdev/api-core";
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
// as an in-thread message in a single step, so the payer does not have to run
// `pay-email-step` and then a separate `send --attachment` by hand.
//
// Why send, not reply: the reply endpoint deduplicates by parent thread, and
// every x402 challenge to the same payer shares the subject "Payment request:
// x402.payment", so all challenges to that payer thread together. Once any
// reply exists in that thread, a subsequent reply is deduped as an idempotent
// replay and no mail goes on the wire, so the payment never reaches the payee
// and the challenge never settles. The send endpoint has no such dedup, so it
// delivers reliably; the interaction is associated by the `interaction.json`'s
// own `interaction_id`, not by thread-level reply matching.
//
// Threading and addressing are derived from the inbound challenge email the
// payer received: --in-reply-to is that inbound email's id. We fetch it to
// derive the payer (its recipient, used as the send From), the payee (its
// sender, used as the send To), and its Message-Id (used as the send's
// In-Reply-To so the authorization still threads under the challenge). Pass
// --from only to override the derived payer From (e.g. a display name or
// alternate verified address).
//
// The signing path is shared byte-for-byte with `pay-email-step` via
// `signEmailChallenge`; the only addition here is delivering the result.

/** The exact part name + content type the inbound matcher requires. */
const INTERACTION_PART_FILENAME = "interaction.json";
const INTERACTION_PART_CONTENT_TYPE = "application/json";

// Send requires a subject; the payee threads on the In-Reply-To Message-Id, so
// the visible subject only needs to be human-readable and non-empty.
const DEFAULT_SUBJECT = "x402 payment authorization";

// Always carry a body even though the payload that matters travels in the
// `interaction.json` attachment. Default to a short human-readable note so the
// command works with no extra flags; `--body` overrides it.
const DEFAULT_BODY_TEXT =
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

/**
 * Pull the `EmailDetail` out of the get-email envelope. The fields wrapper
 * returns `{ data: { data: EmailDetail } }`; normalize to the inner detail or
 * null when the API returned no body.
 */
function emailDetailFromEnvelope(
  data: { data?: EmailDetail } | undefined,
): EmailDetail | null {
  return data?.data ?? null;
}

class PaymentsPayEmailCommand extends Command {
  static description =
    `Pay an email-native x402 challenge in one step: sign it and send the signed interaction.json in-thread.

  Reads the email challenge the payee issued (the JSON from
  \`payments create-email-challenge\`), derives and signs the interaction-bound
  EIP-3009 authorization locally with your wallet key (read from
  ${PRIVATE_KEY_ENV} by default), and sends the signed \`interaction.json\`
  attached as an \`application/json\` part. The key never leaves your machine.

  This is the recommended payer path. It replaces the two-step
  \`pay-email-step\` + \`send --attachment interaction.json\` dance: no manual
  address or threading wrangling. Use \`pay-email-step\` only when you need the
  signed bytes as a portable artifact without sending.

  --in-reply-to is the id of the inbound challenge email you received. It is
  fetched to derive the recipient (the payee, from the inbound's sender), the
  From (you, the payer, from the inbound's recipient), and the In-Reply-To
  Message-Id used to thread the authorization under the challenge. Pass --from
  only to override the derived payer From.

  Provide the challenge inline with --challenge, from a file with
  --challenge-file, or piped on stdin.`;

  static summary =
    "Sign an email x402 challenge and send the signed interaction.json in-thread (one step)";

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
        "Id of the inbound challenge email you received. It is fetched to derive the payee recipient, the payer From, and the Message-Id used to thread the authorization.",
      required: true,
    }),
    from: Flags.string({
      description:
        "Optional From header override. Defaults to the inbound's recipient (the payer the challenge was addressed to).",
    }),
    body: Flags.string({
      description: `Plain-text body. The signed authorization travels in the interaction.json attachment; this is the human-readable accompanying note. Defaults to "${DEFAULT_BODY_TEXT}".`,
    }),
    wait: Flags.boolean({
      description:
        "Block until the receiving MTA returns an outcome. Without --wait, the call returns once Primitive has accepted the message for delivery.",
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

      // Fetch the inbound challenge email to derive addressing + threading. The
      // payer is the address the challenge was sent to (the inbound's
      // recipient); the payee is the inbound's sender; the Message-Id threads
      // the authorization under the challenge. We do not deliver via reply
      // (its parent-thread dedup swallows repeat challenges to the same payer),
      // so we resolve these here and hand them to the send path explicitly.
      const inboundResult = await getEmail({
        client: apiClient.client,
        path: { id: flags["in-reply-to"] },
        responseStyle: "fields",
      });
      if (inboundResult.error) {
        const errorPayload = extractErrorPayload(inboundResult.error);
        writeErrorWithHints(errorPayload);
        surfaceUnauthorizedHint({
          ...authFailureContext,
          payload: errorPayload,
        });
        process.exitCode = 1;
        return;
      }
      const inbound = emailDetailFromEnvelope(
        inboundResult.data as { data?: EmailDetail } | undefined,
      );
      if (!inbound) {
        process.stderr.write(
          `Could not load inbound challenge email ${flags["in-reply-to"]}: the API returned no email.\n`,
        );
        process.exitCode = 1;
        return;
      }

      // To = the payee that issued the challenge (the inbound's canonical
      // sender). From = the payer the challenge was addressed to (the inbound's
      // recipient), overridable with --from. We require a payee To; if the
      // payer From cannot be derived, --from is the fallback.
      const payeeTo = inbound.from_email;
      const derivedPayerFrom = inbound.to_email || inbound.recipient;
      const from = flags.from ?? derivedPayerFrom;
      if (!payeeTo) {
        process.stderr.write(
          `Inbound challenge email ${flags["in-reply-to"]} has no resolvable sender to address the payment to.\n`,
        );
        process.exitCode = 1;
        return;
      }
      if (!from) {
        process.stderr.write(
          `Could not derive the payer From from inbound challenge email ${flags["in-reply-to"]}; pass --from explicitly.\n`,
        );
        process.exitCode = 1;
        return;
      }

      // Send the signed envelope. The inbound matcher requires a part named
      // exactly `interaction.json` with content type `application/json`; build
      // it that way. Always include a non-empty body_text (default, overridable
      // with `--body`) even though the payload of record is the attachment.
      const result = await sendEmail({
        body: {
          from,
          to: payeeTo,
          subject: DEFAULT_SUBJECT,
          // Fall back to the default note when --body is omitted OR blank /
          // whitespace-only, so an empty override can't produce an empty body.
          body_text: flags.body?.trim() ? flags.body : DEFAULT_BODY_TEXT,
          attachments: [interactionAttachment(built)],
          // Thread the authorization under the challenge via its Message-Id.
          // Omitted when the inbound has no Message-Id; association is by the
          // interaction.json's interaction_id regardless, so delivery is
          // unaffected.
          ...(inbound.message_id ? { in_reply_to: inbound.message_id } : {}),
          ...(flags.wait !== undefined ? { wait: flags.wait } : {}),
        },
        client: apiClient.client,
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
