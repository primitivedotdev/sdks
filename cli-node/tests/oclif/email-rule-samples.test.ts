import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("keeps attachment_names, as look-alikes now carry them, paired with the types", () => {
    const named = {
      ...email("a"),
      attachment_types: ["application/pdf"],
      attachment_names: ["statement.pdf"],
    };
    expect(
      samplesFromJson([{ expected: "no_match", email: named }], "f"),
    ).toEqual([{ expected: "no_match", email: named }]);
    // A generate-look-alikes answer saved as printed, whose look-alikes carry them.
    expect(
      samplesFromJson(
        answer([
          { ...lookAlike("Statement", "passed", "no_match"), email: named },
        ]),
        "f",
      ).map((sample) => sample.email),
    ).toEqual([named]);
    // Names alone are kept too: the API pairs by position only when both list files.
    const namesOnly = { ...email("b"), attachment_names: ["notes.txt"] };
    expect(
      samplesFromJson([{ expected: "match", email: namesOnly }], "f"),
    ).toEqual([{ expected: "match", email: namesOnly }]);
    expect(() =>
      samplesFromJson(
        [
          {
            expected: "match",
            email: {
              ...email("c"),
              attachment_types: ["application/pdf", "image/png"],
              attachment_names: ["statement.pdf"],
            },
          },
        ],
        "f",
      ),
    ).toThrow(
      "f, sample 1 (index 0): email attachment_names pairs with attachment_types by position, so give the same number of each.",
    );
    expect(() =>
      samplesFromJson(
        [
          {
            expected: "match",
            email: {
              ...email("d"),
              attachment_names: ["x"].concat(Array(10).fill("y")),
            },
          },
        ],
        "f",
      ),
    ).toThrow("email attachment_names must be a list of at most 10 strings");
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
    ).toThrow(
      '--f a.json, sample 1 (index 0): expected must be "match" or "no_match".',
    );
    expect(() =>
      samplesFromJson(
        [{ expected: "match", email: email("x") }, { expected: "match" }],
        "--f a.json",
      ),
    ).toThrow("--f a.json, sample 2 (index 1): email must be an object");
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
    ).toThrow("f, sample 1 (index 0): label is blank");
    expect(() =>
      samplesFromJson(
        [{ expected: "match", email: email("x"), label: "x".repeat(201) }],
        "f",
      ),
    ).toThrow("label is longer than 200 characters");
    // The email itself, checked against what the API keeps.
    const refused = (email: Record<string, unknown>) => () =>
      samplesFromJson([{ expected: "no_match", email }], "f");
    expect(refused({ to: ["a@b.example"], text: "t" })).toThrow(
      "f, sample 1 (index 0): email needs from.address.",
    );
    expect(refused({ ...email("x"), text: "t".repeat(4_001) })).toThrow(
      "email text must be 1 to 4000 characters",
    );
    expect(refused({ ...email("x"), to: [] })).toThrow(
      "email to must be a list of 1 to 10 strings",
    );
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

