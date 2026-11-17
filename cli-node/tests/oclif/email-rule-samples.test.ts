import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  expectSamples,
  groupCountsLines,
  lookAlikeSample,
  lookAlikeSamples,
  lookAlikesReport,
  pickSamples,
  samplesBodyFields,
  samplesFromJson,
  savedSample,
} from "../../src/oclif/email-rule-samples.js";

let dir = "";
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "primitive-email-rule-samples-"));
});
afterEach(() => {
  rmSync(dir, { force: true, recursive: true });
});

function email(subject: string, from = "billing@clinic.example") {
  return {
    from: { address: from },
    to: ["me@acme.example"],
    cc: [],
    subject,
    text: `${subject}, the text.`,
    attachment_types: [],
    automated: false,
    from_mailing_list: false,
  };
}

function lookAlike(
  subject: string,
  status: "passed" | "failed" | "undecided",
  outcome: "matched" | "near_miss" | "no_match" | "not_decided",
  kind = "medical",
  expected?: "match" | "no_match",
) {
  return {
    kind,
    ...(expected ? { expected } : {}),
    why: `${subject} is private.`,
    email: email(subject),
    outcome,
    status,
    question_answers: [],
  };
}

function answer(lookAlikes: unknown[], dropped = 0) {
  const statuses = lookAlikes.map(
    (item) => (item as { status: string }).status,
  );
  return {
    rule: { tree: {} },
    look_alikes: lookAlikes,
    counts: {
      passed: statuses.filter((s) => s === "passed").length,
      failed: statuses.filter((s) => s === "failed").length,
      undecided: statuses.filter((s) => s === "undecided").length,
      dropped,
    },
    note: "These emails are made up; none was sent or stored.",
  };
}

const THREE = answer([
  lookAlike("Your dental invoice", "failed", "matched"),
  lookAlike("March payslips", "passed", "no_match", "payroll"),
  lookAlike("Your new headphones", "failed", "matched", "personal_purchase"),
]);

function file(name: string, content: unknown): string {
  const path = join(dir, name);
  writeFileSync(
    path,
    typeof content === "string" ? content : JSON.stringify(content),
  );
  return path;
}

describe("lookAlikeSample", () => {
  it("keeps the email as written, as must-not-match, labelled kind and why", () => {
    expect(
      lookAlikeSample(lookAlike("Your dental invoice", "failed", "matched")),
    ).toEqual({
      expected: "no_match",
      label: "medical: Your dental invoice is private.",
      email: email("Your dental invoice"),
    });
  });

  it("labels with the why alone when kind and why do not fit 200", () => {
    const why = "w".repeat(195);
    expect(
      lookAlikeSample({ kind: "personal_purchase", why, email: email("x") })
        ?.label,
    ).toBe(why);
    const long = "w".repeat(250);
    const label = lookAlikeSample({ kind: "medical", why: long, email: {} })
      ?.label as string;
    expect(label.length).toBe(200);
    expect(label.endsWith("...")).toBe(true);
    // Cut to 200 as the API counts it, never inside a character.
    const wide = lookAlikeSample({
      kind: "medical",
      why: "\u{1F600}".repeat(150),
      email: {},
    })?.label as string;
    expect(wide.length).toBeLessThanOrEqual(200);
    expect(wide).toBe(`${"\u{1F600}".repeat(98)}...`);
  });

  it("skips one without an email", () => {
    expect(lookAlikeSample({ kind: "medical", why: "x" })).toBeNull();
  });

  it("keeps a look-alike's expected, so a near case the rule should take is saved as must-match", () => {
    expect(
      lookAlikeSample(
        lookAlike("Referral for Miri", "passed", "matched", "other", "match"),
      )?.expected,
    ).toBe("match");
    expect(
      lookAlikeSample(
        lookAlike("All clear", "passed", "no_match", "other", "no_match"),
      )?.expected,
    ).toBe("no_match");
    // An answer from an older server has no expected: must-not-match, as before.
    expect(
      lookAlikeSample(lookAlike("x", "passed", "no_match"))?.expected,
    ).toBe("no_match");
  });
});

