import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type EmailDetail,
  PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import { preparePresenceProbeEmail } from "@primitivedotdev/sdk/interactions";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  agentProfileDirectory,
  connectedAgentIdentity,
  loadConnectedAgentProfile,
  saveConnectedAgentProfile,
} from "../../src/oclif/connected-agent-profile.js";
import {
  openPresenceControls,
  presenceDisposition,
} from "../../src/oclif/presence-control.js";
import { writeMailJson } from "../../src/oclif/shared-mail-files.js";

const directories: string[] = [];
const receivers: ReturnType<typeof openPresenceControls>[] = [];
afterEach(async () => {
  for (const receiver of receivers.splice(0)) await receiver.close();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
  vi.useRealTimers();
});

function fixture() {
  const configDir = mkdtempSync(join(tmpdir(), "primitive-presence-"));
  directories.push(configDir);
  const session = randomUUID();
  const profile = {
    version: 1 as const,
    auth_method: "agent_connection" as const,
    api_key: ["pconn", "fixture"].join("_"),
    api_base_url: "https://api.primitive.dev/v1",
    org_id: randomUUID(),
    agent_address: "agent@example.test",
    owner_address: "owner@example.test",
    invitation_hash: "a".repeat(64),
    created_at: new Date().toISOString(),
    presence_profile: {
      protocol: "primitive.presence" as const,
      version: 1 as const,
      authentication_profile: "primitive-issued-v1" as const,
      return_address: "owner@example.test",
    },
  };
  saveConnectedAgentProfile(configDir, "work", profile);
  writeMailJson(join(agentProfileDirectory(configDir, "work"), "setup.json"), {
    session,
    phase: "sent",
    invitationHash: profile.invitation_hash,
  });
  const preparation = preparePresenceProbeEmail(
    {
      accountScope: "issuer",
      from: profile.owner_address,
      to: profile.agent_address,
    },
    { uuid: randomUUID, nonce: () => "a".repeat(32), now: Date.now },
  );
  if (preparation.status !== "prepared")
    throw new Error("Probe preparation failed.");
  const body = JSON.parse(preparation.prepared.requestJson);
  const bytes = Buffer.from(body.attachments[0].content_base64, "base64");
  const detail = {
    id: randomUUID(),
    recipient: profile.agent_address,
    to_email: profile.agent_address,
    from_email: profile.owner_address,
    message_id: "<probe@example.test>",
    status: "completed",
    received_at: new Date().toISOString(),
    body_text: body.body_text,
    body_html: null,
    parsed: {
      status: "complete",
      body_text: body.body_text,
      body_html: null,
      references: [],
      attachments: [
        {
          filename: "interaction.json",
          content_type: "application/json",
          part_index: 0,
          size_bytes: bytes.byteLength,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        },
      ],
    },
    presence_control: { status: "verified", valid_for_ms: 300_000 },
  };
  const state = {
    detail,
    bytes,
    failSend: false,
    prior: false,
    mono: 0,
    eligible: true,
    sends: [] as Array<{ body: Record<string, unknown>; key: string }>,
    queries: 0,
    reads: 0,
  };
  const apiClient = new PrimitiveApiClient({
    apiKey: profile.api_key,
    apiBaseUrl: profile.api_base_url,
    fetch: async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      if (url.pathname === `/v1/emails/${detail.id}`) {
        state.reads++;
        return Response.json({ success: true, data: state.detail });
      }
      if (url.pathname === `/v1/emails/${detail.id}/attachments/0`)
        return new Response(new Uint8Array(state.bytes));
      if (url.pathname === "/v1/send-mail") {
        state.sends.push({
          body: (await request.json()) as Record<string, unknown>,
          key: request.headers.get("idempotency-key") ?? "",
        });
        if (state.failSend) throw new Error("Transport outcome unavailable");
        return Response.json({
          success: true,
          data: {
            id: randomUUID(),
            status: "queued",
            idempotent_replay: false,
          },
        });
      }
      if (url.pathname === "/v1/sent-emails") {
        state.queries++;
        return Response.json({
          success: true,
          data: state.prior
            ? [
                {
                  id: randomUUID(),
                  status: "queued",
                  client_idempotency_key: state.sends[0]?.key,
                  from_address: profile.agent_address,
                  to_address: profile.owner_address,
                },
              ]
            : [],
          meta: { cursor: null },
        });
      }
      throw new Error(`Unexpected fixture request: ${url.pathname}`);
    },
  });
  const options = {
    configDir,
    apiClient,
    apiKey: profile.api_key,
    baseUrl: profile.api_base_url,
    identity: connectedAgentIdentity("work", profile),
    sessionKey: `claude:${session}`,
    signal: new AbortController().signal,
    eligible: async () => state.eligible,
    monotonic: () => state.mono,
  };
  function receiver(extra: Partial<typeof options> = {}) {
    const result = openPresenceControls({ ...options, ...extra });
    receivers.push(result);
    return result;
  }
  return {
    ...state,
    state,
    detail: detail as unknown as EmailDetail,
    profile,
    configDir,
    session,
    receiver,
    options,
  };
}

