// Made-up emails a rule keeps as expectations (expectation_samples), read
// from a samples file: a JSON array of samples, or a generate-look-alikes
// answer saved with --json, whose look-alikes are numbered from 1 as its
// report numbers them, so --pick picks what the report showed.
//
//   primitive email-rules generate-look-alikes --rule-id <id> --json > la.json
//   primitive email-rules update <id> \
//     --add-samples-file la.json --pick 2,4
//
// This module does not import email-rule-authoring.ts, which imports it.

import { readFileSync } from "node:fs";
import { Errors } from "@oclif/core";
import type {
  ExtensionBodyField,
  OperationReport,
} from "./operation-extension.js";
import { ruleNotesLines } from "./rule-notes.js";
import { shownLine, shownText, terminalLine } from "./terminal-text.js";

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function usageError(message: string): Errors.CLIError {
  return new Errors.CLIError(message, { exit: 2 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** A JSON file a flag names, parsed, or a usage error (exit 2) saying why not. */
export function readJsonFileFlag(path: string, flag: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    throw new Errors.CLIError(
      `Could not read ${flag} ${path}: ${errorDetail(error)}`,
      { exit: 2 },
    );
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Errors.CLIError(
      `${flag} ${path} is not valid JSON: ${errorDetail(error)}`,
      { exit: 2 },
    );
  }
}

/** The longest label the API keeps on a sample. */
const SAMPLE_LABEL_MAX = 200;

/** A look-alike's group, which a test counts samples by. */
export type SampleGroup = "private" | "near_miss" | "must_match";

const SAMPLE_GROUPS: ReadonlySet<string> = new Set([
  "private",
  "near_miss",
  "must_match",
]);

export type ExpectationSample = {
  expected: "match" | "no_match";
  label?: string | null;
  email: Record<string, unknown>;
  /** Sent in a test's expect.samples only: a rule's saved samples take no group. */
  group?: SampleGroup;
};

/**
 * A sample as a rule keeps it (expectation_samples and
 * add_expectation_samples): only expected, label and email. The API refuses
 * anything else there, a look-alike's group among them.
 */
export function savedSample(sample: ExpectationSample): ExpectationSample {
  return {
    expected: sample.expected,
    ...(sample.label !== undefined ? { label: sample.label } : {}),
    email: sample.email,
  };
}

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
 * API gives it.
 */
function lookAlikeExpected(
  lookAlike: Record<string, unknown>,
): "match" | "no_match" {
  return lookAlike.expected === "match" ? "match" : "no_match";
}

/**
 * A look-alike as a sample, keeping its `expected` (most must not match; a
 * near case the rule should take must match) and its group: the email as
 * written, labelled with its kind and why ("medical: ..."), or the why alone
 * when both do not fit a label. The group goes to a test only; savedSample
 * leaves it out of what a rule keeps.
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
  const group =
    typeof lookAlike.group === "string" && SAMPLE_GROUPS.has(lookAlike.group)
      ? (lookAlike.group as SampleGroup)
      : undefined;
  return {
    expected: lookAlikeExpected(lookAlike),
    ...(label ? { label } : {}),
    email: lookAlike.email,
    ...(group ? { group } : {}),
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

/**
 * The samples a file holds: a JSON array of samples, or a
 * generate-look-alikes answer saved as the command printed it (with or
 * without --json), whose look-alikes become samples, each keeping whether it
 * must match, numbered as its report numbered them. The API checks each
 * sample. Only a literal [] holds no samples; an answer with none is
 * refused, so it never empties a rule's.
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
    return samples;
  }
  if (!Array.isArray(data))
    throw usageError(
      `${source} must hold a JSON array of samples, such as [{"expected": "no_match", "label": "a personal bill", "email": {...}}], or a generate-look-alikes answer.`,
    );
  return data.map((item, index) => {
    if (!isRecord(item))
      throw usageError(
        `${source}, sample ${index + 1} (index ${index}) is not an object.`,
      );
    // A saved sample's id and time are read back from a rule, and not sent.
    const { id: _id, created_at: _createdAt, ...sample } = item;
    return sample as ExpectationSample;
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

/** The samples file flags: replace (create and update), add (update), and test. */
export const SAMPLES_FILE_FLAG = "samples-file";
export const ADD_SAMPLES_FILE_FLAG = "add-samples-file";
export const EXPECT_SAMPLES_FILE_FLAG = "expect-samples-file";
export const PICK_FLAG = "pick";

/** The samples a samples file flag names, only those --pick chooses if given. */
function readSamplesFile(
  path: string,
  flag: string,
  pick: unknown,
): ExpectationSample[] {
  const source = `--${flag} ${path}`;
  const all = samplesFromJson(readJsonFileFlag(path, `--${flag}`), source);
  return typeof pick === "string" ? pickSamples(all, pick, source) : all;
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
 * The body fields a samples file sets on create and
 * update: expectation_samples (on update it replaces them) or, on
 * update, add_expectation_samples. With --pick, only the samples it names.
 * Each is sent as savedSample gives it, without a look-alike's group.
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
        value: samples.map(savedSample),
      },
    ];
  };
}

