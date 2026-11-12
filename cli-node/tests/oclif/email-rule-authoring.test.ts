import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type {
  ListEmailRuleResultsResult,
  TestEmailRuleResult,
} from "@primitivedotdev/api-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OPERATION_ERROR_HINTS,
  OPERATION_EXTENSIONS,
} from "../../src/oclif/api-command.js";
import {
  endEmailRuleShareReport,
  formatFact,
  NOT_MATCHED_LIST_LIMIT,
  testEmailRuleReport,
} from "../../src/oclif/email-rule-authoring.js";
import { COMMANDS } from "../../src/oclif/index.js";
import { composeJsonDocument } from "../../src/oclif/json-output.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");
const API_BASE_URL = "https://api.email-rule-authoring.test/v1";

const RULE = "00000000-0000-4000-8000-0000000000aa";
const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const C = "00000000-0000-4000-8000-00000000000c";
const D = "00000000-0000-4000-8000-00000000000d";
const E = "00000000-0000-4000-8000-00000000000e";

type Runnable = {
  flags: Record<
    string,
    {
      description?: string;
      exclusive?: string[];
      multiple?: boolean;
      required?: boolean;
      type?: string;
    }
  >;
  run(argv: string[], options: { root: string }): Promise<unknown>;
};

type RunResult = {
  exitCode: number;
  merged: string;
  stderr: string;
  stdout: string;
};

type Call = { body: unknown; method: string; url: URL };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

