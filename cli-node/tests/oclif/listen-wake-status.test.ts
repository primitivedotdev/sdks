import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Readable } from "node:stream";
import { afterEach, expect, it, vi } from "vitest";

const session = "11111111-1111-4111-8111-111111111111";
const stopInput = { hook_event_name: "Stop", session_id: session };
const resumeInput = {
  hook_event_name: "SessionStart",
  source: "resume",
  session_id: session,
};
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
  loadConnectedAgentProfile: vi.fn(),
}));

vi.mock("../../src/oclif/connected-agent-profile.js", async (original) => ({
  ...(await original<
    typeof import("../../src/oclif/connected-agent-profile.js")
  >()),
  loadConnectedAgentProfile: mocks.loadConnectedAgentProfile,
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
import {
  ListenStateError,
  resolveListenSubscription,
} from "../../src/oclif/listen-state.js";

const root = resolve(import.meta.dirname, "../..");
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  process.exitCode = undefined;
  delete process.env.PRIMITIVE_HOOK_AGENT_ADDRESS;
  delete process.env.PRIMITIVE_AGENT_PROFILE;
});

it("ends the Claude one-event listener with a typed external status", async () => {
  const previousExit = process.exitCode;
  const stderr: string[] = [];
  const stdin = Readable.from([JSON.stringify(stopInput)]);
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
    close: vi.fn(),
    receiving: vi.fn(),
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

it("wakes the exact invitation profile instead of assuming session-named enrollment", async () => {
  const stdin = Readable.from([JSON.stringify(resumeInput)]);
  vi.spyOn(process, "stdin", "get").mockReturnValue(
    stdin as typeof process.stdin,
  );
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  process.env.PRIMITIVE_AGENT_PROFILE = "invited-profile";
  process.env.PRIMITIVE_HOOK_AGENT_ADDRESS = "invited@example.com";
  mocks.readMailJson.mockReturnValue({
    session,
    receiverMode: "external",
    phase: "sent",
    receipt: { status: "delivered" },
  });
  mocks.loadConnectedAgentProfile.mockReturnValue({
    agent_address: "invited@example.com",
  });
  mocks.createWakeMail.mockResolvedValue({
    handler: vi.fn(),
    close: vi.fn(),
    receiving: vi.fn(),
    completed: vi.fn(),
    wakeId: () => "44444444-4444-4444-8444-444444444444",
    status: () => undefined,
  });
  mocks.runListen.mockResolvedValue(undefined);
  await ListenCommand.run(
    ["--once", "--wake", "--hook-session", "--events", "email.received"],
    { root },
  );
  expect(mocks.readMailJson.mock.calls[0][0]).toContain("invited-profile");
  expect(mocks.loadConnectedAgentProfile).toHaveBeenCalledOnce();
  expect(process.env.PRIMITIVE_AGENT_PROFILE).toBe("invited-profile");
  expect(process.exitCode).toBe(2);
});

it("does not open mail when the invitation profile address changed", async () => {
  const stdin = Readable.from([JSON.stringify(resumeInput)]);
  vi.spyOn(process, "stdin", "get").mockReturnValue(
    stdin as typeof process.stdin,
  );
  process.env.PRIMITIVE_AGENT_PROFILE = "invited-profile";
  process.env.PRIMITIVE_HOOK_AGENT_ADDRESS = "invited@example.com";
  mocks.readMailJson.mockReturnValue({
    session,
    receiverMode: "external",
    phase: "sent",
    receipt: { status: "delivered" },
  });
  mocks.loadConnectedAgentProfile.mockReturnValue({
    agent_address: "other@example.com",
  });
  await ListenCommand.run(
    ["--once", "--wake", "--hook-session", "--events", "email.received"],
    { root },
  );
  expect(mocks.createWakeMail).not.toHaveBeenCalled();
  expect(mocks.runListen).not.toHaveBeenCalled();
});

it.each([
  { hook_event_name: "SessionStart", source: "startup", session_id: session },
  { hook_event_name: "SessionStart", session_id: session },
  { hook_event_name: "UserPromptSubmit", session_id: session },
  { session_id: session },
])("ignores an unrelated hook event without opening mail: %j", async (hook) => {
  const stdin = Readable.from([JSON.stringify(hook)]);
  vi.spyOn(process, "stdin", "get").mockReturnValue(
    stdin as typeof process.stdin,
  );
  await ListenCommand.run(
    ["--once", "--wake", "--hook-session", "--events", "email.received"],
    { root },
  );
  expect(mocks.readMailJson).not.toHaveBeenCalled();
  expect(mocks.createWakeMail).not.toHaveBeenCalled();
  expect(mocks.runListen).not.toHaveBeenCalled();
  expect(process.exitCode).toBeUndefined();
});

it("resumed SessionStart waits for the prior Stop listener to release the exact subscription", async () => {
  const directory = mkdtempSync(join(tmpdir(), "primitive-resume-lock-"));
  const name = `session-${session}`;
  const previous = resolveListenSubscription(directory, "same-account", name);
  const releasePrevious = setTimeout(() => previous.release(), 350);
  const stdin = Readable.from([JSON.stringify(resumeInput)]);
  vi.spyOn(process, "stdin", "get").mockReturnValue(
    stdin as typeof process.stdin,
  );
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  mocks.readMailJson.mockReturnValue({
    session,
    receiverMode: "external",
    phase: "sent",
    receipt: { status: "delivered" },
  });
  mocks.createWakeMail.mockResolvedValue({
    handler: vi.fn(),
    close: vi.fn(),
    receiving: vi.fn(),
    completed: vi.fn(),
    wakeId: () => "44444444-4444-4444-8444-444444444444",
    status: () => undefined,
  });
  let consumed = 0;
  mocks.runListen.mockImplementation(async () => {
    const current = resolveListenSubscription(directory, "same-account", name);
    try {
      consumed++;
    } finally {
      current.release();
    }
  });
  try {
    await ListenCommand.run(
      ["--once", "--wake", "--hook-session", "--events", "email.received"],
      { root },
    );
    expect(mocks.runListen.mock.calls.length).toBeGreaterThan(1);
    expect(consumed).toBe(1);
    expect(process.exitCode).toBe(2);
  } finally {
    clearTimeout(releasePrevious);
    previous.release();
    rmSync(directory, { recursive: true, force: true });
  }
});

it("starts the resume retry window at the first lock collision after a slow lookup", async () => {
  let now = 1_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  const stdin = Readable.from([JSON.stringify(resumeInput)]);
  vi.spyOn(process, "stdin", "get").mockReturnValue(
    stdin as typeof process.stdin,
  );
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  mocks.readMailJson.mockReturnValue({
    session,
    receiverMode: "external",
    phase: "sent",
    receipt: { status: "delivered" },
  });
  mocks.createWakeMail.mockResolvedValue({
    handler: vi.fn(),
    close: vi.fn(),
    receiving: vi.fn(),
    completed: vi.fn(),
    wakeId: () => "44444444-4444-4444-8444-444444444444",
    status: () => undefined,
  });
  mocks.runListen
    .mockImplementationOnce(async () => {
      now += 10_000;
      throw new ListenStateError("Another listener is using this subscription");
    })
    .mockResolvedValueOnce(undefined);
  await ListenCommand.run(
    ["--once", "--wake", "--hook-session", "--events", "email.received"],
    { root },
  );
  expect(mocks.runListen).toHaveBeenCalledTimes(2);
  expect(process.exitCode).toBe(2);
});

it("a contending Stop hook exits without consuming or releasing the winning listener", async () => {
  const directory = mkdtempSync(join(tmpdir(), "primitive-stop-lock-"));
  const name = `session-${session}`;
  const winner = resolveListenSubscription(directory, "same-account", name);
  const stdin = Readable.from([JSON.stringify(stopInput)]);
  vi.spyOn(process, "stdin", "get").mockReturnValue(
    stdin as typeof process.stdin,
  );
  mocks.readMailJson.mockReturnValue({
    session,
    receiverMode: "external",
    phase: "sent",
    receipt: { status: "delivered" },
  });
  mocks.createWakeMail.mockResolvedValue({
    handler: vi.fn(),
    close: vi.fn(),
    receiving: vi.fn(),
    completed: vi.fn(),
    wakeId: () => undefined,
    status: () => undefined,
  });
  mocks.runListen.mockImplementation(async () => {
    resolveListenSubscription(directory, "same-account", name);
  });
  try {
    await ListenCommand.run(
      ["--once", "--wake", "--hook-session", "--events", "email.received"],
      { root },
    );
    expect(mocks.runListen).toHaveBeenCalledOnce();
    expect(process.exitCode).toBeUndefined();
    expect(() =>
      resolveListenSubscription(directory, "same-account", name),
    ).toThrow("Another listener is using this subscription");
  } finally {
    winner.release();
    rmSync(directory, { recursive: true, force: true });
  }
});
