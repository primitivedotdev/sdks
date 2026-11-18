import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profileName: "work" as string | undefined,
  requests: [] as {
    method: string;
    path: string;
    url: string;
    authorization: string | null;
  }[],
  // Default: a server that predates thread mutes.
  respond: (_method: string, path: string): Response =>
    Response.json(
      {
        success: false,
        error: {
          code: "not_found",
          message: `${_method} ${path} is not served yet.`,
        },
      },
      { status: 404 },
    ),
}));
vi.mock("../../src/oclif/api-client.js", async () => {
  const { PrimitiveApiClient } = await import("@primitivedotdev/api-core");
  return {
    createAuthenticatedCliApiClient: async (params: {
      apiKey?: string;
      apiBaseUrl?: string;
    }) => ({
      apiClient: new PrimitiveApiClient({
        apiKey: params.apiKey ?? "fixture",
        apiBaseUrl: params.apiBaseUrl ?? "https://api.example.test/v1",
        fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
          const request = new Request(input, init);
          const path = new URL(request.url).pathname;
          mocks.requests.push({
            method: request.method,
            path,
            url: request.url,
            authorization: request.headers.get("authorization"),
          });
          return mocks.respond(request.method, path);
        },
      }),
      auth: {},
      baseUrlOverridden: false,
    }),
  };
});
vi.mock("../../src/oclif/auth.js", async (original) => ({
  ...(await original<typeof import("../../src/oclif/auth.js")>()),
  resolveCliAuth: () => ({
    connectedAgent: mocks.profileName
      ? { profileName: mocks.profileName, agentAddress: "agent@example.com" }
      : undefined,
  }),
}));

import {
  ThreadsMuteCommand,
  ThreadsMutedCommand,
  ThreadsUnmuteCommand,
} from "../../src/oclif/commands/threads-mute.js";
import {
  isThreadMuted,
  muteThread,
  readThreadMutes,
  ThreadMuteStateError,
  unmuteThread,
} from "../../src/oclif/thread-mutes.js";

const root = resolve(import.meta.dirname, "../..");
const thread = "44444444-4444-4444-8444-444444444444";
const otherThread = "55555555-5555-4555-8555-555555555555";
const claude = "claude:11111111-1111-4111-8111-111111111111";
const codex = "codex:22222222-2222-4222-8222-222222222222";
let configDir: string;

beforeEach(() => {
  configDir = mkdtempSync(join(tmpdir(), "primitive-thread-mutes-"));
  mkdirSync(join(configDir, "agent-connections", "profiles", "work"), {
    recursive: true,
    mode: 0o700,
  });
  mocks.profileName = "work";
  mocks.requests = [];
  mocks.respond = (method, path) =>
    Response.json(
      {
        success: false,
        error: {
          code: "not_found",
          message: `${method} ${path} is not served yet.`,
        },
      },
      { status: 404 },
    );
  vi.stubEnv("CLAUDE_CODE_SESSION_ID", undefined);
  vi.stubEnv("CODEX_THREAD_ID", undefined);
  vi.stubEnv("CODEX_SESSION_ID", undefined);
  vi.stubEnv("PRIMITIVE_CONFIG_DIR", configDir);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  rmSync(configDir, { recursive: true, force: true });
});

