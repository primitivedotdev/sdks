import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prompt = vi.hoisted(() => ({ question: vi.fn() }));
vi.mock("node:readline/promises", () => ({
  createInterface: () => ({ question: prompt.question, close: () => {} }),
}));

import { COMMANDS } from "../../src/oclif/index.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");
const API_BASE_URL = "https://api.delete-email-rule.test/v1";
const RULE = "00000000-0000-4000-8000-0000000000aa";
const COMMAND = "email-rules:delete";

type Runnable = {
  run(argv: string[], options: { root: string }): Promise<unknown>;
};
type Call = { method: string; url: URL };

let answer: unknown = { deleted: true };
let calls: Call[] = [];
let savedEnv: Record<string, string | undefined> = {};
let tempHome = "";
let stdinTTY: PropertyDescriptor | undefined;
let stderrTTY: PropertyDescriptor | undefined;

function setTerminals(on: boolean): void {
  for (const stream of [process.stdin, process.stderr]) {
    Object.defineProperty(stream, "isTTY", {
      configurable: true,
      value: on ? true : undefined,
    });
  }
}

beforeEach(() => {
  savedEnv = {};
  for (const name of Object.keys(process.env)) {
    if (["PRIMITIVE_", "CLAUDE", "CODEX"].some((p) => name.startsWith(p))) {
      savedEnv[name] = process.env[name];
      delete process.env[name];
    }
  }
  tempHome = mkdtempSync(join(tmpdir(), "primitive-delete-email-rule-"));
  for (const [name, value] of Object.entries({
    HOME: tempHome,
    XDG_CONFIG_HOME: join(tempHome, "config"),
    PRIMITIVE_CONFIG_DIR: join(tempHome, "config", "primitive"),
    PRIMITIVE_API_KEY: "prim_test_delete_email_rule",
    PRIMITIVE_API_BASE_URL: API_BASE_URL,
    PRIMITIVE_SKIP_NEW_VERSION_CHECK: "true",
  })) {
    if (!(name in savedEnv)) savedEnv[name] = process.env[name];
    process.env[name] = value;
  }
  stdinTTY = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
  stderrTTY = Object.getOwnPropertyDescriptor(process.stderr, "isTTY");
  setTerminals(false);
  prompt.question.mockReset();
  answer = { deleted: true };
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : undefined;
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      );
      calls.push({
        method: (init?.method ?? request?.method ?? "GET").toUpperCase(),
        url,
      });
      return new Response(JSON.stringify({ success: true, data: answer }), {
        headers: { "content-type": "application/json" },
        status: 200,
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const [stream, descriptor] of [
    [process.stdin, stdinTTY],
    [process.stderr, stderrTTY],
  ] as const) {
    if (descriptor) Object.defineProperty(stream, "isTTY", descriptor);
    else delete (stream as { isTTY?: boolean }).isTTY;
  }
  for (const [name, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  rmSync(tempHome, { force: true, recursive: true });
});

async function run(
  argv: string[],
): Promise<{ exitCode: number; stderr: string; stdout: string }> {
  const command = COMMANDS[COMMAND] as unknown as Runnable;
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
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      stderr.push(`${args.map(String).join(" ")}\n`);
    }),
  ];
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  let thrown: unknown;
  try {
    await command.run(argv, { root: CLI_ROOT });
  } catch (error) {
    thrown = error;
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
  const thrownExit = (thrown as { oclif?: { exit?: number } } | undefined)
    ?.oclif?.exit;
  const exitCode =
    thrown === undefined
      ? typeof process.exitCode === "number"
        ? process.exitCode
        : 0
      : (thrownExit ?? 1);
  process.exitCode = previousExitCode;
  const message = thrown instanceof Error ? `${thrown.message}\n` : "";
  return {
    exitCode,
    stderr: stderr.join("") + message,
    stdout: stdout.join(""),
  };
}

const deletes = () => calls.filter((call) => call.method === "DELETE");

describe("delete", () => {
  it("deletes without asking, in a terminal or not, and refuses --yes", async () => {
    for (const terminal of [false, true]) {
      setTerminals(terminal);
      const result = await run([RULE]);
      expect(result.exitCode, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({ deleted: true });
    }
    expect(prompt.question).not.toHaveBeenCalled();
    expect(deletes()).toHaveLength(2);
    const refused = await run([RULE, "--yes"]);
    expect(refused.exitCode).toBe(2);
    expect(deletes()).toHaveLength(2);
  });
});

describe("delete prints the answer as it came", () => {
  it("prints the answer and no report of its own, with or without --json", async () => {
    answer = { deleted: true };
    const plain = await run([RULE]);
    expect(plain.exitCode).toBe(0);
    expect(JSON.parse(plain.stdout)).toEqual({ deleted: true });
    expect(plain.stderr).toBe("");

    const json = await run([RULE, "--json"]);
    expect(json.exitCode).toBe(0);
    expect(JSON.parse(json.stdout)).toEqual({
      success: true,
      data: { deleted: true },
    });
    expect(json.stderr).toBe("");
    expect(deletes()).toHaveLength(2);
  });
});
