import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ transport: vi.fn() }));
vi.mock("../../src/oclif/shared-mail-transport.js", () => ({
  runSharedMailTransport: mocks.transport,
}));

import { openSharedMailReceiver } from "../../src/oclif/shared-mail-receiver.js";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories)
    rmSync(directory, { recursive: true, force: true });
  vi.clearAllMocks();
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
});
