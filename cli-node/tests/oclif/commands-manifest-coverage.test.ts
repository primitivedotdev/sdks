import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { operationManifest } from "@primitivedotdev/api-core";
import { describe, expect, it } from "vitest";
import { COMMANDS } from "../../src/oclif/index.js";

// Regression guard for the discovery / execution surface staying in
// sync. `primitive list-operations` enumerates the operation
// manifest, and the CLI's COMMANDS map auto-registers a wrapper
// command for every entry. If a new operation lands in the manifest
// without a matching COMMANDS entry, agents would see it via
// list-operations but get "command not found" when they invoke it.
//
// Separately, a stale static `oclif.manifest.json` shipped in the
// package would also cause this gap (oclif looks up commands via the
// static manifest before falling through to the runtime COMMANDS map,
// so any entry missing from the static file is unreachable even when
// the runtime map has it). The second assertion in this file is the
// explicit guard against that mode: the package must not ship a
// pre-built oclif manifest.
describe("COMMANDS / manifest coverage", () => {
  it("registers a command for every operation in the manifest", () => {
    const missing = operationManifest
      .map((op) => `${op.tagCommand}:${op.command}`)
      .filter((id) => !(id in COMMANDS));

    expect(missing).toEqual([]);
  });

  it("does not declare a pre-built oclif.manifest.json in package files", () => {
    // A static `oclif.manifest.json` is a snapshot captured at
    // publish time. Because COMMANDS is built dynamically from the
    // bundled `@primitivedotdev/api-core` operation manifest, a stale
    // static snapshot can advertise commands the runtime can't reach
    // or, conversely, hide commands the runtime exposes. The CLI
    // resolves commands via the dynamic COMMANDS map at runtime; the
    // static manifest must not ship with the package.
    const packageJsonPath = fileURLToPath(
      new URL("../../package.json", import.meta.url),
    );
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      files?: string[];
      scripts?: Record<string, string>;
    };

    expect(packageJson.files ?? []).not.toContain("oclif.manifest.json");
    const prepack = packageJson.scripts?.prepack ?? "";
    expect(prepack).not.toMatch(/oclif\s+manifest/);
  });

  it("has a runtime entry specifically for functions:list-function-logs", () => {
    // Named regression: an AGX agent ran `primitive list-operations`,
    // saw `functions:list-function-logs`, and then got "command not
    // found" when invoking it. The root cause was a stale shipped
    // oclif.manifest.json; the runtime COMMANDS map always had the
    // entry. Keeping this assertion separate from the bulk coverage
    // check above makes the named-regression failure mode obvious.
    expect(COMMANDS["functions:list-function-logs"]).toBeDefined();
  });
});
