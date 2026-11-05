import type { EmailDetail } from "@primitivedotdev/api-core";
import { describe, expect, it } from "vitest";
import {
  mentionsAddress,
  mentionsOnlyOthers,
} from "../../src/oclif/mention-wake.js";

const SELF = "builder@agents.example.test";
const OTHER = "reviewer@agents.example.test";

function email(
  body: string,
  to: string[] = [SELF, OTHER],
  extra: Partial<EmailDetail> = {},
): EmailDetail {
  return {
    id: "email-1",
    recipient: SELF,
    to_email: to.join(", "),
    from_email: "owner@example.test",
    received_at: "2026-11-02T08:00:00.000Z",
    subject: "Plan",
    body_text: body,
    parsed: {
      status: "complete",
      to_addresses: to.map((address) => ({ address })),
    },
    ...extra,
  } as unknown as EmailDetail;
}

describe("mentionsAddress", () => {
  it("matches @local-part and the full address, ignoring case", () => {
    expect(mentionsAddress("@builder please start", SELF)).toBe(true);
    expect(mentionsAddress("Hi @Builder, start", SELF)).toBe(true);
    expect(mentionsAddress("ask BUILDER@agents.example.test", SELF)).toBe(true);
    expect(mentionsAddress("(builder@agents.example.test).", SELF)).toBe(true);
    expect(mentionsAddress("Builder <builder@agents.example.test>", SELF)).toBe(
      true,
    );
  });

  it("does not match a longer handle, word or address", () => {
    expect(mentionsAddress("@builder2 please start", SELF)).toBe(false);
    expect(mentionsAddress("@builder.bot please start", SELF)).toBe(false);
    expect(mentionsAddress("mail ops@builder.example.test", SELF)).toBe(false);
    expect(mentionsAddress("the builder is idle", SELF)).toBe(false);
    expect(mentionsAddress("rebuilder@agents.example.test", SELF)).toBe(false);
    expect(mentionsAddress("builder@agents.example.test.org", SELF)).toBe(
      false,
    );
    for (const prefix of ["support!", "a/", "x=", "q?", "h#", "t~", "p|"])
      expect(
        mentionsAddress(`mail ${prefix}builder@agents.example.test`, SELF),
        prefix,
      ).toBe(false);
    expect(mentionsAddress("ping a!@builder", SELF)).toBe(false);
  });

  it("matches an address in quotes, code or brackets", () => {
    for (const text of [
      "'builder@agents.example.test'",
      "`builder@agents.example.test`",
      "[@builder]",
      "@builder's turn",
      "@builder?",
    ])
      expect(mentionsAddress(text, SELF), text).toBe(true);
  });
});

describe("mentionsOnlyOthers", () => {
  it("keeps waking for mail addressed to this agent alone", () => {
    expect(
      mentionsOnlyOthers(email("@reviewer take a look", [SELF]), SELF),
    ).toBe(false);
  });

  it("keeps waking every recipient when the body mentions nobody", () => {
    expect(mentionsOnlyOthers(email("Both of you, take a look."), SELF)).toBe(
      false,
    );
  });

  it("skips the wake when only another recipient is mentioned", () => {
    expect(mentionsOnlyOthers(email("@reviewer take a look"), SELF)).toBe(true);
    expect(
      mentionsOnlyOthers(email(`Over to ${OTHER} for review.`), SELF),
    ).toBe(true);
  });

  it("wakes a mentioned agent, alone or alongside others", () => {
    expect(mentionsOnlyOthers(email("@builder start"), SELF)).toBe(false);
    expect(
      mentionsOnlyOthers(email("@builder build, then @reviewer review"), SELF),
    ).toBe(false);
  });

  it("counts Cc recipients as participants", () => {
    const detail = email("@reviewer take a look", [SELF]);
    (detail.parsed as Record<string, unknown>).cc = [{ address: OTHER }];
    expect(mentionsOnlyOthers(detail, SELF)).toBe(true);
  });

  it("ignores mentions of addresses the email was not sent to", () => {
    expect(mentionsOnlyOthers(email("cc @someone-else for later"), SELF)).toBe(
      false,
    );
  });

  it("ignores the sender's own address", () => {
    expect(
      mentionsOnlyOthers(email("Reply to owner@example.test when done."), SELF),
    ).toBe(false);
  });

  it("ignores mentions in quoted history", () => {
    const body = [
      "Thanks, both of you keep going.",
      "",
      "On Mon, Nov 2, 2026 at 8:00 AM Owner <owner@example.test> wrote:",
      "> @reviewer take a look",
    ].join("\n");
    expect(mentionsOnlyOthers(email(body), SELF)).toBe(false);
  });

  it("ignores mentions in quoted lines of an inline reply", () => {
    const body = [
      "> @reviewer check this",
      "Done. Both of you can continue.",
      "> and the tests?",
      "Passing.",
    ].join("\n");
    expect(mentionsOnlyOthers(email(body), SELF)).toBe(false);
    expect(
      mentionsOnlyOthers(email(`${body}\n@reviewer please merge`), SELF),
    ).toBe(true);
  });

  it("reads an HTML-only message as text", () => {
    const detail = email("", [SELF, OTHER], {
      body_text: null,
      body_html: "<p>@reviewer take a look</p>",
    } as Partial<EmailDetail>);
    expect(mentionsOnlyOthers(detail, SELF)).toBe(true);
  });

  it("ignores mentions in blockquotes of an HTML-only message", () => {
    const html = (body: string) =>
      email("", [SELF, OTHER], {
        body_text: null,
        body_html: body,
      } as Partial<EmailDetail>);
    const quoted =
      "<p>Both of you continue.</p><blockquote>@reviewer check this</blockquote>";
    expect(mentionsOnlyOthers(html(quoted), SELF)).toBe(false);
    const nested =
      "<p>Both of you continue.</p><blockquote><p>ok</p><blockquote>@reviewer check this</blockquote><p>@reviewer again</p></blockquote>";
    expect(mentionsOnlyOthers(html(nested), SELF)).toBe(false);
    expect(
      mentionsOnlyOthers(html(`${quoted}<p>@reviewer please merge</p>`), SELF),
    ).toBe(true);
    const deep = `<p>Both of you continue.</p>${"<blockquote>".repeat(20_000)}@reviewer${"</blockquote>".repeat(20_000)}`;
    expect(mentionsOnlyOthers(html(deep), SELF)).toBe(false);
    expect(
      mentionsOnlyOthers(
        html(`${deep}<blockquote class="x"><p>@reviewer old</p>`),
        SELF,
      ),
    ).toBe(false);
    expect(
      mentionsOnlyOthers(
        html("</blockquote><p>@reviewer please merge</p>"),
        SELF,
      ),
    ).toBe(true);
  });

  it("never skips when this agent's address is unusable", () => {
    expect(mentionsOnlyOthers(email("@reviewer take a look"), "")).toBe(false);
  });
});
