import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type EmailDetail,
  PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type ContactInteraction,
  contactReference,
  prepareContactAcceptance,
  prepareContactRequest,
} from "../../src/oclif/contact-interactions.js";
import { openContactRequestNotices } from "../../src/oclif/contact-request-state.js";
import { emptyContactPolicy } from "./contact-policy-fixture.js";

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
import { CONTACT_POLICY_RETRY_MIN_MS } from "../../src/oclif/notification-contact-policy.js";
import type { DetailNotificationAuthorization } from "../../src/oclif/notify-session.js";
import { sharedMailScope } from "../../src/oclif/shared-mail-receiver.js";
import {
  createSharedMailWaiter,
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
    reply_to_sent_email_id: null as string | null,
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
      const next = {
        emailId,
        eventId,
        clientId: randomUUID(),
        state: "submitting" as const,
      };
      const reservation = authorization?.reserve?.(next);
      if (reservation === "deferred") return { disposition: "deferred" };
      if (reservation === false) return { disposition: "skipped" };
      receipt = { ...next, state: "accepted" };
      return { disposition: "notified" };
    },
  );
  const policy = emptyContactPolicy(detail.recipient);
  let contactBytes: Buffer | undefined;
  function interaction(value: ContactInteraction) {
    contactBytes = Buffer.from(JSON.stringify(value));
    detail.parsed.attachments.length = 0;
    (detail.parsed.attachments as unknown[]).push({
      filename: "interaction.json",
      content_type: "application/json",
      size_bytes: contactBytes.length,
      part_index: 0,
      sha256: createHash("sha256").update(contactBytes).digest("hex"),
    });
  }
  const identity = {
    profileName: "test",
    orgId: randomUUID(),
    agentAddress: detail.recipient,
    ownerAddress: "owner@example.com",
    apiBaseUrl: baseUrl,
  };
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
      if (path === `/v1/agent-contact-policy/${detail.recipient}`)
        return Response.json({
          success: true,
          data: policy,
        });
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
      if (path === `/v1/emails/${emailId}/attachments/0` && contactBytes)
        return new Response(new Uint8Array(contactBytes));
      throw new Error(`Unexpected remote request ${path}`);
    },
  });
  authenticate.mockReset().mockResolvedValue({
    auth: { apiKey, apiBaseUrl: baseUrl, connectedAgent: identity },
    apiClient,
  });
  const changed = vi.fn(async () => {
    detail.parsed.status = "complete";
  });
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
      changed,
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
    changed,
    notices: () => openContactRequestNotices(configDir, identity),
    receipt: () => receipt,
    order,
    detail,
    endpointNames,
    apiKey,
    baseUrl,
    handleDetail,
    apiClient,
    interaction,
    requests: (structured = true) => {
      contactRows = [];
      const since = new Date(Date.now() - 1000).toISOString();
      policy.agent_policy = {
        rules: [],
        allow_contact_requests: true,
        contact_request_since: since,
        contact_request_generation: randomUUID(),
        version: randomUUID(),
        updated_at: since,
      };
      policy.allow_contact_requests = true;
      policy.contact_request_since = since;
      policy.contact_request_generation = "b".repeat(64);
      openContactRequestNotices(configDir, identity).activate(
        Date.now() - 1000,
      );
      if (structured) {
        contactBytes = Buffer.from(
          JSON.stringify(
            prepareContactRequest(
              detail.from_email,
              "Collaborate on public research",
              600,
            ),
          ),
        );
        (detail.parsed.attachments as unknown[]).push({
          filename: "interaction.json",
          content_type: "application/json",
          size_bytes: contactBytes.length,
          part_index: 0,
          sha256: createHash("sha256").update(contactBytes).digest("hex"),
        });
      }
    },
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

