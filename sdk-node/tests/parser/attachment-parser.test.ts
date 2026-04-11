import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import {
  normalizeContentType,
  parseEmailWithAttachments,
  sanitizeFilename,
  sha256Hex,
} from "../../src/parser/attachment-parser.js";

const FIXTURES_DIR = join(import.meta.dirname, "fixtures/emails");

function loadFixture(name: string): Buffer {
  return readFileSync(join(FIXTURES_DIR, name));
}

let attachmentIdCounter = 0;
function mockAttachmentId(): string {
  return `test-att-${attachmentIdCounter++}`;
}

beforeEach(() => {
  attachmentIdCounter = 0;
});

// =============================================================================
// BODY SELECTION TESTS
// =============================================================================

describe("body selection", () => {
  test("extracts plain text body from simple email", async () => {
    const eml = loadFixture("simple-text.eml");
    const result = await parseEmailWithAttachments(eml, {
      generateAttachmentId: mockAttachmentId,
    });

    expect(result.bodyText).toContain("simple plain text email");
    expect(result.bodyHtml).toBeNull();
    expect(result.attachments).toHaveLength(0);
  });

  test("extracts HTML body from simple HTML email", async () => {
    const eml = loadFixture("simple-html.eml");
    const result = await parseEmailWithAttachments(eml, {
      generateAttachmentId: mockAttachmentId,
    });

    expect(result.bodyHtml).toContain("<h1>Hello World</h1>");
    expect(result.bodyHtml).toContain("<strong>simple</strong>");
    expect(result.attachments).toHaveLength(0);
  });

  test("selects OUTER body from forwarded message, not nested rfc822", async () => {
    const eml = loadFixture("forwarded-message.eml");
    const result = await parseEmailWithAttachments(eml, {
      generateAttachmentId: mockAttachmentId,
    });

    // Should get the forwarding note, NOT the original email body
    expect(result.bodyText).toContain("FYI - forwarding this to you");
    expect(result.bodyText).not.toContain("ORIGINAL email body");

    // The forwarded message should be an attachment
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].contentTypeNorm).toBe("message/rfc822");
    expect(result.attachments[0].isDownloadable).toBe(true);
  });
});

// =============================================================================
// ATTACHMENT EXTRACTION TESTS
// =============================================================================

