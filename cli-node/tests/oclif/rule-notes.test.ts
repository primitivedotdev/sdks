import { describe, expect, it } from "vitest";
import { ruleNotesLines } from "../../src/oclif/rule-notes.js";
// Importing the command table registers the commands withCliCommands names.
import "../../src/oclif/index.js";

describe("ruleNotesLines", () => {
  it("prints each note key once, in order: scope warnings, warnings, then notes", () => {
    expect(
      ruleNotesLines({
        note: "Top note.",
        warnings: ["First.", "First."],
        summary: { warnings: ["From the summary."] },
        scope_warnings: [
          { name: "typo.example", reason: "unknown_domain", message: "" },
          {
            name: "gmail.com",
            reason: "unknown_domain",
            message: "gmail.com is none of your domains.",
          },
        ],
        rule: { note: "Rule note." },
      }),
    ).toEqual([
      "Scope warning: typo.example (unknown_domain)",
      "Scope warning: gmail.com is none of your domains.",
      "Warning: First.",
      "Warning: From the summary.",
      "Top note.",
      "Rule note.",
    ]);
  });

  it("prints a rule's protection note and the answer's note", () => {
    expect(
      ruleNotesLines({
        id: "r",
        note: "The share goes on under the new version.",
        rule: { protection_note: "It protects nothing yet." },
      }),
    ).toEqual([
      "The share goes on under the new version.",
      "It protects nothing yet.",
    ]);
  });

  it("prints a tested rule's warnings", () => {
    expect(
      ruleNotesLines({ rule: { warnings: ["The tree reads no question."] } }),
    ).toEqual(["Warning: The tree reads no question."]);
  });

  it("prints a rule request's share terms and a target check's warning", () => {
    expect(
      ruleNotesLines({
        id: "q",
        share_terms: "Accepting shares mail from now on.",
      }),
    ).toEqual(["Accepting shares mail from now on."]);
    expect(
      ruleNotesLines({ warning: "That member has no mailbox here." }),
    ).toEqual(["Warning: That member has no mailbox here."]);
  });

  it("keeps a note whole on one line, without terminal controls, naming the CLI command for a route", () => {
    const [line] = ruleNotesLines({
      note: "See\nGET /v1/email-rule-scope-options \u001b[31mnow\u001b[0m ‮ok",
    });
    expect(line).toBe(
      "See GET /v1/email-rule-scope-options (primitive email-rules list-scope-options) now ok",
    );
  });

  it("prints nothing for an answer with no notes, a list, or a blank note", () => {
    expect(ruleNotesLines({ id: "r", note: "  " })).toEqual([]);
    expect(ruleNotesLines([{ note: "x" }])).toEqual([]);
    expect(ruleNotesLines(null)).toEqual([]);
  });
});
