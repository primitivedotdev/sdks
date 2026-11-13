import { resolve } from "node:path";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthenticatedCliApiClient: vi.fn(),
}));

vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: mocks.createAuthenticatedCliApiClient,
}));

import {
  deliveringCell,
  deliveryAttemptLines,
  endpointDeliveryLines,
  routeWarningLines,
} from "../../src/oclif/answer-reports.js";
import RoutesAddCommand from "../../src/oclif/commands/routes-add.js";
import RoutesUpdateCommand from "../../src/oclif/commands/routes-update.js";
import { COMMANDS } from "../../src/oclif/index.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");
const ROUTE = "11111111-1111-4111-8111-111111111111";
const FUNCTION = "22222222-2222-4222-8222-222222222222";
const DELIVERY = "33333333-3333-4333-8333-333333333333";

function useServer(answer: () => Response) {
  const client = new PrimitiveApiClient({
    apiKey: "prim_oat_test",
    apiBaseUrl: "https://api.example.test/v1",
    fetch: (async () => answer()) as typeof fetch,
  });
  mocks.createAuthenticatedCliApiClient.mockResolvedValue({
    apiClient: client,
    auth: { apiKey: "prim_oat_test", source: "flag-or-env", credentials: null },
    baseUrlOverridden: false,
  });
}

async function run(
  command: { run(argv: string[], o: { root: string }): Promise<unknown> },
  argv: string[],
) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const previous = process.exitCode;
  process.exitCode = undefined;
  const log = vi.spyOn(console, "log").mockImplementation((line = "") => {
    stdout.push(`${String(line)}\n`);
  });
  const err = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    stderr.push(String(chunk));
    return true;
  });
  try {
    await command.run(argv, { root: CLI_ROOT });
  } finally {
    log.mockRestore();
    err.mockRestore();
  }
  const exitCode = process.exitCode;
  process.exitCode = previous;
  return { exitCode, stderr: stderr.join(""), stdout: stdout.join("") };
}

const WARNING = {
  code: "endpoint_owner_limited",
  message:
    "Its endpoint is owned by a key limited to some mail, so it delivers only what that key can read.",
};

