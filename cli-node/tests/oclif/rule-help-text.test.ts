import { describe, expect, it } from "vitest";
import { BODY_FILE_HELP } from "../../src/oclif/api-command.js";
import { COMMANDS } from "../../src/oclif/index.js";

type Described = {
  description?: string;
  flags?: Record<string, { description?: string }>;
};

function command(id: string): Described {
  const found = (COMMANDS as Record<string, unknown>)[id];
  if (!found) throw new Error(`missing command ${id}`);
  return found as Described;
}

describe("where the help points a reader of email rules", () => {
  it("says --body-file takes the rule of a saved compile answer on the writes that take one", () => {
    for (const [id, sdkName] of [
      ["email-rules:create-email-rule", "createEmailRule"],
      ["email-rules:update-email-rule", "updateEmailRule"],
      ["email-rules:create-email-rule-request", "createEmailRuleRequest"],
      ["email-rules:accept-email-rule-request", "acceptEmailRuleRequest"],
    ] as const) {
      const help = command(id).flags?.["body-file"]?.description ?? "";
      expect(help, id).toContain(
        "the `rule` of a saved compile answer: `compile-email-rule ... --json | jq .data.rule > rule.json`",
      );
      expect(help, id).toContain(BODY_FILE_HELP[sdkName]);
    }
    expect(BODY_FILE_HELP.createEmailRuleRequest).toContain("--target-email");
    // The two request writes take no scope fields, so the rule is compiled
    // without any of the scope flags.
    for (const sdkName of [
      "createEmailRuleRequest",
      "acceptEmailRuleRequest",
    ] as const)
      expect(BODY_FILE_HELP[sdkName]).toContain(
        "compiled without a scope (--evaluation-scope, --scope-address or --scope-domain)",
      );
    // Any other command keeps the plain help.
    expect(
      command("email-rules:test-email-rule").flags?.["body-file"]?.description,
    ).not.toContain("compile-email-rule");
  });

  it("has no --fail-on-expectations on create or update", () => {
    for (const id of [
      "email-rules:create-email-rule",
      "email-rules:update-email-rule",
    ])
      expect(command(id).flags?.["fail-on-expectations"]).toBeUndefined();
  });
});
