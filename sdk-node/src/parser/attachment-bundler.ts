import { createHash } from "node:crypto";
import { PassThrough } from "node:stream";
import type { ParsedAttachment } from "./attachment-parser.js";

async function loadArchiver() {
  const module = await import("archiver");
  return module.default;
}

/**
 * Result of bundling attachments into a tar.gz archive
 */
export interface BundleResult {
  /** The tar.gz archive as a Buffer */
  tarGzBuffer: Buffer;
  /** SHA-256 hash of the tar.gz archive */
  sha256: string;
  /** Number of attachments included */
  attachmentCount: number;
  /** Total size of all attachment bytes (before compression) */
  totalAttachmentBytes: number;
}

/**
 * Metadata for attachments included in the bundle (for DB storage)
 */
export interface AttachmentMetadata {
  filename: string | null;
  content_type: string;
  size_bytes: number;
  sha256: string;
  part_index: number;
  tar_path: string;
}

/**
 * Bundle downloadable attachments into a tar.gz archive.
 *
 * - Only includes attachments where isDownloadable === true
 * - Inline images (related=true) are excluded - they're in body_html as data: URLs
 * - Files are stored at paths: {partIndex}_{sanitized_filename}
 *
 * @param attachments - Array of parsed attachments from parseEmailWithAttachments()
 * @returns BundleResult with the tar.gz buffer and metadata, or null if no downloadable attachments
 */
export async function bundleAttachments(
  attachments: ParsedAttachment[],
): Promise<BundleResult | null> {
  // Filter to only downloadable attachments
  const downloadable = attachments.filter((att) => att.isDownloadable);

  if (downloadable.length === 0) {
    return null;
  }

  // Create tar.gz archive
  const archiver = await loadArchiver();
  const archive = archiver("tar", {
    gzip: true,
    gzipOptions: { level: 6 }, // Balanced compression
  });

  // Collect output into a buffer
  const chunks: Buffer[] = [];
  const passThrough = new PassThrough();
  let totalAttachmentBytes = 0;

  const tarGzBuffer = await new Promise<Buffer>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      archive.off("error", rejectArchive);
      archive.off("warning", rejectArchive);
      passThrough.off("data", handleData);
      passThrough.off("end", handleEnd);
      passThrough.off("error", rejectArchive);
    };

    const rejectArchive = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const handleData = (chunk: Buffer) => {
      chunks.push(chunk);
    };

    const handleEnd = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(Buffer.concat(chunks));
    };

    archive.on("error", rejectArchive);
    archive.on("warning", rejectArchive);
    passThrough.on("data", handleData);
    passThrough.on("end", handleEnd);
    passThrough.on("error", rejectArchive);

    archive.pipe(passThrough);

    try {
      for (const att of downloadable) {
        archive.append(att.content, { name: att.tarPath });
        totalAttachmentBytes += att.sizeBytes;
      }
      void archive.finalize().catch(rejectArchive);
    } catch (error) {
      rejectArchive(error instanceof Error ? error : new Error(String(error)));
    }
  });

  // Compute SHA-256
  const sha256 = createHash("sha256").update(tarGzBuffer).digest("hex");

  return {
    tarGzBuffer,
    sha256,
    attachmentCount: downloadable.length,
    totalAttachmentBytes,
  };
}

/**
 * Extract metadata for DB storage from parsed attachments.
 * Only includes downloadable attachments (matches what's in the tar.gz).
 *
 * @param attachments - Array of parsed attachments
 * @returns Array of attachment metadata for DB storage
 */
export function extractAttachmentMetadata(
  attachments: ParsedAttachment[],
): AttachmentMetadata[] {
  return attachments
    .filter((att) => att.isDownloadable)
    .map((att) => ({
      filename: att.filename,
      content_type: att.contentTypeNorm,
      size_bytes: att.sizeBytes,
      sha256: att.sha256,
      part_index: att.partIndex,
      tar_path: att.tarPath,
    }));
}

/**
 * Generate the storage key for an attachments tar.gz file.
 *
 * @param emailId - The email UUID
 * @param sha256 - SHA-256 hash of the tar.gz file
 * @returns Storage key in format: attachments/{email_id}_{hash8}.tar.gz
 */
export function getAttachmentsStorageKey(
  emailId: string,
  sha256: string,
): string {
  const hash8 = sha256.substring(0, 8);
  return `attachments/${emailId}_${hash8}.tar.gz`;
}
