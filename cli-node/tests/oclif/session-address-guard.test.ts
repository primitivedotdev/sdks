import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = "11111111-1111-4111-8111-111111111111";
const otherSession = "33333333-3333-4333-8333-333333333333";
const mocks = vi.hoisted(() => ({
  setupAgent: vi.fn(),
  enrollAgent: vi.fn(),
  connectAgent: vi.fn(),
  readAgentInvitation: vi.fn(),
  disconnectAgent: vi.fn(),
}));

vi.mock("../../src/oclif/agent-connect.js", async (original) => ({
  ...(await original<typeof import("../../src/oclif/agent-connect.js")>()),
  readAgentInvitation: mocks.readAgentInvitation,
  connectAgent: mocks.connectAgent,
}));
vi.mock("../../src/oclif/agent-setup.js", async (original) => ({
  ...(await original<typeof import("../../src/oclif/agent-setup.js")>()),
  setupAgent: mocks.setupAgent,
}));
vi.mock("../../src/oclif/agent-enroll.js", () => ({
  enrollAgent: mocks.enrollAgent,
}));
vi.mock("../../src/oclif/agent-disconnect.js", async (original) => ({
  ...(await original<typeof import("../../src/oclif/agent-disconnect.js")>()),
  disconnectAgent: mocks.disconnectAgent,
}));

import AgentConnectCommand from "../../src/oclif/commands/agent-connect.js";
import AgentEnrollCommand from "../../src/oclif/commands/agent-enroll.js";
import {
  agentProfileDirectory,
  saveConnectedAgentProfile,
} from "../../src/oclif/connected-agent-profile.js";
import { connectedProfilesForSession } from "../../src/oclif/machine-session.js";
import { ALREADY_CONNECTED_EXIT_CODE } from "../../src/oclif/session-address-guard.js";
import {
  removeMailFile,
  writeMailJson,
} from "../../src/oclif/shared-mail-files.js";

const root = resolve(import.meta.dirname, "../..");
const invitation =
  "https://api.primitive-staging-1.com/v1/agent-connections/setup#token=secret";
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
      receiverMode: "native",
      invitationHash: "a".repeat(64),
    });
}

function setupResult(profileName: string) {
  return {
    identity: {
      profileName,
      agentAddress: "new@example.test",
      orgId: "22222222-2222-4222-8222-222222222222",
      ownerAddress: "owner@example.test",
      apiBaseUrl: "https://api.primitive-staging-1.com/v1",
    },
    sessionId: session,
    verification: { state: "reply_submitted", deliveryStatus: "queued" },
    receiving: { state: "not_ready" },
    ownerNotifications: "enabled",
    resumeCommand: `primitive agent connect --profile ${profileName} --session ${session} --resume --json`,
    guidance: "Receiving health is reported separately.",
  };
}

function enrollResult() {
  return {
    identity: {
      profileName: `session-${session}`,
      agentAddress: "enrolled@example.test",
    },
    connection: { status: "connected" },
    verification: { state: "reply_submitted" },
    receiving: { state: "healthy" },
    contactRequestPolicy: "not_requested",
  };
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "session-address-guard-"));
  configDir = join(home, "config");
  process.env.PRIMITIVE_CONFIG_DIR = configDir;
  process.env.CLAUDE_CONFIG_DIR = join(home, "claude");
  process.env.CODEX_HOME = join(home, "codex");
  delete process.env.CLAUDE_CODE_SESSION_ID;
  delete process.env.CODEX_THREAD_ID;
  delete process.env.CODEX_SESSION_ID;
  outputs = [];
  for (const command of [AgentConnectCommand, AgentEnrollCommand])
    vi.spyOn(command.prototype, "log").mockImplementation((line) => {
      outputs.push(String(line));
    });
  mocks.readAgentInvitation.mockResolvedValue(invitation);
  mocks.disconnectAgent.mockImplementation(
    async (params: { configDir: string; profileName: string }) => {
      removeMailFile(
        join(
          agentProfileDirectory(params.configDir, params.profileName),
          "connection.json",
        ),
      );
      return { status: "disconnected" };
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  delete process.env.PRIMITIVE_CONFIG_DIR;
  delete process.env.CLAUDE_CONFIG_DIR;
  delete process.env.CODEX_HOME;
  delete process.env.CLAUDE_CODE_SESSION_ID;
  delete process.env.CODEX_THREAD_ID;
  rmSync(home, { recursive: true, force: true });
  process.exitCode = undefined;
});

