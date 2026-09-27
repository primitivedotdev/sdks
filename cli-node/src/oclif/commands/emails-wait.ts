import { Command, Errors, Flags } from "@oclif/core";
import type { EmailSummary } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  extractErrorPayload,
  surfaceUnauthorizedHint,
  writeErrorWithHints,
} from "../api-command.js";
import {
  findScopedChatReply,
  isConnectedChatCredential,
} from "../scoped-chat.js";
import { resolveScopedEmailWait } from "../scoped-email-wait.js";
import { formatHeader, formatRow, pickIdWidth } from "./emails-latest.js";
import {
  collectNewAcceptedEmails,
  cursorFromAcceptedRows,
  DEFAULT_EMAIL_POLL_INTERVAL_SECONDS,
  DEFAULT_EMAIL_POLL_PAGE_SIZE,
  fetchEmailSearchPage,
  filtersFromFlags,
  MAX_EMAIL_POLL_PAGE_SIZE,
  sinceFromFlags,
  sleep,
} from "./emails-poll.js";

const DEFAULT_WAIT_TIMEOUT_SECONDS = 300;

function cliError(message: string): Errors.CLIError {
  return new Errors.CLIError(message, { exit: 1 });
}

class EmailsWaitCommand extends Command {
  static description =
    `Poll until matching inbound emails arrive, printing each match as it is found.

  Connected agents require --reply-to-sent-email-id and an exact peer --from.
  The receiving address is derived from the existing sent email; optional --to
  must match it. Existing replies are included by default unless --since narrows
  the window. Matching requires the exact sent ID, receiving address, and an
  authenticated peer. Interaction attachments and incomplete replies remain
  pending for inspection. JSONL contains each matching email detail; --table
  prints compact rows. A plain reply does not prove task completion.

  Connected waits do not support account-wide search or additional content
  filters. The command never sends mail. On timeout it exits 1; run the same
  wait again to recover a reply to the existing send without resending it.`;

  static summary = "Wait for matching inbound emails";

  static examples = [
    "<%= config.bin %> emails wait --reply-to-sent-email-id <sent-id> --from peer@example.com",
    "<%= config.bin %> emails wait --to test@example.com",
    "<%= config.bin %> emails wait --subject verify --number 5 --timeout 120",
    "<%= config.bin %> emails wait --q 'domain:example.com' --table",
  ];

