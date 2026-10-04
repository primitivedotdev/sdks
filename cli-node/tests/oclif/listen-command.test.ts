import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import ListenCommand, {
  CLAUDE_NOTIFY_SESSION_GUIDANCE,
  claudeCodeSession,
  hookReceiverStatus,
} from "../../src/oclif/commands/listen.js";
import {
  agentProfileDirectory,
  saveConnectedAgentProfile,
} from "../../src/oclif/connected-agent-profile.js";
import { writeMailJson } from "../../src/oclif/shared-mail-files.js";

const root = resolve(import.meta.dirname, "../..");
const session = "11111111-1111-4111-8111-111111111111";
const otherSession = "22222222-2222-4222-8222-222222222222";
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
      expect(JSON.parse(output[1] ?? "")).not.toHaveProperty("receiverMode");
    } finally {
      log.mockRestore();
      vi.unstubAllEnvs();
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("status for a hook-receiving Claude session names the hook receiver and its status command", async () => {
    const directory = mkdtempSync(join(tmpdir(), "primitive-listen-hook-"));
    const output: string[] = [];
    const log = vi
      .spyOn(console, "log")
      .mockImplementation((value: unknown) => {
        output.push(String(value));
      });
    try {
      vi.stubEnv("PRIMITIVE_CONFIG_DIR", directory);
      vi.stubEnv("PRIMITIVE_AGENT_PROFILE", "hook-status");
      vi.stubEnv("CLAUDE_CODE_SESSION_ID", "");
      vi.stubEnv("CODEX_THREAD_ID", "");
      saveConnectedAgentProfile(directory, "hook-status", {
        version: 1,
        auth_method: "agent_connection",
        api_key: ["pconn", "c".repeat(48)].join("_"),
        api_base_url: "https://api.primitive.dev/v1",
        org_id: session,
        agent_address: "hook@example.com",
        owner_address: "owner@example.com",
        invitation_hash: "d".repeat(64),
        created_at: new Date().toISOString(),
      });
      writeMailJson(
        join(agentProfileDirectory(directory, "hook-status"), "setup.json"),
        { session, receiverMode: "external" },
      );
      await ListenCommand.run(
        ["--status", "--notify-session", session, "--json"],
        { root },
      );
      const status = JSON.parse(output[0] ?? "");
      expect(status).toMatchObject({
        sessionId: session,
        receiverMode: "external",
        receiverStatusCommand:
          "primitive agent connect --profile hook-status --status --json",
        listener: { healthy: false, reason: "absent" },
      });
      expect(status.receiverGuidance).toContain(
        "receives mail through hooks, not a background listener",
      );
    } finally {
      log.mockRestore();
      vi.unstubAllEnvs();
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("finds the hook receiver for a Claude session without a selected profile", () => {
    const directory = mkdtempSync(join(tmpdir(), "primitive-listen-hook-"));
    try {
      expect(hookReceiverStatus(session, {}, directory)).toBeNull();
      // A Claude session with no bound profile still points at the hook path.
      expect(
        hookReceiverStatus(
          session,
          { CLAUDE_CODE_SESSION_ID: session },
          directory,
        ),
      ).toMatchObject({
        profile: null,
        statusCommand:
          "primitive agent connect --profile <profile> --status --json",
      });
      // A Claude session whose selected profile polls or runs the native
      // listener does not receive through hooks.
      for (const receiverMode of ["poll", "native"]) {
        writeMailJson(
          join(agentProfileDirectory(directory, "other-mode"), "setup.json"),
          { session, receiverMode },
        );
        expect(
          hookReceiverStatus(
            session,
            {
              CLAUDE_CODE_SESSION_ID: session,
              PRIMITIVE_AGENT_PROFILE: "other-mode",
            },
            directory,
          ),
        ).toBeNull();
      }
      // A sessionless poll profile also speaks for this session.
      writeMailJson(
        join(agentProfileDirectory(directory, "other-mode"), "setup.json"),
        { receiverMode: "poll" },
      );
      expect(
        hookReceiverStatus(
          session,
          {
            CLAUDE_CODE_SESSION_ID: session,
            PRIMITIVE_AGENT_PROFILE: "other-mode",
          },
          directory,
        ),
      ).toBeNull();
      // A selected profile set up for another session says nothing about
      // this one, so the session's own hook profile is still named.
      writeMailJson(
        join(agentProfileDirectory(directory, "other-mode"), "setup.json"),
        { session: otherSession, receiverMode: "native" },
      );
      saveConnectedAgentProfile(directory, "bound", {
        version: 1,
        auth_method: "agent_connection",
        api_key: ["pconn", "e".repeat(48)].join("_"),
        api_base_url: "https://api.primitive.dev/v1",
        org_id: session,
        agent_address: "bound@example.com",
        owner_address: "owner@example.com",
        invitation_hash: "f".repeat(64),
        created_at: new Date().toISOString(),
      });
      writeMailJson(
        join(agentProfileDirectory(directory, "bound"), "setup.json"),
        { session, receiverMode: "external" },
      );
      expect(hookReceiverStatus(session, {}, directory)).toMatchObject({
        profile: "bound",
        statusCommand:
          "primitive agent connect --profile bound --status --json",
      });
      expect(
        hookReceiverStatus(
          session,
          { PRIMITIVE_AGENT_PROFILE: "other-mode" },
          directory,
        ),
      ).toMatchObject({ profile: "bound" });
    } finally {
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
