import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Errors, Flags } from "@oclif/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withBooleanFlagValues } from "../../src/oclif/boolean-flag-values.js";
import { COMMANDS } from "../../src/oclif/index.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");
const API_BASE_URL = "https://api.boolean-flag-values.test/v1";
const ENDPOINT = "00000000-0000-4000-8000-0000000000e1";
const OTHER = "00000000-0000-4000-8000-0000000000e2";

const FLAGS: Record<string, unknown> = {
  enabled: Flags.boolean({ allowNo: true }),
  takeover: Flags.boolean({ allowNo: true, aliases: ["take-over"] }),
  json: Flags.boolean({}),
  description: Flags.string({}),
  name: Flags.string({ char: "n" }),
  tags: Flags.string({ multiple: true }),
};

function rewrite(argv: string[]): string[] {
  return withBooleanFlagValues(argv, FLAGS);
}

function usageError(argv: string[]): Errors.CLIError {
  try {
    rewrite(argv);
  } catch (error) {
    if (error instanceof Errors.CLIError) return error;
    throw error;
  }
  throw new Error(`no error for ${argv.join(" ")}`);
}

describe("withBooleanFlagValues", () => {
  it("reads true or false after a boolean flag that has a --no- form", () => {
    expect(rewrite(["--enabled", "false", ENDPOINT])).toEqual([
      "--no-enabled",
      ENDPOINT,
    ]);
    expect(rewrite([ENDPOINT, "--enabled", "true"])).toEqual([
      ENDPOINT,
      "--enabled",
    ]);
    expect(rewrite(["--enabled", "FALSE"])).toEqual(["--no-enabled"]);
    expect(rewrite(["--enabled=false"])).toEqual(["--no-enabled"]);
    expect(rewrite(["--enabled=True"])).toEqual(["--enabled"]);
    // An alias is written as the flag's own name.
    expect(rewrite(["--take-over", "false"])).toEqual(["--no-takeover"]);
  });

  it("leaves the bare flag, its --no- form and an argument that is no yes or no word as typed", () => {
    expect(rewrite(["--enabled", ENDPOINT])).toEqual(["--enabled", ENDPOINT]);
    expect(rewrite(["--no-enabled", ENDPOINT])).toEqual([
      "--no-enabled",
      ENDPOINT,
    ]);
    expect(rewrite(["--enabled"])).toEqual(["--enabled"]);
    // Names every object inherits are not values.
    expect(rewrite(["--enabled", "constructor"])).toEqual([
      "--enabled",
      "constructor",
    ]);
    expect(rewrite(["--enabled", "__proto__"])).toEqual([
      "--enabled",
      "__proto__",
    ]);
  });

  it("never reads the value of a flag that takes one, or anything after --", () => {
    expect(rewrite(["--description", "--enabled", "false"])).toEqual([
      "--description",
      "--enabled",
      "false",
    ]);
    expect(rewrite(["-n", "--enabled", "true"])).toEqual([
      "-n",
      "--enabled",
      "true",
    ]);
    expect(rewrite(["--description=x", "--enabled", "false"])).toEqual([
      "--description=x",
      "--no-enabled",
    ]);
    expect(rewrite(["--tags", "a", "b", "--enabled", "false"])).toEqual([
      "--tags",
      "a",
      "b",
      "--no-enabled",
    ]);
    expect(rewrite(["--", "--enabled", "false"])).toEqual([
      "--",
      "--enabled",
      "false",
    ]);
  });

  it("leaves a boolean flag without a --no- form as typed", () => {
    expect(rewrite(["--json", "false"])).toEqual(["--json", "false"]);
  });

  it("refuses another value after =, another yes or no word, and a value after a --no- form", () => {
    for (const [argv, message] of [
      [
        ["--enabled=yes"],
        '--enabled takes true or false, or no value for true; got "yes".',
      ],
      [
        ["--no-enabled", "false"],
        "--no-enabled takes no value; use --enabled true or false, or --no-enabled alone.",
      ],
      [
        ["--no-enabled=true"],
        "--no-enabled takes no value; use --enabled true or false, or --no-enabled alone.",
      ],
      [
        ["--no-enabled", "yes"],
        "--no-enabled takes no value; use --enabled true or false, or --no-enabled alone.",
      ],
      [
        ["--enabled", "yes", ENDPOINT],
        '--enabled takes true or false, or no value for true; got "yes".',
      ],
      [
        ["--enabled", "0"],
        '--enabled takes true or false, or no value for true; got "0".',
      ],
      [
        ["--enabled", "Off"],
        '--enabled takes true or false, or no value for true; got "Off".',
      ],
    ] as const) {
      const error = usageError([...argv]);
      expect(error.message).toBe(message);
      expect(error.oclif.exit).toBe(2);
    }
  });
});

