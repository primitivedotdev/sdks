import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { describe, expect, it } from "vitest";
import {
  emptyEmailListHint,
  listFilters,
  mailReach,
  ORG_EMPTY_HINT,
  readCallerMail,
  readCallerMailFor,
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
      names: [
        "addresses at x.test other than other members' personal mailboxes",
      ],
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

  it("tells a rules-only key how its rules grant mail, naming the ids for their author or a share's holder to check", () => {
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
      `(no results) No mail this key's rules granted is readable now. This key reads only mail its 2 email rules granted. A rule grants an email it matches when the email is evaluated, shortly after it arrives, while the rule is active, and the key reads that mail only while the rule stays active. Each id (${RULE} and ${RULE2}) is an email rule or a rule shared with the key's holder: a rule's author, signed in as themselves, can check it with \`primitive email-rules get-email-rule --id <id>\`, and a share's holder with \`primitive email-rules get-email-rule-share --id <id>\`.`,
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
      "(no results) No inbound emails yet in the mail this key reads. This key reads only a@x.test, b@x.test, c@x.test and 1 more, and mail its 1 email rule granted; other mail is not listed.",
    );
  });

  it("never tells a person's login it reads nothing: rules colleagues shared with them sit beside its grant", () => {
    const person = (mailScope: unknown) =>
      emptyEmailListHint({
        filterFlags: [],
        caller: { credentialKind: "oauth", mailScope },
      });
    const empty = person({ addresses: [], domains: [], depth: "raw" });
    expect(empty).not.toContain("reads no mail:");
    expect(empty).toContain(
      "This login reads no mailbox through its grant, only mail from email rules colleagues shared with you (`primitive email-rules list-email-rule-shares` lists them).",
    );
    expect(
      person({ addresses: ["me@x.test"], domains: [], depth: "raw" }),
    ).toContain(
      "This login reads me@x.test, and mail from email rules colleagues shared with you",
    );
  });

  it("tells a connection key about the member mailboxes its owner gave it, and drops a presence filter it has by default", () => {
    const connection = {
      credentialKind: "connected_key",
      mailScope: { addresses: ["agent@x.test"], domains: [] },
    };
    expect(emptyEmailListHint({ filterFlags: [], caller: connection })).toBe(
      "(no results) No inbound emails yet in the mail this connection key reads. This connection key reads only agent@x.test, and any member mailbox its owner gave it (pass that mailbox with --recipient).",
    );
    expect(
      emptyEmailListHint({
        filterFlags: ["--include-presence"],
        caller: connection,
      }),
    ).not.toContain("match the filters");
  });

  it("reads a rule-granted email whatever the scope's direction", () => {
    expect(
      hint(
        key({
          addresses: [],
          domains: [],
          rules: [RULE],
          direction: "outbound",
          depth: "content",
        }),
      ),
    ).toContain("This key reads only mail its 1 email rule granted.");
  });

  it("tells apart a scope that names nothing, one the server could not read, and a grant that could not be read", () => {
    expect(
      hint(key({ addresses: [], domains: [], depth: "content" })),
    ).toContain(
      "This key reads no mail: its grant names no mailbox or domain, and no email rule or live share.",
    );
    expect(
      hint(
        key({
          addresses: ["a@x.test"],
          domains: [],
          direction: "outbound",
          depth: "content",
        }),
      ),
    ).toContain(
      "This key reads no received mail: its grant covers sent mail only.",
    );
    expect(hint(key("unreadable"))).toContain(
      "The server could not read this credential's stored mail scope, so it reaches no mail through it.",
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
      "(no results) No more inbound emails past the given --cursor.",
    );
    // A tail poll reads no grant, so it says only that it is caught up.
    expect(hint(null, { pastFlag: "--since" })).toBe(
      "(no results) No inbound emails after the given --since.",
    );
  });
});

describe("an empty page with a next cursor", () => {
  it("says the list goes on, whatever the credential reads", () => {
    for (const caller of [
      key("org"),
      key({ addresses: [], domains: [], rules: [RULE], depth: "content" }),
      undefined,
    ]) {
      expect(
        emptyEmailListHint({
          filterFlags: [],
          pastFlag: "--cursor",
          nextCursor: "c3",
          caller,
        }),
      ).toBe(
        "(no results) This page came back empty, but the list goes on: continue with --cursor c3.",
      );
    }
    expect(
      emptyEmailListHint({
        filterFlags: [],
        nextCursor: null,
        caller: key("org"),
      }),
    ).toBe(ORG_EMPTY_HINT);
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
        wait: 10,
        group: "thread",
        search: "a",
        search_regex: true,
        recipient: "b@x.test",
      }),
    ).toEqual(["search", "recipient"]);
    // As the CLI sends them, as text: turning an exclusion off narrows nothing, and leaving presence mail out does.
    expect(
      listFilters({ exclude_fyi: "false", exclude_muted: "true" }),
    ).toEqual(["exclude_muted"]);
    expect(listFilters({ include_presence: "false" })).toEqual([
      "include_presence",
    ]);
    expect(listFilters({ include_presence: "true" })).toEqual([]);
  });
});

describe("readCallerMailFor", () => {
  it("answers a connected agent's key from the address it was connected for, without asking the server", async () => {
    const client = {
      get: () => Promise.reject(new Error("must not be called")),
    } as unknown as Parameters<typeof readCallerMail>[0];
    expect(
      await readCallerMailFor(
        { apiKey: "pconn_x", connectedAgent: { agentAddress: "agent@x.test" } },
        client,
      ),
    ).toEqual({
      credentialKind: "connected_key",
      mailScope: { addresses: ["agent@x.test"], domains: [] },
    });
    const bare = await readCallerMailFor({ apiKey: "pconn_x" }, client);
    expect(bare).toEqual({
      credentialKind: "connected_key",
      mailScope: undefined,
    });
    expect(emptyEmailListHint({ filterFlags: [], caller: bare })).toBe(
      "(no results) No inbound emails to show. This connection key reads the address it was connected for, and any member mailbox its owner gave it (pass that mailbox with --recipient).",
    );
  });

  it("gives up in time even when the read itself ignores its signal, as a token exchange on a 401 does", async () => {
    const deaf = new PrimitiveApiClient({
      apiKey: "prim_test",
      apiBaseUrl: "https://api.example.test/v1",
      fetch: (() => new Promise<Response>(() => {})) as typeof fetch,
    });
    const started = Date.now();
    expect(await readCallerMail(deaf.client, 50)).toBeUndefined();
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it("gives up on a grant read that does not answer in time", async () => {
    const hanging = new PrimitiveApiClient({
      apiKey: "prim_test",
      apiBaseUrl: "https://api.example.test/v1",
      fetch: ((input: Request) =>
        new Promise<Response>((_resolve, reject) => {
          input.signal.addEventListener("abort", () =>
            reject(input.signal.reason),
          );
        })) as typeof fetch,
    });
    const started = Date.now();
    expect(await readCallerMail(hanging.client, 50)).toBeUndefined();
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});
