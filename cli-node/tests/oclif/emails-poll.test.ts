import type { EmailSearchResult } from "@primitivedotdev/api-core";
import { describe, expect, it } from "vitest";
import {
  buildEmailSearchQuery,
  collectNewAcceptedEmails,
  cursorFromAcceptedRows,
  cursorFromRows,
  filtersFromFlags,
  parseSince,
  sinceFromFlags,
} from "../../src/oclif/commands/emails-poll.js";

function makeEmail(
  overrides: Partial<EmailSearchResult> = {},
): EmailSearchResult {
  return {
    from_verified: false,
    from_header_email: null,
    from_name: null,
    snippet: null,
    attachment_count: 0,
    awaiting: "you",
    automated: false,
    automated_reasons: [],
    last_replied_at: null,
    reply_count: 0,
    created_at: "2026-05-08T00:00:00.000Z",
    domain: "example.com",
    direction: "inbound",
    from_known_address: false,
    id: "11111111-1111-4111-8111-111111111111",
    received_at: "2026-05-08T00:00:00.000Z",
    recipient: "inbox@example.com",
    sender: "sender@example.net",
    status: "accepted",
    webhook_attempt_count: 0,
    thread_id: null,
    ...overrides,
  };
}

describe("buildEmailSearchQuery", () => {
  it("builds a cheap received_at ascending polling query", () => {
    const query = buildEmailSearchQuery({
      cursor: "cursor-1",
      filters: {
        domain: "example.com",
        from: "sender@example.net",
        subject: "verify",
        to: "inbox@example.com",
      },
      pageSize: 25,
      since: "2026-05-08T00:00:00.000Z",
    });

    expect(query).toMatchObject({
      cursor: "cursor-1",
      from: "sender@example.net",
      include_facets: "false",
      limit: 25,
      q: "domain:example.com",
      snippet: "false",
      sort: "received_at_asc",
      subject: "verify",
      to: "inbox@example.com",
    });
  });

  it("combines caller q with the domain filter", () => {
    const query = buildEmailSearchQuery({
      filters: { domain: "example.com", q: "password" },
      pageSize: 50,
    });

    expect(query.q).toBe("password domain:example.com");
  });
});

describe("collectNewAcceptedEmails", () => {
  it("returns accepted/completed rows once and skips other statuses", () => {
    const seen = new Set<string>();
    const rows = [
      makeEmail({
        id: "11111111-1111-4111-8111-111111111111",
        status: "accepted",
      }),
      makeEmail({
        id: "22222222-2222-4222-8222-222222222222",
        status: "completed",
      }),
      makeEmail({
        id: "33333333-3333-4333-8333-333333333333",
        status: "rejected",
      }),
    ];

    expect(collectNewAcceptedEmails(rows, seen).map((row) => row.id)).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ]);
    expect(collectNewAcceptedEmails(rows, seen)).toEqual([]);
  });
});

describe("cursorFromRows", () => {
  it("encodes the last row as a received_at search cursor", () => {
    const cursor = cursorFromRows([
      makeEmail({
        id: "11111111-1111-4111-8111-111111111111",
        received_at: "2026-05-08T00:00:00.000Z",
      }),
      makeEmail({
        id: "22222222-2222-4222-8222-222222222222",
        received_at: "2026-05-08T00:00:01.000Z",
      }),
    ]);

    expect(Buffer.from(cursor ?? "", "base64url").toString("utf8")).toBe(
      "r|2026-05-08T00:00:01.000Z|22222222-2222-4222-8222-222222222222",
    );
  });
});

describe("cursorFromAcceptedRows", () => {
  it("advances only to the last accepted/completed row", () => {
    const cursor = cursorFromAcceptedRows([
      makeEmail({
        id: "11111111-1111-4111-8111-111111111111",
        received_at: "2026-05-08T00:00:00.000Z",
        status: "accepted",
      }),
      makeEmail({
        id: "22222222-2222-4222-8222-222222222222",
        received_at: "2026-05-08T00:00:01.000Z",
        status: "pending",
      }),
    ]);

    expect(Buffer.from(cursor ?? "", "base64url").toString("utf8")).toBe(
      "r|2026-05-08T00:00:00.000Z|11111111-1111-4111-8111-111111111111",
    );
  });

  it("does not advance past rows still being ingested", () => {
    expect(
      cursorFromAcceptedRows([
        makeEmail({
          id: "22222222-2222-4222-8222-222222222222",
          status: "pending",
        }),
      ]),
    ).toBeNull();
  });
});

describe("flag normalization", () => {
  it("maps CLI flag names to API filter names", () => {
    expect(
      filtersFromFlags({
        "domain-id": "11111111-1111-4111-8111-111111111111",
        "has-attachment": true,
        "spam-score-gte": 3,
        "spam-score-lt": 8,
      }),
    ).toMatchObject({
      domainId: "11111111-1111-4111-8111-111111111111",
      hasAttachment: true,
      spamScoreGte: 3,
      spamScoreLt: 8,
    });
  });

  it("normalizes since and respects include-existing", () => {
    expect(parseSince("2026-05-08")).toBe("2026-05-08T00:00:00.000Z");
    expect(sinceFromFlags({ "include-existing": true })).toBeUndefined();
  });

  it("reads --since as a timestamp or as a duration ago", () => {
    const now = Date.parse("2026-11-10T12:00:00.000Z");
    expect(parseSince("30s", now)).toBe("2026-11-10T11:59:30.000Z");
    expect(parseSince("15m", now)).toBe("2026-11-10T11:45:00.000Z");
    expect(parseSince("2H", now)).toBe("2026-11-10T10:00:00.000Z");
    expect(parseSince("1d", now)).toBe("2026-11-09T12:00:00.000Z");
    expect(parseSince("2026-11-10T08:00:00Z", now)).toBe(
      "2026-11-10T08:00:00.000Z",
    );
    expect(() => parseSince("99999999999d", now)).toThrow("--since must be");
    // Far enough back to land before 1970.
    expect(() => parseSince("30000d", now)).toThrow("--since must be");
    expect(() => parseSince("5", now)).toThrow(
      "--since needs a unit on a duration, for example 5m;",
    );
    expect(() => parseSince("15 minutes", now)).toThrow(
      "--since must be an ISO-8601 timestamp or date, or a duration ago such as 30s, 15m, 2h or 1d.",
    );
    // Without --since or --include-existing the window starts now.
    expect(sinceFromFlags({}, now)).toBe("2026-11-10T12:00:00.000Z");
    expect(sinceFromFlags({ since: "15m" }, now)).toBe(
      "2026-11-10T11:45:00.000Z",
    );
  });
});
