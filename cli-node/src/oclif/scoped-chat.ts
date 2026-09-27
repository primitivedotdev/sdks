import { Errors } from "@oclif/core";
import type {
  EmailDetail,
  PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import { getEmail, listEmails } from "@primitivedotdev/api-core";
import { classifySignalContent } from "@primitivedotdev/sdk/interactions";
import { isTrustedSender } from "@primitivedotdev/sdk/webhook";

export function isConnectedChatCredential(apiKey: string | undefined): boolean {
  return apiKey?.startsWith("pconn_") ?? false;
}

// Cancel a stalled request at the caller's deadline and leave timeout reporting
// to the command. Clearing the timer avoids retaining completed requests.
export async function readBeforeDeadline<T>(
  deadline: number | null | undefined,
  read: (signal: AbortSignal | undefined) => Promise<T>,
): Promise<T | null> {
  if (deadline == null) return read(undefined);
  if (Date.now() >= deadline) return null;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = () => {
    const remaining = Math.max(0, deadline - Date.now());
    // Node clamps longer timer delays to 1ms. Rearm instead of expiring early.
    const maximumDelay = 2 ** 31 - 1;
    timer = setTimeout(
      remaining > maximumDelay ? arm : () => controller.abort(),
      Math.min(remaining, maximumDelay),
    );
  };
  arm();
  try {
    const result = await read(controller.signal);
    return controller.signal.aborted || Date.now() >= deadline ? null : result;
  } catch (error) {
    if (controller.signal.aborted) return null;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function address(value: string): string {
  return value.trim().toLowerCase();
}

export function isScopedChatReply(
  detail: EmailDetail,
  params: { from: string; recipient: string; sentId?: string },
): boolean {
  if (
    !["accepted", "completed"].includes(detail.status) ||
    (params.sentId !== undefined &&
      detail.reply_to_sent_email_id !== params.sentId) ||
    address(detail.recipient) !== address(params.from) ||
    address(detail.to_email) !== address(params.from)
  )
    return false;
  const sender = address(params.recipient);
  // The trust helper reads only email.auth and the raw From header. Preserve
  // both without substituting the API's permissively parsed from_email field.
  const event = {
    email: { auth: detail.auth, headers: { from: detail.from_header } },
  } as Parameters<typeof isTrustedSender>[0];
  try {
    return isTrustedSender(event, {
      sender,
      domain: sender.slice(sender.lastIndexOf("@") + 1),
    }).trusted;
  } catch {
    return false;
  }
}

export function isPlainChatReply(detail: EmailDetail): boolean {
  if (
    detail.parsed?.status !== "complete" ||
    !Array.isArray(detail.parsed.attachments)
  )
    return false;
  // A canonical interaction attachment requires interpretation beyond an email
  // reply. Keep signals, malformed interactions and unsupported protocols pending.
  return (
    classifySignalContent({
      inventory: {
        status: "complete",
        parts: detail.parsed.attachments.map((part) => ({
          filename: part.filename ?? null,
          contentType: part.content_type ?? null,
        })),
      },
      bodies: {
        status: "complete",
        text: detail.body_text ?? null,
        html: detail.body_html ?? null,
      },
      canonicalPartBytes: null,
    }).classification === "plain"
  );
}

export async function findScopedChatReply(params: {
  apiClient: PrimitiveApiClient;
  from: string;
  recipient: string;
  sentId?: string;
  since?: string;
  pageSize: number;
  seenIds?: Set<string>;
  requireLatestParent?: boolean;
  notice?: (message: string) => void;
  deadline?: number | null;
}): Promise<EmailDetail | null> {
  const seenIds = params.seenIds ?? new Set<string>();
  const cursors = new Set<string>();
  let cursor: string | undefined;
  let pages = 0;
  do {
    if (++pages > 1000)
      throw new Errors.CLIError(
        "The connected inbox exceeded the chat scan limit; inspect the inbox before retrying.",
        { exit: 1 },
      );
    if (params.deadline != null && Date.now() >= params.deadline) return null;
    const page = await readBeforeDeadline(params.deadline, (signal) =>
      listEmails({
        signal,
        client: params.apiClient.client,
        query: { limit: params.pageSize, cursor, date_from: params.since },
        responseStyle: "fields",
      }),
    );
    if (page === null) return null;
    if (page.error)
      throw new Errors.CLIError(
        "Could not list the connected agent's inbox for chat.",
        { exit: 1 },
      );
    const envelope = page.data;
    if (
      !envelope ||
      !Array.isArray(envelope.data) ||
      !envelope.meta ||
      !(
        envelope.meta.cursor === null ||
        (typeof envelope.meta.cursor === "string" &&
          envelope.meta.cursor.length > 0)
      ) ||
      !envelope.data.every(
        (row) =>
          row &&
          typeof row.id === "string" &&
          row.id.length > 0 &&
          typeof row.status === "string",
      )
    ) {
      throw new Errors.CLIError(
        "The connected inbox returned an invalid page.",
        { exit: 1 },
      );
    }
    for (const row of envelope.data) {
      if (params.deadline != null && Date.now() >= params.deadline) return null;
      if (
        !["accepted", "completed"].includes(row.status) ||
        seenIds.has(row.id)
      )
        continue;
      if (
        typeof row.recipient === "string" &&
        address(row.recipient) !== address(params.from)
      )
        continue;
      const result = await readBeforeDeadline(params.deadline, (signal) =>
        getEmail({
          signal,
          client: params.apiClient.client,
          path: { id: row.id },
          responseStyle: "fields",
        }),
      );
      if (result === null) return null;
      if (params.deadline != null && Date.now() >= params.deadline) return null;
      if (result.error || !result.data?.data)
        throw new Errors.CLIError(
          `Could not inspect chat candidate ${row.id}.`,
          { exit: 1 },
        );
      const detail = result.data.data;
      // Processing rows must remain eligible for inspection on the next poll.
      if (!["accepted", "completed"].includes(detail.status)) continue;
      // A fully parsed reply linked to a different send cannot become ours.
      // Null linkage and incomplete parsing/auth must stay eligible for retry.
      if (
        params.sentId !== undefined &&
        detail.reply_to_sent_email_id != null &&
        detail.reply_to_sent_email_id !== params.sentId &&
        detail.parsed?.status === "complete" &&
        Array.isArray(detail.parsed.attachments)
      ) {
        seenIds.add(row.id);
        continue;
      }
      if (!isScopedChatReply(detail, params)) continue;
      if (isPlainChatReply(detail)) return detail;
      if (params.requireLatestParent) {
        throw new Errors.CLIError(
          `Latest reply ${detail.id} needs inspection. Use primitive emails get --id ${detail.id}, then choose --reply-to-email-id explicitly.`,
          { exit: 1 },
        );
      }
      if (
        detail.parsed?.status === "complete" &&
        Array.isArray(detail.parsed.attachments)
      )
        seenIds.add(row.id);
      params.notice?.(
        `Reply ${detail.id} needs inspection; continuing to wait for a plain reply. Use primitive emails get --id ${detail.id}.`,
      );
    }
    cursor = envelope.meta.cursor ?? undefined;
    if (cursor && cursors.has(cursor))
      throw new Errors.CLIError(
        "The inbox returned a repeated pagination cursor.",
        { exit: 1 },
      );
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return null;
}