/**
 * The samples test expects, from --expect-samples-file (only
 * those --pick chooses if given), or null without the flag. They go in
 * expect.samples, each look-alike keeping its group, which the answer counts
 * samples by.
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

/**
 * What a close call means, beside a passed or failed one: it was decided by an
 * answer below 0.75 confidence, so judging it again may decide it the other
 * way.
 */
export const CLOSE_CALL_NOTE =
  "a close call: decided by an answer below 0.75 confidence, so it may come out the other way when judged again";

/**
 * Counts by look-alike group (by_group), one line, groups with nothing in
 * them left out: "By group: private 3 passed; near_miss 1 passed, 1 failed."
 */
export function groupCountsLines(byGroup: unknown): string[] {
  if (!isRecord(byGroup)) return [];
  const parts: string[] = [];
  for (const group of SAMPLE_GROUPS) {
    const tally = byGroup[group];
    if (!isRecord(tally)) continue;
    const counted = (["passed", "failed", "undecided"] as const)
      .filter((key) => typeof tally[key] === "number" && Number(tally[key]) > 0)
      .map((key) => `${tally[key]} ${key}`);
    if (counted.length > 0) parts.push(`${group} ${counted.join(", ")}`);
  }
  return parts.length > 0 ? [`By group: ${parts.join("; ")}.`] : [];
}

// generate-look-alikes

/**
 * The stderr report of generate-look-alikes: each look-alike numbered as
 * --pick takes it (the answer saved with --json is a samples file), with its
 * status, kind, subject and sender, why the rule should (or should not)
 * match it, and what the rule decided; the counts; then the server's notes.
 */
export function lookAlikesReport(data: unknown): OperationReport {
  if (!isRecord(data)) return { lines: [] };
  const lines: string[] = [];
  lookAlikeEntries(data).forEach(({ lookAlike }, index) => {
    const email = lookAlike.email as Record<string, unknown>;
    const from = isRecord(email.from) ? shownText(email.from.address) : "";
    const subject = shownText(email.subject);
    const status = shownLine(lookAlike.status) || "undecided";
    const kind = shownLine(lookAlike.kind) || "other";
    const outcome = shownLine(lookAlike.outcome) || "not_decided";
    const expected = lookAlikeExpected(lookAlike);
    const group = shownLine(lookAlike.group);
    lines.push(
      `${index + 1}. ${status}  ${kind}${group ? ` (${group})` : ""}  ${subject ? `"${subject}"` : "(no subject)"} from ${from || "an unknown sender"}`,
    );
    const why = shownLine(lookAlike.why);
    if (why)
      lines.push(
        `   Why it should ${expected === "match" ? "" : "not "}match: ${why}`,
      );
    lines.push(
      `   ${outcome} (expected ${expected})${lookAlike.close_call === true ? `; ${CLOSE_CALL_NOTE}` : ""}`,
    );
  });
  const counts = isRecord(data.counts) ? data.counts : {};
  const count = (key: string) =>
    typeof counts[key] === "number" ? (counts[key] as number) : 0;
  const dropped = count("dropped");
  const closeCalls = count("close_calls");
  lines.push(
    `Counts: ${count("passed")} passed, ${count("failed")} failed, ${count("undecided")} undecided${closeCalls > 0 ? `; ${closeCalls} close ${closeCalls === 1 ? "call" : "calls"}` : ""}${dropped > 0 ? `; ${dropped} asked for did not come back` : ""}.`,
    ...groupCountsLines(counts.by_group),
    ...ruleNotesLines(data),
  );
  return { lines: lines.map(terminalLine) };
}
