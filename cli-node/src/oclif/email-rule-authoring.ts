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

import { Errors, Flags } from "@oclif/core";
import type {
  DeleteEmailRuleResult,
  EmailRuleScopeWarning,
  EmailRuleWritten,
  GetEmailRuleScopeResult,
  ListEmailRuleResultsResult,
  TestEmailRuleResult,
} from "@primitivedotdev/api-core";
import { withCliCommands } from "./api-path-commands.js";
import {
  ADD_SAMPLES_FILE_FLAG,
  EXPECT_SAMPLES_FILE_FLAG,
  expectSamples,
  LOOK_ALIKES_SAMPLES_FILE_FLAG,
  lookAlikesReport,
  PICK_FLAG,
  pickFlagHelp,
  readJsonFileFlag,
  SAMPLES_FILE_FLAG,
  SAMPLES_MAX,
  samplesBodyFields,
  sentSampleNumber,
} from "./email-rule-samples.js";
import {
  scopeSelectionBodyFields,
  scopeSelectionFlags,
} from "./email-rule-scope-flags.js";
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
        key === "samples"
          ? `${label} takes emails by id only; give made-up emails with ${label.startsWith("--expectations-file") ? "--expectation-samples-file" : "--expect-samples-file"}.`
          : `${label} takes only "match" and "no_match"; "${key}" is not one of them.`,
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

/**
 * `expect` for test-email-rule, from --expect-file or the id flags, with the
 * made-up emails --expect-samples-file holds in expect.samples.
 */
export function expectBodyFields(
  flags: Record<string, unknown>,
): ExtensionBodyField[] {
  const samples = expectSamples(flags);
  const file = flags["expect-file"];
  const expect: Expectations & { samples?: unknown[] } = {};
  const given: string[] = [];
  if (typeof file === "string") {
    Object.assign(
      expect,
      checkExpectations(
        readJsonFileFlag(file, "--expect-file"),
        `--expect-file ${file}`,
      ),
    );
    given.push("--expect-file");
  }
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
  assertDisjoint(expect, given.join(" and "));
  if (samples) {
    expect.samples = samples;
    given.push(`--${EXPECT_SAMPLES_FILE_FLAG}`);
  }
  if (given.length === 0) return [];
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
  // An email that cannot be tested (unparsed, rejected, content discarded)
  // stays that way: testing again never decides it.
  if (outcome === "skipped")
    return { why: skippedText(result), resolvable: false };
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

/** A made-up email the API judged, as a test's expectations carry it. */
type SampleJudgment = {
  index: number;
  label: string | null;
  expected: string;
  outcome: string;
  status: string;
  question_answers: QuestionAnswer[];
};

/** The made-up emails a test's expectations judged, in order. */
function sampleJudgments(expectations: unknown): SampleJudgment[] {
  const list =
    isRecord(expectations) && Array.isArray(expectations.samples)
      ? expectations.samples
      : [];
  return list.filter(isRecord).map((item, position) => ({
    index: typeof item.index === "number" ? item.index : position,
    label: typeof item.label === "string" ? item.label : null,
    expected: String(item.expected ?? ""),
    outcome: String(item.outcome ?? "not_decided"),
    status: String(item.status ?? "undecided"),
    question_answers: Array.isArray(item.question_answers)
      ? (item.question_answers.filter(isRecord) as QuestionAnswer[])
      : [],
  }));
}

/**
 * How a test names a made-up email: by its number in the samples file when
 * --expect-samples-file sent it (the one --pick took it by), else by its
 * place among the rule's saved ones, from 1; with its label.
 */
type SampleNamer = (sample: Pick<SampleJudgment, "index" | "label">) => string;

function sampleNamer(request?: {
  body?: unknown;
  flags?: Record<string, unknown>;
}): SampleNamer {
  const sent =
    isRecord(request?.body) &&
    isRecord(request.body.expect) &&
    Array.isArray(request.body.expect.samples);
  const fromFile =
    sent && typeof request?.flags?.[EXPECT_SAMPLES_FILE_FLAG] === "string";
  return ({ index, label }) => {
    const n = fromFile ? sentSampleNumber(index, request?.flags) : index + 1;
    const name = sent ? `sample ${n}` : `saved sample ${n}`;
    return label ? `${name} ("${label}")` : name;
  };
}

/**
 * Why a made-up email is undecided, and whether a later test can decide it:
 * yes when it was not reached or a question went unanswered; maybe not
 * otherwise, since a spam score it does not carry, a fact its
 * classification left out or a failed classification look the same. A
 * spam score left unset makes one undecided even with a question
 * unanswered, which then reads as decidable later: the answer cannot tell.
 */
function sampleUndecidedReason(sample: SampleJudgment): UndecidedReason {
  if (sample.outcome === "not_decided")
    return {
      why: "it was not reached in time, or deciding it failed",
      resolvable: true,
    };
  const answers = sample.question_answers;
  if (
    answers.some((answer) => answer.answer === null) &&
    !answers.some((answer) => answer.answer === false)
  )
    return { why: "a question went unanswered", resolvable: true };
  return {
    why: "it reads a spam score the sample does not carry, a fact its classification left out, or its classification failed",
    resolvable: false,
    may: true,
  };
}

function sampleLines(sample: SampleJudgment, name: SampleNamer): string[] {
  const note =
    sample.status === "undecided"
      ? ` (${undecidedNote(sampleUndecidedReason(sample))})`
      : "";
  const lines = [
    `  ${sample.status}: ${name(sample)} expected ${sample.expected}, got ${sample.outcome}${note}`,
  ];
  if (sample.question_answers.length > 0)
    lines.push(
      `    questions: ${sample.question_answers.map(answerText).join("; ")}`,
    );
  return lines;
}

function expectationsLines(
  expectations: TestEmailRuleResult["expectations"],
  testResults: readonly TestResult[],
  name: SampleNamer = sampleNamer(),
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
    ...sampleJudgments(expectations)
      .filter((sample) => sample.status !== "passed")
      .flatMap((sample) => sampleLines(sample, name)),
  ];
}

