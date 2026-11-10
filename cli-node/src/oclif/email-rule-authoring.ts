// Authoring email rules from the CLI: flags on the generated email-rules
// commands that set a test's `expect` and a rule's saved `expectations`, and
// the readable reports those commands print on stderr after their JSON.
//
//   primitive email-rules test-email-rule --rule-id <id> \
//     --expect-match <email-id>,<email-id> --expect-no-match <email-id>
//
// The exit code follows the expectations the answer judged (expect, or a
// saved rule's saved expectations): 1 when one failed or is undecided for
// good (its email cannot be found, read or classified), and 3 when the only
// undecided ones a later test can decide, so a script can rerun it. The JSON
// on stdout keeps the API's shape; under --json the report is left out and
// the document gains `error` and `exit_code` when the exit code is not 0.
//
// create-email-rule and update-email-rule exit 0 whatever their answer's
// expectations_check says, unless --fail-on-expectations asks otherwise: then
// 1 when one failed, and 3 when none failed but one is undecided or the
// expectations this write sent were not checked, so test the rule to decide.
//
// This module does not import api-command.ts, which imports it.

import { readFileSync } from "node:fs";
import { Errors, Flags } from "@oclif/core";
import type {
  EmailRuleScopeWarning,
  EmailRuleWritten,
  GetEmailRuleScopeResult,
  ListEmailRuleResultsResult,
  TestEmailRuleResult,
} from "@primitivedotdev/api-core";
import { withCliCommands } from "./api-path-commands.js";
import type {
  ExtensionBodyField,
  OperationExtension,
  OperationReport,
} from "./operation-extension.js";

const EMAIL_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** Whether `id` has the shape of an email id (a UUID). */
export function isEmailId(id: string): boolean {
  return EMAIL_ID.test(id);
}

/** The most not-matched results the test report lists one by one. */
export const NOT_MATCHED_LIST_LIMIT = 25;

/** Exit code of a test with a failed expectation. */
export const EXIT_EXPECTATION_FAILED = 1;
/** Exit code of a test with no failed expectation but an undecided one. */
export const EXIT_EXPECTATION_UNDECIDED = 3;

type Expectations = { match?: string[]; no_match?: string[] };

function usageError(message: string): Errors.CLIError {
  return new Errors.CLIError(message, { exit: 2 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** `count` and the word for it: "1 expectation", "2 expectations". */
function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function checkEmailId(id: string, label: string): string {
  if (!isEmailId(id))
    throw usageError(
      `${label} takes email ids (UUIDs, from \`primitive emails list\`); "${id}" is not one.`,
    );
  return id;
}

/**
 * The email ids in a repeatable, comma-separated flag, in the order given and
 * without repeats.
 */
export function parseEmailIdList(
  values: readonly string[],
  flag: string,
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    for (const raw of value.split(",")) {
      const id = raw.trim();
      if (id === "") continue;
      checkEmailId(id, flag);
      if (seen.has(id.toLowerCase())) continue;
      seen.add(id.toLowerCase());
      ids.push(id);
    }
  }
  if (ids.length === 0)
    throw usageError(`${flag} needs at least one email id.`);
  return ids;
}

function assertDisjoint(expectations: Expectations, label: string): void {
  const match = new Set(
    (expectations.match ?? []).map((id) => id.toLowerCase()),
  );
  const both = (expectations.no_match ?? []).find((id) =>
    match.has(id.toLowerCase()),
  );
  if (both)
    throw usageError(
      `${label}: ${both} is expected both to match and not to match; give each email one way.`,
    );
}

/**
 * Check a JSON value in the shape of a rule's expectations or a test's
 * `expect`: an object with `match` and `no_match`, each a list of email ids,
 * at least one id in all, and no id in both. Repeats are removed.
 */
export function checkExpectations(value: unknown, label: string): Expectations {
  if (!isRecord(value))
    throw usageError(
      `${label} must hold a JSON object such as {"match": ["<email-id>"], "no_match": ["<email-id>"]}.`,
    );
  const expectations: Expectations = {};
  for (const [key, list] of Object.entries(value)) {
    if (key !== "match" && key !== "no_match")
      throw usageError(
        `${label} takes only "match" and "no_match"; "${key}" is not one of them.`,
      );
    if (!Array.isArray(list) || list.some((id) => typeof id !== "string"))
      throw usageError(`${label}: "${key}" must be a list of email ids.`);
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const id of list as string[]) {
      checkEmailId(id, label);
      if (seen.has(id.toLowerCase())) continue;
      seen.add(id.toLowerCase());
      ids.push(id);
    }
    expectations[key] = ids;
  }
  if (
    (expectations.match?.length ?? 0) + (expectations.no_match?.length ?? 0) ===
    0
  )
    throw usageError(
      `${label} needs at least one email id in match or no_match.`,
    );
  assertDisjoint(expectations, label);
  return expectations;
}

/** Read and parse a JSON file a flag names, failing like --body-file does. */
export function readJsonFileFlag(path: string, flag: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    throw new Errors.CLIError(
      `Could not read ${flag} ${path}: ${errorDetail(error)}`,
      { exit: 1 },
    );
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Errors.CLIError(
      `${flag} ${path} is not valid JSON: ${errorDetail(error)}`,
      { exit: 1 },
    );
  }
}

