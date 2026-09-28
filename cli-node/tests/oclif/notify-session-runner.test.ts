import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type EmailDetail,
  PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";

const { authenticate, prepare, receive } = vi.hoisted(() => ({
  authenticate: vi.fn(),
  prepare: vi.fn(),
  receive: vi.fn(),
}));
vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: authenticate,
}));
vi.mock("../../src/oclif/notify-session.js", () => ({
  openSessionNotifications: prepare,
}));
vi.mock("../../src/oclif/shared-mail-receiver.js", async (original) => ({
  ...(await original<
    typeof import("../../src/oclif/shared-mail-receiver.js")
  >()),
  openSharedMailReceiver: receive,
}));

import { runListen } from "../../src/oclif/listen-runner.js";
import { ListenStateError } from "../../src/oclif/listen-state.js";
import type { DetailNotificationAuthorization } from "../../src/oclif/notify-session.js";
import { sharedMailScope } from "../../src/oclif/shared-mail-receiver.js";
import {
  openSharedMailStore,
  type SharedMailStore,
} from "../../src/oclif/shared-mail-state.js";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
function setup(
  modes = ["sdk"],
  eventTypes = ["email.received"],
  hydrated = false,
) {
  const configDir = mkdtempSync(join(tmpdir(), "primitive-notify-runner-"));
  directories.push(configDir);
  const order: string[] = [],
    endpointNames: string[] = [];
  const apiKey = `pconn_${"a".repeat(64)}`,
    baseUrl = "https://example.test/v1";
  const emailId = randomUUID(),
    eventId = randomUUID(),
    receivedAt = new Date().toISOString();
  const detail = {
    id: emailId,
    recipient: "device@example.com",
    to_email: "device@example.com",
    from_header: "sender@example.com",
    from_email: "sender@example.com",
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
  };
  let receipt: {
    emailId: string;
    eventId: string;
    clientId: string;
    state: string;
  } | null = null;
  const handleDetail = vi.fn(
    async (
      _detail: EmailDetail,
      _eventId: string,
      signal: AbortSignal,
      authorization?: DetailNotificationAuthorization,
    ) => {
      if (authorization) (await authorization.recheck(signal))();
      receipt = { emailId, eventId, clientId: randomUUID(), state: "accepted" };
      return { disposition: "notified" };
    },
  );
  let contactStatus = 200;
  let contactRows: unknown[] = [
    {
      agent_address: detail.recipient,
      contact_address: detail.from_email,
      version: randomUUID(),
      notify: true,
      notification_generation: randomUUID(),
      notify_since: new Date(Date.now() - 60_000).toISOString(),
    },
  ];
  const close = vi.fn(),
    closeReceiver = vi.fn();
  prepare.mockReset().mockImplementation(async () => {
    order.push("native-ready");
    return {
      handleDetail,
      receipt: () => receipt,
      close,
      bindRecipient: vi.fn(),
    };
  });
  const apiClient = new PrimitiveApiClient({
    apiKey,
    apiBaseUrl: baseUrl,
    fetch: async (input, init) => {
      const request = new Request(input, init),
        path = decodeURIComponent(new URL(request.url).pathname);
      order.push(path);
      if (path === "/v1/endpoints") {
        endpointNames.push((await request.json()).name);
        return Response.json({
          success: true,
          data: {
            id: "endpoint",
            kind: "pull",
            enabled: true,
            recipient: "device@example.com",
            rules: { event_types: eventTypes },
            receiver_capabilities: {
              completion_modes: modes,
              stream_protocols: ["primitive.events.v1"],
            },
          },
        });
      }
      if (path === `/v1/emails/${emailId}`)
        return Response.json({ success: true, data: detail });
      if (path === `/v1/agent-contacts/${detail.recipient}`)
        return Response.json(
          contactStatus === 200
            ? { success: true, data: contactRows, meta: { cursor: null } }
            : {
                success: false,
                error: { code: "forbidden", message: "Unavailable" },
              },
          { status: contactStatus },
        );
      throw new Error(`Unexpected remote request ${path}`);
    },
  });
  authenticate
    .mockReset()
    .mockResolvedValue({ auth: { apiKey, apiBaseUrl: baseUrl }, apiClient });
  let opened: SharedMailStore | undefined;
  receive.mockReset().mockImplementation(async () => {
    opened = await openSharedMailStore({
      configDir,
      scope: sharedMailScope(apiKey, baseUrl),
      recipient: detail.recipient,
    });
    await opened.ingest({ emailId, eventId, receivedAt });
    if (hydrated)
      await opened.hydrate(emailId, {
        recipient: detail.recipient,
        peer: "sender@example.com",
        replyToSentEmailId: null,
        receivedAt,
        authorization: "trusted",
      });
    return {
      store: opened,
      ready: vi.fn(async () => ({ ready: true })),
      changed: vi.fn(async () => {
        detail.parsed.status = "complete";
      }),
      close: closeReceiver,
    };
  });
  const options = {
    configDir,
    transport: "websocket" as const,
    signal: new AbortController().signal,
    number: 1,
    handler: vi.fn(),
    stderr: { write: vi.fn() },
    notifySession: { threadId: randomUUID(), senders: ["sender@example.com"] },
  };
  return {
    options,
    order,
    detail,
    endpointNames,
    apiKey,
    baseUrl,
    handleDetail,
    apiClient,
    contacts: (rows: unknown[], status = 200) => {
      contactRows = rows;
      contactStatus = status;
    },
    close,
    closeReceiver,
    store: () => opened,
    unknown: () => {
      receipt = { emailId, eventId, clientId: randomUUID(), state: "unknown" };
    },
  };
}
describe("shared notification listener integration", () => {
  it("loads its own contact preferences and rechecks them at native dispatch", async () => {
    const f = setup();
    expect(
      await runListen({
        ...f.options,
        notifySession: {
          ...f.options.notifySession,
          senders: [],
          contactPreferences: true,
        },
      }),
    ).toBe(1);
    expect(f.handleDetail).toHaveBeenCalledOnce();
    expect(
      f.order.filter((path) => path.startsWith("/v1/agent-contacts/")),
    ).toEqual([
      "/v1/agent-contacts/device@example.com",
      "/v1/agent-contacts/device@example.com",
    ]);
    expect((await f.store()?.readEmail(f.detail.id))?.route).toMatchObject({
      state: "accepted",
    });
  });
  it("leaves unapproved hydrated mail unreserved in contact mode", async () => {
    const f = setup(["sdk"], ["email.received"], true);
    f.contacts([]);
    expect(
      await runListen({
        ...f.options,
        notifySession: {
          ...f.options.notifySession,
          senders: [],
          contactPreferences: true,
        },
      }),
    ).toBe(1);
    expect(f.handleDetail).not.toHaveBeenCalled();
    expect((await f.store()?.readEmail(f.detail.id))?.route).toBeNull();
  });
  it("fails closed on revoked contact access before receiving or dispatching", async () => {
    const f = setup();
    f.contacts([], 403);
    await expect(
      runListen({
        ...f.options,
        notifySession: {
          ...f.options.notifySession,
          senders: [],
          contactPreferences: true,
        },
      }),
    ).rejects.toThrow("unavailable or invalid");
    expect(receive).not.toHaveBeenCalled();
    expect(f.handleDetail).not.toHaveBeenCalled();
    expect(f.close).toHaveBeenCalledOnce();
  });
  it("rejects a receiving address that differs from the selected connection profile", async () => {
    const f = setup();
    authenticate.mockResolvedValue({
      apiClient: f.apiClient,
      auth: {
        apiKey: f.apiKey,
        apiBaseUrl: f.baseUrl,
        connectedAgent: {
          orgId: randomUUID(),
          agentAddress: "other@example.com",
          ownerAddress: "owner@example.com",
          apiBaseUrl: f.baseUrl,
          profileName: "test-profile",
        },
      },
    });
    await expect(
      runListen({
        ...f.options,
        notifySession: {
          ...f.options.notifySession,
          senders: [],
          contactPreferences: true,
        },
      }),
    ).rejects.toThrow("selected connected-agent profile");
    expect(receive).not.toHaveBeenCalled();
    expect(f.handleDetail).not.toHaveBeenCalled();
  });
  it("rejects competing subscription modes before authentication", async () => {
    const f = setup();
    for (const extra of [
      { transport: "poll" as const },
      { subscription: "custom" },
      { events: ["email.received", "payment.settled"] },
    ])
      await expect(runListen({ ...f.options, ...extra })).rejects.toThrow();
    await expect(
      runListen({
        ...f.options,
        notifySession: undefined,
        subscription: "local-mail-reserved",
      }),
    ).rejects.toThrow("reserved");
    expect(authenticate).not.toHaveBeenCalled();
  });
  it.each([
    { modes: ["stdout"] },
    { modes: [] },
  ])("checks native readiness then refuses incompatible SDK completion %j", async ({
    modes,
  }) => {
    const f = setup(modes);
    await expect(runListen(f.options)).rejects.toThrow(
      "compatible subscription",
    );
    expect(f.order).toEqual(["native-ready", "/v1/endpoints"]);
    expect(receive).not.toHaveBeenCalled();
    expect(f.close).toHaveBeenCalledOnce();
  });
  it("uses one stable name and accepts only through the shared receiver", async () => {
    const f = setup();
    expect(await runListen(f.options)).toBe(1);
    expect(f.endpointNames).toEqual([f.store()?.subscriptionName]);
    expect(f.handleDetail).toHaveBeenCalledOnce();
    expect(f.order).toEqual([
      "native-ready",
      "/v1/endpoints",
      `/v1/emails/${f.detail.id}`,
    ]);
    expect((await f.store()?.readEmail(f.detail.id))?.route).toMatchObject({
      kind: "notification",
      state: "accepted",
    });
    expect(f.closeReceiver).toHaveBeenCalledOnce();
    expect(f.close).toHaveBeenCalledOnce();
  });
  it("retries pending exact detail locally without leasing or completing events itself", async () => {
    const f = setup();
    f.detail.parsed.status = "pending";
    expect(await runListen(f.options)).toBe(1);
    expect(f.handleDetail).toHaveBeenCalledOnce();
    expect(f.order.filter((path) => path.includes("/emails/"))).toHaveLength(2);
  });
  it("leaves preflight errors selected and retryable, without claiming submission", async () => {
    const f = setup();
    f.handleDetail.mockRejectedValueOnce(
      new ListenStateError("session offline"),
    );
    await expect(runListen(f.options)).rejects.toThrow("session offline");
    expect((await f.store()?.readEmail(f.detail.id))?.route).toMatchObject({
      state: "selected",
    });
  });
  it("does not let another native allowlist reserve an already hydrated email", async () => {
    const f = setup(["sdk"], ["email.received"], true);
    f.options.notifySession.senders = ["other@example.com"];
    expect(await runListen(f.options)).toBe(1);
    expect((await f.store()?.readEmail(f.detail.id))?.route).toBeNull();
    expect(f.handleDetail).not.toHaveBeenCalled();
    f.options.notifySession = {
      ...f.options.notifySession,
      threadId: randomUUID(),
      senders: ["sender@example.com"],
    };
    expect(await runListen(f.options)).toBe(1);
    expect(f.handleDetail).toHaveBeenCalledOnce();
  });
  it("holds ambiguous native acceptance and never invokes a second dispatch", async () => {
    const f = setup();
    f.handleDetail.mockImplementationOnce(async () => {
      f.unknown();
      throw new ListenStateError("unknown outcome");
    });
    await expect(runListen(f.options)).rejects.toThrow("unknown outcome");
    expect((await f.store()?.readEmail(f.detail.id))?.route).toMatchObject({
      state: "unknown",
    });
    await expect(runListen(f.options)).rejects.toThrow("unknown outcome");
    expect(f.handleDetail).toHaveBeenCalledOnce();
  });
});
