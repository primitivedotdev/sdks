import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import ListenCommand, {
  CLAUDE_NOTIFY_SESSION_GUIDANCE,
  claudeCodeSession,
} from "../../src/oclif/commands/listen.js";
import { saveConnectedAgentProfile } from "../../src/oclif/connected-agent-profile.js";
import { writeMailJson } from "../../src/oclif/shared-mail-files.js";

const root = resolve(import.meta.dirname, "../..");
const session = "11111111-1111-4111-8111-111111111111";
describe("native listener command transport", () => {
  it("accepts explicit JSON status without changing the default offline output", async () => {
    const directory = mkdtempSync(join(tmpdir(), "primitive-listen-json-"));
    const output: string[] = [];
    const log = vi
      .spyOn(console, "log")
      .mockImplementation((value: unknown) => {
        output.push(String(value));
      });
    try {
      vi.stubEnv("PRIMITIVE_CONFIG_DIR", directory);
      vi.stubEnv("PRIMITIVE_AGENT_PROFILE", "json-status");
      saveConnectedAgentProfile(directory, "json-status", {
        version: 1,
        auth_method: "agent_connection",
        api_key: ["pconn", "a".repeat(48)].join("_"),
        api_base_url: "https://api.primitive.dev/v1",
        org_id: session,
        agent_address: "agent@example.com",
        owner_address: "owner@example.com",
        invitation_hash: "b".repeat(64),
        created_at: new Date().toISOString(),
      });
      await ListenCommand.run(["--status", "--notify-session", session], {
        root,
      });
      await ListenCommand.run(
        ["--status", "--notify-session", session, "--json"],
        { root },
      );
      expect(output).toHaveLength(2);
      expect(JSON.parse(output[1] ?? "")).toEqual(JSON.parse(output[0] ?? ""));
      expect(JSON.parse(output[1] ?? "")).toMatchObject({
        sessionId: session,
        receipts: [],
        listener: { healthy: false, reason: "absent" },
      });
    } finally {
      log.mockRestore();
      vi.unstubAllEnvs();
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it.each([
    ["--background"],
    ["--stop"],
    ["--background", "--notify-session", session, "--once"],
    ["--background", "--notify-session", session, "--status"],
    ["--stop", "--notify-session", session, "--contacts"],
    ["--stop", "--notify-session", session, "--sender", "peer@example.com"],
  ])("rejects incompatible lifecycle options before starting a receiver: %j", async (...args) => {
    await expect(ListenCommand.run(args, { root })).rejects.toThrow();
  });
  it("refuses --notify-session for a Claude Code session and points to the hook path", async () => {
    vi.stubEnv("CLAUDE_CODE_SESSION_ID", session.toUpperCase());
    vi.stubEnv("CODEX_THREAD_ID", "");
    try {
      await expect(
        ListenCommand.run(
          ["--notify-session", session, "--sender", "peer@example.com"],
          { root },
        ),
      ).rejects.toThrow(CLAUDE_NOTIFY_SESSION_GUIDANCE);
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("recognizes Claude sessions from the environment or this machine's session record only", () => {
    const directory = mkdtempSync(join(tmpdir(), "primitive-listen-claude-"));
    try {
      expect(
        claudeCodeSession(
          session,
          { CLAUDE_CODE_SESSION_ID: session },
          directory,
        ),
      ).toBe(true);
      expect(
        claudeCodeSession(
          session,
          { CLAUDE_CODE_SESSION_ID: session, CODEX_THREAD_ID: session },
          directory,
        ),
      ).toBe(false);
      expect(claudeCodeSession(session, {}, directory)).toBe(false);
      writeMailJson(join(directory, "machine", "sessions", `${session}.json`), {
        version: 1,
        runtime: "claude",
        session,
      });
      expect(claudeCodeSession(session, {}, directory)).toBe(true);
      writeMailJson(join(directory, "machine", "sessions", `${session}.json`), {
        version: 1,
        runtime: "codex",
        session,
      });
      expect(claudeCodeSession(session, {}, directory)).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("reserves shared subscription names against generic consumers", async () => {
    await expect(
      ListenCommand.run(
        ["--subscription", "local-mail-11111111-1111-4111-8111-111111111111"],
        { root },
      ),
    ).rejects.toThrow("reserved for shared mail receiving");
  });
  it.each([
    ["--transport", "poll", "requires --transport websocket"],
    ["--subscription", "custom", "omit --subscription"],
  ])("rejects %s before authentication or session access", async (flag, value, message) => {
    await expect(
      ListenCommand.run(
        [
          "--notify-session",
          session,
          "--sender",
          "peer@example.com",
          flag,
          value,
        ],
        { root },
      ),
    ).rejects.toThrow(message);
  });
});
