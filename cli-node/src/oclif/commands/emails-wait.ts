import { Command, Errors, Flags } from "@oclif/core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  extractErrorPayload,
  removeStaleSavedCredentialOnUnauthorized,
  writeErrorWithHints,
} from "../api-command.js";
import { formatHeader, formatRow, pickIdWidth } from "./emails-latest.js";
import {
  collectNewAcceptedEmails,
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
    "Poll until matching inbound emails arrive, printing each match as it is found.";

  static summary = "Wait for matching inbound emails";

  static examples = [
    "<%= config.bin %> emails wait --to test@example.com",
    "<%= config.bin %> emails wait --subject verify --number 5 --timeout 120",
    "<%= config.bin %> emails wait --q 'domain:example.com' --table",
  ];

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
      description: "Only match emails with one or more attachments",
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
      description: "Filter by recipient address or domain",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(EmailsWaitCommand);
    const { apiClient, auth, baseUrlOverridden } =
      createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl1: flags["api-base-url-1"],
        apiBaseUrl2: flags["api-base-url-2"],
        configDir: this.config.configDir,
      });

    let since: string | undefined;
    try {
      since = sinceFromFlags(flags);
    } catch (error) {
      throw cliError(error instanceof Error ? error.message : String(error));
    }

    const filters = filtersFromFlags(flags);
    const deadline =
      flags.timeout === 0 ? null : Date.now() + flags.timeout * 1000;
    const idWidth = pickIdWidth(Boolean(process.stdout.isTTY));
    const seenIds = new Set<string>();
    let cursor: string | null = null;
    let matched = 0;
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
        removeStaleSavedCredentialOnUnauthorized({
          auth,
          baseUrlOverridden,
          configDir: this.config.configDir,
          payload,
        });
        process.exitCode = 1;
        return;
      }

      cursor = page.cursor ?? cursor;

      for (const email of collectNewAcceptedEmails(page.rows, seenIds)) {
        if (flags.table) {
          if (!headerPrinted) {
            process.stderr.write(`${formatHeader(idWidth)}\n`);
            headerPrinted = true;
          }
          this.log(formatRow(email, idWidth));
        } else {
          this.log(JSON.stringify(email));
        }
        matched += 1;
        if (matched >= flags.number) return;
      }

      if (page.rows.length > 0) continue;
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