  static flags = {
    "api-key": Flags.string({
      description:
        "Primitive API key override (defaults to PRIMITIVE_API_KEY or saved OAuth login credentials)",
      env: "PRIMITIVE_API_KEY",
    }),
    "api-base-url": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL",
      hidden: true,
    }),
    body: Flags.string({
      description: "Full-text body filter",
    }),
    domain: Flags.string({
      description: "Filter by inbound email domain",
    }),
    "domain-id": Flags.string({
      description: "Filter by domain UUID",
    }),
    from: Flags.string({
      description:
        "Sender address or domain; connected agents require an exact peer address",
    }),
    "has-attachment": Flags.boolean({
      description: "Only match emails with one or more attachments",
    }),
    "include-existing": Flags.boolean({
      description:
        "Start from existing matching emails; this is the default for connected exact-parent waits",
    }),
    interval: Flags.integer({
      default: DEFAULT_EMAIL_POLL_INTERVAL_SECONDS,
      description: "Seconds to wait between empty polls",
      min: 1,
    }),
    number: Flags.integer({
      char: "n",
      default: 1,
      description: "Exit successfully after this many matching emails",
      min: 1,
    }),
    "page-size": Flags.integer({
      default: DEFAULT_EMAIL_POLL_PAGE_SIZE,
      description: `Emails to fetch per poll (1-${MAX_EMAIL_POLL_PAGE_SIZE})`,
      max: MAX_EMAIL_POLL_PAGE_SIZE,
      min: 1,
    }),
    q: Flags.string({
      description: "Full-text search DSL query",
    }),
    "reply-to-sent-email-id": Flags.string({
      description:
        "Filter to inbound emails that are threaded replies to a specific outbound send (UUID from a /v1/send-mail response). Combine with --to and --since for the strictest version of the wait-for-reply pattern.",
    }),
    since: Flags.string({
      description: "Only match emails received on or after this date/time",
    }),
    "spam-score-gte": Flags.integer({
      description:
        "Only match emails with spam score greater than or equal to this value",
    }),
    "spam-score-lt": Flags.integer({
      description: "Only match emails with spam score below this value",
    }),
    subject: Flags.string({
      description: "Full-text subject filter",
    }),
    table: Flags.boolean({
      description: "Print a human-readable table instead of JSONL",
    }),
    timeout: Flags.integer({
      default: DEFAULT_WAIT_TIMEOUT_SECONDS,
      description: "Seconds to wait before exiting nonzero; 0 waits forever",
      min: 0,
    }),
    to: Flags.string({
      description:
        "Recipient address or domain; connected waits derive it from the referenced send",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(EmailsWaitCommand);
    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });

    const connected = isConnectedChatCredential(auth.apiKey);
    let since: string | undefined;
    try {
      since = sinceFromFlags(
        connected ? { ...flags, "include-existing": true } : flags,
      );
    } catch (error) {
      throw cliError(error instanceof Error ? error.message : String(error));
    }

    const filters = filtersFromFlags(flags);
    const deadline =
      flags.timeout === 0 ? null : Date.now() + flags.timeout * 1000;
    const scoped = connected
      ? await resolveScopedEmailWait({ apiClient, filters, deadline })
      : null;
    const idWidth = pickIdWidth(Boolean(process.stdout.isTTY));
    const seenIds = new Set<string>();
    let cursor: string | null = null;
    let matched = 0;
    let headerPrinted = false;

    const printEmail = (email: EmailSummary) => {
      if (flags.table) {
        if (!headerPrinted) {
          process.stderr.write(`${formatHeader(idWidth)}\n`);
          headerPrinted = true;
        }
        this.log(formatRow(email, idWidth));
      } else this.log(JSON.stringify(email));
      matched += 1;
    };

    while (
      (!connected || scoped !== null) &&
      (deadline === null || Date.now() < deadline)
    ) {
      if (scoped) {
        const email = await findScopedChatReply({
          apiClient,
          ...scoped,
          // Inbox date_from is created_at, so apply received --since locally.
          // A reply created before the cutoff may have been received later.
          deadline,
          seenIds,
          pageSize: flags["page-size"],
          notice: (message) => process.stderr.write(`${message}\n`),
        });
        if (email) {
          seenIds.add(email.id);
          // The list API filters created_at; wait's --since promises received_at.
          const receivedAt = Date.parse(email.received_at);
          if (!Number.isFinite(receivedAt))
            throw cliError(
              "The matching reply has an invalid received timestamp.",
            );
          if (since !== undefined && receivedAt < Date.parse(since)) continue;
          printEmail(email);
          if (matched >= flags.number) return;
          continue;
        }
        if (deadline !== null && Date.now() >= deadline) break;
        await sleep(
          Math.min(
            flags.interval * 1000,
            deadline === null ? Infinity : Math.max(0, deadline - Date.now()),
          ),
        );
        continue;
      }
      const page = await fetchEmailSearchPage({
        apiClient,
        cursor,
        filters,
        pageSize: flags["page-size"],
        since,
      });

      if (!page.ok) {
        const payload = extractErrorPayload(page.error);
        writeErrorWithHints(payload);
        surfaceUnauthorizedHint({
          auth,
          baseUrlOverridden,
          configDir: this.config.configDir,
          payload,
        });
        process.exitCode = 1;
        return;
      }

      const nextCursor = cursorFromAcceptedRows(page.rows);
      const cursorAdvanced = Boolean(nextCursor && nextCursor !== cursor);
      if (nextCursor) cursor = nextCursor;

      for (const email of collectNewAcceptedEmails(page.rows, seenIds)) {
        printEmail(email);
        if (matched >= flags.number) return;
      }

      if (cursorAdvanced) continue;
      if (deadline !== null && Date.now() >= deadline) break;
      await sleep(flags.interval * 1000);
    }

    process.stderr.write(
      `Timed out waiting for ${flags.number} matching email${flags.number === 1 ? "" : "s"}; received ${matched}.\n`,
    );
    process.exitCode = 1;
  }
}

export default EmailsWaitCommand;
