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
import {
  haltAutoWorking,
  isSentSignal,
  restoreAutoWorking,
} from "../auto-signals.js";
import { followEmailConversation } from "../conversation-follow.js";
import {
  buildFyiMessageContent,
  carriesInteraction,
  FYI_FLAG_DESCRIPTION,
  FyiMessageError,
  uuidsFromSeed,
} from "../fyi-message.js";
import {
  type InteractionWarning,
  replyInteractionWarning,
} from "../interaction-actions.js";
import { currentMailSessionKey } from "../mail-session.js";
import { resolveMessageBodies } from "../message-body-sources.js";
import { warnIfSharedProfile } from "../profile-session-check.js";
import {
  formatRepeatStarted,
  repeatFlags,
  repeatFromFlags,
  writeRepeatErrorHint,
} from "../repeat-flags.js";
import {
  assertValidIdempotencyKey,
  buildThrownSendFailureEnvelope,
  checkPriorReplies,
  deriveSendIdempotencyKey,
  formatPriorRepliesCheckSkipped,
  formatPriorRepliesWarning,
  formatSendFailureSummary,
  IDEMPOTENCY_KEY_FLAG_DESCRIPTION,
  type PriorRepliesCheck,
  reportSendCommandResult,
  SEND_OUTCOME_HELP,
  sendOutcomeExitCode,
} from "../send-outcome.js";
import { sharedMailScope } from "../shared-mail-receiver.js";
import {
  type LatestInboundResolution,
  resolveLatestInboundInThread,
  ThreadResolutionError,
} from "../thread-latest-inbound.js";

class ReplyCommand extends Command {
  static description = `Reply to an inbound email.

  The API derives recipients, the Re: subject, and threading headers from the inbound email id. Pass --thread <thread-id> instead of --id to answer the newest inbound email in a thread, so a reply never answers an older message while newer ones wait. Use \`primitive send --in-reply-to <message-id>\` only when you need to thread against a raw Message-Id instead of an inbound email stored by Primitive.

  Before sending, the CLI looks up the inbound email and warns on stderr
  when prior outgoing emails reference it. These may include activity
  updates and do not prove a completed answer. The warning never blocks
  the send. If the lookup fails, the reply is still sent and stderr says
  the check was skipped. A connected native session requires the lookup
  to succeed so it can follow this conversation before sending. Thread
  ownership or local storage failures then stop before sending.

  Stdout is the send record as JSON. A one-line outcome summary goes to
  stderr ("Reply sent (queued for delivery, id X). Do not resend."). A
  queued status means the reply was accepted and is on its way; it is
  not a failure. --json replaces stdout with one envelope { outcome,
  exit_code, outcome_message, sent_email_id, idempotency_key, sent,
  http_status, error, follow_up_commands, prior_replies,
  prior_replies_check, interaction_warning } for every outcome, including failures, and
  moves stderr notices into its warnings array, so output merged with
  2>&1 still parses. If the outcome is uncertain, reconcile with
  \`primitive sent get --idempotency-key <key>\` before retrying.

  --all replies to everyone on the email: the sender (or Reply-To) as
  To, and every other To and Cc address of the email as Cc, minus your
  own address. Bcc is never included. Every send rule applies to each
  recipient. \`primitive emails get --brief\` lists who else was
  addressed. --all cannot be combined with --fyi.

  --fyi sends the reply as an informational acknowledgement: an ack
  signal (status received) whose note is the plain-text body.
  Receivers classify it as informational and do not wake for it. Use
  it for replies that need no answer. It takes plain text only (no
  HTML or attachments, at most 2000 characters) and is refused when
  the email being answered is itself a signal or interaction.

  A plain reply to an email the server classifies as an interaction
  (for example a payment or contact request) does not complete that
  interaction, and an informational (fyi) email or status signal needs
  no reply. In those cases the reply is still sent, and a one-line
  warning naming the command that answers the interaction goes to
  stderr (with --json: interaction_warning { code, email_id, kind,
  category, message, expected }; null otherwise). The classification
  comes only from the server's interaction_hint, interaction_kind and
  fyi fields.

  ${SEND_OUTCOME_HELP}`;

