import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authenticate } = vi.hoisted(() => ({ authenticate: vi.fn() }));
vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: authenticate,
}));

import {
  type ListenOptions,
  listenSleep,
  runListen,
} from "../../src/oclif/listen-runner.js";
import type { ListenDelivery } from "../../src/oclif/listen-types.js";

const now = Date.parse("2026-09-09T12:00:00Z");
const delivery: ListenDelivery = {
  queue_id: "11111111-1111-4111-8111-111111111111",
  event_id: "22222222-2222-4222-8222-222222222222",
  event_type: "email.received",
  delivery_id: "33333333-3333-4333-8333-333333333333",
  lease_token: "lease-secret",
  lease_expires_at: new Date(now + 60_000).toISOString(),
  body: '{"existing":"event"}',
  headers: { "Content-Type": "application/json" },
};
type Step =
  | Response
  | Error
  | ((request: Request) => Response | Promise<Response>);
let directory: string;
let controller: AbortController;
let token: string;
let steps: Record<string, Step[]>;
let requests: Array<{
  path: string;
  body: unknown;
  authorization: string | null;
}>;
let options: ListenOptions;
const ok = (data: unknown) => Response.json({ success: true, data });
const pull = (item: ListenDelivery | null, gaps = 0, reason: unknown = null) =>
  ok({
    delivery: item,
    gap_count: gaps,
    backlog: 0,
    last_gap_reason: reason,
    retention_seconds: 86400,
    handler_timeout_seconds: 30,
  });
const apiError = (
  status: number,
  code: string,
  headers?: Record<string, string>,
) =>
  Response.json(
    {
      success: false,
      error: { code, message: "secret response must never be logged" },
    },
    { status, headers },
  );
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "primitive-listen-runner-"));
  controller = new AbortController();
  token = "token-a";
  requests = [];
  steps = {
    "/v1/account": [ok({ id: "account-a" })],
    "/v1/endpoints": [ok({ id: "endpoint-a", kind: "pull", enabled: true })],
    "/v1/endpoints/endpoint-a/pull": [pull(delivery)],
    "/v1/endpoints/endpoint-a/complete": [ok({ result: "completed" })],
  };
  const fetcher = vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      const request = new Request(input, init);
      const path = new URL(request.url).pathname;
      const text = await request.clone().text();
      requests.push({
        path,
        body: text ? JSON.parse(text) : null,
        authorization: request.headers.get("authorization"),
      });
      const step = steps[path]?.shift();
      if (step instanceof Error) throw step;
      if (typeof step === "function") return step(request);
      if (step) return step;
      throw new Error(`unexpected test request ${path}`);
    },
  );
  authenticate.mockReset().mockImplementation(async () => ({
    apiClient: new PrimitiveApiClient({
      apiKey: token,
      apiBaseUrl: "https://api.example.test/v1",
      fetch: fetcher,
    }),
    auth: { apiKey: token, apiBaseUrl: "https://api.example.test/v1" },
  }));
  options = {
    transport: "poll",
    configDir: directory,
    number: 1,
    signal: controller.signal,
    now: () => now,
    random: () => 0.5,
    sleep: vi.fn(async () => {}),
    stderr: { write: vi.fn() },
    handler: vi.fn(async () => ({
      succeeded: true,
      outcome: { mode: "exec" as const, exit_code: 0, duration_ms: 2 },
    })),
  };
});
afterEach(() => {
  controller.abort();
  rmSync(directory, { recursive: true, force: true });
});
const bodies = (suffix: string) =>
  requests
    .filter((request) => request.path.endsWith(suffix))
    .map((request) => request.body);

