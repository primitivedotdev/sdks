#!/usr/bin/env node

// The CLI moved to @primitivedotdev/cli. This bin is retained on
// @primitivedotdev/sdk for a few minor versions so existing scripts
// and agent prompts that invoke `npx @primitivedotdev/sdk@latest
// <command>` keep working. Every invocation prints a one-line stderr
// banner with the migration command; the actual oclif runtime runs
// unchanged after that. The CLI surface will be removed from
// @primitivedotdev/sdk in a future minor release; until then this
// shipped snapshot is frozen against the 0.23.0 command set.
import { execute } from "@oclif/core";

process.stderr.write(
  "[@primitivedotdev/sdk] Heads up: the CLI moved to @primitivedotdev/cli. " +
    "Switch to `npx @primitivedotdev/cli@latest <command>` " +
    "(or `npm install -g @primitivedotdev/cli`). " +
    "The CLI surface will be removed from @primitivedotdev/sdk in a future minor release.\n",
);

await execute({ dir: import.meta.url });
