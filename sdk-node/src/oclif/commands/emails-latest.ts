import { Command, Errors, Flags } from "@oclif/core";
import { listEmails } from "../../api/generated/sdk.gen.js";
import type { EmailSummary } from "../../api/generated/types.gen.js";
import { PrimitiveApiClient } from "../../api/index.js";
import { extractErrorPayload, writeErrorWithHints } from "../api-command.js";

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
const ID_DISPLAY_WIDTH = 8;
const RECEIVED_DISPLAY_WIDTH = 19;

// Truncate to width with right-padding; values longer than width are
// cut to width-3 with a "..." suffix. Display-only; never mutates the
// underlying value the caller passed in.
export function truncate(value: string, width: number): string {
  if (value.length <= width) return value.padEnd(width);
  return `${value.slice(0, width - 1)}...`.padEnd(width);
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

export function formatRow(email: EmailSummary): string {
  const id = truncate(email.id.slice(0, ID_DISPLAY_WIDTH), ID_DISPLAY_WIDTH);
  const received = formatReceivedAt(email.received_at);
  const from = truncate(email.sender ?? "", ADDRESS_DISPLAY_WIDTH);
  const to = truncate(email.recipient ?? "", ADDRESS_DISPLAY_WIDTH);
  const subject = (email.subject ?? "").replace(/\s+/g, " ");
  const subjectCol = truncate(subject, SUBJECT_DISPLAY_WIDTH);
  return `${id}  ${received}  ${from}  ${to}  ${subjectCol}`;
}

class EmailsLatestCommand extends Command {
  static description =
    `Print the N most recent inbound emails as a one-line-per-row text table. Designed for quick triage and visual scanning. For programmatic access, use \`primitive emails:list-emails\` (full JSON envelope, cursor pagination, filters).

  The displayed id is the first ${ID_DISPLAY_WIDTH} characters of the email's UUID; pass the full UUID (from \`emails:list-emails\` or \`emails:get-email\`) to operations that need it.`;

  static summary = "Show the most recent inbound emails as a compact table";

  static examples = [
    "<%= config.bin %> emails:latest",
    "<%= config.bin %> emails:latest --limit 25",
  ];

  static flags = {
    "api-key": Flags.string({
      description: "Primitive API key (defaults to PRIMITIVE_API_KEY)",
      env: "PRIMITIVE_API_KEY",
    }),
    "base-url": Flags.string({
      description: "API base URL (defaults to PRIMITIVE_API_URL or production)",
      env: "PRIMITIVE_API_URL",
    }),
    limit: Flags.integer({
      description: `Number of rows to print (1-${MAX_LIMIT}, default ${DEFAULT_LIMIT}).`,
      default: DEFAULT_LIMIT,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(EmailsLatestCommand);

    if (flags.limit < 1 || flags.limit > MAX_LIMIT) {
      throw new Errors.CLIError(`--limit must be between 1 and ${MAX_LIMIT}.`, {
        exit: 1,
      });
    }

    const apiClient = new PrimitiveApiClient({
      apiKey: flags["api-key"],
      baseUrl: flags["base-url"],
    });

    const result = await listEmails({
      client: apiClient.client,
      query: { limit: flags.limit },
      responseStyle: "fields",
    });

    if (result.error) {
      writeErrorWithHints(extractErrorPayload(result.error));
      process.exitCode = 1;
      return;
    }

    const envelope = result.data as { data?: EmailSummary[] } | undefined;
    const rows = envelope?.data ?? [];

    if (rows.length === 0) {
      process.stderr.write(
        "No inbound emails yet. Send an email to one of your verified domains to populate this list.\n",
      );
      return;
    }

    // Header on stderr so the table itself stays grep-friendly.
    const header = `${"ID".padEnd(ID_DISPLAY_WIDTH)}  ${"RECEIVED (UTC)".padEnd(RECEIVED_DISPLAY_WIDTH)}  ${"FROM".padEnd(ADDRESS_DISPLAY_WIDTH)}  ${"TO".padEnd(ADDRESS_DISPLAY_WIDTH)}  SUBJECT`;
    process.stderr.write(`${header}\n`);
    for (const row of rows) {
      this.log(formatRow(row));
    }
  }
}

export default EmailsLatestCommand;
