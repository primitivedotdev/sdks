import { Errors } from "@oclif/core";
import type {
  EmailDetail,
  PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import { getEmail, searchEmails } from "@primitivedotdev/api-core";
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

/** Inspect an exact email ID obtained from a targeted query or event journal. */
export async function inspectTargetedReply(
  params: ReplyTarget & {
    apiClient: PrimitiveApiClient;
    id: string;
    deadline?: number | null;
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
  );
  if (result === null) return null;
  if (result.error)
    throw invalid(
      "Targeted reply search is unavailable. This wait requires server support for connected-credential search; no inbox scan was attempted.",
    );
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
