import { Command, Errors, Flags, type Interfaces } from "@oclif/core";
import { replyToEmail } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import { readAttachmentFiles } from "../attachments.js";
import { resolveMessageBodies } from "../message-body-sources.js";
import {
  buildThrownSendFailureEnvelope,
  checkPriorReplies,
  formatPriorRepliesCheckSkipped,
  formatPriorRepliesWarning,
  formatSendFailureSummary,
  type PriorRepliesCheck,
  reportSendCommandResult,
  SEND_OUTCOME_HELP,
  sendOutcomeExitCode,
} from "../send-outcome.js";

class ReplyCommand extends Command {
  static description = `Reply to an inbound email.

  The API derives recipients, the Re: subject, and threading headers from the inbound email id. Use \`primitive send --in-reply-to <message-id>\` only when you need to thread against a raw Message-Id instead of an inbound email stored by Primitive.

  Before sending, the CLI looks up the inbound email and warns on stderr
  when you already replied to it ("You already replied to this email at
  T (sent id S). Sending another reply."). The warning never blocks the
  send. If the lookup fails, the reply is still sent and stderr says the
  check was skipped.

  Stdout is the send record as JSON. A one-line outcome summary goes to
  stderr ("Reply sent (queued for delivery, id X). Do not resend."). A
  queued status means the reply was accepted and is on its way; it is
  not a failure. --json replaces stdout with an envelope { outcome,
  exit_code, outcome_message, sent, http_status, error,
  follow_up_commands, prior_replies, prior_replies_check } for every
  outcome, including failures.

  ${SEND_OUTCOME_HELP}`;

  static summary = "Reply to an inbound email";

  static examples = [
    "<%= config.bin %> reply --id <inbound-email-id> --body 'Thanks, got it.'",
    "<%= config.bin %> reply --id <inbound-email-id> --body-file ./reply.txt",
    "<%= config.bin %> reply --id <inbound-email-id> --body 'See attached.' --attachment ./report.pdf",
    "<%= config.bin %> reply --id <inbound-email-id> --html '<p>Thanks, got it.</p>' --wait",
    "<%= config.bin %> reply --id <inbound-email-id> --from 'Support <support@example.com>' --body 'Thanks!'",
  ];

