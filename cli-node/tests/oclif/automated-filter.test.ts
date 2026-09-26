import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthenticatedCliApiClient: vi.fn(),
  listEmails: vi.fn(),
  searchEmails: vi.fn(),
}));

vi.mock("@primitivedotdev/api-core", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@primitivedotdev/api-core")>();
  return {
    ...actual,
    listEmails: mocks.listEmails,
    searchEmails: mocks.searchEmails,
    operations: {
      ...actual.operations,
      listEmails: mocks.listEmails,
      searchEmails: mocks.searchEmails,
    },
  };
});

vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: mocks.createAuthenticatedCliApiClient,
}));

import {
  AUTOMATED_FILTER_UNSUPPORTED_CODE,
  AutomatedFilterUnsupportedError,
  assertAutomatedVerdict,
  automatedSurfaceForOperation,
  ensureSearchReportsAutomated,
  hasAutomatedVerdict,
  isAutomatedRejectedError,
  queryUsesAutomated,
} from "../../src/oclif/automated-filter.js";
import {
  buildEmailSearchQuery,
  fetchEmailSearchPage,
  filtersFromFlags,
} from "../../src/oclif/commands/emails-poll.js";
import { COMMANDS } from "../../src/oclif/index.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    sender: "alice@example.com",
    recipient: "agent@example.com",
    subject: "hello",
    received_at: "2026-09-20T00:00:00.000Z",
    created_at: "2026-09-20T00:00:00.000Z",
    status: "completed",
    domain: "example.com",
    webhook_attempt_count: 0,
    awaiting: "you",
    reply_count: 0,
    last_replied_at: null,
    automated: false,
    automated_reasons: [],
    ...overrides,
  };
}

function oldRow(overrides: Record<string, unknown> = {}) {
  const { automated: _a, automated_reasons: _r, ...rest } = row(overrides);
  return rest;
}

const REJECTED = {
  error: {
    success: false,
    error: {
      code: "validation_error",
      message: "Unrecognized key(s) in object: 'automated'",
    },
  },
};

describe("hasAutomatedVerdict", () => {
  it("accepts rows carrying both fields", () => {
    expect(hasAutomatedVerdict(row())).toBe(true);
    expect(
      hasAutomatedVerdict(
        row({ automated: true, automated_reasons: ["list_id"] }),
      ),
    ).toBe(true);
  });

  it("rejects rows from a server without the verdict", () => {
    expect(hasAutomatedVerdict(oldRow())).toBe(false);
    expect(hasAutomatedVerdict(row({ automated: "false" }))).toBe(false);
    expect(hasAutomatedVerdict(row({ automated_reasons: "list_id" }))).toBe(
      false,
    );
    expect(hasAutomatedVerdict(row({ automated_reasons: [1] }))).toBe(false);
    expect(hasAutomatedVerdict(null)).toBe(false);
    expect(hasAutomatedVerdict("row")).toBe(false);
  });
});

describe("assertAutomatedVerdict", () => {
  it("passes an empty page, complete rows and matching values", () => {
    expect(() =>
      assertAutomatedVerdict([], "GET /emails", false),
    ).not.toThrow();
    expect(() =>
      assertAutomatedVerdict([row()], "GET /emails", false),
    ).not.toThrow();
    expect(() =>
      assertAutomatedVerdict([row({ automated: true })], "GET /emails"),
    ).not.toThrow();
  });

  it("names the surface and the code when fields are missing", () => {
    try {
      assertAutomatedVerdict([row(), oldRow()], "GET /emails");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AutomatedFilterUnsupportedError);
      expect((error as AutomatedFilterUnsupportedError).code).toBe(
        AUTOMATED_FILTER_UNSUPPORTED_CODE,
      );
      expect((error as Error).message).toContain(
        "GET /emails returned 1 of 2 emails without the `automated`",
      );
    }
  });

  it("fails when the server ignored the filter", () => {
    expect(() =>
      assertAutomatedVerdict(
        [row({ automated: true, automated_reasons: ["list_id"] })],
        "GET /emails",
        false,
      ),
    ).toThrow(
      /ignored `automated=false` and returned 1 email with `automated=true`/,
    );
  });
});

