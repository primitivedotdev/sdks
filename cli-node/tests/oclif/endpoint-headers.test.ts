import { resolve } from "node:path";
import {
  operationManifest,
  PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createOperationCommand } from "../../src/oclif/api-command.js";
import {
  endpointWarningLines,
  headersBodyFields,
  headersNeedUrl,
  parseHeaderFlags,
} from "../../src/oclif/endpoint-headers.js";

const auth = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: auth.create,
}));

const ENDPOINT_ID = "c4a9e1b7-3d28-4f60-b915-8e2c7a0d6f31";
const URL_STORED = "https://hooks.example.test/primitive?team=1";
const SECRET = "s3cret-token-value";

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

function endpointRow(extra: Record<string, unknown> = {}) {
  return {
    id: ENDPOINT_ID,
    org_id: "11111111-1111-4111-8111-111111111111",
    kind: "http",
    url: URL_STORED,
    enabled: true,
    rules: {},
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    delivery_count: 0,
    success_count: 0,
    failure_count: 0,
    consecutive_fails: 0,
    ...extra,
  };
}

function command(sdkName: string) {
  const operation = operationManifest.find((op) => op.sdkName === sdkName);
  if (!operation) throw new Error(`missing operation ${sdkName}`);
  return createOperationCommand(operation) as unknown as {
    run(argv: string[], opts: { root: string }): Promise<void>;
    flags: Record<string, unknown>;
  };
}

const root = resolve(import.meta.dirname, "../..");

afterEach(() => {
  vi.restoreAllMocks();
  auth.create.mockReset();
  process.exitCode = undefined;
});

