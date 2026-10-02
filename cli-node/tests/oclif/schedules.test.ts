import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
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
  formatSchedule,
  ScheduleStopCommand,
  SchedulesCreateCommand,
} from "../../src/oclif/commands/schedules.js";
import { COMMANDS } from "../../src/oclif/index.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");
const EMAIL_ID = "22222222-2222-4222-8222-222222222222";
const SCHEDULE_ID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const SCHEDULE = {
  id: SCHEDULE_ID,
  org_id: "33333333-3333-4333-8333-333333333333",
  user_id: "44444444-4444-4444-8444-444444444444",
  from_address: "owner@example.com",
  agent_address: "agent@example.com",
  subject: "Scheduled message",
  body_text: "Any progress?",
  interval_minutes: 30,
  idle_minutes: 15,
  agent_can_stop: true,
  status: "active",
  next_run_at: "2026-10-02T12:00:00.000Z",
  last_sent_at: null,
  last_sent_email_id: null,
  root_message_id: null,
  sent_count: 0,
  stopped_at: null,
  stop_reason: null,
  created_at: "2026-10-02T11:59:00.000Z",
  updated_at: "2026-10-02T11:59:00.000Z",
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
  respond = () => json({ success: true, data: SCHEDULE });
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

describe("schedule command registration", () => {
  it("registers the agent and owner commands next to the generated ones", () => {
    expect(COMMANDS["schedule:stop"]).toBe(ScheduleStopCommand);
    expect(COMMANDS["schedules:create"]).toBe(SchedulesCreateCommand);
    for (const id of [
      "schedules:list",
      "schedules:get",
      "schedules:pause",
      "schedules:resume",
      "schedules:delete",
      "agent-message-schedules:stop-agent-message-schedule",
      "agent-message-schedules:create-agent-message-schedule",
    ])
      expect(COMMANDS[id]).toBeDefined();
    expect(
      operationManifest.find(
        (op) => op.operationId === "stopAgentMessageSchedule",
      ),
    ).toMatchObject({ method: "POST", path: "/emails/{id}/schedule-stop" });
  });
});

describe("primitive schedule stop", () => {
  const stopped = {
    schedule_id: SCHEDULE_ID,
    status: "stopped_by_agent",
    stopped_at: "2026-10-02T12:30:00.000Z",
    stop_reason: "Report is done",
    reply_sent_email_id: "55555555-5555-4555-8555-555555555555",
  };

  it("posts the reason to the schedule-stop endpoint", async () => {
    respond = () => json({ success: true, data: stopped });
    const result = await run("schedule:stop", [
      "--id",
      EMAIL_ID,
      "--reason",
      "  Report is done ",
    ]);
    expect(result.exitCode).toBeUndefined();
    expect(calls).toEqual([
      {
        method: "POST",
        path: `/v1/emails/${EMAIL_ID}/schedule-stop`,
        body: { reason: "Report is done" },
      },
    ]);
    expect(result.stdout).toContain(`Stopped schedule ${SCHEDULE_ID}.`);
    expect(result.stdout).toContain("Reason: Report is done");
  });

  it("sends an empty body without a reason and prints JSON", async () => {
    respond = () =>
      json({ success: true, data: { ...stopped, stop_reason: null } });
    const result = await run("schedule:stop", ["--id", EMAIL_ID, "--json"]);
    expect(calls[0]?.body).toEqual({});
    expect(JSON.parse(result.stdout)).toEqual({
      ...stopped,
      stop_reason: null,
    });
  });

  it("explains a schedule the agent may not stop", async () => {
    respond = () =>
      json(
        {
          success: false,
          error: {
            code: "schedule_stop_not_allowed",
            message: "This schedule cannot be stopped by the agent",
          },
        },
        403,
      );
    const result = await run("schedule:stop", ["--id", EMAIL_ID]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Only the schedule's owner can stop");
  });

  it("rejects a bad id or reason before calling the API", async () => {
    const badId = await run("schedule:stop", ["--id", "not-an-id"]);
    expect(String(badId.thrown)).toContain("--id must be an email id");
    const longReason = await run("schedule:stop", [
      "--id",
      EMAIL_ID,
      "--reason",
      "x".repeat(281),
    ]);
    expect(String(longReason.thrown)).toContain("--reason is invalid");
    expect(calls).toEqual([]);
  });
});

describe("primitive schedules", () => {
  it("creates a schedule from a body file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "primitive-schedules-"));
    const file = join(dir, "prompt.txt");
    writeFileSync(file, "Any progress?");
    respond = () => json({ success: true, data: SCHEDULE }, 201);
    const result = await run("schedules:create", [
      "--agent",
      "agent@example.com",
      "--every",
      "30",
      "--idle",
      "15",
      "--body-file",
      file,
    ]);
    expect(result.exitCode).toBeUndefined();
    expect(calls).toEqual([
      {
        method: "POST",
        path: "/v1/agent-message-schedules",
        body: {
          agent_address: "agent@example.com",
          body_text: "Any progress?",
          interval_minutes: 30,
          idle_minutes: 15,
          agent_can_stop: true,
        },
      },
    ]);
    expect(result.stdout).toContain("Created schedule:");
    expect(result.stdout).toContain(SCHEDULE_ID);
    rmSync(dir, { recursive: true, force: true });
  });

  it("keeps stopping to the owner with --no-agent-stop", async () => {
    await run("schedules:create", [
      "--agent",
      "agent@example.com",
      "--every",
      "60",
      "--no-agent-stop",
      "--subject",
      "Daily check",
      "--body",
      "Status?",
    ]);
    expect(calls[0]?.body).toEqual({
      agent_address: "agent@example.com",
      body_text: "Status?",
      interval_minutes: 60,
      agent_can_stop: false,
      subject: "Daily check",
    });
  });

  it("validates cadence and message before calling the API", async () => {
    const tooOften = await run("schedules:create", [
      "--agent",
      "agent@example.com",
      "--every",
      "4",
      "--body",
      "x",
    ]);
    expect(String(tooOften.thrown)).toContain("--every must be");
    const noBody = await run("schedules:create", [
      "--agent",
      "agent@example.com",
      "--every",
      "30",
    ]);
    expect(String(noBody.thrown)).toContain(
      "--body, --body-file or --body-stdin",
    );
    const twoBodies = await run("schedules:create", [
      "--agent",
      "agent@example.com",
      "--every",
      "30",
      "--body",
      "a",
      "--body-file",
      "b",
    ]);
    expect(String(twoBodies.thrown)).toContain("only one message source");
    expect(calls).toEqual([]);
  });

  it("lists, gets, pauses, resumes and deletes", async () => {
    respond = (call) => {
      if (
        call.method === "GET" &&
        call.path.startsWith("/v1/agent-message-schedules?")
      )
        return json({ success: true, data: [SCHEDULE] });
      if (call.method === "DELETE")
        return json({ success: true, data: { deleted: true } });
      if (call.method === "PATCH")
        return json({
          success: true,
          data: { ...SCHEDULE, ...(call.body as object) },
        });
      return json({ success: true, data: SCHEDULE });
    };
    const list = await run("schedules:list", ["--agent", "agent@example.com"]);
    expect(list.stdout).toContain(`${SCHEDULE_ID}  active  every 30 min`);
    await run("schedules:get", [SCHEDULE_ID]);
    const pause = await run("schedules:pause", [SCHEDULE_ID]);
    expect(pause.stdout).toContain("  paused  ");
    await run("schedules:resume", [SCHEDULE_ID]);
    const deleted = await run("schedules:delete", [SCHEDULE_ID]);
    expect(deleted.stdout).toContain(`Deleted schedule ${SCHEDULE_ID}.`);
    expect(calls.map(({ method, path, body }) => [method, path, body])).toEqual(
      [
        [
          "GET",
          "/v1/agent-message-schedules?agent_address=agent%40example.com",
          null,
        ],
        ["GET", `/v1/agent-message-schedules/${SCHEDULE_ID}`, null],
        [
          "PATCH",
          `/v1/agent-message-schedules/${SCHEDULE_ID}`,
          { status: "paused" },
        ],
        [
          "PATCH",
          `/v1/agent-message-schedules/${SCHEDULE_ID}`,
          { status: "active" },
        ],
        ["DELETE", `/v1/agent-message-schedules/${SCHEDULE_ID}`, null],
      ],
    );
  });

  it("explains the member-login requirement on 403", async () => {
    respond = () =>
      json(
        { success: false, error: { code: "forbidden", message: "Forbidden" } },
        403,
      );
    const result = await run("schedules:list", []);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("needs a member login");
  });

  it("formats an agent-stopped schedule with its untrusted reason", () => {
    expect(
      formatSchedule({
        ...SCHEDULE,
        status: "stopped_by_agent",
        stop_reason: "done",
      } as never),
    ).toContain('stopped by agent (agent-written reason): "done"');
    expect(
      formatSchedule({
        ...SCHEDULE,
        idle_minutes: null,
        agent_can_stop: false,
      } as never),
    ).toContain("every 30 min  to agent@example.com");
  });
});
