import { randomUUID } from "node:crypto";
import {
  chmod,
  mkdir,
  mkdtemp,
  realpath,
  rename,
  rm,
  symlink,
} from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocketServer } from "ws";
import {
  connectNativeSession,
  isNativeTurnNotSteerableResponse,
  NativeSessionDisconnectedError,
  NativeSessionError,
  NativeSessionNotLoadedError,
  NativeTurnNotSubmittedError,
} from "../../src/oclif/notify-session-native.js";

describe("native turn refusal classification", () => {
  it.each([
    "Review",
    "Compact",
  ])("accepts only explicit %s pre-dispatch refusal", (kind) => {
    expect(
      isNativeTurnNotSteerableResponse({
        code: -32603,
        message: `failed to submit turn input: ActiveTurnNotSteerable { turn_kind: ${kind} }`,
      }),
    ).toBe(true);
  });
  it.each([
    null,
    { code: -32603, message: "failed to submit turn input: Other" },
    {
      code: -32603,
      message:
        "failed to submit turn input: ActiveTurnNotSteerable { turn_kind: Regular }",
    },
    {
      code: -32000,
      message:
        "failed to submit turn input: ActiveTurnNotSteerable { turn_kind: Review }",
    },
    { code: -32603, message: "ActiveTurnNotSteerable { turn_kind: Review }" },
  ])("holds ambiguous RPC errors: %j", (error) => {
    expect(isNativeTurnNotSteerableResponse(error)).toBe(false);
  });
});

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
async function fixture() {
  const directory = await mkdtemp("/tmp/primitive-native-");
  await chmod(directory, 0o700);
  await mkdir(join(directory, "control"), { mode: 0o700 });
  const target = join(directory, "socket");
  const socketPath = join(directory, "control", "socket");
  const server = createServer();
  const sockets = new WebSocketServer({ server });
  await new Promise<void>((resolve) => server.listen(target, resolve));
  await chmod(target, 0o600);
  await symlink(target, socketPath);
  cleanups.push(async () => {
    for (const socket of sockets.clients) socket.terminate();
    await new Promise<void>((resolve) => sockets.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  });
  const threadId = randomUUID();
  const state = {
    loaded: [threadId],
    loadedComplete: true,
    omitFinalCursor: false,
    cwd: directory,
    direct: true,
    resumeThreadId: threadId,
    unloadAfterResume: false,
    changeCwdAfterResume: false,
    disableDirectAfterResume: false,
    resumeError: null as { code: number; message: string } | null,
    dropOutput: false,
    turnError: null as { code: number; message: string } | null,
    turn: { id: randomUUID(), items: [], status: "inProgress" } as unknown,
  };
  const calls: Array<{
    id?: number;
    method: string;
    params: Record<string, unknown>;
  }> = [];
  sockets.on("connection", (socket) =>
    socket.on("message", (raw) => {
      const call = JSON.parse(raw.toString());
      calls.push(call);
      if (call.id === undefined) return;
      if (call.method === "turn/start" && state.dropOutput) return;
      if (call.method === "turn/start" && state.turnError) {
        socket.send(JSON.stringify({ id: call.id, error: state.turnError }));
        return;
      }
      if (call.method === "thread/resume" && state.resumeError) {
        socket.send(JSON.stringify({ id: call.id, error: state.resumeError }));
        return;
      }
      const result =
        call.method === "initialize"
          ? {}
          : call.method === "thread/loaded/list"
            ? {
                data: state.loaded,
                ...(state.loadedComplete && state.omitFinalCursor
                  ? {}
                  : {
                      nextCursor: state.loadedComplete
                        ? null
                        : `page-${calls.length}`,
                    }),
              }
            : call.method === "thread/read"
              ? {
                  thread: {
                    id: threadId,
                    canAcceptDirectInput: state.direct,
                    cwd: state.cwd,
                  },
                }
              : call.method === "thread/resume"
                ? {
                    thread: {
                      id: state.resumeThreadId,
                    },
                  }
                : {
                    turn: state.turn,
                  };
      socket.send(JSON.stringify({ id: call.id, result }));
      if (call.method === "thread/resume") {
        if (state.unloadAfterResume) state.loaded = [];
        if (state.changeCwdAfterResume) state.cwd = "/different";
        if (state.disableDirectAfterResume) state.direct = false;
      }
    }),
  );
  const connect = async (
    onDisconnect?: (error: NativeSessionError) => void,
    signal = new AbortController().signal,
    extra: Pick<
      Parameters<typeof connectNativeSession>[0],
      "expectedCwd" | "onVerifiedCwd"
    > = {},
  ) => {
    const native = await connectNativeSession({
      threadId,
      socketPath,
      signal,
      timeoutMs: 100,
      onDisconnect,
      ...extra,
    });
    cleanups.push(async () => native.close());
    return native;
  };
  return { connect, target, socketPath, state, calls, sockets, threadId };
}

describe.skipIf(process.platform === "win32")(
  "native session transport",
  () => {
    it("subscribes only to the verified exact thread and sends external tool output without user input", async () => {
      const f = await fixture();
      f.state.loaded.unshift(randomUUID());
      f.state.omitFinalCursor = true;
      const native = await f.connect();
      expect(f.calls.map((call) => call.method)).toEqual([
        "initialize",
        "initialized",
        "thread/loaded/list",
        "thread/read",
        "thread/resume",
        "thread/loaded/list",
        "thread/read",
      ]);
      expect(
        f.calls.find((call) => call.method === "thread/resume")?.params,
      ).toEqual({ threadId: f.threadId, excludeTurns: true });
      let persisted = false;
      const id = randomUUID();
      await native.queue("External event metadata", id, () => {
        persisted = true;
      });
      expect(persisted).toBe(true);
      expect(
        f.calls.filter((call) => call.method === "turn/start")[0]?.params,
      ).toEqual({
        threadId: f.threadId,
        input: [],
        toolOutput: {
          name: "mail_received",
          namespace: "primitive",
          output: "External event metadata",
        },
      });
      expect(
        f.calls.every((call) =>
          [
            "initialize",
            "initialized",
            "thread/loaded/list",
            "thread/read",
            "thread/resume",
            "turn/start",
          ].includes(call.method),
        ),
      ).toBe(true);
      expect(
        f.calls
          .filter((call) => call.method === "thread/read")
          .every((call) => call.params.includeTurns === false),
      ).toBe(true);
    });
    it("rechecks loaded identity and cwd before persisting a submission", async () => {
      const f = await fixture();
      const native = await f.connect();
      let persisted = false;
      f.state.loaded = [];
      await expect(
        native.queue("Event", randomUUID(), () => {
          persisted = true;
        }),
      ).rejects.toMatchObject({ submitted: false });
      f.state.loaded = [f.threadId];
      f.state.cwd = "/different";
      await expect(
        native.queue("Event", randomUUID(), () => {
          persisted = true;
        }),
      ).rejects.toMatchObject({ submitted: false });
      expect(persisted).toBe(false);
    });
    it.each([
      "inProgress",
      "completed",
      "interrupted",
      "failed",
    ])("acknowledges a valid %s turn without requiring a new user message", async (status) => {
      const f = await fixture();
      const native = await f.connect();
      const existingTurnId = randomUUID();
      f.state.turn = { id: existingTurnId, items: [], status };
      const beforeDispatch = vi.fn();
      await native.queue("External event", randomUUID(), beforeDispatch);
      expect(beforeDispatch).toHaveBeenCalledOnce();
      expect(
        f.calls.filter((call) => call.method === "turn/start"),
      ).toHaveLength(1);
      expect(f.calls.some((call) => call.method === "turn/interrupt")).toBe(
        false,
      );
    });
    it.each([
      { items: [], status: "inProgress" },
      { id: "", items: [], status: "inProgress" },
      { id: "turn", items: null, status: "inProgress" },
      { id: "turn", items: [], status: "unknown" },
      { id: "turn", items: [], status: ["inProgress"] },
    ])("holds a malformed turn acknowledgement as unknown: %j", async (turn) => {
      const f = await fixture();
      const native = await f.connect();
      f.state.turn = turn;
      const beforeDispatch = vi.fn();
      await expect(
        native.queue("External event", randomUUID(), beforeDispatch),
      ).rejects.toMatchObject({ submitted: true });
      expect(beforeDispatch).toHaveBeenCalledOnce();
      expect(
        f.calls.filter((call) => call.method === "turn/start"),
      ).toHaveLength(1);
    });
    it("identifies a completely listed but unloaded session without submitting input", async () => {
      const f = await fixture();
      f.state.loaded = [];
      const initialError = await f.connect().catch((error: unknown) => error);
      expect(initialError).toBeInstanceOf(NativeSessionNotLoadedError);
      expect(initialError).toMatchObject({
        message:
          "Open this exact session in the native terminal before listening.",
        submitted: false,
      });
      expect(f.calls.some((call) => call.method === "thread/read")).toBe(false);
      expect(f.calls.some((call) => call.method === "thread/resume")).toBe(
        false,
      );

      f.state.loaded = [f.threadId];
      const verified = vi.fn();
      const native = await f.connect(undefined, undefined, {
        onVerifiedCwd: verified,
      });
      const cwd = await realpath(f.state.cwd);
      expect(verified).toHaveBeenCalledWith(cwd);
      native.close();
      f.state.loaded = [];
      await expect(
        f.connect(undefined, undefined, { expectedCwd: cwd }),
      ).rejects.toBeInstanceOf(NativeSessionNotLoadedError);
      f.state.loaded = [f.threadId];
      await f.connect(undefined, undefined, { expectedCwd: cwd });
      expect(
        f.calls.every((call) =>
          [
            "initialize",
            "initialized",
            "thread/loaded/list",
            "thread/read",
            "thread/resume",
          ].includes(call.method),
        ),
      ).toBe(true);
    });
    it.each([
      "wrong-thread",
      "resume-error",
      "unloaded-after-resume",
      "cwd-changed-after-resume",
      "direct-input-disabled-after-resume",
    ])("rejects %s before dispatch and closes the native connection", async (reason) => {
      const f = await fixture();
      if (reason === "wrong-thread") f.state.resumeThreadId = randomUUID();
      if (reason === "resume-error")
        f.state.resumeError = { code: -32603, message: "resume refused" };
      if (reason === "unloaded-after-resume") f.state.unloadAfterResume = true;
      if (reason === "cwd-changed-after-resume")
        f.state.changeCwdAfterResume = true;
      if (reason === "direct-input-disabled-after-resume")
        f.state.disableDirectAfterResume = true;
      await expect(f.connect()).rejects.toMatchObject({ submitted: false });
      expect(
        f.calls.filter((call) => call.method === "thread/resume"),
      ).toHaveLength(1);
      expect(f.calls.some((call) => call.method === "turn/start")).toBe(false);
      await vi.waitFor(() => expect(f.sockets.clients.size).toBe(0));
    });
    it("keeps incomplete loaded-session pagination fatal even when the session was found", async () => {
      const f = await fixture();
      f.state.loadedComplete = false;
      const error = await f.connect().catch((error: unknown) => error);
      expect(error).toBeInstanceOf(NativeSessionError);
      expect(error).not.toBeInstanceOf(NativeSessionNotLoadedError);
      expect(error).not.toBeInstanceOf(NativeSessionDisconnectedError);
      expect(
        f.calls.filter((call) => call.method === "thread/loaded/list"),
      ).toHaveLength(100);
      expect(f.calls.some((call) => call.method === "thread/read")).toBe(false);
      expect(f.calls.some((call) => call.method === "turn/start")).toBe(false);
    });
    it("rejects socket permission and symlink identity changes", async () => {
      const f = await fixture();
      const native = await f.connect();
      await chmod(f.target, 0o660);
      await expect(
        native.queue("Event", randomUUID(), () => {}),
      ).rejects.toMatchObject({ submitted: false });
      await chmod(f.target, 0o600);
      await rename(f.socketPath, `${f.socketPath}.old`);
      await symlink(f.target, f.socketPath);
      await expect(
        native.queue("Event", randomUUID(), () => {}),
      ).rejects.toMatchObject({ submitted: false });
      expect(f.calls.some((call) => call.method === "turn/start")).toBe(false);
    });
    it("marks post-dispatch timeouts unknown and leaves approvals unanswered", async () => {
      const f = await fixture();
      const native = await f.connect();
      for (const socket of f.sockets.clients)
        socket.send(
          JSON.stringify({
            id: 900,
            method: "item/commandExecution/requestApproval",
            params: {},
          }),
        );
      f.state.dropOutput = true;
      await expect(
        native.queue("Event", randomUUID(), () => {}),
      ).rejects.toMatchObject({ submitted: true });
      expect(f.calls.some((call) => call.id === 900)).toBe(false);
    });
    it.each([
      "Review",
      "Compact",
    ])("retries only Codex's explicit %s pre-dispatch refusal", async (kind) => {
      const f = await fixture();
      const native = await f.connect();
      f.state.turnError = {
        code: -32603,
        message: `failed to submit turn input: ActiveTurnNotSteerable { turn_kind: ${kind} }`,
      };
      const dispatch = vi.fn();
      await expect(
        native.queue("Event", randomUUID(), dispatch),
      ).rejects.toBeInstanceOf(NativeTurnNotSubmittedError);
      expect(dispatch).toHaveBeenCalledOnce();
      expect(
        f.calls.filter((call) => call.method === "turn/start"),
      ).toHaveLength(1);
      f.state.turnError = null;
      await native.queue("Event", randomUUID(), dispatch);
      expect(
        f.calls.filter((call) => call.method === "turn/start"),
      ).toHaveLength(2);
    });
    it.each([
      { code: -32603, message: "failed to submit turn input: Other" },
      {
        code: -32603,
        message:
          "failed to submit turn input: ActiveTurnNotSteerable { turn_kind: Regular }",
      },
      {
        code: -32000,
        message:
          "failed to submit turn input: ActiveTurnNotSteerable { turn_kind: Review }",
      },
    ])("holds every other RPC error as unknown: %j", async (turnError) => {
      const f = await fixture();
      const native = await f.connect();
      f.state.turnError = turnError;
      await expect(
        native.queue("Event", randomUUID(), () => {}),
      ).rejects.toMatchObject({
        submitted: true,
      });
    });
    it("reports an idle socket loss once without submitting any input", async () => {
      const f = await fixture();
      const disconnected = vi.fn();
      const native = await f.connect(disconnected);
      for (const socket of f.sockets.clients) socket.terminate();
      await vi.waitFor(() => expect(disconnected).toHaveBeenCalledTimes(1));
      native.close();
      expect(disconnected).toHaveBeenCalledTimes(1);
      expect(disconnected.mock.calls[0]?.[0]).toBeInstanceOf(
        NativeSessionDisconnectedError,
      );
      expect(f.calls.some((call) => call.method === "turn/start")).toBe(false);
    });
    it.each([
      "thread/closed",
      "thread/status/changed",
    ])("marks an exact %s unload as disconnected while ignoring other threads", async (method) => {
      const f = await fixture();
      const disconnected = vi.fn();
      await f.connect(disconnected);
      for (const socket of f.sockets.clients) {
        socket.send(
          JSON.stringify({
            method,
            params: {
              threadId: randomUUID(),
              status: { type: "notLoaded" },
            },
          }),
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(disconnected).not.toHaveBeenCalled();
      for (const socket of f.sockets.clients) {
        socket.send(
          JSON.stringify({
            method,
            params: {
              threadId: f.threadId,
              status: { type: "notLoaded" },
            },
          }),
        );
      }
      await vi.waitFor(() =>
        expect(disconnected).toHaveBeenCalledWith(
          expect.any(NativeSessionNotLoadedError),
        ),
      );
      expect(f.calls.some((call) => call.method === "turn/start")).toBe(false);
    });
    it("does not report deliberate close or cancellation as a lost connection", async () => {
      const f = await fixture();
      const disconnected = vi.fn();
      const first = await f.connect(disconnected);
      first.close();
      const controller = new AbortController();
      await f.connect(disconnected, controller.signal);
      controller.abort();
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(disconnected).not.toHaveBeenCalled();
    });
    it("retains an unknown dispatch outcome when disconnect aborts the receiver", async () => {
      const f = await fixture();
      const controller = new AbortController();
      const native = await f.connect(
        () => controller.abort(),
        controller.signal,
      );
      f.state.dropOutput = true;
      const outcome = expect(
        native.queue("Event", randomUUID(), () => {}),
      ).rejects.toMatchObject({ submitted: true });
      await vi.waitFor(() =>
        expect(f.calls.some((call) => call.method === "turn/start")).toBe(true),
      );
      for (const socket of f.sockets.clients) socket.terminate();
      await outcome;
      expect(controller.signal.aborted).toBe(true);
      expect(
        f.calls.filter((call) => call.method === "turn/start"),
      ).toHaveLength(1);
    });
    it("retries a missing socket but refuses unsafe socket permissions", async () => {
      const f = await fixture();
      await rename(f.socketPath, `${f.socketPath}.old`);
      await expect(f.connect()).rejects.toBeInstanceOf(
        NativeSessionDisconnectedError,
      );
      await rename(`${f.socketPath}.old`, f.socketPath);
      await chmod(f.target, 0o660);
      const error = await f.connect().catch((error: unknown) => error);
      expect(error).toBeInstanceOf(NativeSessionError);
      expect(error).not.toBeInstanceOf(NativeSessionDisconnectedError);
    });
    it("reports malformed idle protocol as fatal instead of leaving an idle listener", async () => {
      const f = await fixture();
      const disconnected = vi.fn();
      await f.connect(disconnected);
      for (const socket of f.sockets.clients) socket.send("invalid json");
      await vi.waitFor(() => expect(disconnected).toHaveBeenCalledOnce());
      expect(disconnected.mock.calls[0]?.[0]).toBeInstanceOf(
        NativeSessionError,
      );
      expect(disconnected.mock.calls[0]?.[0]).not.toBeInstanceOf(
        NativeSessionDisconnectedError,
      );
    });
    it("pins the canonical session cwd across reconnections", async () => {
      const f = await fixture();
      const verified = vi.fn();
      const native = await f.connect(undefined, undefined, {
        onVerifiedCwd: verified,
      });
      const cwd = await realpath(f.state.cwd);
      expect(verified).toHaveBeenCalledWith(cwd);
      native.close();
      await f.connect(undefined, undefined, { expectedCwd: cwd });
      f.state.cwd = "/tmp";
      const error = await f
        .connect(undefined, undefined, { expectedCwd: cwd })
        .catch((error: unknown) => error);
      expect(error).toBeInstanceOf(NativeSessionError);
      expect(error).not.toBeInstanceOf(NativeSessionDisconnectedError);
      expect(f.calls.some((call) => call.method === "turn/start")).toBe(false);
    });
  },
);
