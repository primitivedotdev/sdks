import { describe, expect, it, vi } from "vitest";
import fixture from "../../../test-fixtures/local-event-receiver.json";
import { DeliveryExpired, PrimitiveClient } from "../../src/api/index.js";

const id = "11111111-1111-4111-8111-111111111111";
const raw = () => ({
  ...fixture.delivery,
  event_id: id,
  lease_expires_at: new Date(Date.now() + 60000).toISOString(),
});
const offer = (delivery: ReturnType<typeof raw> | null = raw()) => ({
  delivery,
  backlog: 0,
  gap_count: 0,
  last_gap_reason: null,
  retention_seconds: 86400,
  handler_timeout_seconds: 30,
});
function setup(
  overrides: {
    complete?: (body: unknown) => Response;
    pull?: (request: Request) => Promise<Response>;
    capabilities?: boolean;
  } = {},
) {
  const bodies: unknown[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const request = input instanceof Request ? input : new Request(input);
    const path = new URL(request.url).pathname;
    if (path.endsWith("/pull"))
      return overrides.pull
        ? overrides.pull(request)
        : Response.json({ success: true, data: offer() });
    if (path.endsWith("/complete")) {
      const body: unknown = await request.json();
      bodies.push(body);
      return (
        overrides.complete?.(body) ??
        Response.json({ success: true, data: { result: "completed" } })
      );
    }
    return Response.json({
      success: true,
      data: {
        id,
        kind: "pull",
        enabled: true,
        ...(overrides.capabilities === false
          ? {}
          : {
              receiver_capabilities: {
                completion_modes: ["sdk"],
                stream_protocols: ["primitive.events.v1"],
              },
            }),
      },
    });
  });
  return {
    client: new PrimitiveClient({ apiKey: "test", fetch }),
    fetch,
    bodies,
  };
}
const options = { subscription: "local-agent", transport: "poll" } as const;
describe("in-process events", () => {
  it("returns a delivery without acknowledging; preserves canonical identity and body", async () => {
    const { client, bodies } = setup();
    const delivery = await client.events.wait(options);
    expect(delivery?.event).toMatchObject({
      id,
      type: "future.event",
      body: '  {"value":42}\n',
      data: { value: 42 },
      headers: { Signature: "original" },
    });
    expect(bodies).toHaveLength(0);
    await expect(client.events.wait(options)).rejects.toThrow(
      "unsettled delivery",
    );
    await delivery?.ack();
    await delivery?.ack();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({
      mode: "sdk",
      accepted: true,
      queue_id: fixture.delivery.queue_id,
      lease_token: fixture.delivery.lease_token,
    });
    await expect(delivery?.retry()).rejects.toThrow("already been chosen");
  });
  it("validates before I/O and refuses unsupported servers before consuming", async () => {
    const { client, fetch } = setup({ capabilities: false });
    for (const name of fixture.invalid_names)
      await expect(
        client.events.wait({ ...options, subscription: name }),
      ).rejects.toThrow("subscription");
    await expect(
      client.events.wait({ ...options, transport: "p0ll" as "poll" }),
    ).rejects.toThrow("transport");
    expect(fetch).not.toHaveBeenCalled();
    await expect(client.events.wait(options)).rejects.toThrow(
      "does not support",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("bounds setup and waiting and returns null on timeout", async () => {
    const { client } = setup({
      pull: (request) =>
        new Promise((_, reject) =>
          request.signal.addEventListener(
            "abort",
            () => reject(request.signal.reason),
            { once: true },
          ),
        ),
    });
    expect(await client.events.wait({ ...options, timeoutMs: 25 })).toBeNull();
    expect(await client.events.wait({ ...options, timeoutMs: 25 })).toBeNull();
  });
  it("retains identical evidence across a lost receipt without rerunning the handler", async () => {
    let calls = 0;
    const { client, bodies } = setup({
      complete: () =>
        ++calls === 1
          ? Response.json({ error: { code: "unavailable" } }, { status: 503 })
          : Response.json({
              success: true,
              data: { result: "already_completed" },
            }),
    });
    const delivery = await client.events.wait(options);
    await delivery?.ack();
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toEqual(bodies[1]);
  });
  it("releases expired handles and rejects late acceptance", async () => {
    vi.useFakeTimers();
    try {
      const { client } = setup();
      const delivery = await client.events.wait(options);
      await vi.advanceTimersByTimeAsync(30001);
      expect(delivery?.signal.aborted).toBe(true);
      await expect(delivery?.ack()).rejects.toBeInstanceOf(DeliveryExpired);
      const next = await client.events.wait(options);
      await next?.retry();
    } finally {
      vi.useRealTimers();
    }
  });
  it("graceful close waits for the active handler and confirms it", async () => {
    const { client, bodies } = setup();
    let finish: () => void = () => {};
    const accepted = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const handler = vi.fn(() => accepted);
    const listener = await client.events.listen(handler, options);
    await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());
    const closing = listener.close();
    expect(bodies).toHaveLength(0);
    finish();
    await closing;
    expect(listener.status.type).toBe("closed");
    expect(bodies).toHaveLength(1);
  });
  it("cancellation aborts a pending handle and releases its subscription", async () => {
    const { client } = setup();
    const aborter = new AbortController();
    const delivery = await client.events.wait({
      ...options,
      signal: aborter.signal,
    });
    aborter.abort();
    await expect(delivery?.ack()).rejects.toMatchObject({ name: "AbortError" });
    const next = await client.events.wait(options);
    await next?.retry();
  });
});