let responder: (url: URL) => Response = () =>
  jsonResponse(503, {
    success: false,
    error: { code: "service_unavailable", message: "try again" },
  });
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
  tempHome = mkdtempSync(join(tmpdir(), "primitive-email-rule-authoring-"));
  for (const [name, value] of Object.entries({
    HOME: tempHome,
    XDG_CONFIG_HOME: join(tempHome, "config"),
    PRIMITIVE_CONFIG_DIR: join(tempHome, "config", "primitive"),
    PRIMITIVE_API_KEY: "prim_test_email_rule_authoring",
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
      return responder(url);
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

// Run a command through the registry, as the installed CLI does, recording
// stdout and stderr separately and interleaved (`2>&1`).
async function run(id: string, argv: string[]): Promise<RunResult> {
  const command = COMMANDS[id] as unknown as Runnable;
  const merged: string[] = [];
  const stdout: string[] = [];
  const stderr: string[] = [];
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
    vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      err(`${args.map(String).join(" ")}\n`);
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
  const clean = (chunks: string[]) =>
    chunks
      .join("")
      .split("\n")
      .filter(
        (line) =>
          !/^\(node:\d+\) /.test(line) &&
          !line.startsWith("(Use `node --trace-"),
      )
      .join("\n");
  const thrownMessage =
    thrown instanceof Error &&
    !(thrown as { skipOclifErrorHandling?: boolean }).skipOclifErrorHandling
      ? `${thrown.message}\n`
      : "";
  return {
    exitCode,
    merged: clean(merged),
    stderr: clean(stderr) + thrownMessage,
    stdout: stdout.join(""),
  };
}

function stderrLines(result: RunResult): string[] {
  return result.stderr.split("\n").filter((line) => line !== "");
}

function tempFile(name: string, content: string): string {
  const path = join(tempHome, name);
  writeFileSync(path, content);
  return path;
}

function testResult(
  expectations?: TestEmailRuleResult["expectations"],
): TestEmailRuleResult {
  return {
    rule: { id: RULE, version: 3, vocabulary: "v1" },
    window: { mode: "recent", since: "2026-10-11T00:00:00Z", limit: 198 },
    counts: {
      emails: 4,
      matched: 1,
      near_miss: 1,
      no_match: 1,
      unclassified: 1,
      not_found: 0,
    },
    classification: { classified_now: 0, still_unclassified: 1 },
    questions: { asked: 1, capped: false },
    results: [
      { email_id: A, outcome: "matched", parts: [] },
      {
        email_id: B,
        outcome: "no_match",
        parts: [
          { index: 0, matched: true, columns: ["sender_known"] },
          { index: 1, matched: false, columns: ["is_cold_outreach"] },
        ],
        values: {
          sender_known: { value: false },
          is_cold_outreach: { value: true, confidence: 0.69 },
        },
      },
      {
        email_id: C,
        outcome: "near_miss",
        parts: [
          { index: 0, matched: true, columns: ["sender_known"] },
          { index: 1, matched: true, columns: ["is_cold_outreach"] },
        ],
        values: {
          topics: {
            value: ["billing", "invoice"],
            confidence: 0.8,
            value_confidences: { billing: 0.91, invoice: 0.62 },
          },
        },
        question_answers: [
          {
            question: "Is it a sales pitch?",
            answer: false,
            probability: 0.81,
          },
        ],
        question_answers_source: "stored",
      },
      { email_id: D, outcome: "unclassified", unclassified_reason: "pending" },
    ],
    summary: {
      decided: 3,
      conditions: [
        {
          index: 0,
          text: "The sender is not a contact",
          held: 3,
          failed: 0,
          only_failure: 0,
        },
        {
          index: 1,
          text: "It is cold outreach",
          held: 2,
          failed: 1,
          only_failure: 1,
        },
      ],
      questions: [{ index: 0, yes: 1, no: 1, unanswered: 0 }],
      warnings: ["Most emails failed on condition 1."],
    },
    scope_warnings: [
      {
        name: "typo.example",
        kind: "domain",
        reason: "unknown_domain",
        message: "typo.example is none of the organization's domains.",
      },
    ],
    ...(expectations ? { expectations } : {}),
  };
}

function withResults(
  extra: TestEmailRuleResult["results"],
  expectations: TestEmailRuleResult["expectations"],
): TestEmailRuleResult {
  const base = testResult(expectations);
  return { ...base, results: [...base.results, ...extra] };
}

const FAILED_EXPECTATIONS: TestEmailRuleResult["expectations"] = {
  passed: false,
  counts: { passed: 1, failed: 1, undecided: 1 },
  results: [
    { email_id: A, expected: "match", outcome: "matched", status: "passed" },
    { email_id: B, expected: "match", outcome: "no_match", status: "failed" },
    {
      email_id: D,
      expected: "no_match",
      outcome: "unclassified",
      status: "undecided",
    },
  ],
};

const UNDECIDED_EXPECTATIONS: TestEmailRuleResult["expectations"] = {
  passed: false,
  counts: { passed: 1, failed: 0, undecided: 1 },
  results: [
    { email_id: A, expected: "match", outcome: "matched", status: "passed" },
    {
      email_id: D,
      expected: "no_match",
      outcome: "unclassified",
      status: "undecided",
    },
  ],
};

const PASSED_EXPECTATIONS: TestEmailRuleResult["expectations"] = {
  passed: true,
  counts: { passed: 2, failed: 0, undecided: 0 },
  results: [
    { email_id: A, expected: "match", outcome: "matched", status: "passed" },
    {
      email_id: B,
      expected: "no_match",
      outcome: "no_match",
      status: "passed",
    },
  ],
};

function answer(data: unknown): void {
  responder = () => jsonResponse(200, { success: true, data });
}

describe("email-rules test-email-rule: expectations from flags", () => {
  it("adds --expect-match, --expect-no-match and --expect-file", () => {
    const flags = (
      COMMANDS["email-rules:test-email-rule"] as unknown as Runnable
    ).flags;
    expect(flags["expect-match"]).toMatchObject({
      type: "option",
      multiple: true,
      exclusive: ["expect-file"],
    });
    expect(flags["expect-no-match"]).toMatchObject({
      type: "option",
      multiple: true,
      exclusive: ["expect-file"],
    });
    expect(flags["expect-file"]?.exclusive).toEqual([
      "expect-match",
      "expect-no-match",
    ]);
  });

  it("says in --help-full that expect has flags, and what the exit codes mean", () => {
    const description = (
      COMMANDS["email-rules:test-email-rule"] as unknown as {
        description: string;
      }
    ).description;
    const rawBodyOnly = description.slice(
      description.indexOf("Body fields requiring --raw-body JSON"),
    );
    expect(rawBodyOnly).toMatch(/^ {3}tree\b/m);
    expect(rawBodyOnly).not.toMatch(/^ {3}expect\b/m);
    for (const text of [
      "a saved rule's saved expectations are judged instead",
      // Both reports named, the test's and the write's.
      "Either way, the answer reports the expectations it judged in expectations: passed, counts and per-email results.",
      "create-email-rule and update-email-rule instead judge the rule's saved expectations on the version they save, in expectations_check",
      "The exit code follows that report:",
      "1 when one is undecided and testing again will not decide it",
      "3 when the only undecided ones can be decided later",
      "Exit 1 also means the request failed",
      "expectations_failed, expectations_unresolvable, expectations_undecided (exit 3)",
    ])
      expect(description).toContain(text);
    for (const id of [
      "email-rules:create-email-rule",
      "email-rules:update-email-rule",
    ]) {
      const text = (COMMANDS[id] as unknown as { description: string })
        .description;
      expect(text, id).not.toMatch(/^ {2,3}expectations\b/m);
    }
  });

  it("names the report each command answers with in its flag help: expectations on a test, expectations_check on a write", () => {
    const flags = (id: string) =>
      (
        COMMANDS[id] as unknown as {
          flags: Record<string, { description?: string }>;
        }
      ).flags;
    for (const flag of ["expect-match", "expect-no-match"]) {
      const text =
        flags("email-rules:test-email-rule")[flag]?.description ?? "";
      expect(text, flag).toContain(
        "The answer reports them in expectations (passed, counts, results) and the exit code follows it",
      );
    }
    for (const id of [
      "email-rules:create-email-rule",
      "email-rules:update-email-rule",
    ]) {
      expect(flags(id)["expectations-file"]?.description, id).toContain(
        "the answer judges them in expectations_check (passed, decided, failed, undecided); the report test-email-rule answers with is named expectations instead.",
      );
    }
  });

  it("builds expect from repeated and comma-listed ids, without repeats", async () => {
    answer(testResult());
    const result = await run("email-rules:test-email-rule", [
      "--rule-id",
      RULE,
      "--expect-match",
      `${A}, ${B}`,
      "--expect-match",
      `${C},${A}`,
      "--expect-no-match",
      D,
    ]);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(calls.map((call) => [call.method, call.url.pathname])).toEqual([
      ["POST", "/v1/email-rules/test"],
    ]);
    expect(calls[0]?.body).toEqual({
      rule_id: RULE,
      expect: { match: [A, B, C], no_match: [D] },
    });
  });

  it("replaces expect in --raw-body and keeps its other fields", async () => {
    answer(testResult());
    const tree = { version: 1, vocabulary: "v1", when: { all: [] } };
    await run("email-rules:test-email-rule", [
      "--raw-body",
      JSON.stringify({ tree, expect: { match: [E] } }),
      "--expect-no-match",
      D,
    ]);
    expect(calls[0]?.body).toEqual({ tree, expect: { no_match: [D] } });
  });

  it("reads expect from --expect-file and merges it into --body-file", async () => {
    answer(testResult());
    const bodyFile = tempFile(
      "body.json",
      JSON.stringify({ rule_id: RULE, email_ids: [E] }),
    );
    const expectFile = tempFile(
      "expect.json",
      JSON.stringify({ match: [A], no_match: [B] }),
    );
    const result = await run("email-rules:test-email-rule", [
      "--body-file",
      bodyFile,
      "--expect-file",
      expectFile,
    ]);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(calls[0]?.body).toEqual({
      rule_id: RULE,
      email_ids: [E],
      expect: { match: [A], no_match: [B] },
    });
  });

  it("refuses --expect-file with --expect-match before any request", async () => {
    const expectFile = tempFile("expect.json", JSON.stringify({ match: [A] }));
    const result = await run("email-rules:test-email-rule", [
      "--rule-id",
      RULE,
      "--expect-file",
      expectFile,
      "--expect-match",
      B,
    ]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--expect-match");
    expect(calls).toEqual([]);
  });

  it.each([
    [
      ["--expect-match", "not-an-id"],
      'takes email ids (UUIDs, from `primitive emails list`); "not-an-id" is not one',
    ],
    [
      ["--expect-match", A, "--expect-no-match", A],
      "is expected both to match and not to match",
    ],
    [["--expect-match", " , "], "--expect-match needs at least one email id"],
  ])("refuses %j with exit 2 and sends nothing", async (argv, message) => {
    const result = await run("email-rules:test-email-rule", [
      "--rule-id",
      RULE,
      ...argv,
    ]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(message);
    expect(calls).toEqual([]);
  });

  it("refuses an --expect-file that is not in the expect shape with exit 2", async () => {
    for (const [content, message] of [
      ["[]", "must hold a JSON object"],
      [JSON.stringify({ matches: [A] }), 'takes only "match" and "no_match"'],
      [JSON.stringify({ match: A }), '"match" must be a list of email ids'],
      [JSON.stringify({ match: ["x"] }), '"x" is not one'],
      ["{}", "needs at least one email id in match or no_match"],
      [
        JSON.stringify({ match: [], no_match: [] }),
        "needs at least one email id in match or no_match",
      ],
      [
        JSON.stringify({ match: [A], no_match: [A.toUpperCase()] }),
        "is expected both to match and not to match",
      ],
    ] as const) {
      const result = await run("email-rules:test-email-rule", [
        "--rule-id",
        RULE,
        "--expect-file",
        tempFile("bad.json", content),
      ]);
      expect(result.exitCode, content).toBe(2);
      expect(result.stderr, content).toContain(message);
    }
    expect(calls).toEqual([]);
  });

  it("refuses an unreadable or invalid JSON --expect-file with exit 1", async () => {
    for (const [path, message] of [
      [join(tempHome, "missing.json"), "Could not read --expect-file"],
      [tempFile("bad.json", "{"), "is not valid JSON"],
    ] as const) {
      const result = await run("email-rules:test-email-rule", [
        "--rule-id",
        RULE,
        "--expect-file",
        path,
      ]);
      expect(result.exitCode, path).toBe(1);
      expect(result.stderr, path).toContain(message);
    }
    expect(calls).toEqual([]);
  });

  it("removes repeated ids from --expect-file", async () => {
    answer(testResult());
    await run("email-rules:test-email-rule", [
      "--rule-id",
      RULE,
      "--expect-file",
      tempFile(
        "expect.json",
        JSON.stringify({ match: [A, B, A.toUpperCase()], no_match: [C, C] }),
      ),
    ]);
    expect(calls[0]?.body).toEqual({
      rule_id: RULE,
      expect: { match: [A, B], no_match: [C] },
    });
  });

  it("names the expectation flag when --raw-body is not an object", async () => {
    const result = await run("email-rules:test-email-rule", [
      "--raw-body",
      "[]",
      "--expect-match",
      A,
    ]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain(
      "supplied per-field flags: --expect-match.",
    );
    expect(calls).toEqual([]);
  });
});

describe("email-rules test-email-rule: exit codes and the stderr report", () => {
  it("exits 1 when an expectation failed and prints the report after the JSON", async () => {
    const data = testResult(FAILED_EXPECTATIONS);
    answer(data);
    const result = await run("email-rules:test-email-rule", [
      "--rule-id",
      RULE,
      "--expect-match",
      `${A},${B}`,
      "--expect-no-match",
      D,
    ]);
    expect(result.exitCode).toBe(1);
    // stdout is the API's data, unchanged.
    expect(JSON.parse(result.stdout)).toEqual(data);
    expect(result.merged.indexOf("Warning:")).toBeGreaterThan(
      result.merged.indexOf('"rule"'),
    );
    expect(stderrLines(result)).toEqual([
      "Warning: Most emails failed on condition 1.",
      "Scope warning: typo.example is none of the organization's domains.",
      "Conditions (3 decided):",
      "  0. The sender is not a contact: held on 3, failed on 0 (the only failure on 0)",
      "  1. It is cold outreach: held on 2, failed on 1 (the only failure on 1)",
      "Questions (on emails whose conditions held):",
      '  0. "Is it a sales pitch?": yes 1, no 1, unanswered 0',
      "Expectations: 1 failed, 1 undecided, 1 passed.",
      `  failed: ${B} expected match, got no_match`,
      `  undecided: ${D} expected no_match, got unclassified (not classified yet; test again later)`,
      "Not matched (3):",
      `  ${B} no_match (failed part 1): sender_known: false; is_cold_outreach: true at 0.69`,
      `  ${D} unclassified (pending: test again later)`,
      `  ${C} near_miss: topics: [billing 0.91, invoice 0.62] at 0.80`,
      '    questions (stored): "Is it a sales pitch?" no at 0.81',
    ]);
  });

  it("exits 3 when nothing failed but an expectation is undecided", async () => {
    answer(testResult(UNDECIDED_EXPECTATIONS));
    const result = await run("email-rules:test-email-rule", [
      "--rule-id",
      RULE,
      "--expect-match",
      A,
      "--expect-no-match",
      D,
    ]);
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("Expectations: 1 undecided, 1 passed.");
  });

  it("exits 1 with expectations_unresolvable for an email the rule cannot find", async () => {
    const data = withResults([{ email_id: E, outcome: "not_found" }], {
      passed: false,
      counts: { passed: 1, failed: 0, undecided: 1 },
      results: [
        {
          email_id: A,
          expected: "match",
          outcome: "matched",
          status: "passed",
        },
        {
          email_id: E,
          expected: "match",
          outcome: "not_found",
          status: "undecided",
        },
      ],
    });
    answer(data);
    const argv = ["--rule-id", RULE, "--expect-match", `${A},${E}`];
    const result = await run("email-rules:test-email-rule", argv);
    expect(result.exitCode).toBe(1);
    expect(stderrLines(result)).toContain(
      `  undecided: ${E} expected match, got not_found (no such email the rule can read; testing again will not decide it)`,
    );
    const json = await run("email-rules:test-email-rule", [...argv, "--json"]);
    expect(json.exitCode).toBe(1);
    expect(json.stderr).toBe("");
    expect(JSON.parse(json.merged)).toMatchObject({
      error: {
        code: "expectations_unresolvable",
        message: `1 expectation is undecided, and testing again will not decide it: ${E} (no such email the rule can read).`,
      },
      exit_code: 1,
    });
  });

  it("exits 1 with expectations_unresolvable for an email that cannot be classified", async () => {
    const data = {
      ...testResult(UNDECIDED_EXPECTATIONS),
      results: testResult().results.map((result) =>
        result.email_id === D
          ? { ...result, unclassified_reason: "not_classifiable" as const }
          : result,
      ),
    };
    answer(data);
    const result = await run("email-rules:test-email-rule", [
      "--rule-id",
      RULE,
      "--expect-no-match",
      D,
    ]);
    expect(result.exitCode).toBe(1);
    expect(stderrLines(result)).toEqual(
      expect.arrayContaining([
        `  undecided: ${D} expected no_match, got unclassified (it cannot be classified; testing again will not decide it)`,
        `  ${D} unclassified (not_classifiable)`,
      ]),
    );
    const json = await run("email-rules:test-email-rule", [
      "--rule-id",
      RULE,
      "--json",
    ]);
    expect(json.exitCode).toBe(1);
    expect(JSON.parse(json.merged).error).toEqual({
      code: "expectations_unresolvable",
      message: `1 expectation is undecided, and testing again will not decide it: ${D} (it cannot be classified).`,
    });
  });

  it("exits 1 with expectations_unresolvable for an email that cannot be tested", async () => {
    const data = withResults(
      [{ email_id: E, outcome: "skipped", skipped_reason: "unparsed" }],
      {
        passed: false,
        counts: { passed: 0, failed: 0, undecided: 1 },
        results: [
          {
            email_id: E,
            expected: "match",
            outcome: "skipped",
            status: "undecided",
          },
        ],
      },
    );
    answer(data);
    const argv = ["--rule-id", RULE, "--expect-match", E];
    const result = await run("email-rules:test-email-rule", argv);
    expect(result.exitCode).toBe(1);
    expect(stderrLines(result)).toEqual(
      expect.arrayContaining([
        `  undecided: ${E} expected match, got skipped (skipped: its content failed to parse; testing again will not decide it)`,
        `  ${E} skipped: its content failed to parse`,
      ]),
    );
    const json = await run("email-rules:test-email-rule", [...argv, "--json"]);
    expect(json.exitCode).toBe(1);
    expect(JSON.parse(json.merged).error).toEqual({
      code: "expectations_unresolvable",
      message: `1 expectation is undecided, and testing again will not decide it: ${E} (skipped: its content failed to parse).`,
    });
  });

  it("exits 3 only when a later test can decide every undecided one", async () => {
    const data = {
      ...testResult({
        passed: false,
        counts: { passed: 0, failed: 0, undecided: 2 },
        results: [
          {
            email_id: C,
            expected: "match",
            outcome: "near_miss",
            status: "undecided",
          },
          {
            email_id: D,
            expected: "no_match",
            outcome: "unclassified",
            status: "undecided",
          },
        ],
      }),
      results: testResult().results.map((result) =>
        result.email_id === D
          ? {
              ...result,
              unclassified_reason: "classifier_unavailable" as const,
            }
          : result,
      ),
    };
    answer(data);
    const result = await run("email-rules:test-email-rule", [
      "--rule-id",
      RULE,
    ]);
    expect(result.exitCode).toBe(3);
    expect(stderrLines(result)).toEqual(
      expect.arrayContaining([
        `  undecided: ${C} expected match, got near_miss (a question went unanswered; test again later)`,
        `  undecided: ${D} expected no_match, got unclassified (the classifier was unavailable; test again later)`,
        `  ${D} unclassified (classifier_unavailable: test again later)`,
      ]),
    );
    const json = await run("email-rules:test-email-rule", [
      "--rule-id",
      RULE,
      "--json",
    ]);
    expect(json.exitCode).toBe(3);
    expect(JSON.parse(json.merged).error).toEqual({
      code: "expectations_undecided",
      message: `2 expectations are undecided: ${C} (a question went unanswered), ${D} (the classifier was unavailable). Test again later.`,
    });
  });

  it("gives expectations_failed precedence over undecided ones", async () => {
    answer(
      withResults([{ email_id: E, outcome: "not_found" }], {
        passed: false,
        counts: { passed: 0, failed: 1, undecided: 1 },
        results: [
          {
            email_id: B,
            expected: "match",
            outcome: "no_match",
            status: "failed",
          },
          {
            email_id: E,
            expected: "no_match",
            outcome: "not_found",
            status: "undecided",
          },
        ],
      }),
    );
    const result = await run("email-rules:test-email-rule", [
      "--rule-id",
      RULE,
      "--json",
    ]);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.merged).error).toEqual({
      code: "expectations_failed",
      message: `1 expectation failed: ${B}.`,
    });
  });

  it("follows a saved rule's saved expectations when no expect is sent", async () => {
    answer(testResult(FAILED_EXPECTATIONS));
    const result = await run("email-rules:test-email-rule", [
      "--rule-id",
      RULE,
    ]);
    expect(calls[0]?.body).toEqual({ rule_id: RULE });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "Expectations: 1 failed, 1 undecided, 1 passed.",
    );
  });

  it("prints a null value as null", async () => {
    answer({
      ...testResult(),
      results: [
        {
          email_id: B,
          outcome: "no_match",
          values: { is_cold_outreach: null },
        },
      ],
    });
    const result = await run("email-rules:test-email-rule", [
      "--rule-id",
      RULE,
    ]);
    expect(result.exitCode).toBe(0);
    expect(stderrLines(result)).toContain(
      `  ${B} no_match: is_cold_outreach: null`,
    );
    expect(result.stderr).not.toContain("could not be built");
  });

  it("keeps the JSON and prints one warning when the report cannot be built", async () => {
    const extension = OPERATION_EXTENSIONS.testEmailRule;
    if (!extension) throw new Error("testEmailRule has no extension");
    const report = extension.report;
    extension.report = () => {
      throw new Error("bad answer");
    };
    try {
      const data = testResult(FAILED_EXPECTATIONS);
      answer(data);
      const result = await run("email-rules:test-email-rule", [
        "--rule-id",
        RULE,
      ]);
      // Fails closed: the expectations did not pass, so it still exits 1.
      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout)).toEqual(data);
      expect(stderrLines(result)).toEqual([
        "Warning: testEmailRule succeeded but its report could not be built (bad answer). The JSON above is the full answer; read it rather than the exit code.",
        "The answer's expectations were not all shown to pass, so the command exits 1.",
      ]);
      const json = await run("email-rules:test-email-rule", [
        "--rule-id",
        RULE,
        "--json",
      ]);
      expect(json.stderr).toBe("");
      expect(json.exitCode).toBe(1);
      expect(JSON.parse(json.merged)).toEqual({
        ...data,
        error: {
          code: "expectations_not_passed",
          message:
            "The answer's expectations were not all shown to pass; read their result in the answer.",
        },
        exit_code: 1,
        warnings: [stderrLines(result)[0]],
      });
      // An answer whose expectations passed keeps exit 0 when the report breaks.
      answer(testResult(PASSED_EXPECTATIONS));
      const passed = await run("email-rules:test-email-rule", [
        "--rule-id",
        RULE,
      ]);
      expect(passed.exitCode).toBe(0);
    } finally {
      extension.report = report;
    }
  });

  it("exits 0 when every expectation passed, and without expectations", async () => {
    answer(testResult(PASSED_EXPECTATIONS));
    const passed = await run("email-rules:test-email-rule", [
      "--rule-id",
      RULE,
      "--expect-match",
      A,
      "--expect-no-match",
      B,
    ]);
    expect(passed.exitCode).toBe(0);
    expect(passed.stderr).toContain("Expectations: all 2 passed.");
    answer(testResult());
    const none = await run("email-rules:test-email-rule", ["--rule-id", RULE]);
    expect(none.exitCode).toBe(0);
    expect(none.stderr).not.toContain("Expectations");
    expect(none.stderr).toContain("Not matched (3):");
  });

  it("lists not-matched results up to a limit, expected ones first", () => {
    const many: TestEmailRuleResult["results"] = Array.from(
      { length: NOT_MATCHED_LIST_LIMIT + 5 },
      (_, index) => ({
        email_id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        outcome: "no_match" as const,
      }),
    );
    const last = many.at(-1)?.email_id ?? "";
    const report = testEmailRuleReport({
      ...testResult(),
      summary: undefined,
      scope_warnings: undefined,
      results: many,
      expectations: {
        passed: false,
        counts: { passed: 0, failed: 1, undecided: 0 },
        results: [
          {
            email_id: last,
            expected: "match",
            outcome: "no_match",
            status: "failed",
          },
        ],
      },
    });
    const listed = report.lines.slice(
      report.lines.indexOf(
        `Not matched (${NOT_MATCHED_LIST_LIMIT} of ${NOT_MATCHED_LIST_LIMIT + 5} shown; the JSON has every result):`,
      ),
    );
    expect(listed).toHaveLength(NOT_MATCHED_LIST_LIMIT + 1);
    expect(listed[1]).toBe(`  ${last} no_match`);
  });
});

describe("email-rules test-email-rule --json", () => {
  it("keeps the exit code and states why in one document, with nothing on stderr", async () => {
    const data = testResult(FAILED_EXPECTATIONS);
    answer(data);
    const failed = await run("email-rules:test-email-rule", [
      "--rule-id",
      RULE,
      "--expect-match",
      B,
      "--json",
    ]);
    expect(failed.exitCode).toBe(1);
    expect(failed.stderr).toBe("");
    expect(JSON.parse(failed.merged)).toEqual({
      ...data,
      error: {
        code: "expectations_failed",
        message: `1 expectation failed: ${B}.`,
      },
      exit_code: 1,
    });

    answer(testResult(UNDECIDED_EXPECTATIONS));
    const undecided = await run("email-rules:test-email-rule", [
      "--rule-id",
      RULE,
      "--expect-no-match",
      D,
      "--json",
      "--envelope",
    ]);
    expect(undecided.exitCode).toBe(3);
    expect(undecided.stderr).toBe("");
    expect(JSON.parse(undecided.merged)).toMatchObject({
      success: true,
      data: { expectations: UNDECIDED_EXPECTATIONS },
      error: {
        code: "expectations_undecided",
        message: `1 expectation is undecided: ${D} (not classified yet). Test again later.`,
      },
      exit_code: 3,
    });
  });

  it("prints the data alone when the exit code is 0", async () => {
    const data = testResult(PASSED_EXPECTATIONS);
    answer(data);
    const result = await run("email-rules:test-email-rule", [
      "--rule-id",
      RULE,
      "--json",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.merged)).toEqual(data);
  });

  it("relies on composeJsonDocument keeping the error and adding exit_code", () => {
    // What the --json guard does with a document a command printed before
    // exiting non-zero: an error the document carries is kept and exit_code
    // is added. Without one, the guard would write a generic message.
    const document = { counts: { emails: 1 } };
    expect(
      composeJsonDocument({
        exitCode: 3,
        stderr: [],
        stdout: JSON.stringify({
          ...document,
          error: { code: "expectations_undecided", message: "undecided" },
        }),
      }),
    ).toEqual({
      ...document,
      error: { code: "expectations_undecided", message: "undecided" },
      exit_code: 3,
    });
    expect(
      composeJsonDocument({
        exitCode: 3,
        stderr: [],
        stdout: JSON.stringify(document),
      }),
    ).toEqual({
      ...document,
      error: { message: "The command failed with exit code 3." },
      exit_code: 3,
    });
  });
});

describe("email-rules create-email-rule and update-email-rule --expectations-file", () => {
  const written = {
    id: RULE,
    name: "Cold outreach",
    state: "observe",
    current_version: 4,
    author_user_id: "00000000-0000-4000-8000-0000000000f1",
    is_author: true,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-10T00:00:00Z",
    current: null,
  };
  const tree = { version: 1, vocabulary: "v1", when: { all: [] } };

  it("sets expectations from the file on create, over --raw-body", async () => {
    answer({
      ...written,
      expectations_check: {
        version: 1,
        passed: true,
        failed: [],
        undecided: [],
      },
    });
    const file = tempFile(
      "expectations.json",
      JSON.stringify({ match: [A], no_match: [B] }),
    );
    const result = await run("email-rules:create-email-rule", [
      "--raw-body",
      JSON.stringify({ tree, expectations: { match: [E] } }),
      "--name",
      "Cold outreach",
      "--english",
      "cold outreach",
      "--expectations-file",
      file,
    ]);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(calls[0]?.body).toEqual({
      tree,
      name: "Cold outreach",
      english: "cold outreach",
      expectations: { match: [A], no_match: [B] },
    });
    expect(stderrLines(result)).toEqual([
      "Expectations on version 1: all passed.",
    ]);
  });

  it("refuses a null file on create, which only update takes", async () => {
    const result = await run("email-rules:create-email-rule", [
      "--raw-body",
      JSON.stringify({ tree, name: "n", english: "e" }),
      "--expectations-file",
      tempFile("null.json", "null"),
    ]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("only update-email-rule takes");
    expect(calls).toEqual([]);
  });

  it("refuses a file with no email id on create and update", async () => {
    for (const [id, argv] of [
      [
        "email-rules:create-email-rule",
        ["--raw-body", JSON.stringify({ tree, name: "n", english: "e" })],
      ],
      ["email-rules:update-email-rule", [RULE]],
    ] as const) {
      for (const content of ["{}", JSON.stringify({ match: [] })]) {
        const result = await run(id, [
          ...argv,
          "--expectations-file",
          tempFile("empty.json", content),
        ]);
        expect(result.exitCode, `${id} ${content}`).toBe(2);
        expect(result.stderr).toContain(
          "needs at least one email id in match or no_match",
        );
      }
    }
    expect(calls).toEqual([]);
  });

  it("clears saved expectations on update with a null file", async () => {
    answer(written);
    const result = await run("email-rules:update-email-rule", [
      RULE,
      "--expectations-file",
      tempFile("null.json", "null"),
    ]);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(calls.map((call) => [call.method, call.url.pathname])).toEqual([
      ["PATCH", `/v1/email-rules/${RULE}`],
    ]);
    expect(calls[0]?.body).toEqual({ expectations: null });
    expect(result.stderr).toBe("");
  });

  it("summarizes expectations_check with its version and prints scope warnings", async () => {
    answer({
      ...written,
      scope_warnings: [
        {
          name: "new@acme.example",
          kind: "address",
          reason: "unknown_address",
          message: "No mail has reached this inbox yet.",
        },
      ],
      expectations_check: {
        version: 4,
        passed: false,
        failed: [B],
        undecided: [D],
      },
    });
    const result = await run("email-rules:update-email-rule", [
      "--id",
      RULE,
      "--if-version",
      "3",
      "--english",
      "cold outreach from strangers",
      "--expectations-file",
      tempFile("e.json", JSON.stringify({ match: [B], no_match: [D] })),
    ]);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(calls[0]?.body).toEqual({
      if_version: 3,
      english: "cold outreach from strangers",
      expectations: { match: [B], no_match: [D] },
    });
    expect(stderrLines(result)).toEqual([
      "Scope warning: new@acme.example: No mail has reached this inbox yet.",
      `Expectations on version 4: 1 failed (${B}), 1 undecided (${D}). To decide the rest, run \`primitive email-rules test-email-rule --rule-id ${RULE}\`.`,
    ]);
  });

  it("says none failed when the rest are undecided, and that a do_not_share rule blocks sharing", async () => {
    answer({
      ...written,
      kind: "do_not_share",
      expectations_check: {
        version: 4,
        passed: null,
        decided: false,
        failed: [],
        undecided: [D],
      },
    });
    const result = await run("email-rules:update-email-rule", [
      RULE,
      "--expectations-file",
      tempFile("e.json", JSON.stringify({ no_match: [D] })),
    ]);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(stderrLines(result)).toEqual([
      "This rule blocks sharing (kind do_not_share): while it is active, no rule shares an email it matches. It blocks nothing until it is active.",
      `Expectations on version 4: none failed, 1 undecided (${D}). To decide the rest, run \`primitive email-rules test-email-rule --rule-id ${RULE}\`.`,
    ]);
    // An active do_not_share rule says only that it blocks sharing.
    answer({ ...written, kind: "do_not_share", state: "active" });
    const active = await run("email-rules:update-email-rule", [
      RULE,
      "--name",
      "n",
    ]);
    expect(stderrLines(active)).toEqual([
      "This rule blocks sharing (kind do_not_share): while it is active, no rule shares an email it matches.",
    ]);
    // A grant rule adds no line for its kind.
    answer({ ...written, kind: "grant" });
    const grant = await run("email-rules:update-email-rule", [
      RULE,
      "--name",
      "n",
    ]);
    expect(grant.stderr).toBe("");
  });

  it("says when expectations it sent were not checked", async () => {
    answer(written);
    const result = await run("email-rules:update-email-rule", [
      RULE,
      "--expectations-file",
      tempFile("e.json", JSON.stringify({ match: [A] })),
    ]);
    expect(stderrLines(result)).toEqual([
      `Expectations were not checked on this write. Test them with \`primitive email-rules test-email-rule --rule-id ${RULE}\`.`,
    ]);
  });

  it("prints nothing on stderr under --json, and the data unchanged", async () => {
    const data = {
      ...written,
      expectations_check: {
        version: 4,
        passed: false,
        failed: [B],
        undecided: [],
      },
    };
    answer(data);
    const result = await run("email-rules:update-email-rule", [
      RULE,
      "--expectations-file",
      tempFile("e.json", JSON.stringify({ match: [B] })),
      "--json",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.merged)).toEqual(data);
  });

  describe("--fail-on-expectations", () => {
    const sent = () =>
      tempFile("e.json", JSON.stringify({ match: [B], no_match: [D] }));
    const check = (fields: Record<string, unknown>) => ({
      ...written,
      expectations_check: { version: 4, ...fields },
    });
    const TEST = `\`primitive email-rules test-email-rule --rule-id ${RULE}\``;

    it("exits 1 when an expectation failed, with the same report", async () => {
      answer(
        check({ passed: false, decided: false, failed: [B], undecided: [D] }),
      );
      const result = await run("email-rules:update-email-rule", [
        RULE,
        "--expectations-file",
        sent(),
        "--fail-on-expectations",
      ]);
      expect(result.exitCode).toBe(1);
      expect(stderrLines(result)).toEqual([
        `Expectations on version 4: 1 failed (${B}), 1 undecided (${D}). To decide the rest, run ${TEST}.`,
      ]);
    });

    it("exits 3 when none failed and one is undecided, with passed null", async () => {
      const data = check({
        passed: null,
        decided: false,
        failed: [],
        undecided: [D],
      });
      answer(data);
      const result = await run("email-rules:create-email-rule", [
        "--raw-body",
        JSON.stringify({ tree, name: "n", english: "e" }),
        "--expectations-file",
        sent(),
        "--fail-on-expectations",
        "--json",
      ]);
      expect(result.exitCode).toBe(3);
      expect(result.stderr).toBe("");
      expect(JSON.parse(result.merged)).toEqual({
        ...data,
        error: {
          code: "expectations_undecided",
          message: `1 expectation is undecided on this write, which judges them without classifying mail or asking the rule's questions: ${D}. Test them with ${TEST}.`,
        },
        exit_code: 3,
      });
    });

    it("says a write the server did not judge was saved, under --json, when one failed", async () => {
      // Changing only expectations saves no version, so the server saves
      // it unjudged and the check after saving sets the exit code.
      const data = check({
        passed: false,
        decided: true,
        failed: [B, D],
        undecided: [],
      });
      answer(data);
      const result = await run("email-rules:update-email-rule", [
        RULE,
        "--expectations-file",
        sent(),
        "--fail-on-expectations",
        "--json",
      ]);
      expect(result.exitCode, result.stderr).toBe(1);
      expect(calls[0]?.body).toMatchObject({ if_expectations_pass: true });
      expect(JSON.parse(result.merged)).toEqual({
        ...data,
        error: {
          code: "expectations_failed",
          message: `The write was saved: the server judges a write before saving only when it saves a version or turns the rule active, so not this one. 2 expectations failed on this write: ${B}, ${D}.`,
        },
        exit_code: 1,
      });
    });

    it("never sends if_expectations_pass on create", async () => {
      answer(check({ passed: true, decided: true, failed: [], undecided: [] }));
      await run("email-rules:create-email-rule", [
        "--raw-body",
        JSON.stringify({ tree, name: "n", english: "e" }),
        "--fail-on-expectations",
      ]);
      expect(calls[0]?.body).not.toHaveProperty("if_expectations_pass");
    });

    it("exits 0 when every one passed, and when the write has none to check", async () => {
      answer(check({ passed: true, decided: true, failed: [], undecided: [] }));
      const passed = await run("email-rules:update-email-rule", [
        RULE,
        "--expectations-file",
        sent(),
        "--fail-on-expectations",
      ]);
      expect(passed.exitCode, passed.stderr).toBe(0);
      answer(written);
      const none = await run("email-rules:update-email-rule", [
        RULE,
        "--name",
        "Renamed",
        "--fail-on-expectations",
      ]);
      expect(none.exitCode, none.stderr).toBe(0);
      expect(none.stderr).toBe("");
    });

    it("exits 3 when the expectations it sent were not checked", async () => {
      answer(written);
      const result = await run("email-rules:update-email-rule", [
        RULE,
        "--expectations-file",
        sent(),
        "--fail-on-expectations",
        "--json",
      ]);
      expect(result.exitCode).toBe(3);
      expect(JSON.parse(result.merged)).toMatchObject({
        error: {
          code: "expectations_unchecked",
          message: `The write was saved: the server judges a write before saving only when it saves a version or turns the rule active, so not this one. The expectations this write sent were not checked on it. Test them with ${TEST}.`,
        },
        exit_code: 3,
      });
    });

    it("keeps exit 0 without the flag, whatever the check says", async () => {
      answer(
        check({ passed: false, decided: true, failed: [B], undecided: [] }),
      );
      const result = await run("email-rules:update-email-rule", [
        RULE,
        "--expectations-file",
        sent(),
      ]);
      expect(result.exitCode).toBe(0);
    });

    it("exits 3 when none failed and one is undecided, with passed false", async () => {
      answer(check({ passed: false, failed: [], undecided: [D] }));
      const result = await run("email-rules:update-email-rule", [
        RULE,
        "--expectations-file",
        sent(),
        "--fail-on-expectations",
      ]);
      expect(result.exitCode, result.stderr).toBe(3);
    });

    it("exits 1 for any other check that did not pass", async () => {
      for (const fields of [
        { passed: null, failed: [], undecided: [] },
        { passed: false, failed: [], undecided: [] },
        { failed: [], undecided: [] },
        { passed: null, failed: "x", undecided: "y" },
      ]) {
        answer(check(fields));
        const result = await run("email-rules:update-email-rule", [
          RULE,
          "--expectations-file",
          sent(),
          "--fail-on-expectations",
          "--json",
        ]);
        expect(result.exitCode, JSON.stringify(fields)).toBe(1);
        expect(JSON.parse(result.merged).error?.code).toBe(
          "expectations_failed",
        );
      }
    });

    it("exits 0 on create with no expectations, and on update with a null file", async () => {
      answer(written);
      const created = await run("email-rules:create-email-rule", [
        "--raw-body",
        JSON.stringify({ tree, name: "n", english: "e" }),
        "--fail-on-expectations",
      ]);
      expect(created.exitCode, created.stderr).toBe(0);
      answer(written);
      const cleared = await run("email-rules:update-email-rule", [
        RULE,
        "--expectations-file",
        tempFile("null.json", "null"),
        "--fail-on-expectations",
      ]);
      expect(cleared.exitCode, cleared.stderr).toBe(0);
    });

    it("prints the data alone under --json when every one passed", async () => {
      const data = check({
        passed: true,
        decided: true,
        failed: [],
        undecided: [],
      });
      answer(data);
      const result = await run("email-rules:update-email-rule", [
        RULE,
        "--expectations-file",
        sent(),
        "--fail-on-expectations",
        "--json",
      ]);
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.merged)).toEqual(data);
    });

    it("fails closed when the report cannot be built, and only with the flag", async () => {
      const extension = OPERATION_EXTENSIONS.updateEmailRule;
      if (!extension) throw new Error("updateEmailRule has no extension");
      const report = extension.report;
      extension.report = () => {
        throw new Error("bad answer");
      };
      try {
        const exitFor = async (data: unknown, flag: boolean) => {
          answer(data);
          const result = await run("email-rules:update-email-rule", [
            RULE,
            "--expectations-file",
            sent(),
            ...(flag ? ["--fail-on-expectations"] : []),
          ]);
          return result.exitCode;
        };
        const failed = check({ passed: false, failed: [B], undecided: [] });
        expect(await exitFor(failed, true)).toBe(1);
        expect(await exitFor(failed, false)).toBe(0);
        // No check, though the write sent expectations: not checked, so test the rule.
        expect(await exitFor(written, true)).toBe(3);
        // Read as the report reads it, lists first, whatever passed says.
        expect(
          await exitFor(
            check({ passed: true, failed: [B], undecided: [] }),
            true,
          ),
        ).toBe(1);
        expect(
          await exitFor(
            check({ passed: true, failed: [], undecided: [D] }),
            true,
          ),
        ).toBe(3);
        expect(
          await exitFor(
            check({ passed: true, failed: [], undecided: [] }),
            true,
          ),
        ).toBe(0);
      } finally {
        extension.report = report;
      }
    });

    it("is a flag on create and update", () => {
      for (const id of [
        "email-rules:create-email-rule",
        "email-rules:update-email-rule",
      ]) {
        const flag = (COMMANDS[id] as unknown as Runnable).flags[
          "fail-on-expectations"
        ];
        expect(flag?.type, id).toBe("boolean");
      }
      // Create judges after saving; update asks the server to refuse first.
      expect(
        (COMMANDS["email-rules:create-email-rule"] as unknown as Runnable)
          .flags["fail-on-expectations"]?.description,
      ).toContain("Exit 1 when an expectation");
      const update = (
        COMMANDS["email-rules:update-email-rule"] as unknown as Runnable
      ).flags["fail-on-expectations"]?.description;
      expect(update).toContain("sends if_expectations_pass");
      expect(update).toContain("saves nothing");
    });
  });

  it("generates --if-version on update and an optional --explanation on rule writes", () => {
    const update = (
      COMMANDS["email-rules:update-email-rule"] as unknown as Runnable
    ).flags;
    expect(update["if-version"]?.type).toBe("option");
    expect(update["if-version"]?.description).toContain("version_moved");
    for (const id of [
      "email-rules:create-email-rule",
      "email-rules:update-email-rule",
      "email-rules:create-email-rule-request",
      "email-rules:accept-email-rule-request",
    ]) {
      const explanation = (COMMANDS[id] as unknown as Runnable).flags
        .explanation;
      expect(explanation, id).toBeDefined();
      expect(explanation?.required, id).toBeFalsy();
      expect(explanation?.description, id).toContain(
        "Left out, the server writes one",
      );
    }
  });
});

