import { resolve } from "node:path";
import {
  operationManifest,
  PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthenticatedCliApiClient: vi.fn(),
}));

vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: mocks.createAuthenticatedCliApiClient,
}));

import SentCancelCommand, {
  formatCanceledSend,
  NOT_SCHEDULED_HINT,
} from "../../src/oclif/commands/sent-cancel.js";
import {
  assertFromVerifiedRows,
  FromVerifiedFilterUnsupportedError,
  fromVerifiedExpectation,
  fromVerifiedTermsInQuery,
} from "../../src/oclif/from-verified-filter.js";
import { COMMANDS } from "../../src/oclif/index.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");
const SEND_ID = "7f9c24e8-3b1a-4b6e-9c11-0d5f8a2e6c3d";
const CANCELED = {
  id: SEND_ID,
  status: "canceled",
  scheduled_at: "2026-10-21T09:00:00.000Z",
  canceled_at: "2026-10-20T12:00:00.000Z",
  client_idempotency_key: "order-42",
};

type Call = { method: string; path: string; body: unknown };
let calls: Call[] = [];
let respond: (call: Call) => Response;

type Runnable = {
  run(argv: string[], options: { root: string }): Promise<unknown>;
};

async function run(id: string, argv: string[]) {
  const command = COMMANDS[id] as unknown as Runnable;
  const stdout: string[] = [];
  const stderr: string[] = [];
  const previous = process.exitCode;
  process.exitCode = undefined;
  const log = vi.spyOn(console, "log").mockImplementation((message = "") => {
    stdout.push(`${String(message)}\n`);
  });
  const out = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    stdout.push(String(chunk));
    return true;
  });
  const err = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    stderr.push(String(chunk));
    return true;
  });
  let thrown: unknown;
  try {
    await command.run(argv, { root: CLI_ROOT });
  } catch (error) {
    thrown = error;
  } finally {
    log.mockRestore();
    out.mockRestore();
    err.mockRestore();
  }
  const exitCode = process.exitCode;
  process.exitCode = previous;
  return { exitCode, stdout: stdout.join(""), stderr: stderr.join(""), thrown };
}

beforeEach(() => {
  vi.clearAllMocks();
  calls = [];
  respond = () => Response.json({ success: true, data: CANCELED });
  const apiClient = new PrimitiveApiClient({
    apiKey: "fixture",
    apiBaseUrl: "https://example.test/v1",
    fetch: async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      const text = await request.text();
      const call = {
        method: request.method,
        path: `${url.pathname}${url.search}`,
        body: text ? JSON.parse(text) : null,
      };
      calls.push(call);
      return respond(call);
    },
  });
  mocks.createAuthenticatedCliApiClient.mockResolvedValue({
    apiClient,
    auth: { kind: "oauth", source: "saved" },
    baseUrlOverridden: false,
  });
});

describe("command registration", () => {
  it("registers sent cancel, the changes list alias and the generated operations", () => {
    expect(COMMANDS["sent:cancel"]).toBe(SentCancelCommand);
    for (const id of [
      "changes:list",
      "changes:list-changes",
      "sending:cancel-sent-email",
      "sending:cancel-sent-email-by-idempotency-key",
    ])
      expect(COMMANDS[id], id).toBeDefined();
    expect(
      operationManifest.find((op) => op.operationId === "listChanges"),
    ).toMatchObject({ method: "GET", path: "/changes" });
    const changes = operationManifest.find(
      (op) => op.operationId === "listChanges",
    );
    expect(changes?.queryParams.map((p) => p.name)).toEqual(
      expect.arrayContaining(["since", "wait", "limit", "expand", "address"]),
    );
    expect(
      operationManifest
        .find((op) => op.operationId === "listEmails")
        ?.queryParams.map((p) => p.name),
    ).toContain("from_verified");
  });
});

