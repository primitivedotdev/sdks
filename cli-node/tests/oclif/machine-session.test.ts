import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import type { disconnectAgent } from "../../src/oclif/agent-disconnect.js";
import type { enrollAgent } from "../../src/oclif/agent-enroll.js";
import { saveCliCredentials } from "../../src/oclif/auth.js";
import {
  AgentConnectionSetupError,
  agentProfileDirectory,
  type ConnectedAgentProfile,
  saveConnectedAgentProfile,
} from "../../src/oclif/connected-agent-profile.js";
import {
  defaultSessionName,
  endSession,
  ompProcessSession,
  pendingSessionDisconnects,
  readClaudeHookInput,
  registerSession,
  retryPendingDisconnects,
  type SessionRegisterDependencies,
} from "../../src/oclif/machine-session.js";
import {
  removeMailFile,
  writeMailJson,
} from "../../src/oclif/shared-mail-files.js";

const session = "11111111-1111-4111-8111-111111111111";
const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function setup(options: { loggedIn?: boolean } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "machine-session-")));
  directories.push(root);
  const configDir = join(root, "primitive");
  const repo = join(root, "work", "my-repo");
  mkdirSync(join(repo, ".git"), { recursive: true });
  mkdirSync(join(repo, "src"), { recursive: true });
  mkdirSync(configDir, { recursive: true, mode: 0o700 });
  if (options.loggedIn !== false)
    saveCliCredentials(configDir, {
      auth_method: "oauth",
      access_token: ["prim", "oat", "test"].join("_"),
      refresh_token: ["prim", "ort", "test"].join("_"),
      token_type: "Bearer",
      expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
      oauth_grant_id: "grant-test",
      oauth_client_id: "client-test",
      org_id: "22222222-2222-4222-8222-222222222222",
      org_name: "Test",
      api_base_url: "https://api.primitive.dev/v1",
      created_at: new Date().toISOString(),
    });
  return { root, configDir, repo };
}

