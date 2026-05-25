#!/usr/bin/env node

import { restartWithProxyEnvIfNeeded } from "../dist/oclif/proxy-auto-detect.js";

// Auto-restart with NODE_USE_ENV_PROXY=1 when HTTP(S)_PROXY is in the env.
// Node reads NODE_USE_ENV_PROXY during process startup, so mutating
// process.env inside this process is too late for built-in fetch.
restartWithProxyEnvIfNeeded();

const { writeLoggedOutSignupHintIfNeeded } = await import(
  "../dist/oclif/root-signup-hint.js"
);
writeLoggedOutSignupHintIfNeeded();

const { execute } = await import("@oclif/core");
await execute({ dir: import.meta.url });
