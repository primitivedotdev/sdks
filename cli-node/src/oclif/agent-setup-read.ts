import { AgentConnectionSetupError } from "./connected-agent-profile.js";

export type SetupReadBudget = {
  deadline: number;
  now(): number;
  sleep(ms: number): Promise<void>;
  signal: AbortSignal;
  retries: number;
};
type ReadResult = { error?: unknown; response?: Response };
export type SetupReadStage =
  | "challenge search"
  | "challenge detail"
  | "owner notification policy"
  | "owner contact preferences"
  | "verification send lookup";

function retryDelay(
  response: Response | undefined,
  attempt: number,
  now: number,
) {
  const raw = response?.headers.get("retry-after")?.trim();
  if (raw && /^\d+(?:\.\d+)?$/.test(raw)) {
    const value = Number(raw) * 1000;
    if (Number.isFinite(value)) return Math.max(1000, Math.ceil(value));
  }
  if (raw) {
    const date = Date.parse(raw);
    if (Number.isFinite(date)) return Math.max(1000, date - now);
  }
  return Math.min(1000 * 2 ** attempt, 10_000);
}

/** Read-only recovery. The caller supplies a GET operation, never a claim or write. */
export async function readSetupApi<T extends ReadResult>(
  budget: SetupReadBudget,
  stage: SetupReadStage,
  read: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const remaining = budget.deadline - budget.now();
    if (remaining <= 0 || budget.signal.aborted)
      throw new AgentConnectionSetupError(
        `Setup ${stage} reached its read deadline. Resume the saved profile; no claim or send was replayed.`,
      );
    let result: T | undefined;
    let failed = false;
    try {
      result = await read(
        AbortSignal.any([
          budget.signal,
          AbortSignal.timeout(Math.min(10_000, Math.max(1, remaining))),
        ]),
      );
    } catch {
      failed = true;
    }
    const status = result?.response?.status;
    const transient =
      status === 429 ||
      (status !== undefined && status >= 500 && status <= 599) ||
      (status === undefined && (failed || result?.error !== undefined));
    if (!transient) {
      if (
        failed ||
        !result ||
        result.error !== undefined ||
        (status !== undefined && status >= 400)
      )
        throw new AgentConnectionSetupError(
          `Setup ${stage} could not be read${status === undefined ? "" : ` (HTTP ${status})`}. Resume the saved profile after resolving access; no claim or send was replayed.`,
        );
      return result;
    }
    const waitMs = retryDelay(result?.response, attempt, budget.now());
    const remainingAfterRead = budget.deadline - budget.now();
    if (attempt >= 4 || waitMs >= remainingAfterRead || budget.signal.aborted)
      throw new AgentConnectionSetupError(
        `Setup ${stage} is temporarily unavailable${status === undefined ? " (transport failure)" : ` (HTTP ${status})`}. Retry after ${Math.ceil(waitMs / 1000)} seconds with the saved profile's --resume command; no claim or send was replayed.`,
      );
    await budget.sleep(waitMs);
    budget.retries++;
  }
}
