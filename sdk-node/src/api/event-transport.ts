import {
  type CompleteWebhookInput,
  completeWebhookEvent,
  getAccount,
  type PrimitiveApiClient,
  type PullWebhookResponse,
  pullWebhookEvent,
} from "@primitivedotdev/api-core";

export type EventOffer = PullWebhookResponse["data"];
export type EventDelivery = NonNullable<EventOffer["delivery"]>;
export type EventSocketFactory = (url: string, protocol: string) => WebSocket;
export class EventReceiverError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 0,
    readonly retryAfterMs = 0,
  ) {
    super(message);
    this.name = "EventReceiverError";
  }
}
export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function validateOffer(value: unknown): EventOffer {
  if (
    !record(value) ||
    !Number.isSafeInteger(value.backlog) ||
    Number(value.backlog) < 0 ||
    !Number.isSafeInteger(value.gap_count) ||
    Number(value.gap_count) < 0 ||
    (value.last_gap_reason !== null &&
      typeof value.last_gap_reason !== "string") ||
    value.retention_seconds !== 86400 ||
    value.handler_timeout_seconds !== 30
  ) {
    throw new EventReceiverError(
      "Invalid event status response",
      "invalid_response",
    );
  }
  const d = value.delivery;
  if (
    d !== null &&
    (!record(d) ||
      ![
        "queue_id",
        "event_id",
        "delivery_id",
        "lease_token",
        "event_type",
        "body",
        "lease_expires_at",
      ].every((key) => typeof d[key] === "string") ||
      !Number.isFinite(Date.parse(String(d.lease_expires_at))) ||
      !record(d.headers) ||
      !Object.values(d.headers).every((header) => typeof header === "string"))
  ) {
    throw new EventReceiverError(
      "Invalid event delivery response",
      "invalid_response",
    );
  }
  return value as EventOffer;
}
export function retryAfter(value: string | null): number {
  if (!value) return 0;
  const ms = /^\d+(\.\d+)?$/.test(value)
    ? Number(value) * 1000
    : Date.parse(value) - Date.now();
  return Number.isFinite(ms) ? Math.max(0, ms) : 0;
}
export function unwrap<T>(result: {
  data?: T;
  error?: unknown;
  response?: Response;
}): T {
  if (result.data !== undefined && !result.error) return result.data;
  const code =
    record(result.error) &&
    record(result.error.error) &&
    typeof result.error.error.code === "string"
      ? result.error.error.code
      : "request_failed";
  throw new EventReceiverError(
    `Event request failed (${result.response?.status ?? 0}, ${code})`,
    code,
    result.response?.status ?? 0,
    retryAfter(result.response?.headers.get("retry-after") ?? null),
  );
}
export function delay(ms: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(
      () => {
        signal.removeEventListener("abort", abort);
        resolve();
      },
      Math.min(ms, 2_147_483_647),
    );
    signal.addEventListener("abort", abort, { once: true });
  });
}
export async function eventRetry<T>(
  operation: () => Promise<T>,
  signal: AbortSignal,
  onRetry?: () => void,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();
    try {
      return await operation();
    } catch (error) {
      signal.throwIfAborted();
      if (
        error instanceof EventReceiverError &&
        (!([0, 408, 429].includes(error.status) || error.status >= 500) ||
          [
            "invalid_response",
            "unsupported",
            "pull_unavailable",
            "subscription_unavailable",
          ].includes(error.code))
      )
        throw error;
      if (!(error instanceof EventReceiverError)) throw error;
      onRetry?.();
      await delay(
        Math.max(
          error instanceof EventReceiverError ? error.retryAfterMs : 0,
          Math.min(10000, 250 * 2 ** Math.min(attempt, 6)) *
            (0.8 + Math.random() * 0.4),
        ),
        signal,
      );
    }
  }
}

/** Shared by the SDK and CLI. Completion retries preserve the original evidence. */
export class EventConnection {
  private socket?: WebSocket;
  private pending?: {
    resolve(value: unknown): void;
    reject(error: unknown): void;
  };
  private accountId?: string;
  private touch?: () => void;
  constructor(
    private readonly client: PrimitiveApiClient["client"],
    readonly endpointId: string,
    private readonly options: {
      transport?: "websocket" | "poll";
      webSocketFactory?: EventSocketFactory;
      onStatus?: (status: EventOffer) => void;
    } = {},
  ) {}

