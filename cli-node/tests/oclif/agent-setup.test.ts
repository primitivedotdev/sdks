import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EmailDetail } from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AgentSetupDependencies,
  setupAgent,
  setupChallenge,
} from "../../src/oclif/agent-setup.js";
import { agentProfileDirectory } from "../../src/oclif/connected-agent-profile.js";

import { emptyContactPolicy } from "./contact-policy-fixture.js";

const directories: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
function fixture() {
  const configDir = mkdtempSync(join(tmpdir(), "primitive-setup-"));
  directories.push(configDir);
  const profileName = "private-session";
  const session = randomUUID();
  const token = ["invitation", "a".repeat(48)].join("_");
  const credential = ["pconn", "b".repeat(48)].join("_");
  const identity = {
    profileName,
    apiBaseUrl: "https://api.primitive-staging-1.com/v1",
    orgId: randomUUID(),
    agentAddress: "agent@example.com",
    ownerAddress: "owner@example.com",
  };
  const now = Date.parse("2026-09-28T19:00:00Z");
  const challenge = {
    id: randomUUID(),
    messageId: "<challenge@example.com>",
    marker: `primitive-connection:${randomUUID()}:1`,
  };
  const receipt = { id: randomUUID(), status: "queued" };
  const fetch = vi.fn<typeof globalThis.fetch>(async () =>
    Response.json({
      success: true,
      data: {
        api_key: credential,
        api_base_url: identity.apiBaseUrl,
        org_id: identity.orgId,
        owner_address: identity.ownerAddress,
        connection: {
          address: identity.agentAddress,
          owner_address: identity.ownerAddress,
          status: "claimed",
        },
      },
    }),
  );
  const dependencies = {
    preflight: vi.fn(async () => {}),
    findChallenge: vi.fn<AgentSetupDependencies["findChallenge"]>(
      async () => challenge,
    ),
    sendVerification: vi.fn<AgentSetupDependencies["sendVerification"]>(
      async () => receipt,
    ),
    reconcile: vi.fn<AgentSetupDependencies["reconcile"]>(async () => null),
    enableOwner: vi.fn<AgentSetupDependencies["enableOwner"]>(
      async () => "enabled",
    ),
    startListener: vi.fn(async () => true),
    now: () => now,
    sleep: vi.fn<AgentSetupDependencies["sleep"]>(async () => {}),
  };
  const params = {
    configDir,
    profileName,
    session,
    contactRequests: true,
    invitation: `${identity.apiBaseUrl}/agent-connections/setup#token=${token}`,
    timeoutMs: 0,
    fetch,
    dependencies,
  };
  const detail = {
    id: challenge.id,
    message_id: challenge.messageId,
    subject: "Connect your agent to Primitive",
    sender: identity.ownerAddress,
    from_email: identity.ownerAddress,
    from_header: `Owner <${identity.ownerAddress}>`,
    recipient: identity.agentAddress,
    to_email: identity.agentAddress,
    domain: "example.com",
    status: "accepted",
    created_at: new Date(now - 10_000).toISOString(),
    received_at: new Date(now - 10_000).toISOString(),
    replies: [],
    webhook_attempt_count: 0,
    body_text: `Reply once with ${challenge.marker}`,
    body_html: null,
    parsed: { status: "complete", attachments: [] },
    auth: {
      spf: "pass",
      dmarc: "pass",
      dmarcFromDomain: "example.com",
      dmarcSpfAligned: true,
      dmarcDkimAligned: true,
      dkimSignatures: [],
      dmarcPolicy: null,
      dmarcSpfStrict: null,
      dmarcDkimStrict: null,
    },
  } satisfies EmailDetail;
  const resume = () =>
    setupAgent({ ...params, invitation: undefined, resume: true });
  return {
    params,
    dependencies,
    fetch,
    configDir,
    identity,
    detail,
    now,
    challenge,
    credential,
    token,
    receipt,
    resume,
    state: () =>
      JSON.parse(
        readFileSync(
          join(agentProfileDirectory(configDir, profileName), "setup.json"),
          "utf8",
        ),
      ),
  };
}

