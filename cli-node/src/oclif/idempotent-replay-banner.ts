/**
 * Emit a stderr notice when a send-mail response indicates the
 * server replayed a cached row instead of putting a fresh message on
 * the wire.
 *
 * Why this exists. The send-mail API auto-derives an idempotency key
 * from the message content (from + to + subject + body). When the
 * same content is sent twice within the server's idempotency window,
 * the second call returns the persisted row from the first call with
 * `idempotent_replay: true` and the original delivery state. No SMTP
 * traffic, no new email lands in the recipient's inbox.
 *
 * Without this banner the JSON response looks indistinguishable from
 * a successful fresh delivery (same `status: "delivered"`, same
 * `id`, same SMTP fields once the row-column-carry-through is in
 * place). A customer debugging "why didn't my second email arrive"
 * has no signal that the second call was a no-op, and an agent has
 * no signal that its message already went out. This notice makes
 * that condition impossible to miss in an interactive shell while
 * leaving stdout JSON output unchanged for scripted consumers.
 *
 * The API also says why it answered with an existing send: an
 * `idempotency` object naming how the key that matched was derived and
 * which send it matched. The notice is worded from that, because the
 * four cases call for different next steps. A key derived from content
 * expires with its 5-minute window, so a deliberate repeat needs a key
 * of its own. A key the caller chose never expires. A Function's key is
 * tied to the email or event that invoked it. A keyless reply is matched
 * to the reply its parent already has. An API that predates the object
 * gets the general notice.
 *
 * Design:
 * - Writes to stderr only. Stdout JSON is byte-identical to a
 *   non-replay response so `... | jq ...` pipelines keep working.
 * - Pure of side effects beyond the supplied write target so the
 *   unit test can capture writes without mocking `process.stderr`.
 * - Idempotent: safe to call regardless of whether the response
 *   actually carries `idempotent_replay`. Non-replay responses
 *   produce no output.
 */

interface ReplayBannerOptions extends ReplayNoticeOptions {
  /** Sink for the banner. Defaults at the call site to `process.stderr`. */
  write: (chunk: string) => void;
}

export interface ReplayNoticeOptions {
  /**
   * Who chose the idempotency key the request carried. `send`, `reply`
   * and `chat` send a key of their own when the caller passes none: a
   * hash of the content and the current 5-minute window, the same rule
   * the API applies to a request with no key. The API sees a header and
   * reports `explicit`, but to the person at the terminal it is the
   * automatic key, so `cli_derived` words it that way. Default `caller`.
   */
  keyOrigin?: "caller" | "cli_derived";
  /**
   * Whether to say how to send again. Off where the surrounding message
   * already tells the caller not to resend. Default true.
   */
  advise?: boolean;
  /**
   * How the surrounding command names an idempotency key, for the advice
   * sentence. Default "an idempotency key".
   */
  keyHint?: string;
  /** Clock for the "sent <n>s ago" age. Defaults to `Date.now()`. */
  now?: number;
}

interface ReplayProbe {
  idempotent_replay?: unknown;
  id?: unknown;
  status?: unknown;
  delivery_status?: unknown;
  dedup_reason?: unknown;
  client_idempotency_key?: unknown;
  idempotency?: unknown;
}

type ReplayKind =
  | "auto_content"
  | "explicit"
  | "function_trigger"
  | "parent_already_replied";

interface ReplayDetail {
  kind: ReplayKind;
  originalId: string | null;
  originalCreatedAt: string | null;
}

/**
 * If `data` carries `idempotent_replay: true`, write a stderr notice
 * that nothing new was sent and why. Otherwise no-op.
 */
export function writeIdempotentReplayBannerIfReplay(
  data: unknown,
  options: ReplayBannerOptions,
): void {
  if (!isReplay(data)) return;
  const { write, ...notice } = options;
  write(`${formatAlreadySentNotice(data as ReplayProbe, notice)}\n`);
}

