import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { connectAgent } from "../../src/oclif/agent-connect.js";
import {
  AGENT_CONNECT_CAPABILITIES,
  type AgentConnectFlowDependencies,
  type AgentConnectFlowOptions,
  agentInfoValue,
  defaultAgentProfileName,
  runAgentConnect,
} from "../../src/oclif/agent-connect-flow.js";
import type { setupAgent } from "../../src/oclif/agent-setup.js";
import {
  AgentConnectionSetupError,
  agentProfileDirectory,
} from "../../src/oclif/connected-agent-profile.js";
import { notificationScope } from "../../src/oclif/notify-session.js";
import { writeMailJson } from "../../src/oclif/shared-mail-files.js";

const session = "11111111-1111-4111-8111-111111111111";
const token = ["invitation", "a".repeat(48)].join("_");
const credential = ["pconn", "b".repeat(48)].join("_");
const apiBaseUrl = "https://api.primitive.dev/v1";
const invitation = `${apiBaseUrl}/agent-connections/setup#token=${token}`;
const identity = {
  profileName: defaultAgentProfileName(session),
  orgId: "33333333-3333-4333-8333-333333333333",
  agentAddress: "agent@example.test",
  ownerAddress: "owner@example.test",
  apiBaseUrl,
};
type SetupResult = Awaited<ReturnType<typeof setupAgent>>;
function setupResult(
  overrides: {
    verification?: SetupResult["verification"];
    receiving?: string;
  } = {},
): SetupResult {
  return {
    identity,
    sessionId: session,
    verification: overrides.verification ?? {
      state: "reply_submitted",
      sentId: "44444444-4444-4444-8444-444444444444",
      deliveryStatus: "delivered",
    },
    receiving: { state: overrides.receiving ?? "healthy" },
    ownerNotifications: "enabled",
    resumeCommand: `primitive agent connect --profile ${identity.profileName} --session ${session} --resume --json`,
    guidance: "Reply submission is not proof of delivery.",
  };
}

const directories: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function fixture(
  overrides: Partial<AgentConnectFlowOptions> = {},
  result: SetupResult = setupResult(),
) {
  const configDir = mkdtempSync(join(tmpdir(), "agent-connect-flow-"));
  directories.push(configDir);
  const dependencies = {
    setupAgent: vi.fn<AgentConnectFlowDependencies["setupAgent"]>(
      async () => result,
    ),
    installClaudeWakeHook: vi.fn<
      AgentConnectFlowDependencies["installClaudeWakeHook"]
    >(() => "installed_unverified"),
    installSkill: vi.fn<AgentConnectFlowDependencies["installSkill"]>(
      (runtime) => ({
        state: "installed",
        runtime,
        path: `/skills/${runtime}/primitive-connect`,
        version: "0123456789abcdef",
      }),
    ),
    seedAgentInfo: vi.fn<AgentConnectFlowDependencies["seedAgentInfo"]>(
      async () => "created",
    ),
    awaitMailCheck: vi.fn<AgentConnectFlowDependencies["awaitMailCheck"]>(
      async () => ({
        state: "confirmed",
        lastSuccessfulMailCheckAt: "2026-10-01T21:12:00.000Z",
      }),
    ),
  };
  const readInvitation = vi.fn(async () => invitation);
  const options: AgentConnectFlowOptions = {
    configDir,
    packageRoot: "/package",
    cliVersion: "1.36.0",
    cliPath: "/cli/bin/run.js",
    session,
    env: { CODEX_THREAD_ID: session },
    readInvitation,
    ...overrides,
    dependencies: { ...dependencies, ...overrides.dependencies },
  };
  return { configDir, dependencies, readInvitation, options };
}

