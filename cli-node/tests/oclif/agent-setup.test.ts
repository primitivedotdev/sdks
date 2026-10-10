import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EmailDetail } from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentInvitationRejectedError } from "../../src/oclif/agent-connect.js";
import { runAgentConnect } from "../../src/oclif/agent-connect-flow.js";
import { disconnectAgent } from "../../src/oclif/agent-disconnect.js";
import {
  type AgentSetupDependencies,
  parseVerificationCheck,
  setupAgent,
  setupChallenge,
  VERIFICATION_BACKOFF_MS,
  verificationReplySubmitted,
} from "../../src/oclif/agent-setup.js";
import {
  agentProfileDirectory,
  agentProfilesDirectory,
  loadConnectedAgentProfile,
  saveConnectedAgentProfile,
} from "../../src/oclif/connected-agent-profile.js";

import { acquireListenLock } from "../../src/oclif/listen-state.js";
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
    checkVerification: vi.fn<AgentSetupDependencies["checkVerification"]>(
      async () => ({ state: "unavailable" as const }),
    ),
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
    sender_connected_agent_verified: false,
    from_header: `Owner <${identity.ownerAddress}>`,
    recipient: identity.agentAddress,
    to_email: identity.agentAddress,
    domain: "example.com",
    status: "accepted",
    created_at: new Date(now - 10_000).toISOString(),
    received_at: new Date(now - 10_000).toISOString(),
    replies: [],
    reply_count: 0,
    last_replied_at: null,
    awaiting: "you",
    automated: false,
    automated_reasons: [],
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
      receiving: { state: "hooks_pending" },
      ownerNotifications: "enabled",
    });
    expect(f.dependencies.preflight).not.toHaveBeenCalled();
    expect(f.dependencies.startListener).not.toHaveBeenCalled();
    expect(f.state().receiverMode).toBe("external");
    expect(
      await setupAgent({ ...params, invitation: undefined, resume: true }),
    ).toMatchObject({
      verification: { state: "reply_submitted" },
      receiving: { state: "hooks_pending" },
    });
    // Omitting --receiver on resume reuses the saved external receiver and
    // never probes a native socket.
    expect(await f.resume()).toMatchObject({
      receiving: { state: "hooks_pending" },
    });
    expect(f.dependencies.preflight).not.toHaveBeenCalled();
    // The conflicting option is named even though native preflight would fail.
    await expect(
      setupAgent({
        ...f.params,
        invitation: undefined,
        resume: true,
        receiverMode: "native",
      }),
    ).rejects.toThrow("--receiver native (saved: external)");
    expect(f.dependencies.preflight).not.toHaveBeenCalled();
    expect(f.dependencies.sendVerification).toHaveBeenCalledOnce();
    expect(f.fetch).toHaveBeenCalledOnce();
  });
  it("verifies poll receiving without a session, a probe or a receiver, and resumes without one", async () => {
    const f = fixture();
    const { session: _none, ...withoutSession } = f.params;
    const params = { ...withoutSession, receiverMode: "poll" as const };
    f.dependencies.preflight.mockRejectedValue(new Error("No native socket"));
    const result = await setupAgent(params);
    expect(result).toMatchObject({
      sessionId: null,
      verification: { state: "reply_submitted" },
      receiving: { state: "poll" },
      ownerNotifications: "enabled",
      resumeCommand: `primitive agent connect --profile ${f.params.profileName} --receiver poll --resume --contact-requests --json`,
    });
    expect(f.state()).toMatchObject({ session: null, receiverMode: "poll" });
    expect(f.dependencies.preflight).not.toHaveBeenCalled();
    expect(f.dependencies.startListener).not.toHaveBeenCalled();
    // A resume needs no session and keeps the saved poll receiver.
    expect(
      await setupAgent({
        ...withoutSession,
        invitation: undefined,
        resume: true,
      }),
    ).toMatchObject({ sessionId: null, receiving: { state: "poll" } });
    // A session cannot be attached to a setup that bound none.
    await expect(
      setupAgent({ ...f.params, invitation: undefined, resume: true }),
    ).rejects.toThrow("--session (this profile's setup binds no session)");
    expect(f.dependencies.sendVerification).toHaveBeenCalledOnce();
    expect(f.fetch).toHaveBeenCalledOnce();
  });
  it("refuses native and external receiving without a session before claiming", async () => {
    const f = fixture();
    const { session: _none, ...withoutSession } = f.params;
    for (const receiverMode of ["native", "external"] as const)
      await expect(
        setupAgent({ ...withoutSession, receiverMode }),
      ).rejects.toThrow(
        "Without one, use --receiver poll. No invitation was claimed.",
      );
    await expect(setupAgent(withoutSession)).rejects.toThrow(
      "No invitation was claimed.",
    );
    expect(f.fetch).not.toHaveBeenCalled();
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
  it.each(["unknown", "wait_timeout"])(
    "reports %s delivery evidence without declaring verification submitted",
    async (status) => {
      const f = fixture();
      f.dependencies.sendVerification.mockResolvedValue({
        ...f.receipt,
        status,
      });
      expect(await setupAgent(f.params)).toMatchObject({
        verification: { state: "delivery_unknown", deliveryStatus: status },
      });
      expect(await f.resume()).toMatchObject({
        verification: { state: "delivery_unknown" },
      });
      expect(f.dependencies.sendVerification).toHaveBeenCalledOnce();
    },
  );
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
    await expect(setupAgent(f.params)).rejects.toThrow(
      "fresh setup instruction",
    );
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
    ).rejects.toThrow("conflicts with --session");
    await expect(
      setupAgent({
        ...f.params,
        invitation: undefined,
        resume: true,
        contactRequests: false,
      }),
    ).rejects.toThrow("saved setup has --contact-requests");
    expect(f.fetch).toHaveBeenCalledOnce();
  });
  it("reuses the saved setup configuration when resume omits its options", async () => {
    const f = fixture();
    f.dependencies.startListener.mockResolvedValueOnce(false);
    expect(await setupAgent(f.params)).toMatchObject({
      receiving: { state: "not_ready" },
    });
    const { contactRequests: _omitted, ...withoutOptions } = f.params;
    expect(
      await setupAgent({
        ...withoutOptions,
        invitation: undefined,
        resume: true,
      }),
    ).toMatchObject({ receiving: { state: "healthy" } });
    // The listener restarts with the saved contact-request choice.
    expect(f.dependencies.startListener).toHaveBeenLastCalledWith(
      f.params.profileName,
      f.params.session,
      true,
      f.configDir,
    );
    expect(f.state().contactRequests).toBe(true);
    expect(f.dependencies.sendVerification).toHaveBeenCalledOnce();
  });
  it("refuses a different invitation on a connected profile without advising a separate profile", async () => {
    const f = fixture();
    await setupAgent(f.params);
    const claims = f.params.fetch.mock.calls.length;
    const error = await setupAgent({
      ...f.params,
      invitation: f.params.invitation.replace("#token=", "#token=next_"),
    }).catch((caught: unknown) => caught);
    const message = (error as Error).message;
    expect(message).toContain(
      "Agent profile private-session is already connected as agent@example.com with a different invitation. No invitation was claimed and nothing was changed.",
    );
    expect(message).toContain("Do not create a separate profile on your own.");
    expect(message).toContain("Ask the user whether to keep agent@example.com");
    expect(message).toContain("--replace-existing");
    expect(message).toContain("--keep-existing");
    expect(message).not.toMatch(/Use a separate profile/);
    expect(f.params.fetch.mock.calls.length).toBe(claims);
  });
  it("names an explicit option that conflicts with the saved setup", async () => {
    const f = fixture();
    await setupAgent({ ...f.params, contactRequests: false });
    const error = await setupAgent({
      ...f.params,
      invitation: undefined,
      resume: true,
      contactRequests: true,
    }).catch((caught: unknown) => caught);
    expect((error as Error).message).toContain(
      "--contact-requests (saved setup did not enable it)",
    );
    expect((error as Error).message).toContain("Omit the option");
    expect(f.state().contactRequests).toBe(false);
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
  it.each([undefined, "invalid-private-status"])(
    "keeps a successful POST with malformed status %s uncertain and resumable",
    async (status) => {
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
    },
  );
  it.each([undefined, "invalid-private-status"])(
    "does not persist malformed status %s from a verification receipt lookup",
    async (status) => {
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
    },
  );
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
  it.each(["multiple", "incomplete"])(
    "refuses %s challenge search without sending",
    async (kind) => {
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
    },
  );
  it.each(["absent", "silenced", "rate-limited"])(
    "uses conditional owner contact setup and preserves %s membership",
    async (kind) => {
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
          return ok({
            address: f.identity.ownerAddress,
            version: randomUUID(),
          });
        if (path === `/v1/agent-contacts/${f.identity.agentAddress}`)
          return ok(rows);
        if (
          path.startsWith("/v1/agent-contacts/") &&
          request.method === "PUT"
        ) {
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
    },
  );
});

describe("verification after the setup reply", () => {
  const me = (address: string, status: string, verifiedAt?: string) =>
    Response.json({
      success: true,
      data: {
        connection: {
          address,
          status,
          ...(verifiedAt ? { verified_at: verifiedAt } : {}),
        },
      },
    });
  const claimFetch = (f: ReturnType<typeof fixture>) =>
    f.fetch.getMockImplementation() as typeof globalThis.fetch;
  /** Route the claim to the fixture and status reads to `status`. */
  function routeFetch(
    f: ReturnType<typeof fixture>,
    status: () => Promise<Response>,
  ) {
    const claim = claimFetch(f);
    const reads: string[] = [];
    f.fetch.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/agent-connections/me")) {
        reads.push(
          new Headers(init?.headers).get("authorization") ?? "missing",
        );
        return status();
      }
      return claim(input, init);
    });
    return reads;
  }
  const realCheck = (f: ReturnType<typeof fixture>) => {
    const { checkVerification: _ignored, ...rest } = f.dependencies;
    return { ...f.params, dependencies: rest };
  };

  it("reports verified once the server says connected", async () => {
    const f = fixture();
    let reads = 0;
    const authorization = routeFetch(f, async () =>
      ++reads < 3
        ? me(f.identity.agentAddress, "claimed")
        : me(f.identity.agentAddress, "connected", "2026-09-28T19:00:04.000Z"),
    );
    const result = await setupAgent(realCheck(f));
    expect(result.verification).toMatchObject({
      state: "verified",
      verifiedAt: "2026-09-28T19:00:04.000Z",
      sentId: f.receipt.id,
    });
    expect(result.guidance).toContain("verified this connection");
    expect(authorization).toEqual(Array(3).fill(`Bearer ${f.credential}`));
    expect(f.dependencies.sleep.mock.calls.map(([ms]) => ms)).toEqual(
      VERIFICATION_BACKOFF_MS.slice(0, 2),
    );
    expect(JSON.stringify(result)).not.toContain(f.credential);
  });

  it("keeps reply_submitted with a pending message when the budget runs out", async () => {
    const f = fixture();
    routeFetch(f, async () => me(f.identity.agentAddress, "claimed"));
    const result = await setupAgent({
      ...realCheck(f),
      verificationTimeoutMs: 6_000,
    });
    expect(result.verification.state).toBe("reply_submitted");
    expect(result.verification).not.toHaveProperty("verifiedAt");
    expect(result.guidance).toContain("usually completes within seconds");
    const waits = f.dependencies.sleep.mock.calls.map(([ms]) => ms);
    expect(waits.reduce((sum, ms) => sum + ms, 0)).toBe(6_000);
    expect(waits).toEqual([1_000, 1_000, 2_000, 2_000]);
  });

  it("counts slow status reads against the wait and caps each read at the time left", async () => {
    const f = fixture();
    let clock = f.now;
    const budgets: number[] = [];
    const checkVerification = vi.fn<
      AgentSetupDependencies["checkVerification"]
    >(async (_context, timeoutMs) => {
      budgets.push(timeoutMs);
      clock += timeoutMs;
      return { state: "pending" };
    });
    const result = await setupAgent({
      ...f.params,
      verificationTimeoutMs: 12_000,
      dependencies: {
        ...f.dependencies,
        checkVerification,
        now: () => clock,
        sleep: vi.fn(async (ms: number) => {
          clock += ms;
        }),
      },
    });
    expect(result.verification.state).toBe("reply_submitted");
    expect(budgets).toEqual([5_000, 5_000]);
    expect(clock - f.now).toBe(12_000);
  });

  it("stops at once and keeps setup successful when the endpoint is missing", async () => {
    const f = fixture();
    let reads = 0;
    routeFetch(f, async () => {
      reads++;
      return new Response("not found", { status: 404 });
    });
    const result = await setupAgent(realCheck(f));
    expect(reads).toBe(1);
    expect(f.dependencies.sleep).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      verification: { state: "reply_submitted" },
      receiving: { state: "healthy" },
    });
  });

  it("stops at once and keeps setup successful on a network error", async () => {
    const f = fixture();
    let reads = 0;
    routeFetch(f, async () => {
      reads++;
      throw new TypeError("fetch failed");
    });
    const result = await setupAgent(realCheck(f));
    expect(reads).toBe(1);
    expect(result.verification.state).toBe("reply_submitted");
  });

  it("does not poll when the reply was not submitted", async () => {
    const f = fixture();
    f.dependencies.sendVerification.mockRejectedValueOnce(new Error("down"));
    const result = await setupAgent(f.params);
    expect(result.verification.state).toBe("send_unknown");
    expect(f.dependencies.checkVerification).not.toHaveBeenCalled();
  });

  it("skips the wait when it is disabled", async () => {
    const f = fixture();
    const result = await setupAgent({ ...f.params, verificationTimeoutMs: 0 });
    expect(result.verification.state).toBe("reply_submitted");
    expect(f.dependencies.checkVerification).not.toHaveBeenCalled();
  });

  it("treats unknown shapes, other addresses and other statuses as unavailable", () => {
    const address = "agent@example.com";
    expect(parseVerificationCheck(null, address)).toEqual({
      state: "unavailable",
    });
    expect(
      parseVerificationCheck({ success: true, data: {} }, address),
    ).toEqual({ state: "unavailable" });
    expect(
      parseVerificationCheck(
        {
          success: true,
          data: {
            connection: { address: "x@example.com", status: "connected" },
          },
        },
        address,
      ),
    ).toEqual({ state: "unavailable" });
    expect(
      parseVerificationCheck(
        { success: true, data: { connection: { address, status: "revoked" } } },
        address,
      ),
    ).toEqual({ state: "unavailable" });
    expect(
      parseVerificationCheck(
        {
          success: true,
          data: {
            connection: { address, status: "connected", verified_at: "nope" },
          },
        },
        address,
      ),
    ).toEqual({ state: "verified", verifiedAt: null });
    expect(verificationReplySubmitted("verified")).toBe(true);
    expect(verificationReplySubmitted("reply_submitted")).toBe(true);
    expect(verificationReplySubmitted("send_unknown")).toBe(false);
  });
});

