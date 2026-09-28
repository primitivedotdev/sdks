import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  contactReference,
  prepareContactRequest,
} from "../../src/oclif/contact-interactions.js";
import { sharedMailScope } from "../../src/oclif/shared-mail-receiver.js";
import { openSharedMailStore } from "../../src/oclif/shared-mail-state.js";
import { emptyContactPolicy } from "./contact-policy-fixture.js";

const hooks = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock("../../src/oclif/connected-reply-wait.js", () => ({
  openConnectedReplyWait: hooks.open,
}));

import {
  acceptContact,
  recoverContactRequest,
  requestContact,
  waitForContact,
} from "../../src/oclif/contact-request-commands.js";

const directories: string[] = [];
afterEach(() => {
  for (const path of directories.splice(0))
    rmSync(path, { recursive: true, force: true });
});
beforeEach(() => {
  hooks.open.mockReset();
});
function fixture() {
  const recipient = "agent@example.com",
    peer = "peer@example.net";
  const configDir = mkdtempSync(join(tmpdir(), "contact-command-"));
  directories.push(configDir);
  const sentId = randomUUID(),
    emailId = randomUUID(),
    version = randomUUID();
  const request = prepareContactRequest(
    peer,
    "Coordinate public research",
    600,
  );
  const bytes = Buffer.from(JSON.stringify(request));
  const state = {
    rows: [] as Record<string, unknown>[],
    policy: emptyContactPolicy(recipient),
    status: 200,
    sendStatus: "queued",
    membershipStatus: 200,
    sendThrows: false,
    auth: "pass",
    parsed: true,
    recovered: [] as unknown[],
  };
  const writes: {
    path: string;
    body: Record<string, unknown>;
    headers: Headers;
  }[] = [];
  const detail = {
    id: emailId,
    recipient,
    to_email: recipient,
    from_email: peer,
    from_header: peer,
    status: "completed",
    body_text: "Contact request",
    received_at: new Date().toISOString(),
    parsed: {
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
    },
    auth: {
      dmarc: "pass",
      dmarcFromDomain: "example.net",
      dmarcDkimAligned: true,
      spf: "pass",
      dkimSignatures: [],
    },
  };
  const apiClient = new PrimitiveApiClient({
    apiKey: ["pconn", "test"].join("_"),
    apiBaseUrl: "https://api.primitive.dev/v1",
    fetch: async (input, init) => {
      const req = new Request(input, init),
        path = decodeURIComponent(new URL(req.url).pathname);
      const ok = (data: unknown) =>
        Response.json({ success: true, data, meta: { cursor: null } });
      if (req.method !== "GET")
        writes.push({
          path,
          body: (await req.json()) as Record<string, unknown>,
          headers: req.headers,
        });
      if (path === "/v1/sent-emails") {
        expect(new URL(req.url).searchParams.get("limit")).toBe("2");
        expect(
          new URL(req.url).searchParams.get("idempotency_key"),
        ).toBeTruthy();
        return ok(state.recovered);
      }
      if (path === `/v1/agent-contact-policy/${recipient}`)
        return ok(state.policy);
      if (path === `/v1/agent-contacts/${recipient}`) return ok(state.rows);
      if (path === `/v1/contacts/${peer}`)
        return ok({ address: peer, version });
      if (path === `/v1/agent-contacts/${recipient}/${peer}`) {
        if (state.membershipStatus !== 200)
          return Response.json(
            { success: false, error: { code: "contact_conflict" } },
            { status: state.membershipStatus },
          );
        const row = {
          agent_address: recipient,
          contact_address: peer,
          notify: true,
          notify_since: new Date(Date.now() - 1000).toISOString(),
          notification_generation: randomUUID(),
          version,
        };
        state.rows = [row];
        return ok(row);
      }
      if (path === `/v1/emails/${emailId}`)
        return ok({ ...detail, auth: { ...detail.auth, dmarc: state.auth } });
      if (path === `/v1/emails/${emailId}/attachments/0`)
        return new Response(bytes);
      if (path === "/v1/send-mail" || path === `/v1/emails/${emailId}/reply`) {
        if (state.sendThrows) throw new Error("Connection lost after dispatch");
        if (state.status !== 200)
          return Response.json(
            { success: false, error: { code: "forbidden" } },
            { status: state.status },
          );
        return ok({
          id: sentId,
          status: state.sendStatus,
          idempotent_replay: false,
        });
      }
      throw new Error(`Unexpected request ${path}`);
    },
  });
  const wait = {
    requestId: randomUUID(),
    ready: vi.fn(async () => true),
    bind: vi.fn(),
    next: vi.fn(async (): Promise<{ id: string } | null> => null),
    observed: vi.fn(),
    finish: vi.fn(),
    close: vi.fn(),
    uncertain: vi.fn(),
    cancelBeforeSend: vi.fn(),
    cancelRejectedSend: vi.fn(),
  };
  hooks.open.mockResolvedValue(wait);
  const context = {
    apiClient,
    apiKey: ["pconn", "test"].join("_"),
    configDir,
    identity: {
      profileName: "work",
      orgId: randomUUID(),
      agentAddress: recipient,
      ownerAddress: "owner@example.com",
      apiBaseUrl: "https://api.primitive.dev/v1",
    },
  };
  const options = {
    address: peer,
    reason: "Coordinate public research",
    notify: false,
    wait: false,
    timeoutSeconds: 10,
    expiresIn: 600,
  };
  return {
    context,
    state,
    writes,
    wait,
    peer,
    recipient,
    sentId,
    emailId,
    options,
    request,
  };
}