/** `expect` for test-email-rule, from --expect-file or the id flags. */
export function expectBodyFields(
  flags: Record<string, unknown>,
): ExtensionBodyField[] {
  const file = flags["expect-file"];
  if (typeof file === "string") {
    const label = `--expect-file ${file}`;
    return [
      {
        flag: "--expect-file",
        property: "expect",
        value: checkExpectations(
          readJsonFileFlag(file, "--expect-file"),
          label,
        ),
      },
    ];
  }
  const expect: Expectations = {};
  const given: string[] = [];
  const match = flags["expect-match"];
  if (Array.isArray(match)) {
    expect.match = parseEmailIdList(match as string[], "--expect-match");
    given.push("--expect-match");
  }
  const noMatch = flags["expect-no-match"];
  if (Array.isArray(noMatch)) {
    expect.no_match = parseEmailIdList(
      noMatch as string[],
      "--expect-no-match",
    );
    given.push("--expect-no-match");
  }
  if (given.length === 0) return [];
  assertDisjoint(expect, given.join(" and "));
  return [{ flag: given.join(", "), property: "expect", value: expect }];
}

/**
 * `expectations` for create-email-rule and update-email-rule, from
 * --expectations-file. A file holding `null` removes the saved expectations,
 * which only update accepts.
 */
export function expectationsBodyFields(
  allowNull: boolean,
): (flags: Record<string, unknown>) => ExtensionBodyField[] {
  return (flags) => {
    const file = flags["expectations-file"];
    if (typeof file !== "string") return [];
    const value = readJsonFileFlag(file, "--expectations-file");
    if (value === null && !allowNull)
      throw usageError(
        `--expectations-file ${file} holds null, which only update-email-rule takes (to remove a rule's saved expectations). A new rule takes an object such as {"match": ["<email-id>"], "no_match": ["<email-id>"]}, or no --expectations-file.`,
      );
    return [
      {
        flag: "--expectations-file",
        property: "expectations",
        value:
          value === null
            ? null
            : checkExpectations(value, `--expectations-file ${file}`),
      },
    ];
  };
}

// Readable values

function confidence(value: number): string {
  return value.toFixed(2);
}

type FactValue = {
  value?: unknown;
  confidence?: number | null;
  value_confidences?: Record<string, number>;
};

/**
 * A fact or column value as rule conditions read it, with its confidence:
 * `true at 0.69`, or for a multi fact with per-value confidences
 * `[billing 0.91, invoice 0.62] at 0.80`.
 */
