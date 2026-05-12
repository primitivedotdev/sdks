import type { EmailSearchResult } from "@primitivedotdev/api-core";
import { describe, expect, it } from "vitest";
import {
  buildEmailSearchQuery,
  collectNewAcceptedEmails,
  cursorFromRows,
  filtersFromFlags,
  normalizeIsoDate,
  sinceFromFlags,
} from "../../src/oclif/commands/emails-poll.js";

function makeEmail(
  overrides: Partial<EmailSearchResult> = {},
): EmailSearchResult {
  return {
    attachment_count: 0,
    created_at: "2026-05-08T00:00:00.000Z",
    domain: "example.com",
    from_known_address: false,
    id: "11111111-1111-4111-8111-111111111111",
    received_at: "2026-05-08T00:00:00.000Z",
    recipient: "inbox@example.com",
    sender: "sender@example.net",
    status: "accepted",
    webhook_attempt_count: 0,
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
    expect(normalizeIsoDate("2026-05-08", "--since")).toBe(
      "2026-05-08T00:00:00.000Z",
    );
    expect(sinceFromFlags({ "include-existing": true })).toBeUndefined();
  });
});
