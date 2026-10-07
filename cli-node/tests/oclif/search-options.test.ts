import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthenticatedCliApiClient: vi.fn(),
  searchEmails: vi.fn(),
  semanticSearch: vi.fn(),
}));

vi.mock("@primitivedotdev/api-core", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@primitivedotdev/api-core")>();
  return {
    ...actual,
    searchEmails: mocks.searchEmails,
    semanticSearch: mocks.semanticSearch,
  };
});

vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: mocks.createAuthenticatedCliApiClient,
}));

import SearchCommand, {
  formatSearchTotal,
} from "../../src/oclif/commands/search.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");
const THREAD_ID = "22222222-2222-4222-8222-222222222222";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    sender: "alice@example.com",
    recipient: "agent@example.com",
    subject: "quarterly invoice",
    received_at: "2026-09-20T00:00:00.000Z",
    created_at: "2026-09-20T00:00:00.000Z",
    status: "completed",
    domain: "example.com",
    webhook_attempt_count: 0,
    attachment_count: 0,
    from_known_address: false,
    awaiting: "you",
    reply_count: 0,
    last_replied_at: null,
    thread_id: THREAD_ID,
    direction: "inbound",
    ...overrides,
  };
}

type Runnable = {
  run(argv: string[], options: { root: string }): Promise<unknown>;
};

async function runSearch(argv: string[]) {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  const logSpy = vi.spyOn(console, "log").mockImplementation((message = "") => {
    stdoutChunks.push(`${String(message)}\n`);
  });
  const stderrSpy = vi
    .spyOn(process.stderr, "write")
    .mockImplementation((chunk) => {
      stderrChunks.push(String(chunk));
      return true;
    });
  try {
    await (SearchCommand as unknown as Runnable).run(argv, { root: CLI_ROOT });
  } finally {
    logSpy.mockRestore();
    stderrSpy.mockRestore();
  }
  const exitCode = process.exitCode;
  process.exitCode = previousExitCode;
  return {
    exitCode,
    stdout: stdoutChunks.join(""),
    stderr: stderrChunks.join(""),
  };
}

function sentQuery(): Record<string, unknown> {
  return mocks.searchEmails.mock.calls[0]?.[0].query;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createAuthenticatedCliApiClient.mockResolvedValue({
    apiClient: { client: {} },
    auth: { kind: "api-key", source: "flag", apiBaseUrl: "http://x" },
    baseUrlOverridden: false,
  });
  mocks.searchEmails.mockResolvedValue({
    data: {
      success: true,
      data: [row()],
      meta: { total: 1, total_capped: false, cursor: null },
    },
  });
});

describe("search --thread-id, --prefix, --no-count", () => {
  it("sends none of the new parameters by default", async () => {
    const result = await runSearch(["invoice"]);
    expect(result.exitCode).toBeUndefined();
    const query = sentQuery();
    expect(query).not.toHaveProperty("thread_id");
    expect(query).not.toHaveProperty("prefix");
    expect(query).not.toHaveProperty("count");
  });

  it("maps --thread-id to thread_id", async () => {
    const result = await runSearch(["invoice", "--thread-id", THREAD_ID]);
    expect(result.exitCode).toBeUndefined();
    expect(sentQuery().thread_id).toBe(THREAD_ID);
  });

  it("rejects a --thread-id that is not a UUID before calling the API", async () => {
    const result = await runSearch(["invoice", "--thread-id", "not-a-uuid"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--thread-id must be a UUID");
    expect(mocks.createAuthenticatedCliApiClient).not.toHaveBeenCalled();
    expect(mocks.searchEmails).not.toHaveBeenCalled();
  });

  it("maps --prefix to prefix=true", async () => {
    await runSearch(["quarterly invoi", "--prefix"]);
    expect(sentQuery().prefix).toBe("true");
    expect(sentQuery().q).toBe("quarterly invoi");
  });

  it("maps --no-count to count=false and --count to the default", async () => {
    await runSearch(["invoice", "--no-count"]);
    expect(sentQuery().count).toBe("false");

    mocks.searchEmails.mockClear();
    await runSearch(["invoice", "--count"]);
    expect(sentQuery()).not.toHaveProperty("count");
  });

  it("prints a null total as not counted with --envelope", async () => {
    mocks.searchEmails.mockResolvedValue({
      data: {
        success: true,
        data: [row()],
        meta: { total: null, total_capped: false, cursor: "next-page" },
      },
    });
    const result = await runSearch(["invoice", "--no-count", "--envelope"]);
    expect(result.exitCode).toBeUndefined();
    expect(result.stdout).toContain("quarterly invoice");
    expect(result.stderr).toContain("Total: not counted (--no-count)");
    expect(result.stderr).toContain("Next page: pass --cursor next-page");
  });

  it("passes a null total through unchanged with --json", async () => {
    mocks.searchEmails.mockResolvedValue({
      data: {
        success: true,
        data: [row()],
        meta: { total: null, total_capped: false, cursor: null },
      },
    });
    const result = await runSearch(["invoice", "--no-count", "--json"]);
    const parsed = JSON.parse(result.stdout) as {
      meta: { total: number | null };
      data: Array<{ thread_id: string | null; direction: string }>;
    };
    expect(parsed.meta.total).toBeNull();
    expect(parsed.data[0]?.thread_id).toBe(THREAD_ID);
    expect(parsed.data[0]?.direction).toBe("inbound");
  });

  it("prints a counted total with --envelope", async () => {
    const result = await runSearch(["invoice", "--envelope"]);
    expect(result.stderr).toContain("Total: 1\n");
  });

  it("rejects the new flags with --mode", async () => {
    for (const extra of [
      ["--thread-id", THREAD_ID],
      ["--prefix"],
      ["--no-count"],
    ]) {
      const result = await runSearch(["invoice", "--mode", "hybrid", ...extra]);
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("only applies to the lexical backend");
    }
    expect(mocks.semanticSearch).not.toHaveBeenCalled();
  });
});

describe("formatSearchTotal", () => {
  it("describes counted, capped, uncounted and missing totals", () => {
    expect(formatSearchTotal({ total: 42, total_capped: false })).toBe(
      "Total: 42",
    );
    expect(formatSearchTotal({ total: 1000, total_capped: true })).toBe(
      "Total: 1000+",
    );
    expect(formatSearchTotal({ total: null, total_capped: false })).toBe(
      "Total: not counted (--no-count)",
    );
    expect(formatSearchTotal(undefined)).toBe("Total: unknown");
  });
});
