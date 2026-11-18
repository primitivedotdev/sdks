import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transport: vi.fn(),
  identityAvailable: true,
}));
vi.mock("../../src/oclif/listen-state.js", async (original) => {
  const actual =
    await original<typeof import("../../src/oclif/listen-state.js")>();
  return {
    ...actual,
    listenProcessIdentity: (pid: number) =>
      mocks.identityAvailable ? actual.listenProcessIdentity(pid) : null,
  };
});
vi.mock("../../src/oclif/shared-mail-transport.js", () => ({
  runSharedMailTransport: mocks.transport,
}));

import { openSharedMailReceiver } from "../../src/oclif/shared-mail-receiver.js";
import { tryOwnSharedMail } from "../../src/oclif/shared-mail-watch.js";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories)
    rmSync(directory, { recursive: true, force: true });
  vi.clearAllMocks();
  mocks.identityAvailable = true;
});
function fixture() {
  const configDir = mkdtempSync(join(tmpdir(), "receiver-test-"));
  directories.push(configDir);
  const apiKey = ["pconn", "fixture"].join("_");
  return {
    configDir,
    apiKey,
    baseUrl: "https://example.test/v1",
    recipient: "owner@example.test",
    apiClient: new PrimitiveApiClient({
      apiKey,
      apiBaseUrl: "https://example.test/v1",
    }),
  };
}
describe("shared receiver lifecycle", () => {
  it("does not start receiving when its deadline has already elapsed", async () => {
    await expect(
      openSharedMailReceiver({ ...fixture(), deadline: Date.now() - 1 }),
    ).rejects.toThrow();
    expect(mocks.transport).not.toHaveBeenCalled();
  });
  it("waits for authenticated readiness and cancels the owned transport on close", async () => {
    let finishReady: (() => Promise<void>) | undefined;
    mocks.transport.mockImplementation(
      async ({
        ready,
        signal,
      }: {
        ready: () => Promise<void>;
        signal: AbortSignal;
      }) => {
        finishReady = ready;
        await new Promise<void>((resolve) =>
          signal.addEventListener("abort", () => resolve(), { once: true }),
        );
      },
    );
    const receiver = await openSharedMailReceiver(fixture());
    const ready = receiver.ready();
    await vi.waitFor(() => expect(finishReady).toBeDefined());
    expect(receiver.status()?.ready).toBe(false);
    await finishReady?.();
    expect((await ready)?.ready).toBe(true);
    await receiver.close();
    expect(receiver.status()).toBeNull();
  });
  it("keeps its own authenticated receiver ready when OS identity reads become unavailable", async () => {
    mocks.transport.mockImplementation(
      async ({
        ready,
        signal,
      }: {
        ready: () => Promise<void>;
        signal: AbortSignal;
      }) => {
        await new Promise<void>((resolve) => setImmediate(resolve));
        await ready();
        mocks.identityAvailable = false;
        await new Promise<void>((resolve) =>
          signal.addEventListener("abort", () => resolve(), { once: true }),
        );
      },
    );
    const receiver = await openSharedMailReceiver(fixture());
    try {
      expect((await receiver.ready(Date.now() + 1000))?.ready).toBe(true);
      expect(receiver.status()).toMatchObject({ alive: true, ready: true });
    } finally {
      await receiver.close();
    }
  });
  it("still requires OS identity verification for a receiver it does not own", async () => {
    const receiver = await openSharedMailReceiver(fixture());
    const owner = tryOwnSharedMail(receiver.store);
    if (!owner) throw new Error("expected separate owner");
    try {
      owner.markReady();
      mocks.identityAvailable = false;
      expect(receiver.status()).toMatchObject({ alive: false, ready: true });
      expect(mocks.transport).not.toHaveBeenCalled();
    } finally {
      owner.close();
      await receiver.close();
    }
  });
});