function isReplay(data: unknown): boolean {
  if (data === null || typeof data !== "object") return false;
  const probe = data as ReplayProbe;
  return probe.idempotent_replay === true;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

/**
 * Read the API's `idempotency` object. Null when it is absent or names
 * a key source this CLI does not know, so the general notice is used
 * and nothing is claimed about a case it cannot describe.
 */
function readReplayDetail(
  sent: ReplayProbe,
  keyOrigin: "caller" | "cli_derived",
): ReplayDetail | null {
  const raw = sent.idempotency;
  if (raw === null || typeof raw !== "object") return null;
  const object = raw as Record<string, unknown>;
  const source = object.key_source;
  let kind: ReplayKind;
  if (sent.dedup_reason === "parent_already_replied") {
    kind = "parent_already_replied";
  } else if (source === "auto_content" || source === "function_trigger") {
    kind = source;
  } else if (source === "explicit") {
    kind = keyOrigin === "cli_derived" ? "auto_content" : "explicit";
  } else {
    return null;
  }
  return {
    kind,
    originalId:
      nonEmptyString(object.original_sent_email_id) ?? nonEmptyString(sent.id),
    originalCreatedAt: nonEmptyString(object.original_created_at),
  };
}

/** "12s ago", "4m ago", "3h ago", "9d ago"; null when the time is unusable. */
export function formatReplayAge(
  createdAt: string | null,
  now: number,
): string | null {
  if (createdAt === null) return null;
  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) return null;
  // A clock a little behind the API's reads as a negative age.
  const seconds = Math.max(0, Math.round((now - created) / 1000));
  if (seconds < 120) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 120) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function statusSuffix(sent: ReplayProbe): string {
  const status = nonEmptyString(sent.status);
  const deliveryStatus = nonEmptyString(sent.delivery_status);
  const details: string[] = [];
  if (status) details.push(`status ${status}`);
  if (deliveryStatus && deliveryStatus !== status) {
    details.push(`delivery status ${deliveryStatus}`);
  }
  return details.length > 0 ? ` (${details.join(", ")})` : "";
}

function formatSpecificNotice(
  sent: ReplayProbe,
  detail: ReplayDetail,
  options: ReplayNoticeOptions,
): string {
  const age = formatReplayAge(
    detail.originalCreatedAt,
    options.now ?? Date.now(),
  );
  const when = age ? ` sent ${age}` : "";
  const id = detail.originalId ?? "an earlier send";
  const state = statusSuffix(sent);
  const advise = options.advise !== false;
  const keyHint = options.keyHint ?? "an idempotency key";
  switch (detail.kind) {
    case "auto_content":
      return `Not sent: identical to ${id}${when}${state}.${advise ? ` Pass ${keyHint} to send again.` : ""}`;
    case "explicit": {
      const key = nonEmptyString(sent.client_idempotency_key);
      const subject = key ? `idempotency key ${key}` : "this idempotency key";
      return `Not sent: ${subject} was already used for ${id}${when}${state}. A key you pass never expires.${advise ? " Use a different key only for a different message." : ""}`;
    }
    case "function_trigger":
      return `Not sent: this Function already sent this message as ${id}${when}${state}, for the same email or event that invoked it. A Function that runs again for one trigger sends once.`;
    case "parent_already_replied":
      return `Not sent: the email already has a reply, ${id}${when}${state}.${advise ? ` Pass ${keyHint} to send another reply.` : ""}`;
  }
}

/**
 * The notice for a send that was answered with an existing send. Worded
 * from the API's `idempotency` object when the response carries one;
 * the general "already sent" notice otherwise.
 *
 * The advice never says to change the message. Whoever sees this has a
 * send on record already, and varying the content to get past it is how
 * a retry becomes a double send. Sending the same thing again on
 * purpose is a different request, and an idempotency key is how the API
 * is told so.
 */
export function formatAlreadySentNotice(
  sent: {
    id?: unknown;
    status?: unknown;
    delivery_status?: unknown;
    dedup_reason?: unknown;
    client_idempotency_key?: unknown;
    idempotency?: unknown;
  },
  options: ReplayNoticeOptions = {},
): string {
  const detail = readReplayDetail(sent, options.keyOrigin ?? "caller");
  if (detail) return formatSpecificNotice(sent, detail, options);
  const details: string[] = [];
  if (typeof sent.id === "string" && sent.id) {
    details.push(`sent id ${sent.id}`);
  }
  const status =
    typeof sent.status === "string" && sent.status ? sent.status : null;
  const deliveryStatus =
    typeof sent.delivery_status === "string" && sent.delivery_status
      ? sent.delivery_status
      : null;
  if (status) details.push(`status ${status}`);
  if (deliveryStatus && deliveryStatus !== status) {
    details.push(`delivery status ${deliveryStatus}`);
  }
  const suffix = details.length > 0 ? ` (${details.join(", ")})` : "";
  return `Already sent: this exact message went out earlier${suffix}. Nothing new was sent.`;
}