describe("a definitely refused claim", () => {
  it("leaves no stub profile behind and names the spent invitation", async () => {
    const f = fixture();
    f.fetch.mockImplementation(async () =>
      Response.json(
        {
          success: false,
          error: {
            code: "connection_invitation_unavailable",
            message:
              "The invitation expired, was revoked, or has already been claimed.",
          },
        },
        { status: 409 },
      ),
    );
    await expect(setupAgent(f.params)).rejects.toThrow(
      /already used.*Nothing was changed on this machine/,
    );
    expect(
      existsSync(agentProfileDirectory(f.configDir, "private-session")),
    ).toBe(false);
    expect(f.dependencies.findChallenge).not.toHaveBeenCalled();
  });

  it("names an invitation another session on this machine already used, without a request or a stub", async () => {
    // A second session pasting an invitation a first session already claimed
    // here never reaches the server: the local claim record answers first.
    // It must say so plainly and leave no setup record for the new session.
    const f = fixture();
    await setupAgent(f.params);
    expect(f.fetch).toHaveBeenCalledOnce();
    const other = { ...f.params, profileName: "other-session" };
    const error = await setupAgent({ ...other, session: randomUUID() }).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(AgentInvitationRejectedError);
    expect(String(error)).toContain(
      "already used on this machine to connect agent@example.com",
    );
    expect(String(error)).toContain("fresh setup instruction");
    expect(String(error)).toContain("Nothing was changed on this machine");
    expect(String(error)).not.toMatch(/may have been consumed/);
    expect(f.fetch).toHaveBeenCalledOnce();
    expect(
      existsSync(agentProfileDirectory(f.configDir, "other-session")),
    ).toBe(false);
  });

  it("reports the claimed connection name on the claim and on a later resume", async () => {
    const f = fixture();
    f.fetch.mockImplementation(async () =>
      Response.json({
        success: true,
        data: {
          api_key: f.credential,
          api_base_url: "https://api.primitive-staging-1.com/v1",
          org_id: f.identity.orgId,
          owner_address: f.identity.ownerAddress,
          connection: {
            address: f.identity.agentAddress,
            owner_address: f.identity.ownerAddress,
            status: "claimed",
            name: "agent",
          },
        },
      }),
    );
    expect(await setupAgent(f.params)).toMatchObject({
      connectionName: "agent",
    });
    expect(await f.resume()).toMatchObject({ connectionName: "agent" });
    expect(f.fetch).toHaveBeenCalledOnce();
  });

  it("reports the claim journal written by an older CLI as a used invitation", async () => {
    // Older versions left the record at "attempted" even after a successful
    // claim; the saved profile shows the claim finished.
    const f = fixture();
    await setupAgent(f.params);
    const claims = join(agentProfilesDirectory(f.configDir), "claims");
    const [record] = readdirSync(claims);
    if (!record) throw new Error("Missing claim record");
    writeFileSync(
      join(claims, record),
      JSON.stringify({
        version: 1,
        profile_name: "private-session",
        status: "attempted",
      }),
      { mode: 0o600 },
    );
    await expect(
      setupAgent({
        ...f.params,
        profileName: "other-session",
        session: randomUUID(),
      }),
    ).rejects.toThrow(/already used on this machine to connect agent@/);
    expect(f.fetch).toHaveBeenCalledOnce();
  });

  it("keeps the saved setup when the claim outcome is uncertain", async () => {
    const f = fixture();
    f.fetch.mockImplementation(async () => {
      throw new Error("socket closed");
    });
    await expect(setupAgent(f.params)).rejects.toThrow(
      /may have been consumed/,
    );
    expect(f.state()).toMatchObject({ phase: "waiting" });
  });
});

