import { resolve } from "node:path";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defaultRuntimeNote,
  detectRuntimeLabel,
  insideOmp,
  RUNTIME_NOTE_NAME,
  runtimeFolderLabel,
  runtimeHostLabel,
  runtimeNoteValue,
} from "../../src/oclif/agent-runtime-note.js";
import {
  AgentRuntimeGetCommand,
  AgentRuntimeSetCommand,
} from "../../src/oclif/commands/agent-runtime.js";
import { COMMANDS } from "../../src/oclif/index.js";

const auth = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: auth.create,
}));

const root = resolve(import.meta.dirname, "../..");
const own = "agent@example.test";
const peer = "peer@example.test";
const noOmp = () => false;

function note(value: unknown, version = "3", visibility = "private") {
  return {
    address: own,
    name: RUNTIME_NOTE_NAME,
    value,
    visibility,
    version,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-02T00:00:00Z",
  };
}
const ok = (data: unknown) => ({ body: { success: true, data } });
const missing = {
  status: 404,
  body: { success: false, error: { code: "not_found", message: "Not found" } },
};
type Reply = { body: unknown; status?: number };

function fixture(...responses: Reply[]) {
  const calls: { method: string; url: URL; body: unknown }[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const request = new Request(input, init);
    const body = await request.text();
    calls.push({
      method: request.method,
      url: new URL(request.url),
      body: body ? JSON.parse(body) : undefined,
    });
    const next = responses.shift();
    if (!next) throw new Error("Unexpected extra API request");
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  });
  const apiClient = new PrimitiveApiClient({
    apiKey: "test-key",
    apiBaseUrl: "https://api.example.test/v1",
    fetch,
  });
  auth.create.mockResolvedValue({
    apiClient,
    auth: { connectedAgent: { agentAddress: own } },
    baseUrlOverridden: false,
  });
  return calls;
}

function captureLog(command: { prototype: { log: unknown } }): string[] {
  const lines: string[] = [];
  vi.spyOn(
    command.prototype as { log: (...args: unknown[]) => void },
    "log",
  ).mockImplementation((line?: unknown) => {
    lines.push(String(line));
  });
  return lines;
}

afterEach(() => {
  vi.restoreAllMocks();
  auth.create.mockReset();
  process.exitCode = undefined;
});

describe("default runtime note", () => {
  it("formats runtime, host and folder name", () => {
    expect(
      defaultRuntimeNote({
        env: { CLAUDE_CODE_SESSION_ID: "11111111-1111-4111-8111-111111111111" },
        hostname: "Ethan-Mac.local",
        cwd: "/Users/ethan/Desktop/currentProjects/primitive-mono-repo-5",
        insideOmp: noOmp,
      }),
    ).toBe("Claude Code on ethan-mac in primitive-mono-repo-5");
  });

  it("detects the runtime from its marker variables", () => {
    expect(detectRuntimeLabel({ CLAUDECODE: "1" }, noOmp)).toBe("Claude Code");
    expect(detectRuntimeLabel({ CODEX_THREAD_ID: "t" }, noOmp)).toBe("Codex");
    expect(detectRuntimeLabel({ CODEX_SESSION_ID: "s" }, noOmp)).toBe("Codex");
    expect(detectRuntimeLabel({}, () => true)).toBe("omp");
    expect(detectRuntimeLabel({ CLAUDECODE: " " }, noOmp)).toBe("CLI");
    expect(detectRuntimeLabel({}, noOmp)).toBe("CLI");
  });

  it("detects omp from the process ancestry", () => {
    const rows: Record<number, { ppid: number; command: string }> = {
      40: { ppid: 30, command: "/bin/zsh -c primitive agent runtime set" },
      30: { ppid: 20, command: "bun /opt/pi-coding-agent/dist/cli.js" },
      20: { ppid: 1, command: "login" },
    };
    const processInfo = (pid: number) => {
      const row = rows[pid];
      return row ? { ...row, started: "Thu Oct  1 12:00:00 2026" } : null;
    };
    expect(insideOmp({ startPid: 40, processInfo, platform: "darwin" })).toBe(
      true,
    );
    expect(insideOmp({ startPid: 20, processInfo, platform: "darwin" })).toBe(
      false,
    );
    expect(insideOmp({ startPid: 40, processInfo, platform: "win32" })).toBe(
      false,
    );
  });

  it("lowercases the host and strips a trailing .local", () => {
    expect(runtimeHostLabel("Ethan-Mac.local")).toBe("ethan-mac");
    expect(runtimeHostLabel("BUILD-BOX.LOCAL")).toBe("build-box");
    expect(runtimeHostLabel("box.local.example.com")).toBe(
      "box.local.example.com",
    );
    expect(runtimeHostLabel("  ")).toBe("unknown-host");
  });

  it("uses only the folder name, never the path", () => {
    expect(runtimeFolderLabel("/Users/ethan/src/app")).toBe("app");
    expect(runtimeFolderLabel("/Users/ethan/src/app/")).toBe("app");
    expect(runtimeFolderLabel("/")).toBe("/");
    expect(runtimeFolderLabel("/srv/odd\nname")).toBe("oddname");
  });

  it("never includes environment values or the full path", () => {
    const value = defaultRuntimeNote({
      env: { CODEX_THREAD_ID: "secret-thread", PRIMITIVE_API_KEY: "prim_x" },
      hostname: "box",
      cwd: "/home/dev/app",
      insideOmp: noOmp,
    });
    expect(value).toBe("Codex on box in app");
  });

  it("shortens a very long folder name without splitting a character", () => {
    const value = defaultRuntimeNote({
      env: {},
      hostname: "box",
      cwd: `/srv/${"\u{1F600}".repeat(300)}`,
      insideOmp: noOmp,
    });
    expect(value.length).toBeLessThanOrEqual(500);
    expect(value.startsWith("CLI on box in ...")).toBe(true);
    expect(value.endsWith("\u{1F600}")).toBe(true);
    // No lone surrogate halves remain after the cut.
    const lone = Array.from(value).filter((character) => {
      const code = character.charCodeAt(0);
      return character.length === 1 && code >= 0xd800 && code <= 0xdfff;
    });
    expect(lone).toEqual([]);
  });

  it("validates an explicit value", () => {
    expect(runtimeNoteValue("  Codex on box in app ")).toBe(
      "Codex on box in app",
    );
    expect(() => runtimeNoteValue("")).toThrow(/must not be empty/);
    expect(() => runtimeNoteValue("a\nb")).toThrow(/one line/);
    expect(() => runtimeNoteValue("x".repeat(501))).toThrow(/at most 500/);
  });
});

