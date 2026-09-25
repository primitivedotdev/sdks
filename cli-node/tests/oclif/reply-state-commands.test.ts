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

import EmailsLatestCommand, {
  formatHeader,
  formatRow,
} from "../../src/oclif/commands/emails-latest.js";
import {
  buildEmailSearchQuery,
  fetchEmailSearchPage,
  filtersFromFlags,
} from "../../src/oclif/commands/emails-poll.js";
import EmailsWaitCommand from "../../src/oclif/commands/emails-wait.js";
import EmailsWatchCommand from "../../src/oclif/commands/emails-watch.js";
import SearchCommand from "../../src/oclif/commands/search.js";
import { COMMANDS } from "../../src/oclif/index.js";
import { ReplyStateUnsupportedError } from "../../src/oclif/reply-state.js";

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
    attachment_count: 0,
    from_known_address: false,
    awaiting: "you",
    reply_count: 0,
    last_replied_at: null,
    ...overrides,
  };
}

function oldRow(overrides: Record<string, unknown> = {}) {
  const {
    awaiting: _a,
    reply_count: _r,
    last_replied_at: _l,
    ...rest
  } = row(overrides);
  return rest;
}

const REJECTED = {
  error: {
    success: false,
    error: {
      code: "validation_error",
      message: "Unrecognized key(s) in object: 'awaiting'",
    },
  },
};

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
  const stderrSpy = vi
    .spyOn(process.stderr, "write")
    .mockImplementation((chunk) => {
      stderrChunks.push(String(chunk));
      return true;
    });
  let thrown: unknown;
  try {
    await (command as Runnable).run(argv, { root: CLI_ROOT });
  } catch (error) {
    thrown = error;
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
    thrown,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createAuthenticatedCliApiClient.mockResolvedValue({
    apiClient: { client: {} },
    auth: { kind: "api-key", source: "flag", apiBaseUrl: "http://x" },
    baseUrlOverridden: false,
  });
});

describe("reply-state table columns", () => {
  it("adds AWAITING and REPLIES before SUBJECT", () => {
    const header = formatHeader(8);
    expect(header).toMatch(/TO\s+AWAITING\s+REPLIES\s+SUBJECT$/);
    const line = formatRow(
      row({ awaiting: "them", reply_count: 2 }) as never,
      8,
    );
    expect(line).toMatch(/them\s+2\s+hello\s*$/);
  });

  it("shows dashes for rows from a server without reply state", () => {
    expect(formatRow(oldRow() as never, 8)).toMatch(/-\s+-\s+hello\s*$/);
  });
});

