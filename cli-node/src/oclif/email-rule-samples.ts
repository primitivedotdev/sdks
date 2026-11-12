// Made-up emails a rule keeps as expectations (expectation_samples), and the
// look-alike emails `email-rules generate-look-alikes` writes for a rule to
// be checked against.
//
//   primitive email-rules generate-look-alikes --rule-id <id> \
//     --samples-file look-alikes.json
//   primitive email-rules update-email-rule <id> \
//     --add-expectation-samples-file look-alikes.json --pick 2,4
//
// The samples file is a JSON array of samples, numbered from 1 in the order
// the look-alikes report printed them, so --pick picks what the report
// showed. A hand-written file takes the same shape.
//
// This module does not import email-rule-authoring.ts, which imports it.

import { readFileSync, writeFileSync } from "node:fs";
import { Errors } from "@oclif/core";
import type {
  ExtensionBodyField,
  OperationReport,
} from "./operation-extension.js";

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function usageError(message: string): Errors.CLIError {
  return new Errors.CLIError(message, { exit: 2 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** A path as a shell word: quoted when it holds anything but plain characters. */
function shellWord(value: string): string {
  return /^[\w@%+=:,./-]+$/.test(value)
    ? value
    : `'${value.replaceAll("'", "'\\''")}'`;
}

/** A JSON file a flag names, parsed, or an exit-1 error saying why not. */
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

/** The longest label the API keeps on a sample. */
const SAMPLE_LABEL_MAX = 200;

export type ExpectationSample = {
  expected: "match" | "no_match";
  label?: string | null;
  email: Record<string, unknown>;
};

/** A look-alike of a generate-look-alikes answer, and the sample it saves as. */
type LookAlikeEntry = {
  lookAlike: Record<string, unknown>;
  sample: ExpectationSample;
};

/**
 * `text` cut to `max` UTF-16 units, as the API counts a label's length,
 * never inside a character.
 */
function cutLabel(text: string, max: number): string {
  const cut = text.slice(0, max);
  return (/[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut).trimEnd();
}

/**
 * Whether a look-alike is one the rule should match: its `expected` as the
 * API gives it. An answer without one (an older server) is must-not-match,
 * as every look-alike was.
 */
function lookAlikeExpected(
  lookAlike: Record<string, unknown>,
): "match" | "no_match" {
  return lookAlike.expected === "match" ? "match" : "no_match";
}

/**
 * A look-alike as a sample, keeping its `expected` (most must not match; a
 * near case the rule should take must match): the email as written,
 * labelled with its kind and why ("medical: ..."), or the why alone when
 * both do not fit a label.
 */
export function lookAlikeSample(lookAlike: unknown): ExpectationSample | null {
  if (!isRecord(lookAlike) || !isRecord(lookAlike.email)) return null;
  const kind = typeof lookAlike.kind === "string" ? lookAlike.kind : "";
  const why = typeof lookAlike.why === "string" ? lookAlike.why.trim() : "";
  const both = kind && why ? `${kind}: ${why}` : kind || why;
  const label =
    both.length <= SAMPLE_LABEL_MAX
      ? both
      : why.length <= SAMPLE_LABEL_MAX
        ? why
        : `${cutLabel(why, SAMPLE_LABEL_MAX - 3)}...`;
  return {
    expected: lookAlikeExpected(lookAlike),
    ...(label ? { label } : {}),
    email: lookAlike.email,
  };
}

/**
 * The look-alikes of a generate-look-alikes answer that can be saved (each
 * with an email), in the answer's order. The report numbers these and the
 * samples file holds these, so a number means the same email in both.
 */
function lookAlikeEntries(answer: unknown): LookAlikeEntry[] {
  const list =
    isRecord(answer) && Array.isArray(answer.look_alikes)
      ? answer.look_alikes
      : [];
  const entries: LookAlikeEntry[] = [];
  for (const item of list) {
    const sample = lookAlikeSample(item);
    if (sample && isRecord(item)) entries.push({ lookAlike: item, sample });
  }
  return entries;
}

/** The look-alikes of a generate-look-alikes answer, as samples, in order. */
export function lookAlikeSamples(answer: unknown): ExpectationSample[] {
  return lookAlikeEntries(answer).map((entry) => entry.sample);
}

/** The fields a saved made-up email takes, and the API's bounds on them. */
const SAMPLE_EMAIL_KEYS = new Set([
  "from",
  "to",
  "cc",
  "subject",
  "text",
  "attachment_types",
  "automated",
  "from_mailing_list",
  "spam_score",
]);
const SAMPLE_TEXT_MAX = 4_000;
const SAMPLE_SUBJECT_MAX = 998;
const SAMPLE_LIST_MAX = 10;

/**
 * Refuse, naming the sample and the field, a made-up email the API would
 * refuse to keep: the fields it takes and their bounds. The API checks the
 * rest (address forms, a NUL).
 */
function checkSampleEmail(email: Record<string, unknown>, at: string): void {
  const fail = (what: string) => {
    throw usageError(`${at}: email ${what}.`);
  };
  const unknown = Object.keys(email).find((key) => !SAMPLE_EMAIL_KEYS.has(key));
  if (unknown !== undefined)
    fail(
      `takes no "${unknown}" (it takes ${[...SAMPLE_EMAIL_KEYS].join(", ")})`,
    );
  if (!isRecord(email.from) || typeof email.from.address !== "string")
    fail("needs from.address");
  const list = (key: string, min: number) => {
    const value = email[key];
    if (value === undefined && min === 0) return;
    if (
      !Array.isArray(value) ||
      value.some((entry) => typeof entry !== "string") ||
      value.length < min ||
      value.length > SAMPLE_LIST_MAX
    )
      fail(
        `${key} must be a list of ${min > 0 ? `${min} to ` : "at most "}${SAMPLE_LIST_MAX} strings`,
      );
  };
  list("to", 1);
  list("cc", 0);
  list("attachment_types", 0);
  if (
    email.subject !== undefined &&
    (typeof email.subject !== "string" ||
      email.subject.length > SAMPLE_SUBJECT_MAX)
  )
    fail(
      `subject must be a string of at most ${SAMPLE_SUBJECT_MAX} characters`,
    );
  if (
    typeof email.text !== "string" ||
    email.text.length === 0 ||
    email.text.length > SAMPLE_TEXT_MAX
  )
    fail(`text must be 1 to ${SAMPLE_TEXT_MAX} characters`);
  for (const key of ["automated", "from_mailing_list"])
    if (email[key] !== undefined && typeof email[key] !== "boolean")
      fail(`${key} must be true or false`);
  if (
    email.spam_score !== undefined &&
    (typeof email.spam_score !== "number" || !Number.isFinite(email.spam_score))
  )
    fail("spam_score must be a number");
}

/** The most made-up emails one rule keeps, and one test or write sends. */
export const SAMPLES_MAX = 20;

/** The keys a sample may carry: a saved one's id and time are taken and ignored. */
const SAMPLE_KEYS = new Set(["expected", "label", "email", "id", "created_at"]);

/**
 * The samples a file holds: a JSON array of samples, as --samples-file
 * writes them, or a generate-look-alikes answer saved as the command printed
 * it (with or without --json), whose look-alikes become must-not-match
 * samples numbered as its report numbered them. Only a literal [] holds no
 * samples; an answer with none is refused, so it never empties a rule's.
 */
export function samplesFromJson(
  value: unknown,
  source: string,
): ExpectationSample[] {
  const data = isRecord(value) && isRecord(value.data) ? value.data : value;
  if (isRecord(data) && Array.isArray(data.look_alikes)) {
    const samples = lookAlikeSamples(data);
    if (samples.length === 0)
      throw usageError(
        `${source} is a generate-look-alikes answer with no look-alikes in it.`,
      );
    samples.forEach((sample, index) => {
      checkSampleEmail(sample.email, `${source}, look-alike ${index + 1}`);
    });
    return samples;
  }
  if (!Array.isArray(data))
    throw usageError(
      `${source} must hold a JSON array of samples, such as [{"expected": "no_match", "label": "a personal bill", "email": {...}}], or a generate-look-alikes answer.`,
    );
  return data.map((item, index) => {
    const at = `${source}, sample ${index + 1}`;
    if (!isRecord(item)) throw usageError(`${at} is not an object.`);
    const unknown = Object.keys(item).find((key) => !SAMPLE_KEYS.has(key));
    if (unknown !== undefined)
      throw usageError(
        `${at}: "${unknown}" is not a sample field; a sample takes expected, label and email.`,
      );
    if (item.expected !== "match" && item.expected !== "no_match")
      throw usageError(`${at}: expected must be "match" or "no_match".`);
    if (!isRecord(item.email))
      throw usageError(
        `${at}: email must be an object, as test-email-rule-on-sample takes it.`,
      );
    checkSampleEmail(item.email, at);
    const label = item.label;
    if (label !== undefined && label !== null) {
      if (typeof label !== "string")
        throw usageError(`${at}: label must be a string.`);
      if (label.trim() === "")
        throw usageError(
          `${at}: label is blank; leave it out or say what the email stands for.`,
        );
      if (label.trim().length > SAMPLE_LABEL_MAX)
        throw usageError(
          `${at}: label is longer than ${SAMPLE_LABEL_MAX} characters.`,
        );
    }
    return {
      expected: item.expected,
      ...(label !== undefined ? { label } : {}),
      email: item.email,
    };
  });
}

/**
 * The numbers --pick names, from 1, in the order given and without repeats,
 * or a usage error: "2,4" or "2 4". `count` is how many there are to pick
 * from; a number past it is refused, rather than skipped.
 */
export function pickNumbers(
  pick: string,
  count: number,
  source: string,
): number[] {
  const parts = pick
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter((part) => part !== "");
  if (parts.length === 0)
    throw usageError(
      "--pick needs the numbers of the samples to take, such as --pick 2,4.",
    );
  const chosen: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part))
      throw usageError(`--pick ${pick}: "${part}" is not a sample number.`);
    const n = Number(part);
    if (n < 1 || n > count)
      throw usageError(
        count === 0
          ? `--pick ${pick}: ${source} holds no samples.`
          : `--pick ${pick}: ${n} is not a sample number; ${source} holds ${count === 1 ? "sample 1" : `samples 1 to ${count}`}.`,
      );
    if (!chosen.includes(n)) chosen.push(n);
  }
  return chosen;
}

/** The samples --pick chooses, by their numbers from 1. */
export function pickSamples(
  samples: readonly ExpectationSample[],
  pick: string,
  source: string,
): ExpectationSample[] {
  return pickNumbers(pick, samples.length, source).map(
    (n) => samples[n - 1] as ExpectationSample,
  );
}

/**
 * The number a person knows a sample a command sent by: its number in the
 * samples file when --pick took it, else its place from 1 in what was sent.
 * `index` is its place in what was sent, from 0, as the API gives it.
 */
export function sentSampleNumber(
  index: number,
  flags: Record<string, unknown> | undefined,
): number {
  const pick = flags?.[PICK_FLAG];
  if (typeof pick !== "string") return index + 1;
  try {
    return pickNumbers(pick, Number.MAX_SAFE_INTEGER, "")[index] ?? index + 1;
  } catch {
    return index + 1;
  }
}

/** The samples file flags: replace (create and update), add (update), and test. */
export const SAMPLES_FILE_FLAG = "expectation-samples-file";
export const ADD_SAMPLES_FILE_FLAG = "add-expectation-samples-file";
export const EXPECT_SAMPLES_FILE_FLAG = "expect-samples-file";
export const PICK_FLAG = "pick";
/** generate-look-alikes' flag for the file it writes them to. */
export const LOOK_ALIKES_SAMPLES_FILE_FLAG = "samples-file";

/** The samples a samples file flag names, only those --pick chooses if given. */
function readSamplesFile(
  path: string,
  flag: string,
  pick: unknown,
): ExpectationSample[] {
  const source = `--${flag} ${path}`;
  const all = samplesFromJson(readJsonFileFlag(path, `--${flag}`), source);
  const samples =
    typeof pick === "string" ? pickSamples(all, pick, source) : all;
  if (samples.length > SAMPLES_MAX)
    throw usageError(
      `${source} holds ${samples.length} samples, and a rule or a test takes at most ${SAMPLES_MAX}; take some with --pick.`,
    );
  return samples;
}

/** The one of `names` given as a file path, or null; --pick without one is refused. */
function givenSamplesFlag(
  flags: Record<string, unknown>,
  names: readonly string[],
): string | null {
  const given = names.find((name) => typeof flags[name] === "string") ?? null;
  if (given === null && typeof flags[PICK_FLAG] === "string")
    throw usageError(
      `--pick chooses from a samples file: pass it with ${names.map((name) => `--${name}`).join(" or ")}.`,
    );
  return given;
}

/**
 * The body fields a samples file sets on create-email-rule and
 * update-email-rule: expectation_samples (on update it replaces them) or, on
 * update, add_expectation_samples. With --pick, only the samples it names.
 */
export function samplesBodyFields(
  canAdd: boolean,
): (flags: Record<string, unknown>) => ExtensionBodyField[] {
  const names = canAdd
    ? [SAMPLES_FILE_FLAG, ADD_SAMPLES_FILE_FLAG]
    : [SAMPLES_FILE_FLAG];
  return (flags) => {
    const flag = givenSamplesFlag(flags, names);
    if (flag === null) return [];
    const path = flags[flag] as string;
    const samples = readSamplesFile(path, flag, flags[PICK_FLAG]);
    // Replacing on update may empty the list, which removes them; adding,
    // and a new rule, need at least one.
    if (samples.length === 0 && !(canAdd && flag === SAMPLES_FILE_FLAG))
      throw usageError(`--${flag} ${path} holds no samples.`);
    return [
      {
        flag: `--${flag}`,
        property:
          flag === ADD_SAMPLES_FILE_FLAG
            ? "add_expectation_samples"
            : "expectation_samples",
        value: samples,
      },
    ];
  };
}

/**
 * The samples test-email-rule expects, from --expect-samples-file (only
 * those --pick chooses if given), or null without the flag. They go in
 * expect.samples.
 */
export function expectSamples(
  flags: Record<string, unknown>,
): ExpectationSample[] | null {
  const flag = givenSamplesFlag(flags, [EXPECT_SAMPLES_FILE_FLAG]);
  if (flag === null) return null;
  const path = flags[flag] as string;
  const samples = readSamplesFile(path, flag, flags[PICK_FLAG]);
  if (samples.length === 0)
    throw usageError(`--${flag} ${path} holds no samples.`);
  return samples;
}

/** --pick's help, naming the flags it chooses from. */
export function pickFlagHelp(flags: readonly string[]): string {
  return `Take only these samples from ${flags.map((flag) => `--${flag}`).join(" or ")}, by their numbers from 1 as generate-look-alikes printed them: --pick 2,4. A number the file does not hold is refused.`;
}

// generate-look-alikes

/**
 * What the rule decided for a look-alike, and what its status makes of it,
 * against what it should do: leave it (`no_match`), or take it (`match`).
 */
function decidedLine(
  outcome: unknown,
  status: unknown,
  expected: "match" | "no_match",
): string {
  if (outcome === "not_decided")
    return "The rule did not decide it: it was not reached in time, or deciding it failed.";
  if (outcome === "matched")
    return status === "undecided"
      ? "The rule matched it, but it reads a spam score, which a look-alike does not carry, so this one is undecided."
      : expected === "match"
        ? "The rule matched it, as it should."
        : "The rule matched it, so mail like it would be shared.";
  const decided =
    outcome === "near_miss"
      ? "The rule nearly matched it, but did not"
      : "The rule did not match it";
  if (status === "undecided")
    return `${decided}, on something it could not decide (its classification failed, a fact or a question's answer is missing, or it reads a spam score, which a look-alike does not carry), so this one is undecided.`;
  return expected === "match"
    ? `${decided}, but it should: mail like it would be missed.`
    : `${decided}.`;
}

/**
 * The stderr report of generate-look-alikes: each look-alike numbered as the
 * samples file numbers it, with its status, kind, subject, sender, why the
 * rule should (or should not) match it and what the rule decided; the
 * counts; the answer's note; and how to save the ones you choose. With
 * --samples-file it writes every look-alike there as a sample keeping its
 * expected, in that order.
 */
export function lookAlikesReport(
  data: unknown,
  request: { body: unknown; flags?: Record<string, unknown> },
): OperationReport {
  const file = request.flags?.[LOOK_ALIKES_SAMPLES_FILE_FLAG];
  if (!isRecord(data)) {
    if (typeof file !== "string") return { lines: [] };
    const message = `Did not write --${LOOK_ALIKES_SAMPLES_FILE_FLAG} ${file}: the answer held no look-alikes to write.`;
    return {
      lines: [message],
      exitCode: 1,
      error: { code: "samples_file_not_written", message },
    };
  }
  const entries = lookAlikeEntries(data);
  const lines: string[] = [];
  entries.forEach(({ lookAlike }, index) => {
    const email = lookAlike.email as Record<string, unknown>;
    const from =
      isRecord(email.from) && typeof email.from.address === "string"
        ? email.from.address
        : "an unknown sender";
    const subject =
      typeof email.subject === "string" && email.subject
        ? `"${email.subject}"`
        : "(no subject)";
    const status =
      typeof lookAlike.status === "string" ? lookAlike.status : "undecided";
    const kind = typeof lookAlike.kind === "string" ? lookAlike.kind : "other";
    const outcome =
      typeof lookAlike.outcome === "string" ? lookAlike.outcome : "not_decided";
    const expected = lookAlikeExpected(lookAlike);
    lines.push(`${index + 1}. ${status}  ${kind}  ${subject} from ${from}`);
    if (typeof lookAlike.why === "string" && lookAlike.why.trim())
      lines.push(
        `   Why it should ${expected === "match" ? "" : "not "}match: ${lookAlike.why.trim()}`,
      );
    lines.push(`   ${decidedLine(outcome, status, expected)}`);
  });
  const counts = isRecord(data.counts) ? data.counts : {};
  const count = (key: string) =>
    typeof counts[key] === "number" ? (counts[key] as number) : 0;
  const dropped = count("dropped");
  lines.push(
    `Counts: ${count("passed")} passed, ${count("failed")} failed, ${count("undecided")} undecided${dropped > 0 ? `; ${dropped} asked for did not come back` : ""}.`,
  );
  if (typeof data.note === "string" && data.note.trim())
    lines.push(data.note.trim());

  // Which to keep: those it decided the wrong way (it matched one it must
  // not, or missed one it must match); else, when some are undecided (and
  // would stay so as samples), those it decided as each should be.
  const numbered = (status: string) =>
    entries
      .map(({ lookAlike }, index) =>
        lookAlike.status === status ? index + 1 : 0,
      )
      .filter((n) => n > 0);
  const wanted = (n: number) => entries[n - 1]?.sample.expected === "match";
  const failed = numbered("failed");
  const missed = failed.filter(wanted);
  const matched = failed.filter((n) => !wanted(n));
  const undecided = numbered("undecided");
  const chosen =
    failed.length > 0 ? failed : undecided.length > 0 ? numbered("passed") : [];
  const pick = chosen.length > 0 ? ` --pick ${chosen.join(",")}` : "";
  const body = isRecord(request.body) ? request.body : {};
  const ruleId = typeof body.rule_id === "string" ? body.rule_id : null;
  const requestId =
    typeof body.request_id === "string" ? body.request_id : null;
  const target = typeof file === "string" ? shellWord(file) : "<file>";
  // A saved rule keeps them now; a request's rule, once accepted; a tree's,
  // once created.
  const save = ruleId
    ? `\`primitive email-rules update-email-rule ${ruleId} --${ADD_SAMPLES_FILE_FLAG} ${target}${pick}\``
    : requestId
      ? `\`primitive email-rules accept-email-rule-request ${requestId} --${SAMPLES_FILE_FLAG} ${target}${pick}\` when the member the request asks accepts it`
      : `\`primitive email-rules create-email-rule ... --${SAMPLES_FILE_FLAG} ${target}${pick}\` when you save the rule`;
  const one = (count: number, single: string, many: string) =>
    count === 1 ? single : many;
  // None decided: saved as they are, they would stay undecided.
  const noneDecided =
    entries.length > 0 && undecided.length === entries.length
      ? `None of them was decided (each says why above), so saved as they are they may stay undecided; if the rule reads a spam score, give each email a spam_score${typeof file === "string" ? " in the file" : ""} first.`
      : "";
  const keepMatched = `${one(matched.length, "the one it matched as an email", "the ones it matched as emails")} it must not match`;
  const keepMissed = `${one(missed.length, "the one it missed as an email", "the ones it missed as emails")} it must match`;
  const which =
    failed.length > 0
      ? `Keep ${matched.length > 0 && missed.length > 0 ? `${keepMatched}, and ${keepMissed}` : matched.length > 0 ? keepMatched : keepMissed}`
      : chosen.length > 0
        ? chosen.some(wanted)
          ? `Keep ${one(chosen.length, "the one", "the ones")} it decided as expected (each keeps whether it must match; an undecided one may stay undecided as a sample)`
          : `Keep ${one(chosen.length, "the one it did not match as an email", "the ones it did not match as emails")} it must not match (an undecided one may stay undecided as a sample)`
        : entries.some((_, index) => wanted(index + 1))
          ? `Keep ${one(entries.length, "it as an email", "them as emails")} the rule must match or not, as each says`
          : `Keep ${one(entries.length, "it as an email", "them as emails")} the rule must not match`;
  const test =
    failed.length > 0
      ? ` Test an edited rule on ${one(failed.length, "it", "them")} with \`primitive email-rules test-email-rule ${ruleId ? `--rule-id ${ruleId}` : "--body-file <body.json>"} --${EXPECT_SAMPLES_FILE_FLAG} ${target}${pick}\`.`
      : "";
  if (typeof file === "string") {
    const samples = entries.map((entry) => entry.sample);
    // Nothing to write: leave the file as it is, since an empty list would
    // remove a rule's samples where a file replaces them.
    if (samples.length === 0) {
      const message = `Did not write --${LOOK_ALIKES_SAMPLES_FILE_FLAG} ${file}: no look-alikes came back, so it was left as it was.`;
      return {
        lines: [...lines, message],
        exitCode: 1,
        error: { code: "samples_file_not_written", message },
      };
    }
    try {
      writeFileSync(file, `${JSON.stringify(samples, null, 2)}\n`);
    } catch (error) {
      const message = `Could not write --${LOOK_ALIKES_SAMPLES_FILE_FLAG} ${file}: ${errorDetail(error)}`;
      return {
        lines: [
          ...lines,
          message,
          "The JSON printed above holds these same look-alikes: save it to a file and give that file instead. Running generate-look-alikes again writes new ones.",
        ],
        exitCode: 1,
        error: { code: "samples_file_not_written", message },
      };
    }
    const wrote = `Wrote ${one(samples.length, "the look-alike", `the ${samples.length} look-alikes`)} to ${file}, numbered as above.`;
    lines.push(
      noneDecided
        ? `${wrote} ${noneDecided}`
        : `${wrote} ${which} with ${save}; --pick takes any of the numbers.${test}`,
    );
  } else if (noneDecided) {
    lines.push(noneDecided);
  } else if (entries.length > 0) {
    lines.push(
      `${which}: save the JSON printed above to a file and give it to ${save}; --pick takes any of the numbers above.${test}`,
    );
  }
  return { lines };
}