describe("samples with fields this CLI does not know", () => {
  function captureStderr(): string[] {
    const said: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      said.push(String(chunk));
      return true;
    });
    return said;
  }
  afterEach(() => {
    vi.restoreAllMocks();
  });
  const withNew = (subject: string) => ({
    ...email(subject),
    reply_to: ["r@b.example"],
  });

  it("passes them on for the API to judge instead of refusing, and names them once for the samples sent", () => {
    const said = captureStderr();
    const samples = [
      { expected: "match", email: withNew("one"), lable: "x" },
      { expected: "no_match", email: email("two") },
      { expected: "match", email: withNew("three") },
    ];
    const path = join(dir, "samples.json");
    writeFileSync(path, JSON.stringify(samples));
    const sent = expectSamples({ "expect-samples-file": path });
    expect(sent).toEqual([
      { lable: "x", expected: "match", email: withNew("one") },
      { expected: "no_match", email: email("two") },
      { expected: "match", email: withNew("three") },
    ]);
    expect(said).toEqual([
      `--expect-samples-file ${path} has fields this CLI does not know, which it does not refuse but leaves for the API to judge (if the API refuses one, take it out): sample field "lable" (sample 1 (index 0)), email field "reply_to" (samples 1 (index 0), 3 (index 2)).\n`,
    ]);
    // Only what --pick sends is named, by its number in the file.
    said.length = 0;
    expect(
      expectSamples({ "expect-samples-file": path, pick: "2,3" }),
    ).toHaveLength(2);
    expect(said).toEqual([
      `--expect-samples-file ${path} has fields this CLI does not know, which it does not refuse but leaves for the API to judge (if the API refuses one, take it out): email field "reply_to" (sample 3 (index 2)).\n`,
    ]);
    said.length = 0;
    expectSamples({ "expect-samples-file": path, pick: "2" });
    expect(said).toEqual([]);
  });

  it("says nothing for a file that is then refused, or for known fields", () => {
    const said = captureStderr();
    const path = join(dir, "many.json");
    writeFileSync(
      path,
      JSON.stringify(
        Array.from({ length: 21 }, (_, index) => ({
          expected: "no_match",
          email: index === 0 ? withNew("first") : email(`n${index}`),
        })),
      ),
    );
    // More than a test takes, and a --pick the file does not hold.
    expect(() => expectSamples({ "expect-samples-file": path })).toThrow(
      "holds 21 samples",
    );
    expect(() =>
      expectSamples({ "expect-samples-file": path, pick: "99" }),
    ).toThrow("99 is not a sample number");
    // A sample refused part way through says nothing of the ones before it.
    expect(() =>
      samplesFromJson(
        [
          { expected: "match", email: withNew("one") },
          { expected: "maybe", email: email("two") },
        ],
        "f",
      ),
    ).toThrow("f, sample 2");
    // A look-alikes answer whose emails carry a field added later is not refused either.
    expect(
      samplesFromJson(
        answer([{ kind: "medical", why: "w", email: withNew("x") }]),
        "--x a.json",
      ),
    ).toHaveLength(1);
    // A saved sample's id and time are still left out.
    expect(
      samplesFromJson(
        [{ expected: "match", email: email("x"), id: "s1", created_at: "t" }],
        "f",
      ),
    ).toEqual([{ expected: "match", email: email("x") }]);
    expect(said).toEqual([]);
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

  it("says why a must-match one should match, what a miss means, and keeps both kinds of failure", () => {
    const mixed = answer([
      lookAlike("All clear", "failed", "matched", "other", "no_match"),
      lookAlike("Referral for Miri", "failed", "no_match", "other", "match"),
      lookAlike("Escalation", "passed", "matched", "other", "match"),
    ]);
    const path = join(dir, "mixed.json");
    const report = lookAlikesReport(mixed, {
      body: { rule_id: RULE },
      flags: { "samples-file": path },
    });
    expect(report.lines.slice(0, 9)).toEqual([
      '1. failed  other  "All clear" from billing@clinic.example',
      "   Why it should not match: All clear is private.",
      "   The rule matched it, so mail like it would be shared.",
      '2. failed  other  "Referral for Miri" from billing@clinic.example',
      "   Why it should match: Referral for Miri is private.",
      "   The rule did not match it, but it should: mail like it would be missed.",
      '3. passed  other  "Escalation" from billing@clinic.example',
      "   Why it should match: Escalation is private.",
      "   The rule matched it, as it should.",
    ]);
    expect(report.lines.at(-1)).toContain(
      "Keep the one it matched as an email it must not match, and the one it missed as an email it must match, with",
    );
    expect(report.lines.at(-1)).toContain("--pick 1,2");
    // The file keeps each one's expected, so saving them keeps the right way round.
    expect(
      JSON.parse(readFileSync(path, "utf8")).map(
        (s: { expected: string }) => s.expected,
      ),
    ).toEqual(["no_match", "match", "match"]);
    // A must-match one it nearly took: the miss is said with "though".
    const near = lookAlikesReport(
      answer([
        lookAlike("Escalation", "failed", "near_miss", "other", "match"),
      ]),
      { body: { tree: {} }, flags: {} },
    );
    expect(near.lines).toContain(
      "   The rule nearly matched it, but did not, though it should: mail like it would be missed.",
    );
    // All decided as expected: each kept as it says, must-match ones included.
    const allPassed = lookAlikesReport(
      answer([
        lookAlike("a", "passed", "no_match"),
        lookAlike("Referral", "passed", "matched", "other", "match"),
      ]),
      { body: { tree: {} }, flags: {} },
    );
    expect(allPassed.lines.at(-1)).toMatch(
      /^Keep them as emails the rule must match or not, as each says: /,
    );
    // Only a miss: kept as must-match.
    const missedOnly = lookAlikesReport(
      answer([lookAlike("Referral", "failed", "no_match", "other", "match")]),
      { body: { rule_id: RULE }, flags: {} },
    );
    expect(missedOnly.lines.at(-1)).toMatch(
      /^Keep the one it missed as an email it must match: /,
    );
    // None wrong, some undecided: those decided as expected, each keeping its expected.
    const asExpected = lookAlikesReport(
      answer([
        lookAlike("a", "undecided", "not_decided"),
        lookAlike("Referral", "passed", "matched", "other", "match"),
      ]),
      { body: { tree: {} }, flags: {} },
    );
    expect(asExpected.lines.at(-1)).toMatch(
      /^Keep the one it decided as expected \(each keeps whether it must match; an undecided one may stay undecided as a sample\): /,
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
      `Wrote the 2 look-alikes to ${path}, numbered as above. Keep the one it matched as an email it must not match, with \`primitive email-rules update-email-rule ${RULE} --add-expectation-samples-file ${path} --pick 2\`; --pick takes any of the numbers. Test an edited rule on it with \`primitive email-rules test-email-rule --rule-id ${RULE} --expect-samples-file ${path} --pick 2\`.`,
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
      `Wrote the 3 look-alikes to ${path}, numbered as above. Keep the ones it matched as emails it must not match, with \`primitive email-rules create-email-rule ... --expectation-samples-file '${path}' --pick 1,3\` when you save the rule; --pick takes any of the numbers. Test an edited rule on them with \`primitive email-rules test-email-rule --body-file <body.json> --expect-samples-file '${path}' --pick 1,3\`.`,
    );
  });

  it("saves a request's look-alikes on the rule its accept writes", () => {
    const REQUEST = "00000000-0000-4000-8000-0000000000ee";
    const report = lookAlikesReport(THREE, {
      body: { request_id: REQUEST },
      flags: {},
    });
    expect(report.lines.at(-1)).toBe(
      `Keep the ones it matched as emails it must not match: save the JSON printed above to a file and give it to \`primitive email-rules accept-email-rule-request ${REQUEST} --expectation-samples-file <file> --pick 1,3\` when the member the request asks accepts it; --pick takes any of the numbers above. Test an edited rule on them with \`primitive email-rules test-email-rule --body-file <body.json> --expect-samples-file <file> --pick 1,3\`.`,
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
