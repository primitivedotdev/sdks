import { describe, expect, it } from "vitest";
import {
  detectAgentRuntime,
  detectRuntimeSession,
} from "../../src/oclif/runtime-session.js";

const session = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";

describe("runtime session detection", () => {
  it("names the one session the environment holds, lowercased", () => {
    expect(
      detectRuntimeSession({ CLAUDE_CODE_SESSION_ID: session.toUpperCase() }),
    ).toEqual({
      kind: "detected",
      runtime: "claude",
      session,
      variable: "CLAUDE_CODE_SESSION_ID",
    });
    expect(
      detectRuntimeSession({
        CODEX_THREAD_ID: other,
        CODEX_SESSION_ID: session,
      }),
    ).toEqual({
      kind: "detected",
      runtime: "codex",
      session: other,
      variable: "CODEX_THREAD_ID",
    });
    expect(detectRuntimeSession({ CODEX_SESSION_ID: ` ${session} ` })).toEqual({
      kind: "detected",
      runtime: "codex",
      session,
      variable: "CODEX_SESSION_ID",
    });
  });
  it("finds none without a runtime-provided session UUID", () => {
    expect(detectRuntimeSession({})).toEqual({ kind: "none" });
    expect(
      detectRuntimeSession({
        CLAUDE_CODE_SESSION_ID: "latest",
        CODEX_THREAD_ID: "",
      }),
    ).toEqual({ kind: "none" });
  });
  it("refuses to choose between two runtimes", () => {
    expect(
      detectRuntimeSession({
        CLAUDE_CODE_SESSION_ID: session,
        CODEX_THREAD_ID: other,
      }),
    ).toEqual({
      kind: "ambiguous",
      candidates: [
        { runtime: "claude", session, variable: "CLAUDE_CODE_SESSION_ID" },
        { runtime: "codex", session: other, variable: "CODEX_THREAD_ID" },
      ],
    });
  });
});

describe("runtime detection", () => {
  it("names the runtime whose environment holds this exact session", () => {
    expect(
      detectAgentRuntime(session, { CLAUDE_CODE_SESSION_ID: session }),
    ).toBe("claude");
    expect(
      detectAgentRuntime(session.toUpperCase(), {
        CLAUDE_CODE_SESSION_ID: session,
      }),
    ).toBe("claude");
    expect(detectAgentRuntime(session, { CODEX_THREAD_ID: session })).toBe(
      "codex",
    );
    expect(detectAgentRuntime(session, { CODEX_SESSION_ID: session })).toBe(
      "codex",
    );
  });
  it("prefers the loaded Codex thread over its process session", () => {
    expect(
      detectAgentRuntime(session, {
        CODEX_THREAD_ID: other,
        CODEX_SESSION_ID: session,
      }),
    ).toBeNull();
    expect(
      detectAgentRuntime(other, {
        CODEX_THREAD_ID: other,
        CODEX_SESSION_ID: session,
      }),
    ).toBe("codex");
  });
  it("refuses to guess for a different, ambiguous or malformed session", () => {
    expect(detectAgentRuntime(session, {})).toBeNull();
    expect(
      detectAgentRuntime(session, { CLAUDE_CODE_SESSION_ID: other }),
    ).toBeNull();
    expect(
      detectAgentRuntime(session, {
        CLAUDE_CODE_SESSION_ID: session,
        CODEX_THREAD_ID: session,
      }),
    ).toBeNull();
    expect(
      detectAgentRuntime("not-a-session", {
        CLAUDE_CODE_SESSION_ID: "not-a-session",
      }),
    ).toBeNull();
  });
});