describe("one-command agent connect", () => {
  it("runs every step for a Codex session and prints one complete result", async () => {
    const { options, dependencies, readInvitation } = fixture({
      name: "Research",
      info: "Reviews pull requests and runs tests",
      contactRequests: true,
    });
    const output = await runAgentConnect(options);
    expect(dependencies.installSkill).toHaveBeenCalledWith("codex");
    expect(readInvitation).toHaveBeenCalledTimes(1);
    expect(dependencies.setupAgent).toHaveBeenCalledWith({
      configDir: options.configDir,
      profileName: `session-${session}`,
      session,
      receiverMode: "native",
      resume: undefined,
      contactRequests: true,
      invitation,
    });
    expect(dependencies.awaitMailCheck).toHaveBeenCalledWith(
      `session-${session}`,
      expect.any(Number),
    );
    expect(dependencies.seedAgentInfo).toHaveBeenCalledWith(
      `session-${session}`,
      "Research: Reviews pull requests and runs tests",
    );
    expect(dependencies.installClaudeWakeHook).not.toHaveBeenCalled();
    expect(output).toMatchObject({
      status: "connected",
      address: identity.agentAddress,
      orgId: identity.orgId,
      ownerAddress: identity.ownerAddress,
      profile: `session-${session}`,
      sessionId: session,
      runtime: "codex",
      cli: {
        version: "1.36.0",
        capabilities: [...AGENT_CONNECT_CAPABILITIES],
      },
      skill: { state: "installed", runtime: "codex" },
      verification: { state: "reply_submitted" },
      receiving: {
        mode: "native",
        state: "healthy",
        mailCheck: "confirmed",
        lastSuccessfulMailCheckAt: "2026-10-01T21:12:00.000Z",
      },
      ownerNotifications: "enabled",
      agentInfo: "created",
      skipped: [],
      selectProfile: `PRIMITIVE_AGENT_PROFILE=session-${session}`,
      externalHook: null,
    });
    const serialized = JSON.stringify(output);
    expect(serialized).not.toContain(token);
    expect(serialized).not.toContain(credential);
  });

  it("defaults a Claude session to external hooks and skips the mail check", async () => {
    const { options, dependencies } = fixture(
      { env: { CLAUDE_CODE_SESSION_ID: session } },
      setupResult({ receiving: "external_setup_required" }),
    );
    const output = await runAgentConnect(options);
    expect(dependencies.installSkill).toHaveBeenCalledWith("claude");
    expect(dependencies.setupAgent.mock.calls[0]?.[0].receiverMode).toBe(
      "external",
    );
    expect(dependencies.installClaudeWakeHook).toHaveBeenCalledWith({
      cliPath: "/cli/bin/run.js",
      configDir: options.configDir,
      profileName: identity.profileName,
      agentAddress: identity.agentAddress,
      sessionId: session,
      env: { CLAUDE_CODE_SESSION_ID: session },
    });
    expect(dependencies.awaitMailCheck).not.toHaveBeenCalled();
    expect(output).toMatchObject({
      status: "connected",
      runtime: "claude",
      receiving: { mode: "external", hook: "installed_unverified" },
      externalHook: "installed_unverified",
      agentInfo: "not_requested",
      skipped: [{ step: "agent_info", reason: "not_requested" }],
    });
  });

  it("reports an unavailable Claude hook as pending", async () => {
    const { options, dependencies } = fixture(
      { env: { CLAUDE_CODE_SESSION_ID: session } },
      setupResult({ receiving: "external_setup_required" }),
    );
    dependencies.installClaudeWakeHook.mockReturnValue("unavailable");
    const output = await runAgentConnect({ ...options, dependencies });
    expect(output.status).toBe("pending");
    expect(output.externalHook).toBe("unavailable");
  });

  it("refuses external receiving outside the exact Claude session before reading the invitation", async () => {
    const { options, dependencies, readInvitation } = fixture({
      receiver: "external",
    });
    await expect(runAgentConnect(options)).rejects.toThrow(
      /exact Claude session ID\. No invitation was claimed/,
    );
    expect(readInvitation).not.toHaveBeenCalled();
    expect(dependencies.setupAgent).not.toHaveBeenCalled();
    expect(dependencies.installSkill).not.toHaveBeenCalled();
  });

  it("refuses a malformed session or invalid note text before any step", async () => {
    for (const overrides of [
      { session: "not-a-session" },
      { name: "x".repeat(81) },
      { info: "   " },
      { name: "bad\u0007name" },
    ]) {
      const { options, dependencies, readInvitation } = fixture(overrides);
      await expect(runAgentConnect(options)).rejects.toBeInstanceOf(
        AgentConnectionSetupError,
      );
      expect(readInvitation).not.toHaveBeenCalled();
      expect(dependencies.setupAgent).not.toHaveBeenCalled();
    }
  });

  it("skips the skill for an unknown runtime or --no-skill and keeps connecting", async () => {
    const unknown = fixture({ env: {} });
    const first = await runAgentConnect(unknown.options);
    expect(unknown.dependencies.installSkill).not.toHaveBeenCalled();
    expect(first.runtime).toBeNull();
    expect(first.skill).toEqual({
      state: "skipped",
      runtime: null,
      path: null,
      version: null,
      reason: "runtime_unknown",
    });
    expect(first.skipped).toContainEqual({
      step: "skill",
      reason: "runtime_unknown",
    });
    expect(first.status).toBe("connected");

    const declined = fixture({ skill: false });
    const second = await runAgentConnect(declined.options);
    expect(declined.dependencies.installSkill).not.toHaveBeenCalled();
    expect(second.skill).toMatchObject({
      state: "skipped",
      reason: "not_requested",
    });
  });

  it("reports a missing bundled skill without stopping the connection", async () => {
    const { options, dependencies } = fixture();
    dependencies.installSkill.mockImplementation(() => {
      throw new Error("missing");
    });
    const output = await runAgentConnect({ ...options, dependencies });
    expect(output.skill).toMatchObject({
      state: "failed",
      reason: "bundled_skill_unavailable",
    });
    expect(dependencies.setupAgent).toHaveBeenCalled();
  });

  it("holds receiving and AGENT_INFO until verification and resumes through npx", async () => {
    const { options, dependencies } = fixture(
      {
        name: "Research",
        invocation: "npx -y primitive@latest",
      },
      setupResult({
        verification: { state: "challenge_pending" },
        receiving: "not_started",
      }),
    );
    const output = await runAgentConnect(options);
    expect(dependencies.seedAgentInfo).not.toHaveBeenCalled();
    expect(dependencies.awaitMailCheck).not.toHaveBeenCalled();
    expect(output).toMatchObject({
      status: "pending",
      agentInfo: "pending_verification",
      receiving: { mode: "native", mailCheck: "not_started" },
      skipped: [
        { step: "receiver", reason: "pending_verification" },
        { step: "agent_info", reason: "pending_verification" },
      ],
    });
    expect(output.resumeCommand).toBe(
      `npx -y primitive@latest agent connect --profile session-${session} --session ${session} --receiver native --resume --json`,
    );
  });

  it("holds the Claude hook until verification", async () => {
    const { options, dependencies } = fixture(
      { env: { CLAUDE_CODE_SESSION_ID: session } },
      setupResult({
        verification: { state: "send_unknown" },
        receiving: "not_started",
      }),
    );
    const output = await runAgentConnect(options);
    expect(dependencies.installClaudeWakeHook).not.toHaveBeenCalled();
    expect(output.skipped).toContainEqual({
      step: "receiver",
      reason: "pending_verification",
    });
  });

  it("reports a verified native receiver that is not ready", async () => {
    const { options } = fixture({}, setupResult({ receiving: "not_ready" }));
    const output = await runAgentConnect(options);
    expect(output.status).toBe("pending");
    expect(output.skipped).toContainEqual({
      step: "receiver",
      reason: "not_ready",
    });
  });

  it("reports a mail check not yet observed without failing the connection", async () => {
    const { options, dependencies } = fixture();
    dependencies.awaitMailCheck.mockResolvedValue({
      state: "pending",
      lastSuccessfulMailCheckAt: null,
    });
    const output = await runAgentConnect({ ...options, dependencies });
    expect(output.status).toBe("connected");
    expect(output.receiving).toMatchObject({ mailCheck: "pending" });
    expect(output.skipped).toContainEqual({
      step: "mail_check",
      reason: "not_yet_observed",
    });
  });

  it("resumes without reading stdin and keeps an existing AGENT_INFO note", async () => {
    const { options, dependencies, readInvitation } = fixture({
      resume: true,
      info: "Coordinates releases",
      profileName: "custom",
    });
    dependencies.seedAgentInfo.mockResolvedValue("already_present");
    const output = await runAgentConnect({ ...options, dependencies });
    expect(readInvitation).not.toHaveBeenCalled();
    const call = dependencies.setupAgent.mock.calls[0]?.[0];
    expect(call).toMatchObject({ resume: true, profileName: "custom" });
    expect(call).not.toHaveProperty("invitation");
    expect(output.agentInfo).toBe("already_present");
    expect(output.skipped).toContainEqual({
      step: "agent_info",
      reason: "already_present",
    });
  });
});