describe("contact request command lifecycle", () => {
  it("sends a generated bounded envelope without silently creating membership and returns exact resume evidence", async () => {
    const f = fixture();
    const result = await requestContact(f.context, f.options);
    expect(result).toMatchObject({
      exitCode: 0,
      data: {
        outcome: "sent",
        sent_id: f.sentId,
        contact_accepted: false,
        next_command: `primitive contacts wait --id ${f.sentId}`,
      },
    });
    expect(f.writes.map((row) => row.path)).toEqual(["/v1/send-mail"]);
    const sent = f.writes[0];
    const part = (sent.body.attachments as { content_base64: string }[])[0];
    const envelope = JSON.parse(
      Buffer.from(part.content_base64, "base64").toString(),
    );
    expect(envelope).toMatchObject({
      protocol: "primitive.contact",
      step: "request",
      payload: { reason: f.options.reason },
    });
    expect(sent.headers.get("Idempotency-Key")).toBe(
      `contact-${envelope.step_id}`,
    );
    expect(hooks.open.mock.calls[0][0].contactRequest.stepId).toBe(
      envelope.step_id,
    );
    expect(f.wait.bind).toHaveBeenCalledWith(f.sentId);
  });
  it("requires explicit --notify before saving this agent's exact preference", async () => {
    const f = fixture();
    await requestContact(f.context, { ...f.options, notify: true });
    expect(f.writes[0].body).toEqual({ if_absent: true });
    expect(f.writes[1].body).toMatchObject({ if_absent: true, notify: true });
    expect(f.writes.at(-1)?.path).toBe("/v1/send-mail");
  });
  it.each([
    "membership",
    "policy",
  ])("does not overwrite %s silence or send a request with --notify", async (kind) => {
    const f = fixture();
    if (kind === "membership")
      f.state.rows = [
        {
          agent_address: f.recipient,
          contact_address: f.peer,
          notify: false,
          notify_since: null,
          notification_generation: null,
          version: randomUUID(),
        },
      ];
    else
      f.state.policy.org_policy = {
        ...f.state.policy.org_policy,
        version: randomUUID(),
        updated_at: new Date().toISOString(),
        rules: [
          {
            pattern: "*@example.net",
            effect: "silence",
            notify_since: null,
            notification_generation: null,
          },
        ],
      };
    await expect(
      requestContact(f.context, { ...f.options, notify: true }),
    ).rejects.toThrow("silenced");
    expect(f.writes).toEqual([]);
    expect(hooks.open).not.toHaveBeenCalled();
  });
  it("does not fabricate permission or send after directory creation followed by membership conflict", async () => {
    const f = fixture();
    f.state.membershipStatus = 409;
    await expect(
      requestContact(f.context, { ...f.options, notify: true }),
    ).rejects.toThrow();
    expect(f.writes.map((row) => row.path)).toHaveLength(2);
    expect(f.state.rows).toEqual([]);
  });
  it("returns sent-awaiting instead of suggesting resend when dedicated wait times out", async () => {
    const f = fixture();
    expect(
      await requestContact(f.context, { ...f.options, wait: true }),
    ).toMatchObject({
      exitCode: 3,
      data: { outcome: "sent_awaiting_reply", sent_id: f.sentId },
    });
    expect(f.wait.finish).not.toHaveBeenCalled();
    expect(f.wait.uncertain).not.toHaveBeenCalled();
  });
  it("marks acceptance separately from task completion without further membership writes", async () => {
    const f = fixture();
    f.wait.next.mockResolvedValue({ id: randomUUID() });
    expect(
      await requestContact(f.context, { ...f.options, wait: true }),
    ).toMatchObject({
      data: { outcome: "contact_accepted", contact_accepted: true },
    });
    expect(f.writes).toHaveLength(1);
    expect(f.wait.observed).toHaveBeenCalledOnce();
    expect(f.wait.finish).toHaveBeenCalledOnce();
  });
  it("keeps an ambiguous send held and never retries it automatically", async () => {
    const f = fixture();
    f.state.sendThrows = true;
    expect(await requestContact(f.context, f.options)).toMatchObject({
      exitCode: 4,
      data: { outcome: "uncertain", contact_accepted: false },
    });
    expect(f.writes).toHaveLength(1);
    expect(f.wait.uncertain).toHaveBeenCalledOnce();
  });
  it("classifies an authoritative refusal as not sent", async () => {
    const f = fixture();
    f.state.status = 403;
    expect(await requestContact(f.context, f.options)).toMatchObject({
      exitCode: 1,
      data: { outcome: "not_sent" },
    });
    expect(f.wait.cancelRejectedSend).toHaveBeenCalledOnce();
    expect(f.wait.uncertain).not.toHaveBeenCalled();
  });
  it("creates membership before a threaded correlated acceptance and suppresses repeated acceptance", async () => {
    const f = fixture();
    const result = await acceptContact(f.context, f.emailId);
    expect(result).toMatchObject({
      exitCode: 0,
      data: { outcome: "sent", local_preference_saved: true },
    });
    const reply = f.writes.at(-1);
    expect(reply?.path).toBe(`/v1/emails/${f.emailId}/reply`);
    const part = (reply?.body.attachments as { content_base64: string }[])[0];
    expect(
      JSON.parse(Buffer.from(part.content_base64, "base64").toString()),
    ).toMatchObject({
      step: "accept",
      interaction_id: f.request.interaction_id,
      prev_step_id: f.request.step_id,
      payload: {},
    });
    const count = f.writes.length;
    expect(await acceptContact(f.context, f.emailId)).toMatchObject({
      data: { outcome: "already_sent" },
    });
    expect(f.writes).toHaveLength(count);
  });
  it("reports saved preference separately from failed acceptance and permits safe retry only after definitive refusal", async () => {
    const f = fixture();
    f.state.status = 403;
    expect(await acceptContact(f.context, f.emailId)).toMatchObject({
      exitCode: 1,
      data: { outcome: "not_sent", local_preference_saved: true },
    });
    f.state.status = 200;
    expect(await acceptContact(f.context, f.emailId)).toMatchObject({
      exitCode: 0,
      data: { outcome: "sent" },
    });
    expect(
      f.writes.filter((row) => row.path.includes("/agent-contacts/")).length,
    ).toBe(1);
  });
  it.each([
    ["fail", "auth-suspicious", false],
    ["temperror", "dmarc-temperror", true],
  ])("reports a safe trust reason without writing preferences (%s)", async (dmarc, reason, retryable) => {
    const f = fixture();
    f.state.auth = String(dmarc);
    await expect(acceptContact(f.context, f.emailId)).rejects.toThrow(
      `authentication rejected (reason: ${reason}; retryable: ${retryable}). No acceptance or contact preference was written.`,
    );
    expect(f.writes).toEqual([]);
  });
});

