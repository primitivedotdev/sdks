import { describe, expect, it } from "vitest";
import {
  emptyEmailListHint,
  listFilters,
  mailReach,
  ORG_EMPTY_HINT,
} from "../../src/oclif/empty-mail-hint.js";

const RULE = "1b1b1b1b-0000-4000-8000-000000000001";
const hint = (
  mailScope: unknown,
  over: { filterFlags?: string[]; paged?: boolean } = {},
) =>
  emptyEmailListHint({
    filterFlags: over.filterFlags ?? [],
    paged: over.paged ?? false,
    mailScope,
  });

describe("mailReach", () => {
  it("reads each mail scope GET /whoami can answer", () => {
    expect(mailReach("org")).toEqual({ kind: "org" });
    expect(mailReach("unreadable")).toEqual({ kind: "none" });
    expect(mailReach(undefined)).toEqual({ kind: "unknown" });
    expect(mailReach({ addresses: "x" })).toEqual({ kind: "unknown" });
    expect(mailReach({ addresses: [], domains: [], depth: "content" })).toEqual(
      { kind: "none" },
    );
    expect(
      mailReach({
        addresses: [],
        domains: [],
        rules: [RULE],
        depth: "content",
      }),
    ).toEqual({ kind: "rules_only", rules: 1 });
    expect(
      mailReach({
        addresses: ["a@x.test"],
        domains: ["x.test"],
        rules: [RULE],
        depth: "content",
      }),
    ).toEqual({
      kind: "mailboxes",
      names: ["a@x.test", "any address at x.test"],
      rules: 1,
    });
  });
});

describe("emptyEmailListHint", () => {
  it("keeps the account-wide hint only for a credential that reads every mailbox and asked for everything", () => {
    expect(hint("org")).toBe(ORG_EMPTY_HINT);
    expect(
      emptyEmailListHint({
        filterFlags: [],
        paged: false,
        mailScope: "org",
        orgHint: "Nothing yet.",
      }),
    ).toBe("Nothing yet.");
  });

  it("tells a rules-only key how its rules grant mail", () => {
    const text = hint({
      addresses: [],
      domains: [],
      rules: [RULE, RULE.replace("1b", "2c")],
      depth: "content",
    });
    expect(text).toBe(
      "(no results) No email has been granted to this key yet. This key reads only mail its 2 email rules granted it. A rule grants an email only when the email matches while the rule is active, and never mail that arrived before; check each rule's state with `primitive email-rules get-email-rule --id <rule-id>`.",
    );
  });

  it("names at most three mailboxes, and the rules beside them", () => {
    const text = hint({
      addresses: ["a@x.test", "b@x.test", "c@x.test"],
      domains: ["y.test"],
      rules: [RULE],
      depth: "content",
    });
    expect(text).toBe(
      "(no results) No inbound emails yet in the mail this credential reads. This credential reads only a@x.test, b@x.test, c@x.test and 1 more, and mail its 1 email rule granted it; mail to the organization's other mailboxes is not listed.",
    );
  });

  it("says a credential that reaches nothing reads no mail, and one it cannot read may be narrowed", () => {
    expect(hint("unreadable")).toContain("This credential reads no mail");
    expect(hint({ addresses: [], domains: [], depth: "content" })).toContain(
      "This credential reads no mail",
    );
    expect(hint(undefined)).toBe(
      "(no results) No inbound emails to show. This credential may not read every mailbox; `primitive whoami` shows which mail it reaches.",
    );
  });

  it("says nothing matched the filters, or that the page is past the last, with what the credential reads", () => {
    expect(hint("org", { filterFlags: ["--search", "--since"] })).toBe(
      "(no results) No inbound emails match the filters given (--search, --since).",
    );
    expect(
      hint(
        { addresses: [], domains: [], rules: [RULE], depth: "content" },
        { filterFlags: ["--search"] },
      ),
    ).toMatch(
      /^\(no results\) No inbound emails match the filters given \(--search\)\. This key reads only mail its 1 email rule granted it\./,
    );
    expect(hint("org", { paged: true })).toBe(
      "(no results) No more inbound emails after this cursor.",
    );
  });
});

describe("listFilters", () => {
  it("leaves out what pages or shapes the list", () => {
    expect(
      listFilters({
        limit: 5,
        cursor: "c",
        include: "x",
        include_presence: true,
        wait: 10,
        search: "a",
        recipient: "b@x.test",
      }),
    ).toEqual(["search", "recipient"]);
  });
});
