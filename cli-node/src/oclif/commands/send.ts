import { Command, Errors, Flags, type Interfaces } from "@oclif/core";
import { sendEmail } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import { readAttachmentFiles } from "../attachments.js";
import { resolveMessageBodies } from "../message-body-sources.js";
import { deriveSubject, pickDefaultFromAddress } from "../outbound-defaults.js";
import {
  buildThrownSendFailureEnvelope,
  formatSendFailureSummary,
  reportSendCommandResult,
  SEND_OUTCOME_HELP,
  sendOutcomeExitCode,
} from "../send-outcome.js";

// `primitive send` is the agent-grade shortcut for the most common
// case: send a fresh outbound email. It wraps `sending:send-email`
// with two ergonomic defaults that the underlying operation can't
// express through manifest-driven flag generation alone:
//
//   1. `--from` defaults to `agent@<first-verified-domain>` when
//      omitted. Most agents don't know which domains their org has
//      verified for outbound; making them list-domains first to
//      derive a from-address is exactly the kind of email-ops cruft
//      this command exists to hide. Customers with multiple
//      domains, or who want a different local-part, pass --from
//      explicitly.
//   2. `--subject` defaults to the first non-empty line of the body
//      (capped). Empty subjects get spam-scored, so we always emit
//      something. Callers who want full control pass --subject.
//
// `--body` here is the message body (text). The full `send-email`
// operation distinguishes `body_text` and `body_html`; this
// shortcut keeps it simple by exposing `--body` for text and
// `--html` for the HTML alternative. Users who need both can pass
// both flags or fall back to `sending:send-email` for the full
// flag list.
//
// `--attachment` reads file bytes and sends them as MIME attachments.
// `--body-file` reads a file as message text; it never attaches that
// file.
//
// Compared to `swaks` (which agents likely have in their training
// data): this is `swaks`-shaped on purpose so an agent
// pattern-matching from there lands in the happy path. We just
// don't need swaks's `--server` / `--auth-*` flags because the
// HTTPS bearer auth is implicit: saved OAuth login or an explicit API key.

class SendCommand extends Command {
  static description =
    `Send an outbound email. Agent-grade shortcut for \`sending send\` with sensible defaults.

  --from defaults to agent@<your-first-verified-outbound-domain> when omitted.
  --subject defaults to the first line of the body when omitted.
  --attachment attaches a file; repeat it to attach multiple files.

  For the full flag set (custom message-id threading on the wire,
  references arrays, etc.), use \`primitive sending send\`.

  Stdout is the send record as JSON. A one-line outcome summary goes to
  stderr ("Message sent (queued for delivery, id X). Do not resend.").
  A queued status means the message was accepted and is on its way;
  it is not a failure. --json replaces stdout with an envelope
  { outcome, exit_code, outcome_message, sent, http_status, error,
  follow_up_commands } for every outcome, including failures.

  ${SEND_OUTCOME_HELP}`;

  static summary = "Send an email (simplified, agent-friendly)";

