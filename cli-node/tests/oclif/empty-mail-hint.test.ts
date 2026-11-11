import { describe, expect, it } from "vitest";
import {
  emptyEmailListHint,
  listFilters,
  mailReach,
  ORG_EMPTY_HINT,
} from "../../src/oclif/empty-mail-hint.js";

const RULE = "1b1b1b1b-0000-4000-8000-000000000001";
const RULE2 = "2c2c2c2c-0000-4000-8000-000000000002";
const key = (mailScope: unknown) => ({ credentialKind: "org_key", mailScope });
const hint = (
  caller: ReturnType<typeof key> | null | undefined,
  over: { filterFlags?: string[]; pastFlag?: "--cursor" | "--since" } = {},
) =>
  emptyEmailListHint({
    filterFlags: over.filterFlags ?? [],
    caller,
    ...(over.pastFlag ? { pastFlag: over.pastFlag } : {}),
  });

describe("mailReach", () => {
  it("reads each mail scope GET /whoami/grant can answer", () => {
    expect(mailReach("org")).toEqual({ kind: "org" });
    expect(mailReach("unreadable")).toEqual({ kind: "unreadable" });
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
    ).toEqual({ kind: "rules_only", rules: [RULE] });
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
      rules: [RULE],
    });
    // A domain entry that leaves out personal mailboxes does not claim them.
    expect(
      mailReach({
        addresses: [],
        domains: ["x.test"],
        depth: "content",
        excluded_personal_mailboxes: 2,
      }),
    ).toEqual({
      kind: "mailboxes",
      names: ["addresses at x.test other than personal mailboxes"],
      rules: [],
    });
  });
});

describe("emptyEmailListHint", () => {
  it("keeps the account-wide hint only for a credential that reads every mailbox and asked for everything", () => {
    expect(hint(key("org"))).toBe(ORG_EMPTY_HINT);
    expect(
      emptyEmailListHint({
        filterFlags: [],
        caller: key("org"),
        orgHint: "Nothing yet.",
      }),
    ).toBe("Nothing yet.");
  });

  it("tells a rules-only key how its rules grant mail, naming the rules for their author to check", () => {
    expect(
      hint(
        key({
          addresses: [],
          domains: [],
          rules: [RULE, RULE2],
          depth: "content",
        }),
      ),
    ).toBe(
      `(no results) No mail this key's rules granted is readable now. This key reads only mail its 2 email rules granted. A rule grants an email that matches it on arrival while the rule is active, and the key reads that mail only while the rule stays active. The rules' author, signed in as themselves, can check each one's state with \`primitive email-rules get-email-rule --id <rule-id>\` (${RULE} and ${RULE2}).`,
    );
  });

  it("names at most three mailboxes, and the rules beside them", () => {
    expect(
      hint(
        key({
          addresses: ["a@x.test", "b@x.test", "c@x.test"],
          domains: ["y.test"],
          rules: [RULE],
          depth: "content",
        }),
      ),
    ).toBe(
      "(no results) No inbound emails yet in the mail this credential reads. This key reads only a@x.test, b@x.test, c@x.test and 1 more, and mail its 1 email rule granted; mail to the organization's other mailboxes is not listed.",
    );
  });

  it("says a person's login is a credential, not a key", () => {
    expect(
      emptyEmailListHint({
        filterFlags: [],
        caller: {
          credentialKind: "oauth",
          mailScope: { addresses: [], domains: [], depth: "raw" },
        },
      }),
    ).toContain("This credential reads no mail");
  });

  it("tells apart a scope that names nothing, one the server could not read, and a grant that could not be read", () => {
    expect(
      hint(key({ addresses: [], domains: [], depth: "content" })),
    ).toContain(
      "This key reads no mail: its grant names no mailbox, domain or email rule.",
    );
    expect(hint(key("unreadable"))).toContain(
      "The server could not read this credential's stored mail scope, so it reaches no mail.",
    );
    expect(hint(undefined)).toBe(
      "(no results) No inbound emails to show. This credential may not read every mailbox; `primitive whoami --json --grant` shows which mail it reaches.",
    );
  });

  it("says nothing matched the filters, or that a page or tail is past the last email, with what the credential reads", () => {
    expect(hint(key("org"), { filterFlags: ["--search", "--recipient"] })).toBe(
      "(no results) No inbound emails match the filters given (--search, --recipient).",
    );
    expect(
      hint(
        key({ addresses: [], domains: [], rules: [RULE], depth: "content" }),
        { filterFlags: ["--search"] },
      ),
    ).toMatch(
      /^\(no results\) No inbound emails match the filters given \(--search\)\. This key reads only mail its 1 email rule granted\./,
    );
    expect(hint(key("org"), { pastFlag: "--cursor" })).toBe(
      "(no results) No inbound emails after the given --cursor.",
    );
    // A tail poll reads no grant, so it says only that it is caught up.
    expect(hint(null, { pastFlag: "--since" })).toBe(
      "(no results) No inbound emails after the given --since.",
    );
  });
});

describe("listFilters", () => {
  it("leaves out what pages, shapes or only modifies the list", () => {
    expect(
      listFilters({
        limit: 5,
        cursor: "c",
        since: "s",
        include: "x",
        include_presence: true,
        wait: 10,
        group: "thread",
        search: "a",
        search_regex: true,
        recipient: "b@x.test",
      }),
    ).toEqual(["search", "recipient"]);
    // Turning an exclusion off narrows nothing; turning it on does.
    expect(listFilters({ exclude_fyi: false, exclude_muted: true })).toEqual([
      "exclude_muted",
    ]);
  });
});
