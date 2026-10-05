import { resolve } from "node:path";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AgentWorkingClearCommand,
  AgentWorkingGetCommand,
  AgentWorkingSetCommand,
  workingClaimStdin,
} from "../../src/oclif/commands/agent-working.js";
import { COMMANDS } from "../../src/oclif/index.js";
import {
  buildWorkingClaim,
  DEFAULT_CLAIM_MS,
  formatWorkingClaim,
  readWorkingClaim,
} from "../../src/oclif/working-claim.js";

const auth = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: auth.create,
}));

const root = resolve(import.meta.dirname, "../..");
const own = "agent@example.test";
const peer = "peer@example.test";
const NOW = Date.parse("2026-10-01T12:00:00.000Z");

function note(value: unknown, version = "3", visibility = "private") {
  return {
    address: own,
    name: "AGENT_WORKING",
    value,
    visibility,
    version,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
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
  vi.useRealTimers();
  vi.restoreAllMocks();
  auth.create.mockReset();
  process.exitCode = undefined;
});

describe("working claim values", () => {
  it("defaults the expiry to four hours from now", () => {
    expect(buildWorkingClaim({ claim: " composer: a.tsx ", now: NOW })).toEqual(
      {
        claim: "composer: a.tsx",
        until: new Date(NOW + DEFAULT_CLAIM_MS).toISOString(),
      },
    );
  });

  it("accepts an explicit ISO expiry with a timezone", () => {
    expect(
      buildWorkingClaim({
        claim: "x",
        until: "2026-10-01T18:00:00+02:00",
        now: NOW,
      }).until,
    ).toBe("2026-10-01T16:00:00.000Z");
  });

  it.each([
    ["", undefined, /must not be empty/],
    ["two\nlines", undefined, /one line/],
    ["x".repeat(501), undefined, /at most 500/],
    ["x", "tomorrow", /ISO 8601/],
    ["x", "2026-10-01T18:00:00", /ISO 8601/],
    ["x", "2026-10-01T11:00:00Z", /in the future/],
  ])("rejects claim %j until %j", (claim, until, message) => {
    expect(() => buildWorkingClaim({ claim, until, now: NOW })).toThrow(
      message,
    );
  });

  it("reports active, expired, legacy and absent values", () => {
    const active = { claim: "a", until: "2026-10-01T13:00:00Z" };
    expect(readWorkingClaim(active, NOW)).toEqual({
      state: "active",
      claim: "a",
      until: "2026-10-01T13:00:00.000Z",
    });
    expect(readWorkingClaim(JSON.stringify(active), NOW).state).toBe("active");
    expect(
      readWorkingClaim({ claim: "a", until: "2026-10-01T11:00:00Z" }, NOW)
        .state,
    ).toBe("expired");
    expect(readWorkingClaim("Researching the topic", NOW)).toEqual({
      state: "legacy",
      claim: "Researching the topic",
      until: null,
    });
    // A malformed structured claim is no claim, never a claim without expiry.
    expect(readWorkingClaim({ claim: "a", until: "soon" }, NOW).state).toBe(
      "none",
    );
    expect(readWorkingClaim({ claim: "a" }, NOW).state).toBe("none");
    // A legacy note that is not claim-shaped stays visible, JSON or not.
    expect(readWorkingClaim('{"task":"checkout refactor"}', NOW)).toEqual({
      state: "legacy",
      claim: '{"task":"checkout refactor"}',
      until: null,
    });
    expect(readWorkingClaim({ task: "checkout refactor" }, NOW).state).toBe(
      "legacy",
    );
    // Empty JSON values are no claim, stored as values or as text.
    for (const empty of [{}, [], "{}", "[]", " [ ] "])
      expect(readWorkingClaim(empty, NOW).state).toBe("none");
    expect(
      readWorkingClaim(JSON.stringify({ claim: "a", until: "soon" }), NOW)
        .state,
    ).toBe("none");
    expect(readWorkingClaim(null, NOW).state).toBe("none");
    expect(readWorkingClaim("", NOW).state).toBe("none");
  });

  it("formats expired and absent claims as none", () => {
    expect(
      formatWorkingClaim(
        readWorkingClaim({ claim: "a", until: "2026-10-01T11:00:00Z" }, NOW),
      ),
    ).toBe("none");
    expect(formatWorkingClaim(readWorkingClaim(null, NOW))).toBe("none");
    expect(formatWorkingClaim(readWorkingClaim("legacy text", NOW))).toBe(
      "legacy text",
    );
  });
});

