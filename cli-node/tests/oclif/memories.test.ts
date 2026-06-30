import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthenticatedCliApiClient: vi.fn(),
  deleteMemory: vi.fn(),
  getMemory: vi.fn(),
  searchMemories: vi.fn(),
  setMemory: vi.fn(),
}));

vi.mock("@primitivedotdev/api-core", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@primitivedotdev/api-core")>();
  return {
    ...actual,
    deleteMemory: mocks.deleteMemory,
    getMemory: mocks.getMemory,
    searchMemories: mocks.searchMemories,
    setMemory: mocks.setMemory,
  };
});

vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: mocks.createAuthenticatedCliApiClient,
}));

import {
  buildDeleteMemoryQuery,
  buildGetMemoryQuery,
  buildSearchMemoriesQuery,
  buildSetMemoryInput,
  MemoriesDeleteCommand,
  MemoriesGetCommand,
  MemoriesSearchCommand,
  MemoriesSetCommand,
  memoryScopeForBody,
  memoryScopeForQuery,
  parseMemoryJson,
  resolveMemoryValueSource,
} from "../../src/oclif/commands/memories.js";
import { COMMANDS } from "../../src/oclif/index.js";

const FUNCTION_ID = "11111111-1111-4111-8111-111111111111";
const CLI_ROOT = resolve(import.meta.dirname, "../..");

const MEMORY_RECORD = {
  id: "22222222-2222-4222-8222-222222222222",
  key: "state",
  scope: { type: "function", id: FUNCTION_ID },
  value: { step: 2 },
  version: "1",
  created_at: "2026-06-29T18:00:00.000Z",
  updated_at: "2026-06-29T18:00:00.000Z",
  last_read_at: null,
  read_count: "0",
  write_count: "1",
  expires_at: null,
  created_by: "api_key:key-1",
  updated_by: "api_key:key-1",
};

type RunnableMemoryCommand = {
  run(argv: string[], options: { root: string }): Promise<unknown>;
};

async function runMemoryCommand(
  command: RunnableMemoryCommand,
  argv: string[],
): Promise<{
  exitCode: NodeJS.Process["exitCode"];
  stdout: string;
  stderr: string;
}> {
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
    await command.run(argv, { root: CLI_ROOT });
    return {
      exitCode: process.exitCode,
      stdout: stdoutChunks.join(""),
      stderr: stderrChunks.join(""),
    };
  } finally {
    logSpy.mockRestore();
    stderrSpy.mockRestore();
    process.exitCode = previousExitCode;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createAuthenticatedCliApiClient.mockResolvedValue({
    apiClient: { client: { host: "api" } },
    auth: { kind: "api-key" },
    baseUrlOverridden: false,
  });
  mocks.setMemory.mockResolvedValue({ data: { data: MEMORY_RECORD } });
  mocks.getMemory.mockResolvedValue({ data: { data: MEMORY_RECORD } });
  mocks.searchMemories.mockResolvedValue({
    data: {
      data: [MEMORY_RECORD],
      meta: { total: 1, limit: 50, cursor: null },
    },
  });
  mocks.deleteMemory.mockResolvedValue({
    data: {
      data: {
        deleted: true,
        key: "state",
        scope: { type: "function", id: FUNCTION_ID },
      },
    },
  });
});

describe("memories command registration", () => {
  it.each([
    "memories:set",
    "memories:get",
    "memories:delete",
    "memories:search",
    "memories:set-memory",
    "memories:get-memory",
    "memories:delete-memory",
    "memories:search-memories",
  ])("registers %s", (key) => {
    expect(COMMANDS[key]).toBeDefined();
  });

  it("keeps friendly commands hand-rolled", () => {
    expect(COMMANDS["memories:set"]).toBe(MemoriesSetCommand);
    expect(COMMANDS["memories:get"]).toBe(MemoriesGetCommand);
    expect(COMMANDS["memories:delete"]).toBe(MemoriesDeleteCommand);
    expect(COMMANDS["memories:search"]).toBe(MemoriesSearchCommand);
    expect(COMMANDS["memories:set"]).not.toBe(COMMANDS["memories:set-memory"]);
  });

  it("declares the memories parent topic", () => {
    const packageJsonPath = fileURLToPath(
      new URL("../../package.json", import.meta.url),
    );
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      oclif: { topics: Record<string, { description?: string }> };
    };

    expect(packageJson.oclif.topics.memories?.description).toContain(
      "set|get|delete|search",
    );
  });
});

