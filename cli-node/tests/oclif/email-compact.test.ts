import type { EmailDetail } from "@primitivedotdev/api-core";
import { describe, expect, it } from "vitest";
import {
  buildEmailCompact,
  htmlToText,
  stripQuotedHistory,
} from "../../src/oclif/email-compact.js";

describe("stripQuotedHistory", () => {
  it("leaves a message with no history untouched", () => {
    expect(stripQuotedHistory("Hello.\n\nSecond paragraph.\n")).toEqual({
      text: "Hello.\n\nSecond paragraph.",
      removed: 0,
    });
  });

  it("cuts at a one-line attribution", () => {
    const body =
      "Sounds good.\r\n\r\nOn Mon, Oct 5, 2026 at 3:01 PM Ada <ada@example.com> wrote:\r\n> Lunch?\r\n> Thursday?";
    const result = stripQuotedHistory(body);
    expect(result.text).toBe("Sounds good.");
    expect(result.removed).toBeGreaterThan(60);
  });

  it("cuts at an attribution wrapped across two lines", () => {
    const body =
      "Yes.\n\nOn Mon, Oct 5, 2026 at 3:01 PM Ada Lovelace <\nada@example.com> wrote:\n\n> Lunch?";
    expect(stripQuotedHistory(body).text).toBe("Yes.");
  });

  it("cuts at an Original Message rule and at a copied header block", () => {
    expect(
      stripQuotedHistory(
        "Approved.\n\n-----Original Message-----\nFrom: Ada\nold text",
      ).text,
    ).toBe("Approved.");
    expect(
      stripQuotedHistory(
        "Approved.\n\n________________________________\nFrom: Ada <ada@example.com>\nSent: Monday, October 5, 2026 3:01 PM\nTo: Bo <bo@example.com>\nSubject: Budget\n\nold text",
      ).text,
    ).toBe("Approved.");
    expect(
      stripQuotedHistory(
        "Approved.\n\nFrom: Ada <ada@example.com>\nDate: Monday, October 5, 2026\nSubject: Budget\n\nold text",
      ).text,
    ).toBe("Approved.");
  });

  it("keeps a sentence that only starts like a header or an attribution", () => {
    const body =
      "From: the look of it, we are fine.\nOn Monday we ship.\nShe wrote: yes.\nThanks";
    expect(stripQuotedHistory(body)).toEqual({ text: body, removed: 0 });
  });

  it("drops a trailing run of quoted lines but keeps an inline reply", () => {
    expect(stripQuotedHistory("Agreed.\n\n> earlier\n> text\n").text).toBe(
      "Agreed.",
    );
    const inline = "> Can you do Friday?\nYes.\n> And the budget?\nApproved.";
    expect(stripQuotedHistory(inline)).toEqual({ text: inline, removed: 0 });
  });

  it("keeps an Outlook forward, which only the subject tells from a reply", () => {
    const body =
      "FYI\n\n-----Original Message-----\nFrom: Ada <ada@example.com>\nSent: Monday, October 5, 2026 3:01 PM\nTo: Bo <bo@example.com>\nSubject: Budget\n\nPlease approve $500.";
    for (const subject of [
      "FW: Budget",
      "Fwd: Budget",
      "fw:Budget",
      "WG: Budget",
    ])
      expect(stripQuotedHistory(body, subject)).toEqual({
        text: body,
        removed: 0,
      });
    expect(stripQuotedHistory(body, "RE: Budget").text).toBe("FYI");
    expect(stripQuotedHistory(body, null).text).toBe("FYI");
  });

  it("keeps everything when the sender says their answers are in the earlier message", () => {
    for (const intro of [
      "Answers below.",
      "My comments inline.",
      "See my replies in red.",
      "Responses in-line:",
    ]) {
      const body = `${intro}\n\n________________________________\nFrom: Ada <ada@example.com>\nSent: Monday, October 5, 2026 3:01 PM\nTo: Bo <bo@example.com>\nSubject: Budget\n\nCan we ship?\nYes, Friday.`;
      expect(stripQuotedHistory(body, "RE: Budget")).toEqual({
        text: body,
        removed: 0,
      });
    }
  });

  it("keeps a quoted question left open at the end of an inline exchange", () => {
    const body = "> Can you do Friday?\nYes.\n> And the budget?";
    expect(stripQuotedHistory(body)).toEqual({ text: body, removed: 0 });
  });

  it("keeps the whole body when nothing but history would remain", () => {
    const body = "On Mon, Oct 5, 2026 Ada <ada@example.com> wrote:\n> Lunch?";
    expect(stripQuotedHistory(body)).toEqual({ text: body, removed: 0 });
  });

  it("keeps a forwarded message, copied headers and quoted lines included", () => {
    for (const body of [
      "FYI\n\n---------- Forwarded message ---------\nFrom: Ada <ada@example.com>\nDate: Mon, Oct 5, 2026 at 3:01 PM\nSubject: Budget\nTo: Bo <bo@example.com>\n\nPlease approve $500.\n\nOn Sun, Oct 4, 2026 Bo <bo@example.com> wrote:\n> How much?",
      "See below.\n\nBegin forwarded message:\n\nFrom: Ada <ada@example.com>\nSubject: Budget\nDate: October 5, 2026\nTo: Bo <bo@example.com>\n\nPlease approve $500.",
    ])
      expect(stripQuotedHistory(body)).toEqual({ text: body, removed: 0 });
  });

  it("keeps answers written below an attribution", () => {
    const inline =
      "My answers below.\n\nOn Monday Ada wrote:\n> Can we ship?\nYes, Friday.\n> And the budget?\nApproved.";
    expect(stripQuotedHistory(inline)).toEqual({ text: inline, removed: 0 });
    const wrapped =
      "Answers inline.\n\nOn Mon, Oct 5, 2026 at 3:01 PM Ada Lovelace <\nada@example.com> wrote:\n> Can we ship?\nYes.";
    expect(stripQuotedHistory(wrapped)).toEqual({ text: wrapped, removed: 0 });
    const below = "On Monday Ada wrote:\n> Can we ship?\n\nYes, Friday.";
    expect(stripQuotedHistory(below)).toEqual({ text: below, removed: 0 });
  });
});

