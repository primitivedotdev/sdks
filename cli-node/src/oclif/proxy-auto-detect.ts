import { spawnSync } from "node:child_process";

// Auto-detect proxy environment variables at CLI startup so users
// behind a corporate proxy don't have to prefix every command with
// `NODE_USE_ENV_PROXY=1`.
//
// Node 22+ ignores `HTTP_PROXY` / `HTTPS_PROXY` for the built-in
// `fetch` / undici client unless `NODE_USE_ENV_PROXY=1` is present at
// Node process startup. Mutating process.env after startup is too late;
// fetch will keep ignoring the proxy vars. That turns a one-line proxy
// export into per-command friction: every CLI invocation either inherits
// the prefix or fails with `ENETUNREACH`.
//
// This module is called once from `bin/run.js` before oclif loads. If
// any standard proxy env var is set AND `NODE_USE_ENV_PROXY` is not
// already set explicitly, it re-runs the CLI as a child Node process
// with `NODE_USE_ENV_PROXY=1` in the startup environment, then exits
// with the child's status.
//
// An explicit `NODE_USE_ENV_PROXY` value (including `0`, `""`, etc.)
// is always respected: if the user has chosen to disable proxy use
// for this invocation, we don't override that choice.

const PROXY_ENV_VARS = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "http_proxy",
  "https_proxy",
] as const;

type ProxyEnvVar = (typeof PROXY_ENV_VARS)[number];

export interface ProxyAutoDetectResult {
  applied: boolean;
  detectedVars: ProxyEnvVar[];
  reason?:
    | "no_proxy_env"
    | "node_use_env_proxy_already_set"
    | "missing_entrypoint";
}

interface RestartWithProxyEnvOptions {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  execArgv?: string[];
  execPath?: string;
  exit?: (code?: string | number | null | undefined) => never;
  kill?: (pid: number, signal: NodeJS.Signals | number) => true;
  pid?: number;
  spawn?: typeof spawnSync;
  stderr?: { write: (chunk: string) => unknown };
}

// Module-level latch so the hint is printed at most once per process
// even if a future entry point routes through this helper twice.
let hintPrinted = false;

// Test-only: reset the one-shot hint latch so each test case can
// observe the first-call behavior independently.
export function _resetHintLatchForTest(): void {
  hintPrinted = false;
}

function detectProxyVars(env: NodeJS.ProcessEnv): ProxyEnvVar[] {
  return PROXY_ENV_VARS.filter((name) => {
    const value = env[name];
    return typeof value === "string" && value.length > 0;
  });
}

export function restartWithProxyEnvIfNeeded(
  options: RestartWithProxyEnvOptions = {},
): ProxyAutoDetectResult {
  const env = options.env ?? process.env;
  const stderr = options.stderr ?? process.stderr;

  const detectedVars = detectProxyVars(env);
  if (detectedVars.length === 0) {
    return { applied: false, detectedVars: [], reason: "no_proxy_env" };
  }

  if (Object.hasOwn(env, "NODE_USE_ENV_PROXY")) {
    return {
      applied: false,
      detectedVars,
      reason: "node_use_env_proxy_already_set",
    };
  }

  const argv = options.argv ?? process.argv;
  const entrypoint = argv[1];
  if (!entrypoint) {
    return { applied: false, detectedVars, reason: "missing_entrypoint" };
  }

  const execPath = options.execPath ?? process.execPath;
  const execArgv = options.execArgv ?? process.execArgv;
  const spawn = options.spawn ?? spawnSync;
  const exit: NonNullable<RestartWithProxyEnvOptions["exit"]> =
    options.exit ??
    ((code) => {
      process.exit(code);
      throw new Error("process.exit returned unexpectedly");
    });

  if (!hintPrinted) {
    hintPrinted = true;
    const names = detectedVars.join("/");
    stderr.write(
      `primitive: proxy detected via ${names}, restarting with NODE_USE_ENV_PROXY=1\n`,
    );
  }

  const child = spawn(execPath, [...execArgv, entrypoint, ...argv.slice(2)], {
    env: { ...env, NODE_USE_ENV_PROXY: "1" },
    stdio: "inherit",
  });

  if (child.error) {
    throw child.error;
  }

  if (child.signal) {
    const kill = options.kill ?? process.kill;
    kill(options.pid ?? process.pid, child.signal);
    return exit(1);
  }

  return exit(child.status ?? 1);
}
