import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { EventReceiverError } from "@primitivedotdev/sdk/api";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runListen: vi.fn(),
  runBackgroundListen: vi.fn(),
}));
vi.mock("../../src/oclif/listen-runner.js", async (original) => ({
  ...(await original<typeof import("../../src/oclif/listen-runner.js")>()),
  runListen: mocks.runListen,
}));
vi.mock("../../src/oclif/listen-background.js", async (original) => ({
  ...(await original<typeof import("../../src/oclif/listen-background.js")>()),
  runBackgroundListen: mocks.runBackgroundListen,
}));

import ListenCommand from "../../src/oclif/commands/listen.js";
import { saveConnectedAgentProfile } from "../../src/oclif/connected-agent-profile.js";
import {
  ConnectionRevokedError,
  ListenUnauthorizedError,
} from "../../src/oclif/listen-state.js";

const root = resolve(import.meta.dirname, "../..");
const session = "11111111-1111-4111-8111-111111111111";
const credential = ["pconn", "native"].join("_");
let home: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "listen-revoked-"));
  vi.stubEnv("PRIMITIVE_CONFIG_DIR", home);
  vi.stubEnv("PRIMITIVE_AGENT_PROFILE", "work");
  for (const name of [
    "CLAUDE_CODE_SESSION_ID",
    "CLAUDECODE",
    "CODEX_THREAD_ID",
    "PRIMITIVE_API_KEY",
    "PRIMITIVE_API_BASE_URL",
  ])
    vi.stubEnv(name, "");
  saveConnectedAgentProfile(home, "work", {
    version: 1,
    auth_method: "agent_connection",
    api_key: credential,
    api_base_url: "https://api.primitive.dev/v1",
    org_id: "22222222-2222-4222-8222-222222222222",
    agent_address: "work@example.test",
    owner_address: "owner@example.test",
    invitation_hash: "a".repeat(64),
    created_at: "2026-01-01T00:00:00.000Z",
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  rmSync(home, { recursive: true, force: true });
});

type Captured = {
  run(signal: AbortSignal, onReady: () => void): Promise<void>;
  failureCode(error: unknown): string;
  retryable(error: unknown): boolean;
};

async function capturedReceiver(): Promise<Captured> {
  let captured: Captured | undefined;
  mocks.runBackgroundListen.mockImplementation(async (options: Captured) => {
    captured = options;
  });
  await ListenCommand.run(
    ["--notify-session", session, "--sender", "peer@example.test"],
    { root },
  );
  if (!captured) throw new Error("the receiver was not started");
  return captured;
}

function answers(...responses: Array<() => Response>) {
  const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
    expect(String(input)).toBe(
      "https://api.primitive.dev/v1/agent-connections/me",
    );
    expect(new Headers(init?.headers).get("authorization")).toBe(
      `Bearer ${credential}`,
    );
    const next = responses.shift();
    if (!next) throw new Error("unexpected extra request");
    return next();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

it.each([
  ["an open stream", new EventReceiverError("refused", "unauthorized", 401)],
  ["an email read", new ListenUnauthorizedError("refused", 401)],
])(
  "holds the receiver with connection-revoked when %s is refused and Primitive confirms the revocation",
  async (_label, refusal) => {
    const receiver = await capturedReceiver();
    answers(() => new Response("{}", { status: 401 }));
    mocks.runListen.mockRejectedValue(refusal);
    const failure = await receiver
      .run(new AbortController().signal, () => undefined)
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ConnectionRevokedError);
    expect((failure as Error).message).toContain(
      "Primitive no longer accepts the connection for work@example.test.",
    );
    expect((failure as Error).message).not.toContain(credential);
    expect(receiver.failureCode(failure)).toBe("connection-revoked");
    expect(receiver.retryable(failure)).toBe(false);
  },
);

it("keeps an unconfirmed 401 an ordinary receiving failure", async () => {
  const receiver = await capturedReceiver();
  answers(
    () =>
      new Response(
        JSON.stringify({
          success: true,
          data: {
            connection: { address: "work@example.test", status: "connected" },
          },
        }),
        { status: 200 },
      ),
  );
  const refusal = new EventReceiverError("refused", "unauthorized", 401);
  mocks.runListen.mockRejectedValue(refusal);
  const failure = await receiver
    .run(new AbortController().signal, () => undefined)
    .catch((error: unknown) => error);
  expect(failure).toBe(refusal);
  expect(receiver.failureCode(failure)).toBe("receiving-failed");
});

it("does not ask Primitive about failures other than a 401", async () => {
  const receiver = await capturedReceiver();
  const fetchMock = answers();
  const refusal = new EventReceiverError("busy", "unavailable", 503);
  mocks.runListen.mockRejectedValue(refusal);
  const failure = await receiver
    .run(new AbortController().signal, () => undefined)
    .catch((error: unknown) => error);
  expect(failure).toBe(refusal);
  expect(fetchMock).not.toHaveBeenCalled();
});