export function formatFactValue(fact: FactValue | null | undefined): string {
  const value = fact?.value;
  let text: string;
  if (Array.isArray(value)) {
    const per = isRecord(fact?.value_confidences)
      ? fact.value_confidences
      : undefined;
    text = `[${value
      .map((item) => {
        const name = String(item);
        const score = per?.[name];
        return typeof score === "number"
          ? `${name} ${confidence(score)}`
          : name;
      })
      .join(", ")}]`;
  } else if (value === null || value === undefined) {
    text = "null";
  } else if (typeof value === "object") {
    text = JSON.stringify(value);
  } else {
    text = String(value);
  }
  return typeof fact?.confidence === "number"
    ? `${text} at ${confidence(fact.confidence)}`
    : text;
}

/** One line for a fact: `is_cold_outreach: true at 0.69`. */
export function formatFact(
  name: string,
  fact: FactValue | null | undefined,
): string {
  return `${name}: ${formatFactValue(fact)}`;
}

export function scopeWarningLine(warning: EmailRuleScopeWarning): string {
  const message =
    typeof warning.message === "string" && warning.message.trim()
      ? withCliCommands(warning.message.trim())
      : undefined;
  if (!message) return `Scope warning: ${warning.name} (${warning.reason})`;
  return message.includes(warning.name)
    ? `Scope warning: ${message}`
    : `Scope warning: ${warning.name}: ${message}`;
}

function scopeWarningLines(warnings: unknown): string[] {
  return Array.isArray(warnings)
    ? (warnings as EmailRuleScopeWarning[])
        .filter(isRecord)
        .map(scopeWarningLine)
    : [];
}

// test-email-rule

type TestResult = TestEmailRuleResult["results"][number];
type ExpectationResult = NonNullable<
  TestEmailRuleResult["expectations"]
>["results"][number];
type QuestionAnswer = NonNullable<TestResult["question_answers"]>[number];

type UndecidedReason = {
  why: string;
  resolvable: boolean;
  /** Unresolvable as far as the answer shows, though a later test might still decide it. */
  may?: boolean;
};

// An unclassified email by unclassified_reason: whether a later test can
// classify it. An unknown reason is taken as one it cannot.
const UNCLASSIFIED_REASONS: Record<string, UndecidedReason> = {
  pending: { why: "not classified yet", resolvable: true },
  classifier_unavailable: {
    why: "the classifier was unavailable",
    resolvable: true,
  },
  classification_failed: {
    why: "its classification failed",
    resolvable: false,
    may: true,
  },
  not_classifiable: { why: "it cannot be classified", resolvable: false },
};