type Runnable = {
  run(argv: string[], options: { root: string }): Promise<unknown>;
};

type Call = { body: unknown; method: string; url: URL };

let calls: Call[] = [];
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
  tempHome = mkdtempSync(join(tmpdir(), "primitive-boolean-flag-values-"));
  for (const [name, value] of Object.entries({
    HOME: tempHome,
    XDG_CONFIG_HOME: join(tempHome, "config"),
    PRIMITIVE_CONFIG_DIR: join(tempHome, "config", "primitive"),
    PRIMITIVE_API_KEY: "prim_test_boolean_flag_values",
    PRIMITIVE_API_BASE_URL: API_BASE_URL,
    PRIMITIVE_SKIP_NEW_VERSION_CHECK: "true",
  })) {
    if (!(name in savedEnv)) savedEnv[name] = process.env[name];
    process.env[name] = value;
  }
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
      const text = request
        ? await request.clone().text()
        : typeof init?.body === "string"
          ? init.body
          : undefined;
      calls.push({
        body: text ? JSON.parse(text) : undefined,
        method: (init?.method ?? request?.method ?? "GET").toUpperCase(),
        url,
      });
      return new Response(
        JSON.stringify({ success: true, data: { id: ENDPOINT } }),
        { headers: { "content-type": "application/json" }, status: 200 },
      );
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
  argv: string[],
): Promise<{ exitCode: number; stderr: string }> {
  const stderr: string[] = [];
  const spies = [
    vi.spyOn(process.stdout, "write").mockImplementation(() => true),
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
      stderr.push(String(chunk));
      return true;
    }),
    vi.spyOn(console, "log").mockImplementation(() => undefined),
  ];
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  let thrown: unknown;
  try {
    await (COMMANDS["endpoints:update"] as unknown as Runnable).run(argv, {
      root: CLI_ROOT,
    });
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
  return { exitCode, stderr: stderr.join("") + message };
}

describe("endpoints update --enabled", () => {
  it("sends enabled false to the endpoint named, wherever the id is given", async () => {
    for (const argv of [
      [ENDPOINT, "--enabled", "false"],
      ["--enabled", "false", ENDPOINT],
      ["--id", ENDPOINT, "--enabled", "false"],
      ["--enabled=false", ENDPOINT],
      ["--no-enabled", ENDPOINT],
    ]) {
      calls = [];
      const result = await run(argv);
      expect(result.exitCode, `${argv.join(" ")}: ${result.stderr}`).toBe(0);
      expect(
        calls.map((call) => [call.method, call.url.pathname, call.body]),
        argv.join(" "),
      ).toEqual([["PATCH", `/v1/endpoints/${ENDPOINT}`, { enabled: false }]]);
    }
  });

  it("sends enabled true for --enabled true and for the bare flag", async () => {
    for (const argv of [
      ["--enabled", "true", ENDPOINT],
      ["--enabled", ENDPOINT],
      [ENDPOINT, "--enabled"],
    ]) {
      calls = [];
      const result = await run(argv);
      expect(result.exitCode, `${argv.join(" ")}: ${result.stderr}`).toBe(0);
      expect(
        calls.map((call) => [call.method, call.url.pathname, call.body]),
        argv.join(" "),
      ).toEqual([["PATCH", `/v1/endpoints/${ENDPOINT}`, { enabled: true }]]);
    }
  });

  it("still refuses two different ids", async () => {
    const result = await run(["--id", ENDPOINT, "--enabled", "false", OTHER]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Give the id once");
    expect(calls).toEqual([]);
  });
});
