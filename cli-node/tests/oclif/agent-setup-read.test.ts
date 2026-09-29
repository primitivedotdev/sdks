import { describe, expect, it, vi } from "vitest";
import {
  readSetupApi,
  type SetupReadBudget,
} from "../../src/oclif/agent-setup-read.js";

function budget() {
  let now = Date.parse("2026-09-28T19:30:00Z");
  const value: SetupReadBudget = {
    deadline: now + 90_000,
    now: () => now,
    sleep: vi.fn(async (ms) => {
      now += ms;
    }),
    signal: new AbortController().signal,
    retries: 0,
  };
  return value;
}
const failed = (status: number, retryAfter?: string) => ({
  error: { private: "must not appear" },
  response: new Response("private", {
    status,
    headers: retryAfter ? { "retry-after": retryAfter } : {},
  }),
});
const success = () => ({ data: "read complete", response: new Response("{}") });

describe("bounded setup GET recovery", () => {
  it("honors a 32-second rate-limit delay before retrying the read", async () => {
    const b = budget();
    const read = vi.fn(
      async () =>
        success() as ReturnType<typeof success> | ReturnType<typeof failed>,
    );
    read.mockResolvedValueOnce(failed(429, "32"));
    expect(await readSetupApi(b, "challenge search", read)).toMatchObject({
      data: "read complete",
    });
    expect(b.sleep).toHaveBeenCalledExactlyOnceWith(32_000);
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("accepts HTTP-date Retry-After and backs off for transient transport/5xx", async () => {
    const b = budget();
    const read = vi.fn(
      async () =>
        success() as ReturnType<typeof success> | ReturnType<typeof failed>,
    );
    read.mockResolvedValueOnce(
      failed(503, new Date(b.now() + 20_000).toUTCString()),
    );
    read.mockRejectedValueOnce(new Error("private socket failure"));
    expect(await readSetupApi(b, "challenge detail", read)).toMatchObject({
      data: "read complete",
    });
    expect(vi.mocked(b.sleep).mock.calls.map(([ms]) => ms)).toEqual([
      20_000, 2000,
    ]);
  });
  it("does not shorten an advertised delay to squeeze another request into its deadline", async () => {
    const b = budget();
    const read = vi.fn(async () => failed(429, "120"));
    await expect(
      readSetupApi(b, "owner notification policy", read),
    ).rejects.toThrow(
      /owner notification policy.*HTTP 429.*120 seconds.*--resume/,
    );
    expect(read).toHaveBeenCalledOnce();
    expect(b.sleep).not.toHaveBeenCalled();
  });
  it("bounds repeated retries and emits no private response content", async () => {
    const b = budget();
    const read = vi.fn(async () => failed(429, "0"));
    let error: unknown;
    try {
      await readSetupApi(b, "challenge search", read);
    } catch (caught) {
      error = caught;
    }
    expect(String(error)).toContain("HTTP 429");
    expect(String(error)).not.toContain("private");
    expect(read).toHaveBeenCalledTimes(5);
    expect(vi.mocked(b.sleep).mock.calls.map(([ms]) => ms)).toEqual([
      1000, 1000, 1000, 1000,
    ]);
  });
  it.each([
    401, 403, 404,
  ])("does not retry HTTP %s authorization or missing-resource failures", async (status) => {
    const b = budget(),
      read = vi.fn(async () => failed(status));
    await expect(
      readSetupApi(b, "verification send lookup", read),
    ).rejects.toThrow(`HTTP ${status}`);
    expect(read).toHaveBeenCalledOnce();
    expect(b.sleep).not.toHaveBeenCalled();
  });
});
