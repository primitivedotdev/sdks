import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { openapiDocument } from "@primitivedotdev/api-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COMMANDS } from "../../src/oclif/index.js";
import { META_NOTES, metaNoteLines } from "../../src/oclif/meta-notes.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");
const API_BASE_URL = "https://api.meta-notes.test/v1";

const OUTSIDE =
  "Note: this credential does not read the mailbox --recipient names, so the list is empty however much mail that mailbox holds.";
const RULES_ONLY =
  "Note: this credential reads the mailbox --recipient names only through email rules, so the list holds only the mail those rules give it there.";

describe("metaNoteLines", () => {
  it("prints a line for each known meta field that is true, and nothing else", () => {
    expect(metaNoteLines({ recipient_outside_access: true })).toEqual([
      OUTSIDE,
    ]);
    expect(
      metaNoteLines({
        cursor: null,
        recipient_outside_access: false,
        recipient_rules_only: true,
        total_capped: true,
        unknown_flag: true,
      }),
    ).toEqual([RULES_ONLY]);
    expect(metaNoteLines({ recipient_rules_only: "true" })).toEqual([]);
    expect(metaNoteLines(undefined)).toEqual([]);
    expect(metaNoteLines(null)).toEqual([]);
    expect(metaNoteLines([true])).toEqual([]);
  });

  it("names the address cap when the answer gives it", () => {
    expect(metaNoteLines({ truncated: true, address_cap: 500 })).toEqual([
      "Note: the organization has more known addresses than the 500 address rules listed here.",
    ]);
    expect(metaNoteLines({ truncated: true })).toEqual([
      "Note: the organization has more known addresses than the address rules listed here.",
    ]);
  });

  it("covers the operations whose answer meta carries each field, and only those", () => {
    // A note's wording is written for these operations. When the spec gives
    // another operation's meta one of these fields, check the note still
    // reads true for it, then add it here.
    type Schema = Record<string, unknown>;
    const document = openapiDocument as unknown as {
      components: { schemas: Record<string, Schema> };
      paths: Record<string, Record<string, unknown>>;
    };
    const properties = (
      schema: unknown,
      depth = 0,
    ): Record<string, unknown> => {
      if (!schema || typeof schema !== "object" || depth > 8) return {};
      const record = schema as Schema;
      if (typeof record.$ref === "string") {
        const name = record.$ref.split("/").pop() ?? "";
        return properties(document.components.schemas[name], depth + 1);
      }
      const merged: Record<string, unknown> = {};
      for (const key of ["allOf", "oneOf", "anyOf"]) {
        const parts = record[key];
        if (Array.isArray(parts))
          for (const part of parts)
            Object.assign(merged, properties(part, depth + 1));
      }
      const own = record.properties;
      return own && typeof own === "object"
        ? { ...merged, ...(own as Record<string, unknown>) }
        : merged;
    };
    const carriers: Record<string, string[]> = {};
    for (const item of Object.values(document.paths)) {
      for (const operation of Object.values(item)) {
        const op = operation as {
          operationId?: string;
          responses?: Record<string, { content?: Record<string, Schema> }>;
        };
        if (!op?.responses || !op.operationId) continue;
        for (const [status, response] of Object.entries(op.responses)) {
          if (!status.startsWith("2")) continue;
          const schema = response.content?.["application/json"]?.schema;
          const meta = properties(schema).meta;
          for (const field of Object.keys(properties(meta))) {
            if (!(field in META_NOTES)) continue;
            carriers[field] = [...(carriers[field] ?? []), op.operationId];
          }
        }
      }
    }
    expect(carriers).toEqual({
      recipient_outside_access: ["listEmails"],
      recipient_rules_only: ["listEmails"],
      partial: ["searchEmails"],
      replies_only: ["getSendPermissions"],
      truncated: ["getSendPermissions"],
    });
  });
});

type Runnable = {
  run(argv: string[], options: { root: string }): Promise<unknown>;
};

let responder: (url: URL) => unknown = () => ({ success: true, data: [] });
let requested: string[] = [];
let savedEnv: Record<string, string | undefined> = {};
let tempHome = "";

beforeEach(() => {
  savedEnv = {};
  for (const name of Object.keys(process.env)) {
    if (["PRIMITIVE_", "CLAUDE", "CODEX"].some((p) => name.startsWith(p))) {
      savedEnv[name] = process.env[name];
      delete process.env[name];
    }
  }
  tempHome = mkdtempSync(join(tmpdir(), "primitive-meta-notes-"));
  for (const [name, value] of Object.entries({
    HOME: tempHome,
    XDG_CONFIG_HOME: join(tempHome, "config"),
    PRIMITIVE_CONFIG_DIR: join(tempHome, "config", "primitive"),
    PRIMITIVE_API_KEY: "prim_test_meta_notes",
    PRIMITIVE_API_BASE_URL: API_BASE_URL,
    PRIMITIVE_SKIP_NEW_VERSION_CHECK: "true",
  })) {
    if (!(name in savedEnv)) savedEnv[name] = process.env[name];
    process.env[name] = value;
  }
  requested = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      );
      requested.push(url.pathname);
      // The empty-list hint reads the grant; answer that it cannot.
      if (url.pathname.endsWith("/whoami/grant"))
        return new Response(null, { status: 404 });
      return new Response(JSON.stringify(responder(url)), {
        headers: { "content-type": "application/json" },
        status: 200,
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const [name, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  rmSync(tempHome, { force: true, recursive: true });
});

async function run(
  id: string,
  argv: string[],
): Promise<{ exitCode: number; stderr: string; stdout: string }> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const spies = [
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      stdout.push(String(chunk));
      return true;
    }),
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
      stderr.push(String(chunk));
      return true;
    }),
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      stdout.push(`${args.map(String).join(" ")}\n`);
    }),
  ];
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  let thrown: unknown;
  try {
    await (COMMANDS[id] as unknown as Runnable).run(argv, { root: CLI_ROOT });
  } catch (error) {
    thrown = error;
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
  const exitCode =
    thrown === undefined
      ? typeof process.exitCode === "number"
        ? process.exitCode
        : 0
      : ((thrown as { oclif?: { exit?: number } }).oclif?.exit ?? 1);
  process.exitCode = previousExitCode;
  const message = thrown instanceof Error ? `${thrown.message}\n` : "";
  return {
    exitCode,
    stderr: stderr.join("") + message,
    stdout: stdout.join(""),
  };
}

