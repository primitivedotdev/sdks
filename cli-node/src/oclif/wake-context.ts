import type {
  EmailDetail,
  PrimitiveApiClient,
  ThreadMessage,
} from "@primitivedotdev/api-core";

/**
 * Server-derived facts about one received email that a wake may carry.
 * Every field comes from authenticated API state or local listener state,
 * never from text the sender wrote. Subject and body are deliberately absent.
 */
export type WakeRelationship =
  | "owner"
  | "member"
  | "agent"
  | "contact"
  | "other";

export type WakeContext = {
  sender: string;
  relationship: WakeRelationship;
  threadId: string | null;
  inThread: boolean;
  attachments: boolean;
  /** Present only when the API reports newer inbound mail for this thread. */
  newer?: number;
};

export type NewerInbound = { id: string; from: string; received_at: string };

export type ThreadContext = {
  threadId: string;
  messages: ThreadMessage[];
  truncated: boolean;
  newerInboundCount?: number;
  newerInbound?: NewerInbound[];
};

type Client = PrimitiveApiClient["client"];

const security = [{ scheme: "bearer" as const, type: "http" as const }];
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const WAKE_ADDRESS = /^[a-z0-9._%+-]{1,64}@[a-z0-9.-]{1,253}$/;

// A server that rejects the `after` query is remembered per client so a
// listener does not pay a failed request on every wake.
const afterUnsupported = new WeakSet<object>();

/** The bare lowercase address in `Name <addr>` or `addr` form. */
export function bareAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const bracket = /<([^<>\s]+@[^<>\s]+)>\s*$/.exec(value);
  const address = (bracket?.[1] ?? value).trim().toLowerCase();
  return /^[^\s<>@]+@[^\s<>@]+$/.test(address) ? address : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function newerRows(value: unknown): NewerInbound[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const rows: NewerInbound[] = [];
  for (const item of value.slice(-20)) {
    const row = record(item);
    const from = bareAddress(row?.from);
    if (
      !row ||
      typeof row.id !== "string" ||
      !UUID.test(row.id) ||
      !from ||
      typeof row.received_at !== "string" ||
      !Number.isFinite(Date.parse(row.received_at))
    )
      return undefined;
    rows.push({ id: row.id.toLowerCase(), from, received_at: row.received_at });
  }
  return rows;
}

/**
 * Read one thread, asking for mail newer than `afterEmailId`. The newer-mail
 * fields are feature-detected: an API that does not return them yields a
 * context without `newerInboundCount`. Returns null when the thread cannot be
 * read; callers treat that as "unknown", never as an error.
 */
export async function readThreadContext(
  client: Client,
  threadId: string,
  afterEmailId: string | undefined,
  signal: AbortSignal,
): Promise<ThreadContext | null> {
  if (!UUID.test(threadId)) return null;
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(5000)]);
  const read = (after?: string) =>
    client.get({
      security,
      url: "/threads/{id}",
      path: { id: threadId },
      ...(after ? { query: { after } } : {}),
      signal: bounded,
      responseStyle: "fields",
    }) as Promise<{ data?: unknown; error?: unknown; response?: Response }>;
  try {
    const askAfter =
      afterEmailId !== undefined &&
      UUID.test(afterEmailId) &&
      !afterUnsupported.has(client);
    let result = await read(askAfter ? afterEmailId : undefined);
    if (askAfter && result.response?.status === 400) {
      afterUnsupported.add(client);
      result = await read();
    }
    if (result.error !== undefined) return null;
    const body = record(result.data);
    const data = record(body?.data);
    if (body?.success !== true || !data || !Array.isArray(data.messages))
      return null;
    const messages = data.messages.filter(
      (message): message is ThreadMessage =>
        Boolean(record(message)) &&
        typeof (message as ThreadMessage).id === "string" &&
        ["inbound", "outbound"].includes((message as ThreadMessage).direction),
    );
    const count = data.newer_inbound_count;
    const newerInboundCount =
      typeof count === "number" && Number.isSafeInteger(count) && count >= 0
        ? count
        : undefined;
    const newerInbound =
      newerInboundCount === undefined
        ? undefined
        : newerRows(data.newer_inbound);
    return {
      threadId: threadId.toLowerCase(),
      messages,
      truncated:
        typeof data.message_count === "number" &&
        data.message_count > messages.length,
      ...(newerInboundCount === undefined ? {} : { newerInboundCount }),
      ...(newerInbound === undefined ? {} : { newerInbound }),
    };
  } catch {
    signal.throwIfAborted();
    return null;
  }
}

