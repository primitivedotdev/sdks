import { lstat, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, normalize } from "node:path";
import { isDeepStrictEqual } from "node:util";
import WebSocket from "ws";
import {
  NativeSessionDisconnectedError,
  NativeSessionError,
  NativeSessionNotLoadedError,
  NotificationOutcomeUnknownError,
} from "./notify-session-errors.js";

export {
  NativeSessionDisconnectedError,
  NativeSessionError,
  NativeSessionNotLoadedError,
} from "./notify-session-errors.js";

/** Codex explicitly refused this input before adding it to the turn queue. */
export class NativeTurnNotSubmittedError extends NativeSessionError {
  constructor() {
    super("The active Codex turn cannot accept external output yet.");
  }
}

export function isNativeTurnNotSteerableResponse(error: unknown): boolean {
  const response = record(error);
  return (
    response.code === -32603 &&
    typeof response.message === "string" &&
    /^failed to submit turn input: ActiveTurnNotSteerable \{ turn_kind: (Review|Compact) \}$/.test(
      response.message,
    )
  );
}

export const SESSION_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const failure = () =>
  new NativeSessionError(
    "The native session socket is unavailable or not private. Open the exact session in a terminal with native local-session support enabled, then restart this listener.",
  );
function connectionFailure(error: unknown): NativeSessionError {
  if (error instanceof NativeSessionError) return error;
  if ((error as { code?: unknown } | null)?.code === "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH")
    return new NativeSessionError(
      "The native session sent an oversized response. Update the CLI and resume the exact session before restarting the listener.",
    );
  const message = (error as { message?: unknown } | null)?.message;
  if (
    typeof message === "string" &&
    /^Unexpected server response: (401|403)$/.test(message)
  )
    return new NativeSessionError(
      "The native session rejected the listener connection. Check local session access before restarting the listener.",
    );
  if (
    [
      "ENOENT",
      "ECONNREFUSED",
      "ECONNRESET",
      "EPIPE",
      "ENOTCONN",
      "ETIMEDOUT",
    ].includes((error as NodeJS.ErrnoException | null)?.code ?? "")
  )
    return new NativeSessionDisconnectedError();
  return failure();
}
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