function sameId(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Why an expectation is undecided, from its email's result, and whether a
 * later test can decide it: not for an email the rule cannot find or read, or
 * one that cannot be classified; yes for one not classified yet, or whose
 * question went unanswered.
 */
export function undecidedReason(
  expectation: Pick<ExpectationResult, "email_id" | "outcome">,
  results: readonly TestResult[],
): UndecidedReason {
  const result = results.find((entry) =>
    sameId(entry.email_id, expectation.email_id),
  );
  const outcome = result?.outcome ?? expectation.outcome;
  if (outcome === "not_found")
    return { why: "no such email the rule can read", resolvable: false };
  if (outcome === "unclassified") {
    const reason = result?.unclassified_reason;
    return (
      (reason ? UNCLASSIFIED_REASONS[reason] : undefined) ?? {
        why: reason ? `unclassified (${reason})` : "unclassified",
        resolvable: false,
      }
    );
  }
  return { why: "a question went unanswered", resolvable: true };
}

function undecidedNote(reason: UndecidedReason): string {
  return `${reason.why}; ${reason.resolvable ? "test again later" : reason.may ? "a later test may not decide it" : "testing again will not decide it"}`;
}

function answerText(answer: QuestionAnswer): string {
  const verdict =
    answer.answer === true
      ? "yes"
      : answer.answer === false
        ? "no"
        : "unanswered";
  const probability =
    typeof answer.probability === "number"
      ? ` at ${confidence(answer.probability)}`
      : "";
  const error = answer.error_class ? ` (${answer.error_class})` : "";
  return `"${answer.question}" ${verdict}${probability}${error}`;
}

function conditionLines(summary: TestEmailRuleResult["summary"]): string[] {
  const conditions = Array.isArray(summary?.conditions)
    ? summary.conditions
    : [];
  if (conditions.length === 0) return [];
  return [
    `Conditions (${summary?.decided ?? 0} decided):`,
    ...conditions.map(
      (condition) =>
        `  ${condition.index}. ${condition.text}: held on ${condition.held}, failed on ${condition.failed} (the only failure on ${condition.only_failure})`,
    ),
  ];
}

function questionLines(
  summary: TestEmailRuleResult["summary"],
  results: readonly TestResult[],
): string[] {
  const questions = Array.isArray(summary?.questions) ? summary.questions : [];
  if (questions.length === 0) return [];
  return [
    "Questions (on emails whose conditions held):",
    ...questions.map((question) => {
      const text = results.find(
        (result) => result.question_answers?.[question.index],
      )?.question_answers?.[question.index]?.question;
      return `  ${question.index}. ${text ? `"${text}": ` : ""}yes ${question.yes}, no ${question.no}, unanswered ${question.unanswered}`;
    }),
  ];
}

function expectationLine(
  result: ExpectationResult,
  results: readonly TestResult[],
): string {
  const note =
    result.status === "undecided"
      ? undecidedNote(undecidedReason(result, results))
      : undefined;
  return `  ${result.status}: ${result.email_id} expected ${result.expected}, got ${result.outcome}${note ? ` (${note})` : ""}`;
}

function expectationsLines(
  expectations: TestEmailRuleResult["expectations"],
  testResults: readonly TestResult[],
): string[] {
  if (!expectations) return [];
  const results = Array.isArray(expectations.results)
    ? expectations.results
    : [];
  const passed = expectations.counts?.passed ?? 0;
  const failed = expectations.counts?.failed ?? 0;
  const undecided = expectations.counts?.undecided ?? 0;
  if (expectations.passed && failed === 0 && undecided === 0)
    return [`Expectations: all ${passed} passed.`];
  const parts = [
    failed > 0 ? `${failed} failed` : "",
    undecided > 0 ? `${undecided} undecided` : "",
    `${passed} passed`,
  ].filter((part) => part !== "");
  return [
    `Expectations: ${parts.join(", ")}.`,
    ...results
      .filter((result) => result.status !== "passed")
      .map((result) => expectationLine(result, testResults)),
  ];
}

const NOT_MATCHED_ORDER: Record<string, number> = {
  near_miss: 1,
  no_match: 2,
  unclassified: 3,
  not_found: 4,
};

function notMatchedLine(result: TestResult): string[] {
  if (result.outcome === "unclassified") {
    const reason = result.unclassified_reason;
    const note = !reason
      ? ""
      : UNCLASSIFIED_REASONS[reason]?.resolvable
        ? `${reason}: test again later`
        : reason;
    return [`  ${result.email_id} unclassified${note ? ` (${note})` : ""}`];
  }
  if (result.outcome === "not_found") return [`  ${result.email_id} not_found`];
  const failedParts = (result.parts ?? [])
    .filter((part) => !part.matched)
    .map((part) => part.index);
  const values = Object.entries(result.values ?? {}).map(([column, value]) =>
    formatFact(column, value),
  );
  const missing = result.missing_facts ?? [];
  if (missing.length > 0) values.push(`missing: ${missing.join(", ")}`);
  const head = `  ${result.email_id} ${result.outcome}${failedParts.length > 0 ? ` (failed part ${failedParts.join(", ")})` : ""}`;
  const lines = [values.length > 0 ? `${head}: ${values.join("; ")}` : head];
  const answers = result.question_answers ?? [];
  if (answers.length > 0) {
    const source = result.question_answers_source
      ? ` (${result.question_answers_source})`
      : "";
    lines.push(`    questions${source}: ${answers.map(answerText).join("; ")}`);
  }
  return lines;
}

function notMatchedLines(
  results: readonly TestResult[],
  expectations: TestEmailRuleResult["expectations"],
): string[] {
  // Expected emails that did not pass come first, then near misses: the ones
  // worth reading when the list is cut.
  const flagged = new Set(
    (expectations?.results ?? [])
      .filter((result) => result.status !== "passed")
      .map((result) => result.email_id),
  );
  const rank = (result: TestResult) =>
    flagged.has(result.email_id) ? 0 : (NOT_MATCHED_ORDER[result.outcome] ?? 5);
  const notMatched = results
    .filter((result) => result.outcome !== "matched")
    .map((result, position) => ({ result, position }))
    .sort((a, b) => rank(a.result) - rank(b.result) || a.position - b.position)
    .map(({ result }) => result);
  if (notMatched.length === 0) return [];
  const shown = notMatched.slice(0, NOT_MATCHED_LIST_LIMIT);
  const header =
    shown.length < notMatched.length
      ? `Not matched (${shown.length} of ${notMatched.length} shown; the JSON has every result):`
      : `Not matched (${notMatched.length}):`;
  return [header, ...shown.flatMap(notMatchedLine)];
}

/**
 * The exit code a test's expectations call for, and the error a --json
 * document carries with it:
 * - 1 and `expectations_failed` when one failed;
 * - else 1 and `expectations_unresolvable` when one is undecided and a later
 *   test cannot decide it (its email cannot be found or read, or cannot be
 *   classified);
 * - else 3 and `expectations_undecided` when one is undecided and a later
 *   test can decide it;
 * - else nothing: the exit code stays 0.
 */
export function expectationsOutcome(
  expectations: TestEmailRuleResult["expectations"],
  testResults: readonly TestResult[] = [],
): Pick<OperationReport, "exitCode" | "error"> {
  if (!expectations) return {};
  const results = Array.isArray(expectations.results)
    ? expectations.results
    : [];
  const failed = results
    .filter((result) => result.status === "failed")
    .map((result) => result.email_id);
  const undecided = results
    .filter((result) => result.status === "undecided")
    .map((result) => ({
      id: result.email_id,
      reason: undecidedReason(result, testResults),
    }));
  const unresolvable = undecided.filter(({ reason }) => !reason.resolvable);
  const failedCount = Math.max(expectations.counts?.failed ?? 0, failed.length);
  const undecidedCount = Math.max(
    expectations.counts?.undecided ?? 0,
    undecided.length,
  );
  const why = (list: typeof undecided) =>
    list.map(({ id, reason }) => `${id} (${reason.why})`).join(", ");
  if (failedCount > 0)
    return {
      exitCode: EXIT_EXPECTATION_FAILED,
      error: {
        code: "expectations_failed",
        message: `${plural(failedCount, "expectation", "expectations")} failed${failed.length > 0 ? `: ${failed.join(", ")}` : ""}.`,
      },
    };
  if (unresolvable.length > 0)
    return {
      exitCode: EXIT_EXPECTATION_FAILED,
      error: {
        code: "expectations_unresolvable",
        message: `${plural(unresolvable.length, "expectation is", "expectations are")} undecided, and testing again will not decide ${unresolvable.length === 1 ? "it" : "them"}: ${why(unresolvable)}.`,
      },
    };
  if (undecidedCount > 0)
    return {
      exitCode: EXIT_EXPECTATION_UNDECIDED,
      error: {
        code: "expectations_undecided",
        message: `${plural(undecidedCount, "expectation is", "expectations are")} undecided${undecided.length > 0 ? `: ${why(undecided)}` : ""}. Test again later.`,
      },
    };
  return {};
}

/** The stderr report and exit code of a test-email-rule answer. */
export function testEmailRuleReport(data: unknown): OperationReport {
  if (!isRecord(data)) return { lines: [] };
  const result = data as Partial<TestEmailRuleResult>;
  const results = Array.isArray(result.results) ? result.results : [];
  const summary = isRecord(result.summary) ? result.summary : undefined;
  const lines = [
    ...(Array.isArray(summary?.warnings) ? summary.warnings : []).map(
      (warning) => `Warning: ${warning}`,
    ),
    ...scopeWarningLines(result.scope_warnings),
    ...conditionLines(summary),
    ...questionLines(summary, results),
    ...expectationsLines(result.expectations, results),
    ...notMatchedLines(results, result.expectations),
  ];
  return { lines, ...expectationsOutcome(result.expectations, results) };
}

// create-email-rule and update-email-rule

function expectationsCheckLine(
  check: EmailRuleWritten["expectations_check"],
  ruleId: string,
): string | undefined {
  if (!isRecord(check)) return undefined;
  const on =
    typeof check.version === "number"
      ? `version ${check.version}`
      : "the current version";
  const failed = Array.isArray(check.failed) ? check.failed : [];
  const undecided = Array.isArray(check.undecided) ? check.undecided : [];
  if (check.passed && failed.length === 0 && undecided.length === 0)
    return `Expectations on ${on}: all passed.`;
  const parts: string[] = [];
  if (failed.length > 0)
    parts.push(`${failed.length} failed (${failed.join(", ")})`);
  if (undecided.length > 0)
    parts.push(`${undecided.length} undecided (${undecided.join(", ")})`);
  const rest =
    undecided.length > 0
      ? ` To decide the rest, run \`primitive email-rules test-email-rule --rule-id ${ruleId}\`.`
      : "";
  return `Expectations on ${on}: ${parts.length > 0 ? parts.join(", ") : "not passed"}.${rest}`;
}

/** The flag that makes a rule write's exit code follow its expectations_check. */
export const FAIL_ON_EXPECTATIONS_FLAG = "fail-on-expectations";

/**
 * The exit code and --json `error` of a rule write under
 * --fail-on-expectations: 1 when an expectation failed; 3 when none failed but
 * one is undecided, or when expectations this write sent were not checked.
 * Read from the failed and undecided lists first, since a write may answer
 * `passed` as false or as null when nothing failed and something is
 * undecided; any other check that did not pass exits 1.
 */
function writtenExpectationsOutcome(
  check: unknown,
  sentExpectations: boolean,
  ruleId: string,
): Pick<OperationReport, "exitCode" | "error"> {
  const test = `\`primitive email-rules test-email-rule --rule-id ${ruleId}\``;
  if (!isRecord(check)) {
    if (!sentExpectations) return {};
    return {
      exitCode: EXIT_EXPECTATION_UNDECIDED,
      error: {
        code: "expectations_unchecked",
        message: `The expectations this write sent were not checked on it. Test them with ${test}.`,
      },
    };
  }
  const failed = Array.isArray(check.failed) ? check.failed : [];
  const undecided = Array.isArray(check.undecided) ? check.undecided : [];
  if (failed.length > 0)
    return {
      exitCode: EXIT_EXPECTATION_FAILED,
      error: {
        code: "expectations_failed",
        message: `${plural(failed.length, "expectation", "expectations")} failed on this write: ${failed.join(", ")}.`,
      },
    };
  if (undecided.length > 0)
    return {
      exitCode: EXIT_EXPECTATION_UNDECIDED,
      error: {
        code: "expectations_undecided",
        message: `${plural(undecided.length, "expectation is", "expectations are")} undecided on this write, which judges them without classifying mail or asking the rule's questions: ${undecided.join(", ")}. Test them with ${test}.`,
      },
    };
  // Fail closed: a check that names nothing failed or undecided yet did not pass.
  if (check.passed !== true)
    return {
      exitCode: EXIT_EXPECTATION_FAILED,
      error: {
        code: "expectations_failed",
        message: "The write's expectations check did not pass.",
      },
    };
  return {};
}

/** The stderr report of a rule written by create-email-rule or update-email-rule. */
export function writtenEmailRuleReport(
  data: unknown,
  request: { body: unknown; flags?: Record<string, unknown> },
): OperationReport {
  if (!isRecord(data)) return { lines: [] };
  const rule = data as Partial<EmailRuleWritten>;
  const ruleId = typeof rule.id === "string" ? rule.id : "<rule-id>";
  const lines = scopeWarningLines(rule.scope_warnings);
  const sentExpectations =
    isRecord(request.body) && isRecord(request.body.expectations);
  const checked = expectationsCheckLine(rule.expectations_check, ruleId);
  if (checked) lines.push(checked);
  else if (sentExpectations)
    lines.push(
      `Expectations were not checked on this write. Test them with \`primitive email-rules test-email-rule --rule-id ${ruleId}\`.`,
    );
  if (request.flags?.[FAIL_ON_EXPECTATIONS_FLAG] !== true) return { lines };
  return {
    lines,
    ...writtenExpectationsOutcome(
      rule.expectations_check,
      sentExpectations,
      ruleId,
    ),
  };
}

/**
 * A rule write's exit code when its report cannot be built, under
 * --fail-on-expectations: 1 for a check that is there and did not pass, and 3
 * when there is none but the write sent expectations.
 */
function writtenFallbackExitCode(
  data: unknown,
  request: { body: unknown; flags: Record<string, unknown> },
): number | undefined {
  if (request.flags[FAIL_ON_EXPECTATIONS_FLAG] !== true) return undefined;
  const check = isRecord(data) ? data.expectations_check : undefined;
  if (isRecord(check))
    return check.passed !== true ? EXIT_EXPECTATION_FAILED : undefined;
  return isRecord(request.body) && isRecord(request.body.expectations)
    ? EXIT_EXPECTATION_UNDECIDED
    : undefined;
}

// get-email-rule-scope

/** The stderr report of get-email-rule-scope. */
export function emailRuleScopeReport(data: unknown): OperationReport {
  if (!isRecord(data)) return { lines: [] };
  const scope = data as Partial<GetEmailRuleScopeResult>;
  const lines = scopeWarningLines(scope.scope_warnings);
  if (scope.reads_nothing === true) {
    const stopped =
      typeof scope.stopped_reason === "string" && scope.stopped_reason
        ? ` Stopped: ${scope.stopped_reason}.`
        : "";
    lines.push(
      `This rule reads no mail now: it cannot run as its author, or everything its scope names is at none of the organization's domains or no longer read.${stopped}`,
    );
  }
  return { lines };
}

// update-email-rule's 409

function errorDetails(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) return {};
  if (isRecord(payload.details)) return payload.details;
  if (isRecord(payload.error) && isRecord(payload.error.details))
    return payload.error.details;
  return {};
}

