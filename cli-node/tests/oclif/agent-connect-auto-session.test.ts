import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const invitation = `https://api.primitive.dev/v1/agent-connections/setup#token=${["invitation", "c".repeat(48)].join("_")}`;
const mocks = vi.hoisted(() => ({
  setupAgent: vi.fn(),
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
vi.mock("../../src/oclif/claude-wake-install.js", () => ({
  installClaudeWakeHook: mocks.installClaudeWakeHook,
}));
vi.mock("../../src/oclif/notify-session-native.js", async (original) => ({
  ...(await original<
    typeof import("../../src/oclif/notify-session-native.js")
  >()),
  connectNativeSession: async () => ({ close() {}, queue: async () => {} }),
}));

import AgentConnectCommand from "../../src/oclif/commands/agent-connect.js";

const root = resolve(import.meta.dirname, "../..");
let home: string;
let outputs: string[];

function environment(values: {
  CLAUDE_CODE_SESSION_ID?: string;
  CODEX_THREAD_ID?: string;
  CODEX_SESSION_ID?: string;
}) {
  for (const name of [
    "CLAUDE_CODE_SESSION_ID",
    "CODEX_THREAD_ID",
    "CODEX_SESSION_ID",
  ] as const)
    vi.stubEnv(name, values[name] ?? "");
}

function setupResult(profileName: string, sessionId: string | null) {
  return {
    identity: {
      profileName,
      agentAddress: "agent@example.com",
      orgId: "33333333-3333-4333-8333-333333333333",
      ownerAddress: "owner@example.com",
      apiBaseUrl: "https://api.primitive.dev/v1",
    },
    sessionId,
    verification: { state: "reply_submitted", deliveryStatus: "queued" },
    receiving: { state: sessionId ? "hooks_pending" : "poll" },
    resumeCommand: "primitive agent connect --resume",
    guidance: "Receiving health is reported separately.",
  };
}

/** Runs one connect in a fresh config dir and returns what setup was asked to do and what was printed. */
async function connect(argv: string[]) {
  const configDir = join(home, "config");
  rmSync(configDir, { recursive: true, force: true });
  vi.stubEnv("PRIMITIVE_CONFIG_DIR", configDir);
  mocks.setupAgent.mockClear();
  outputs = [];
  await AgentConnectCommand.run([...argv, "--no-skill", "--json"], { root });
  const [options] = mocks.setupAgent.mock.calls[0] ?? [];
  const exitCode = process.exitCode;
  process.exitCode = undefined;
  return {
    options,
    output: JSON.parse(outputs[0] ?? "null"),
    exitCode,
  };
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "connect-auto-session-"));
  vi.stubEnv("PRIMITIVE_AGENT_PROFILE", "");
  vi.stubEnv("CLAUDE_CONFIG_DIR", join(home, "claude"));
  vi.stubEnv("CODEX_HOME", join(home, "codex"));
  outputs = [];
  vi.spyOn(AgentConnectCommand.prototype, "log").mockImplementation((line) => {
    outputs.push(String(line));
  });
  mocks.readAgentInvitation.mockResolvedValue(invitation);
  mocks.installClaudeWakeHook.mockReturnValue("installed_unverified");
  mocks.setupAgent.mockImplementation(
    async (options: { profileName: string; session?: string }) =>
      setupResult(options.profileName, options.session ?? null),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  rmSync(home, { recursive: true, force: true });
  process.exitCode = undefined;
});

describe("agent connect --session auto", () => {
  it.each([
    [
      "Claude Code",
      { CLAUDE_CODE_SESSION_ID: session.toUpperCase() },
      { runtime: "claude", variable: "CLAUDE_CODE_SESSION_ID" },
      "external",
    ],
    [
      "Codex, preferring the loaded thread over the process session",
      { CODEX_THREAD_ID: session, CODEX_SESSION_ID: other },
      { runtime: "codex", variable: "CODEX_THREAD_ID" },
      "native",
    ],
  ])(
    "in %s connects exactly as the explicit session would",
    async (_runtime, env, found, receiverMode) => {
      environment(env);
      const explicit = await connect(["--session", session]);
      const auto = await connect(["--session", "auto"]);
      expect(auto.options).toMatchObject({
        profileName: `session-${session}`,
        session,
        receiverMode,
        invitation,
      });
      expect(auto.options).toEqual(explicit.options);
      const { sessionDetection, ...rest } = auto.output;
      expect(sessionDetection).toEqual({
        state: "detected",
        session,
        ...found,
      });
      expect(rest).toEqual(explicit.output);
      expect(auto.exitCode).toBe(explicit.exitCode);
    },
  );

  it("without a session in the environment connects with poll receiving and says why", async () => {
    environment({ CLAUDE_CODE_SESSION_ID: "not-a-session" });
    const { options, output } = await connect(["--session", "auto"]);
    expect(mocks.readAgentInvitation).toHaveBeenCalledTimes(1);
    expect(options).toMatchObject({ receiverMode: "poll", invitation });
    expect(options).not.toHaveProperty("session");
    expect(output).toMatchObject({
      sessionId: null,
      receiving: { mode: "poll" },
      sessionDetection: {
        state: "not_detected",
        detail: expect.stringContaining(
          "CLAUDE_CODE_SESSION_ID, CODEX_THREAD_ID or CODEX_SESSION_ID",
        ),
      },
    });
  });

  it("refuses when two runtimes name sessions, before reading the invitation", async () => {
    environment({ CLAUDE_CODE_SESSION_ID: session, CODEX_THREAD_ID: other });
    const run = AgentConnectCommand.run(["--session", "auto", "--json"], {
      root,
    });
    await expect(run).rejects.toThrow(
      `--session auto found more than one session in this environment (CLAUDE_CODE_SESSION_ID=${session}, CODEX_THREAD_ID=${other}). Pass the exact session with --session <uuid>.`,
    );
    expect(mocks.readAgentInvitation).not.toHaveBeenCalled();
    expect(mocks.setupAgent).not.toHaveBeenCalled();
    expect(outputs).toEqual([]);
  });

  it("names the detected session, never auto, when setup pauses", async () => {
    environment({ CODEX_THREAD_ID: session });
    mocks.setupAgent.mockRejectedValue(new Error("network"));
    const run = AgentConnectCommand.run(
      ["--session", "auto", "--no-skill", "--json"],
      { root },
    );
    await expect(run).rejects.toThrow(
      `agent connect --profile session-${session} --session ${session} --resume --json`,
    );
    await expect(run).rejects.not.toThrow(/--session auto/);
  });

  it("reads status for the detected session", async () => {
    environment({ CODEX_THREAD_ID: session });
    vi.stubEnv("PRIMITIVE_CONFIG_DIR", join(home, "config"));
    await AgentConnectCommand.run(["--status", "--session", "auto", "--json"], {
      root,
    });
    expect(process.exitCode).toBe(1);
    expect(JSON.parse(outputs[0] ?? "")).toMatchObject({
      status: "not_configured",
      session,
      sessionDetection: { state: "detected", runtime: "codex", session },
    });
  });

  it("reads status like no --session when the environment names none", async () => {
    environment({});
    vi.stubEnv("PRIMITIVE_CONFIG_DIR", join(home, "config"));
    vi.stubEnv("PRIMITIVE_AGENT_PROFILE", "work");
    await AgentConnectCommand.run(["--status", "--session", "auto", "--json"], {
      root,
    });
    expect(JSON.parse(outputs[0] ?? "")).toMatchObject({
      status: "not_configured",
      profileName: "work",
      sessionDetection: { state: "not_detected" },
    });
    vi.stubEnv("PRIMITIVE_AGENT_PROFILE", "");
    await expect(
      AgentConnectCommand.run(["--status", "--session", "auto"], { root }),
    ).rejects.toThrow(/found no session UUID .* Pass --profile <name>/);
  });
});