/** Whether `self` has an outbound message in the thread; undefined if unknowable. */
export function sentInThread(
  context: ThreadContext | null,
  self: string,
): boolean | undefined {
  if (!context) return undefined;
  const address = self.toLowerCase();
  if (
    context.messages.some(
      (message) =>
        message.direction === "outbound" &&
        bareAddress(message.from) === address,
    )
  )
    return true;
  return context.truncated ? undefined : false;
}

/** The latest outbound message from `self` in the thread, if listed. */
export function latestOwnOutbound(
  context: ThreadContext | null,
  self: string,
): ThreadMessage | undefined {
  const address = self.toLowerCase();
  return [...(context?.messages ?? [])]
    .reverse()
    .find(
      (message) =>
        message.direction === "outbound" &&
        bareAddress(message.from) === address,
    );
}

export function hasAttachments(detail: EmailDetail): boolean {
  return (detail.parsed?.attachments?.length ?? 0) > 0;
}

/**
 * Map server-provided sender facts to one relationship label. The owner and
 * member labels come only from server admission; `agent` from the server's
 * connected-agent verification or network admission; `contact` from an
 * explicit contact allowance.
 */
export function wakeRelationship(input: {
  senderRelation?: "owner" | "member";
  connectedAgentVerified?: boolean;
  network?: boolean;
  contact?: boolean;
}): WakeRelationship {
  if (input.senderRelation) return input.senderRelation;
  if (input.connectedAgentVerified || input.network) return "agent";
  if (input.contact) return "contact";
  return "other";
}

const SERVER_RELATIONSHIPS: Readonly<Record<string, WakeRelationship>> = {
  owner: "owner",
  org_agent: "agent",
  member: "member",
  contact: "contact",
  other: "other",
};

/** The `collaboration` object of an email read, when the server sends one. */
function collaborationOf(detail: unknown): Record<string, unknown> | null {
  return record(record(detail)?.collaboration);
}

/**
 * The sender relationship the server computed for this email
 * (`collaboration.sender_relationship`), mapped to the CLI's labels:
 * `org_agent` reads as `agent`. When present it is authoritative, `other`
 * included, so a stale local classification cannot override it. Returns
 * undefined only for an older server that sends no such field, or an
 * unrecognized value; the caller then keeps its own derivation.
 */
export function serverRelationship(
  detail: unknown,
): WakeRelationship | undefined {
  const value = collaborationOf(detail)?.sender_relationship;
  return typeof value === "string" && Object.hasOwn(SERVER_RELATIONSHIPS, value)
    ? SERVER_RELATIONSHIPS[value]
    : undefined;
}

/**
 * True when the server reports this email's thread as muted for the
 * receiving address (`collaboration.muted`, or `muted` on the email). An
 * older server sends neither and nothing is muted by it.
 */
export function serverMuted(detail: unknown): boolean {
  return (
    collaborationOf(detail)?.muted === true || record(detail)?.muted === true
  );
}

/** The metadata clause of a wake line. Addresses outside a plain charset are withheld. */
export function formatWakeContext(context: WakeContext): string {
  const sender = WAKE_ADDRESS.test(context.sender)
    ? context.sender
    : "unavailable";
  const thread =
    context.threadId && UUID.test(context.threadId)
      ? context.threadId.toLowerCase()
      : "none";
  const newer =
    context.newer !== undefined &&
    Number.isSafeInteger(context.newer) &&
    context.newer >= 0
      ? ` newer=${Math.min(context.newer, 9999)}`
      : "";
  return `from=${sender} relationship=${context.relationship} thread=${thread} in_thread=${context.inThread ? "yes" : "no"} attachments=${context.attachments ? "yes" : "no"}${newer}`;
}

/** Build a wake context, reading the thread once. Never throws for API failures. */
export async function describeWake(input: {
  client: Client;
  detail: EmailDetail;
  self: string;
  relationship: WakeRelationship;
  localInThread: boolean;
  signal: AbortSignal;
}): Promise<WakeContext> {
  const { detail } = input;
  const threadId =
    typeof detail.thread_id === "string" && UUID.test(detail.thread_id)
      ? detail.thread_id.toLowerCase()
      : null;
  const thread = threadId
    ? await readThreadContext(input.client, threadId, detail.id, input.signal)
    : null;
  return {
    sender: detail.from_email.trim().toLowerCase(),
    relationship: serverRelationship(detail) ?? input.relationship,
    threadId,
    inThread: input.localInThread || sentInThread(thread, input.self) === true,
    attachments: hasAttachments(detail),
    ...(thread?.newerInboundCount === undefined
      ? {}
      : { newer: thread.newerInboundCount }),
  };
}
