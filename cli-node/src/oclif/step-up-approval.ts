import { createInterface } from "node:readline/promises";
import { openBrowser } from "./browser-login-prompt.js";

// Browser approval for a request the server asks the person to approve
// (a session step-up): it answers `403 step_up_required` with a link, the
// page shows a one-time token, and the request is sent again with that token
// in the Primitive-Step-Up header. Shared by the key commands and every
// generated command whose operation takes that header.

export const STEP_UP_HEADER = "Primitive-Step-Up";

// ASCII control characters, which a header value cannot carry. Built from
// code points so the pattern holds no literal control character.
const CONTROL_CHARACTERS = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}]`,
);

export const STEP_UP_TOKEN_FLAG_DESCRIPTION =
  "One-time token from the approval page, for a request you already approved in the browser. Sent in the Primitive-Step-Up header.";

export const BROWSER_FLAG_DESCRIPTION =
  "Open the approval page in your browser. Use --no-browser to only print its link.";

/** The error code of a refusal, whether or not it is still in its envelope. */
function errorCode(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const inner = (payload as { error?: { code?: unknown } }).error;
  if (inner && typeof inner === "object" && typeof inner.code === "string")
    return inner.code;
  const code = (payload as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/** The approval link of a `step_up_required` refusal, if that is what it is. */
export function stepUpUrlOf(payload: unknown): string | undefined {
  if (errorCode(payload) !== "step_up_required") return undefined;
  if (!payload || typeof payload !== "object") return undefined;
  const details = (payload as { details?: unknown }).details;
  if (!details || typeof details !== "object") return undefined;
  const url = (details as { step_up_url?: unknown }).step_up_url;
  return typeof url === "string" && url.length > 0 ? url : undefined;
}

export type ApprovalIo = {
  stepUpToken?: string;
  interactive: boolean;
  openBrowser: boolean;
  open: (url: string) => void;
  prompt: (question: string) => Promise<string>;
  write: (text: string) => void;
};

/** What an attempt answers: whether it went through, and the refusal if not. */
export type ApprovalAttempt = { ok: boolean; payload?: unknown };

/**
 * Send a request, and when the server asks the person to approve it, show
 * the approval link, open it where possible, wait for the token the page
 * shows, and send the request once more with it. Without a terminal to wait
 * in, the refusal is returned with its link, to rerun with --step-up-token.
 */
export async function withApproval<R extends ApprovalAttempt>(
  attempt: (stepUpToken: string | undefined) => Promise<R>,
  io: ApprovalIo,
): Promise<R & { stepUpUrl?: string }> {
  const first = await attempt(io.stepUpToken);
  if (first.ok) return first;
  const stepUpUrl = stepUpUrlOf(first.payload);
  if (!stepUpUrl || io.stepUpToken || !io.interactive) {
    return { ...first, ...(stepUpUrl ? { stepUpUrl } : {}) };
  }
  io.write(`Approve this request in your browser: ${stepUpUrl}\n`);
  if (io.openBrowser) io.open(stepUpUrl);
  io.write(
    "After you confirm, the page shows a one-time token. Paste it here to finish.\n",
  );
  const token = (await io.prompt("Token: ")).trim();
  if (!token) return { ...first, stepUpUrl };
  if (CONTROL_CHARACTERS.test(token)) {
    io.write(
      "That token holds a line break or another control character, so it cannot be sent. Copy it again from the page.\n",
    );
    return { ...first, stepUpUrl };
  }
  return attempt(token);
}

/** The line to print when a refusal asks for an approval the command could not wait for. */
export function approveThenRerunHint(stepUpUrl: string): string {
  return `Approve this request in your browser: ${stepUpUrl}\nThen run the same command again with --step-up-token <token from the page>.\n`;
}

export async function promptLine(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

/** Approval in the terminal the command runs in: never under --json, and only with a terminal on both ends. */
export function terminalApprovalIo(options: {
  stepUpToken?: string;
  openBrowser: boolean;
  json?: boolean;
}): ApprovalIo {
  return {
    ...(options.stepUpToken ? { stepUpToken: options.stepUpToken } : {}),
    interactive:
      !options.json && Boolean(process.stdin.isTTY && process.stderr.isTTY),
    openBrowser: options.openBrowser,
    open: openBrowser,
    prompt: promptLine,
    write: (text) => process.stderr.write(text),
  };
}
