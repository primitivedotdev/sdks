import { type ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { EventEmitter, once } from "node:events";
import * as fs from "node:fs";
import {
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listenProcessIdentity } from "../../src/oclif/listen-state.js";
import {
  openSharedMailStore,
  type SharedMailStore,
} from "../../src/oclif/shared-mail-state.js";
import {
  readSharedMailOwner,
  tryOwnSharedMail,
  waitForSharedMailChange,
} from "../../src/oclif/shared-mail-watch.js";

vi.mock("node:fs", async (original) => ({
  ...(await original<typeof import("node:fs")>()),
}));
let configDir: string, store: SharedMailStore;
const owners: Array<NonNullable<ReturnType<typeof tryOwnSharedMail>>> = [];
const children: ChildProcess[] = [];
beforeEach(async () => {
  configDir = mkdtempSync(join(tmpdir(), "primitive-mail-watch-"));
  store = await openSharedMailStore({
    configDir,
    scope: "fixture",
    recipient: "device@example.com",
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const child of children.splice(0)) child.kill();
  for (const owner of owners.splice(0)) owner.close();
  rmSync(configDir, { recursive: true, force: true });
});
function own() {
  const result = tryOwnSharedMail(store);
  if (!result) throw new Error("expected owner");
  owners.push(result);
  return result;
}
describe("shared mail stream ownership and local change hints", () => {
  it("elects one foreground owner and publishes ready only after explicit handshake confirmation", () => {
    const first = own();
    expect(tryOwnSharedMail(store)).toBeNull();
    expect(readSharedMailOwner(store)).toMatchObject({
      generation: first.generation,
      ready: false,
      alive: true,
    });
    first.markReady();
    first.markChecked();
    first.markStatus({ gapCount: 2, lastGapReason: "retention_expired" });
    expect(readSharedMailOwner(store)).toMatchObject({
      ready: true,
      gapCount: 2,
      lastGapReason: "retention_expired",
    });
    expect(
      Date.parse(readSharedMailOwner(store)?.lastMailCheckAt ?? ""),
    ).not.toBeNaN();
    first.markStatus({ ready: false });
    expect(readSharedMailOwner(store)?.ready).toBe(false);
    first.close();
    expect(readSharedMailOwner(store)).toBeNull();
    const next = own();
    expect(next.generation).not.toBe(first.generation);
    expect(readSharedMailOwner(store)?.ready).toBe(false);
  });
  it("reclaims only a dead owner using existing process identity locks", async () => {
    const child = spawn(
      process.execPath,
      ["-e", "process.stdout.write('ready');setInterval(()=>{},1000)"],
      { stdio: ["ignore", "pipe", "ignore"] },
    );
    children.push(child);
    if (!child.stdout) throw new Error("child stdout missing");
    await once(child.stdout, "data");
    if (!child.pid) throw new Error("child missing pid");
    const first = own(),
      identity = listenProcessIdentity(child.pid);
    expect(identity).not.toBeNull();
    const lock = readdirSync(store.directory).find((name) =>
      name.endsWith(".lock"),
    );
    if (!lock) throw new Error("lock missing");
    const path = join(store.directory, lock),
      oldOwner = readdirSync(path)[0];
    const newOwner = `${child.pid}-${randomUUID()}`;
    renameSync(join(path, oldOwner), join(path, newOwner));
    writeFileSync(
      join(path, newOwner),
      JSON.stringify({ version: 1, identity }),
    );
    writeFileSync(
      join(store.directory, "owner.json"),
      JSON.stringify({
        generation: first.generation,
        pid: child.pid,
        identity,
        ready: true,
        gapCount: 0,
        lastGapReason: null,
      }),
    );
    expect(tryOwnSharedMail(store)).toBeNull();
    child.kill();
    await once(child, "exit");
    expect(readSharedMailOwner(store)?.alive).toBe(false);
    const next = own();
    expect(next.generation).not.toBe(first.generation);
  });
  it("observes state written after watcher installation, then cleans up on cancellation", async () => {
    const controller = new AbortController(),
      changed = waitForSharedMailChange(store, {
        signal: controller.signal,
        timeoutMs: 5000,
      });
    expect((await store.listEmails()).emails).toEqual([]);
    await store.ingest({
      emailId: randomUUID(),
      eventId: randomUUID(),
      receivedAt: new Date().toISOString(),
    });
    await changed;
    expect((await store.listEmails()).emails).toHaveLength(1);
    const aborted = waitForSharedMailChange(store, {
      signal: controller.signal,
    });
    controller.abort(new Error("cancelled"));
    await expect(aborted).rejects.toThrow("cancelled");
  });
  it("reconciles durable state even when the filesystem emits no change event", async () => {
    const closed = vi.fn();
    class SilentWatcher extends EventEmitter implements fs.FSWatcher {
      close() {
        closed();
      }
      ref(): this {
        return this;
      }
      unref(): this {
        return this;
      }
    }
    vi.spyOn(fs, "watch").mockImplementation(() => new SilentWatcher());
    const changed = waitForSharedMailChange(store, {
      signal: new AbortController().signal,
      timeoutMs: 10,
    });
    await store.ingest({
      emailId: randomUUID(),
      eventId: randomUUID(),
      receivedAt: new Date().toISOString(),
    });
    await changed;
    expect((await store.listEmails()).emails).toHaveLength(1);
    expect(closed).toHaveBeenCalledTimes(3);
  });
  it("does not wake itself when a read acquires and releases the state lock", async () => {
    const controller = new AbortController();
    let notified = false;
    const changed = waitForSharedMailChange(store, {
      signal: controller.signal,
      timeoutMs: 1000,
    }).then(
      () => {
        notified = true;
      },
      () => {},
    );
    await store.listEmails();
    await delay(50);
    expect(notified).toBe(false);
    controller.abort();
    await changed;
  });
  it("does not silently accept malformed owner state or decreasing gaps", () => {
    const first = own();
    first.markStatus({ gapCount: 2 });
    expect(() => first.markStatus({ gapCount: 1 })).toThrow("inconsistent");
    writeFileSync(join(store.directory, "owner.json"), "null");
    expect(() => readSharedMailOwner(store)).toThrow("inconsistent");
    rmSync(join(store.directory, "owner.json"));
  });
});
