import { afterEach, describe, expect, it, vi } from "vitest";
import { writeErrorWithHints } from "../../src/oclif/api-command.js";
import {
  backoffDelay,
  describeApiFailure,
  parseRetryAfter,
  retryTransient,
  transientFailure,
} from "../../src/oclif/transient-retry.js";

function failed(status: number, body: unknown, headers = {}) {
  return { error: body, response: new Response(null, { status, headers }) };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("transient API failures", () => {
  it("parses Retry-After as seconds or an HTTP-date", () => {
    const now = Date.parse("2026-09-27T00:00:00Z");
    expect(parseRetryAfter("60", now)).toBe(60_000);
    expect(parseRetryAfter(" 0 ", now)).toBe(0);
    expect(parseRetryAfter("Sun, 27 Sep 2026 00:00:45 GMT", now)).toBe(45_000);
    expect(parseRetryAfter("Sat, 26 Sep 2026 23:00:00 GMT", now)).toBe(0);
    for (const bad of [undefined, null, "", "-5", "soon", "1.5"])
      expect(parseRetryAfter(bad, now)).toBeUndefined();
  });

  it("retries 429, 502, 503, 504 and network errors only", () => {
    expect(transientFailure(failed(429, {}, { "Retry-After": "60" }))).toEqual({
      reason: "rate_limited",
      status: 429,
      retryAfterMs: 60_000,
    });
    for (const status of [502, 503, 504])
      expect(transientFailure(failed(status, {}))).toEqual({
        reason: "unavailable",
        status,
      });
    expect(transientFailure({ error: new TypeError("fetch failed") })).toEqual({
      reason: "network",
    });
    for (const status of [400, 401, 403, 404, 409, 500])
      expect(transientFailure(failed(status, {}))).toBeNull();
    expect(
      transientFailure({ error: new DOMException("Aborted", "AbortError") }),
    ).toBeNull();
    // An API payload without a response is not a network error.
    expect(transientFailure({ error: { code: "not_found" } })).toBeNull();
    expect(transientFailure({ data: {}, response: new Response() })).toBeNull();
  });

  it("backs off exponentially with jitter, capped at 30 s", () => {
    expect(backoffDelay(0, () => 0)).toBe(500);
    expect(backoffDelay(0, () => 1)).toBe(1000);
    expect(backoffDelay(3, () => 1)).toBe(8000);
    expect(backoffDelay(20, () => 1)).toBe(30_000);
    expect(backoffDelay(20, () => 0)).toBe(15_000);
  });

  it("describes a failure by the API's code and message", () => {
    expect(
      describeApiFailure(
        failed(404, {
          success: false,
          error: { code: "not_found", message: "Email not found" },
        }),
      ),
    ).toBe("not_found (Email not found)");
    expect(
      describeApiFailure(
        failed(404, { code: "not_found", message: "line\none" }),
      ),
    ).toBe("not_found (line one)");
    expect(describeApiFailure(failed(500, {}))).toBe("HTTP 500");
    expect(
      describeApiFailure({ error: new TypeError("fetch failed: proxy") }),
    ).toBe("network error");
  });

  it("does not retry outside a wait", async () => {
    const read = vi.fn(async () => failed(429, {}, { "Retry-After": "0" }));
    const result = await retryTransient(read, { deadline: undefined });
    expect(result?.response.status).toBe(429);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("prints one notice per backoff and returns the first lasting result", async () => {
    const notices: string[] = [];
    const read = vi
      .fn<() => Promise<ReturnType<typeof failed>>>()
      .mockResolvedValueOnce(failed(429, {}, { "Retry-After": "0" }))
      .mockResolvedValueOnce(failed(503, {}, { "Retry-After": "0" }))
      .mockResolvedValueOnce(failed(404, { code: "not_found" }));
    const result = await retryTransient(read, {
      deadline: null,
      notice: (message) => notices.push(message),
    });
    expect(result?.response.status).toBe(404);
    expect(notices).toEqual([
      "primitive: rate limited; retrying in 0 s.",
      "primitive: API unavailable (HTTP 503); retrying in 0 s.",
    ]);
  });
});

describe("rate limit hint", () => {
  function written(run: () => void): string {
    const chunks: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      chunks.push(String(chunk));
      return true;
    });
    run();
    return chunks.join("");
  }

  it("says when to retry from Retry-After", () => {
    const text = written(() =>
      writeErrorWithHints(
        { code: "rate_limit_exceeded", message: "Too many requests" },
        new Response(null, { status: 429, headers: { "Retry-After": "60" } }),
      ),
    );
    expect(text).toContain('"code": "rate_limit_exceeded"');
    expect(text).toContain(
      "Hint: this request was rate limited. Retry in 60 s.",
    );
  });

  it("explains the rate limit from the code alone", () => {
    const text = written(() =>
      writeErrorWithHints({ code: "rate_limited", message: "Slow down" }),
    );
    expect(text).toContain(
      "Hint: this request was rate limited. Wait before retrying",
    );
  });
});
