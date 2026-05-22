import { Command, Flags } from "@oclif/core";
import type { EmailSummary } from "@primitivedotdev/api-core";
import { listEmails } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  extractErrorPayload,
  removeStaleSavedCredentialOnUnauthorized,
  runWithTiming,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";

// `primitive emails:latest` is the agent-grade shortcut for "show me
// the most recent inbound emails as something I can read at a glance."
// `emails:list-emails` returns the full JSON envelope which is great
// for piping but blows out the screen for a quick triage. The AGX
// walkthrough flagged that an agent doing inbox triage had no compact
// view to reach for; `latest` is that view.
//
// Output is a fixed-width text table: short-id, received timestamp,
// from address, to address, and subject. Subject is truncated for
// display only; the underlying JSON is unchanged. For machine-readable
// output, callers should use `emails:list-emails` and pipe to jq.

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
// Truncation widths chosen so a row fits in ~140 columns total. Long
// values wrap to "..." rather than blowing out terminal layout.
const SUBJECT_DISPLAY_WIDTH = 50;
const ADDRESS_DISPLAY_WIDTH = 32;
// Two ID widths: the short prefix is for human eyes (interactive
// TTY), the full UUID is for piped output (a script reading the row
// as a feed). The short prefix is useless when piped because every
// other operation requires the full UUID, so the AGX walkthrough
// kept producing a re-run with `--json` just to recover the id.
// Auto-switching by `process.stdout.isTTY` makes the common piped
// case a one-call workflow.
const ID_DISPLAY_WIDTH_SHORT = 8;
const ID_DISPLAY_WIDTH_FULL = 36;
const RECEIVED_DISPLAY_WIDTH = 19;

// Truncate to width with right-padding; values longer than width are
// cut to width-3 with a "..." suffix so the output is exactly `width`
// chars (3 of which are the ellipsis). Display-only; never mutates
// the underlying value the caller passed in.
//
// Width-exact output matters here: formatRow relies on each column
// being exactly its declared width so columns line up across rows.
// An overflowing truncate would shift every later column to the
// right whenever truncation fired (e.g. a row with both addresses
// truncated would push SUBJECT 4 chars off).
export function truncate(value: string, width: number): string {
  if (value.length <= width) return value.padEnd(width);
  return `${value.slice(0, width - 3)}...`;
}

