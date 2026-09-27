import { randomUUID } from "node:crypto";
import { chmod, mkdir, mkdtemp, rename, rm, symlink } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocketServer } from "ws";
import { connectNativeSession } from "../../src/oclif/notify-session-native.js";

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
            ? { data: state.loaded, nextCursor: null }
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
  const connect = async () => {
    const native = await connectNativeSession({
      threadId,
      socketPath,
      signal: new AbortController().signal,
      timeoutMs: 100,
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
  },
);
