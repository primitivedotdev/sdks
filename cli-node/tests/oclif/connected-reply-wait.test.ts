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
  contactReference,
  prepareContactAcceptance,
  prepareContactRequest,
} from "../../src/oclif/contact-interactions.js";
import { openSharedMailStore } from "../../src/oclif/shared-mail-state.js";

const hooks = vi.hoisted(() => ({ ready: vi.fn(), changed: vi.fn() }));
vi.mock("../../src/oclif/shared-mail-receiver.js", () => ({
  sharedMailScope: () => "test-scope",
  openSharedMailReceiver: async (options: {
    configDir: string;
    recipient: string;
  }) => {
    const store = await openSharedMailStore({
      ...options,
      scope: "test-scope",
    });
    return {
      store,
      ready: async () => {
        await hooks.ready(store);
        return { generation: "one", gapCount: 0 };
      },
      changed: async () => hooks.changed(store),
      close: async () => {},
      signal: new AbortController().signal,
    };
  },
}));

import { openConnectedReplyWait } from "../../src/oclif/connected-reply-wait.js";

const target = {
  sentId: "11111111-1111-4111-8111-111111111111",
  from: "owner@sender.example",
  recipient: "peer@agent.example",
};
const directories: string[] = [];
afterEach(() => {
  for (const dir of directories) rmSync(dir, { recursive: true, force: true });
  hooks.ready.mockReset();
  hooks.changed.mockReset();
});
function fixture() {
  const detail: EmailDetail = {
    id: "22222222-2222-4222-8222-222222222222",
    sender: target.recipient,
    from_email: target.recipient,
    from_header: `Peer <${target.recipient}>`,
    recipient: target.from,
    to_email: target.from,
    domain: "sender.example",
    status: "accepted",
    created_at: "2026-01-01T00:00:00Z",
    received_at: "2026-02-01T00:00:00Z",
    reply_to_sent_email_id: target.sentId,
    replies: [],
    reply_count: 0,
    last_replied_at: null,
    awaiting: "you",
    automated: false,
    automated_reasons: [],
    webhook_attempt_count: 0,
    body_text: "Answer",
    body_html: null,
    parsed: { status: "complete", attachments: [] },
    auth: {
      spf: "pass",
      dmarc: "pass",
      dmarcFromDomain: "agent.example",
      dmarcSpfAligned: true,
      dmarcDkimAligned: true,
      dkimSignatures: [],
      dmarcPolicy: null,
      dmarcSpfStrict: null,
      dmarcDkimStrict: null,
    },
  } satisfies EmailDetail;
  const configDir = mkdtempSync(join(tmpdir(), "reply-wait-"));
  directories.push(configDir);
  const requests: string[] = [];
  let searches = 0;
  const state = {
    detail,
    partBytes: new Uint8Array(),
    partFailure: null as "http" | "stream" | null,
    pages: [] as unknown[],
    page: { data: [{ id: detail.id }], meta: { cursor: null } } as unknown,
  };
  const apiClient = new PrimitiveApiClient({
    apiKey: ["pconn", "fixture"].join("_"),
    apiBaseUrl: "https://example.test/v1",
    fetch: async (input, init) => {
      const url = new URL(new Request(input, init).url);
      requests.push(url.pathname);
      if (url.pathname === "/v1/emails/search") {
        searches++;
        return Response.json(state.pages.shift() ?? state.page);
      }
      if (url.pathname === `/v1/emails/${detail.id}`)
        return Response.json({ data: state.detail });
      if (url.pathname === `/v1/emails/${detail.id}/attachments/0`) {
        if (state.partFailure === "http")
          return Response.json({ error: "unavailable" }, { status: 503 });
        if (state.partFailure === "stream")
          return new Response(
            new ReadableStream({
              start(controller) {
                controller.error(new Error("Temporary stream interruption"));
              },
            }),
          );
        return new Response(state.partBytes);
      }
      throw new Error(`Unexpected request ${url.pathname}`);
    },
  });
  return {
    state,
    requests,
    searches: () => searches,
    options: {
      apiClient,
      configDir,
      apiKey: ["pconn", "fixture"].join("_"),
      baseUrl: "https://example.test/v1",
      ...target,
      pageSize: 10,
    },
  };
}
describe("connected pushed reply waits", () => {
  it("registers before readiness and recovers the exact parent without inbox reads", async () => {
    const f = fixture();
    const waiter = await openConnectedReplyWait(f.options);
    hooks.ready.mockImplementation(async (store) => {
      expect((await store.readWait(waiter.requestId)).sentEmailId).toBe(
        target.sentId,
      );
    });
    expect((await waiter.next())?.id).toBe(f.state.detail.id);
    await waiter.observed(f.state.detail.id);
    await waiter.finish();
    await waiter.close();
    expect(f.requests).toEqual([
      "/v1/emails/search",
      `/v1/emails/${f.state.detail.id}`,
    ]);
  });
  it("recovers an available exact reply before reading unrelated retained history", async () => {
    const f = fixture();
    const waiter = await openConnectedReplyWait(f.options);
    const store = waiter.receiver.store;
    for (let index = 0; index < 12; index++) {
      await store.ingest({
        emailId: randomUUID(),
        eventId: randomUUID(),
        receivedAt: f.state.detail.received_at,
      });
    }
    const localPages = vi.spyOn(store, "listEmails");
    expect((await waiter.next())?.id).toBe(f.state.detail.id);
    expect(localPages).not.toHaveBeenCalled();
    expect(f.requests).toEqual([
      "/v1/emails/search",
      `/v1/emails/${f.state.detail.id}`,
    ]);
    await waiter.close();
  });
  it("interleaves only one retained page before continuing exact-parent recovery", async () => {
    const f = fixture();
    f.state.pages.push({ data: [], meta: { cursor: "next-target-page" } });
    const waiter = await openConnectedReplyWait({ ...f.options, pageSize: 1 });
    const store = waiter.receiver.store;
    for (let index = 0; index < 3; index++) {
      const emailId = randomUUID(),
        receivedAt = f.state.detail.received_at;
      await store.ingest({ emailId, eventId: randomUUID(), receivedAt });
      await store.hydrate(emailId, {
        recipient: target.from,
        peer: "other@agent.example",
        replyToSentEmailId: null,
        receivedAt,
        authorization: "trusted",
      });
    }
    const localPages = vi.spyOn(store, "listEmails");
    expect((await waiter.next())?.id).toBe(f.state.detail.id);
    expect(localPages).toHaveBeenCalledOnce();
    expect(f.requests).toEqual([
      "/v1/emails/search",
      "/v1/emails/search",
      `/v1/emails/${f.state.detail.id}`,
    ]);
    await waiter.close();
  });
  it("retries a pending exact ID locally without repeating search", async () => {
    const f = fixture();
    f.state.detail.parsed = { status: "failed", attachments: [] };
    const waiter = await openConnectedReplyWait(f.options);
    hooks.changed.mockImplementation(async () => {
      f.state.detail.parsed = { status: "complete", attachments: [] };
    });
    expect((await waiter.next())?.id).toBe(f.state.detail.id);
    expect(f.searches()).toBe(1);
    await waiter.close();
  });
  it.each([
    "http",
    "stream",
  ] as const)("retries a temporary %s contact download on the same wait and exact ID", async (failure) => {
    const f = fixture();
    const receivedAt = Date.now() - 3600_000;
    const request = prepareContactRequest(
      target.from,
      "Public coordination",
      600,
      receivedAt,
    );
    const bytes = Buffer.from(
      JSON.stringify(prepareContactAcceptance(request)),
    );
    f.state.partBytes = bytes;
    f.state.partFailure = failure;
    f.state.detail.received_at = new Date(receivedAt + 1000).toISOString();
    f.state.detail.parsed = {
      status: "complete",
      attachments: [
        {
          filename: "interaction.json",
          content_type: "application/json",
          part_index: 0,
          size_bytes: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        },
      ],
    };
    const waiter = await openConnectedReplyWait({
      ...f.options,
      contactRequest: contactReference(request),
      deadline: Date.now() + 5000,
    });
    hooks.changed.mockImplementation(async () => {
      expect(
        await waiter.receiver.store.readEmail(f.state.detail.id),
      ).toBeNull();
      f.state.partFailure = null;
    });
    expect((await waiter.next())?.id).toBe(f.state.detail.id);
    expect(hooks.changed).toHaveBeenCalledOnce();
    expect(f.searches()).toBe(1);
    expect(
      f.requests.filter((path) => path.endsWith("/attachments/0")).length,
    ).toBeGreaterThan(1);
    expect(
      (await waiter.receiver.store.readEmail(f.state.detail.id))?.route,
    ).toMatchObject({ kind: "wait", requestId: waiter.requestId });
    await waiter.close();
  });
  it("starts a new active claim when the prior wait for that parent completed", async () => {
    const f = fixture();
    const first = await openConnectedReplyWait(f.options);
    const email = await first.next();
    expect(email).not.toBeNull();
    await first.observed(f.state.detail.id);
    await first.finish();
    await first.close();
    const second = await openConnectedReplyWait({
      ...f.options,
      requestId: first.requestId,
    });
    expect(second.requestId).not.toBe(first.requestId);
    expect(
      (await second.receiver.store.readWait(second.requestId))?.status,
    ).toBe("bound");
    await second.close();
  });
  it("cleans up a new intent when binding a completed parent for another peer fails", async () => {
    const f = fixture();
    const first = await openConnectedReplyWait(f.options);
    await first.next();
    await first.observed(f.state.detail.id);
    await first.finish();
    await first.close();
    const failedId = randomUUID(),
      peer = "other@agent.example";
    await expect(
      openConnectedReplyWait({
        ...f.options,
        requestId: failedId,
        recipient: peer,
      }),
    ).rejects.toThrow("inconsistent");
    const store = first.receiver.store;
    expect((await store.readWait(failedId))?.status).toBe("cancelled");
    const emailId = randomUUID(),
      receivedAt = new Date().toISOString();
    await store.ingest({ emailId, eventId: randomUUID(), receivedAt });
    await store.hydrate(emailId, {
      recipient: target.from,
      peer,
      replyToSentEmailId: null,
      receivedAt,
      authorization: "trusted",
    });
    expect(
      (await store.claimForNotification(emailId, "runtime:session")).status,
    ).toBe("claimed");
  });

  it.each([
    "unbound",
    "uncertain",
  ] as const)("preserves a preexisting %s intent when constructor binding fails", async (status) => {
    const f = fixture();
    const first = await openConnectedReplyWait(f.options);
    await first.next();
    await first.observed(f.state.detail.id);
    await first.finish();
    await first.close();
    const store = first.receiver.store,
      requestId = randomUUID(),
      peer = "other@agent.example",
      createdAt = new Date().toISOString();
    await store.registerWait({
      requestId,
      peer,
      idempotencyKey: "saved-key",
      createdAt,
    });
    if (status === "uncertain") await store.markWaitUncertain(requestId);
    await expect(
      openConnectedReplyWait({
        ...f.options,
        requestId,
        recipient: peer,
        idempotencyKey: "saved-key",
        createdAt,
      }),
    ).rejects.toThrow("inconsistent");
    expect((await store.readWait(requestId))?.status).toBe(status);
  });

  it.each([
    "claimed",
    "observed",
    "completed",
  ] as const)("recovers only the saved exact reply after interrupted %s finalization", async (phase) => {
    const f = fixture();
    const first = await openConnectedReplyWait(f.options);
    expect((await first.next())?.id).toBe(f.state.detail.id);
    if (phase !== "claimed") await first.observed(f.state.detail.id);
    if (phase === "completed") await first.finish();
    await first.close();
    const searchCount = f.searches();
    f.requests.length = 0;
    f.state.page = { data: [{ id: randomUUID() }], meta: { cursor: null } };
    const resumed = await openConnectedReplyWait({
      ...f.options,
      resumeReply: { emailId: f.state.detail.id, requestId: first.requestId },
    });
    expect(resumed.requestId).toBe(first.requestId);
    await resumed.bind(target.sentId);
    expect((await resumed.next())?.id).toBe(f.state.detail.id);
    await resumed.observed(f.state.detail.id);
    await resumed.finish();
    expect(
      (await resumed.receiver.store.readWait(first.requestId))?.status,
    ).toBe("completed");
    expect(
      (
        await resumed.receiver.store.claimForNotification(
          f.state.detail.id,
          "runtime:session",
        )
      ).status,
    ).toBe("held");
    expect(f.searches()).toBe(searchCount);
    expect(f.requests).toEqual([`/v1/emails/${f.state.detail.id}`]);
    await resumed.close();
  });
  it("rejects a saved reply whose peer or claimed email differs", async () => {
    const f = fixture();
    const first = await openConnectedReplyWait(f.options);
    await first.next();
    await first.close();
    for (const changed of [{ recipient: "other@agent.example" }, {}]) {
      await expect(
        openConnectedReplyWait({
          ...f.options,
          ...changed,
          resumeReply: {
            emailId: changed.recipient ? f.state.detail.id : randomUUID(),
            requestId: first.requestId,
          },
        }),
      ).rejects.toThrow("saved reply does not match");
    }
  });
  it("retains a claimed reply for resume before local output completes", async () => {
    const f = fixture();
    const first = await openConnectedReplyWait(f.options);
    expect((await first.next())?.id).toBe(f.state.detail.id);
    await first.close();
    const second = await openConnectedReplyWait(f.options);
    expect(second.requestId).toBe(first.requestId);
    expect((await second.next())?.id).toBe(f.state.detail.id);
    await second.close();
  });
});

it("persists the contact wait classifier and refuses reuse as an ordinary task wait", async () => {
  const f = fixture();
  const contactRequest = contactReference(
    prepareContactRequest(target.from, "Public research", 600),
  );
  const first = await openConnectedReplyWait({ ...f.options, contactRequest });
  const requestId = first.requestId;
  expect(
    (await first.receiver.store.readWait(requestId))?.contactRequest,
  ).toEqual(contactRequest);
  await first.close();
  await expect(openConnectedReplyWait(f.options)).rejects.toThrow(
    "different reply type",
  );
  const resumed = await openConnectedReplyWait({
    ...f.options,
    contactRequest,
  });
  expect(resumed.requestId).toBe(requestId);
  await resumed.close();
});
