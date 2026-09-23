import { once } from "node:events";
import { createServer } from "node:http";
import { afterEach, expect, it } from "vitest";
import { WebSocketServer } from "ws";
import fixture from "../../../test-fixtures/local-event-receiver.json";
import { PrimitiveClient } from "../../src/api/index.js";

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of cleanup.splice(0)) await close();
});
it("receives over WebSocket by default and retries a lost receipt without another delivery", async () => {
  const completions: unknown[] = [];
  let deliveries = 0;
  const server = createServer((request, response) => {
    const data = request.url?.endsWith("/account")
      ? { id: "account" }
      : {
          id: "endpoint",
          kind: "pull",
          receiver_capabilities: {
            completion_modes: ["sdk"],
            stream_protocols: ["primitive.events.v1"],
          },
        };
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ success: true, data }));
  });
  const sockets = new WebSocketServer({ server });
  sockets.on("connection", (socket) => {
    socket.on("message", (bytes) => {
      const frame = JSON.parse(bytes.toString());
      if (frame.type === "authenticate") {
        expect(frame.token).toBe("test");
        socket.send(
          JSON.stringify({ type: "ready", protocol: "primitive.events.v1" }),
        );
      } else if (frame.type === "receive") {
        deliveries++;
        socket.send(JSON.stringify({ type: "ping" }));
        socket.send(
          JSON.stringify({
            type: "event",
            data: {
              delivery: fixture.delivery,
              backlog: 0,
              gap_count: 0,
              last_gap_reason: null,
              retention_seconds: 86400,
              handler_timeout_seconds: 30,
            },
          }),
        );
      } else if (frame.type === "complete") {
        completions.push(frame.body);
        if (completions.length === 1) socket.terminate();
        else
          socket.send(
            JSON.stringify({
              type: "receipt",
              data: { result: "already_completed" },
            }),
          );
      }
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  cleanup.push(async () => {
    for (const socket of sockets.clients) socket.terminate();
    sockets.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No address");
  const client = new PrimitiveClient({
    apiKey: "test",
    apiBaseUrl: `http://127.0.0.1:${address.port}/v1`,
  });
  const delivery = await client.events.wait({
    subscription: "agent",
    timeoutMs: 3000,
  });
  expect(delivery?.event.body).toBe(fixture.delivery.body);
  await delivery?.ack();
  expect(deliveries).toBe(1);
  expect(completions).toHaveLength(2);
  expect(completions[0]).toEqual(completions[1]);
});

it("stops when a gap callback throws instead of retrying it as a network error", async () => {
  let receives = 0;
  const server = createServer((request, response) => {
    const data = request.url?.endsWith("/account")
      ? { id: "account" }
      : {
          id: "endpoint",
          kind: "pull",
          receiver_capabilities: {
            completion_modes: ["sdk"],
            stream_protocols: ["primitive.events.v1"],
          },
        };
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ success: true, data }));
  });
  const sockets = new WebSocketServer({ server });
  sockets.on("connection", (socket) =>
    socket.on("message", (bytes) => {
      const frame = JSON.parse(bytes.toString());
      if (frame.type === "authenticate")
        socket.send(
          JSON.stringify({ type: "ready", protocol: "primitive.events.v1" }),
        );
      if (frame.type === "receive") {
        receives++;
        const data = {
          delivery: null,
          backlog: 1,
          gap_count: 1,
          last_gap_reason: "retention_expired",
          retention_seconds: 86400,
          handler_timeout_seconds: 30,
        };
        socket.send(JSON.stringify({ type: "status", data }));
        socket.send(
          JSON.stringify({
            type: "event",
            data: { ...data, delivery: fixture.delivery },
          }),
        );
      }
    }),
  );
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  cleanup.push(async () => {
    for (const socket of sockets.clients) socket.terminate();
    sockets.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No address");
  const client = new PrimitiveClient({
    apiKey: "test",
    apiBaseUrl: `http://127.0.0.1:${address.port}/v1`,
  });
  const failure = new TypeError("status callback failed");
  await expect(
    client.events.wait({
      subscription: "agent",
      timeoutMs: 2000,
      onGap: "error",
      onStatus: (status) => {
        if (status.type === "gap") throw failure;
      },
    }),
  ).rejects.toBe(failure);
  expect(receives).toBe(1);
});