function profile(address: string): ConnectedAgentProfile {
  return {
    version: 1,
    auth_method: "agent_connection",
    api_key: ["pconn", "fixture", "x"].join("_"),
    api_base_url: "https://api.primitive.dev/v1",
    org_id: "22222222-2222-4222-8222-222222222222",
    agent_address: address,
    owner_address: "owner@example.test",
    invitation_hash: "a".repeat(64),
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

/** Fake enrollment that claims a profile the way the real flow does. */
function fakeDependencies(configDir: string) {
  const calls = {
    enroll: [] as Array<Parameters<typeof enrollAgent>[0]>,
    hooks: [] as string[],
    seeds: [] as string[],
  };
  const dependencies: Partial<SessionRegisterDependencies> = {
    enroll: (async (params: Parameters<typeof enrollAgent>[0]) => {
      calls.enroll.push(params);
      const name = `session-${params.session}`;
      saveConnectedAgentProfile(configDir, name, profile("agent@example.test"));
      writeMailJson(
        join(agentProfileDirectory(configDir, name), "setup.json"),
        {
          receiverMode: params.receiverMode,
        },
      );
      return {
        identity: { agentAddress: "agent@example.test", profileName: name },
        verification: { state: "verified" },
        connection: { status: "connected" },
      };
    }) as unknown as typeof enrollAgent,
    installClaudeHook: (options) => {
      calls.hooks.push(options.sessionId);
      return "installed_unverified";
    },
    seedAgentInfo: async (_configDir, _profile, value) => {
      calls.seeds.push(value);
      return "created";
    },
    connectionState: async () => "connected",
    now: () => new Date("2026-10-02T12:00:00.000Z"),
  };
  return { calls, dependencies };
}

describe("agent session-register", () => {
  it("registers once and a resume only re-verifies", async () => {
    const { configDir, repo } = setup();
    const { calls, dependencies } = fakeDependencies(configDir);
    const options = {
      configDir,
      runtime: "claude" as const,
      cwd: join(repo, "src"),
      env: {
        CLAUDE_CODE_SESSION_ID: session,
        PRIMITIVE_API_KEY: "should-not-reach-enroll",
      },
      cliPath: "/cli/bin/run.js",
      dependencies,
    };
    const first = await registerSession(options);
    expect(first).toMatchObject({
      status: "registered",
      runtime: "claude",
      session,
      profile: `session-${session}`,
      address: "agent@example.test",
      receiving: "external_hook",
    });
    expect(calls.enroll).toHaveLength(1);
    expect(calls.enroll[0]?.name).toBe("claude-my-repo");
    expect(calls.enroll[0]?.receiverMode).toBe("external");
    expect(calls.enroll[0]?.env?.PRIMITIVE_API_KEY).toBeUndefined();
    expect(calls.hooks).toEqual([session]);
    expect(calls.seeds).toEqual([
      "Claude Code coding session. Repository: my-repo. Directory: src.",
    ]);

    const resumed = await registerSession(options);
    expect(resumed.status).toBe("already_registered");
    expect(calls.enroll).toHaveLength(1);
    expect(calls.seeds).toHaveLength(1);
    // The resume reinstalls the same exact-session hook (idempotent).
    expect(calls.hooks).toEqual([session, session]);
  });

  it("reuses a connected profile already bound to the session instead of enrolling a second one", async () => {
    const { configDir, repo } = setup();
    const { calls, dependencies } = fakeDependencies(configDir);
    saveConnectedAgentProfile(
      configDir,
      "my-agent",
      profile("mine@example.test"),
    );
    writeMailJson(
      join(agentProfileDirectory(configDir, "my-agent"), "setup.json"),
      { session, receiverMode: "external" },
    );
    const installed: string[] = [];
    const options = {
      configDir,
      runtime: "claude" as const,
      cwd: repo,
      env: { CLAUDE_CODE_SESSION_ID: session },
      cliPath: "/cli/bin/run.js",
      dependencies: {
        ...dependencies,
        installClaudeHook: ((hook) => {
          installed.push(`${hook.profileName}:${hook.agentAddress}`);
          return "installed_unverified";
        }) as SessionRegisterDependencies["installClaudeHook"],
      },
    };
    for (let run = 0; run < 3; run++) {
      const result = await registerSession(options);
      expect(result).toMatchObject({
        status: "already_registered",
        profile: "my-agent",
        address: "mine@example.test",
        receiving: "external_hook",
      });
    }
    expect(calls.enroll).toHaveLength(0);
    expect(calls.seeds).toHaveLength(0);
    expect(installed).toEqual(Array(3).fill("my-agent:mine@example.test"));
    // Ending the session leaves a profile it did not create connected.
    const ended = await endSession({
      configDir,
      runtime: "claude",
      session,
      dependencies: {
        disconnect: (async () => {
          throw new Error("must not disconnect");
        }) as unknown as typeof disconnectAgent,
      },
    });
    expect(ended.status).toBe("not_managed");
  });

  it("enrolls as before when the bound profile is not connected, and stops when it cannot be checked", async () => {
    const revoked = setup();
    const a = fakeDependencies(revoked.configDir);
    saveConnectedAgentProfile(
      revoked.configDir,
      "old-agent",
      profile("old@example.test"),
    );
    writeMailJson(
      join(agentProfileDirectory(revoked.configDir, "old-agent"), "setup.json"),
      { session, receiverMode: "external" },
    );
    const registered = await registerSession({
      configDir: revoked.configDir,
      runtime: "claude",
      env: { CLAUDE_CODE_SESSION_ID: session },
      cliPath: "/cli/bin/run.js",
      dependencies: {
        ...a.dependencies,
        connectionState: async (candidate) =>
          candidate.agent_address === "old@example.test"
            ? "revoked"
            : "connected",
      },
    });
    expect(registered).toMatchObject({
      status: "registered",
      profile: `session-${session}`,
    });
    expect(a.calls.enroll).toHaveLength(1);

    const offline = setup();
    const b = fakeDependencies(offline.configDir);
    saveConnectedAgentProfile(
      offline.configDir,
      "my-agent",
      profile("mine@example.test"),
    );
    writeMailJson(
      join(agentProfileDirectory(offline.configDir, "my-agent"), "setup.json"),
      { session, receiverMode: "external" },
    );
    const unchecked = await registerSession({
      configDir: offline.configDir,
      runtime: "claude",
      env: { CLAUDE_CODE_SESSION_ID: session },
      cliPath: "/cli/bin/run.js",
      dependencies: {
        ...b.dependencies,
        connectionState: async () => "unavailable",
      },
    });
    expect(unchecked.status).toBe("offline");
    expect(b.calls.enroll).toHaveLength(0);
  });

  it("never creates a second address once the profile is gone or revoked", async () => {
    const { configDir, repo } = setup();
    const { calls, dependencies } = fakeDependencies(configDir);
    const options = {
      configDir,
      runtime: "codex" as const,
      cwd: repo,
      env: { CODEX_THREAD_ID: session },
      cliPath: "/cli/bin/run.js",
      dependencies,
    };
    expect((await registerSession(options)).status).toBe("registered");
    expect(calls.enroll[0]?.receiverMode).toBe("native");
    const revoked = await registerSession({
      ...options,
      dependencies: { ...dependencies, connectionState: async () => "revoked" },
    });
    expect(revoked.status).toBe("revoked");
    // The profile disappears (for example moved aside by the doctor).
    rmSync(agentProfileDirectory(configDir, `session-${session}`), {
      recursive: true,
    });
    const removed = await registerSession(options);
    expect(removed.status).toBe("removed");
    expect(calls.enroll).toHaveLength(1);
  });

  it("fails open: no login, no network, enrollment errors", async () => {
    const notLoggedIn = setup({ loggedIn: false });
    const a = fakeDependencies(notLoggedIn.configDir);
    const result = await registerSession({
      configDir: notLoggedIn.configDir,
      runtime: "claude",
      env: { CLAUDE_CODE_SESSION_ID: session },
      cliPath: "/cli/bin/run.js",
      dependencies: a.dependencies,
    });
    expect(result.status).toBe("not_logged_in");
    expect(a.calls.enroll).toHaveLength(0);

    const offline = setup();
    const b = fakeDependencies(offline.configDir);
    const failed = await registerSession({
      configDir: offline.configDir,
      runtime: "codex",
      session,
      cliPath: "/cli/bin/run.js",
      dependencies: {
        ...b.dependencies,
        enroll: (async () => {
          throw new TypeError("fetch failed");
        }) as unknown as typeof enrollAgent,
      },
    });
    expect(failed.status).toBe("failed");
    expect(failed.detail).not.toContain("fetch failed");
    const refused = await registerSession({
      configDir: offline.configDir,
      runtime: "codex",
      session,
      cliPath: "/cli/bin/run.js",
      dependencies: {
        ...b.dependencies,
        enroll: (async () => {
          throw new AgentConnectionSetupError("Organization has no domain.");
        }) as unknown as typeof enrollAgent,
      },
    });
    expect(refused).toMatchObject({
      status: "failed",
      detail: "Organization has no domain.",
    });

    saveConnectedAgentProfile(
      offline.configDir,
      `session-${session}`,
      profile("agent@example.test"),
    );
    const unreachable = await registerSession({
      configDir: offline.configDir,
      runtime: "codex",
      session,
      cliPath: "/cli/bin/run.js",
      dependencies: {
        ...b.dependencies,
        connectionState: async () => "unavailable",
      },
    });
    expect(unreachable.status).toBe("offline");
  });

  it("skips non-interactive Claude runs and treats unknown entrypoints as interactive", async () => {
    const { configDir } = setup();
    const { calls, dependencies } = fakeDependencies(configDir);
    for (const entrypoint of ["sdk-cli", "sdk-ts", "sdk-py"]) {
      const result = await registerSession({
        configDir,
        runtime: "claude",
        env: {
          CLAUDE_CODE_SESSION_ID: session,
          CLAUDE_CODE_ENTRYPOINT: entrypoint,
        },
        cliPath: "/cli/bin/run.js",
        dependencies,
      });
      expect(result.status).toBe("skipped_headless");
    }
    expect(calls.enroll).toHaveLength(0);
    const ended = await endSession({
      configDir,
      runtime: "claude",
      env: {
        CLAUDE_CODE_SESSION_ID: session,
        CLAUDE_CODE_ENTRYPOINT: "sdk-cli",
      },
    });
    expect(ended.status).toBe("skipped_headless");
    const unknown = await registerSession({
      configDir,
      runtime: "claude",
      env: {
        CLAUDE_CODE_SESSION_ID: session,
        CLAUDE_CODE_ENTRYPOINT: "something-new",
      },
      cliPath: "/cli/bin/run.js",
      dependencies,
    });
    expect(unknown.status).toBe("registered");
    // Codex is never filtered by the Claude entrypoint.
    const codex = await registerSession({
      configDir,
      runtime: "codex",
      session: "44444444-4444-4444-8444-444444444444",
      env: { CLAUDE_CODE_ENTRYPOINT: "sdk-cli" },
      cliPath: "/cli/bin/run.js",
      dependencies,
    });
    expect(codex.status).toBe("registered");
  });

  it("reports no session instead of guessing one", async () => {
    const { configDir } = setup();
    const { calls, dependencies } = fakeDependencies(configDir);
    const result = await registerSession({
      configDir,
      runtime: "claude",
      env: {},
      cliPath: "/cli/bin/run.js",
      dependencies,
    });
    expect(result.status).toBe("no_session");
    const invalid = await registerSession({
      configDir,
      runtime: "claude",
      session: "not-a-uuid",
      env: {},
      cliPath: "/cli/bin/run.js",
      dependencies,
    });
    expect(invalid.status).toBe("failed");
    expect(calls.enroll).toHaveLength(0);
  });

  it("trusts the session from Claude hook input for enrollment", async () => {
    const { configDir } = setup();
    const { calls, dependencies } = fakeDependencies(configDir);
    await registerSession({
      configDir,
      runtime: "claude",
      session,
      env: {},
      trustedSession: true,
      cliPath: "/cli/bin/run.js",
      dependencies,
    });
    expect(calls.enroll[0]?.env?.CLAUDE_CODE_SESSION_ID).toBe(session);
  });

  it("registers omp without a receiver and without probing one", async () => {
    const { configDir, repo } = setup();
    const { calls, dependencies } = fakeDependencies(configDir);
    const result = await registerSession({
      configDir,
      runtime: "omp",
      cwd: repo,
      env: {},
      cliPath: "/cli/bin/run.js",
      dependencies: { ...dependencies, ompSession: () => session },
    });
    expect(result).toMatchObject({
      status: "registered",
      receiving: "unsupported",
      session,
    });
    expect(calls.enroll[0]?.preflight).toBeTypeOf("function");
    expect(calls.hooks).toHaveLength(0);
  });
});

describe("agent session-end", () => {
  it("disconnects only agents session-register created, once", async () => {
    const { configDir } = setup();
    const { dependencies } = fakeDependencies(configDir);
    const disconnected: string[] = [];
    const disconnect = (async (params: { profileName: string }) => {
      disconnected.push(params.profileName);
      removeMailFile(
        join(
          agentProfileDirectory(configDir, params.profileName),
          "connection.json",
        ),
      );
      return {};
    }) as unknown as typeof disconnectAgent;
    await registerSession({
      configDir,
      runtime: "claude",
      env: { CLAUDE_CODE_SESSION_ID: session },
      cliPath: "/cli/bin/run.js",
      dependencies,
    });
    const ended = await endSession({
      configDir,
      runtime: "claude",
      env: { CLAUDE_CODE_SESSION_ID: session },
      dependencies: { disconnect },
    });
    expect(ended.status).toBe("disconnected");
    expect(disconnected).toEqual([`session-${session}`]);
    const again = await endSession({
      configDir,
      runtime: "claude",
      session,
      dependencies: { disconnect },
    });
    expect(again.status).toBe("already_ended");
    const resumed = await registerSession({
      configDir,
      runtime: "claude",
      env: { CLAUDE_CODE_SESSION_ID: session },
      cliPath: "/cli/bin/run.js",
      dependencies,
    });
    expect(resumed.status).toBe("ended");
  });

  it("disconnects an agent whose session ended while it was still enrolling", async () => {
    const { configDir } = setup();
    const { calls, dependencies } = fakeDependencies(configDir);
    const disconnected: string[] = [];
    const disconnect = (async (params: { profileName: string }) => {
      disconnected.push(params.profileName);
      removeMailFile(
        join(
          agentProfileDirectory(configDir, params.profileName),
          "connection.json",
        ),
      );
      return {};
    }) as unknown as typeof disconnectAgent;
    const realEnroll = dependencies.enroll as typeof enrollAgent;
    const ending: Array<Promise<unknown>> = [];
    const result = await registerSession({
      configDir,
      runtime: "claude",
      env: { CLAUDE_CODE_SESSION_ID: session },
      cliPath: "/cli/bin/run.js",
      dependencies: {
        ...dependencies,
        disconnect,
        enroll: (async (params: Parameters<typeof enrollAgent>[0]) => {
          // SessionEnd arrives before the profile exists.
          const end = await endSession({
            configDir,
            runtime: "claude",
            session,
            dependencies: { disconnect, revokeByAddress: async () => false },
          });
          ending.push(Promise.resolve(end));
          return realEnroll(params);
        }) as unknown as typeof enrollAgent,
      },
    });
    expect(result.status).toBe("ended");
    expect(disconnected).toEqual([`session-${session}`]);
    expect(calls.enroll).toHaveLength(1);
    expect(calls.hooks).toHaveLength(0);
    const again = await registerSession({
      configDir,
      runtime: "claude",
      env: { CLAUDE_CODE_SESSION_ID: session },
      cliPath: "/cli/bin/run.js",
      dependencies: { ...dependencies, disconnect },
    });
    expect(again.status).toBe("ended");
    expect(calls.enroll).toHaveLength(1);
    expect(disconnected).toHaveLength(1);
  });

  it("disconnects by address when the local profile is gone, and retries until confirmed", async () => {
    const { configDir } = setup();
    const { dependencies } = fakeDependencies(configDir);
    await registerSession({
      configDir,
      runtime: "claude",
      env: { CLAUDE_CODE_SESSION_ID: session },
      cliPath: "/cli/bin/run.js",
      dependencies,
    });
    removeMailFile(
      join(
        agentProfileDirectory(configDir, `session-${session}`),
        "connection.json",
      ),
    );
    const revoked: string[] = [];
    const pending = await endSession({
      configDir,
      runtime: "claude",
      session,
      dependencies: { revokeByAddress: async () => false },
    });
    expect(pending.status).toBe("disconnect_pending");
    expect(
      pendingSessionDisconnects(configDir).map((row) => row.session),
    ).toEqual([session]);
    // A later registration attempt never clears the end, and retries.
    const resumed = await registerSession({
      configDir,
      runtime: "claude",
      session,
      env: {},
      cliPath: "/cli/bin/run.js",
      dependencies: { ...dependencies, revokeByAddress: async () => false },
    });
    expect(resumed.status).toBe("ended");
    expect(
      await retryPendingDisconnects(configDir, {
        dependencies: {
          revokeByAddress: async (_configDir, address) => {
            revoked.push(address);
            return true;
          },
        },
      }),
    ).toBe(1);
    expect(revoked).toEqual(["agent@example.test"]);
    expect(pendingSessionDisconnects(configDir)).toEqual([]);
  });

  it("disconnects whatever an enrollment left behind when the session ended first", async () => {
    const cases = [
      {
        name: "setup failed after the claim",
        leave: (configDir: string) =>
          saveConnectedAgentProfile(
            configDir,
            `session-${session}`,
            profile("claimed@example.test"),
          ),
        expectDisconnect: [`session-${session}`],
        expectRevoke: [] as string[],
      },
      {
        name: "owner confirmation failed before the claim",
        leave: (configDir: string) =>
          writeMailJson(
            join(
              agentProfileDirectory(configDir, `session-${session}`),
              "enrollment",
              "state.json",
            ),
            { address: "created@example.test" },
          ),
        expectDisconnect: [] as string[],
        expectRevoke: ["created@example.test"],
      },
      {
        name: "nothing was created",
        leave: () => undefined,
        expectDisconnect: [] as string[],
        expectRevoke: [] as string[],
      },
    ];
    for (const item of cases) {
      const { configDir } = setup();
      const { dependencies } = fakeDependencies(configDir);
      const disconnected: string[] = [];
      const revoked: string[] = [];
      const disconnect = (async (params: { profileName: string }) => {
        disconnected.push(params.profileName);
        removeMailFile(
          join(
            agentProfileDirectory(configDir, params.profileName),
            "connection.json",
          ),
        );
        return {};
      }) as unknown as typeof disconnectAgent;
      const revokeByAddress = async (_dir: string, address: string) => {
        revoked.push(address);
        return true;
      };
      let endStatus = "";
      const result = await registerSession({
        configDir,
        runtime: "claude",
        env: { CLAUDE_CODE_SESSION_ID: session },
        cliPath: "/cli/bin/run.js",
        dependencies: {
          ...dependencies,
          // A fresh registration: its enrollment may still be starting.
          now: () => new Date(),
          disconnect,
          revokeByAddress,
          enroll: (async () => {
            // SessionEnd arrives before enrollment has saved any state.
            endStatus = (
              await endSession({
                configDir,
                runtime: "claude",
                session,
                dependencies: { disconnect, revokeByAddress },
              })
            ).status;
            item.leave(configDir);
            throw new AgentConnectionSetupError("setup failed");
          }) as unknown as typeof enrollAgent,
        },
      });
      expect(endStatus, item.name).toBe("disconnect_pending");
      expect(result.status, item.name).toBe("ended");
      expect(disconnected, item.name).toEqual(item.expectDisconnect);
      expect(revoked, item.name).toEqual(item.expectRevoke);
      expect(pendingSessionDisconnects(configDir), item.name).toEqual([]);
    }
  });

  it("keeps a confirmed disconnect when a slower attempt reports pending", async () => {
    const { configDir } = setup();
    const { dependencies } = fakeDependencies(configDir);
    await registerSession({
      configDir,
      runtime: "claude",
      env: { CLAUDE_CODE_SESSION_ID: session },
      cliPath: "/cli/bin/run.js",
      dependencies,
    });
    removeMailFile(
      join(
        agentProfileDirectory(configDir, `session-${session}`),
        "connection.json",
      ),
    );
    await endSession({
      configDir,
      runtime: "claude",
      session,
      dependencies: { revokeByAddress: async () => false },
    });
    const slow = retryPendingDisconnects(configDir, {
      dependencies: {
        revokeByAddress: async () => {
          await new Promise((done) => setTimeout(done, 100));
          return false;
        },
      },
    });
    const fast = retryPendingDisconnects(configDir, {
      dependencies: { revokeByAddress: async () => true },
    });
    expect(await fast).toBe(1);
    await slow;
    expect(pendingSessionDisconnects(configDir)).toEqual([]);
    const again = await endSession({ configDir, runtime: "claude", session });
    expect(again.status).toBe("already_ended");
  });

  it("leaves agents connected some other way alone", async () => {
    const { configDir } = setup();
    saveConnectedAgentProfile(
      configDir,
      `session-${session}`,
      profile("manual@example.test"),
    );
    let called = false;
    const result = await endSession({
      configDir,
      runtime: "claude",
      session,
      dependencies: {
        disconnect: (async () => {
          called = true;
          return {};
        }) as unknown as typeof disconnectAgent,
      },
    });
    expect(result.status).toBe("not_managed");
    expect(called).toBe(false);
  });

  it("reports a failed disconnect without throwing", async () => {
    const { configDir } = setup();
    const { dependencies } = fakeDependencies(configDir);
    await registerSession({
      configDir,
      runtime: "claude",
      env: { CLAUDE_CODE_SESSION_ID: session },
      cliPath: "/cli/bin/run.js",
      dependencies,
    });
    const result = await endSession({
      configDir,
      runtime: "claude",
      session,
      dependencies: {
        disconnect: (async () => {
          throw new TypeError("network");
        }) as unknown as typeof disconnectAgent,
        revokeByAddress: async () => false,
      },
    });
    expect(result.status).toBe("disconnect_pending");
  });
});

describe("session identity helpers", () => {
  it("gives one stable ID per running omp process", () => {
    const { configDir } = setup();
    const table: Record<
      number,
      { ppid: number; started: string; command: string }
    > = {
      300: {
        ppid: 200,
        started: "Tue Sep 29 19:41:31 2026",
        command: "node run.js",
      },
      200: {
        ppid: 100,
        started: "Tue Sep 29 19:41:30 2026",
        command: "/bin/zsh -c primitive",
      },
      100: {
        ppid: 1,
        started: "Tue Sep 29 19:00:00 2026",
        command: "bun /Users/me/.bun/bin/omp",
      },
    };
    const processInfo = (pid: number) => table[pid] ?? null;
    const first = ompProcessSession(configDir, {
      startPid: 300,
      processInfo,
      platform: "darwin",
    });
    const second = ompProcessSession(configDir, {
      startPid: 200,
      processInfo,
      platform: "darwin",
    });
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(second).toBe(first);
    const restarted = ompProcessSession(configDir, {
      startPid: 300,
      processInfo: (pid) =>
        pid === 100
          ? {
              ...table[100],
              ppid: 1,
              command: table[100]?.command ?? "",
              started: "Wed Sep 30 08:00:00 2026",
            }
          : (table[pid] ?? null),
      platform: "darwin",
    });
    expect(restarted).not.toBe(first);
    const viaWorker = ompProcessSession(configDir, {
      startPid: 300,
      processInfo: (pid) =>
        pid === 200
          ? {
              ppid: 100,
              started: "x",
              command: "bun cli.js __omp_worker_daemon_broker",
            }
          : (table[pid] ?? null),
      platform: "darwin",
    });
    expect(viaWorker).toBeNull();
    expect(
      ompProcessSession(configDir, { startPid: 300, processInfo: () => null }),
    ).toBeNull();
  });

  it("names a session after its repository", () => {
    const { repo } = setup();
    expect(defaultSessionName("codex", join(repo, "src"))).toBe(
      "codex-my-repo",
    );
  });

  it("reads only a valid session from Claude hook input", async () => {
    const valid = await readClaudeHookInput(
      Readable.from([
        JSON.stringify({
          session_id: session.toUpperCase(),
          cwd: "/work",
          hook_event_name: "SessionStart",
          source: "resume",
        }),
      ]),
    );
    expect(valid).toEqual({ sessionId: session, cwd: "/work" });
    expect(await readClaudeHookInput(Readable.from(["not json"]))).toBeNull();
    expect(
      await readClaudeHookInput(
        Readable.from([JSON.stringify({ session_id: "x" })]),
      ),
    ).toBeNull();
  });
});
