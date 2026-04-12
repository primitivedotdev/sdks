import { describe, expect, it } from "vitest";
import type { AttachmentMetadata } from "../../src/parser/attachment-bundler.js";
import type {
  ParsedAttachment,
  ParsedEmailWithAttachments,
} from "../../src/parser/attachment-parser.js";
import {
  attachmentMetadataToWebhookAttachments,
  toCanonicalHeaders,
  toParsedDataComplete,
  toWebhookAttachments,
} from "../../src/parser/mapping.js";

function createAttachment(
  overrides: Partial<ParsedAttachment> = {},
): ParsedAttachment {
  return {
    id: "att-1",
    partIndex: 0,
    filename: "document.pdf",
    contentType: "application/pdf",
    contentTypeNorm: "application/pdf",
    contentDispositionRaw: 'attachment; filename="document.pdf"',
    disposition: "attachment",
    contentTransferEncoding: "base64",
    contentIdRaw: null,
    contentIdNorm: null,
    downloadName: "document.pdf",
    tarPath: "0_document.pdf",
    sizeBytes: 1024,
    sha256: "a".repeat(64),
    isInline: false,
    isDownloadable: true,
    isSafeForInlineServing: false,
    content: Buffer.from("fake content"),
    ...overrides,
  };
}

function createParsedEmail(
  overrides: Partial<ParsedEmailWithAttachments> = {},
): ParsedEmailWithAttachments {
  return {
    bodyText: "Hello world",
    bodyHtml: "<p>Hello <script>alert('xss')</script>world</p>",
    attachments: [],
    subject: "Test Subject",
    messageId: "<msg-123@example.com>",
    date: new Date("2025-06-15T10:30:00.000Z"),
    dateHeader: "Sun, 15 Jun 2025 10:30:00 +0000",
    from: "sender@example.com",
    to: "recipient@example.com",
    replyTo: [{ address: "reply@example.com", name: "Reply" }],
    cc: null,
    bcc: null,
    inReplyTo: ["<prev@example.com>"],
    references: ["<thread1@example.com>", "<thread2@example.com>"],
    ...overrides,
  };
}

describe("toParsedDataComplete", () => {
  it("maps camelCase fields to snake_case", () => {
    const parsed = createParsedEmail();
    const result = toParsedDataComplete(parsed, null);

    expect(result.status).toBe("complete");
    expect(result.error).toBeNull();
    expect(result.body_text).toBe("Hello world");
    expect(result.reply_to).toEqual([
      { address: "reply@example.com", name: "Reply" },
    ]);
    expect(result.in_reply_to).toEqual(["<prev@example.com>"]);
    expect(result.references).toEqual([
      "<thread1@example.com>",
      "<thread2@example.com>",
    ]);
    expect(result.cc).toBeNull();
    expect(result.bcc).toBeNull();
  });

  it("passes through bodyHtml without sanitizing it", () => {
    const parsed = createParsedEmail({
      bodyHtml: "<p>raw <script>bad</script></p>",
    });
    const result = toParsedDataComplete(parsed, null);

    expect(result.body_html).toBe("<p>raw <script>bad</script></p>");
  });

  it("passes through null body values", () => {
    const parsed = createParsedEmail({
      bodyText: null,
      bodyHtml: null,
    });
    const result = toParsedDataComplete(parsed, null);

    expect(result.body_text).toBeNull();
    expect(result.body_html).toBeNull();
  });

  it("passes through attachments_download_url", () => {
    const result = toParsedDataComplete(
      createParsedEmail({ attachments: [createAttachment()] }),
      "https://cdn.example.com/attachments/123.tar.gz",
    );
    expect(result.attachments_download_url).toBe(
      "https://cdn.example.com/attachments/123.tar.gz",
    );
  });

  it("passes through null attachments_download_url", () => {
    const result = toParsedDataComplete(createParsedEmail(), null);
    expect(result.attachments_download_url).toBeNull();
  });

  it("forces attachments_download_url to null when there are no attachments", () => {
    const result = toParsedDataComplete(
      createParsedEmail({ attachments: [] }),
      "https://cdn.example.com/attachments/123.tar.gz",
    );

    expect(result.attachments).toEqual([]);
    expect(result.attachments_download_url).toBeNull();
  });

  it("filters attachments to only downloadable ones", () => {
    const parsed = createParsedEmail({
      attachments: [
        createAttachment({ isDownloadable: true, filename: "doc.pdf" }),
        createAttachment({
          isDownloadable: false,
          filename: "inline.png",
          partIndex: 1,
        }),
        createAttachment({
          isDownloadable: true,
          filename: "photo.jpg",
          partIndex: 2,
        }),
      ],
    });
    const result = toParsedDataComplete(parsed, null);

    expect(result.attachments).toHaveLength(2);
    expect(result.attachments[0].filename).toBe("doc.pdf");
    expect(result.attachments[1].filename).toBe("photo.jpg");
  });
});

