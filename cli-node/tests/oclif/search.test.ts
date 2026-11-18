import { describe, expect, it } from "vitest";
import SearchCommand from "../../src/oclif/commands/search.js";
import { COMMANDS } from "../../src/oclif/index.js";

// `prim search` is the canonical search verb. Lexical (default) covers
// every indexed field on inbound mail via the positional `q`;
// `--mode` switches dispatch to the semantic backend.

describe("search command registration", () => {
  it("is registered as a root command in COMMANDS", () => {
    expect(COMMANDS.search).toBe(SearchCommand);
  });

  it("declares a required positional query arg", () => {
    const args = (
      SearchCommand as unknown as {
        args: Record<string, { required?: boolean }>;
      }
    ).args;
    expect(args.query).toBeDefined();
    expect(args.query.required).toBe(true);
  });

  it("declares --mode with the three semantic backends and no default", () => {
    const flags = (
      SearchCommand as unknown as {
        flags: Record<
          string,
          { options?: string[]; default?: unknown; required?: boolean }
        >;
      }
    ).flags;
    expect(flags.mode).toBeDefined();
    expect(flags.mode.options).toEqual(["hybrid", "semantic", "keyword"]);
    // Default is undefined so the lexical hot path stays free of the
    // semantic_search_enabled entitlement check.
    expect(flags.mode.default).toBeUndefined();
    expect(flags.mode.required).toBeFalsy();
  });

  it("exposes the lexical-only structured filters", () => {
    const flags = (
      SearchCommand as unknown as { flags: Record<string, unknown> }
    ).flags;
    for (const name of [
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
      "thread-id",
      "prefix",
      "count",
      "date-from",
      "date-to",
      "limit",
      "cursor",
      "json",
      "corpus",
    ]) {
      expect(flags[name]).toBeDefined();
    }
    expect(flags.envelope).toBeUndefined();
  });

  it("removes the retired topic-nested spelling", () => {
    expect(COMMANDS["search:semantic-search"]).toBeUndefined();
    expect(COMMANDS["semantic-search"]).toBeDefined();
  });
});
