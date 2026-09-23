import {
  type CompleteWebhookInput,
  createEndpoint,
  PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import type { KnownWebhookEvent, WebhookEvent } from "../types.js";
import { parseWebhookEvent } from "../webhook/parse-event.js";
import {
  delay,
  EventConnection,
  type EventDelivery,
  type EventOffer,
  EventReceiverError,
  type EventSocketFactory,
  eventRetry,
  unwrap,
} from "./event-transport.js";

export type {
  EventDelivery,
  EventOffer,
  EventSocketFactory,
} from "./event-transport.js";
export { EventConnection, EventReceiverError } from "./event-transport.js";
export type LocalEvent<T extends string = string> = {
  id: string;
  type: T;
  body: string;
  headers: Readonly<Record<string, string>>;
  data: string extends T
    ? WebhookEvent
    : Extract<KnownWebhookEvent, { event: T }> extends never
      ? WebhookEvent
      : Extract<KnownWebhookEvent, { event: T }>;
};
export type EventStatus = {
  type: "ready" | "reconnecting" | "handler_error" | "gap" | "closed";
  backlog?: number;
  gapCount?: number;
  lastGapReason?: string | null;
  error?: unknown;
};
export interface EventListenOptions<T extends string = string> {
  subscription: string;
  events?: readonly T[];
  signal?: AbortSignal;
  transport?: "websocket" | "poll";
  webSocketFactory?: EventSocketFactory;
  onStatus?: (status: EventStatus) => void;
  onGap?: "report" | "error";
}
export interface EventWaitOptions<T extends string = string>
  extends EventListenOptions<T> {
  timeoutMs?: number;
}
export interface EventListener {
  closed: Promise<void>;
  close(): Promise<void>;
  readonly status: EventStatus;
}
export interface PendingEvent<T extends string = string> {
  event: LocalEvent<T>;
  signal: AbortSignal;
  ack(): Promise<void>;
  retry(): Promise<void>;
}
export class DeliveryExpired extends EventReceiverError {
  constructor() {
    super(
      "Event acceptance deadline expired; the event may be delivered again",
      "delivery_expired",
      409,
    );
  }
}

function validate(options: EventWaitOptions): void {
  if (
    options.transport !== undefined &&
    options.transport !== "websocket" &&
    options.transport !== "poll"
  )
    throw new TypeError("transport must be websocket or poll");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(options.subscription))
    throw new TypeError(
      "subscription must be 1-64 letters, digits, underscores or hyphens, starting with a letter or digit",
    );
  if (
    options.events !== undefined &&
    (options.events.length === 0 ||
      options.events.length > 50 ||
      options.events.some(
        (event) => typeof event !== "string" || !event.trim(),
      ))
  )
    throw new TypeError("events must contain 1-50 nonempty event names");
  if (
    options.timeoutMs !== undefined &&
    (!Number.isFinite(options.timeoutMs) ||
      options.timeoutMs <= 0 ||
      options.timeoutMs > 2_147_483_647)
  )
    throw new TypeError("timeoutMs must be positive and at most 2147483647");
}