const NOT_MATCHED_ORDER: Record<string, number> = {
  near_miss: 1,
  no_match: 2,
  unclassified: 3,
  skipped: 4,
  not_found: 5,
};

const SKIPPED_REASONS: Record<string, string> = {
  unparsed: "its content failed to parse",
  rejected: "it was rejected and never delivered",
  content_discarded: "its content was discarded",
};

/** Why a skipped email cannot be tested, from its skipped_reason. */
function skippedText(
  result: Pick<TestResult, "skipped_reason"> | undefined,
): string {
  const reason = result?.skipped_reason;
  return `skipped: ${(reason && SKIPPED_REASONS[reason]) ?? (reason ? reason : "it cannot be tested")}`;
}

function notMatchedLine(result: TestResult): string[] {
  if (result.outcome === "skipped")
    return [`  ${result.email_id} ${skippedText(result)}`];
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
  name: SampleNamer = sampleNamer(),
): Pick<OperationReport, "exitCode" | "error"> {
  if (!expectations) return {};
  const results = Array.isArray(expectations.results)
    ? expectations.results
    : [];
  const samples = sampleJudgments(expectations);
  const failed = [
    ...results
      .filter((result) => result.status === "failed")
      .map((result) => result.email_id),
    // Named without their labels here: the message adds its own reasons.
    ...samples
      .filter((sample) => sample.status === "failed")
      .map((sample) => name({ index: sample.index, label: null })),
  ];
  const undecided = [
    ...results
      .filter((result) => result.status === "undecided")
      .map((result) => ({
        id: result.email_id,
        reason: undecidedReason(result, testResults),
      })),
    ...samples
      .filter((sample) => sample.status === "undecided")
      .map((sample) => ({
        id: name({ index: sample.index, label: null }),
        reason: sampleUndecidedReason(sample),
      })),
  ];
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
        message: `${plural(unresolvable.length, "expectation is", "expectations are")} undecided, and testing again ${unresolvable.every(({ reason }) => reason.may) ? "may not decide" : "will not decide"} ${unresolvable.length === 1 ? "it" : "them"}: ${why(unresolvable)}.`,
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
export function testEmailRuleReport(
  data: unknown,
  request?: { body?: unknown; flags?: Record<string, unknown> },
): OperationReport {
  if (!isRecord(data)) return { lines: [] };
  const name = sampleNamer(request);
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
    ...expectationsLines(result.expectations, results, name),
    ...notMatchedLines(results, result.expectations),
  ];
  return {
    lines,
    ...expectationsOutcome(result.expectations, results, name),
  };
}

// create-email-rule and update-email-rule

/** A list of numbers from 0, as the API gives sample indexes. */
function indexList(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((n): n is number => typeof n === "number")
    : [];
}

/**
 * How a rule write names a made-up email its check gives by index, from 0 in
 * the set judged: those this write sends in place of the rule's
 * (expectation_samples), or the rule's saved ones oldest first and then
 * those it adds (add_expectation_samples). One this write sent is "sample
 * N", its number in the samples file --pick took it from (or its place in
 * what was sent); any other is "saved sample N", its place among the rule's.
 * With its label when known. `saved` is the answer's expectation_samples,
 * every one the rule keeps after the write, when it has them.
 */
export function writtenSampleNamer(
  body: unknown,
  flags: Record<string, unknown> | undefined,
  saved?: unknown,
): (index: number) => string {
  const sent =
    isRecord(body) && Array.isArray(body.expectation_samples)
      ? body.expectation_samples
      : null;
  const added =
    isRecord(body) && Array.isArray(body.add_expectation_samples)
      ? body.add_expectation_samples
      : null;
  const kept = Array.isArray(saved) ? saved : null;
  const labelled = (name: string, sample: unknown) =>
    isRecord(sample) && typeof sample.label === "string" && sample.label
      ? `${name} ("${sample.label}")`
      : name;
  return (index) => {
    if (sent)
      return labelled(`sample ${sentSampleNumber(index, flags)}`, sent[index]);
    if (added) {
      // Where the added ones start, known only from the rule's samples after
      // the write; a refused write answers without them.
      const start = kept ? kept.length - added.length : null;
      if (start === null) return `made-up email ${index + 1}`;
      if (index >= start)
        return labelled(
          `sample ${sentSampleNumber(index - start, flags)}`,
          added[index - start],
        );
    }
    return labelled(`saved sample ${index + 1}`, kept?.[index]);
  };
}

