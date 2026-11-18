import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { TestEmailRuleResult } from "@primitivedotdev/api-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OPERATION_EXTENSIONS,
  overLongBodyField,
} from "../../src/oclif/api-command.js";
import {
  answerConfidence,
  changesLines,
  expectationsOutcome,
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
    rule: {
      id: RULE,
      version: 3,
      vocabulary: "v1",
      kind: "grant",
      warnings: [],
    },
    window: {
      mode: "recent",
      since: "2026-10-11T00:00:00Z",
      limit: 198,
      oldest_at: null,
      newest_at: null,
    },
    counts: {
      emails: 4,
      matched: 1,
      near_miss: 1,
      no_match: 1,
      unclassified: 1,
      skipped: 0,
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
            confidence: 0.81,
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
  counts: { passed: 1, failed: 1, undecided: 1, close_calls: 0 },
  results: [
    {
      email_id: A,
      expected: "match",
      outcome: "matched",
      status: "passed",
      close_call: false,
    },
    {
      email_id: B,
      expected: "match",
      outcome: "no_match",
      status: "failed",
      close_call: false,
    },
    {
      close_call: false,
      email_id: D,
      expected: "no_match",
      outcome: "unclassified",
      status: "undecided",
      reason: "unclassified",
      retryable: true,
    },
  ],
};

const UNDECIDED_EXPECTATIONS: TestEmailRuleResult["expectations"] = {
  passed: false,
  counts: { passed: 1, failed: 0, undecided: 1, close_calls: 0 },
  results: [
    {
      email_id: A,
      expected: "match",
      outcome: "matched",
      status: "passed",
      close_call: false,
    },
    {
      close_call: false,
      email_id: D,
      expected: "no_match",
      outcome: "unclassified",
      status: "undecided",
      reason: "unclassified",
      retryable: true,
    },
  ],
};

const PASSED_EXPECTATIONS: TestEmailRuleResult["expectations"] = {
  passed: true,
  counts: { passed: 2, failed: 0, undecided: 0, close_calls: 0 },
  results: [
    {
      email_id: A,
      expected: "match",
      outcome: "matched",
      status: "passed",
      close_call: false,
    },
    {
      close_call: false,
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

describe("email-rules test: expectations from flags", () => {
  it("adds --expect-match, --expect-no-match and --expect-file", () => {
    const flags = (COMMANDS["email-rules:test"] as unknown as Runnable).flags;
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
      COMMANDS["email-rules:test"] as unknown as {
        description: string;
      }
    ).description;
    const rawBodyOnly = description.slice(
      description.indexOf("Body fields requiring --raw-body JSON"),
    );
    expect(rawBodyOnly).toMatch(/^ {3}tree\b/m);
    expect(rawBodyOnly).not.toMatch(/^ {3}expect\b/m);
    for (const text of [
      "without it, a saved rule's own expectations are judged",
      "1 when one failed or is undecided for good (or the request failed)",
      "3 when the only ones not passed can be decided by testing again later",
      "error.code is expectations_failed or expectations_undecided",
    ])
      expect(description).toContain(text);
    for (const id of ["email-rules:create", "email-rules:update"]) {
      const text = (COMMANDS[id] as unknown as { description: string })
        .description;
      expect(text, id).not.toMatch(/^ {2,3}expectations\b/m);
    }
  });

  it("says in its flag help which report judges expectations: expectations on a test, the gate on a write", () => {
    const flags = (id: string) =>
      (
        COMMANDS[id] as unknown as {
          flags: Record<string, { description?: string }>;
        }
      ).flags;
    for (const flag of ["expect-match", "expect-no-match"]) {
      const text = flags("email-rules:test")[flag]?.description ?? "";
      expect(text, flag).toContain(
        "Replaces any expect in --body-file or --raw-body.",
      );
    }
    expect(
      flags("email-rules:create")["expectations-file"]?.description,
    ).toContain(
      "A create judges them before saving only for a do_not_share rule created active, in expectations_check (passed, failed, undecided)",
    );
    expect(
      flags("email-rules:update")["expectations-file"]?.description,
    ).toContain(
      "refused if one fails or, for a grant rule, cannot be decided; a do_not_share rule is saved with undecided ones",
    );
  });

  it("builds expect from repeated and comma-listed ids, without repeats", async () => {
    answer(testResult());
    const result = await run("email-rules:test", [
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
    await run("email-rules:test", [
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
    const result = await run("email-rules:test", [
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
    const result = await run("email-rules:test", [
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
    [["--expect-match", " , "], "--expect-match needs at least one email id"],
  ])("refuses %j with exit 2 and sends nothing", async (argv, message) => {
    const result = await run("email-rules:test", ["--rule-id", RULE, ...argv]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(message);
    expect(calls).toEqual([]);
  });

  it("refuses an --expect-file that is not a JSON object, or that holds samples, and sends the rest as it is", async () => {
    for (const [content, message] of [
      ["[]", "must hold a JSON object"],
      [JSON.stringify({ samples: [] }), "--expect-samples-file"],
    ] as const) {
      const result = await run("email-rules:test", [
        "--rule-id",
        RULE,
        "--expect-file",
        tempFile("bad.json", content),
      ]);
      expect(result.exitCode, content).toBe(2);
      expect(result.stderr, content).toContain(message);
    }
    expect(calls).toEqual([]);
    answer(testResult());
    await run("email-rules:test", [
      "--rule-id",
      RULE,
      "--expect-file",
      tempFile("odd.json", JSON.stringify({ match: ["x"], no_match: ["x"] })),
    ]);
    expect(calls[0]?.body).toEqual({
      rule_id: RULE,
      expect: { match: ["x"], no_match: ["x"] },
    });
  });

  it("refuses an unreadable or invalid JSON --expect-file as a usage error", async () => {
    for (const [path, message] of [
      [join(tempHome, "missing.json"), "Could not read --expect-file"],
      [tempFile("bad.json", "{"), "is not valid JSON"],
    ] as const) {
      const result = await run("email-rules:test", [
        "--rule-id",
        RULE,
        "--expect-file",
        path,
      ]);
      expect(result.exitCode, path).toBe(2);
      expect(result.stderr, path).toContain(message);
    }
    expect(calls).toEqual([]);
  });

  it("names the expectation flag when --raw-body is not an object", async () => {
    const result = await run("email-rules:test", [
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

describe("email-rules test: exit codes and the stderr report", () => {
  it("exits 1 when an expectation failed and prints the report after the JSON", async () => {
    const data = testResult(FAILED_EXPECTATIONS);
    answer(data);
    const result = await run("email-rules:test", [
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
      "Scope warning: typo.example is none of the organization's domains.",
      "Warning: Most emails failed on condition 1.",
      "Conditions (3 decided):",
      "  0. The sender is not a contact: held on 3, failed on 0 (the only failure on 0)",
      "  1. It is cold outreach: held on 2, failed on 1 (the only failure on 1)",
      "Questions (on emails whose conditions held):",
      '  0. "Is it a sales pitch?": yes 1, no 1, unanswered 0',
      "Expectations: 1 failed, 1 undecided, 1 passed.",
      `  failed: ${B} expected match, got no_match`,
      `  undecided: ${D} expected no_match, got unclassified (unclassified; test again later)`,
      "Matched (1):",
      `  ${A}`,
      "Not matched (3):",
      `  ${B} no_match (failed part 1): sender_known: false; is_cold_outreach: true at 0.69`,
      `  ${D} unclassified (pending)`,
      `  ${C} near_miss: topics: [billing 0.91, invoice 0.62] at 0.80`,
      '    questions (stored): "Is it a sales pitch?" no at 0.81',
    ]);
  });

  it("says how many decided emails the conditions held on together", async () => {
    const data = testResult();
    answer({ ...data, summary: { ...data.summary, conditions_held: 2 } });
    const result = await run("email-rules:test", ["--rule-id", RULE]);
    expect(stderrLines(result)).toContain(
      "Conditions (3 decided; together they held on 2):",
    );
  });

  it("exits 3 when nothing failed but an expectation is undecided", async () => {
    answer(testResult(UNDECIDED_EXPECTATIONS));
    const result = await run("email-rules:test", [
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

  it("exits 1 with expectations_undecided for an email the rule cannot find", async () => {
    const data = withResults([{ email_id: E, outcome: "not_found" }], {
      passed: false,
      counts: { passed: 1, failed: 0, undecided: 1, close_calls: 0 },
      results: [
        {
          close_call: false,
          email_id: A,
          expected: "match",
          outcome: "matched",
          status: "passed",
        },
        {
          close_call: false,
          email_id: E,
          expected: "match",
          outcome: "not_found",
          status: "undecided",
          reason: "not_found",
          retryable: false,
        },
      ],
    });
    answer(data);
    const argv = ["--rule-id", RULE, "--expect-match", `${A},${E}`];
    const result = await run("email-rules:test", argv);
    expect(result.exitCode).toBe(1);
    expect(stderrLines(result)).toContain(
      `  undecided: ${E} expected match, got not_found (not_found; testing again will not decide it)`,
    );
    const json = await run("email-rules:test", [...argv, "--json"]);
    expect(json.exitCode).toBe(1);
    expect(json.stderr).toBe("");
    expect(JSON.parse(json.merged)).toMatchObject({
      error: {
        code: "expectations_undecided",
        message: `1 expectation is undecided, and testing again will not decide this one: ${E} (not_found).`,
      },
      exit_code: 1,
    });
  });

  it("exits 1 with expectations_undecided for an email that cannot be classified", async () => {
    const data = {
      ...testResult({
        ...UNDECIDED_EXPECTATIONS,
        results: (UNDECIDED_EXPECTATIONS?.results ?? []).map((entry) =>
          entry.status === "undecided" ? { ...entry, retryable: false } : entry,
        ),
      }),
      results: testResult().results.map((result) =>
        result.email_id === D
          ? { ...result, unclassified_reason: "not_classifiable" as const }
          : result,
      ),
    };
    answer(data);
    const result = await run("email-rules:test", [
      "--rule-id",
      RULE,
      "--expect-no-match",
      D,
    ]);
    expect(result.exitCode).toBe(1);
    expect(stderrLines(result)).toEqual(
      expect.arrayContaining([
        `  undecided: ${D} expected no_match, got unclassified (unclassified; testing again will not decide it)`,
        `  ${D} unclassified (not_classifiable)`,
      ]),
    );
    const json = await run("email-rules:test", ["--rule-id", RULE, "--json"]);
    expect(json.exitCode).toBe(1);
    expect(JSON.parse(json.merged).error).toEqual({
      code: "expectations_undecided",
      message: `1 expectation is undecided, and testing again will not decide this one: ${D} (unclassified).`,
    });
  });

  it("exits 1 with expectations_undecided for an email that cannot be tested", async () => {
    const data = withResults(
      [{ email_id: E, outcome: "skipped", skipped_reason: "unparsed" }],
      {
        passed: false,
        counts: { passed: 0, failed: 0, undecided: 1, close_calls: 0 },
        results: [
          {
            close_call: false,
            email_id: E,
            expected: "match",
            outcome: "skipped",
            status: "undecided",
            reason: "skipped",
            retryable: false,
          },
        ],
      },
    );
    answer(data);
    const argv = ["--rule-id", RULE, "--expect-match", E];
    const result = await run("email-rules:test", argv);
    expect(result.exitCode).toBe(1);
    expect(stderrLines(result)).toEqual(
      expect.arrayContaining([
        `  undecided: ${E} expected match, got skipped (skipped; testing again will not decide it)`,
        `  ${E} skipped (unparsed)`,
      ]),
    );
    const json = await run("email-rules:test", [...argv, "--json"]);
    expect(json.exitCode).toBe(1);
    expect(JSON.parse(json.merged).error).toEqual({
      code: "expectations_undecided",
      message: `1 expectation is undecided, and testing again will not decide this one: ${E} (skipped).`,
    });
  });

  it("exits 3 only when a later test can decide every undecided one", async () => {
    const data = {
      ...testResult({
        passed: false,
        counts: { passed: 0, failed: 0, undecided: 2, close_calls: 0 },
        results: [
          {
            close_call: false,
            email_id: C,
            expected: "match",
            outcome: "near_miss",
            status: "undecided",
            reason: "unanswered",
            retryable: true,
          },
          {
            close_call: false,
            email_id: D,
            expected: "no_match",
            outcome: "unclassified",
            status: "undecided",
            reason: "unclassified",
            retryable: true,
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
    const result = await run("email-rules:test", ["--rule-id", RULE]);
    expect(result.exitCode).toBe(3);
    expect(stderrLines(result)).toEqual(
      expect.arrayContaining([
        `  undecided: ${C} expected match, got near_miss (unanswered; test again later)`,
        `  undecided: ${D} expected no_match, got unclassified (unclassified; test again later)`,
        `  ${D} unclassified (classifier_unavailable)`,
      ]),
    );
    const json = await run("email-rules:test", ["--rule-id", RULE, "--json"]);
    expect(json.exitCode).toBe(3);
    expect(JSON.parse(json.merged).error).toEqual({
      code: "expectations_undecided",
      message: `2 expectations are undecided: ${C} (unanswered), ${D} (unclassified). Test again later.`,
    });
  });

  it("gives expectations_failed precedence over undecided ones", async () => {
    answer(
      withResults([{ email_id: E, outcome: "not_found" }], {
        passed: false,
        counts: { passed: 0, failed: 1, undecided: 1, close_calls: 0 },
        results: [
          {
            close_call: false,
            email_id: B,
            expected: "match",
            outcome: "no_match",
            status: "failed",
          },
          {
            close_call: false,
            email_id: E,
            expected: "no_match",
            outcome: "not_found",
            status: "undecided",
          },
        ],
      }),
    );
    const result = await run("email-rules:test", ["--rule-id", RULE, "--json"]);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.merged).error).toEqual({
      code: "expectations_failed",
      message: `1 expectation failed: ${B}.`,
    });
  });

  it("follows a saved rule's saved expectations when no expect is sent", async () => {
    answer(testResult(FAILED_EXPECTATIONS));
    const result = await run("email-rules:test", ["--rule-id", RULE]);
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
    const result = await run("email-rules:test", ["--rule-id", RULE]);
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
      const result = await run("email-rules:test", ["--rule-id", RULE]);
      // Fails closed: the expectations did not pass, so it still exits 1.
      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout)).toEqual(data);
      expect(stderrLines(result)).toEqual([
        "Warning: testEmailRule succeeded but its report could not be built (bad answer). The JSON above is the full answer; read it rather than the exit code.",
        "The answer's expectations were not all shown to pass, so the command exits 1.",
      ]);
      const json = await run("email-rules:test", ["--rule-id", RULE, "--json"]);
      expect(json.stderr).toBe("");
      expect(json.exitCode).toBe(1);
      expect(JSON.parse(json.merged)).toEqual({
        success: true,
        data,
        error: {
          code: "expectations_failed",
          message:
            "The answer's expectations were not all shown to pass; read their result in the answer.",
        },
        exit_code: 1,
        warnings: [stderrLines(result)[0]],
      });
      // An answer whose expectations passed keeps exit 0 when the report breaks.
      answer(testResult(PASSED_EXPECTATIONS));
      const passed = await run("email-rules:test", ["--rule-id", RULE]);
      expect(passed.exitCode).toBe(0);
    } finally {
      extension.report = report;
    }
  });

  it("exits 0 when every expectation passed, and without expectations", async () => {
    answer(testResult(PASSED_EXPECTATIONS));
    const passed = await run("email-rules:test", [
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
    const none = await run("email-rules:test", ["--rule-id", RULE]);
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

describe("email-rules test: which mail was tested (--same-emails-as)", () => {
  const windowed = (mode: "recent" | "ids") => ({
    ...testResult(),
    window: {
      mode,
      since: mode === "recent" ? "2026-10-11T00:00:00Z" : null,
      limit: 198,
      oldest_at: "2026-11-12T08:53:50.000Z",
      newest_at: "2026-11-13T10:13:50.000Z",
    },
  });

  it("says first which mail a test covered, and only that", async () => {
    for (const mode of ["recent", "ids"] as const) {
      answer(windowed(mode));
      const result = await run("email-rules:test", ["--rule-id", RULE]);
      expect(stderrLines(result)[0]).toBe(
        "Tested 4 emails received 2026-11-12 08:53 UTC to 2026-11-13 10:13 UTC.",
      );
    }
  });

  it("tests exactly the emails a saved answer tested, as --json printed it or with --envelope", async () => {
    const saved = windowed("recent");
    for (const [name, content] of [
      ["answer.json", saved],
      ["envelope.json", { success: true, data: saved }],
    ] as const) {
      calls.length = 0;
      answer(saved);
      const result = await run("email-rules:test", [
        "--rule-id",
        RULE,
        "--same-emails-as",
        tempFile(name, JSON.stringify(content)),
      ]);
      expect(result.exitCode, result.stderr).not.toBe(2);
      expect(
        (calls[0]?.body as { email_ids?: string[] } | undefined)?.email_ids,
      ).toEqual(saved.results.map((r) => r.email_id));
    }
  });

  it("says nothing of the span without one, and leaves emails not found out of the count", async () => {
    answer(testResult());
    const plain = await run("email-rules:test", ["--rule-id", RULE]);
    expect(stderrLines(plain)[0]).not.toMatch(/^Tested /);
    const withMissing = windowed("recent");
    answer({
      ...withMissing,
      counts: { ...withMissing.counts, emails: 5, not_found: 2 },
    });
    const missing = await run("email-rules:test", ["--rule-id", RULE]);
    expect(stderrLines(missing)[0]).toMatch(/^Tested 3 emails received /);
  });

  it("takes each email once, in lower case, over the body's own email_ids", async () => {
    calls.length = 0;
    answer(windowed("ids"));
    const upper = A.toUpperCase();
    const result = await run("email-rules:test", [
      "--body-file",
      tempFile("body.json", JSON.stringify({ rule_id: RULE, email_ids: [C] })),
      "--same-emails-as",
      tempFile(
        "dupes.json",
        JSON.stringify({
          results: [
            { email_id: upper },
            { email_id: A },
            { email_id: "not-an-id" },
            { email_id: B },
            { outcome: "matched" },
          ],
        }),
      ),
    ]);
    expect(result.exitCode, result.stderr).not.toBe(2);
    expect(
      (calls[0]?.body as { email_ids?: string[] } | undefined)?.email_ids,
    ).toEqual([A.toLowerCase(), B]);
  });

  it("refuses a saved answer that names no emails", async () => {
    calls.length = 0;
    const none = await run("email-rules:test", [
      "--rule-id",
      RULE,
      "--same-emails-as",
      tempFile("none.json", JSON.stringify({ results: [] })),
    ]);
    expect(none.exitCode).toBe(2);
    expect(none.stderr).toContain("names no emails");
    expect(calls).toEqual([]);
  });

  it("refuses a file that is not a saved answer, sending nothing", async () => {
    calls.length = 0;
    const result = await run("email-rules:test", [
      "--rule-id",
      RULE,
      "--same-emails-as",
      tempFile("other.json", JSON.stringify({ rules: [] })),
    ]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(
      "is not a saved test answer: it has no results",
    );
    expect(calls).toEqual([]);
  });
});

describe("email-rules test: the matched emails and their attachments", () => {
  it("lists each matched email with its sender, subject and file names, and a near miss's file names", async () => {
    const data = testResult();
    answer({
      ...data,
      results: [
        {
          email_id: A,
          outcome: "matched",
          parts: [],
          from_address: "billing@kestruvo.example",
          subject: "Invoice NV-118",
          attachment_names: [
            "NV-118.pdf",
            "rates\u001b[31m.xlsx",
            "inv\u202egpj.exe",
          ],
        },
        ...data.results
          .slice(1)
          .map((result) =>
            result.outcome === "near_miss"
              ? { ...result, attachment_names: ["contract.pdf"] }
              : result,
          ),
      ],
    });
    const result = await run("email-rules:test", ["--rule-id", RULE]);
    const lines = stderrLines(result);
    const at = lines.indexOf("Matched (1):");
    expect(lines.slice(at, at + 3)).toEqual([
      "Matched (1):",
      `  ${A} billing@kestruvo.example "Invoice NV-118"`,
      "    attachments: NV-118.pdf, rates.xlsx, invgpj.exe",
    ]);
    expect(lines).toContain("    attachments: contract.pdf");
  });
});

describe("email-rules test --json", () => {
  it("keeps the exit code and states why in one document, with nothing on stderr", async () => {
    const data = testResult(FAILED_EXPECTATIONS);
    answer(data);
    const failed = await run("email-rules:test", [
      "--rule-id",
      RULE,
      "--expect-match",
      B,
      "--json",
    ]);
    expect(failed.exitCode).toBe(1);
    expect(failed.stderr).toBe("");
    expect(JSON.parse(failed.merged)).toEqual({
      success: true,
      data,
      error: {
        code: "expectations_failed",
        message: `1 expectation failed: ${B}.`,
      },
      exit_code: 1,
    });

    answer(testResult(UNDECIDED_EXPECTATIONS));
    const undecided = await run("email-rules:test", [
      "--rule-id",
      RULE,
      "--expect-no-match",
      D,
      "--json",
    ]);
    expect(undecided.exitCode).toBe(3);
    expect(undecided.stderr).toBe("");
    expect(JSON.parse(undecided.merged)).toMatchObject({
      success: true,
      data: { expectations: UNDECIDED_EXPECTATIONS },
      error: {
        code: "expectations_undecided",
        message: `1 expectation is undecided: ${D} (unclassified). Test again later.`,
      },
      exit_code: 3,
    });
  });

  it("prints the response body when the exit code is 0", async () => {
    const data = testResult(PASSED_EXPECTATIONS);
    answer(data);
    const result = await run("email-rules:test", ["--rule-id", RULE, "--json"]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.merged)).toEqual({ success: true, data });
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

describe("email-rules create and update --expectations-file", () => {
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
    const result = await run("email-rules:create", [
      "--raw-body",
      JSON.stringify({ tree, kind: "grant", expectations: { match: [E] } }),
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
      kind: "grant",
      name: "Cold outreach",
      english: "cold outreach",
      expectations: { match: [A], no_match: [B] },
    });
    // The write's report is the server's notes, and this answer has none.
    expect(stderrLines(result)).toEqual([]);
  });

  it("clears saved expectations on update with a null file", async () => {
    answer(written);
    const result = await run("email-rules:update", [
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
    const result = await run("email-rules:update", [
      RULE,
      "--expectations-file",
      tempFile("e.json", JSON.stringify({ match: [B] })),
      "--json",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.merged)).toEqual({ success: true, data });
  });

  it("generates --if-revision, and no --if-version or --explanation, on rule writes", () => {
    const update = (COMMANDS["email-rules:update"] as unknown as Runnable)
      .flags;
    expect(update["if-revision"]?.type).toBe("option");
    expect(update["if-version"]).toBeUndefined();
    for (const id of [
      "email-rules:create",
      "email-rules:update",
      "email-rules:create-request",
      "email-rules:accept-request",
    ])
      expect(
        (COMMANDS[id] as unknown as Runnable).flags.explanation,
        id,
      ).toBeUndefined();
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
    expect(flags("email-rules:create")).toHaveProperty("samples-file");
    expect(flags("email-rules:create").pick?.description).toContain(
      "by their numbers from 1 as generate-look-alikes printed them",
    );
    const update = flags("email-rules:update");
    expect(update["samples-file"]?.exclusive).toEqual(["add-samples-file"]);
    expect(update["add-samples-file"]?.exclusive).toEqual(["samples-file"]);
    expect(
      flags("email-rules:test")["expect-samples-file"]?.exclusive,
    ).toBeUndefined();
  });

  it("sets the picked samples on create, in the order --pick names them", async () => {
    answer(written);
    const result = await run("email-rules:create", [
      "--raw-body",
      JSON.stringify({
        tree,
        kind: "grant",
        expectation_samples: [sample("raw")],
      }),
      "--name",
      "Bills",
      "--english",
      "bills",
      "--samples-file",
      tempFile("samples.json", JSON.stringify(samples)),
      "--pick",
      "3,1",
    ]);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(calls[0]?.body).toEqual({
      tree,
      kind: "grant",
      name: "Bills",
      english: "bills",
      expectation_samples: [samples[2], samples[0]],
    });
  });

  it("adds on update with --add-samples-file, and replaces with --samples-file", async () => {
    answer(written);
    const file = tempFile("samples.json", JSON.stringify(samples));
    const added = await run("email-rules:update", [
      RULE,
      "--add-samples-file",
      file,
      "--pick",
      "2",
    ]);
    expect(added.exitCode, added.stderr).toBe(0);
    expect(calls[0]?.body).toEqual({ add_expectation_samples: [samples[1]] });
    const removed = await run("email-rules:update", [
      RULE,
      "--samples-file",
      tempFile("empty.json", "[]"),
    ]);
    expect(removed.exitCode, removed.stderr).toBe(0);
    expect(calls[1]?.body).toEqual({ expectation_samples: [] });
  });

  it("refuses a --pick number the file does not hold, and --pick without a file, sending nothing", async () => {
    const file = tempFile("samples.json", JSON.stringify(samples));
    const out = await run("email-rules:update", [
      RULE,
      "--add-samples-file",
      file,
      "--pick",
      "2,4",
    ]);
    expect(out.exitCode).toBe(2);
    expect(out.stderr).toContain(
      `--pick 2,4: 4 is not a sample number; --add-samples-file ${file} holds samples 1 to 3.`,
    );
    const alone = await run("email-rules:create", [
      "--raw-body",
      JSON.stringify({ tree, name: "n", english: "e" }),
      "--pick",
      "1",
    ]);
    expect(alone.exitCode).toBe(2);
    expect(alone.stderr).toContain(
      "--pick chooses from a samples file: pass it with --samples-file.",
    );
    const both = await run("email-rules:update", [
      RULE,
      "--add-samples-file",
      file,
      "--samples-file",
      file,
    ]);
    expect(both.exitCode).toBe(2);
    expect(calls).toEqual([]);
  });

  it("tests the picked samples with --expect-samples-file, beside --expect-match", async () => {
    answer(testResult());
    const result = await run("email-rules:test", [
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
    await run("email-rules:test", [
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
    const inFile = await run("email-rules:test", [
      "--rule-id",
      RULE,
      "--expect-file",
      tempFile("expect2.json", JSON.stringify({ samples })),
    ]);
    expect(inFile.exitCode).toBe(2);
    expect(inFile.stderr).toContain(
      "takes emails by id only; give made-up emails with --expect-samples-file.",
    );
    const rule = await run("email-rules:update", [
      RULE,
      "--expectations-file",
      tempFile("expectations.json", JSON.stringify({ samples })),
    ]);
    expect(rule.stderr).toContain("give made-up emails with --samples-file.");
    expect(calls).toHaveLength(2);
    // Alone, the samples are the whole of expect.
    await run("email-rules:test", [
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

  it("sends the rule, prints each look-alike numbered, and an update takes the saved answer by those numbers", async () => {
    answer(data);
    const result = await run("email-rules:generate-look-alikes", [
      "--rule-id",
      RULE,
    ]);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(calls[0]?.url.pathname).toBe("/v1/email-rules/look-alikes");
    expect(calls[0]?.body).toEqual({ rule_id: RULE });
    expect(stderrLines(result).slice(0, 3)).toEqual([
      '1. failed  medical  "Your dental invoice" from billing@clinic.example',
      "   Why it should not match: Your dental invoice is private.",
      "   matched (expected no_match)",
    ]);
    const saved = tempFile("look-alikes.json", result.stdout);
    answer({ id: RULE, name: "Bills", state: "observe", current_version: 2 });
    await run("email-rules:update", [
      RULE,
      "--add-samples-file",
      saved,
      "--pick",
      "1",
    ]);
    expect(calls[1]?.body).toEqual({
      add_expectation_samples: [
        {
          expected: "no_match",
          label: "medical: Your dental invoice is private.",
          email: data.look_alikes[0]?.email,
        },
      ],
    });
  });

  it("has no --samples-file", () => {
    const command = COMMANDS["email-rules:generate-look-alikes"] as unknown as {
      flags: Record<string, unknown>;
    };
    expect(command.flags["samples-file"]).toBeUndefined();
  });
});

describe("email-rules accept-request --samples-file", () => {
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
    const result = await run("email-rules:accept-request", [
      REQUEST,
      "--samples-file",
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

  it("refuses a text field over the API's limit before sending it, from a flag or --body-file", async () => {
    calls.length = 0;
    const long = `${"x".repeat(612)}  `;
    const declined = await run("email-rules:decline-request", [
      REQUEST,
      "--reason",
      long,
    ]);
    expect(declined.exitCode).toBe(2);
    expect(declined.stderr).toContain(
      "reason is 612 characters; the API takes at most 500. Nothing was sent.",
    );
    const objected = await run("email-rule-oversight:create-objection", [
      "--body-file",
      tempFile(
        "objection.json",
        JSON.stringify({ rule_id: RULE, message: long }),
      ),
    ]);
    expect(objected.exitCode).toBe(2);
    expect(objected.stderr).toContain("message is 612 characters");
    expect(calls).toEqual([]);
    // A single-code-point emoji counts once, so 300 of them are within 500, and the refusal counts code points.
    expect(
      overLongBodyField(
        { properties: { reason: { maxLength: 500 } } },
        { reason: "\u{1F600}".repeat(300) },
      ),
    ).toBeUndefined();
    expect(
      overLongBodyField(
        { properties: { reason: { maxLength: 500 } } },
        { reason: "\u{1F600}".repeat(501) },
      ),
    ).toBe(
      "reason is 501 characters; the API takes at most 500. Nothing was sent.",
    );
    // Text over no limit, and values that are not text, are left to the API.
    expect(
      overLongBodyField(
        { properties: { reason: { maxLength: 5 }, n: { maxLength: 1 } } },
        { reason: null, n: 12, other: "x".repeat(50) },
      ),
    ).toBeUndefined();
    // At the limit, with spaces the server trims around it, it is sent.
    answer({ id: REQUEST, status: "declined" });
    const atLimit = await run("email-rules:decline-request", [
      REQUEST,
      "--reason",
      ` ${"x".repeat(500)} `,
    ]);
    expect(atLimit.exitCode, atLimit.stderr).toBe(0);
    expect(calls).toHaveLength(1);
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
    const empty = await run("email-rules:accept-request", [
      REQUEST,
      "--samples-file",
      tempFile("empty.json", "[]"),
    ]);
    expect(empty.exitCode).toBe(2);
    expect(empty.stderr).toContain("holds no samples");
    const out = await run("email-rules:accept-request", [
      REQUEST,
      "--samples-file",
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

  it("names each sample that did not pass by its place from 1 among those sent", async () => {
    // Sent as --pick 3,1: named by the API's index, from 1.
    answer(
      testResult(
        expectations(
          [
            judged(0, "failed", "matched", {
              label: "medical: three",
              question_answers: [
                {
                  question: "Is it a bill?",
                  answer: true,
                  confidence: 0.9,
                },
              ],
            }),
            judged(1, "undecided", "not_decided", {
              label: "medical: one",
              reason: "not_decided",
              retryable: true,
            }),
          ],
          { failed: 1, undecided: 1 },
        ),
      ),
    );
    const result = await run("email-rules:test", [
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
      '  failed: sample 1 ("medical: three") expected no_match, got matched',
      '    questions: "Is it a bill?" yes at 0.90',
      '  undecided: sample 2 ("medical: one") expected no_match, got not_decided (not_decided; test again later)',
    ]);
  });

  it("exits 3 for a sample a later test can decide, and 1 for one it may not", async () => {
    answer(
      testResult(
        expectations(
          [
            judged(0, "undecided", "not_decided", {
              reason: "not_decided",
              retryable: true,
            }),
          ],
          {
            undecided: 1,
          },
        ),
      ),
    );
    const later = await run("email-rules:test", ["--rule-id", RULE, "--json"]);
    expect(later.exitCode).toBe(3);
    expect(JSON.parse(later.merged).error).toEqual({
      code: "expectations_undecided",
      message:
        "1 expectation is undecided: sample 1 (not_decided). Test again later.",
    });
    // A question left unanswered, with none answered no, can be decided by a
    // later test: exit 3 too.
    answer(
      testResult(
        expectations(
          [
            judged(2, "undecided", "near_miss", {
              reason: "unanswered",
              retryable: true,
              question_answers: [{ question: "Is it a bill?", answer: null }],
            }),
          ],
          { undecided: 1 },
        ),
      ),
    );
    const unanswered = await run("email-rules:test", ["--rule-id", RULE]);
    expect(unanswered.exitCode).toBe(3);
    expect(lines(unanswered)).toContain(
      '  undecided: sample 3 ("medical: three") expected no_match, got near_miss (unanswered; test again later)',
    );
    const unansweredJson = await run("email-rules:test", [
      "--rule-id",
      RULE,
      "--json",
    ]);
    expect(JSON.parse(unansweredJson.merged).error).toEqual({
      code: "expectations_undecided",
      message:
        "1 expectation is undecided: sample 3 (unanswered). Test again later.",
    });
    answer(
      testResult(
        expectations(
          [
            judged(1, "undecided", "no_match", {
              reason: "unset_column",
              retryable: false,
            }),
          ],
          { undecided: 1 },
        ),
      ),
    );
    const may = await run("email-rules:test", ["--rule-id", RULE]);
    expect(may.exitCode).toBe(1);
    // Judged as the rule's own: numbered as it keeps them.
    expect(
      JSON.parse(
        (await run("email-rules:test", ["--rule-id", RULE, "--json"])).merged,
      ).error.message,
    ).toContain("testing again will not decide this one");
    expect(lines(may)).toContain(
      '  undecided: sample 2 ("medical: two") expected no_match, got no_match (unset_column; testing again will not decide it)',
    );
  });
});

describe("emails facts", () => {
  const ready = {
    version: 1,
    status: "ready",
    classification_id: "00000000-0000-4000-8000-0000000000c1",
    vocabulary: "v1",
    classified_at: "2026-11-10T00:00:00Z",
    facts: {
      is_cold_outreach: { value: true, confidence: 0.69 },
      topics: { value: ["Billing", "invoice"], confidence: 0.8 },
      language: { value: "en", confidence: 0.99 },
    },
  };
  const email = (understanding?: unknown) => ({
    id: A,
    ...(understanding === undefined ? {} : { understanding }),
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

  it("prints one line per fact from the email's own understanding, in one read", async () => {
    answer(email(ready));
    for (const argv of [[A], ["--id", A]]) {
      calls = [];
      const result = await run("emails:facts", argv);
      expect(result.exitCode, result.stderr).toBe(0);
      expect(calls.map((call) => [call.method, call.url.pathname])).toEqual([
        ["GET", `/v1/emails/${A}`],
      ]);
      expect(result.stdout).toBe(
        [
          "is_cold_outreach: true at 0.69",
          "topics: [Billing, invoice] at 0.80",
          "language: en at 0.99",
          "",
        ].join("\n"),
      );
      expect(result.stderr).toBe("");
    }
  });

  it("prints the classification with --json, or null without one", async () => {
    answer(email(ready));
    const result = await run("emails:facts", [A, "--json"]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.merged)).toEqual({
      id: ready.classification_id,
      vocabulary: "v1",
      classified_at: ready.classified_at,
      facts: ready.facts,
    });
    answer(email({ version: 1, status: "pending" }));
    const none = await run("emails:facts", [A, "--json"]);
    expect(JSON.parse(none.merged)).toBeNull();
  });

  it("says why when there is no classification, and when a ready one has no facts", async () => {
    for (const [understanding, message] of [
      [{ status: "pending" }, "it has not been classified"],
      [{ status: "unavailable" }, "it was not classified in time"],
      [undefined, "the email read carries no facts"],
      [{ ...ready, facts: {} }, "This email's classification has no facts."],
    ] as const) {
      answer(email(understanding));
      const result = await run("emails:facts", [A]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(message);
    }
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

describe("an empty rule request list", () => {
  it("says once on stderr what the list leaves out by default, and nothing under --json", async () => {
    answer([]);
    const empty = await run("email-rules:list-requests", []);
    expect(empty.exitCode).toBe(0);
    expect(stderrLines(empty)).toEqual([
      "(no results) No rule requests match. Without --box and --status only pending requests made to you are listed; `--box all --status any` lists every one you can see.",
    ]);
    const quiet = await run("email-rules:list-requests", ["--json"]);
    expect(quiet.stderr).toBe("");
  });
});

describe("canonical saved sample flags", () => {
  it("removes old spellings while preserving the temporary expectations flag", () => {
    for (const id of [
      "email-rules:create",
      "email-rules:update",
      "email-rules:accept-request",
    ]) {
      const command = COMMANDS[id] as unknown as Runnable;
      expect(command.flags["samples-file"], id).toBeDefined();
      expect(command.flags["expectation-samples-file"], id).toBeUndefined();
      expect(command.flags["add-expectation-samples-file"], id).toBeUndefined();
    }
    const update = COMMANDS["email-rules:update"] as unknown as Runnable;
    expect(update.flags["add-samples-file"]?.exclusive).toContain(
      "samples-file",
    );
    expect(update.flags["samples-file"]?.exclusive).toContain(
      "add-samples-file",
    );
    const test = COMMANDS["email-rules:test"] as unknown as Runnable;
    expect(test.flags["expect-samples-file"]).toBeDefined();
  });

  it("rejects retired saved sample flags before reading a file or sending a request", async () => {
    for (const [id, flag] of [
      ["email-rules:create", "--expectation-samples-file"],
      ["email-rules:update", "--add-expectation-samples-file"],
      ["email-rules:accept-request", "--expectation-samples-file"],
    ]) {
      const result = await run(id, [flag, "/no-such-samples.json"]);
      expect(result.exitCode, id).not.toBe(0);
      expect(result.stderr, id).toContain(flag.slice(2));
    }
    expect(calls).toEqual([]);
  });
});

describe("--scope-address and --scope-domain", () => {
  const written = {
    id: RULE,
    name: "Support mail",
    state: "observe",
    current_version: 1,
    author_user_id: "00000000-0000-4000-8000-0000000000f1",
    is_author: true,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-10T00:00:00Z",
    current: null,
  };
  const tree = { version: 1, vocabulary: "v1", when: { all: [] } };
  const SCOPE_COMMANDS = [
    "email-rules:create",
    "email-rules:update",
    "email-rules:test",
    "email-rules:test-sample",
    "email-rules:generate-look-alikes",
    "email-rules:compile",
  ];

  it("are on every email-rules command whose request takes evaluation_scope, and take scope_selection out of the --raw-body list", () => {
    for (const id of SCOPE_COMMANDS) {
      const command = COMMANDS[id] as unknown as Runnable & {
        description: string;
      };
      for (const flag of ["scope-address", "scope-domain"]) {
        expect(command.flags[flag], `${id} --${flag}`).toMatchObject({
          type: "option",
          multiple: true,
        });
        expect(command.flags[flag]?.description, `${id} --${flag}`).toContain(
          "Sends evaluation_scope selected unless --scope or the body gives a scope.",
        );
      }
      expect(command.flags.scope, id).toBeDefined();
      expect(command.flags["evaluation-scope"], id).toBeUndefined();
      expect(command.description, id).not.toMatch(/^ {2,3}scope_selection\b/m);
    }
  });

  it("rejects the retired scope flag before making a request", async () => {
    for (const id of SCOPE_COMMANDS) {
      const result = await run(id, ["--evaluation-scope", "author"]);
      expect(result.exitCode, id).not.toBe(0);
      expect(result.stderr, id).toContain("evaluation-scope");
    }
    expect(calls).toEqual([]);
  });

  it("build scope_selection from repeated and comma-listed values, without repeats", async () => {
    answer(written);
    const result = await run("email-rules:create", [
      "--raw-body",
      JSON.stringify({
        tree,
        kind: "grant",
        name: "Support mail",
        english: "support mail",
      }),
      "--scope",
      "selected",
      "--scope-address",
      "support@example.com, billing@example.com",
      "--scope-address",
      "Support@example.com",
      "--scope-domain",
      "example.org",
    ]);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(calls.map((call) => [call.method, call.url.pathname])).toEqual([
      ["POST", "/v1/email-rules"],
    ]);
    expect(calls[0]?.body).toEqual({
      tree,
      kind: "grant",
      name: "Support mail",
      english: "support mail",
      evaluation_scope: "selected",
      scope_selection: {
        addresses: ["support@example.com", "billing@example.com"],
        domains: ["example.org"],
      },
    });
  });

  it("send the list not given as empty, and keep a rule id given after them as the argument", async () => {
    answer(written);
    const result = await run("email-rules:update", [
      "--scope",
      "selected",
      "--scope-domain",
      "example.org",
      RULE,
    ]);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(calls.map((call) => [call.method, call.url.pathname])).toEqual([
      ["PATCH", `/v1/email-rules/${RULE}`],
    ]);
    expect(calls[0]?.body).toEqual({
      evaluation_scope: "selected",
      scope_selection: { addresses: [], domains: ["example.org"] },
    });
  });

  it("replace a scope_selection in --raw-body, which may carry evaluation_scope", async () => {
    answer(testResult());
    const result = await run("email-rules:test", [
      "--raw-body",
      JSON.stringify({
        tree,
        evaluation_scope: "selected",
        scope_selection: { addresses: ["old@example.com"] },
      }),
      "--scope-address",
      "new@example.com",
    ]);
    expect(calls[0]?.body).toEqual({
      tree,
      evaluation_scope: "selected",
      scope_selection: { addresses: ["new@example.com"], domains: [] },
    });
    expect(result.stderr).not.toContain("--scope selected");
  });

  it("set scope_selection on test-sample and generate-look-alikes", async () => {
    for (const id of [
      "email-rules:test-sample",
      "email-rules:generate-look-alikes",
    ]) {
      calls = [];
      const input = {
        tree,
        kind: "grant",
        ...(id.endsWith("test-sample")
          ? {
              email: {
                from: { address: "sender@example.com" },
                to: ["support@example.com"],
                text: "Sample mail",
              },
            }
          : {}),
      };
      answer({});
      await run(id, [
        "--raw-body",
        JSON.stringify(input),
        "--scope",
        "selected",
        "--scope-address",
        "support@example.com",
      ]);
      expect(calls[0]?.body, id).toEqual({
        ...input,
        evaluation_scope: "selected",
        scope_selection: { addresses: ["support@example.com"], domains: [] },
      });
    }
  });

  it("send evaluation_scope selected when no scope is given, and any scope given as it is", async () => {
    answer(written);
    const alone = await run("email-rules:update", [
      RULE,
      "--scope-address",
      "support@example.com",
    ]);
    expect(alone.exitCode, alone.stderr).toBe(0);
    expect(calls[0]?.body).toEqual({
      evaluation_scope: "selected",
      scope_selection: { addresses: ["support@example.com"], domains: [] },
    });
    calls = [];
    const other = await run("email-rules:update", [
      RULE,
      "--scope",
      "author",
      "--scope-address",
      "support@example.com",
    ]);
    expect(other.exitCode, other.stderr).toBe(0);
    expect(calls[0]?.body).toEqual({
      evaluation_scope: "author",
      scope_selection: { addresses: ["support@example.com"], domains: [] },
    });
  });

  it("read evaluation_scope from --raw-body or --body-file when --scope is not given, and let the flag win", async () => {
    answer(written);
    for (const [argv, scope] of [
      [["--raw-body", JSON.stringify({ tree, name: "n" })], "selected"],
      [
        [
          "--raw-body",
          JSON.stringify({
            tree,
            name: "n",
            kind: "grant",
            english: "scope rule",
            evaluation_scope: "author",
          }),
        ],
        "author",
      ],
      [
        [
          "--body-file",
          tempFile(
            "own.json",
            JSON.stringify({ tree, evaluation_scope: "own_mailboxes" }),
          ),
        ],
        "own_mailboxes",
      ],
    ] as const) {
      calls = [];
      const result = await run("email-rules:create", [
        ...argv,
        "--name",
        "Scope rule",
        "--kind",
        "grant",
        "--english",
        "scope rule",
        "--scope-address",
        "support@example.com",
      ]);
      expect(result.exitCode, argv.join(" ")).toBe(0);
      expect(calls[0]?.body).toMatchObject({ evaluation_scope: scope });
    }
    calls = [];
    // A body that is not an object is refused for what it is.
    const array = await run("email-rules:create", [
      "--raw-body",
      "[]",
      "--scope-address",
      "support@example.com",
    ]);
    expect(array.exitCode).toBe(2);
    expect(array.stderr).toContain(
      "--raw-body must be a JSON object when also passing per-field flags (got array)",
    );
    expect(calls).toEqual([]);

    const file = tempFile(
      "selected.json",
      JSON.stringify({
        tree,
        name: "n",
        kind: "grant",
        english: "scope rule",
        evaluation_scope: "selected",
      }),
    );
    const fromFile = await run("email-rules:create", [
      "--body-file",
      file,
      "--scope-domain",
      "example.org",
    ]);
    expect(fromFile.exitCode, fromFile.stderr).toBe(0);
    expect(calls[0]?.body).toEqual({
      tree,
      name: "n",
      kind: "grant",
      english: "scope rule",
      evaluation_scope: "selected",
      scope_selection: { addresses: [], domains: ["example.org"] },
    });

    calls = [];
    const overridden = await run("email-rules:create", [
      "--raw-body",
      JSON.stringify({
        tree,
        name: "n",
        kind: "grant",
        english: "scope rule",
        evaluation_scope: "author",
      }),
      "--scope",
      "selected",
      "--scope-domain",
      "example.org",
    ]);
    expect(overridden.exitCode, overridden.stderr).toBe(0);
    expect(calls[0]?.body).toMatchObject({
      evaluation_scope: "selected",
      scope_selection: { addresses: [], domains: ["example.org"] },
    });
  });

  it("refuse an empty value, and leave the address and domain forms to the API", async () => {
    const empty = await run("email-rules:update", [
      RULE,
      "--scope-address",
      " , ",
    ]);
    expect(empty.exitCode).toBe(2);
    expect(empty.stderr).toContain("--scope-address needs a value.");
    expect(calls).toEqual([]);
    answer(written);
    const domain = await run("email-rules:update", [
      RULE,
      "--scope-address",
      "example.org",
    ]);
    expect(domain.exitCode, domain.stderr).toBe(0);
    expect(calls[0]?.body).toMatchObject({
      scope_selection: { addresses: ["example.org"] },
    });
  });
});

describe("how sure a question's answer is", () => {
  it("reads confidence, the number a webhook payload carries, and nothing else", () => {
    expect(
      answerConfidence({
        question: "Q",
        answer: false,
        confidence: 0.75,
      }),
    ).toBe(0.75);
    expect(
      answerConfidence({ question: "Q", answer: false, confidence: null }),
    ).toBeNull();
    expect(
      answerConfidence({
        question: "Q",
        answer: true,
        confidence: Number.NaN,
      }),
    ).toBeNull();
    expect(
      answerConfidence({
        question: "Q",
        answer: null,
        confidence: 0.9,
      }),
    ).toBeNull();
  });
});

describe("expectationsOutcome: one exit rule for a test", () => {
  type Expectations = Parameters<typeof expectationsOutcome>[0];
  const E1 = "00000000-0000-4000-8000-0000000000e1";
  const entry = (status: string, extra: Record<string, unknown> = {}) => ({
    email_id: E1,
    expected: "match" as const,
    outcome: "near_miss" as const,
    status: status as "passed",
    ...extra,
  });
  const sample = (status: string, extra: Record<string, unknown> = {}) => ({
    index: 0,
    label: null,
    expected: "no_match",
    outcome: "no_match",
    status,
    question_answers: [],
    ...extra,
  });
  type Case = [
    string,
    { results?: unknown[]; samples?: unknown[] },
    number | undefined,
    string | undefined,
  ];
  const cases: Case[] = [
    ["nothing to judge", {}, undefined, undefined],
    ["all passed", { results: [entry("passed")] }, undefined, undefined],
    [
      "an email failed",
      { results: [entry("failed")] },
      1,
      "expectations_failed",
    ],
    [
      "a sample failed",
      { samples: [sample("failed")] },
      1,
      "expectations_failed",
    ],
    [
      "failed beats undecided",
      { results: [entry("undecided")], samples: [sample("failed")] },
      1,
      "expectations_failed",
    ],
    [
      "undecided, retryable by the server",
      { results: [entry("undecided", { retryable: true, reason: "x" })] },
      3,
      "expectations_undecided",
    ],
    [
      "undecided, not retryable by the server",
      { results: [entry("undecided", { retryable: false, reason: "x" })] },
      1,
      "expectations_undecided",
    ],
    [
      "one retryable and one not",
      {
        results: [entry("undecided", { retryable: true })],
        samples: [sample("undecided", { retryable: false })],
      },
      1,
      "expectations_undecided",
    ],
    [
      "an undecided one the server does not call retryable",
      { samples: [sample("undecided", { outcome: "not_decided" })] },
      1,
      "expectations_undecided",
    ],
    [
      "a sample decided but undecided, without the server's word",
      { samples: [sample("undecided")] },
      1,
      "expectations_undecided",
    ],
  ];
  it.each(cases)("%s", (_name, given, exitCode, code) => {
    const results = given.results ?? [];
    const samples = given.samples ?? [];
    const all = [...results, ...samples] as Array<{ status: string }>;
    const count = (status: string) =>
      all.filter((item) => item.status === status).length;
    const outcome = expectationsOutcome(
      results.length + samples.length === 0
        ? undefined
        : ({
            passed: count("passed") === all.length,
            counts: {
              passed: count("passed"),
              failed: count("failed"),
              undecided: count("undecided"),
            },
            results,
            samples,
          } as Expectations),
    );
    expect(outcome.exitCode).toBe(exitCode);
    expect(outcome.error?.code).toBe(code);
  });

  it("exits 1 for an undecided one the answer counts but does not list", () => {
    const outcome = expectationsOutcome({
      passed: false,
      counts: { passed: 0, failed: 0, undecided: 2 },
      results: [entry("undecided", { retryable: true, reason: "pending" })],
    } as Expectations);
    expect(outcome.exitCode).toBe(1);
    expect(outcome.error?.code).toBe("expectations_undecided");
  });

  it("names the server's reason for each undecided one", () => {
    const outcome = expectationsOutcome({
      passed: false,
      counts: { passed: 0, failed: 0, undecided: 1 },
      results: [entry("undecided", { retryable: true, reason: "pending" })],
    } as Expectations);
    expect(outcome.error?.message).toBe(
      `1 expectation is undecided: ${E1} (pending). Test again later.`,
    );
  });
});

describe("the notes printer on a rules answer", () => {
  it("prints a single answer's notes on stderr after the JSON, and nothing under --json or for a list", async () => {
    answer({
      id: RULE,
      name: "Bills",
      note: "A note from the server.",
      warnings: ["A warning."],
    });
    const plain = await run("email-rules:get", [RULE]);
    expect(plain.exitCode).toBe(0);
    expect(stderrLines(plain)).toEqual([
      "Warning: A warning.",
      "A note from the server.",
    ]);
    const json = await run("email-rules:get", [RULE, "--json"]);
    expect(json.stderr).toBe("");
    expect(json.merged).not.toContain("Warning: A warning.");
    answer([{ id: RULE, note: "On a row." }]);
    const listed = await run("email-rules:list", []);
    expect(listed.stderr).not.toContain("On a row.");
  });
});

describe("the test report prints server text safely", () => {
  it("strips terminal controls from condition and question text and fact values", async () => {
    const data = testResult();
    answer({
      ...data,
      summary: {
        ...data.summary,
        conditions: [
          {
            index: 0,
            text: "Sender \u001b[2Jis \u202eknown",
            held: 1,
            failed: 0,
            only_failure: 0,
          },
        ],
      },
      results: [
        {
          email_id: B,
          outcome: "no_match",
          values: {
            topic: { value: "bill\u001b]0;x\u0007ing", confidence: 0.5 },
          },
        },
      ],
    });
    const result = await run("email-rules:test", ["--rule-id", RULE]);
    expect(result.stderr).toContain("0. Sender is known: held on 1");
    expect(result.stderr).toContain(`${B} no_match: topic: billing at 0.50`);
    for (const control of ["\u001b", "\u0007", "\u202e"])
      expect(result.stderr).not.toContain(control);
  });
});

describe("a saved compile answer as a write body", () => {
  it("creates the compiled rule from the rule of the --json answer, as the help says", async () => {
    const tree = { version: 1, vocabulary: "v1", when: { all: [] } };
    const rule = { english: "bills", kind: "grant", tree };
    answer({ rule, explanation: "Bills.", assumptions: [], warnings: [] });
    const compiled = await run("email-rules:compile", [
      "--raw-body",
      JSON.stringify({ english: "bills" }),
      "--json",
    ]);
    const file = tempFile(
      "rule.json",
      JSON.stringify(JSON.parse(compiled.stdout).data.rule),
    );
    calls = [];
    answer({ id: RULE, name: "Bills" });
    const created = await run("email-rules:create", [
      "--body-file",
      file,
      "--name",
      "Bills",
    ]);
    expect(created.exitCode, created.stderr).toBe(0);
    expect(calls[0]?.body).toEqual({ ...rule, name: "Bills" });
  });
});

describe("a refused rule write", () => {
  it("exits 1 with the API's error alone, and no hint of the CLI's own", async () => {
    const error = {
      code: "expectations_undecided",
      message: "1 expectation is undecided; send the write again later.",
      details: { retryable: true },
    };
    responder = () => jsonResponse(409, { success: false, error });
    const plain = await run("email-rules:update", [RULE, "--state", "active"]);
    expect(plain.exitCode).toBe(1);
    expect(plain.stderr).not.toContain("Hint:");
    const json = await run("email-rules:update", [
      RULE,
      "--state",
      "active",
      "--json",
    ]);
    expect(json.exitCode).toBe(1);
    expect(JSON.parse(json.merged)).toEqual({ error, exit_code: 1 });
  });
});

describe("update numbers", () => {
  it("sends --if-revision and --restore-version as numbers", async () => {
    answer({ id: RULE, name: "Bills", state: "observe", current_version: 3 });
    await run("email-rules:update", [
      RULE,
      "--restore-version",
      "3",
      "--if-revision",
      "12",
    ]);
    expect(calls.find((call) => call.method === "PATCH")?.body).toEqual({
      restore_version: 3,
      if_revision: 12,
    });
  });
});

describe("the test report: changes against the current version and close calls", () => {
  const changed = (count: number, ids: string[]) => ({
    count,
    emails: ids.map((id) => ({
      email_id: id,
      subject: `Subject ${id}`,
      from: `${id}@sender.example`,
      received_at: "2026-11-16T00:00:00Z",
    })),
  });

  it("counts what the tree would change and names a few emails each way", () => {
    expect(
      changesLines({
        compared_to_version: 3,
        newly_matched: changed(5, ["a", "b", "c", "d", "e"]),
        stops_matching: changed(1, ["f"]),
        undecided: 2,
      }),
    ).toEqual([
      "Against version 3: 5 newly matched, 1 stops matching, 2 undecided by either.",
      "  Newly matched (3 of 5 shown; the JSON lists up to 50):",
      '    "Subject a" from a@sender.example (a)',
      '    "Subject b" from b@sender.example (b)',
      '    "Subject c" from c@sender.example (c)',
      "  Stops matching:",
      '    "Subject f" from f@sender.example (f)',
    ]);
    expect(
      changesLines(
        {
          compared_to_version: 1,
          newly_matched: changed(0, []),
          stops_matching: changed(2, []),
          undecided: 0,
        },
        "do_not_share",
      ),
    ).toEqual(["Against version 1: 0 newly withheld, 2 no longer withheld."]);
    expect(
      changesLines({
        compared_to: "requested",
        newly_matched: changed(1, ["g"]),
        stops_matching: changed(0, []),
        undecided: 0,
      }),
    ).toEqual([
      "Against the rule as asked: 1 newly matched, 0 stop matching.",
      "  Newly matched:",
      '    "Subject g" from g@sender.example (g)',
    ]);
    expect(
      changesLines({
        compared_to: "something_new",
        newly_matched: changed(0, []),
        stops_matching: changed(0, []),
        undecided: 0,
      })[0],
    ).toBe(
      "Against the rule compared against: 0 newly matched, 0 stop matching.",
    );
    expect(changesLines(undefined)).toEqual([]);
  });

  it("prints changes before the expectations, and lists close calls even when all passed", () => {
    const report = testEmailRuleReport({
      ...testResult({
        passed: true,
        counts: { passed: 2, failed: 0, undecided: 0, close_calls: 1 },
        results: [
          {
            email_id: A,
            expected: "match",
            outcome: "matched",
            status: "passed",
            close_call: true,
          },
          {
            email_id: B,
            expected: "no_match",
            outcome: "no_match",
            status: "passed",
            close_call: false,
          },
        ],
      }),
      changes: {
        compared_to: "version",
        compared_to_version: 3,
        newly_matched: changed(0, []),
        stops_matching: changed(0, []),
        undecided: 0,
      },
    });
    const at = report.lines.indexOf(
      "Against version 3: 0 newly matched, 0 stop matching.",
    );
    expect(at).toBeGreaterThanOrEqual(0);
    const expectations = report.lines.indexOf(
      "Expectations: all 2 passed; 1 was a close call.",
    );
    expect(expectations).toBeGreaterThan(at);
    expect(report.lines[expectations + 1]).toBe(
      `  passed: ${A} expected match, got matched (a close call: decided by an answer below 0.75 confidence, so it may come out the other way when judged again)`,
    );
    expect(report.lines.join("\n")).not.toContain(`passed: ${B}`);
    expect(report.exitCode).toBeUndefined();
  });

  it("marks a failed close call and prints the counts by group", () => {
    const report = testEmailRuleReport(
      testResult({
        passed: false,
        counts: {
          passed: 0,
          failed: 1,
          undecided: 0,
          close_calls: 1,
          by_group: {
            private: { passed: 0, failed: 1, undecided: 0 },
            near_miss: { passed: 0, failed: 0, undecided: 0 },
            must_match: { passed: 0, failed: 0, undecided: 0 },
          },
        },
        results: [],
        samples: [
          {
            index: 0,
            sample_id: null,
            label: "a dental bill",
            expected: "no_match",
            group: "private",
            outcome: "matched",
            status: "failed",
            close_call: true,
            question_answers: [],
          },
        ],
      }),
    );
    expect(report.lines).toContain(
      "Expectations: 1 failed, 0 passed; 1 was a close call.",
    );
    expect(report.lines).toContain("By group: private 1 failed.");
    expect(report.lines).toContain(
      '  failed: sample 1 ("a dental bill") expected no_match, got matched (a close call: decided by an answer below 0.75 confidence, so it may come out the other way when judged again)',
    );
    expect(report.exitCode).toBe(1);
  });
});
