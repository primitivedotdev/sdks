import { resolve } from "node:path";
import {
  operationManifest,
  PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createOperationCommand } from "../../src/oclif/api-command.js";
import {
  endpointsWithQueryHidden,
  errorWithQueryHidden,
  HIDDEN_QUERY_NOTE,
  hiddenQueryUrlRefusal,
  urlWithQueryHidden,
} from "../../src/oclif/endpoint-url-shown.js";

const auth = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: auth.create,
}));

const ENDPOINT_ID = "c4a9e1b7-3d28-4f60-b915-8e2c7a0d6f31";
const SECRET_URL =
  "https://hooks.example.test/api/primitive?x-protection-bypass=s3cr3t-value";
const SHOWN_URL = "https://hooks.example.test/api/primitive?... (query hidden)";

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
  auth.create.mockResolvedValue({
    apiClient: new PrimitiveApiClient({
      apiKey: "test-key",
      apiBaseUrl: "https://api.example.test/v1",
      fetch,
    }),
    auth: {},
    baseUrlOverridden: false,
  });
  return calls;
}

function endpointRow(url: string | null, extra: Record<string, unknown> = {}) {
  return {
    id: ENDPOINT_ID,
    org_id: "11111111-1111-4111-8111-111111111111",
    url,
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

const root = resolve(import.meta.dirname, "../..");

async function run(sdkName: string, argv: string[]) {
  const operation = operationManifest.find((op) => op.sdkName === sdkName);
  if (!operation) throw new Error(`missing operation ${sdkName}`);
  const Cmd = createOperationCommand(operation) as unknown as {
    run(argv: string[], opts: { root: string }): Promise<void>;
  };
  const stdout: string[] = [];
  const stderr: string[] = [];
  vi.spyOn(console, "log").mockImplementation((line = "") => {
    stdout.push(`${String(line)}\n`);
  });
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    stdout.push(String(chunk));
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    stderr.push(String(chunk));
    return true;
  });
  let error: unknown = null;
  try {
    await Cmd.run(argv, { root });
  } catch (caught) {
    error = caught;
  }
  const exitCode = process.exitCode;
  vi.restoreAllMocks();
  return {
    error,
    exitCode,
    stdout: stdout.join(""),
    stderr: stderr.join(""),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  auth.create.mockReset();
  process.exitCode = undefined;
});

describe("urlWithQueryHidden", () => {
  it("keeps the scheme, host and path and hides the query, and anything after it", () => {
    expect(urlWithQueryHidden(SECRET_URL)).toBe(SHOWN_URL);
    expect(urlWithQueryHidden("https://a.test/p?x=1#frag")).toBe(
      "https://a.test/p?... (query hidden)",
    );
    // An empty query is still a query: that one exists is never dropped.
    expect(urlWithQueryHidden("https://a.test/p?")).toBe(
      "https://a.test/p?... (query hidden)",
    );
  });

  it("leaves a URL with no query string as it is", () => {
    expect(urlWithQueryHidden("https://a.test/p")).toBeNull();
    // A ? inside the fragment is no query.
    expect(urlWithQueryHidden("https://a.test/p#a?b")).toBeNull();
  });
});

describe("endpointsWithQueryHidden", () => {
  it("marks each endpoint whose URL was shortened, in a list or alone, and leaves the rest", () => {
    const plain = endpointRow("https://a.test/p");
    const fn = endpointRow(null, { kind: "function" });
    const shown = endpointsWithQueryHidden([
      endpointRow(SECRET_URL),
      plain,
      fn,
    ]);
    expect(shown.hidden).toBe(true);
    expect(shown.data).toEqual([
      endpointRow(SHOWN_URL, { url_query_hidden: true }),
      plain,
      fn,
    ]);
    expect(endpointsWithQueryHidden(endpointRow(SECRET_URL))).toEqual({
      data: endpointRow(SHOWN_URL, { url_query_hidden: true }),
      hidden: true,
    });
    expect(endpointsWithQueryHidden([plain, fn])).toEqual({
      data: [plain, fn],
      hidden: false,
    });
    expect(endpointsWithQueryHidden(null)).toEqual({
      data: null,
      hidden: false,
    });
  });
});