export class EventsResource {
  private readonly active = new Set<string>();
  constructor(private readonly client: PrimitiveApiClient["client"]) {}
  private reserve(options: EventWaitOptions): () => void {
    validate(options);
    options.signal?.throwIfAborted();
    if (this.active.has(options.subscription))
      throw new EventReceiverError(
        "A receiver or unsettled delivery already uses this subscription on this client",
        "busy",
        409,
      );
    this.active.add(options.subscription);
    return () => {
      this.active.delete(options.subscription);
    };
  }
  private async connect(options: EventListenOptions, signal: AbortSignal) {
    // Freeze endpoint, headers and transport configuration for this receiver.
    const config = this.client.getConfig();
    const client = new PrimitiveApiClient({
      ...config,
      headers: new Headers(config.headers as HeadersInit),
      apiBaseUrl: config.baseUrl,
    }).client;
    let status: EventStatus = { type: "ready" };
    const emit = (next: EventStatus) => {
      status = { ...status, ...next };
      options.onStatus?.(status);
    };
    const retry = <T>(operation: () => Promise<T>, operationSignal = signal) =>
      eventRetry(operation, operationSignal, () =>
        emit({ type: "reconnecting" }),
      );
    const result = await retry(async () =>
      unwrap(
        await createEndpoint({
          client,
          responseStyle: "fields",
          throwOnError: false,
          signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
          body: {
            kind: "pull",
            name: options.subscription,
            ...(options.events === undefined
              ? {}
              : { rules: { event_types: [...new Set(options.events)] } }),
          },
        }),
      ),
    );
    const endpoint = result.data;
    if (!endpoint || endpoint.kind !== "pull" || endpoint.enabled === false)
      throw new EventReceiverError(
        "Subscription is unavailable",
        "subscription_unavailable",
        409,
      );
    if (
      !endpoint.receiver_capabilities?.completion_modes.includes("sdk") ||
      (options.transport !== "poll" &&
        !endpoint.receiver_capabilities.stream_protocols.includes(
          "primitive.events.v1",
        ))
    )
      throw new EventReceiverError(
        "This API does not support SDK event receiving with the selected transport",
        "unsupported",
      );
    let gaps = -1;
    const update = (data: EventOffer) => {
      status = {
        type: "ready",
        backlog: data.backlog,
        gapCount: data.gap_count,
        lastGapReason: data.last_gap_reason,
      };
      if (data.gap_count > 0 && data.gap_count !== gaps) {
        gaps = data.gap_count;
        emit({ ...status, type: "gap" });
        if (options.onGap === "error")
          throw new EventReceiverError(
            "Subscription reports lost events",
            "event_gap",
            409,
          );
      }
    };
    const connection = new EventConnection(client, endpoint.id, {
      ...options,
      onStatus: update,
    });
    try {
      await retry(() => connection.open(signal));
      emit(status);
    } catch (error) {
      connection.close();
      throw error;
    }
    return {
      connection,
      emit,
      retry,
      update,
      get status() {
        return status;
      },
    };
  }
  async wait<const T extends string = string>(
    options: EventWaitOptions<T>,
  ): Promise<PendingEvent<T> | null> {
    const release = this.reserve(options);
    const timeout = new AbortController();
    const timeoutReason = new DOMException(
      "Event wait timed out",
      "TimeoutError",
    );
    const timer =
      options.timeoutMs === undefined
        ? undefined
        : setTimeout(() => timeout.abort(timeoutReason), options.timeoutMs);
    const signal = AbortSignal.any([
      timeout.signal,
      ...(options.signal ? [options.signal] : []),
    ]);
    let session: Awaited<ReturnType<EventsResource["connect"]>> | undefined;
    let handedOff = false;
    try {
      session = await this.connect(options, signal);
      const receiving = session;
      while (true) {
        const data = await receiving.retry(() =>
          receiving.connection.receive(signal),
        );
        signal.throwIfAborted();
        session.update(data);
        if (!data.delivery) {
          await delay(250, signal);
          continue;
        }
        const selected = session;
        const delivery = this.delivery<T>(
          data.delivery,
          selected.connection,
          options.signal,
          () => {
            selected.connection.close();
            release();
          },
        );
        handedOff = true;
        return delivery;
      }
    } catch (error) {
      if (
        timeout.signal.aborted &&
        !options.signal?.aborted &&
        error === timeoutReason
      )
        return null;
      throw error;
    } finally {
      clearTimeout(timer);
      if (!handedOff) {
        session?.connection.close();
        release();
      }
    }
  }
  async listen<const T extends string = string>(
    handler: (
      event: LocalEvent<T>,
      context: { signal: AbortSignal },
    ) => void | Promise<void>,
    options: EventListenOptions<T>,
  ): Promise<EventListener> {
    if (typeof handler !== "function")
      throw new TypeError("handler must be a function");
    const release = this.reserve(options);
    const stopping = new AbortController();
    const signal = AbortSignal.any([
      stopping.signal,
      ...(options.signal ? [options.signal] : []),
    ]);
    let session: Awaited<ReturnType<EventsResource["connect"]>>;
    try {
      session = await this.connect(options, signal);
    } catch (error) {
      release();
      throw error;
    }
    let ended = false;
    let disposeDelivery = () => {};
    const closed = (async () => {
      try {
        while (!signal.aborted) {
          const offer = await session.retry(() =>
            session.connection.receive(signal),
          );
          signal.throwIfAborted();
          session.update(offer);
          if (!offer.delivery) {
            await delay(250, signal);
            continue;
          }
          const delivery = this.delivery<T>(
            offer.delivery,
            session.connection,
            options.signal,
            () => {},
          );
          disposeDelivery = delivery.dispose;
          let removeAbort = () => {};
          try {
            await Promise.race([
              Promise.resolve().then(() =>
                handler(delivery.event, { signal: delivery.signal }),
              ),
              new Promise<never>((_, reject) => {
                const aborted = () => reject(delivery.signal.reason);
                delivery.signal.addEventListener("abort", aborted, {
                  once: true,
                });
                removeAbort = () =>
                  delivery.signal.removeEventListener("abort", aborted);
                if (delivery.signal.aborted) aborted();
              }),
            ]);
          } catch (error) {
            if (delivery.signal.aborted) throw error;
            session.emit({ type: "handler_error", error });
            await delivery.retry();
            continue;
          } finally {
            removeAbort();
          }
          await delivery.ack();
        }
      } catch (error) {
        if (!signal.aborted) throw error;
      } finally {
        ended = true;
        disposeDelivery();
        session.connection.close();
        release();
        session.emit({ type: "closed" });
      }
    })();
    // The caller still observes rejection on closed; starting a receiver does
    // not create an unhandled-rejection window before they attach a supervisor.
    void closed.catch(() => {});
    return {
      closed,
      get status(): EventStatus {
        return ended ? { type: "closed" } : session.status;
      },
      close: async () => {
        stopping.abort();
        await closed;
      },
    };
  }
  private delivery<T extends string>(
    raw: EventDelivery,
    connection: EventConnection,
    callerSignal: AbortSignal | undefined,
    release: () => void,
  ): PendingEvent<T> & { dispose(): void } {
    callerSignal?.throwIfAborted();
    const event = {
      id: raw.event_id,
      type: raw.event_type,
      body: raw.body,
      headers: raw.headers,
      data: parseWebhookEvent(JSON.parse(raw.body), raw.event_type),
    } as LocalEvent<T>;
    const started = performance.now();
    const lifetime = new AbortController();
    const signal = AbortSignal.any([
      lifetime.signal,
      ...(callerSignal ? [callerSignal] : []),
    ]);
    const remaining = Math.min(
      30000,
      Date.parse(raw.lease_expires_at) - Date.now() - 5000,
    );
    if (remaining <= 0) throw new DeliveryExpired();
    let released = false;
    let outcome: boolean | undefined;
    let settled: Promise<void> | undefined;
    const cleanup = () => {
      if (!released) {
        released = true;
        clearTimeout(timer);
        signal.removeEventListener("abort", cleanup);
        release();
      }
    };
    const timer = setTimeout(
      () => lifetime.abort(new DeliveryExpired()),
      remaining,
    );
    signal.addEventListener("abort", cleanup, { once: true });
    function complete(accepted: boolean): Promise<void> {
      if (settled !== undefined)
        return outcome === accepted
          ? settled
          : Promise.reject(
              new EventReceiverError(
                "Delivery outcome has already been chosen",
                "completion_conflict",
                409,
              ),
            );
      if (signal.aborted) return Promise.reject(signal.reason);
      outcome = accepted;
      clearTimeout(timer);
      const body: CompleteWebhookInput = {
        mode: "sdk",
        accepted,
        duration_ms: Math.min(30000, Math.round(performance.now() - started)),
        queue_id: raw.queue_id,
        delivery_id: raw.delivery_id,
        lease_token: raw.lease_token,
      };
      const receiptSignal = AbortSignal.any([
        signal,
        AbortSignal.timeout(
          Math.min(
            60000,
            Math.max(1, Date.parse(raw.lease_expires_at) - Date.now()),
          ),
        ),
      ]);
      settled = eventRetry(
        () => connection.complete(body, receiptSignal),
        receiptSignal,
      ).finally(cleanup);
      return settled;
    }
    return {
      event,
      signal,
      dispose: () => {
        lifetime.abort();
        cleanup();
      },
      ack: () => complete(true),
      retry: () => complete(false),
    };
  }
}
