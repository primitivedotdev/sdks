import type { EmailDetail } from "@primitivedotdev/api-core";
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
  return scopedChatSenderTrust(detail, params.recipient).trusted;
}

export function scopedChatSenderTrust(detail: EmailDetail, peer: string) {
  const sender = address(peer);
  // The trust helper consumes only authenticated detail fields, not a fabricated
  // signed webhook or the API's permissively parsed from_email field.
  const evidence = {
    email: { auth: detail.auth, headers: { from: detail.from_header } },
  } as Parameters<typeof isTrustedSender>[0];
  return isTrustedSender(evidence, {
    sender,
    domain: sender.slice(sender.lastIndexOf("@") + 1),
  });
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
