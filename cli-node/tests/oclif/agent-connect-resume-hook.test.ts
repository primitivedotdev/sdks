import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";

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
vi.mock("../../src/oclif/agent-setup.js", async (original) => ({
  ...(await original<typeof import("../../src/oclif/agent-setup.js")>()),
  setupAgent: mocks.setupAgent,
}));
vi.mock("../../src/oclif/agent-enroll.js", () => ({
  enrollAgent: mocks.enrollAgent,
}));
vi.mock("../../src/oclif/claude-wake-install.js", () => ({
  installClaudeWakeHook: mocks.installClaudeWakeHook,
}));
// The exact session is reachable for native receiving.
vi.mock("../../src/oclif/notify-session-native.js", async (original) => ({
  ...(await original<
    typeof import("../../src/oclif/notify-session-native.js")
  >()),
  connectNativeSession: async () => ({ close() {}, queue: async () => {} }),
}));
// Install from a bundle built by the real build step into scratch space, so
// this suite never depends on (or writes from) a local dist build.
vi.mock("../../src/oclif/connect-skill.js", async (original) => {
  const actual =
    await original<typeof import("../../src/oclif/connect-skill.js")>();
  return {
    ...actual,
    readBundledConnectSkill: () => actual.readBundledConnectSkill(bundleRoot),
  };
});

import AgentConnectCommand from "../../src/oclif/commands/agent-connect.js";
import AgentEnrollCommand from "../../src/oclif/commands/agent-enroll.js";

const root = resolve(import.meta.dirname, "../..");
const bundleRoot = mkdtempSync(join(tmpdir(), "connect-command-bundle-"));
execFileSync(
  process.execPath,
  [
    join(root, "scripts", "bundle-skills.mjs"),
    "--out",
    join(bundleRoot, "dist"),
  ],
  { stdio: "ignore" },
);
afterAll(() => rmSync(bundleRoot, { recursive: true, force: true }));
let home: string;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "connect-command-home-"));
  process.env.CLAUDE_CONFIG_DIR = join(home, "claude");
  process.env.CODEX_HOME = join(home, "codex");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  delete process.env.CLAUDE_CODE_SESSION_ID;
  delete process.env.CODEX_THREAD_ID;
  delete process.env.CLAUDE_CONFIG_DIR;
  delete process.env.CODEX_HOME;
  rmSync(home, { recursive: true, force: true });
  process.exitCode = undefined;
  vi.unstubAllEnvs();
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
    receiving: { state: "hooks_pending" },
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
    receiving: { state: "hook_unavailable" },
    externalHook: "unavailable",
  });
  expect(JSON.parse(outputs[1])).toMatchObject({
    externalHook: "installed_unverified",
    receiving: { state: "hooks_installed" },
  });
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
    receiving: { state: "hooks_pending" },
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
    receiving: { state: "hook_unavailable" },
    externalHook: "unavailable",
  });
  expect(JSON.parse(outputs[1])).toMatchObject({
    externalHook: "installed_unverified",
    receiving: { state: "hooks_installed" },
  });
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