function expectationsCheckLine(
  check: EmailRuleWritten["expectations_check"],
  ruleId: string,
  name: (index: number) => string = (index) => `saved sample ${index + 1}`,
): string | undefined {
  if (!isRecord(check)) return undefined;
  const on =
    typeof check.version === "number"
      ? `version ${check.version}`
      : "the current version";
  const failed = Array.isArray(check.failed) ? check.failed : [];
  const undecided = Array.isArray(check.undecided) ? check.undecided : [];
  const failedSamples = indexList(
    (check as Record<string, unknown>).failed_samples,
  );
  const undecidedSamples = indexList(
    (check as Record<string, unknown>).undecided_samples,
  );
  if (
    check.passed &&
    failed.length === 0 &&
    undecided.length === 0 &&
    failedSamples.length === 0 &&
    undecidedSamples.length === 0
  )
    return `Expectations on ${on}: all passed.`;
  const parts: string[] = [];
  if (failed.length > 0)
    parts.push(`${failed.length} failed (${failed.join(", ")})`);
  if (failedSamples.length > 0)
    parts.push(
      `${plural(failedSamples.length, "made-up email", "made-up emails")} failed (${failedSamples.map(name).join(", ")})`,
    );
  // passed null: none failed, but a write judges without classifying mail
  // or asking questions, so some are not decided yet. That is not a failure.
  if (
    failed.length === 0 &&
    failedSamples.length === 0 &&
    (undecided.length > 0 || undecidedSamples.length > 0)
  )
    parts.push("none failed");
  if (undecided.length > 0)
    parts.push(`${undecided.length} undecided (${undecided.join(", ")})`);
  // A saved write's check never judges made-up emails: only the guard
  // before an update with if_expectations_pass does, and it then passed.
  if (undecidedSamples.length > 0)
    parts.push(
      `${plural(undecidedSamples.length, "made-up email", "made-up emails")} not judged by this write (${undecidedSamples.map(name).join(", ")})`,
    );
  const rest =
    undecided.length > 0 || undecidedSamples.length > 0
      ? ` To decide the rest, run \`primitive email-rules test-email-rule --rule-id ${ruleId}\`.`
      : "";
  // On an update that saved a version that did not pass: saved anyway, and whether it is live.
  const note =
    typeof check.note === "string" && check.note.trim()
      ? ` ${check.note.trim()}`
      : "";
  return `Expectations on ${on}: ${parts.length > 0 ? parts.join(", ") : "not passed"}.${rest}${note}`;
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
  /** Said first on update, where the same codes also mean a refused write. */
  saved = "",
  name: (index: number) => string = (index) => `saved sample ${index + 1}`,
): Pick<OperationReport, "exitCode" | "error"> {
  const test = `\`primitive email-rules test-email-rule --rule-id ${ruleId}\``;
  if (!isRecord(check)) {
    if (!sentExpectations) return {};
    return {
      exitCode: EXIT_EXPECTATION_UNDECIDED,
      error: {
        code: "expectations_unchecked",
        message: `${saved}The expectations this write sent were not checked on it. Test them with ${test}.`,
      },
    };
  }
  const failed = [
    ...(Array.isArray(check.failed) ? check.failed : []),
    ...indexList(check.failed_samples).map(name),
  ];
  const undecidedSamples = indexList(check.undecided_samples);
  const undecided = [
    ...(Array.isArray(check.undecided) ? check.undecided : []),
    ...undecidedSamples.map(name),
  ];
  if (failed.length > 0)
    return {
      exitCode: EXIT_EXPECTATION_FAILED,
      error: {
        code: "expectations_failed",
        message: `${saved}${plural(failed.length, "expectation", "expectations")} failed on this write: ${failed.join(", ")}.`,
      },
    };
  if (undecided.length > 0)
    return {
      exitCode: EXIT_EXPECTATION_UNDECIDED,
      error: {
        code: "expectations_undecided",
        message: `${saved}${plural(undecided.length, "expectation is", "expectations are")} undecided on this write, which judges them without classifying mail or asking the rule's questions${undecidedSamples.length > 0 ? ", and leaves made-up emails unjudged" : ""}: ${undecided.join(", ")}. Test them with ${test}.`,
      },
    };
  // Fail closed: a check that names nothing failed or undecided yet did not pass.
  if (check.passed !== true)
    return {
      exitCode: EXIT_EXPECTATION_FAILED,
      error: {
        code: "expectations_failed",
        message: `${saved}The write's expectations check did not pass.`,
      },
    };
  return {};
}

/**
 * update-email-rule's post-save outcome says the write was saved: the server
 * judges a write before saving only when it saves a version or turns the
 * rule active, and refuses with these same codes, saving nothing.
 */
const SAVED_UNJUDGED =
  "The write was saved: the server judges a write before saving only when it saves a version or turns the rule active, so not this one. ";

/** What a written do_not_share rule's report says first. */
const BLOCKS_SHARING =
  "This rule blocks sharing (kind do_not_share): while it is active, no rule shares an email it matches.";

/** A do_not_share rule's protection_note, as a line, or undefined. */
export function protectionLine(rule: unknown): string | undefined {
  if (!isRecord(rule)) return undefined;
  const note = rule.protection_note;
  return typeof note === "string" && note.trim()
    ? `Protection: ${note.trim()}`
    : undefined;
}

/** What a restore_version write saved, as its answer says. */
function restoredLine(
  restored: unknown,
  currentVersion: unknown,
): string | undefined {
  if (!isRecord(restored) || typeof restored.version !== "number")
    return undefined;
  const note =
    typeof restored.note === "string" && restored.note.trim()
      ? ` ${restored.note.trim()}`
      : "";
  const as =
    typeof currentVersion === "number"
      ? `as version ${currentVersion}, now current`
      : "as the current version";
  return `Saved version ${restored.version} again ${as}.${note}`;
}

/**
 * Who an update that saved a version reaches, as its answer counts them: the
 * keys listing the rule, the webhooks those keys own, and the shares the
 * write ended.
 */
export function affectsLine(affects: unknown): string | undefined {
  if (!isRecord(affects)) return undefined;
  const count = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : undefined;
  const keys = count(affects.keys);
  const endpoints = count(affects.endpoints);
  const shares = count(affects.shares_ended);
  if (keys === undefined || endpoints === undefined || shares === undefined)
    return undefined;
  return `This version reaches ${plural(keys, "API key", "API keys")} listing the rule and ${plural(endpoints, "webhook", "webhooks")} those keys own; it ended ${plural(shares, "share", "shares")}. The rule keeps its state.`;
}

