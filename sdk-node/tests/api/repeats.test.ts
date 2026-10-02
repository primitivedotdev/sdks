import { describe, expect, it, vi } from "vitest";
import {
  type PrimitiveApiError,
  PrimitiveClient,
  type ReceivedEmail,
} from "../../src/index.js";

const REPEAT_ID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const EMAIL_ID = "00000000-0000-4000-8000-000000000001";
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
  sent_count: 1,
};
const SEND_RESULT = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "queued",
  from: "owner@example.com",
  queue_id: null,
  accepted: [],
  rejected: [],
  client_idempotency_key: "k",
  request_id: "r",
  content_hash: "h",
  idempotent_replay: false,
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

type Call = { method: string; path: string; body: unknown };

function recorder(respond: (call: Call) => Response) {
  const calls: Call[] = [];
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    const text = await request.text();
    const call = {
      method: request.method,
      path: `${url.pathname}${url.search}`,
      body: text ? JSON.parse(text) : null,
    };
    calls.push(call);
    return respond(call);
  });
  return { calls, fetchMock };
}

describe("repeating sends", () => {
  it("sends with repeat and returns the repeat id", async () => {
    const { calls, fetchMock } = recorder(() =>
      json({ success: true, data: { ...SEND_RESULT, repeat_id: REPEAT_ID } }),
    );
    const result = await clientWith(fetchMock).send({
      from: "owner@example.com",
      to: "agent@example.com",
      subject: "Check in",
      bodyText: "Any progress?",
      repeat: {
        everyMinutes: 30,
        onlyIfRecipientIdleMinutes: 15,
        stoppableByRecipient: false,
        maxSends: 10,
        until: "2026-10-09T00:00:00.000Z",
      },
    });
    expect(result.repeatId).toBe(REPEAT_ID);
    expect(calls[0]?.path).toBe("/v1/send-mail");
    expect(calls[0]?.body).toMatchObject({
      repeat: {
        every_minutes: 30,
        only_if_recipient_idle_minutes: 15,
        stoppable_by_recipient: false,
        max_sends: 10,
        until: "2026-10-09T00:00:00.000Z",
      },
    });
  });

  it("omits repeatId and repeat when not repeating", async () => {
    const { calls, fetchMock } = recorder(() =>
      json({ success: true, data: SEND_RESULT }),
    );
    const result = await clientWith(fetchMock).send({
      from: "owner@example.com",
      to: "agent@example.com",
      subject: "Once",
      bodyText: "Hi",
    });
    expect(result.repeatId).toBeUndefined();
    expect(calls[0]?.body).not.toHaveProperty("repeat");
  });

  it("replies with repeat", async () => {
    const { calls, fetchMock } = recorder(() =>
      json({ success: true, data: { ...SEND_RESULT, repeat_id: REPEAT_ID } }),
    );
    const result = await clientWith(fetchMock).reply(
      { id: EMAIL_ID } as ReceivedEmail,
      { text: "Still on it?", repeat: { everyMinutes: 60 } },
    );
    expect(result.repeatId).toBe(REPEAT_ID);
    expect(calls[0]).toEqual({
      method: "POST",
      path: `/v1/emails/${EMAIL_ID}/reply`,
      body: { body_text: "Still on it?", repeat: { every_minutes: 60 } },
    });
  });

  it("lists, gets, pauses, resumes, cancels and deletes", async () => {
    const { calls, fetchMock } = recorder((call) => {
      if (call.method === "GET" && call.path.startsWith("/v1/repeating-sends?"))
        return json({ success: true, data: [REPEAT] });
      if (call.method === "PATCH")
        return json({
          success: true,
          data: { ...REPEAT, ...(call.body as object) },
        });
      if (call.method === "DELETE")
        return json({ success: true, data: { deleted: true } });
      return json({ success: true, data: REPEAT });
    });
    const client = clientWith(fetchMock);
    await expect(
      client.repeats.list({ to: "agent@example.com", status: "active" }),
    ).resolves.toEqual([REPEAT]);
    await expect(client.repeats.get(REPEAT_ID)).resolves.toEqual(REPEAT);
    await expect(client.repeats.pause(REPEAT_ID)).resolves.toMatchObject({
      status: "paused",
    });
    await expect(client.repeats.resume(REPEAT_ID)).resolves.toMatchObject({
      status: "active",
    });
    await expect(client.repeats.cancel(REPEAT_ID)).resolves.toMatchObject({
      status: "canceled",
    });
    await expect(client.repeats.delete(REPEAT_ID)).resolves.toEqual({
      deleted: true,
    });
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
        ["DELETE", `/v1/repeating-sends/${REPEAT_ID}`, null],
      ],
    );
  });

  it("stops a repeat through the repeat-stop endpoint", async () => {
    const stopped = {
      repeat_id: REPEAT_ID,
      status: "stopped_by_recipient",
      stopped_at: "2026-10-02T12:30:00.000Z",
      stop_reason: "Report is done",
      reply_sent_email_id: "22222222-2222-4222-8222-222222222222",
    };
    const { calls, fetchMock } = recorder(() =>
      json({ success: true, data: stopped }),
    );
    const client = clientWith(fetchMock);
    await expect(
      client.repeats.stop(EMAIL_ID, { reason: "  Report is done " }),
    ).resolves.toEqual(stopped);
    await client.repeats.stop(EMAIL_ID);
    expect(calls).toEqual([
      {
        method: "POST",
        path: `/v1/emails/${EMAIL_ID}/repeat-stop`,
        body: { reason: "Report is done" },
      },
      { method: "POST", path: `/v1/emails/${EMAIL_ID}/repeat-stop`, body: {} },
    ]);
  });

  it("validates ids and reasons before sending", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const client = clientWith(fetchMock);
    await expect(client.repeats.stop("not-a-uuid")).rejects.toThrow(TypeError);
    await expect(
      client.repeats.stop(EMAIL_ID, { reason: "x".repeat(281) }),
    ).rejects.toThrow(TypeError);
    await expect(client.repeats.pause("../emails")).rejects.toThrow(TypeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces API errors", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      json(
        {
          success: false,
          error: {
            code: "repeat_recipient_external",
            message: "Repeats are limited to your organization",
          },
        },
        403,
      ),
    );
    const error = (await clientWith(fetchMock)
      .send({
        from: "owner@example.com",
        to: "someone@elsewhere.test",
        subject: "Hi",
        bodyText: "Hi",
        repeat: { everyMinutes: 30 },
      })
      .catch((caught: unknown) => caught)) as PrimitiveApiError;
    expect(error.status).toBe(403);
    expect(error.code).toBe("repeat_recipient_external");
  });
});