/**
 * The hint for update-email-rule's 409 `email_rule_conflict` with
 * `details.reason` `version_moved`: the rule's version is no longer the
 * if_version that was sent, so nothing was saved.
 */
export function versionMovedHint(
  payload: unknown,
  ruleId: unknown,
): string | undefined {
  const details = errorDetails(payload);
  if (details.reason !== "version_moved") return undefined;
  const id = typeof ruleId === "string" && ruleId ? ruleId : "<rule-id>";
  const current =
    typeof details.current_version === "number"
      ? details.current_version
      : undefined;
  const read = `Read it again with \`primitive email-rules get-email-rule ${id}\` and reapply your change to what it shows`;
  return current === undefined
    ? `Hint: the rule's version is not the if_version you sent, so nothing was saved, and the answer did not give its current version. ${read}.`
    : `Hint: the rule's current version is ${current}, not the if_version you sent, so nothing was saved. ${read}, then retry with --if-version ${current}.`;
}

// The flags and reports, by generated operation

const EXPECTATION_FLAG_NOTE =
  "Replaces any expect in --body-file or --raw-body. The exit code follows the answer's expectations; see --help-full.";

export const EMAIL_RULE_OPERATION_EXTENSIONS: Record<
  string,
  OperationExtension
> = {
  testEmailRule: {
    flags: {
      "expect-match": Flags.string({
        description: `An email the rule must match, by id: repeat the flag or give a comma list. Sets expect.match. ${EXPECTATION_FLAG_NOTE}`,
        multiple: true,
        exclusive: ["expect-file"],
      }),
      "expect-no-match": Flags.string({
        description: `An email the rule must not match, by id: repeat the flag or give a comma list. Sets expect.no_match. ${EXPECTATION_FLAG_NOTE}`,
        multiple: true,
        exclusive: ["expect-file"],
      }),
      "expect-file": Flags.string({
        description:
          'A JSON file holding the request\'s expect, such as {"match": ["<email-id>"], "no_match": ["<email-id>"]}. Not with --expect-match or --expect-no-match.',
        exclusive: ["expect-match", "expect-no-match"],
      }),
    },
    bodyFields: expectBodyFields,
    bodyProperties: ["expect"],
    // Fail closed: expectations that are there and not passed exit 1.
    fallbackExitCode: (data) => {
      const expectations = (
        data as { expectations?: { passed?: unknown } } | null
      )?.expectations;
      return expectations && expectations.passed !== true
        ? EXIT_EXPECTATION_FAILED
        : undefined;
    },
    report: testEmailRuleReport,
  },
  createEmailRule: {
    flags: {
      "expectations-file": Flags.string({
        description:
          'A JSON file holding the emails the rule must match and must not, such as {"match": ["<email-id>"], "no_match": ["<email-id>"]}. Sets expectations, over any in --body-file or --raw-body; the answer judges them in expectations_check.',
      }),
      [FAIL_ON_EXPECTATIONS_FLAG]: Flags.boolean({
        description:
          "Exit 1 when an expectation in the answer's expectations_check failed, and 3 when none failed but one is undecided or the expectations this write sent were not checked (test the rule to decide). Without it the command exits 0 whatever the check says.",
      }),
    },
    bodyFields: expectationsBodyFields(false),
    bodyProperties: ["expectations"],
    fallbackExitCode: writtenFallbackExitCode,
    report: writtenEmailRuleReport,
  },
  updateEmailRule: {
    flags: {
      "expectations-file": Flags.string({
        description:
          'A JSON file holding the emails the rule must match and must not, such as {"match": ["<email-id>"], "no_match": ["<email-id>"]}, replacing its saved expectations; a file holding null removes them. Sets expectations, over any in --body-file or --raw-body; the answer judges them in expectations_check.',
      }),
      [FAIL_ON_EXPECTATIONS_FLAG]: Flags.boolean({
        description:
          "Exit 1 when an expectation in the answer's expectations_check failed, and 3 when none failed but one is undecided or the expectations this write sent were not checked (test the rule to decide). Without it the command exits 0 whatever the check says.",
      }),
    },
    bodyFields: expectationsBodyFields(true),
    bodyProperties: ["expectations"],
    fallbackExitCode: writtenFallbackExitCode,
    report: writtenEmailRuleReport,
  },
  getEmailRuleScope: {
    flags: {},
    report: emailRuleScopeReport,
  },
};

// emails facts

type Classification = NonNullable<ListEmailRuleResultsResult["classification"]>;

/** The classification in a listEmailRuleResults answer, or null. */
export function classificationOf(data: unknown): Classification | null {
  if (!isRecord(data) || !isRecord(data.classification)) return null;
  return data.classification as Classification;
}

/** One line per fact: name, value(s) and confidence. */
export function classificationFactLines(
  classification: Classification,
): string[] {
  return Object.entries(
    isRecord(classification.facts) ? classification.facts : {},
  ).map(([name, fact]) => formatFact(name, isRecord(fact) ? fact : {}));
}

/** Why there are no facts to print for an email. */
export function noFactsMessage(data: unknown): string {
  if (classificationOf(data))
    return "This email's classification has no facts.";
  const rules = isRecord(data) && Array.isArray(data.rules) ? data.rules : [];
  const withheld = rules.some(
    (rule) =>
      isRecord(rule) &&
      isRecord(rule.decision) &&
      rule.decision.detail_withheld === true,
  );
  return withheld
    ? "No classification to show: this email's content cannot be read (withheld, failed to parse or discarded)."
    : "No classification for this email yet. It has not been classified (recent mail can take a while, so try again later), it will not be, or its content cannot be read.";
}
