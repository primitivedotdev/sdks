import { type ChildProcess, spawn } from "node:child_process";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { performance } from "node:perf_hooks";
import type { Readable, Writable } from "node:stream";
import type {
  ListenDelivery,
  ListenHandler,
  ListenHandlerResult,
} from "./listen-types.js";

const HANDLER_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const FORWARDED_HEADERS = new Set([
  "content-type",
  "user-agent",
  "primitive-signature",
  "mymx-signature",
  "x-webhook-event",
  "x-webhook-id",
  "x-primitive-webhook-delivery-id",
  "x-primitive-email-id",
  "x-primitive-endpoint-id",
]);

export type ListenHandlerOptions = {
  exec?: string;
  forwardTo?: string;
  stdout?: Writable;
  stderr?: Writable;
};

export function validateListenHandlerOptions(
  options: ListenHandlerOptions,
): void {
  if (options.exec !== undefined && process.platform === "win32") {
    throw new Error(
      "--exec requires a POSIX shell and process groups. On Windows, use --forward-to with a local HTTP handler.",
    );
  }
  if (options.exec !== undefined && options.forwardTo !== undefined) {
    throw new Error("Choose either --exec or --forward-to.");
  }
  if (
    options.exec !== undefined &&
    (!options.exec.trim() || options.exec.includes("\0"))
  ) {
    throw new Error("--exec requires a nonempty shell command.");
  }
  if (options.forwardTo !== undefined) {
    let url: URL;
    try {
      url = new URL(options.forwardTo);
    } catch {
      throw new Error("--forward-to requires an HTTP or HTTPS URL.");
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.hash
    ) {
      throw new Error(
        "--forward-to requires HTTP or HTTPS without userinfo or a fragment.",
      );
    }
  }
}

/** User hooks retain their configuration, but not the CLI's API credentials. */
function hookEnvironment(delivery: ListenDelivery): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const name of Object.keys(env)) {
    if (
      /^PRIMITIVE_(?:(?:API_|OAUTH_|AUTH_)?(?:KEY|TOKEN|ACCESS_TOKEN|REFRESH_TOKEN)|API_HEADERS|LEASE_TOKEN)$/i.test(
        name,
      )
    ) {
      delete env[name];
    }
  }
  return {
    ...env,
    PRIMITIVE_EVENT_ID: delivery.event_id,
    PRIMITIVE_DELIVERY_ID: delivery.delivery_id,
    PRIMITIVE_EVENT_TYPE: delivery.event_type,
  };
}

async function writeChunk(
  output: Writable,
  chunk: Buffer,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  let onError: (error: Error) => void = () => {};
  let onAbort = () => {};
  let onDrain = () => {};
  let onClose = () => {};
  try {
    await new Promise<void>((resolve, reject) => {
      let callbackDone = false;
      let returned = false;
      let accepted = false;
      let drained = false;
      const finish = () => {
        if (returned && callbackDone && (accepted || drained)) resolve();
      };
      onError = reject;
      onAbort = () => reject(signal.reason);
      onClose = () =>
        reject(new Error("Output closed before accepting the event."));
      onDrain = () => {
        drained = true;
        finish();
      };
      output.on("error", onError);
      output.on("close", onClose);
      output.on("drain", onDrain);
      signal.addEventListener("abort", onAbort, { once: true });
      accepted = output.write(chunk, (error) => {
        if (error) reject(error);
        else {
          callbackDone = true;
          finish();
        }
      });
      returned = true;
      finish();
    });
  } finally {
    output.off("error", onError);
    output.off("close", onClose);
    output.off("drain", onDrain);
    signal.removeEventListener("abort", onAbort);
  }
}

function stopProcessGroup(child: ChildProcess): void {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    /* The group already exited. */
  }
}

class ChildCleanupError extends Error {}

async function reapChild(
  child: ChildProcess,
  closed: Promise<void>,
): Promise<void> {
  stopProcessGroup(child);
  child.stdin?.destroy();
  child.stdout?.destroy();
  child.stderr?.destroy();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      closed,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new ChildCleanupError(
                "The hook did not close after termination. Its delivery remains uncompleted.",
              ),
            ),
          1000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function execute(
  command: string,
  delivery: ListenDelivery,
  stderr: Writable,
  signal: AbortSignal,
): Promise<number | null> {
  signal.throwIfAborted();
  const child = spawn(command, {
    shell: true,
    detached: true,
    env: hookEnvironment(delivery),
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  const closed = new Promise<void>((resolve) =>
    child.once("close", () => resolve()),
  );
  const stop = () => stopProcessGroup(child);
  signal.addEventListener("abort", stop, { once: true });
  const consume = async (stream: Readable) => {
    for await (const chunk of stream) {
      await writeChunk(
        stderr,
        Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
        signal,
      );
    }
  };
  // Close stdio and reap descendants even if the shell exited successfully.
  child.once("exit", stop);
  try {
    const exited = new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code) => resolve(code));
    });
    const stdin = writeChunk(
      child.stdin,
      Buffer.from(delivery.body, "utf8"),
      signal,
    ).then(() => child.stdin.end());
    const [code] = await Promise.all([
      exited,
      stdin,
      consume(child.stdout),
      consume(child.stderr),
    ]);
    signal.throwIfAborted();
    return code;
  } finally {
    try {
      await reapChild(child, closed);
    } finally {
      signal.removeEventListener("abort", stop);
    }
  }
}