const route = (warnings: unknown[]) => ({
  id: ROUTE,
  match_type: "exact",
  pattern: "alice@acme.example",
  function_id: FUNCTION,
  warnings,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("route warnings", () => {
  it("is one line per warning, by message, else by code", () => {
    expect(
      routeWarningLines(
        route([WARNING, { code: "owner_unchecked" }, { message: " " }, null]),
      ),
    ).toEqual([
      `Route warning: ${WARNING.message}`,
      "Route warning: owner_unchecked",
    ]);
    expect(routeWarningLines(route([]))).toEqual([]);
    expect(routeWarningLines({ id: ROUTE })).toEqual([]);
  });

  it("prints them on stderr after the route from routes add, and leaves --json to the document", async () => {
    const data = route([WARNING]);
    useServer(() => Response.json({ success: true, data }, { status: 201 }));
    const plain = await run(RoutesAddCommand, [
      "alice@acme.example",
      "--function",
      FUNCTION,
    ]);
    expect(plain.exitCode).toBeUndefined();
    expect(JSON.parse(plain.stdout)).toEqual(data);
    expect(plain.stderr).toBe(`Route warning: ${WARNING.message}\n`);

    // routes update and the generated route writes print them the same way.
    for (const [command, argv] of [
      [RoutesUpdateCommand, [ROUTE, "--priority", "5"]],
      [
        COMMANDS["routes:create-route"],
        [
          "--raw-body",
          JSON.stringify({
            match_type: "exact",
            pattern: "alice@acme.example",
            function_id: FUNCTION,
          }),
        ],
      ],
      [COMMANDS["routes:update-route"], [ROUTE, "--priority", "5"]],
    ] as const) {
      const written = await run(command as never, [...argv]);
      expect(written.exitCode, written.stderr).toBeUndefined();
      expect(written.stderr).toBe(`Route warning: ${WARNING.message}\n`);
    }

    const json = await run(RoutesAddCommand, [
      "alice@acme.example",
      "--function",
      FUNCTION,
      "--json",
    ]);
    expect(json.stderr).toBe("");
    // The route's own warnings stay as the API gave them.
    expect(JSON.parse(json.stdout)).toEqual(data);
  });
});

describe("delivery attempts", () => {
  const delivery = (attempts: unknown[]) => ({ id: DELIVERY, attempts });

  it("says what the endpoint answered each attempt, or that no answer came back", () => {
    expect(
      deliveryAttemptLines(
        delivery([
          {
            id: "a1",
            attempt_count: 1,
            status: "failed",
            last_error_code: "http_error",
            duration_ms: 40,
            created_at: "2026-11-10T10:00:00Z",
            response_status: 500,
            response_body: `{"error":\n  "boom"}${"x".repeat(200)}`,
          },
          {
            id: "a2",
            attempt_count: 2,
            status: "failed",
            last_error_code: "timeout",
            duration_ms: 10000,
            created_at: "2026-11-10T10:01:00Z",
            response_status: null,
            response_body: null,
          },
          {
            id: "a3",
            attempt_count: 3,
            status: "delivered",
            last_error_code: null,
            duration_ms: 12,
            created_at: "2026-11-10T10:05:00Z",
            response_status: 200,
            response_body: "",
          },
          // A pull endpoint's delivery has no HTTP answer.
          {
            id: "a4",
            attempt_count: 1,
            status: "delivered",
            last_error_code: null,
            duration_ms: 0,
            created_at: "2026-11-10T10:06:00Z",
            response_status: null,
            response_body: null,
          },
        ]),
      ),
    ).toEqual([
      "Attempts (4):",
      `  #1 2026-11-10T10:00:00Z failed http_error, answered HTTP 500: {"error": "boom"}${"x".repeat(100)}...`,
      "  #2 2026-11-10T10:01:00Z failed timeout, no answer recorded",
      "  #3 2026-11-10T10:05:00Z delivered, answered HTTP 200",
      "  #1 2026-11-10T10:06:00Z delivered",
    ]);
    expect(deliveryAttemptLines(delivery([]))).toEqual([]);
    expect(deliveryAttemptLines({ id: DELIVERY })).toEqual([]);
  });

  it("prints them after the delivery from get-delivery, and nothing extra under --json", async () => {
    const data = {
      id: DELIVERY,
      status: "delivered",
      // Null (a delivery pass is running now, or this kind of delivery is
      // retried on its own schedule) is printed as null, never as false.
      retry_scheduled: null,
      attempts: [
        {
          id: "a1",
          attempt_count: 1,
          status: "delivered",
          last_error_code: null,
          duration_ms: 12,
          created_at: "2026-11-10T10:05:00Z",
          response_status: 202,
          response_body: "accepted",
          retry_scheduled: null,
        },
      ],
    };
    useServer(() => Response.json({ success: true, data }));
    const command = COMMANDS["webhook-deliveries:get-delivery"] as never;
    const plain = await run(command, [DELIVERY]);
    expect(plain.exitCode).toBeUndefined();
    expect(plain.stderr).toBe(
      "Attempts (1):\n  #1 2026-11-10T10:05:00Z delivered, answered HTTP 202: accepted\n",
    );
    expect(JSON.parse(plain.stdout)).toEqual(data);
    expect(plain.stdout).not.toContain('"retry_scheduled": false');
    const json = await run(command, [DELIVERY, "--json"]);
    expect(json.stderr).toBe("");
    expect(JSON.parse(json.stdout)).toEqual(data);
  });

  it("removes terminal controls from what the endpoint answered, and cuts by character", () => {
    const ESC = "\u001b";
    const lines = deliveryAttemptLines(
      delivery([
        {
          attempt_count: 1,
          status: "failed",
          created_at: "2026-11-10T10:00:00Z",
          response_status: 500,
          response_body: `oops${ESC}[31mRED${ESC}]52;c;ZXZpbA==\u0007\nnext\u0008`,
        },
        {
          attempt_count: 2,
          status: "failed",
          created_at: "2026-11-10T10:01:00Z",
          response_status: 500,
          response_body: "\u{1F600}".repeat(130),
        },
      ]),
    );
    expect(lines[1]).toBe(
      "  #1 2026-11-10T10:00:00Z failed, answered HTTP 500: oopsRED next",
    );
    expect(lines[2]).toBe(
      `  #2 2026-11-10T10:01:00Z failed, answered HTTP 500: ${"\u{1F600}".repeat(117)}...`,
    );
  });

  it("says a record of no attempt was not sent, and counts only the attempts it shows", () => {
    expect(
      deliveryAttemptLines(
        delivery([
          {
            attempt_count: 0,
            status: "skipped_by_rules",
            created_at: "2026-11-10T10:00:00Z",
            response_status: null,
            response_body: null,
          },
          {
            attempt_count: 1,
            status: "header_confirmed",
            created_at: "2026-11-10T10:00:01Z",
            response_status: null,
            response_body: null,
          },
          "not an attempt",
          {},
        ]),
      ),
    ).toEqual([
      "Attempts (2):",
      "  2026-11-10T10:00:00Z skipped_by_rules, not sent",
      "  #1 2026-11-10T10:00:01Z header_confirmed",
    ]);
  });
});

describe("endpoints list DELIVERING", () => {
  const ENDPOINT = "44444444-4444-4444-8444-444444444444";
  const endpoint = (extra: Record<string, unknown>) => ({
    id: ENDPOINT,
    org_id: "55555555-5555-4555-8555-555555555555",
    url: "https://hooks.example.test/p",
    enabled: true,
    rules: {},
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    delivery_count: 0,
    success_count: 0,
    failure_count: 0,
    consecutive_fails: 0,
    kind: "http",
    ...extra,
  });
  const revoked = {
    delivering: false,
    reasons: [
      {
        code: "acting_owner_revoked",
        message: "Not delivered: the endpoint owner's credential was revoked.",
      },
    ],
  };

  it("reads delivery, not enabled", () => {
    expect(deliveringCell(endpoint({ delivery: revoked }))).toBe(
      "no (acting_owner_revoked)",
    );
    expect(
      deliveringCell(endpoint({ delivery: { delivering: true, reasons: [] } })),
    ).toBe("yes");
    expect(
      deliveringCell(
        endpoint({ enabled: false, delivery: { delivering: false } }),
      ),
    ).toBe("no");
    // Not checked just now, or a server that does not say.
    expect(deliveringCell(endpoint({ delivery: null }))).toBe("unknown");
    expect(deliveringCell(endpoint({}))).toBe("unknown");
    // A Function or pull endpoint has no delivery.
    expect(deliveringCell(endpoint({ kind: "function", url: null }))).toBe("-");
  });

  it("tables each endpoint's ENABLED and DELIVERING, and nothing for an empty list", () => {
    const lines = endpointDeliveryLines([
      endpoint({ delivery: revoked, name: "invoices" }),
      endpoint({
        id: "66666666-6666-4666-8666-666666666666",
        kind: "function",
        url: null,
      }),
    ]);
    expect(lines[0]).toMatch(/^ID\s+KIND\s+ENABLED\s+DELIVERING\s+NAME$/);
    expect(lines[1]).toMatch(
      new RegExp(
        `^${ENDPOINT}\\s+http\\s+yes\\s+no \\(acting_owner_revoked\\)\\s+invoices$`,
      ),
    );
    expect(lines[2]).toMatch(/\sfunction\s+yes\s+-$/);
    expect(endpointDeliveryLines([])).toEqual([]);
    expect(endpointDeliveryLines(null)).toEqual([]);
  });

  it("prints the table on stderr after the JSON without --json, and leaves --json as it was", async () => {
    const page = () =>
      Response.json({
        success: true,
        data: [endpoint({ delivery: revoked })],
        meta: { cursor: null },
      });
    useServer(page);
    const listed = await run(COMMANDS["endpoints:list-endpoints"] as never, []);
    expect(listed.exitCode).toBeUndefined();
    expect(listed.stderr).toMatch(/ENABLED\s+DELIVERING/);
    expect(listed.stderr).toContain("no (acting_owner_revoked)");
    useServer(page);
    const json = await run(COMMANDS["endpoints:list-endpoints"] as never, [
      "--json",
    ]);
    expect(json.stderr).toBe("");
    expect(JSON.parse(json.stdout)).toEqual([endpoint({ delivery: revoked })]);
  });
});
