import { resolve } from "node:path";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AddressNotesApiError,
  addressNoteTarget,
  runAddressNotesRequest,
} from "../../src/oclif/address-notes.js";
import {
  AgentNotesDeleteCommand,
  AgentNotesGetCommand,
  AgentNotesListCommand,
  AgentNotesSetCommand,
} from "../../src/oclif/commands/agent-notes.js";

const auth = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: auth.create,
}));

const own = "agent+tag@example.test";
const peer = "peer@example.test";
const name = "AGENT_INFO";
const note = {
  address: own,
  name,
  value: { name: "Agent", description: "Research" },
  visibility: "private",
  version: "12",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
};
const ok = (data: unknown, meta?: unknown) => ({
  body: { success: true, data, ...(meta === undefined ? {} : { meta }) },
});
const missing = {
  status: 404,
  body: { success: false, error: { code: "not_found", message: "Not found" } },
};
const conflict = {
  status: 409,
  body: {
    success: false,
    error: { code: "address_note_conflict", message: "Changed" },
  },
};
type Reply = { body: unknown; status?: number };

function fixture(...responses: Reply[]) {
  const calls: {
    method: string;
    url: URL;
    body: unknown;
    authorization: string | null;
  }[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const request = new Request(input, init);
    const body = await request.text();
    calls.push({
      method: request.method,
      url: new URL(request.url),
      body: body ? JSON.parse(body) : undefined,
      authorization: request.headers.get("Authorization"),
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
  return { apiClient, client: apiClient.client, calls };
}

afterEach(() => {
  vi.restoreAllMocks();
  auth.create.mockReset();
  process.exitCode = undefined;
});

describe("address notes public API commands", () => {
  it("lists another organization address with the exact public path and live cursor", async () => {
    const f = fixture(
      ok([{ ...note, address: peer }], { limit: 5, cursor: null }),
    );
    const result = await runAddressNotesRequest(f.client, {
      action: "list",
      address: peer,
      prefix: "AGENT_",
      limit: 5,
    });
    expect(result).toMatchObject({
      data: [{ address: peer }],
      meta: { cursor: null },
    });
    expect(f.calls[0]?.url.pathname).toBe("/v1/address-notes");
    expect(f.calls[0]?.url.searchParams.get("address")).toBe(peer);
    expect(f.calls[0]?.url.searchParams.get("prefix")).toBe("AGENT_");
    expect(f.calls[0]?.authorization).toBe("Bearer test-key");
  });

  it("gets a note without a write and preserves plus tags", async () => {
    const f = fixture(ok(note));
    expect(
      await runAddressNotesRequest(f.client, {
        action: "get",
        address: own,
        name,
      }),
    ).toEqual(note);
    expect(decodeURIComponent(f.calls[0]?.url.pathname ?? "")).toBe(
      `/v1/address-notes/${own}/${name}`,
    );
    expect(f.calls.map((call) => call.method)).toEqual(["GET"]);
  });

  it("creates a private note using if_absent without reading or requesting publication", async () => {
    const f = fixture(missing, ok(note));
    await runAddressNotesRequest(f.client, {
      action: "set",
      address: own,
      name,
      value: note.value,
    });
    expect(f.calls.map((call) => call.method)).toEqual(["GET", "PUT"]);
    expect(f.calls[1]?.body).toEqual({ value: note.value, if_absent: true });
  });

  it("preserves public visibility on an edit by omitting visibility and uses the read version", async () => {
    const f = fixture(
      ok({ ...note, visibility: "public" }),
      ok({ ...note, visibility: "public", version: "13" }),
    );
    await runAddressNotesRequest(f.client, {
      action: "set",
      address: own,
      name,
      value: "changed",
    });
    expect(f.calls[1]?.body).toEqual({ value: "changed", if_version: "12" });
  });

  it("can explicitly publish with a supplied version, without a preliminary read", async () => {
    const f = fixture(ok({ ...note, visibility: "public", version: "13" }));
    await runAddressNotesRequest(f.client, {
      action: "set",
      address: own,
      name,
      value: "curated",
      visibility: "public",
      ifVersion: "12",
    });
    expect(f.calls.map((call) => call.method)).toEqual(["PUT"]);
    expect(f.calls[0]?.body).toEqual({
      value: "curated",
      if_version: "12",
      visibility: "public",
    });
  });

  it("does not retry a conditional conflict", async () => {
    const f = fixture(ok(note), conflict);
    await expect(
      runAddressNotesRequest(f.client, {
        action: "set",
        address: own,
        name,
        value: "changed",
      }),
    ).rejects.toBeInstanceOf(AddressNotesApiError);
    expect(f.calls.map((call) => call.method)).toEqual(["GET", "PUT"]);
  });

  it("deletes with the current version and no retry", async () => {
    const f = fixture(ok(note), ok({ deleted: true }));
    expect(
      await runAddressNotesRequest(f.client, {
        action: "delete",
        address: own,
        name,
      }),
    ).toEqual({ deleted: true });
    expect(f.calls.map((call) => call.method)).toEqual(["GET", "DELETE"]);
    expect(f.calls[1]?.url.searchParams.get("if_version")).toBe("12");
  });

  it("does not permit connected-agent writes to another address", () => {
    expect(addressNoteTarget(undefined, own, true)).toBe(own);
    expect(addressNoteTarget(peer, own, false)).toBe(peer);
    expect(() => addressNoteTarget(peer, own, true)).toThrow("only its own");
  });

  it("invokes the user-facing set shape with JSON value and own-address default", async () => {
    const f = fixture(ok({ ...note, version: "13" }));
    auth.create.mockResolvedValue({
      apiClient: f.apiClient,
      auth: { connectedAgent: { agentAddress: own } },
      baseUrlOverridden: false,
    });
    const log = vi
      .spyOn(AgentNotesSetCommand.prototype, "log")
      .mockImplementation(() => undefined);
    await AgentNotesSetCommand.run(
      [
        "AGENT_INFO",
        '{"name":"Agent","description":"Research"}',
        "--json-value",
        "--if-version",
        "12",
      ],
      {
        root: resolve(import.meta.dirname, "../.."),
      },
    );
    expect(f.calls[0]?.body).toEqual({ value: note.value, if_version: "12" });
    expect(decodeURIComponent(f.calls[0]?.url.pathname ?? "")).toBe(
      `/v1/address-notes/${own}/${name}`,
    );
    expect(log).toHaveBeenCalled();
  });

  it("invokes list, get and delete with their user-facing command shapes", async () => {
    const f = fixture(
      ok([{ ...note, address: peer }], { limit: 50, cursor: null }),
      ok(note),
      ok({ deleted: true }),
    );
    auth.create.mockResolvedValue({
      apiClient: f.apiClient,
      auth: { connectedAgent: { agentAddress: own } },
      baseUrlOverridden: false,
    });
    const root = resolve(import.meta.dirname, "../..");
    vi.spyOn(AgentNotesListCommand.prototype, "log").mockImplementation(
      () => undefined,
    );
    vi.spyOn(AgentNotesGetCommand.prototype, "log").mockImplementation(
      () => undefined,
    );
    vi.spyOn(AgentNotesDeleteCommand.prototype, "log").mockImplementation(
      () => undefined,
    );
    await AgentNotesListCommand.run(["--address", peer, "--prefix", "AGENT_"], {
      root,
    });
    await AgentNotesGetCommand.run([name], { root });
    await AgentNotesDeleteCommand.run([name, "--if-version", "12"], { root });
    expect(f.calls.map((call) => call.method)).toEqual([
      "GET",
      "GET",
      "DELETE",
    ]);
    expect(f.calls[0]?.url.searchParams.get("address")).toBe(peer);
    expect(f.calls[1]?.url.pathname).toContain("AGENT_INFO");
    expect(f.calls[2]?.url.searchParams.get("if_version")).toBe("12");
  });
});
