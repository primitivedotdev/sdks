import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prompt = vi.hoisted(() => ({ question: vi.fn() }));
vi.mock("node:readline/promises", () => ({
  createInterface: () => ({ question: prompt.question, close: () => {} }),
}));

import { deleteEmailRuleReport } from "../../src/oclif/email-rule-authoring.js";
import { COMMANDS } from "../../src/oclif/index.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");
const API_BASE_URL = "https://api.delete-email-rule.test/v1";
const RULE = "00000000-0000-4000-8000-0000000000aa";
const SHARE = "00000000-0000-4000-8000-0000000000bb";
const KEY = "00000000-0000-4000-8000-0000000000cc";
const COMMAND = "email-rules:delete-email-rule";

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

describe("delete-email-rule asks before it deletes", () => {
  it("without a terminal, sends nothing and exits 2, naming --yes", async () => {
    const result = await run([RULE]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(
      "Pass --yes to delete the rule without a prompt.",
    );
    expect(calls).toEqual([]);
    expect(prompt.question).not.toHaveBeenCalled();
  });

  it("with --json, sends nothing without --yes even in a terminal", async () => {
    setTerminals(true);
    const result = await run([RULE, "--json"]);
    expect(result.exitCode).toBe(2);
    expect(calls).toEqual([]);
    expect(prompt.question).not.toHaveBeenCalled();
  });

  it("names the rule in the question when it is given with --id", async () => {
    setTerminals(true);
    prompt.question.mockResolvedValueOnce("n");
    const kept = await run(["--id", RULE]);
    expect(kept.exitCode).toBe(1);
    expect(prompt.question).toHaveBeenCalledWith(
      `Delete email rule ${RULE}? Its versions and decisions are deleted with it. [y/N] `,
    );
    expect(calls).toEqual([]);
  });

  it("in a terminal, deletes only on yes", async () => {
    setTerminals(true);
    prompt.question.mockResolvedValueOnce("n");
    const kept = await run([RULE]);
    expect(kept.exitCode).toBe(1);
    expect(kept.stderr).toContain("Cancelled. The rule was not deleted.");
    expect(calls).toEqual([]);
    expect(prompt.question).toHaveBeenCalledWith(
      `Delete email rule ${RULE}? Its versions and decisions are deleted with it. [y/N] `,
    );

    prompt.question.mockResolvedValueOnce("yes");
    const removed = await run([RULE]);
    expect(removed.exitCode).toBe(0);
    expect(deletes().map((call) => call.url.pathname)).toEqual([
      `/v1/email-rules/${RULE}`,
    ]);
  });

  it("with --yes, deletes without asking", async () => {
    const result = await run([RULE, "--yes"]);
    expect(result.exitCode).toBe(0);
    expect(prompt.question).not.toHaveBeenCalled();
    expect(deletes()).toHaveLength(1);
    expect(JSON.parse(result.stdout)).toEqual({ deleted: true });
  });
});

// A server that answers only { deleted: true } (before it said what a delete
// left) gets the command's old output: the answer on stdout, and nothing on
// stderr, so no report claims nothing was left.
describe("delete-email-rule against a server that answers only deleted", () => {
  it("prints the answer and no report, with or without --json", async () => {
    answer = { deleted: true };
    const plain = await run([RULE, "--yes"]);
    expect(plain.exitCode).toBe(0);
    expect(JSON.parse(plain.stdout)).toEqual({ deleted: true });
    expect(plain.stderr).toBe("");

    const json = await run([RULE, "--yes", "--json"]);
    expect(json.exitCode).toBe(0);
    expect(JSON.parse(json.stdout)).toEqual({ deleted: true });
    expect(json.stderr).toBe("");
    expect(deletes()).toHaveLength(2);
  });
});

describe("delete-email-rule says what the delete left", () => {
  it("names the shares it ended and the keys still listing the rule, on stderr", async () => {
    answer = {
      deleted: true,
      ended_shares: [SHARE],
      keys: [{ id: KEY, name: "Support reader", key_prefix: "prim_abc123" }],
      other_keys: 2,
    };
    const result = await run([RULE, "-y"]);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(answer);
    expect(result.stderr).toContain(
      "Ended 1 share of this rule (end_reason rule_deleted). It keeps its record.",
    );
    expect(result.stderr).toContain(
      "1 key still lists this rule and now reads nothing through it:",
    );
    expect(result.stderr).toContain(`${KEY}  Support reader  prim_abc123`);
    expect(result.stderr).toContain(
      `Take the rule off with \`primitive keys update ${KEY} --remove-rule ${RULE}\`, or revoke the key.`,
    );
    expect(result.stderr).toContain(
      "2 more keys you cannot read list this rule too.",
    );
  });

  it("prints nothing for an answer that carries none of it", () => {
    expect(
      deleteEmailRuleReport({ deleted: true }, { path: { id: RULE } }),
    ).toEqual({ lines: [] });
    expect(
      deleteEmailRuleReport(
        { deleted: true, ended_shares: [], keys: [], other_keys: 0 },
        { path: { id: RULE } },
      ),
    ).toEqual({ lines: [] });
  });

  it("counts in the plural and names a key without a name", () => {
    const { lines } = deleteEmailRuleReport(
      {
        deleted: true,
        ended_shares: [SHARE, SHARE],
        keys: [
          { id: KEY, name: null, key_prefix: "prim_a" },
          { id: KEY, name: "B", key_prefix: "prim_b" },
        ],
        other_keys: 1,
      },
      { path: { id: RULE } },
    );
    expect(lines).toEqual([
      "Ended 2 shares of this rule (end_reason rule_deleted). Each keeps its record.",
      "2 keys still list this rule and now read nothing through it:",
      `  ${KEY}  (no name)  prim_a`,
      `  ${KEY}  B  prim_b`,
      `Take the rule off each with \`primitive keys update <key-id> --remove-rule ${RULE}\`, or revoke them.`,
      "1 more key you cannot read lists this rule too.",
    ]);
  });

  it("says keys it cannot name now read nothing, when none are named", () => {
    expect(
      deleteEmailRuleReport(
        { deleted: true, ended_shares: [], keys: [], other_keys: 2 },
        { path: { id: RULE } },
      ).lines,
    ).toEqual([
      "2 keys you cannot read list this rule and now read nothing through it.",
    ]);
    expect(
      deleteEmailRuleReport(
        { deleted: true, ended_shares: [], keys: [], other_keys: 1 },
        { path: { id: RULE } },
      ).lines,
    ).toEqual([
      "1 key you cannot read lists this rule and now reads nothing through it.",
    ]);
  });

  it("prints the server's share notice in place of the share count", () => {
    const notice =
      "Deleting this rule ended its share with Dana (accepted at version 2): they can no longer read anything it shared through Primitive, even what it shared before; copies already delivered to their webhooks or downloaded stay with them. The share keeps its record.";
    expect(
      deleteEmailRuleReport(
        {
          deleted: true,
          ended_shares: [SHARE],
          keys: [],
          other_keys: 0,
          share_notice: `  ${notice} `,
        },
        { path: { id: RULE } },
      ).lines,
    ).toEqual([notice]);
  });

  it("says when the keys could not be checked", () => {
    expect(
      deleteEmailRuleReport(
        { deleted: true, ended_shares: [SHARE] },
        { path: { id: RULE } },
      ).lines,
    ).toEqual([
      "Ended 1 share of this rule (end_reason rule_deleted). It keeps its record.",
      "Could not check which keys list this rule.",
    ]);
  });
});