describe("samplesFromJson", () => {
  it("takes an array of samples, keeping expected, label and email", () => {
    const samples = [
      { expected: "match", email: email("a") },
      { expected: "no_match", label: null, email: email("b"), id: "x" },
    ];
    expect(samplesFromJson(samples, "f")).toEqual([
      { expected: "match", email: email("a") },
      { expected: "no_match", label: null, email: email("b") },
    ]);
  });

  it("takes a generate-look-alikes answer, bare or as --json printed it", () => {
    const expected = lookAlikeSamples(THREE);
    expect(expected).toHaveLength(3);
    expect(samplesFromJson(THREE, "f")).toEqual(expected);
    expect(samplesFromJson({ success: true, data: THREE }, "f")).toEqual(
      expected,
    );
  });

  it("refuses only a file that is neither shape, and leaves each sample to the API", () => {
    expect(() => samplesFromJson({ x: 1 }, "--f a.json")).toThrow(
      "--f a.json must hold a JSON array of samples",
    );
    expect(() => samplesFromJson([3], "--f a.json")).toThrow(
      "--f a.json, sample 1 (index 0) is not an object.",
    );
    // What a sample holds is sent as it is, a saved one's id and time aside.
    const odd = {
      expected: "maybe",
      label: "  ",
      email: { to: [] },
      reply_to: ["r@b.example"],
    };
    expect(
      samplesFromJson([{ ...odd, id: "s1", created_at: "t" }], "f"),
    ).toEqual([odd]);
    // An empty answer is refused, so it never empties a rule's samples;
    // only a literal [] does.
    expect(() => samplesFromJson(answer([]), "--x a.json")).toThrow(
      "--x a.json is a generate-look-alikes answer with no look-alikes in it.",
    );
    expect(samplesFromJson([], "f")).toEqual([]);
  });
});

describe("pickSamples", () => {
  const samples = lookAlikeSamples(THREE);

  it("takes the numbered ones from 1, in the order given, once each", () => {
    expect(pickSamples(samples, "3,1", "f")).toEqual([samples[2], samples[0]]);
    expect(pickSamples(samples, " 2  2,", "f")).toEqual([samples[1]]);
  });

  it("refuses a number the file does not hold, and what is not a number", () => {
    expect(() => pickSamples(samples, "1,4", "--x f.json")).toThrow(
      "--pick 1,4: 4 is not a sample number; --x f.json holds samples 1 to 3.",
    );
    expect(() => pickSamples(samples, "0", "f")).toThrow(
      "0 is not a sample number",
    );
    expect(() => pickSamples(samples.slice(0, 1), "2", "f")).toThrow(
      "f holds sample 1.",
    );
    expect(() => pickSamples([], "1", "f")).toThrow("f holds no samples.");
    expect(() => pickSamples(samples, "1-2", "f")).toThrow(
      '"1-2" is not a sample number',
    );
    expect(() => pickSamples(samples, " , ", "f")).toThrow(
      "--pick needs the numbers",
    );
  });
});

describe("samplesBodyFields and expectSamples", () => {
  it("sets expectation_samples on create, the picked ones only", () => {
    const path = file("s.json", lookAlikeSamples(THREE));
    expect(
      samplesBodyFields(false)({ "expectation-samples-file": path, pick: "2" }),
    ).toEqual([
      {
        flag: "--expectation-samples-file",
        property: "expectation_samples",
        value: [lookAlikeSamples(THREE)[1]],
      },
    ]);
  });

  it("adds with add_expectation_samples on update, and replaces with []", () => {
    const path = file("s.json", lookAlikeSamples(THREE));
    expect(
      samplesBodyFields(true)({ "add-expectation-samples-file": path }),
    ).toEqual([
      {
        flag: "--add-expectation-samples-file",
        property: "add_expectation_samples",
        value: lookAlikeSamples(THREE),
      },
    ]);
    const empty = file("empty.json", "[]");
    expect(
      samplesBodyFields(true)({ "expectation-samples-file": empty }),
    ).toEqual([
      {
        flag: "--expectation-samples-file",
        property: "expectation_samples",
        value: [],
      },
    ]);
    expect(() =>
      samplesBodyFields(false)({ "expectation-samples-file": empty }),
    ).toThrow("holds no samples");
    expect(() =>
      samplesBodyFields(true)({ "add-expectation-samples-file": empty }),
    ).toThrow("holds no samples");
  });

  it("refuses --pick without a samples file", () => {
    expect(() => samplesBodyFields(true)({ pick: "1" })).toThrow(
      "--pick chooses from a samples file: pass it with --expectation-samples-file or --add-expectation-samples-file.",
    );
    expect(() => expectSamples({ pick: "1" })).toThrow(
      "pass it with --expect-samples-file.",
    );
    expect(samplesBodyFields(true)({})).toEqual([]);
    expect(expectSamples({})).toBeNull();
  });

  it("sends every sample the file holds, or those --pick takes, and leaves the count to the API", () => {
    const many = Array.from({ length: 21 }, (_, i) => ({
      expected: "no_match",
      email: email(`s${i}`),
    }));
    const path = file("many.json", many);
    expect(expectSamples({ "expect-samples-file": path })).toHaveLength(21);
    expect(
      expectSamples({ "expect-samples-file": path, pick: "21,1" }),
    ).toEqual([
      { expected: "no_match", email: email("s20") },
      { expected: "no_match", email: email("s0") },
    ]);
  });

  it("keeps a look-alike's group for a test, and saves only expected, label and email", () => {
    const grouped = answer([
      {
        ...lookAlike("Your dental invoice", "failed", "matched"),
        group: "private",
      },
      {
        ...lookAlike("Statement", "passed", "matched", "near_case", "match"),
        group: "must_match",
      },
      { ...lookAlike("Odd", "passed", "no_match"), group: "unknown" },
    ]);
    const path = file("la.json", { success: true, data: grouped });
    const tested = expectSamples({ "expect-samples-file": path }) ?? [];
    expect(tested.map((sample) => sample.group)).toEqual([
      "private",
      "must_match",
      undefined,
    ]);
    const saved = samplesBodyFields(false)({
      "expectation-samples-file": path,
      pick: "1,2",
    })[0]?.value as Record<string, unknown>[];
    expect(saved).toHaveLength(2);
    for (const sample of saved)
      expect(Object.keys(sample).sort()).toEqual([
        "email",
        "expected",
        "label",
      ]);
    // A samples file written by hand loses its group, and anything else, too.
    const raw = file("raw.json", [
      {
        expected: "no_match",
        label: null,
        email: email("x"),
        group: "private",
        note: 1,
      },
    ]);
    expect(
      samplesBodyFields(true)({ "add-expectation-samples-file": raw })[0]
        ?.value,
    ).toEqual([{ expected: "no_match", label: null, email: email("x") }]);
    expect(savedSample({ expected: "match", email: {} })).toEqual({
      expected: "match",
      email: {},
    });
  });

  it("fails like --body-file on a file it cannot read or parse", () => {
    expect(() =>
      expectSamples({ "expect-samples-file": join(dir, "missing.json") }),
    ).toThrow("Could not read --expect-samples-file");
    expect(() =>
      expectSamples({ "expect-samples-file": file("bad.json", "{") }),
    ).toThrow("is not valid JSON");
  });
});

