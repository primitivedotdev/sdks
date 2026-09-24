import { createHash } from "node:crypto";
import {
  completeWebhookEvent,
  createEndpoint,
  getAccount,
  type PrimitiveApiClient,
  pullWebhookEvent,
} from "@primitivedotdev/api-core";
import { EventConnection, EventReceiverError } from "@primitivedotdev/sdk/api";
import { createAuthenticatedCliApiClient } from "./api-client.js";
import {
  listenIdentity,
  normalizeListenOrigin,
  resolveListenSubscription,
} from "./listen-state.js";
import type { ListenDelivery, ListenHandler } from "./listen-types.js";

export class ListenError extends Error {}
class RequestFailure extends ListenError {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly retryAfter: number,
  ) {
    super(
      status === 401 || status === 403
        ? "Listener authorization failed. Run primitive signin or check your API key and account permissions."
        : status === 409 && code === "subscription_conflict"
          ? "This subscription has different event filters. Omit --events to resume it, or use primitive listen --subscription new-subscription (add your --events selection)."
          : `Listener API request failed (HTTP ${status || "transport"}, ${code}).`,
    );
  }
}
type ApiResult<T> = { data?: T; error?: unknown; response?: Response };
type Client = PrimitiveApiClient["client"];
export interface ListenOptions {
  configDir: string;
  transport?: "websocket" | "poll";
  apiKey?: string;
  apiBaseUrl?: string;
  subscription?: string;
  events?: string[];
  number?: number;
  handler: ListenHandler;
  mode?: "exec" | "http" | "stdout";
  signal: AbortSignal;
  stderr?: { write(value: string): unknown };
  now?: () => number;
  random?: () => number;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}

export async function listenSleep(
  ms: number,
  signal: AbortSignal,
): Promise<void> {
  let remaining = ms;
  while (remaining > 0) {
    const chunk = Math.min(remaining, 60_000);
    await sleepChunk(chunk, signal);
    remaining -= chunk;
  }
}

function sleepChunk(ms: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const aborted = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", aborted);
      resolve();
    }, ms);
    signal.addEventListener("abort", aborted, { once: true });
  });
}
function failure(result: ApiResult<unknown>, now: number): RequestFailure {
  const error = result.error as { error?: { code?: unknown } } | undefined;
  const code =
    typeof error?.error?.code === "string" &&
    /^[a-z0-9_]{1,80}$/.test(error.error.code)
      ? error.error.code
      : "invalid_response";
  const retry = result.response?.headers.get("retry-after");
  const retryAfter = retry
    ? /^\d+$/.test(retry)
      ? Number(retry) * 1000
      : Date.parse(retry) - now
    : 0;
  return new RequestFailure(
    result.response?.status ?? 0,
    code,
    Number.isFinite(retryAfter) ? Math.max(0, retryAfter) : 0,
  );
}
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function validDelivery(value: unknown): value is ListenDelivery {
  if (!value || typeof value !== "object") return false;
  const d = value as Record<string, unknown>;
  return (
    ["queue_id", "event_id", "delivery_id"].every(
      (key) => typeof d[key] === "string" && UUID.test(d[key] as string),
    ) &&
    ["event_type", "lease_token", "body"].every(
      (key) =>
        typeof d[key] === "string" &&
        (key === "body" || (d[key] as string).length > 0),
    ) &&
    typeof d.lease_expires_at === "string" &&
    Number.isFinite(Date.parse(d.lease_expires_at)) &&
    typeof d.headers === "object" &&
    d.headers !== null &&
    !Array.isArray(d.headers) &&
    Object.values(d.headers).every((value) => typeof value === "string")
  );
}

