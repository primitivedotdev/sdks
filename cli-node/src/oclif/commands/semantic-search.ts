import { Args, Command, Flags } from "@oclif/core";
import type { SemanticSearchResult } from "@primitivedotdev/api-core";
import { semanticSearch } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";

// `primitive semantic-search` is the cross-corpus, meaning-aware search
// surface. Distinct from `primitive emails list --search ...`, which is
// keyword-only and inbound-only; this one spans sent + received and can
// rank semantically.
//
// Output mirrors the `emails latest` shape: a fixed-width text table on
// stdout (header on stderr so the rows stay grep/awk-friendly), or the
// raw envelope as JSON with `--json` for piping into jq.

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const SCORE_WIDTH = 7;
const SOURCE_WIDTH = 4;
const SUBJECT_WIDTH = 40;
const FROM_WIDTH = 26;
const SNIPPET_WIDTH = 60;

function truncate(value: string, width: number): string {
  if (value.length <= width) return value.padEnd(width);
  return `${value.slice(0, width - 3)}...`;
}

function sourceLabel(t: SemanticSearchResult["source_type"]): string {
  return t === "inbound_email" ? "in" : "out";
}

function formatRow(r: SemanticSearchResult): string {
  const score = r.score.toFixed(3).padStart(SCORE_WIDTH);
  const src = sourceLabel(r.source_type).padEnd(SOURCE_WIDTH);
  const subject = truncate(
    (r.subject ?? "").replace(/\s+/g, " "),
    SUBJECT_WIDTH,
  );
  const from = truncate(r.from ?? "", FROM_WIDTH);
  const snippetText = r.snippets[0]?.text ?? "";
  const snippet = truncate(snippetText.replace(/\s+/g, " "), SNIPPET_WIDTH);
  return `${score}  ${src}  ${subject}  ${from}  ${snippet}`;
}

function formatHeader(): string {
  return `${"SCORE".padStart(SCORE_WIDTH)}  ${"SRC".padEnd(SOURCE_WIDTH)}  ${"SUBJECT".padEnd(SUBJECT_WIDTH)}  ${"FROM".padEnd(FROM_WIDTH)}  EXCERPT`;
}

class SemanticSearchCommand extends Command {
  static description = `Search received and sent mail by meaning or keywords.

  Returns ranked rows. Each row carries a relevance score, the fields it
  matched, and a match-centered excerpt. Defaults to hybrid mode (blends
  semantic and keyword signals); use \`--mode keyword\` for plain
  full-text matching and \`--mode semantic\` for embedding-only.

  Requires the Pro plan with the semantic_search_enabled entitlement.`;

  static summary =
    "Semantic / hybrid / keyword search across received and sent mail";

  static examples = [
    '<%= config.bin %> semantic-search "invoice from acme"',
    '<%= config.bin %> semantic-search "shipping update" --mode keyword',
    '<%= config.bin %> semantic-search "kickoff" --corpus inbound --limit 25',
    "<%= config.bin %> semantic-search renewal --json | jq '.data[].id'",
  ];

  static args = {
    query: Args.string({
      description: "The search query.",
      required: true,
    }),
  };

  static flags = {
    "api-key": Flags.string({
      description:
        "Primitive API key override (defaults to PRIMITIVE_API_KEY or saved OAuth login credentials)",
      env: "PRIMITIVE_API_KEY",
    }),
    "api-base-url": Flags.string({
      description: API_BASE_URL_FLAG_DESCRIPTION,
      env: "PRIMITIVE_API_BASE_URL",
      hidden: true,
    }),
    mode: Flags.string({
      description: "Ranking strategy.",
      options: ["hybrid", "semantic", "keyword"],
      default: "hybrid",
    }),
    corpus: Flags.string({
      description:
        "Restrict to inbound or outbound. Pass twice to include both (the default).",
      options: ["inbound", "outbound"],
      multiple: true,
    }),
    "date-from": Flags.string({
      description: "Only include mail at or after this ISO-8601 timestamp.",
    }),
    "date-to": Flags.string({
      description: "Only include mail at or before this ISO-8601 timestamp.",
    }),
    limit: Flags.integer({
      description: `Maximum results to return (1-${MAX_LIMIT}, default ${DEFAULT_LIMIT}).`,
      default: DEFAULT_LIMIT,
      min: 1,
      max: MAX_LIMIT,
    }),
    cursor: Flags.string({
      description:
        "Opaque pagination cursor from a prior response's meta.cursor.",
    }),
    json: Flags.boolean({
      description:
        "Print the raw response envelope as JSON on STDOUT instead of the text table.",
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SemanticSearchCommand);

    await runWithTiming(flags.time, async () => {
      const { apiClient, auth, baseUrlOverridden } =
        await createAuthenticatedCliApiClient({
          apiKey: flags["api-key"],
          apiBaseUrl: flags["api-base-url"],
          configDir: this.config.configDir,
        });

      const result = await semanticSearch({
        client: apiClient.client,
        body: {
          query: args.query,
          mode: flags.mode as "hybrid" | "semantic" | "keyword",
          ...(flags.corpus
            ? { corpus: flags.corpus as Array<"inbound" | "outbound"> }
            : {}),
          ...(flags["date-from"] ? { date_from: flags["date-from"] } : {}),
          ...(flags["date-to"] ? { date_to: flags["date-to"] } : {}),
          limit: flags.limit,
          ...(flags.cursor ? { cursor: flags.cursor } : {}),
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
        | {
            data?: SemanticSearchResult[];
            meta?: { cursor?: string | null };
          }
        | undefined;

      if (flags.json) {
        this.log(JSON.stringify(envelope ?? null, null, 2));
        return;
      }

      const rows = envelope?.data ?? [];

      if (rows.length === 0) {
        process.stderr.write("No matching mail.\n");
        return;
      }

      process.stderr.write(`${formatHeader()}\n`);
      for (const row of rows) {
        this.log(formatRow(row));
      }

      const nextCursor = envelope?.meta?.cursor ?? null;
      if (nextCursor) {
        process.stderr.write(`\nNext page: pass --cursor ${nextCursor}\n`);
      }
    });
  }
}

export default SemanticSearchCommand;
