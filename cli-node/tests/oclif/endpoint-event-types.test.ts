import { resolve } from "node:path";
import {
  operationManifest,
  PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createOperationCommand } from "../../src/oclif/api-command.js";
import {
  currentEndpointRules,
  EventTypesFlagError,
  parseEventTypesFlag,
  withDefaultEventTypes,
  withEventTypes,
} from "../../src/oclif/endpoint-event-types.js";

const auth = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: auth.create,
}));

const SENT_EMAIL_EVENTS = [
  "sent_email.accepted",
  "sent_email.delivered",
  "sent_email.failed",
  "sent_email.completed",
];
const ENDPOINT_ID = "c4a9e1b7-3d28-4f60-b915-8e2c7a0d6f31";

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
    auth: {},
    baseUrlOverridden: false,
  });
  return calls;
}

function endpointRow(rules: Record<string, unknown>) {
  return {
    id: ENDPOINT_ID,
    org_id: "11111111-1111-4111-8111-111111111111",
    url: "https://hooks.example.test/primitive",
    enabled: true,
    rules,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    delivery_count: 0,
    success_count: 0,
    failure_count: 0,
    consecutive_fails: 0,
  };
}

function command(sdkName: string) {
  const operation = operationManifest.find((op) => op.sdkName === sdkName);
  if (!operation) throw new Error(`missing operation ${sdkName}`);
  const Cmd = createOperationCommand(operation) as unknown as {
    run(argv: string[], opts: { root: string }): Promise<void>;
    flags: Record<string, unknown>;
  };
  return Cmd;
}

const root = resolve(import.meta.dirname, "../..");

afterEach(() => {
  vi.restoreAllMocks();
  auth.create.mockReset();
  process.exitCode = undefined;
});

describe("parseEventTypesFlag", () => {
  it("splits, trims and dedupes, and leaves family names for the API to expand", () => {
    expect(
      parseEventTypesFlag([
        "email.received, sent_email.*",
        "sent_email.*",
        "email_rule_objection.*,email.bouncd",
        "",
      ]),
    ).toEqual([
      "email.received",
      "sent_email.*",
      "email_rule_objection.*",
      "email.bouncd",
    ]);
  });

  it("rejects an empty list", () => {
    expect(() => parseEventTypesFlag([" , "])).toThrow(EventTypesFlagError);
  });
});

describe("withDefaultEventTypes", () => {
  it("adds email.received to a create that names no event types, and leaves any other body alone", () => {
    expect(withDefaultEventTypes(undefined)).toBeUndefined();
    expect(withDefaultEventTypes({ kind: "http", url: "u" })).toEqual({
      kind: "http",
      url: "u",
      rules: { event_types: ["email.received"] },
    });
    for (const other of [
      { kind: "function", function_id: "f" },
      { kind: "pull", name: "p" },
    ])
      expect(withDefaultEventTypes(other)).toBe(other);
    expect(
      withDefaultEventTypes({ url: "u", rules: { max_size_bytes: 1 } }),
    ).toEqual({
      url: "u",
      rules: { max_size_bytes: 1, event_types: ["email.received"] },
    });
    const named = { rules: { event_types: ["sent_email.*"] } };
    expect(withDefaultEventTypes(named)).toBe(named);
    expect(withDefaultEventTypes([])).toEqual([]);
  });
});

describe("withEventTypes", () => {
  it("keeps the base rules and lets body rules win", () => {
    expect(
      withEventTypes(
        { url: "https://x.test", rules: { max_size_bytes: 10 } },
        ["sent_email.failed"],
        { max_size_bytes: 5, sender_whitelist: ["a@example.test"] },
      ),
    ).toEqual({
      url: "https://x.test",
      rules: {
        max_size_bytes: 10,
        sender_whitelist: ["a@example.test"],
        event_types: ["sent_email.failed"],
      },
    });
    expect(withEventTypes(undefined, ["email.received"])).toEqual({
      rules: { event_types: ["email.received"] },
    });
  });

  it("refuses a body or rules that is not an object", () => {
    expect(() => withEventTypes([], ["email.received"])).toThrow(
      EventTypesFlagError,
    );
    expect(() => withEventTypes({ rules: "x" }, ["email.received"])).toThrow(
      EventTypesFlagError,
    );
  });
});

