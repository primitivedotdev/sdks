import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";

const { authenticate, prepare } = vi.hoisted(() => ({
  authenticate: vi.fn(),
  prepare: vi.fn(),
}));
vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: authenticate,
}));
vi.mock("../../src/oclif/notify-session.js", () => ({
  openSessionNotifications: prepare,
}));

import { runListen } from "../../src/oclif/listen-runner.js";
import { NotificationRetryError } from "../../src/oclif/notify-session-content.js";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
function setup(modes = ["sdk"]) {
  const configDir = mkdtempSync(join(tmpdir(), "primitive-notify-runner-"));
  directories.push(configDir);
  const order: string[] = [];
  const completions: unknown[] = [];
  const handler = vi.fn(async () => ({
    succeeded: true,
    outcome: { mode: "sdk" as const, accepted: true, duration_ms: 1 },
  }));
  const close = vi.fn();
  prepare.mockReset().mockImplementation(async () => {
    order.push("native-ready");
    return { handler, close, bindRecipient: vi.fn() };
  });
  const apiKey = `pconn_${"a".repeat(64)}`;
  authenticate.mockReset().mockResolvedValue({
    auth: { apiKey, apiBaseUrl: "https://example.test/v1" },
    apiClient: new PrimitiveApiClient({
      apiKey,
      apiBaseUrl: "https://example.test/v1",
      fetch: async (input, init) => {
        const request = new Request(input, init);
        const path = new URL(request.url).pathname;
        order.push(path);
        let data: unknown;
        if (path === "/v1/endpoints")
          data = {
            id: "endpoint",
            kind: "pull",
            enabled: true,
            recipient: "device@example.com",
            receiver_capabilities: {
              completion_modes: modes,
              stream_protocols: ["primitive.events.v1"],
            },
          };
        else if (path.endsWith("/complete")) {
          completions.push(await request.json());
          data = { result: "completed" };
        } else
          data = {
            gap_count: 0,
            last_gap_reason: null,
            backlog: 0,
            handler_timeout_seconds: 30,
            retention_seconds: 86400,
            delivery: {
              queue_id: randomUUID(),
              event_id: randomUUID(),
              delivery_id: randomUUID(),
              lease_token: "lease-fixture",
              event_type: "email.received",
              lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
              body: "{}",
              headers: {},
            },
          };
        return Response.json({ success: true, data });
      },
    }),
  });
  const options = {
    configDir,
    transport: "poll" as const,
    signal: new AbortController().signal,
    number: 1,
    handler,
    stderr: { write: vi.fn() },
    notifySession: { threadId: randomUUID(), senders: ["sender@example.com"] },
  };
  return { options, order, completions, handler, close };
}
describe("notification listener integration", () => {
  it("checks native readiness before registration and requires SDK capability for polling", async () => {
    const f = setup(["stdout"]);
    await expect(runListen(f.options)).rejects.toThrow(
      "does not advertise SDK acceptance",
    );
    expect(f.order).toEqual(["native-ready", "/v1/endpoints"]);
    expect(f.close).toHaveBeenCalledTimes(1);
  });
  it("releases a temporary content failure through failed SDK acceptance and continues", async () => {
    const f = setup();
    f.handler.mockRejectedValueOnce(
      new NotificationRetryError("processing pending"),
    );
    expect(await runListen(f.options)).toBe(1);
    expect(f.completions).toHaveLength(2);
    expect(f.completions[0]).toMatchObject({
      mode: "sdk",
      accepted: false,
      transport_error: "io",
    });
    expect(f.completions[1]).toMatchObject({ mode: "sdk", accepted: true });
    expect(f.close).toHaveBeenCalledTimes(1);
  });
});
