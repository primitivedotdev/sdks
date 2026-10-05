import { describe, expect, it } from "vitest";
import {
  cliInvocation,
  connectNextSteps,
  defaultConnectionName,
  generatedAgentName,
  identitySuggestions,
  LOAD_SKILL_LINE,
  loadSkillLine,
} from "../../src/oclif/agent-identity-suggestions.js";
import { skillFirstLine } from "../../src/oclif/wake-context.js";

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

describe("connection names read back from a claim", () => {
  it("treats the enrollment fallback and a bare address local part as default", () => {
    expect(defaultConnectionName("Coding agent", "a@example.com")).toBe(true);
    expect(
      defaultConnectionName("ergo-r2-a1-1", "ergo-r2-a1-1@example.com"),
    ).toBe(true);
    expect(
      defaultConnectionName("Research agent", "research@example.com"),
    ).toBe(false);
  });
});

describe("connect next steps", () => {
  const profile = "session-11111111-1111-4111-8111-111111111111";
  const address = "ergo-r2-a1-1@example.com";

  it("orders the report, one offer and the skill, naming the generated name", () => {
    const { suggestions } = identitySuggestions({
      invocation: "primitive",
      profile,
      nameIsDefault: true,
      connectedNow: true,
    });
    const steps = connectNextSteps({
      address,
      receiving: { state: "hooks_installed", mode: "external" },
      name: "ergo-r2-a1-1",
      suggestions,
    });
    expect(steps).toHaveLength(3);
    expect(steps[0]).toMatch(/^Report to the owner in two short sentences/);
    expect(steps[0]).toContain(`connected as ${address}`);
    expect(steps[0]).toContain("installed hooks");
    expect(steps[0]).toContain(
      "Leave out the organization id, profile name and command output.",
    );
    expect(steps[1]).toMatch(/^In the same message, make one offer/);
    expect(steps[1]).toContain('generated name "ergo-r2-a1-1"');
    expect(steps[1]).toContain(
      `PRIMITIVE_AGENT_PROFILE=${profile} primitive agent rename "<new name>"`,
    );
    expect(steps[1]).toContain(
      `PRIMITIVE_AGENT_PROFILE=${profile} primitive agent runtime set`,
    );
    expect(steps[1]).toContain("only after the owner answers");
    expect(steps[2]).toBe(
      "Load the primitive-connect skill before handling any mail.",
    );
  });

  it("offers only the runtime note for an owner-chosen name and describes poll receiving", () => {
    const { suggestions } = identitySuggestions({
      invocation: "primitive",
      profile,
      nameIsDefault: false,
      connectedNow: true,
    });
    const steps = connectNextSteps({
      address,
      receiving: { state: "poll", mode: "poll" },
      name: "Research agent",
      suggestions,
    });
    expect(steps[0]).toContain("start of each turn and after sending");
    expect(steps[1]).not.toContain("rename");
    expect(steps[1]).toContain("record where it runs");
  });
});

describe("skill-first wake line", () => {
  it("is given only for verified owner, member and peer mail", () => {
    expect(skillFirstLine("owner")).toBe(LOAD_SKILL_LINE);
    expect(skillFirstLine("member")).toBe(LOAD_SKILL_LINE);
    expect(skillFirstLine("agent")).toBe(LOAD_SKILL_LINE);
    expect(skillFirstLine("contact")).toBeNull();
    expect(skillFirstLine("other")).toBeNull();
    expect(skillFirstLine(undefined)).toBeNull();
    expect(LOAD_SKILL_LINE).toBe(
      "Load the primitive-connect skill first if it is not loaded.",
    );
  });

  it("names the installed SKILL.md on the same line when it is known", () => {
    const file = "/home/agent/.claude/skills/primitive-connect/SKILL.md";
    const line = skillFirstLine("agent", file);
    expect(line).toBe(
      `${LOAD_SKILL_LINE} If your skill tool does not list primitive-connect, read ${file} in full.`,
    );
    expect(line).not.toContain("\n");
    expect(loadSkillLine(null)).toBe(LOAD_SKILL_LINE);
    expect(skillFirstLine("other", file)).toBeNull();
  });
});

describe("connect next steps with an installed skill", () => {
  it("tells an agent whose skill tool lacks the new skill to read the file in full", () => {
    const file = "/home/agent/.claude/skills/primitive-connect/SKILL.md";
    const steps = connectNextSteps({
      address: "agent@example.test",
      receiving: { state: "hooks_installed", mode: "external" },
      suggestions: [],
      skillFile: file,
    });
    expect(steps.at(-1)).toBe(
      `Load the primitive-connect skill before handling any mail. If your skill tool does not list primitive-connect, read ${file} in full.`,
    );
  });
});