it("agent connect --session runs the whole flow with a default profile and one JSON result", async () => {
  const outputs: string[] = [];
  vi.spyOn(AgentConnectCommand.prototype, "log").mockImplementation((line) => {
    outputs.push(String(line));
  });
  process.env.CODEX_THREAD_ID = session;
  const invitation =
    "https://api.primitive.dev/v1/agent-connections/setup#token=secret";
  mocks.readAgentInvitation.mockResolvedValue(invitation);
  mocks.setupAgent.mockResolvedValue({
    identity: {
      profileName: `session-${session}`,
      agentAddress: "codex@example.com",
      orgId: "22222222-2222-4222-8222-222222222222",
      ownerAddress: "owner@example.com",
      apiBaseUrl: "https://api.primitive.dev/v1",
    },
    sessionId: session,
    verification: { state: "reply_submitted", deliveryStatus: "queued" },
    receiving: { state: "not_ready" },
    ownerNotifications: "enabled",
    resumeCommand: `primitive agent connect --profile session-${session} --session ${session} --resume --json`,
    guidance: "Receiving health is reported separately.",
  });
  await AgentConnectCommand.run(["--session", session, "--json"], { root });
  expect(outputs).toHaveLength(1);
  const output = JSON.parse(outputs[0] ?? "");
  expect(mocks.setupAgent).toHaveBeenCalledWith(
    expect.objectContaining({
      profileName: `session-${session}`,
      session,
      receiverMode: "native",
      invitation,
    }),
  );
  expect(output).toMatchObject({
    status: "pending",
    address: "codex@example.com",
    runtime: "codex",
    skill: {
      state: "installed",
      runtime: "codex",
      path: join(home, "codex", "skills", "primitive-connect"),
    },
    receiving: { mode: "native", state: "not_ready" },
    skipped: expect.arrayContaining([
      { step: "receiver", reason: "not_ready" },
    ]),
  });
  expect(outputs[0]).not.toContain("secret");
  expect(
    readFileSync(
      join(home, "codex", "skills", "primitive-connect", "SKILL.md"),
      "utf8",
    ),
  ).toContain("## Connect in one command");
  expect(process.exitCode).toBe(2);
  process.exitCode = undefined;

  outputs.length = 0;
  await AgentConnectCommand.run(
    ["--session", session, "--resume", "--no-skill", "--json"],
    { root },
  );
  expect(JSON.parse(outputs[0] ?? "").skill).toMatchObject({
    state: "skipped",
    reason: "not_requested",
  });
  expect(mocks.readAgentInvitation).toHaveBeenCalledTimes(1);
});

it("agent connect --status needs --profile or PRIMITIVE_AGENT_PROFILE", async () => {
  vi.stubEnv("PRIMITIVE_AGENT_PROFILE", "");
  vi.spyOn(AgentConnectCommand.prototype, "log").mockImplementation(
    () => undefined,
  );
  await expect(AgentConnectCommand.run(["--status"], { root })).rejects.toThrow(
    "Pass --profile <name> or set PRIMITIVE_AGENT_PROFILE.",
  );
  expect(mocks.readAgentInvitation).not.toHaveBeenCalled();
  expect(existsSync(join(home, "codex"))).toBe(false);
});

it("agent connect --status reads the profile selected by PRIMITIVE_AGENT_PROFILE", async () => {
  const configDir = join(home, "config");
  vi.stubEnv("PRIMITIVE_CONFIG_DIR", configDir);
  vi.stubEnv("PRIMITIVE_AGENT_PROFILE", "work");
  const { connectAgent } = await import("../../src/oclif/agent-connect.js");
  await connectAgent({
    configDir,
    profileName: "work",
    invitation: pollInvitation,
    fetch: async () =>
      new Response(
        JSON.stringify({
          success: true,
          data: {
            org_id: "22222222-2222-4222-8222-222222222222",
            api_base_url: "https://api.primitive.dev/v1",
            api_key: ["pconn", "d".repeat(48)].join("_"),
            owner_address: "owner@example.com",
            connection: {
              address: "env@example.com",
              owner_address: "owner@example.com",
              status: "claimed",
            },
          },
        }),
      ),
  });
  const outputs: string[] = [];
  vi.spyOn(AgentConnectCommand.prototype, "log").mockImplementation((line) => {
    outputs.push(String(line));
  });
  await AgentConnectCommand.run(["--status", "--json"], { root });
  expect(process.exitCode).toBeUndefined();
  expect(JSON.parse(outputs[0] ?? "")).toMatchObject({
    status: "configured",
    identity: { profileName: "work", agentAddress: "env@example.com" },
  });
  // An explicit --profile still wins over the environment.
  outputs.length = 0;
  await AgentConnectCommand.run(["--status", "--profile", "other"], { root });
  expect(outputs[0]).toContain("Agent profile other is not configured.");
});

