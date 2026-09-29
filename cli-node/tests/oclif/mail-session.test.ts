import { describe, expect, it } from "vitest";
import { currentMailSessionKey } from "../../src/oclif/mail-session.js";

const id = "11111111-1111-4111-8111-111111111111";

describe("current mail session", () => {
  it("uses only the current runtime-provided identity", () => {
    expect(currentMailSessionKey({ CLAUDE_CODE_SESSION_ID: id })).toBe(
      `claude:${id}`,
    );
    expect(currentMailSessionKey({ CODEX_SESSION_ID: id })).toBe(`codex:${id}`);
    expect(
      currentMailSessionKey({
        CODEX_SESSION_ID: id,
        CLAUDE_CODE_SESSION_ID: id,
      }),
    ).toBeNull();
    expect(
      currentMailSessionKey({
        CODEX_SESSION_ID: id,
        CODEX_THREAD_ID: "22222222-2222-4222-8222-222222222222",
      }),
    ).toBeNull();
    expect(
      currentMailSessionKey({ CLAUDE_CODE_SESSION_ID: "not-a-session" }),
    ).toBeNull();
    expect(currentMailSessionKey({})).toBeNull();
  });
});
