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
  it("says --body-file takes the compile answer unchanged on the writes that take one", () => {
    for (const [id, sdkName] of [
      ["email-rules:create-email-rule", "createEmailRule"],
      ["email-rules:update-email-rule", "updateEmailRule"],
      ["email-rules:create-email-rule-request", "createEmailRuleRequest"],
      ["email-rules:accept-email-rule-request", "acceptEmailRuleRequest"],
    ] as const) {
      const help = command(id).flags?.["body-file"]?.description ?? "";
      expect(help, id).toContain(
        "the answer `compile-email-rule --json` printed (without --include-sql), unchanged",
      );
      expect(help, id).toContain(BODY_FILE_HELP[sdkName]);
    }
    expect(BODY_FILE_HELP.createEmailRuleRequest).toContain("--target-email");
    // Any other command keeps the plain help.
    expect(
      command("email-rules:test-email-rule").flags?.["body-file"]?.description,
    ).not.toContain("compile-email-rule");
  });

  it("says a create leaves expectations on questions undecided until a test asks them", () => {
    expect(
      command("email-rules:create-email-rule").flags?.["fail-on-expectations"]
        ?.description,
    ).toContain(
      "on a new rule with questions an email whose conditions hold stays undecided (exit 3) until `test-email-rule --rule-id` asks them",
    );
  });
});
