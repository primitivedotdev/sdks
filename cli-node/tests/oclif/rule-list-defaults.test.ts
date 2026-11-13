import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COMMANDS } from "../../src/oclif/index.js";
import {
  emptyRuleListHint,
  ruleListDefaultsNote,
} from "../../src/oclif/rule-list-defaults.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");
const API_BASE_URL = "https://api.rule-list-defaults.test/v1";

type Runnable = {
  run(argv: string[], options: { root: string }): Promise<unknown>;
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

const page = (rows: unknown[], cursor: string | null = null) =>
  jsonResponse(200, { success: true, data: rows, meta: { cursor } });

let responder: (url: URL) => Response = () => page([]);
let requested: URL[] = [];
let home = "";
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "primitive-rule-list-defaults-"));
  saved = {};
  for (const name of Object.keys(process.env))
    if (name.startsWith("PRIMITIVE_")) {
      saved[name] = process.env[name];
      delete process.env[name];
    }
  for (const [name, value] of Object.entries({
    HOME: home,
    XDG_CONFIG_HOME: join(home, "config"),
    PRIMITIVE_CONFIG_DIR: join(home, "config", "primitive"),
    PRIMITIVE_API_KEY: "prim_test_rule_list_defaults",
    PRIMITIVE_API_BASE_URL: API_BASE_URL,
    PRIMITIVE_SKIP_NEW_VERSION_CHECK: "true",
  })) {
    if (!(name in saved)) saved[name] = process.env[name];
    process.env[name] = value;
  }
  requested = [];
  responder = () => page([]);
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
      requested.push(url);
      return responder(url);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  rmSync(home, { force: true, recursive: true });
});

async function run(
  id: string,
  argv: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
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
  const previous = process.exitCode;
  process.exitCode = undefined;
  try {
    await (COMMANDS[id] as unknown as Runnable).run(argv, { root: CLI_ROOT });
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
  const exitCode = typeof process.exitCode === "number" ? process.exitCode : 0;
  process.exitCode = previous;
  return {
    stdout: stdout.join(""),
    stderr: stderr
      .join("")
      .split("\n")
      .filter((line) => !/^\(node:\d+\) /.test(line))
      .join("\n"),
    exitCode,
  };
}

const OBJECTIONS = "email-rule-oversight:list-email-rule-objections";
const SHARES = "email-rules:list-email-rule-shares";
const objection = {
  id: "0b9a3c1e-6c4d-4a7e-9a51-000000000001",
  is_objector: false,
  is_author: true,
};

describe("ruleListDefaultsNote", () => {
  it("says what each rule list's defaults leave out, on any page, and nothing once every default is given", () => {
    expect(ruleListDefaultsNote("listEmailRuleShares", {})).toBe(
      "By default this lists only live shares made with you: add `--box all --live any` to widen it.",
    );
    expect(
      ruleListDefaultsNote("listEmailRuleShares", { cursor: "c", box: "all" }),
    ).toBe(
      "By default this lists only live shares: add `--live any` to widen it.",
    );
    expect(ruleListDefaultsNote("listGivenEmailRuleShares", {})).toBe(
      "By default this lists only live shares of your mail: add `--live any` to widen it.",
    );
    expect(ruleListDefaultsNote("listEmailRuleRequests", {})).toBe(
      "By default this lists only pending requests made to you: add `--box all --status any` to widen it.",
    );
    expect(
      ruleListDefaultsNote("listEmailRuleShares", {
        box: "all",
        live: "any",
      }),
    ).toBeUndefined();
    expect(ruleListDefaultsNote("listEmails", {})).toBeUndefined();
  });

  it("says what the objection list's defaults leave out", () => {
    expect(ruleListDefaultsNote("listEmailRuleObjections", {})).toBe(
      "By default this lists only pending objections you made: add `--box all --status any` to widen it.",
    );
    expect(
      ruleListDefaultsNote("listEmailRuleObjections", { status: "any" }),
    ).toBe(
      "By default this lists only objections you made: add `--box all` to widen it.",
    );
    expect(
      ruleListDefaultsNote("listEmailRuleObjections", { box: "incoming" }),
    ).toBe(
      "By default this lists only pending objections: add `--status any` to widen it.",
    );
    expect(
      ruleListDefaultsNote("listEmailRuleObjections", {
        box: "all",
        status: "any",
      }),
    ).toBeUndefined();
  });

  it("puts that nothing matched in front on an empty first page only", () => {
    expect(emptyRuleListHint("listEmailRuleObjections", {})).toBe(
      "(no results) No objections match. By default this lists only pending objections you made: add `--box all --status any` to widen it.",
    );
    expect(
      emptyRuleListHint("listEmailRuleObjections", { cursor: "c" }),
    ).toBeUndefined();
  });
});

describe("rule lists say what their defaults leave out", () => {
  it("asks for the objection list's default box by name, and says so above a page that holds some", async () => {
    responder = () => page([objection]);
    const result = await run(OBJECTIONS, []);
    expect(result.exitCode).toBe(0);
    expect(requested.map((url) => url.searchParams.get("box"))).toEqual([
      "outgoing",
    ]);
    expect(JSON.parse(result.stdout)).toEqual([objection]);
    expect(result.stderr).toContain(
      "By default this lists only pending objections you made: add `--box all --status any` to widen it.",
    );
  });

  it("says so on a page of shares that holds some, and on a later page", async () => {
    responder = () => page([{ id: "s1" }], "next");
    const first = await run(SHARES, []);
    expect(first.stderr).toContain(
      "By default this lists only live shares made with you: add `--box all --live any` to widen it.",
    );
    const later = await run(SHARES, ["--cursor", "next"]);
    expect(later.stderr).toContain("By default this lists only live shares");
    expect(later.stderr).not.toContain("(no results)");
  });

  it("carries the line in --envelope's summary on every page, and keeps a bare --json document and stderr as they were", async () => {
    responder = () => page([{ id: "s1" }]);
    const enveloped = await run(SHARES, ["--json", "--envelope"]);
    expect(enveloped.stderr).toBe("");
    const document = JSON.parse(enveloped.stdout) as Record<string, unknown>;
    expect(document).toMatchObject({
      data: [{ id: "s1" }],
      summary:
        "By default this lists only live shares made with you: add `--box all --live any` to widen it.",
    });
    expect(document).not.toHaveProperty("warnings");
    const bare = await run(SHARES, ["--json"]);
    expect(bare.stderr).toBe("");
    expect(JSON.parse(bare.stdout)).toEqual([{ id: "s1" }]);
  });

  it("says it once on an empty first page, after (no results), on stderr or in summary", async () => {
    const line =
      "(no results) No shares match. By default this lists only live shares made with you: add `--box all --live any` to widen it.";
    const text = await run(SHARES, []);
    expect(text.stderr.split(line)).toHaveLength(2);
    expect(text.stderr).not.toMatch(/\nBy default this lists/);
    const enveloped = await run(SHARES, ["--json", "--envelope"]);
    expect(enveloped.stderr).toBe("");
    const document = JSON.parse(enveloped.stdout) as Record<string, unknown>;
    expect(document.summary).toBe(line);
    expect(document).not.toHaveProperty("warnings");
  });

  it("sends --box as given", async () => {
    await run(OBJECTIONS, ["--box", "incoming"]);
    expect(requested.map((url) => url.searchParams.get("box"))).toEqual([
      "incoming",
    ]);
  });

  it("says nothing once every default is given", async () => {
    responder = () => page([{ id: "s1" }]);
    const result = await run(SHARES, ["--box", "all", "--live", "any"]);
    expect(result.stderr).not.toContain("By default");
  });
});
