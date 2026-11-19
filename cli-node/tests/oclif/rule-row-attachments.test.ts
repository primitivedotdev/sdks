import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_DESCRIPTION_SHOWN_MAX,
  ATTACHMENT_NAME_SHOWN_MAX,
  attachmentsLines,
  attachmentsSummary,
} from "../../src/oclif/rule-row-attachments.js";

const file = (name: unknown, description: unknown = null) => ({
  name,
  description,
});

describe("attachmentsSummary", () => {
  it("names the first three files with their descriptions and counts the rest", () => {
    expect(
      attachmentsSummary({
        attachments: [
          file("rate-card-2026.pdf", "Contractor pay rates by role"),
          file("invoice.pdf"),
          file("logo.png", ""),
          file("terms.pdf"),
        ],
        attachment_count: 12,
      }),
    ).toBe(
      "12 attachments: rate-card-2026.pdf (Contractor pay rates by role), invoice.pdf, logo.png, +9 more",
    );
  });

  it("says one attachment, and none, in words", () => {
    expect(
      attachmentsSummary({ attachments: [file("a.pdf")], attachment_count: 1 }),
    ).toBe("1 attachment: a.pdf");
    expect(attachmentsSummary({ attachments: [], attachment_count: 0 })).toBe(
      "no attachments",
    );
  });

  it("says nothing when the answer does not know, or does not say", () => {
    expect(
      attachmentsSummary({ attachments: null, attachment_count: null }),
    ).toBeUndefined();
    expect(attachmentsSummary({})).toBeUndefined();
    expect(attachmentsSummary(null)).toBeUndefined();
    expect(attachmentsLines({ attachments: null }, "  ")).toEqual([]);
  });

  it("cuts long names and descriptions, and keeps them on one safe line", () => {
    const summary =
      attachmentsSummary({
        attachments: [
          file(`${"n".repeat(80)}.pdf`, `${"d".repeat(100)}`),
          file("evil\u001b[31m\nname‮.pdf", "line one\nline two"),
        ],
        attachment_count: 2,
      }) ?? "";
    expect(summary).toContain(
      `${"n".repeat(ATTACHMENT_NAME_SHOWN_MAX - 3)}...`,
    );
    expect(summary).toContain(
      `(${"d".repeat(ATTACHMENT_DESCRIPTION_SHOWN_MAX - 3)}...)`,
    );
    expect(summary).toContain("evil name.pdf (line one line two)");
    for (const unsafe of ["\u001b", "\n", "\u202e"]) {
      expect(summary).not.toContain(unsafe);
    }
  });

  it("quotes a name that could pass for more files, and keeps descriptions in their parentheses", () => {
    expect(
      attachmentsSummary({
        attachments: [
          file('a.pdf (Signed W-9), "payroll".xlsx', "Rates (draft), by role"),
        ],
        attachment_count: 1,
      }),
    ).toBe(
      "1 attachment: \"a.pdf (Signed W-9), 'payroll'.xlsx\" (Rates [draft], by role)",
    );
  });

  it("never cuts inside a character", () => {
    const summary =
      attachmentsSummary({
        attachments: [file(`${"a".repeat(36)}\u{1F4CE}\u{1F4CE}b.pdf`)],
        attachment_count: 1,
      }) ?? "";
    expect(summary).toBe(`1 attachment: ${"a".repeat(36)}\u{1F4CE}...`);
  });

  it("counts at least the files it lists, whatever attachment_count says", () => {
    expect(
      attachmentsSummary({ attachments: [file("a.pdf"), file("b.pdf")] }),
    ).toBe("2 attachments: a.pdf, b.pdf");
    expect(
      attachmentsSummary({ attachments: [file("a.pdf")], attachment_count: 0 }),
    ).toBe("1 attachment: a.pdf");
  });

  it("names a file the answer gives no name as such", () => {
    expect(
      attachmentsSummary({ attachments: [file(null)], attachment_count: 1 }),
    ).toBe("1 attachment: (no name)");
  });
});

describe("attachmentsLines", () => {
  it("indents the summary under its row", () => {
    expect(
      attachmentsLines({ attachments: [], attachment_count: 0 }, "    "),
    ).toEqual(["    no attachments"]);
  });
});
