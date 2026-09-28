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
  NativeSessionDisconnectedError,
  NativeSessionError,
  NativeSessionNotLoadedError,
} from "../../src/oclif/notify-session-native.js";

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
    cwd: directory,
    direct: true,
    dropQueue: false,
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
      if (call.method === "thread/queue/add" && state.dropQueue) return;
      const result =
        call.method === "initialize"
          ? {}
          : call.method === "thread/loaded/list"
            ? {
                data: state.loaded,
                nextCursor: state.loadedComplete
                  ? null
                  : `page-${calls.length}`,
              }
            : call.method === "thread/read"
              ? {
                  thread: {
                    id: threadId,
                    canAcceptDirectInput: state.direct,
                    cwd: state.cwd,
                  },
                }
              : {
                  queuedSubmission: {
                    id: randomUUID(),
                    clientUserMessageId: call.params.clientUserMessageId,
                  },
                };
      socket.send(JSON.stringify({ id: call.id, result }));
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
    it("uses only read-only attachment and exact queue submission", async () => {
      const f = await fixture();
      const native = await f.connect();
      let persisted = false;
      const id = randomUUID();
      await native.queue("External event metadata", id, () => {
        persisted = true;
      });
      expect(persisted).toBe(true);
      expect(
        f.calls.filter((call) => call.method === "thread/queue/add")[0]?.params,
      ).toEqual({
        threadId: f.threadId,
        clientUserMessageId: id,
        input: [
          { type: "text", text: "External event metadata", text_elements: [] },
        ],
      });
      expect(
        f.calls.every((call) =>
          [
            "initialize",
            "initialized",
            "thread/loaded/list",
            "thread/read",
            "thread/queue/add",
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
          ].includes(call.method),
        ),
      ).toBe(true);
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
      expect(f.calls.some((call) => call.method === "thread/queue/add")).toBe(
        false,
      );
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
      expect(f.calls.some((call) => call.method === "thread/queue/add")).toBe(
        false,
      );
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
      f.state.dropQueue = true;
      await expect(
        native.queue("Event", randomUUID(), () => {}),
      ).rejects.toMatchObject({ submitted: true });
      expect(f.calls.some((call) => call.id === 900)).toBe(false);
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
      expect(f.calls.some((call) => call.method === "thread/queue/add")).toBe(
        false,
      );
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
      f.state.dropQueue = true;
      const outcome = expect(
        native.queue("Event", randomUUID(), () => {}),
      ).rejects.toMatchObject({ submitted: true });
      await vi.waitFor(() =>
        expect(f.calls.some((call) => call.method === "thread/queue/add")).toBe(
          true,
        ),
      );
      for (const socket of f.sockets.clients) socket.terminate();
      await outcome;
      expect(controller.signal.aborted).toBe(true);
      expect(
        f.calls.filter((call) => call.method === "thread/queue/add"),
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
      expect(f.calls.some((call) => call.method === "thread/queue/add")).toBe(
        false,
      );
    });
  },
);