function lines(text: string): string[] {
  return text.split("\n").filter((line) => line !== "");
}

const emailListAnswer = (meta: Record<string, unknown>) => ({
  success: true,
  data: [],
  meta: { total: 0, limit: 50, cursor: null, ...meta },
});

describe("emails list --recipient outside the credential's mail", () => {
  it("says why the list is empty on stderr, in place of the generic empty-list hint", async () => {
    responder = () => emailListAnswer({ recipient_outside_access: true });
    const result = await run("emails:list", [
      "--recipient",
      "someone@example.com",
    ]);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([]);
    expect(lines(result.stderr)).toEqual([OUTSIDE]);
    // The generic hint's grant read is not made either.
    expect(requested).toEqual(["/v1/emails"]);
  });

  it("keeps the generic empty-list hint when meta says nothing", async () => {
    responder = () => emailListAnswer({});
    const result = await run("emails:list", [
      "--recipient",
      "someone@example.com",
    ]);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(lines(result.stderr)).toEqual([
      expect.stringMatching(/^\(no results\) No inbound emails match/),
    ]);
  });

  it("prints nothing more under --json, which stays the data alone", async () => {
    responder = () => emailListAnswer({ recipient_outside_access: true });
    const result = await run("emails:list", [
      "--recipient",
      "someone@example.com",
      "--json",
    ]);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual([]);
  });

  it("leaves the note out of a --json --envelope document, whose meta carries the field", async () => {
    responder = () => emailListAnswer({ recipient_outside_access: true });
    const result = await run("emails:list", [
      "--recipient",
      "someone@example.com",
      "--json",
      "--envelope",
    ]);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    const document = JSON.parse(result.stdout) as {
      meta?: Record<string, unknown>;
      summary?: string;
      warnings?: unknown;
    };
    expect(document.meta?.recipient_outside_access).toBe(true);
    // A note written on stderr would land in the document's warnings.
    expect(document.warnings).toBeUndefined();
    // The document keeps the empty-list hint it always carried.
    expect(document.summary).toMatch(/^\(no results\) No inbound emails/);
    expect(result.stdout).not.toContain("Note: this credential");
  });

  it("says when the list holds only what email rules give the credential", async () => {
    responder = () => ({
      ...emailListAnswer({ recipient_rules_only: true }),
      data: [{ id: "00000000-0000-4000-8000-000000000001" }],
      meta: { total: 1, limit: 50, cursor: null, recipient_rules_only: true },
    });
    const result = await run("emails:list", [
      "--recipient",
      "someone@example.com",
    ]);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(lines(result.stderr)).toEqual([RULES_ONLY]);
  });
});

describe("other meta notes", () => {
  it("says a search page stopped at its time limit is not the end", async () => {
    responder = () => ({
      success: true,
      data: [],
      meta: {
        total: null,
        total_capped: false,
        limit: 25,
        cursor: "next-page",
        sort: "received_at_desc",
        partial: true,
      },
    });
    const result = await run("emails:search", ["--q", "invoice"]);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(lines(result.stderr)).toContain(
      "Note: the search stopped at its time limit before this page filled, so a short page is not the end of the results: continue with the next cursor until it is null.",
    );
  });

  it("says send permissions are for replies only, and that the address rules were cut short", async () => {
    responder = () => ({
      success: true,
      data: [],
      meta: { address_cap: 500, truncated: true, replies_only: true },
    });
    const result = await run("sending:permissions", []);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(lines(result.stderr)).toEqual([
      "Note: this credential can only reply to mail it received (it holds mail:reply but not mail:send). These rules apply to its replies; it cannot start a new message.",
      "Note: the organization has more known addresses than the 500 address rules listed here.",
    ]);
    // Under --json a stderr note would land in the document's warnings.
    const quiet = await run("sending:permissions", ["--json", "--envelope"]);
    expect(quiet.stderr).toBe("");
    const document = JSON.parse(quiet.stdout) as Record<string, unknown>;
    expect(document.meta).toEqual({
      address_cap: 500,
      truncated: true,
      replies_only: true,
    });
    expect(document.warnings).toBeUndefined();
  });
});
