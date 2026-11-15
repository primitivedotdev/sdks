// Authoring email rules from the CLI: flags on the generated email-rules
// commands that set a test's `expect` and a rule's saved `expectations`, and
// the readable reports those commands print on stderr after their JSON.
//
//   primitive email-rules test-email-rule --rule-id <id> \
//     --expect-match <email-id>,<email-id> --expect-no-match <email-id>
//
// test-email-rule's exit code follows the expectations the answer judged
// (expect, or a saved rule's own): 1 when one failed, or is undecided and
// testing again cannot decide it; 3 when the only ones not passed are
// undecided and a later test can decide them; else 0. Under --json the
// report is left out and the document gains `error` and `exit_code` when
// the exit code is not 0. A write the API refuses exits 1 with the API's
// error.
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
import { shownLine, shownText } from "./terminal-text.js";

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
      if (seen.has(id.toLowerCase())) continue;
      seen.add(id.toLowerCase());
      ids.push(id);
    }
  }
  if (ids.length === 0)
    throw usageError(`${flag} needs at least one email id.`);
  return ids;
}

/**
 * A JSON value given as a rule's expectations or a test's `expect`: a JSON
 * object, sent as it is (the API checks what it holds). Made-up emails have
 * their own flag.
 */
export function checkExpectations(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (!isRecord(value))
    throw usageError(
      `${label} must hold a JSON object such as {"match": ["<email-id>"], "no_match": ["<email-id>"]}.`,
    );
  if ("samples" in value)
    throw usageError(
      `${label} takes emails by id only; give made-up emails with ${label.startsWith("--expectations-file") ? "--expectation-samples-file" : "--expect-samples-file"}.`,
    );
  return value;
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
  const expect: Record<string, unknown> = {};
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
  if (samples) {
    expect.samples = samples;
    given.push(`--${EXPECT_SAMPLES_FILE_FLAG}`);
  }
  if (given.length === 0) return [];
  return [{ flag: given.join(", "), property: "expect", value: expect }];
}

/** test-email-rule's flag that tests the emails an earlier answer tested. */
export const SAME_EMAILS_FLAG = "same-emails-as";

/**
 * `email_ids` for test-email-rule, from --same-emails-as: every email an
 * earlier test's answer, saved as it printed it, tested (its results'
 * email_id), so a second tree is tested over the same mail rather than over
 * whatever is newest by then.
 */
export function sameEmailsBodyFields(
  flags: Record<string, unknown>,
): ExtensionBodyField[] {
  const file = flags[SAME_EMAILS_FLAG];
  if (typeof file !== "string") return [];
  const saved = readJsonFileFlag(file, `--${SAME_EMAILS_FLAG}`);
  // The answer as --json prints it, or with --envelope.
  const answer = isRecord(saved) && isRecord(saved.data) ? saved.data : saved;
  const results =
    isRecord(answer) && Array.isArray(answer.results) ? answer.results : null;
  if (!results)
    throw usageError(
      `--${SAME_EMAILS_FLAG} ${file} is not a saved test-email-rule answer: it has no results. Save one with test-email-rule --json > answer.json.`,
    );
  const ids = [
    ...new Set(
      results.flatMap((result) =>
        isRecord(result) &&
        typeof result.email_id === "string" &&
        isEmailId(result.email_id)
          ? [result.email_id.toLowerCase()]
          : [],
      ),
    ),
  ];
  if (ids.length === 0)
    throw usageError(`--${SAME_EMAILS_FLAG} ${file} names no emails.`);
  return [{ flag: `--${SAME_EMAILS_FLAG}`, property: "email_ids", value: ids }];
}

/**
 * `expectations` for create-email-rule and update-email-rule, from
 * --expectations-file. A file holding `null` removes the saved expectations
 * (the API takes that on update only).
 */
