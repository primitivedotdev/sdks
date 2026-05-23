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
  removeStaleSavedCredentialOnUnauthorized,
  runWithTiming,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import { deriveSubject, pickDefaultFromAddress } from "../outbound-defaults.js";
import {
  collectNewAcceptedEmails,
  DEFAULT_EMAIL_POLL_INTERVAL_SECONDS,
  DEFAULT_EMAIL_POLL_PAGE_SIZE,
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
// MVP scope and known limitation: today the reply is matched by
// (sender = recipient) and (received_at > send time). Subject is not
// used for matching to stay robust to recipients that rewrite it.
// This is racy if a second unrelated inbound from the same sender
// lands during the wait window; in practice that is rare for
// agent-style endpoints and the wait window is short. The proper
// fix is server-side filtering on `in_reply_to_email_id` in the
// emails search; tracked as a follow-up.

const DEFAULT_CHAT_TIMEOUT_SECONDS = 120;

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
        createAuthenticatedCliApiClient({
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
        removeStaleSavedCredentialOnUnauthorized({
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
        const body = reply.body_text ?? "";
        this.log(body);
      }
    });
  }
}

type WaitForReplyParams = {
  apiClient: ReturnType<typeof createAuthenticatedCliApiClient>["apiClient"];
  authFailureContext: {
    auth: ReturnType<typeof createAuthenticatedCliApiClient>["auth"];
    baseUrlOverridden: boolean;
    configDir: string;
  };
  from: string;
  interval: number;
  pageSize: number;
  recipient: string;
  sentAtIso: string;
  timeoutSeconds: number;
};

async function waitForReply(
  params: WaitForReplyParams,
): Promise<EmailDetail | null> {
  const deadline =
    params.timeoutSeconds === 0
      ? null
      : Date.now() + params.timeoutSeconds * 1000;
  const seenIds = new Set<string>();
  let cursor: string | null = null;

  while (deadline === null || Date.now() < deadline) {
    const page = await fetchEmailSearchPage({
      apiClient: params.apiClient,
      cursor,
      filters: {
        from: params.recipient,
        to: params.from,
      },
      pageSize: params.pageSize,
      since: params.sentAtIso,
    });

    if (!page.ok) {
      const payload = extractErrorPayload(page.error);
      writeErrorWithHints(payload);
      removeStaleSavedCredentialOnUnauthorized({
        ...params.authFailureContext,
        payload,
      });
      throw new Errors.CLIError("Failed to poll for reply.", { exit: 1 });
    }

    cursor = page.cursor ?? cursor;

    const matches = collectNewAcceptedEmails(page.rows, seenIds);
    if (matches.length > 0) {
      const firstId = matches[0].id;
      const full = await getEmail({
        client: params.apiClient.client,
        path: { id: firstId },
        responseStyle: "fields",
      });
      if (full.error) {
        const payload = extractErrorPayload(full.error);
        writeErrorWithHints(payload);
        removeStaleSavedCredentialOnUnauthorized({
          ...params.authFailureContext,
          payload,
        });
        throw new Errors.CLIError(
          `Reply landed but fetching the full body failed (id=${firstId}).`,
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
          `Reply landed but the email body could not be loaded (id=${firstId}).`,
          { exit: 1 },
        );
      }
      return detail;
    }

    if (page.rows.length > 0) continue;
    if (deadline !== null && Date.now() >= deadline) break;
    await sleep(params.interval * 1000);
  }

  return null;
}

export default ChatCommand;
