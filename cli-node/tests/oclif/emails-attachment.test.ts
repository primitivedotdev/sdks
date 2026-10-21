import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthenticatedCliApiClient: vi.fn(),
  downloadEmailAttachmentByFilename: vi.fn(),
  downloadSentAttachmentByFilename: vi.fn(),
  listEmailAttachmentArchiveMembers: vi.fn(),
  listSentAttachmentArchiveMembers: vi.fn(),
  downloadEmailAttachmentArchiveMember: vi.fn(),
  downloadSentAttachmentArchiveMember: vi.fn(),
  getEmail: vi.fn(),
  replyToEmail: vi.fn(),
}));

vi.mock("@primitivedotdev/api-core", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@primitivedotdev/api-core")>();
  return {
    ...actual,
    downloadEmailAttachmentByFilename: mocks.downloadEmailAttachmentByFilename,
    downloadSentAttachmentByFilename: mocks.downloadSentAttachmentByFilename,
    listEmailAttachmentArchiveMembers: mocks.listEmailAttachmentArchiveMembers,
    listSentAttachmentArchiveMembers: mocks.listSentAttachmentArchiveMembers,
    downloadEmailAttachmentArchiveMember:
      mocks.downloadEmailAttachmentArchiveMember,
    downloadSentAttachmentArchiveMember:
      mocks.downloadSentAttachmentArchiveMember,
    getEmail: mocks.getEmail,
    replyToEmail: mocks.replyToEmail,
  };
});

vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: mocks.createAuthenticatedCliApiClient,
}));

import {
  EmailsAttachmentCommand,
  EmailsAttachmentMembersCommand,
} from "../../src/oclif/commands/emails-attachment.js";
import ReplyCommand from "../../src/oclif/commands/reply.js";
import { COMMANDS } from "../../src/oclif/index.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");
const EMAIL_ID = "11111111-1111-4111-8111-111111111111";
let tempDir: string;

type Runnable = {
  run: (argv: string[], opts: { root: string }) => Promise<unknown>;
};

async function run(
  command: Runnable,
  argv: string[],
): Promise<{
  exitCode: NodeJS.Process["exitCode"];
  stdout: string;
  stderr: string;
}> {
  const out: string[] = [];
  const err: string[] = [];
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  const stdoutSpy = vi
    .spyOn(process.stdout, "write")
    .mockImplementation((chunk: string | Uint8Array) => {
      out.push(Buffer.from(chunk).toString());
      return true;
    });
  const logSpy = vi.spyOn(console, "log").mockImplementation((message = "") => {
    out.push(`${String(message)}\n`);
  });
  const stderrSpy = vi
    .spyOn(process.stderr, "write")
    .mockImplementation((chunk: string | Uint8Array) => {
      err.push(Buffer.from(chunk).toString());
      return true;
    });
  try {
    await command.run(argv, { root: CLI_ROOT });
    return {
      exitCode: process.exitCode,
      stdout: out.join(""),
      stderr: err.join(""),
    };
  } finally {
    stdoutSpy.mockRestore();
    logSpy.mockRestore();
    stderrSpy.mockRestore();
    process.exitCode = previousExitCode;
  }
}

const blob = (text: string) => ({ data: new Blob([text]) });

describe("emails attachment", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "primitive-emails-attachment-"));
    vi.clearAllMocks();
    mocks.createAuthenticatedCliApiClient.mockResolvedValue({
      apiClient: { client: { host: "api" } },
      auth: { kind: "api-key" },
      baseUrlOverridden: false,
    });
  });
  afterEach(() => {
    process.exitCode = undefined;
    rmSync(tempDir, { force: true, recursive: true });
  });

  it("downloads by exact filename through the query form, digits-only names included", async () => {
    mocks.downloadEmailAttachmentByFilename.mockResolvedValue(
      blob("year report"),
    );
    const result = await run(EmailsAttachmentCommand, [EMAIL_ID, "2024"]);
    expect(result.exitCode).toBeUndefined();
    expect(result.stdout).toBe("year report");
    expect(mocks.downloadEmailAttachmentByFilename).toHaveBeenCalledWith(
      expect.objectContaining({
        client: { host: "api" },
        path: { id: EMAIL_ID },
        query: { filename: "2024" },
        parseAs: "blob",
      }),
    );
  });

  it("reads sent mail with --sent and writes --output", async () => {
    mocks.downloadSentAttachmentByFilename.mockResolvedValue(blob("csv"));
    const output = join(tempDir, "out.csv");
    const result = await run(EmailsAttachmentCommand, [
      EMAIL_ID,
      "invoice.csv",
      "--sent",
      "--output",
      output,
    ]);
    expect(result.exitCode).toBeUndefined();
    expect(result.stdout).toBe("");
    expect(readFileSync(output, "utf8")).toBe("csv");
    expect(mocks.downloadEmailAttachmentByFilename).not.toHaveBeenCalled();
  });

  it("exits 1 with the server error for an ambiguous name, writing no bytes", async () => {
    mocks.downloadEmailAttachmentByFilename.mockResolvedValue({
      error: {
        success: false,
        error: {
          code: "attachment_name_ambiguous",
          message: "More than one attachment has this filename.",
          details: { part_indexes: [1, 2] },
        },
      },
    });
    const result = await run(EmailsAttachmentCommand, [EMAIL_ID, "notes.txt"]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("attachment_name_ambiguous");
  });
});

