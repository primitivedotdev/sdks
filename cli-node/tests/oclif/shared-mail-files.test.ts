import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { acquireListenLock } from "../../src/oclif/listen-state.js";
import {
  privateMailPermissions,
  syncMailDirectory,
} from "../../src/oclif/shared-mail-files.js";
import { openSharedMailStore } from "../../src/oclif/shared-mail-state.js";

vi.mock("node:fs", async (original) => ({
  ...(await original<typeof import("node:fs")>()),
}));
const directories: string[] = [],
  releases: Array<() => void> = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const release of releases.splice(0)) release();
  for (const path of directories.splice(0))
    rmSync(path, { recursive: true, force: true });
});
describe("portable shared mail storage and cancellation", () => {
  it("uses existing user-config ACL semantics on Windows and strict modes on POSIX", () => {
    const owner = process.getuid?.() ?? 0;
    expect(privateMailPermissions({ uid: owner, mode: 0o600 }, "darwin")).toBe(
      true,
    );
    expect(privateMailPermissions({ uid: owner, mode: 0o644 }, "darwin")).toBe(
      false,
    );
    expect(
      privateMailPermissions({ uid: owner + 1, mode: 0o600 }, "linux"),
    ).toBe(false);
    expect(
      privateMailPermissions({ uid: owner + 1, mode: 0o666 }, "win32"),
    ).toBe(true);
    const open = vi.spyOn(fs, "openSync");
    syncMailDirectory("not-opened-on-windows", "win32");
    expect(open).not.toHaveBeenCalled();
    expect(() => syncMailDirectory("missing-directory", "linux")).toThrow();
  });
  it("aborts a contended state transaction without an orphaned later mutation", async () => {
    const configDir = mkdtempSync(join(tmpdir(), "primitive-mail-abort-"));
    directories.push(configDir);
    const controller = new AbortController(),
      store = await openSharedMailStore({
        configDir,
        scope: "fixture",
        recipient: "device@example.com",
        signal: controller.signal,
      });
    const release = acquireListenLock(store.directory, "shared-mail-state");
    releases.push(release);
    const emailId = randomUUID(),
      pending = store.ingest({
        emailId,
        eventId: randomUUID(),
        receivedAt: new Date().toISOString(),
      });
    controller.abort(new Error("deadline"));
    await expect(pending).rejects.toThrow();
    release();
    const recovered = await openSharedMailStore({
      configDir,
      scope: "fixture",
      recipient: "device@example.com",
    });
    expect(await recovered.readEmail(emailId)).toBeNull();
  });
});
