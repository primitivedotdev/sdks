import { describe, expect, it, vi } from "vitest";
import { type PrimitiveApiError, PrimitiveClient } from "../../src/index.js";

const SCHEDULE_ID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const EMAIL_ID = "00000000-0000-4000-8000-000000000001";
const SCHEDULE = {
  id: SCHEDULE_ID,
  agent_address: "agent@example.com",
  from_address: "owner@example.com",
  subject: "Check in",
  body_text: "Any progress?",
  interval_minutes: 30,
  idle_minutes: 15,
  agent_can_stop: true,
  status: "active",
  next_run_at: "2026-10-02T12:00:00.000Z",
  sent_count: 0,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function clientWith(fetchMock: typeof fetch): PrimitiveClient {
  return new PrimitiveClient({
    apiKey: "prim_test",
    apiBaseUrl: "https://api.example.test/v1",
    fetch: fetchMock,
  });
}

describe("client.schedules", () => {
  it("lists, creates, pauses, resumes and deletes schedules", async () => {
    const calls: { method: string; path: string; body: unknown }[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      const url = new URL(request.url);
      const text = await request.text();
      calls.push({
        method: request.method,
        path: `${url.pathname}${url.search}`,
        body: text ? JSON.parse(text) : null,
      });
      if (request.method === "GET")
        return json({ success: true, data: [SCHEDULE] });
      if (request.method === "POST")
        return json({ success: true, data: SCHEDULE }, 201);
      if (request.method === "PATCH")
        return json({
          success: true,
          data: { ...SCHEDULE, ...(JSON.parse(text) as object) },
        });
      return json({ success: true, data: { deleted: true } });
    });
    const client = clientWith(fetchMock);

    await expect(
      client.schedules.list({ agentAddress: "agent@example.com" }),
    ).resolves.toEqual([SCHEDULE]);
    await expect(client.schedules.list()).resolves.toEqual([SCHEDULE]);
    await expect(
      client.schedules.create({
        agent_address: "agent@example.com",
        body_text: "Any progress?",
        interval_minutes: 30,
        idle_minutes: 15,
      }),
    ).resolves.toEqual(SCHEDULE);
    await expect(client.schedules.pause(SCHEDULE_ID)).resolves.toMatchObject({
      status: "paused",
    });
    await expect(client.schedules.resume(SCHEDULE_ID)).resolves.toMatchObject({
      status: "active",
    });
    await expect(client.schedules.delete(SCHEDULE_ID)).resolves.toEqual({
      deleted: true,
    });

    expect(calls).toEqual([
      {
        method: "GET",
        path: "/v1/agent-message-schedules?agent_address=agent%40example.com",
        body: null,
      },
      { method: "GET", path: "/v1/agent-message-schedules", body: null },
      {
        method: "POST",
        path: "/v1/agent-message-schedules",
        body: {
          agent_address: "agent@example.com",
          body_text: "Any progress?",
          interval_minutes: 30,
          idle_minutes: 15,
        },
      },
      {
        method: "PATCH",
        path: `/v1/agent-message-schedules/${SCHEDULE_ID}`,
        body: { status: "paused" },
      },
      {
        method: "PATCH",
        path: `/v1/agent-message-schedules/${SCHEDULE_ID}`,
        body: { status: "active" },
      },
      {
        method: "DELETE",
        path: `/v1/agent-message-schedules/${SCHEDULE_ID}`,
        body: null,
      },
    ]);
  });

  it("stops a schedule through the schedule-stop endpoint", async () => {
    const stopped = {
      schedule_id: SCHEDULE_ID,
      status: "stopped_by_agent",
      stopped_at: "2026-10-02T12:30:00.000Z",
      stop_reason: "Report is done",
      reply_sent_email_id: "11111111-1111-4111-8111-111111111111",
    };
    const bodies: unknown[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      const url = new URL(request.url);
      expect(request.method).toBe("POST");
      expect(url.pathname).toBe(`/v1/emails/${EMAIL_ID}/schedule-stop`);
      bodies.push(await request.json());
      return json({ success: true, data: stopped });
    });
    const client = clientWith(fetchMock);
    await expect(
      client.schedules.stop(EMAIL_ID, { reason: "  Report is done " }),
    ).resolves.toEqual(stopped);
    await client.schedules.stop(EMAIL_ID);
    expect(bodies).toEqual([{ reason: "Report is done" }, {}]);
  });

  it("gets one schedule", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = new URL((input as Request).url);
      expect(url.pathname).toBe(`/v1/agent-message-schedules/${SCHEDULE_ID}`);
      return json({ success: true, data: SCHEDULE });
    });
    await expect(
      clientWith(fetchMock).schedules.get(SCHEDULE_ID),
    ).resolves.toEqual(SCHEDULE);
  });

  it("validates ids and reasons before sending", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const client = clientWith(fetchMock);
    await expect(client.schedules.stop("not-a-uuid")).rejects.toThrow(
      TypeError,
    );
    await expect(
      client.schedules.stop(EMAIL_ID, { reason: "x".repeat(281) }),
    ).rejects.toThrow(TypeError);
    await expect(client.schedules.pause("../emails")).rejects.toThrow(
      TypeError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces API errors", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      json(
        {
          success: false,
          error: { code: "forbidden", message: "Member credentials required" },
        },
        403,
      ),
    );
    const error = (await clientWith(fetchMock)
      .schedules.list()
      .catch((caught: unknown) => caught)) as PrimitiveApiError;
    expect(error.status).toBe(403);
    expect(error.code).toBe("forbidden");
  });
});
