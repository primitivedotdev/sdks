import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
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
