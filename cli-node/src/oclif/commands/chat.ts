import { Args, Command, Errors, Flags } from "@oclif/core";
import type {
  EmailDetail,
  GetEmailResponse,
  SendMailResult,
} from "@primitivedotdev/api-core";
import { getEmail, sendEmail } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import { deriveSubject, pickDefaultFromAddress } from "../outbound-defaults.js";
import {
  collectNewAcceptedEmails,
  DEFAULT_EMAIL_POLL_INTERVAL_SECONDS,
  DEFAULT_EMAIL_POLL_PAGE_SIZE,
  encodeReceivedAtSearchCursor,
  fetchEmailSearchPage,
  sleep,
} from "./emails-poll.js";

// `primitive chat` is the first-party verb for talking to an agent
// that lives behind an email address. It sends a message, waits for
// the reply, and prints the reply body. That's it.
//
// Why this is its own command and not a flag on `send`:
//
//   - `send` is transport: "put these bytes on the wire." It is
//     fire-and-forget by design; the existing `--wait` flag waits for
//     delivery confirmation (the receiving MTA's 250 OK), not for a
//     human or agent to respond.
//   - `chat` is semantic: "have a conversation with the address on
//     the other side, expecting a reply." Today the substrate is
//     email; future transports (Primitive-native fast-path, etc.)
//     can ride under the same verb without breaking callers.
//
// Reply-matching strategy. Two-phase, hybrid:
//
//   1. STRICT phase. Filter by reply_to_sent_email_id = <sent.id>.
//      The server resolves this FK at inbound ingest by matching the
//      parsed In-Reply-To header (or References as a fallback)
//      against sent_emails.message_id in the same org. Strict
//      threading: only an inbound that's a real reply to the
//      specific send we just made matches. Cheap and unambiguous.
//
//   2. FALLBACK phase. After STRICT_PHASE_SECONDS, if no strict
//      match landed, switch to a broader (from = recipient,
//      since = sent time) filter and take the first match. This
//      catches legitimate replies from mailing-list / forwarder
//      paths that strip In-Reply-To AND References, where the FK
//      never gets populated. There's a narrow correctness risk
//      (any second unrelated inbound from the same sender during
//      the fallback window would also match), but in practice the
//      window starts after most well-behaved replies would already
//      have hit the strict path.
//
// --strict-only opts out of the fallback for callers that need
// strict guarantees over success-rate.

const DEFAULT_CHAT_TIMEOUT_SECONDS = 120;
const DEFAULT_STRICT_PHASE_SECONDS = 60;

function cliError(message: string): Errors.CLIError {
  return new Errors.CLIError(message, { exit: 1 });
}