describe("memories value parsing", () => {
  it("parses JSON objects and JSON strings", () => {
    expect(parseMemoryJson('{"step":2}')).toEqual({
      kind: "ok",
      value: { step: 2 },
    });
    expect(parseMemoryJson('"hello"')).toEqual({
      kind: "ok",
      value: "hello",
    });
  });

  it("rejects unquoted strings", () => {
    const result = parseMemoryJson("hello");
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("valid JSON");
      expect(result.message).toContain('"hello"');
    }
  });

  it("rejects non-finite JSON numbers", () => {
    const result = parseMemoryJson("1e999");
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("Numbers must be finite");
    }
  });

  it("requires exactly one value source", () => {
    expect(resolveMemoryValueSource({ value: '{"ok":true}' })).toEqual({
      kind: "ok",
      source: '{"ok":true}',
      label: "value",
    });
    expect(
      resolveMemoryValueSource({
        valueFile: "state.json",
        readFile: () => '{"file":true}',
      }),
    ).toEqual({
      kind: "ok",
      source: '{"file":true}',
      label: "--value-file state.json",
    });
    expect(
      resolveMemoryValueSource({ value: "{}", valueFile: "state.json" }),
    ).toMatchObject({ kind: "error" });
    expect(resolveMemoryValueSource({})).toMatchObject({ kind: "error" });
  });

  it("returns file read failures as value source errors", () => {
    const result = resolveMemoryValueSource({
      valueFile: "missing.json",
      readFile: () => {
        throw new Error("file missing");
      },
    });

    expect(result).toEqual({
      kind: "error",
      message: "file missing",
    });
  });
});

describe("memories scope and body builders", () => {
  it("builds function and org scopes for body requests", () => {
    expect(memoryScopeForBody({ function: FUNCTION_ID })).toEqual({
      type: "function",
      id: FUNCTION_ID,
    });
    expect(memoryScopeForBody({ org: true })).toEqual({ type: "org" });
    expect(memoryScopeForBody({})).toBeUndefined();
  });

  it("builds function and org scopes for query requests", () => {
    expect(memoryScopeForQuery({ function: FUNCTION_ID })).toEqual({
      scope_type: "function",
      scope_id: FUNCTION_ID,
    });
    expect(memoryScopeForQuery({ org: true })).toEqual({ scope_type: "org" });
    expect(memoryScopeForQuery({})).toEqual({});
  });

  it("rejects empty value-bearing flags instead of falling back", () => {
    expect(() => memoryScopeForBody({ function: "" })).toThrow(
      "--function must be a non-empty string",
    );
    expect(() => memoryScopeForQuery({ function: "" })).toThrow(
      "--function must be a non-empty string",
    );
    expect(() =>
      buildSetMemoryInput({
        key: "thread:state",
        value: { step: 2 },
        flags: { "if-version": "" },
      }),
    ).toThrow("--if-version must be a non-empty string");
    expect(() =>
      buildDeleteMemoryQuery({
        key: "thread:state",
        flags: { "if-version": "" },
      }),
    ).toThrow("--if-version must be a non-empty string");
  });

  it("builds set request bodies with scope, TTL, and CAS flags", () => {
    expect(
      buildSetMemoryInput({
        key: "thread:state",
        value: { step: 2 },
        flags: {
          function: FUNCTION_ID,
          "ttl-seconds": 60,
          "if-version": "7",
        },
      }),
    ).toEqual({
      key: "thread:state",
      value: { step: 2 },
      scope: { type: "function", id: FUNCTION_ID },
      ttl_seconds: 60,
      if_version: "7",
    });
  });

  it("builds get, delete, and search query shapes", () => {
    expect(
      buildGetMemoryQuery({ key: "thread:state", flags: { org: true } }),
    ).toEqual({ key: "thread:state", scope_type: "org" });
    expect(
      buildDeleteMemoryQuery({
        key: "thread:state",
        flags: { function: FUNCTION_ID, "if-version": "7" },
      }),
    ).toEqual({
      key: "thread:state",
      scope_type: "function",
      scope_id: FUNCTION_ID,
      if_version: "7",
    });
    expect(
      buildSearchMemoriesQuery({
        prefix: "thread:",
        flags: {
          function: FUNCTION_ID,
          limit: 25,
          "metadata-only": true,
          cursor: "thread:1",
        },
      }),
    ).toEqual({
      prefix: "thread:",
      limit: 25,
      include_value: "false",
      cursor: "thread:1",
      scope_type: "function",
      scope_id: FUNCTION_ID,
    });
  });
});

