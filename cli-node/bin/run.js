#!/usr/bin/env node

import { restartWithProxyEnvIfNeeded } from "../dist/oclif/proxy-auto-detect.js";

// With --json, stderr stays empty so a merged stream is one JSON document.
// The update notice and Node's runtime warnings are printed outside any
// command, so turn them off here.
const cliArgs = process.argv.slice(2);
const separator = cliArgs.indexOf("--");
if (
  (separator === -1 ? cliArgs : cliArgs.slice(0, separator)).includes("--json")
) {
  process.env.PRIMITIVE_SKIP_NEW_VERSION_CHECK ??= "true";
  process.removeAllListeners("warning");
}

// Auto-restart with NODE_USE_ENV_PROXY=1 when HTTP(S)_PROXY is in the env.
// Node reads NODE_USE_ENV_PROXY during process startup, so mutating
// process.env inside this process is too late for built-in fetch.
restartWithProxyEnvIfNeeded();

const { writeRootAuthContextIfNeeded } = await import(
  "../dist/oclif/root-signup-hint.js"
);
await writeRootAuthContextIfNeeded();

const { execute } = await import("@oclif/core");
await execute({ dir: import.meta.url });
