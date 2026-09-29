import { randomUUID } from "node:crypto";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";

const { authenticate, connect, receive } = vi.hoisted(() => ({
  authenticate: vi.fn(),
  connect: vi.fn(),
  receive: vi.fn(),
}));
vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: authenticate,
}));
vi.mock("../../src/oclif/notify-session-native.js", async (original) => ({
  ...(await original<
    typeof import("../../src/oclif/notify-session-native.js")
  >()),
  connectNativeSession: connect,
}));
vi.mock("../../src/oclif/shared-mail-receiver.js", async (original) => ({
  ...(await original<
    typeof import("../../src/oclif/shared-mail-receiver.js")
  >()),
  openSharedMailReceiver: receive,
}));

import { runListen } from "../../src/oclif/listen-runner.js";
import {
  NativeSessionDisconnectedError,
  NativeSessionError,
  NotificationOutcomeUnknownError,
} from "../../src/oclif/notify-session-errors.js";
import { readNotificationReceipts } from "../../src/oclif/notify-session-state.js";
import { sharedMailScope } from "../../src/oclif/shared-mail-receiver.js";
import { openSharedMailStore } from "../../src/oclif/shared-mail-state.js";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function fixture() {
  const configDir = mkdtempSync(join(tmpdir(), "primitive-native-lifecycle-"));
  directories.push(configDir);
  const apiKey = `pconn_${"a".repeat(64)}`;
  const baseUrl = "https://example.test/v1";
  const scope = sharedMailScope(apiKey, baseUrl);
  const emailId = randomUUID(),
    eventId = randomUUID(),
    threadId = randomUUID();
  const recipient = "device@example.com",
    sender = "sender@example.com";
  const receivedAt = new Date().toISOString();
  const requests: string[] = [];
  let controller = new AbortController();
  const close = vi.fn();
  const closeReceiver = vi.fn();
  const queue = vi.fn(
    async (_text: string, _id: string, dispatch: () => void) => {
      dispatch();
    },
  );
  connect.mockReset().mockImplementation(async () => ({ queue, close }));
  const apiClient = new PrimitiveApiClient({
    apiKey,
    apiBaseUrl: baseUrl,
    fetch: async (input, init) => {
      const request = new Request(input, init);
      const path = new URL(request.url).pathname;
      requests.push(path);
      if (path === "/v1/endpoints")
        return Response.json({
          success: true,
          data: {
            id: "endpoint",
            kind: "pull",
            enabled: true,
            recipient,
            rules: { event_types: ["email.received"] },
            receiver_capabilities: {
              completion_modes: ["sdk"],
              stream_protocols: ["primitive.events.v1"],
            },
          },
        });
      if (path === `/v1/emails/${emailId}`)
        return Response.json({
          success: true,
          data: {
            id: emailId,
            recipient,
            to_email: recipient,
            from_email: sender,
            from_header: sender,
            status: "completed",
            received_at: receivedAt,
            reply_to_sent_email_id: null,
            parsed: { status: "complete", attachments: [] },
            auth: {
              dmarc: "pass",
              dmarcFromDomain: "example.com",
              dmarcSpfAligned: true,
              dmarcDkimAligned: true,
              spf: "pass",
              dkimSignatures: [],
            },
          },
        });
      throw new Error(`Unexpected fixture request ${path}`);
    },
  });
  authenticate.mockReset().mockResolvedValue({
    auth: { apiKey, apiBaseUrl: baseUrl },
    apiClient,
  });
  receive
    .mockReset()
    .mockImplementation(async (options: { signal: AbortSignal }) => {
      const store = await openSharedMailStore({
        configDir,
        scope,
        recipient,
        signal: options.signal,
      });
      await store.ingest({ emailId, eventId, receivedAt });
      return {
        store,
        ready: async () => ({ ready: true }),
        changed: async () => controller.abort(),
        close: closeReceiver,
      };
    });
  const options = () => ({
    configDir,
    signal: controller.signal,
    number: 1,
    transport: "websocket" as const,
    handler: vi.fn(),
    stderr: { write: vi.fn() },
    notifySession: { threadId, senders: [sender] },
    expectedNotificationScope: scope,
  });
  return {
    queue,
    close,
    closeReceiver,
    requests,
    files: () => readdirSync(configDir),
    replaceCredentials: (kind: "credential" | "origin") =>
      authenticate.mockResolvedValue({
        auth: {
          apiKey: kind === "credential" ? `pconn_${"b".repeat(64)}` : apiKey,
          apiBaseUrl: kind === "origin" ? "https://other.test/v1" : baseUrl,
        },
        apiClient,
      }),
    run: () => runListen(options()),
    abort: (reason?: Error) => controller.abort(reason),
    restart: () => {
      controller = new AbortController();
    },
    receipts: () => readNotificationReceipts(configDir, scope, threadId),
    row: async () =>
      (await openSharedMailStore({ configDir, scope, recipient })).readEmail(
        emailId,
      ),
  };
}