describe("memories black-box command invocation", () => {
  it("runs set/get/delete/search with the user-facing command shapes", async () => {
    await expect(
      runMemoryCommand(MemoriesSetCommand, [
        "state",
        '{"step":2}',
        "--function",
        FUNCTION_ID,
        "--if-version",
        "3",
      ]),
    ).resolves.toMatchObject({ exitCode: undefined });
    expect(mocks.setMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        client: { host: "api" },
        body: {
          key: "state",
          value: { step: 2 },
          scope: { type: "function", id: FUNCTION_ID },
          if_version: "3",
        },
      }),
    );

    await expect(
      runMemoryCommand(MemoriesGetCommand, [
        "state",
        "--function",
        FUNCTION_ID,
      ]),
    ).resolves.toMatchObject({ exitCode: undefined });
    expect(mocks.getMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        client: { host: "api" },
        query: {
          key: "state",
          scope_type: "function",
          scope_id: FUNCTION_ID,
        },
      }),
    );

    await expect(
      runMemoryCommand(MemoriesDeleteCommand, [
        "state",
        "--function",
        FUNCTION_ID,
        "--if-version",
        "4",
      ]),
    ).resolves.toMatchObject({ exitCode: undefined });
    expect(mocks.deleteMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        client: { host: "api" },
        query: {
          key: "state",
          scope_type: "function",
          scope_id: FUNCTION_ID,
          if_version: "4",
        },
      }),
    );

    await expect(
      runMemoryCommand(MemoriesSearchCommand, [
        "st",
        "--function",
        FUNCTION_ID,
        "--metadata-only",
      ]),
    ).resolves.toMatchObject({ exitCode: undefined });
    expect(mocks.searchMemories).toHaveBeenCalledWith(
      expect.objectContaining({
        client: { host: "api" },
        query: {
          prefix: "st",
          limit: 50,
          include_value: "false",
          scope_type: "function",
          scope_id: FUNCTION_ID,
        },
      }),
    );
  });

  it("rejects invalid JSON and empty guard flags before auth", async () => {
    let result = await runMemoryCommand(MemoriesSetCommand, ["bad", "1e999"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Numbers must be finite");
    expect(mocks.createAuthenticatedCliApiClient).not.toHaveBeenCalled();

    result = await runMemoryCommand(MemoriesSetCommand, [
      "state",
      '{"step":2}',
      "--function",
      "",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--function must be a non-empty string");
    expect(mocks.createAuthenticatedCliApiClient).not.toHaveBeenCalled();

    result = await runMemoryCommand(MemoriesDeleteCommand, [
      "state",
      "--if-version",
      "",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--if-version must be a non-empty string");
    expect(mocks.createAuthenticatedCliApiClient).not.toHaveBeenCalled();
  });
});

describe("memories command metadata", () => {
  it("marks scope and write-condition flags as mutually exclusive", () => {
    expect(MemoriesSetCommand.flags.function.exclusive).toContain("org");
    expect(MemoriesSetCommand.flags.org.exclusive).toContain("function");
    expect(MemoriesSetCommand.flags["if-absent"].exclusive).toContain(
      "if-version",
    );
    expect(MemoriesSetCommand.flags["ttl-seconds"].exclusive).toEqual([
      "expires-at",
      "clear-ttl",
    ]);
  });

  it("exposes expected get/delete/search flags", () => {
    expect(MemoriesGetCommand.flags.function).toBeDefined();
    expect(MemoriesDeleteCommand.flags["if-version"]).toBeDefined();
    expect(MemoriesSearchCommand.flags["metadata-only"]).toBeDefined();
    expect(MemoriesSearchCommand.flags.limit.default).toBe(50);
  });
});
