import { Command, Errors, Flags } from "@oclif/core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  extractErrorPayload,
  surfaceUnauthorizedHint,
  writeErrorWithHints,
} from "../api-command.js";
import {
  AUTOMATED_FLAG_DESCRIPTION,
  AUTOMATED_VALUES,
  AutomatedFilterUnsupportedError,
} from "../automated-filter.js";
import {
  focusEmptyHint,
  focusFlags,
  focusFlagValues,
  queryScopesItself,
  resolveFocus,
  writeFocusLine,
} from "../focus.js";
import {
  AWAITING_FLAG_DESCRIPTION,
  AWAITING_VALUES,
  ReplyStateUnsupportedError,
} from "../reply-state.js";
import {
  pauseForTransientFailure,
  transientFailure,
  waitOutRetryAfter,
} from "../transient-retry.js";
import { formatHeader, formatRow, pickIdWidth } from "./emails-latest.js";
import {
  collectNewAcceptedEmails,
  cursorFromAcceptedRows,
  DEFAULT_EMAIL_POLL_INTERVAL_SECONDS,
  DEFAULT_EMAIL_POLL_PAGE_SIZE,
  fetchEmailSearchPage,
  filtersFromFlags,
  type LateMailReread,
  lateMailReread,
  MAX_EMAIL_POLL_PAGE_SIZE,
  SINCE_VALUE_HELP,
  sinceFromFlags,
  sleep,
} from "./emails-poll.js";

const ELSEWHERE_CHECK_MS = 60_000;

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
    "<%= config.bin %> emails watch --awaiting you",
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
    automated: Flags.string({
      description: AUTOMATED_FLAG_DESCRIPTION,
      options: [...AUTOMATED_VALUES],
    }),
    awaiting: Flags.string({
      description: AWAITING_FLAG_DESCRIPTION,
      options: [...AWAITING_VALUES],
    }),
    body: Flags.string({
      description: "Full-text body filter",
    }),
    ...focusFlags(),
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
      description: `Only show emails received on or after this time: ${SINCE_VALUE_HELP}`,
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

    // --domain and the saved focus filter by domain id; --domain-id, --to
    // or a domain: or to: filter in --q keep their own scope.
    const focus = await resolveFocus({
      surface: "inbound",
      configDir: this.config.configDir,
      auth,
      client: apiClient.client,
      flags: focusFlagValues(flags),
      explicitScope:
        Boolean(flags["domain-id"] || flags.to) || queryScopesItself(flags.q),
      conflictingFlag: flags["domain-id"] ? "--domain-id" : undefined,
    });
    writeFocusLine(focus, false);
    const filters = {
      ...filtersFromFlags({ ...flags, domain: undefined }),
      ...(focus.focused ? { focus: focus.params } : {}),
    };
    // The note on mail elsewhere is printed once, checked at most once a
    // minute while the focused watch finds nothing.
    let elsewhereNoted = !focus.focused;
    let elsewhereCheckedAt = 0;
    const deadline = flags.seconds ? Date.now() + flags.seconds * 1000 : null;
    const idWidth = pickIdWidth(Boolean(process.stdout.isTTY));
    const seenIds = new Set<string>();
    let cursor: string | null = null;
    // Consecutive transient failures, for backoff.
    let failures = 0;
    let printed = 0;
    let headerPrinted = false;
    // Re-reads behind the cursor, once it has passed some mail.
    let reread: LateMailReread | null = null;

    while (deadline === null || Date.now() < deadline) {
      const polledAt = Date.now();
      let page: Awaited<ReturnType<typeof fetchEmailSearchPage>>;
      try {
        page = await fetchEmailSearchPage({
          apiClient,
          cursor,
          filters,
          pageSize: flags["page-size"],
          since,
        });
      } catch (error) {
        if (
          error instanceof ReplyStateUnsupportedError ||
          error instanceof AutomatedFilterUnsupportedError
        ) {
          throw cliError(error.message);
        }
        throw error;
      }

      if (!page.ok) {
        const failure = transientFailure(page);
        if (failure) {
          // Rate limited or briefly unavailable: back off until the deadline.
          if (
            !(await pauseForTransientFailure(failure, failures, { deadline }))
          )
            break;
          failures += 1;
          continue;
        }
        const payload = extractErrorPayload(page.error);
        writeErrorWithHints(payload, page.response);
        surfaceUnauthorizedHint({
          auth,
          baseUrlOverridden,
          configDir: this.config.configDir,
          payload,
        });
        process.exitCode = 1;
        return;
      }

      failures = 0;
      const nextCursor = cursorFromAcceptedRows(page.rows);
      const cursorAdvanced = Boolean(nextCursor && nextCursor !== cursor);
      if (nextCursor) cursor = nextCursor;
      if (cursor !== null)
        reread ??= lateMailReread({
          pollIntervalMs: flags.interval * 1000,
          deadline,
          start: polledAt,
        });
      // Idle: mail that became readable after the cursor passed its place.
      const recent =
        !cursorAdvanced && reread?.due()
          ? await reread.read({
              apiClient,
              filters,
              since,
              fetchPage: fetchEmailSearchPage,
            })
          : { rows: [] };

      for (const email of collectNewAcceptedEmails(
        [...page.rows, ...recent.rows],
        seenIds,
      )) {
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

      if (
        printed === 0 &&
        !elsewhereNoted &&
        Date.now() - elsewhereCheckedAt >= ELSEWHERE_CHECK_MS
      ) {
        elsewhereCheckedAt = Date.now();
        let total: number | null = null;
        let capped = false;
        const note = await focusEmptyHint(focus, async () => {
          const counted = await fetchEmailSearchPage({
            apiClient,
            count: true,
            filters: { ...filters, focus: undefined },
            pageSize: 1,
            since,
          });
          total = counted.ok ? (counted.total ?? null) : null;
          capped = counted.ok && counted.totalCapped === true;
          return total === null
            ? null
            : { total, bound: capped ? "atLeast" : undefined };
        });
        if (note && total !== null && total > 0) {
          process.stderr.write(`${note}\n`);
          elsewhereNoted = true;
        }
      }

      if (cursorAdvanced) continue;
      if (!(await waitOutRetryAfter(recent.failed, { deadline }))) break;
      if (deadline !== null && Date.now() >= deadline) break;
      await sleep(flags.interval * 1000);
    }
  }
}

export default EmailsWatchCommand;