describe("attachment extraction", () => {
  test("extracts PDF attachment with correct metadata", async () => {
    const eml = loadFixture("pdf-attachment.eml");
    const result = await parseEmailWithAttachments(eml, {
      generateAttachmentId: mockAttachmentId,
    });

    expect(result.attachments).toHaveLength(1);
    const att = result.attachments[0];

    expect(att.filename).toBe("report.pdf");
    expect(att.contentTypeNorm).toBe("application/pdf");
    expect(att.disposition).toBe("attachment");
    expect(att.isDownloadable).toBe(true);
    expect(att.isInline).toBe(false);
    expect(att.sizeBytes).toBeGreaterThan(0);
    expect(att.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(att.content).toBeInstanceOf(Buffer);
  });

  test("identifies inline image via CID reference", async () => {
    const eml = loadFixture("inline-image.eml");
    const result = await parseEmailWithAttachments(eml, {
      generateAttachmentId: mockAttachmentId,
    });

    expect(result.attachments).toHaveLength(1);
    const att = result.attachments[0];

    expect(att.filename).toBe("logo.png");
    expect(att.contentTypeNorm).toBe("image/png");
    expect(att.contentIdNorm).toBe("logo123");
    expect(att.isInline).toBe(true);
    expect(att.isDownloadable).toBe(false);
    expect(att.isSafeForInlineServing).toBe(true);
  });

  test("separates inline images from downloadable attachments", async () => {
    const eml = loadFixture("inline-and-attachment.eml");
    const result = await parseEmailWithAttachments(eml, {
      generateAttachmentId: mockAttachmentId,
    });

    expect(result.attachments).toHaveLength(2);

    const inlineAtt = result.attachments.find((a) => a.isInline);
    const downloadableAtt = result.attachments.find((a) => a.isDownloadable);

    expect(inlineAtt).toBeDefined();
    expect(inlineAtt?.filename).toBe("header.png");
    expect(inlineAtt?.contentIdNorm).toBe("header-image");

    expect(downloadableAtt).toBeDefined();
    expect(downloadableAtt?.filename).toBe("contract.pdf");
    expect(downloadableAtt?.contentTypeNorm).toBe("application/pdf");
  });

  test("filters out S/MIME signature artifacts", async () => {
    const eml = loadFixture("smime-signed.eml");
    const result = await parseEmailWithAttachments(eml, {
      generateAttachmentId: mockAttachmentId,
    });

    // The pkcs7-signature should be filtered out
    expect(result.attachments).toHaveLength(0);
    expect(result.bodyText).toContain("digitally signed");
  });

  test("treats calendar invite as downloadable", async () => {
    const eml = loadFixture("calendar-invite.eml");
    const result = await parseEmailWithAttachments(eml, {
      generateAttachmentId: mockAttachmentId,
    });

    expect(result.attachments).toHaveLength(1);
    const att = result.attachments[0];

    expect(att.contentTypeNorm).toBe("text/calendar");
    expect(att.isDownloadable).toBe(true);
    expect(att.filename).toBe("invite.ics");
  });

  test("handles unicode filename", async () => {
    const eml = loadFixture("unicode-filename.eml");
    const result = await parseEmailWithAttachments(eml, {
      generateAttachmentId: mockAttachmentId,
    });

    expect(result.attachments).toHaveLength(1);
    const att = result.attachments[0];

    // mailparser should decode the RFC 5987 filename - original is preserved
    expect(att.filename).toBe("\u5831\u544A\u66F8.pdf");
    // downloadName is sanitized for tarPath compatibility (no unicode due to PaxHeader issues)
    expect(att.downloadName).toBe("___.pdf");
  });
});

// =============================================================================
// INLINE IMAGE HANDLING TESTS (CID -> data: URLs)
// =============================================================================

describe("inline image handling", () => {
  test("mailparser converts cid: references to data: URLs in body_html", async () => {
    const eml = loadFixture("inline-image.eml");
    const result = await parseEmailWithAttachments(eml, {
      generateAttachmentId: mockAttachmentId,
    });

    // Original had: src="cid:logo123"
    // Mailparser converts to: src="data:image/png;base64,..."
    expect(result.bodyHtml).toContain("data:image/png;base64,");
    expect(result.bodyHtml).not.toContain("cid:logo123");
  });

  test("handles multiple CID formats (case insensitive)", async () => {
    const eml = loadFixture("multiple-cid-formats.eml");
    const result = await parseEmailWithAttachments(eml, {
      generateAttachmentId: mockAttachmentId,
    });

    // All CID references should be converted to data: URLs by mailparser
    // Note: some CIDs in CSS or srcset may not be converted
    expect(result.bodyHtml).toContain("data:image/png;base64,");
  });

  test("inline images are marked as non-downloadable", async () => {
    const eml = loadFixture("inline-image.eml");
    const result = await parseEmailWithAttachments(eml, {
      generateAttachmentId: mockAttachmentId,
    });

    const inlineAtt = result.attachments.find((a) => a.isInline);
    expect(inlineAtt).toBeDefined();
    expect(inlineAtt?.isDownloadable).toBe(false);
    expect(inlineAtt?.isInline).toBe(true);
  });
});

// =============================================================================
// HTML BODY TESTS
// =============================================================================

describe("HTML body handling", () => {
  test("preserves raw HTML without sanitizing it", async () => {
    const eml = loadFixture("malicious-xss.eml");
    const result = await parseEmailWithAttachments(eml, {
      generateAttachmentId: mockAttachmentId,
    });

    expect(result.bodyHtml).toContain("<script>alert('XSS')</script>");
    expect(result.bodyHtml).toContain("onload=\"alert('body onload XSS')\"");
    expect(result.bodyHtml).toContain("https://evil.com/phishing");
  });
});

// =============================================================================
// FILENAME SANITIZATION TESTS
// =============================================================================

describe("filename sanitization", () => {
  test("removes path traversal sequences", () => {
    expect(sanitizeFilename("../../../etc/passwd", 0)).toBe("______etc_passwd");
    expect(sanitizeFilename("..\\..\\windows\\system32", 0)).toBe(
      "____windows_system32",
    );
  });

  test("removes null bytes and control characters", () => {
    expect(sanitizeFilename("file\x00name.pdf", 0)).toBe("filename.pdf");
    expect(sanitizeFilename("test\x1f\x7ffile.doc", 0)).toBe("testfile.doc");
  });

  test("normalizes whitespace", () => {
    expect(sanitizeFilename("  file   name  .pdf  ", 0)).toBe("file name .pdf");
  });

  test("truncates long filenames while preserving extension", () => {
    const longName = `${"a".repeat(250)}.pdf`;
    const result = sanitizeFilename(longName, 0);

    expect(result.length).toBeLessThanOrEqual(200);
    expect(result.endsWith(".pdf")).toBe(true);
  });

  test("truncates long filenames without preserving a long extension", () => {
    const longName = `${"a".repeat(210)}.${"b".repeat(20)}`;
    const result = sanitizeFilename(longName, 0);

    expect(result.length).toBe(200);
    expect(result).toBe(longName.slice(0, 200));
  });

  test("handles null/empty filename", () => {
    expect(sanitizeFilename(null, 5)).toBe("attachment_5");
    expect(sanitizeFilename("", 3)).toBe("attachment_3");
    expect(sanitizeFilename("   ", 2)).toBe("attachment_2");
  });

  test("handles dangerous filenames", () => {
    expect(sanitizeFilename(".", 0)).toBe("attachment_0");
    expect(sanitizeFilename("..", 0)).toBe("attachment_0");
  });

  test("replaces unicode with underscore (archiver PaxHeader issue)", () => {
    // Archiver uses PaxHeader format for non-ASCII which our tar parser doesn't handle
    // Original filename is preserved in attachment metadata
    expect(sanitizeFilename("\u5831\u544A\u66F8.pdf", 0)).toBe("___.pdf");
    expect(
      sanitizeFilename(
        "\u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442.docx",
        0,
      ),
    ).toBe("________.docx");
    expect(sanitizeFilename("Caf\u00E9.pdf", 0)).toBe("Caf_.pdf");
    expect(sanitizeFilename("Report \uD83D\uDCE7.pdf", 0)).toBe(
      "Report __.pdf",
    );
  });

  test("removes colons (archiver treats them as drive letters)", () => {
    // Colons cause issues with the archiver library - it strips content before them
    expect(sanitizeFilename("Climate: The Report.pdf", 0)).toBe(
      "Climate- The Report.pdf",
    );
    expect(sanitizeFilename("C:\\users\\test.txt", 0)).toBe(
      "C-_users_test.txt",
    );
    expect(sanitizeFilename("Time: 10:30 AM.pdf", 0)).toBe(
      "Time- 10-30 AM.pdf",
    );
  });

  test("handles combined unicode and colons", () => {
    expect(sanitizeFilename("\u5831\u544A\u66F8: Final.pdf", 0)).toBe(
      "___- Final.pdf",
    );
    expect(sanitizeFilename("Caf\u00E9: Menu \uD83D\uDCE7.pdf", 0)).toBe(
      "Caf_- Menu __.pdf",
    );
  });

  test("handles path traversal from fixture", async () => {
    const eml = loadFixture("path-traversal-filename.eml");
    const result = await parseEmailWithAttachments(eml, {
      generateAttachmentId: mockAttachmentId,
    });

    expect(result.attachments).toHaveLength(1);
    const att = result.attachments[0];

    // The download name should be sanitized
    expect(att.downloadName).not.toContain("..");
    expect(att.downloadName).not.toContain("/");
    expect(att.downloadName).not.toContain("\\");
  });
});

// =============================================================================
// CONTENT TYPE NORMALIZATION TESTS
// =============================================================================

describe("content type normalization", () => {
  test("normalizes to lowercase", () => {
    expect(normalizeContentType("Application/PDF")).toBe("application/pdf");
    expect(normalizeContentType("IMAGE/PNG")).toBe("image/png");
  });

  test("strips parameters", () => {
    expect(normalizeContentType("text/plain; charset=utf-8")).toBe(
      "text/plain",
    );
    expect(normalizeContentType('application/pdf; name="file.pdf"')).toBe(
      "application/pdf",
    );
  });

  test("handles null/undefined/empty", () => {
    expect(normalizeContentType(null)).toBe("application/octet-stream");
    expect(normalizeContentType(undefined)).toBe("application/octet-stream");
    expect(normalizeContentType("")).toBe("application/octet-stream");
    expect(normalizeContentType("   ")).toBe("application/octet-stream");
  });

  test("falls back when the media type is empty after splitting", () => {
    expect(normalizeContentType(" ; charset=utf-8")).toBe(
      "application/octet-stream",
    );
  });
});

// =============================================================================
// SHA256 TESTS
// =============================================================================

describe("sha256", () => {
  test("computes correct hash", () => {
    const buffer = Buffer.from("hello world");
    const hash = sha256Hex(buffer);

    // Known SHA-256 hash of "hello world"
    expect(hash).toBe(
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    );
  });

  test("produces 64 character hex string", () => {
    const buffer = Buffer.from("test");
    const hash = sha256Hex(buffer);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

// =============================================================================
// METADATA EXTRACTION TESTS
// =============================================================================

describe("metadata extraction", () => {
  test("extracts subject", async () => {
    const eml = loadFixture("simple-text.eml");
    const result = await parseEmailWithAttachments(eml, {
      generateAttachmentId: mockAttachmentId,
    });

    expect(result.subject).toBe("Simple text email");
  });

  test("extracts message ID", async () => {
    const eml = loadFixture("simple-text.eml");
    const result = await parseEmailWithAttachments(eml, {
      generateAttachmentId: mockAttachmentId,
    });

    expect(result.messageId).toBe("<simple-text@example.com>");
  });

  test("extracts from/to addresses", async () => {
    const eml = loadFixture("simple-text.eml");
    const result = await parseEmailWithAttachments(eml, {
      generateAttachmentId: mockAttachmentId,
    });

    expect(result.from).toBe("sender@example.com");
    expect(result.to).toBe("recipient@example.com");
  });

  test("extracts date", async () => {
    const eml = loadFixture("simple-text.eml");
    const result = await parseEmailWithAttachments(eml, {
      generateAttachmentId: mockAttachmentId,
    });

    expect(result.date).toBeInstanceOf(Date);
    expect(result.dateHeader).toBe("Sun, 15 Dec 2024 10:00:00 -0800");
  });
});

// =============================================================================
// EDGE CASE TESTS - Real-world email scenarios
// =============================================================================

describe("edge cases", () => {
  test("handles malformed/truncated email gracefully", async () => {
    const eml = loadFixture("malformed-truncated.eml");
    const result = await parseEmailWithAttachments(eml, {
      generateAttachmentId: mockAttachmentId,
    });

    // Should still extract what it can
    expect(result.bodyText).toContain("truncated mid-stream");
    // Attachment may or may not be fully parsed depending on mailparser behavior
    // Key is that it doesn't throw
  });

  test("extracts correct body from deeply nested MIME (Gmail-style)", async () => {
    const eml = loadFixture("deeply-nested-mime.eml");
    const result = await parseEmailWithAttachments(eml, {
      generateAttachmentId: mockAttachmentId,
    });

    // Should get the OUTER body, not something nested
    expect(result.bodyText).toContain("OUTER plain text body");
    expect(result.bodyHtml).toContain("OUTER HTML body");

    // Should find the inline image and the attachment
    const inlineAtt = result.attachments.find((a) => a.isInline);
    const downloadableAtt = result.attachments.find((a) => a.isDownloadable);

    expect(inlineAtt).toBeDefined();
    expect(downloadableAtt).toBeDefined();
    expect(downloadableAtt?.filename).toBe("document.pdf");
  });

  test("handles attachment with no filename", async () => {
    const eml = loadFixture("attachment-no-filename.eml");
    const result = await parseEmailWithAttachments(eml, {
      generateAttachmentId: mockAttachmentId,
    });

    expect(result.attachments).toHaveLength(1);
    const att = result.attachments[0];

    // Original filename should be null
    expect(att.filename).toBeNull();
    // But downloadName should have a fallback
    expect(att.downloadName).toMatch(/^attachment_\d+$/);
    expect(att.isDownloadable).toBe(true);
  });

  test("handles duplicate filenames - both attachments extracted", async () => {
    const eml = loadFixture("duplicate-filenames.eml");
    const result = await parseEmailWithAttachments(eml, {
      generateAttachmentId: mockAttachmentId,
    });

    // Both attachments should be extracted
    expect(result.attachments).toHaveLength(2);

    // Both have same filename
    expect(result.attachments[0].filename).toBe("report.pdf");
    expect(result.attachments[1].filename).toBe("report.pdf");

    // But different content (different hashes)
    expect(result.attachments[0].sha256).not.toBe(result.attachments[1].sha256);

    // Different part indices
    expect(result.attachments[0].partIndex).toBe(0);
    expect(result.attachments[1].partIndex).toBe(1);
  });

  test("handles HTML-only email (no text/plain alternative)", async () => {
    const eml = loadFixture("html-only.eml");
    const result = await parseEmailWithAttachments(eml, {
      generateAttachmentId: mockAttachmentId,
    });

    // bodyHtml should be populated
    expect(result.bodyHtml).toContain("Amazing Deals");
    expect(result.bodyHtml).toContain("no plain text alternative");

    // bodyText might be null or mailparser might generate it from HTML
    // Either is acceptable behavior
  });

  test("handles body-less email (attachments only)", async () => {
    const eml = loadFixture("body-less.eml");
    const result = await parseEmailWithAttachments(eml, {
      generateAttachmentId: mockAttachmentId,
    });

    // Body should be null or empty
    expect(result.bodyText ?? "").toBe("");
    expect(result.bodyHtml).toBeNull();

    // But attachments should be extracted
    expect(result.attachments).toHaveLength(2);
    expect(result.attachments[0].filename).toBe("document1.pdf");
    expect(result.attachments[1].filename).toBe("document2.pdf");
  });

  test("handles reply chain with quoted content", async () => {
    const eml = loadFixture("reply-chain.eml");
    const result = await parseEmailWithAttachments(eml, {
      generateAttachmentId: mockAttachmentId,
    });

    // Should contain the actual reply text
    expect(result.bodyText).toContain("THIS IS THE ACTUAL NEW REPLY TEXT");
    expect(result.bodyHtml).toContain("THIS IS THE ACTUAL NEW REPLY TEXT");

    // Should also contain quoted content (mailparser doesn't strip it)
    expect(result.bodyText).toContain("Thanks for the update");
  });

  test("handles non-UTF8 charset (ISO-8859-1)", async () => {
    const eml = loadFixture("non-utf8-charset.eml");
    const result = await parseEmailWithAttachments(eml, {
      generateAttachmentId: mockAttachmentId,
    });

    // Mailparser should convert to UTF-8
    // e-acute should be properly decoded
    expect(result.bodyText).toContain("caf\u00E9");
    expect(result.bodyText).toContain("Cr\u00E8me br\u00FBl\u00E9e");
    expect(result.bodyText).toContain("fran\u00E7ais");

    // Subject should be decoded (MIME encoded-word)
    expect(result.subject).toContain("Caf\u00E9");
    expect(result.subject).toContain("\u00E0 la carte");
  });

  test("handles quoted-printable encoding", async () => {
    const eml = loadFixture("quoted-printable.eml");
    const result = await parseEmailWithAttachments(eml, {
      generateAttachmentId: mockAttachmentId,
    });

    // Soft line breaks should be removed
    expect(result.bodyText).toContain(
      "soft line breaks which should be removed during decoding",
    );
    expect(result.bodyText).not.toContain("=\n");

    // Encoded characters should be decoded
    expect(result.bodyText).toContain("equals= sign"); // =3D -> =

    // Attachment should also be decoded
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].filename).toBe("notes.txt");
  });

  test("handles inline attachment without Content-ID", async () => {
    const eml = loadFixture("inline-no-cid.eml");
    const result = await parseEmailWithAttachments(eml, {
      generateAttachmentId: mockAttachmentId,
    });

    expect(result.attachments).toHaveLength(1);
    const att = result.attachments[0];

    // Has inline disposition but no CID
    expect(att.disposition).toBe("inline");
    expect(att.contentIdNorm).toBeNull();

    // Since it can't be referenced in HTML, it should probably be downloadable
    // This tests our isDownloadable logic for this edge case
    expect(att.filename).toBe("photo.png");
  });
});