it("recovers a lost send response using only its durable exact idempotency lookup", async () => {
  const f = fixture();
  const store = await openSharedMailStore({
    configDir: f.context.configDir,
    scope: sharedMailScope(f.context.apiKey, f.context.identity.apiBaseUrl),
    recipient: f.recipient,
  });
  const requestId = randomUUID(),
    key = `contact-${randomUUID()}`;
  await store.registerWait({
    requestId,
    peer: f.peer,
    idempotencyKey: key,
    createdAt: new Date().toISOString(),
    contactRequest: contactReference(f.request),
  });
  await store.markWaitUncertain(requestId);
  expect(await recoverContactRequest(f.context, requestId, 5)).toMatchObject({
    exitCode: 4,
    data: {
      outcome: "uncertain",
      next_command: `primitive contacts wait --request-id ${requestId}`,
    },
  });
  f.state.recovered = [
    {
      id: f.sentId,
      from_address: f.recipient,
      to_address: f.peer,
      client_idempotency_key: key,
      status: "delivered",
    },
  ];
  f.wait.next.mockResolvedValue({ id: randomUUID() });
  expect(await recoverContactRequest(f.context, requestId, 5)).toMatchObject({
    exitCode: 0,
    data: { outcome: "contact_accepted", sent_id: f.sentId },
  });
  expect((await store.readWait(requestId))?.sentEmailId).toBe(f.sentId);
  expect(f.writes).toEqual([]);
});