/** The rule's author, by name and email where the answer gives them. */
export function authorLine(author: unknown): string | undefined {
  if (!isRecord(author) || typeof author.user_id !== "string") return undefined;
  const name =
    typeof author.name === "string" && author.name.trim()
      ? author.name.trim()
      : null;
  const email =
    typeof author.email === "string" && author.email.trim()
      ? author.email.trim()
      : null;
  if (name && email) return `Author: ${name} <${email}>`;
  if (name || email) return `Author: ${name ?? email}`;
  return `Author: user ${author.user_id} (name and email not shown to you)`;
}

/** The stderr report of a rule written by create-email-rule or update-email-rule. */
export function writtenEmailRuleReport(
  data: unknown,
  request: {
    body: unknown;
    path?: Record<string, unknown>;
    flags?: Record<string, unknown>;
  },
): OperationReport {
  if (!isRecord(data)) return { lines: [] };
  const rule = data as Partial<EmailRuleWritten>;
  const ruleId = typeof rule.id === "string" ? rule.id : "<rule-id>";
  const lines = scopeWarningLines(rule.scope_warnings);
  // A rule that blocks sharing reads like any other in the JSON; say so.
  if ((rule as { kind?: unknown }).kind === "do_not_share") {
    // The server's note says what it protects now; an older server sends
    // none, so say the one thing that was known.
    const note = protectionLine(rule);
    lines.unshift(
      ...(note
        ? [BLOCKS_SHARING, note]
        : [
            `${BLOCKS_SHARING}${typeof rule.state === "string" && rule.state !== "active" ? " It blocks nothing until it is active." : ""}`,
          ]),
    );
  }
  const restored = restoredLine(rule.restored_from, rule.current_version);
  if (restored) lines.push(restored);
  const reach = affectsLine(rule.affects);
  if (reach) lines.push(reach);
  const sentExpectations = sentExpectationsIn(request.body);
  const name = writtenSampleNamer(
    request.body,
    request.flags,
    (rule as Record<string, unknown>).expectation_samples,
  );
  const checked = expectationsCheckLine(rule.expectations_check, ruleId, name);
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
      isUpdate(request) ? SAVED_UNJUDGED : "",
      name,
    ),
  };
}

/** Whether a rule write sent expectations: emails by id, or made-up emails to save or add. */
function sentExpectationsIn(body: unknown): boolean {
  if (!isRecord(body)) return false;
  const some = (value: unknown) => Array.isArray(value) && value.length > 0;
  return (
    isRecord(body.expectations) ||
    some(body.expectation_samples) ||
    some(body.add_expectation_samples)
  );
}

