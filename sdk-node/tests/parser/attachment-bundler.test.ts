import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  bundleAttachments,
  extractAttachmentMetadata,
  getAttachmentsStorageKey,
} from "../../src/parser/attachment-bundler.js";
import type { ParsedAttachment } from "../../src/parser/attachment-parser.js";

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
    sizeBytes: 7,
    sha256: createHash("sha256").update("content").digest("hex"),
    isInline: false,
    isDownloadable: true,
    isSafeForInlineServing: false,
    content: Buffer.from("content"),
    ...overrides,
  };
}

function listTarEntries(buffer: Buffer): string[] {
  const files: string[] = [];
  let offset = 0;

  while (offset < buffer.length - 512) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      break;
    }

    const nameEnd = header.indexOf(0);
    const name = header
      .subarray(0, nameEnd > 0 && nameEnd < 100 ? nameEnd : 100)
      .toString("utf8")
      .trim();
    const size = parseInt(header.subarray(124, 136).toString("utf8").trim(), 8);

    if (name) {
      files.push(name);
    }

    offset += 512 + Math.ceil((size || 0) / 512) * 512;
  }

  return files;
}

describe("attachment-bundler", () => {
  it("returns null when there are no downloadable attachments", async () => {
    const result = await bundleAttachments([
      createAttachment({ isDownloadable: false, isInline: true }),
    ]);

    expect(result).toBeNull();
  });

  it("bundles only downloadable attachments and reports metadata", async () => {
    const first = createAttachment({
      tarPath: "0_invoice.pdf",
      sizeBytes: 5,
      content: Buffer.from("first"),
      sha256: createHash("sha256").update("first").digest("hex"),
    });
    const second = createAttachment({
      id: "att-2",
      partIndex: 1,
      filename: "photo.jpg",
      contentType: "image/jpeg",
      contentTypeNorm: "image/jpeg",
      tarPath: "1_photo.jpg",
      sizeBytes: 6,
      content: Buffer.from("second"),
      sha256: createHash("sha256").update("second").digest("hex"),
    });

    const result = await bundleAttachments([
      first,
      createAttachment({
        id: "att-inline",
        isDownloadable: false,
        tarPath: "2_skip.png",
      }),
      second,
    ]);

    expect(result).not.toBeNull();
    expect(result?.attachmentCount).toBe(2);
    expect(result?.totalAttachmentBytes).toBe(11);
    expect(result?.sha256).toBe(
      createHash("sha256")
        .update(result?.tarGzBuffer ?? Buffer.alloc(0))
        .digest("hex"),
    );

    const names = listTarEntries(
      gunzipSync(result?.tarGzBuffer ?? Buffer.alloc(0)),
    );
    expect(names).toEqual(["0_invoice.pdf", "1_photo.jpg"]);
  });

  it("extracts metadata for downloadable attachments only", () => {
    const metadata = extractAttachmentMetadata([
      createAttachment(),
      createAttachment({
        isDownloadable: false,
        filename: "inline.png",
        partIndex: 1,
      }),
    ]);

    expect(metadata).toEqual([
      {
        filename: "document.pdf",
        content_type: "application/pdf",
        size_bytes: 7,
        sha256: createHash("sha256").update("content").digest("hex"),
        part_index: 0,
        tar_path: "0_document.pdf",
      },
    ]);
  });

  it("builds attachment storage keys with the hash prefix", () => {
    expect(getAttachmentsStorageKey("email-123", "abcdef1234567890")).toBe(
      "attachments/email-123_abcdef12.tar.gz",
    );
  });
});
