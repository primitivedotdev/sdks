export type AgentRuntime = "claude" | "codex";

type Env = Record<string, string | undefined>;

/**
 * The variables each runtime sets to its exact session ID, first match wins.
 * The loaded Codex thread is the receiving identity; the process session ID
 * is only a fallback when no thread ID is exposed.
 */
export const RUNTIME_SESSION_VARIABLES = {
  claude: ["CLAUDE_CODE_SESSION_ID"],
  codex: ["CODEX_THREAD_ID", "CODEX_SESSION_ID"],
} as const satisfies Record<AgentRuntime, readonly string[]>;

export type RuntimeSession = {
  runtime: AgentRuntime;
  session: string;
  variable: string;
};

export type RuntimeSessionDetection =
  | ({ kind: "detected" } & RuntimeSession)
  | { kind: "none" }
  | { kind: "ambiguous"; candidates: RuntimeSession[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Each runtime whose environment names a session UUID. Never guessed from history or cwd. */
function runtimeSessions(env: Env): RuntimeSession[] {
  return (Object.keys(RUNTIME_SESSION_VARIABLES) as AgentRuntime[]).flatMap(
    (runtime) => {
      for (const variable of RUNTIME_SESSION_VARIABLES[runtime]) {
        const value = env[variable]?.trim().toLowerCase();
        if (!value) continue;
        return UUID.test(value) ? [{ runtime, session: value, variable }] : [];
      }
      return [];
    },
  );
}

/** The one session the runtime environment names, if exactly one runtime names one. */
export function detectRuntimeSession(
  env: Env = process.env,
): RuntimeSessionDetection {
  const candidates = runtimeSessions(env);
  const [only] = candidates;
  if (!only) return { kind: "none" };
  return candidates.length === 1
    ? { kind: "detected", ...only }
    : { kind: "ambiguous", candidates };
}

/**
 * The runtime whose tool environment names this exact session. A session ID
 * that matches neither runtime's variable, or both, has no detectable runtime.
 */
export function detectAgentRuntime(
  session: string,
  env: Env = process.env,
): AgentRuntime | null {
  const wanted = session.trim().toLowerCase();
  const matches = runtimeSessions(env).filter(
    (candidate) => candidate.session === wanted,
  );
  return matches.length === 1 ? (matches[0]?.runtime ?? null) : null;
}

/** Every variable a runtime may name its session in, for messages. */
export function runtimeSessionVariableList(): string {
  const names: string[] = Object.values(RUNTIME_SESSION_VARIABLES).flat();
  return `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`;
}