export async function runListen(options: ListenOptions): Promise<number> {
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const sleep = options.sleep ?? listenSleep;
  const stderr = options.stderr ?? process.stderr;
  const signal = options.signal;
  if (
    options.number !== undefined &&
    (!Number.isSafeInteger(options.number) || options.number < 1)
  )
    throw new ListenError("--number must be a positive integer.");
  let origin: string | undefined;
  let accountId: string | undefined;
  let verifiedKey: string | undefined;
  let verified = false;
  let confirmed = 0;
  let release: (() => void) | undefined;
  let stream: EventConnection | undefined;

  async function retry<T>(operation: () => Promise<ApiResult<T>>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      signal.throwIfAborted();
      let error: RequestFailure;
      try {
        const result = await operation();
        if (result.data !== undefined && !result.error) return result.data;
        error = failure(result, now());
      } catch (caught) {
        if (signal.aborted) throw signal.reason;
        if (caught instanceof EventReceiverError) {
          if (["invalid_response", "unsupported"].includes(caught.code))
            throw new ListenError(caught.message);
          error = new RequestFailure(
            caught.status,
            caught.code,
            caught.retryAfterMs,
          );
        } else {
          if (caught instanceof ListenError) throw caught;
          if (caught instanceof SyntaxError)
            throw new ListenError("The API returned malformed JSON.");
          // Exceptions may contain credentials, URLs, or body data. Never display them.
          error = new RequestFailure(0, "transport", 0);
        }
      }
      if (
        ![0, 408, 429].includes(error.status) &&
        !(error.status >= 500 && error.status <= 599)
      )
        throw error;
      stderr.write("Connection interrupted; retrying the same operation.\n");
      const jitter =
        Math.min(10_000, 250 * 2 ** Math.min(attempt, 6)) *
        (0.8 + random() * 0.4);
      await sleep(Math.max(error.retryAfter, jitter), signal);
    }
  }
  async function freshClient(): Promise<Client> {
    let auth: Awaited<ReturnType<typeof createAuthenticatedCliApiClient>>;
    try {
      auth = await createAuthenticatedCliApiClient({
        configDir: options.configDir,
        apiKey: options.apiKey,
        apiBaseUrl: options.apiBaseUrl,
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: AbortSignal.any([
              signal,
              ...(init?.signal ? [init.signal] : []),
              AbortSignal.timeout(45_000),
            ]),
          }),
      });
    } catch {
      throw new ListenError(
        "Could not refresh listener credentials. Run primitive signin and retry.",
      );
    }
    const base = normalizeListenOrigin(auth.auth.apiBaseUrl);
    if (origin !== undefined && origin !== base)
      throw new ListenError(
        "The API environment changed while listening. Restart the listener.",
      );
    origin = base;
    if (!verified || auth.auth.apiKey !== verifiedKey) {
      if (auth.auth.apiKey.startsWith("pconn_")) {
        // Connected credentials cannot read account settings. Keep local state
        // private to this credential; registration and every receive authenticate
        // it on the server before any event is returned.
        const identity = `connection:${createHash("sha256").update(auth.auth.apiKey).digest("hex")}`;
        if (accountId !== undefined && accountId !== identity)
          throw new ListenError(
            "The connected credential changed while listening. Restart the listener.",
          );
        accountId = identity;
        verifiedKey = auth.auth.apiKey;
        verified = true;
        return auth.apiClient.client;
      }
      const account = await retry(() =>
        getAccount({
          client: auth.apiClient.client,
          responseStyle: "fields",
          signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
        }),
      );
      if (account.success !== true || typeof account.data?.id !== "string")
        throw new ListenError("The API returned an invalid account response.");
      if (accountId !== undefined && accountId !== account.data.id)
        throw new ListenError(
          "The authenticated account changed while listening. Restart the listener.",
        );
      accountId = account.data.id;
      verifiedKey = auth.auth.apiKey;
      verified = true;
    }
    return auth.apiClient.client;
  }

  try {
    await freshClient();
    signal.throwIfAborted();
    if (!origin || !accountId)
      throw new ListenError("The API returned no account identity.");
    const subscription = resolveListenSubscription(
      options.configDir,
      listenIdentity(origin, accountId),
      options.subscription,
    );
    release = subscription.release;
    let resumed = true;
    const registered = await retry(async () => {
      const result = await createEndpoint({
        client: await freshClient(),
        responseStyle: "fields",
        signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
        body: {
          kind: "pull",
          name: subscription.name,
          ...(options.events === undefined
            ? {}
            : { rules: { event_types: options.events } }),
        },
      });
      if (result.response?.ok) resumed = result.response.status !== 201;
      return result;
    });
    const endpoint = registered.data;
    if (
      registered.success !== true ||
      !endpoint ||
      typeof endpoint.id !== "string" ||
      endpoint.kind !== "pull" ||
      endpoint.enabled === false
    )
      throw new ListenError(
        "The API did not return an enabled pull subscription.",
      );
    const streamClient = await freshClient();
    if (options.transport !== "poll") {
      if (
        !endpoint.receiver_capabilities?.stream_protocols.includes(
          "primitive.events.v1",
        )
      )
        throw new ListenError(
          "This API does not support WebSocket events. Use --transport poll explicitly for an older API.",
        );
      if (
        !endpoint.receiver_capabilities.completion_modes.includes(
          options.mode ?? "stdout",
        )
      )
        throw new ListenError(
          "This API does not support the selected listener handler mode.",
        );
      stream = new EventConnection(streamClient, endpoint.id);
    }
    const selected = endpoint.rules?.event_types;
    const selection =
      Array.isArray(selected) &&
      selected.every(
        (value) => typeof value === "string" && /^[a-zA-Z0-9_.-]+$/.test(value),
      )
        ? selected.join(", ")
        : "all events";
    stderr.write(
      `Listening on subscription ${subscription.name} (${endpoint.id}); ${resumed ? "resumed" : "created"}, mode ${options.mode ?? "stdout"}, selection: ${selection}. Retention: 24 hours; handler limit: 30 seconds. Pending count follows the first poll. Ctrl-C disconnects; delete with primitive endpoints delete --id ${endpoint.id}.\n`,
    );
    let lastGap = -1;
    let lastBacklog = -1;
    while (
      !signal.aborted &&
      (options.number === undefined || confirmed < options.number)
    ) {
      const pollStarted = now();
      const result = await retry(async () => {
        if (stream) {
          streamClient.setConfig((await freshClient()).getConfig());
          return {
            data: {
              success: true as const,
              data: await stream.receive(signal),
            },
          };
        }
        return pullWebhookEvent({
          client: await freshClient(),
          path: { id: endpoint.id },
          body: { wait_seconds: 25 },
          responseStyle: "fields",
          signal: AbortSignal.any([signal, AbortSignal.timeout(45_000)]),
        });
      });
      if (
        result.success !== true ||
        !result.data ||
        !Number.isSafeInteger(result.data.gap_count) ||
        result.data.gap_count < 0 ||
        (result.data.last_gap_reason !== null &&
          typeof result.data.last_gap_reason !== "string") ||
        !Number.isSafeInteger(result.data.backlog) ||
        result.data.backlog < 0 ||
        result.data.handler_timeout_seconds !== 30 ||
        result.data.retention_seconds !== 86400
      )
        throw new ListenError("The API returned an invalid pull response.");
      const data = result.data;
      const gapReasons: Record<string, string> = {
        retention_expired: "24-hour retention expired",
        content_unavailable: "source content was discarded or is unavailable",
        event_deleted: "source event was deleted",
        capacity_exceeded: "pending event capacity exceeded",
        delivery_failed: "delivery retries exhausted",
      };
      const gapReason =
        data.last_gap_reason !== null &&
        Object.hasOwn(gapReasons, data.last_gap_reason)
          ? gapReasons[data.last_gap_reason]
          : "reason unavailable";
      if (data.gap_count > 0 && data.gap_count !== lastGap)
        stderr.write(
          `Warning: subscription reports ${data.gap_count} lost events (${gapReason}). Inspect the subscription before relying on complete history.\n`,
        );
      lastGap = data.gap_count;
      if (data.backlog !== lastBacklog)
        stderr.write(`Pending events: ${data.backlog}.\n`);
      lastBacklog = data.backlog;
      if (data.delivery === null) {
        const elapsed = now() - pollStarted;
        if (elapsed < 250) await sleep(250 - elapsed, signal);
        continue;
      }
      if (!validDelivery(data.delivery))
        throw new ListenError("The API returned an invalid delivery.");
      const delivery = data.delivery;
      if (Date.parse(delivery.lease_expires_at) - now() < 35_000) {
        stderr.write(
          "Delivery lease is too short to start safely; waiting for redelivery.\n",
        );
        await sleep(1000, signal);
        continue;
      }
      signal.throwIfAborted();
      let handled: Awaited<ReturnType<ListenHandler>>;
      try {
        handled = await options.handler(delivery, signal);
      } catch {
        if (signal.aborted) throw signal.reason;
        throw new ListenError(
          "The event handler did not finish. Its delivery remains uncompleted.",
        );
      }
      signal.throwIfAborted();
      const completion = {
        ...handled.outcome,
        queue_id: delivery.queue_id,
        delivery_id: delivery.delivery_id,
        lease_token: delivery.lease_token,
      };
      try {
        // Keep this evidence in memory until confirmed. Never rerun the hook to retry an acknowledgement.
        const receipt = await retry(async () => {
          if (stream) {
            streamClient.setConfig((await freshClient()).getConfig());
            await stream.complete(completion, signal);
            return {
              data: {
                success: true as const,
                data: { result: "completed" as const },
              },
            };
          }
          return completeWebhookEvent({
            client: await freshClient(),
            path: { id: endpoint.id },
            body: completion,
            responseStyle: "fields",
            signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
          });
        });
        if (
          receipt.success !== true ||
          !["completed", "already_completed"].includes(receipt.data?.result)
        )
          throw new ListenError(
            "The API returned an invalid completion receipt.",
          );
        if (handled.succeeded) confirmed++;
        else
          stderr.write(
            "Handler reported failure; the server will apply its retry policy.\n",
          );
      } catch (error) {
        if (
          !(error instanceof RequestFailure) ||
          error.status !== 409 ||
          error.code !== "stale_delivery"
        )
          throw error;
        stderr.write(
          "Delivery ownership expired before confirmation; it may be delivered again.\n",
        );
      }
    }
  } catch (error) {
    if (!signal.aborted) throw error;
  } finally {
    stream?.close();
    release?.();
  }
  return confirmed;
}
