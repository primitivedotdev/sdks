import { Args, Command, Flags } from "@oclif/core";
import type {
  EmailSearchMeta,
  EmailSearchResult,
  EmailStatus,
  SearchEmailsData,
  SemanticSearchResult,
} from "@primitivedotdev/api-core";
import { searchEmails, semanticSearch } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import {
  formatHeader as formatLexicalHeader,
  formatRow as formatLexicalRow,
  pickIdWidth,
} from "./emails-latest.js";
import { quoteDslValue } from "./emails-poll.js";
import {
  formatHeader as formatSemanticHeader,
  formatRow as formatSemanticRow,
} from "./semantic-search.js";

// `primitive search <query>` is the canonical search verb. Default mode
// is lexical full-text against inbound mail: the positional query is
// sent as `q=<query>` to /v1/emails/search, which matches every
// indexed field (subject, body, sender, recipient). The `--mode` flag
// switches the dispatch to /semantic-search for meaning-aware ranking
// across inbound and outbound. `primitive semantic-search` remains a
// first-class root command for users who already know they want
// semantic; this command exists so the obvious verb works without
// needing to know the topology.

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

type SemanticMode = "hybrid" | "semantic" | "keyword";
type LexicalSort = "relevance" | "received_at_desc" | "received_at_asc";
type SearchQuery = NonNullable<SearchEmailsData["query"]>;

type LexicalEnvelope = {
  data?: EmailSearchResult[];
  meta?: EmailSearchMeta;
};

type SemanticEnvelope = {
  data?: SemanticSearchResult[];
  meta?: { cursor?: string | null };
};

// Flags that only apply to the lexical backend. Rejecting them on
// --mode keeps the error specific instead of letting the semantic
// request silently drop them.
const LEXICAL_ONLY_FLAGS = [
  "from",
  "to",
  "subject",
  "body",
  "domain",
  "domain-id",
  "has-attachment",
  "status",
  "sort",
  "snippet",
  "include-facets",
] as const;

class SearchCommand extends Command {
  static description =
    `Search received (default) or both received and sent mail (with --mode).

  Default behavior is lexical full-text matching: the positional query is sent as \`q=<query>\` to the inbound search endpoint, which matches against subject, body, sender, and recipient in a single pass. Structured filters (--from, --to, --subject, --body, --domain, --has-attachment, --date-from, --date-to, --status) AND with the text query.

  Pass --mode to switch to the cross-corpus semantic backend (covers inbound and outbound). \`--mode keyword\` is plain full-text; \`--mode semantic\` is embedding-only; \`--mode hybrid\` blends both. Semantic modes require the Pro plan with the semantic_search_enabled entitlement.

  Output is a fixed-width text table by default (header on STDERR so rows stay grep/awk-friendly). Use --json for the raw envelope.`;

  static summary = "Search mail (lexical by default; --mode for semantic)";

  static examples = [
    '<%= config.bin %> search "invoice"',
    '<%= config.bin %> search "renewal" --from acme.com',
    '<%= config.bin %> search "kickoff" --mode hybrid',
    '<%= config.bin %> search "shipping" --mode keyword --corpus outbound',
    "<%= config.bin %> search \"needle\" --json | jq '.data[0].id'",
  ];