describe("first-contact intake", () => {
  const requestOptions = (f: ReturnType<typeof setup>) => ({
    ...f.options,
    notifySession: {
      ...f.options.notifySession,
      senders: [],
      contactPreferences: true,
      contactRequests: true,
    },
  });
  it("keeps ordinary mail uncompleted through a transient request-only policy refresh", async () => {
    const f = setup();
    f.requests(false);
    const original = receive.getMockImplementation();
    if (!original) throw new Error("Missing shared receiver fixture");
    receive.mockImplementationOnce(async (...args: unknown[]) => {
      // Startup has a valid request-only snapshot. Its admission refresh fails.
      f.contacts([], 503);
      return original(...args);
    });
    const clock = vi.spyOn(performance, "now");
    f.changed.mockImplementationOnce(async () => {
      expect(f.handleDetail).not.toHaveBeenCalled();
      expect((await f.store()?.readEmail(f.detail.id))?.route).toBeNull();
      f.contacts([
        {
          agent_address: f.detail.recipient,
          contact_address: f.detail.from_email,
          version: randomUUID(),
          notify: true,
          notification_generation: randomUUID(),
          notify_since: new Date(Date.now() - 60_000).toISOString(),
        },
      ]);
      clock.mockReturnValue(performance.now() + CONTACT_POLICY_RETRY_MIN_MS);
    });
    try {
      expect(await runListen(requestOptions(f))).toBe(1);
      expect(f.changed).toHaveBeenCalledOnce();
      expect(f.handleDetail).toHaveBeenCalledOnce();
      expect((await f.store()?.readEmail(f.detail.id))?.route).toMatchObject({
        state: "accepted",
      });
    } finally {
      clock.mockRestore();
    }
  });
  it("notifies one authenticated structured request but does not widen to ordinary unknown mail", async () => {
    const plain = setup();
    plain.requests(false);
    expect(await runListen(requestOptions(plain))).toBe(1);
    expect(plain.handleDetail).not.toHaveBeenCalled();
    const request = setup();
    request.requests();
    expect(await runListen(requestOptions(request))).toBe(1);
    expect(request.handleDetail).toHaveBeenCalledOnce();
    expect(request.handleDetail.mock.calls[0][3]).toMatchObject({
      contactRequest: true,
    });
  });
  it.each([
    "trusted",
    "sender-mismatch",
    "signer-mismatch",
  ])("checks managed staging authentication before structured request admission: %s", async (evidence) => {
    const f = setup();
    f.detail.from_email = "agent@neutral.primitive-staging.email";
    f.detail.from_header =
      evidence === "sender-mismatch"
        ? "other@neutral.primitive-staging.email"
        : f.detail.from_email;
    Object.assign(f.detail.auth, {
      dmarcFromDomain: "primitive-staging.email",
      dkimSignatures: [
        {
          domain:
            evidence === "signer-mismatch"
              ? "primitive.email"
              : "primitive-staging.email",
          selector: "default",
          result: "pass",
          aligned: true,
          keyBits: 2048,
          algo: "rsa-sha256",
        },
      ],
    });
    f.requests();
    expect(await runListen(requestOptions(f))).toBe(1);
    expect(f.handleDetail).toHaveBeenCalledTimes(
      evidence === "trusted" ? 1 : 0,
    );
    if (evidence === "trusted") {
      expect(f.handleDetail.mock.calls[0][3]).toMatchObject({
        sender: f.detail.from_email,
        contactRequest: true,
      });
      expect(f.receipt()).toMatchObject({ state: "accepted" });
    } else {
      expect(f.receipt()).toBeNull();
    }
  });
  it.each([
    { offset: 4700, notified: true },
    { offset: -1, notified: false },
  ])("rechecks cached request-only policy for ordinary mail received $offset ms after acceptance", async ({
    offset,
    notified,
  }) => {
    const f = setup();
    f.requests(false);
    const acceptedAt = Date.now();
    const original = receive.getMockImplementation();
    if (!original) throw new Error("Missing shared receiver fixture");
    receive.mockImplementationOnce(async (...args: unknown[]) => {
      // Startup has cached request-only admission. Acceptance changes exact
      // membership before ordinary mail is read, still within the 30s cache.
      f.contacts([
        {
          agent_address: f.detail.recipient,
          contact_address: f.detail.from_email,
          version: randomUUID(),
          notify: true,
          notification_generation: randomUUID(),
          notify_since: new Date(acceptedAt).toISOString(),
        },
      ]);
      f.detail.received_at = new Date(acceptedAt + offset).toISOString();
      return original(...args);
    });

    expect(await runListen(requestOptions(f))).toBe(1);
    expect(f.handleDetail).toHaveBeenCalledTimes(notified ? 1 : 0);
    expect(
      f.order.filter((path) => path.startsWith("/v1/agent-contacts/")),
    ).toHaveLength(notified ? 3 : 2);
    if (notified) {
      expect(f.handleDetail.mock.calls[0][3]).toMatchObject({
        sender: f.detail.from_email,
        contactRequest: false,
      });
      expect((await f.store()?.readEmail(f.detail.id))?.route).toMatchObject({
        state: "accepted",
      });
      const controller = new AbortController();
      f.changed.mockImplementationOnce(async () => controller.abort());
      expect(
        await runListen({ ...requestOptions(f), signal: controller.signal }),
      ).toBe(0);
      expect(f.handleDetail).toHaveBeenCalledOnce();
    } else {
      expect((await f.store()?.readEmail(f.detail.id))?.route).toBeNull();
    }
  });
  it("keeps a request eligible after a crash between ingest and native dispatch", async () => {
    const f = setup();
    f.requests();
    f.handleDetail.mockRejectedValueOnce(
      new Error("Native session disconnected before dispatch"),
    );
    await expect(runListen(requestOptions(f))).rejects.toThrow("disconnected");
    expect((await f.store()?.readEmail(f.detail.id))?.route).toMatchObject({
      state: "selected",
    });
    expect(await runListen(requestOptions(f))).toBe(1);
    expect(f.handleDetail).toHaveBeenCalledTimes(2);
    expect((await f.store()?.readEmail(f.detail.id))?.route).toMatchObject({
      state: "accepted",
    });
  });
  it("settles a selected request that expires before the restarted listener reads it", async () => {
    const f = setup();
    f.requests();
    f.handleDetail.mockRejectedValueOnce(
      new Error("Native preflight unavailable"),
    );
    await expect(runListen(requestOptions(f))).rejects.toThrow("preflight");
    expect((await f.store()?.readEmail(f.detail.id))?.route).toMatchObject({
      state: "selected",
    });
    const now = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 601_000);
    try {
      expect(await runListen(requestOptions(f))).toBe(1);
    } finally {
      now.mockRestore();
    }
    expect((await f.store()?.readEmail(f.detail.id))?.route).toMatchObject({
      state: "skipped",
    });
    expect(f.receipt()).toBeNull();
    expect(f.handleDetail).toHaveBeenCalledOnce();
  });
  it.each([
    "duplicate",
    "expired",
  ])("durably settles a %s request without a native receipt or retry after restart", async (reason) => {
    const f = setup();
    f.requests();
    if (reason !== "expired") {
      for (let index = 0; index < 1; index++) {
        expect(
          f.notices().reserve(
            reason === "duplicate"
              ? f.detail.from_email
              : `peer${index}@example.com`,
            f.options.notifySession.threadId,
            {
              emailId: randomUUID(),
              eventId: randomUUID(),
              clientId: randomUUID(),
              state: "submitting",
            },
            [],
          ),
        ).toBe("reserved");
      }
    } else {
      const original = f.handleDetail.getMockImplementation();
      if (!original) throw new Error("Missing notification fixture");
      f.handleDetail.mockImplementationOnce(async (...args) => {
        const now = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 601_000);
        try {
          return await original(...args);
        } finally {
          now.mockRestore();
        }
      });
    }
    expect(await runListen(requestOptions(f))).toBe(1);
    expect((await f.store()?.readEmail(f.detail.id))?.route).toMatchObject({
      state: "skipped",
    });
    expect(f.receipt()).toBeNull();
    for (const threadId of [f.options.notifySession.threadId, randomUUID()]) {
      const controller = new AbortController();
      f.changed.mockImplementationOnce(async () => {
        controller.abort();
      });
      const options = requestOptions(f);
      expect(
        await runListen({
          ...options,
          signal: controller.signal,
          notifySession: { ...options.notifySession, threadId },
        }),
      ).toBe(0);
      expect(
        (
          await f
            .store()
            ?.claimForNotification(f.detail.id, `codex:${threadId}`)
        )?.status,
      ).toBe("already_observed");
    }
    expect(f.handleDetail).toHaveBeenCalledOnce();
  });
  it("retries a capacity-deferred request when a membership frees a slot, without hot polling", async () => {
    const f = setup();
    f.requests();
    for (let i = 0; i < 32; i++)
      expect(
        f.notices().reserve(
          `peer${i}@example.com`,
          f.options.notifySession.threadId,
          {
            emailId: randomUUID(),
            eventId: randomUUID(),
            clientId: randomUUID(),
            state: "submitting",
          },
          [],
        ),
      ).toBe("reserved");
    let readsAfterDeferral = 0;
    const clock = vi.spyOn(performance, "now");
    f.changed
      .mockImplementationOnce(async () => {
        expect((await f.store()?.readEmail(f.detail.id))?.route).toBeNull();
        expect(f.receipt()).toBeNull();
        readsAfterDeferral = f.order.length;
      })
      .mockImplementationOnce(async () => {
        expect(f.order.length).toBe(readsAfterDeferral);
        f.contacts([
          {
            agent_address: f.detail.recipient,
            contact_address: "peer0@example.com",
            version: randomUUID(),
            notify: false,
            notify_since: null,
            notification_generation: null,
          },
        ]);
        clock.mockReturnValue(performance.now() + 31_000);
      });
    try {
      expect(await runListen(requestOptions(f))).toBe(1);
    } finally {
      clock.mockRestore();
    }
    expect(f.handleDetail).toHaveBeenCalledTimes(2);
    expect(f.changed).toHaveBeenCalledTimes(2);
    expect((await f.store()?.readEmail(f.detail.id))?.route).toMatchObject({
      state: "accepted",
    });
    expect(f.receipt()).toMatchObject({ state: "accepted" });
  });
  it("never interprets an explicit disabled membership as an unknown request sender", async () => {
    const f = setup();
    f.requests();
    f.contacts([
      {
        agent_address: f.detail.recipient,
        contact_address: f.detail.from_email,
        version: randomUUID(),
        notify: false,
        notify_since: null,
        notification_generation: null,
      },
    ]);
    expect(await runListen(requestOptions(f))).toBe(1);
    expect(f.handleDetail).not.toHaveBeenCalled();
  });
});

