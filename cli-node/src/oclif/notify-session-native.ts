import { lstat, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, normalize } from "node:path";
import { isDeepStrictEqual } from "node:util";
import WebSocket from "ws";
import { ListenStateError } from "./listen-state.js";

export const SESSION_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class NativeSessionError extends ListenStateError {
  constructor(
    message: string,
    readonly submitted = false,
  ) {
    super(message);
  }
}
const failure = () =>
  new NativeSessionError(
    "The native session socket is unavailable or not private. Open the exact session in a terminal with native local-session support enabled, then restart this listener.",
  );
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export function defaultSessionSocket(): string {
  return join(
    process.env.CODEX_HOME ?? join(homedir(), ".codex"),
    "app-server-control",
    "app-server-control.sock",
  );
}

/** The native control path may link to a second private runtime directory. */
export async function inspectSessionSocket(socketPath: string) {
  if (
    !process.getuid ||
    !isAbsolute(socketPath) ||
    normalize(socketPath) !== socketPath ||
    /[:\0?#]/.test(socketPath)
  )
    throw failure();
  const uid = process.getuid();
  const identity = (info: Awaited<ReturnType<typeof lstat>>) => ({
    dev: info.dev,
    ino: info.ino,
  });
  async function parents(path: string) {
    const resolved = await realpath(path);
    const chain = [];
    for (let current = resolved; ; ) {
      const info = await lstat(current);
      if (
        !info.isDirectory() ||
        ![uid, 0].includes(info.uid) ||
        (info.mode & 0o022 && !(info.uid === 0 && info.mode & 0o1000))
      )
        throw failure();
      if (current === resolved && (info.uid !== uid || info.mode & 0o077))
        throw failure();
      chain.push({ path: current, ...identity(info) });
      if (dirname(current) === current) break;
      current = dirname(current);
    }
    return chain;
  }
  const sourceParents = await parents(dirname(socketPath));
  const source = await lstat(socketPath);
  if (source.uid !== uid || (!source.isSocket() && !source.isSymbolicLink()))
    throw failure();
  const targetPath = await realpath(socketPath);
  if (/[:\0?#]/.test(targetPath)) throw failure();
  const targetParents = await parents(dirname(targetPath));
  const target = await lstat(targetPath);
  if (!target.isSocket() || target.uid !== uid || target.mode & 0o077)
    throw failure();
  return {
    targetPath,
    source: identity(source),
    target: identity(target),
    sourceParents,
    targetParents,
  };
}

/** Connect only. The terminal keeps ownership of approvals and runtime policy. */
export async function connectNativeSession(options: {
  threadId: string;
  socketPath?: string;
  signal: AbortSignal;
  timeoutMs?: number;
}) {
  if (!SESSION_UUID.test(options.threadId))
    throw new NativeSessionError(
      "--notify-session requires an exact session UUID.",
    );
  const socketPath = options.socketPath ?? defaultSessionSocket();
  const timeoutMs = options.timeoutMs ?? 3000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 3000)
    throw failure();
  let identity: Awaited<ReturnType<typeof inspectSessionSocket>>;
  try {
    identity = await inspectSessionSocket(socketPath);
  } catch {
    throw failure();
  }
  options.signal.throwIfAborted();
  const socket = new WebSocket(`ws+unix://${identity.targetPath}:/`, {
    maxPayload: 8 * 1024 * 1024,
    handshakeTimeout: timeoutMs,
    followRedirects: false,
  });
  const pending = new Map<
    number,
    {
      resolve: (result: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  let closed = false;
  let sequence = 0;
  let cwd: string | undefined;
  const close = () => {
    if (closed) return;
    closed = true;
    options.signal.removeEventListener("abort", close);
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(failure());
    }
    pending.clear();
    socket.terminate();
  };
  options.signal.addEventListener("abort", close, { once: true });
  socket.on("error", close);
  socket.on("close", close);
  socket.on("message", (bytes, binary) => {
    try {
      if (binary) throw failure();
      const message = record(JSON.parse(bytes.toString()));
      // Server requests, including approvals, belong to the terminal. Never answer.
      if (typeof message.method === "string") return;
      if (!Number.isSafeInteger(message.id)) throw failure();
      const entry = pending.get(message.id as number);
      if (!entry) return;
      pending.delete(message.id as number);
      clearTimeout(entry.timer);
      if (Object.hasOwn(message, "result") && !Object.hasOwn(message, "error"))
        entry.resolve(message.result);
      else entry.reject(failure());
    } catch {
      close();
    }
  });
  function request(method: string, params: unknown): Promise<unknown> {
    if (
      closed ||
      options.signal.aborted ||
      socket.readyState !== WebSocket.OPEN
    )
      return Promise.reject(failure());
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(failure());
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      try {
        socket.send(JSON.stringify({ id, method, params }), (error) => {
          if (error) close();
        });
      } catch {
        close();
      }
    });
  }
  async function verify() {
    if (!isDeepStrictEqual(await inspectSessionSocket(socketPath), identity))
      throw new NativeSessionError(
        "The native session socket changed. Restart the listener explicitly.",
      );
    let cursor: string | undefined;
    let found = false;
    let complete = false;
    const cursors = new Set<string>();
    const deadline = Date.now() + 5000;
    for (let page = 0; page < 100 && Date.now() < deadline; page++) {
      const result = record(
        await request("thread/loaded/list", {
          ...(cursor ? { cursor } : {}),
          limit: 100,
        }),
      );
      if (
        !Array.isArray(result.data) ||
        !result.data.every(
          (id) => typeof id === "string" && SESSION_UUID.test(id),
        )
      )
        throw failure();
      found ||= result.data.includes(options.threadId);
      if (result.nextCursor === null) {
        complete = true;
        break;
      }
      if (
        typeof result.nextCursor !== "string" ||
        !result.nextCursor ||
        cursors.has(result.nextCursor)
      )
        throw failure();
      cursor = result.nextCursor;
      cursors.add(cursor);
    }
    if (!complete || !found)
      throw new NativeSessionError(
        "Open this exact session in the native terminal before listening.",
      );
    const thread = record(
      record(
        await request("thread/read", {
          threadId: options.threadId,
          includeTurns: false,
        }),
      ).thread,
    );
    if (
      thread.id !== options.threadId ||
      thread.canAcceptDirectInput !== true ||
      typeof thread.cwd !== "string" ||
      !isAbsolute(thread.cwd) ||
      (cwd !== undefined && cwd !== thread.cwd)
    )
      throw new NativeSessionError(
        "The exact session cannot accept input or its working directory changed.",
      );
    cwd = thread.cwd;
    if (!isDeepStrictEqual(await inspectSessionSocket(socketPath), identity))
      throw failure();
    if (closed || options.signal.aborted) throw failure();
  }
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", () => reject(failure()));
      socket.once("close", () => reject(failure()));
    });
    await request("initialize", {
      clientInfo: { name: "primitive_cli", version: "1" },
      capabilities: { experimentalApi: true },
    });
    socket.send(JSON.stringify({ method: "initialized", params: {} }));
    await verify();
  } catch (error) {
    close();
    throw error instanceof NativeSessionError ? error : failure();
  }
  return {
    close,
    async queue(
      text: string,
      clientUserMessageId: string,
      beforeDispatch: () => void,
    ) {
      if (
        !SESSION_UUID.test(clientUserMessageId) ||
        Buffer.byteLength(text) > 16_384
      )
        throw failure();
      try {
        await verify();
      } catch (error) {
        throw error instanceof NativeSessionError ? error : failure();
      }
      // Synchronous durable receipt write belongs immediately before dispatch.
      beforeDispatch();
      try {
        const result = record(
          await request("thread/queue/add", {
            threadId: options.threadId,
            clientUserMessageId,
            input: [{ type: "text", text, text_elements: [] }],
          }),
        );
        const queued = record(result.queuedSubmission);
        if (
          typeof queued.id !== "string" ||
          queued.clientUserMessageId !== clientUserMessageId
        )
          throw failure();
      } catch {
        throw new NativeSessionError(
          "Native notification outcome is unknown; it will not be sent again automatically.",
          true,
        );
      }
    },
  };
}