  static args = {
    query: Args.string({
      description:
        "The search query. Matched against every indexed field (subject, body, sender, recipient) when lexical; against the embedding when semantic.",
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
      description:
        "Switch to the cross-corpus semantic backend. Omit for the default lexical backend.",
      options: ["hybrid", "semantic", "keyword"],
    }),
    // Lexical-only structured filters. Rejected when --mode is set.
    from: Flags.string({
      description: "Lexical only. Filter by sender address or sender domain.",
    }),
    to: Flags.string({
      description:
        "Lexical only. Filter by recipient address or recipient domain.",
    }),
    subject: Flags.string({
      description: "Lexical only. Full-text search restricted to the subject.",
    }),
    body: Flags.string({
      description:
        "Lexical only. Full-text search restricted to the parsed text body.",
    }),
    domain: Flags.string({
      description: "Lexical only. Filter by the recipient's mail domain.",
    }),
    "domain-id": Flags.string({
      description: "Lexical only. Filter by domain ID.",
    }),
    "has-attachment": Flags.string({
      description:
        "Lexical only. Filter by whether the email has one or more attachments.",
      options: ["true", "false"],
    }),
    status: Flags.string({
      description: "Lexical only. Filter by parse status.",
      options: ["pending", "accepted", "completed", "rejected"],
    }),
    sort: Flags.string({
      description: "Lexical only. Result ordering.",
      options: ["relevance", "received_at_desc", "received_at_asc"],
    }),
    snippet: Flags.string({
      description:
        "Lexical only. Include match-centered subject/body highlights on each row.",
      options: ["true", "false"],
    }),
    "include-facets": Flags.string({
      description:
        "Lexical only. Include facet counts for sender, domain, status, and attachment presence.",
      options: ["true", "false"],
    }),
    // Semantic-only filter. Rejected when --mode is not set.
    corpus: Flags.string({
      description:
        "Semantic only. Restrict to inbound or outbound mail. Pass twice to include both (the default).",
      options: ["inbound", "outbound"],
      multiple: true,
    }),
    // Shared filters.
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
    envelope: Flags.boolean({
      description:
        "Lexical only. With --json, include facets and meta; without --json, surface the next cursor below the table.",
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SearchCommand);

    await runWithTiming(flags.time, async () => {
      const { apiClient, auth, baseUrlOverridden } =
        await createAuthenticatedCliApiClient({
          apiKey: flags["api-key"],
          apiBaseUrl: flags["api-base-url"],
          configDir: this.config.configDir,
        });

      const handleError = (error: unknown): void => {
        const errorPayload = extractErrorPayload(error);
        writeErrorWithHints(errorPayload);
        surfaceUnauthorizedHint({
          auth,
          baseUrlOverridden,
          configDir: this.config.configDir,
          payload: errorPayload,
        });
        process.exitCode = 1;
      };

      if (flags.mode) {
        if (flags.envelope) {
          process.stderr.write(
            "--envelope only applies to lexical mode. Use --json for the raw semantic envelope.\n",
          );
          process.exitCode = 2;
          return;
        }
        const incompatible = LEXICAL_ONLY_FLAGS.filter(
          (name) => (flags as Record<string, unknown>)[name] !== undefined,
        );
        if (incompatible.length > 0) {
          process.stderr.write(
            `Flag${incompatible.length === 1 ? "" : "s"} --${incompatible.join(", --")} only applies to the lexical backend. Omit --mode to use them.\n`,
          );
          process.exitCode = 2;
          return;
        }

        const result = await semanticSearch({
          client: apiClient.client,
          body: {
            query: args.query,
            mode: flags.mode as SemanticMode,
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
          handleError(result.error);
          return;
        }

        const envelope = result.data as SemanticEnvelope | undefined;

        if (flags.json) {
          this.log(JSON.stringify(envelope ?? null, null, 2));
          return;
        }

        const rows = envelope?.data ?? [];
        if (rows.length === 0) {
          process.stderr.write("No matching mail.\n");
          return;
        }

        process.stderr.write(`${formatSemanticHeader()}\n`);
        for (const row of rows) {
          this.log(formatSemanticRow(row));
        }

        const nextCursor = envelope?.meta?.cursor ?? null;
        if (nextCursor) {
          process.stderr.write(`\nNext page: pass --cursor ${nextCursor}\n`);
        }
        return;
      }

      if (flags.corpus && flags.corpus.length > 0) {
        process.stderr.write(
          "--corpus only applies to semantic mode. Pass --mode keyword|semantic|hybrid to enable it.\n",
        );
        process.exitCode = 2;
        return;
      }

      const query: SearchQuery = {
        // `domain` is expressed via the DSL on `q` rather than a
        // separate query param, mirroring how emails-poll composes it.
        q: flags.domain
          ? `${args.query} domain:${quoteDslValue(flags.domain)}`
          : args.query,
        limit: flags.limit,
      };
      if (flags.from) query.from = flags.from;
      if (flags.to) query.to = flags.to;
      if (flags.subject) query.subject = flags.subject;
      if (flags.body) query.body = flags.body;
      if (flags["domain-id"]) query.domain_id = flags["domain-id"];
      if (flags["has-attachment"]) {
        query.has_attachment = flags["has-attachment"] as "true" | "false";
      }
      if (flags.status) {
        query.status = flags.status as EmailStatus;
      }
      if (flags.sort) query.sort = flags.sort as LexicalSort;
      if (flags.snippet) query.snippet = flags.snippet as "true" | "false";
      if (flags["include-facets"]) {
        query.include_facets = flags["include-facets"] as "true" | "false";
      }
      if (flags["date-from"]) query.date_from = flags["date-from"];
      if (flags["date-to"]) query.date_to = flags["date-to"];
      if (flags.cursor) query.cursor = flags.cursor;

      const result = await searchEmails({
        client: apiClient.client,
        query,
        responseStyle: "fields",
      });

      if (result.error) {
        handleError(result.error);
        return;
      }

      const envelope = result.data as LexicalEnvelope | undefined;

      if (flags.json) {
        this.log(JSON.stringify(envelope ?? null, null, 2));
        return;
      }

      const rows = envelope?.data ?? [];
      if (rows.length === 0) {
        process.stderr.write("No matching mail.\n");
        return;
      }

      const idWidth = pickIdWidth(Boolean(process.stdout.isTTY));
      process.stderr.write(`${formatLexicalHeader(idWidth)}\n`);
      for (const row of rows) {
        this.log(formatLexicalRow(row, idWidth));
      }

      if (flags.envelope) {
        const nextCursor = envelope?.meta?.cursor ?? null;
        if (nextCursor) {
          process.stderr.write(`\nNext page: pass --cursor ${nextCursor}\n`);
        }
      }
    });
  }
}

export default SearchCommand;
