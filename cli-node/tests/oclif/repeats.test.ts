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

import {
  formatRepeat,
  RepeatStopCommand,
  RepeatsListCommand,
} from "../../src/oclif/commands/repeats.js";
import { COMMANDS } from "../../src/oclif/index.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");
const EMAIL_ID = "22222222-2222-4222-8222-222222222222";
const REPEAT_ID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const REPEAT = {
  id: REPEAT_ID,
  org_id: "33333333-3333-4333-8333-333333333333",
  from_address: "owner@example.com",
  to_address: "agent@example.com",
  subject: "Check in",
  body_text: "Any progress?",
  every_minutes: 30,
  only_if_recipient_idle_minutes: 15,
  stoppable_by_recipient: true,
  max_sends: null,
  until: null,
  status: "active",
  next_run_at: "2026-10-02T12:00:00.000Z",
  sent_count: 2,
  last_sent_at: null,
  last_sent_email_id: null,
  root_message_id: null,
  stopped_at: null,
  stop_reason: null,
  created_at: "2026-10-02T11:00:00.000Z",
  updated_at: "2026-10-02T11:30:00.000Z",
};

type Call = { method: string; path: string; body: unknown };
let calls: Call[] = [];
let respond: (call: Call) => Response;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

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
  return {
    exitCode,
    stdout: stdout.join(""),
    stderr: stderr.join(""),
    thrown,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  calls = [];
  respond = () => json({ success: true, data: REPEAT });
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

describe("repeat command registration", () => {
  it("registers the recipient and sender commands next to the generated ones", () => {
    expect(COMMANDS["repeat:stop"]).toBe(RepeatStopCommand);
    expect(COMMANDS["repeats:list"]).toBe(RepeatsListCommand);
    for (const id of [
      "repeats:get",
      "repeats:pause",
      "repeats:resume",
      "repeats:cancel",
      "repeating-sends:stop-repeat-from-email",
      "repeating-sends:delete-repeating-send",
    ])
      expect(COMMANDS[id]).toBeDefined();
    expect(
      operationManifest.find((op) => op.operationId === "stopRepeatFromEmail"),
    ).toMatchObject({ method: "POST", path: "/emails/{id}/repeat-stop" });
  });
});

describe("primitive repeat stop", () => {
  const stopped = {
    repeat_id: REPEAT_ID,
    status: "stopped_by_recipient",
    stopped_at: "2026-10-02T12:30:00.000Z",
    stop_reason: "Report is done",
    reply_sent_email_id: "55555555-5555-4555-8555-555555555555",
  };

  it("posts the reason to the repeat-stop endpoint", async () => {
    respond = () => json({ success: true, data: stopped });
    const result = await run("repeat:stop", [
      "--id",
      EMAIL_ID,
      "--reason",
      "  Report is done ",
    ]);
    expect(result.exitCode).toBeUndefined();
    expect(calls).toEqual([
      {
        method: "POST",
        path: `/v1/emails/${EMAIL_ID}/repeat-stop`,
        body: { reason: "Report is done" },
      },
    ]);
    expect(result.stdout).toContain(`Stopped repeat ${REPEAT_ID}.`);
    expect(result.stdout).toContain("Reason: Report is done");
    expect(result.stdout).toContain("The sender was told in the thread");
  });

  it("sends an empty body without a reason and prints JSON", async () => {
    respond = () =>
      json({ success: true, data: { ...stopped, stop_reason: null } });
    const result = await run("repeat:stop", ["--id", EMAIL_ID, "--json"]);
    expect(calls[0]?.body).toEqual({});
    expect(JSON.parse(result.stdout)).toEqual({
      ...stopped,
      stop_reason: null,
    });
  });

  it("explains a repeat the recipient may not stop", async () => {
    respond = () =>
      json(
        {
          success: false,
          error: {
            code: "repeat_stop_not_allowed",
            message: "This repeat cannot be stopped by its recipient",
          },
        },
        403,
      );
    const result = await run("repeat:stop", ["--id", EMAIL_ID]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Run this as the recipient");
    expect(result.stderr).toContain("only the sender can stop this repeat");
  });

  it("explains an email that does not repeat", async () => {
    respond = () =>
      json(
        {
          success: false,
          error: { code: "not_a_repeating_send", message: "Not a repeat" },
        },
        422,
      );
    const result = await run("repeat:stop", ["--id", EMAIL_ID]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "Pass the id of a received message that repeats",
    );
  });

  it("rejects a bad id or reason before calling the API", async () => {
    const badId = await run("repeat:stop", ["--id", "not-an-id"]);
    expect(String(badId.thrown)).toContain("--id must be an email id");
    const longReason = await run("repeat:stop", [
      "--id",
      EMAIL_ID,
      "--reason",
      "x".repeat(281),
    ]);
    expect(String(longReason.thrown)).toContain("--reason is invalid");
    expect(calls).toEqual([]);
  });
});

describe("primitive repeats", () => {
  it("lists, gets, pauses, resumes and cancels", async () => {
    respond = (call) => {
      if (call.method === "GET" && call.path.startsWith("/v1/repeating-sends?"))
        return json({ success: true, data: [REPEAT] });
      if (call.method === "PATCH")
        return json({
          success: true,
          data: { ...REPEAT, ...(call.body as object) },
        });
      return json({ success: true, data: REPEAT });
    };
    const list = await run("repeats:list", [
      "--to",
      "agent@example.com",
      "--status",
      "active",
    ]);
    expect(list.stdout).toContain(`${REPEAT_ID}  active  every 30 min`);
    await run("repeats:get", [REPEAT_ID]);
    const pause = await run("repeats:pause", [REPEAT_ID]);
    expect(pause.stdout).toContain("  paused  ");
    await run("repeats:resume", [REPEAT_ID]);
    const cancel = await run("repeats:cancel", [REPEAT_ID]);
    expect(cancel.stdout).toContain("  canceled  ");
    expect(calls.map(({ method, path, body }) => [method, path, body])).toEqual(
      [
        [
          "GET",
          "/v1/repeating-sends?to=agent%40example.com&status=active",
          null,
        ],
        ["GET", `/v1/repeating-sends/${REPEAT_ID}`, null],
        ["PATCH", `/v1/repeating-sends/${REPEAT_ID}`, { status: "paused" }],
        ["PATCH", `/v1/repeating-sends/${REPEAT_ID}`, { status: "active" }],
        ["PATCH", `/v1/repeating-sends/${REPEAT_ID}`, { status: "canceled" }],
      ],
    );
  });

  it("prints an empty list plainly and lists without filters", async () => {
    respond = () => json({ success: true, data: [] });
    const result = await run("repeats:list", []);
    expect(result.stdout).toContain("No repeats.");
    expect(calls[0]?.path).toBe("/v1/repeating-sends");
  });

  it("formats limits and a recipient stop with its untrusted reason", () => {
    const line = formatRepeat({
      ...REPEAT,
      status: "stopped_by_recipient",
      stop_reason: "done",
      max_sends: 10,
      until: "2026-10-09T17:00:00.000Z",
      stoppable_by_recipient: false,
    } as never);
    expect(line).toContain("sent 2/10");
    expect(line).toContain("until 2026-10-09T17:00:00.000Z");
    expect(line).toContain("sender-only stop");
    expect(line).toContain(
      'stopped by recipient (recipient-written reason): "done"',
    );
  });
});
