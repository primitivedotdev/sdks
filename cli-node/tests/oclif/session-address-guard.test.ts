import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
  connectNativeSession: vi.fn(),
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
vi.mock("../../src/oclif/agent-enroll.js", async (original) => ({
  ...(await original<typeof import("../../src/oclif/agent-enroll.js")>()),
  enrollAgent: mocks.enrollAgent,
}));
vi.mock("../../src/oclif/notify-session-native.js", async (original) => ({
  ...(await original<
    typeof import("../../src/oclif/notify-session-native.js")
  >()),
  connectNativeSession: mocks.connectNativeSession,
}));
vi.mock("../../src/oclif/agent-disconnect.js", async (original) => ({
  ...(await original<typeof import("../../src/oclif/agent-disconnect.js")>()),
  disconnectAgent: mocks.disconnectAgent,
}));

import { existsSync } from "node:fs";
import {
  AgentInvitationRejectedError,
  agentInvitationHash,
} from "../../src/oclif/agent-connect.js";
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
const invitation = `https://api.primitive-staging-1.com/v1/agent-connections/setup#token=${["invite", "b".repeat(48)].join("_")}`;
let home: string;
let configDir: string;
let outputs: string[];

function savedProfile(
  name: string,
  address: string,
  bound: string | null,
  invitationHash = "a".repeat(64),
) {
  saveConnectedAgentProfile(configDir, name, {
    version: 1,
    auth_method: "agent_connection",
    api_key: ["pconn", "fixture", name].join("_"),
    api_base_url: "https://api.primitive-staging-1.com/v1",
    org_id: "22222222-2222-4222-8222-222222222222",
    agent_address: address,
    owner_address: "owner@example.test",
    invitation_hash: invitationHash,
    created_at: "2026-01-01T00:00:00.000Z",
  });
  if (bound)
    writeMailJson(join(agentProfileDirectory(configDir, name), "setup.json"), {
      version: 1,
      session: bound,
      receiverMode: "native",
      invitationHash,
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
  // Offline by default: no saved credential can be confirmed revoked, so
  // bound addresses keep counting unless a test says otherwise.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("offline");
    }),
  );
  mocks.connectNativeSession.mockResolvedValue({ close: () => {} });
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
  vi.unstubAllGlobals();
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
    // The invitation is read and checked first; the disconnect is the last
    // step before the claim.
    expect(mocks.readAgentInvitation.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.disconnectAgent.mock.invocationCallOrder[0] ?? 0,
    );
    expect(mocks.disconnectAgent.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.setupAgent.mock.invocationCallOrder[0] ?? 0,
    );
    expect(JSON.parse(outputs[0] ?? "")).toMatchObject({
      address: "new@example.test",
      replacedExisting: [{ profile: "work", address: "work@example.test" }],
    });
    expect(connectedProfilesForSession(configDir, session)).toEqual([]);
  });

  it("connects without --replace-existing when the session's agent was revoked elsewhere", async () => {
    process.env.CODEX_THREAD_ID = session;
    const target = `session-${session}`;
    savedProfile(target, "agent@example.test", session);
    const probes: Request[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        probes.push(new Request(input, init));
        return new Response("{}", { status: 401 });
      }),
    );
    mocks.setupAgent.mockResolvedValue(setupResult(target));
    await AgentConnectCommand.run(
      ["--session", session, "--no-skill", "--json"],
      {
        root,
      },
    );
    expect(process.exitCode).not.toBe(ALREADY_CONNECTED_EXIT_CODE);
    expect(probes.map((probe) => `${probe.method} ${probe.url}`)).toEqual([
      "GET https://api.primitive-staging-1.com/v1/agent-connections/me",
    ]);
    expect(mocks.disconnectAgent).toHaveBeenCalledWith(
      expect.objectContaining({ configDir, profileName: target }),
    );
    expect(mocks.setupAgent).toHaveBeenCalledWith(
      expect.objectContaining({ profileName: target, session, invitation }),
    );
    expect(JSON.parse(outputs[0] ?? "")).toMatchObject({
      clearedRevoked: [{ profile: target, address: "agent@example.test" }],
    });
  });

  it("still refuses when a bound credential is live or its state is unknown", async () => {
    for (const answer of [
      () =>
        Response.json({
          success: true,
          data: {
            connection: { address: "work@example.test", status: "connected" },
          },
        }),
      () => new Response("unavailable", { status: 503 }),
    ]) {
      process.env.CODEX_THREAD_ID = session;
      savedProfile("work", "work@example.test", session);
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => answer()),
      );
      outputs = [];
      process.exitCode = undefined;
      await AgentConnectCommand.run(["--session", session, "--json"], {
        root,
      });
      expect(process.exitCode).toBe(ALREADY_CONNECTED_EXIT_CODE);
      expect(JSON.parse(outputs[0] ?? "")).toMatchObject({
        status: "already_connected",
        bound: [{ profile: "work", address: "work@example.test" }],
      });
    }
    expect(mocks.disconnectAgent).not.toHaveBeenCalled();
    expect(mocks.readAgentInvitation).not.toHaveBeenCalled();
    expect(mocks.setupAgent).not.toHaveBeenCalled();
  });

  it("--replace-existing names the disconnected agent when the new invitation is refused", async () => {
    process.env.CODEX_THREAD_ID = session;
    savedProfile("work", "work@example.test", session);
    mocks.setupAgent.mockRejectedValue(
      new AgentInvitationRejectedError(
        "This invitation was already used. Nothing was changed on this machine.",
        "invitation_unavailable",
      ),
    );
    const error = await AgentConnectCommand.run(
      ["--session", session, "--replace-existing", "--no-skill", "--json"],
      { root },
    ).catch((e) => e);
    expect(String(error)).toContain(
      "The agent this was replacing (work@example.test) was already disconnected",
    );
    expect(String(error)).not.toContain("Nothing was changed");
    // The same refusal without a replacement keeps its message.
    mocks.setupAgent.mockClear();
    const plain = await AgentConnectCommand.run(
      ["--session", session, "--keep-existing", "--no-skill", "--json"],
      { root },
    ).catch((e) => e);
    expect(String(plain)).toContain("Nothing was changed on this machine");
  });

  it("warns a claim-only connect when the owner has no personal address", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    mocks.connectAgent.mockImplementation(async () => {
      saveConnectedAgentProfile(configDir, "solo", {
        version: 1,
        auth_method: "agent_connection",
        api_key: ["pconn", "fixture", "solo"].join("_"),
        api_base_url: "https://api.primitive-staging-1.com/v1",
        org_id: "22222222-2222-4222-8222-222222222222",
        agent_address: "solo@example.test",
        owner_address: "owner@example.test",
        owner_member_address: null,
        invitation_hash: "c".repeat(64),
        created_at: "2026-01-01T00:00:00.000Z",
      });
      return {
        status: "claimed",
        identity: {
          profileName: "solo",
          agentAddress: "solo@example.test",
          ownerAddress: "owner@example.test",
          orgId: "22222222-2222-4222-8222-222222222222",
          apiBaseUrl: "https://api.primitive-staging-1.com/v1",
        },
      };
    });
    await AgentConnectCommand.run(["--profile", "solo", "--json"], { root });
    expect(JSON.parse(outputs[0] ?? "")).toMatchObject({
      status: "claimed",
      warnings: [{ kind: "owner_member_address_missing" }],
    });
    vi.unstubAllGlobals();
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
    expect(mocks.setupAgent).not.toHaveBeenCalled();
  });

  it("--replace-existing on enroll disconnects, then enrolls", async () => {
    savedProfile("work", "work@example.test", session);
    mocks.enrollAgent.mockImplementation(
      async (params: { beforeCreate?: () => Promise<void> }) => {
        await params.beforeCreate?.();
        return enrollResult();
      },
    );
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

  it("refuses a connection in the target profile without reading stdin", async () => {
    process.env.CODEX_THREAD_ID = session;
    const target = `session-${session}`;
    // Even the same invitation is refused: continuing it is what --resume is for.
    savedProfile(
      target,
      "same@example.test",
      session,
      agentInvitationHash(invitation),
    );
    await AgentConnectCommand.run(
      ["--session", session, "--no-skill", "--json"],
      { root },
    );
    expect(process.exitCode).toBe(ALREADY_CONNECTED_EXIT_CODE);
    expect(JSON.parse(outputs[0] ?? "")).toMatchObject({
      status: "already_connected",
      bound: [{ profile: target, address: "same@example.test" }],
    });
    expect(mocks.readAgentInvitation).not.toHaveBeenCalled();
    expect(mocks.setupAgent).not.toHaveBeenCalled();
    // --replace-existing reads it and leaves a same-invitation target to resume.
    process.exitCode = undefined;
    mocks.setupAgent.mockResolvedValue(setupResult(target));
    await AgentConnectCommand.run(
      ["--session", session, "--replace-existing", "--no-skill", "--json"],
      { root },
    );
    expect(mocks.disconnectAgent).not.toHaveBeenCalled();
    expect(mocks.setupAgent).toHaveBeenCalledWith(
      expect.objectContaining({ profileName: target, session, invitation }),
    );
  });

  it("points a claim-only rerun at --keep-existing, which refreshes the same profile", async () => {
    process.env.CLAUDE_CODE_SESSION_ID = session;
    const target = `session-${session}`;
    // Claim-only saves a credential but no setup binding.
    savedProfile(
      target,
      "claimed@example.test",
      null,
      agentInvitationHash(invitation),
    );
    await AgentConnectCommand.run(["--profile", target, "--json"], { root });
    expect(process.exitCode).toBe(ALREADY_CONNECTED_EXIT_CODE);
    const refusal = JSON.parse(outputs[0] ?? "");
    expect(refusal.detail).toContain("--keep-existing to refresh it");
    expect(refusal.detail).not.toContain("--resume");
    expect(mocks.readAgentInvitation).not.toHaveBeenCalled();
    process.exitCode = undefined;
    outputs = [];
    mocks.connectAgent.mockImplementation(
      async (
        params: Parameters<
          typeof import("../../src/oclif/agent-connect.js").connectAgent
        >[0],
      ) =>
        (
          await vi.importActual<
            typeof import("../../src/oclif/agent-connect.js")
          >("../../src/oclif/agent-connect.js")
        ).connectAgent(params),
    );
    await AgentConnectCommand.run(
      ["--profile", target, "--keep-existing", "--json"],
      { root },
    );
    expect(process.exitCode).not.toBe(ALREADY_CONNECTED_EXIT_CODE);
    expect(mocks.readAgentInvitation).toHaveBeenCalledTimes(1);
    expect(JSON.parse(outputs[0] ?? "")).toMatchObject({
      status: "already_configured",
      identity: { profileName: target },
    });
  });

  it("points a target with saved setup progress at --resume", async () => {
    process.env.CODEX_THREAD_ID = session;
    const target = `session-${session}`;
    savedProfile(target, "same@example.test", session);
    await AgentConnectCommand.run(["--session", session, "--no-skill"], {
      root,
    });
    expect(process.exitCode).toBe(ALREADY_CONNECTED_EXIT_CODE);
    expect(outputs.join("\n")).toContain("rerun with --resume instead");
    expect(mocks.readAgentInvitation).not.toHaveBeenCalled();
  });

  it("never refuses a resume or a kept target", async () => {
    process.env.CODEX_THREAD_ID = session;
    savedProfile(
      `session-${session}`,
      "same@example.test",
      session,
      agentInvitationHash(invitation),
    );
    mocks.setupAgent.mockResolvedValue(setupResult(`session-${session}`));
    await AgentConnectCommand.run(
      ["--session", session, "--keep-existing", "--no-skill", "--json"],
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

  it("guards the explicit --session, not the runtime's, when it is empty or invalid", async () => {
    process.env.CODEX_THREAD_ID = session;
    savedProfile("work", "work@example.test", session);
    await expect(
      AgentConnectCommand.run(
        ["--session", "not-a-uuid", "--replace-existing", "--no-skill"],
        { root },
      ),
    ).rejects.toThrow(/exact loaded session UUID/);
    expect(mocks.disconnectAgent).not.toHaveBeenCalled();
    expect(mocks.readAgentInvitation).not.toHaveBeenCalled();
    mocks.setupAgent.mockImplementation(
      async (params: { profileName: string }) => ({
        ...setupResult(params.profileName),
        receiving: { state: "poll" },
      }),
    );
    await AgentConnectCommand.run(
      ["--session", "", "--replace-existing", "--no-skill", "--json"],
      { root },
    );
    expect(mocks.disconnectAgent).not.toHaveBeenCalled();
    expect(mocks.setupAgent).toHaveBeenCalledTimes(1);
    expect(mocks.setupAgent.mock.calls[0]?.[0]).not.toHaveProperty("session");
    expect(connectedProfilesForSession(configDir, session)).toEqual([
      { profile: "work", address: "work@example.test" },
    ]);
  });

  it("--replace-existing disconnects nothing until the new setup passes its checks", async () => {
    process.env.CODEX_THREAD_ID = session;
    savedProfile("work", "work@example.test", session);
    mocks.readAgentInvitation.mockResolvedValue("not an invitation");
    await expect(
      AgentConnectCommand.run(
        ["--session", session, "--replace-existing", "--no-skill"],
        { root },
      ),
    ).rejects.toThrow();
    // The runtime has a session socket, so the failure is this session's
    // and no poll fallback applies.
    mkdirSync(join(home, "codex", "app-server-control"), { recursive: true });
    writeFileSync(
      join(home, "codex", "app-server-control", "app-server-control.sock"),
      "",
    );
    mocks.readAgentInvitation.mockResolvedValue(invitation);
    mocks.connectNativeSession.mockRejectedValue(new Error("not loaded"));
    await expect(
      AgentConnectCommand.run(
        ["--session", session, "--replace-existing", "--no-skill"],
        { root },
      ),
    ).rejects.toThrow(/not available for native receiving/);
    // Enrollment without a saved member login fails before the disconnect.
    const actual = await vi.importActual<
      typeof import("../../src/oclif/agent-enroll.js")
    >("../../src/oclif/agent-enroll.js");
    mocks.enrollAgent.mockImplementation(actual.enrollAgent);
    await expect(
      AgentEnrollCommand.run(
        ["--session", session, "--replace-existing", "--receiver", "poll"],
        { root },
      ),
    ).rejects.toThrow(/primitive signin/);
    expect(mocks.disconnectAgent).not.toHaveBeenCalled();
    expect(mocks.setupAgent).not.toHaveBeenCalled();
    expect(connectedProfilesForSession(configDir, session)).toEqual([
      { profile: "work", address: "work@example.test" },
    ]);
  });

  it("treats the target profile holding another invitation as the session's address", async () => {
    process.env.CODEX_THREAD_ID = session;
    const target = `session-${session}`;
    savedProfile(target, "old@example.test", session);
    await AgentConnectCommand.run(
      ["--session", session, "--no-skill", "--json"],
      { root },
    );
    expect(process.exitCode).toBe(ALREADY_CONNECTED_EXIT_CODE);
    expect(JSON.parse(outputs[0] ?? "")).toMatchObject({
      status: "already_connected",
      bound: [{ profile: target, address: "old@example.test" }],
    });
    expect(mocks.setupAgent).not.toHaveBeenCalled();
    expect(mocks.disconnectAgent).not.toHaveBeenCalled();
    expect(mocks.readAgentInvitation).not.toHaveBeenCalled();
    process.exitCode = undefined;
    outputs = [];
    mocks.setupAgent.mockResolvedValue(setupResult(target));
    await AgentConnectCommand.run(
      ["--session", session, "--replace-existing", "--no-skill", "--json"],
      { root },
    );
    expect(mocks.disconnectAgent).toHaveBeenCalledWith(
      expect.objectContaining({ profileName: target }),
    );
    // The old setup binding is moved aside so the new invitation can use
    // the same profile.
    expect(
      existsSync(join(agentProfileDirectory(configDir, target), "setup.json")),
    ).toBe(false);
    expect(mocks.setupAgent).toHaveBeenCalledWith(
      expect.objectContaining({ profileName: target, session, invitation }),
    );
    expect(JSON.parse(outputs[0] ?? "")).toMatchObject({
      replacedExisting: [{ profile: target, address: "old@example.test" }],
    });
  });

  it("refuses enrollment over a session profile that is not its own enrollment", async () => {
    const target = `session-${session}`;
    savedProfile(target, "connected@example.test", session);
    await AgentEnrollCommand.run(["--session", session, "--json"], { root });
    expect(process.exitCode).toBe(ALREADY_CONNECTED_EXIT_CODE);
    expect(JSON.parse(outputs[0] ?? "")).toMatchObject({
      status: "already_connected",
      bound: [{ profile: target, address: "connected@example.test" }],
    });
    expect(mocks.enrollAgent).not.toHaveBeenCalled();
    process.exitCode = undefined;
    outputs = [];
    mocks.enrollAgent.mockImplementation(
      async (params: { beforeCreate?: () => Promise<void> }) => {
        await params.beforeCreate?.();
        return enrollResult();
      },
    );
    await AgentEnrollCommand.run(
      ["--session", session, "--replace-existing", "--json"],
      { root },
    );
    expect(mocks.disconnectAgent).toHaveBeenCalledWith(
      expect.objectContaining({ profileName: target }),
    );
    expect(JSON.parse(outputs[0] ?? "")).toMatchObject({
      replacedExisting: [
        { profile: target, address: "connected@example.test" },
      ],
    });
  });

  it("resumes enrollment when the session profile holds its own enrollment", async () => {
    const target = `session-${session}`;
    savedProfile(target, "enrolled@example.test", session);
    writeMailJson(
      join(
        agentProfileDirectory(configDir, target),
        "enrollment",
        "state.json",
      ),
      {
        version: 1,
        session,
        profile: target,
        name: "Coding agent",
        address: "enrolled@example.test",
        orgId: "22222222-2222-4222-8222-222222222222",
        grantId: "grant",
        apiBaseUrl: "https://api.primitive-staging-1.com/v1",
        receiverMode: "native",
        contactRequests: false,
        startedAt: "2026-01-01T00:00:00.000Z",
        phase: "setup_attempted",
        invitationHash: "a".repeat(64),
        ownerAddress: "owner@example.test",
      },
    );
    mocks.enrollAgent.mockResolvedValue(enrollResult());
    await AgentEnrollCommand.run(["--session", session, "--json"], { root });
    expect(process.exitCode).not.toBe(ALREADY_CONNECTED_EXIT_CODE);
    expect(mocks.enrollAgent).toHaveBeenCalledTimes(1);
    expect(mocks.disconnectAgent).not.toHaveBeenCalled();
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
