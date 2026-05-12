// Auto-detect proxy environment variables at CLI startup so users
// behind a corporate proxy don't have to prefix every command with
// `NODE_USE_ENV_PROXY=1`.
//
// Node 22+ ignores `HTTP_PROXY` / `HTTPS_PROXY` for the built-in
// `fetch` / undici client unless `NODE_USE_ENV_PROXY=1` is set. That
// turns a one-line proxy export into per-command friction: every CLI
// invocation either inherits the prefix or fails with `ENETUNREACH`.
//
// This module is called once from `bin/run.js` before any network
// initialization. If any of the standard proxy env vars are set AND
// `NODE_USE_ENV_PROXY` is not already set explicitly, it sets it to
// `1` for the current process and prints a one-time stderr hint so
// the user knows what changed.
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
  reason?: "no_proxy_env" | "node_use_env_proxy_already_set" | "applied";
}

interface ProxyAutoDetectOptions {
  env?: NodeJS.ProcessEnv;
  stderr?: { write: (chunk: string) => unknown };
}

// Module-level latch so the hint is printed at most once per process
// even if `applyProxyAutoDetect` is called more than once (e.g. from
// tests, or if a future entry point routes through it twice).
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

export function applyProxyAutoDetect(
  options: ProxyAutoDetectOptions = {},
): ProxyAutoDetectResult {
  const env = options.env ?? process.env;
  const stderr = options.stderr ?? process.stderr;

  const detectedVars = detectProxyVars(env);
  if (detectedVars.length === 0) {
    return { applied: false, detectedVars: [], reason: "no_proxy_env" };
  }

  // Respect any explicit `NODE_USE_ENV_PROXY` value, including `0`
  // or an empty string. The user has made a deliberate choice and
  // auto-detection must not silently override it.
  if (Object.hasOwn(env, "NODE_USE_ENV_PROXY")) {
    return {
      applied: false,
      detectedVars,
      reason: "node_use_env_proxy_already_set",
    };
  }

  env.NODE_USE_ENV_PROXY = "1";

  if (!hintPrinted) {
    hintPrinted = true;
    const names = detectedVars.join("/");
    stderr.write(
      `primitive: proxy detected via ${names}, NODE_USE_ENV_PROXY=1 set automatically\n`,
    );
  }

  return { applied: true, detectedVars, reason: "applied" };
}