it("agent connect --status exits 1 for a profile that is not configured", async () => {
  vi.stubEnv("PRIMITIVE_CONFIG_DIR", join(home, "config"));
  const outputs: string[] = [];
  vi.spyOn(AgentConnectCommand.prototype, "log").mockImplementation((line) => {
    outputs.push(String(line));
  });
  await AgentConnectCommand.run(["--profile", "nope", "--status", "--json"], {
    root,
  });
  expect(process.exitCode).toBe(1);
  expect(JSON.parse(outputs[0] ?? "")).toEqual({
    status: "not_configured",
    profileName: "nope",
    detail:
      "Agent profile nope is not configured. Run `primitive agent connect` with the owner's invitation to connect it.",
  });
  process.exitCode = undefined;
  outputs.length = 0;
  await AgentConnectCommand.run(["--profile", "nope", "--status"], { root });
  expect(process.exitCode).toBe(1);
  expect(outputs[0]).toContain("primitive agent connect");
});

const pollInvitation = `https://api.primitive.dev/v1/agent-connections/setup#token=${["invitation", "c".repeat(48)].join("_")}`;
function pollResult(profileName: string) {
  return {
    identity: {
      profileName,
      agentAddress: "cloud@example.com",
      orgId: "22222222-2222-4222-8222-222222222222",
      ownerAddress: "owner@example.com",
      apiBaseUrl: "https://api.primitive.dev/v1",
    },
    sessionId: null,
    verification: { state: "verified", deliveryStatus: "delivered" },
    receiving: { state: "poll" },
    resumeCommand: "primitive agent connect --resume",
    guidance: "Primitive verified this connection.",
  };
}

it.each([
  ["no session", ["--no-skill", "--json"]],
  ["an empty session", ["--session", "", "--no-skill", "--json"]],
  ["--receiver poll", ["--receiver", "poll", "--no-skill", "--json"]],
])("agent connect with %s claims once and reports poll receiving", async (_label, argv) => {
  const outputs: string[] = [];
  vi.spyOn(AgentConnectCommand.prototype, "log").mockImplementation((line) => {
    outputs.push(String(line));
  });
  const { invitationProfileName } = await import(
    "../../src/oclif/agent-connect-flow.js"
  );
  const profile = invitationProfileName(pollInvitation);
  expect(profile).toMatch(/^connection-[a-f0-9]{12}$/);
  mocks.readAgentInvitation.mockResolvedValue(pollInvitation);
  mocks.setupAgent.mockResolvedValue(pollResult(profile));
  await AgentConnectCommand.run(argv, { root });
  expect(process.exitCode).toBeUndefined();
  expect(mocks.readAgentInvitation).toHaveBeenCalledTimes(1);
  expect(mocks.setupAgent).toHaveBeenCalledTimes(1);
  const [options] = mocks.setupAgent.mock.calls[0];
  expect(options).toMatchObject({
    profileName: profile,
    receiverMode: "poll",
    invitation: pollInvitation,
  });
  expect(options).not.toHaveProperty("session");
  expect(mocks.installClaudeWakeHook).not.toHaveBeenCalled();
  const output = JSON.parse(outputs[0]);
  expect(output).toMatchObject({
    status: "connected",
    address: "cloud@example.com",
    profile,
    sessionId: null,
    receiving: {
      mode: "poll",
      state: "poll",
      checkCommand: `PRIMITIVE_AGENT_PROFILE=${profile} primitive agent check-mail --json`,
    },
    resumeCommand: `primitive agent connect --profile ${profile} --receiver poll --resume --no-skill --json`,
  });
  expect(output.cli.capabilities).toContain("poll_receiver");
});

it("agent connect with a profile and an explicitly empty session runs poll setup, not claim-only", async () => {
  const outputs: string[] = [];
  vi.spyOn(AgentConnectCommand.prototype, "log").mockImplementation((line) => {
    outputs.push(String(line));
  });
  mocks.readAgentInvitation.mockResolvedValue(pollInvitation);
  mocks.setupAgent.mockResolvedValue(pollResult("work"));
  await AgentConnectCommand.run(
    ["--profile", "work", "--session", "", "--no-skill", "--json"],
    { root },
  );
  expect(mocks.setupAgent).toHaveBeenCalledTimes(1);
  expect(mocks.setupAgent.mock.calls[0][0]).toMatchObject({
    profileName: "work",
    receiverMode: "poll",
    invitation: pollInvitation,
  });
  expect(JSON.parse(outputs[0])).toMatchObject({
    status: "connected",
    receiving: {
      mode: "poll",
      checkCommand:
        "PRIMITIVE_AGENT_PROFILE=work primitive agent check-mail --json",
    },
  });
});