describe("parseHeaderFlags", () => {
  it("splits at the first colon and trims the name and value", () => {
    expect(
      parseHeaderFlags(["Authorization: Bearer a:b", "X-Api-Key:abc "]),
    ).toEqual([
      { name: "Authorization", value: "Bearer a:b" },
      { name: "X-Api-Key", value: "abc" },
    ]);
  });

  it.each([
    [SECRET, /--header 1 has no colon/],
    [`: ${SECRET}`, /--header 1 has no name/],
    [`Bad Name: ${SECRET}`, /cannot hold spaces/],
    ["X-Empty:  ", /--header 1 \(X-Empty\) has no value/],
    [`X-Line: a\n${SECRET}`, /control characters/],
  ])("refuses %j without repeating the value", (given, message) => {
    let thrown: unknown;
    try {
      parseHeaderFlags([given]);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({ oclif: { exit: 2 } });
    expect(String((thrown as Error).message)).toMatch(message);
    expect(String((thrown as Error).message)).not.toContain(SECRET);
  });

  it("refuses a name given twice, in any case", () => {
    expect(() => parseHeaderFlags(["X-Key: a", `x-key: ${SECRET}`])).toThrow(
      /--header 2: x-key is given more than once/,
    );
  });
});

describe("headersBodyFields and headersNeedUrl", () => {
  it("sets headers from --header, [] from --clear-headers, and nothing otherwise", () => {
    expect(headersBodyFields({ header: ["A: 1"] })).toEqual([
      {
        flag: "--header",
        property: "headers",
        value: [{ name: "A", value: "1" }],
      },
    ]);
    expect(headersBodyFields({ "clear-headers": true })).toEqual([
      { flag: "--clear-headers", property: "headers", value: [] },
    ]);
    expect(headersBodyFields({})).toEqual([]);
  });

  it("asks for the URL only for a non-empty list without one", () => {
    expect(headersNeedUrl({ headers: [{ name: "A", value: "1" }] })).toBe(true);
    expect(
      headersNeedUrl({
        headers: [{ name: "A", value: "1" }],
        url: "https://x",
      }),
    ).toBe(false);
    expect(headersNeedUrl({ headers: [] })).toBe(false);
    expect(headersNeedUrl({ enabled: true })).toBe(false);
  });
});

describe("endpointWarningLines", () => {
  it("prints each warning's message, else its code", () => {
    expect(
      endpointWarningLines({
        warnings: [
          {
            code: "url_requires_login",
            status: 401,
            message: "The URL answered 401:\nit appears to require a login.",
          },
          { code: "url_not_checked" },
        ],
      }),
    ).toEqual([
      "Warning: The URL answered 401: it appears to require a login.",
      "Warning: url_not_checked",
    ]);
    expect(endpointWarningLines({})).toEqual([]);
  });
});

describe("endpoints create/update --header", () => {
  it("is offered on create and update, and --clear-headers on update only", () => {
    expect(command("createEndpoint").flags.header).toBeDefined();
    expect(command("updateEndpoint").flags.header).toBeDefined();
    expect(command("createEndpoint").flags["clear-headers"]).toBeUndefined();
    expect(command("updateEndpoint").flags["clear-headers"]).toBeDefined();
  });

  it("sends the headers on create and prints the login warning after the JSON", async () => {
    const calls = fixture({
      body: {
        success: true,
        data: {
          ...endpointRow(),
          warnings: [
            {
              code: "url_requires_login",
              status: 302,
              message: "The URL appears to require a login (it answered 302).",
            },
          ],
        },
      },
    });
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    await command("createEndpoint").run(
      ["--url", URL_STORED, "--header", `Authorization: Bearer ${SECRET}`],
      { root },
    );
    expect(calls[0]?.body).toMatchObject({
      url: URL_STORED,
      headers: [{ name: "Authorization", value: `Bearer ${SECRET}` }],
    });
    const printed = stderr.mock.calls.map(([chunk]) => String(chunk)).join("");
    expect(printed).toContain(
      "Warning: The URL appears to require a login (it answered 302).",
    );
    expect(printed).not.toContain(SECRET);
  });

  it("reads the webhook's URL and sends it with the headers on update without --url", async () => {
    const calls = fixture(
      { body: { success: true, data: endpointRow() } },
      { body: { success: true, data: endpointRow() } },
    );
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    await command("updateEndpoint").run(
      ["--id", ENDPOINT_ID, "--header", "X-Api-Key: abc"],
      { root },
    );
    expect(calls.map((call) => call.method)).toEqual(["GET", "PATCH"]);
    expect(calls[0]?.url.pathname).toBe(`/v1/endpoints/${ENDPOINT_ID}`);
    expect(calls[1]?.body).toEqual({
      url: URL_STORED,
      headers: [{ name: "X-Api-Key", value: "abc" }],
    });
  });

  it("does not read the endpoint when --url is given, or for --clear-headers", async () => {
    const calls = fixture(
      { body: { success: true, data: endpointRow() } },
      { body: { success: true, data: endpointRow() } },
    );
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    await command("updateEndpoint").run(
      [
        "--id",
        ENDPOINT_ID,
        "--url",
        "https://new.example.test/h",
        "--header",
        "A: 1",
      ],
      { root },
    );
    await command("updateEndpoint").run(
      ["--id", ENDPOINT_ID, "--clear-headers"],
      { root },
    );
    expect(calls.map((call) => call.method)).toEqual(["PATCH", "PATCH"]);
    expect(calls[0]?.body).toEqual({
      url: "https://new.example.test/h",
      headers: [{ name: "A", value: "1" }],
    });
    expect(calls[1]?.body).toEqual({ headers: [] });
  });

  it("refuses with exit 2 when the URL cannot be read, and sends nothing", async () => {
    const calls = fixture({
      body: { success: false, error: { code: "internal_error", message: "x" } },
      status: 500,
    });
    await expect(
      command("updateEndpoint").run(
        ["--id", ENDPOINT_ID, "--header", `A: ${SECRET}`],
        { root },
      ),
    ).rejects.toMatchObject({ oclif: { exit: 2 } });
    expect(calls.map((call) => call.method)).toEqual(["GET"]);
  });

  it("refuses headers on an endpoint that is not a webhook", async () => {
    const calls = fixture({
      body: {
        success: true,
        data: endpointRow({ kind: "function", url: null }),
      },
    });
    await expect(
      command("updateEndpoint").run(["--id", ENDPOINT_ID, "--header", "A: 1"], {
        root,
      }),
    ).rejects.toThrow(/only for webhooks/);
    expect(calls).toHaveLength(1);
  });

  it("refuses --clear-headers with --header without printing the value", async () => {
    const calls = fixture();
    let thrown: unknown;
    try {
      await command("updateEndpoint").run(
        [
          "--id",
          ENDPOINT_ID,
          "--clear-headers",
          "--header",
          `Authorization: Bearer ${SECRET}`,
        ],
        { root },
      );
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({ oclif: { exit: 2 } });
    expect(String((thrown as Error).message)).toMatch(
      /cannot go with --header/,
    );
    expect(String((thrown as Error).message)).not.toContain(SECRET);
    expect(calls).toEqual([]);
  });

  it("keeps a turned-off webhook off when it sends the URL for headers", async () => {
    const calls = fixture(
      { body: { success: true, data: endpointRow({ enabled: false }) } },
      { body: { success: true, data: endpointRow({ enabled: false }) } },
    );
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    await command("updateEndpoint").run(
      ["--id", ENDPOINT_ID, "--header", "A: 1"],
      { root },
    );
    expect(calls[1]?.body).toEqual({
      url: URL_STORED,
      enabled: false,
      headers: [{ name: "A", value: "1" }],
    });
  });

  it("says the endpoint was not found, exit 1, on a 404 read", async () => {
    const calls = fixture({
      body: { success: false, error: { code: "not_found", message: "x" } },
      status: 404,
    });
    await expect(
      command("updateEndpoint").run(
        ["--id", ENDPOINT_ID, "--header", `A: ${SECRET}`],
        { root },
      ),
    ).rejects.toMatchObject({
      oclif: { exit: 1 },
      message: expect.stringMatching(/No endpoint .* was found/),
    });
    expect(calls.map((call) => call.method)).toEqual(["GET"]);
  });
});
