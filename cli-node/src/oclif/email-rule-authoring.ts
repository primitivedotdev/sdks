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
import type { TestEmailRuleResult } from "@primitivedotdev/api-core";
import {
  ADD_SAMPLES_FILE_FLAG,
  CLOSE_CALL_NOTE,
  EXPECT_SAMPLES_FILE_FLAG,
  expectSamples,
  groupCountsLines,
  lookAlikesReport,
  PICK_FLAG,
  pickFlagHelp,
  readJsonFileFlag,
  SAMPLES_FILE_FLAG,
  samplesBodyFields,
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
import { ruleNotesLines, ruleNotesReport } from "./rule-notes.js";
import { shownLine, shownText, terminalLine } from "./terminal-text.js";

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
  // The answer as --json prints it (the data inside the body), or the data alone.
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
          ? `${shownLine(name)} ${confidence(score)}`
          : shownLine(name);
      })
      .join(", ")}]`;
  } else if (value === null || value === undefined) {
    text = "null";
  } else if (typeof value === "object") {
    text = shownLine(JSON.stringify(value));
  } else {
    text = shownLine(String(value));
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
  return `${shownLine(name)}: ${formatFactValue(fact)}`;
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

/**
 * The server's reason for an undecided entry, and whether testing again can
 * decide it. An entry that does not say it can is taken as one that cannot.
 */
export function undecidedOf(entry: unknown): Undecided {
  const given = isRecord(entry) ? entry : {};
  return {
    reason: typeof given.reason === "string" ? given.reason : "undecided",
    retryable: given.retryable === true,
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

/** Whether an expectation entry is marked a close call. */
function isCloseCall(entry: unknown): boolean {
  return isRecord(entry) && entry.close_call === true;
}

function expectationLine(result: ExpectationResult): string {
  const note =
    result.status === "undecided"
      ? undecidedNote(undecidedOf(result))
      : isCloseCall(result)
        ? CLOSE_CALL_NOTE
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

/** A made-up email as every report names it: its place from 1 in the set the API judged, and its label. */
type SampleNamer = (sample: Pick<SampleJudgment, "index" | "label">) => string;

function sampleName(index: number, label: unknown): string {
  const name = `sample ${index + 1}`;
  const shown = shownLine(label);
  return shown ? `${name} ("${shown}")` : name;
}

const sampleNamer =
  (): SampleNamer =>
  ({ index, label }) =>
    sampleName(index, label);

function sampleLines(sample: SampleJudgment, name: SampleNamer): string[] {
  const note =
    sample.status === "undecided"
      ? ` (${undecidedNote(undecidedOf(sample.entry))})`
      : isCloseCall(sample.entry)
        ? ` (${CLOSE_CALL_NOTE})`
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
  name: SampleNamer = sampleNamer(),
): string[] {
  if (!expectations) return [];
  const results = Array.isArray(expectations.results)
    ? expectations.results
    : [];
  const passed = expectations.counts?.passed ?? 0;
  const failed = expectations.counts?.failed ?? 0;
  const undecided = expectations.counts?.undecided ?? 0;
  const closeCalls = expectations.counts?.close_calls ?? 0;
  const closeCallsPart =
    closeCalls > 0
      ? `; ${plural(closeCalls, "was a close call", "were close calls")}`
      : "";
  const byGroup = groupCountsLines(expectations.counts?.by_group);
  // Passed ones are listed only when they were close calls.
  const listed = (entry: { status: string; entry?: unknown }) =>
    entry.status !== "passed" || isCloseCall(entry.entry ?? entry);
  const rows = [
    ...results.filter((result) => listed(result)).map(expectationLine),
    ...sampleJudgments(expectations)
      .filter((sample) => listed(sample))
      .flatMap((sample) => sampleLines(sample, name)),
  ];
  if (expectations.passed && failed === 0 && undecided === 0)
    return [
      `Expectations: all ${passed} passed${closeCallsPart}.`,
      ...byGroup,
      ...rows,
    ];
  const parts = [
    failed > 0 ? `${failed} failed` : "",
    undecided > 0 ? `${undecided} undecided` : "",
    `${passed} passed`,
  ].filter((part) => part !== "");
  return [
    `Expectations: ${parts.join(", ")}${closeCallsPart}.`,
    ...byGroup,
    ...rows,
  ];
}

/** The most emails each list of a test's changes names. */
export const CHANGES_LIST_LIMIT = 3;

/**
 * What the tested tree would change (changes) against the rule's current
 * version, or with request_id against the request's rule as asked: the
 * counts, then a few of the emails each way, newest first.
 * For a do_not_share rule they are the emails newly withheld and no longer
 * withheld.
 */
export function changesLines(changes: unknown, kind?: unknown): string[] {
  if (!isRecord(changes)) return [];
  const list = (value: unknown) => {
    const given = isRecord(value) ? value : {};
    const emails = Array.isArray(given.emails)
      ? given.emails.filter(isRecord)
      : [];
    const count = typeof given.count === "number" ? given.count : emails.length;
    return { count, emails };
  };
  const newly = list(changes.newly_matched);
  const stops = list(changes.stops_matching);
  const undecided =
    typeof changes.undecided === "number" ? changes.undecided : 0;
  // compared_to requested: a rule request's rule as asked, which a tree
  // given with request_id edits.
  const version =
    changes.compared_to === "requested"
      ? "the rule as asked"
      : changes.compared_to !== undefined && changes.compared_to !== "version"
        ? "the rule compared against"
        : typeof changes.compared_to_version === "number"
          ? `version ${changes.compared_to_version}`
          : "the current version";
  const withheld = kind === "do_not_share";
  const words = withheld
    ? (["newly withheld", "no longer withheld"] as const)
    : (["newly matched", "stops matching"] as const);
  const lines = [
    `Against ${version}: ${newly.count} ${words[0]}, ${stops.count} ${withheld ? words[1] : stops.count === 1 ? "stops matching" : "stop matching"}${undecided > 0 ? `, ${undecided} undecided by either` : ""}.`,
  ];
  const emailLine = (email: Record<string, unknown>) => {
    const subject = shownText(email.subject);
    const from = shownText(email.from);
    return `    ${subject ? `"${subject}"` : "(no subject)"}${from ? ` from ${from}` : ""} (${shownLine(email.email_id)})`;
  };
  for (const [label, entry] of [
    [words[0], newly],
    [words[1], stops],
  ] as const) {
    if (entry.emails.length === 0) continue;
    const shown = entry.emails.slice(0, CHANGES_LIST_LIMIT);
    lines.push(
      `  ${label[0]?.toUpperCase()}${label.slice(1)}${entry.count > shown.length ? ` (${shown.length} of ${entry.count} shown; the JSON lists up to 50)` : ""}:`,
      ...shown.map(emailLine),
    );
  }
  return lines;
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
    return [`  ${result.email_id} unclassified${reason ? ` (${reason})` : ""}`];
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
        ...undecidedOf(result),
      })),
    ...samples
      .filter((sample) => sample.status === "undecided")
      .map((sample) => ({
        id: name({ index: sample.index, label: null }),
        ...undecidedOf(sample.entry),
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
  // An undecided one the answer counts but does not list is not known to be
  // retryable.
  const unlisted = undecidedCount > undecided.length;
  const final = undecided.filter(({ retryable }) => !retryable);
  if (final.length > 0 || unlisted)
    return {
      exitCode: EXIT_EXPECTATION_FAILED,
      error: {
        code: "expectations_undecided",
        message:
          final.length > 0
            ? `${plural(undecidedCount, "expectation is", "expectations are")} undecided, and testing again will not decide ${final.length === 1 ? "this one" : "these"}: ${why(final)}.`
            : `${plural(undecidedCount, "expectation is", "expectations are")} undecided, and the answer does not say testing again can decide them.`,
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
export function testEmailRuleReport(data: unknown): OperationReport {
  if (!isRecord(data)) return { lines: [] };
  const name = sampleNamer();
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
    ...ruleNotesLines(data),
    ...conditionLines(summary),
    ...questionLines(summary, results),
    ...changesLines(
      data.changes,
      isRecord(data.rule) ? data.rule.kind : undefined,
    ),
    ...expectationsLines(result.expectations, name),
    ...matchedLines(results, result.expectations),
    ...notMatchedLines(results, result.expectations),
  ];
  return {
    lines: lines.map(terminalLine),
    ...expectationsOutcome(result.expectations, name),
  };
}

// The flags and reports, by generated operation

/** What a samples file flag reads. */
const SAMPLES_FILE_SHAPE =
  'A JSON file of made-up emails the rule must match or not, such as [{"expected": "no_match", "label": "a personal bill", "email": {...}}], or a generate-look-alikes answer saved with --json.';

const EXPECTATION_FLAG_NOTE =
  "Replaces any expect in --body-file or --raw-body.";

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
        description: `${SAMPLES_FILE_SHAPE} Sets expect.samples, beside any emails by id; the answer judges each in expectations.samples, and the report names each sample N, its place from 1 among those sent. Like any expect, it replaces a saved rule's own expectations and samples for this test. ${EXPECTATION_FLAG_NOTE}`,
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
          'A JSON file holding the emails the rule must match and must not, such as {"match": ["<email-id>"], "no_match": ["<email-id>"]}. Sets expectations, over any in --body-file or --raw-body. A create judges them before saving only for a do_not_share rule created active, in expectations_check (passed, failed, undecided); test-email-rule --rule-id judges them otherwise.',
      }),
      [SAMPLES_FILE_FLAG]: Flags.string({
        description: `${SAMPLES_FILE_SHAPE} Sets expectation_samples, over any in --body-file or --raw-body. A create judges them only for a do_not_share rule created active; test-email-rule --rule-id does otherwise.`,
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
    report: ruleNotesReport,
  },
  updateEmailRule: {
    flags: {
      "expectations-file": Flags.string({
        description:
          'A JSON file holding the emails the rule must match and must not, such as {"match": ["<email-id>"], "no_match": ["<email-id>"]}, replacing its saved expectations; a file holding null removes them. Sets expectations, over any in --body-file or --raw-body. An update that leaves the rule active on a new version, or turns it active, is judged against them before saving and refused if one fails or, for a grant rule, cannot be decided; a do_not_share rule is saved with undecided ones.',
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
    report: ruleNotesReport,
  },
  generateLookAlikes: {
    flags: {
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
    report: ruleNotesReport,
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
    report: ruleNotesReport,
  },
  compileEmailRule: {
    flags: scopeSelectionFlags(),
    bodyFields: scopeSelectionBodyFields,
    bodyProperties: ["scope_selection"],
    report: ruleNotesReport,
  },
};
