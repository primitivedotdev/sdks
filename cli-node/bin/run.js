#!/usr/bin/env node

import { execute } from "@oclif/core";
import { applyProxyAutoDetect } from "../dist/oclif/proxy-auto-detect.js";

// Auto-set NODE_USE_ENV_PROXY=1 when HTTP(S)_PROXY is in the env.
// Must run before any network init (e.g. before oclif loads commands
// that touch fetch). See proxy-auto-detect.ts for the full rationale.
applyProxyAutoDetect();

await execute({ dir: import.meta.url });