describe("one-command connected agent setup", () => {
  it("preflights before claiming, sends exactly once, and resumes receiving without invitations", async () => {
    const f = fixture();
    f.fetch.mockImplementationOnce(async () => {
      expect(f.dependencies.preflight).toHaveBeenCalledOnce();
      expect(f.state().phase).toBe("waiting");
      return Response.json({
        success: true,
        data: {
          api_key: f.credential,
          api_base_url: f.identity.apiBaseUrl,
          org_id: f.identity.orgId,
          owner_address: f.identity.ownerAddress,
          connection: {
            address: f.identity.agentAddress,
            owner_address: f.identity.ownerAddress,
            status: "claimed",
          },
        },
      });
    });
    f.dependencies.sendVerification.mockImplementationOnce(async () => {
      expect(f.state().phase).toBe("sending");
      return f.receipt;
    });
    const result = await setupAgent(f.params);
    expect(result).toMatchObject({
      identity: f.identity,
      verification: {
        state: "reply_submitted",
        sentId: f.receipt.id,
        deliveryStatus: "queued",
      },
      receiving: { state: "healthy" },
    });
    expect(f.dependencies.startListener).toHaveBeenCalledWith(
      f.params.profileName,
      f.params.session,
      true,
      f.configDir,
    );
    expect(JSON.stringify(result)).not.toContain(f.credential);
    expect(JSON.stringify(result)).not.toContain(f.token);
    expect(JSON.stringify(f.state())).not.toContain(f.token);
    expect(await f.resume()).toMatchObject({
      verification: { state: "reply_submitted" },
      receiving: { state: "healthy" },
    });
    expect(f.fetch).toHaveBeenCalledOnce();
    expect(f.dependencies.sendVerification).toHaveBeenCalledOnce();
    expect(f.dependencies.findChallenge).toHaveBeenCalledOnce();
  });
  it("verifies an external runtime without probing or starting a native receiver", async () => {
    const f = fixture();
    const params = { ...f.params, receiverMode: "external" as const };
    f.dependencies.preflight.mockRejectedValue(new Error("No native socket"));
    expect(await setupAgent(params)).toMatchObject({
      verification: { state: "reply_submitted" },
      receiving: { state: "external_setup_required" },
      ownerNotifications: "enabled",
    });
    expect(f.dependencies.preflight).not.toHaveBeenCalled();
    expect(f.dependencies.startListener).not.toHaveBeenCalled();
    expect(f.state().receiverMode).toBe("external");
    expect(
      await setupAgent({ ...params, invitation: undefined, resume: true }),
    ).toMatchObject({
      verification: { state: "reply_submitted" },
      receiving: { state: "external_setup_required" },
    });
    f.dependencies.preflight.mockResolvedValue(undefined);
    await expect(f.resume()).rejects.toThrow("different setup configuration");
    expect(f.dependencies.sendVerification).toHaveBeenCalledOnce();
    expect(f.fetch).toHaveBeenCalledOnce();
  });
  it("reports a recorded verification delivery failure without resending it", async () => {
    const f = fixture();
    f.dependencies.sendVerification.mockResolvedValue({
      ...f.receipt,
      status: "gate_denied",
    });
    expect(await setupAgent(f.params)).toMatchObject({
      verification: { state: "reply_failed", deliveryStatus: "gate_denied" },
    });
    expect(await f.resume()).toMatchObject({
      verification: { state: "reply_failed" },
    });
    expect(f.dependencies.sendVerification).toHaveBeenCalledOnce();
  });
  it.each([
    "unknown",
    "wait_timeout",
  ])("reports %s delivery evidence without declaring verification submitted", async (status) => {
    const f = fixture();
    f.dependencies.sendVerification.mockResolvedValue({ ...f.receipt, status });
    expect(await setupAgent(f.params)).toMatchObject({
      verification: { state: "delivery_unknown", deliveryStatus: status },
    });
    expect(await f.resume()).toMatchObject({
      verification: { state: "delivery_unknown" },
    });
    expect(f.dependencies.sendVerification).toHaveBeenCalledOnce();
  });
  it("native preflight failure cannot consume an invitation", async () => {
    const f = fixture();
    f.dependencies.preflight.mockRejectedValue(
      new Error("Private runtime diagnostic"),
    );
    await expect(setupAgent(f.params)).rejects.toThrow(
      "No invitation was claimed",
    );
    expect(f.fetch).not.toHaveBeenCalled();
  });
  it("never retries an uncertain claim on resume or repeated original input", async () => {
    const f = fixture();
    f.fetch.mockRejectedValue(new Error(f.credential));
    await expect(setupAgent(f.params)).rejects.toThrow("fresh invitation");
    await expect(f.resume()).rejects.toThrow("fresh invitation");
    await expect(setupAgent(f.params)).rejects.toThrow("fresh invitation");
    expect(f.fetch).toHaveBeenCalledOnce();
    expect(f.dependencies.sendVerification).not.toHaveBeenCalled();
  });
  it("preserves an uncertain verification send, reconciling instead of replaying", async () => {
    const f = fixture();
    f.dependencies.sendVerification.mockRejectedValue(new Error(f.credential));
    expect(await setupAgent(f.params)).toMatchObject({
      verification: { state: "send_unknown" },
      receiving: { state: "not_started" },
    });
    expect(await f.resume()).toMatchObject({
      verification: { state: "send_unknown" },
    });
    expect(f.dependencies.sendVerification).toHaveBeenCalledOnce();
    f.dependencies.reconcile.mockResolvedValue(f.receipt);
    expect(await f.resume()).toMatchObject({
      verification: { state: "reply_submitted" },
      receiving: { state: "healthy" },
    });
    expect(f.dependencies.sendVerification).toHaveBeenCalledOnce();
    expect(f.fetch).toHaveBeenCalledOnce();
  });
  it("reports an absent challenge separately and resumes bounded targeted discovery", async () => {
    const f = fixture();
    f.dependencies.findChallenge.mockResolvedValueOnce(null);
    expect(await setupAgent(f.params)).toMatchObject({
      verification: { state: "challenge_pending" },
      receiving: { state: "not_started" },
    });
    expect(f.dependencies.sendVerification).not.toHaveBeenCalled();
    expect(await f.resume()).toMatchObject({
      verification: { state: "reply_submitted" },
    });
    expect(f.fetch).toHaveBeenCalledOnce();
  });
  it("does not rewrite an existing session or notification configuration", async () => {
    const f = fixture();
    await setupAgent(f.params);
    await expect(
      setupAgent({
        ...f.params,
        invitation: undefined,
        resume: true,
        session: randomUUID(),
      }),
    ).rejects.toThrow("different setup configuration");
    await expect(
      setupAgent({
        ...f.params,
        invitation: undefined,
        resume: true,
        contactRequests: false,
      }),
    ).rejects.toThrow("different setup configuration");
    expect(f.fetch).toHaveBeenCalledOnce();
  });
  it("preserves silence and reports receiver failure without losing completed setup", async () => {
    const f = fixture();
    f.dependencies.enableOwner.mockResolvedValue("silenced");
    f.dependencies.startListener.mockRejectedValue(new Error(f.credential));
    expect(await setupAgent(f.params)).toMatchObject({
      ownerNotifications: "silenced",
      receiving: { state: "not_ready" },
      verification: { state: "reply_submitted" },
    });
    f.dependencies.startListener.mockResolvedValue(true);
    expect(await f.resume()).toMatchObject({
      ownerNotifications: "silenced",
      receiving: { state: "healthy" },
    });
    expect(f.dependencies.sendVerification).toHaveBeenCalledOnce();
  });
  it("authenticates exact fresh owner challenges and excludes spoofed, old and ambiguous markers", () => {
    const f = fixture();
    const since = new Date(f.now - 900_000).toISOString();
    expect(setupChallenge(f.detail, f.identity, since)).toEqual(f.challenge);
    expect(
      setupChallenge(
        { ...f.detail, recipient: "other@example.com" },
        f.identity,
        since,
      ),
    ).toBeNull();
    expect(
      setupChallenge(
        { ...f.detail, from_header: "evil@example.com" },
        f.identity,
        since,
      ),
    ).toBeNull();
    expect(
      setupChallenge(
        { ...f.detail, received_at: new Date(f.now - 901_000).toISOString() },
        f.identity,
        since,
      ),
    ).toBeNull();
    expect(
      setupChallenge(
        {
          ...f.detail,
          body_text: `${f.detail.body_text} primitive-connection:${randomUUID()}:2`,
        },
        f.identity,
        since,
      ),
    ).toBeNull();
    expect(
      setupChallenge(
        { ...f.detail, auth: { ...f.detail.auth, dmarc: "fail" } },
        f.identity,
        since,
      ),
    ).toBeNull();
  });
  it("default transport uses only targeted search, authenticates details, and sends a threaded idempotent reply without wait", async () => {
    const f = fixture();
    const claim = await f.fetch(f.identity.apiBaseUrl);
    f.fetch.mockClear();
    const requests: Request[] = [];
    f.fetch.mockImplementation(async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      const url = new URL(request.url);
      if (url.pathname === "/v1/agent-connections/claim") return claim;
      if (url.pathname === "/v1/emails/search") {
        expect(url.searchParams.get("from")).toBe(f.identity.ownerAddress);
        expect(url.searchParams.get("to")).toBe(f.identity.agentAddress);
        expect(url.searchParams.get("subject")).toBe(f.detail.subject);
        return Response.json({
          data: [{ id: f.challenge.id }],
          meta: { cursor: null },
        });
      }
      if (url.pathname === `/v1/emails/${f.challenge.id}`)
        return Response.json({ data: f.detail });
      if (url.pathname === "/v1/send-mail") {
        expect(f.state().phase).toBe("sending");
        expect(request.headers.get("Idempotency-Key")).toBe(
          `connection-verification-${f.state().invitationHash}`,
        );
        expect(await request.json()).toEqual({
          from: f.identity.agentAddress,
          to: f.identity.ownerAddress,
          subject: `Re: ${f.detail.subject}`,
          body_text: f.challenge.marker,
          in_reply_to: f.challenge.messageId,
          references: [f.challenge.messageId],
        });
        return Response.json({ data: f.receipt });
      }
      throw new Error("Unexpected endpoint");
    });
    const {
      findChallenge: _find,
      sendVerification: _send,
      ...dependencies
    } = f.dependencies;
    expect(await setupAgent({ ...f.params, dependencies })).toMatchObject({
      verification: { state: "reply_submitted" },
    });
    expect(requests).toHaveLength(4);
  });
  it("recovers a rate-limited challenge read without reclaiming or duplicating verification", async () => {
    const f = fixture();
    const claim = await f.fetch(f.identity.apiBaseUrl);
    let reads = 0,
      claims = 0;
    let clock = f.now;
    f.dependencies.now = () => clock;
    f.dependencies.sleep.mockImplementation(async (ms: number) => {
      clock += ms;
    });
    f.fetch.mockImplementation(async (input, init) => {
      const path = new URL(new Request(input, init).url).pathname;
      if (path.endsWith("/claim")) {
        claims++;
        return claim;
      }
      if (path.endsWith("/emails/search")) {
        reads++;
        if (reads === 1)
          return Response.json(
            { error: { private: f.credential } },
            { status: 429, headers: { "retry-after": "32" } },
          );
        return Response.json({
          data: [{ id: f.challenge.id }],
          meta: { cursor: null },
        });
      }
      return Response.json({ data: f.detail });
    });
    const { findChallenge: _find, ...dependencies } = f.dependencies;
    expect(await setupAgent({ ...f.params, dependencies })).toMatchObject({
      verification: { state: "reply_submitted" },
    });
    expect(claims).toBe(1);
    expect(reads).toBe(2);
    expect(f.dependencies.sendVerification).toHaveBeenCalledOnce();
    expect(f.dependencies.sleep).toHaveBeenCalledExactlyOnceWith(32_000);
  });
  it("never retries a rate-limited owner contact PUT", async () => {
    const f = fixture();
    const claim = await f.fetch(f.identity.apiBaseUrl);
    let writes = 0;
    f.fetch.mockImplementation(async (input, init) => {
      const request = new Request(input, init),
        path = new URL(request.url).pathname;
      if (path.endsWith("/claim")) return claim;
      if (path.startsWith("/v1/agent-contact-policy/"))
        return Response.json({
          success: true,
          data: emptyContactPolicy(f.identity.agentAddress),
        });
      if (request.method === "GET")
        return Response.json({
          success: true,
          data: [],
          meta: { cursor: null },
        });
      if (request.method === "PUT") {
        writes++;
        return Response.json(
          { error: { private: f.credential } },
          { status: 429, headers: { "retry-after": "32" } },
        );
      }
      throw new Error("Unexpected request");
    });
    const { enableOwner: _enable, ...dependencies } = f.dependencies;
    await expect(setupAgent({ ...f.params, dependencies })).rejects.toThrow(
      "Contact request failed",
    );
    expect(writes).toBe(1);
    expect(f.dependencies.sleep).not.toHaveBeenCalled();
    expect(f.dependencies.sendVerification).toHaveBeenCalledOnce();
    expect(f.state().phase).toBe("sent");
  });
  it("passes the setup deadline to owner writes and stops between directory and membership", async () => {
    const f = fixture();
    const claim = await f.fetch(f.identity.apiBaseUrl);
    const controller = new AbortController();
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) =>
      ms === 90_000 ? controller.signal : timeout(ms),
    );
    const writes: string[] = [];
    f.fetch.mockImplementation(async (input, init) => {
      const request = new Request(input, init);
      const path = new URL(request.url).pathname;
      if (path.endsWith("/claim")) return claim;
      if (path.startsWith("/v1/agent-contact-policy/"))
        return Response.json({
          success: true,
          data: emptyContactPolicy(f.identity.agentAddress),
        });
      if (request.method === "GET")
        return Response.json({
          success: true,
          data: [],
          meta: { cursor: null },
        });
      writes.push(path);
      controller.abort();
      expect(request.signal.aborted).toBe(true);
      return Response.json({
        success: true,
        data: { address: f.identity.ownerAddress },
      });
    });
    const { enableOwner: _enable, ...dependencies } = f.dependencies;
    await expect(setupAgent({ ...f.params, dependencies })).rejects.toThrow();
    expect(writes).toHaveLength(1);
    expect(writes[0]).toContain("/v1/contacts/");
    expect(f.state()).toMatchObject({ phase: "sent", receipt: f.receipt });
    expect(f.dependencies.startListener).not.toHaveBeenCalled();
  });
  it("allows the full supported challenge wait with bounded completion headroom", async () => {
    const f = fixture();
    const claim = await f.fetch(f.identity.apiBaseUrl);
    let clock = f.now;
    f.dependencies.now = () => clock;
    f.dependencies.sleep.mockImplementation(async (ms) => {
      clock += ms;
    });
    f.fetch.mockImplementation(async (input, init) => {
      const path = new URL(new Request(input, init).url).pathname;
      if (path.endsWith("/claim")) return claim;
      if (path.endsWith("/emails/search"))
        return Response.json({
          data: clock >= f.now + 120_000 ? [{ id: f.challenge.id }] : [],
          meta: { cursor: null },
        });
      return Response.json({ data: f.detail });
    });
    f.dependencies.enableOwner.mockImplementation(async (context) => {
      expect(context.readBudget.deadline).toBe(f.now + 150_000);
      expect(context.readBudget.deadline - clock).toBe(30_000);
      expect(context.signal.aborted).toBe(false);
      return "enabled";
    });
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const { findChallenge: _find, ...dependencies } = f.dependencies;
    expect(
      await setupAgent({ ...f.params, timeoutMs: 120_000, dependencies }),
    ).toMatchObject({ verification: { state: "reply_submitted" } });
    expect(clock).toBe(f.now + 120_000);
    expect(timeout).toHaveBeenCalledWith(150_000);
    expect(f.dependencies.sendVerification).toHaveBeenCalledOnce();
  });
  it.each([
    undefined,
    "invalid-private-status",
  ])("keeps a successful POST with malformed status %s uncertain and resumable", async (status) => {
    const f = fixture();
    const claim = await f.fetch(f.identity.apiBaseUrl);
    let sends = 0;
    f.fetch.mockImplementation(async (input, init) => {
      const path = new URL(new Request(input, init).url).pathname;
      if (path.endsWith("/claim")) return claim;
      if (path.endsWith("/send-mail")) {
        sends++;
        return Response.json({ data: { id: f.receipt.id, status } });
      }
      throw new Error("Unexpected request");
    });
    const { sendVerification: _send, ...dependencies } = f.dependencies;
    const result = await setupAgent({ ...f.params, dependencies });
    expect(result).toMatchObject({
      verification: { state: "send_unknown" },
      receiving: { state: "not_started" },
    });
    expect(JSON.stringify(result)).not.toContain("invalid-private-status");
    expect(f.state()).toMatchObject({ phase: "sending", receipt: null });
    f.dependencies.reconcile.mockResolvedValue(f.receipt);
    expect(await f.resume()).toMatchObject({
      verification: { state: "reply_submitted" },
    });
    expect(sends).toBe(1);
  });
  it.each([
    undefined,
    "invalid-private-status",
  ])("does not persist malformed status %s from a verification receipt lookup", async (status) => {
    const f = fixture();
    f.dependencies.sendVerification.mockRejectedValue(
      new Error("Uncertain send"),
    );
    await setupAgent(f.params);
    f.fetch.mockImplementation(async () =>
      Response.json({
        data: [
          {
            id: f.receipt.id,
            status,
            client_idempotency_key: `connection-verification-${f.state().invitationHash}`,
            from_address: f.identity.agentAddress,
            to_address: f.identity.ownerAddress,
          },
        ],
        meta: { cursor: null },
      }),
    );
    const { reconcile: _reconcile, ...dependencies } = f.dependencies;
    await expect(
      setupAgent({
        ...f.params,
        invitation: undefined,
        resume: true,
        dependencies,
      }),
    ).rejects.toThrow("receipt is incomplete or invalid");
    expect(f.state()).toMatchObject({ phase: "sending", receipt: null });
    expect(f.dependencies.sendVerification).toHaveBeenCalledOnce();
    expect(f.dependencies.startListener).not.toHaveBeenCalled();
    f.dependencies.reconcile.mockResolvedValue(f.receipt);
    expect(await f.resume()).toMatchObject({
      verification: { state: "reply_submitted" },
    });
  });
  it("never retries a rate-limited verification POST", async () => {
    const f = fixture();
    const claim = await f.fetch(f.identity.apiBaseUrl);
    let sends = 0;
    f.fetch.mockImplementation(async (input, init) => {
      const request = new Request(input, init),
        path = new URL(request.url).pathname;
      if (path.endsWith("/claim")) return claim;
      if (path.endsWith("/send-mail")) {
        sends++;
        return Response.json(
          { error: { private: f.credential } },
          { status: 429, headers: { "retry-after": "32" } },
        );
      }
      throw new Error("Unexpected request");
    });
    const { sendVerification: _send, ...dependencies } = f.dependencies;
    expect(await setupAgent({ ...f.params, dependencies })).toMatchObject({
      verification: { state: "send_unknown" },
    });
    expect(sends).toBe(1);
    expect(f.dependencies.sleep).not.toHaveBeenCalled();
  });
  it.each([
    "multiple",
    "incomplete",
  ])("refuses %s challenge search without sending", async (kind) => {
    const f = fixture();
    const claim = await f.fetch(f.identity.apiBaseUrl);
    f.fetch.mockImplementation(async (input, init) => {
      const path = new URL(new Request(input, init).url).pathname;
      if (path.endsWith("/claim")) return claim;
      if (path.endsWith("/emails/search"))
        return Response.json({
          data: [
            { id: f.challenge.id },
            ...(kind === "multiple" ? [{ id: randomUUID() }] : []),
          ],
          meta: { cursor: kind === "incomplete" ? "more" : null },
        });
      if (path.includes("/emails/"))
        return Response.json({
          data: { ...f.detail, id: path.split("/").at(-1) },
        });
      throw new Error("Unexpected request");
    });
    const { findChallenge: _find, ...dependencies } = f.dependencies;
    await expect(setupAgent({ ...f.params, dependencies })).rejects.toThrow(
      /ambiguous|Several/,
    );
    expect(f.dependencies.sendVerification).not.toHaveBeenCalled();
  });
  it.each([
    "absent",
    "silenced",
    "rate-limited",
  ])("uses conditional owner contact setup and preserves %s membership", async (kind) => {
    const f = fixture();
    const claim = await f.fetch(f.identity.apiBaseUrl);
    let clock = f.now;
    f.dependencies.now = () => clock;
    f.dependencies.sleep.mockImplementation(async (ms: number) => {
      clock += ms;
    });
    let limited = kind === "rate-limited";
    let policyReads = 0;
    const rows: Array<Record<string, unknown>> =
      kind === "silenced"
        ? [
            {
              agent_address: f.identity.agentAddress,
              contact_address: f.identity.ownerAddress,
              notify: false,
              notify_since: null,
              notification_generation: null,
              version: randomUUID(),
            },
          ]
        : [];
    const writes: Record<string, unknown>[] = [];
    f.fetch.mockImplementation(async (input, init) => {
      const request = new Request(input, init);
      const path = decodeURIComponent(new URL(request.url).pathname);
      const ok = (data: unknown) =>
        Response.json({ success: true, data, meta: { cursor: null } });
      if (path.endsWith("/claim")) return claim;
      if (path.startsWith("/v1/agent-contact-policy/")) {
        policyReads++;
        if (limited) {
          limited = false;
          return Response.json(
            { error: { private: "do not print" } },
            { status: 429, headers: { "retry-after": "32" } },
          );
        }
        return ok(emptyContactPolicy(f.identity.agentAddress));
      }
      if (path === `/v1/contacts/${f.identity.ownerAddress}`)
        return ok({ address: f.identity.ownerAddress, version: randomUUID() });
      if (path === `/v1/agent-contacts/${f.identity.agentAddress}`)
        return ok(rows);
      if (path.startsWith("/v1/agent-contacts/") && request.method === "PUT") {
        const body = (await request.json()) as Record<string, unknown>;
        writes.push(body);
        const row = {
          agent_address: f.identity.agentAddress,
          contact_address: f.identity.ownerAddress,
          notify: true,
          notify_since: new Date(Date.now() - 1000).toISOString(),
          notification_generation: randomUUID(),
          version: randomUUID(),
        };
        rows.push(row);
        return ok(row);
      }
      throw new Error("Unexpected request");
    });
    const { enableOwner: _enable, ...dependencies } = f.dependencies;
    expect(await setupAgent({ ...f.params, dependencies })).toMatchObject({
      ownerNotifications: kind === "silenced" ? "silenced" : "enabled",
    });
    expect(writes).toHaveLength(kind === "silenced" ? 0 : 1);
    if (writes.length)
      expect(writes[0]).toMatchObject({ if_absent: true, notify: true });
    if (kind === "rate-limited") {
      expect(f.dependencies.sleep).toHaveBeenCalledExactlyOnceWith(32_000);
      expect(policyReads).toBeGreaterThanOrEqual(3);
    }
  });
});
