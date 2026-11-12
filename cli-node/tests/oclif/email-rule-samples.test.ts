import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  expectSamples,
  lookAlikeSample,
  lookAlikeSamples,
  lookAlikesReport,
  pickSamples,
  samplesBodyFields,
  samplesFromJson,
  sentSampleNumber,
} from "../../src/oclif/email-rule-samples.js";

const RULE = "00000000-0000-4000-8000-0000000000aa";

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
) {
  return {
    kind,
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

  it("refuses anything else, naming the sample", () => {
    expect(() => samplesFromJson({ x: 1 }, "--f a.json")).toThrow(
      "--f a.json must hold a JSON array of samples",
    );
    expect(() =>
      samplesFromJson([{ expected: "maybe", email: email("x") }], "--f a.json"),
    ).toThrow('--f a.json, sample 1: expected must be "match" or "no_match".');
    expect(() =>
      samplesFromJson(
        [{ expected: "match", email: email("x") }, { expected: "match" }],
        "--f a.json",
      ),
    ).toThrow("--f a.json, sample 2: email must be an object");
    expect(() =>
      samplesFromJson(
        [{ expected: "match", email: email("x"), label: 3 }],
        "f",
      ),
    ).toThrow("label must be a string");
    expect(() =>
      samplesFromJson(
        [{ expected: "match", email: email("x"), label: "  " }],
        "f",
      ),
    ).toThrow("f, sample 1: label is blank");
    expect(() =>
      samplesFromJson(
        [{ expected: "match", email: email("x"), label: "x".repeat(201) }],
        "f",
      ),
    ).toThrow("label is longer than 200 characters");
    expect(() =>
      samplesFromJson(
        [{ expected: "match", email: email("x"), lable: "x" }],
        "f",
      ),
    ).toThrow('f, sample 1: "lable" is not a sample field');
    // The email itself, checked against what the API keeps.
    const refused = (email: Record<string, unknown>) => () =>
      samplesFromJson([{ expected: "no_match", email }], "f");
    expect(refused({ to: ["a@b.example"], text: "t" })).toThrow(
      "f, sample 1: email needs from.address.",
    );
    expect(refused({ ...email("x"), text: "t".repeat(4_001) })).toThrow(
      "email text must be 1 to 4000 characters",
    );
    expect(refused({ ...email("x"), to: [] })).toThrow(
      "email to must be a list of 1 to 10 strings",
    );
    expect(refused({ ...email("x"), bcc: [] })).toThrow('email takes no "bcc"');
    expect(refused({ ...email("x"), automated: "no" })).toThrow(
      "email automated must be true or false",
    );
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

  it("refuses more than 20 samples, after --pick", () => {
    const many = Array.from({ length: 21 }, (_, i) => ({
      expected: "no_match",
      email: email(`s${i}`),
    }));
    const path = file("many.json", many);
    expect(() => expectSamples({ "expect-samples-file": path })).toThrow(
      `--expect-samples-file ${path} holds 21 samples, and a rule or a test takes at most 20; take some with --pick.`,
    );
    expect(
      expectSamples({ "expect-samples-file": path, pick: "21,1" }),
    ).toEqual([
      { expected: "no_match", email: email("s20") },
      { expected: "no_match", email: email("s0") },
    ]);
  });

  it("names a sent sample by its number in the file when --pick chose it", () => {
    expect(sentSampleNumber(0, { pick: "3,1" })).toBe(3);
    expect(sentSampleNumber(1, { pick: "3 1" })).toBe(1);
    expect(sentSampleNumber(1, {})).toBe(2);
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
  it("numbers each look-alike with its status, why and what the rule decided", () => {
    const report = lookAlikesReport(THREE, {
      body: { rule_id: RULE },
      flags: {},
    });
    expect(report.exitCode).toBeUndefined();
    expect(report.lines).toEqual([
      '1. failed  medical  "Your dental invoice" from billing@clinic.example',
      "   Why it should not match: Your dental invoice is private.",
      "   The rule matched it, so mail like it would be shared.",
      '2. passed  payroll  "March payslips" from billing@clinic.example',
      "   Why it should not match: March payslips is private.",
      "   The rule did not match it.",
      '3. failed  personal_purchase  "Your new headphones" from billing@clinic.example',
      "   Why it should not match: Your new headphones is private.",
      "   The rule matched it, so mail like it would be shared.",
      "Counts: 1 passed, 2 failed, 0 undecided.",
      "These emails are made up; none was sent or stored.",
      `Keep the ones it matched as emails it must not match: save the JSON printed above to a file and give it to \`primitive email-rules update-email-rule ${RULE} --add-expectation-samples-file <file> --pick 1,3\`; --pick takes any of the numbers above. Test an edited rule on them with \`primitive email-rules test-email-rule --rule-id ${RULE} --expect-samples-file <file> --pick 1,3\`.`,
    ]);
  });

  it("says what undecided and not decided mean, and what did not come back", () => {
    const report = lookAlikesReport(
      answer(
        [
          lookAlike("a", "undecided", "matched"),
          lookAlike("b", "undecided", "near_miss"),
          lookAlike("c", "undecided", "not_decided"),
          lookAlike("d", "passed", "near_miss"),
        ],
        2,
      ),
      { body: { tree: {} }, flags: {} },
    );
    expect(report.lines.filter((line) => line.startsWith("   The"))).toEqual([
      "   The rule matched it, but it reads a spam score, which a look-alike does not carry, so this one is undecided.",
      "   The rule nearly matched it, but did not, on something it could not decide (its classification failed, a fact or a question's answer is missing, or it reads a spam score, which a look-alike does not carry), so this one is undecided.",
      "   The rule did not decide it: it was not reached in time, or deciding it failed.",
      "   The rule nearly matched it, but did not.",
    ]);
    expect(report.lines).toContain(
      "Counts: 1 passed, 0 failed, 3 undecided; 2 asked for did not come back.",
    );
    // None matched and some are undecided: it suggests the ones it did not
    // match, since an undecided one stays undecided as a sample.
    expect(report.lines.at(-1)).toBe(
      "Keep the one it did not match as an email it must not match (an undecided one may stay undecided as a sample): save the JSON printed above to a file and give it to `primitive email-rules create-email-rule ... --expectation-samples-file <file> --pick 4` when you save the rule; --pick takes any of the numbers above.",
    );
  });

  it("writes the samples file in the order the report numbers them", () => {
    const path = join(dir, "look-alikes.json");
    const withoutEmail = { kind: "medical", why: "no email", status: "failed" };
    const data = answer([
      lookAlike("first", "passed", "no_match"),
      withoutEmail,
      lookAlike("second", "failed", "matched"),
    ]);
    const report = lookAlikesReport(data, {
      body: { rule_id: RULE },
      flags: { "samples-file": path },
    });
    const written = JSON.parse(readFileSync(path, "utf8"));
    expect(written).toEqual(lookAlikeSamples(data));
    expect(
      written.map((s: { email: { subject: string } }) => s.email.subject),
    ).toEqual(["first", "second"]);
    expect(report.lines.filter((line) => /^\d+\. /.test(line))).toEqual([
      '1. passed  medical  "first" from billing@clinic.example',
      '2. failed  medical  "second" from billing@clinic.example',
    ]);
    expect(report.lines.at(-1)).toBe(
      `Wrote the 2 look-alikes to ${path}, numbered as above. Keep the one it matched as an email it must not match with \`primitive email-rules update-email-rule ${RULE} --add-expectation-samples-file ${path} --pick 2\`; --pick takes any of the numbers. Test an edited rule on it with \`primitive email-rules test-email-rule --rule-id ${RULE} --expect-samples-file ${path} --pick 2\`.`,
    );
    // The file it wrote is what --pick reads, numbered the same.
    expect(
      pickSamples(samplesFromJson(written, "f"), "2", "f")[0]?.email,
    ).toEqual(email("second"));
  });

  it("quotes a path with spaces in the commands it suggests, and tests a tree by its body", () => {
    const path = join(dir, "my look-alikes.json");
    const report = lookAlikesReport(THREE, {
      body: { tree: {} },
      flags: { "samples-file": path },
    });
    expect(report.lines.at(-1)).toBe(
      `Wrote the 3 look-alikes to ${path}, numbered as above. Keep the ones it matched as emails it must not match with \`primitive email-rules create-email-rule ... --expectation-samples-file '${path}' --pick 1,3\` when you save the rule; --pick takes any of the numbers. Test an edited rule on them with \`primitive email-rules test-email-rule --body-file <body.json> --expect-samples-file '${path}' --pick 1,3\`.`,
    );
  });

  it("says a request's rule keeps them once accepted", () => {
    const REQUEST = "00000000-0000-4000-8000-0000000000ee";
    const report = lookAlikesReport(THREE, {
      body: { request_id: REQUEST },
      flags: {},
    });
    expect(report.lines.at(-1)).toBe(
      `Keep the ones it matched as emails it must not match: when the member the request asks accepts request ${REQUEST}, the accept keeps those its body sends as expectation_samples on the rule it writes (numbers 1, 3 above). Test an edited rule on them with \`primitive email-rules test-email-rule --body-file <body.json> --expect-samples-file <file> --pick 1,3\`.`,
    );
    // None came back: nothing to keep, so no sentence about it.
    const none = lookAlikesReport(answer([], 6), {
      body: { request_id: REQUEST },
      flags: {},
    });
    expect(none.lines.join(" ")).not.toContain("accepts request");
  });

  it("suggests keeping them all when every one passed", () => {
    const report = lookAlikesReport(
      answer([
        lookAlike("a", "passed", "no_match"),
        lookAlike("b", "passed", "near_miss"),
      ]),
      { body: { rule_id: RULE }, flags: {} },
    );
    expect(report.lines.at(-1)).toBe(
      `Keep them as emails the rule must not match: save the JSON printed above to a file and give it to \`primitive email-rules update-email-rule ${RULE} --add-expectation-samples-file <file>\`; --pick takes any of the numbers above.`,
    );
  });

  it("leaves the file as it was when none came back, and exits 1", () => {
    // An empty list would remove a rule's samples where a file replaces them.
    const path = file("earlier.json", [{ expected: "no_match", email: {} }]);
    const report = lookAlikesReport(answer([], 6), {
      body: { rule_id: RULE },
      flags: { "samples-file": path },
    });
    expect(JSON.parse(readFileSync(path, "utf8"))).toHaveLength(1);
    expect(report.exitCode).toBe(1);
    expect(report.error?.code).toBe("samples_file_not_written");
    expect(report.lines).toEqual([
      "Counts: 0 passed, 0 failed, 0 undecided; 6 asked for did not come back.",
      "These emails are made up; none was sent or stored.",
      `Did not write --samples-file ${path}: no look-alikes came back, so it was left as it was.`,
    ]);
  });

  it("exits 1 with samples_file_not_written when it cannot write the file", () => {
    const path = join(dir, "missing-dir", "look-alikes.json");
    const report = lookAlikesReport(THREE, {
      body: { rule_id: RULE },
      flags: { "samples-file": path },
    });
    expect(report.exitCode).toBe(1);
    expect(report.error?.code).toBe("samples_file_not_written");
    expect(report.lines.at(-2)).toContain(
      `Could not write --samples-file ${path}:`,
    );
    // Not a re-run, which writes new ones: the JSON printed holds these.
    expect(report.lines.at(-1)).toBe(
      "The JSON printed above holds these same look-alikes: save it to a file and give that file instead. Running generate-look-alikes again writes new ones.",
    );
    // An answer that is not one writes nothing, and says so.
    const none = lookAlikesReport(null, {
      body: {},
      flags: { "samples-file": path },
    });
    expect(none.exitCode).toBe(1);
    expect(none.error?.code).toBe("samples_file_not_written");
  });

  it("says saving them is no use when none was decided", () => {
    const path = join(dir, "undecided.json");
    const report = lookAlikesReport(
      answer([
        lookAlike("a", "undecided", "no_match"),
        lookAlike("b", "undecided", "matched"),
      ]),
      { body: { rule_id: RULE }, flags: { "samples-file": path } },
    );
    expect(report.lines.at(-1)).toBe(
      `Wrote the 2 look-alikes to ${path}, numbered as above. None of them was decided (each says why above), so saved as they are they may stay undecided; if the rule reads a spam score, give each email a spam_score in the file first.`,
    );
  });
});
