// The endpoint commands print a webhook's URL exactly as the API stores it,
// with or without --json, in answers and in errors, and send a URL as given.
import { resolve } from "node:path";
import {
  operationManifest,
  PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createOperationCommand } from "../../src/oclif/api-command.js";

const auth = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: auth.create,
}));

const ENDPOINT_ID = "c4a9e1b7-3d28-4f60-b915-8e2c7a0d6f31";
const QUERY_URL =
  "https://hooks.example.test/api/primitive?x-protection-bypass=s3cr3t-value";

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

/** The JSON document stdout holds, with or without --json. */
function printed(stdout: string): unknown {
  return JSON.parse(stdout);
}

describe("the endpoint commands print a webhook URL as stored", () => {
  for (const mode of [[], ["--json"]] as const) {
    const label = mode.length > 0 ? "with --json" : "without --json";

    it(`get and list print the URL with its query string, ${label}`, async () => {
      fixture({ body: { success: true, data: endpointRow(QUERY_URL) } });
      const got = await run("getEndpoint", [ENDPOINT_ID, ...mode]);
      expect(got.error).toBeNull();
      expect(printed(got.stdout)).toEqual(endpointRow(QUERY_URL));
      expect(got.stderr).not.toContain("query string is hidden");

      fixture({
        body: {
          success: true,
          data: [endpointRow(QUERY_URL), endpointRow("https://a.test/p")],
          meta: { cursor: null },
        },
      });
      const listed = await run("listEndpoints", [...mode]);
      expect(listed.error).toBeNull();
      expect(listed.stdout).toContain("s3cr3t-value");
      const rows = printed(listed.stdout) as { url: string }[];
      expect(rows.map((row) => row.url)).toEqual([
        QUERY_URL,
        "https://a.test/p",
      ]);
    });

    it(`create and update send the URL as given and print it as answered, ${label}`, async () => {
      const placeholder = "https://hooks.example.test/api?... (query hidden)";
      for (const [sdkName, argv, sent] of [
        ["createEndpoint", ["--url", QUERY_URL], QUERY_URL],
        ["createEndpoint", ["--url", placeholder], placeholder],
        ["updateEndpoint", [ENDPOINT_ID, "--url", QUERY_URL], QUERY_URL],
      ] as const) {
        const calls = fixture({
          body: { success: true, data: endpointRow(sent) },
        });
        const result = await run(sdkName, [...argv, ...mode]);
        expect(result.error, sdkName).toBeNull();
        expect(calls[0]?.body, sdkName).toEqual({ url: sent });
        expect((printed(result.stdout) as { url: string }).url, sdkName).toBe(
          sent,
        );
      }
    });

    it(`an error that names an endpoint's URL prints it as the API sent it, ${label}`, async () => {
      fixture({
        status: 409,
        body: {
          success: false,
          error: {
            code: "conflict",
            message: "This domain already has an endpoint.",
            details: {
              holder: { id: ENDPOINT_ID, kind: "http", url: QUERY_URL },
            },
          },
        },
      });
      const result = await run("createEndpoint", [
        "--url",
        "https://new.example.test/hook",
        ...mode,
      ]);
      expect(result.exitCode).toBe(1);
      expect(`${result.stdout}${result.stderr}`).toContain(QUERY_URL);
    });
  }

  it("takes no --show-url", () => {
    for (const sdkName of [
      "getEndpoint",
      "listEndpoints",
      "createEndpoint",
      "updateEndpoint",
    ]) {
      const operation = operationManifest.find((op) => op.sdkName === sdkName);
      if (!operation) throw new Error(`missing operation ${sdkName}`);
      const Cmd = createOperationCommand(operation) as unknown as {
        flags: Record<string, unknown>;
      };
      expect(Cmd.flags["show-url"], sdkName).toBeUndefined();
    }
  });
});