  static examples = [
    "<%= config.bin %> send --to alice@example.com --body 'Hi Alice!'",
    "<%= config.bin %> send --to alice@example.com --body-file ./message.txt",
    "<%= config.bin %> send --to alice@example.com --body 'See attached.' --attachment ./report.pdf",
    "<%= config.bin %> send --to alice@example.com --from support@yourcompany.com --subject 'Quick question' --body 'Are you free Thursday?'",
    "<%= config.bin %> send --to alice@example.com --html '<p>Hello!</p>'",
    "<%= config.bin %> send --to alice@example.com --cc bob@example.com --bcc audit@example.com --body 'Loop bob in; audit copy stays hidden.'",
    "<%= config.bin %> send --to alice@example.com --body 'Confirmed' --wait",
    "<%= config.bin %> send --to inbox@your-managed-domain.primitive.email --body 'self-loop smoke test' --wait  # any *.primitive.email address routes back to the sending account; useful for proving outbound + inbound work end-to-end",
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
    to: Flags.string({
      description: "Recipient address (e.g. alice@example.com).",
      required: true,
    }),
    from: Flags.string({
      description:
        "Sender address. Defaults to agent@<your-first-verified-outbound-domain>.",
    }),
    subject: Flags.string({
      description:
        "Subject line. Defaults to the first line of --body / --html when omitted.",
    }),
    body: Flags.string({
      description:
        "Plain-text message body. Either --body or --html (or both) is required.",
    }),
    "body-file": Flags.string({
      description:
        "Read the plain-text message body from a UTF-8 file. This does not attach the file; use --attachment for file attachments. Mutually exclusive with --body and --body-stdin.",
    }),
    "body-stdin": Flags.boolean({
      description:
        "Read the plain-text message body from stdin. Mutually exclusive with --body and --body-file. Stdin can only be consumed once.",
    }),
    html: Flags.string({
      description:
        "HTML message body. Either --body or --html (or both) is required.",
    }),
    "html-file": Flags.string({
      description:
        "Read the HTML message body from a UTF-8 file. Mutually exclusive with --html and --html-stdin.",
    }),
    "html-stdin": Flags.boolean({
      description:
        "Read the HTML message body from stdin. Mutually exclusive with --html and --html-file. Stdin can only be consumed once.",
    }),
    attachment: Flags.string({
      description:
        "Attach a file to the email. Repeatable. Sends file bytes as a MIME attachment; use --body-file only for message body text.",
      multiple: true,
    }),
    cc: Flags.string({
      description:
        "Carbon-copy recipient. Repeatable for multiple. Cc recipients are visible to everyone who receives the message.",
      multiple: true,
    }),
    bcc: Flags.string({
      description:
        "Blind-carbon-copy recipient. Repeatable for multiple. Bcc recipients receive the message but are not disclosed to the other recipients.",
      multiple: true,
    }),
    "in-reply-to": Flags.string({
      description:
        "Message-Id of the parent email when threading a reply on the wire. For replying to an inbound message you received, prefer `primitive reply --id <inbound-id>`.",
    }),
    wait: Flags.boolean({
      description:
        "Block until the receiving MTA returns an outcome. Without --wait, the call returns once Primitive has accepted the message for delivery.",
    }),
    "wait-timeout-ms": Flags.integer({
      description:
        "Maximum time to wait when --wait is set. Defaults to 30000ms.",
    }),
    json: Flags.boolean({
      description:
        "Emit an outcome envelope { outcome, exit_code, outcome_message, sent, http_status, error, follow_up_commands } on stdout for every outcome, including failures. Without --json, stdout is the send record as before.",
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  private sendRequestStarted = false;

  async run(): Promise<void> {
    const { flags } = await this.parse(SendCommand);
    try {
      await this.sendMessage(flags);
    } catch (error) {
      // --json owes stdout an envelope for every outcome, including a
      // failure that threw instead of returning an API result.
      if (flags.json) {
        this.log(
          JSON.stringify(
            buildThrownSendFailureEnvelope({
              error,
              noun: "Message",
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
          `${formatSendFailureSummary("Message", "uncertain", undefined)} ${detail}`,
          { exit: sendOutcomeExitCode("uncertain") },
        );
      }
      throw error;
    }
  }

  private async sendMessage(
    flags: Interfaces.InferredFlags<typeof SendCommand.flags>,
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
    const attachments = readAttachmentFiles(flags.attachment);

    await runWithTiming(flags.time, async () => {
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
      const from =
        flags.from ??
        (await pickDefaultFromAddress(apiClient, authFailureContext));
      const subject =
        flags.subject ?? (bodies.body ? deriveSubject(bodies.body) : "Message");

      const attemptStartedAtIso = new Date().toISOString();
      this.sendRequestStarted = true;
      const result = await sendEmail({
        body: {
          from,
          to: flags.to,
          ...(flags.cc !== undefined ? { cc: flags.cc } : {}),
          ...(flags.bcc !== undefined ? { bcc: flags.bcc } : {}),
          subject,
          ...(bodies.body !== undefined ? { body_text: bodies.body } : {}),
          ...(bodies.html !== undefined ? { body_html: bodies.html } : {}),
          ...(attachments !== undefined ? { attachments } : {}),
          ...(flags["in-reply-to"] !== undefined
            ? { in_reply_to: flags["in-reply-to"] }
            : {}),
          ...(flags.wait !== undefined ? { wait: flags.wait } : {}),
          ...(flags["wait-timeout-ms"] !== undefined
            ? { wait_timeout_ms: flags["wait-timeout-ms"] }
            : {}),
        },
        client: apiClient.client,
        responseStyle: "fields",
      });

      // Stdout JSON is unchanged without --json so
      // `primitive send ... | jq ...` keeps parsing; the outcome
      // (including an idempotent replay, where nothing new went out)
      // is summarised on stderr and in the exit code.
      const outcome = reportSendCommandResult({
        attemptStartedAtIso,
        json: flags.json,
        log: (line) => this.log(line),
        noun: "Message",
        onApiError: (errorPayload) => {
          writeErrorWithHints(errorPayload);
          surfaceUnauthorizedHint({
            ...authFailureContext,
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

export default SendCommand;
