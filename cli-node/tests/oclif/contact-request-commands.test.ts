import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  agentProfileDirectory,
  saveConnectedAgentProfile,
} from "../../src/oclif/connected-agent-profile.js";
import {
  contactReference,
  prepareContactRequest,
} from "../../src/oclif/contact-interactions.js";
import { writeMailJson } from "../../src/oclif/shared-mail-files.js";
import { sharedMailScope } from "../../src/oclif/shared-mail-receiver.js";
import { openSharedMailStore } from "../../src/oclif/shared-mail-state.js";
import { emptyContactPolicy } from "./contact-policy-fixture.js";

const hooks = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock("../../src/oclif/connected-reply-wait.js", () => ({
  openConnectedReplyWait: hooks.open,
}));

import {
  acceptContact,
  contactRequestSessionKey,
  recoverContactRequest,
  requestContact,
  waitForContact,
} from "../../src/oclif/contact-request-commands.js";

const directories: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const path of directories.splice(0))
    rmSync(path, { recursive: true, force: true });
});
beforeEach(() => {
  hooks.open.mockReset();
  vi.stubEnv("CODEX_SESSION_ID", "");
  vi.stubEnv("CODEX_THREAD_ID", "");
  vi.stubEnv("CLAUDE_CODE_SESSION_ID", "");
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
    directoryStatus: 200,
    directoryThrows: false,
    directoryStalls: false,
    directoryAddress: peer,
    directory: null as {
      address: string;
      display_name: string | null;
      version: string;
    } | null,
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
  let resolveDirectoryStarted!: (signal: AbortSignal) => void;
  const directoryStarted = new Promise<AbortSignal>((resolve) => {
    resolveDirectoryStarted = resolve;
  });
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
      if (path === "/v1/agent-networks/default/contact-admission")
        return ok({
          allowed: false,
          allowed_since: null,
          pending: false,
          member_policy_required: false,
        });
      if (path === `/v1/agent-contact-policy/${recipient}`)
        return ok(state.policy);
      if (path === `/v1/agent-contacts/${recipient}`) return ok(state.rows);
      if (path === `/v1/contacts/${peer}`) {
        resolveDirectoryStarted(req.signal);
        if (state.directoryStalls)
          return new Promise<Response>((_resolve, reject) => {
            if (req.signal.aborted) reject(req.signal.reason);
            else
              req.signal.addEventListener(
                "abort",
                () => reject(req.signal.reason),
                { once: true },
              );
          });
        if (state.directoryStatus !== 200)
          return Response.json(
            { error: { message: "Private directory failure" } },
            { status: state.directoryStatus },
          );
        state.directory ??= { address: peer, display_name: null, version };
        if (state.directoryThrows)
          throw new Error("Private directory response lost after write");
        return ok({ ...state.directory, address: state.directoryAddress });
      }
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
  const sessionId = randomUUID();
  const invitationHash = "a".repeat(64);
  saveConnectedAgentProfile(configDir, context.identity.profileName, {
    version: 1,
    auth_method: "agent_connection",
    api_key: context.apiKey,
    api_base_url: context.identity.apiBaseUrl,
    org_id: context.identity.orgId,
    agent_address: context.identity.agentAddress,
    owner_address: context.identity.ownerAddress,
    invitation_hash: invitationHash,
    created_at: new Date().toISOString(),
  });
  const setupPath = join(
    agentProfileDirectory(configDir, context.identity.profileName),
    "setup.json",
  );
  const setup = {
    version: 1,
    session: sessionId,
    receiverMode: "external",
    invitationHash,
    since: new Date().toISOString(),
    contactRequests: true,
    challenge: null,
    phase: "sent",
    receipt: { id: randomUUID(), status: "queued" },
  };
  writeMailJson(setupPath, setup);
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
    sessionId,
    setup,
    setupPath,
    directoryStarted,
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
  it("binds an initiated request to the selected profile's verified Claude session", async () => {
    const f = fixture();
    await requestContact(f.context, f.options);
    expect(hooks.open.mock.calls[0][0].sessionKey).toBe(
      `claude:${f.sessionId}`,
    );
  });

  it("keeps a bare CLI profile manual-only without assigning another session", async () => {
    const f = fixture();
    rmSync(f.setupPath);
    expect(contactRequestSessionKey(f.context, {})).toBeNull();
    await requestContact(f.context, f.options);
    expect(hooks.open.mock.calls[0][0].sessionKey).toBeNull();
    expect(f.writes.some((row) => row.path === "/v1/send-mail")).toBe(true);
  });

  it("lets a verified poll setup request manually, but not while setup is unfinished", () => {
    const f = fixture();
    const poll = { ...f.setup, session: null, receiverMode: "poll" };
    writeMailJson(f.setupPath, poll);
    expect(contactRequestSessionKey(f.context, {})).toBeNull();
    for (const unfinished of [
      { ...poll, phase: "waiting", receipt: null },
      { ...poll, phase: "sending", receipt: null },
      { ...poll, receipt: { ...poll.receipt, status: "bounced" } },
      { ...poll, invitationHash: "b".repeat(64) },
    ]) {
      writeMailJson(f.setupPath, unfinished);
      expect(() => contactRequestSessionKey(f.context, {})).toThrow(
        "exact coding session",
      );
    }
  });

  it("uses the exact runtime identity and rejects mixed or mismatched session IDs", () => {
    const f = fixture();
    expect(contactRequestSessionKey(f.context, {})).toBe(
      `claude:${f.sessionId}`,
    );
    expect(
      contactRequestSessionKey(f.context, {
        CLAUDE_CODE_SESSION_ID: f.sessionId,
      }),
    ).toBe(`claude:${f.sessionId}`);
    expect(() =>
      contactRequestSessionKey(f.context, {
        CLAUDE_CODE_SESSION_ID: randomUUID(),
      }),
    ).toThrow("exact coding session");
    expect(() =>
      contactRequestSessionKey(f.context, {
        CLAUDE_CODE_SESSION_ID: f.sessionId,
        CODEX_SESSION_ID: randomUUID(),
      }),
    ).toThrow("exact coding session");
  });

  it("rejects incomplete or mismatched setup before touching the directory or sending", async () => {
    const f = fixture();
    writeMailJson(f.setupPath, { ...f.setup, invitationHash: "b".repeat(64) });
    await expect(requestContact(f.context, f.options)).rejects.toThrow(
      "No request was sent",
    );
    expect(f.writes).toEqual([]);
    expect(hooks.open).not.toHaveBeenCalled();
  });

  it("refuses a different live session before any contact write or email", async () => {
    const f = fixture();
    vi.stubEnv("CLAUDE_CODE_SESSION_ID", randomUUID());
    await expect(requestContact(f.context, f.options)).rejects.toThrow(
      "No request was sent",
    );
    expect(f.writes).toEqual([]);
    expect(hooks.open).not.toHaveBeenCalled();
  });

  it("requires a live exact Codex session for native setup", () => {
    const f = fixture();
    writeMailJson(f.setupPath, { ...f.setup, receiverMode: "native" });
    expect(() => contactRequestSessionKey(f.context, {})).toThrow(
      "exact coding session",
    );
    expect(
      contactRequestSessionKey(f.context, {
        CODEX_SESSION_ID: f.sessionId,
        CODEX_THREAD_ID: f.sessionId,
      }),
    ).toBe(`codex:${f.sessionId}`);
    expect(
      contactRequestSessionKey(f.context, {
        CODEX_SESSION_ID: randomUUID(),
        CODEX_THREAD_ID: f.sessionId,
      }),
    ).toBe(`codex:${f.sessionId}`);
    // Older saved native setups had no receiverMode field.
    writeMailJson(f.setupPath, { ...f.setup, receiverMode: undefined });
    expect(
      contactRequestSessionKey(f.context, { CODEX_SESSION_ID: f.sessionId }),
    ).toBe(`codex:${f.sessionId}`);
  });
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
    expect(f.writes.map((row) => row.path)).toEqual([
      `/v1/contacts/${f.peer}`,
      "/v1/send-mail",
    ]);
    expect(f.writes[0].body).toEqual({ if_absent: true });
    expect(f.state.directory?.address).toBe(f.peer);
    expect(f.state.rows).toEqual([]);
    const sent = f.writes[1];
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
  it("preserves an existing directory label and explicit silence without --notify", async () => {
    const f = fixture();
    f.state.directory = {
      address: f.peer,
      display_name: "Owner's label",
      version: randomUUID(),
    };
    const original = { ...f.state.directory };
    f.state.rows = [
      { agent_address: f.recipient, contact_address: f.peer, notify: false },
    ];
    const existingRows = structuredClone(f.state.rows);
    const result = await requestContact(f.context, f.options);
    expect(result.data.outcome).toBe("sent");
    expect(f.state.directory).toEqual(original);
    expect(f.state.rows).toEqual(existingRows);
    expect(f.writes.map((row) => row.path)).toEqual([
      `/v1/contacts/${f.peer}`,
      "/v1/send-mail",
    ]);
    expect(f.writes[0].body).toEqual({ if_absent: true });
  });
  it.each([
    403,
    409,
    429,
    503,
    "transport",
    "wrong-address",
  ])("stops before receiving or sending after directory failure %s", async (failure) => {
    const f = fixture();
    if (typeof failure === "number") f.state.directoryStatus = failure;
    else if (failure === "transport") f.state.directoryThrows = true;
    else f.state.directoryAddress = "other@example.net";
    const error = await requestContact(f.context, f.options).catch(
      (error: unknown) => error,
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("No contact email was sent");
    expect((error as Error).message).not.toContain("Private");
    expect(f.writes.map((row) => row.path)).toEqual([`/v1/contacts/${f.peer}`]);
    expect(hooks.open).not.toHaveBeenCalled();
    expect(f.state.rows).toEqual([]);
  });
  it("reuses a directory entry after its response was lost, then sends only on the explicit retry", async () => {
    const f = fixture();
    f.state.directoryThrows = true;
    await expect(requestContact(f.context, f.options)).rejects.toThrow(
      "Retrying this request is safe",
    );
    const saved = { ...f.state.directory };
    f.state.directoryThrows = false;
    expect((await requestContact(f.context, f.options)).data.outcome).toBe(
      "sent",
    );
    expect(f.state.directory).toEqual(saved);
    expect(f.writes.map((row) => row.path)).toEqual([
      `/v1/contacts/${f.peer}`,
      `/v1/contacts/${f.peer}`,
      "/v1/send-mail",
    ]);
    expect(hooks.open).toHaveBeenCalledOnce();
  });
  it("bounds a stalled directory save and never starts receiving or sends", async () => {
    const f = fixture();
    const controller = new AbortController();
    const timeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(controller.signal);
    f.state.directoryStalls = true;
    const result = requestContact(f.context, f.options);
    const rejected = expect(result).rejects.toThrow(
      "No contact email was sent",
    );
    const signal = await f.directoryStarted;
    expect(timeout).toHaveBeenCalledExactlyOnceWith(30_000);
    controller.abort();
    await rejected;
    expect(signal.aborted).toBe(true);
    expect(hooks.open).not.toHaveBeenCalled();
    expect(f.writes).toHaveLength(1);
  });
  it("retains a saved directory entry when receiver setup fails before sending", async () => {
    const f = fixture();
    f.wait.ready.mockResolvedValue(false);
    await expect(requestContact(f.context, f.options)).rejects.toThrow(
      "No request was sent",
    );
    expect(f.state.directory?.address).toBe(f.peer);
    expect(f.writes.map((row) => row.path)).toEqual([`/v1/contacts/${f.peer}`]);
    expect(f.wait.cancelBeforeSend).toHaveBeenCalledOnce();
    expect(f.wait.close).toHaveBeenCalledOnce();
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
    expect(f.writes.filter((row) => row.path === "/v1/send-mail")).toHaveLength(
      1,
    );
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
    expect(f.writes.filter((row) => row.path === "/v1/send-mail")).toHaveLength(
      1,
    );
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
      data: {
        outcome: "sent",
        local_preference_saved: true,
        acceptance_sent: true,
        delivery_status: "queued",
      },
    });
    expect(result.data).not.toHaveProperty("contact_accepted");
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
    const repeated = await acceptContact(f.context, f.emailId);
    expect(repeated).toMatchObject({
      data: { outcome: "already_sent", acceptance_sent: true },
    });
    expect(repeated.data).not.toHaveProperty("contact_accepted");
    expect(f.writes).toHaveLength(count);
  });
  it("reports saved preference separately from failed acceptance and permits safe retry only after definitive refusal", async () => {
    const f = fixture();
    f.state.status = 403;
    expect(await acceptContact(f.context, f.emailId)).toMatchObject({
      exitCode: 1,
      data: {
        outcome: "not_sent",
        local_preference_saved: true,
        acceptance_sent: false,
      },
    });
    f.state.status = 200;
    expect(await acceptContact(f.context, f.emailId)).toMatchObject({
      exitCode: 0,
      data: { outcome: "sent", acceptance_sent: true },
    });
    expect(
      f.writes.filter((row) => row.path.includes("/agent-contacts/")).length,
    ).toBe(1);
  });
  it.each([
    "transport",
    "send-record",
  ])("keeps %s uncertainty distinct from a sent acceptance, including repeated recovery", async (failure) => {
    const f = fixture();
    if (failure === "transport") f.state.sendThrows = true;
    else f.state.sendStatus = "unknown";
    const initial = await acceptContact(f.context, f.emailId);
    expect(initial).toMatchObject({
      exitCode: 4,
      data: {
        outcome: "uncertain",
        local_preference_saved: true,
        acceptance_sent: null,
      },
    });
    expect(initial.data).not.toHaveProperty("contact_accepted");
    const count = f.writes.length;
    f.state.sendThrows = false;
    f.state.sendStatus = "delivered";
    expect(await acceptContact(f.context, f.emailId)).toMatchObject({
      exitCode: 4,
      data: { outcome: "uncertain", acceptance_sent: null },
    });
    expect(f.writes).toHaveLength(count);
  });
  it("reports a refused send record truthfully and permits an explicit retry", async () => {
    const f = fixture();
    f.state.sendStatus = "gate_denied";
    const refused = await acceptContact(f.context, f.emailId);
    expect(refused).toMatchObject({
      exitCode: 1,
      data: { outcome: "not_sent", acceptance_sent: false },
    });
    expect(refused.data.guidance).toContain("was not sent");
    expect(refused.data.guidance).not.toContain("email submitted");
    f.state.sendStatus = "delivered";
    expect(await acceptContact(f.context, f.emailId)).toMatchObject({
      exitCode: 0,
      data: { outcome: "sent", acceptance_sent: true },
    });
    expect(
      f.writes.filter((row) => row.path === `/v1/emails/${f.emailId}/reply`),
    ).toHaveLength(2);
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
    sessionKey: `claude:${f.sessionId}`,
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
    sessionKey: `claude:${f.sessionId}`,
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

it("lets a bare profile manually recover an unbound contact wait", async () => {
  const f = fixture();
  rmSync(f.setupPath);
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
    createdAt: new Date().toISOString(),
    contactRequest: contactReference(f.request),
  });
  await store.bindWait(requestId, f.sentId);
  f.wait.next.mockResolvedValue({ id: f.emailId });
  expect(await waitForContact(f.context, f.sentId, 5)).toMatchObject({
    data: { outcome: "contact_accepted", acceptance_email_id: f.emailId },
  });
  expect((await store.readWait(requestId))?.sessionKey).toBeNull();
  expect(hooks.open.mock.calls[0][0].sessionKey).toBeNull();
  expect(await recoverContactRequest(f.context, requestId, 5)).toMatchObject({
    data: { outcome: "contact_accepted" },
  });
  expect(f.writes).toEqual([]);
});

it("refuses another session's wait before consuming an acceptance", async () => {
  const f = fixture();
  const store = await openSharedMailStore({
    configDir: f.context.configDir,
    scope: sharedMailScope(f.context.apiKey, f.context.identity.apiBaseUrl),
    recipient: f.recipient,
  });
  const requestId = randomUUID();
  await store.registerWait({
    requestId,
    sessionKey: `claude:${randomUUID()}`,
    peer: f.peer,
    idempotencyKey: `contact-${randomUUID()}`,
    createdAt: new Date().toISOString(),
    contactRequest: contactReference(f.request),
  });
  await store.bindWait(requestId, f.sentId);
  await expect(waitForContact(f.context, f.sentId, 5)).rejects.toThrow(
    "another or an unbound session",
  );
  await expect(recoverContactRequest(f.context, requestId, 5)).rejects.toThrow(
    "another or an unbound session",
  );
  expect(hooks.open).not.toHaveBeenCalled();
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
  expect(f.writes.filter((row) => row.path === "/v1/send-mail")).toHaveLength(
    1,
  );
});