describe("email-rules samples files and --pick", () => {
  const written = {
    id: RULE,
    name: "Bills",
    state: "observe",
    current_version: 2,
    author_user_id: "00000000-0000-4000-8000-0000000000f1",
    is_author: true,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-10T00:00:00Z",
    current: null,
  };
  const tree = { version: 1, vocabulary: "v1", when: { all: [] } };
  const sample = (subject: string) => ({
    expected: "no_match",
    label: `medical: ${subject}`,
    email: {
      from: { address: "billing@clinic.example" },
      to: ["me@acme.example"],
      subject,
      text: `${subject}, the text.`,
    },
  });
  const samples = [sample("one"), sample("two"), sample("three")];

  it("adds the flags, each samples file flag beside --pick", () => {
    const flags = (id: string) => (COMMANDS[id] as unknown as Runnable).flags;
    expect(flags("email-rules:create-email-rule")).toHaveProperty(
      "expectation-samples-file",
    );
    expect(flags("email-rules:create-email-rule").pick?.description).toContain(
      "by their numbers from 1 as generate-look-alikes printed them",
    );
    const update = flags("email-rules:update-email-rule");
    expect(update["expectation-samples-file"]?.exclusive).toEqual([
      "add-expectation-samples-file",
    ]);
    expect(update["add-expectation-samples-file"]?.exclusive).toEqual([
      "expectation-samples-file",
    ]);
    expect(
      flags("email-rules:test-email-rule")["expect-samples-file"]?.exclusive,
    ).toBeUndefined();
  });

  it("sets the picked samples on create, in the order --pick names them", async () => {
    answer(written);
    const result = await run("email-rules:create-email-rule", [
      "--raw-body",
      JSON.stringify({ tree, expectation_samples: [sample("raw")] }),
      "--name",
      "Bills",
      "--english",
      "bills",
      "--expectation-samples-file",
      tempFile("samples.json", JSON.stringify(samples)),
      "--pick",
      "3,1",
    ]);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(calls[0]?.body).toEqual({
      tree,
      name: "Bills",
      english: "bills",
      expectation_samples: [samples[2], samples[0]],
    });
  });

  it("adds on update with --add-expectation-samples-file, and replaces with --expectation-samples-file", async () => {
    answer(written);
    const file = tempFile("samples.json", JSON.stringify(samples));
    const added = await run("email-rules:update-email-rule", [
      RULE,
      "--add-expectation-samples-file",
      file,
      "--pick",
      "2",
    ]);
    expect(added.exitCode, added.stderr).toBe(0);
    expect(calls[0]?.body).toEqual({ add_expectation_samples: [samples[1]] });
    const removed = await run("email-rules:update-email-rule", [
      RULE,
      "--expectation-samples-file",
      tempFile("empty.json", "[]"),
    ]);
    expect(removed.exitCode, removed.stderr).toBe(0);
    expect(calls[1]?.body).toEqual({ expectation_samples: [] });
  });

  it("refuses a --pick number the file does not hold, and --pick without a file, sending nothing", async () => {
    const file = tempFile("samples.json", JSON.stringify(samples));
    const out = await run("email-rules:update-email-rule", [
      RULE,
      "--add-expectation-samples-file",
      file,
      "--pick",
      "2,4",
    ]);
    expect(out.exitCode).toBe(2);
    expect(out.stderr).toContain(
      `--pick 2,4: 4 is not a sample number; --add-expectation-samples-file ${file} holds samples 1 to 3.`,
    );
    const alone = await run("email-rules:create-email-rule", [
      "--raw-body",
      JSON.stringify({ tree, name: "n", english: "e" }),
      "--pick",
      "1",
    ]);
    expect(alone.exitCode).toBe(2);
    expect(alone.stderr).toContain(
      "--pick chooses from a samples file: pass it with --expectation-samples-file.",
    );
    const both = await run("email-rules:update-email-rule", [
      RULE,
      "--add-expectation-samples-file",
      file,
      "--expectation-samples-file",
      file,
    ]);
    expect(both.exitCode).toBe(2);
    expect(calls).toEqual([]);
  });

  it("tests the picked samples with --expect-samples-file, beside --expect-match", async () => {
    answer(testResult());
    const result = await run("email-rules:test-email-rule", [
      "--rule-id",
      RULE,
      "--expect-match",
      A,
      "--expect-samples-file",
      tempFile("samples.json", JSON.stringify(samples)),
      "--pick",
      "1,3",
    ]);
    expect(calls[0]?.body).toMatchObject({
      rule_id: RULE,
      expect: { match: [A], samples: [samples[0], samples[2]] },
    });
    expect(result.stderr).not.toContain("--pick");
    // Beside --expect-file too: the file's emails by id, and the samples.
    await run("email-rules:test-email-rule", [
      "--rule-id",
      RULE,
      "--expect-file",
      tempFile("expect.json", JSON.stringify({ no_match: [B] })),
      "--expect-samples-file",
      tempFile("samples2.json", JSON.stringify(samples)),
      "--pick",
      "2",
    ]);
    expect(calls[1]?.body).toMatchObject({
      expect: { no_match: [B], samples: [samples[1]] },
    });
    // An expect file with samples in it points to the samples flag.
    const inFile = await run("email-rules:test-email-rule", [
      "--rule-id",
      RULE,
      "--expect-file",
      tempFile("expect2.json", JSON.stringify({ samples })),
    ]);
    expect(inFile.exitCode).toBe(2);
    expect(inFile.stderr).toContain(
      "takes emails by id only; give made-up emails with --expect-samples-file.",
    );
    const rule = await run("email-rules:update-email-rule", [
      RULE,
      "--expectations-file",
      tempFile("expectations.json", JSON.stringify({ samples })),
    ]);
    expect(rule.stderr).toContain(
      "give made-up emails with --expectation-samples-file.",
    );
    expect(calls).toHaveLength(2);
    // Alone, the samples are the whole of expect.
    await run("email-rules:test-email-rule", [
      "--rule-id",
      RULE,
      "--expect-samples-file",
      tempFile("samples3.json", JSON.stringify(samples)),
    ]);
    expect(calls[2]?.body).toEqual({ rule_id: RULE, expect: { samples } });
  });
});

