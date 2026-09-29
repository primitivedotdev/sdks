/** Runtime-provided identity only. Never guess a session from history or cwd. */
export function currentMailSessionKey(
  env: Record<string, string | undefined> = process.env,
): string | null {
  // The loaded conversation is the native receiver's identity.
  const codex = env.CODEX_THREAD_ID ?? env.CODEX_SESSION_ID;
  const claude = env.CLAUDE_CODE_SESSION_ID;
  if (codex && claude) return null;
  const value = codex ?? claude;
  return value && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
    ? `${codex ? "codex" : "claude"}:${value.toLowerCase()}`
    : null;
}
