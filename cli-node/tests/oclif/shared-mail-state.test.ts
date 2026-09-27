import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  openSharedMailStore,
  reserveSharedMailSubscription,
  type SharedMailStore,
} from "../../src/oclif/shared-mail-state.js";

vi.mock("node:fs", async (original) => ({
  ...(await original<typeof import("node:fs")>()),
}));
let configDir: string, store: SharedMailStore;
const recipient = "device@example.com",
  peer = "person@example.com";
beforeEach(async () => {
  configDir = mkdtempSync(join(tmpdir(), "primitive-mail-state-"));
  store = await openSharedMailStore({ configDir, scope: "fixture", recipient });
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(configDir, { recursive: true, force: true });
});
const intent = (sessionKey: string | null = null) => ({
  requestId: randomUUID(),
  peer,
  sessionKey,
  idempotencyKey: randomUUID(),
  createdAt: new Date(Date.now() - 1000).toISOString(),
});
async function received(
  parent: string | null = null,
  authorization: "pending" | "trusted" | "rejected" = "trusted",
) {
  const emailId = randomUUID(),
    eventId = randomUUID(),
    receivedAt = new Date().toISOString();
  await store.ingest({ emailId, eventId, receivedAt });
  await store.hydrate(emailId, {
    recipient,
    peer,
    replyToSentEmailId: parent,
    receivedAt,
    authorization,
  });
  return { emailId, eventId, receivedAt };
}
describe("shared mail ingress and claims", () => {
  it("bootstraps notify first and wait first with one immutable recipient and subscription", async () => {
    const scope = "notify-first";
    const reserved = await reserveSharedMailSubscription({ configDir, scope });
    expect(reserved.recipient).toBeNull();
    const [waiter, notifier] = await Promise.all([
      openSharedMailStore({ configDir, scope, recipient }),
      reserveSharedMailSubscription({ configDir, scope, recipient }),
    ]);
    expect(waiter.subscriptionName).toBe(reserved.name);
    expect(notifier.name).toBe(reserved.name);
    expect(
      (await reserveSharedMailSubscription({ configDir, scope })).recipient,
    ).toBe(recipient);
    await expect(
      reserveSharedMailSubscription({ configDir, scope, recipient: peer }),
    ).rejects.toThrow("inconsistent");
    const alreadyWaiting = await openSharedMailStore({
      configDir,
      scope: "wait-first",
      recipient,
    });
    const joining = await reserveSharedMailSubscription({
      configDir,
      scope: "wait-first",
    });
    expect(joining).toMatchObject({
      name: alreadyWaiting.subscriptionName,
      recipient,
    });
  });

  it("persists a local stable subscription, isolates credentials, and rejects recipient changes", async () => {
    expect(
      (await openSharedMailStore({ configDir, scope: "fixture", recipient }))
        .subscriptionName,
    ).toBe(store.subscriptionName);
    expect(
      (await openSharedMailStore({ configDir, scope: "other", recipient }))
        .subscriptionName,
    ).not.toBe(store.subscriptionName);
    await expect(
      openSharedMailStore({ configDir, scope: "fixture", recipient: peer }),
    ).rejects.toThrow("inconsistent");
  });
  it("deduplicates aliases and rejects conflicting event identity", async () => {
    const e = await received();
    expect(
      await store.ingest({ ...e, emailId: e.emailId.toUpperCase() }),
    ).toEqual(await store.readEmail(e.emailId));
    await store.ingest({ ...e, eventId: randomUUID() });
    expect((await store.listEmails()).emails).toHaveLength(1);
    await expect(store.ingest({ ...e, emailId: randomUUID() })).rejects.toThrow(
      "inconsistent",
    );
  });
  it("requires hydrated authentication, own recipient and exact ancestry", async () => {
    const w = intent(),
      parent = randomUUID();
    await store.registerWait(w);
    await store.bindWait(w.requestId, parent);
    const e = await received(null, "pending");
    expect((await store.claimForWait(e.emailId, w.requestId)).status).toBe(
      "held",
    );
    const details = {
      recipient,
      peer,
      replyToSentEmailId: null,
      receivedAt: e.receivedAt,
      authorization: "trusted" as const,
    };
    await expect(
      store.hydrate(e.emailId, { ...details, recipient: peer }),
    ).rejects.toThrow("inconsistent");
    await store.hydrate(e.emailId, details);
    expect((await store.claimForWait(e.emailId, w.requestId)).status).toBe(
      "unmatched",
    );
    await store.hydrate(e.emailId, { ...details, replyToSentEmailId: parent });
    expect((await store.claimForWait(e.emailId, w.requestId)).status).toBe(
      "claimed",
    );
    await expect(
      store.hydrate(e.emailId, {
        ...details,
        replyToSentEmailId: randomUUID(),
      }),
    ).rejects.toThrow("inconsistent");
  });
  it("holds a fast reply before send binding and retains uncertainty across restart", async () => {
    const w = intent();
    await store.registerWait(w);
    const parent = randomUUID(),
      e = await received(parent);
    expect(
      (await store.claimForNotification(e.emailId, "runtime:session")).status,
    ).toBe("held");
    await store.markWaitUncertain(w.requestId);
    store = await openSharedMailStore({
      configDir,
      scope: "fixture",
      recipient,
    });
    expect((await store.readWait(w.requestId))?.status).toBe("uncertain");
    expect(
      (await store.claimForNotification(e.emailId, "runtime:session")).status,
    ).toBe("held");
    // Only an accepted/reconciled send ID binds the retained request.
    await store.bindWait(w.requestId, parent);
    expect((await store.claimForWait(e.emailId, w.requestId)).status).toBe(
      "claimed",
    );
  });
  it("releases an attempted peer hold only after definitive send rejection", async () => {
    const w = intent();
    await store.registerWait(w);
    await store.markWaitUncertain(w.requestId);
    const email = await received();
    expect(
      (await store.claimForNotification(email.emailId, "runtime:session"))
        .status,
    ).toBe("held");
    await expect(store.cancelWaitBeforeSend(w.requestId)).rejects.toThrow(
      "inconsistent",
    );
    await store.cancelRejectedSend(w.requestId);
    await store.cancelRejectedSend(w.requestId);
    store = await openSharedMailStore({
      configDir,
      scope: "fixture",
      recipient,
    });
    expect((await store.readWait(w.requestId))?.status).toBe("cancelled");
    expect(
      (await store.claimForNotification(email.emailId, "runtime:session"))
        .status,
    ).toBe("claimed");
  });
  it("refuses rejected-send cleanup of an accepted bound send", async () => {
    const w = intent(),
      parent = randomUUID();
    await store.registerWait(w);
    await store.bindWait(w.requestId, parent);
    await expect(store.cancelRejectedSend(w.requestId)).rejects.toThrow(
      "inconsistent",
    );
    const email = await received(parent);
    expect(
      (await store.claimForNotification(email.emailId, "runtime:session"))
        .status,
    ).toBe("held");
  });
  it("routes concurrent asks to the same peer by parent, preserving unrelated mail", async () => {
    const first = intent(),
      second = intent(),
      a = randomUUID(),
      b = randomUUID();
    await store.registerWait(first);
    await store.registerWait(second);
    await store.bindWait(first.requestId, a);
    await store.bindWait(second.requestId, b);
    const e = await received(a),
      other = await received(randomUUID());
    expect((await store.claimForWait(e.emailId, second.requestId)).status).toBe(
      "unmatched",
    );
    expect(
      (await store.claimForNotification(e.emailId, "runtime:session")).status,
    ).toBe("held");
    expect((await store.claimForWait(e.emailId, first.requestId)).status).toBe(
      "claimed",
    );
    expect(
      (await store.claimForNotification(other.emailId, "runtime:session"))
        .status,
    ).toBe("claimed");
    await expect(store.bindWait(second.requestId, a)).rejects.toThrow(
      "inconsistent",
    );
  });
  it("retains claimed and observed replies for resume rather than native fallback", async () => {
    const w = intent(),
      parent = randomUUID();
    await store.registerWait(w);
    await store.bindWait(w.requestId, parent);
    const e = await received(parent);
    await store.claimForWait(e.emailId, w.requestId);
    store = await openSharedMailStore({
      configDir,
      scope: "fixture",
      recipient,
    });
    expect(
      (await store.listWaitEmails(w.requestId)).emails.map((r) => r.emailId),
    ).toEqual([e.emailId]);
    expect(
      (await store.claimForNotification(e.emailId, "runtime:session")).status,
    ).toBe("held");
    await store.markWaitObserved(e.emailId, w.requestId);
    expect((await store.claimForWait(e.emailId, w.requestId)).status).toBe(
      "already_observed",
    );
    expect(
      (await store.claimForNotification(e.emailId, "runtime:session")).status,
    ).toBe("held");
  });
  it("settles a successful wait while preserving observations and permitting a later follow-up", async () => {
    const w = intent(),
      parent = randomUUID();
    await store.registerWait(w);
    await store.bindWait(w.requestId, parent);
    const first = await received(parent);
    await store.claimForWait(first.emailId, w.requestId);
    await expect(store.finishWait(w.requestId)).rejects.toThrow("inconsistent");
    await store.markWaitObserved(first.emailId, w.requestId);
    await store.finishWait(w.requestId);
    expect((await store.findWaitByParent(parent))?.status).toBe("completed");
    expect((await store.claimForWait(first.emailId, w.requestId)).status).toBe(
      "already_observed",
    );
    expect(
      (await store.claimForNotification(first.emailId, "runtime:session"))
        .status,
    ).toBe("held");
    const next = await received(parent);
    expect(
      (await store.claimForNotification(next.emailId, "runtime:session"))
        .status,
    ).toBe("claimed");
  });
  it("joins a known parent without leaving an unrelated unbound hold", async () => {
    const original = intent(),
      alias = intent(),
      parent = randomUUID();
    await store.registerWait(original);
    await store.bindWait(original.requestId, parent);
    await store.registerWait(alias);
    expect((await store.bindWait(alias.requestId, parent)).requestId).toBe(
      original.requestId,
    );
    expect((await store.readWait(alias.requestId))?.status).toBe("cancelled");
    const unrelated = await received(randomUUID());
    expect(
      (await store.claimForNotification(unrelated.emailId, "runtime:session"))
        .status,
    ).toBe("claimed");
  });
  it("releases only a definite pre-send failure and never an uncertain intent", async () => {
    const definite = intent();
    await store.registerWait(definite);
    const e = await received();
    await store.cancelWaitBeforeSend(definite.requestId);
    expect(
      (await store.claimForNotification(e.emailId, "runtime:session")).status,
    ).toBe("claimed");
    const uncertain = intent();
    await store.registerWait(uncertain);
    await store.markWaitUncertain(uncertain.requestId);
    await expect(
      store.cancelWaitBeforeSend(uncertain.requestId),
    ).rejects.toThrow("inconsistent");
    const held = await received();
    expect(
      (await store.claimForNotification(held.emailId, "runtime:session"))
        .status,
    ).toBe("held");
  });
  it("arbitrates a simultaneous exact wait and native claimant under one short lock", async () => {
    const w = intent("runtime:session-A"),
      parent = randomUUID();
    await store.registerWait(w);
    await store.bindWait(w.requestId, parent);
    const e = await received(parent);
    const [native, waiter] = await Promise.all([
      store.claimForNotification(e.emailId, "runtime:session-B"),
      store.claimForWait(e.emailId, w.requestId),
    ]);
    expect(native.status).toBe("held");
    expect(waiter.status).toBe("claimed");
  });
  it.each([
    "submitting",
    "accepted",
    "unknown",
  ] as const)("never reroutes native %s even after later wait registration", async (state) => {
    const parent = randomUUID(),
      e = await received(parent);
    await store.claimForNotification(e.emailId, "runtime:opaque-session");
    await store.markNotification(e.emailId, "submitting");
    if (state !== "submitting") await store.markNotification(e.emailId, state);
    expect(
      (await store.claimForNotification(e.emailId, "runtime:opaque-session"))
        .status,
    ).toBe(state === "accepted" ? "already_observed" : "held");
    const w = intent();
    await store.registerWait(w);
    await store.bindWait(w.requestId, parent);
    expect((await store.claimForWait(e.emailId, w.requestId)).status).toBe(
      "held",
    );
    expect(
      (await store.claimForNotification(e.emailId, "runtime:different")).status,
    ).toBe("held");
    if (state !== "submitting")
      await expect(
        store.markNotification(e.emailId, "submitting"),
      ).rejects.toThrow("inconsistent");
  });
  it("rejects terminal untrusted mail without assigning a consumer", async () => {
    const e = await received(null, "rejected");
    expect(
      (await store.claimForNotification(e.emailId, "runtime:session")).status,
    ).toBe("unmatched");
    expect((await store.readEmail(e.emailId))?.route).toBeNull();
  });
  it.each([
    1, 2, 3,
  ])("recovers a torn claim transaction at rename %s without losing wait ownership", async (phase) => {
    const w = intent(),
      parent = randomUUID();
    await store.registerWait(w);
    await store.bindWait(w.requestId, parent);
    const e = await received(parent),
      original = fs.renameSync;
    let writes = 0;
    vi.spyOn(fs, "renameSync").mockImplementation((...args) => {
      if (String(args[1]).endsWith(".json") && ++writes === phase)
        throw new Error("interrupted");
      return original(...args);
    });
    await expect(store.claimForWait(e.emailId, w.requestId)).rejects.toThrow(
      "interrupted",
    );
    vi.restoreAllMocks();
    // Reads recover the pending transaction under the same short lock.
    await store.readEmail(e.emailId);
    // A failure before the journal rename cannot commit anything. Later phases recover.
    if (phase > 1)
      expect((await store.listWaitEmails(w.requestId)).emails).toHaveLength(1);
    expect(
      (await store.claimForNotification(e.emailId, "runtime:session")).status,
    ).toBe("held");
    expect((await store.claimForWait(e.emailId, w.requestId)).status).toBe(
      "claimed",
    );
  });
  it("rejects disk null, unexpected payload fields, and conflicting journal recovery", async () => {
    const e = await received(),
      path = join(store.directory, "emails", `${e.emailId}.json`),
      good = readFileSync(path, "utf8");
    writeFileSync(path, "null");
    await expect(store.readEmail(e.emailId)).rejects.toThrow("inconsistent");
    writeFileSync(
      path,
      JSON.stringify({ ...JSON.parse(good), body: "unwanted" }),
    );
    await expect(store.readEmail(e.emailId)).rejects.toThrow("inconsistent");
    writeFileSync(path, good);
    const changed = {
      ...JSON.parse(good),
      firstSeenAt: "2000-01-01T00:00:00.000Z",
    };
    writeFileSync(
      join(store.directory, "pending.json"),
      JSON.stringify({
        writes: [
          { path: `emails/${e.emailId}.json`, before: null, after: changed },
        ],
      }),
      { mode: 0o600 },
    );
    await expect(
      openSharedMailStore({ configDir, scope: "fixture", recipient }),
    ).rejects.toThrow("inconsistent");
  });
  it("pages retained metadata and never persists bodies or raw credentials", async () => {
    for (let i = 0; i < 3; i++) await received();
    const a = await store.listEmails({ limit: 2 }),
      b = await store.listEmails({
        limit: 2,
        cursor: a.nextCursor ?? undefined,
      });
    expect(a.emails).toHaveLength(2);
    expect(b.emails).toHaveLength(1);
    expect(b.nextCursor).toBeNull();
    expect(new Set([...a.emails, ...b.emails].map((e) => e.emailId)).size).toBe(
      3,
    );
    for (const name of readdirSync(join(store.directory, "emails")))
      expect(
        readFileSync(join(store.directory, "emails", name), "utf8"),
      ).not.toMatch(/body|transcript|credential/);
  });
});