describe("agent working commands", () => {
  it("are registered under agent working", () => {
    for (const action of ["set", "get", "clear"])
      expect(COMMANDS[`agent:working:${action}`]).toBeDefined();
  });

  it("set writes the JSON claim to the connected profile's own note", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    const calls = fixture(missing, ok(note({})));
    const lines = captureLog(AgentWorkingSetCommand);
    await AgentWorkingSetCommand.run(["composer: src/composer.tsx"], { root });
    const expected = {
      claim: "composer: src/composer.tsx",
      until: new Date(NOW + DEFAULT_CLAIM_MS).toISOString(),
    };
    expect(calls[1]?.method).toBe("PUT");
    expect(decodeURIComponent(calls[1]?.url.pathname ?? "")).toBe(
      `/v1/address-notes/${own}/AGENT_WORKING`,
    );
    // No visibility is sent, so a new note stays private and an existing
    // note keeps its visibility.
    expect(calls[1]?.body).toEqual({ value: expected, if_absent: true });
    expect(lines).toEqual([`Working claim set until ${expected.until}.`]);
  });

  it("set passes --until and explicit visibility and prints JSON", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    const calls = fixture(ok(note("old", "4")), ok(note({}, "5", "public")));
    const lines = captureLog(AgentWorkingSetCommand);
    await AgentWorkingSetCommand.run(
      ["billing", "--until", "2026-10-01T18:00:00Z", "--public", "--json"],
      { root },
    );
    expect(calls[1]?.body).toEqual({
      value: { claim: "billing", until: "2026-10-01T18:00:00.000Z" },
      if_version: "4",
      visibility: "public",
    });
    expect(JSON.parse(lines[0] ?? "")).toEqual({
      address: own,
      state: "active",
      claim: "billing",
      until: "2026-10-01T18:00:00.000Z",
      visibility: "public",
    });
  });

  it("set --stdin reads the claim from stdin, not an argument", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    vi.spyOn(workingClaimStdin, "read").mockReturnValue(
      "composer: src/composer.tsx\n",
    );
    const calls = fixture(missing, ok(note({})));
    captureLog(AgentWorkingSetCommand);
    await AgentWorkingSetCommand.run(["--stdin"], { root });
    expect(calls[1]?.body).toEqual({
      value: {
        claim: "composer: src/composer.tsx",
        until: new Date(NOW + DEFAULT_CLAIM_MS).toISOString(),
      },
      if_absent: true,
    });
  });

  it("set refuses both an argument and --stdin, and neither", async () => {
    const calls = fixture();
    await expect(
      AgentWorkingSetCommand.run(["x", "--stdin"], { root }),
    ).rejects.toThrow(/not both/);
    await expect(AgentWorkingSetCommand.run([], { root })).rejects.toThrow(
      /--stdin/,
    );
    expect(calls).toEqual([]);
  });

  it("set refuses another address from a connected profile", async () => {
    const calls = fixture();
    await expect(
      AgentWorkingSetCommand.run(["x", "--address", peer], { root }),
    ).rejects.toThrow(/only its own address notes/);
    expect(calls).toEqual([]);
  });

  it("get reads a peer claim with --address", async () => {
    const calls = fixture(
      ok({
        ...note({ claim: "composer", until: "2099-01-01T00:00:00Z" }),
        address: peer,
      }),
    );
    const lines = captureLog(AgentWorkingGetCommand);
    await AgentWorkingGetCommand.run(["--address", peer], { root });
    expect(decodeURIComponent(calls[0]?.url.pathname ?? "")).toBe(
      `/v1/address-notes/${peer}/AGENT_WORKING`,
    );
    expect(lines).toEqual(["composer (until 2099-01-01T00:00:00.000Z)"]);
  });

  it("get prints none for an expired or absent claim", async () => {
    fixture(ok(note({ claim: "old", until: "2000-01-01T00:00:00Z" })));
    const lines = captureLog(AgentWorkingGetCommand);
    await AgentWorkingGetCommand.run([], { root });
    fixture(missing);
    await AgentWorkingGetCommand.run([], { root });
    expect(lines).toEqual(["none", "none"]);
    expect(process.exitCode).toBeUndefined();
  });

  it("get --json reports state and keeps the expired claim separate", async () => {
    fixture(ok(note({ claim: "old", until: "2000-01-01T00:00:00Z" })));
    const lines = captureLog(AgentWorkingGetCommand);
    await AgentWorkingGetCommand.run(["--json"], { root });
    expect(JSON.parse(lines[0] ?? "")).toEqual({
      address: own,
      state: "none",
      claim: null,
      until: null,
      expired_claim: { claim: "old", until: "2000-01-01T00:00:00.000Z" },
    });
  });

  it("get shows a legacy plain-text value as-is", async () => {
    fixture(ok(note("Researching the requested topic")));
    const lines = captureLog(AgentWorkingGetCommand);
    await AgentWorkingGetCommand.run(["--json"], { root });
    expect(JSON.parse(lines[0] ?? "")).toEqual({
      address: own,
      state: "legacy",
      claim: "Researching the requested topic",
      until: null,
    });
  });

  it("clear rewrites the claim as expired at its current version", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    const calls = fixture(
      ok(note({ claim: "composer", until: "2099-01-01T00:00:00Z" }, "7")),
      ok(note({}, "8")),
    );
    const lines = captureLog(AgentWorkingClearCommand);
    await AgentWorkingClearCommand.run([], { root });
    expect(calls).toHaveLength(2);
    expect(calls[1]?.method).toBe("PUT");
    expect(calls[1]?.body).toEqual({
      value: { claim: "composer", until: new Date(NOW).toISOString() },
      if_version: "7",
    });
    const written = (calls[1]?.body as { value: unknown }).value;
    expect(readWorkingClaim(written, NOW).state).toBe("expired");
    expect(lines).toEqual(["Working claim cleared."]);
  });

  it("clear ends a legacy plain-text claim the same way", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    const calls = fixture(ok(note("Researching", "2")), ok(note({}, "3")));
    const lines = captureLog(AgentWorkingClearCommand);
    await AgentWorkingClearCommand.run(["--json"], { root });
    expect(calls[1]?.body).toEqual({
      value: { claim: "Researching", until: new Date(NOW).toISOString() },
      if_version: "2",
    });
    expect(JSON.parse(lines[0] ?? "")).toEqual({
      address: own,
      cleared: true,
      method: "expired",
    });
  });

  it("clear falls back to deleting when the write is refused", async () => {
    const forbidden = {
      status: 403,
      body: { success: false, error: { code: "forbidden", message: "No" } },
    };
    const calls = fixture(
      ok(note({ claim: "composer", until: "2099-01-01T00:00:00Z" }, "7")),
      forbidden,
      ok({ deleted: true }),
    );
    const lines = captureLog(AgentWorkingClearCommand);
    await AgentWorkingClearCommand.run(["--json"], { root });
    expect(calls.map((call) => call.method)).toEqual(["GET", "PUT", "DELETE"]);
    expect(calls[2]?.url.searchParams.get("if_version")).toBe("7");
    expect(JSON.parse(lines[0] ?? "")).toEqual({
      address: own,
      cleared: true,
      method: "deleted",
    });
    expect(process.exitCode).toBeUndefined();
  });

  it("clear reports both the refused write and the delete's own failure", async () => {
    const refused = {
      status: 409,
      body: {
        success: false,
        error: { code: "version_conflict", message: "Write conflict" },
      },
    };
    const deleteRefused = {
      status: 403,
      body: {
        success: false,
        error: { code: "forbidden", message: "Delete not allowed" },
      },
    };
    fixture(
      ok(note({ claim: "composer", until: "2099-01-01T00:00:00Z" }, "7")),
      refused,
      deleteRefused,
    );
    captureLog(AgentWorkingClearCommand);
    const written: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });
    await AgentWorkingClearCommand.run([], { root });
    expect(process.exitCode).toBe(1);
    const stderr = written.join("");
    expect(stderr).toContain("Write conflict");
    expect(stderr).toContain("Delete not allowed");
    expect(stderr.indexOf("Write conflict")).toBeLessThan(
      stderr.indexOf("Delete not allowed"),
    );
  });

  it("clear ends a JSON-shaped legacy note", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    const calls = fixture(
      ok(note('{"task":"checkout refactor"}', "4")),
      ok(note({}, "5")),
    );
    const lines = captureLog(AgentWorkingClearCommand);
    await AgentWorkingClearCommand.run(["--json"], { root });
    expect(calls[1]?.method).toBe("PUT");
    expect(JSON.parse(lines[0] ?? "")).toMatchObject({ cleared: true });
  });

  it("clear writes nothing when the claim already expired", async () => {
    const calls = fixture(
      ok(note({ claim: "old", until: "2000-01-01T00:00:00Z" })),
    );
    const lines = captureLog(AgentWorkingClearCommand);
    await AgentWorkingClearCommand.run(["--json"], { root });
    expect(calls).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "")).toEqual({
      address: own,
      cleared: false,
      method: null,
    });
  });

  it("clear succeeds when there is no claim", async () => {
    fixture(missing);
    const lines = captureLog(AgentWorkingClearCommand);
    await AgentWorkingClearCommand.run(["--json"], { root });
    expect(JSON.parse(lines[0] ?? "")).toEqual({
      address: own,
      cleared: false,
      method: null,
    });
    expect(process.exitCode).toBeUndefined();
  });

  it("reports other API failures with a nonzero exit", async () => {
    fixture({
      status: 403,
      body: { success: false, error: { code: "forbidden", message: "No" } },
    });
    captureLog(AgentWorkingGetCommand);
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    await AgentWorkingGetCommand.run([], { root });
    expect(process.exitCode).toBe(1);
    expect(stderr).toHaveBeenCalled();
  });
});