describe("filter detection", () => {
  it("recognizes the DSL term", () => {
    expect(queryUsesAutomated("automated:false invoice")).toBe(true);
    expect(queryUsesAutomated("invoice (-automated:true)")).toBe(true);
    expect(queryUsesAutomated("notautomated:true")).toBe(false);
    expect(queryUsesAutomated(null)).toBe(false);
  });

  it("recognizes a rejected parameter or term", () => {
    expect(isAutomatedRejectedError(REJECTED.error)).toBe(true);
    expect(
      isAutomatedRejectedError({
        code: "validation_error",
        message: 'Unknown field "automated".',
      }),
    ).toBe(true);
    expect(
      isAutomatedRejectedError({
        error: { code: "validation_error", message: "limit too large" },
      }),
    ).toBe(false);
    expect(isAutomatedRejectedError({ error: { code: "not_found" } })).toBe(
      false,
    );
    expect(isAutomatedRejectedError(null)).toBe(false);
  });

  it("maps list and search calls that filter on automated", () => {
    expect(
      automatedSurfaceForOperation("listEmails", { automated: "false" }),
    ).toBe("GET /emails");
    expect(
      automatedSurfaceForOperation("searchEmails", { q: "automated:true" }),
    ).toBe("GET /emails/search");
    expect(automatedSurfaceForOperation("listEmails", { limit: 5 })).toBe(null);
    expect(
      automatedSurfaceForOperation("listDomains", { automated: "true" }),
    ).toBe(null);
    expect(automatedSurfaceForOperation("listEmails", undefined)).toBe(null);
  });
});

describe("ensureSearchReportsAutomated", () => {
  beforeEach(() => vi.clearAllMocks());

  it("probes once per client and caches a supported answer", async () => {
    const apiClient = { client: {} };
    mocks.searchEmails.mockResolvedValue({
      data: { success: true, data: [row()], meta: { cursor: null } },
    });
    await ensureSearchReportsAutomated(apiClient);
    await ensureSearchReportsAutomated(apiClient);
    expect(mocks.searchEmails).toHaveBeenCalledTimes(1);
    expect(mocks.searchEmails.mock.calls[0]?.[0].query).toEqual({
      limit: 1,
      include_facets: "false",
      snippet: "false",
    });
  });

  it("fails on an older server and on a failed probe, and retries after a failure", async () => {
    mocks.searchEmails.mockResolvedValueOnce({
      data: { success: true, data: [oldRow()], meta: { cursor: null } },
    });
    await expect(ensureSearchReportsAutomated({ client: {} })).rejects.toThrow(
      AutomatedFilterUnsupportedError,
    );

    const apiClient = { client: {} };
    mocks.searchEmails.mockResolvedValueOnce({
      error: { success: false, error: { code: "internal_error" } },
    });
    await expect(ensureSearchReportsAutomated(apiClient)).rejects.toThrow(
      /Could not verify that the server supports the `automated` filter/,
    );
    mocks.searchEmails.mockResolvedValueOnce({
      data: { success: true, data: [], meta: { cursor: null } },
    });
    await expect(ensureSearchReportsAutomated(apiClient)).resolves.toBe(
      undefined,
    );
  });
});

type Runnable = {
  run(argv: string[], options: { root: string }): Promise<unknown>;
};

async function runCommand(command: unknown, argv: string[]) {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  const logSpy = vi.spyOn(console, "log").mockImplementation((message = "") => {
    stdoutChunks.push(`${String(message)}\n`);
  });
  const stdoutSpy = vi
    .spyOn(process.stdout, "write")
    .mockImplementation((chunk) => {
      stdoutChunks.push(String(chunk));
      return true;
    });
  const stderrSpy = vi
    .spyOn(process.stderr, "write")
    .mockImplementation((chunk) => {
      stderrChunks.push(String(chunk));
      return true;
    });
  try {
    await (command as Runnable).run(argv, { root: CLI_ROOT });
    return {
      exitCode: process.exitCode,
      stdout: stdoutChunks.join(""),
      stderr: stderrChunks.join(""),
    };
  } finally {
    logSpy.mockRestore();
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    process.exitCode = previousExitCode;
  }
}

