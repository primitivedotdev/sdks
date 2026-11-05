import { detectRuntimeSession } from "./runtime-session.js";

/** Runtime-provided identity only. Never guess a session from history or cwd. */
export function currentMailSessionKey(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const detection = detectRuntimeSession(env);
  return detection.kind === "detected"
    ? `${detection.runtime}:${detection.session}`
    : null;
}
