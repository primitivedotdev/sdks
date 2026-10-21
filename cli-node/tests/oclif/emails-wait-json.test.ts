import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthenticatedCliApiClient: vi.fn(),
  searchEmails: vi.fn(),
}));

vi.mock("@primitivedotdev/api-core", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@primitivedotdev/api-core")>();
  return {
    ...actual,
    searchEmails: mocks.searchEmails,
    operations: { ...actual.operations, searchEmails: mocks.searchEmails },
  };
});

vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: mocks.createAuthenticatedCliApiClient,
}));

import { COMMANDS } from "../../src/oclif/index.js";
import { STREAMING_JSON_COMMAND_IDS } from "../../src/oclif/json-output.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");

type Runnable = {
  run(argv: string[], options: { root: string }): Promise<unknown>;
};

function row(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    sender: "alice@example.com",
    recipient: "agent@example.com",
    subject: `hello ${id}`,
    received_at: "2026-09-20T00:00:00.000Z",
    created_at: "2026-09-20T00:00:00.000Z",
    status: "completed",
    domain: "example.com",
    webhook_attempt_count: 0,
    thread_id: `thread-${id}`,
    ...overrides,
  };
}

function page(rows: unknown[]) {
  return { data: { success: true, data: rows, meta: { cursor: null } } };
}

// Run through the registry, as the installed CLI does, and record stdout
// and stderr separately and interleaved (as `2>&1` would see them).
async function runWait(argv: string[]) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const merged: string[] = [];
  const out = (text: string) => {
    stdout.push(text);
    merged.push(text);
  };
  const err = (text: string) => {
    stderr.push(text);
    merged.push(text);
  };
  const spies = [
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      out(String(chunk));
      return true;
    }),
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
      err(String(chunk));
      return true;
    }),
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      out(`${args.map(String).join(" ")}\n`);
    }),
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      err(`${args.map(String).join(" ")}\n`);
    }),
  ];
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  let thrown: unknown;
  try {
    await (COMMANDS["emails:wait"] as unknown as Runnable).run(argv, {
      root: CLI_ROOT,
    });
  } catch (error) {
    thrown = error;
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
  const exitCode = process.exitCode;
  process.exitCode = previousExitCode;
  const lines = (chunks: string[]) =>
    chunks
      .join("")
      .split("\n")
      .filter((line) => line.trim() !== "");
  return {
    exitCode,
    merged: lines(merged),
    stderr: stderr.join(""),
    stdout: lines(stdout),
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

describe("emails wait --json", () => {
  it("streams its own JSON lines instead of one guarded document", () => {
    expect(STREAMING_JSON_COMMAND_IDS.has("emails:wait")).toBe(true);
  });

  it("prints one JSON object per matching email", async () => {
    mocks.searchEmails.mockResolvedValue(page([row("e2"), row("e1")]));
    const result = await runWait(["--json", "--number", "2"]);
    expect(result.thrown).toBeUndefined();
    expect(result.exitCode).toBeUndefined();
    expect(result.stderr).toBe("");
    expect(result.merged).toEqual(result.stdout);
    const emails = result.stdout.map((line) => JSON.parse(line));
    expect(emails).toHaveLength(2);
    for (const email of emails) {
      expect(email).toMatchObject({
        id: expect.any(String),
        sender: "alice@example.com",
        recipient: "agent@example.com",
        subject: expect.any(String),
        received_at: "2026-09-20T00:00:00.000Z",
        thread_id: expect.any(String),
      });
    }
    expect(new Set(emails.map((email) => email.id))).toEqual(
      new Set(["e1", "e2"]),
    );
  });

  it("prints the same lines as the default output", async () => {
    mocks.searchEmails.mockResolvedValue(page([row("e1")]));
    const plain = await runWait([]);
    mocks.searchEmails.mockResolvedValue(page([row("e1")]));
    const json = await runWait(["--json"]);
    expect(json.stdout).toEqual(plain.stdout);
  });

  it("ends a timeout with one JSON error line and exit 1", async () => {
    mocks.searchEmails.mockResolvedValue(page([row("e1")]));
    const result = await runWait([
      "--json",
      "--number",
      "2",
      "--timeout",
      "1",
      "--interval",
      "1",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    expect(result.merged).toEqual(result.stdout);
    expect(result.stdout).toHaveLength(2);
    expect(JSON.parse(result.stdout[0] as string)).toMatchObject({ id: "e1" });
    expect(JSON.parse(result.stdout[1] as string)).toEqual({
      error: {
        code: "wait_timeout",
        message: "Timed out waiting for 2 matching emails; received 1.",
      },
      exit_code: 1,
      matched: 1,
    });
  });

  it("keeps the plain-text timeout on stderr without --json", async () => {
    mocks.searchEmails.mockResolvedValue(page([]));
    const result = await runWait(["--timeout", "1", "--interval", "1"]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toEqual([]);
    expect(result.stderr).toContain(
      "Timed out waiting for 1 matching email; received 0.",
    );
  });

  it("reports an API error as one JSON line", async () => {
    mocks.searchEmails.mockResolvedValue({
      error: {
        success: false,
        error: { code: "service_unavailable", message: "try again" },
      },
    });
    const result = await runWait(["--json"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    expect(result.stdout).toHaveLength(1);
    expect(JSON.parse(result.stdout[0] as string)).toMatchObject({
      error: { code: "service_unavailable", message: "try again" },
      exit_code: 1,
    });
  });

  it("reports a thrown error as one JSON line and keeps the exit", async () => {
    mocks.searchEmails.mockResolvedValue(page([]));
    const result = await runWait(["--json", "--since", "not a date"]);
    expect(result.thrown).toBeDefined();
    expect(result.stderr).toBe("");
    expect(result.stdout).toHaveLength(1);
    const line = JSON.parse(result.stdout[0] as string);
    expect(line.exit_code).toBe(1);
    expect(line.error.message).toEqual(expect.any(String));
  });

  it("rejects --json with --table", async () => {
    const result = await runWait(["--json", "--table"]);
    expect(mocks.searchEmails).not.toHaveBeenCalled();
    expect((result.thrown as { oclif?: { exit?: number } }).oclif?.exit).toBe(
      2,
    );
    expect(result.stderr).toBe("");
    expect(result.stdout).toHaveLength(1);
    const line = JSON.parse(result.stdout[0] as string);
    expect(line.exit_code).toBe(2);
    expect(line.error.message).toContain("--table");
  });

  it("rejects --table with --json on the plain path too", async () => {
    const flags = (
      COMMANDS["emails:wait"] as unknown as {
        flags: Record<string, { exclusive?: string[] }>;
      }
    ).flags;
    expect(flags.json?.exclusive).toEqual(["table"]);
    expect(flags.table?.exclusive).toEqual(["json"]);
  });
});