/** Whether a rule write is an update: it names the rule in its path. */
function isUpdate(request: { path?: Record<string, unknown> }): boolean {
  return typeof request.path?.id === "string";
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
  // The same reading as the report's, so the two never disagree.
  return writtenExpectationsOutcome(
    isRecord(data) ? data.expectations_check : undefined,
    sentExpectationsIn(request.body),
    "<rule-id>",
  ).exitCode;
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

// delete-email-rule

/** The delete-email-rule question, naming the rule. */
function deleteEmailRuleQuestion(flags: Record<string, unknown>): string {
  const id = typeof flags.id === "string" ? flags.id : "this rule";
  return `Delete email rule ${id}? Its versions and decisions are deleted with it. [y/N] `;
}

/**
 * What a rule's delete left behind, read from the answer: the shares it
 * ended, and the keys that still list the rule and now read nothing through
 * it. An answer without these fields (an older server) prints nothing.
 */
export function deleteEmailRuleReport(
  data: unknown,
  request: { path: Record<string, unknown> },
): OperationReport {
  if (!isRecord(data)) return { lines: [] };
  const answer = data as Partial<DeleteEmailRuleResult>;
  const lines: string[] = [];
  const ended = Array.isArray(answer.ended_shares)
    ? answer.ended_shares.length
    : 0;
  if (ended > 0) {
    lines.push(
      `Ended ${ended === 1 ? "1 share" : `${ended} shares`} of this rule (end_reason rule_deleted). ${ended === 1 ? "It keeps its record" : "Each keeps its record"}.`,
    );
  }
  const keys = Array.isArray(answer.keys) ? answer.keys : [];
  const others =
    typeof answer.other_keys === "number" && answer.other_keys > 0
      ? answer.other_keys
      : 0;
  const ruleId =
    typeof request.path.id === "string" ? request.path.id : "<rule-id>";
  if (keys.length > 0) {
    lines.push(
      `${keys.length === 1 ? "1 key still lists" : `${keys.length} keys still list`} this rule and now ${keys.length === 1 ? "reads" : "read"} nothing through it:`,
    );
    for (const key of keys) {
      lines.push(`  ${key.id}  ${key.name ?? "(no name)"}  ${key.key_prefix}`);
    }
    lines.push(
      keys.length === 1
        ? `Take the rule off with \`primitive keys update ${keys[0]?.id} --remove-rule ${ruleId}\`, or revoke the key.`
        : `Take the rule off each with \`primitive keys update <key-id> --remove-rule ${ruleId}\`, or revoke them.`,
    );
  }
  if (others > 0) {
    lines.push(
      keys.length > 0
        ? `${others === 1 ? "1 more key" : `${others} more keys`} you cannot read ${others === 1 ? "lists" : "list"} this rule too.`
        : `${others === 1 ? "1 key" : `${others} keys`} you cannot read ${others === 1 ? "lists" : "list"} this rule and now ${others === 1 ? "reads" : "read"} nothing through it.`,
    );
  }
  // A server that says what a delete left but could not read the keys leaves them out.
  if (
    Array.isArray(answer.ended_shares) &&
    answer.keys === undefined &&
    answer.other_keys === undefined
  ) {
    lines.push("Could not check which keys list this rule.");
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

/** The read-again advice every conflict ends with. */
function readAgain(id: string): string {
  return `Read it again with \`primitive email-rules get-email-rule ${id}\` and send the write again`;
}

/**
 * The hint for update-email-rule's refusals: an email_rule_conflict by its
 * details.reason (version_moved, revision_moved, expectations_moved,
 * rule_changed), and the expectations guard's expectations_failed,
 * expectations_undecided, expectations_unreadable and no_expectations.
 * Nothing was saved in any of them.
 */
export function updateEmailRuleErrorHint(
  code: string | undefined,
  payload: unknown,
  ruleId: unknown,
  body?: unknown,
  flags?: Record<string, unknown>,
): string | undefined {
  const id = typeof ruleId === "string" && ruleId ? ruleId : "<rule-id>";
  const details = errorDetails(payload);
  const guarded = isRecord(body) && body.if_expectations_pass === true;
  if (code === "email_rule_conflict") {
    switch (details.reason) {
      case "version_moved":
        return versionMovedHint(payload, ruleId);
      case "revision_moved": {
        const current =
          typeof details.current_revision === "number"
            ? details.current_revision
            : undefined;
        return current === undefined
          ? `Hint: the rule was updated since the if_revision you sent, so nothing was saved. ${readAgain(id)} with --if-revision set to its revision.`
          : `Hint: the rule is now at revision ${current}, not the if_revision you sent, so nothing was saved. ${readAgain(id)}, reapplying your change to what it shows, with --if-revision ${current}.`;
      }
      case "expectations_moved":
        return `Hint: the rule's saved expectations changed while this write was checked against them, so nothing was saved. ${readAgain(id)}.`;
      case "rule_changed":
        return guarded
          ? `Hint: the rule changed after this write was judged against its expectations and before it was saved, so saving it would have gone unchecked; nothing was saved. ${readAgain(id)}.`
          : `Hint: the rule changed while this write was being saved, so nothing was saved. ${readAgain(id)}.`;
      default:
        return undefined;
    }
  }
  if (code === "expectations_failed" || code === "expectations_undecided") {
    const check = isRecord(details.expectations_check)
      ? details.expectations_check
      : {};
    const failed = Array.isArray(check.failed) ? check.failed : [];
    const undecided = Array.isArray(check.undecided) ? check.undecided : [];
    const name = writtenSampleNamer(body, flags);
    const failedAll = [...failed, ...indexList(check.failed_samples).map(name)];
    const undecidedSamples = indexList(check.undecided_samples);
    const undecidedAll = [...undecided, ...undecidedSamples.map(name)];
    const parts = [
      ...(failedAll.length > 0 ? [`failed: ${failedAll.join(", ")}`] : []),
      ...(undecidedAll.length > 0
        ? [`undecided: ${undecidedAll.join(", ")}`]
        : []),
    ];
    // A refused write answers without the rule's samples, so an added one is
    // numbered in the set judged: said once, after the list.
    const addedOrder =
      isRecord(body) &&
      Array.isArray(body.add_expectation_samples) &&
      indexList(check.failed_samples).length + undecidedSamples.length > 0
        ? " Made-up emails are numbered from 1: the rule's saved ones first, then those this write adds."
        : "";
    const which =
      parts.length > 0 ? ` Expectations ${parts.join("; ")}.${addedOrder}` : "";
    const reason = String(details.reason);
    // A reason the answer gives says what to do; with none, a made-up email
    // may stay undecided.
    // The same reading as updateEmailRuleErrorExitCode's, so the hint and
    // the exit code never disagree.
    const samplesMayStay = undecidedSamplesMayStay(
      undecidedSamples.length,
      reason,
    );
    const byReason =
      reason !== "none" && Object.hasOwn(UNDECIDED_NEXT_STEP, reason)
        ? (UNDECIDED_NEXT_STEP[reason] as string)
        : UNDECIDED_NEXT_STEP.none;
    const next =
      code === "expectations_failed"
        ? ""
        : samplesMayStay
          ? `${undecided.length > 0 ? ` ${byReason}` : ""} ${UNDECIDED_SAMPLES_NEXT_STEP} ${refusedSampleTest(body, id)}`
          : ` ${byReason}`;
    return `Hint: the rule, as this write would leave it, was judged against its expectations before saving (if_expectations_pass), and nothing was saved.${which}${next} The command exits ${updateEmailRuleErrorExitCode(payload) ?? EXIT_EXPECTATION_FAILED}.`;
  }
  if (code === "expectations_unreadable") {
    // Emails the rule cannot read (deleted, or outside its scope or its
    // author's mail): no later write decides them, so it exits 1, not 3.
    const unreadable = Array.isArray(details.unreadable)
      ? details.unreadable
          .filter(
            (entry) => entry !== null && entry !== undefined && entry !== "",
          )
          .map(String)
      : [];
    const one = unreadable.length === 1;
    const named = unreadable.length > 0 ? `: ${unreadable.join(", ")}` : "";
    const them = one ? "it" : "them";
    return `Hint: the rule, as this write would leave it, was judged against its expectations before saving (if_expectations_pass), and nothing was saved. ${one ? "An expectation names an email" : "Expectations name emails"} this rule cannot read (deleted, or outside its scope or its author's mail)${named}. Sending the write again will not decide ${them}: send --expectations-file without ${them}, or an evaluation_scope that reads ${them}. The command exits ${EXIT_EXPECTATION_FAILED}.`;
  }
  if (code === "no_expectations")
    return "Hint: nothing was saved. Give the rule expectations with --expectations-file or made-up emails with --expectation-samples-file or --add-expectation-samples-file (in this write or before it), or send the write without if_expectations_pass (--fail-on-expectations or --if-expectations-pass).";
  return undefined;
}

/** The reasons a guard's undecided judgment can be decided by sending the write again. */
const RETRYABLE_REASONS: ReadonlySet<string> = new Set([
  "deadline",
  "error",
  "client_gone",
]);

/**
 * A made-up email can stay undecided: one that reads a spam score it does
 * not carry, or whose classification failed or left out a fact the rule
 * needs, decides the same way every time.
 */
const UNDECIDED_SAMPLES_NEXT_STEP =
  "A made-up email undecided for no reason given may stay so (a spam score it does not carry, a fact its classification left out, or a failed classification), so sending the write again may not decide it.";

/**
 * How to see why a refused write's made-up emails are undecided: only
 * test-email-rule-on-sample answers with what a made-up email lacked. Test
 * the tree this write sent (or the version it restores), else the rule, on
 * each. Nothing was saved, so a test by rule id would see neither.
 */
function refusedSampleTest(body: unknown, ruleId: string): string {
  const onSample = "`primitive email-rules test-email-rule-on-sample`";
  if (isRecord(body) && isRecord(body.tree))
    return `To see why, test the tree this write sent on each with ${onSample}.`;
  if (isRecord(body) && typeof body.restore_version === "number")
    return `To see why, test version ${body.restore_version}'s tree (\`primitive email-rules list-email-rule-versions ${ruleId} --versions ${body.restore_version}\`) on each with ${onSample}.`;
  // Only samples sent in place of the rule's leave none of its saved ones
  // to look up.
  const sent = isRecord(body) && Array.isArray(body.expectation_samples);
  return `To see why, test rule ${ruleId} on each with ${onSample}${sent ? "" : ` (\`primitive email-rules get-email-rule ${ruleId}\` lists its saved ones)`}.`;
}

/** What to do about an undecided judgment, by details.reason ("none": no reason given). */
const UNDECIDED_NEXT_STEP: Readonly<Record<string, string>> = {
  none: "Some could not be decided yet (mail not classified yet, or a question not answered yet); send the write again later.",
  deadline: "The judgment ran out of time; send the write again.",
  error: "The judgment could not finish; send the write again.",
  client_gone: "The request ended before the write was saved; send it again.",
  author_unresolvable:
    "The rule cannot run as its author over the mail it would cover (details.author_reason), so sending the write again will not decide them.",
};

/**
 * update-email-rule's exit code for the expectations guard's refusals: 1 when
 * one failed, or when they may not be decided by trying again (an expectation
 * names an email the rule cannot read, the rule cannot run as its author, or
 * a made-up email is undecided for no reason the answer gives); 3 when trying
 * again later can decide them.
 */
export function updateEmailRuleErrorExitCode(
  payload: unknown,
): number | undefined {
  const code = isRecord(payload) ? payload.code : undefined;
  if (code === "expectations_failed" || code === "expectations_unreadable")
    return EXIT_EXPECTATION_FAILED;
  if (code !== "expectations_undecided") return undefined;
  const details = errorDetails(payload);
  if (details.reason === "author_unresolvable") return EXIT_EXPECTATION_FAILED;
  const check = isRecord(details.expectations_check)
    ? details.expectations_check
    : {};
  return undecidedSamplesMayStay(
    indexList(check.undecided_samples).length,
    String(details.reason),
  )
    ? EXIT_EXPECTATION_FAILED
    : EXIT_EXPECTATION_UNDECIDED;
}

/**
 * Whether a guard's undecided made-up emails may stay undecided: some are,
 * and the answer gives no reason that sending the write again can change
 * (author_unresolvable has its own advice and exit code).
 */
function undecidedSamplesMayStay(count: number, reason: string): boolean {
  return (
    count > 0 &&
    !RETRYABLE_REASONS.has(reason) &&
    reason !== "author_unresolvable"
  );
}

// compile-email-rule

/** The stderr report of compile-email-rule: how many recent emails it holds for. */
export function compileEmailRuleReport(data: unknown): OperationReport {
  if (!isRecord(data)) return { lines: [] };
  const lines = (Array.isArray(data.warnings) ? data.warnings : [])
    .filter(
      (warning): warning is string =>
        typeof warning === "string" && warning.trim() !== "",
    )
    .map((warning) => `Warning: ${warning.trim()}`);
  const breadth = data.breadth;
  if (
    isRecord(breadth) &&
    typeof breadth.checked === "number" &&
    typeof breadth.matched === "number"
  )
    lines.push(
      `Breadth: its conditions hold for ${breadth.matched} of ${plural(breadth.checked, "recent email", "recent emails")} checked in your own mailboxes, whatever scope you save it with.`,
    );
  return { lines };
}

// get-email-rule

/** The stderr report of get-email-rule: who wrote it, and its revision. */
export function getEmailRuleReport(data: unknown): OperationReport {
  if (!isRecord(data)) return { lines: [] };
  const lines: string[] = [];
  const author = authorLine(data.author);
  if (author) lines.push(author);
  const protection = protectionLine(data);
  if (protection) lines.push(protection);
  if (typeof data.revision === "number")
    lines.push(
      `Revision ${data.revision}: pass --if-revision ${data.revision} to update-email-rule so a change made since is never replaced unseen.`,
    );
  return { lines };
}

// list-email-rules

/** The stderr report of list-email-rules: the protective rules that protect nothing yet, or less than they seem. */
export function listEmailRulesReport(data: unknown): OperationReport {
  const rules = Array.isArray(data) ? data : [];
  const lines: string[] = [];
  for (const rule of rules) {
    if (!isRecord(rule)) continue;
    const note =
      typeof rule.protection_note === "string"
        ? rule.protection_note.trim()
        : "";
    if (!note) continue;
    const id = typeof rule.id === "string" ? rule.id : "<rule-id>";
    const name = typeof rule.name === "string" ? rule.name : "no name";
    lines.push(`Protection of ${id} (${name}): ${note}`);
  }
  return { lines };
}

// The flags and reports, by generated operation

/** create-email-rule's --fail-on-expectations: the exit code follows the check made after saving. */
const FAIL_ON_EXPECTATIONS_HELP =
  "Exit 1 when an expectation in the answer's expectations_check failed, and 3 when none failed but one is undecided or the expectations this write sent were not checked (test the rule to decide). A create does not judge made-up emails, so with some it exits 3. Without it the command exits 0 whatever the check says.";

/** update-email-rule's --fail-on-expectations: the server refuses the write. */
const UPDATE_FAIL_ON_EXPECTATIONS_HELP =
  "Refuse the write unless the rule, as this write would leave it, passes its expectations. It sends if_expectations_pass (over any in --body-file or --raw-body), so the server judges a new version, a restored one, a new scope or turning the rule active before saving, on its emails by id and its made-up emails, and saves nothing when one failed (exit 1), one names an email the rule cannot read (exit 1, since sending again never decides it), one is undecided (exit 3, or 1 when the rule cannot run as its author or a made-up email is undecided for no reason the answer gives) or the rule has none (exit 1). It can take as long as a test of the rule; the command waits for it. Judging needs a credential that reads the mail's content. A write the server does not judge (one changing only expectations, say) is saved, and the exit code then follows the answer's expectations_check, as on create. With --json, a refused write's document holds the API's error alone; a saved write's holds the rule.";

/** What a samples file flag reads. */
const SAMPLES_FILE_SHAPE =
  'A JSON file of made-up emails the rule must match or not: an array such as [{"expected": "no_match", "label": "a personal bill", "email": {...}}], with email as test-email-rule-on-sample takes it (text up to 4,000 characters, at most 10 each of to, cc and attachment_types), like the one generate-look-alikes --samples-file writes, or a generate-look-alikes answer saved as it printed it.';

const EXPECTATION_FLAG_NOTE =
  "Replaces any expect in --body-file or --raw-body. The answer reports them in expectations (passed, counts, results) and the exit code follows it; see --help-full.";

/**
 * update-email-rule's --fail-on-expectations sends if_expectations_pass, over
 * any in the body. Asking for it while turning it off is refused.
 */
function expectationsGuardBodyFields(
  flags: Record<string, unknown>,
): ExtensionBodyField[] {
  if (flags[FAIL_ON_EXPECTATIONS_FLAG] !== true) return [];
  if (flags["if-expectations-pass"] === false)
    throw usageError(
      "--fail-on-expectations asks the server to judge the write before saving it; it cannot be combined with --no-if-expectations-pass.",
    );
  return [
    {
      flag: `--${FAIL_ON_EXPECTATIONS_FLAG}`,
      property: "if_expectations_pass",
      value: true,
    },
  ];
}

/**
 * The stderr report of end-email-rule-share: the answer's note, which says
 * the rule itself is left as it was (ending a share does not turn it off)
 * and, to the member who shared, how to stop it.
 */
export function endEmailRuleShareReport(data: unknown): OperationReport {
  const note =
    isRecord(data) && typeof data.note === "string" ? data.note.trim() : "";
  return { lines: note ? [note] : [] };
}

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
          'A JSON file holding the emails the request\'s expect names by id, such as {"match": ["<email-id>"], "no_match": ["<email-id>"]}; made-up emails go in --expect-samples-file. Not with --expect-match or --expect-no-match.',
        exclusive: ["expect-match", "expect-no-match"],
      }),
      [EXPECT_SAMPLES_FILE_FLAG]: Flags.string({
        description: `${SAMPLES_FILE_SHAPE} Sets expect.samples (at most ${SAMPLES_MAX}), beside any emails by id; the answer judges each in expectations.samples (index from 0 over those sent), and the report names each by its number in the file. Like any expect, it replaces a saved rule's own expectations and samples for this test. ${EXPECTATION_FLAG_NOTE}`,
      }),
      [PICK_FLAG]: Flags.string({
        description: pickFlagHelp([EXPECT_SAMPLES_FILE_FLAG]),
      }),
      ...scopeSelectionFlags(),
    },
    bodyFields: (flags, base) => [
      ...expectBodyFields(flags),
      ...scopeSelectionBodyFields(flags, base),
    ],
    bodyProperties: ["expect", "scope_selection"],
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
          'A JSON file holding the emails the rule must match and must not, such as {"match": ["<email-id>"], "no_match": ["<email-id>"]}. Sets expectations, over any in --body-file or --raw-body; the answer judges them in expectations_check (passed, decided, failed, undecided); the report test-email-rule answers with is named expectations instead.',
      }),
      [SAMPLES_FILE_FLAG]: Flags.string({
        description: `${SAMPLES_FILE_SHAPE} Sets expectation_samples (at most ${SAMPLES_MAX}), over any in --body-file or --raw-body. A create does not judge them; test-email-rule --rule-id does.`,
      }),
      [PICK_FLAG]: Flags.string({
        description: pickFlagHelp([SAMPLES_FILE_FLAG]),
      }),
      [FAIL_ON_EXPECTATIONS_FLAG]: Flags.boolean({
        description: FAIL_ON_EXPECTATIONS_HELP,
      }),
      ...scopeSelectionFlags(),
    },
    bodyFields: (flags, base) => [
      ...expectationsBodyFields(false)(flags),
      ...samplesBodyFields(false)(flags),
      ...scopeSelectionBodyFields(flags, base),
    ],
    bodyProperties: ["expectations", "expectation_samples", "scope_selection"],
    fallbackExitCode: writtenFallbackExitCode,
    report: writtenEmailRuleReport,
  },
  updateEmailRule: {
    flags: {
      "expectations-file": Flags.string({
        description:
          'A JSON file holding the emails the rule must match and must not, such as {"match": ["<email-id>"], "no_match": ["<email-id>"]}, replacing its saved expectations; a file holding null removes them. Sets expectations, over any in --body-file or --raw-body; the answer judges them in expectations_check (passed, decided, failed, undecided); the report test-email-rule answers with is named expectations instead.',
      }),
      [SAMPLES_FILE_FLAG]: Flags.string({
        description: `${SAMPLES_FILE_SHAPE} They replace the rule's saved ones, and a file holding [] removes them. Sets expectation_samples, over any in --body-file or --raw-body. Not with --${ADD_SAMPLES_FILE_FLAG}. The write judges them only with --${FAIL_ON_EXPECTATIONS_FLAG}, and only when it saves a version or turns the rule active.`,
        exclusive: [ADD_SAMPLES_FILE_FLAG],
      }),
      [ADD_SAMPLES_FILE_FLAG]: Flags.string({
        description: `${SAMPLES_FILE_SHAPE} They are added to the rule's saved ones, ${SAMPLES_MAX} at most in all. Sets add_expectation_samples, over any in --body-file or --raw-body. Not with --${SAMPLES_FILE_FLAG}. The write judges them only with --${FAIL_ON_EXPECTATIONS_FLAG}, and only when it saves a version or turns the rule active.`,
        exclusive: [SAMPLES_FILE_FLAG],
      }),
      [PICK_FLAG]: Flags.string({
        description: pickFlagHelp([SAMPLES_FILE_FLAG, ADD_SAMPLES_FILE_FLAG]),
      }),
      [FAIL_ON_EXPECTATIONS_FLAG]: Flags.boolean({
        description: UPDATE_FAIL_ON_EXPECTATIONS_HELP,
      }),
      ...scopeSelectionFlags(),
    },
    bodyFields: (flags, base) => [
      ...expectationsBodyFields(true)(flags),
      ...samplesBodyFields(true)(flags),
      ...expectationsGuardBodyFields(flags),
      ...scopeSelectionBodyFields(flags, base),
    ],
    bodyProperties: [
      "expectations",
      "expectation_samples",
      "add_expectation_samples",
      "scope_selection",
    ],
    errorExitCode: updateEmailRuleErrorExitCode,
    fallbackExitCode: writtenFallbackExitCode,
    report: writtenEmailRuleReport,
  },
  generateLookAlikes: {
    flags: {
      [LOOK_ALIKES_SAMPLES_FILE_FLAG]: Flags.string({
        description: `Also write the look-alikes to this JSON file as made-up emails the rule must match or not (each keeps its expected: most must not match, and a near case it should take must match), a JSON array numbered from 1 in the order the report prints them. Save the ones you choose with create-email-rule --${SAMPLES_FILE_FLAG}, update-email-rule --${ADD_SAMPLES_FILE_FLAG} or, for a request, accept-email-rule-request --${SAMPLES_FILE_FLAG}, with --pick; test an edited rule on them with test-email-rule --${EXPECT_SAMPLES_FILE_FLAG}. Replaces the file if it exists, once the call succeeds; when no look-alikes came back it leaves the file as it was and exits 1. The numbered report is printed on stderr, and only without --json, which prints exactly one JSON document and nothing on stderr; the answer's look_alikes and this file hold the same emails in the same order, so with --json the file still gives the numbered set to --pick from.`,
      }),
      ...scopeSelectionFlags(),
    },
    bodyFields: scopeSelectionBodyFields,
    bodyProperties: ["scope_selection"],
    report: lookAlikesReport,
  },
  testEmailRuleOnSample: {
    flags: scopeSelectionFlags(),
    bodyFields: scopeSelectionBodyFields,
    bodyProperties: ["scope_selection"],
  },
  acceptEmailRuleRequest: {
    flags: {
      [SAMPLES_FILE_FLAG]: Flags.string({
        description: `${SAMPLES_FILE_SHAPE} Sets expectation_samples (at most ${SAMPLES_MAX}), over any in --body-file or --raw-body: they are kept on the rule this accept writes, such as the look-alikes of the request, each keeping whether it must match.`,
      }),
      [PICK_FLAG]: Flags.string({
        description: pickFlagHelp([SAMPLES_FILE_FLAG]),
      }),
    },
    bodyFields: samplesBodyFields(false),
    bodyProperties: ["expectation_samples"],
  },
  compileEmailRule: {
    flags: {},
    report: compileEmailRuleReport,
  },
  endEmailRuleShare: {
    flags: {},
    report: endEmailRuleShareReport,
  },
  getEmailRule: {
    flags: {},
    report: getEmailRuleReport,
  },
  listEmailRules: {
    flags: {},
    report: listEmailRulesReport,
  },
  getEmailRuleScope: {
    flags: {},
    report: emailRuleScopeReport,
  },
  deleteEmailRule: {
    flags: {
      yes: Flags.boolean({
        char: "y",
        description:
          "Delete without asking for confirmation. Needed without a terminal, and with --json.",
      }),
    },
    confirm: {
      question: deleteEmailRuleQuestion,
      noTerminal:
        "Not deleting: no terminal to confirm in. Pass --yes to delete the rule without a prompt.",
      cancelled: "Cancelled. The rule was not deleted.",
    },
    report: deleteEmailRuleReport,
  },
};

// emails facts

export type Classification = NonNullable<
  ListEmailRuleResultsResult["classification"]
>;

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