it("agent enroll --receiver poll carries the check command in its JSON result", async () => {
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
    verification: { state: "verified" },
    receiving: { state: "poll" },
    contactRequestPolicy: "not_requested",
  });
  await AgentEnrollCommand.run(
    ["--session", session, "--receiver", "poll", "--json"],
    { root },
  );
  expect(process.exitCode).toBeUndefined();
  expect(mocks.installClaudeWakeHook).not.toHaveBeenCalled();
  expect(JSON.parse(outputs[0])).toMatchObject({
    receiving: {
      state: "poll",
      mode: "poll",
      checkCommand: `PRIMITIVE_AGENT_PROFILE=session-${session} primitive agent check-mail --json`,
    },
  });
});

it("agent connect without a session names the poll resume command when setup pauses", async () => {
  vi.spyOn(AgentConnectCommand.prototype, "log").mockImplementation(
    () => undefined,
  );
  const { invitationProfileName } = await import(
    "../../src/oclif/agent-connect-flow.js"
  );
  mocks.readAgentInvitation.mockResolvedValue(pollInvitation);
  mocks.setupAgent.mockRejectedValue(new Error("network"));
  await expect(
    AgentConnectCommand.run(["--no-skill", "--json"], { root }),
  ).rejects.toThrow(
    `run primitive agent connect --profile ${invitationProfileName(pollInvitation)} --receiver poll --resume --json`,
  );
  expect(mocks.readAgentInvitation).toHaveBeenCalledTimes(1);
});

it("agent connect refuses native or external receiving without a session before reading the invitation", async () => {
  vi.spyOn(AgentConnectCommand.prototype, "log").mockImplementation(
    () => undefined,
  );
  mocks.readAgentInvitation.mockResolvedValue(pollInvitation);
  for (const receiver of ["native", "external"])
    for (const argv of [
      ["--profile", "cloud", "--receiver", receiver, "--json"],
      ["--receiver", receiver, "--json"],
      ["--session", "", "--receiver", receiver, "--json"],
    ])
      await expect(AgentConnectCommand.run(argv, { root })).rejects.toThrow(
        /Without one, use --receiver poll. No invitation was claimed/,
      );
  expect(mocks.setupAgent).not.toHaveBeenCalled();
  expect(mocks.readAgentInvitation).not.toHaveBeenCalled();
});

it("agent connect points a paused npx setup back at npx", async () => {
  vi.spyOn(AgentConnectCommand.prototype, "log").mockImplementation(
    () => undefined,
  );
  const entry = process.argv[1];
  process.argv[1] =
    "/home/user/.npm/_npx/abc/node_modules/primitive/bin/run.js";
  mocks.readAgentInvitation.mockResolvedValue("invitation");
  mocks.setupAgent.mockRejectedValue(new Error("network"));
  try {
    await expect(
      AgentConnectCommand.run(["--session", session, "--no-skill"], { root }),
    ).rejects.toThrow(
      `run npx -y primitive@latest agent connect --profile session-${session} --session ${session} --resume --json`,
    );
  } finally {
    process.argv[1] = entry ?? "";
  }
});

it("agent connect --json prints one document reporting verification and nothing on stderr", async () => {
  const outputs: string[] = [];
  vi.spyOn(AgentConnectCommand.prototype, "log").mockImplementation((line) => {
    outputs.push(String(line));
  });
  const stderr: string[] = [];
  vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    stderr.push(String(chunk));
    return true;
  });
  vi.spyOn(AgentConnectCommand.prototype, "warn").mockImplementation((line) => {
    stderr.push(String(line));
    return line;
  });
  process.env.CLAUDE_CODE_SESSION_ID = session;
  mocks.setupAgent.mockResolvedValue({
    identity: {
      profileName: "invited-profile",
      agentAddress: "invited@example.com",
      orgId: "22222222-2222-4222-8222-222222222222",
      ownerAddress: "owner@example.com",
      apiBaseUrl: "https://api.primitive-staging-1.com/v1",
    },
    sessionId: session,
    verification: {
      state: "verified",
      verifiedAt: "2026-09-28T19:00:04.000Z",
      deliveryStatus: "queued",
    },
    receiving: { state: "hooks_pending" },
    resumeCommand: "primitive agent connect --resume",
    guidance: "Primitive verified this connection.",
  });
  mocks.installClaudeWakeHook.mockReturnValue("installed_unverified");
  await AgentConnectCommand.run(
    [
      "--profile",
      "invited-profile",
      "--session",
      session,
      "--receiver",
      "external",
      "--resume",
      "--json",
    ],
    { root },
  );
  expect(process.exitCode).toBeUndefined();
  expect(outputs).toHaveLength(1);
  expect(JSON.parse(outputs[0])).toMatchObject({
    status: "connected",
    verification: {
      state: "verified",
      verifiedAt: "2026-09-28T19:00:04.000Z",
    },
    externalHook: "installed_unverified",
  });
  expect(stderr).toEqual([]);
  expect(mocks.installClaudeWakeHook).toHaveBeenCalledOnce();
});

