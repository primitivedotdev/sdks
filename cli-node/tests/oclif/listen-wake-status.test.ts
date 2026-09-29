import { resolve } from "node:path";
import { Readable } from "node:stream";
import { afterEach, expect, it, vi } from "vitest";

const session = "11111111-1111-4111-8111-111111111111";
const status = {
  emailId: "22222222-2222-4222-8222-222222222222",
  sentEmailId: "33333333-3333-4333-8333-333333333333",
  kind: "working" as const,
  peer: "peer@example.com",
};
const mocks = vi.hoisted(() => ({
  runListen: vi.fn(),
  createWakeMail: vi.fn(),
  readMailJson: vi.fn(),
}));

vi.mock("../../src/oclif/listen-runner.js", async (original) => ({
  ...(await original<typeof import("../../src/oclif/listen-runner.js")>()),
  runListen: mocks.runListen,
}));
vi.mock("../../src/oclif/wake-mail.js", () => ({
  createWakeMail: mocks.createWakeMail,
}));
vi.mock("../../src/oclif/shared-mail-files.js", async (original) => ({
  ...(await original<typeof import("../../src/oclif/shared-mail-files.js")>()),
  readMailJson: mocks.readMailJson,
}));

import ListenCommand from "../../src/oclif/commands/listen.js";

const root = resolve(import.meta.dirname, "../..");
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  process.exitCode = undefined;
});

it("ends the Claude one-event listener with a typed external status", async () => {
  const previousExit = process.exitCode;
  const stderr: string[] = [];
  const stdin = Readable.from([JSON.stringify({ session_id: session })]);
  vi.spyOn(process, "stdin", "get").mockReturnValue(
    stdin as typeof process.stdin,
  );
  vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
    stderr.push(String(chunk));
    return true;
  });
  mocks.readMailJson.mockReturnValue({
    session,
    receiverMode: "external",
    phase: "sent",
    receipt: { status: "delivered" },
  });
  const completed = vi.fn();
  mocks.createWakeMail.mockResolvedValue({
    handler: vi.fn(),
    completed,
    wakeId: () => undefined,
    status: () => status,
  });
  mocks.runListen.mockResolvedValue(undefined);
  try {
    await ListenCommand.run(
      ["--once", "--wake", "--hook-session", "--events", "email.received"],
      { root },
    );
    expect(mocks.runListen).toHaveBeenCalledOnce();
    expect(completed).toHaveBeenCalledOnce();
    expect(process.exitCode).toBe(2);
    expect(stderr.join("")).toContain(
      `Primitive status arrived: ${status.emailId} working peer@example.com ${status.sentEmailId}. This is activity on an exact conversation this session started, not a new task.\n`,
    );
  } finally {
    process.exitCode = previousExit;
  }
});