describe("generated emails list / search with --automated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAuthenticatedCliApiClient.mockResolvedValue({
      apiClient: { client: {} },
      auth: { kind: "api-key", source: "flag" },
      baseUrlOverridden: false,
    });
  });

  it("adds --automated to both generated commands", () => {
    for (const id of ["emails:list-emails", "emails:search-emails"]) {
      const flags = (
        COMMANDS[id] as unknown as {
          flags: Record<string, { options?: string[] }>;
        }
      ).flags;
      expect(flags.automated?.options).toEqual(["true", "false"]);
    }
  });

  it("prints rows that carry the verdict and match the filter", async () => {
    mocks.listEmails.mockResolvedValue({
      data: { success: true, data: [row()], meta: { cursor: null } },
    });
    const result = await runCommand(COMMANDS["emails:list-emails"], [
      "--automated",
      "false",
    ]);
    expect(mocks.listEmails.mock.calls[0]?.[0].query.automated).toBe("false");
    expect(result.exitCode).toBeUndefined();
    expect(JSON.parse(result.stdout)[0].automated).toBe(false);
  });

  it("refuses to print unfiltered rows from an older server", async () => {
    mocks.listEmails.mockResolvedValue({
      data: { success: true, data: [oldRow()], meta: { cursor: null } },
    });
    const result = await runCommand(COMMANDS["emails:list-emails"], [
      "--automated",
      "false",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(
      "does not support the `automated` filter yet",
    );
  });

  it("refuses rows that contradict the filter", async () => {
    mocks.searchEmails.mockResolvedValue({
      data: {
        success: true,
        data: [row({ automated: true, automated_reasons: ["precedence"] })],
        meta: { cursor: null },
      },
    });
    const result = await runCommand(COMMANDS["emails:search-emails"], [
      "--automated",
      "false",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("ignored `automated=false`");
  });

  it("probes an empty generated search and fails on an older server", async () => {
    mocks.searchEmails
      .mockResolvedValueOnce({
        data: { success: true, data: [], meta: { cursor: null } },
      })
      .mockResolvedValueOnce({
        data: { success: true, data: [oldRow()], meta: { cursor: null } },
      });
    const result = await runCommand(COMMANDS["emails:search-emails"], [
      "--automated",
      "true",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
  });

  it("explains a rejected filter", async () => {
    mocks.listEmails.mockResolvedValue(REJECTED);
    const result = await runCommand(COMMANDS["emails:list-emails"], [
      "--automated",
      "true",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("rejected the `automated` filter");
  });
});

describe("emails wait / watch --automated", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds the flag to both commands", () => {
    for (const id of ["emails:wait", "emails:watch"]) {
      const flags = (
        COMMANDS[id] as unknown as {
          flags: Record<string, { options?: string[] }>;
        }
      ).flags;
      expect(flags.automated?.options).toEqual(["true", "false"]);
    }
  });

  it("sends the filter and requires matching rows", async () => {
    const filters = filtersFromFlags({ automated: "false" });
    expect(buildEmailSearchQuery({ filters, pageSize: 10 }).automated).toBe(
      "false",
    );
    expect(
      buildEmailSearchQuery({ filters: filtersFromFlags({}), pageSize: 10 })
        .automated,
    ).toBeUndefined();
    mocks.searchEmails.mockResolvedValue({
      data: { success: true, data: [row()], meta: { cursor: null } },
    });
    const page = await fetchEmailSearchPage({
      apiClient: { client: {} } as never,
      filters,
      pageSize: 10,
    });
    expect(page.ok).toBe(true);
  });

  it("rejects an invalid value", () => {
    expect(() => filtersFromFlags({ automated: "yes" })).toThrow(
      "--automated must be true or false.",
    );
  });

  it("fails loudly on an older server, rejected or ignored", async () => {
    mocks.searchEmails.mockResolvedValue(REJECTED);
    await expect(
      fetchEmailSearchPage({
        apiClient: { client: {} } as never,
        filters: filtersFromFlags({ automated: "false" }),
        pageSize: 10,
      }),
    ).rejects.toThrow(/rejected the `automated` filter/);
    mocks.searchEmails.mockResolvedValue({
      data: { success: true, data: [oldRow()], meta: { cursor: null } },
    });
    await expect(
      fetchEmailSearchPage({
        apiClient: { client: {} } as never,
        filters: filtersFromFlags({ q: "automated:false" }),
        pageSize: 10,
      }),
    ).rejects.toThrow(AutomatedFilterUnsupportedError);
  });

  it("probes an empty page", async () => {
    mocks.searchEmails
      .mockResolvedValueOnce({
        data: { success: true, data: [], meta: { cursor: null } },
      })
      .mockResolvedValueOnce({
        data: { success: true, data: [oldRow()], meta: { cursor: null } },
      });
    await expect(
      fetchEmailSearchPage({
        apiClient: { client: {} } as never,
        filters: filtersFromFlags({ automated: "true" }),
        pageSize: 10,
      }),
    ).rejects.toThrow(AutomatedFilterUnsupportedError);
  });
});
