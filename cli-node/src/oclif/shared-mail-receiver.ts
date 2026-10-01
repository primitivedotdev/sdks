import { scryptSync } from "node:crypto";
import type { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { listenIdentity } from "./listen-state.js";
import { openSharedMailStore } from "./shared-mail-state.js";
import { runSharedMailTransport } from "./shared-mail-transport.js";
import {
  readSharedMailOwner,
  tryOwnSharedMail,
  waitForSharedMailChange,
} from "./shared-mail-watch.js";

export function sharedMailScope(
  apiKey: string | undefined,
  baseUrl: string,
): string {
  if (!apiKey?.startsWith("pconn_"))
    throw new Error("Shared mail receiving requires connected credentials.");
  return listenIdentity(
    baseUrl,
    `connection:${scryptSync(apiKey, "primitive-listener-identity-v1", 32).toString("hex")}`,
  );
}

/** Join locally, or own the stable remote subscription while this command lives. */
export async function openSharedMailReceiver(options: {
  configDir: string;
  apiClient: PrimitiveApiClient;
  apiKey: string | undefined;
  baseUrl: string;
  recipient: string;
  signal?: AbortSignal;
  deadline?: number | null;
}) {
  const scope = sharedMailScope(options.apiKey, options.baseUrl);
  const stopping = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = () => {
    if (options.deadline == null) return;
    const remaining = Math.max(0, options.deadline - Date.now());
    timer = setTimeout(
      remaining > 2 ** 31 - 1
        ? arm
        : () =>
            stopping.abort(
              new DOMException("Mail wait timed out", "TimeoutError"),
            ),
      Math.min(remaining, 2 ** 31 - 1),
    );
  };
  if (options.deadline != null && Date.now() >= options.deadline)
    stopping.abort(new DOMException("Mail wait timed out", "TimeoutError"));
  else arm();
  const signal = AbortSignal.any([
    stopping.signal,
    ...(options.signal ? [options.signal] : []),
  ]);
  const store = await openSharedMailStore({
    configDir: options.configDir,
    scope,
    recipient: options.recipient,
    signal,
  }).catch((error: unknown) => {
    clearTimeout(timer);
    throw error;
  });
  let failure: unknown;
  let cleanupFailure: unknown;
  let active: Promise<void> | undefined;
  function ensureOwner() {
    signal.throwIfAborted();
    if (failure !== undefined) throw failure;
    const current = readSharedMailOwner(store);
    if (current?.alive || active) return current;
    const owner = tryOwnSharedMail(store);
    if (!owner) return readSharedMailOwner(store);
    active = runSharedMailTransport({
      apiClient: options.apiClient,
      subscription: store.subscriptionName,
      recipient: store.recipient,
      signal,
      ready: async () => {
        owner.markReady();
      },
      checked: async () => {
        owner.markChecked();
      },
      status: async (status) => {
        owner.markStatus(status);
      },
      ingest: async (event) => {
        await store.ingest(event);
      },
    })
      .catch((error: unknown) => {
        if (!signal.aborted) failure = error;
      })
      .finally(() => {
        try {
          owner.close();
        } catch (error) {
          cleanupFailure = error;
          failure ??= error;
        } finally {
          active = undefined;
        }
      });
    return readSharedMailOwner(store);
  }
  function watch(deadline?: number | null) {
    const stop = new AbortController();
    const promise = waitForSharedMailChange(store, {
      signal: AbortSignal.any([signal, stop.signal]),
      timeoutMs:
        deadline == null
          ? 1000
          : Math.max(1, Math.min(1000, deadline - Date.now())),
    });
    // A successful state read cancels the already-installed watcher.
    void promise.catch(() => {});
    return { promise, close: () => stop.abort() };
  }
  return {
    store,
    signal,
    status: () => readSharedMailOwner(store),
    async ready(deadline?: number | null) {
      while (deadline == null || Date.now() < deadline) {
        const watching = watch(deadline);
        try {
          const owner = ensureOwner();
          if (owner?.alive && owner.ready) return owner;
          await watching.promise;
        } finally {
          watching.close();
        }
      }
      return null;
    },
    async changed(deadline?: number | null) {
      const watching = watch(deadline);
      try {
        ensureOwner();
        await watching.promise;
      } finally {
        watching.close();
      }
      if (failure !== undefined) throw failure;
    },
    async close() {
      clearTimeout(timer);
      stopping.abort();
      await active;
      if (cleanupFailure !== undefined) throw cleanupFailure;
    },
  };
}
export type SharedMailReceiver = Awaited<
  ReturnType<typeof openSharedMailReceiver>
>;