describe("lookAlikesReport", () => {
  it("numbers each look-alike as --pick takes it, with its status, why and outcome, then the counts and notes", () => {
    const report = lookAlikesReport(
      answer(
        [
          lookAlike("Your dental invoice", "failed", "matched"),
          lookAlike("Statement", "passed", "matched", "near_case", "match"),
          lookAlike("Pay\u001b[2Jslip", "undecided", "not_decided", "payroll"),
        ],
        2,
      ),
    );
    expect(report.exitCode).toBeUndefined();
    expect(report.lines).toEqual([
      '1. failed  medical  "Your dental invoice" from billing@clinic.example',
      "   Why it should not match: Your dental invoice is private.",
      "   matched (expected no_match)",
      '2. passed  near_case  "Statement" from billing@clinic.example',
      "   Why it should match: Statement is private.",
      "   matched (expected match)",
      '3. undecided  payroll  "Payslip" from billing@clinic.example',
      "   Why it should not match: Payslip is private.",
      "   not_decided (expected no_match)",
      "Counts: 1 passed, 1 failed, 1 undecided; 2 asked for did not come back.",
      "These emails are made up; none was sent or stored.",
    ]);
  });

  it("marks close calls and groups, and counts them", () => {
    const report = lookAlikesReport({
      look_alikes: [
        {
          ...lookAlike("Your dental invoice", "passed", "no_match"),
          group: "private",
          close_call: true,
        },
      ],
      counts: {
        passed: 1,
        failed: 0,
        undecided: 0,
        close_calls: 1,
        dropped: 0,
        by_group: {
          private: { passed: 1, failed: 0, undecided: 0 },
          near_miss: { passed: 0, failed: 0, undecided: 0 },
          must_match: { passed: 0, failed: 0, undecided: 0 },
        },
      },
    });
    expect(report.lines).toEqual([
      '1. passed  medical (private)  "Your dental invoice" from billing@clinic.example',
      "   Why it should not match: Your dental invoice is private.",
      "   no_match (expected no_match); a close call: decided by an answer below 0.75 confidence, so it may come out the other way when judged again",
      "Counts: 1 passed, 0 failed, 0 undecided; 1 close call.",
      "By group: private 1 passed.",
    ]);
  });

  it("prints only the counts and notes when none came back", () => {
    expect(lookAlikesReport(answer([])).lines).toEqual([
      "Counts: 0 passed, 0 failed, 0 undecided.",
      "These emails are made up; none was sent or stored.",
    ]);
  });
});

describe("groupCountsLines", () => {
  it("names each group with something in it, and nothing for none", () => {
    expect(
      groupCountsLines({
        private: { passed: 3, failed: 0, undecided: 0 },
        near_miss: { passed: 1, failed: 1, undecided: 2 },
        must_match: { passed: 0, failed: 0, undecided: 0 },
      }),
    ).toEqual([
      "By group: private 3 passed; near_miss 1 passed, 1 failed, 2 undecided.",
    ]);
    expect(groupCountsLines(undefined)).toEqual([]);
    expect(
      groupCountsLines({ private: { passed: 0, failed: 0, undecided: 0 } }),
    ).toEqual([]);
  });
});
