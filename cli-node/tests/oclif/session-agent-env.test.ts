import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  registerSession: vi.fn(),
  runDetached: vi.fn(),
  readClaudeHookInput: vi.fn(),
}));
vi.mock("../../src/oclif/machine-session.js", async (original) => ({
  ...(await original<typeof import("../../src/oclif/machine-session.js")>()),
  registerSession: mocks.registerSession,
  runDetached: mocks.runDetached,
  readClaudeHookInput: mocks.readClaudeHookInput,
  revokeStaleSessionAgents: vi.fn(async () => undefined),
}));

import { resolveCliAuth } from "../../src/oclif/auth.js";
import AgentSessionRegisterCommand from "../../src/oclif/commands/agent-session-register.js";
import {
  agentProfileDirectory,
  requireDefaultLoginProfile,
  saveConnectedAgentProfile,
} from "../../src/oclif/connected-agent-profile.js";
import { assertAgentFromAddress } from "../../src/oclif/outbound-defaults.js";
import {
  agentIdentitySource,
  exportSessionAgentEnv,
} from "../../src/oclif/session-agent-env.js";
import { writeMailJson } from "../../src/oclif/shared-mail-files.js";

const session = "11111111-1111-4111-8111-111111111111";
const profileName = `session-${session}`;
const address = "claude-app@example.test";
const apiBaseUrl = "https://api.primitive.dev/v1";
const lines = [
  `export PRIMITIVE_AGENT_PROFILE=${profileName}`,
  `export PRIMITIVE_AGENT_ADDRESS=${address}`,
];
const root = resolve(import.meta.dirname, "../..");

let configDir: string;
let envFile: string;

function saveProfile(name = profileName) {
  saveConnectedAgentProfile(configDir, name, {
    version: 1,
    auth_method: "agent_connection",
    api_key: ["pconn", "c".repeat(48)].join("_"),
    api_base_url: apiBaseUrl,
    org_id: "33333333-3333-4333-8333-333333333333",
    agent_address: address,
    owner_address: "owner@example.test",
    invitation_hash: "a".repeat(64),
    created_at: "2026-10-01T00:00:00.000Z",
  });
}

function envFileText(): string {
  return readFileSync(envFile, "utf8");
}

beforeEach(() => {
  configDir = mkdtempSync(join(tmpdir(), "primitive-session-env-"));
  envFile = join(configDir, "claude-env.sh");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  rmSync(configDir, { recursive: true, force: true });
});

describe("exportSessionAgentEnv", () => {
  const run = (env: Record<string, string | undefined>) =>
    exportSessionAgentEnv({ configDir, profileName, address, env });

  it("appends the profile and address exports for a saved profile", () => {
    saveProfile();
    expect(run({ CLAUDE_ENV_FILE: envFile })).toBe("written");
    expect(envFileText()).toBe(`${lines.join("\n")}\n`);
  });

  it("keeps lines other hooks wrote and never duplicates its own", () => {
    saveProfile();
    writeFileSync(envFile, "export OTHER=1");
    expect(run({ CLAUDE_ENV_FILE: envFile })).toBe("written");
    expect(run({ CLAUDE_ENV_FILE: envFile })).toBe("already_written");
    expect(envFileText()).toBe(`export OTHER=1\n${lines.join("\n")}\n`);
  });

  it("writes nothing without CLAUDE_ENV_FILE", () => {
    saveProfile();
    expect(run({})).toBe("no_env_file");
    expect(existsSync(envFile)).toBe(false);
  });

  it.each(["work", ""])(
    "respects a PRIMITIVE_AGENT_PROFILE the session already sets (%j)",
    (value) => {
      saveProfile();
      expect(
        run({ CLAUDE_ENV_FILE: envFile, PRIMITIVE_AGENT_PROFILE: value }),
      ).toBe("explicit_env");
      expect(existsSync(envFile)).toBe(false);
    },
  );

  it("leaves an existing assignment in the env file alone", () => {
    saveProfile();
    writeFileSync(envFile, "export PRIMITIVE_AGENT_PROFILE=work\n");
    expect(run({ CLAUDE_ENV_FILE: envFile })).toBe("env_file_conflict");
    expect(envFileText()).toBe("export PRIMITIVE_AGENT_PROFILE=work\n");
  });

  it("never names a profile that is not saved or holds another address", () => {
    expect(run({ CLAUDE_ENV_FILE: envFile })).toBe("no_profile");
    saveProfile();
    expect(
      exportSessionAgentEnv({
        configDir,
        profileName,
        address: "someone-else@example.test",
        env: { CLAUDE_ENV_FILE: envFile },
      }),
    ).toBe("no_profile");
    expect(existsSync(envFile)).toBe(false);
  });
});