describe("thread mute state", () => {
  it("mutes per session or per profile and matches only applicable scopes", async () => {
    await muteThread(configDir, "work", thread, claude);
    expect(isThreadMuted(configDir, "work", thread, claude)).toBe(true);
    expect(isThreadMuted(configDir, "work", thread.toUpperCase(), claude)).toBe(
      true,
    );
    expect(isThreadMuted(configDir, "work", thread, codex)).toBe(false);
    expect(isThreadMuted(configDir, "work", otherThread, claude)).toBe(false);
    expect(isThreadMuted(configDir, "work", null, claude)).toBe(false);
    await muteThread(configDir, "work", otherThread, null);
    expect(isThreadMuted(configDir, "work", otherThread, codex)).toBe(true);
    expect(isThreadMuted(configDir, "work", otherThread, null)).toBe(true);
  });

  it("is idempotent and unmutes only the named scope", async () => {
    expect((await muteThread(configDir, "work", thread, claude)).changed).toBe(
      true,
    );
    expect((await muteThread(configDir, "work", thread, claude)).changed).toBe(
      false,
    );
    await muteThread(configDir, "work", thread, null);
    const result = await unmuteThread(configDir, "work", thread, claude);
    expect(result.removed).toBe(true);
    expect(result.remaining).toMatchObject([{ session: null }]);
    expect(isThreadMuted(configDir, "work", thread, claude)).toBe(true);
    await unmuteThread(configDir, "work", thread, null);
    expect(isThreadMuted(configDir, "work", thread, claude)).toBe(false);
  });

  it("rejects malformed state rather than guessing", () => {
    writeFileSync(
      join(
        configDir,
        "agent-connections",
        "profiles",
        "work",
        "muted-threads.json",
      ),
      "{oops",
      { mode: 0o600 },
    );
    expect(() => readThreadMutes(configDir, "work")).toThrow(
      ThreadMuteStateError,
    );
  });
});

