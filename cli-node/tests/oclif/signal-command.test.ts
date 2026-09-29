import { randomUUID } from "node:crypto";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import SignalCommand from "../../src/oclif/commands/signal.js";
import { type SignalKind, sendSignal } from "../../src/oclif/signal-command.js";

const directories: string[] = [];
afterEach(() => {
  for (const path of directories.splice(0))
    rmSync(path, { force: true, recursive: true });
  vi.restoreAllMocks();
});
function fixture() {
  const configDir = mkdtempSync(join(tmpdir(), "signal-command-"));
  directories.push(configDir);
  const id = randomUUID(),
    sender = "agent@example.test",
    peer = "peer@example.test";
  let clock = Date.now();
  const detail = {
    id,
    from_email: peer,
    from_header: peer,
    recipient: sender,
    to_email: sender,
    status: "completed",
    message_id: "<parent@example.test>",
    subject: "Task",
    body_text: "Please review",
    body_html: null,
    parsed: {
      status: "complete",
      attachments: [] as unknown[],
      references: ["<older@example.test>"],
    },
    auth: {
      dmarc: "pass",
      dmarcFromDomain: "example.test",
      dmarcDkimAligned: true,
      dkimSignatures: [],
    },
  };
  const posts: { key: string; body: Record<string, unknown> }[] = [],
    records: Record<string, unknown>[] = [];
  const state = {
    lost: false,
    malformed: false,
    status: 200,
    lookup: true,
    release: null as null | (() => void),
    delay: false,
  };
  const apiKey = ["pconn", "fixture"].join("_");
  const apiClient = new PrimitiveApiClient({
    apiKey,
    apiBaseUrl: "https://api.primitive.dev/v1",
    fetch: async (input, init) => {
      const request = new Request(input, init),
        url = new URL(request.url);
      const ok = (data: unknown) =>
        Response.json({ success: true, data, meta: { cursor: null } });
      if (url.pathname === `/v1/emails/${id}`) return ok(detail);
      if (url.pathname === "/v1/sent-emails")
        return ok(
          state.lookup
            ? records.filter(
                (row) =>
                  row.client_idempotency_key ===
                  url.searchParams.get("idempotency_key"),
              )
            : [],
        );
      if (url.pathname === "/v1/send-mail") {
        const body = (await request.json()) as Record<string, unknown>,
          key = request.headers.get("idempotency-key") ?? "";
        posts.push({ body, key });
        if (state.delay)
          await new Promise<void>((resolve) => {
            state.release = resolve;
          });
        if (state.status !== 200)
          return Response.json(
            {
              success: false,
              error: {
                code: state.status === 410 ? "sent_email_deleted" : "forbidden",
                message: "private response",
              },
            },
            { status: state.status },
          );
        const row = {
          id: randomUUID(),
          status: "delivered",
          from: sender,
          from_address: sender,
          to_address: peer,
          idempotent_replay: false,
          client_idempotency_key: key,
        };
        records.push(row);
        if (state.lost) throw new Error("private transport failure");
        return ok(
          state.malformed ? { ...row, id: "private invalid response" } : row,
        );
      }
      throw new Error(`Unexpected fixture request ${url.pathname}`);
    },
  });
  const context = {
    apiClient,
    apiKey,
    configDir,
    identity: {
      profileName: "work",
      agentAddress: sender,
      ownerAddress: "owner@example.test",
      orgId: randomUUID(),
      apiBaseUrl: "https://api.primitive.dev/v1",
    },
    now: () => clock,
  };
  const path = () =>
    join(
      configDir,
      "signals",
      readdirSync(join(configDir, "signals"))[0],
      "intent.json",
    );
  return {
    id,
    detail,
    context,
    posts,
    records,
    state,
    path,
    advance: (ms: number) => {
      clock += ms;
    },
    send: (kind: SignalKind, extra = {}) =>
      sendSignal(context, {
        id,
        kind,
        ...(kind === "ack" ? { status: "received" as const } : {}),
        ...extra,
      }),
  };
}
describe("explicit signal send", () => {
  it.each([
    "read",
    "ack",
    "working",
    "typing",
  ] as const)("sends and deduplicates %s with pinned identity and ordinary email headers", async (kind) => {
    const f = fixture();
    expect((await f.send(kind)).data.outcome).toBe("sent");
    expect((await f.send(kind)).data.outcome).toBe("already_sent");
    expect(f.posts).toHaveLength(1);
    const body = f.posts[0].body;
    expect(body).toMatchObject({
      from: f.context.identity.agentAddress,
      to: f.detail.from_email,
      in_reply_to: f.detail.message_id,
      references: ["<older@example.test>", f.detail.message_id],
    });
    const parts = body.attachments as { content_base64: string }[];
    expect(
      JSON.parse(Buffer.from(parts[0].content_base64, "base64").toString()),
    ).toMatchObject({
      protocol: kind,
      step: kind,
      payload: { subject_message_id: f.detail.message_id },
    });
    expect(readFileSync(f.path(), "utf8")).not.toContain(f.context.apiKey);
  });
  it("renews expired known activity only on explicit invocation with a fresh key", async () => {
    const f = fixture();
    await f.send("working", { expiresIn: 1 });
    f.advance(1001);
    expect((await f.send("working", { expiresIn: 2 })).data.outcome).toBe(
      "sent",
    );
    expect(f.posts).toHaveLength(2);
    expect(f.posts[0].key).not.toBe(f.posts[1].key);
  });
  it("holds unknown expired sends until exact reconciliation, then permits explicit renewal", async () => {
    const f = fixture();
    f.state.lost = true;
    expect((await f.send("typing", { expiresIn: 1 })).exitCode).toBe(4);
    f.advance(1001);
    f.state.lookup = false;
    expect((await f.send("typing")).data.outcome).toBe("uncertain");
    expect(f.posts).toHaveLength(1);
    f.state.lookup = true;
    f.state.lost = false;
    expect((await f.send("typing")).data.outcome).toBe("sent");
    expect(f.posts).toHaveLength(2);
  });
  it("reconciles a lost read response without another POST", async () => {
    const f = fixture();
    f.state.lost = true;
    await f.send("read");
    expect((await f.send("read")).data.outcome).toBe("already_sent");
    expect(f.posts).toHaveLength(1);
  });
  it("does not replay an expired prepared activity after a crash", async () => {
    const f = fixture();
    await f.send("working", { expiresIn: 1 });
    const saved = JSON.parse(readFileSync(f.path(), "utf8"));
    saved.phase = "prepared";
    saved.sentId = null;
    writeFileSync(f.path(), JSON.stringify(saved));
    f.advance(1001);
    expect((await f.send("working")).data.outcome).toBe("expired");
    expect(f.posts).toHaveLength(1);
    expect((await f.send("working")).data.outcome).toBe("sent");
    expect(f.posts).toHaveLength(2);
  });
  it("recovers a crash before dispatch using exactly the durable prepared bytes", async () => {
    const f = fixture();
    await f.send("ack");
    const saved = JSON.parse(readFileSync(f.path(), "utf8"));
    saved.phase = "prepared";
    saved.sentId = null;
    writeFileSync(f.path(), JSON.stringify(saved));
    await f.send("ack");
    expect(f.posts[1]).toEqual(f.posts[0]);
  });
  it("never treats a crash during dispatch as safe to resend", async () => {
    const f = fixture();
    await f.send("read");
    const saved = JSON.parse(readFileSync(f.path(), "utf8"));
    saved.phase = "submitting";
    saved.sentId = null;
    writeFileSync(f.path(), JSON.stringify(saved));
    f.state.lookup = false;
    expect((await f.send("read")).exitCode).toBe(4);
    expect(f.posts).toHaveLength(1);
  });
  it("holds concurrent identical dispatches behind one durable intent", async () => {
    const f = fixture();
    f.state.delay = true;
    const first = f.send("read");
    await vi.waitFor(() => expect(f.state.release).not.toBeNull());
    await expect(f.send("read")).rejects.toThrow(/listener|lock/);
    expect(f.posts).toHaveLength(1);
    f.state.release?.();
    await first;
    expect((await f.send("read")).data.outcome).toBe("already_sent");
  });
  it.each([
    "trust",
    "scope",
    "signal",
    "missing parent",
    "self",
  ])("refuses %s before sending", async (reason) => {
    const f = fixture();
    if (reason === "self") {
      f.detail.from_email = f.context.identity.agentAddress;
      f.detail.from_header = f.context.identity.agentAddress;
    }
    if (reason === "trust") f.detail.auth.dmarc = "fail";
    if (reason === "scope") f.detail.recipient = "another@example.test";
    if (reason === "signal")
      f.detail.parsed.attachments = [
        { filename: "interaction.json", content_type: "application/json" },
      ];
    if (reason === "missing parent") f.detail.message_id = "";
    await expect(f.send("read")).rejects.toThrow();
    expect(f.posts).toHaveLength(0);
  });
  it("preserves an unknown outcome for malformed post-dispatch responses", async () => {
    const f = fixture();
    f.state.malformed = true;
    const result = await f.send("read");
    expect(result.exitCode).toBe(4);
    expect(JSON.stringify(result)).not.toContain("private invalid response");
    expect(JSON.parse(readFileSync(f.path(), "utf8")).phase).toBe("uncertain");
    expect((await f.send("read")).data.outcome).toBe("already_sent");
    expect(f.posts).toHaveLength(1);
  });
  it.each([
    undefined,
    "",
    "not-a-status",
    123,
  ])("holds malformed reconciliation status %s after expiry", async (status) => {
    const f = fixture();
    f.state.lost = true;
    await f.send("typing", { expiresIn: 1 });
    f.advance(1001);
    f.records[0].status = status;
    expect((await f.send("typing")).exitCode).toBe(4);
    expect(f.posts).toHaveLength(1);
  });
  it("refuses typing above 30 seconds and working above 60", async () => {
    const f = fixture();
    await expect(f.send("typing", { expiresIn: 31 })).rejects.toThrow("1-30");
    await expect(f.send("working", { expiresIn: 61 })).rejects.toThrow("1-60");
    expect(f.posts).toHaveLength(0);
  });
  it("reports an earlier deleted send as already sent, without repeating it", async () => {
    const f = fixture();
    f.state.status = 410;
    expect((await f.send("read")).data.outcome).toBe("already_sent");
    expect((await f.send("read")).data.outcome).toBe("already_sent");
    expect(f.posts).toHaveLength(1);
  });
  it("reports definitive rejection without leaking backend text or resending", async () => {
    const f = fixture();
    f.state.status = 403;
    expect(await f.send("read")).toMatchObject({
      exitCode: 1,
      data: { outcome: "not_sent" },
    });
    const repeated = await f.send("read");
    expect(JSON.stringify(repeated)).not.toContain("private response");
    expect(f.posts).toHaveLength(1);
  });
  it("refuses corrupt durable bytes rather than preparing a different intent", async () => {
    const f = fixture();
    await f.send("read");
    const saved = JSON.parse(readFileSync(f.path(), "utf8"));
    saved.prepared.accountScope = "different";
    writeFileSync(f.path(), JSON.stringify(saved));
    await expect(f.send("read")).rejects.toThrow("Saved signal state");
    expect(f.posts).toHaveLength(1);
  });
  it.each([
    { args: [] },
    { args: ["ack", "--id", "invalid"] },
    { args: ["unknown", "--id", "invalid"] },
  ])("validates the actual bare/invalid command shape %j", async ({ args }) => {
    await expect(
      SignalCommand.run(args, { root: resolve(import.meta.dirname, "../..") }),
    ).rejects.toThrow();
  });
});
