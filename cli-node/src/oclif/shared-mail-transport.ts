import { setTimeout as delay } from "node:timers/promises";
import {
  createEndpoint,
  type PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import { EventConnection, EventReceiverError } from "@primitivedotdev/sdk/api";
import {
  AGENT_CONNECTION_REQUIRED,
  AGENT_CONNECTION_REQUIRED_MESSAGE,
} from "./listen-credential.js";

export interface SharedMailTransportOptions {
  apiClient: PrimitiveApiClient;
  subscription: string;
  recipient: string;
  signal: AbortSignal;
  ready(): Promise<void>;
  checked?(): Promise<void>;
  status(value: {
    ready?: boolean;
    gapCount?: number;
    lastGapReason?: string | null;
  }): Promise<void>;
  ingest(value: {
    eventId: string;
    emailId: string;
    receivedAt: string;
  }): Promise<void>;
}

function invalid(message: string): EventReceiverError {
  return new EventReceiverError(message, "invalid_response");
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function ensureSharedMailSubscription(options: {
  apiClient: PrimitiveApiClient;
  subscription: string;
  recipient?: string;
  signal: AbortSignal;
}) {
  const signal = options.signal;
  const result = await createEndpoint({
    client: options.apiClient.client,
    body: {
      kind: "pull",
      name: options.subscription,
      rules: { event_types: ["email.received"] },
    },
    signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    responseStyle: "fields",
  });
  if (result.error || !result.data?.data) {
    const error = result.error as { error?: { code?: unknown } } | undefined;
    if (error?.error?.code === AGENT_CONNECTION_REQUIRED)
      throw new EventReceiverError(
        AGENT_CONNECTION_REQUIRED_MESSAGE,
        AGENT_CONNECTION_REQUIRED,
        403,
      );
    throw new EventReceiverError(
      "Could not open the shared inbound subscription.",
      "subscription_failed",
      result.response?.status ?? 0,
    );
  }
  const created = result.data.data;
  if (
    typeof created.id !== "string" ||
    !created.id ||
    created.kind !== "pull" ||
    created.enabled !== true ||
    !Array.isArray(created.rules?.event_types) ||
    created.rules.event_types.length !== 1 ||
    created.rules.event_types[0] !== "email.received" ||
    typeof created.recipient !== "string" ||
    !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(created.recipient) ||
    (options.recipient !== undefined &&
      created.recipient.trim().toLowerCase() !==
        options.recipient.trim().toLowerCase()) ||
    !created.receiver_capabilities?.stream_protocols.includes(
      "primitive.events.v1",
    ) ||
    !created.receiver_capabilities.completion_modes.includes("sdk")
  )
    throw invalid(
      "The API did not return a compatible subscription for the connected address.",
    );
  return {
    endpointId: created.id,
    recipient: created.recipient.trim().toLowerCase(),
  };
}

/** The elected foreground owner journals IDs before accepting remote delivery. */
export async function runSharedMailTransport(
  options: SharedMailTransportOptions,
): Promise<void> {
  const failed = new AbortController();
  const signal = AbortSignal.any([options.signal, failed.signal]);
  let connected = false;
  async function retry<T>(
    operation: () => Promise<T>,
    deadline?: number,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      signal.throwIfAborted();
      if (deadline !== undefined && Date.now() >= deadline)
        throw invalid(
          "The shared inbound completion lease expired; durable ingress remains available for redelivery.",
        );
      try {
        return await operation();
      } catch (error) {
        signal.throwIfAborted();
        if (
          !(error instanceof EventReceiverError) ||
          ["invalid_response", "unsupported"].includes(error.code) ||
          !([0, 408, 429].includes(error.status) || error.status >= 500)
        )
          throw error;
        connected = false;
        await options.status({ ready: false });
        await delay(
          Math.max(
            error.retryAfterMs,
            Math.min(10_000, 250 * 2 ** Math.min(attempt, 6)),
          ),
          undefined,
          { signal },
        );
      }
    }
  }
  const created = await retry(() =>
    ensureSharedMailSubscription({ ...options, signal }),
  );
  let statusWork = Promise.resolve();
  const publishChecked = () => {
    const checked = options.checked;
    if (!checked) return;
    statusWork = statusWork.then(() => checked());
    void statusWork.catch((error: unknown) => failed.abort(error));
  };
  // A mail check is a server answer about this subscription's queue: an
  // offer (empty or not) or a status frame. Opening the stream and pings
  // only show the connection is alive, so they do not count.
  const publishStatus = (value: {
    gap_count: number;
    last_gap_reason: string | null;
  }) => {
    publishChecked();
    statusWork = statusWork.then(() =>
      options.status({
        gapCount: value.gap_count,
        lastGapReason: value.last_gap_reason,
      }),
    );
    void statusWork.catch((error: unknown) => failed.abort(error));
  };
  const stream = new EventConnection(
    options.apiClient.client,
    created.endpointId,
    { onStatus: publishStatus },
  );
  const ensureOpen = async () => {
    if (connected) return;
    await stream.open(signal);
    await statusWork;
    await options.ready();
    connected = true;
  };
  try {
    await retry(ensureOpen);
    while (!signal.aborted) {
      const offer = await retry(async () => {
        await ensureOpen();
        return stream.receive(signal);
      });
      publishStatus(offer);
      await statusWork;
      const delivery = offer.delivery;
      if (!delivery) continue;
      const started = performance.now();
      let body: unknown;
      try {
        body = JSON.parse(delivery.body);
      } catch {
        throw invalid("The shared subscription returned invalid JSON.");
      }
      if (
        delivery.event_type !== "email.received" ||
        !record(body) ||
        !record(body.email) ||
        typeof body.email.id !== "string" ||
        !body.email.id ||
        typeof body.email.received_at !== "string" ||
        !Number.isFinite(Date.parse(body.email.received_at)) ||
        !record(body.email.smtp) ||
        !Array.isArray(body.email.smtp.rcpt_to) ||
        body.email.smtp.rcpt_to.length !== 1 ||
        typeof body.email.smtp.rcpt_to[0] !== "string" ||
        body.email.smtp.rcpt_to[0].trim().toLowerCase() !==
          options.recipient.trim().toLowerCase()
      )
        throw invalid(
          "The shared subscription returned an invalid or out-of-scope inbound event.",
        );
      await options.ingest({
        eventId: delivery.event_id,
        emailId: body.email.id,
        receivedAt: body.email.received_at,
      });
      const elapsed = Math.round(performance.now() - started);
      if (elapsed > 30_000)
        throw invalid(
          "Shared inbound persistence exceeded the handler deadline; durable ingress remains available for redelivery.",
        );
      const completion = {
        queue_id: delivery.queue_id,
        delivery_id: delivery.delivery_id,
        lease_token: delivery.lease_token,
        mode: "sdk" as const,
        accepted: true,
        duration_ms: elapsed,
      };
      const leaseDeadline = Date.parse(delivery.lease_expires_at);
      if (Date.now() >= leaseDeadline)
        throw invalid(
          "The shared inbound lease expired after durable recording; it remains eligible for redelivery.",
        );
      await retry(async () => {
        await ensureOpen();
        if (Date.now() >= leaseDeadline)
          throw invalid(
            "The shared inbound completion lease expired; durable ingress remains available for redelivery.",
          );
        return stream.complete(
          completion,
          AbortSignal.any([
            signal,
            AbortSignal.timeout(Math.max(1, leaseDeadline - Date.now())),
          ]),
        );
      }, leaseDeadline);
    }
  } finally {
    stream.close();
  }
}
