// Attachment downloads can answer `attachment_not_ready` for a short while
// after an email arrives. The download commands wait and retry on that code
// instead of handing the caller a manual polling loop.

/** Generated download commands that wait for attachment content by default. */
export const ATTACHMENT_WAIT_OPERATIONS: ReadonlySet<string> = new Set([
  "downloadAttachments",
  "downloadEmailAttachmentPart",
  "downloadSentAttachmentPart",
]);

export const ATTACHMENT_NOT_READY = "attachment_not_ready";

/** Longest a download command waits for attachment content, in total. */
export const ATTACHMENT_WAIT_MAX_MS = 60_000;

const INITIAL_DELAY_MS = 1000;
const MAX_DELAY_MS = 8000;

export const ATTACHMENT_WAIT_FLAG_DESCRIPTION = `Wait and retry while the attachment content is not ready yet (attachment_not_ready), for up to ${ATTACHMENT_WAIT_MAX_MS / 1000}s. Pass --no-wait to return the error immediately.`;

type DownloadResult = { error?: unknown; response?: Response };

export type AttachmentWaitOptions = {
  /** False returns the first result as is (--no-wait). */
  wait: boolean;
  /** Reads the error code from a failed result. */
  errorCode: (error: unknown) => string | undefined;
  /** Called once, before the first wait. Must not write to stdout. */
  onFirstWait?: () => void;
  maxWaitMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

/** Seconds from a Retry-After header, or undefined when absent or not a number of seconds. */
export function retryAfterMs(
  response: Response | undefined,
): number | undefined {
  const header = response?.headers?.get("retry-after");
  if (!header || !/^\d+$/.test(header.trim())) return undefined;
  return Number(header.trim()) * 1000;
}

/**
 * Delay before the next attempt: the server's Retry-After when it gives one,
 * otherwise exponential backoff from 1s, capped at 8s either way, and never
 * past the remaining budget.
 */
export function nextAttachmentWaitDelay(
  attempt: number,
  remainingMs: number,
  serverHintMs: number | undefined,
): number {
  const backoff = INITIAL_DELAY_MS * 2 ** Math.min(attempt, 10);
  const delay = Math.min(serverHintMs ?? backoff, MAX_DELAY_MS);
  return Math.max(0, Math.min(delay, remainingMs));
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Run `call` and, while it fails with attachment_not_ready, wait and run it
 * again until it succeeds, fails differently, or the budget is spent. The last
 * result is returned either way, so the caller reports it exactly as before.
 */
export async function withAttachmentWait<T extends DownloadResult>(
  call: () => Promise<T>,
  options: AttachmentWaitOptions,
): Promise<T> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const maxWaitMs = options.maxWaitMs ?? ATTACHMENT_WAIT_MAX_MS;
  const started = now();
  let result = await call();
  for (let attempt = 0; options.wait; attempt++) {
    if (
      !result.error ||
      options.errorCode(result.error) !== ATTACHMENT_NOT_READY
    )
      break;
    const remaining = maxWaitMs - (now() - started);
    if (remaining <= 0) break;
    if (attempt === 0) options.onFirstWait?.();
    await sleep(
      nextAttachmentWaitDelay(
        attempt,
        remaining,
        retryAfterMs(result.response),
      ),
    );
    result = await call();
  }
  return result;
}
