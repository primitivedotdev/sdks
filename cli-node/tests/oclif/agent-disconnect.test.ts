import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AgentDisconnectError,
  disconnectAgent,
} from "../../src/oclif/agent-disconnect.js";
import { installClaudeWakeHook } from "../../src/oclif/claude-wake-install.js";
import {
  agentProfileDirectory,
  loadConnectedAgentProfile,
  saveConnectedAgentProfile,
} from "../../src/oclif/connected-agent-profile.js";
import {
  readMailJson,
  writeMailJson,
} from "../../src/oclif/shared-mail-files.js";

const configDirs: string[] = [];
const session = "11111111-1111-4111-8111-111111111111";
const profile = {
  version: 1 as const,
  auth_method: "agent_connection" as const,
  api_key: ["pconn", "fixture", "local"].join("_"),
  api_base_url: "https://api.primitive-staging-1.com/v1",
  org_id: "22222222-2222-4222-8222-222222222222",
  agent_address: "agent@example.test",
  owner_address: "owner@example.test",
  invitation_hash: "a".repeat(64),
  created_at: "2026-01-01T00:00:00.000Z",
};

function configDir(): string {
  const directory = mkdtempSync(join(tmpdir(), "primitive-disconnect-test-"));
  configDirs.push(directory);
  return directory;
}

function saved(directory: string, name = "work", withSession = false): void {
  saveConnectedAgentProfile(directory, name, profile);
  if (withSession)
    writeMailJson(join(agentProfileDirectory(directory, name), "setup.json"), {
      session,
      invitationHash: profile.invitation_hash,
    });
}

function revoked(): { success: true; data: { connection: object } } {
  return {
    success: true,
    data: {
      connection: {
        address: profile.agent_address,
        owner_address: profile.owner_address,
        status: "revoked",
      },
    },
  };
}

