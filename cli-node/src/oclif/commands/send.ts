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
import { haltAutoWorking, restoreAutoWorking } from "../auto-signals.js";
import {
  buildFyiMessageContent,
  FYI_FLAG_DESCRIPTION,
  FyiMessageError,
  uuidsFromSeed,
} from "../fyi-message.js";
import { resolveMessageBodies } from "../message-body-sources.js";
import { deriveSubject, pickDefaultFromAddress } from "../outbound-defaults.js";
import { warnIfSharedProfile } from "../profile-session-check.js";
import {
  assertValidIdempotencyKey,
  buildThrownSendFailureEnvelope,
  deriveSendIdempotencyKey,
  formatSendFailureSummary,
  IDEMPOTENCY_KEY_FLAG_DESCRIPTION,
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
  --fyi (with --in-reply-to) sends an informational acknowledgement of
  that message that receivers do not wake for. To answer an inbound
  email you received, prefer \`primitive reply --id <id> --fyi\`.

  For the full flag set (custom message-id threading on the wire,
  references arrays, etc.), use \`primitive sending send\`.

  Stdout is the send record as JSON. A one-line outcome summary goes to
  stderr ("Message sent (queued for delivery, id X). Do not resend.").
  A queued status means the message was accepted and is on its way;
  it is not a failure. --json replaces stdout with one envelope
  { outcome, exit_code, outcome_message, sent_email_id, idempotency_key,
  sent, http_status, error, follow_up_commands } for every outcome,
  including failures, and leaves stderr empty, so output merged with
  2>&1 still parses. If the outcome is uncertain, reconcile with
  \`primitive sent get --idempotency-key <key>\` before retrying.

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
    "<%= config.bin %> send --to alice@example.com --in-reply-to '<parent@example.com>' --fyi --body 'Deployed. No action needed.'",
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
    fyi: Flags.boolean({
      description: `${FYI_FLAG_DESCRIPTION} Requires --in-reply-to, the Message-Id being acknowledged.`,
      dependsOn: ["in-reply-to"],
      exclusive: ["html", "html-file", "html-stdin", "attachment"],
    }),
    wait: Flags.boolean({
      description:
        "Block until the receiving MTA returns an outcome. Without --wait, the call returns once Primitive has accepted the message for delivery.",
    }),
    "wait-timeout-ms": Flags.integer({
      description:
        "Maximum time to wait when --wait is set. Defaults to 30000ms.",
    }),
    "idempotency-key": Flags.string({
      description: IDEMPOTENCY_KEY_FLAG_DESCRIPTION,
    }),
    json: Flags.boolean({
      description:
        "Emit one outcome envelope { outcome, exit_code, outcome_message, sent_email_id, idempotency_key, sent, http_status, error, follow_up_commands } on stdout for every outcome, including failures, with nothing on stderr. Without --json, stdout is the send record as before.",
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  private attemptStartedAtIso: string | null = null;
  private idempotencyKey: string | null = null;
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
              attemptStartedAtIso: this.attemptStartedAtIso,
              error,
              idempotencyKey: this.idempotencyKey,
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
    const fyiWithoutBody =
      flags.fyi &&
      flags.body === undefined &&
      flags["body-file"] === undefined &&
      !flags["body-stdin"];
    const bodies = fyiWithoutBody
      ? { kind: "ok" as const, body: undefined, html: undefined }
      : resolveMessageBodies({
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
    if (flags["idempotency-key"] !== undefined) {
      this.idempotencyKey = assertValidIdempotencyKey(flags["idempotency-key"]);
    }
    const attachments = readAttachmentFiles(flags.attachment);

    await runWithTiming(flags.time, async () => {
      const { apiClient, auth, baseUrlOverridden } =
        await createAuthenticatedCliApiClient({
          apiKey: flags["api-key"],
          apiBaseUrl: flags["api-base-url"],
          configDir: this.config.configDir,
        });
      warnIfSharedProfile({
        configDir: this.config.configDir,
        connectedAgent: auth.connectedAgent,
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
        flags.subject ??
        (bodies.body
          ? deriveSubject(bodies.body)
          : flags.fyi
            ? "Re: Your message"
            : "Message");
      const plainContent: {
        body_text?: string;
        body_html?: string;
        attachments?: typeof attachments;
      } = {
        ...(bodies.body !== undefined ? { body_text: bodies.body } : {}),
        ...(bodies.html !== undefined ? { body_html: bodies.html } : {}),
        ...(attachments !== undefined ? { attachments } : {}),
      };
      const envelope = {
        from,
        to: flags.to,
        ...(flags.cc !== undefined ? { cc: flags.cc } : {}),
        ...(flags.bcc !== undefined ? { bcc: flags.bcc } : {}),
        subject,
      };
      const threading = {
        ...(flags["in-reply-to"] !== undefined
          ? { in_reply_to: flags["in-reply-to"] }
          : {}),
        ...(flags.wait !== undefined ? { wait: flags.wait } : {}),
        ...(flags["wait-timeout-ms"] !== undefined
          ? { wait_timeout_ms: flags["wait-timeout-ms"] }
          : {}),
      };
      // An --fyi key is derived from what the caller asked for, and the
      // signal's ids are then derived from the key, so a retry sends the
      // same request under the same key and is deduplicated.
      const idempotencyKey =
        this.idempotencyKey ??
        deriveSendIdempotencyKey(
          "send",
          flags.fyi
            ? {
                ...envelope,
                fyi: true,
                ...(bodies.body !== undefined
                  ? { body_text: bodies.body.trimEnd() }
                  : {}),
                ...threading,
              }
            : { ...envelope, ...plainContent, ...threading },
        );
      this.idempotencyKey = idempotencyKey;

      let content: typeof plainContent = plainContent;
      if (flags.fyi) {
        try {
          content = buildFyiMessageContent({
            parentMessageId: flags["in-reply-to"],
            senderAddress: from,
            recipientAddress: flags.to,
            note: bodies.body,
            uuid: uuidsFromSeed(idempotencyKey),
          });
        } catch (error) {
          if (error instanceof FyiMessageError)
            throw new Errors.CLIError(
              error.message.replace(
                "the email finishes processing",
                "you have the parent Message-Id",
              ),
            );
          throw error;
        }
      }
      const body = { ...envelope, ...content, ...threading };

      // A message to the sender of mail being worked on answers it.
      const halted = await haltAutoWorking(
        this.config.configDir,
        {
          peers: [flags.to],
          profileName: auth.connectedAgent?.profileName,
        },
        flags.fyi ? "fyi" : "reply",
      );
      const attemptStartedAtIso = new Date().toISOString();
      this.attemptStartedAtIso = attemptStartedAtIso;
      this.sendRequestStarted = true;
      const result = await sendEmail({
        body,
        client: apiClient.client,
        headers: { "Idempotency-Key": idempotencyKey },
        responseStyle: "fields",
      });

      // Stdout JSON is unchanged without --json so
      // `primitive send ... | jq ...` keeps parsing; the outcome
      // (including an idempotent replay, where nothing new went out)
      // is summarised on stderr and in the exit code.
      const outcome = reportSendCommandResult({
        attemptStartedAtIso,
        idempotencyKey,
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
      // A refused message reached nobody, so the sender still sees working.
      if (outcome === "not_sent") restoreAutoWorking(halted);
      const exitCode = sendOutcomeExitCode(outcome);
      if (exitCode !== 0) process.exitCode = exitCode;
    });
  }
}

export default SendCommand;