export function expectationsBodyFields(
  flags: Record<string, unknown>,
): ExtensionBodyField[] {
  const file = flags["expectations-file"];
  if (typeof file !== "string") return [];
  const value = readJsonFileFlag(file, "--expectations-file");
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

const unitInterval = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1;

/**
 * How sure an answer is, from 0 to 1: the answer's `confidence`, the number
 * a webhook payload carries for it. Null for an unanswered question, or a
 * confidence that is not a number from 0 to 1.
 */
export function answerConfidence(answer: QuestionAnswer): number | null {
  if (typeof answer.answer !== "boolean") return null;
  return unitInterval(answer.confidence) ? answer.confidence : null;
}

/** Why an expectation is undecided, and whether testing again later can decide it. */
type Undecided = { reason: string; retryable: boolean };

/** Unclassified reasons a later test can get past. */
const RETRYABLE_UNCLASSIFIED = new Set(["pending", "classifier_unavailable"]);
/** Outcomes decided on an email's conditions: undecided then means a question went unanswered. */
const DECIDED_OUTCOMES = new Set(["matched", "near_miss", "no_match"]);

/**
 * The server's `retryable` and `reason` on an undecided entry when it gives
 * them. Otherwise read from the outcome: an email not classified yet, or
 * decided on its conditions with a question unanswered, and a sample not
 * reached or with a question unanswered, can be decided later; nothing else
 * can.
 */
export function undecidedOf(
  entry: unknown,
  result?: Pick<TestResult, "outcome" | "unclassified_reason">,
  questionAnswers: readonly QuestionAnswer[] = [],
): Undecided {
  const given = isRecord(entry) ? entry : {};
  const outcome = String(result?.outcome ?? given.outcome ?? "");
  const unclassified = result?.unclassified_reason ?? "";
  const unanswered =
    (result !== undefined && DECIDED_OUTCOMES.has(outcome)) ||
    questionAnswers.some((answer) => answer.answer === null);
  const fallback: Undecided =
    outcome === "unclassified"
      ? {
          reason: unclassified || "unclassified",
          retryable: RETRYABLE_UNCLASSIFIED.has(unclassified),
        }
      : outcome === "not_decided"
        ? { reason: "not_decided", retryable: true }
        : unanswered
          ? { reason: "question_unanswered", retryable: true }
          : { reason: outcome || "undecided", retryable: false };
  return {
    reason: typeof given.reason === "string" ? given.reason : fallback.reason,
    retryable:
      typeof given.retryable === "boolean"
        ? given.retryable
        : fallback.retryable,
  };
}

function undecidedNote(undecided: Undecided): string {
  return `${undecided.reason}; ${undecided.retryable ? "test again later" : "testing again will not decide it"}`;
}

function answerText(answer: QuestionAnswer): string {
  const verdict =
    answer.answer === true
      ? "yes"
      : answer.answer === false
        ? "no"
        : "unanswered";
  const sure = answerConfidence(answer);
  const at = sure === null ? "" : ` at ${confidence(sure)}`;
  const error = answer.error_class ? ` (${answer.error_class})` : "";
  return `"${answer.question}" ${verdict}${at}${error}`;
}

function conditionLines(summary: TestEmailRuleResult["summary"]): string[] {
  const conditions = Array.isArray(summary?.conditions)
    ? summary.conditions
    : [];
  if (conditions.length === 0) return [];
  // How many of those decided the conditions held for together, before any
  // question.
  const held = summary?.conditions_held;
  const together =
    typeof held === "number" ? `; together they held on ${held}` : "";
  return [
    `Conditions (${summary?.decided ?? 0} decided${together}):`,
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

/** An undecided email expectation, read with its email's test result. */
function emailUndecided(
  expectation: Pick<ExpectationResult, "email_id" | "outcome">,
  results: readonly TestResult[],
): Undecided {
  const result = results.find(
    (entry) =>
      entry.email_id.toLowerCase() === expectation.email_id.toLowerCase(),
  );
  return undecidedOf(expectation, result, result?.question_answers ?? []);
}

function expectationLine(
  result: ExpectationResult,
  results: readonly TestResult[],
): string {
  const note =
    result.status === "undecided"
      ? undecidedNote(emailUndecided(result, results))
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
  /** The entry as the API gave it, for its retryable and reason. */
  entry: Record<string, unknown>;
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
    entry: item,
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
    // A saved one also by the index from 0 the API names it by, as rule writes name it.
    if (!sent)
      return `saved sample ${n} (index ${index}${label ? `, "${label}"` : ""})`;
    const name = `sample ${n}`;
    return label ? `${name} ("${label}")` : name;
  };
}

function sampleLines(sample: SampleJudgment, name: SampleNamer): string[] {
  const note =
    sample.status === "undecided"
      ? ` (${undecidedNote(undecidedOf(sample.entry, undefined, sample.question_answers))})`
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

function notMatchedLine(result: TestResult): string[] {
  if (result.outcome === "skipped")
    return [
      `  ${result.email_id} skipped${result.skipped_reason ? ` (${result.skipped_reason})` : ""}`,
    ];
  if (result.outcome === "unclassified") {
    const reason = result.unclassified_reason;
    const note = !reason
      ? ""
      : RETRYABLE_UNCLASSIFIED.has(reason)
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
  return [...lines, ...attachmentsLine(result)];
}

/**
 * The file names a matched or near-miss result lists (attachment_names), on
 * one line under it: the names its questions are given, shown as shownText
 * shows a sender's text.
 */
function attachmentsLine(result: TestResult): string[] {
  const names = (result as { attachment_names?: unknown }).attachment_names;
  if (!Array.isArray(names)) return [];
  const shown = names.map(shownText).filter(Boolean);
  return shown.length > 0 ? [`    attachments: ${shown.join(", ")}`] : [];
}

/**
 * The matched emails, each with who sent it, its subject and its attachments'
 * file names, so a match can be judged without opening it; cut as the not
 * matched list is.
 */
function matchedLines(
  results: readonly TestResult[],
  expectations: TestEmailRuleResult["expectations"],
): string[] {
  // An email an expectation failed or left undecided on comes first, as in
  // the not matched list, so the cut never drops it.
  const flagged = new Set(
    (expectations?.results ?? [])
      .filter((result) => result.status !== "passed")
      .map((result) => result.email_id),
  );
  const matched = results
    .filter((result) => result.outcome === "matched")
    .map((result, position) => ({ result, position }))
    .sort(
      (a, b) =>
        Number(flagged.has(b.result.email_id)) -
          Number(flagged.has(a.result.email_id)) || a.position - b.position,
    )
    .map(({ result }) => result);
  if (matched.length === 0) return [];
  const shown = matched.slice(0, NOT_MATCHED_LIST_LIMIT);
  const header =
    shown.length < matched.length
      ? `Matched (${shown.length} of ${matched.length} shown; the JSON has every result):`
      : `Matched (${matched.length}):`;
  return [
    header,
    ...shown.flatMap((result) => {
      const from = shownText(result.from_address);
      const subject = shownText(result.subject);
      const about = [from, subject ? `"${subject}"` : ""].filter(Boolean);
      return [
        `  ${result.email_id}${about.length > 0 ? ` ${about.join(" ")}` : ""}`,
        ...attachmentsLine(result),
      ];
    }),
  ];
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
 * - 1 and `expectations_failed` when one failed (emails or samples);
 * - else 1 and `expectations_undecided` when one is undecided and testing
 *   again cannot decide it;
 * - else 3 and `expectations_undecided` when one is undecided;
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
        ...emailUndecided(result, testResults),
      })),
    ...samples
      .filter((sample) => sample.status === "undecided")
      .map((sample) => ({
        id: name({ index: sample.index, label: null }),
        ...undecidedOf(sample.entry, undefined, sample.question_answers),
      })),
  ];
  const failedCount = Math.max(expectations.counts?.failed ?? 0, failed.length);
  const undecidedCount = Math.max(
    expectations.counts?.undecided ?? 0,
    undecided.length,
  );
  const why = (list: typeof undecided) =>
    list.map(({ id, reason }) => `${id} (${reason})`).join(", ");
  if (failedCount > 0)
    return {
      exitCode: EXIT_EXPECTATION_FAILED,
      error: {
        code: "expectations_failed",
        message: `${plural(failedCount, "expectation", "expectations")} failed${failed.length > 0 ? `: ${failed.join(", ")}` : ""}.`,
      },
    };
  if (undecidedCount === 0) return {};
  const final = undecided.filter(({ retryable }) => !retryable);
  if (final.length > 0)
    return {
      exitCode: EXIT_EXPECTATION_FAILED,
      error: {
        code: "expectations_undecided",
        message: `${plural(undecidedCount, "expectation is", "expectations are")} undecided, and testing again will not decide ${final.length === 1 ? "this one" : "these"}: ${why(final)}.`,
      },
    };
  return {
    exitCode: EXIT_EXPECTATION_UNDECIDED,
    error: {
      code: "expectations_undecided",
      message: `${plural(undecidedCount, "expectation is", "expectations are")} undecided${undecided.length > 0 ? `: ${why(undecided)}` : ""}. Test again later.`,
    },
  };
}