async function readStdinToString(): Promise<string> {
  if (process.stdin.isTTY) {
    throw cliError(
      "No message provided. Pass the message as the second positional argument or pipe it via stdin.",
    );
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

class ChatCommand extends Command {
  static description = `Send a message to an address and wait for the reply.

  This is the first-party verb for talking to agents that live behind
  email addresses. \`primitive send\` is transport (fire-and-forget);
  \`primitive chat\` is semantic (send + wait for the threaded reply).

  The message body can be given as the second positional argument or
  piped via stdin. The reply body is written to stdout; --json emits a
  structured envelope with both sides of the exchange.

  Matching the reply: the wait phase polls inbound mail filtered by
  the recipient as sender and the send time as a lower bound. The
  first match is taken; the full inbound row is then fetched for the
  body. Exits non-zero on timeout.`;

  static summary =
    "Chat with an agent over email (send and wait for the reply)";

  static examples = [
    "<%= config.bin %> chat help@agent.acme.dev 'how do I rotate my API key?'",
    "cat error.log | <%= config.bin %> chat help@agent.acme.dev --subject 'webhook 401s'",
    "<%= config.bin %> chat help@agent.acme.dev 'follow up question' --json",
    "<%= config.bin %> chat help@agent.acme.dev 'one more thing' --timeout 300",
  ];

  static args = {
    recipient: Args.string({
      description: "Address to chat with (e.g. help@agent.acme.dev).",
      required: true,
    }),
    message: Args.string({
      description: "Message body. If omitted, read from stdin.",
    }),
  };

  static flags = {
    "api-key": Flags.string({
      description:
        "Primitive API key (defaults to PRIMITIVE_API_KEY or saved `primitive login` credentials)",
      env: "PRIMITIVE_API_KEY",
    }),
    "api-base-url-1": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL_1",
      hidden: true,
    }),
    "api-base-url-2": Flags.string({
      description:
        "Override the attachments-supporting send host base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL_2",
      hidden: true,
    }),
    from: Flags.string({
      description:
        "Sender address. Defaults to agent@<your-first-verified-outbound-domain>.",
    }),
    subject: Flags.string({
      description:
        "Subject line. Defaults to the first line of the message when omitted.",
    }),
    "in-reply-to": Flags.string({
      description:
        "Message-Id of the parent email to thread this against. Use when continuing a prior conversation from outside the CLI; for an inbound you received via Primitive, prefer `primitive reply --id <inbound-id>`.",
    }),
    json: Flags.boolean({
      description:
        "Emit a structured JSON envelope { sent, reply } on stdout instead of just the reply body.",
    }),
    timeout: Flags.integer({
      default: DEFAULT_CHAT_TIMEOUT_SECONDS,
      description:
        "Seconds to wait for a reply before exiting non-zero; 0 waits forever.",
      min: 0,
    }),
    "strict-phase-seconds": Flags.integer({
      default: DEFAULT_STRICT_PHASE_SECONDS,
      description:
        "Seconds to wait in strict-threading mode (filter by reply_to_sent_email_id) before falling back to time-window matching. Set to the full --timeout to disable the fallback; --strict-only is the explicit way to do that.",
      min: 1,
    }),
    "strict-only": Flags.boolean({
      description:
        "Disable the time-window fallback. Only accept inbounds whose threading headers (In-Reply-To / References) resolve to this send. Recommended when correctness matters more than success rate (e.g. agents talking to agents).",
    }),
    interval: Flags.integer({
      default: DEFAULT_EMAIL_POLL_INTERVAL_SECONDS,
      description: "Seconds between polls while waiting for the reply.",
      min: 1,
    }),
    "page-size": Flags.integer({
      default: DEFAULT_EMAIL_POLL_PAGE_SIZE,
      description:
        "Inbound emails to fetch per poll while waiting (1-100). Internal tuning knob.",
      max: 100,
      min: 1,
      hidden: true,
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChatCommand);

    const message =
      args.message !== undefined && args.message !== ""
        ? args.message
        : await readStdinToString();
    if (!message.trim()) {
      throw cliError("Message body is empty.");
    }

    await runWithTiming(flags.time, async () => {
      const { apiClient, auth, baseUrlOverridden } =
        await createAuthenticatedCliApiClient({
          apiKey: flags["api-key"],
          apiBaseUrl1: flags["api-base-url-1"],
          apiBaseUrl2: flags["api-base-url-2"],
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
      const subject = flags.subject ?? deriveSubject(message);

      // Capture send time BEFORE issuing the send so the inbound
      // poll's `since` filter cannot miss a reply that races back
      // faster than we record the timestamp. A few ms of overlap
      // with our own outbound row is fine: the search is scoped to
      // inbound by endpoint (`/emails`), not outbound.
      const sentAtIso = new Date().toISOString();

      const sendResult = await sendEmail({
        body: {
          from,
          to: args.recipient,
          subject,
          body_text: message,
          ...(flags["in-reply-to"] !== undefined
            ? { in_reply_to: flags["in-reply-to"] }
            : {}),
        },
        client: apiClient._sendClient,
        responseStyle: "fields",
      });

      if (sendResult.error) {
        const errorPayload = extractErrorPayload(sendResult.error);
        writeErrorWithHints(errorPayload);
        surfaceUnauthorizedHint({
          ...authFailureContext,
          payload: errorPayload,
        });
        process.exitCode = 1;
        return;
      }

      const sentEnvelope = sendResult.data as
        | { data?: SendMailResult }
        | undefined;
      const sent = sentEnvelope?.data;
      if (!sent) {
        throw cliError("Send succeeded but the API returned no data.");
      }

      const reply = await waitForReply({
        apiClient,
        authFailureContext,
        from,
        interval: flags.interval,
        pageSize: flags["page-size"],
        recipient: args.recipient,
        sentAtIso,
        sentId: sent.id,
        strictOnly: flags["strict-only"],
        strictPhaseSeconds: flags["strict-phase-seconds"],
        timeoutSeconds: flags.timeout,
      });
      if (reply === null) {
        process.stderr.write(
          `Timed out after ${flags.timeout}s waiting for a reply from ${args.recipient}.\n`,
        );
        process.exitCode = 1;
        return;
      }

      if (flags.json) {
        const envelope = {
          sent,
          reply,
        };
        this.log(JSON.stringify(envelope, null, 2));
      } else {
        // Fall back to body_html when the reply has no body_text. HTML-
        // only replies are rare but real (some clients send multipart
        // with the text part empty), and emitting an empty string with
        // exit 0 would silently lose the message.
        const body = reply.body_text ?? reply.body_html ?? "";
        this.log(body);
      }
    });
  }
}

type WaitForReplyParams = {
  apiClient: Awaited<
    ReturnType<typeof createAuthenticatedCliApiClient>
  >["apiClient"];
  authFailureContext: {
    auth: Awaited<ReturnType<typeof createAuthenticatedCliApiClient>>["auth"];
    baseUrlOverridden: boolean;
    configDir: string;
  };
  from: string;
  interval: number;
  pageSize: number;
  recipient: string;
  sentAtIso: string;
  sentId: string;
  strictOnly: boolean;
  strictPhaseSeconds: number;
  timeoutSeconds: number;
};

async function waitForReply(
  params: WaitForReplyParams,
): Promise<EmailDetail | null> {
  const totalDeadline =
    params.timeoutSeconds === 0
      ? null
      : Date.now() + params.timeoutSeconds * 1000;
  // Strict phase ends at min(strictPhaseSeconds, total timeout). If
  // --strict-only is set, the strict phase covers the entire wait
  // window and the fallback never runs.
  const strictDeadlineFromBudget =
    Date.now() + params.strictPhaseSeconds * 1000;
  const strictDeadline = params.strictOnly
    ? totalDeadline
    : totalDeadline === null
      ? strictDeadlineFromBudget
      : Math.min(strictDeadlineFromBudget, totalDeadline);
  type Phase = {
    label: "strict" | "fallback";
    filters: { from?: string; to?: string; replyToSentEmailId?: string };
    deadline: number | null;
  };
  const phases: Phase[] = [
    {
      label: "strict",
      filters: { replyToSentEmailId: params.sentId },
      deadline: strictDeadline,
    },
  ];
  if (!params.strictOnly) {
    phases.push({
      label: "fallback",
      filters: { from: params.recipient, to: params.from },
      deadline: totalDeadline,
    });
  }

  // If the server is older than the reply_to_sent_email_id rollout it
  // silently drops the unknown query param (Zod .strip() on the search
  // schema), so a strict-phase search will return any inbound from the
  // recipient. We detect that here by verifying the candidate's FK
  // post-fetch; if it doesn't match we abort strict phase early and let
  // the fallback handle it (or time out under --strict-only).
  let strictFilterUnsupported = false;

  for (const phase of phases) {
    if (phase.label === "strict" && strictFilterUnsupported) continue;
    // Per-phase seenIds: when the strict phase silently drops the
    // filter (old server), the actual reply may surface in both
    // phases' result sets. A shared Set would let strict's rejection
    // poison fallback's view of the same row.
    const seenIds = new Set<string>();
    let cursor: string | null = null;
    while (true) {
      if (phase.deadline !== null && Date.now() >= phase.deadline) break;
      const page = await fetchEmailSearchPage({
        apiClient: params.apiClient,
        cursor,
        filters: phase.filters,
        pageSize: params.pageSize,
        since: params.sentAtIso,
      });

      if (!page.ok) {
        const payload = extractErrorPayload(page.error);
        writeErrorWithHints(payload);
        surfaceUnauthorizedHint({
          ...params.authFailureContext,
          payload,
        });
        throw new Errors.CLIError("Failed to poll for reply.", { exit: 1 });
      }

      // Advance cursor only to the last accepted/completed row in the
      // page. If we instead used page.cursor we would skip past
      // pending/processing rows that we deliberately ignored in
      // collectNewAcceptedEmails; when those later flip to accepted,
      // our next poll would start past them and never see them.
      let lastAccepted: (typeof page.rows)[number] | undefined;
      for (let i = page.rows.length - 1; i >= 0; i--) {
        const row = page.rows[i];
        if (row.status === "accepted" || row.status === "completed") {
          lastAccepted = row;
          break;
        }
      }
      if (lastAccepted) {
        cursor = encodeReceivedAtSearchCursor(lastAccepted);
      }

      const matches = collectNewAcceptedEmails(page.rows, seenIds);
      for (const match of matches) {
        const full = await getEmail({
          client: params.apiClient.client,
          path: { id: match.id },
          responseStyle: "fields",
        });
        if (full.error) {
          const payload = extractErrorPayload(full.error);
          writeErrorWithHints(payload);
          surfaceUnauthorizedHint({
            ...params.authFailureContext,
            payload,
          });
          throw new Errors.CLIError(
            `Reply landed but fetching the full body failed (id=${match.id}).`,
            { exit: 1 },
          );
        }
        const envelope = full.data as
          | { data?: EmailDetail }
          | GetEmailResponse
          | undefined;
        const detail =
          (envelope as { data?: EmailDetail } | undefined)?.data ??
          (envelope as EmailDetail | undefined) ??
          null;
        if (!detail) {
          throw new Errors.CLIError(
            `Reply landed but the email body could not be loaded (id=${match.id}).`,
            { exit: 1 },
          );
        }
        if (
          phase.label === "strict" &&
          detail.reply_to_sent_email_id !== params.sentId
        ) {
          // Server returned a candidate that doesn't actually thread
          // back to our send. The most likely cause is the server
          // hasn't shipped reply_to_sent_email_id filtering yet and
          // silently dropped the param. Skip this candidate, mark
          // strict phase unsupported, and let fallback handle it (or
          // give up immediately when --strict-only is set, in which
          // case we say so plainly).
          if (!strictFilterUnsupported) {
            process.stderr.write(
              params.strictOnly
                ? "Strict-phase reply matching is not supported by this Primitive API host; --strict-only requires server support so the command will exit without a match.\n"
                : "Strict-phase reply matching is not supported by this Primitive API host; falling back to time-window matching.\n",
            );
          }
          strictFilterUnsupported = true;
          continue;
        }
        return detail;
      }

      if (strictFilterUnsupported && phase.label === "strict") break;
      // Skip the sleep only when the cursor actually advanced, i.e.
      // there are more accepted/completed rows to page through. If a
      // page is full of pending/processing rows, lastAccepted is
      // undefined and the cursor didn't move; fetching again
      // immediately would return the same page and spin until those
      // rows transition state.
      if (lastAccepted !== undefined) continue;
      if (phase.deadline !== null && Date.now() >= phase.deadline) break;
      if (totalDeadline !== null && Date.now() >= totalDeadline) return null;
      await sleep(params.interval * 1000);
    }
  }

  return null;
}

export default ChatCommand;