describe("emails attachment-members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAuthenticatedCliApiClient.mockResolvedValue({
      apiClient: { client: { host: "api" } },
      auth: { kind: "api-key" },
      baseUrlOverridden: false,
    });
  });

  it("prints the listing as JSON", async () => {
    const listing = {
      part_index: 0,
      filename: "logs.zip",
      format: "zip",
      members: [{ path: "a/b.txt", size_bytes: 3, sha256: "0".repeat(64) }],
    };
    mocks.listEmailAttachmentArchiveMembers.mockResolvedValue({
      data: { success: true, data: listing },
    });
    const result = await run(EmailsAttachmentMembersCommand, [
      EMAIL_ID,
      "logs.zip",
    ]);
    expect(result.exitCode).toBeUndefined();
    expect(JSON.parse(result.stdout)).toEqual(listing);
    expect(mocks.listEmailAttachmentArchiveMembers).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { id: EMAIL_ID, attachment: "logs.zip" },
      }),
    );
  });

  it("fetches one member with --member, from sent mail with --sent", async () => {
    mocks.downloadSentAttachmentArchiveMember.mockResolvedValue(
      blob("member bytes"),
    );
    const result = await run(EmailsAttachmentMembersCommand, [
      EMAIL_ID,
      "0",
      "--member",
      "a/b.txt",
      "--sent",
    ]);
    expect(result.exitCode).toBeUndefined();
    expect(result.stdout).toBe("member bytes");
    expect(mocks.downloadSentAttachmentArchiveMember).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { id: EMAIL_ID, attachment: "0", path: "a/b.txt" },
        parseAs: "blob",
      }),
    );
  });

  const LISTING = {
    part_index: 0,
    filename: "logs.zip",
    format: "zip",
    members: [{ path: "a/b.txt", size_bytes: 3, sha256: "0".repeat(64) }],
  };
  // Through the registry, so the --json output guard applies as installed.
  const Installed = COMMANDS[
    "emails:attachment-members"
  ] as unknown as Runnable;

  it("accepts --json and prints the same listing", async () => {
    mocks.listEmailAttachmentArchiveMembers.mockResolvedValue({
      data: { success: true, data: LISTING },
    });
    const plain = await run(Installed, [EMAIL_ID, "logs.zip"]);
    const json = await run(Installed, [EMAIL_ID, "logs.zip", "--json"]);
    expect(json.exitCode).toBeUndefined();
    expect(JSON.parse(json.stdout)).toEqual(LISTING);
    expect(json.stdout).toBe(plain.stdout);
    expect(json.stderr).toBe("");
  });

  it("prints the full envelope with --envelope", async () => {
    const envelope = { success: true, data: LISTING };
    mocks.listEmailAttachmentArchiveMembers.mockResolvedValue({
      data: envelope,
    });
    const result = await run(Installed, [
      EMAIL_ID,
      "logs.zip",
      "--json",
      "--envelope",
    ]);
    expect(result.exitCode).toBeUndefined();
    expect(JSON.parse(result.stdout)).toEqual(envelope);
  });

  it("puts a failure in one JSON document on stdout with --json", async () => {
    mocks.listEmailAttachmentArchiveMembers.mockResolvedValue({
      error: {
        success: false,
        error: {
          code: "archive_unsafe_path",
          message: "Archive contains an unsafe member path.",
        },
      },
    });
    const result = await run(Installed, [EMAIL_ID, "bad.zip", "--json"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toMatchObject({
      error: { code: "archive_unsafe_path" },
      exit_code: 1,
    });
  });

  it("refuses --json with --output, which would leave stdout empty", async () => {
    await expect(
      EmailsAttachmentMembersCommand.run(
        [EMAIL_ID, "logs.zip", "--json", "--output", join(tempDir, "x.json")],
        { root: CLI_ROOT },
      ),
    ).rejects.toThrow(/cannot also be provided when using --/);
    expect(mocks.listEmailAttachmentArchiveMembers).not.toHaveBeenCalled();
  });

  it("refuses --json and --envelope with a --member download", async () => {
    for (const flag of ["--json", "--envelope"]) {
      await expect(
        EmailsAttachmentMembersCommand.run(
          [EMAIL_ID, "0", "--member", "a/b.txt", flag],
          { root: CLI_ROOT },
        ),
      ).rejects.toThrow(
        /--member=a\/b.txt cannot also be provided when using --/,
      );
    }
    expect(mocks.downloadEmailAttachmentArchiveMember).not.toHaveBeenCalled();
  });

  it("reports an unsafe archive as an error", async () => {
    mocks.listEmailAttachmentArchiveMembers.mockResolvedValue({
      error: {
        success: false,
        error: {
          code: "archive_unsafe_path",
          message: "Archive contains an unsafe member path.",
        },
      },
    });
    const result = await run(EmailsAttachmentMembersCommand, [
      EMAIL_ID,
      "bad.zip",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("archive_unsafe_path");
  });
});

describe("reply --if-latest-message-id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAuthenticatedCliApiClient.mockResolvedValue({
      apiClient: { client: { host: "api" } },
      auth: { kind: "api-key" },
      baseUrlOverridden: false,
    });
    mocks.getEmail.mockResolvedValue({
      data: { data: { id: "email-1", replies: [] } },
    });
    mocks.replyToEmail.mockResolvedValue({
      data: {
        data: {
          id: "sent-1",
          status: "queued",
          accepted: [],
          rejected: [],
          client_idempotency_key: "k",
          content_hash: "h",
          idempotent_replay: false,
          from: "a@example.com",
          request_id: "r",
        },
      },
    });
  });

  it("sends the condition in the reply body", async () => {
    const result = await run(ReplyCommand, [
      "--id",
      "email-1",
      "--body",
      "On it.",
      "--if-latest-message-id",
      EMAIL_ID,
    ]);
    expect(result.exitCode).toBeUndefined();
    expect(mocks.replyToEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          body_text: "On it.",
          if_latest_message_id: EMAIL_ID,
        }),
      }),
    );
  });

  it("exits 1, not 4, when the condition no longer holds", async () => {
    mocks.replyToEmail.mockResolvedValue({
      error: {
        success: false,
        error: {
          code: "latest_message_mismatch",
          message: "The thread has a newer message.",
          details: {
            latest_message_id: "22222222-2222-4222-8222-222222222222",
          },
        },
      },
      response: { status: 409 },
    });
    const result = await run(ReplyCommand, [
      "--id",
      "email-1",
      "--body",
      "On it.",
      "--if-latest-message-id",
      EMAIL_ID,
    ]);
    expect(result.exitCode).toBe(1);
  });

  it("keys fyi replies with different conditions differently", async () => {
    mocks.getEmail.mockResolvedValue({
      data: {
        data: {
          id: "email-1",
          message_id: "<parent@example.com>",
          recipient: "me@example.com",
          from_email: "alice@example.com",
          replies: [],
        },
      },
    });
    const keys: string[] = [];
    for (const condition of [
      EMAIL_ID,
      "33333333-3333-4333-8333-333333333333",
    ]) {
      await run(ReplyCommand, [
        "--id",
        "email-1",
        "--fyi",
        "--body",
        "Noted.",
        "--if-latest-message-id",
        condition,
      ]);
      const call = mocks.replyToEmail.mock.calls.at(-1)?.[0] as
        | { headers?: Record<string, string> }
        | undefined;
      keys.push(call?.headers?.["Idempotency-Key"] ?? "");
    }
    expect(keys[0]).not.toBe("");
    expect(keys[0]).not.toBe(keys[1]);
  });
});