// Compact ISO timestamp for display: `YYYY-MM-DD HH:MM:SS` in UTC.
// The full ISO string with milliseconds and `T`/`Z` markers is too
// dense to scan at a glance; this is the same shape git log uses.
export function formatReceivedAt(value: string | undefined | null): string {
  if (!value) return "-".padEnd(RECEIVED_DISPLAY_WIDTH);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.padEnd(RECEIVED_DISPLAY_WIDTH);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

// Decide whether to print the full UUID or the short 8-char prefix
// based on whether stdout is a TTY. Piped/redirected stdout (the
// caller is consuming the rows programmatically) gets full UUIDs;
// interactive terminals get the compact prefix. Pulled out as a
// helper so tests can drive the rendering branch without touching
// process.stdout.
export function pickIdWidth(isTty: boolean): number {
  return isTty ? ID_DISPLAY_WIDTH_SHORT : ID_DISPLAY_WIDTH_FULL;
}

export function formatRow(email: EmailSummary, idWidth: number): string {
  // idWidth is one of ID_DISPLAY_WIDTH_SHORT or ID_DISPLAY_WIDTH_FULL.
  // For SHORT, slice the UUID to the prefix length and pad. For FULL,
  // pad to the full UUID width (UUIDs are already 36 chars, so this
  // is effectively just an alignment guarantee for any malformed
  // shorter id).
  const id = truncate(email.id.slice(0, idWidth), idWidth);
  const received = formatReceivedAt(email.received_at);
  const from = truncate(email.sender ?? "", ADDRESS_DISPLAY_WIDTH);
  const to = truncate(email.recipient ?? "", ADDRESS_DISPLAY_WIDTH);
  const subject = (email.subject ?? "").replace(/\s+/g, " ");
  const subjectCol = truncate(subject, SUBJECT_DISPLAY_WIDTH);
  return `${id}  ${received}  ${from}  ${to}  ${subjectCol}`;
}

export function formatHeader(idWidth: number): string {
  return `${"ID".padEnd(idWidth)}  ${"RECEIVED (UTC)".padEnd(RECEIVED_DISPLAY_WIDTH)}  ${"FROM".padEnd(ADDRESS_DISPLAY_WIDTH)}  ${"TO".padEnd(ADDRESS_DISPLAY_WIDTH)}  SUBJECT`;
}

class EmailsLatestCommand extends Command {
  static description =
    `Print the N most recent inbound emails as a one-line-per-row text table. Designed for quick triage and visual scanning. For programmatic access, use \`primitive emails list\` (full JSON envelope, cursor pagination, filters) or pass \`--json\` here for the same raw shape without pagination/filters.

  ID display is TTY-aware. When STDOUT is a terminal, the table truncates each row's id to the first ${ID_DISPLAY_WIDTH_SHORT} characters for readability. When STDOUT is piped or redirected (the row stream is being consumed by another command), the full UUID is printed so the id can be fed straight back into \`emails:get-email\`, \`emails:delete-email\`, etc. without a separate \`--json\` round-trip.

  Output streams: the column header line is written to STDERR so the row data on STDOUT stays grep/awk-friendly. \`--json\` writes everything (including the envelope) to STDOUT and is equivalent to running \`emails list --limit N\` for the same N.`;

  static summary = "Show the most recent inbound emails as a compact table";

  static examples = [
    "<%= config.bin %> emails latest",
    "<%= config.bin %> emails latest --limit 25",
    "<%= config.bin %> emails latest | head -1 | awk '{print $1}'  # full UUID since piped",
    "<%= config.bin %> emails latest --json | jq '.data[0].id'",
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
    limit: Flags.integer({
      description: `Number of rows to print (1-${MAX_LIMIT}, default ${DEFAULT_LIMIT}).`,
      default: DEFAULT_LIMIT,
      // oclif validates min/max at parse time and emits a consistent
      // out-of-range error before run() is reached, so no manual
      // bounds check is needed here.
      min: 1,
      max: MAX_LIMIT,
    }),
    json: Flags.boolean({
      description:
        "Print the raw response envelope (with full UUIDs and meta) as JSON on STDOUT instead of the text table. Useful for piping into `jq`, capturing ids for follow-up commands, or scripting.",
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(EmailsLatestCommand);

    await runWithTiming(flags.time, async () => {
      const { apiClient, auth, baseUrlOverridden } =
        createAuthenticatedCliApiClient({
          apiKey: flags["api-key"],
          apiBaseUrl1: flags["api-base-url-1"],
          apiBaseUrl2: flags["api-base-url-2"],
          configDir: this.config.configDir,
        });

      const result = await listEmails({
        client: apiClient.client,
        query: { limit: flags.limit },
        responseStyle: "fields",
      });

      if (result.error) {
        const errorPayload = extractErrorPayload(result.error);
        writeErrorWithHints(errorPayload);
        removeStaleSavedCredentialOnUnauthorized({
          auth,
          baseUrlOverridden,
          configDir: this.config.configDir,
          payload: errorPayload,
        });
        process.exitCode = 1;
        return;
      }

      const envelope = result.data as { data?: EmailSummary[] } | undefined;

      if (flags.json) {
        // Raw envelope on stdout. Mirrors the shape `emails:list-emails`
        // emits so callers can swap one for the other when they want
        // table vs json without remembering different command names.
        this.log(JSON.stringify(envelope ?? null, null, 2));
        return;
      }

      const rows = envelope?.data ?? [];

      if (rows.length === 0) {
        process.stderr.write(
          "No inbound emails yet. Send an email to one of your verified domains to populate this list.\n",
        );
        return;
      }

      const idWidth = pickIdWidth(Boolean(process.stdout.isTTY));

      // Header on stderr so the table itself stays grep-friendly.
      process.stderr.write(`${formatHeader(idWidth)}\n`);
      for (const row of rows) {
        this.log(formatRow(row, idWidth));
      }
    });
  }
}

export default EmailsLatestCommand;
