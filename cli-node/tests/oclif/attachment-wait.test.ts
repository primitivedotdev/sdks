import { describe, expect, it, vi } from "vitest";
import { createOperationCommand } from "../../src/oclif/api-command.js";
import {
  ATTACHMENT_WAIT_MAX_MS,
  nextAttachmentWaitDelay,
  retryAfterMs,
  withAttachmentWait,
} from "../../src/oclif/attachment-wait.js";

const notReady = (retryAfter?: string) => ({
  error: {
    success: false,
    error: {
      code: "attachment_not_ready",
      message: "Attachment content is not ready. Please retry shortly.",
    },
  },
  response: new Response(null, {
    status: 503,
    headers: retryAfter ? { "retry-after": retryAfter } : {},
  }),
});
const ok = { data: new Blob(["bytes"]) };
const errorCode = (error: unknown) =>
  (error as { error?: { code?: string } }).error?.code;

function clock() {
  let now = 0;
  const sleeps: number[] = [];
  return {
    now: () => now,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      now += ms;
    },
    sleeps,
  };
}

describe("withAttachmentWait", () => {
  it("retries attachment_not_ready until the content arrives, honouring Retry-After", async () => {
    const c = clock();
    const call = vi
      .fn()
      .mockResolvedValueOnce(notReady("5"))
      .mockResolvedValueOnce(notReady("5"))
      .mockResolvedValueOnce(ok);
    const onFirstWait = vi.fn();
    const result = await withAttachmentWait(call, {
      wait: true,
      errorCode,
      onFirstWait,
      now: c.now,
      sleep: c.sleep,
    });
    expect(result).toBe(ok);
    expect(call).toHaveBeenCalledTimes(3);
    expect(c.sleeps).toEqual([5000, 5000]);
    expect(onFirstWait).toHaveBeenCalledTimes(1);
  });

  it("backs off exponentially without a Retry-After and gives up after the budget", async () => {
    const c = clock();
    const call = vi.fn().mockImplementation(async () => notReady());
    const result = await withAttachmentWait(call, {
      wait: true,
      errorCode,
      now: c.now,
      sleep: c.sleep,
    });
    expect(errorCode(result.error)).toBe("attachment_not_ready");
    expect(c.sleeps.slice(0, 5)).toEqual([1000, 2000, 4000, 8000, 8000]);
    expect(c.sleeps.reduce((a, b) => a + b, 0)).toBe(ATTACHMENT_WAIT_MAX_MS);
  });

  it("returns at once with --no-wait", async () => {
    const c = clock();
    const call = vi.fn().mockResolvedValue(notReady("5"));
    const onFirstWait = vi.fn();
    await withAttachmentWait(call, {
      wait: false,
      errorCode,
      onFirstWait,
      now: c.now,
      sleep: c.sleep,
    });
    expect(call).toHaveBeenCalledTimes(1);
    expect(c.sleeps).toEqual([]);
    expect(onFirstWait).not.toHaveBeenCalled();
  });

  it("does not retry other errors", async () => {
    const c = clock();
    const forbidden = {
      error: {
        success: false,
        error: { code: "not_found", message: "Attachment not found" },
      },
    };
    const call = vi.fn().mockResolvedValue(forbidden);
    expect(
      await withAttachmentWait(call, {
        wait: true,
        errorCode,
        now: c.now,
        sleep: c.sleep,
      }),
    ).toBe(forbidden);
    expect(call).toHaveBeenCalledTimes(1);
  });
});

describe("attachment wait timing", () => {
  it("reads only a whole-seconds Retry-After", () => {
    expect(
      retryAfterMs(new Response(null, { headers: { "retry-after": "5" } })),
    ).toBe(5000);
    expect(
      retryAfterMs(
        new Response(null, {
          headers: { "retry-after": "Wed, 21 Oct 2015 07:28:00 GMT" },
        }),
      ),
    ).toBeUndefined();
    expect(retryAfterMs(undefined)).toBeUndefined();
  });

  it("caps the delay at 8s and at the remaining budget", () => {
    expect(nextAttachmentWaitDelay(0, 60_000, 120_000)).toBe(8000);
    expect(nextAttachmentWaitDelay(6, 60_000, undefined)).toBe(8000);
    expect(nextAttachmentWaitDelay(0, 300, 5000)).toBe(300);
  });
});

describe("download command --wait flag", () => {
  const operation = (sdkName: string) =>
    createOperationCommand({
      binaryResponse: true,
      bodyRequired: false,
      command: "download",
      description: "Download",
      hasJsonBody: false,
      method: "GET",
      operationId: sdkName,
      path: "/download",
      pathParams: [],
      queryParams: [],
      requestSchema: null,
      responseSchema: null,
      sdkName,
      summary: "Download",
      tag: "Emails",
      tagCommand: "emails",
    }) as unknown as {
      flags: Record<string, { allowNo?: boolean; default?: unknown }>;
    };

  it.each([
    "downloadAttachments",
    "downloadEmailAttachmentPart",
    "downloadSentAttachmentPart",
  ])("waits by default on %s with a --no-wait escape", (sdkName) => {
    const flag = operation(sdkName).flags.wait;
    expect(flag?.allowNo).toBe(true);
    expect(flag?.default).toBe(true);
  });

  it("is not added to other downloads", () => {
    expect(operation("downloadRawEmail").flags.wait).toBeUndefined();
  });
});