describe("local webhook runner", () => {
  it("acknowledges address-scoped HTTP forwarding without requesting content deletion", async () => {
    token = `pconn_${"a".repeat(64)}`;
    steps["/v1/endpoints"] = [
      ok({
        id: "endpoint-a",
        kind: "pull",
        enabled: true,
        recipient: "device@example.test",
      }),
    ];
    options.handler = vi.fn(async () => ({
      succeeded: true,
      outcome: {
        mode: "http" as const,
        status_code: 200,
        duration_ms: 1,
        confirmed: true,
      },
    }));
    expect(await runListen(options)).toBe(1);
    expect(bodies("/complete")[0]).toMatchObject({
      mode: "http",
      confirmed: false,
    });
  });

  it("listens with a connected credential without requiring account access", async () => {
    token = `pconn_${"a".repeat(64)}`;
    steps["/v1/account"] = [apiError(403, "agent_connection_scope_forbidden")];
    expect(await runListen(options)).toBe(1);
    expect(requests.some((request) => request.path === "/v1/account")).toBe(
      false,
    );
    expect(options.handler).toHaveBeenCalledWith(delivery, controller.signal);
  });

  it("registers, receives and counts only confirmed handler success using fresh authentication on every operation", async () => {
    expect(await runListen(options)).toBe(1);
    expect(authenticate).toHaveBeenCalledTimes(5);
    expect(options.handler).toHaveBeenCalledWith(delivery, controller.signal);
    expect(bodies("/endpoints")).toEqual([
      { kind: "pull", name: expect.stringMatching(/^local-/) },
    ]);
    expect(bodies("/complete")).toEqual([
      {
        queue_id: "11111111-1111-4111-8111-111111111111",
        delivery_id: "33333333-3333-4333-8333-333333333333",
        lease_token: "lease-secret",
        mode: "exec" as const,
        exit_code: 0,
        duration_ms: 2,
      },
    ]);
  });
  it("reuses the saved destination name after an ambiguous create and preserves omitted filters", async () => {
    steps["/v1/endpoints"]?.unshift(new Error("lost response with secret"));
    await runListen(options);
    expect(bodies("/endpoints")[0]).toEqual(bodies("/endpoints")[1]);
    expect(bodies("/endpoints")[0]).not.toHaveProperty("rules");
    expect(options.stderr?.write).not.toHaveBeenCalledWith(
      expect.stringContaining("secret"),
    );
  });
  it("sends explicit filters and stops with an actionable conflict without running a handler", async () => {
    steps["/v1/endpoints"] = [apiError(409, "subscription_conflict")];
    await expect(
      runListen({
        ...options,
        subscription: "agent",
        events: ["email.received"],
      }),
    ).rejects.toThrow(
      /Omit --events.*primitive listen --subscription new-subscription/,
    );
    expect(bodies("/endpoints")).toEqual([
      {
        kind: "pull",
        name: "agent",
        rules: { event_types: ["email.received"] },
      },
    ]);
    expect(options.handler).not.toHaveBeenCalled();
  });
  it("retries ambiguous completion with identical evidence without repeating the handler", async () => {
    steps["/v1/endpoints/endpoint-a/complete"] = [
      new Error("response lost"),
      apiError(503, "unavailable"),
      ok({ result: "already_completed" }),
    ];
    expect(await runListen(options)).toBe(1);
    expect(options.handler).toHaveBeenCalledOnce();
    const completions = bodies("/complete");
    expect(completions).toHaveLength(3);
    expect(completions[1]).toEqual(completions[0]);
    expect(completions[2]).toEqual(completions[0]);
  });
  it("respects Retry-After and warns when server retention has lost events", async () => {
    steps["/v1/endpoints/endpoint-a/pull"] = [
      apiError(429, "rate_limited", { "Retry-After": "3" }),
      pull(delivery, 2),
    ];
    expect(await runListen(options)).toBe(1);
    expect(options.sleep).toHaveBeenCalledWith(3000, controller.signal);
    expect(options.stderr?.write).toHaveBeenCalledWith(
      expect.stringContaining("2 lost events"),
    );
  });
  it("never starts a handler with insufficient lease time", async () => {
    steps["/v1/endpoints/endpoint-a/pull"] = [
      pull({
        ...delivery,
        lease_expires_at: new Date(now + 31_000).toISOString(),
      }),
      pull({
        ...delivery,
        delivery_id: "66666666-6666-4666-8666-666666666666",
      }),
    ];
    await runListen(options);
    expect(options.handler).toHaveBeenCalledOnce();
    expect(options.handler).toHaveBeenCalledWith(
      expect.objectContaining({
        delivery_id: "66666666-6666-4666-8666-666666666666",
      }),
      controller.signal,
    );
  });
  it("does not count stale or failed outcomes toward --number", async () => {
    steps["/v1/endpoints/endpoint-a/pull"] = [
      pull(delivery),
      pull({
        ...delivery,
        delivery_id: "44444444-4444-4444-8444-444444444444",
      }),
      pull({
        ...delivery,
        delivery_id: "55555555-5555-4555-8555-555555555555",
      }),
    ];
    steps["/v1/endpoints/endpoint-a/complete"] = [
      apiError(409, "stale_delivery"),
      ok({ result: "completed" }),
      ok({ result: "completed" }),
    ];
    let calls = 0;
    options.handler = vi.fn(async () => ({
      succeeded: ++calls !== 2,
      outcome: {
        mode: "exec" as const,
        exit_code: calls === 2 ? 1 : 0,
        duration_ms: 1,
      },
    }));
    expect(await runListen(options)).toBe(1);
    expect(options.handler).toHaveBeenCalledTimes(3);
  });
  it("stops on permanent authentication failure without logging the response body", async () => {
    steps["/v1/endpoints/endpoint-a/pull"] = [apiError(401, "unauthorized")];
    await expect(runListen(options)).rejects.toThrow("primitive signin");
    expect(options.sleep).not.toHaveBeenCalled();
    expect(options.handler).not.toHaveBeenCalled();
  });
  it("refreshes changed credentials and refuses a different account before pulling", async () => {
    steps["/v1/endpoints"] = [
      () => {
        token = "token-b";
        return ok({ id: "endpoint-a", kind: "pull", enabled: true });
      },
    ];
    steps["/v1/account"]?.push(ok({ id: "account-b" }));
    await expect(runListen(options)).rejects.toThrow("account changed");
    expect(bodies("/pull")).toEqual([]);
    expect(options.handler).not.toHaveBeenCalled();
  });
  it("accepts rotated credentials for the same account without changing subscription ownership", async () => {
    steps["/v1/endpoints"] = [
      () => {
        token = "token-b";
        return ok({ id: "endpoint-a", kind: "pull", enabled: true });
      },
    ];
    steps["/v1/account"]?.push(ok({ id: "account-a" }));
    expect(await runListen(options)).toBe(1);
    expect(
      requests.find((request) => request.path.endsWith("/pull"))?.authorization,
    ).toBe("Bearer token-b");
  });
  it("waits for cancelled handler cleanup and sends no completion for unfinished work", async () => {
    let cleanup = false;
    options.handler = vi.fn(async () => {
      controller.abort();
      await Promise.resolve();
      cleanup = true;
      throw new Error("cancelled");
    });
    expect(await runListen(options)).toBe(0);
    expect(cleanup).toBe(true);
    expect(bodies("/complete")).toEqual([]);
  });
});