describe("agent runtime commands", () => {
  it("are registered under agent runtime", () => {
    expect(COMMANDS["agent:runtime:set"]).toBe(AgentRuntimeSetCommand);
    expect(COMMANDS["agent:runtime:get"]).toBe(AgentRuntimeGetCommand);
  });

  it("set creates a private AGENT_RUNTIME note on the profile's own address", async () => {
    const calls = fixture(missing, ok(note("v", "1")));
    const lines = captureLog(AgentRuntimeSetCommand);
    await AgentRuntimeSetCommand.run(["--value", "Codex on box in app"], {
      root,
    });
    expect(calls.map((call) => call.method)).toEqual(["GET", "PUT"]);
    expect(decodeURIComponent(calls[1]?.url.pathname ?? "")).toBe(
      `/v1/address-notes/${own}/AGENT_RUNTIME`,
    );
    expect(calls[1]?.body).toEqual({
      value: "Codex on box in app",
      if_absent: true,
      visibility: "private",
    });
    expect(lines).toEqual(["AGENT_RUNTIME set: Codex on box in app"]);
  });

  it("set updates an existing note with its version and prints JSON", async () => {
    const calls = fixture(ok(note("old", "7", "public")), ok(note("new", "8")));
    const lines = captureLog(AgentRuntimeSetCommand);
    await AgentRuntimeSetCommand.run(
      ["--value", "Claude Code on box in home", "--json"],
      { root },
    );
    expect(calls[1]?.body).toEqual({
      value: "Claude Code on box in home",
      if_version: "7",
      visibility: "private",
    });
    expect(JSON.parse(lines.join("\n"))).toEqual({
      address: own,
      name: "AGENT_RUNTIME",
      value: "Claude Code on box in home",
      visibility: "private",
      version: "8",
    });
  });

  it("set computes the default value when --value is omitted", async () => {
    const calls = fixture(missing, ok(note("v", "1")));
    captureLog(AgentRuntimeSetCommand);
    await AgentRuntimeSetCommand.run([], { root });
    const written = (calls[1]?.body as { value: string } | undefined)?.value;
    expect(written).toMatch(/^(Claude Code|Codex|omp|CLI) on \S+ in \S/);
  });

  it("set refuses another address from a connected profile", async () => {
    const calls = fixture();
    await expect(
      AgentRuntimeSetCommand.run(["--value", "x", "--address", peer], { root }),
    ).rejects.toThrow(/only its own address notes/);
    expect(calls).toEqual([]);
  });

  it("get reports a route 404 instead of printing none", async () => {
    fixture({
      status: 404,
      body: {
        success: false,
        error: {
          code: "not_found",
          message: "GET /v1/address-notes/x is not served yet.",
        },
      },
    });
    const lines = captureLog(AgentRuntimeGetCommand);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    await AgentRuntimeGetCommand.run([], { root });
    expect(lines).toEqual([]);
    expect(process.exitCode).toBe(1);
  });

  it("get prints the note, or none when absent", async () => {
    fixture(ok(note("Codex on box in app")));
    const lines = captureLog(AgentRuntimeGetCommand);
    await AgentRuntimeGetCommand.run([], { root });
    fixture(missing);
    await AgentRuntimeGetCommand.run([], { root });
    expect(lines).toEqual(["Codex on box in app", "none"]);
    expect(process.exitCode).toBeUndefined();
  });

  it("get reads a peer's note as JSON", async () => {
    const calls = fixture(ok({ ...note("omp on box in x"), address: peer }));
    const lines = captureLog(AgentRuntimeGetCommand);
    await AgentRuntimeGetCommand.run(["--address", peer, "--json"], { root });
    expect(decodeURIComponent(calls[0]?.url.pathname ?? "")).toBe(
      `/v1/address-notes/${peer}/AGENT_RUNTIME`,
    );
    expect(JSON.parse(lines.join("\n"))).toEqual({
      address: peer,
      name: "AGENT_RUNTIME",
      value: "omp on box in x",
      visibility: "private",
      updated_at: "2026-10-02T00:00:00Z",
    });
  });
});
