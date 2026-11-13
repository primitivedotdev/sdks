import { describe, expect, it } from "vitest";
import { COMMANDS } from "../../src/oclif/index.js";

type Described = { description?: string; flags?: Record<string, unknown> };

function command(id: string): Described {
  const found = (COMMANDS as Record<string, unknown>)[id];
  if (!found) throw new Error(`missing command ${id}`);
  return found as Described;
}

describe("the objection commands' help", () => {
  it("says the message can ask the author to narrow or explain the rule, and how the author answers", () => {
    const create = command("email-rule-oversight:create-email-rule-objection");
    expect(create.description).toContain(
      "ask the author to narrow the rule, or to explain where its matches go",
    );
    expect(create.description).toContain("declines with a reason that you see");
    // The flag and the command the tip names exist.
    expect(create.flags).toHaveProperty("message");
    command("email-rule-oversight:get-email-rule-objection");
  });

  it("says the decline reason can answer a request to narrow or explain the rule", () => {
    const decline = command(
      "email-rule-oversight:decline-email-rule-objection",
    );
    expect(decline.description).toContain(
      "the reason can answer that: say what you changed, or what the receiver is for",
    );
    expect(decline.flags).toHaveProperty("reason");
  });
});