describe("one address per session", () => {
  it("refuses agent connect without reading or claiming the invitation", async () => {
    process.env.CODEX_THREAD_ID = session;
    savedProfile("work", "work@example.test", session);
    await AgentConnectCommand.run(["--session", session, "--json"], { root });
    expect(process.exitCode).toBe(ALREADY_CONNECTED_EXIT_CODE);
    expect(outputs).toHaveLength(1);
    const output = JSON.parse(outputs[0] ?? "");
    expect(output).toMatchObject({
      status: "already_connected",
      session,
      existing: { profile: "work", address: "work@example.test" },
      bound: [{ profile: "work", address: "work@example.test" }],
    });
    expect(output.detail).toContain("Ask the user");
    expect(output.detail).toContain("No invitation was claimed");
    expect(mocks.readAgentInvitation).not.toHaveBeenCalled();
    expect(mocks.setupAgent).not.toHaveBeenCalled();
    expect(mocks.connectAgent).not.toHaveBeenCalled();
    expect(mocks.disconnectAgent).not.toHaveBeenCalled();
  });

  it("refuses with human text that tells the agent to ask the user", async () => {
    process.env.CLAUDE_CODE_SESSION_ID = session;
    savedProfile(`session-${session}`, "auto@example.test", session);
    await AgentConnectCommand.run(["--profile", "second"], { root });
    expect(process.exitCode).toBe(ALREADY_CONNECTED_EXIT_CODE);
    expect(outputs.join("\n")).toBe(
      `This session already has a Primitive address: auto@example.test (profile session-${session}). No invitation was claimed and nothing was changed. Ask the user whether to keep the existing address and not connect a new one, or to disconnect the existing agent first. Do not decide for them. If they want to replace it, rerun this command with --replace-existing, which disconnects the existing agent and then continues. If they want this session to have more than one address on purpose, rerun with --keep-existing.`,
    );
    expect(mocks.readAgentInvitation).not.toHaveBeenCalled();
    expect(mocks.connectAgent).not.toHaveBeenCalled();
  });

  it("refuses agent enroll before anything is created", async () => {
    savedProfile("work", "work@example.test", session);
    await AgentEnrollCommand.run(["--session", session, "--json"], { root });
    expect(process.exitCode).toBe(ALREADY_CONNECTED_EXIT_CODE);
    expect(JSON.parse(outputs[0] ?? "")).toMatchObject({
      status: "already_connected",
      existing: { profile: "work", address: "work@example.test" },
    });
    expect(JSON.parse(outputs[0] ?? "").detail).toContain(
      "No address was created",
    );
    expect(mocks.enrollAgent).not.toHaveBeenCalled();
  });

  it("--replace-existing disconnects the bound profile, then connects", async () => {
    process.env.CODEX_THREAD_ID = session;
    savedProfile("work", "work@example.test", session);
    mocks.setupAgent.mockResolvedValue(setupResult(`session-${session}`));
    await AgentConnectCommand.run(
      ["--session", session, "--replace-existing", "--no-skill", "--json"],
      { root },
    );
    expect(mocks.disconnectAgent).toHaveBeenCalledTimes(1);
    expect(mocks.disconnectAgent).toHaveBeenCalledWith(
      expect.objectContaining({ configDir, profileName: "work" }),
    );
    expect(mocks.setupAgent).toHaveBeenCalledWith(
      expect.objectContaining({ session, invitation }),
    );
    expect(mocks.disconnectAgent.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.readAgentInvitation.mock.invocationCallOrder[0] ?? 0,
    );
    expect(JSON.parse(outputs[0] ?? "")).toMatchObject({
      address: "new@example.test",
      replacedExisting: [{ profile: "work", address: "work@example.test" }],
    });
    expect(connectedProfilesForSession(configDir, session)).toEqual([]);
  });

  it("--replace-existing stops and claims nothing when disconnect fails", async () => {
    savedProfile("work", "work@example.test", session);
    mocks.disconnectAgent.mockRejectedValue(new Error("revocation pending"));
    await expect(
      AgentConnectCommand.run(
        ["--session", session, "--replace-existing", "--no-skill", "--json"],
        { root },
      ),
    ).rejects.toThrow(/No new address was claimed or created/);
    expect(mocks.readAgentInvitation).not.toHaveBeenCalled();
    expect(mocks.setupAgent).not.toHaveBeenCalled();
  });

  it("--replace-existing on enroll disconnects, then enrolls", async () => {
    savedProfile("work", "work@example.test", session);
    mocks.enrollAgent.mockResolvedValue(enrollResult());
    await AgentEnrollCommand.run(
      ["--session", session, "--replace-existing", "--json"],
      { root },
    );
    expect(mocks.disconnectAgent).toHaveBeenCalledTimes(1);
    expect(mocks.enrollAgent).toHaveBeenCalledTimes(1);
    expect(JSON.parse(outputs[0] ?? "")).toMatchObject({
      replacedExisting: [{ profile: "work", address: "work@example.test" }],
    });
  });

  it("--keep-existing allows a second address", async () => {
    process.env.CODEX_THREAD_ID = session;
    savedProfile("work", "work@example.test", session);
    mocks.setupAgent.mockResolvedValue(setupResult("second"));
    await AgentConnectCommand.run(
      [
        "--profile",
        "second",
        "--session",
        session,
        "--keep-existing",
        "--no-skill",
        "--json",
      ],
      { root },
    );
    expect(mocks.disconnectAgent).not.toHaveBeenCalled();
    expect(mocks.setupAgent).toHaveBeenCalledWith(
      expect.objectContaining({ profileName: "second", session, invitation }),
    );
    expect(JSON.parse(outputs[0] ?? "")).not.toHaveProperty("replacedExisting");
    mocks.enrollAgent.mockResolvedValue(enrollResult());
    await AgentEnrollCommand.run(
      ["--session", session, "--keep-existing", "--json"],
      { root },
    );
    expect(mocks.enrollAgent).toHaveBeenCalledTimes(1);
  });

  it("rejects --keep-existing together with --replace-existing", async () => {
    await expect(
      AgentConnectCommand.run(
        ["--session", session, "--keep-existing", "--replace-existing"],
        { root },
      ),
    ).rejects.toThrow(/cannot also be provided/);
    expect(mocks.readAgentInvitation).not.toHaveBeenCalled();
  });

  it("leaves a session with no bound profile unchanged", async () => {
    process.env.CODEX_THREAD_ID = session;
    savedProfile("elsewhere", "other@example.test", otherSession);
    savedProfile("unbound", "unbound@example.test", null);
    mocks.setupAgent.mockResolvedValue(setupResult(`session-${session}`));
    await AgentConnectCommand.run(
      ["--session", session, "--no-skill", "--json"],
      {
        root,
      },
    );
    expect(process.exitCode).not.toBe(ALREADY_CONNECTED_EXIT_CODE);
    expect(mocks.setupAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        profileName: `session-${session}`,
        session,
        invitation,
      }),
    );
    expect(mocks.disconnectAgent).not.toHaveBeenCalled();
    mocks.enrollAgent.mockResolvedValue(enrollResult());
    await AgentEnrollCommand.run(["--session", session, "--json"], { root });
    expect(mocks.enrollAgent).toHaveBeenCalledTimes(1);
  });

  it("never refuses the profile being connected or a resume", async () => {
    process.env.CODEX_THREAD_ID = session;
    savedProfile(`session-${session}`, "same@example.test", session);
    mocks.setupAgent.mockResolvedValue(setupResult(`session-${session}`));
    await AgentConnectCommand.run(
      ["--session", session, "--no-skill", "--json"],
      {
        root,
      },
    );
    expect(mocks.setupAgent).toHaveBeenCalledTimes(1);
    savedProfile("work", "work@example.test", session);
    await AgentConnectCommand.run(
      [
        "--profile",
        "second",
        "--session",
        session,
        "--resume",
        "--no-skill",
        "--json",
      ],
      { root },
    );
    expect(mocks.setupAgent).toHaveBeenCalledTimes(2);
    mocks.enrollAgent.mockResolvedValue(enrollResult());
    await AgentEnrollCommand.run(
      ["--session", session, "--keep-existing", "--json"],
      { root },
    );
    expect(mocks.enrollAgent).toHaveBeenCalledTimes(1);
  });
});

describe("connectedProfilesForSession", () => {
  it("finds the session's own profile, its record and setup bindings, excluding disconnected ones", () => {
    savedProfile(`session-${session}`, "auto@example.test", null);
    savedProfile("work", "work@example.test", session);
    savedProfile("gone", "gone@example.test", session);
    removeMailFile(
      join(agentProfileDirectory(configDir, "gone"), "connection.json"),
    );
    savedProfile("elsewhere", "other@example.test", otherSession);
    expect(
      connectedProfilesForSession(configDir, session.toUpperCase()),
    ).toEqual([
      { profile: `session-${session}`, address: "auto@example.test" },
      { profile: "work", address: "work@example.test" },
    ]);
    expect(connectedProfilesForSession(configDir, session, "work")).toEqual([
      { profile: `session-${session}`, address: "auto@example.test" },
    ]);
    expect(connectedProfilesForSession(configDir, "not-a-uuid")).toEqual([]);
  });
});
