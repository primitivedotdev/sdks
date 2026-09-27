import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { EventReceiverError } from "@primitivedotdev/sdk/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  receive: vi.fn(),
  complete: vi.fn(),
  close: vi.fn(),
}));
vi.mock("@primitivedotdev/sdk/api", async (original) => ({
  ...(await original<typeof import("@primitivedotdev/sdk/api")>()),
  EventConnection: class {
    open = mocks.open;
    receive = mocks.receive;
    complete = mocks.complete;
    close = mocks.close;
  },
}));

import { runSharedMailTransport } from "../../src/oclif/shared-mail-transport.js";

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
  const options = {
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
beforeEach(() => vi.resetAllMocks());
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
  it("never completes an event whose journal write failed", async () => {
    const { options } = fixture();
    options.ingest = async () => {
      throw new Error("disk full");
    };
    await expect(runSharedMailTransport(options)).rejects.toThrow("disk full");
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.close).toHaveBeenCalledOnce();
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