  close(): void {
    const socket = this.socket;
    this.socket = undefined;
    this.pending?.reject(
      new EventReceiverError("Event connection closed", "disconnected"),
    );
    this.pending = undefined;
    socket?.close();
  }
  async open(signal: AbortSignal): Promise<void> {
    if (this.options.transport === "poll" || this.socket?.readyState === 1)
      return;
    const account = unwrap(
      await getAccount({
        client: this.client,
        responseStyle: "fields",
        throwOnError: false,
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      }),
    );
    if (
      !account.data?.id ||
      (this.accountId && account.data.id !== this.accountId)
    )
      throw new EventReceiverError(
        "The authenticated account changed; restart the receiver",
        "identity_changed",
        403,
      );
    this.accountId = account.data.id;
    const config = this.client.getConfig();
    const auth =
      typeof config.auth === "function"
        ? await config.auth({ type: "http", scheme: "bearer" })
        : config.auth;
    const authorization = new Headers(config.headers as HeadersInit).get(
      "authorization",
    );
    const token =
      typeof auth === "string"
        ? auth.replace(/^Bearer /i, "")
        : authorization?.replace(/^Bearer /i, "");
    if (!token)
      throw new EventReceiverError(
        "Event receiver requires bearer credentials",
        "unauthorized",
        401,
      );
    const url = new URL(
      `${config.baseUrl?.replace(/\/+$/, "")}/endpoints/${encodeURIComponent(this.endpointId)}/stream`,
    );
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      )
    )
      throw new EventReceiverError(
        "Event connections require HTTPS (except loopback development)",
        "unsupported",
      );
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const socket = (
      this.options.webSocketFactory ??
      ((address, protocol) => new WebSocket(address, protocol))
    )(url.href, "primitive.events.v1");
    this.socket = socket;
    socket.addEventListener("message", (message) => {
      if (this.socket !== socket) return;
      let frame: unknown;
      try {
        frame = JSON.parse(String(message.data));
      } catch {
        this.fail(
          new EventReceiverError("Invalid event frame", "invalid_response"),
        );
        return;
      }
      this.touch?.();
      if (!record(frame)) {
        this.fail(
          new EventReceiverError("Invalid event frame", "invalid_response"),
        );
        return;
      }
      if (frame.type === "ping") {
        socket.send(JSON.stringify({ type: "pong" }));
        return;
      }
      if (frame.type === "status") {
        try {
          this.options.onStatus?.(validateOffer(frame.data));
        } catch (error) {
          this.fail(error);
        }
        return;
      }
      if (frame.type === "error") {
        this.fail(
          new EventReceiverError(
            "Event stream request failed",
            typeof frame.code === "string" ? frame.code : "request_failed",
            typeof frame.status === "number" ? frame.status : 0,
            retryAfter(
              typeof frame.retry_after === "string" ? frame.retry_after : null,
            ),
          ),
        );
        return;
      }
      this.pending?.resolve(frame);
    });
    socket.addEventListener("close", () => {
      if (this.socket === socket)
        this.fail(
          new EventReceiverError("Event stream disconnected", "disconnected"),
        );
    });
    socket.addEventListener("error", () => {
      if (this.socket === socket)
        this.fail(
          new EventReceiverError(
            "Event stream connection failed",
            "disconnected",
          ),
        );
    });
    const ready = await this.exchange(
      signal,
      undefined,
      () => {
        socket.addEventListener(
          "open",
          () => socket.send(JSON.stringify({ type: "authenticate", token })),
          { once: true },
        );
      },
      15000,
    );
    if (
      !record(ready) ||
      ready.type !== "ready" ||
      ready.protocol !== "primitive.events.v1"
    ) {
      this.close();
      throw new EventReceiverError(
        "Unsupported event stream protocol",
        "unsupported",
      );
    }
  }
  private fail(error: unknown): void {
    this.pending?.reject(error);
    this.pending = undefined;
    this.close();
  }
  private async exchange(
    signal: AbortSignal,
    frame?: unknown,
    start?: () => void,
    timeoutMs = 60000,
  ): Promise<unknown> {
    signal.throwIfAborted();
    if (this.pending)
      throw new EventReceiverError("Concurrent event operation", "busy", 409);
    let cleanup = () => {};
    try {
      return await new Promise((resolve, reject) => {
        const abort = () => {
          reject(signal.reason);
          this.close();
        };
        let timer: ReturnType<typeof setTimeout>;
        this.touch = () => {
          clearTimeout(timer);
          timer = setTimeout(
            () =>
              this.fail(
                new EventReceiverError(
                  "Event stream timed out",
                  "disconnected",
                ),
              ),
            timeoutMs,
          );
        };
        this.touch();
        cleanup = () => {
          this.touch = undefined;
          clearTimeout(timer);
          signal.removeEventListener("abort", abort);
          this.pending = undefined;
        };
        this.pending = { resolve, reject };
        signal.addEventListener("abort", abort, { once: true });
        if (frame) this.socket?.send(JSON.stringify(frame));
        start?.();
      });
    } finally {
      cleanup();
    }
  }
  async receive(signal: AbortSignal): Promise<EventOffer> {
    if (this.options.transport === "poll") {
      const result = unwrap(
        await pullWebhookEvent({
          client: this.client,
          path: { id: this.endpointId },
          body: { wait_seconds: 25 },
          responseStyle: "fields",
          throwOnError: false,
          signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]),
        }),
      );
      return validateOffer(result.data);
    }
    await this.open(signal);
    // Status frames keep an idle receive alive. The server pings every 20s;
    // a generous receive timeout bounds half-open connections without polling.
    const frame = await this.exchange(
      signal,
      { type: "receive" },
      undefined,
      90000,
    );
    if (!record(frame) || frame.type !== "event")
      throw new EventReceiverError("Invalid event frame", "invalid_response");
    return validateOffer(frame.data);
  }
  async complete(
    body: CompleteWebhookInput,
    signal: AbortSignal,
  ): Promise<void> {
    let receipt: unknown;
    if (this.options.transport === "poll") {
      receipt = unwrap(
        await completeWebhookEvent({
          client: this.client,
          path: { id: this.endpointId },
          body,
          responseStyle: "fields",
          throwOnError: false,
          signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
        }),
      ).data;
    } else {
      await this.open(signal);
      const frame = await this.exchange(
        signal,
        { type: "complete", body },
        undefined,
        15000,
      );
      if (!record(frame) || frame.type !== "receipt")
        throw new EventReceiverError(
          "Invalid event receipt",
          "invalid_response",
        );
      receipt = frame.data;
    }
    if (
      !record(receipt) ||
      !["completed", "already_completed"].includes(String(receipt.result))
    )
      throw new EventReceiverError("Invalid event receipt", "invalid_response");
  }
}
