#!/usr/bin/env node

import { restartWithProxyEnvIfNeeded } from "../dist/oclif/proxy-auto-detect.js";

if (process.env.PRIMITIVE_LISTEN_SUPERVISOR === "1") {
  const { runBackgroundListenSupervisor } = await import(
    "../dist/oclif/listen-supervisor.js"
  );
  await runBackgroundListenSupervisor();
  process.exit(0);
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