/** Subscribe to a verified loaded thread. The terminal owns approvals and policy. */
export type NativeSessionConnection = {
  close(): void;
  verify?: () => Promise<void>;
  queue(
    text: string,
    receiptId: string,
    beforeDispatch: () => void,
  ): Promise<void>;
};
export async function connectNativeSession(options: {
  threadId: string;
  socketPath?: string;
  signal: AbortSignal;
  timeoutMs?: number;
  onDisconnect?: (error: NativeSessionError) => void;
  expectedCwd?: string;
  onVerifiedCwd?: (cwd: string) => void;
}): Promise<NativeSessionConnection> {
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
  } catch (error) {
    throw connectionFailure(error);
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
      method: string;
      resolve: (result: unknown) => void;
      reject: (error: unknown) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  let closed = false;
  let closeReason: NativeSessionError | undefined;
  let sequence = 0;
  let cwd: string | undefined;
  const close = (reason?: NativeSessionError) => {
    if (closed) return;
    closed = true;
    closeReason = reason;
    options.signal.removeEventListener("abort", abort);
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(reason ?? options.signal.reason ?? failure());
    }
    pending.clear();
    socket.terminate();
    if (reason && !options.signal.aborted) options.onDisconnect?.(reason);
  };
  const abort = () => close();
  options.signal.addEventListener("abort", abort, { once: true });
  socket.on("error", (error) => close(connectionFailure(error)));
  socket.on("close", () => close(new NativeSessionDisconnectedError()));
  socket.on("message", (bytes, binary) => {
    try {
      if (binary) throw failure();
      const message = record(JSON.parse(bytes.toString()));
      // Server requests, including approvals, belong to the terminal. Never answer.
      if (typeof message.method === "string") {
        const params = record(message.params);
        if (
          params.threadId === options.threadId &&
          (message.method === "thread/closed" ||
            (message.method === "thread/status/changed" &&
              record(params.status).type === "notLoaded"))
        )
          close(new NativeSessionNotLoadedError());
        return;
      }
      if (!Number.isSafeInteger(message.id)) throw failure();
      const entry = pending.get(message.id as number);
      if (!entry) return;
      pending.delete(message.id as number);
      clearTimeout(entry.timer);
      if (Object.hasOwn(message, "result") && !Object.hasOwn(message, "error"))
        entry.resolve(message.result);
      else if (
        entry.method === "turn/start" &&
        isNativeTurnNotSteerableResponse(message.error)
      )
        entry.reject(new NativeTurnNotSubmittedError());
      else entry.reject(failure());
    } catch {
      close(failure());
    }
  });
  function request(method: string, params: unknown): Promise<unknown> {
    if (
      closed ||
      options.signal.aborted ||
      socket.readyState !== WebSocket.OPEN
    )
      return Promise.reject(
        closeReason ??
          options.signal.reason ??
          new NativeSessionDisconnectedError(),
      );
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(failure());
      }, timeoutMs);
      pending.set(id, { method, resolve, reject, timer });
      try {
        socket.send(JSON.stringify({ id, method, params }), (error) => {
          if (error) close(connectionFailure(error));
        });
      } catch (error) {
        close(connectionFailure(error));
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
      if (result.nextCursor === null || result.nextCursor === undefined) {
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
    if (!complete) throw failure();
    if (!found) throw new NativeSessionNotLoadedError();
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
      !isAbsolute(thread.cwd)
    )
      throw new NativeSessionError(
        "The exact session cannot accept input or its working directory changed.",
      );
    let verifiedCwd: string;
    try {
      verifiedCwd = await realpath(thread.cwd);
    } catch {
      throw failure();
    }
    if (
      (cwd !== undefined && cwd !== verifiedCwd) ||
      (options.expectedCwd !== undefined && options.expectedCwd !== verifiedCwd)
    )
      throw new NativeSessionError(
        "The exact session working directory changed. Restart the listener explicitly.",
      );
    if (!isDeepStrictEqual(await inspectSessionSocket(socketPath), identity))
      throw failure();
    if (closed || options.signal.aborted)
      throw (
        closeReason ??
        options.signal.reason ??
        new NativeSessionDisconnectedError()
      );
    cwd = verifiedCwd;
    options.onVerifiedCwd?.(verifiedCwd);
  }
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", (error) =>
        reject(closeReason ?? connectionFailure(error)),
      );
      socket.once("close", () =>
        reject(closeReason ?? new NativeSessionDisconnectedError()),
      );
    });
    await request("initialize", {
      clientInfo: { name: "primitive_cli", version: "1" },
      capabilities: { experimentalApi: true },
    });
    socket.send(JSON.stringify({ method: "initialized", params: {} }));
    await verify();
    // Subscribe this connection to the already loaded exact thread so the
    // app server does not unload it when the terminal's subscription ends.
    // No turn is started and no thread configuration is overridden.
    const resumed = record(
      record(
        await request("thread/resume", {
          threadId: options.threadId,
          excludeTurns: true,
        }),
      )
        .thread,
    );
    if (resumed.id !== options.threadId)
      throw new NativeSessionError(
        "The exact session changed while subscribing to native events.",
      );
    await verify();
  } catch (error) {
    close();
    if (error === options.signal.reason) throw error;
    throw connectionFailure(error);
  }
  return {
    close: () => close(),
    verify,
    async queue(text: string, receiptId: string, beforeDispatch: () => void) {
      if (!SESSION_UUID.test(receiptId) || Buffer.byteLength(text) > 16_384)
        throw failure();
      try {
        await verify();
      } catch (error) {
        if (error === options.signal.reason) throw error;
        throw connectionFailure(error);
      }
      // Synchronous durable receipt write belongs immediately before dispatch.
      beforeDispatch();
      try {
        const result = record(
          await request("turn/start", {
            threadId: options.threadId,
            input: [],
            toolOutput: {
              name: "mail_received",
              namespace: "primitive",
              output: text,
            },
          }),
        );
        const turn = record(result.turn);
        if (
          typeof turn.id !== "string" ||
          turn.id.length === 0 ||
          !Array.isArray(turn.items) ||
          typeof turn.status !== "string" ||
          !["completed", "interrupted", "failed", "inProgress"].includes(
            turn.status,
          )
        )
          throw failure();
      } catch (error) {
        if (error instanceof NativeTurnNotSubmittedError) throw error;
        throw new NotificationOutcomeUnknownError(
          "Native notification outcome is unknown; it will not be sent again automatically.",
        );
      }
    },
  };
}
