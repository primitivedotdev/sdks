import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  cliInvocation,
  generatedAgentName,
  identitySuggestions,
} from "../../src/oclif/agent-identity-suggestions.js";

function repository(): string {
  const repo = join(mkdtempSync(join(tmpdir(), "identity-")), "my-repo");
  mkdirSync(join(repo, ".git"), { recursive: true });
  mkdirSync(join(repo, "src"));
  return repo;
}

describe("generated agent names", () => {
  it("matches the names this CLI chooses by itself", () => {
    const repo = repository();
    const cwd = join(repo, "src");
    expect(generatedAgentName("Coding agent", cwd)).toBe(true);
    expect(generatedAgentName("claude-my-repo", cwd)).toBe(true);
    expect(generatedAgentName("codex-my-repo", cwd)).toBe(true);
    expect(generatedAgentName("omp-my-repo", cwd)).toBe(true);
  });

  it("does not match a name someone chose", () => {
    const cwd = join(repository(), "src");
    expect(generatedAgentName("Research", cwd)).toBe(false);
    expect(generatedAgentName("claude-other-repo", cwd)).toBe(false);
    expect(generatedAgentName("coding agent", cwd)).toBe(false);
  });
});

describe("identity suggestions", () => {
  const profile = "session-11111111-1111-4111-8111-111111111111";

  it("suggests a rename and the runtime note for a generated name", () => {
    const cwd = join(repository(), "src");
    expect(
      identitySuggestions({
        invocation: "primitive",
        profile,
        name: "claude-my-repo",
        cwd,
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
    const cwd = join(repository(), "src");
    expect(
      identitySuggestions({
        invocation: "npx -y primitive@latest",
        profile,
        name: "Research",
        cwd,
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
        cwd: "/tmp",
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
