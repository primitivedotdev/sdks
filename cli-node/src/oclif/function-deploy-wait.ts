import type { FunctionDetail } from "@primitivedotdev/api-core";
import { extractErrorPayload } from "./api-command.js";

export const DEFAULT_DEPLOY_WAIT_TIMEOUT_SECONDS = 120;
export const DEFAULT_DEPLOY_POLL_INTERVAL_SECONDS = 2;

export type FunctionDeployWaitSnapshot = {
  id: string;
  name: string;
  deploy_status: FunctionDetail["deploy_status"];
  deploy_error?: string | null;
  deployed_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type GetFunctionForDeployWait = (params: { id: string }) => Promise<{
  data?: { data?: FunctionDetail };
  error?: unknown;
}>;

export type WaitForFunctionDeployResult =
  | { kind: "ok"; function: FunctionDeployWaitSnapshot }
  | { kind: "failed"; function: FunctionDeployWaitSnapshot }
  | {
      kind: "timeout";
      elapsedSeconds: number;
      lastFunction: FunctionDeployWaitSnapshot | null;
    }
  | { kind: "error"; payload: unknown };

export function validateDeployWaitFlags(params: {
  timeoutSeconds: number;
  pollIntervalSeconds: number;
}): string | null {
  if (params.timeoutSeconds < 0) {
    return "--timeout must be greater than or equal to 0.";
  }
  if (params.pollIntervalSeconds <= 0) {
    return "--poll-interval must be greater than 0.";
  }
  return null;
}

function isTerminal(status: string): status is "deployed" | "failed" {
  return status === "deployed" || status === "failed";
}

function resultForTerminal(
  snapshot: FunctionDeployWaitSnapshot,
): WaitForFunctionDeployResult {
  if (snapshot.deploy_status === "failed") {
    return { function: snapshot, kind: "failed" };
  }
  return { function: snapshot, kind: "ok" };
}

function toDeployWaitSnapshot(
  value: FunctionDeployWaitSnapshot,
): FunctionDeployWaitSnapshot {
  return {
    ...(value.created_at !== undefined ? { created_at: value.created_at } : {}),
    ...(value.deploy_error !== undefined
      ? { deploy_error: value.deploy_error }
      : {}),
    deploy_status: value.deploy_status,
    ...(value.deployed_at !== undefined
      ? { deployed_at: value.deployed_at }
      : {}),
    id: value.id,
    name: value.name,
    ...(value.updated_at !== undefined ? { updated_at: value.updated_at } : {}),
  };
}

function elapsedSeconds(startedAt: number, now: () => number): number {
  return Math.max(0, Math.round((now() - startedAt) / 1000));
}

async function defaultSleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForFunctionDeploy(params: {
  id: string;
  getFunction: GetFunctionForDeployWait;
  initial?: FunctionDeployWaitSnapshot | null;
  timeoutSeconds: number;
  pollIntervalSeconds: number;
  writeStderr?: (chunk: string) => void;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}): Promise<WaitForFunctionDeployResult> {
  const now = params.now ?? Date.now;
  const sleep = params.sleep ?? defaultSleep;
  const writeStderr =
    params.writeStderr ??
    ((chunk: string) => {
      process.stderr.write(chunk);
    });
  const startedAt = now();
  const timeoutMs = params.timeoutSeconds * 1000;
  const pollIntervalMs = params.pollIntervalSeconds * 1000;
  const hasTimeout = params.timeoutSeconds > 0;
  let last = params.initial ? toDeployWaitSnapshot(params.initial) : null;
  let lastStatus = last?.deploy_status ?? "unknown";

  if (last && isTerminal(last.deploy_status)) {
    return resultForTerminal(last);
  }

  writeStderr(
    `Waiting for function ${params.id} deploy to finish (current status: ${lastStatus})...\n`,
  );

  while (true) {
    const elapsedMs = now() - startedAt;
    if (hasTimeout && elapsedMs >= timeoutMs) {
      return {
        elapsedSeconds: elapsedSeconds(startedAt, now),
        kind: "timeout",
        lastFunction: last,
      };
    }

    const sleepMs = hasTimeout
      ? Math.min(pollIntervalMs, Math.max(0, timeoutMs - elapsedMs))
      : pollIntervalMs;
    await sleep(sleepMs);

    if (hasTimeout && now() - startedAt >= timeoutMs) {
      return {
        elapsedSeconds: elapsedSeconds(startedAt, now),
        kind: "timeout",
        lastFunction: last,
      };
    }

    const result = await params.getFunction({ id: params.id });
    if (result.error) {
      return { kind: "error", payload: extractErrorPayload(result.error) };
    }

    const fetched = result.data?.data;
    if (!fetched) {
      return {
        kind: "error",
        payload: {
          code: "client_error",
          message: "Get function returned no data while waiting for deploy",
        },
      };
    }

    last = toDeployWaitSnapshot(fetched);
    if (last.deploy_status !== lastStatus) {
      lastStatus = last.deploy_status;
      writeStderr(
        `Function ${params.id} deploy status: ${last.deploy_status}\n`,
      );
    }
    if (isTerminal(last.deploy_status)) {
      return resultForTerminal(last);
    }
  }
}