describe("native listener cancellation boundaries", () => {
  it.each([
    "credential",
    "origin",
  ] as const)("rejects a replaced %s before native attachment, subscription or journal state", async (kind) => {
    const f = fixture();
    f.replaceCredentials(kind);
    await expect(f.run()).rejects.toThrow("selected connection changed");
    expect(connect).not.toHaveBeenCalled();
    expect(receive).not.toHaveBeenCalled();
    expect(f.queue).not.toHaveBeenCalled();
    expect(f.requests).toEqual([]);
    expect(f.files()).toEqual([]);
  });
  it.each([
    "disconnect",
    "owner stop",
  ])("holds unknown acceptance through %s, aborted reconciliation and cleanup failure", async (reason) => {
    const f = fixture();
    f.queue.mockImplementationOnce(async (_text, _id, dispatch) => {
      dispatch();
      f.abort(
        reason === "disconnect"
          ? new NativeSessionDisconnectedError()
          : undefined,
      );
      throw new NativeSessionError("Queue acceptance was lost", true);
    });
    f.closeReceiver.mockRejectedValueOnce(new Error("Cleanup failed"));
    await expect(f.run()).rejects.toBeInstanceOf(
      NotificationOutcomeUnknownError,
    );
    expect(f.receipts()).toMatchObject([{ state: "unknown" }]);
    // Aborted shared transactions did not manufacture submission evidence.
    expect((await f.row())?.route).toMatchObject({ state: "selected" });
    f.restart();
    await expect(f.run()).rejects.toBeInstanceOf(
      NotificationOutcomeUnknownError,
    );
    expect((await f.row())?.route).toMatchObject({ state: "unknown" });
    expect(f.queue).toHaveBeenCalledOnce();
  });

  it("allows a fresh attempt after a known pre-dispatch disconnect", async () => {
    const f = fixture();
    f.queue.mockImplementationOnce(async () => {
      const error = new NativeSessionDisconnectedError();
      f.abort(error);
      throw error;
    });
    await expect(f.run()).rejects.toBeInstanceOf(
      NativeSessionDisconnectedError,
    );
    expect(f.receipts()).toEqual([]);
    expect((await f.row())?.route).toMatchObject({ state: "selected" });
    f.restart();
    expect(await f.run()).toBe(1);
    expect(f.receipts()).toMatchObject([{ state: "accepted" }]);
    expect(f.queue).toHaveBeenCalledTimes(2);
  });

  it("retains confirmed acceptance if disconnect follows the queue response", async () => {
    const f = fixture();
    f.queue.mockImplementationOnce(async (_text, _id, dispatch) => {
      dispatch();
      f.abort(new NativeSessionDisconnectedError());
    });
    await expect(f.run()).rejects.toBeInstanceOf(
      NativeSessionDisconnectedError,
    );
    expect(f.receipts()).toMatchObject([{ state: "accepted" }]);
    f.restart();
    expect(await f.run()).toBe(0);
    expect((await f.row())?.route).toMatchObject({ state: "accepted" });
    expect(f.queue).toHaveBeenCalledOnce();
  });

  it("does not suppress an unrelated failure because cancellation also happened", async () => {
    const f = fixture();
    const failure = new Error("Receipt state is inconsistent");
    f.queue.mockImplementationOnce(async () => {
      f.abort();
      throw failure;
    });
    await expect(f.run()).rejects.toBe(failure);
    expect(f.receipts()).toEqual([]);
  });
});