describe("email-rules generate-look-alikes", () => {
  const lookAlike = (subject: string, status: string, outcome: string) => ({
    kind: "medical",
    why: `${subject} is private.`,
    email: {
      from: { address: "billing@clinic.example" },
      to: ["me@acme.example"],
      cc: [],
      subject,
      text: `${subject}, the text.`,
      attachment_types: [],
      automated: false,
      from_mailing_list: false,
    },
    outcome,
    status,
    question_answers: [],
  });
  const data = {
    rule: { id: RULE, version: 2, vocabulary: "v1" },
    look_alikes: [
      lookAlike("Your dental invoice", "failed", "matched"),
      lookAlike("Lab results", "passed", "no_match"),
    ],
    counts: { passed: 1, failed: 1, undecided: 0, dropped: 0 },
    note: "These emails are made up.",
  };

  it("sends the rule, prints each look-alike numbered, and writes them to --samples-file in that order", async () => {
    answer(data);
    const path = join(tempHome, "look-alikes.json");
    const result = await run("email-rules:generate-look-alikes", [
      "--rule-id",
      RULE,
      "--samples-file",
      path,
    ]);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(calls[0]?.url.pathname).toBe("/v1/email-rules/look-alikes");
    expect(calls[0]?.body).toEqual({ rule_id: RULE });
    expect(stderrLines(result).slice(0, 2)).toEqual([
      '1. failed  medical  "Your dental invoice" from billing@clinic.example',
      "   Why it should not match: Your dental invoice is private.",
    ]);
    const written = JSON.parse(readFileSync(path, "utf8"));
    expect(
      written.map((s: { email: { subject: string } }) => s.email.subject),
    ).toEqual(["Your dental invoice", "Lab results"]);
    expect(written[0]).toMatchObject({
      expected: "no_match",
      label: "medical: Your dental invoice is private.",
    });
    // And an update takes the file by those numbers.
    answer({ id: RULE, name: "Bills", state: "observe", current_version: 2 });
    await run("email-rules:update-email-rule", [
      RULE,
      "--add-expectation-samples-file",
      path,
      "--pick",
      "1",
    ]);
    expect(calls[1]?.body).toEqual({ add_expectation_samples: [written[0]] });
  });

  it("writes the file under --json too, and exits 1 with samples_file_not_written when it cannot", async () => {
    answer(data);
    const path = join(tempHome, "quiet.json");
    const quiet = await run("email-rules:generate-look-alikes", [
      "--rule-id",
      RULE,
      "--samples-file",
      path,
      "--json",
    ]);
    expect(quiet.exitCode).toBe(0);
    expect(quiet.stderr).toBe("");
    expect(JSON.parse(readFileSync(path, "utf8"))).toHaveLength(2);
    const failed = await run("email-rules:generate-look-alikes", [
      "--rule-id",
      RULE,
      "--samples-file",
      join(tempHome, "no-such-dir", "f.json"),
      "--json",
    ]);
    expect(failed.exitCode).toBe(1);
    expect(JSON.parse(failed.merged).error.code).toBe(
      "samples_file_not_written",
    );
  });
});

