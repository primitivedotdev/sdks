import type {
  CompleteWebhookInput,
  PullWebhookResponse,
} from "@primitivedotdev/api-core";

export type ListenDelivery = NonNullable<
  PullWebhookResponse["data"]["delivery"]
>;

type WithoutOwnership<T> = T extends unknown
  ? Omit<T, "queue_id" | "delivery_id" | "lease_token">
  : never;

export type ListenOutcome = WithoutOwnership<CompleteWebhookInput>;

export type ListenHandlerResult = {
  outcome: ListenOutcome;
  succeeded: boolean;
};

export type ListenHandler = (
  delivery: ListenDelivery,
  signal: AbortSignal,
) => Promise<ListenHandlerResult>;