  static summary = "Reply to an inbound email";

  static examples = [
    "<%= config.bin %> reply --id <inbound-email-id> --body 'Thanks, got it.'",
    "<%= config.bin %> reply --id <inbound-email-id> --body-file ./reply.txt",
    "<%= config.bin %> reply --id <inbound-email-id> --body 'See attached.' --attachment ./report.pdf",
    "<%= config.bin %> reply --id <inbound-email-id> --html '<p>Thanks, got it.</p>' --wait",
    "<%= config.bin %> reply --id <inbound-email-id> --from 'Support <support@example.com>' --body 'Thanks!'",
    "<%= config.bin %> reply --thread <thread-id> --body 'Answering the latest message.'",
    "<%= config.bin %> reply --id <inbound-email-id> --fyi --body 'Done, merged. No action needed.'",
    "<%= config.bin %> reply --id <inbound-email-id> --all --body 'Answering everyone on this email.'",
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
      description:
        "Inbound email id to reply to. Exactly one of --id or --thread is required.",
      exactlyOne: ["id", "thread"],
    }),
    thread: Flags.string({
      description:
        "Thread id. Replies to the newest inbound email in the thread. Exactly one of --id or --thread is required.",
      exactlyOne: ["id", "thread"],
    }),
    fyi: Flags.boolean({
      description: FYI_FLAG_DESCRIPTION,
      exclusive: ["html", "html-file", "html-stdin", "attachment", "all"],
    }),
    all: Flags.boolean({
      description:
        "Reply to everyone on the email: the sender (or Reply-To) as To, every other To and Cc address as Cc, minus your own address. Bcc is never included.",
      exclusive: ["fyi"],
    }),
    body: Flags.string({
      description:
        "Plain-text reply body. Either --body or --html (or both) is required, except with --fyi.",
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
    "idempotency-key": Flags.string({
      description: IDEMPOTENCY_KEY_FLAG_DESCRIPTION,
    }),
    json: Flags.boolean({
      description:
        "Emit one outcome envelope { outcome, exit_code, outcome_message, sent_email_id, idempotency_key, sent, http_status, error, follow_up_commands, prior_replies, prior_replies_check } on stdout for every outcome, including failures, with nothing on stderr. Without --json, stdout is the send record as before.",
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
    ...repeatFlags(
      ["fyi", "attachment", "all"],
      "The reply recipient (the Reply-To address, else the sender) must be an address in your organization, and the reply cannot use --attachment, --fyi or --all.",
    ),
  };

  private attemptStartedAtIso: string | null = null;
  private idempotencyKey: string | null = null;
  private priorRepliesCheck: PriorRepliesCheck | null = null;
  private interactionWarning: InteractionWarning | null = null;
  private replyTarget: LatestInboundResolution | null = null;
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
              attemptStartedAtIso: this.attemptStartedAtIso,
              error,
              idempotencyKey: this.idempotencyKey,
              extraEnvelopeFields: {
                ...priorRepliesEnvelopeFields(this.priorRepliesCheck),
                ...replyTargetEnvelopeFields(flags, this.replyTarget),
                interaction_warning: this.interactionWarning,
              },
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
      const attachments = readAttachmentFiles(flags.attachment);
      const repeat = repeatFromFlags(flags);
      const receivingSince = new Date().toISOString();

      let emailId: string;
      if (flags.thread !== undefined) {
        try {
          this.replyTarget = await resolveLatestInboundInThread({
            client: apiClient.client,
            threadId: flags.thread,
          });
        } catch (error) {
          if (error instanceof ThreadResolutionError)
            throw new Errors.CLIError(error.message);
          throw error;
        }
        emailId = this.replyTarget.emailId;
        if (!flags.json)
          process.stderr.write(
            `Replying to ${emailId}, the newest inbound email in thread ${flags.thread}.\n`,
          );
      } else {
        emailId = flags.id as string;
      }

      // Advisory only: a reply the caller already sent is worth a loud
      // warning, but the caller may mean to follow up, so never block.
      const priorRepliesCheck = await checkPriorReplies({
        client: apiClient.client,
        emailId,
        isLocalSignal: (sentId) => isSentSignal(this.config.configDir, sentId),
      });
      this.priorRepliesCheck = priorRepliesCheck;
      const priorRepliesMessage =
        priorRepliesCheck.status === "checked"
          ? formatPriorRepliesWarning(priorRepliesCheck.prior)
          : formatPriorRepliesCheckSkipped(emailId, priorRepliesCheck.reason);
      if (priorRepliesMessage !== null) {
        process.stderr.write(`${priorRepliesMessage}\n`);
      }

      // Advisory only: a prose reply to an interaction (or to mail that
      // needs no reply) still goes out. Decided from the server's
      // interaction_hint, interaction_kind and fyi, never from headers or
      // filenames. --fyi has its own refusal below.
      if (
        !flags.fyi &&
        priorRepliesCheck.status === "checked" &&
        priorRepliesCheck.detail?.id === emailId
      ) {
        this.interactionWarning = replyInteractionWarning(
          priorRepliesCheck.detail,
          emailId,
        );
        if (this.interactionWarning && !flags.json)
          process.stderr.write(`${this.interactionWarning.message}\n`);
      }

      const sessionKey = currentMailSessionKey();
      if (auth.connectedAgent && sessionKey) {
        if (
          priorRepliesCheck.status !== "checked" ||
          !priorRepliesCheck.detail ||
          priorRepliesCheck.detail.id !== emailId
        )
          throw new Errors.CLIError(
            "Conversation receiving could not be established because this email could not be read. No reply was sent; retry after the lookup succeeds.",
          );
        await followEmailConversation(
          {
            configDir: this.config.configDir,
            scope: sharedMailScope(auth.apiKey, auth.apiBaseUrl),
            recipient: auth.connectedAgent.agentAddress,
            peer: priorRepliesCheck.detail.from_email,
            sessionKey,
            since: receivingSince,
          },
          priorRepliesCheck.detail,
        );
      }

      const plainContent: {
        body_text?: string;
        body_html?: string;
        attachments?: typeof attachments;
      } = {
        ...(bodies.body !== undefined ? { body_text: bodies.body } : {}),
        ...(bodies.html !== undefined ? { body_html: bodies.html } : {}),
        ...(attachments !== undefined ? { attachments } : {}),
      };
      // The key is derived once the target is known (after --thread has
      // resolved it), so it names the email actually answered. An --fyi
      // key is derived from what the caller asked for, and the signal's
      // ids are then derived from the key, so a retry sends the same
      // request under the same key and is deduplicated.
      const idempotencyKey =
        this.idempotencyKey ??
        deriveSendIdempotencyKey(
          "reply",
          flags.fyi
            ? {
                fyi: true,
                ...(bodies.body !== undefined
                  ? { body_text: bodies.body.trimEnd() }
                  : {}),
                ...(flags.from !== undefined ? { from: flags.from } : {}),
                in_reply_to_email_id: emailId,
              }
            : {
                ...plainContent,
                ...(flags.from !== undefined ? { from: flags.from } : {}),
                ...(flags.all ? { reply_all: true } : {}),
                ...(repeat !== undefined ? { repeat } : {}),
                in_reply_to_email_id: emailId,
              },
        );
      this.idempotencyKey = idempotencyKey;

      let content: typeof plainContent = plainContent;
      if (flags.fyi) {
        const parent =
          priorRepliesCheck.status === "checked" &&
          priorRepliesCheck.detail?.id === emailId
            ? priorRepliesCheck.detail
            : null;
        if (!parent)
          throw new Errors.CLIError(
            "--fyi needs to read the email being answered, and that lookup failed. No reply was sent; retry after the lookup succeeds.",
          );
        if (carriesInteraction(parent))
          throw new Errors.CLIError(
            "The email being answered is a signal or interaction. --fyi replies to it are refused so acknowledgements cannot loop. No reply was sent.",
          );
        try {
          content = buildFyiMessageContent({
            parentMessageId: parent.message_id,
            senderAddress: flags.from ?? parent.recipient,
            recipientAddress: parent.from_email,
            note: bodies.body,
            uuid: uuidsFromSeed(idempotencyKey),
          });
        } catch (error) {
          if (error instanceof FyiMessageError)
            throw new Errors.CLIError(error.message);
          throw error;
        }
      }

      const replyBody = {
        ...content,
        ...(flags.from !== undefined ? { from: flags.from } : {}),
        ...(flags.wait !== undefined ? { wait: flags.wait } : {}),
        ...(flags.all ? { reply_all: true } : {}),
        ...(repeat !== undefined ? { repeat } : {}),
      };
      // An answer ends automatic working for the email it answers.
      const halted = await haltAutoWorking(
        this.config.configDir,
        {
          emailIds: [emailId],
          peers:
            priorRepliesCheck.status === "checked" &&
            priorRepliesCheck.detail?.from_email
              ? [priorRepliesCheck.detail.from_email]
              : [],
          profileName: auth.connectedAgent?.profileName,
          // Other emails from the same sender stay in progress unless they
          // are in this reply's thread.
          threadId:
            priorRepliesCheck.status === "checked"
              ? (priorRepliesCheck.detail?.thread_id ?? null)
              : null,
        },
        flags.fyi ? "fyi" : "reply",
      );
      const attemptStartedAtIso = new Date().toISOString();
      this.attemptStartedAtIso = attemptStartedAtIso;
      this.sendRequestStarted = true;
      const result = await replyToEmail({
        body: replyBody,
        client: apiClient.client,
        headers: { "Idempotency-Key": idempotencyKey },
        path: { id: emailId },
        responseStyle: "fields",
      });

      // Stdout JSON is unchanged without --json so
      // `primitive reply ... | jq ...` keeps parsing; the outcome
      // (including an idempotent replay, where nothing new went out)
      // is summarised on stderr and in the exit code.
      const outcome = reportSendCommandResult({
        attemptStartedAtIso,
        idempotencyKey,
        extraEnvelopeFields: {
          ...priorRepliesEnvelopeFields(priorRepliesCheck),
          ...replyTargetEnvelopeFields(flags, this.replyTarget),
          interaction_warning: this.interactionWarning,
        },
        json: flags.json,
        log: (line) => this.log(line),
        noun: "Reply",
        onApiError: (errorPayload) => {
          writeErrorWithHints(errorPayload);
          writeRepeatErrorHint(errorPayload);
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
      const repeatLine = formatRepeatStarted(result, repeat);
      if (repeatLine) process.stderr.write(`${repeatLine}\n`);
      // A refused answer reached nobody, so the sender still sees working.
      if (outcome === "not_sent") restoreAutoWorking(halted);
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
        // Status signals and fyi acknowledgements are not answers; they are
        // counted apart so prior_replies lists only real replies.
        prior_replies_check: {
          status: "checked",
          signals_excluded: check.signals ?? 0,
        },
      }
    : {
        prior_replies: null,
        prior_replies_check: { status: "skipped", reason: check.reason },
      };
}

/**
 * With --thread, --fyi or --all the envelope says which email was answered
 * and how, so a caller that only kept the JSON can still tell. Plain --id
 * replies keep their existing envelope shape.
 */
function replyTargetEnvelopeFields(
  flags: { thread?: string; fyi?: boolean; all?: boolean },
  target: LatestInboundResolution | null,
): Record<string, unknown> {
  return {
    ...(flags.thread !== undefined
      ? {
          reply_target: {
            thread_id: flags.thread,
            email_id: target?.emailId ?? null,
            resolved_by: target?.resolvedBy ?? null,
          },
        }
      : {}),
    ...(flags.fyi ? { informational: true } : {}),
    ...(flags.all ? { reply_all: true } : {}),
  };
}

export default ReplyCommand;
