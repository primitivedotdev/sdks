import { describe, expect, it } from "vitest";
import * as parser from "../../src/parser/index.js";

describe("parser index", () => {
  it("re-exports the parser surface", () => {
    expect(typeof parser.parseEmail).toBe("function");
    expect(typeof parser.parseEmailWithAttachments).toBe("function");
    expect(typeof parser.bundleAttachments).toBe("function");
    expect(typeof parser.extractAttachmentMetadata).toBe("function");
    expect(typeof parser.getAttachmentsStorageKey).toBe("function");
    expect(typeof parser.toParsedDataComplete).toBe("function");
    expect(typeof parser.toWebhookAttachments).toBe("function");
    expect(typeof parser.attachmentMetadataToWebhookAttachments).toBe(
      "function",
    );
    expect(typeof parser.toCanonicalHeaders).toBe("function");
    expect(typeof parser.normalizeContentType).toBe("function");
    expect(typeof parser.sanitizeFilename).toBe("function");
    expect(typeof parser.sanitizeHtml).toBe("function");
    expect(typeof parser.sha256Hex).toBe("function");
  });
});