describe("AGENT_INFO text", () => {
  it("joins a name and description and trims both", () => {
    expect(agentInfoValue(" Research ", " Reviews code ")).toBe(
      "Research: Reviews code",
    );
    expect(agentInfoValue("Research", undefined)).toBe("Research");
    expect(agentInfoValue(undefined, "Line one\nLine two")).toBe(
      "Line one\nLine two",
    );
    expect(agentInfoValue(undefined, undefined)).toBeNull();
  });
});

describe("default steps", () => {
  async function savedProfile(configDir: string, profileName: string) {
    const claim = {
      success: true,
      data: {
        org_id: identity.orgId,
        api_base_url: apiBaseUrl,
        api_key: credential,
        owner_address: identity.ownerAddress,
        connection: {
          address: identity.agentAddress,
          owner_address: identity.ownerAddress,
          status: "claimed",
        },
      },
    };
    await connectAgent({
      configDir,
      profileName,
      invitation,
      fetch: vi.fn<typeof fetch>(async () => Response.json(claim)),
    });
  }

  it("seeds a private AGENT_INFO note only when absent", async () => {
    const { options, configDir } = fixture();
    const profile = defaultAgentProfileName(session);
    await savedProfile(configDir, profile);
    const requests: Array<{ url: string; body: unknown; auth: string }> = [];
    const statuses = [200, 409, 500];
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input, init) => {
        const request = input instanceof Request ? input : null;
        const body = request ? await request.text() : String(init?.body ?? "");
        requests.push({
          url: request ? request.url : String(input),
          body: JSON.parse(body),
          auth:
            (request?.headers.get("authorization") ??
              new Headers(init?.headers).get("authorization")) ||
            "",
        });
        const status = statuses.shift() ?? 500;
        return status === 200
          ? Response.json({
              success: true,
              data: {
                address: identity.agentAddress,
                name: "AGENT_INFO",
                value: "Research",
                visibility: "private",
                version: "1",
                created_at: "2026-10-01T00:00:00Z",
                updated_at: "2026-10-01T00:00:00Z",
              },
            })
          : Response.json(
              { success: false, error: { code: "conflict" } },
              { status },
            );
      }),
    );
    const run = (name: string) =>
      runAgentConnect({
        ...options,
        name,
        dependencies: {
          ...options.dependencies,
          seedAgentInfo: undefined,
        },
      });
    expect((await run("Research")).agentInfo).toBe("created");
    expect((await run("Research")).agentInfo).toBe("already_present");
    expect((await run("Research")).agentInfo).toBe("failed");
    expect(requests[0]).toEqual({
      url: `${apiBaseUrl}/address-notes/${encodeURIComponent(identity.agentAddress)}/AGENT_INFO`,
      body: { value: "Research", if_absent: true, visibility: "private" },
      auth: `Bearer ${credential}`,
    });
  });

  it("reports a missing profile as a failed seed", async () => {
    const { options } = fixture({ name: "Research" });
    const output = await runAgentConnect({
      ...options,
      dependencies: { ...options.dependencies, seedAgentInfo: undefined },
    });
    expect(output.agentInfo).toBe("failed");
  });

  it("confirms the listener's recorded mail check, or reports it pending", async () => {
    const { options, configDir } = fixture({ mailCheckWaitMs: 0 });
    const profile = defaultAgentProfileName(session);
    const withoutDefault = {
      ...options,
      dependencies: { ...options.dependencies, awaitMailCheck: undefined },
    };
    expect((await runAgentConnect(withoutDefault)).receiving).toMatchObject({
      mailCheck: "pending",
      lastSuccessfulMailCheckAt: null,
    });
    await savedProfile(configDir, profile);
    writeMailJson(
      join(agentProfileDirectory(configDir, profile), "setup.json"),
      {
        session,
        receiverMode: "native",
      },
    );
    const scope = notificationScope(apiBaseUrl, credential);
    const recordCheck = (lastMailCheckAt: string) =>
      writeMailJson(
        join(
          configDir,
          "shared-mail",
          createHash("sha256").update(scope).digest("hex"),
          "owner.json",
        ),
        {
          generation: randomUUID(),
          pid: process.pid,
          identity: "listener",
          ready: true,
          gapCount: 0,
          lastGapReason: null,
          lastMailCheckAt,
        },
      );
    // A reused receiver's check from before this setup does not count.
    recordCheck("2020-01-01T00:00:00.000Z");
    expect((await runAgentConnect(withoutDefault)).receiving).toMatchObject({
      mailCheck: "pending",
      lastSuccessfulMailCheckAt: null,
    });
    // A check recorded while setup runs does.
    let checkedAt = "";
    const setup = vi.fn<AgentConnectFlowDependencies["setupAgent"]>(
      async () => {
        checkedAt = new Date().toISOString();
        recordCheck(checkedAt);
        return setupResult();
      },
    );
    const confirmed = await runAgentConnect({
      ...withoutDefault,
      dependencies: { ...withoutDefault.dependencies, setupAgent: setup },
    });
    expect(confirmed.receiving).toMatchObject({
      mailCheck: "confirmed",
      lastSuccessfulMailCheckAt: checkedAt,
    });
  });
});

