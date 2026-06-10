#!/usr/bin/env node

// Unscoped alias entry point. Delegates to @primitivedotdev/cli, whose
// run.js resolves oclif against its own package via import.meta.url, so the
// real command set and version run unchanged. This package exists only so the
// CLI is discoverable on npm under the bare brand name in addition to the
// scoped @primitivedotdev/cli package.
import "@primitivedotdev/cli/bin/run.js";
