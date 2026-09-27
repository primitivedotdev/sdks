import { randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type NotificationReceipt,
  notificationReceiptPage,
  openNotificationReceipts,
} from "../../src/oclif/notify-session-state.js";

let directory: string;
const scope = "fixture-scope",
  threadId = randomUUID();
const releases: Array<() => void> = [];
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "primitive-receipt-"));
});
afterEach(() => {
  for (const release of releases.splice(0)) release();
  rmSync(directory, { recursive: true, force: true });
});
function open() {
  const store = openNotificationReceipts(directory, scope, threadId);
  releases.push(store.release);
  return store;
}
function paths(r: NotificationReceipt) {
  const parent = join(directory, "session-notifications");
  const base = join(parent, readdirSync(parent)[0]);
  return {
    base,
    email: join(base, "emails", `${r.emailId.toLowerCase()}.json`),
    event: join(base, "events", `${r.eventId.toLowerCase()}.json`),
    pending: join(base, "pending.json"),
  };
}
function makeReceipt(): NotificationReceipt {
  return {
    emailId: randomUUID(),
    eventId: randomUUID(),
    clientId: randomUUID(),
    state: "submitting",
  };
}
const write = (path: string, value: unknown) =>
  writeFileSync(path, JSON.stringify(value), { mode: 0o600 });

describe("indexed notification receipts", () => {
  it.each([
    "journal",
    "email",
    "index",
    "complete",
  ])("recovers an interrupted submitting write at %s without authorizing resend", (phase) => {
    const r = makeReceipt(),
      store = open();
    store.save(r);
    store.release();
    const p = paths(r);
    if (phase !== "complete")
      write(p.pending, { receipt: r, eventId: r.eventId });
    if (phase === "journal") unlinkSync(p.email);
    if (phase === "journal" || phase === "email") unlinkSync(p.event);
    const recovered = open();
    expect(recovered.find(r.emailId, r.eventId)).toEqual(r);
    expect(existsSync(p.pending)).toBe(false);
    expect(
      notificationReceiptPage(directory, scope, threadId).receipts,
    ).toEqual([r]);
  });
  it.each([
    "journal",
    "email",
    "complete",
  ])("retains accepted evidence after an interrupted update at %s", (phase) => {
    const r = makeReceipt(),
      store = open();
    store.save(r);
    store.release();
    const accepted = { ...r, state: "accepted" as const },
      p = paths(r);
    if (phase !== "complete")
      write(p.pending, { receipt: accepted, eventId: r.eventId });
    if (phase !== "journal") write(p.email, accepted);
    const recovered = open();
    expect(recovered.find(r.emailId, r.eventId)?.state).toBe("accepted");
    expect(() => recovered.save(r)).toThrow("inconsistent");
  });
  it("fails closed on conflicting indexes before journal recovery", () => {
    const r = makeReceipt(),
      store = open();
    store.save(r);
    store.release();
    const p = paths(r);
    write(p.pending, { receipt: r, eventId: r.eventId });
    write(p.event, {
      emailId: randomUUID(),
      eventId: r.eventId,
      clientId: r.clientId,
    });
    expect(() => open()).toThrow("inconsistent");
    expect(existsSync(p.pending)).toBe(true);
  });
  it.each([
    "email",
    "event",
    "pending",
  ] as const)("rejects on-disk null in %s", (kind) => {
    const r = makeReceipt(),
      store = open();
    store.save(r);
    store.release();
    const p = paths(r);
    write(p[kind], null);
    expect(() => {
      const reopened = open();
      reopened.find(r.emailId, r.eventId);
    }).toThrow("inconsistent");
  });
  it("rejects coerced states and public journal permissions", () => {
    const r = makeReceipt(),
      store = open();
    store.save(r);
    store.release();
    const p = paths(r);
    write(p.pending, {
      receipt: { ...r, state: ["accepted"] },
      eventId: r.eventId,
    });
    expect(() => open()).toThrow("inconsistent");
    write(p.pending, { receipt: r, eventId: r.eventId });
    chmodSync(p.pending, 0o644);
    expect(() => open()).toThrow("inconsistent");
  });
  it("normalizes UUID filenames, indexes aliases, and paginates without modifying receipts", () => {
    const store = open(),
      all = Array.from({ length: 4 }, makeReceipt);
    for (const r of all) store.save({ ...r, emailId: r.emailId.toUpperCase() });
    const r = all[0],
      alias = randomUUID();
    expect(store.find(r.emailId.toUpperCase(), alias)?.emailId).toBe(r.emailId);
    expect(() => store.find(randomUUID(), alias)).toThrow("inconsistent");
    const first = notificationReceiptPage(directory, scope, threadId, {
      limit: 2,
    });
    expect(first.receipts).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    const second = notificationReceiptPage(directory, scope, threadId, {
      limit: 2,
      cursor: first.nextCursor ?? undefined,
    });
    expect(second.receipts).toHaveLength(2);
    expect(second.nextCursor).toBeNull();
    expect(
      new Set(
        [...first.receipts, ...second.receipts].map((item) => item.emailId),
      ).size,
    ).toBe(4);
    expect(readFileSync(paths(r).email, "utf8")).not.toContain(
      r.emailId.toUpperCase(),
    );
  });
  it("writes new receipts after historical evidence exceeds the former 8 MiB cap", () => {
    const store = open(),
      sample = makeReceipt(),
      p = paths(sample);
    let historicalBytes = 0;
    // Seed settled history directly, avoiding 50,000 redundant fsync ceremonies.
    // Each record has its corresponding event index and valid private permissions.
    for (let number = 0; historicalBytes <= 8 * 1024 * 1024; number++) {
      const id = `ffffffff-ffff-4fff-8fff-${number.toString(16).padStart(12, "0")}`;
      const r = { emailId: id, eventId: id, clientId: id, state: "accepted" };
      const serialized = JSON.stringify(r);
      historicalBytes += Buffer.byteLength(serialized);
      writeFileSync(join(p.base, "emails", `${id}.json`), serialized, {
        mode: 0o600,
      });
      write(join(p.base, "events", `${id}.json`), {
        emailId: id,
        eventId: id,
        clientId: id,
      });
    }
    store.save(sample);
    expect(store.find(sample.emailId, sample.eventId)).toEqual(sample);
    expect(
      notificationReceiptPage(directory, scope, threadId, { limit: 1 })
        .receipts,
    ).toHaveLength(1);
    expect(existsSync(join(p.base, "receipts.json"))).toBe(false);
  }, 60_000);
});
