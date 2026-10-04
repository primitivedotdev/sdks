import { describe, expect, it } from "vitest";
import {
  cliInvocation,
  generatedAgentName,
  identitySuggestions,
} from "../../src/oclif/agent-identity-suggestions.js";

describe("generated agent names", () => {
  it("matches only enrollment's own fallback name", () => {
    expect(generatedAgentName("Coding agent")).toBe(true);
    expect(generatedAgentName("Research")).toBe(false);
    expect(generatedAgentName("coding agent")).toBe(false);
  });
});

describe("identity suggestions", () => {
  const profile = "session-11111111-1111-4111-8111-111111111111";

  it("suggests a rename and the runtime note for a default name", () => {
    expect(
      identitySuggestions({
        invocation: "primitive",
        profile,
        nameIsDefault: true,
        connectedNow: true,
      }),
    ).toEqual({
      nameIsDefault: true,
      suggestions: [
        {
          kind: "rename",
          command: `PRIMITIVE_AGENT_PROFILE=${profile} primitive agent rename "<new name>"`,
        },
        {
          kind: "runtime_note",
          command: `PRIMITIVE_AGENT_PROFILE=${profile} primitive agent runtime set`,
        },
      ],
    });
  });

  it("reports a custom name as not default and suggests no rename", () => {
    expect(
      identitySuggestions({
        invocation: "npx -y primitive@latest",
        profile,
        nameIsDefault: generatedAgentName("Research"),
        connectedNow: true,
      }),
    ).toEqual({
      nameIsDefault: false,
      suggestions: [
        {
          kind: "runtime_note",
          command: `PRIMITIVE_AGENT_PROFILE=${profile} npx -y primitive@latest agent runtime set`,
        },
      ],
    });
  });

  it("omits nameIsDefault when the name is unknown and waits for a connection", () => {
    expect(
      identitySuggestions({
        invocation: "primitive",
        profile,
        connectedNow: false,
      }),
    ).toEqual({ suggestions: [] });
  });

  it("prints follow-up commands the way the CLI was invoked", () => {
    expect(
      cliInvocation("/home/u/.npm/_npx/abc/node_modules/.bin/primitive"),
    ).toBe("npx -y primitive@latest");
    expect(cliInvocation("/usr/local/bin/primitive")).toBe("primitive");
    expect(cliInvocation(undefined)).toBe("primitive");
  });
});