describe("email-rules accept-email-rule-request --expectation-samples-file", () => {
  const REQUEST = "00000000-0000-4000-8000-0000000000ee";
  const sample = (subject: string) => ({
    expected: "no_match",
    label: `medical: ${subject}`,
    email: {
      from: { address: "billing@clinic.example" },
      to: ["me@acme.example"],
      subject,
      text: `${subject}, the text.`,
    },
  });
  const samples = [sample("one"), sample("two"), sample("three")];

  it("keeps the picked samples on the rule the accept writes", async () => {
    answer({ request: { id: REQUEST }, rule: { id: RULE }, share: {} });
    const result = await run("email-rules:accept-email-rule-request", [
      REQUEST,
      "--expectation-samples-file",
      tempFile("samples.json", JSON.stringify(samples)),
      "--pick",
      "3,1",
    ]);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(calls[0]?.url.pathname).toBe(
      `/v1/email-rule-requests/${REQUEST}/accept`,
    );
    expect(calls[0]?.body).toEqual({
      expectation_samples: [samples[2], samples[0]],
    });
  });

  it("writes look-alikes for a request with --request-id", async () => {
    answer({
      rule: { id: null, version: null, vocabulary: "v1" },
      look_alikes: [],
      counts: { passed: 0, failed: 0, undecided: 0, dropped: 0 },
      note: "Made up.",
    });
    const result = await run("email-rules:generate-look-alikes", [
      "--request-id",
      REQUEST,
    ]);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(calls[0]?.body).toEqual({ request_id: REQUEST });
  });

  it("refuses an empty file and a number it does not hold, sending nothing", async () => {
    const empty = await run("email-rules:accept-email-rule-request", [
      REQUEST,
      "--expectation-samples-file",
      tempFile("empty.json", "[]"),
    ]);
    expect(empty.exitCode).toBe(2);
    expect(empty.stderr).toContain("holds no samples");
    const out = await run("email-rules:accept-email-rule-request", [
      REQUEST,
      "--expectation-samples-file",
      tempFile("samples.json", JSON.stringify(samples)),
      "--pick",
      "4",
    ]);
    expect(out.exitCode).toBe(2);
    expect(out.stderr).toContain("4 is not a sample number");
    expect(calls).toEqual([]);
  });
});

