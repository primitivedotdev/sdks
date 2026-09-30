import { resolve } from "node:path";
import { afterEach, expect, it, vi } from "vitest";

const session = "11111111-1111-4111-8111-111111111111";
const mocks = vi.hoisted(() => ({
  setupAgent: vi.fn(),
  enrollAgent: vi.fn(),
  readAgentInvitation: vi.fn(),
  installClaudeWakeHook: vi.fn(),
}));

vi.mock("../../src/oclif/agent-connect.js", async (original) => ({
  ...(await original<typeof import("../../src/oclif/agent-connect.js")>()),
  readAgentInvitation: mocks.readAgentInvitation,
}));
vi.mock("../../src/oclif/agent-setup.js", () => ({
  setupAgent: mocks.setupAgent,
}));
vi.mock("../../src/oclif/agent-enroll.js", () => ({
  enrollAgent: mocks.enrollAgent,
}));
vi.mock("../../src/oclif/claude-wake-install.js", () => ({
  installClaudeWakeHook: mocks.installClaudeWakeHook,
}));

import AgentConnectCommand from "../../src/oclif/commands/agent-connect.js";
import AgentEnrollCommand from "../../src/oclif/commands/agent-enroll.js";

const root = resolve(import.meta.dirname, "../..");
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  delete process.env.CLAUDE_CODE_SESSION_ID;
  process.exitCode = undefined;
});

it("agent enroll reports failed external hook installation as incomplete", async () => {
  const outputs: string[] = [];
  vi.spyOn(AgentEnrollCommand.prototype, "log").mockImplementation((line) => {
    outputs.push(String(line));
  });
  mocks.enrollAgent.mockResolvedValue({
    identity: {
      profileName: `session-${session}`,
      agentAddress: "enrolled@example.com",
    },
    connection: { status: "connected" },
    verification: { state: "reply_submitted" },
    receiving: { state: "external_setup_required" },
    contactRequestPolicy: "unchanged",
  });
  mocks.installClaudeWakeHook
    .mockReturnValueOnce("unavailable")
    .mockReturnValueOnce("installed_unverified");
  const argv = ["--session", session, "--receiver", "external", "--json"];
  await AgentEnrollCommand.run(argv, { root });
  expect(process.exitCode).toBe(2);
  process.exitCode = undefined;
  await AgentEnrollCommand.run(argv, { root });
  expect(process.exitCode).toBeUndefined();
  expect(mocks.enrollAgent).toHaveBeenCalledTimes(2);
  expect(JSON.parse(outputs[0])).toMatchObject({
    connection: { status: "connected" },
    receiving: { state: "external_setup_required" },
    externalHook: "unavailable",
  });
  expect(JSON.parse(outputs[1]).externalHook).toBe("installed_unverified");
  expect(mocks.installClaudeWakeHook.mock.calls[1][0]).toMatchObject({
    profileName: `session-${session}`,
    agentAddress: "enrolled@example.com",
    sessionId: session,
  });
});

it("agent connect --resume retries only failed hook installation", async () => {
  const outputs: string[] = [];
  vi.spyOn(AgentConnectCommand.prototype, "log").mockImplementation((line) => {
    outputs.push(String(line));
  });
  process.env.CLAUDE_CODE_SESSION_ID = session;
  const result = {
    identity: {
      profileName: "invited-profile",
      agentAddress: "invited@example.com",
      orgId: "22222222-2222-4222-8222-222222222222",
      ownerAddress: "owner@example.com",
      apiBaseUrl: "https://api.primitive-staging-1.com/v1",
    },
    sessionId: session,
    verification: { state: "reply_submitted", deliveryStatus: "queued" },
    receiving: { state: "external_setup_required" },
    resumeCommand: "primitive agent connect --resume",
  };
  mocks.setupAgent.mockResolvedValue(result);
  mocks.installClaudeWakeHook
    .mockReturnValueOnce("unavailable")
    .mockReturnValueOnce("installed_unverified");
  const argv = [
    "--profile",
    "invited-profile",
    "--session",
    session,
    "--receiver",
    "external",
    "--resume",
    "--json",
  ];
  await AgentConnectCommand.run(argv, { root });
  expect(process.exitCode).toBe(2);
  process.exitCode = undefined;
  await AgentConnectCommand.run(argv, { root });
  expect(process.exitCode).toBeUndefined();
  expect(mocks.readAgentInvitation).not.toHaveBeenCalled();
  expect(JSON.parse(outputs[0])).toMatchObject({
    verification: { state: "reply_submitted" },
    receiving: { state: "external_setup_required" },
    externalHook: "unavailable",
  });
  expect(JSON.parse(outputs[1]).externalHook).toBe("installed_unverified");
  expect(mocks.setupAgent).toHaveBeenCalledTimes(2);
  for (const [options] of mocks.setupAgent.mock.calls) {
    expect(options).toMatchObject({
      profileName: "invited-profile",
      session,
      receiverMode: "external",
      resume: true,
    });
    expect(options).not.toHaveProperty("invitation");
  }
  expect(mocks.installClaudeWakeHook).toHaveBeenCalledTimes(2);
  expect(mocks.installClaudeWakeHook.mock.calls[1][0]).toMatchObject({
    profileName: "invited-profile",
    agentAddress: "invited@example.com",
    sessionId: session,
  });
});

it("agent enroll parses the exact pending-only continuation flag without changing session identity", async () => {
  vi.spyOn(AgentEnrollCommand.prototype, "log").mockImplementation(
    () => undefined,
  );
  mocks.enrollAgent.mockResolvedValue({
    identity: {
      profileName: `session-${session}`,
      agentAddress: "enrolled@example.com",
    },
    connection: { status: "connected" },
    verification: { state: "reply_submitted" },
    receiving: { state: "healthy" },
    contactRequestPolicy: "not_requested",
  });
  await AgentEnrollCommand.run(
    ["--session", session, "--name", "Research", "--continue-setup", "--json"],
    { root },
  );
  expect(mocks.enrollAgent).toHaveBeenCalledWith(
    expect.objectContaining({ session, name: "Research", continueSetup: true }),
  );
  expect(mocks.installClaudeWakeHook).not.toHaveBeenCalled();
});