it("resumes an expired request to recover an acceptance without resending", async () => {
  const f = fixture();
  const createdAt = Date.now() - 3600_000;
  const reference = contactReference(
    prepareContactRequest(f.recipient, "Public coordination", 600, createdAt),
  );
  const store = await openSharedMailStore({
    configDir: f.context.configDir,
    scope: sharedMailScope(f.context.apiKey, f.context.identity.apiBaseUrl),
    recipient: f.recipient,
  });
  const requestId = randomUUID();
  await store.registerWait({
    requestId,
    peer: f.peer,
    idempotencyKey: `contact-${randomUUID()}`,
    createdAt: new Date(createdAt).toISOString(),
    contactRequest: reference,
  });
  await store.bindWait(requestId, f.sentId);
  f.wait.next.mockResolvedValue({ id: f.emailId });
  expect(await waitForContact(f.context, f.sentId, 5)).toMatchObject({
    data: { outcome: "contact_accepted", acceptance_email_id: f.emailId },
  });
  expect(hooks.open.mock.calls[0][0]).toMatchObject({
    sentId: f.sentId,
    contactRequest: reference,
  });
  expect(hooks.open.mock.calls[0][0].deadline).toBeGreaterThan(Date.now());
  expect(f.wait.observed).toHaveBeenCalledWith(f.emailId);
  expect(f.wait.finish).toHaveBeenCalledOnce();
  expect(f.writes).toEqual([]);
});

it("keeps recovery handles for an uncertain send record returned with HTTP success", async () => {
  const f = fixture();
  f.state.sendStatus = "unknown";
  expect(await requestContact(f.context, f.options)).toMatchObject({
    exitCode: 4,
    data: {
      outcome: "uncertain",
      sent_id: f.sentId,
      request_id: f.wait.requestId,
      next_command: `primitive contacts wait --request-id ${f.wait.requestId}`,
    },
  });
  expect(f.wait.uncertain).toHaveBeenCalledOnce();
  expect(f.wait.bind).not.toHaveBeenCalled();
});

it("returns local-request recovery after a known send whose durable binding failed", async () => {
  const f = fixture();
  f.wait.bind.mockRejectedValue(new Error("Local disk unavailable"));
  expect(await requestContact(f.context, f.options)).toMatchObject({
    exitCode: 3,
    data: {
      outcome: "sent_awaiting_reply",
      sent_id: f.sentId,
      request_id: f.wait.requestId,
      next_command: `primitive contacts wait --request-id ${f.wait.requestId}`,
    },
  });
  expect(f.writes).toHaveLength(1);
});