describe("email-rules made-up emails in test and write reports", () => {
  const written = {
    id: RULE,
    name: "Bills",
    state: "observe",
    current_version: 1,
    author_user_id: "00000000-0000-4000-8000-0000000000f1",
    is_author: true,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-10T00:00:00Z",
    current: null,
  };
  const tree = { version: 1, vocabulary: "v1", when: { all: [] } };
  const sample = (subject: string) => ({
    expected: "no_match",
    label: `medical: ${subject}`,
    email: {
      from: { address: "billing@clinic.example" },
      to: ["me@acme.example"],
      subject,
      text: `${subject}, the text.`,
    },
  });
  const samples = [sample("one"), sample("two"), sample("three")];
  const judged = (
    index: number,
    status: string,
    outcome: string,
    extra: Record<string, unknown> = {},
  ) => ({
    index,
    sample_id: null,
    label: `medical: ${["one", "two", "three"][index] ?? "x"}`,
    expected: "no_match",
    outcome,
    status,
    question_answers: [],
    ...extra,
  });
  const expectations = (list: unknown[], counts: Record<string, number>) =>
    ({
      passed: false,
      counts: { passed: 0, failed: 0, undecided: 0, ...counts },
      results: [],
      samples: list,
    }) as unknown as TestEmailRuleResult["expectations"];
  // The report from its Expectations line on.
  const lines = (result: RunResult) => {
    const all = stderrLines(result);
    return all.slice(all.findIndex((line) => line.startsWith("Expectations")));
  };

  it("names each sample that did not pass by its number in the file --pick took it from", async () => {
    // Sent as --pick 3,1: the API's index 0 is the file's sample 3.
    answer(
      testResult(
        expectations(
          [
            judged(0, "failed", "matched", {
              label: "medical: three",
              question_answers: [
                { question: "Is it a bill?", answer: true, probability: 0.9 },
              ],
            }),
            judged(1, "undecided", "not_decided", { label: "medical: one" }),
          ],
          { failed: 1, undecided: 1 },
        ),
      ),
    );
    const result = await run("email-rules:test-email-rule", [
      "--rule-id",
      RULE,
      "--expect-samples-file",
      tempFile("samples.json", JSON.stringify(samples)),
      "--pick",
      "3,1",
    ]);
    expect(result.exitCode).toBe(1);
    expect(lines(result).slice(0, 4)).toEqual([
      "Expectations: 1 failed, 1 undecided, 0 passed.",
      '  failed: sample 3 ("medical: three") expected no_match, got matched',
      '    questions: "Is it a bill?" yes at 0.90',
      '  undecided: sample 1 ("medical: one") expected no_match, got not_decided (it was not reached in time, or deciding it failed; test again later)',
    ]);
  });

  it("exits 3 for a sample a later test can decide, and 1 for one it may not", async () => {
    answer(
      testResult(
        expectations([judged(0, "undecided", "not_decided")], {
          undecided: 1,
        }),
      ),
    );
    const later = await run("email-rules:test-email-rule", [
      "--rule-id",
      RULE,
      "--json",
    ]);
    expect(later.exitCode).toBe(3);
    expect(JSON.parse(later.merged).error).toEqual({
      code: "expectations_undecided",
      message:
        "1 expectation is undecided: saved sample 1 (it was not reached in time, or deciding it failed). Test again later.",
    });
    // A question left unanswered, with none answered no, can be decided by a
    // later test: exit 3 too.
    answer(
      testResult(
        expectations(
          [
            judged(2, "undecided", "near_miss", {
              question_answers: [
                { question: "Is it a bill?", answer: null, probability: null },
              ],
            }),
          ],
          { undecided: 1 },
        ),
      ),
    );
    const unanswered = await run("email-rules:test-email-rule", [
      "--rule-id",
      RULE,
    ]);
    expect(unanswered.exitCode).toBe(3);
    expect(lines(unanswered)).toContain(
      '  undecided: saved sample 3 ("medical: three") expected no_match, got near_miss (a question went unanswered; test again later)',
    );
    const unansweredJson = await run("email-rules:test-email-rule", [
      "--rule-id",
      RULE,
      "--json",
    ]);
    expect(JSON.parse(unansweredJson.merged).error).toEqual({
      code: "expectations_undecided",
      message:
        "1 expectation is undecided: saved sample 3 (a question went unanswered). Test again later.",
    });
    answer(
      testResult(
        expectations([judged(1, "undecided", "no_match")], { undecided: 1 }),
      ),
    );
    const may = await run("email-rules:test-email-rule", ["--rule-id", RULE]);
    expect(may.exitCode).toBe(1);
    // Judged as the rule's own: numbered as it keeps them.
    expect(
      JSON.parse(
        (
          await run("email-rules:test-email-rule", [
            "--rule-id",
            RULE,
            "--json",
          ])
        ).merged,
      ).error.message,
    ).toContain("testing again may not decide it");
    expect(lines(may)).toContain(
      '  undecided: saved sample 2 ("medical: two") expected no_match, got no_match (it reads a spam score the sample does not carry, a fact its classification left out, or its classification failed; a later test may not decide it)',
    );
  });

  it("says a write does not judge the made-up emails it saved, and --fail-on-expectations exits 3", async () => {
    const data = {
      ...written,
      expectation_samples: [
        {
          id: "00000000-0000-4000-8000-0000000000c1",
          created_at: "2026-11-10T00:00:00Z",
          ...sample("one"),
        },
        {
          id: "00000000-0000-4000-8000-0000000000c2",
          created_at: "2026-11-10T00:00:00Z",
          ...sample("two"),
          label: null,
        },
      ],
      expectations_check: {
        version: 1,
        passed: null,
        decided: false,
        failed: [],
        undecided: [],
        failed_samples: [],
        undecided_samples: [0, 1],
      },
    };
    answer(data);
    const argv = [
      "--raw-body",
      JSON.stringify({ tree, name: "Bills", english: "bills" }),
      "--expectation-samples-file",
      tempFile("samples.json", JSON.stringify(samples)),
      "--pick",
      "2,3",
    ];
    const plain = await run("email-rules:create-email-rule", argv);
    expect(plain.exitCode).toBe(0);
    expect(stderrLines(plain)).toContain(
      // Sent as --pick 2,3: named by their numbers in the file.
      `Expectations on version 1: none failed, 2 made-up emails not judged by this write (sample 2 ("medical: two"), sample 3 ("medical: three")). To decide the rest, run \`primitive email-rules test-email-rule --rule-id ${RULE}\`.`,
    );
    const failing = await run("email-rules:create-email-rule", [
      ...argv,
      "--fail-on-expectations",
      "--json",
    ]);
    expect(failing.exitCode).toBe(3);
    expect(JSON.parse(failing.merged).error.message).toBe(
      `2 expectations are undecided on this write, which judges them without classifying mail or asking the rule's questions, and leaves made-up emails unjudged: sample 2 ("medical: two"), sample 3 ("medical: three"). Test them with \`primitive email-rules test-email-rule --rule-id ${RULE}\`.`,
    );
  });

  it("names the made-up emails a guarded update failed on, and exits 1", async () => {
    responder = () =>
      jsonResponse(409, {
        success: false,
        error: {
          code: "expectations_failed",
          message: "Refused.",
          details: {
            expectations_check: {
              version: null,
              passed: false,
              decided: true,
              failed: [],
              undecided: [],
              failed_samples: [1],
              undecided_samples: [],
            },
          },
        },
      });
    const result = await run("email-rules:update-email-rule", [
      RULE,
      "--state",
      "active",
      "--fail-on-expectations",
    ]);
    expect(result.exitCode).toBe(1);
    expect(stderrLines(result).at(-1)).toBe(
      "Hint: the rule, as this write would leave it, was judged against its expectations before saving (if_expectations_pass), and nothing was saved. Expectations failed: saved sample 2. The command exits 1.",
    );
  });

  const refusedWith = (check: Record<string, unknown>, reason?: string) => {
    responder = () =>
      jsonResponse(409, {
        success: false,
        error: {
          code: check.failed_samples
            ? "expectations_failed"
            : "expectations_undecided",
          message: "Refused.",
          details: {
            ...(reason ? { reason } : {}),
            expectations_check: {
              version: null,
              passed: null,
              decided: false,
              failed: [],
              undecided: [],
              ...check,
            },
          },
        },
      });
  };

  it("names a refused write's own samples by their numbers in the file, or says where an added one may be", async () => {
    const file = tempFile("samples.json", JSON.stringify(samples));
    refusedWith({ failed_samples: [0] });
    const replaced = await run("email-rules:update-email-rule", [
      RULE,
      "--expectation-samples-file",
      file,
      "--pick",
      "3",
      "--fail-on-expectations",
    ]);
    expect(stderrLines(replaced).at(-1)).toContain(
      'Expectations failed: sample 3 ("medical: three").',
    );
    refusedWith({ failed_samples: [4] });
    const added = await run("email-rules:update-email-rule", [
      RULE,
      "--add-expectation-samples-file",
      file,
      "--fail-on-expectations",
    ]);
    expect(stderrLines(added).at(-1)).toContain(
      "Expectations failed: made-up email 5. Made-up emails are numbered from 1: the rule's saved ones first, then those this write adds.",
    );
  });

  it("exits 1 when a refused write's made-up email is undecided for no reason given, and 3 when the judgment ran out of time", async () => {
    refusedWith({ undecided_samples: [0] });
    const stays = await run("email-rules:update-email-rule", [
      RULE,
      "--state",
      "active",
      "--fail-on-expectations",
    ]);
    expect(stays.exitCode).toBe(1);
    expect(stderrLines(stays).at(-1)).toBe(
      `Hint: the rule, as this write would leave it, was judged against its expectations before saving (if_expectations_pass), and nothing was saved. Expectations undecided: saved sample 1. A made-up email undecided for no reason given may stay so (a spam score it does not carry, a fact its classification left out, or a failed classification), so sending the write again may not decide it. To see why, test rule ${RULE} on each with \`primitive email-rules test-email-rule-on-sample\` (\`primitive email-rules get-email-rule ${RULE}\` lists its saved ones). The command exits 1.`,
    );
    refusedWith({ undecided_samples: [0] }, "deadline");
    const later = await run("email-rules:update-email-rule", [
      RULE,
      "--state",
      "active",
      "--fail-on-expectations",
    ]);
    expect(later.exitCode).toBe(3);
    expect(stderrLines(later).at(-1)).toContain(
      "The judgment ran out of time; send the write again.",
    );
    // A reason given says what to do: a rule that cannot run as its author
    // stays undecided, and a test of it would fail the same way.
    refusedWith(
      { undecided: [E], undecided_samples: [0] },
      "author_unresolvable",
    );
    const author = await run("email-rules:update-email-rule", [
      RULE,
      "--state",
      "active",
      "--fail-on-expectations",
    ]);
    expect(author.exitCode).toBe(1);
    const hint = stderrLines(author).at(-1) ?? "";
    expect(hint).toContain(
      "The rule cannot run as its author over the mail it would cover (details.author_reason), so sending the write again will not decide them.",
    );
    expect(hint).not.toContain("may stay so");
  });

  it("says how to see why a refused write's made-up emails are undecided, for the tree, the restored version or the samples it sent", async () => {
    const hintFor = async (argv: string[]) => {
      refusedWith({ undecided_samples: [0] });
      const result = await run("email-rules:update-email-rule", [
        RULE,
        ...argv,
        "--fail-on-expectations",
      ]);
      expect(result.exitCode).toBe(1);
      return stderrLines(result).at(-1) ?? "";
    };
    expect(
      await hintFor([
        "--raw-body",
        JSON.stringify({
          tree: { version: 1, vocabulary: "v1", when: { all: [] } },
          english: "e",
        }),
      ]),
    ).toContain(
      "To see why, test the tree this write sent on each with `primitive email-rules test-email-rule-on-sample`.",
    );
    expect(await hintFor(["--restore-version", "2"])).toContain(
      `To see why, test version 2's tree (\`primitive email-rules list-email-rule-versions ${RULE} --versions 2\`) on each with \`primitive email-rules test-email-rule-on-sample\`.`,
    );
    expect(
      await hintFor([
        "--add-expectation-samples-file",
        tempFile("samples.json", JSON.stringify(samples)),
      ]),
    ).toContain(
      `To see why, test rule ${RULE} on each with \`primitive email-rules test-email-rule-on-sample\` (\`primitive email-rules get-email-rule ${RULE}\` lists its saved ones).`,
    );
  });

  it("names an added sample by its number in the file once the answer lists the rule's samples", async () => {
    const saved = (subject: string, id: string) => ({
      id,
      created_at: "2026-11-10T00:00:00Z",
      ...sample(subject),
    });
    answer({
      ...written,
      expectation_samples: [
        saved("kept", "00000000-0000-4000-8000-0000000000c1"),
        saved("two", "00000000-0000-4000-8000-0000000000c2"),
      ],
      expectations_check: {
        version: 1,
        passed: null,
        decided: false,
        failed: [],
        undecided: [],
        failed_samples: [],
        undecided_samples: [0, 1],
      },
    });
    const result = await run("email-rules:update-email-rule", [
      RULE,
      "--add-expectation-samples-file",
      tempFile("samples.json", JSON.stringify(samples)),
      "--pick",
      "2",
    ]);
    expect(stderrLines(result)).toContain(
      `Expectations on version 1: none failed, 2 made-up emails not judged by this write (saved sample 1 ("medical: kept"), sample 2 ("medical: two")). To decide the rest, run \`primitive email-rules test-email-rule --rule-id ${RULE}\`.`,
    );
  });
});

describe("email-rules update-email-rule: 409 version_moved", () => {
  const conflict = {
    success: false,
    error: {
      code: "email_rule_conflict",
      message: "The rule changed since you read it.",
      details: { reason: "version_moved", current_version: 7 },
    },
  };
  const hint = `Hint: the rule's current version is 7, not the if_version you sent, so nothing was saved. Read it again with \`primitive email-rules get-email-rule ${RULE}\` and reapply your change to what it shows, then retry with --if-version 7.`;

  it("names the current version and how to read the rule again", async () => {
    responder = () => jsonResponse(409, conflict);
    const result = await run("email-rules:update-email-rule", [
      RULE,
      "--if-version",
      "5",
      "--name",
      "renamed",
    ]);
    expect(result.exitCode).toBe(1);
    expect(stderrLines(result).at(-1)).toBe(hint);
  });

  it("puts the hint in the --json document's warnings", async () => {
    responder = () => jsonResponse(409, conflict);
    const result = await run("email-rules:update-email-rule", [
      RULE,
      "--if-version",
      "5",
      "--name",
      "renamed",
      "--json",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.merged)).toEqual({
      error: conflict.error,
      exit_code: 1,
      warnings: [hint],
    });
  });

  it("gives no hint for another conflict", () => {
    const hintFor = OPERATION_ERROR_HINTS.updateEmailRule;
    expect(
      hintFor?.(
        "email_rule_conflict",
        {},
        { code: "email_rule_conflict", details: { reason: "other" } },
        { id: RULE },
      ),
    ).toBeUndefined();
    expect(
      hintFor?.("email_rule_scope_locked", {}, conflict.error, { id: RULE }),
    ).toBeUndefined();
  });

  it("says the answer gave no current version when current_version is null", async () => {
    responder = () =>
      jsonResponse(409, {
        success: false,
        error: {
          ...conflict.error,
          details: { reason: "version_moved", current_version: null },
        },
      });
    const result = await run("email-rules:update-email-rule", [
      RULE,
      "--if-version",
      "5",
      "--name",
      "renamed",
    ]);
    expect(result.exitCode).toBe(1);
    const last = stderrLines(result).at(-1);
    expect(last).toBe(
      `Hint: the rule's version is not the if_version you sent, so nothing was saved, and the answer did not give its current version. Read it again with \`primitive email-rules get-email-rule ${RULE}\` and reapply your change to what it shows.`,
    );
    expect(last).not.toContain("--if-version");
  });
});