function structuredErrorCode(body: string): string | undefined {
  try {
    const value: unknown = JSON.parse(body);
    if (typeof value !== "object" || value === null) return undefined;
    const object = value as Record<string, unknown>;
    const nested =
      typeof object.error === "object" && object.error !== null
        ? (object.error as Record<string, unknown>).code
        : undefined;
    const code = typeof nested === "string" ? nested : object.code;
    return typeof code === "string" && /^[a-z][a-z0-9_]{0,63}$/.test(code)
      ? code
      : undefined;
  } catch {
    return undefined;
  }
}

class ForwardFailure extends Error {
  constructor(
    readonly statusCode: number | null,
    readonly transportError: "network" | "io" | "response_too_large",
  ) {
    super("Webhook transport did not complete.");
  }
}

async function forward(
  target: string,
  delivery: ListenDelivery,
  signal: AbortSignal,
): Promise<{ status: number; confirmed: boolean; errorCode?: string }> {
  signal.throwIfAborted();
  const url = new URL(target);
  const body = Buffer.from(delivery.body, "utf8");
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(delivery.headers)) {
    if (FORWARDED_HEADERS.has(name.toLowerCase()))
      headers[name.toLowerCase()] = value;
  }
  headers["content-length"] = String(body.length);
  return new Promise((resolve, reject) => {
    let observedStatus: number | null = null;
    let settled = false;
    const fail = (
      kind: "network" | "io" | "response_too_large" = observedStatus === null
        ? "network"
        : "io",
    ) => {
      if (settled) return;
      settled = true;
      reject(new ForwardFailure(observedStatus, kind));
    };
    // No redirect, proxy credential, cookie or caller API-header inheritance.
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(
      url,
      {
        method: "POST",
        headers,
        signal,
        rejectUnauthorized: true,
      },
      (response) => {
        observedStatus = response.statusCode ?? null;
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("error", () => fail());
        response.on("aborted", () => fail());
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_RESPONSE_BYTES) {
            // Fix the evidence before destroy emits aborted/error callbacks.
            fail("response_too_large");
            request.destroy();
          } else chunks.push(chunk);
        });
        response.on("end", () => {
          if (settled) return;
          if (!response.complete || size > MAX_RESPONSE_BYTES) {
            fail(size > MAX_RESPONSE_BYTES ? "response_too_large" : "io");
            return;
          }
          settled = true;
          const status = response.statusCode ?? 0;
          const succeeded = status >= 200 && status < 300;
          resolve({
            status,
            confirmed:
              succeeded &&
              (response.headers["x-primitive-confirmed"] === "true" ||
                response.headers["x-mymx-confirmed"] === "true"),
            errorCode: succeeded
              ? undefined
              : status >= 300 && status < 400
                ? "handler_redirect"
                : (structuredErrorCode(
                    Buffer.concat(chunks).toString("utf8"),
                  ) ??
                  (status >= 400 && status < 500
                    ? "handler_4xx"
                    : status >= 500
                      ? "handler_5xx"
                      : "unknown_error")),
          });
        });
      },
    );
    request.on("error", () => fail());
    request.end(body);
  });
}

function jsonLine(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body));
  } catch {
    throw new Error("Webhook body is not valid JSON.");
  }
}

export function createListenHandler(
  options: ListenHandlerOptions = {},
): ListenHandler {
  validateListenHandlerOptions(options);
  return async (delivery, signal): Promise<ListenHandlerResult> => {
    signal.throwIfAborted();
    const start = performance.now();
    const work = new AbortController();
    let timedOut = false;
    const cancel = () => work.abort(signal.reason);
    signal.addEventListener("abort", cancel, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      work.abort(new Error("Event handler timed out."));
    }, HANDLER_TIMEOUT_MS);
    const duration = () =>
      Math.min(
        HANDLER_TIMEOUT_MS,
        Math.max(0, Math.round(performance.now() - start)),
      );
    try {
      if (options.exec !== undefined) {
        const code = await execute(
          options.exec,
          delivery,
          options.stderr ?? process.stderr,
          work.signal,
        );
        signal.throwIfAborted();
        return {
          succeeded: code === 0,
          outcome: { mode: "exec", exit_code: code, duration_ms: duration() },
        };
      }
      if (options.forwardTo !== undefined) {
        const response = await forward(
          options.forwardTo,
          delivery,
          work.signal,
        );
        signal.throwIfAborted();
        return {
          succeeded: response.status >= 200 && response.status < 300,
          outcome: {
            mode: "http",
            status_code: response.status,
            confirmed: response.confirmed,
            duration_ms: duration(),
            ...(response.errorCode ? { error_code: response.errorCode } : {}),
          },
        };
      }
      await writeChunk(
        options.stdout ?? process.stdout,
        Buffer.from(`${jsonLine(delivery.body)}\n`, "utf8"),
        work.signal,
      );
      signal.throwIfAborted();
      return {
        succeeded: true,
        outcome: {
          mode: "stdout",
          write_succeeded: true,
          duration_ms: duration(),
        },
      };
    } catch (error) {
      signal.throwIfAborted();
      if (error instanceof ChildCleanupError) throw error;
      if (options.exec !== undefined)
        return {
          succeeded: false,
          outcome: {
            mode: "exec",
            exit_code: null,
            transport_error: timedOut ? "timeout" : "io",
            duration_ms: duration(),
          },
        };
      if (options.forwardTo !== undefined)
        return {
          succeeded: false,
          outcome: {
            mode: "http",
            status_code:
              error instanceof ForwardFailure ? error.statusCode : null,
            confirmed: false,
            transport_error: timedOut
              ? "timeout"
              : error instanceof ForwardFailure
                ? error.transportError
                : "network",
            duration_ms: duration(),
          },
        };
      // A broken JSONL pipe must stop receiving, never acknowledge unseen input.
      throw error;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      work.abort();
    }
  };
}