describe("emails latest --awaiting", () => {
  it("passes the filter and prints the rows", async () => {
    mocks.listEmails.mockResolvedValue({
      data: { success: true, data: [row()], meta: { cursor: null } },
    });
    const result = await runCommand(EmailsLatestCommand, ["--awaiting", "you"]);
    expect(mocks.listEmails.mock.calls[0]?.[0].query).toEqual({
      limit: 10,
      awaiting: "you",
    });
    expect(result.exitCode).toBeUndefined();
    expect(result.stdout).toContain("you");
  });

  it("does not send awaiting without the flag", async () => {
    mocks.listEmails.mockResolvedValue({
      data: { success: true, data: [oldRow()], meta: { cursor: null } },
    });
    const result = await runCommand(EmailsLatestCommand, []);
    expect(mocks.listEmails.mock.calls[0]?.[0].query).toEqual({ limit: 10 });
    expect(result.exitCode).toBeUndefined();
  });

  it("fails loudly when the server rejects the filter", async () => {
    mocks.listEmails.mockResolvedValue(REJECTED);
    const result = await runCommand(EmailsLatestCommand, ["--awaiting", "you"]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(
      "The server does not support reply state yet",
    );
  });

  it("fails loudly when rows lack reply state, even with --json", async () => {
    mocks.listEmails.mockResolvedValue({
      data: { success: true, data: [oldRow()], meta: { cursor: null } },
    });
    const result = await runCommand(EmailsLatestCommand, [
      "--awaiting",
      "you",
      "--json",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("without the `awaiting`");
  });
});

describe("emails wait / watch --awaiting", () => {
  it("declares the flag on both commands", () => {
    for (const command of [EmailsWaitCommand, EmailsWatchCommand]) {
      const flags = command.flags as Record<string, { options?: string[] }>;
      expect(flags.awaiting?.options).toEqual(["you", "them"]);
    }
  });

  it("maps the flag into the search query", () => {
    const filters = filtersFromFlags({ awaiting: "you" });
    expect(buildEmailSearchQuery({ filters, pageSize: 10 }).awaiting).toBe(
      "you",
    );
    expect(
      buildEmailSearchQuery({ filters: filtersFromFlags({}), pageSize: 10 })
        .awaiting,
    ).toBeUndefined();
  });

  it("throws when search ignores the filter on an older server", async () => {
    mocks.searchEmails.mockResolvedValue({
      data: { success: true, data: [oldRow()], meta: { cursor: null } },
    });
    await expect(
      fetchEmailSearchPage({
        apiClient: { client: {} } as never,
        filters: filtersFromFlags({ awaiting: "you" }),
        pageSize: 10,
      }),
    ).rejects.toThrow(ReplyStateUnsupportedError);
    await expect(
      fetchEmailSearchPage({
        apiClient: { client: {} } as never,
        filters: filtersFromFlags({ q: "awaiting:you" }),
        pageSize: 10,
      }),
    ).rejects.toThrow(ReplyStateUnsupportedError);
  });

  it("probes once per client when polls come back empty", async () => {
    const apiClient = { client: {} } as never;
    mocks.searchEmails.mockResolvedValue({
      data: { success: true, data: [], meta: { cursor: null } },
    });
    for (let i = 0; i < 3; i++) {
      const page = await fetchEmailSearchPage({
        apiClient,
        filters: filtersFromFlags({ awaiting: "you" }),
        pageSize: 10,
      });
      expect(page.ok).toBe(true);
    }
    // Three polls plus a single probe.
    expect(mocks.searchEmails).toHaveBeenCalledTimes(4);
  });

  it("does not require reply state without the filter", async () => {
    mocks.searchEmails.mockResolvedValue({
      data: { success: true, data: [oldRow()], meta: { cursor: null } },
    });
    const page = await fetchEmailSearchPage({
      apiClient: { client: {} } as never,
      filters: filtersFromFlags({}),
      pageSize: 10,
    });
    expect(page.ok).toBe(true);
  });

  it("emails wait exits nonzero with the reply-state message", async () => {
    mocks.searchEmails.mockResolvedValue(REJECTED);
    const result = await runCommand(EmailsWaitCommand, [
      "--awaiting",
      "you",
      "--timeout",
      "1",
    ]);
    expect(String(result.thrown)).toContain(
      "The server does not support reply state yet",
    );
  });

  it("emails watch exits nonzero with the reply-state message", async () => {
    mocks.searchEmails.mockResolvedValue({
      data: { success: true, data: [oldRow()], meta: { cursor: null } },
    });
    const result = await runCommand(EmailsWatchCommand, [
      "--awaiting",
      "them",
      "--seconds",
      "1",
    ]);
    expect(String(result.thrown)).toContain(
      "The server does not support reply state yet",
    );
  });
});

describe("search --awaiting", () => {
  it("sends the filter and prints matching rows", async () => {
    mocks.searchEmails.mockResolvedValue({
      data: { success: true, data: [row()], meta: { cursor: null } },
    });
    const result = await runCommand(SearchCommand, [
      "invoice",
      "--awaiting",
      "you",
    ]);
    expect(mocks.searchEmails.mock.calls[0]?.[0].query.awaiting).toBe("you");
    expect(result.exitCode).toBeUndefined();
  });

  it("fails loudly on rows without reply state", async () => {
    mocks.searchEmails.mockResolvedValue({
      data: { success: true, data: [oldRow()], meta: { cursor: null } },
    });
    const result = await runCommand(SearchCommand, ["awaiting:you"]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("does not support reply state yet");
  });

  it("fails loudly when the DSL term is rejected", async () => {
    mocks.searchEmails.mockResolvedValue({
      error: {
        success: false,
        error: {
          code: "validation_error",
          message: 'Unknown field "awaiting". Known fields: from, to.',
        },
      },
    });
    const result = await runCommand(SearchCommand, ["awaiting:you"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("rejected the `awaiting` filter");
  });

  it("probes an empty filtered result and fails on an older server", async () => {
    mocks.searchEmails
      .mockResolvedValueOnce({
        data: { success: true, data: [], meta: { cursor: null } },
      })
      .mockResolvedValueOnce({
        data: { success: true, data: [oldRow()], meta: { cursor: null } },
      });
    const result = await runCommand(SearchCommand, [
      "invoice",
      "--awaiting",
      "you",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("does not support reply state yet");
    expect(mocks.searchEmails.mock.calls[1]?.[0].query).toEqual({
      limit: 1,
      include_facets: "false",
      snippet: "false",
    });
  });

  it("keeps an empty filtered result when the server reports reply state", async () => {
    mocks.searchEmails
      .mockResolvedValueOnce({
        data: { success: true, data: [], meta: { cursor: null } },
      })
      .mockResolvedValueOnce({
        data: { success: true, data: [row()], meta: { cursor: null } },
      });
    const result = await runCommand(SearchCommand, [
      "invoice",
      "--awaiting",
      "you",
    ]);
    expect(result.exitCode).toBeUndefined();
    expect(result.stderr).toContain("No matching mail.");
  });

  it("fails, and retries later, when the verification probe fails", async () => {
    const apiClient = { client: {} } as never;
    mocks.searchEmails
      .mockResolvedValueOnce({
        data: { success: true, data: [], meta: { cursor: null } },
      })
      .mockResolvedValueOnce({
        error: {
          success: false,
          error: { code: "internal_error", message: "boom" },
        },
      });
    await expect(
      fetchEmailSearchPage({
        apiClient,
        filters: filtersFromFlags({ awaiting: "you" }),
        pageSize: 10,
      }),
    ).rejects.toThrow(/Could not verify that the server supports reply state/);
    mocks.searchEmails
      .mockResolvedValueOnce({
        data: { success: true, data: [], meta: { cursor: null } },
      })
      .mockResolvedValueOnce({
        data: { success: true, data: [row()], meta: { cursor: null } },
      });
    const page = await fetchEmailSearchPage({
      apiClient,
      filters: filtersFromFlags({ awaiting: "you" }),
      pageSize: 10,
    });
    expect(page.ok).toBe(true);
    expect(mocks.searchEmails).toHaveBeenCalledTimes(4);
  });

  it("keeps an empty filtered result for an empty mailbox", async () => {
    mocks.searchEmails.mockResolvedValue({
      data: { success: true, data: [], meta: { cursor: null } },
    });
    const result = await runCommand(SearchCommand, ["awaiting:them"]);
    expect(result.exitCode).toBeUndefined();
  });

  it("rejects --awaiting with --mode", async () => {
    const result = await runCommand(SearchCommand, [
      "x",
      "--mode",
      "semantic",
      "--awaiting",
      "you",
    ]);
    expect(result.exitCode).toBe(2);
    expect(mocks.searchEmails).not.toHaveBeenCalled();
  });
});

describe("generated emails list / search with --awaiting", () => {
  it("adds --awaiting to both generated commands", () => {
    for (const id of ["emails:list-emails", "emails:search-emails"]) {
      const flags = (
        COMMANDS[id] as unknown as {
          flags: Record<string, { options?: string[] }>;
        }
      ).flags;
      expect(flags.awaiting?.options).toEqual(["you", "them"]);
    }
  });

  it("refuses to print unfiltered rows from an older server", async () => {
    mocks.listEmails.mockResolvedValue({
      data: { success: true, data: [oldRow()], meta: { cursor: null } },
    });
    const result = await runCommand(COMMANDS["emails:list-emails"], [
      "--awaiting",
      "you",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("does not support reply state yet");
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
      "--awaiting",
      "you",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
  });

  it("explains a rejected filter", async () => {
    mocks.searchEmails.mockResolvedValue(REJECTED);
    const result = await runCommand(COMMANDS["emails:search-emails"], [
      "--awaiting",
      "you",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("rejected the `awaiting` filter");
  });

  it("prints rows that carry reply state", async () => {
    mocks.listEmails.mockResolvedValue({
      data: { success: true, data: [row()], meta: { cursor: null } },
    });
    const result = await runCommand(COMMANDS["emails:list-emails"], [
      "--awaiting",
      "you",
    ]);
    expect(result.exitCode).toBeUndefined();
    expect(JSON.parse(result.stdout)[0].awaiting).toBe("you");
  });
});
