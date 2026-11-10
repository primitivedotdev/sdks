import { describe, expect, it, vi } from "vitest";
import { writeErrorWithHints } from "../../src/oclif/api-command.js";
import {
  cliCommandLines,
  commandForRoute,
  withCliCommands,
} from "../../src/oclif/api-path-commands.js";
import { scopeWarningLine } from "../../src/oclif/email-rule-authoring.js";
// Importing the command table registers the commands the helper may name.
import "../../src/oclif/index.js";

const EMAIL = "0f0e0d0c-0b0a-4908-8706-050403020100";

describe("API routes named in server messages", () => {
  it("names the command that calls a route, by template or concrete path", () => {
    expect(commandForRoute("GET", "/v1/email-rule-scope-options")).toBe(
      "primitive email-rules list-email-rule-scope-options",
    );
    expect(commandForRoute("get", `/v1/emails/${EMAIL}/rule-results`)).toBe(
      "primitive email-rules list-email-rule-results",
    );
    expect(commandForRoute("GET", "/v1/emails/{id}/rule-results")).toBe(
      "primitive email-rules list-email-rule-results",
    );
    // A short name wins where the CLI has one.
    expect(commandForRoute("GET", `/v1/emails/${EMAIL}`)).toBe(
      "primitive emails get",
    );
    // A fixed route wins over a parameter route at the same place.
    expect(commandForRoute("GET", "/v1/emails/search")).toBe(
      "primitive emails search",
    );
    expect(commandForRoute("GET", "/v1/email-rules/vocabulary")).toBe(
      "primitive email-rules vocabulary",
    );
    // The hand-rolled command, where the CLI covers an operation with one.
    expect(commandForRoute("POST", "/v1/keys")).toBe("primitive keys create");
    expect(commandForRoute("PATCH", "/v1/keys/:id")).toBe(
      "primitive keys update",
    );
    expect(commandForRoute("GET", `/v1/keys/${EMAIL}`)).toBe(
      "primitive keys get",
    );
    expect(commandForRoute("POST", "/v1/credentials/revoke")).toBe(
      "primitive keys revoke",
    );
    expect(commandForRoute("PUT", `/v1/functions/${EMAIL}/route`)).toBe(
      "primitive functions route-set",
    );
    // An alias kept for an older id in another topic is not taken as a short name.
    expect(commandForRoute("POST", "/v1/organization/leave")).not.toContain(
      "primitive account",
    );
    // A dashboard-only route has no command: the API refuses the CLI there.
    expect(
      commandForRoute("GET", `/v1/keys/${EMAIL}/suggestion`),
    ).toBeUndefined();
    expect(commandForRoute("GET", "/v1/credentials")).toBeUndefined();
    expect(commandForRoute("GET", "/v1/no-such-route")).toBeUndefined();
    expect(
      commandForRoute("DELETE", "/v1/email-rule-scope-options"),
    ).toBeUndefined();
  });

  it("adds the command after each route in a message, and leaves other text alone", () => {
    const message =
      "This organization receives no mail at gmail.com, so gmail.com names nothing the rule can decide. Check the spelling, or see GET /v1/email-rule-scope-options for what you can name.";
    expect(withCliCommands(message)).toBe(
      "This organization receives no mail at gmail.com, so gmail.com names nothing the rule can decide. Check the spelling, or see GET /v1/email-rule-scope-options (primitive email-rules list-email-rule-scope-options) for what you can name.",
    );
    expect(withCliCommands("Nothing to see here.")).toBe(
      "Nothing to see here.",
    );
    // A path holding an address is read whole, not cut at the @.
    expect(
      withCliCommands("Read GET /v1/no-such/alice@example.com first."),
    ).toBe("Read GET /v1/no-such/alice@example.com first.");
    expect(withCliCommands("See GET /v1/no-such-route.")).toBe(
      "See GET /v1/no-such-route.",
    );
    expect(
      scopeWarningLine({
        name: "gmail.com",
        kind: "domain",
        reason: "unknown_domain",
        message,
      } as never),
    ).toContain(
      "GET /v1/email-rule-scope-options (primitive email-rules list-email-rule-scope-options)",
    );
  });

  it("prints one line per route an error names, after the error", () => {
    expect(
      cliCommandLines(
        "Read GET /v1/email-rule-scope-options, then GET /v1/email-rule-scope-options again.",
      ),
    ).toEqual([
      "Hint: in the CLI, GET /v1/email-rule-scope-options is `primitive email-rules list-email-rule-scope-options`.",
    ]);
    const writes: string[] = [];
    const spy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((chunk: unknown) => {
        writes.push(String(chunk));
        return true;
      });
    try {
      writeErrorWithHints({
        code: "validation_error",
        message: "See GET /v1/email-rule-scope-options for what you can name.",
      });
    } finally {
      spy.mockRestore();
    }
    expect(writes.join("")).toContain(
      "Hint: in the CLI, GET /v1/email-rule-scope-options is `primitive email-rules list-email-rule-scope-options`.",
    );
  });
});
