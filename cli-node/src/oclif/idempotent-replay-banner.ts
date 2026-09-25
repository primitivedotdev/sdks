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
 * Design:
 * - Writes to stderr only. Stdout JSON is byte-identical to a
 *   non-replay response so `... | jq ...` pipelines keep working.
 * - Pure of side effects beyond the supplied write target so the
 *   unit test can capture writes without mocking `process.stderr`.
 * - Idempotent: safe to call regardless of whether the response
 *   actually carries `idempotent_replay`. Non-replay responses
 *   produce no output.
 */

interface ReplayBannerOptions {
  /** Sink for the banner. Defaults at the call site to `process.stderr`. */
  write: (chunk: string) => void;
}

interface ReplayProbe {
  idempotent_replay?: unknown;
  id?: unknown;
  status?: unknown;
  delivery_status?: unknown;
}

/**
 * If `data` carries `idempotent_replay: true`, write a stderr notice
 * that the message already went out and nothing new was sent.
 * Otherwise no-op.
 *
 * The notice deliberately gives no advice on how to force a fresh
 * copy. Whoever sees a replay has already sent this message; telling
 * them to vary the content is an instruction to double-send.
 */
export function writeIdempotentReplayBannerIfReplay(
  data: unknown,
  options: ReplayBannerOptions,
): void {
  if (!isReplay(data)) return;
  options.write(`${formatAlreadySentNotice(data as ReplayProbe)}\n`);
}

function isReplay(data: unknown): boolean {
  if (data === null || typeof data !== "object") return false;
  const probe = data as ReplayProbe;
  return probe.idempotent_replay === true;
}

export function formatAlreadySentNotice(sent: {
  id?: unknown;
  status?: unknown;
  delivery_status?: unknown;
}): string {
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