describe("email-rules update-email-rule: the server's write guards", () => {
  const written = {
    id: RULE,
    name: "Cold outreach",
    state: "observe",
    current_version: 5,
    author_user_id: "00000000-0000-4000-8000-0000000000f1",
    is_author: true,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-10T00:00:00Z",
    current: null,
  };
  const refusal = (code: string, details: unknown) => ({
    success: false,
    error: { code, message: `Refused: ${code}.`, details },
  });
  const sentBody = () => calls.find((call) => call.method === "PATCH")?.body;

  it("--fail-on-expectations sends if_expectations_pass, over the body", async () => {
    answer(written);
    await run("email-rules:update-email-rule", [
      RULE,
      "--raw-body",
      JSON.stringify({ state: "active", if_expectations_pass: false }),
      "--fail-on-expectations",
    ]);
    expect(sentBody()).toEqual({ state: "active", if_expectations_pass: true });
    calls = [];
    await run("email-rules:update-email-rule", [RULE, "--state", "active"]);
    expect(sentBody()).toEqual({ state: "active" });
  });

  it("refuses --fail-on-expectations with --no-if-expectations-pass, sending nothing", async () => {
    answer(written);
    const result = await run("email-rules:update-email-rule", [
      RULE,
      "--state",
      "active",
      "--fail-on-expectations",
      "--no-if-expectations-pass",
    ]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--no-if-expectations-pass");
    expect(calls).toEqual([]);
  });

  it("exits 1 when an expectation failed and nothing was saved, naming them", async () => {
    responder = () =>
      jsonResponse(
        409,
        refusal("expectations_failed", {
          current_version: 5,
          state: "observe",
          expectations_check: {
            version: null,
            passed: false,
            decided: true,
            failed: [A],
            undecided: [],
          },
        }),
      );
    const result = await run("email-rules:update-email-rule", [
      RULE,
      "--state",
      "active",
      "--fail-on-expectations",
    ]);
    expect(result.exitCode).toBe(1);
    expect(stderrLines(result).at(-1)).toBe(
      `Hint: the rule, as this write would leave it, was judged against its expectations before saving (if_expectations_pass), and nothing was saved. Expectations failed: ${A}. The command exits 1.`,
    );
  });

  it("exits 3 when one is undecided, under --json too", async () => {
    const body = refusal("expectations_undecided", {
      reason: "deadline",
      current_version: 5,
      state: "observe",
      expectations_check: {
        version: null,
        passed: null,
        decided: false,
        failed: [],
        undecided: [B],
      },
    });
    responder = () => jsonResponse(409, body);
    const result = await run("email-rules:update-email-rule", [
      RULE,
      "--state",
      "active",
      "--fail-on-expectations",
      "--json",
    ]);
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.merged)).toEqual({
      error: body.error,
      exit_code: 3,
      warnings: [
        `Hint: the rule, as this write would leave it, was judged against its expectations before saving (if_expectations_pass), and nothing was saved. Expectations undecided: ${B}. The judgment ran out of time; send the write again. The command exits 3.`,
      ],
    });
  });

  it("exits 1 when the rule cannot run as its author, since trying again will not decide it", async () => {
    responder = () =>
      jsonResponse(
        409,
        refusal("expectations_undecided", {
          reason: "author_unresolvable",
          author_reason: "membership_ended",
          current_version: 5,
          state: "observe",
          expectations_check: {
            version: null,
            passed: null,
            decided: false,
            failed: [],
            undecided: [B],
          },
        }),
      );
    const result = await run("email-rules:update-email-rule", [
      RULE,
      "--state",
      "active",
      "--fail-on-expectations",
    ]);
    expect(result.exitCode).toBe(1);
    expect(stderrLines(result).at(-1)).toBe(
      `Hint: the rule, as this write would leave it, was judged against its expectations before saving (if_expectations_pass), and nothing was saved. Expectations undecided: ${B}. The rule cannot run as its author over the mail it would cover (details.author_reason), so sending the write again will not decide them. The command exits 1.`,
    );
  });

  it("exits 1 when an expectation names an email the rule cannot read, since sending again never decides it", async () => {
    const body = refusal("expectations_unreadable", {
      current_version: 5,
      state: "observe",
      unreadable: [C],
      expectations_check: {
        version: null,
        passed: null,
        decided: false,
        failed: [],
        undecided: [C],
      },
    });
    responder = () => jsonResponse(409, body);
    const result = await run("email-rules:update-email-rule", [
      RULE,
      "--state",
      "active",
      "--fail-on-expectations",
    ]);
    expect(result.exitCode).toBe(1);
    expect(stderrLines(result).at(-1)).toBe(
      `Hint: the rule, as this write would leave it, was judged against its expectations before saving (if_expectations_pass), and nothing was saved. Some expectations name emails this rule cannot read (deleted, or outside its scope or its author's mail): ${C}. Sending the write again will not decide them: send --expectations-file without them, or a scope that reads them. The command exits 1.`,
    );
    // Under --json too: never the retry-later 3.
    const json = await run("email-rules:update-email-rule", [
      RULE,
      "--state",
      "active",
      "--fail-on-expectations",
      "--json",
    ]);
    expect(json.exitCode).toBe(1);
    expect(JSON.parse(json.merged)).toMatchObject({
      error: body.error,
      exit_code: 1,
    });
  });

  it("exits 1 with how to give the rule expectations when it has none", async () => {
    responder = () =>
      jsonResponse(
        400,
        refusal("no_expectations", {
          current_version: 5,
          state: "observe",
        }),
      );
    const result = await run("email-rules:update-email-rule", [
      RULE,
      "--state",
      "active",
      "--fail-on-expectations",
    ]);
    expect(result.exitCode).toBe(1);
    expect(stderrLines(result).at(-1)).toBe(
      "Hint: nothing was saved. Give the rule expectations with --expectations-file or made-up emails with --expectation-samples-file or --add-expectation-samples-file (in this write or before it), or send the write without if_expectations_pass (--fail-on-expectations or --if-expectations-pass).",
    );
  });

  it("explains each conflict reason", () => {
    const hintFor = OPERATION_ERROR_HINTS.updateEmailRule;
    const conflict = (details: unknown) => ({
      code: "email_rule_conflict",
      details,
    });
    const read = `Read it again with \`primitive email-rules get-email-rule ${RULE}\` and send the write again`;
    expect(
      hintFor?.(
        "email_rule_conflict",
        {},
        conflict({ reason: "revision_moved", current_revision: 9 }),
        { id: RULE },
      ),
    ).toBe(
      `Hint: the rule is now at revision 9, not the if_revision you sent, so nothing was saved. ${read}, reapplying your change to what it shows, with --if-revision 9.`,
    );
    expect(
      hintFor?.(
        "email_rule_conflict",
        {},
        conflict({ reason: "revision_moved" }),
        { id: RULE },
      ),
    ).toBe(
      `Hint: the rule was updated since the if_revision you sent, so nothing was saved. ${read} with --if-revision set to its revision.`,
    );
    expect(
      hintFor?.(
        "email_rule_conflict",
        {},
        conflict({ reason: "expectations_moved" }),
        { id: RULE },
      ),
    ).toBe(
      `Hint: the rule's saved expectations changed while this write was checked against them, so nothing was saved. ${read}.`,
    );
    expect(
      hintFor?.(
        "email_rule_conflict",
        { if_expectations_pass: true },
        conflict({ reason: "rule_changed" }),
        { id: RULE },
      ),
    ).toBe(
      `Hint: the rule changed after this write was judged against its expectations and before it was saved, so saving it would have gone unchecked; nothing was saved. ${read}.`,
    );
    expect(
      hintFor?.(
        "email_rule_conflict",
        {},
        conflict({ reason: "rule_changed" }),
        { id: RULE },
      ),
    ).toBe(
      `Hint: the rule changed while this write was being saved, so nothing was saved. ${read}.`,
    );
  });

  it("sends --if-revision and --restore-version as numbers", async () => {
    answer(written);
    await run("email-rules:update-email-rule", [
      RULE,
      "--restore-version",
      "3",
      "--if-revision",
      "12",
    ]);
    expect(sentBody()).toEqual({ restore_version: 3, if_revision: 12 });
  });

  it("says what a restore saved and whom a new version reaches", async () => {
    answer({
      ...written,
      current_version: 6,
      restored_from: {
        version: 3,
        note: "The scope is not part of a version: the rule keeps its own.",
      },
      affects: { keys: 2, endpoints: 1, shares_ended: 0 },
      expectations_check: {
        version: 6,
        passed: false,
        decided: true,
        failed: [A],
        undecided: [],
        note: "It was saved anyway and is current; the rule is in observe, so it is not live.",
      },
    });
    const result = await run("email-rules:update-email-rule", [
      RULE,
      "--restore-version",
      "3",
    ]);
    expect(result.exitCode).toBe(0);
    expect(stderrLines(result)).toEqual([
      "Saved version 3 again as version 6, now current. The scope is not part of a version: the rule keeps its own.",
      "This version reaches 2 API keys listing the rule and 1 webhook those keys own; it ended 0 shares. The rule keeps its state.",
      `Expectations on version 6: 1 failed (${A}). It was saved anyway and is current; the rule is in observe, so it is not live.`,
    ]);
  });
});

describe("email-rules compile-email-rule and get-email-rule reports", () => {
  it("prints each compile warning before the breadth", async () => {
    answer({
      tree: { version: 1, vocabulary: "v1", when: { all: [] } },
      explanation: "Invoices from Acme.",
      assumptions: [],
      warnings: [
        "The description names Acme but gives no domain, so the sender is judged by sender_relationship alone.",
        "  ",
      ],
      breadth: { checked: 20, matched: 3 },
    });
    const result = await run("email-rules:compile-email-rule", [
      "--english",
      "invoices from Acme",
    ]);
    expect(result.exitCode).toBe(0);
    expect(stderrLines(result)).toEqual([
      "Warning: The description names Acme but gives no domain, so the sender is judged by sender_relationship alone.",
      "Breadth: its conditions hold for 3 of 20 recent emails checked in your own mailboxes, whatever scope you save it with.",
    ]);
  });

  it("prints the warnings with no breadth, and nothing under --json", async () => {
    answer({
      tree: { version: 1, vocabulary: "v1", when: { all: [] } },
      explanation: "Invoices from Acme.",
      assumptions: [],
      warnings: ["A grant worded as a prohibition."],
      breadth: null,
    });
    const plain = await run("email-rules:compile-email-rule", [
      "--english",
      "invoices",
    ]);
    expect(stderrLines(plain)).toEqual([
      "Warning: A grant worded as a prohibition.",
    ]);
    const quiet = await run("email-rules:compile-email-rule", [
      "--english",
      "invoices",
      "--json",
    ]);
    expect(quiet.exitCode).toBe(0);
    expect(quiet.stderr).toBe("");
  });

  it("prints a protective rule's protection_note on create, get and list", async () => {
    const rule = {
      id: RULE,
      name: "Never share medical mail",
      state: "observe",
      kind: "do_not_share",
      protection_note: "It protects nothing yet: it is not active.",
      current_version: 1,
      author_user_id: "00000000-0000-4000-8000-0000000000f1",
      is_author: true,
      created_at: "2026-11-01T00:00:00Z",
      updated_at: "2026-11-10T00:00:00Z",
      current: null,
    };
    answer(rule);
    const created = await run("email-rules:create-email-rule", [
      "--raw-body",
      JSON.stringify({
        tree: { version: 1, vocabulary: "v1", when: { all: [] } },
        name: "Never share medical mail",
        english: "medical mail",
        kind: "do_not_share",
      }),
    ]);
    expect(created.exitCode).toBe(0);
    expect(stderrLines(created).slice(0, 2)).toEqual([
      "This rule blocks sharing (kind do_not_share): while it is active, no rule shares an email it matches.",
      "Protection: It protects nothing yet: it is not active.",
    ]);
    const updated = await run("email-rules:update-email-rule", [
      RULE,
      "--name",
      "Never share medical mail",
    ]);
    expect(stderrLines(updated)).toContain(
      "Protection: It protects nothing yet: it is not active.",
    );
    const got = await run("email-rules:get-email-rule", [RULE]);
    expect(stderrLines(got)).toContain(
      "Protection: It protects nothing yet: it is not active.",
    );
    answer([
      rule,
      {
        ...rule,
        id: B,
        name: "Other",
        kind: "grant",
        protection_note: undefined,
      },
    ]);
    const listed = await run("email-rules:list-email-rules", []);
    expect(listed.exitCode).toBe(0);
    expect(stderrLines(listed)).toEqual([
      `Protection of ${RULE} (Never share medical mail): It protects nothing yet: it is not active.`,
    ]);
    const quiet = await run("email-rules:list-email-rules", ["--json"]);
    expect(quiet.stderr).toBe("");
    // An older server sends no note: the earlier wording.
    answer({ ...rule, protection_note: undefined });
    const older = await run("email-rules:create-email-rule", [
      "--raw-body",
      JSON.stringify({
        tree: { version: 1, vocabulary: "v1", when: { all: [] } },
        name: "n",
        english: "e",
        kind: "do_not_share",
      }),
    ]);
    expect(stderrLines(older)[0]).toBe(
      "This rule blocks sharing (kind do_not_share): while it is active, no rule shares an email it matches. It blocks nothing until it is active.",
    );
  });

  it("creates a do-not-share rule active with --state active", async () => {
    answer({ id: RULE, name: "n", state: "active", kind: "do_not_share" });
    const result = await run("email-rules:create-email-rule", [
      "--raw-body",
      JSON.stringify({
        tree: { version: 1, vocabulary: "v1", when: { all: [] } },
        name: "n",
        english: "e",
        kind: "do_not_share",
      }),
      "--state",
      "active",
    ]);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(calls[0]?.body).toMatchObject({ state: "active" });
  });

  it("says how many recent emails a compiled rule holds for, and nothing when not counted", async () => {
    answer({
      tree: { version: 1, vocabulary: "v1", when: { all: [] } },
      explanation: "Invoices.",
      assumptions: [],
      warnings: [],
      breadth: { checked: 200, matched: 52 },
    });
    const counted = await run("email-rules:compile-email-rule", [
      "--english",
      "invoices",
    ]);
    expect(stderrLines(counted)).toEqual([
      "Breadth: its conditions hold for 52 of 200 recent emails checked in your own mailboxes, whatever scope you save it with.",
    ]);
    answer({
      tree: { version: 1, vocabulary: "v1", when: { all: [] } },
      explanation: "Invoices.",
      assumptions: [],
      warnings: [],
      breadth: null,
    });
    const uncounted = await run("email-rules:compile-email-rule", [
      "--english",
      "invoices",
    ]);
    expect(uncounted.stderr).toBe("");
  });

  it("names the author and the revision to guard an update with", async () => {
    const rule = {
      id: RULE,
      name: "Cold outreach",
      state: "observe",
      current_version: 5,
      revision: 12,
      author_user_id: "00000000-0000-4000-8000-0000000000f1",
      author: {
        user_id: "00000000-0000-4000-8000-0000000000f1",
        name: "Dana Ruiz",
        email: "dana@yuuja.example",
      },
      is_author: false,
      created_at: "2026-11-01T00:00:00Z",
      updated_at: "2026-11-10T00:00:00Z",
      current: null,
    };
    answer(rule);
    const result = await run("email-rules:get-email-rule", [RULE]);
    expect(stderrLines(result)).toEqual([
      "Author: Dana Ruiz <dana@yuuja.example>",
      "Revision 12: pass --if-revision 12 to update-email-rule so a change made since is never replaced unseen.",
    ]);
    answer({ ...rule, author: { ...rule.author, name: null, email: null } });
    const hidden = await run("email-rules:get-email-rule", [RULE]);
    expect(stderrLines(hidden)[0]).toBe(
      "Author: user 00000000-0000-4000-8000-0000000000f1 (name and email not shown to you)",
    );
    const json = await run("email-rules:get-email-rule", [RULE, "--json"]);
    expect(json.stderr).toBe("");
  });
});

