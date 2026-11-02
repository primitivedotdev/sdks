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

  it("reads an HTML-only message as text", () => {
    const detail = email("", [SELF, OTHER], {
      body_text: null,
      body_html: "<p>@reviewer take a look</p>",
    } as Partial<EmailDetail>);
    expect(mentionsOnlyOthers(detail, SELF)).toBe(true);
  });

  it("never skips when this agent's address is unusable", () => {
    expect(mentionsOnlyOthers(email("@reviewer take a look"), "")).toBe(false);
  });
});