describe("errorWithQueryHidden", () => {
  it("hides the query of every url an error names, and leaves the rest", () => {
    const error = {
      code: "conflict",
      message: "The domain already has an endpoint.",
      details: {
        holder: { id: ENDPOINT_ID, kind: "http", url: SECRET_URL },
        others: [{ url: "https://a.test/p" }],
      },
    };
    expect(errorWithQueryHidden(error)).toEqual({
      ...error,
      details: {
        holder: {
          id: ENDPOINT_ID,
          kind: "http",
          url: SHOWN_URL,
          url_query_hidden: true,
        },
        others: [{ url: "https://a.test/p" }],
      },
    });
    const network = new Error("fetch failed");
    expect(errorWithQueryHidden(network)).toBe(network);
    expect(errorWithQueryHidden("boom")).toBe("boom");
  });
});

describe("hiddenQueryUrlRefusal", () => {
  it("refuses a URL as the commands print it, and nothing else", () => {
    expect(hiddenQueryUrlRefusal({ url: SHOWN_URL })).toContain("--show-url");
    // Cut at its first space, as a terminal's word selection copies it.
    expect(
      hiddenQueryUrlRefusal({ url: "https://hooks.example.test/api?..." }),
    ).toContain("--show-url");
    expect(hiddenQueryUrlRefusal({ url: SECRET_URL })).toBeNull();
    expect(hiddenQueryUrlRefusal({ enabled: false })).toBeNull();
    expect(hiddenQueryUrlRefusal(undefined)).toBeNull();
  });
});