describe("htmlToText", () => {
  it("keeps the text and drops markup, styles, scripts and comments", () => {
    const html = `<html><head><title>t</title><style>p{color:red}</style></head>
<body><!-- hidden --><script>alert(1)</script>
<div>Hi&nbsp;Ada &amp; Bo,</div><p>Your code is <b>4821</b>.<br>It expires &#x2014; soon&#33;</p>
<ul><li>one</li><li>two</li></ul></body></html>`;
    expect(htmlToText(html)).toBe(
      "Hi Ada & Bo,\nYour code is 4821.\nIt expires — soon!\n\none\ntwo",
    );
  });

  it("keeps a link's destination beside its label", () => {
    expect(
      htmlToText(
        `<p><a class="b" href="https://example.com/reset?token=123&amp;u=1"><b>Reset password</b></a> or mail <a href='mailto:help@example.com'>help@example.com</a>, see <a href="https://example.com">https://example.com</a> <a href="#top">top</a> <a href="https://example.com/logo"><img src="x"></a></p>`,
      ),
    ).toBe(
      "Reset password (https://example.com/reset?token=123&u=1) or mail help@example.com, see https://example.com top https://example.com/logo",
    );
  });

  it("keeps the destination of a link whose href is not quoted", () => {
    expect(
      htmlToText(
        "<a href=https://example.com/reset target=_blank>Reset password</a>",
      ),
    ).toBe("Reset password (https://example.com/reset)");
  });

  it("leaves no tag behind when tags are nested inside each other", () => {
    expect(htmlToText("a<scr<script>x</script>ipt>b</script>c")).not.toMatch(
      /<|script/,
    );
  });

  it("leaves an unknown or out-of-range entity as written", () => {
    expect(htmlToText("&bogus; &#99999999;")).toBe("&bogus; &#99999999;");
  });
});

describe("buildEmailCompact", () => {
  const base = {
    id: "22222222-2222-4222-8222-222222222222",
    received_at: "2026-10-01T10:00:00.000Z",
    from_email: "ada@example.com",
    to_email: "agent@example.com",
    parsed: {},
  } as unknown as EmailDetail;

  it("falls back to the HTML body when there is no text part", () => {
    const compact = buildEmailCompact({
      ...base,
      from_header: "Ada <ada@example.com>",
      subject: "Code",
      body_text: "  ",
      body_html: "<p>Your code is 4821.</p>",
      parsed: {
        attachments: [
          {
            filename: "a.pdf",
            content_type: "application/pdf",
            size_bytes: 12,
            part_index: 2,
          },
        ],
      },
    } as unknown as EmailDetail);
    expect(compact).toEqual({
      id: base.id,
      thread_id: null,
      received_at: base.received_at,
      from: "Ada <ada@example.com>",
      to: "agent@example.com",
      subject: "Code",
      body_text: "Your code is 4821.",
      body_source: "html",
      quoted_chars_removed: 0,
      attachments: [
        {
          filename: "a.pdf",
          content_type: "application/pdf",
          size_bytes: 12,
          part_index: 2,
        },
      ],
    });
  });

  it("keeps the body of a forwarded email whole", () => {
    const body =
      "FYI\n\n-----Original Message-----\nFrom: Ada <ada@example.com>\nSent: Monday\nSubject: Budget\n\nPlease approve $500.";
    const compact = buildEmailCompact({
      ...base,
      subject: "FW: Budget",
      body_text: body,
    } as unknown as EmailDetail);
    expect(compact.body_text).toBe(body);
    expect(compact.quoted_chars_removed).toBe(0);
  });

  it("reports an email with no body as such", () => {
    const compact = buildEmailCompact(base);
    expect(compact.body_source).toBe("none");
    expect(compact.body_text).toBe("");
    expect(compact.from).toBe("ada@example.com");
    expect(compact.subject).toBeNull();
  });
});