describe("primitive sent cancel", () => {
  it("cancels by idempotency key", async () => {
    const result = await run("sent:cancel", [
      "--idempotency-key",
      " order-42 ",
    ]);
    expect(result.exitCode).toBeUndefined();
    expect(calls).toEqual([
      {
        method: "POST",
        path: "/v1/sent-emails/cancel",
        body: { idempotency_key: "order-42" },
      },
    ]);
    expect(result.stdout).toContain(`Canceled ${SEND_ID}`);
    expect(result.stdout).toContain("order-42 is free to use again");
  });

  it("passes --created-before with the key, and requires the key for it", async () => {
    await run("sent:cancel", [
      "--idempotency-key",
      "order-42",
      "--created-before",
      "2026-10-20T14:00:00Z",
    ]);
    expect(calls[0]?.body).toEqual({
      idempotency_key: "order-42",
      created_before: "2026-10-20T14:00:00Z",
    });
    calls = [];
    expect(
      (
        await run("sent:cancel", [
          "--id",
          SEND_ID,
          "--created-before",
          "2026-10-20T14:00:00Z",
        ])
      ).thrown,
    ).toBeDefined();
    expect(
      (
        await run("sent:cancel", [
          "--idempotency-key",
          "k",
          "--created-before",
          "yesterday",
        ])
      ).thrown,
    ).toBeDefined();
    // A time without a zone is refused before any request.
    expect(
      (
        await run("sent:cancel", [
          "--idempotency-key",
          "k",
          "--created-before",
          "2026-10-20T14:00:00",
        ])
      ).thrown,
    ).toBeDefined();
    expect(calls).toEqual([]);
    // A numeric offset is a zone.
    await run("sent:cancel", [
      "--idempotency-key",
      "k",
      "--created-before",
      "2026-10-20T10:00:00-04:00",
    ]);
    expect(calls[0]?.body).toEqual({
      idempotency_key: "k",
      created_before: "2026-10-20T10:00:00-04:00",
    });
  });

  it("cancels by id and prints JSON", async () => {
    const result = await run("sent:cancel", ["--id", SEND_ID, "--json"]);
    expect(calls).toEqual([
      { method: "POST", path: `/v1/sent-emails/${SEND_ID}/cancel`, body: null },
    ]);
    expect(JSON.parse(result.stdout)).toEqual(CANCELED);
  });

  it("requires exactly one of --id and --idempotency-key, and a UUID id", async () => {
    expect((await run("sent:cancel", [])).thrown).toBeDefined();
    expect(
      (await run("sent:cancel", ["--id", SEND_ID, "--idempotency-key", "k"]))
        .thrown,
    ).toBeDefined();
    expect((await run("sent:cancel", ["--id", "nope"])).thrown).toBeDefined();
    expect(calls).toEqual([]);
  });

  it("exits 1 with the current status and a hint when the send is no longer scheduled", async () => {
    respond = () =>
      Response.json(
        {
          success: false,
          error: {
            code: "not_scheduled",
            message:
              "cannot cancel: this sent email is no longer scheduled (status: delivered)",
            details: { sent_email_id: SEND_ID, status: "delivered" },
          },
        },
        { status: 409 },
      );
    const result = await run("sent:cancel", ["--idempotency-key", "order-42"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("status: delivered");
    expect(result.stderr).toContain(NOT_SCHEDULED_HINT);
    expect(result.stdout).toBe("");
  });

  it("formats a send without a key", () => {
    expect(
      formatCanceledSend({
        ...CANCELED,
        client_idempotency_key: null,
      } as never),
    ).toBe(`Canceled ${SEND_ID} (was scheduled for ${CANCELED.scheduled_at})`);
  });
});

describe("from_verified filter guard", () => {
  it("reads the values a query asks for from the parameter and the q term", () => {
    expect(fromVerifiedTermsInQuery("invoice from_verified:TRUE")).toEqual([
      true,
    ]);
    expect(fromVerifiedTermsInQuery('from_verified:"false" x')).toEqual([
      false,
    ]);
    expect(fromVerifiedTermsInQuery("not_from_verified:true")).toEqual([]);
    // Filter-like text inside a quoted phrase is searched for, not applied.
    expect(
      fromVerifiedTermsInQuery('"please from_verified:true invoice" acme'),
    ).toEqual([]);
    expect(
      fromVerifiedTermsInQuery(
        '"say \\"hi\\" from_verified:true" from_verified:false',
      ),
    ).toEqual([false]);
    // Nor inside another field's quoted value, such as an exact header search.
    expect(
      fromVerifiedTermsInQuery(
        'header:"X-Note=hello from_verified:true world"',
      ),
    ).toEqual([]);
    expect(
      fromVerifiedTermsInQuery(
        'subject:"from_verified:false" from_verified:true',
      ),
    ).toEqual([true]);
    expect(
      fromVerifiedExpectation("listEmails", { from_verified: "true" }),
    ).toEqual({
      surface: "GET /emails",
      expected: [true],
    });
    expect(
      fromVerifiedExpectation("searchEmails", { q: "from_verified:false" }),
    ).toEqual({ surface: "GET /emails/search", expected: [false] });
    expect(
      fromVerifiedExpectation("listEmails", { automated: "true" }),
    ).toBeNull();
    expect(
      fromVerifiedExpectation("listSentEmails", { from_verified: "true" }),
    ).toBeNull();
  });

  it("refuses rows without the requested value, so an ignored filter never passes for an applied one", () => {
    const expectation = { surface: "GET /emails", expected: [true] };
    expect(() =>
      assertFromVerifiedRows([{ from_verified: true }], expectation),
    ).not.toThrow();
    expect(() => assertFromVerifiedRows([], expectation)).not.toThrow();
    for (const rows of [[{ from_verified: false }], [{ id: "x" }], [null]]) {
      expect(() => assertFromVerifiedRows(rows, expectation)).toThrow(
        FromVerifiedFilterUnsupportedError,
      );
    }
  });

  it("stops emails list from printing rows a server returned without the filter", async () => {
    respond = () =>
      Response.json({
        success: true,
        data: [{ id: SEND_ID, from_verified: false }],
        meta: { limit: 50, cursor: null },
      });
    const result = await run("emails:list", ["--from-verified", "true"]);
    expect(calls[0]?.path).toContain("from_verified=true");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("did not apply the `from_verified` filter");
    expect(result.stdout).not.toContain(SEND_ID);
  });
});
