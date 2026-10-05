import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSharedMailWaiter,
  openSharedMailStore,
  type SharedMailStore,
} from "../../src/oclif/shared-mail-state.js";

const lifecycle = vi.hoisted(() => ({ identity: vi.fn() }));
vi.mock("../../src/oclif/listen-state.js", async (original) => ({
  ...(await original<typeof import("../../src/oclif/listen-state.js")>()),
  listenProcessIdentity: lifecycle.identity,
}));
const recipient = "receiver@example.com",
  peer = "peer@example.com";
let directory: string, store: SharedMailStore;
beforeEach(async () => {
  lifecycle.identity.mockReturnValue("process-start");
  directory = mkdtempSync(join(tmpdir(), "primitive-waiters-"));
  store = await openSharedMailStore({
    configDir: directory,
    scope: "fixture",
    recipient,
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(directory, { recursive: true, force: true });
});
async function registered(managed = true) {
  const owner = createSharedMailWaiter(),
    requestId = randomUUID(),
    parent = randomUUID();
  const registration = {
    requestId,
    peer,
    createdAt: new Date().toISOString(),
    idempotencyKey: randomUUID(),
    ...(managed ? { waiter: owner } : {}),
  };
  await store.registerWait(registration);
  return { owner, requestId, parent, registration };
}
async function bound(managed = true) {
  const result = await registered(managed);
  await store.bindWait(result.requestId, result.parent);
  return result;
}
async function receive(
  parent: string | null,
  authorization: "trusted" | "pending" | "rejected" = "trusted",
  sender = peer,
) {
  const emailId = randomUUID(),
    receivedAt = new Date().toISOString();
  await store.ingest({ emailId, eventId: randomUUID(), receivedAt });
  await store.hydrate(emailId, {
    recipient,
    peer: sender,
    replyToSentEmailId: parent,
    receivedAt,
    authorization,
  });
  return emailId;
}
const notify = (id: string) =>
  store.claimForNotification(id, "runtime:session");

describe("active reply wait handoff", () => {
  it.each(["bound", "completed"] as const)(
    "only the owning native session can claim a %s conversation after its synchronous wait ends",
    async (phase) => {
      const owner = createSharedMailWaiter();
      const requestId = randomUUID(),
        parent = randomUUID();
      const session = `codex:${randomUUID()}`;
      await store.registerWait({
        requestId,
        peer,
        sessionKey: session,
        createdAt: new Date().toISOString(),
        idempotencyKey: randomUUID(),
        waiter: owner,
      });
      await store.bindWait(requestId, parent);
      if (phase === "completed") {
        const interim = await receive(parent);
        await store.claimForWait(interim, requestId, owner.token);
        await store.markWaitObserved(interim, requestId);
        await store.finishWait(requestId);
      }
      await store.releaseWaiter(requestId, owner.token);
      const reply = await receive(parent);
      const other = `codex:${randomUUID()}`;
      // Explicit sender and contact-preference listeners both use this atomic
      // claim. A consumer that bypasses policy cannot steal or skip the event.
      expect((await store.claimForNotification(reply, other)).status).toBe(
        "held",
      );
      expect((await store.readEmail(reply))?.route).toBeNull();
      const [wrong, right] = await Promise.all([
        store.claimForNotification(reply, other),
        store.claimForNotification(reply, session),
      ]);
      expect(wrong.status).toBe("held");
      expect(right.status).toBe("claimed");
      await expect(store.skipNotification(reply, other)).rejects.toThrow(
        "inconsistent",
      );
      expect((await store.readEmail(reply))?.route).toMatchObject({
        kind: "notification",
        sessionKey: session,
        state: "selected",
      });
      await store.markNotification(reply, "submitting");
      await store.markNotification(reply, "accepted");
      store = await openSharedMailStore({
        configDir: directory,
        scope: "fixture",
        recipient,
      });
      expect((await store.claimForNotification(reply, other)).status).toBe(
        "held",
      );
      expect((await store.claimForNotification(reply, session)).status).toBe(
        "already_observed",
      );
    },
  );

  it("holds a live legacy macOS waiter after clock correction or identity upgrade", async () => {
    lifecycle.identity.mockReturnValue(
      "darwin:1700000000:123:Wed Sep 9 12:34:56 2026",
    );
    const wait = await bound(),
      id = await receive(wait.parent);
    lifecycle.identity.mockReturnValue(
      "darwin-boot:0385d3d5-2a65-41bd-9596-c3dd32c06ddd:Wed Sep 9 12:34:56 2026",
    );
    expect((await notify(id)).status).toBe("held");
    await store.releaseWaiter(wait.requestId, wait.owner.token);
    expect((await notify(id)).status).toBe("claimed");
  });
  it("keeps active waits first, then permits one durable external event after the final owner releases", async () => {
    const wait = await bound(),
      id = await receive(wait.parent);
    expect((await notify(id)).status).toBe("held");
    await store.releaseWaiter(wait.requestId, wait.owner.token);
    expect((await store.readWait(wait.requestId))?.status).toBe("bound");
    expect((await notify(id)).status).toBe("claimed");
    await store.markNotification(id, "submitting");
    await store.markNotification(id, "accepted");
    store = await openSharedMailStore({
      configDir: directory,
      scope: "fixture",
      recipient,
    });
    expect((await notify(id)).status).toBe("already_observed");
    expect((await store.claimForNotification(id, "runtime:other")).status).toBe(
      "held",
    );
  });

  it("does not hand off when one joined waiter times out or repeatedly closes", async () => {
    const wait = await bound(),
      second = createSharedMailWaiter(),
      id = await receive(wait.parent);
    await store.joinWait(wait.requestId, second);
    await store.releaseWaiter(wait.requestId, wait.owner.token);
    await store.releaseWaiter(wait.requestId, wait.owner.token);
    expect((await notify(id)).status).toBe("held");
    expect(
      (await store.claimForWait(id, wait.requestId, wait.owner.token)).status,
    ).toBe("held");
    expect(
      (await store.claimForWait(id, wait.requestId, second.token)).status,
    ).toBe("claimed");
    await store.releaseWaiter(wait.requestId, second.token);
    expect((await notify(id)).status).toBe("held");
  });

  it("atomically retains all owners when two send intents join one parent", async () => {
    const canonical = await bound(),
      incoming = await registered(),
      second = createSharedMailWaiter();
    await store.registerWait({ ...incoming.registration, waiter: second });
    expect(
      (await store.bindWait(incoming.requestId, canonical.parent)).requestId,
    ).toBe(canonical.requestId);
    await store.releaseWaiter(canonical.requestId, canonical.owner.token);
    await store.releaseWaiter(incoming.requestId, incoming.owner.token);
    const id = await receive(canonical.parent);
    expect((await notify(id)).status).toBe("held");
    // Closing before the second handle has bound must release its migrated owner.
    await store.releaseWaiter(incoming.requestId, second.token);
    expect((await notify(id)).status).toBe("claimed");
    await store.bindWait(incoming.requestId, canonical.parent);
    expect((await store.readWait(canonical.requestId))?.waiters).toEqual([]);
  });

  it.each(["wait", "notification"] as const)(
    "gives a resumed wait and notification one winner: %s first",
    async (winner) => {
      const wait = await bound(),
        id = await receive(wait.parent);
      await store.releaseWaiter(wait.requestId, wait.owner.token);
      const resumed = createSharedMailWaiter();
      if (winner === "wait") {
        await store.joinWait(wait.requestId, resumed);
        expect((await notify(id)).status).toBe("held");
        expect(
          (await store.claimForWait(id, wait.requestId, resumed.token)).status,
        ).toBe("claimed");
      } else {
        expect((await notify(id)).status).toBe("claimed");
        await store.joinWait(wait.requestId, resumed);
        expect(
          (await store.claimForWait(id, wait.requestId, resumed.token)).status,
        ).toBe("held");
      }
    },
  );

  it("preserves a reply already claimed before timeout for exact recovery, never external replay", async () => {
    const wait = await bound(),
      id = await receive(wait.parent);
    expect(
      (await store.claimForWait(id, wait.requestId, wait.owner.token)).status,
    ).toBe("claimed");
    await store.releaseWaiter(wait.requestId, wait.owner.token);
    expect((await notify(id)).status).toBe("held");
    const resumed = createSharedMailWaiter();
    await store.joinWait(wait.requestId, resumed);
    expect(
      (await store.claimForWait(id, wait.requestId, resumed.token)).status,
    ).toBe("claimed");
  });

  it.each(["exit", "reused"] as const)(
    "hands off unclaimed mail after a proven process %s",
    async (reason) => {
      const wait = await bound(),
        id = await receive(wait.parent);
      lifecycle.identity.mockReturnValue(
        reason === "exit" ? null : "different-start",
      );
      if (reason === "exit") {
        const kill = process.kill.bind(process);
        vi.spyOn(process, "kill").mockImplementation((pid, signal) => {
          if (pid === wait.owner.pid && signal === 0)
            throw Object.assign(new Error("gone"), { code: "ESRCH" });
          return kill(pid, signal);
        });
      }
      expect((await notify(id)).status).toBe("claimed");
      expect(
        (await store.claimForWait(id, wait.requestId, wait.owner.token)).status,
      ).toBe("held");
    },
  );

  it("retains the hold when process metadata is unavailable and liveness is uncertain", async () => {
    const wait = await bound(),
      id = await receive(wait.parent);
    lifecycle.identity.mockReturnValue(null);
    const kill = process.kill.bind(process);
    vi.spyOn(process, "kill").mockImplementation((pid, signal) => {
      if (pid === wait.owner.pid && signal === 0)
        throw Object.assign(new Error("denied"), { code: "EPERM" });
      return kill(pid, signal);
    });
    expect((await notify(id)).status).toBe("held");
    await store.releaseWaiter(wait.requestId, wait.owner.token);
    expect((await notify(id)).status).toBe("claimed");
  });

  it("does not upgrade a legacy wait or drop its untracked owner when a modern waiter joins", async () => {
    const legacy = await bound(false),
      incoming = await registered(),
      id = await receive(legacy.parent);
    await store.joinWait(legacy.requestId, incoming.owner);
    await store.bindWait(incoming.requestId, legacy.parent);
    await store.releaseWaiter(legacy.requestId, incoming.owner.token);
    expect((await store.readWait(legacy.requestId))?.waiters).toBeUndefined();
    expect((await notify(id)).status).toBe("held");
  });

  it.each(["unbound", "uncertain"] as const)(
    "never releases a possible %s send based on waiter exit",
    async (status) => {
      const wait = await registered(),
        id = await receive(randomUUID());
      if (status === "uncertain") await store.markWaitUncertain(wait.requestId);
      await store.releaseWaiter(wait.requestId, wait.owner.token);
      expect((await notify(id)).status).toBe("held");
    },
  );

  it.each(["pending", "rejected"] as const)(
    "does not promote %s mail merely because a wait ended",
    async (authorization) => {
      const wait = await bound(),
        id = await receive(wait.parent, authorization);
      await store.releaseWaiter(wait.requestId, wait.owner.token);
      expect((await notify(id)).status).toBe(
        authorization === "pending" ? "held" : "unmatched",
      );
    },
  );

  it("allows unrelated parent or sender mail while a wait is active", async () => {
    const wait = await bound();
    expect((await notify(await receive(randomUUID()))).status).toBe("claimed");
    expect(
      (
        await notify(
          await receive(wait.parent, "trusted", "another@example.com"),
        )
      ).status,
    ).toBe("claimed");
  });
});
