import { resolve } from "node:path";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AgentRenameUnsupportedError,
  agentDisplayName,
  RENAME_UNSUPPORTED_MESSAGE,
  renameAgentConnection,
  renameTarget,
} from "../../src/oclif/agent-rename.js";
import AgentRenameCommand from "../../src/oclif/commands/agent-rename.js";
import { COMMANDS } from "../../src/oclif/index.js";

const auth = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: auth.create,
}));

const root = resolve(import.meta.dirname, "../..");
const own = "agent@example.test";
const peer = "peer@example.test";

type Reply = { body: unknown; status?: number };

function connection(name: string, address = own) {
  return {
    address,
    name,
    owner_address: "owner@example.test",
    status: "connected",
  };
}
const ok = (name: string, address = own): Reply => ({
  body: { success: true, data: { connection: connection(name, address) } },
});

function fixture(
  connectedAgent: string | undefined,
  ...responses: Reply[]
): { method: string; url: URL; body: unknown }[] {
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
    auth: connectedAgent
      ? { connectedAgent: { agentAddress: connectedAgent } }
      : {},
    baseUrlOverridden: false,
  });
  return calls;
}

function captureLog(): string[] {
  const lines: string[] = [];
  vi.spyOn(
    AgentRenameCommand.prototype as { log: (...args: unknown[]) => void },
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

describe("agent display name rules", () => {
  it("trims and accepts names up to 64 characters", () => {
    expect(agentDisplayName("  Billing reviewer  ")).toBe("Billing reviewer");
    expect(agentDisplayName("x".repeat(64))).toBe("x".repeat(64));
    // Characters, not UTF-16 units, are counted.
    expect(agentDisplayName("\u{1F600}".repeat(64))).toHaveLength(128);
  });

  it.each([
    ["", /must not be empty/],
    ["   ", /must not be empty/],
    ["x".repeat(65), /at most 64/],
    ["two\nlines", /one line/],
    ["tab\there", /one line/],
    ["bell\u0007", /one line/],
    ["c1\u0085", /one line/],
    ["split line", /one line/],
  ])("rejects %j", (name, message) => {
    expect(() => agentDisplayName(name)).toThrow(message);
  });

  it("defaults a connected profile to its own address", () => {
    expect(renameTarget(undefined, own)).toBe(own);
    expect(renameTarget(own.toUpperCase(), own)).toBe(own);
    expect(() => renameTarget(peer, own)).toThrow(/only its own address/);
    expect(renameTarget(peer, undefined)).toBe(peer);
    expect(() => renameTarget(undefined, undefined)).toThrow(/--address/);
  });
});

describe("renameAgentConnection", () => {
  it("sends PATCH /agent-connections/{address}/name with the trimmed name", async () => {
    const calls = fixture(own, ok("Billing reviewer"));
    const { apiClient } = await auth.create();
    const result = await renameAgentConnection(apiClient.client, {
      address: own,
      name: " Billing reviewer ",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe("PATCH");
    expect(decodeURIComponent(calls[0]?.url.pathname ?? "")).toBe(
      `/v1/agent-connections/${own}/name`,
    );
    expect(calls[0]?.body).toEqual({ name: "Billing reviewer" });
    expect(result).toMatchObject({ address: own, name: "Billing reviewer" });
  });

  it("validates before sending anything", async () => {
    const calls = fixture(own);
    const { apiClient } = await auth.create();
    await expect(
      renameAgentConnection(apiClient.client, { address: own, name: "a\nb" }),
    ).rejects.toThrow(/one line/);
    expect(calls).toEqual([]);
  });

  it("reports a missing route as unsupported", async () => {
    fixture(own, {
      status: 404,
      body: {
        success: false,
        error: {
          code: "not_found",
          message:
            "PATCH /v1/agent-connections/agent@example.test/name is not served yet.",
        },
      },
    });
    const { apiClient } = await auth.create();
    await expect(
      renameAgentConnection(apiClient.client, { address: own, name: "x" }),
    ).rejects.toBeInstanceOf(AgentRenameUnsupportedError);
  });

  it("keeps an unknown-connection 404 as an API error", async () => {
    fixture(own, {
      status: 404,
      body: {
        success: false,
        error: { code: "not_found", message: "Agent connection not found" },
      },
    });
    const { apiClient } = await auth.create();
    const failure = renameAgentConnection(apiClient.client, {
      address: own,
      name: "x",
    });
    await expect(failure).rejects.not.toBeInstanceOf(
      AgentRenameUnsupportedError,
    );
    await expect(failure).rejects.toMatchObject({ status: 404 });
  });

  it("rejects a response for another address", async () => {
    fixture(own, ok("x", peer));
    const { apiClient } = await auth.create();
    await expect(
      renameAgentConnection(apiClient.client, { address: own, name: "x" }),
    ).rejects.toThrow(/invalid connection/);
  });
});

describe("agent rename command", () => {
  it("is registered as agent rename", () => {
    expect(COMMANDS["agent:rename"]).toBe(AgentRenameCommand);
  });

  it("renames the connected profile's own address", async () => {
    const calls = fixture(own, ok("Billing reviewer"));
    const lines = captureLog();
    await AgentRenameCommand.run(["Billing reviewer"], { root });
    expect(decodeURIComponent(calls[0]?.url.pathname ?? "")).toBe(
      `/v1/agent-connections/${own}/name`,
    );
    expect(lines).toEqual([
      `Renamed ${own} to "Billing reviewer". The address is unchanged.`,
    ]);
  });

  it("lets an owner login rename an address and print JSON", async () => {
    const calls = fixture(undefined, ok("Research", peer));
    const lines = captureLog();
    await AgentRenameCommand.run(["Research", "--address", peer, "--json"], {
      root,
    });
    expect(decodeURIComponent(calls[0]?.url.pathname ?? "")).toBe(
      `/v1/agent-connections/${peer}/name`,
    );
    expect(JSON.parse(lines.join("\n"))).toEqual({
      connection: connection("Research", peer),
    });
  });

  it("refuses another address from a connected profile without a request", async () => {
    const calls = fixture(own);
    await expect(
      AgentRenameCommand.run(["x", "--address", peer], { root }),
    ).rejects.toThrow(/only its own address/);
    expect(calls).toEqual([]);
  });

  it("refuses an invalid name before authenticating", async () => {
    await expect(
      AgentRenameCommand.run(["x".repeat(65)], { root }),
    ).rejects.toThrow(/at most 64/);
    expect(auth.create).not.toHaveBeenCalled();
  });

  it("explains an API without the rename route", async () => {
    fixture(own, {
      status: 404,
      body: {
        success: false,
        error: { code: "not_found", message: "Not found" },
      },
    });
    await expect(AgentRenameCommand.run(["x"], { root })).rejects.toThrow(
      RENAME_UNSUPPORTED_MESSAGE,
    );
  });
});