it("agent connect tells the agent what to do next when a connection completes", async () => {
  const outputs: string[] = [];
  vi.spyOn(AgentConnectCommand.prototype, "log").mockImplementation((line) => {
    outputs.push(String(line));
  });
  process.env.CODEX_THREAD_ID = session;
  mocks.readAgentInvitation.mockResolvedValue(
    "https://api.primitive.dev/v1/agent-connections/setup#token=secret",
  );
  mocks.setupAgent.mockResolvedValue({
    identity: {
      profileName: `session-${session}`,
      agentAddress: "codex-1@example.com",
      orgId: "22222222-2222-4222-8222-222222222222",
      ownerAddress: "owner@example.com",
      apiBaseUrl: "https://api.primitive.dev/v1",
    },
    connectionName: "codex-1",
    sessionId: session,
    verification: { state: "verified", verifiedAt: null },
    receiving: { state: "poll" },
    ownerNotifications: "enabled",
    resumeCommand: "primitive agent connect --resume",
    guidance: "Primitive verified this connection.",
  });
  const argv = ["--session", session, "--receiver", "poll", "--no-skill"];
  await AgentConnectCommand.run([...argv, "--json"], { root });
  const output = JSON.parse(outputs[0] ?? "");
  expect(output).toMatchObject({
    status: "connected",
    name: "codex-1",
    nameIsDefault: true,
  });
  expect(output.suggestions.map((s: { kind: string }) => s.kind)).toEqual([
    "rename",
    "runtime_note",
  ]);
  expect(output.nextSteps).toHaveLength(3);
  expect(output.nextSteps[0]).toMatch(
    /^Report to the owner in two short sentences: that this agent is connected as codex-1@example\.com/,
  );
  expect(output.nextSteps[1]).toContain('generated name "codex-1"');
  expect(output.nextSteps[2]).toBe(
    "Load the primitive-connect skill before handling any mail.",
  );
  expect(output.guidance).toContain(`Next: ${output.nextSteps[0]}`);

  outputs.length = 0;
  await AgentConnectCommand.run(argv, { root });
  const text = outputs.join("\n");
  expect(text).toContain("Next steps:\n1. Report to the owner");
  expect(text).toContain("\n3. Load the primitive-connect skill");
});

it("agent enroll tells the agent what to do next when pairing completes", async () => {
  const outputs: string[] = [];
  vi.spyOn(AgentEnrollCommand.prototype, "log").mockImplementation((line) => {
    outputs.push(String(line));
  });
  mocks.enrollAgent.mockResolvedValue({
    identity: {
      profileName: `session-${session}`,
      agentAddress: "enrolled@example.com",
    },
    name: "Coding agent",
    connection: { status: "connected" },
    verification: { state: "verified" },
    receiving: { state: "healthy" },
    contactRequestPolicy: "not_requested",
    guidance: "Pairing verified.",
  });
  await AgentEnrollCommand.run(["--session", session, "--json"], { root });
  const output = JSON.parse(outputs[0] ?? "");
  expect(output.nameIsDefault).toBe(true);
  expect(output.nextSteps[0]).toContain(
    "a background listener receives new mail",
  );
  expect(output.nextSteps[1]).toContain('generated name "Coding agent"');
  expect(output.guidance).toMatch(/^Pairing verified\. Next: Report/);
});
