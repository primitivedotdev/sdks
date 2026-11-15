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
        expectations_check: { note: "Check note." },
      }),
    ).toEqual([
      "Scope warning: typo.example (unknown_domain)",
      "Scope warning: gmail.com is none of your domains.",
      "Warning: First.",
      "Warning: From the summary.",
      "Top note.",
      "Rule note.",
      "Check note.",
    ]);
  });

  it("keeps a note whole on one line, without terminal controls, naming the CLI command for a route", () => {
    const [line] = ruleNotesLines({
      note: "See\nGET /v1/email-rule-scope-options \u001b[31mnow\u001b[0m ‮ok",
    });
    expect(line).toBe(
      "See GET /v1/email-rule-scope-options (primitive email-rules list-email-rule-scope-options) now ok",
    );
  });

  it("prints nothing for an answer with no notes, a list, or a blank note", () => {
    expect(ruleNotesLines({ id: "r", note: "  " })).toEqual([]);
    expect(ruleNotesLines([{ note: "x" }])).toEqual([]);
    expect(ruleNotesLines(null)).toEqual([]);
  });
});
