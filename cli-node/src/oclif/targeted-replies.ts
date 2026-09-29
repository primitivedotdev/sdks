import { Errors } from "@oclif/core";
import type {
  EmailDetail,
  PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import { getEmail, searchEmails } from "@primitivedotdev/api-core";
import {
  type ContactRequestReference,
  isContactAcceptance,
  readContactInteraction,
} from "./contact-interactions.js";
import {
  NotificationRetryError,
  notificationPartReader,
} from "./notify-session-content.js";
import { presenceDisposition } from "./presence-provenance.js";
import {
  isPlainChatReply,
  isScopedChatReply,
  readBeforeDeadline,
  scopedChatSenderTrust,
} from "./scoped-chat.js";

export interface ReplyTarget {
  from: string;
  recipient: string;
  sentId: string;
  since?: string;
}

export type TargetedReplyInspection =
  | { kind: "reply"; email: EmailDetail }
  | {
      kind: "pending" | "inspection" | "unrelated";
      id: string;
      email: EmailDetail;
    };

function invalid(message: string): Errors.CLIError {
  return new Errors.CLIError(message, { exit: 1 });
}

/** Diagnostics use status and a parsed delay only, never response bodies or transport errors. */
function searchFailure(response?: Response): Errors.CLIError {
  const status = response?.status;
  if (status === 429) {
    const raw = response?.headers.get("retry-after")?.trim() ?? "";
    let seconds: number | undefined;
    if (/^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)))
      seconds = Number(raw);
    else if (
      /^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(raw)
    ) {
      const timestamp = Date.parse(raw);
      if (Number.isFinite(timestamp))
        seconds = Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
    }
    return invalid(
      `Targeted reply search is rate limited (HTTP 429). ${seconds === undefined ? "Resume this same wait after the rate limit resets" : `Retry after ${seconds} seconds and resume this same wait`}; do not resend the email.`,
    );
  }
  if (status === undefined || (status >= 500 && status <= 599))
    return invalid(
      `Targeted reply search is temporarily unavailable${status === undefined ? " (transport failure)" : ` (HTTP ${status})`}. Resume this same wait later; do not resend the email.`,
    );
  if (status === 401 || status === 403)
    return invalid(
      `Targeted reply search access was denied (HTTP ${status}). Check this profile's access before resuming the same wait.`,
    );
  if (status === 404 || status === 405)
    return invalid(
      `Targeted reply search is unavailable on this API endpoint (HTTP ${status}). Check the API host before resuming this wait.`,
    );
  return invalid(
    `Targeted reply search failed (HTTP ${status}). Check the wait parameters before resuming this wait.`,
  );
}

/** Inspect an exact email ID obtained from a targeted query or event journal. */
export async function inspectTargetedReply(
  params: ReplyTarget & {
    apiClient: PrimitiveApiClient;
    id: string;
    deadline?: number | null;
    contactRequest?: ContactRequestReference;
  },
): Promise<TargetedReplyInspection | null> {
  const result = await readBeforeDeadline(params.deadline, (signal) =>
    getEmail({
      client: params.apiClient.client,
      path: { id: params.id },
      signal,
      responseStyle: "fields",
    }),
  );
  if (result === null) return null;
  const email = result.data?.data;
  if (result.error || !email || email.id !== params.id)
    throw invalid(`Could not inspect reply candidate ${params.id}.`);
  const presence = presenceDisposition(email);
  if (presence !== "ordinary")
    return {
      kind: presence === "pending" ? "pending" : "unrelated",
      id: params.id,
      email,
    };
  if (
    email.reply_to_sent_email_id != null &&
    email.reply_to_sent_email_id !== params.sentId
  )
    return { kind: "unrelated", id: params.id, email };
  if (typeof email.recipient !== "string" || typeof email.to_email !== "string")
    throw invalid(
      `Reply candidate ${params.id} has invalid recipient metadata.`,
    );
  if (
    email.recipient.trim().toLowerCase() !== params.from.trim().toLowerCase() ||
    email.to_email.trim().toLowerCase() !== params.from.trim().toLowerCase()
  )
    return { kind: "unrelated", id: params.id, email };
  if (email.status === "rejected")
    return { kind: "unrelated", id: params.id, email };
  // A different authenticated identity cannot become this peer. Do not keep
  // rereading unrelated pushed mail on every local state reconciliation.
  const trust = scopedChatSenderTrust(email, params.recipient);
  if (
    ["accepted", "completed"].includes(email.status) &&
    email.parsed?.status === "complete" &&
    [
      "dmarc-domain-mismatch",
      "from-domain-mismatch",
      "sender-mismatch",
      "from-header-multiple-addresses",
      "from-header-invalid",
    ].includes(trust.reason)
  )
    return { kind: "unrelated", id: params.id, email };
  // Pending parse/auth/linkage is not an observed reply and must stay retryable.
  if (
    !isScopedChatReply(email, params) ||
    email.parsed?.status !== "complete" ||
    !Array.isArray(email.parsed.attachments)
  )
    return { kind: "pending", id: params.id, email };
  const received = Date.parse(email.received_at);
  if (!Number.isFinite(received))
    throw invalid(
      `Reply candidate ${params.id} has an invalid receipt timestamp.`,
    );
  if (params.since !== undefined && received < Date.parse(params.since))
    return { kind: "unrelated", id: params.id, email };
  if (params.contactRequest) {
    try {
      const control = await readBeforeDeadline(params.deadline, (signal) =>
        readContactInteraction(
          email,
          notificationPartReader(async () => params.apiClient.client),
          signal ?? new AbortController().signal,
          // Recovery time must not invalidate an acceptance received in time.
          received,
        ),
      );
      return isContactAcceptance(control, params.contactRequest)
        ? { kind: "reply", email }
        : { kind: "inspection", id: params.id, email };
    } catch (error) {
      if (error instanceof NotificationRetryError)
        return { kind: "pending", id: params.id, email };
      throw error;
    }
  }
  return isPlainChatReply(email)
    ? { kind: "reply", email }
    : { kind: "inspection", id: params.id, email };
}

/** One targeted recovery page. The event owner decides when recovery is needed. */
export async function readTargetedReplyPage(
  params: ReplyTarget & {
    apiClient: PrimitiveApiClient;
    cursor?: string;
    pageSize: number;
    deadline?: number | null;
  },
): Promise<{ ids: string[]; cursor: string | null } | null> {
  if (!params.sentId || !params.from || !params.recipient)
    throw invalid(
      "Targeted reply recovery requires the exact sent email, receiving address, and peer.",
    );
  const result = await readBeforeDeadline(params.deadline, (signal) =>
    searchEmails({
      client: params.apiClient.client,
      signal,
      query: {
        reply_to_sent_email_id: params.sentId,
        from: params.recipient,
        to: params.from,
        date_from: params.since,
        cursor: params.cursor,
        limit: params.pageSize,
        sort: "received_at_asc",
        snippet: "false",
        include_facets: "false",
      },
      responseStyle: "fields",
    }),
  ).catch(() => {
    throw searchFailure();
  });
  if (result === null) return null;
  if (result.error || (result.response && result.response.status >= 400))
    throw searchFailure(result.response);
  const envelope = result.data;
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
      (row) => row && typeof row.id === "string" && row.id.length > 0,
    )
  )
    throw invalid("Targeted reply search returned an invalid page.");
  if (params.cursor !== undefined && envelope.meta.cursor === params.cursor)
    throw invalid("Targeted reply search returned a repeated cursor.");
  return {
    ids: [...new Set(envelope.data.map((row) => row.id))],
    cursor: envelope.meta.cursor,
  };
}