  static flags = {
    "api-key": Flags.string({
      description:
        "Primitive API key override (defaults to PRIMITIVE_API_KEY or saved OAuth login credentials)",
      env: "PRIMITIVE_API_KEY",
    }),
    "api-base-url": Flags.string({
      description:
        "Override the API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL",
      hidden: true,
    }),
    id: Flags.string({
      description: "Inbound email id to reply to.",
      required: true,
    }),
    body: Flags.string({
      description:
        "Plain-text reply body. Either --body or --html (or both) is required.",
    }),
    "body-file": Flags.string({
      description:
        "Read the plain-text reply body from a UTF-8 file; this does not attach the file. Use --attachment for attachments. Mutually exclusive with --body and --body-stdin.",
    }),
    "body-stdin": Flags.boolean({
      description:
        "Read the plain-text reply body from stdin. Mutually exclusive with --body and --body-file. Stdin can only be consumed once.",
    }),
    html: Flags.string({
      description:
        "HTML reply body. Either --body or --html (or both) is required.",
    }),
    "html-file": Flags.string({
      description:
        "Read the HTML reply body from a UTF-8 file; this does not attach the file. Use --attachment for attachments. Mutually exclusive with --html and --html-stdin.",
    }),
    "html-stdin": Flags.boolean({
      description:
        "Read the HTML reply body from stdin. Mutually exclusive with --html and --html-file. Stdin can only be consumed once.",
    }),
    from: Flags.string({
      description:
        "Optional From header override. Defaults to the inbound recipient.",
    }),
    attachment: Flags.string({
      char: "a",
      description:
        "Attach a file to the reply. Repeat --attachment to attach multiple files.",
      multiple: true,
    }),
    wait: Flags.boolean({
      description:
        "Block until the receiving MTA returns an outcome. Without --wait, the call returns once Primitive has accepted the reply for delivery.",
    }),
    json: Flags.boolean({
      description:
        "Emit an outcome envelope { outcome, exit_code, outcome_message, sent, http_status, error, follow_up_commands, prior_replies, prior_replies_check } on stdout for every outcome, including failures. Without --json, stdout is the send record as before.",
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  private priorRepliesCheck: PriorRepliesCheck | null = null;
  private sendRequestStarted = false;

  async run(): Promise<void> {
    const { flags } = await this.parse(ReplyCommand);
    try {
      await this.sendReply(flags);
    } catch (error) {
      // --json owes stdout an envelope for every outcome, including a
      // failure that threw instead of returning an API result.
      if (flags.json) {
        this.log(
          JSON.stringify(
            buildThrownSendFailureEnvelope({
              error,
              extraEnvelopeFields: priorRepliesEnvelopeFields(
                this.priorRepliesCheck,
              ),
              noun: "Reply",
              requestStarted: this.sendRequestStarted,
            }),
            null,
            2,
          ),
        );
      }
      if (this.sendRequestStarted) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Errors.CLIError(
          `${formatSendFailureSummary("Reply", "uncertain", undefined)} ${detail}`,
          { exit: sendOutcomeExitCode("uncertain") },
        );
      }
      throw error;
    }
  }

  private async sendReply(
    flags: Interfaces.InferredFlags<typeof ReplyCommand.flags>,
  ): Promise<void> {
    const bodies = resolveMessageBodies({
      body: flags.body,
      bodyFile: flags["body-file"],
      bodyStdin: flags["body-stdin"],
      html: flags.html,
      htmlFile: flags["html-file"],
      htmlStdin: flags["html-stdin"],
    });
    if (bodies.kind === "error") {
      throw new Errors.CLIError(bodies.message);
    }

    await runWithTiming(flags.time, async () => {
      const { apiClient, auth, baseUrlOverridden } =
        await createAuthenticatedCliApiClient({
          apiKey: flags["api-key"],
          apiBaseUrl: flags["api-base-url"],
          configDir: this.config.configDir,
        });
      const attachments = readAttachmentFiles(flags.attachment);

      // Advisory only: a reply the caller already sent is worth a loud
      // warning, but the caller may mean to follow up, so never block.
      const priorRepliesCheck = await checkPriorReplies({
        client: apiClient.client,
        emailId: flags.id,
      });
      this.priorRepliesCheck = priorRepliesCheck;
      const priorRepliesMessage =
        priorRepliesCheck.status === "checked"
          ? formatPriorRepliesWarning(priorRepliesCheck.prior)
          : formatPriorRepliesCheckSkipped(flags.id, priorRepliesCheck.reason);
      if (priorRepliesMessage !== null) {
        process.stderr.write(`${priorRepliesMessage}\n`);
      }

      const attemptStartedAtIso = new Date().toISOString();
      this.sendRequestStarted = true;
      const result = await replyToEmail({
        body: {
          ...(bodies.body !== undefined ? { body_text: bodies.body } : {}),
          ...(bodies.html !== undefined ? { body_html: bodies.html } : {}),
          ...(flags.from !== undefined ? { from: flags.from } : {}),
          ...(attachments !== undefined ? { attachments } : {}),
          ...(flags.wait !== undefined ? { wait: flags.wait } : {}),
        },
        client: apiClient.client,
        path: { id: flags.id },
        responseStyle: "fields",
      });

      // Stdout JSON is unchanged without --json so
      // `primitive reply ... | jq ...` keeps parsing; the outcome
      // (including an idempotent replay, where nothing new went out)
      // is summarised on stderr and in the exit code.
      const outcome = reportSendCommandResult({
        attemptStartedAtIso,
        extraEnvelopeFields: priorRepliesEnvelopeFields(priorRepliesCheck),
        json: flags.json,
        log: (line) => this.log(line),
        noun: "Reply",
        onApiError: (errorPayload) => {
          writeErrorWithHints(errorPayload);
          surfaceUnauthorizedHint({
            auth,
            baseUrlOverridden,
            configDir: this.config.configDir,
            payload: errorPayload,
          });
        },
        result,
        writeStderr: (chunk) => {
          process.stderr.write(chunk);
        },
      });
      const exitCode = sendOutcomeExitCode(outcome);
      if (exitCode !== 0) process.exitCode = exitCode;
    });
  }
}

function priorRepliesEnvelopeFields(
  check: PriorRepliesCheck | null,
): Record<string, unknown> {
  if (check === null) {
    return { prior_replies: null, prior_replies_check: null };
  }
  return check.status === "checked"
    ? {
        prior_replies: check.prior,
        prior_replies_check: { status: "checked" },
      }
    : {
        prior_replies: null,
        prior_replies_check: { status: "skipped", reason: check.reason },
      };
}

export default ReplyCommand;
