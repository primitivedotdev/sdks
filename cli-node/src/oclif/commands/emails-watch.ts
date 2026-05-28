import { Command, Errors, Flags } from "@oclif/core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  extractErrorPayload,
  surfaceUnauthorizedHint,
  writeErrorWithHints,
} from "../api-command.js";
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

function cliError(message: string): Errors.CLIError {
  return new Errors.CLIError(message, { exit: 1 });
}

class EmailsWatchCommand extends Command {
  static description =
    "Poll for new inbound emails and print matching messages as they arrive.";

  static summary = "Watch inbound emails with filters";

  static examples = [
    "<%= config.bin %> emails watch --to support@example.com",
    "<%= config.bin %> emails watch --subject verify --seconds 300",
    "<%= config.bin %> emails watch --number 20 --jsonl",
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
      description: "Filter by sender address or domain",
    }),
    "has-attachment": Flags.boolean({
      description: "Only show emails with one or more attachments",
    }),
    "include-existing": Flags.boolean({
      description:
        "Start from existing matching emails instead of only new arrivals",
    }),
    interval: Flags.integer({
      default: DEFAULT_EMAIL_POLL_INTERVAL_SECONDS,
      description: "Seconds to wait between empty polls",
      min: 1,
    }),
    jsonl: Flags.boolean({
      description: "Print each email as one JSON object per line",
    }),
    number: Flags.integer({
      description: "Exit after printing this many matching emails",
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
    seconds: Flags.integer({
      description: "Exit after this many seconds",
      min: 1,
    }),
    since: Flags.string({
      description: "Only show emails received on or after this date/time",
    }),
    "spam-score-gte": Flags.integer({
      description:
        "Only show emails with spam score greater than or equal to this value",
    }),
    "spam-score-lt": Flags.integer({
      description: "Only show emails with spam score below this value",
    }),
    subject: Flags.string({
      description: "Full-text subject filter",
    }),
    to: Flags.string({
      description: "Filter by recipient address or domain",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(EmailsWatchCommand);
    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });

    let since: string | undefined;
    try {
      since = sinceFromFlags(flags);
    } catch (error) {
      throw cliError(error instanceof Error ? error.message : String(error));
    }

    const filters = filtersFromFlags(flags);
    const deadline = flags.seconds ? Date.now() + flags.seconds * 1000 : null;
    const idWidth = pickIdWidth(Boolean(process.stdout.isTTY));
    const seenIds = new Set<string>();
    let cursor: string | null = null;
    let printed = 0;
    let headerPrinted = false;

    while (deadline === null || Date.now() < deadline) {
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
        if (flags.jsonl) {
          this.log(JSON.stringify(email));
        } else {
          if (!headerPrinted) {
            process.stderr.write(`${formatHeader(idWidth)}\n`);
            headerPrinted = true;
          }
          this.log(formatRow(email, idWidth));
        }
        printed += 1;
        if (flags.number && printed >= flags.number) return;
      }

      if (cursorAdvanced) continue;
      if (deadline !== null && Date.now() >= deadline) break;
      await sleep(flags.interval * 1000);
    }
  }
}

export default EmailsWatchCommand;
