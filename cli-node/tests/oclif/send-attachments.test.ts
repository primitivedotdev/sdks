import { Errors } from "@oclif/core";
import { describe, expect, it } from "vitest";
import { readAttachmentFiles } from "../../src/oclif/attachments.js";
import SendCommand from "../../src/oclif/commands/send.js";

describe("readAttachmentFiles", () => {
  it("returns undefined when no attachment flags are present", () => {
    expect(readAttachmentFiles(undefined)).toBeUndefined();
    expect(readAttachmentFiles([])).toBeUndefined();
  });

  it("reads repeatable attachment paths as base64 payloads", () => {
    const attachments = readAttachmentFiles(
      ["/tmp/report.txt", "/tmp/image.bin"],
      (path) => {
        if (path.endsWith("report.txt")) return Buffer.from("hello");
        return Uint8Array.from([0, 1, 2, 3]);
      },
    );

    expect(attachments).toEqual([
      {
        content_base64: "aGVsbG8=",
        filename: "report.txt",
      },
      {
        content_base64: "AAECAw==",
        filename: "image.bin",
      },
    ]);
  });

  it("reports file read errors with the attachment flag name", () => {
    expect(() =>
      readAttachmentFiles(["missing.pdf"], () => {
        throw new Error("ENOENT");
      }),
    ).toThrow(Errors.CLIError);
    expect(() =>
      readAttachmentFiles(["missing.pdf"], () => {
        throw new Error("ENOENT");
      }),
    ).toThrow(/--attachment missing\.pdf/);
  });

  it("rejects empty attachment files before sending", () => {
    expect(() =>
      readAttachmentFiles(["empty.txt"], () => Buffer.alloc(0)),
    ).toThrow(/must contain at least one byte/);
  });

  it("rejects filenames with control characters", () => {
    expect(() =>
      readAttachmentFiles(["bad\nname.txt"], () => Buffer.from("x")),
    ).toThrow(/control characters/);
    expect(() =>
      readAttachmentFiles(["bad\u0085name.txt"], () => Buffer.from("x")),
    ).toThrow(/control characters/);
  });
});

describe("send attachment flag", () => {
  it("exposes repeatable --attachment on the top-level send command", () => {
    const flag = SendCommand.flags.attachment as {
      description?: string;
      multiple?: boolean;
    };

    expect(flag).toBeDefined();
    expect(flag.multiple).toBe(true);
    expect(flag.description).toContain("MIME attachment");
  });

  it("keeps --body-file documented as message body input", () => {
    const flag = SendCommand.flags["body-file"] as {
      description?: string;
    };

    expect(flag.description).toContain("does not attach the file");
    expect(flag.description).toContain("--attachment");
  });
});