/** A time an answer gives, to the minute, in UTC. */
function minuteUtc(value: string): string {
  const at = new Date(value);
  return Number.isNaN(at.getTime())
    ? shownLine(value)
    : `${at.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/** The first line of a test report: which mail was tested. */
function windowLine(data: Record<string, unknown>, tested: number): string[] {
  const window = isRecord(data.window) ? data.window : undefined;
  const oldest =
    typeof window?.oldest_at === "string" ? window.oldest_at : undefined;
  const newest =
    typeof window?.newest_at === "string" ? window.newest_at : undefined;
  if (!window || !oldest || !newest) return [];
  return [
    `Tested ${plural(tested, "email", "emails")} received ${minuteUtc(oldest)} to ${minuteUtc(newest)}.`,
  ];
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
  // Emails not found have no arrival, so the span says nothing of them.
  const counts = isRecord(data.counts) ? data.counts : undefined;
  const tested =
    (typeof counts?.emails === "number" ? counts.emails : results.length) -
    (typeof counts?.not_found === "number" ? counts.not_found : 0);
  const lines = [
    ...windowLine(data, tested),
    ...(Array.isArray(summary?.warnings) ? summary.warnings : []).map(
      (warning) => `Warning: ${warning}`,
    ),
    ...scopeWarningLines(result.scope_warnings),
    ...conditionLines(summary),
    ...questionLines(summary, results),
    ...expectationsLines(result.expectations, results, name),
    ...matchedLines(results, result.expectations),
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
 * The labels a write's check gives the made-up emails it names, by index
 * (failed_sample_details and undecided_sample_details), from a server that
 * sends them.
 */
export function sampleDetailLabels(check: unknown): Map<number, string | null> {
  const labels = new Map<number, string | null>();
  if (!isRecord(check)) return labels;
  for (const key of ["failed_sample_details", "undecided_sample_details"]) {
    const details = check[key];
    if (!Array.isArray(details)) continue;
    for (const detail of details)
      if (
        isRecord(detail) &&
        typeof detail.index === "number" &&
        Number.isInteger(detail.index) &&
        detail.index >= 0
      )
        labels.set(
          detail.index,
          typeof detail.label === "string" ? detail.label : null,
        );
  }
  return labels;
}

/**
 * How a rule write names a made-up email its check gives by index, from 0 in
 * the set judged: those this write sends in place of the rule's
 * (expectation_samples), or the rule's saved ones oldest first and then
 * those it adds (add_expectation_samples). One this write sent is "sample
 * N", its number in the samples file --pick took it from (or its place in
 * what was sent); any other is "saved sample N (index i)", its place among
 * the rule's and the index the API names it by. With its label when known,
 * from the samples or from `labels` (sampleDetailLabels). `saved` is the
 * answer's expectation_samples, every one the rule keeps after the write,
 * when it has them.
 */
export function writtenSampleNamer(
  body: unknown,
  flags: Record<string, unknown> | undefined,
  saved?: unknown,
  labels: ReadonlyMap<number, string | null> = new Map(),
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
  // A sample this write did not send: numbered from 1 among the rule's, with
  // the index from 0 the API names it by, and its label from the rule's
  // samples or the check's details.
  const indexed = (name: string, index: number) => {
    const sample = kept?.[index];
    const label =
      isRecord(sample) && typeof sample.label === "string" && sample.label
        ? sample.label
        : labels.get(index);
    return `${name} (index ${index}${label ? `, "${label}"` : ""})`;
  };
  return (index) => {
    if (sent)
      return labelled(`sample ${sentSampleNumber(index, flags)}`, sent[index]);
    if (added) {
      // Where the added ones start, known only from the rule's samples after
      // the write; a refused write answers without them.
      const start = kept ? kept.length - added.length : null;
      if (start === null) return indexed(`made-up email ${index + 1}`, index);
      if (index >= start)
        return labelled(
          `sample ${sentSampleNumber(index - start, flags)}`,
          added[index - start],
        );
    }
    return indexed(`saved sample ${index + 1}`, index);
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
 * Who an update that saved a version, or turned a grant rule active, reaches,
 * as its answer counts them: the keys listing the rule and the webhooks those
 * keys own, and the shares the write ended when it ended any. A new version
 * keeps a rule's share, so the API counts none; the answer's `share_notice`
 * says the share goes on.
 */
export function affectsLine(
  affects: unknown,
  write: {
    /** The write sent state active and no tree or restored version. */
    activatedOnly?: boolean;
    /** It also sent a scope, which saves a version when it differs from the rule's. */
    scopeSent?: boolean;
    /** The state the write sent, if any, and the rule's state after it. */
    stateSent?: unknown;
    state?: unknown;
  } = {},
): string | undefined {
  if (!isRecord(affects)) return undefined;
  const count = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : undefined;
  const keys = count(affects.keys);
  const endpoints = count(affects.endpoints);
  // A new version ends no share, so a missing count reads as none.
  const shares = count(affects.shares_ended) ?? 0;
  const reach = `${plural(keys ?? 0, "API key", "API keys")} listing the rule and ${plural(endpoints ?? 0, "webhook", "webhooks")} those keys own`;
  // Sent only for a saved version or a rule turned active. With no tree or
  // restored version it is the activation, and with a scope sent, the scope
  // too (a changed scope saves a version that copies the current words and
  // tree): what it reaches now either way.
  if (write.activatedOnly && keys !== undefined && endpoints !== undefined)
    return `Now active${write.scopeSent ? ", over the scope this write sent" : ""}: it reaches ${reach}.`;
  if (keys === undefined || endpoints === undefined) return undefined;
  const ended =
    shares > 0 ? `; it ended ${plural(shares, "share", "shares")}` : "";
  // A write that also sent a state may have changed it: say what it is now.
  if (write.stateSent !== undefined && typeof write.state === "string")
    return `This version reaches ${reach}${ended}. The rule is now ${write.state}.`;
  return `This version reaches ${reach}${ended}. The rule keeps its state.`;
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

/** A note the server wrote on a rule answer, as a line, or undefined. */
function noteLine(note: unknown): string | undefined {
  return typeof note === "string" && note.trim() ? note.trim() : undefined;
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
  // A write that turned the rule active saves no version unless it sent a
  // tree or a restored one, or changed the scope: affects counts what it
  // reaches now either way. A do-not-share rule turned on reaches no key, so
  // its line is left out, unless a scope was sent, which may have saved a
  // version, said as a tree saved on one is.
  const body = isRecord(request.body) ? request.body : {};
  const activatedOnly =
    body.state === "active" &&
    body.tree === undefined &&
    body.restore_version === undefined;
  const scopeSent = body.evaluation_scope !== undefined;
  const reach =
    (rule as { kind?: unknown }).kind === "do_not_share" &&
    activatedOnly &&
    !scopeSent
      ? undefined
      : affectsLine(rule.affects, {
          activatedOnly,
          scopeSent,
          stateSent: body.state,
          state: rule.state,
        });
  if (reach) lines.push(reach);
  // That the rule's share goes on under the new version, and with whom; then,
  // for a version saved on an active rule keys, webhooks or a share read
  // without a check, what it changes; and, on a grant rule's create, that
  // do-not-share rules run first.
  for (const note of [rule.share_notice, rule.notice, rule.do_not_share_note]) {
    const line = noteLine(note);
    if (line) lines.push(line);
  }
  const sentExpectations = sentExpectationsIn(request.body);
  const name = writtenSampleNamer(
    request.body,
    request.flags,
    (rule as Record<string, unknown>).expectation_samples,
    sampleDetailLabels(rule.expectations_check),
  );
  const checked = expectationsCheckLine(rule.expectations_check, ruleId, name);
  if (checked) lines.push(checked);
  else if (sentExpectations)
    lines.push(
      `Expectations were not checked on this write. Test them with \`primitive email-rules test-email-rule --rule-id ${ruleId}\`.`,
    );
  // To its author: objections to the rule waiting for an answer.
  const objections = noteLine(rule.objection_notice);
  if (objections) lines.push(objections);
  return { lines };
}

