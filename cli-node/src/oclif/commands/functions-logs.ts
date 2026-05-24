import { Command, Flags } from "@oclif/core";
import type { FunctionLogRow } from "@primitivedotdev/api-core";
import { listFunctionLogs } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import { sleep } from "./emails-poll.js";

const DEFAULT_LOG_LIMIT = 50;
const DEFAULT_LOG_POLL_INTERVAL_SECONDS = 2;

type FunctionLogsEnvelope = {
  items: FunctionLogRow[];
  next_cursor: string | null;
};

function levelLabel(level: FunctionLogRow["level"]): string {
  return level.toUpperCase().padEnd(5);
}

export function orderFunctionLogsForDisplay(
  rows: FunctionLogRow[],
): FunctionLogRow[] {
  return [...rows].reverse();
}

export function formatFunctionLogLine(row: FunctionLogRow): string {
  const metadata =
    row.metadata && Object.keys(row.metadata).length > 0
      ? ` ${JSON.stringify(row.metadata)}`
      : "";
  return `${row.ts} ${levelLabel(row.level)} ${row.message}${metadata}`;
}

export function filterNewFunctionLogs(
  rows: FunctionLogRow[],
  seenIds: Set<string>,
): FunctionLogRow[] {
  return orderFunctionLogsForDisplay(
    collectFreshFunctionLogsFromPage(rows, seenIds).freshNewestFirst,
  );
}

export function collectFreshFunctionLogsFromPage(
  rows: FunctionLogRow[],
  seenIds: Set<string>,
): { freshNewestFirst: FunctionLogRow[]; reachedSeen: boolean } {
  const freshNewestFirst: FunctionLogRow[] = [];
  let reachedSeen = false;

  for (const row of rows) {
    if (seenIds.has(row.id)) {
      reachedSeen = true;
      continue;
    }
    freshNewestFirst.push(row);
    seenIds.add(row.id);
  }

  return { freshNewestFirst, reachedSeen };
}

function emitLogRows(rows: FunctionLogRow[], jsonl: boolean): void {
  for (const row of rows) {
    const line = jsonl ? JSON.stringify(row) : formatFunctionLogLine(row);
    process.stdout.write(`${line}\n`);
  }
}

class FunctionsLogsCommand extends Command {
  static description =
    "List or follow function execution logs. Defaults to compact text output; use --jsonl for one JSON object per log row.";

  static summary = "List or follow a function's execution logs";

  static examples = [
    "<%= config.bin %> functions logs --id <fn-id>",
    "<%= config.bin %> functions logs --id <fn-id> --jsonl",
    "<%= config.bin %> functions logs --id <fn-id> --follow",
  ];

  static flags = {
    "api-key": Flags.string({
      description:
        "Primitive API key override (defaults to PRIMITIVE_API_KEY or saved OAuth login credentials)",
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
    id: Flags.string({
      description: "Function id (UUID).",
      required: true,
    }),
    limit: Flags.integer({
      default: DEFAULT_LOG_LIMIT,
      description: "Maximum rows to fetch per poll. Server clamps to 1..200.",
    }),
    cursor: Flags.string({
      description:
        "Opaque pagination cursor from a previous logs response. Not supported with --follow.",
    }),
    follow: Flags.boolean({
      char: "f",
      description: "Keep polling the newest logs and print rows not seen yet.",
    }),
    jsonl: Flags.boolean({
      description: "Print one compact JSON object per log row.",
    }),
    "poll-interval": Flags.integer({
      default: DEFAULT_LOG_POLL_INTERVAL_SECONDS,
      description: "Seconds between polls when --follow is set.",
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(FunctionsLogsCommand);

    if (flags.limit <= 0) {
      this.error("--limit must be greater than 0.", { exit: 2 });
    }
    if (flags["poll-interval"] <= 0) {
      this.error("--poll-interval must be greater than 0.", { exit: 2 });
    }
    if (flags.follow && flags.cursor) {
      this.error("--cursor cannot be combined with --follow.", { exit: 2 });
    }

    await runWithTiming(flags.time, async () => {
      const { apiClient, auth, baseUrlOverridden } =
        await createAuthenticatedCliApiClient({
          apiKey: flags["api-key"],
          apiBaseUrl1: flags["api-base-url-1"],
          apiBaseUrl2: flags["api-base-url-2"],
          configDir: this.config.configDir,
        });
      const seenIds = new Set<string>();
      let completedInitialFollowPoll = false;
      let hasObservedLogs = false;
      let wroteEmptyHint = false;

      while (true) {
        let cursor = flags.cursor;
        let nextCursor: string | null = null;
        let rows: FunctionLogRow[] = [];

        while (true) {
          const result = await listFunctionLogs({
            client: apiClient.client,
            path: { id: flags.id },
            query: {
              ...(cursor ? { cursor } : {}),
              limit: flags.limit,
            },
            responseStyle: "fields",
          });

          if (result.error) {
            const errorPayload = extractErrorPayload(result.error);
            writeErrorWithHints(errorPayload);
            surfaceUnauthorizedHint({
              auth,
              baseUrlOverridden,
              configDir: this.config.configDir,
              payload: errorPayload,
            });
            process.exitCode = 1;
            return;
          }

          const envelope = result.data as
            | { data?: FunctionLogsEnvelope }
            | undefined;
          const page = envelope?.data ?? { items: [], next_cursor: null };
          nextCursor = page.next_cursor;

          if (!flags.follow) {
            rows = orderFunctionLogsForDisplay(page.items);
            break;
          }

          if (page.items.length > 0) {
            hasObservedLogs = true;
          }

          const collected = collectFreshFunctionLogsFromPage(
            page.items,
            seenIds,
          );
          rows.push(...collected.freshNewestFirst);

          if (
            !completedInitialFollowPoll ||
            collected.reachedSeen ||
            !page.next_cursor
          ) {
            rows = orderFunctionLogsForDisplay(rows);
            break;
          }

          cursor = page.next_cursor;
        }

        if (rows.length === 0 && !wroteEmptyHint) {
          process.stderr.write(
            flags.follow
              ? hasObservedLogs
                ? "Waiting for new function logs...\n"
                : "No function logs yet. Waiting for new rows...\n"
              : "No function logs yet. Trigger the function, then run this command again.\n",
          );
          wroteEmptyHint = true;
        }

        emitLogRows(rows, flags.jsonl);

        if (!flags.follow) {
          if (nextCursor) {
            process.stderr.write(`next cursor: ${nextCursor}\n`);
          }
          return;
        }

        completedInitialFollowPoll = true;
        await sleep(flags["poll-interval"] * 1000);
      }
    });
  }
}

export default FunctionsLogsCommand;
