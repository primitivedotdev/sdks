import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildEventFromParsedData,
  type EmailAnalysis,
  type EmailAuth,
} from "../../src/contract/index.js";
import { parseEmailWithAttachments } from "../../src/parser/attachment-parser.js";
import {
  toCanonicalHeaders,
  toParsedDataComplete,
} from "../../src/parser/mapping.js";
import { validateEmailReceivedEvent } from "../../src/webhook/index.js";

const fixturePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures/emails/pdf-attachment.eml",
);

const auth: EmailAuth = {
  spf: "pass",
  dmarc: "pass",
  dmarcPolicy: "reject",
  dmarcFromDomain: "example.com",
  dmarcSpfAligned: true,
  dmarcDkimAligned: true,
  dmarcSpfStrict: false,
  dmarcDkimStrict: false,
  dkimSignatures: [],
};

const analysis: EmailAnalysis = {};

describe("parser to contract integration", () => {
  it("turns a real .eml fixture into a schema-valid webhook event", async () => {
    const rawBytes = readFileSync(fixturePath);
    const parsedEmail = await parseEmailWithAttachments(rawBytes);
    const parsed = toParsedDataComplete(
      parsedEmail,
      "https://example.com/attachments/email-123.tar.gz",
    );
    const headers = toCanonicalHeaders(parsedEmail);

    const event = buildEventFromParsedData({
      emailId: "email_pdf_attachment",
      endpointId: "endpoint_parser_contract",
      rawBytes,
      parsed,
      messageId: headers.message_id,
      sender: headers.from,
      recipient: headers.to,
      toHeader: headers.to,
      subject: headers.subject,
      receivedAt: "2025-01-01T12:00:00Z",
      smtpHelo: "mail.example.com",
      smtpMailFrom: "from@example.com",
      smtpRcptTo: [headers.to],
      auth,
      analysis,
      downloadUrl: "https://example.com/download/email-123",
      downloadExpiresAt: "2025-01-02T12:00:00Z",
      attachmentsDownloadUrl:
        "https://example.com/attachments/email-123.tar.gz",
      attemptCount: 1,
      dateHeader: headers.date,
      buildOptions: { attempted_at: "2025-01-01T12:01:00Z" },
    });

    expect(validateEmailReceivedEvent(event)).toEqual(event);
    expect(event.email.parsed.status).toBe("complete");
    if (event.email.parsed.status === "complete") {
      expect(event.email.parsed.attachments.length).toBeGreaterThan(0);
      expect(event.email.parsed.attachments_download_url).toBe(
        "https://example.com/attachments/email-123.tar.gz",
      );
    }
  });
});