function server(body: unknown = revoked(), status = 200) {
  const calls: Request[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    calls.push(new Request(input, init));
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
  return { fetch, calls };
}

const stopped = {
  phase: "stopped" as const,
  pid: null,
  detached: true,
  healthy: false,
  failureCode: null,
  reason: "stopped" as const,
  updatedAt: Date.now(),
};

afterEach(() => {
  for (const directory of configDirs.splice(0))
    rmSync(directory, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("connected agent self-disconnect", () => {
  it("removes only the disconnected Claude session's Stop hook", async () => {
    const directory = configDir();
    const claudeDir = join(directory, "claude");
    const bin = join(directory, "bin");
    mkdirSync(claudeDir);
    mkdirSync(bin);
    const cliPath = join(bin, "run.js");
    writeFileSync(cliPath, "");
    writeFileSync(join(bin, "claude-wake.mjs"), "");
    saved(directory, "work", true);
    const otherSession = "33333333-3333-4333-8333-333333333333";
    const env = { CLAUDE_CONFIG_DIR: claudeDir };
    expect(
      installClaudeWakeHook({
        cliPath,
        configDir: directory,
        profileName: "work",
        agentAddress: profile.agent_address,
        sessionId: session,
        env,
      }),
    ).toBe("installed_unverified");
    expect(
      installClaudeWakeHook({
        cliPath,
        configDir: directory,
        profileName: "other",
        agentAddress: "other@example.test",
        sessionId: otherSession,
        env,
      }),
    ).toBe("installed_unverified");
    const result = await disconnectAgent({
      configDir: directory,
      profileName: "work",
      fetch: server().fetch,
      stopReceiver: async () => stopped,
      env,
    });
    expect(result.externalHook).toBe("removed");
    const settings = JSON.parse(
      readFileSync(join(claudeDir, "settings.json"), "utf8"),
    );
    expect(settings.hooks.Stop).toHaveLength(1);
    expect(settings.hooks.Stop[0].hooks[0].args[5]).toBe(otherSession);
  });

  it("revokes only the selected profile at its pinned origin and preserves evidence", async () => {
    const directory = configDir();
    saved(directory, "work", true);
    saved(directory, "other");
    const api = server();
    const stopReceiver = vi.fn(async () => stopped);
    const result = await disconnectAgent({
      configDir: directory,
      profileName: "work",
      fetch: api.fetch,
      stopReceiver,
      now: () => new Date("2026-01-03T00:00:00.000Z"),
    });
    expect(result.status).toBe("disconnected");
    expect(result.revocation).toBe("confirmed");
    expect(result.identity.agentAddress).toBe(profile.agent_address);
    expect(stopReceiver).toHaveBeenCalledWith({
      configDir: directory,
      scope: expect.any(String),
      threadId: session,
    });
    expect(api.calls).toHaveLength(1);
    expect(api.calls[0]?.method).toBe("DELETE");
    expect(api.calls[0]?.url).toBe(
      "https://api.primitive-staging-1.com/v1/agent-connections/agent%40example.test",
    );
    expect(api.calls[0]?.headers.get("Authorization")).toBe(
      `Bearer ${profile.api_key}`,
    );
    expect(loadConnectedAgentProfile(directory, "work")).toBeNull();
    expect(loadConnectedAgentProfile(directory, "other")).toMatchObject(
      profile,
    );
    const evidence = agentProfileDirectory(directory, "work");
    expect(readMailJson(join(evidence, "setup.json"))).toMatchObject({
      session,
    });
    expect(
      readMailJson(
        join(evidence, `disconnected-${profile.invitation_hash}.json`),
      ),
    ).toMatchObject({
      address: profile.agent_address,
      revoked_at: "2026-01-03T00:00:00.000Z",
    });
  });

  it("does not revoke while the tracked receiver's stop is unconfirmed", async () => {
    const directory = configDir();
    saved(directory, "work", true);
    const api = server();
    await expect(
      disconnectAgent({
        configDir: directory,
        profileName: "work",
        fetch: api.fetch,
        stopReceiver: async () => ({
          ...stopped,
          phase: "receiving",
          reason: null,
          healthy: true,
        }),
      }),
    ).rejects.toThrow("not confirmed stopping");
    expect(api.calls).toHaveLength(0);
    expect(loadConnectedAgentProfile(directory, "work")).toMatchObject(profile);
  });

  it("preserves the credential after a network loss or 401", async () => {
    for (const failure of ["network", "unauthorized"] as const) {
      const directory = configDir();
      saved(directory);
      const fetch =
        failure === "network"
          ? vi.fn<typeof globalThis.fetch>(async () => {
              throw new Error("private transport detail");
            })
          : server(
              {
                success: false,
                error: { code: "unauthorized", message: "Private detail" },
              },
              401,
            ).fetch;
      await expect(
        disconnectAgent({ configDir: directory, profileName: "work", fetch }),
      ).rejects.toBeInstanceOf(AgentDisconnectError);
      expect(loadConnectedAgentProfile(directory, "work")).toMatchObject(
        profile,
      );
      expect(
        readMailJson(
          join(
            agentProfileDirectory(directory, "work"),
            `disconnected-${profile.invitation_hash}.json`,
          ),
        ),
      ).toBeNull();
    }
  });

  it("preserves the credential if a success response does not prove revocation", async () => {
    const directory = configDir();
    saved(directory);
    const api = server({
      success: true,
      data: {
        connection: { ...revoked().data.connection, status: "connected" },
      },
    });
    await expect(
      disconnectAgent({
        configDir: directory,
        profileName: "work",
        fetch: api.fetch,
      }),
    ).rejects.toThrow("response was incomplete");
    expect(loadConnectedAgentProfile(directory, "work")).toMatchObject(profile);
  });

  it("finishes local cleanup from saved confirmation without a second DELETE", async () => {
    const directory = configDir();
    saved(directory);
    const api = server();
    await disconnectAgent({
      configDir: directory,
      profileName: "work",
      fetch: api.fetch,
    });
    saveConnectedAgentProfile(directory, "work", profile);
    const another = server();
    const result = await disconnectAgent({
      configDir: directory,
      profileName: "work",
      fetch: another.fetch,
    });
    expect(result.revocation).toBe("previously_confirmed");
    expect(another.calls).toHaveLength(0);
    expect(loadConnectedAgentProfile(directory, "work")).toBeNull();
  });

  it("refuses a missing or mismatched profile without an API call", async () => {
    const directory = configDir();
    const api = server();
    await expect(
      disconnectAgent({
        configDir: directory,
        profileName: "absent",
        fetch: api.fetch,
      }),
    ).rejects.toThrow("not configured");
    saved(directory, "work", true);
    writeMailJson(
      join(agentProfileDirectory(directory, "work"), "setup.json"),
      {
        session,
        invitationHash: "b".repeat(64),
      },
    );
    await expect(
      disconnectAgent({
        configDir: directory,
        profileName: "work",
        fetch: api.fetch,
      }),
    ).rejects.toThrow("does not match");
    expect(api.calls).toHaveLength(0);
  });
});