describe("review follow-ups", () => {
  it("keeps a requested AGENT_INFO note privately across a paused setup and writes it on resume", async () => {
    const paused = fixture(
      { name: "Research", info: "Reviews code" },
      setupResult({
        verification: { state: "challenge_pending" },
        receiving: "not_started",
      }),
    );
    const first = await runAgentConnect(paused.options);
    expect(first.agentInfo).toBe("pending_verification");
    expect(first.resumeCommand).not.toContain("Research");
    expect(paused.dependencies.seedAgentInfo).not.toHaveBeenCalled();
    const pending = join(
      agentProfileDirectory(paused.configDir, `session-${session}`),
      "agent-info-pending.json",
    );
    expect(statSync(pending).mode & 0o077).toBe(0);

    paused.dependencies.setupAgent.mockResolvedValue(setupResult());
    paused.dependencies.seedAgentInfo.mockResolvedValueOnce("failed");
    const failed = await runAgentConnect({
      ...paused.options,
      name: undefined,
      info: undefined,
      resume: true,
    });
    expect(failed.agentInfo).toBe("failed");
    expect(failed.skipped).toContainEqual({
      step: "agent_info",
      reason: "failed",
    });
    expect(existsSync(pending)).toBe(true);

    const resumed = await runAgentConnect({
      ...paused.options,
      name: undefined,
      info: undefined,
      resume: true,
    });
    expect(paused.dependencies.seedAgentInfo).toHaveBeenLastCalledWith(
      `session-${session}`,
      "Research: Reviews code",
    );
    expect(resumed.agentInfo).toBe("created");
    expect(existsSync(pending)).toBe(false);

    const later = await runAgentConnect({
      ...paused.options,
      name: undefined,
      info: undefined,
      resume: true,
    });
    expect(later.agentInfo).toBe("not_requested");
  });

  it("lists a failed skill install in skipped", async () => {
    const { options, dependencies } = fixture();
    dependencies.installSkill.mockReturnValue({
      state: "failed",
      runtime: "codex",
      path: "/skills/codex/primitive-connect",
      version: "0123456789abcdef",
      reason: "EACCES",
    });
    const output = await runAgentConnect({ ...options, dependencies });
    expect(output.skipped).toContainEqual({ step: "skill", reason: "EACCES" });
  });

  it("repeats every choice that a resume would otherwise change, never note text", async () => {
    const { options } = fixture(
      {
        skill: false,
        project: true,
        contactRequests: true,
        name: "Private name",
        env: { CLAUDE_CODE_SESSION_ID: session },
      },
      setupResult({
        verification: { state: "challenge_pending" },
        receiving: "not_started",
      }),
    );
    const output = await runAgentConnect(options);
    expect(output.resumeCommand).toBe(
      `primitive agent connect --profile session-${session} --session ${session} --receiver external --resume --contact-requests --no-skill --project --json`,
    );
    expect(output.resumeCommand).not.toContain("Private name");
  });

  it("accepts a Claude session whose UUID differs only in case", async () => {
    const { options, dependencies } = fixture(
      {
        session: session.toUpperCase(),
        env: { CLAUDE_CODE_SESSION_ID: session },
      },
      setupResult({ receiving: "external_setup_required" }),
    );
    const output = await runAgentConnect(options);
    expect(output.runtime).toBe("claude");
    expect(dependencies.setupAgent.mock.calls[0]?.[0].receiverMode).toBe(
      "external",
    );
  });

  it("resumes a native setup in Claude Code with its saved receiver", async () => {
    for (const saved of [{ receiverMode: "native" }, {}]) {
      const { options, configDir, dependencies } = fixture({
        resume: true,
        env: { CLAUDE_CODE_SESSION_ID: session },
      });
      writeMailJson(
        join(
          agentProfileDirectory(configDir, `session-${session}`),
          "setup.json",
        ),
        { session, ...saved },
      );
      const output = await runAgentConnect(options);
      expect(dependencies.setupAgent.mock.calls[0]?.[0].receiverMode).toBe(
        "native",
      );
      expect(output.receiving.mode).toBe("native");
      expect(output.resumeCommand).toContain("--receiver native");
    }
  });
});
