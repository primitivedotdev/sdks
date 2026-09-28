import { Errors } from "@oclif/core";
import type { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { getSentEmail } from "@primitivedotdev/api-core";
import { parseFromHeader } from "@primitivedotdev/sdk/parser/address";
import type { EmailPollFilters } from "./commands/emails-poll.js";
import { readBeforeDeadline } from "./scoped-chat.js";

function invalid(message: string): Errors.CLIError {
  return new Errors.CLIError(message, { exit: 1 });
}

function exactAddress(value: unknown, label: string): string {
  if (typeof value !== "string")
    throw invalid(`${label} must be an exact email address.`);
  const normalized = value.trim().toLowerCase();
  const parsed = parseFromHeader(normalized);
  if (!parsed.ok || parsed.value.address !== normalized)
    throw invalid(
      `${label} must be an exact bare email address, not a domain or address list.`,
    );
  return normalized;
}

export async function resolveScopedEmailWait(params: {
  apiClient: PrimitiveApiClient;
  filters: EmailPollFilters;
  deadline?: number | null;
}): Promise<{ from: string; recipient: string; sentId: string } | null> {
  const { from, to, replyToSentEmailId, ...unsupported } = params.filters;
  if (
    !replyToSentEmailId ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      replyToSentEmailId,
    )
  )
    throw invalid(
      "Connected email waits require --reply-to-sent-email-id with the existing send's UUID. This command does not send mail.",
    );
  const recipient = exactAddress(from, "--from");
  const requestedTo = to === undefined ? undefined : exactAddress(to, "--to");
  if (
    Object.values(unsupported).some(
      (value) => value !== undefined && value !== false,
    )
  )
    throw invalid(
      "Connected email waits support exact --from, --to, and --reply-to-sent-email-id matching only; search, body, subject, domain, attachment, and spam filters are unavailable.",
    );
  const sentId = replyToSentEmailId.toLowerCase();
  const result = await readBeforeDeadline(params.deadline, (signal) =>
    getSentEmail({
      signal,
      client: params.apiClient.client,
      path: { id: sentId },
      responseStyle: "fields",
    }),
  );
  if (result === null) return null;
  const sent = result.data?.data;
  if (result.error || !sent || sent.id !== sentId)
    throw invalid(
      "Could not read that sent email with the connected credential. Inspect the existing send before retrying; do not send it again.",
    );
  const ownAddress = exactAddress(
    sent.from_address,
    "The sent email's from_address",
  );
  if (sent.from_header != null && sent.from_header !== "") {
    const header =
      typeof sent.from_header === "string"
        ? parseFromHeader(sent.from_header)
        : null;
    if (!header?.ok || header.value.address !== ownAddress)
      throw invalid(
        "The sent email's sender fields disagree; inspect it before waiting.",
      );
  }
  if (requestedTo !== undefined && requestedTo !== ownAddress)
    throw invalid(
      "--to must match the sender address of the referenced sent email.",
    );
  // The public sent record has no complete CC/BCC inventory. The peer stays
  // explicit rather than being inferred from a potentially partial To header.
  return { from: ownAddress, recipient, sentId };
}
