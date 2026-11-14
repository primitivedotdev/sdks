import { operationManifest } from "@primitivedotdev/api-core";
import { describe, expect, it } from "vitest";
import { OPERATION_HINTS } from "../../src/oclif/api-command.js";
import { COMMANDS } from "../../src/oclif/index.js";

type Described = {
  description?: string;
  flags?: Record<string, unknown>;
  args?: Record<string, unknown>;
};

function command(id: string): Described {
  const found = (COMMANDS as Record<string, unknown>)[id];
  if (!found) throw new Error(`missing command ${id}`);
  return found as Described;
}

/** The longest a request body's text field may be, as the spec says. */
function maxLength(sdkName: string, field: string): number | undefined {
  const operation = operationManifest.find((op) => op.sdkName === sdkName);
  const schema = operation?.requestSchema as
    | { properties?: Record<string, { maxLength?: number }> }
    | undefined;
  return schema?.properties?.[field]?.maxLength;
}

describe("the objection commands' help", () => {
  it("says the message can ask the author to narrow or explain the rule, and how the author answers", () => {
    const hint = OPERATION_HINTS.createEmailRuleObjection;
    const create = command("email-rule-oversight:create-email-rule-objection");
    expect(create.description).toContain(hint);
    expect(hint).toContain(
      "ask the author to narrow the rule, or to explain where its matches go (its receivers)",
    );
    expect(hint).toContain(
      "declines, optionally giving a reason; or answers amended once they have saved a new version of the rule",
    );
    expect(hint).toContain("Objecting does not change the rule.");
    // The flag, its limit and the commands the tip names are real.
    expect(create.flags).toHaveProperty("message");
    expect(hint).toContain(
      `--message (up to ${maxLength("createEmailRuleObjection", "message")} characters)`,
    );
    for (const name of [
      "get-email-rule-objection",
      "withdraw-email-rule-objection",
    ]) {
      expect(hint).toContain(
        `\`primitive email-rule-oversight ${name} <objection-id>\``,
      );
      expect(
        Object.keys(command(`email-rule-oversight:${name}`).args ?? {}),
      ).toHaveLength(1);
    }
  });

  it("says a reason can explain a receiver, and to answer amended rather than decline after changing the rule", () => {
    const hint = OPERATION_HINTS.declineEmailRuleObjection;
    const decline = command(
      "email-rule-oversight:decline-email-rule-objection",
    );
    expect(decline.description).toContain(hint);
    expect(hint).toContain(
      "If you changed the rule instead of turning it off, do not decline",
    );
    expect(hint).toContain(
      "`primitive email-rule-oversight amend-email-rule-objection <objection-id>`",
    );
    expect(hint).toContain("the reason can say what the receiver is for");
    expect(decline.flags).toHaveProperty("reason");
    expect(hint).toContain(
      `--reason (up to ${maxLength("declineEmailRuleObjection", "reason")} characters)`,
    );
  });

  it("gives the author an amend command that takes the objection id and a note, after a new version", () => {
    const hint = OPERATION_HINTS.amendEmailRuleObjection;
    const amend = command("email-rule-oversight:amend-email-rule-objection");
    expect(amend.description).toContain(hint);
    expect(amend.flags).toHaveProperty("id");
    expect(amend.flags).toHaveProperty("note");
    expect(hint).toContain("`primitive email-rules update-email-rule`");
    expect(hint).toContain("409 no_new_version");
    expect(hint).toContain(
      `--note (up to ${maxLength("amendEmailRuleObjection", "note")} characters)`,
    );
    expect(command("email-rules:update-email-rule")).toBeDefined();
  });
});
