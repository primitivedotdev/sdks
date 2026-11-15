import { operationManifest } from "@primitivedotdev/api-core";
import { describe, expect, it } from "vitest";
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

describe("the length limits in text flag help", () => {
  const flagHelp = (id: string, flag: string) =>
    (command(id).flags?.[flag] as { description?: string } | undefined)
      ?.description ?? "";

  it("gives every rule request and objection text flag's limit, once", () => {
    for (const [id, sdkName, field] of [
      [
        "email-rule-oversight:decline-email-rule-objection",
        "declineEmailRuleObjection",
        "reason",
      ],
      [
        "email-rule-oversight:create-email-rule-objection",
        "createEmailRuleObjection",
        "message",
      ],
      [
        "email-rules:decline-email-rule-request",
        "declineEmailRuleRequest",
        "reason",
      ],
      [
        "email-rules:create-email-rule-request",
        "createEmailRuleRequest",
        "message",
      ],
      [
        "email-rules:create-email-rule-request",
        "createEmailRuleRequest",
        "name",
      ],
      [
        "email-rules:create-email-rule-request",
        "createEmailRuleRequest",
        "english",
      ],
      [
        "email-rules:accept-email-rule-request",
        "acceptEmailRuleRequest",
        "name",
      ],
    ] as const) {
      const max = maxLength(sdkName, field);
      expect(max, `${sdkName}.${field}`).toBeTypeOf("number");
      const help = flagHelp(id, field);
      const said = help.match(new RegExp(`\\b${max}\\b`, "g")) ?? [];
      expect(said, `${id} --${field}: ${help}`).toHaveLength(1);
    }
  });

  it("adds the limit only where the description does not give it", async () => {
    const { withLengthLimit } = await import("../../src/oclif/api-command.js");
    expect(withLengthLimit("A short name for the rule.", 200)).toBe(
      "A short name for the rule. At most 200 characters.",
    );
    expect(withLengthLimit("A short name", 200)).toBe(
      "A short name. At most 200 characters.",
    );
    expect(
      withLengthLimit("Why you are declining, up to 500 characters.", 500),
    ).toBe("Why you are declining, up to 500 characters.");
    expect(withLengthLimit("No limit here.", undefined)).toBe("No limit here.");
    // A flag with no description of its own, and one that gives a limit in
    // other words or units.
    expect(withLengthLimit("", 254)).toBe("At most 254 characters.");
    expect(
      withLengthLimit("Function source. Up to 1 MiB UTF-8.", 1048576),
    ).toBe("Function source. Up to 1 MiB UTF-8.");
    expect(withLengthLimit("Its text, at most 2000 characters", 2000)).toBe(
      "Its text, at most 2000 characters",
    );
  });
});
