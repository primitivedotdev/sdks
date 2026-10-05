import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AgentConnectCommand from "../../src/oclif/commands/agent-connect.js";
import AgentStatusCommand, {
  statusProfile,
} from "../../src/oclif/commands/agent-status.js";
import {
  agentProfileDirectory,
  saveConnectedAgentProfile,
} from "../../src/oclif/connected-agent-profile.js";
import { COMMANDS } from "../../src/oclif/index.js";
import { writeMailJson } from "../../src/oclif/shared-mail-files.js";

const root = resolve(import.meta.dirname, "../..");
const session = "11111111-1111-4111-8111-111111111111";
let home: string;
let configDir: string;
let outputs: string[];

function savedProfile(name: string, address: string, bound: string | null) {
  saveConnectedAgentProfile(configDir, name, {
    version: 1,
    auth_method: "agent_connection",
    api_key: ["pconn", "fixture", name].join("_"),
    api_base_url: "https://api.primitive-staging-1.com/v1",
    org_id: "22222222-2222-4222-8222-222222222222",
    agent_address: address,
    owner_address: "owner@example.test",
    invitation_hash: "a".repeat(64),
    created_at: "2026-01-01T00:00:00.000Z",
  });
  if (bound)
    writeMailJson(join(agentProfileDirectory(configDir, name), "setup.json"), {
      version: 1,
      session: bound,
      receiverMode: "poll",
      invitationHash: "a".repeat(64),
    });
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "agent-status-"));
  configDir = join(home, "config");
  process.env.PRIMITIVE_CONFIG_DIR = configDir;
  delete process.env.PRIMITIVE_AGENT_PROFILE;
  delete process.env.CLAUDE_CODE_SESSION_ID;
  delete process.env.CODEX_THREAD_ID;
  delete process.env.CODEX_SESSION_ID;
  outputs = [];
  for (const command of [AgentConnectCommand, AgentStatusCommand])
    vi.spyOn(command.prototype, "log").mockImplementation((line) => {
      outputs.push(String(line));
    });
});
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.PRIMITIVE_CONFIG_DIR;
  delete process.env.PRIMITIVE_AGENT_PROFILE;
  delete process.env.CODEX_THREAD_ID;
  rmSync(home, { recursive: true, force: true });
  process.exitCode = undefined;
});

describe("agent status", () => {
  it("is a hidden registered alias", () => {
    expect(COMMANDS["agent:status"]).toBe(AgentStatusCommand);
    expect(AgentStatusCommand.hidden).toBe(true);
  });

  it("prints what agent connect --status prints for the session's one address", async () => {
    savedProfile("work", "work@example.test", session);
    process.env.CODEX_THREAD_ID = session;
    await AgentStatusCommand.run(["--json"], { root });
    expect(JSON.parse(outputs[0] ?? "")).toMatchObject({
      status: "configured",
      identity: { profileName: "work", agentAddress: "work@example.test" },
      receiving: { mode: "poll", state: "poll" },
    });
    outputs = [];
    await AgentConnectCommand.run(["--status", "--profile", "work", "--json"], {
      root,
    });
    expect(outputs).toHaveLength(1);
  });

  it("prefers --profile, then PRIMITIVE_AGENT_PROFILE, then the session", () => {
    savedProfile("work", "work@example.test", session);
    const env = { CODEX_THREAD_ID: session, PRIMITIVE_AGENT_PROFILE: "env" };
    expect(statusProfile({ configDir, profile: "flag", env })).toEqual({
      profile: "flag",
    });
    expect(statusProfile({ configDir, env })).toEqual({ profile: "env" });
    expect(
      statusProfile({ configDir, env: { CODEX_THREAD_ID: session } }),
    ).toEqual({ profile: "work" });
  });

  it("reads the session's address with agent connect --status --session", async () => {
    savedProfile("work", "work@example.test", session);
    await AgentConnectCommand.run(
      ["--status", "--session", session, "--json"],
      { root },
    );
    expect(JSON.parse(outputs[0] ?? "")).toMatchObject({
      status: "configured",
      identity: { profileName: "work", agentAddress: "work@example.test" },
    });
  });

  it("says plainly when a session has no address, so connecting replaces nothing", async () => {
    await AgentConnectCommand.run(
      ["--status", "--session", session, "--json"],
      { root },
    );
    expect(process.exitCode).toBe(1);
    const result = JSON.parse(outputs[0] ?? "");
    expect(result).toMatchObject({
      status: "not_configured",
      profileName: null,
      session,
    });
    expect(result.detail).toContain("will not replace anything");
  });

  it("refuses a --status --session that is not a session UUID", async () => {
    await expect(
      AgentConnectCommand.run(["--status", "--session", "nope", "--json"], {
        root,
      }),
    ).rejects.toThrow(/exact loaded session UUID/);
  });

  it("asks for a profile when the session has none or several", async () => {
    await AgentStatusCommand.run(["--json"], { root });
    expect(process.exitCode).toBe(1);
    expect(JSON.parse(outputs[0] ?? "")).toMatchObject({
      status: "not_configured",
      profileName: null,
    });
    savedProfile("one", "one@example.test", session);
    savedProfile("two", "two@example.test", session);
    expect(
      statusProfile({ configDir, env: { CODEX_THREAD_ID: session } }),
    ).toEqual({ profile: null, session, bound: ["one", "two"] });
  });
});