describe("email-rules get-email-rule-scope", () => {
  const scope = {
    evaluation_scope: "selected",
    scope_selection: { addresses: [], domains: ["typo.example"] },
    locked: false,
    author_reach: "organization",
    no_longer_readable: { addresses: [], domains: [] },
    stopped_reason: null,
    scope_warnings: [
      {
        name: "typo.example",
        kind: "domain",
        reason: "unknown_domain",
        message: "typo.example is none of the organization's domains.",
      },
    ],
    reads_nothing: true,
  };

  it("prints scope warnings and a reads_nothing line on stderr", async () => {
    answer(scope);
    const result = await run("email-rules:get-email-rule-scope", [RULE]);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(scope);
    expect(stderrLines(result)).toEqual([
      "Scope warning: typo.example is none of the organization's domains.",
      "This rule reads no mail now: it cannot run as its author, or everything its scope names is at none of the organization's domains or no longer read.",
    ]);
  });

  it("names a warning whose message is not text by its name and reason, without breaking the report", async () => {
    answer({
      ...scope,
      reads_nothing: false,
      scope_warnings: [
        {
          name: "typo.example",
          kind: "domain",
          reason: "unknown_domain",
          message: 42,
        },
      ],
    });
    const result = await run("email-rules:get-email-rule-scope", [RULE]);
    expect(result.exitCode).toBe(0);
    expect(stderrLines(result)).toEqual([
      "Scope warning: typo.example (unknown_domain)",
    ]);
    expect(result.stderr).not.toContain("could not be built");
  });

  it("prints nothing extra when it reads mail, or under --json", async () => {
    answer({ ...scope, scope_warnings: undefined, reads_nothing: false });
    expect((await run("email-rules:get-email-rule-scope", [RULE])).stderr).toBe(
      "",
    );
    answer(scope);
    const json = await run("email-rules:get-email-rule-scope", [
      RULE,
      "--json",
    ]);
    expect(json.stderr).toBe("");
    expect(JSON.parse(json.merged)).toEqual(scope);
  });
});

describe("emails facts", () => {
  const classification: NonNullable<
    ListEmailRuleResultsResult["classification"]
  > = {
    id: "00000000-0000-4000-8000-0000000000c1",
    vocabulary: "v1",
    classified_at: "2026-11-10T00:00:00Z",
    facts: {
      is_cold_outreach: { value: true, confidence: 0.69 },
      topics: { value: ["billing", "invoice"], confidence: 0.8 },
      sender_role: { value: null, confidence: null },
      language: { value: "en", confidence: 0.99 },
    },
  };
  const results = (
    value: ListEmailRuleResultsResult["classification"],
    rules: ListEmailRuleResultsResult["rules"] = [],
  ): ListEmailRuleResultsResult => ({
    rules,
    hidden: 0,
    classification: value,
  });

  it("is registered under emails and named in the topic", () => {
    expect(COMMANDS["emails:facts"]).toBeDefined();
    const packageJson = JSON.parse(
      readFileSync(join(CLI_ROOT, "package.json"), "utf8"),
    ) as { oclif: { topics: Record<string, { description: string }> } };
    expect(packageJson.oclif.topics.emails?.description).toContain(
      "`primitive emails facts`",
    );
  });

  it("prints one line per fact from the email's rule results", async () => {
    answer(results(classification));
    for (const argv of [[A], ["--id", A]]) {
      calls = [];
      const result = await run("emails:facts", argv);
      expect(result.exitCode, result.stderr).toBe(0);
      expect(calls.map((call) => [call.method, call.url.pathname])).toEqual([
        ["GET", `/v1/emails/${A}/rule-results`],
      ]);
      expect(result.stdout).toBe(
        [
          "is_cold_outreach: true at 0.69",
          "topics: [billing, invoice] at 0.80",
          "sender_role: null",
          "language: en at 0.99",
          "",
        ].join("\n"),
      );
      expect(result.stderr).toBe("");
    }
  });

  it("prints the classification object with --json", async () => {
    answer(results(classification));
    const result = await run("emails:facts", [A, "--json"]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.merged)).toEqual(classification);
  });

  it("says why when there is no classification", async () => {
    answer(results(null));
    const none = await run("emails:facts", [A]);
    expect(none.exitCode).toBe(0);
    expect(none.stdout).toBe("");
    expect(none.stderr).toContain("No classification for this email yet.");

    answer(
      results(null, [
        {
          id: RULE,
          name: "r",
          state: "observe",
          not_run_reason: null,
          decision: {
            rule_version: 1,
            matched: false,
            parts: [],
            question_answers: [],
            tree: null,
            detail_withheld: true,
            created_at: "2026-11-10T00:00:00Z",
          },
        },
      ]),
    );
    const withheld = await run("emails:facts", [A]);
    expect(withheld.stderr).toContain("this email's content cannot be read");

    answer(results(null));
    const json = await run("emails:facts", [A, "--json"]);
    expect(json.exitCode).toBe(0);
    expect(json.stderr).toBe("");
    expect(JSON.parse(json.merged)).toBeNull();
  });

  it("refuses a missing, malformed or doubled id before any request", async () => {
    for (const [argv, message] of [
      [[], "Missing the id"],
      [["not-an-id"], "must be a received email's UUID"],
      [[A, "--id", B], "Give the id once"],
    ] as const) {
      const result = await run("emails:facts", [...argv]);
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain(message);
    }
    expect(calls).toEqual([]);
  });

  it("fails with the API's error", async () => {
    responder = () =>
      jsonResponse(404, {
        success: false,
        error: { code: "not_found", message: "No such email" },
      });
    const result = await run("emails:facts", [A]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('"code": "not_found"');
  });

  describe("for a credential that cannot read rule results", () => {
    const refused = (reason: string) =>
      jsonResponse(403, {
        success: false,
        error: {
          code: "forbidden",
          message: "Email rules are written by organization members.",
          details: { reason },
        },
      });
    /** Rule results refuse the credential; the email read answers `understanding`. */
    const keyReading = (
      understanding: unknown,
      reason = "rule_author_credential",
    ) => {
      responder = (url) =>
        url.pathname.endsWith("/rule-results")
          ? refused(reason)
          : jsonResponse(200, {
              success: true,
              data: {
                id: A,
                ...(understanding === undefined ? {} : { understanding }),
              },
            });
    };
    const ready = {
      version: 1,
      status: "ready",
      classification_id: "00000000-0000-4000-8000-0000000000c1",
      vocabulary: "v1",
      classified_at: "2026-11-10T00:00:00Z",
      facts: {
        is_cold_outreach: { value: true, confidence: 0.69 },
        topics: { value: ["Billing"], confidence: 0.8 },
      },
    };
    const note = `This credential cannot read email rule results, so these facts come from the email itself (\`primitive emails get ${A} --json\`, understanding.facts), as the classifier wrote them. Rule conditions read a multi fact's options lowercased, and a fact left out here reads null to them.`;

    it("reads the facts from the email itself and says so", async () => {
      for (const reason of ["rule_author_credential", "narrowed_credential"]) {
        keyReading(ready, reason);
        calls = [];
        const result = await run("emails:facts", [A]);
        expect(result.exitCode, result.stderr).toBe(0);
        expect(calls.map((call) => [call.method, call.url.pathname])).toEqual([
          ["GET", `/v1/emails/${A}/rule-results`],
          ["GET", `/v1/emails/${A}`],
        ]);
        expect(result.stdout).toBe(
          "is_cold_outreach: true at 0.69\ntopics: [Billing] at 0.80\n",
        );
        expect(result.stderr).toBe(`${note}\n`);
      }
    });

    it("prints the same classification shape with --json, the note in warnings", async () => {
      keyReading(ready);
      const result = await run("emails:facts", [A, "--json"]);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(JSON.parse(result.merged)).toEqual({
        id: ready.classification_id,
        vocabulary: "v1",
        classified_at: "2026-11-10T00:00:00Z",
        facts: ready.facts,
        warnings: [note],
      });
    });

    it("says why when the email carries no ready facts", async () => {
      for (const [understanding, message] of [
        [{ version: 1, status: "pending" }, "it has not been classified"],
        [{ version: 1, status: "unavailable" }, "was not classified in time"],
        [{ version: 1, status: "later" }, "the email's understanding is later"],
        [null, "the email read carries no facts"],
        [undefined, "the email read carries no facts"],
      ] as const) {
        keyReading(understanding);
        const result = await run("emails:facts", [A]);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toBe("");
        expect(result.stderr).toContain(message);
        expect(result.stderr).not.toContain("cannot read email rule results");

        const json = await run("emails:facts", [A, "--json"]);
        expect(json.exitCode).toBe(0);
        expect(JSON.parse(json.merged)).toBeNull();
      }
    });

    it("fails with the email read's error", async () => {
      responder = (url) =>
        url.pathname.endsWith("/rule-results")
          ? refused("rule_author_credential")
          : jsonResponse(404, {
              success: false,
              error: { code: "not_found", message: "No such email" },
            });
      const result = await run("emails:facts", [A]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(
        "This credential cannot read email rule results, and reading the facts from the email itself failed:",
      );
      expect(result.stderr).toContain('"code": "not_found"');

      const json = await run("emails:facts", [A, "--json"]);
      expect(json.exitCode).toBe(1);
      expect(json.stderr).toBe("");
      expect(JSON.parse(json.merged)).toMatchObject({
        error: { code: "not_found" },
        exit_code: 1,
        warnings: [
          "This credential cannot read email rule results, and reading the facts from the email itself failed:",
        ],
      });
    });

    it("says a ready classification with no facts has none", async () => {
      keyReading({ ...ready, facts: {} });
      const result = await run("emails:facts", [A]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe(
        `${note}\nThis email's classification has no facts.\n`,
      );
    });

    it("does not fall back for any other refusal", async () => {
      for (const error of [
        {
          code: "grant_forbidden",
          message: "Email rules need mail:read.",
          details: { reason: "permission", permission: "mail:read" },
        },
        { code: "forbidden", message: "No.", details: { reason: "other" } },
        { code: "forbidden", message: "No." },
      ]) {
        responder = () => jsonResponse(403, { success: false, error });
        calls = [];
        const result = await run("emails:facts", [A]);
        expect(result.exitCode).toBe(1);
        expect(calls).toHaveLength(1);
        expect(result.stderr).toContain(`"code": "${error.code}"`);
        expect(result.stderr).not.toContain("cannot read email rule results");
      }
    });
  });
});

describe("formatFact", () => {
  it("renders values as rule conditions read them", () => {
    expect(formatFact("score", { value: 4, confidence: 1 })).toBe(
      "score: 4 at 1.00",
    );
    expect(formatFact("tags", { value: [], confidence: 0.5 })).toBe(
      "tags: [] at 0.50",
    );
    expect(formatFact("tags", { value: ["a", "b"] })).toBe("tags: [a, b]");
  });
});

describe("end-email-rule-share", () => {
  it("prints the answer's note, that the rule itself is left as it was, and nothing without one", () => {
    const note =
      "The share is ended. The rule itself is unchanged: it is still active and decides your mail. Set it to draft or delete it to stop it.";
    expect(
      endEmailRuleShareReport({ ended: true, rule_id: RULE, note }),
    ).toEqual({ lines: [note] });
    expect(endEmailRuleShareReport({ ended: true })).toEqual({ lines: [] });
    expect(endEmailRuleShareReport(null)).toEqual({ lines: [] });
    // The generated command reports it.
    expect(OPERATION_EXTENSIONS.endEmailRuleShare?.report).toBe(
      endEmailRuleShareReport,
    );
  });
});
