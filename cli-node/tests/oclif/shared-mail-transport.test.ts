import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { EventReceiverError } from "@primitivedotdev/sdk/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  receive: vi.fn(),
  complete: vi.fn(),
  close: vi.fn(),
  connectionOptions: [] as Record<string, unknown>[],
}));
vi.mock("@primitivedotdev/sdk/api", async (original) => ({
  ...(await original<typeof import("@primitivedotdev/sdk/api")>()),
  EventConnection: class {
    constructor(
      _client: unknown,
      _id: unknown,
      options: Record<string, unknown>,
    ) {
      mocks.connectionOptions.push(options);
    }
    open = mocks.open;
    receive = mocks.receive;
    complete = mocks.complete;
    close = mocks.close;
  },
}));

import { openSharedMailStore } from "../../src/oclif/shared-mail-state.js";
import {
  runSharedMailTransport,
  type SharedMailTransportOptions,
} from "../../src/oclif/shared-mail-transport.js";

const recipient = "owner@sender.example";
function fixture() {
  const controller = new AbortController();
  const events: string[] = [];
  const endpoint = {
    id: "subscription-id",
    recipient,
    kind: "pull",
    enabled: true,
    rules: { event_types: ["email.received"] },
    receiver_capabilities: {
      stream_protocols: ["primitive.events.v1"],
      completion_modes: ["sdk"],
    },
  };
  const offer = {
    backlog: 0,
    gap_count: 0,
    last_gap_reason: null,
    delivery: {
      event_id: "event-id",
      event_type: "email.received",
      queue_id: "queue",
      delivery_id: "delivery",
      lease_token: "lease",
      lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
      body: JSON.stringify({
        email: {
          id: "email-id",
          received_at: new Date().toISOString(),
          smtp: { rcpt_to: [recipient] },
        },
      }),
    },
  };
  const apiClient = new PrimitiveApiClient({
    apiKey: ["pconn", "fixture"].join("_"),
    apiBaseUrl: "https://example.test/v1",
    fetch: async (input, init) => {
      const request = new Request(input, init);
      expect(new URL(request.url).pathname).toBe("/v1/endpoints");
      expect(request.method).toBe("POST");
      expect(await request.json()).toEqual({
        kind: "pull",
        name: "stable-subscription",
        rules: { event_types: ["email.received"] },
      });
      events.push("subscription");
      return Response.json({ data: endpoint });
    },
  });
  mocks.open.mockImplementation(async () => {
    events.push("authenticated-ready");
  });
  mocks.receive.mockImplementation(async () => {
    events.push("receive");
    return offer;
  });
  mocks.complete.mockImplementation(async () => {
    events.push("complete");
    controller.abort();
  });
  mocks.close.mockImplementation(() => events.push("close"));
  const options: SharedMailTransportOptions = {
    apiClient,
    subscription: "stable-subscription",
    recipient,
    signal: controller.signal,
    ready: async () => {
      events.push("publish-ready");
    },
    status: async () => {
      events.push("status");
    },
    ingest: async () => {
      events.push("durable-ingress");
    },
  };
  return { options, events, endpoint, offer, controller };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.connectionOptions = [];
});
describe("shared inbound transport", () => {
  it("publishes authenticated readiness and persists ingress before completing delivery", async () => {
    const { options, events } = fixture();
    await runSharedMailTransport(options);
    expect(events).toEqual([
      "subscription",
      "authenticated-ready",
      "publish-ready",
      "receive",
      "status",
      "durable-ingress",
      "complete",
      "close",
    ]);
    expect(mocks.complete.mock.calls[0][0]).toMatchObject({
      mode: "sdk",
      accepted: true,
      queue_id: "queue",
      delivery_id: "delivery",
      lease_token: "lease",
    });
  });
  it("retains an observed reply when shutdown interrupts completion and acknowledges redelivery on restart", async () => {
    const configDir = mkdtempSync(join(tmpdir(), "primitive-mail-redelivery-"));
    try {
      const first = fixture();
      const identity = { configDir, scope: "redelivery", recipient };
      const store = await openSharedMailStore(identity);
      const requestId = randomUUID(),
        sentEmailId = randomUUID(),
        emailId = randomUUID(),
        eventId = randomUUID(),
        receivedAt = new Date().toISOString(),
        peer = "peer@sender.example";
      await store.registerWait({
        requestId,
        peer,
        idempotencyKey: randomUUID(),
        createdAt: new Date(Date.now() - 1000).toISOString(),
      });
      await store.bindWait(requestId, sentEmailId);
      first.offer.delivery.event_id = eventId;
      first.offer.delivery.body = JSON.stringify({
        email: {
          id: emailId,
          received_at: receivedAt,
          smtp: { rcpt_to: [recipient] },
        },
      });
      const shutdown = new Error("Satisfied waiter closed its receiver");
      first.options.ingest = async (event) => {
        expect(event).toEqual({ emailId, eventId, receivedAt });
        await store.ingest(event);
        await store.hydrate(emailId, {
          recipient,
          peer,
          replyToSentEmailId: sentEmailId,
          receivedAt,
          authorization: "trusted",
        });
        await store.claimForWait(emailId, requestId);
        await store.markWaitObserved(emailId, requestId);
        await store.finishWait(requestId);
        first.controller.abort(shutdown);
      };
      await expect(runSharedMailTransport(first.options)).rejects.toBe(
        shutdown,
      );
      expect(mocks.complete).not.toHaveBeenCalled();
      expect(mocks.close).toHaveBeenCalledOnce();
      const observed = await store.readEmail(emailId);
      expect(observed?.route).toEqual({
        kind: "wait",
        requestId,
        observed: true,
      });

      const restarted = await openSharedMailStore(identity);
      const second = fixture();
      second.offer.delivery = {
        ...first.offer.delivery,
        delivery_id: "redelivery",
        lease_token: "new-lease",
      };
      second.options.ingest = async (event) => {
        expect(event).toEqual({ emailId, eventId, receivedAt });
        expect(await restarted.ingest(event)).toEqual(observed);
      };
      await runSharedMailTransport(second.options);
      expect(mocks.complete).toHaveBeenCalledOnce();
      expect(mocks.complete.mock.calls[0][0]).toMatchObject({
        delivery_id: "redelivery",
        lease_token: "new-lease",
        mode: "sdk",
        accepted: true,
      });
      expect((await restarted.listEmails()).emails).toEqual([observed]);
      expect((await restarted.claimForWait(emailId, requestId)).status).toBe(
        "already_observed",
      );
      expect(
        (await restarted.claimForNotification(emailId, "runtime:session"))
          .status,
      ).toBe("held");
      expect(await restarted.readEmail(emailId)).toEqual(observed);
    } finally {
      rmSync(configDir, { recursive: true, force: true });
    }
  });
  it("never completes an event whose journal write failed", async () => {
    const { options } = fixture();
    options.ingest = async () => {
      throw new Error("disk full");
    };
    await expect(runSharedMailTransport(options)).rejects.toThrow("disk full");
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.close).toHaveBeenCalledOnce();
  });
  it("counts server queue answers as mail checks, not pings or opening", async () => {
    const { options, events, controller } = fixture();
    mocks.open.mockImplementation(async () => {
      events.push("authenticated-ready");
      // The connection takes no ping callback, so a ping cannot count.
      expect(mocks.connectionOptions[0]).not.toHaveProperty("onHeartbeat");
    });
    let receives = 0;
    mocks.receive.mockImplementation(async () => {
      receives += 1;
      if (receives > 1) {
        controller.abort();
        throw new DOMException("stopped", "AbortError");
      }
      events.push("receive");
      return {
        backlog: 0,
        gap_count: 0,
        last_gap_reason: null,
        delivery: null,
      };
    });
    await runSharedMailTransport({
      ...options,
      checked: async () => {
        events.push("checked");
      },
    }).catch(() => undefined);
    // Opening the stream is not a check; the empty offer that follows is.
    expect(events.slice(0, 4)).toEqual([
      "subscription",
      "authenticated-ready",
      "publish-ready",
      "receive",
    ]);
    expect(events).toContain("checked");
  });

  it("refuses an out-of-scope endpoint before opening a stream", async () => {
    const { options, endpoint } = fixture();
    endpoint.recipient = "other@sender.example";
    await expect(runSharedMailTransport(options)).rejects.toThrow(
      "compatible subscription",
    );
    expect(mocks.open).not.toHaveBeenCalled();
  });
  it("refuses a named subscription with different event selection", async () => {
    const { options, endpoint } = fixture();
    endpoint.rules.event_types = ["email.received", "email.bounced"];
    await expect(runSharedMailTransport(options)).rejects.toThrow(
      "compatible subscription",
    );
    expect(mocks.open).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON without echoing its contents", async () => {
    const { options, offer } = fixture();
    offer.delivery.body = "private malformed content";
    await expect(runSharedMailTransport(options)).rejects.toThrow(
      "invalid JSON",
    );
    expect(mocks.complete).not.toHaveBeenCalled();
  });
  it("does not publish readiness after a failed handshake", async () => {
    const { options, events } = fixture();
    mocks.open.mockRejectedValue(
      new EventReceiverError("unsupported", "unsupported", 400),
    );
    await expect(runSharedMailTransport(options)).rejects.toThrow(
      "unsupported",
    );
    expect(events).not.toContain("publish-ready");
  });
  it("retries identical completion evidence after an ambiguous transport response", async () => {
    const { options } = fixture();
    mocks.complete.mockRejectedValueOnce(
      new EventReceiverError("connection lost", "disconnected"),
    );
    await runSharedMailTransport(options);
    expect(mocks.complete).toHaveBeenCalledTimes(2);
    expect(mocks.complete.mock.calls[0][0]).toEqual(
      mocks.complete.mock.calls[1][0],
    );
  });
  it("keeps an expired recorded event available for redelivery without completing a stale lease", async () => {
    const { options, offer, events } = fixture();
    offer.delivery.lease_expires_at = new Date(Date.now() - 1).toISOString();
    await expect(runSharedMailTransport(options)).rejects.toThrow(
      "lease expired",
    );
    expect(events).toContain("durable-ingress");
    expect(mocks.complete).not.toHaveBeenCalled();
  });
});