describe("locally solicited notification replies", () => {
  async function solicited(kind: "contact" | "plain", mismatch?: string) {
    const f = setup();
    f.contacts([]);
    const createdAt = new Date(Date.now() - 2000).toISOString();
    const request = prepareContactRequest(
      f.detail.recipient,
      "Public coordination",
      600,
      Date.parse(createdAt),
    );
    const parent = randomUUID();
    f.detail.reply_to_sent_email_id = parent;
    if (kind === "contact") {
      const acceptance = prepareContactAcceptance(request);
      if (mismatch === "interaction")
        acceptance.interaction_id = `${randomUUID()}@example.com`;
      if (mismatch === "step") acceptance.prev_step_id = randomUUID();
      if (mismatch === "expiry")
        acceptance.expires_at = new Date(
          Date.parse(request.expires_at) + 1000,
        ).toISOString();
      if (mismatch === "expired-arrival")
        f.detail.received_at = request.expires_at;
      f.interaction(acceptance);
    }
    if (mismatch === "sender") f.detail.from_header = "different@example.com";
    if (mismatch === "before-request")
      f.detail.received_at = new Date(Date.parse(createdAt) - 1).toISOString();
    const owner = createSharedMailWaiter();
    const requestId = randomUUID();
    const original = receive.getMockImplementation();
    if (!original) throw new Error("Missing receiver fixture");
    receive.mockImplementationOnce(async (...args: unknown[]) => {
      const receiver = await original(...args);
      await receiver.store.registerWait({
        requestId,
        peer: f.detail.from_email,
        idempotencyKey: randomUUID(),
        createdAt,
        waiter: owner,
        ...(kind === "contact"
          ? { contactRequest: contactReference(request) }
          : {}),
      });
      await receiver.store.bindWait(
        requestId,
        mismatch === "parent" ? randomUUID() : parent,
      );
      if (mismatch !== "active-wait")
        await receiver.store.releaseWaiter(requestId, owner.token);
      return receiver;
    });
    const options = {
      ...f.options,
      notifySession: {
        ...f.options.notifySession,
        senders: [],
        contactPreferences: true,
      },
    };
    return { ...f, options, parent, requestId, owner };
  }
  it.each([
    "contact",
    "plain",
  ] as const)("notifies one exact late %s response with unsolicited requests disabled and no membership", async (kind) => {
    const f = await solicited(kind);
    expect(await runListen(f.options)).toBe(1);
    expect(f.handleDetail).toHaveBeenCalledOnce();
    expect(f.handleDetail.mock.calls[0][3]).toMatchObject({
      sender: f.detail.from_email,
      contactRequest: false,
    });
    expect(await f.store()?.readWait(f.requestId)).toMatchObject({
      status: "bound",
      waiters: [],
    });
    const controller = new AbortController();
    f.changed.mockImplementationOnce(async () => controller.abort());
    expect(await runListen({ ...f.options, signal: controller.signal })).toBe(
      0,
    );
    expect(f.handleDetail).toHaveBeenCalledOnce();
  });
  it.each([
    "parent",
    "sender",
    "interaction",
    "step",
    "expiry",
    "expired-arrival",
    "before-request",
  ])("does not admit a late contact response with mismatched %s", async (mismatch) => {
    const f = await solicited("contact", mismatch);
    expect(await runListen(f.options)).toBe(1);
    expect(f.handleDetail).not.toHaveBeenCalled();
  });
  it.each([
    "contact",
    "plain",
  ] as const)("retains an active %s waiter until it releases ownership", async (kind) => {
    const f = await solicited(kind, "active-wait");
    f.changed.mockImplementationOnce(async () => {
      expect(f.handleDetail).not.toHaveBeenCalled();
      await f.store()?.releaseWaiter(f.requestId, f.owner.token);
    });
    expect(await runListen(f.options)).toBe(1);
    expect(f.changed).toHaveBeenCalledOnce();
    expect(f.handleDetail).toHaveBeenCalledOnce();
  });
  it.each([
    "contact",
    "plain",
  ] as const)("keeps explicit silence authoritative for a solicited %s response", async (kind) => {
    const f = await solicited(kind);
    f.contacts([
      {
        agent_address: f.detail.recipient,
        contact_address: f.detail.from_email,
        notify: false,
        notify_since: null,
        notification_generation: null,
        version: randomUUID(),
      },
    ]);
    expect(await runListen(f.options)).toBe(1);
    expect(f.handleDetail).not.toHaveBeenCalled();
  });
});
