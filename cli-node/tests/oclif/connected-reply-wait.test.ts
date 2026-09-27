import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type EmailDetail,
  PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openSharedMailStore } from "../../src/oclif/shared-mail-state.js";

const hooks = vi.hoisted(() => ({ ready: vi.fn(), changed: vi.fn() }));
vi.mock("../../src/oclif/shared-mail-receiver.js", () => ({
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
        return Response.json(state.page);
      }
      if (url.pathname === `/v1/emails/${detail.id}`)
        return Response.json({ data: state.detail });
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
