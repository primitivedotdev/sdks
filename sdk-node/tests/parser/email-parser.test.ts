import { describe, expect, it } from "vitest";
import { parseEmail } from "../../src/parser/email-parser.js";

describe("email-parser", () => {
  describe("parseEmail", () => {
    const simpleEmail = `From: sender@example.com
To: recipient@example.com
Subject: Test Subject
Date: Mon, 18 Dec 2025 10:30:00 +0000
Message-ID: <test-123@example.com>
Content-Type: text/plain; charset="UTF-8"

This is the body of the email.`;

    it("parses from address", async () => {
      const result = await parseEmail(simpleEmail);
      expect(result.from).toContain("sender@example.com");
    });

    it("parses to address", async () => {
      const result = await parseEmail(simpleEmail);
      expect(result.to).toContain("recipient@example.com");
    });

    it("parses subject", async () => {
      const result = await parseEmail(simpleEmail);
      expect(result.subject).toBe("Test Subject");
    });

    it("parses text body", async () => {
      const result = await parseEmail(simpleEmail);
      expect(result.text).toContain("This is the body of the email.");
    });

    it("parses message ID", async () => {
      const result = await parseEmail(simpleEmail);
      expect(result.messageId).toBe("<test-123@example.com>");
    });

    it("parses date", async () => {
      const result = await parseEmail(simpleEmail);
      expect(result.date).toBeInstanceOf(Date);
      expect(result.date?.toISOString()).toContain("2025-12-18");
    });

    it("extracts headers as record", async () => {
      const result = await parseEmail(simpleEmail);
      expect(result.headers).toBeDefined();
      expect(typeof result.headers).toBe("object");
    });

    describe("HTML emails", () => {
      const htmlEmail = `From: sender@example.com
To: recipient@example.com
Subject: HTML Email
Content-Type: text/html; charset="UTF-8"

<html><body><h1>Hello</h1><p>This is HTML content.</p></body></html>`;

      it("parses HTML body", async () => {
        const result = await parseEmail(htmlEmail);
        expect(result.html).toContain("<h1>Hello</h1>");
        expect(result.html).toContain("<p>This is HTML content.</p>");
      });
    });

    describe("multipart emails", () => {
      const multipartEmail = `From: sender@example.com
To: recipient@example.com
Subject: Multipart Email
Content-Type: multipart/alternative; boundary="boundary123"

--boundary123
Content-Type: text/plain; charset="UTF-8"

Plain text version.
--boundary123
Content-Type: text/html; charset="UTF-8"

<html><body><p>HTML version.</p></body></html>
--boundary123--`;

      it("parses both text and HTML parts", async () => {
        const result = await parseEmail(multipartEmail);
        expect(result.text).toContain("Plain text version");
        expect(result.html).toContain("HTML version");
      });
    });

    describe("encoded headers", () => {
      it("decodes UTF-8 base64 encoded subject", async () => {
        const encodedEmail = `From: sender@example.com
To: recipient@example.com
Subject: =?UTF-8?B?SGVsbG8gV29ybGQg8J+MjQ==?=
Content-Type: text/plain

Body`;

        const result = await parseEmail(encodedEmail);
        // "Hello World" base64 encoded
        expect(result.subject).toContain("Hello World");
      });

      it("decodes quoted-printable encoded subject", async () => {
        const encodedEmail = `From: sender@example.com
To: recipient@example.com
Subject: =?UTF-8?Q?Hello_World?=
Content-Type: text/plain

Body`;

        const result = await parseEmail(encodedEmail);
        expect(result.subject).toBe("Hello World");
      });
    });

    describe("address formats", () => {
      it("handles name + email format", async () => {
        const emailWithName = `From: "John Doe" <john@example.com>
To: "Jane Smith" <jane@example.com>
Subject: Test

Body`;

        const result = await parseEmail(emailWithName);
        expect(result.from).toContain("john@example.com");
        expect(result.to).toContain("jane@example.com");
      });

      it("handles bare email addresses", async () => {
        const bareEmail = `From: sender@example.com
To: recipient@example.com
Subject: Test

Body`;

        const result = await parseEmail(bareEmail);
        expect(result.from).toContain("sender@example.com");
      });
    });

    describe("edge cases", () => {
      it("handles missing subject", async () => {
        const noSubject = `From: sender@example.com
To: recipient@example.com
Content-Type: text/plain

Body without subject`;

        const result = await parseEmail(noSubject);
        expect(result.subject).toBeUndefined();
      });

      it("handles missing date", async () => {
        const noDate = `From: sender@example.com
To: recipient@example.com
Subject: No Date
Content-Type: text/plain

Body`;

        const result = await parseEmail(noDate);
        // Date might be undefined or mailparser might infer it
        expect(result.date === undefined || result.date instanceof Date).toBe(
          true,
        );
      });

      it("handles empty body", async () => {
        const emptyBody = `From: sender@example.com
To: recipient@example.com
Subject: Empty
Content-Type: text/plain

`;

        const result = await parseEmail(emptyBody);
        expect(
          result.text === undefined ||
            result.text === "" ||
            result.text === "\n",
        ).toBe(true);
      });

      it("handles very long headers", async () => {
        const longSubject = "A".repeat(1000);
        const longHeader = `From: sender@example.com
To: recipient@example.com
Subject: ${longSubject}
Content-Type: text/plain

Body`;

        const result = await parseEmail(longHeader);
        expect(result.subject).toBe(longSubject);
      });

      it("handles special characters in body", async () => {
        const specialChars = `From: sender@example.com
To: recipient@example.com
Subject: Special
Content-Type: text/plain; charset="UTF-8"

Special chars: <>&"' \u00E0\u00E9\u00EF\u00F5\u00FC \u65E5\u672C\u8A9E \uD83C\uDF89`;

        const result = await parseEmail(specialChars);
        expect(result.text).toContain("<>&");
        expect(result.text).toContain("\u00E0\u00E9\u00EF\u00F5\u00FC");
      });

      it("handles minimal email (just headers, no body separator)", async () => {
        const minimal = `From: sender@example.com
To: recipient@example.com`;

        const result = await parseEmail(minimal);
        expect(result.from).toContain("sender@example.com");
      });

      it("handles email with only body (no headers)", async () => {
        const noHeaders = "Just body content with no headers";

        const result = await parseEmail(noHeaders);
        // mailparser treats content without proper headers as a single header line
        // The text body ends up undefined, but the function doesn't throw
        expect(result.from).toBeDefined();
      });

      it("handles CRLF line endings", async () => {
        const crlfEmail =
          "From: sender@example.com\r\nTo: recipient@example.com\r\nSubject: CRLF\r\n\r\nBody with CRLF";

        const result = await parseEmail(crlfEmail);
        expect(result.subject).toBe("CRLF");
        expect(result.text).toContain("Body with CRLF");
      });

      it("handles mixed line endings", async () => {
        const mixedEmail =
          "From: sender@example.com\r\nTo: recipient@example.com\nSubject: Mixed\r\n\nBody";

        const result = await parseEmail(mixedEmail);
        expect(result.from).toContain("sender@example.com");
      });
    });
  });
});