describe("agent session-register env export", () => {
  const registered = {
    status: "registered",
    runtime: "claude",
    session,
    profile: profileName,
    address,
    receiving: "external_hook",
    detail: "Connected.",
  };

  it("asks the background registration to export only for a Claude hook with CLAUDE_ENV_FILE", async () => {
    mocks.readClaudeHookInput.mockResolvedValue({
      sessionId: session,
      cwd: null,
      reason: null,
    });
    mocks.runDetached.mockResolvedValue("finished");
    vi.stubEnv("CLAUDE_CODE_ENTRYPOINT", "cli");
    vi.stubEnv("CLAUDE_ENV_FILE", envFile);
    await AgentSessionRegisterCommand.run(
      ["--runtime", "claude", "--hook"],
      root,
    );
    expect(mocks.runDetached.mock.calls[0][0].args).toContain("--export-env");

    vi.stubEnv("CLAUDE_ENV_FILE", "");
    await AgentSessionRegisterCommand.run(
      ["--runtime", "claude", "--hook"],
      root,
    );
    expect(mocks.runDetached.mock.calls[1][0].args).not.toContain(
      "--export-env",
    );
  });

  it("exports the registered profile once registration has saved it", async () => {
    saveProfile();
    vi.stubEnv("PRIMITIVE_CONFIG_DIR", configDir);
    vi.stubEnv("CLAUDE_ENV_FILE", envFile);
    mocks.registerSession.mockResolvedValue(registered);
    await AgentSessionRegisterCommand.run(
      ["--runtime", "claude", "--session", session, "--quiet", "--export-env"],
      root,
    );
    expect(envFileText()).toBe(`${lines.join("\n")}\n`);
  });

  it.each(["pending", "not_logged_in", "revoked"])(
    "exports nothing for a %s registration",
    async (status) => {
      saveProfile();
      vi.stubEnv("PRIMITIVE_CONFIG_DIR", configDir);
      vi.stubEnv("CLAUDE_ENV_FILE", envFile);
      mocks.registerSession.mockResolvedValue({ ...registered, status });
      await AgentSessionRegisterCommand.run(
        [
          "--runtime",
          "claude",
          "--session",
          session,
          "--quiet",
          "--export-env",
        ],
        root,
      );
      expect(existsSync(envFile)).toBe(false);
    },
  );

  it("exports nothing while another connected profile holds the session", async () => {
    saveProfile();
    vi.stubEnv("PRIMITIVE_CONFIG_DIR", configDir);
    vi.stubEnv("CLAUDE_ENV_FILE", envFile);
    const args = [
      "--runtime",
      "claude",
      "--session",
      session,
      "--quiet",
      "--export-env",
    ];
    mocks.registerSession.mockResolvedValue({
      ...registered,
      status: "already_registered",
      receiverHeld: true,
    });
    await AgentSessionRegisterCommand.run(args, root);
    expect(existsSync(envFile)).toBe(false);

    saveProfile("work");
    writeMailJson(
      join(agentProfileDirectory(configDir, "work"), "setup.json"),
      {
        session,
      },
    );
    mocks.registerSession.mockResolvedValue(registered);
    await AgentSessionRegisterCommand.run(args, root);
    expect(existsSync(envFile)).toBe(false);
  });

  it("does not export from a manual run without --export-env", async () => {
    saveProfile();
    vi.stubEnv("PRIMITIVE_CONFIG_DIR", configDir);
    vi.stubEnv("CLAUDE_ENV_FILE", envFile);
    mocks.registerSession.mockResolvedValue(registered);
    await AgentSessionRegisterCommand.run(
      ["--runtime", "claude", "--session", session, "--quiet"],
      root,
    );
    expect(existsSync(envFile)).toBe(false);
  });
});