describe("toWebhookAttachments", () => {
  it("strips internal fields and converts to snake_case", () => {
    const attachments = [
      createAttachment({
        filename: "report.pdf",
        contentTypeNorm: "application/pdf",
        sizeBytes: 2048,
        sha256: "b".repeat(64),
        partIndex: 3,
        tarPath: "3_report.pdf",
      }),
    ];
    const result = toWebhookAttachments(attachments);

    expect(result).toEqual([
      {
        filename: "report.pdf",
        content_type: "application/pdf",
        size_bytes: 2048,
        sha256: "b".repeat(64),
        part_index: 3,
        tar_path: "3_report.pdf",
      },
    ]);
  });

  it("filters out non-downloadable attachments", () => {
    const attachments = [
      createAttachment({ isDownloadable: true }),
      createAttachment({ isDownloadable: false, partIndex: 1 }),
    ];
    const result = toWebhookAttachments(attachments);

    expect(result).toHaveLength(1);
  });

  it("does not include Buffer content or internal fields", () => {
    const result = toWebhookAttachments([createAttachment()]);
    const keys = Object.keys(result[0]);

    expect(keys).toEqual([
      "filename",
      "content_type",
      "size_bytes",
      "sha256",
      "part_index",
      "tar_path",
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(toWebhookAttachments([])).toEqual([]);
  });

  it("handles null filename", () => {
    const result = toWebhookAttachments([createAttachment({ filename: null })]);
    expect(result[0].filename).toBeNull();
  });
});

describe("attachmentMetadataToWebhookAttachments", () => {
  it("converts AttachmentMetadata to WebhookAttachment", () => {
    const metadata: AttachmentMetadata[] = [
      {
        filename: "test.txt",
        content_type: "text/plain",
        size_bytes: 100,
        sha256: "c".repeat(64),
        part_index: 0,
        tar_path: "0_test.txt",
      },
    ];
    const result = attachmentMetadataToWebhookAttachments(metadata);

    expect(result).toEqual(metadata);
  });
});

describe("toCanonicalHeaders", () => {
  it("maps parser output to canonical header shape", () => {
    const parsed = createParsedEmail();
    const headers = toCanonicalHeaders(parsed);

    expect(headers).toEqual({
      message_id: "<msg-123@example.com>",
      subject: "Test Subject",
      from: "sender@example.com",
      to: "recipient@example.com",
      date: "Sun, 15 Jun 2025 10:30:00 +0000",
    });
  });

  it("returns null when the original Date header is unavailable", () => {
    const parsed = createParsedEmail({
      date: new Date("2024-01-01T00:00:00.000Z"),
      dateHeader: null,
    });
    const headers = toCanonicalHeaders(parsed);

    expect(headers.date).toBeNull();
  });

  it("handles null date", () => {
    const parsed = createParsedEmail({ date: null, dateHeader: null });
    const headers = toCanonicalHeaders(parsed);

    expect(headers.date).toBeNull();
  });

  it("throws when the From header is missing", () => {
    const parsed = createParsedEmail({ from: null });

    expect(() => toCanonicalHeaders(parsed)).toThrow(/From header/);
  });

  it("throws when the To header is missing", () => {
    const parsed = createParsedEmail({ to: null });

    expect(() => toCanonicalHeaders(parsed)).toThrow(/To header/);
  });

  it("handles null subject and messageId", () => {
    const parsed = createParsedEmail({ subject: null, messageId: null });
    const headers = toCanonicalHeaders(parsed);

    expect(headers.subject).toBeNull();
    expect(headers.message_id).toBeNull();
  });
});