describe("deterministic presence control", () => {
  it("elects one responder across concurrent receivers and preserves the exact durable reply", async () => {
    const f = fixture();
    const a = f.receiver(),
      b = f.receiver();
    const results = await Promise.all([
      a.handle(f.detail, randomUUID()),
      b.handle(f.detail, randomUUID()),
    ]);
    expect(results).toContain("quiet");
    expect(f.state.sends).toHaveLength(1);
    const sent = f.state.sends[0];
    expect(sent?.body).toMatchObject({
      from: f.profile.agent_address,
      to: f.profile.owner_address,
      in_reply_to: "<probe@example.test>",
    });
    expect(sent?.key).not.toBe("");
    expect(await a.handle(f.detail, randomUUID())).toBe("quiet");
    expect(f.state.sends).toHaveLength(1);
    const scope = readdirSync(join(f.configDir, "presence"))[0] as string;
    const intent = readdirSync(join(f.configDir, "presence", scope)).find(
      (name) => /^[a-f0-9]{64}$/.test(name),
    ) as string;
    const saved = JSON.parse(
      readFileSync(
        join(f.configDir, "presence", scope, intent, "intent.json"),
        "utf8",
      ),
    );
    expect(JSON.parse(saved.prepared.requestJson)).toEqual(sent?.body);
    expect(saved.prepared.idempotencyKey).toBe(sent?.key);
    expect(saved.phase).toBe("sent");
  });

  it("reconciles unknown sends without replay, including after receiver restart", async () => {
    const f = fixture();
    f.state.failSend = true;
    const first = f.receiver();
    expect(await first.handle(f.detail, randomUUID())).toBe("pending");
    await first.close();
    const resumed = f.receiver();
    expect(await resumed.handle(f.detail, randomUUID())).toBe("pending");
    expect(f.state.queries).toBe(1);
    expect(f.state.sends).toHaveLength(1);
    f.state.prior = true;
    expect(await resumed.handle(f.detail, randomUUID())).toBe("quiet");
    expect(f.state.sends).toHaveLength(1);
  });

  it("preserves authenticated origin across restarts and absent live projections", async () => {
    const f = fixture();
    const first = f.receiver();
    f.state.detail.presence_control.valid_for_ms = 0;
    expect(await first.handle(f.detail, randomUUID())).toBe("quiet");
    await first.close();
    const resumed = f.receiver();
    expect(resumed.knownControl(f.detail.id)).toBe(true);
    const { presence_control: _proof, ...withoutProof } = f.detail;
    expect(
      await resumed.handle(withoutProof as EmailDetail, randomUUID()),
    ).toBe("quiet");
    expect(f.state.sends).toEqual([]);
  });

  it.each(["\n", "\r\n", "\r\n\r\n"])(
    "answers canonical probe text with MIME terminal newlines %j",
    async (ending) => {
      const f = fixture();
      f.state.detail.body_text += ending;
      f.state.detail.parsed.body_text += ending;
      expect(await f.receiver().handle(f.detail, randomUUID())).toBe("quiet");
      expect(f.state.sends).toHaveLength(1);
    },
  );

  it.each([" ", " extra prose", "\nextra prose"])(
    "refuses changed probe prose %j",
    async (ending) => {
      const f = fixture();
      f.state.detail.body_text += ending;
      f.state.detail.parsed.body_text += ending;
      expect(await f.receiver().handle(f.detail, randomUUID())).toBe("quiet");
      expect(f.state.sends).toHaveLength(0);
    },
  );

  it("admits an authoritatively rejected mixed carrier through ordinary routing", async () => {
    const f = fixture();
    f.state.detail.presence_control.status = "rejected";
    f.state.detail.body_text = "Please do this user task.";
    f.state.detail.parsed.attachments.push({
      ...f.state.detail.parsed.attachments[0],
      filename: "user.json",
    });
    const receiver = f.receiver();
    expect(await receiver.handle(f.detail, randomUUID())).toBe("ordinary");
    expect(receiver.knownControl(f.detail.id)).toBe(false);
    expect(f.state.sends).toEqual([]);
  });

  it.each(["session", "invitation"])(
    "does not answer when the saved %s ownership generation changes",
    async (field) => {
      const f = fixture();
      const receiver = f.receiver();
      writeMailJson(
        join(agentProfileDirectory(f.configDir, "work"), "setup.json"),
        {
          session: field === "session" ? randomUUID() : f.session,
          phase: "sent",
          invitationHash:
            field === "invitation" ? "b".repeat(64) : f.profile.invitation_hash,
        },
      );
      expect(await receiver.handle(f.detail, randomUUID())).toBe("quiet");
      expect(f.state.sends).toEqual([]);
    },
  );

  it("refuses a profile authentication return address that does not match its owner", async () => {
    const f = fixture();
    saveConnectedAgentProfile(f.configDir, "work", {
      ...f.profile,
      presence_profile: {
        ...f.profile.presence_profile,
        return_address: "another@example.test",
      },
    });
    expect(
      loadConnectedAgentProfile(f.configDir, "work")?.presence_profile,
    ).toBeUndefined();
    expect(await f.receiver().handle(f.detail, randomUUID())).toBe("quiet");
    expect(f.state.sends).toEqual([]);
  });

  it("keeps an ordinary connection ready when a future presence profile is unsupported", async () => {
    const f = fixture();
    saveConnectedAgentProfile(f.configDir, "work", {
      ...f.profile,
      presence_profile: { ...f.profile.presence_profile, version: 2 },
    } as unknown as typeof f.profile);
    const saved = loadConnectedAgentProfile(f.configDir, "work");
    expect(saved?.api_key).toBe(f.profile.api_key);
    expect(saved?.presence_profile).toBeUndefined();
    expect(await f.receiver().handle(f.detail, randomUUID())).toBe("quiet");
    expect(f.state.sends).toEqual([]);
  });

  it("does not answer expired, unloaded or replaced bindings", async () => {
    const f = fixture();
    const receiver = f.receiver();
    f.state.mono = 300_001;
    expect(await receiver.handle(f.detail, randomUUID(), 0)).toBe("quiet");
    f.state.mono = 0;
    f.state.eligible = false;
    expect(await receiver.handle(f.detail, randomUUID())).toBe("quiet");
    f.state.eligible = true;
    saveConnectedAgentProfile(f.configDir, "work", {
      ...f.profile,
      api_key: ["pconn", "replacement"].join("_"),
    });
    expect(await receiver.handle(f.detail, randomUUID())).toBe("quiet");
    expect(f.state.sends).toEqual([]);
  });

  it("keeps historical origin quiet when the live eligibility expires", async () => {
    const f = fixture();
    f.state.detail.presence_control.valid_for_ms = 0;
    expect(await f.receiver().handle(f.detail, randomUUID())).toBe("quiet");
    expect(f.state.sends).toEqual([]);
    expect(presenceDisposition(f.detail)).toBe("quiet");
  });

  it("does not reply to alive or unsupported controls and never guesses support from old profiles", async () => {
    const f = fixture();
    const envelope = JSON.parse(f.state.bytes.toString("utf8"));
    envelope.protocol_version = 2;
    f.state.bytes = Buffer.from(JSON.stringify(envelope));
    f.state.detail.parsed.attachments[0].size_bytes = f.state.bytes.byteLength;
    f.state.detail.parsed.attachments[0].sha256 = createHash("sha256")
      .update(f.state.bytes)
      .digest("hex");
    expect(await f.receiver().handle(f.detail, randomUUID())).toBe("quiet");
    const { presence_profile: _presence, ...legacy } = f.profile;
    saveConnectedAgentProfile(f.configDir, "work", legacy);
    expect(await f.receiver().handle(f.detail, randomUUID())).toBe("quiet");
    expect(f.state.sends).toEqual([]);
  });

  it("durably defers pending provenance independently of ordinary mail and resumes by exact ID", async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.state.detail.presence_control.status = "pending";
    const first = f.receiver();
    const eventId = randomUUID();
    expect(await first.handle(f.detail, eventId)).toBe("pending");
    expect(
      await first.handle(
        {
          ...f.detail,
          presence_control: { status: "rejected", valid_for_ms: 0 },
        } as EmailDetail,
        randomUUID(),
      ),
    ).toBe("ordinary");
    await first.close();
    const onOrdinary = vi.fn(
      async (_detail: EmailDetail, _eventId: string) => true,
    );
    const resumed = openPresenceControls({
      ...f.options,
      onOrdinary,
      retryMs: 100,
    });
    receivers.push(resumed);
    await vi.advanceTimersByTimeAsync(1000);
    expect(onOrdinary).not.toHaveBeenCalled();
    expect(f.state.sends).toEqual([]);
    f.state.detail.presence_control.status = "rejected";
    f.state.mono = 1100;
    await vi.advanceTimersByTimeAsync(100);
    expect(onOrdinary).toHaveBeenCalledOnce();
    expect(onOrdinary.mock.calls[0]?.[1]).toBe(eventId);
  });

  it("never admits a deferred ID when an API downgrade removes its pending projection", async () => {
    const f = fixture();
    f.state.detail.presence_control.status = "pending";
    const first = f.receiver();
    const eventId = randomUUID();
    expect(await first.handle(f.detail, eventId)).toBe("pending");
    await first.close();
    const resumed = f.receiver();
    const { presence_control: _proof, ...withoutProof } = f.detail;
    expect(await resumed.handle(withoutProof as EmailDetail, eventId)).toBe(
      "pending",
    );
    expect(
      await resumed.handle(
        {
          ...f.detail,
          presence_control: { status: "rejected", valid_for_ms: 0 },
        },
        eventId,
      ),
    ).toBe("ordinary");
    expect(f.state.sends).toEqual([]);
  });

  it("does not answer an alive control, preventing acknowledgement loops", async () => {
    const f = fixture();
    const envelope = JSON.parse(f.state.bytes.toString("utf8"));
    envelope.step = "alive";
    f.state.bytes = Buffer.from(JSON.stringify(envelope));
    f.state.detail.parsed.attachments[0].size_bytes = f.state.bytes.byteLength;
    f.state.detail.parsed.attachments[0].sha256 = createHash("sha256")
      .update(f.state.bytes)
      .digest("hex");
    expect(await f.receiver().handle(f.detail, randomUUID())).toBe("quiet");
    expect(f.state.sends).toEqual([]);
  });

  it("bounds fast provenance retries while retaining unresolved IDs for independent reconciliation", async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.state.detail.presence_control.status = "pending";
    const receiver = openPresenceControls({ ...f.options, retryMs: 100 });
    receivers.push(receiver);
    await receiver.handle(f.detail, randomUUID());
    for (let attempt = 1; attempt <= 6; attempt++) {
      f.state.mono = attempt * 100;
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(f.state.reads).toBe(6);
    f.state.mono = 1700;
    await vi.advanceTimersByTimeAsync(1100);
    expect(f.state.reads).toBe(6);
    expect(f.state.sends).toEqual([]);
    f.state.mono = 1800;
    await vi.advanceTimersByTimeAsync(100);
    expect(f.state.reads).toBe(7);
    expect(await receiver.handle(f.detail, randomUUID())).toBe("pending");
  });

  it.each([0.5, -1, 600001, Number.NaN, Number.POSITIVE_INFINITY])(
    "defers malformed freshness %j without sending or model routing",
    async (valid_for_ms) => {
      const f = fixture();
      f.state.detail.presence_control.valid_for_ms = valid_for_ms;
      expect(await f.receiver().handle(f.detail, randomUUID())).toBe("pending");
      expect(f.state.sends).toEqual([]);
    },
  );

  it("defers changed authenticated bytes rather than replying or routing a model task", async () => {
    const f = fixture();
    f.state.bytes = Buffer.from("{}");
    expect(await f.receiver().handle(f.detail, randomUUID())).toBe("pending");
    expect(f.state.sends).toEqual([]);
  });
});