describe("reconnecting a profile whose agent was revoked elsewhere", () => {
  const stopped = {
    phase: "stopped" as const,
    pid: null,
    detached: true,
    healthy: false,
    failureCode: null,
    reason: "stopped" as const,
    updatedAt: Date.now(),
  };
  // Every request with the revoked credential is refused as unauthorized.
  const revokedServer = () =>
    vi.fn<typeof globalThis.fetch>(
      async () => new Response("{}", { status: 401 }),
    );
  const reconnectInvitation = (f: ReturnType<typeof fixture>) =>
    f.params.invitation.replace("#token=", "#token=reconnect_");
  const files = (f: ReturnType<typeof fixture>) =>
    readdirSync(agentProfileDirectory(f.configDir, f.params.profileName));

  it("claims the owner's new invitation after a disconnect confirms the old credential is dead", async () => {
    const f = fixture();
    await setupAgent(f.params);
    const before = f.state();
    // --replace-existing disconnects first; the DELETE is refused with 401
    // because the owner already revoked the agent in the app.
    const disconnected = await disconnectAgent({
      configDir: f.configDir,
      profileName: f.params.profileName,
      fetch: revokedServer(),
      stopReceiver: async () => stopped,
    });
    expect(disconnected.revocation).toBe("already_revoked");
    // Without the archive, the saved setup refused this as a profile
    // "already set up with a different invitation".
    const result = await setupAgent({
      ...f.params,
      invitation: reconnectInvitation(f),
      // The saved setup's choices do not bind the replacement.
      contactRequests: false,
    });
    expect(result).toMatchObject({
      identity: f.identity,
      sessionId: f.params.session,
      verification: { state: "reply_submitted" },
    });
    expect(f.fetch).toHaveBeenCalledTimes(2);
    expect(f.state()).toMatchObject({
      session: f.params.session,
      receiverMode: "native",
      contactRequests: false,
    });
    expect(f.state().invitationHash).not.toBe(before.invitationHash);
    const archived = files(f).filter((name) =>
      /^replaced-\d+-setup\.json$/.test(name),
    );
    expect(archived).toHaveLength(1);
    expect(
      JSON.parse(
        readFileSync(
          join(
            agentProfileDirectory(f.configDir, f.params.profileName),
            archived[0] ?? "",
          ),
          "utf8",
        ),
      ).invitationHash,
    ).toBe(before.invitationHash);
    expect(f.dependencies.startListener).toHaveBeenLastCalledWith(
      f.params.profileName,
      f.params.session,
      false,
      f.configDir,
    );
  });

  it("claims it when the confirmed-dead credential could not be removed locally", async () => {
    const f = fixture();
    await setupAgent(f.params);
    const credential = loadConnectedAgentProfile(
      f.configDir,
      f.params.profileName,
    );
    await disconnectAgent({
      configDir: f.configDir,
      profileName: f.params.profileName,
      fetch: revokedServer(),
      stopReceiver: async () => stopped,
    });
    // As if local cleanup had failed after the marker was written.
    if (credential)
      saveConnectedAgentProfile(f.configDir, f.params.profileName, credential);
    await setupAgent({ ...f.params, invitation: reconnectInvitation(f) });
    expect(f.fetch).toHaveBeenCalledTimes(2);
    expect(
      files(f).filter((name) => /^replaced-\d+-connection\.json$/.test(name)),
    ).toHaveLength(1);
    expect(
      loadConnectedAgentProfile(f.configDir, f.params.profileName)
        ?.invitation_hash,
    ).toBe(f.state().invitationHash);
  });

  it("still refuses while the old credential's revocation is unconfirmed", async () => {
    const f = fixture();
    await setupAgent(f.params);
    // The DELETE is refused, but the same credential still authenticates.
    await expect(
      disconnectAgent({
        configDir: f.configDir,
        profileName: f.params.profileName,
        fetch: vi.fn<typeof globalThis.fetch>(async (input, init) =>
          new Request(input, init).method === "DELETE"
            ? new Response("{}", { status: 401 })
            : Response.json({
                success: true,
                data: {
                  connection: {
                    address: f.identity.agentAddress,
                    status: "connected",
                  },
                },
              }),
        ),
        stopReceiver: async () => stopped,
      }),
    ).rejects.toThrow("Revocation was not confirmed");
    await expect(
      setupAgent({ ...f.params, invitation: reconnectInvitation(f) }),
    ).rejects.toThrow("with a different invitation");
    expect(f.fetch).toHaveBeenCalledOnce();
    expect(files(f).some((name) => name.startsWith("replaced-"))).toBe(false);
  });

  it("does not move a revoked setup aside for a malformed invitation", async () => {
    const f = fixture();
    await setupAgent(f.params);
    await disconnectAgent({
      configDir: f.configDir,
      profileName: f.params.profileName,
      fetch: revokedServer(),
      stopReceiver: async () => stopped,
    });
    await expect(
      setupAgent({ ...f.params, invitation: "not an invitation" }),
    ).rejects.toThrow();
    expect(files(f).some((name) => name.startsWith("replaced-"))).toBe(false);
    expect(f.fetch).toHaveBeenCalledOnce();
  });

  it("reinstalls the session's Claude hooks when the same address reconnects", async () => {
    const f = fixture();
    const claudeDir = join(f.configDir, "claude");
    const bin = join(f.configDir, "bin");
    mkdirSync(claudeDir);
    mkdirSync(bin);
    const cliPath = join(bin, "run.js");
    writeFileSync(cliPath, "");
    writeFileSync(join(bin, "claude-wake.mjs"), "");
    writeFileSync(join(bin, "claude-pending-mail.mjs"), "");
    const env = {
      CLAUDE_CONFIG_DIR: claudeDir,
      CLAUDE_CODE_SESSION_ID: f.params.session,
    };
    // The real connect flow, with the real setup and hook installer; only
    // the network and receiver probes are stubbed.
    const connect = (invitation: string) =>
      runAgentConnect({
        configDir: f.configDir,
        packageRoot: f.configDir,
        cliVersion: "1.0.0",
        cliPath,
        session: f.params.session,
        profileName: f.params.profileName,
        skill: false,
        env,
        readInvitation: async () => invitation,
        dependencies: {
          setupAgent: (options) =>
            setupAgent({
              ...options,
              timeoutMs: 0,
              verificationTimeoutMs: 0,
              fetch: f.fetch,
              dependencies: f.dependencies,
            }),
          seedAgentInfo: async () => "already_present",
          awaitMailCheck: async () => ({
            state: "pending",
            lastSuccessfulMailCheckAt: null,
          }),
          refreshOwnerMemberAddress: async () => null,
        },
      });
    const stopHooks = () =>
      JSON.parse(readFileSync(join(claudeDir, "settings.json"), "utf8")).hooks
        .Stop as Array<{ hooks: Array<{ args: string[] }> }>;
    expect(await connect(f.params.invitation)).toMatchObject({
      externalHook: "installed_unverified",
    });
    expect(stopHooks()).toHaveLength(1);
    await disconnectAgent({
      configDir: f.configDir,
      profileName: f.params.profileName,
      fetch: revokedServer(),
      env,
    });
    expect(stopHooks()).toHaveLength(0);
    // The server re-invites the same address with a new credential, pasted
    // into the same session.
    expect(await connect(reconnectInvitation(f))).toMatchObject({
      status: "connected",
      address: f.identity.agentAddress,
      externalHook: "installed_unverified",
    });
    expect(
      loadConnectedAgentProfile(f.configDir, f.params.profileName),
    ).toMatchObject({ agent_address: f.identity.agentAddress });
    const hooks = stopHooks();
    expect(hooks).toHaveLength(1);
    expect(hooks[0]?.hooks[0]?.args.slice(3, 6)).toEqual([
      f.params.profileName,
      f.identity.agentAddress,
      f.params.session,
    ]);
  });

  it("refuses and moves nothing while another claim on this machine is in flight", async () => {
    const f = fixture();
    await setupAgent(f.params);
    await disconnectAgent({
      configDir: f.configDir,
      profileName: f.params.profileName,
      fetch: revokedServer(),
      stopReceiver: async () => stopped,
    });
    const before = f.state();
    // A claim-only connect into this profile holds the claim lock with its
    // request pending.
    const releaseClaim = acquireListenLock(
      agentProfilesDirectory(f.configDir),
      "agent-connection-setup",
    );
    try {
      await expect(
        setupAgent({ ...f.params, invitation: reconnectInvitation(f) }),
      ).rejects.toThrow("Another agent setup is running on this machine");
    } finally {
      releaseClaim();
    }
    expect(f.state()).toEqual(before);
    expect(files(f).some((name) => name.startsWith("replaced-"))).toBe(false);
    expect(f.fetch).toHaveBeenCalledOnce();
    // Once it is free, the same reconnect goes through.
    await setupAgent({ ...f.params, invitation: reconnectInvitation(f) });
    expect(f.fetch).toHaveBeenCalledTimes(2);
  });
});