describe("currentEndpointRules", () => {
  it("returns the endpoint's rules and fails closed when it is missing", async () => {
    const list = async () => ({
      data: { data: [endpointRow({ max_size_bytes: 5 })] },
    });
    await expect(currentEndpointRules(ENDPOINT_ID, list)).resolves.toEqual({
      max_size_bytes: 5,
    });
    await expect(currentEndpointRules("other", list)).rejects.toThrow(
      EventTypesFlagError,
    );
    await expect(
      currentEndpointRules(ENDPOINT_ID, async () => ({ error: "boom" })),
    ).rejects.toThrow(EventTypesFlagError);
  });
});

describe("endpoints create/update --event-types", () => {
  it("is only offered on endpoint create and update", () => {
    expect(command("createEndpoint").flags["event-types"]).toBeDefined();
    expect(command("updateEndpoint").flags["event-types"]).toBeDefined();
    expect(command("listEndpoints").flags["event-types"]).toBeUndefined();
  });

  it("sends a family name as given on create", async () => {
    const calls = fixture({
      body: {
        success: true,
        data: endpointRow({ event_types: SENT_EMAIL_EVENTS }),
      },
    });
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await command("createEndpoint").run(
      [
        "--url",
        "https://hooks.example.test/primitive",
        "--event-types",
        "sent_email.*",
      ],
      { root },
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.body).toEqual({
      url: "https://hooks.example.test/primitive",
      rules: { event_types: ["sent_email.*"] },
    });
  });

  it("sends email.received on a create that names no event types", async () => {
    const calls = fixture({ body: { success: true, data: endpointRow({}) } });
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await command("createEndpoint").run(
      ["--url", "https://hooks.example.test/primitive"],
      { root },
    );
    expect(calls[0]?.body).toEqual({
      url: "https://hooks.example.test/primitive",
      rules: { event_types: ["email.received"] },
    });
  });

  it("never fills in the URL when an update adds rule events", async () => {
    const calls = fixture(
      { body: { success: true, data: [endpointRow({})] } },
      { body: { success: true, data: endpointRow({}) } },
    );
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await command("updateEndpoint").run(
      ["--id", ENDPOINT_ID, "--event-types", "email_rule_request.*"],
      { root },
    );
    const patch = calls.find((call) => call.method === "PATCH");
    expect(patch?.body).not.toHaveProperty("url");
  });

  it("keeps the endpoint's other rules on update", async () => {
    const calls = fixture(
      {
        body: {
          success: true,
          data: [
            endpointRow({
              sender_whitelist: ["alerts@example.test"],
              event_types: ["email.received"],
            }),
          ],
        },
      },
      {
        body: {
          success: true,
          data: endpointRow({
            sender_whitelist: ["alerts@example.test"],
            event_types: ["email.received", ...SENT_EMAIL_EVENTS],
          }),
        },
      },
    );
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await command("updateEndpoint").run(
      [
        "--id",
        ENDPOINT_ID,
        "--event-types",
        "email.received",
        "--event-types",
        "sent_email.*",
      ],
      { root },
    );
    expect(calls.map((call) => call.method)).toEqual(["GET", "PATCH"]);
    expect(calls[1]?.url.pathname).toBe(`/v1/endpoints/${ENDPOINT_ID}`);
    expect(calls[1]?.body).toEqual({
      rules: {
        sender_whitelist: ["alerts@example.test"],
        event_types: ["email.received", "sent_email.*"],
      },
    });
  });

  it("does not read the endpoint when --raw-body carries the rules", async () => {
    const calls = fixture({
      body: { success: true, data: endpointRow({}) },
    });
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await command("updateEndpoint").run(
      [
        "--id",
        ENDPOINT_ID,
        "--raw-body",
        '{"rules":{"max_size_bytes":100}}',
        "--event-types",
        "sent_email.completed",
      ],
      { root },
    );
    expect(calls.map((call) => call.method)).toEqual(["PATCH"]);
    expect(calls[0]?.body).toEqual({
      rules: { max_size_bytes: 100, event_types: ["sent_email.completed"] },
    });
  });
});