describe("threads mute commands", () => {
  function capture() {
    const out: string[] = [];
    for (const command of [
      ThreadsMuteCommand,
      ThreadsUnmuteCommand,
      ThreadsMutedCommand,
    ])
      vi.spyOn(command.prototype, "log").mockImplementation(
        (message?: unknown) => {
          out.push(String(message));
        },
      );
    return () => JSON.parse(out.join(""));
  }

  it("mutes for the current Claude session and lists it", async () => {
    vi.stubEnv("CLAUDE_CODE_SESSION_ID", claude.slice(7));
    let output = capture();
    await ThreadsMuteCommand.run(["--id", thread], { root });
    expect(output()).toMatchObject({
      thread_id: thread,
      muted: true,
      already_muted: false,
      scope: claude,
    });
    vi.restoreAllMocks();
    output = capture();
    await ThreadsMutedCommand.run([], { root });
    expect(output()).toMatchObject([{ thread_id: thread, scope: claude }]);
    vi.restoreAllMocks();
    output = capture();
    await ThreadsUnmuteCommand.run(["--id", thread], { root });
    expect(output()).toMatchObject({ removed: true, muted: false });
    expect(isThreadMuted(configDir, "work", thread, claude)).toBe(false);
  });

  it("mutes profile-wide outside a session or with --all-sessions", async () => {
    capture();
    await ThreadsMuteCommand.run(["--id", thread], { root });
    expect(isThreadMuted(configDir, "work", thread, codex)).toBe(true);
    vi.stubEnv("CODEX_THREAD_ID", codex.slice(6));
    await ThreadsMuteCommand.run(["--id", otherThread, "--all-sessions"], {
      root,
    });
    expect(isThreadMuted(configDir, "work", otherThread, claude)).toBe(true);
  });

  it("removes session mutes too when unmuting for all sessions", async () => {
    await muteThread(configDir, "work", thread, claude);
    await muteThread(configDir, "work", thread, codex);
    await muteThread(configDir, "work", thread, null);
    await muteThread(configDir, "work", otherThread, claude);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const output = capture();
    await ThreadsUnmuteCommand.run(["--id", thread, "--all-sessions"], {
      root,
    });
    expect(output()).toMatchObject({ removed: true, muted: false });
    expect(isThreadMuted(configDir, "work", thread, claude)).toBe(false);
    expect(isThreadMuted(configDir, "work", thread, codex)).toBe(false);
    expect(isThreadMuted(configDir, "work", otherThread, claude)).toBe(true);
  });

  it("reports a profile-wide mute that still applies after a session unmute", async () => {
    await muteThread(configDir, "work", thread, null);
    vi.stubEnv("CLAUDE_CODE_SESSION_ID", claude.slice(7));
    const output = capture();
    await ThreadsUnmuteCommand.run(["--id", thread], { root });
    expect(output()).toMatchObject({
      removed: false,
      muted: true,
      still_muted_by: ["all sessions"],
    });
  });

  it("mutes for the address on a server that keeps thread mutes", async () => {
    vi.stubEnv("CLAUDE_CODE_SESSION_ID", claude.slice(7));
    const serverMutes = new Map<string, string>();
    mocks.respond = (method, path) => {
      if (method === "GET" && path === "/v1/threads/muted")
        return Response.json({
          success: true,
          data: [...serverMutes].map(([thread_id, muted_at]) => ({
            thread_id,
            address: "agent@example.com",
            muted: true,
            muted_at,
          })),
          meta: { cursor: null },
        });
      const match = path.match(/^\/v1\/threads\/([^/]+)\/mute$/);
      if (match?.[1] === otherThread)
        return Response.json(
          {
            success: false,
            error: { code: "not_found", message: "Thread not found" },
          },
          { status: 404 },
        );
      if (match && method === "PUT") {
        serverMutes.set(match[1], "2026-10-01T00:00:00.000Z");
        return Response.json({
          success: true,
          data: {
            thread_id: match[1],
            address: "agent@example.com",
            muted: true,
            muted_at: "2026-10-01T00:00:00.000Z",
          },
        });
      }
      if (match && method === "DELETE") {
        serverMutes.delete(match[1]);
        return Response.json({
          success: true,
          data: {
            thread_id: match[1],
            address: "agent@example.com",
            muted: false,
            muted_at: null,
          },
        });
      }
      return Response.json({ success: false }, { status: 500 });
    };
    let output = capture();
    await ThreadsMuteCommand.run(["--id", thread], { root });
    expect(output()).toEqual({
      thread_id: thread,
      muted: true,
      scope: "address",
      stored: "server",
      address: "agent@example.com",
      muted_at: "2026-10-01T00:00:00.000Z",
    });
    // A server mute writes no local state.
    expect(readThreadMutes(configDir, "work")).toEqual([]);
    vi.restoreAllMocks();
    output = capture();
    await ThreadsMuteCommand.run(["--id", thread, "--session-only"], { root });
    expect(output()).toMatchObject({ stored: "local", scope: claude });
    vi.restoreAllMocks();
    output = capture();
    await ThreadsMutedCommand.run([], { root });
    expect(output()).toEqual([
      expect.objectContaining({ thread_id: thread, stored: "server" }),
      expect.objectContaining({ thread_id: thread, stored: "local" }),
    ]);
    vi.restoreAllMocks();
    output = capture();
    await ThreadsUnmuteCommand.run(["--id", thread], { root });
    expect(output()).toMatchObject({
      removed: true,
      server: "unmuted",
      muted: false,
    });
    expect(serverMutes.size).toBe(0);
    expect(mocks.requests.map((r) => r.method)).toEqual([
      "PUT",
      "GET",
      "DELETE",
    ]);

    // A thread the server does not know is an error, not a local mute.
    vi.restoreAllMocks();
    capture();
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    await ThreadsMuteCommand.run(["--id", otherThread], { root });
    expect(process.exitCode).toBe(1);
    process.exitCode = undefined;
    expect(isThreadMuted(configDir, "work", otherThread, claude)).toBe(false);
  });

  it("falls back to a local mute and says so on an older server", async () => {
    const stderr: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      stderr.push(String(chunk));
      return true;
    });
    const output = capture();
    await ThreadsMuteCommand.run(["--id", thread], { root });
    expect(output()).toMatchObject({ stored: "local", scope: "all sessions" });
    expect(stderr.join("")).toContain("stored locally");
  });

  it.each([
    [ThreadsMuteCommand, "PUT", true],
    [ThreadsUnmuteCommand, "DELETE", false],
  ] as const)(
    "uses ordinary credentials and an explicit address for %s",
    async (command, method, muted) => {
      mocks.profileName = undefined;
      mocks.respond = () =>
        Response.json({
          success: true,
          data: {
            thread_id: thread,
            address: "member@example.com",
            muted,
            muted_at: muted ? "2026-10-01T00:00:00.000Z" : null,
          },
        });
      const output = capture();
      await command.run(
        [
          "--id",
          thread,
          "--address",
          "member@example.com",
          "--api-key",
          "ordinary-key",
          "--api-base-url",
          "https://alternate.example.test/v1",
        ],
        { root },
      );
      expect(mocks.requests).toEqual([
        {
          method,
          path: `/v1/threads/${thread}/mute`,
          url: `https://alternate.example.test/v1/threads/${thread}/mute?address=member%40example.com`,
          authorization: "Bearer ordinary-key",
        },
      ]);
      expect(output()).toMatchObject({ address: "member@example.com", muted });
      expect(readThreadMutes(configDir, "work")).toEqual([]);
    },
  );

  it("clears local mutes when unmuting the connected profile's explicit address", async () => {
    await muteThread(configDir, "work", thread, null);
    mocks.respond = () =>
      Response.json({
        success: true,
        data: {
          thread_id: thread,
          address: "agent@example.com",
          muted: false,
          muted_at: null,
        },
      });
    const output = capture();
    await ThreadsUnmuteCommand.run(
      ["--id", thread, "--address", "agent@example.com"],
      { root },
    );
    expect(output()).toMatchObject({
      removed: true,
      server: "unmuted",
      muted: false,
    });
    expect(readThreadMutes(configDir, "work")).toEqual([]);
  });

  it("leaves the connected profile's local mutes intact for another address", async () => {
    await muteThread(configDir, "work", thread, null);
    mocks.respond = () =>
      Response.json({
        success: true,
        data: {
          thread_id: thread,
          address: "other@example.com",
          muted: false,
          muted_at: null,
        },
      });
    const output = capture();
    await ThreadsUnmuteCommand.run(
      ["--id", thread, "--address", "other@example.com"],
      { root },
    );
    expect(output()).toMatchObject({
      address: "other@example.com",
      muted: false,
    });
    expect(isThreadMuted(configDir, "work", thread, null)).toBe(true);
    expect(
      new URL(mocks.requests[0]?.url ?? "").searchParams.get("address"),
    ).toBe("other@example.com");
  });

  it.each([ThreadsMuteCommand, ThreadsUnmuteCommand])(
    "refuses local changes for another address with %s",
    async (command) => {
      await muteThread(configDir, "work", thread, null);
      vi.stubEnv("CLAUDE_CODE_SESSION_ID", claude.slice(7));
      await expect(
        command.run(
          ["--id", thread, "--address", "other@example.com", "--session-only"],
          { root },
        ),
      ).rejects.toThrow(/connected agent profile for the requested address/);
      expect(mocks.requests).toEqual([]);
      expect(isThreadMuted(configDir, "work", thread, null)).toBe(true);
    },
  );

  it("does not store another address's mute locally when the server is unsupported", async () => {
    await expect(
      ThreadsMuteCommand.run(
        ["--id", thread, "--address", "other@example.com"],
        { root },
      ),
    ).rejects.toThrow(/connected agent profile for the requested address/);
    expect(readThreadMutes(configDir, "work")).toEqual([]);
  });

  it.each([ThreadsMuteCommand, ThreadsUnmuteCommand])(
    "preserves local state after the server refuses %s",
    async (command) => {
      await muteThread(configDir, "work", otherThread, null);
      if (command === ThreadsUnmuteCommand)
        await muteThread(configDir, "work", thread, null);
      const before = readThreadMutes(configDir, "work");
      mocks.respond = () =>
        Response.json(
          {
            success: false,
            error: {
              code: "forbidden",
              message: "Thread mute permission denied",
            },
          },
          { status: 403 },
        );
      vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      capture();
      await command.run(["--id", thread], { root });
      expect(process.exitCode).toBe(1);
      process.exitCode = undefined;
      expect(readThreadMutes(configDir, "work")).toEqual(before);
    },
  );

  it("--session-only needs a runtime session and skips the server", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    await expect(
      ThreadsMuteCommand.run(["--id", thread, "--session-only"], { root }),
    ).rejects.toThrow(/needs a Claude Code or Codex session/);
    expect(mocks.requests).toEqual([]);
  });

  it("requires a thread UUID and a connected profile for local fallback", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    await expect(
      ThreadsMuteCommand.run(["--id", "not-a-thread"], { root }),
    ).rejects.toThrow(/thread UUID/);
    mocks.profileName = undefined;
    await expect(
      ThreadsMuteCommand.run(["--id", thread], { root }),
    ).rejects.toThrow(/connected agent profile/);
  });
});
