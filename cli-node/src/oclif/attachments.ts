import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { Errors } from "@oclif/core";
import type { SendMailAttachment } from "@primitivedotdev/api-core";

type AttachmentReader = (path: string) => Buffer | Uint8Array;

function readAttachmentBytes(path: string, readFile: AttachmentReader): Buffer {
  try {
    return Buffer.from(readFile(path));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Errors.CLIError(
      `Could not read --attachment ${path}: ${detail}`,
      { exit: 1 },
    );
  }
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
}

function validateAttachmentFilename(path: string, filename: string): void {
  if (!filename) {
    throw new Errors.CLIError(
      `Could not derive an attachment filename from ${path}. Pass a file path.`,
      { exit: 1 },
    );
  }
  if (hasControlCharacter(filename)) {
    throw new Errors.CLIError(
      `Attachment filename ${filename} contains control characters.`,
      { exit: 1 },
    );
  }
}

export function readAttachmentFiles(
  paths: string[] | undefined,
  readFile: AttachmentReader = readFileSync,
): SendMailAttachment[] | undefined {
  if (!paths || paths.length === 0) return undefined;

  return paths.map((path) => {
    const filename = basename(path);
    validateAttachmentFilename(path, filename);
    const bytes = readAttachmentBytes(path, readFile);
    if (bytes.length === 0) {
      throw new Errors.CLIError(
        `Attachment file ${path} is empty. Attachments must contain at least one byte.`,
        { exit: 1 },
      );
    }

    return {
      content_base64: bytes.toString("base64"),
      filename,
    };
  });
}