it("backs off nonstandard 5xx responses and prevents tight empty-poll loops", async () => {
  steps["/v1/endpoints/endpoint-a/pull"] = [
    apiError(507, "overloaded"),
    pull(null),
    pull(delivery),
  ];
  expect(await runListen(options)).toBe(1);
  expect(options.sleep).toHaveBeenCalledTimes(2);
  expect(options.sleep).toHaveBeenLastCalledWith(250, controller.signal);
});
it("rejects a malformed delivery or negative backlog without invoking the hook", async () => {
  steps["/v1/endpoints/endpoint-a/pull"] = [
    pull({ ...delivery, queue_id: "not-a-uuid" }),
  ];
  await expect(runListen(options)).rejects.toThrow("invalid delivery");
  expect(options.handler).not.toHaveBeenCalled();
});
it("keeps the subscription locked until aborted handler cleanup has finished", async () => {
  let started = () => {};
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  let finish = () => {};
  const cleanup = new Promise<void>((resolve) => {
    finish = resolve;
  });
  options.handler = async () => {
    started();
    await cleanup;
    throw new Error("cancelled");
  };
  options.subscription = "locked";
  const first = runListen(options);
  await entered;
  controller.abort();
  steps["/v1/account"]?.push(ok({ id: "account-a" }));
  const another = new AbortController();
  await expect(
    runListen({ ...options, signal: another.signal }),
  ).rejects.toThrow("Another listener");
  finish();
  expect(await first).toBe(0);
  expect(bodies("/complete")).toEqual([]);
});
it("chunks huge Retry-After waits without a timer overflow or losing cancellation", async () => {
  vi.useFakeTimers();
  try {
    const pending = listenSleep(3_000_000_000, controller.signal);
    const rejected = expect(pending).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(60_000);
    controller.abort();
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});

describe("safe gap diagnostics", () => {
  it.each([
    ["retention_expired", "24-hour retention expired"],
    ["content_unavailable", "source content was discarded or is unavailable"],
    ["capacity_exceeded", "pending event capacity exceeded"],
    ["secret\n\u001b[31m", "reason unavailable"],
    ["toString", "reason unavailable"],
  ])("explains %s without logging untrusted text", async (reason, message) => {
    steps["/v1/endpoints/endpoint-a/pull"] = [pull(delivery, 2, reason)];
    expect(await runListen(options)).toBe(1);
    expect(options.stderr?.write).toHaveBeenCalledWith(
      expect.stringContaining(`2 lost events (${message})`),
    );
    expect(
      JSON.stringify(vi.mocked(options.stderr?.write ?? vi.fn()).mock.calls),
    ).not.toContain("secret");
  });
  it("rejects malformed gap evidence before running the hook", async () => {
    steps["/v1/endpoints/endpoint-a/pull"] = [
      pull(delivery, 2, { unexpected: true }),
    ];
    await expect(runListen(options)).rejects.toThrow("invalid pull response");
    expect(options.handler).not.toHaveBeenCalled();
  });
});

it("rejects unsupported completion modes before opening a stream or handling an event", async () => {
  steps["/v1/endpoints"] = [
    ok({
      id: "endpoint-a",
      kind: "pull",
      enabled: true,
      receiver_capabilities: {
        stream_protocols: ["primitive.events.v1"],
        completion_modes: ["stdout"],
      },
    }),
  ];
  await expect(
    runListen({ ...options, transport: "websocket", mode: "exec" }),
  ).rejects.toThrow("selected listener handler mode");
  expect(options.handler).not.toHaveBeenCalled();
  expect(bodies("/pull")).toEqual([]);
});