describe("the endpoint commands' URLs", () => {
  it("get hides the query string by default and says so on stderr", async () => {
    fixture({ body: { success: true, data: endpointRow(SECRET_URL) } });
    const result = await run("getEndpoint", [ENDPOINT_ID]);
    expect(result.exitCode).toBeUndefined();
    expect(result.stdout).not.toContain("s3cr3t");
    expect(JSON.parse(result.stdout)).toEqual(
      endpointRow(SHOWN_URL, { url_query_hidden: true }),
    );
    expect(result.stderr).toContain(HIDDEN_QUERY_NOTE);
  });

  it("get --json hides it too, with the marker and nothing on stderr", async () => {
    fixture({ body: { success: true, data: endpointRow(SECRET_URL) } });
    const result = await run("getEndpoint", [ENDPOINT_ID, "--json"]);
    expect(JSON.parse(result.stdout)).toMatchObject({
      url: SHOWN_URL,
      url_query_hidden: true,
    });
    expect(result.stdout).not.toContain("s3cr3t");
    expect(result.stderr).toBe("");
  });

  it("get --show-url prints the URL in full, without the marker or the note", async () => {
    fixture({ body: { success: true, data: endpointRow(SECRET_URL) } });
    const result = await run("getEndpoint", [
      ENDPOINT_ID,
      "--show-url",
      "--json",
    ]);
    const printed = JSON.parse(result.stdout);
    expect(printed.url).toBe(SECRET_URL);
    expect(printed).not.toHaveProperty("url_query_hidden");
    expect(result.stderr).not.toContain(HIDDEN_QUERY_NOTE);
  });

  it("list hides each row's query string, and --envelope carries the note in its summary", async () => {
    const page = {
      success: true,
      data: [endpointRow(SECRET_URL), endpointRow("https://a.test/p")],
      meta: { cursor: null },
    };
    fixture({ body: page });
    const listed = await run("listEndpoints", []);
    const rows = JSON.parse(listed.stdout);
    expect(rows.map((row: { url: string }) => row.url)).toEqual([
      SHOWN_URL,
      "https://a.test/p",
    ]);
    expect(rows[1]).not.toHaveProperty("url_query_hidden");
    expect(listed.stdout).not.toContain("s3cr3t");

    fixture({ body: page });
    const enveloped = await run("listEndpoints", ["--json", "--envelope"]);
    const document = JSON.parse(enveloped.stdout);
    expect(document.data[0].url).toBe(SHOWN_URL);
    expect(document.summary).toContain(HIDDEN_QUERY_NOTE);
    expect(enveloped.stdout).not.toContain("s3cr3t");
  });

  it("an answer with no query string prints as it was, with no note", async () => {
    fixture({
      body: { success: true, data: endpointRow("https://a.test/p") },
    });
    const result = await run("getEndpoint", [ENDPOINT_ID]);
    expect(JSON.parse(result.stdout)).toEqual(endpointRow("https://a.test/p"));
    expect(result.stderr).not.toContain(HIDDEN_QUERY_NOTE);
  });

  it("create and update hide the URL they answer with, though the caller sent it", async () => {
    const calls = fixture({
      body: { success: true, data: endpointRow(SECRET_URL) },
    });
    const created = await run("createEndpoint", ["--url", SECRET_URL]);
    expect(calls[0]?.body).toEqual({ url: SECRET_URL });
    expect(JSON.parse(created.stdout).url).toBe(SHOWN_URL);
    expect(created.stdout).not.toContain("s3cr3t");

    const updates = fixture({
      body: {
        success: true,
        data: endpointRow(SECRET_URL, { warnings: [] }),
      },
    });
    const updated = await run("updateEndpoint", [
      ENDPOINT_ID,
      "--url",
      SECRET_URL,
    ]);
    expect(updates[0]?.body).toEqual({ url: SECRET_URL });
    expect(JSON.parse(updated.stdout)).toMatchObject({
      url: SHOWN_URL,
      url_query_hidden: true,
      warnings: [],
    });
  });

  it("an error that names another endpoint's URL hides its query, in text and --json, unless --show-url", async () => {
    const conflict = {
      status: 409,
      body: {
        success: false,
        error: {
          code: "conflict",
          message: "This domain already has an endpoint.",
          details: {
            holder: { id: ENDPOINT_ID, kind: "http", url: SECRET_URL },
          },
        },
      },
    };
    for (const argv of [
      ["--url", "https://new.example.test/hook"],
      ["--url", "https://new.example.test/hook", "--json"],
    ]) {
      fixture(conflict);
      const result = await run("createEndpoint", argv);
      expect(result.exitCode).toBe(1);
      const printed = `${result.stdout}${result.stderr}`;
      expect(printed).toContain("conflict");
      expect(printed).toContain("?... (query hidden)");
      expect(printed).not.toContain("s3cr3t");
    }
    fixture(conflict);
    const shown = await run("createEndpoint", [
      "--url",
      "https://new.example.test/hook",
      "--show-url",
    ]);
    expect(`${shown.stdout}${shown.stderr}`).toContain(SECRET_URL);
  });

  it("create and update refuse a URL as these commands print it before reading a credential, sending nothing", async () => {
    for (const [sdkName, argv] of [
      ["createEndpoint", ["--url", SHOWN_URL]],
      ["updateEndpoint", [ENDPOINT_ID, "--url", SHOWN_URL]],
      [
        "updateEndpoint",
        [ENDPOINT_ID, "--raw-body", JSON.stringify({ url: SHOWN_URL })],
      ],
      // Before the endpoint's rules are read for --event-types.
      [
        "updateEndpoint",
        [
          ENDPOINT_ID,
          "--url",
          "https://hooks.example.test/api/primitive?...",
          "--event-types",
          "email.received",
        ],
      ],
    ] as const) {
      const calls = fixture();
      auth.create.mockClear();
      const result = await run(sdkName, [...argv]);
      expect(calls).toHaveLength(0);
      // Refused before any credential is read, so no refresh is sent either.
      expect(auth.create).not.toHaveBeenCalled();
      expect(String((result.error as Error | null)?.message)).toContain(
        "--show-url",
      );
      expect((result.error as { oclif?: { exit?: number } }).oclif?.exit).toBe(
        2,
      );
    }
  });
});
