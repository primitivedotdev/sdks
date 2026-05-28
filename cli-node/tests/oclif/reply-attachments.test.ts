import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { SendMailResult } from "@primitivedotdev/api-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthenticatedCliApiClient: vi.fn(),
  replyToEmail: vi.fn(),
}));

vi.mock("@primitivedotdev/api-core", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@primitivedotdev/api-core")>();
  return {
    ...actual,
    replyToEmail: mocks.replyToEmail,
  };
});

vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: mocks.createAuthenticatedCliApiClient,
}));

import ReplyCommand from "../../src/oclif/commands/reply.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");
let tempDir: string;

function sendResult(): SendMailResult {
  return {
    accepted: ["alice@example.com"],
    client_idempotency_key: "reply-test",
    content_hash: "sha256:test",
    delivery_status: "delivered",
    id: "sent-reply-1",
    idempotent_replay: false,
    from: "support@example.com",
    queue_id: "queue-1",
    rejected: [],
    request_id: "req-1",
    status: "delivered",
  };
}

async function runReplyCommand(argv: string[]): Promise<{
  exitCode: NodeJS.Process["exitCode"];
  stdout: string;
}> {
  const stdoutChunks: string[] = [];
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  const logSpy = vi.spyOn(console, "log").mockImplementation((message = "") => {
    stdoutChunks.push(`${String(message)}\n`);
  });
  const stderrSpy = vi
    .spyOn(process.stderr, "write")
    .mockImplementation(() => true);

  try {
    await ReplyCommand.run(argv, { root: CLI_ROOT });
    return {
      exitCode: process.exitCode,
      stdout: stdoutChunks.join(""),
    };
  } finally {
    logSpy.mockRestore();
    stderrSpy.mockRestore();
    process.exitCode = previousExitCode;
  }
}

describe("reply attachments", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "primitive-reply-attachments-"));
    vi.clearAllMocks();
    mocks.createAuthenticatedCliApiClient.mockResolvedValue({
      apiClient: { client: { host: "api" } },
      auth: { kind: "api-key" },
      baseUrlOverridden: false,
    });
    mocks.replyToEmail.mockResolvedValue({
      data: { data: sendResult() },
    });
  });

  afterEach(() => {
    process.exitCode = undefined;
    rmSync(tempDir, { force: true, recursive: true });
  });

  it("sends repeatable attachment files through the reply endpoint", async () => {
    const reportPath = join(tempDir, "report.txt");
    const imagePath = join(tempDir, "image.bin");
    writeFileSync(reportPath, "hello");
    writeFileSync(imagePath, Uint8Array.from([0, 1, 2, 3]));

    const result = await runReplyCommand([
      "--id",
      "email-1",
      "--body",
      "See attached.",
      "--attachment",
      reportPath,
      "--attachment",
      imagePath,
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(mocks.replyToEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          attachments: [
            {
              content_base64: "aGVsbG8=",
              filename: "report.txt",
            },
            {
              content_base64: "AAECAw==",
              filename: "image.bin",
            },
          ],
          body_text: "See attached.",
        },
        client: { host: "api" },
        path: { id: "email-1" },
        responseStyle: "fields",
      }),
    );
    expect(result.stdout).toContain('"id": "sent-reply-1"');
  });
});