describe("member login opt-out", () => {
  it("an empty PRIMITIVE_AGENT_PROFILE resolves to the member login", () => {
    writeFileSync(
      join(configDir, "credentials.json"),
      JSON.stringify({
        auth_method: "oauth",
        access_token: "prim_oat_test",
        refresh_token: "prim_ort_test",
        token_type: "Bearer",
        expires_at: "2099-05-05T00:00:00.000Z",
        oauth_grant_id: "11111111-1111-4111-8111-111111111111",
        oauth_client_id: "primitive-cli",
        org_id: "22222222-2222-4222-8222-222222222222",
        org_name: "Acme",
        api_base_url: apiBaseUrl,
        created_at: "2026-05-05T00:00:00.000Z",
      }),
    );
    const auth = resolveCliAuth({
      configDir,
      env: { PRIMITIVE_AGENT_PROFILE: "" },
    });
    expect(auth.source).toBe("stored");
    expect(auth.connectedAgent).toBeUndefined();
    vi.stubEnv("PRIMITIVE_AGENT_PROFILE", "");
    expect(() => requireDefaultLoginProfile()).not.toThrow();
  });

  it("member-only commands name the opt-out in one sentence", () => {
    vi.stubEnv("PRIMITIVE_AGENT_PROFILE", profileName);
    expect(() => requireDefaultLoginProfile()).toThrow(
      "rerun the same command with `PRIMITIVE_AGENT_PROFILE=` in front of it",
    );
  });

  it("a selected profile that is missing says what to run next", () => {
    expect(() =>
      resolveCliAuth({
        configDir,
        env: { PRIMITIVE_AGENT_PROFILE: profileName },
      }),
    ).toThrow(`primitive agent status --profile ${profileName}`);
  });

  it("an explicit profile wins over the session's exported one", () => {
    saveProfile("work");
    const auth = resolveCliAuth({
      configDir,
      env: { PRIMITIVE_AGENT_PROFILE: "work" },
    });
    expect(auth.connectedAgent?.profileName).toBe("work");
  });
});

describe("agent identity", () => {
  const identity = { profileName, agentAddress: address };

  it("reports the session hook as the source of the session's own agent", () => {
    expect(
      agentIdentitySource(identity, {
        CLAUDE_CODE_SESSION_ID: session,
        PRIMITIVE_AGENT_ADDRESS: address,
      }),
    ).toBe("session_hook");
    expect(
      agentIdentitySource(identity, { PRIMITIVE_AGENT_ADDRESS: address }),
    ).toBe("env");
    expect(
      agentIdentitySource(
        { profileName: "work", agentAddress: address },
        { CLAUDE_CODE_SESSION_ID: session, PRIMITIVE_AGENT_ADDRESS: address },
      ),
    ).toBe("env");
  });

  it("refuses an explicit --from that is not the agent's address", () => {
    const agent = {
      profileName,
      orgId: "org",
      agentAddress: address,
      ownerAddress: "owner@example.test",
      apiBaseUrl,
    };
    expect(() => assertAgentFromAddress(undefined, agent)).not.toThrow();
    expect(() =>
      assertAgentFromAddress(`Claude <${address.toUpperCase()}>`, agent),
    ).not.toThrow();
    expect(() => assertAgentFromAddress("other@example.test", agent)).toThrow(
      `--from other@example.test is not this agent's address; omit --from to send as ${address}.`,
    );
    expect(() =>
      assertAgentFromAddress("other@example.test", undefined),
    ).not.toThrow();
  });
});

describe("explicit API key with a selected agent", () => {
  it("refuses the conflict and says how to use the key instead", () => {
    saveProfile();
    expect(() =>
      resolveCliAuth({
        configDir,
        apiKey: "prim_explicit",
        env: { PRIMITIVE_AGENT_PROFILE: profileName },
      }),
    ).toThrow("`PRIMITIVE_AGENT_PROFILE=` in front of it to use the override");
    expect(
      resolveCliAuth({
        configDir,
        apiKey: "prim_explicit",
        env: { PRIMITIVE_AGENT_PROFILE: "" },
      }).source,
    ).toBe("flag-or-env");
  });
});