/** Whether a rule write sent expectations: emails by id, or made-up emails to save or add. */
function sentExpectationsIn(body: unknown): boolean {
  if (!isRecord(body)) return false;
  const some = (value: unknown) => Array.isArray(value) && value.length > 0;
  return (
    isRecord(body.expectations) ||
    some(body.add_expectation_samples) ||
    some(body.expectation_samples)
  );
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
  // The server's notice says with whom each share was and what ending it
  // takes away; without one (an older server), the count.
  const shareNotice = noteLine(answer.share_notice);
  if (shareNotice) lines.push(shareNotice);
  else if (ended > 0) {
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
 * Who reads an active rule, from a refusal's details.read_by: the server
 * sends it when it checked the write against the rule's expectations because
 * API keys, webhooks or a share read the rule, whether or not the write asked.
 * Undefined without it.
 */
function readByText(details: Record<string, unknown>): string | undefined {
  const readBy = details.read_by;
  if (!isRecord(readBy)) return undefined;
  const { keys, webhooks, shares } = readBy;
  // Null when not counted in time; an older server sends no shares at all.
  if (
    typeof keys !== "number" ||
    typeof webhooks !== "number" ||
    shares === null
  )
    return "API keys, webhooks or a share may read what it grants (they could not be counted in time)";
  // A share counts as a reader too: a new version keeps it, so what the
  // version matches reaches the member it is shared with.
  const shared =
    typeof shares === "number" && shares > 0
      ? `it is shared with ${plural(shares, "member", "members")}`
      : undefined;
  if (keys + webhooks === 0 && shared) return shared;
  return `${plural(keys, "API key", "API keys")} and ${plural(webhooks, "webhook", "webhooks")} read what it grants${shared ? `, and ${shared}` : ""}`;
}

/** How to save a write the default check refused, without the check. */
function saveUncheckedText(_flags?: Record<string, unknown>): string {
  return "send it again with --no-if-expectations-pass";
}

/**
 * The hint for update-email-rule's refusals: an email_rule_conflict by its
 * details.reason (version_moved, revision_moved, expectations_moved,
 * rule_changed, readers_changed), and the expectations guard's
 * expectations_failed, expectations_undecided, expectations_unreadable and
 * no_expectations. The guard runs when the write sends if_expectations_pass,
 * and by default (details.read_by) when it changes what an active rule that
 * API keys, webhooks or a share read grants. Nothing was saved in any of them.
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
  const readBy = readByText(details);
  // Why the write was judged: asked for, or by default for a rule that keys,
  // webhooks or a share read; and, then, how to save it without the check.
  const judged = readBy
    ? "was judged against its expectations before saving, as a write that changes what an active rule grants is by default while API keys, webhooks or a share read it, and nothing was saved"
    : "was judged against its expectations before saving (if_expectations_pass), and nothing was saved";
  const unchecked = readBy
    ? ` The rule is active and ${readBy}; to save the write without the check, ${saveUncheckedText(flags)}.`
    : "";
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
      case "readers_changed":
        return "Hint: API keys, webhooks or a share started reading this rule while this write was being saved, and saving it would have changed what they receive without checking it against the rule's expectations, so nothing was saved. Send the write again: it is then checked first.";
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
    const name = writtenSampleNamer(
      body,
      flags,
      undefined,
      sampleDetailLabels(check),
    );
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
    return `Hint: the rule, as this write would leave it, ${judged}.${which}${next}${unchecked}`;
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
    return `Hint: the rule, as this write would leave it, ${judged}. ${one ? "An expectation names an email" : "Expectations name emails"} this rule cannot read (deleted, or outside its scope or its author's mail)${named}. Sending the write again will not decide ${them}: send --expectations-file without ${them}, or an evaluation_scope that reads ${them}.${unchecked}`;
  }
  if (code === "no_expectations")
    return readBy
      ? `Hint: nothing was saved: this write removes the rule's expectations, and the rule is active and ${readBy}, so a write that changes what it grants is checked against them first. Keep some with --expectations-file, --expectation-samples-file or --add-expectation-samples-file, or, to save the write without the check, ${saveUncheckedText(flags)}.`
      : "Hint: nothing was saved. Give the rule expectations with --expectations-file or made-up emails with --expectation-samples-file or --add-expectation-samples-file (in this write or before it), or send the write without if_expectations_pass.";
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

// test-email-rule-on-sample

/**
 * The stderr report of test-email-rule-on-sample with --with-protection:
 * whether a match would be shared, and the do-not-share rules that would
 * keep it from being shared. Nothing without protection in the answer.
 */
export function testSampleProtectionReport(data: unknown): OperationReport {
  if (!isRecord(data) || !isRecord(data.protection)) return { lines: [] };
  const protection = data.protection;
  const mailbox =
    typeof protection.mailbox === "string" && protection.mailbox
      ? ` over ${protection.mailbox}`
      : "";
  if (protection.outcome === "not_matched")
    return {
      lines: [
        `Protection${mailbox}: the rule did not match, so nothing would be shared and no do-not-share rule was judged.`,
      ],
    };
  if (protection.outcome === "shared")
    return {
      lines: [
        `Protection${mailbox}: a match would be shared; no do-not-share rule keeps it back.`,
      ],
    };
  if (protection.outcome !== "withheld") return { lines: [] };
  const withheld = (
    Array.isArray(protection.withheld_by) ? protection.withheld_by : []
  ).filter(isRecord);
  const named = withheld.map(
    (rule) =>
      `${typeof rule.name === "string" ? rule.name : "a rule"} (${rule.id}, ${rule.reason === "undecided" ? "undecided" : "matched"})`,
  );
  const hidden =
    typeof protection.withheld_by_hidden === "number" &&
    protection.withheld_by_hidden > 0
      ? protection.withheld_by_hidden
      : 0;
  const by = [
    ...named,
    ...(hidden > 0
      ? [plural(hidden, "rule you cannot see", "rules you cannot see")]
      : []),
  ];
  const undecided = withheld.some((rule) => rule.reason === "undecided")
    ? " An undecided one holds it back until it is decided."
    : "";
  return {
    lines: [
      `Protection${mailbox}: a match would be withheld${by.length > 0 ? ` by ${by.join(", ")}` : ""}.${undecided}`,
    ],
  };
}

// compile-email-rule

/** Where compile counted breadth, by the evaluation_scope it was sent. */
const BREADTH_SCOPE: Readonly<Record<string, string>> = {
  own_mailboxes: "in your own mailboxes",
  author: "in all the mail you can read",
  selected: "in the inboxes and domains the selected scope names",
};

/** The stderr report of compile-email-rule: how many recent emails it holds for. */
export function compileEmailRuleReport(
  data: unknown,
  request?: { body?: unknown },
): OperationReport {
  if (!isRecord(data)) return { lines: [] };
  const lines = [
    // Names in the scope sent that no mail reaches, first: a typo there makes the rest moot.
    ...scopeWarningLines(data.scope_warnings),
    ...(Array.isArray(data.warnings) ? data.warnings : [])
      .filter(
        (warning): warning is string =>
          typeof warning === "string" && warning.trim() !== "",
      )
      .map((warning) => `Warning: ${warning.trim()}`),
  ];
  const breadth = data.breadth;
  // Counted over the evaluation_scope sent, by default your own mailboxes,
  // as the answer's breadth_scope says when the server sends it.
  const sent =
    isRecord(request?.body) && typeof request.body.evaluation_scope === "string"
      ? request.body.evaluation_scope
      : undefined;
  const counted =
    isRecord(data.breadth_scope) &&
    typeof data.breadth_scope.evaluation_scope === "string"
      ? data.breadth_scope.evaluation_scope
      : sent;
  const where =
    sent === undefined && (counted === undefined || counted === "own_mailboxes")
      ? "in your own mailboxes, the default; pass --evaluation-scope to count over the scope you will save it with"
      : (BREADTH_SCOPE[counted ?? "own_mailboxes"] ??
        `in evaluation_scope ${counted}`);
  if (
    isRecord(breadth) &&
    typeof breadth.checked === "number" &&
    typeof breadth.matched === "number"
  )
    lines.push(
      `Breadth: its conditions hold for ${breadth.matched} of ${plural(breadth.checked, "recent email", "recent emails")} checked ${where}.`,
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
  // To its author: objections to the rule waiting for an answer.
  const objections = noteLine(data.objection_notice);
  if (objections) lines.push(objections);
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

/** What a samples file flag reads. */
const SAMPLES_FILE_SHAPE =
  'A JSON file of made-up emails the rule must match or not: an array such as [{"expected": "no_match", "label": "a personal bill", "email": {...}}], with email as test-email-rule-on-sample takes it (text up to 4,000 characters, at most 10 each of to, cc, attachment_types and attachment_names), like the one generate-look-alikes --samples-file writes, or a generate-look-alikes answer saved as it printed it.';

const EXPECTATION_FLAG_NOTE =
  "Replaces any expect in --body-file or --raw-body. The answer reports them in expectations (passed, counts, results) and the exit code follows it; see --help-full.";

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

/**
 * Whether a share made with you is working, from its `activity`, as one line:
 * the last hour that has ended (or in which an email was shared with you) in
 * which its rule looked at an email in the sharing member's mailboxes, how
 * many emails it has shared and when it last did, and whether the rule is
 * active. Nothing for a share without it: one you are not the person it is
 * shared with, one not live, or a server that predates the field.
 */
export function shareActivityLines(share: unknown): string[] {
  if (!isRecord(share) || !isRecord(share.activity)) return [];
  const activity = share.activity;
  const id = typeof share.id === "string" ? share.id : "<share-id>";
  const rule =
    isRecord(share.rule) && typeof share.rule.name === "string"
      ? shownLine(share.rule.name)
      : "";
  const granter = isRecord(share.granter) ? share.granter : {};
  const person =
    shownLine(granter.name) || shownLine(granter.email) || "the member sharing";
  const head = `Share ${id}${rule ? ` (${rule})` : ""}:`;
  const count = activity.shared_emails;
  const sharedAt =
    typeof activity.last_shared_at === "string"
      ? activity.last_shared_at
      : null;
  const unread = `${head} whether it is working could not be read just now; try again.`;
  if (typeof count !== "number") return [unread];
  // The hour counts the newest email shared, so it is never empty while something was shared; if it is, it was not read.
  if (typeof activity.last_decided_at !== "string" && (count > 0 || sharedAt))
    return [unread];
  // A count and a last time that disagree were not read together either.
  if (count > 0 !== (sharedAt !== null)) return [unread];
  const decided =
    typeof activity.last_decided_at === "string"
      ? `its rule last looked at an email in ${person}'s mailboxes in the hour starting ${minuteUtc(activity.last_decided_at)}`
      : `its rule has not looked at an email in ${person}'s mailboxes in any hour that has ended since it was shared with you`;
  const more = activity.shared_emails_more === true;
  const many = `${more ? "more than " : ""}${count.toLocaleString("en-US")}`;
  const shared =
    count === 0
      ? "nothing has been shared with you yet"
      : `it has shared ${many} ${count === 1 && !more ? "email" : "emails"} with you${sharedAt ? `, the last at ${minuteUtc(sharedAt)}` : ""}`;
  const paused =
    activity.rule_active === false
      ? " The rule is not active, so nothing new is shared until it is."
      : share.delivery_paused === true
        ? " New email is not being shared with you right now; what was shared stays visible."
        : "";
  return [`${head} ${decided}; ${shared}.${paused}`];
}

/**
 * accept-email-rule-request without --json: the answer's notice, then the
 * rule as it was agreed, since the answer's request block holds the rule as
 * it was asked and reads like what was accepted.
 */
export function acceptEmailRuleRequestReport(data: unknown): OperationReport {
  if (!isRecord(data)) return { lines: [] };
  const notice =
    typeof data.notice === "string"
      ? data.notice
          .split(/\n\s*\n/)
          .map((part) => part.trim())
          .filter(Boolean)
      : [];
  const rule = isRecord(data.rule) ? data.rule : undefined;
  const current = rule && isRecord(rule.current) ? rule.current : undefined;
  const lines = [...notice];
  if (rule && typeof rule.name === "string" && typeof rule.id === "string") {
    const version =
      typeof current?.version === "number"
        ? `, version ${current.version}`
        : "";
    const state = typeof rule.state === "string" ? `, ${rule.state}` : "";
    const agreed =
      typeof current?.english === "string"
        ? ` What you agreed to: ${current.english}`
        : "";
    lines.push(
      `Accepted as ${rule.name} (${rule.id})${version}${state}.${agreed}`,
    );
  }
  return { lines };
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
        description: `${SAMPLES_FILE_SHAPE} Sets expect.samples, beside any emails by id; the answer judges each in expectations.samples (index from 0 over those sent), and the report names each by its number in the file. Like any expect, it replaces a saved rule's own expectations and samples for this test. ${EXPECTATION_FLAG_NOTE}`,
      }),
      [PICK_FLAG]: Flags.string({
        description: pickFlagHelp([EXPECT_SAMPLES_FILE_FLAG]),
      }),
      [SAME_EMAILS_FLAG]: Flags.string({
        description:
          "Test the same emails as an earlier test: a file holding what test-email-rule --json printed. Sets email_ids to its results' email_id, so two trees are tested over the same mail.",
      }),
      ...scopeSelectionFlags(),
    },
    bodyFields: (flags, base) => {
      const expect = expectBodyFields(flags);
      const same = sameEmailsBodyFields(flags);
      return [...expect, ...same, ...scopeSelectionBodyFields(flags, base)];
    },
    bodyProperties: ["expect", "scope_selection"],
    // Fail closed: expectations that are there and not passed exit 1, if the
    // report cannot be built.
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
        description: `${SAMPLES_FILE_SHAPE} Sets expectation_samples, over any in --body-file or --raw-body. A create does not judge them; test-email-rule --rule-id does.`,
      }),
      [PICK_FLAG]: Flags.string({
        description: pickFlagHelp([SAMPLES_FILE_FLAG]),
      }),
      ...scopeSelectionFlags(),
    },
    bodyFields: (flags, base) => [
      ...expectationsBodyFields(flags),
      ...samplesBodyFields(false)(flags),
      ...scopeSelectionBodyFields(flags, base),
    ],
    bodyProperties: ["expectations", "expectation_samples", "scope_selection"],
    report: writtenEmailRuleReport,
  },
  updateEmailRule: {
    flags: {
      "expectations-file": Flags.string({
        description:
          'A JSON file holding the emails the rule must match and must not, such as {"match": ["<email-id>"], "no_match": ["<email-id>"]}, replacing its saved expectations; a file holding null removes them. Sets expectations, over any in --body-file or --raw-body; the answer judges them in expectations_check (passed, decided, failed, undecided); the report test-email-rule answers with is named expectations instead.',
      }),
      [SAMPLES_FILE_FLAG]: Flags.string({
        description: `${SAMPLES_FILE_SHAPE} They replace the rule's saved ones, and a file holding [] removes them. Sets expectation_samples, over any in --body-file or --raw-body. Not with --${ADD_SAMPLES_FILE_FLAG}.`,
        exclusive: [ADD_SAMPLES_FILE_FLAG],
      }),
      [ADD_SAMPLES_FILE_FLAG]: Flags.string({
        description: `${SAMPLES_FILE_SHAPE} They are added to the rule's saved ones. Sets add_expectation_samples, over any in --body-file or --raw-body. Not with --${SAMPLES_FILE_FLAG}.`,
        exclusive: [SAMPLES_FILE_FLAG],
      }),
      [PICK_FLAG]: Flags.string({
        description: pickFlagHelp([SAMPLES_FILE_FLAG, ADD_SAMPLES_FILE_FLAG]),
      }),
      ...scopeSelectionFlags(),
    },
    bodyFields: (flags, base) => [
      ...expectationsBodyFields(flags),
      ...samplesBodyFields(true)(flags),
      ...scopeSelectionBodyFields(flags, base),
    ],
    bodyProperties: [
      "expectations",
      "expectation_samples",
      "add_expectation_samples",
      "scope_selection",
    ],
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
    report: testSampleProtectionReport,
  },
  acceptEmailRuleRequest: {
    flags: {
      [SAMPLES_FILE_FLAG]: Flags.string({
        description: `${SAMPLES_FILE_SHAPE} Sets expectation_samples, over any in --body-file or --raw-body: they are kept on the rule this accept writes, such as the look-alikes of the request, each keeping whether it must match.`,
      }),
      [PICK_FLAG]: Flags.string({
        description: pickFlagHelp([SAMPLES_FILE_FLAG]),
      }),
    },
    bodyFields: samplesBodyFields(false),
    bodyProperties: ["expectation_samples"],
    report: acceptEmailRuleRequestReport,
  },
  compileEmailRule: {
    flags: scopeSelectionFlags(),
    bodyFields: scopeSelectionBodyFields,
    bodyProperties: ["scope_selection"],
    report: compileEmailRuleReport,
  },
  endEmailRuleShare: {
    flags: {},
    report: endEmailRuleShareReport,
  },
  getEmailRuleShare: {
    flags: {},
    report: (data) => ({ lines: shareActivityLines(data) }),
  },
  listEmailRuleShares: {
    flags: {},
    report: (data) => ({
      lines: (Array.isArray(data) ? data : []).flatMap(shareActivityLines),
    }),
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
    flags: {},
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
