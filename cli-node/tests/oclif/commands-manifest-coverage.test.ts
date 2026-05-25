import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { operationManifest } from "@primitivedotdev/api-core";
import { describe, expect, it } from "vitest";
import {
  CANONICAL_OPERATION_ALIASES,
  COMMANDS,
} from "../../src/oclif/index.js";

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

  it("registers canonical task aliases for generated API operations", () => {
    for (const [alias, target] of Object.entries(CANONICAL_OPERATION_ALIASES)) {
      expect(COMMANDS[target]).toBeDefined();
      expect(COMMANDS[alias]).toBe(COMMANDS[target]);
    }
  });

  it("registers the top-level reply shortcut", () => {
    expect(COMMANDS.reply).toBeDefined();
  });

  it("registers signup commands", () => {
    expect(COMMANDS.signup).toBeDefined();
    expect(COMMANDS["signup:confirm"]).toBeDefined();
    expect(COMMANDS["signup:interactive"]).toBeDefined();
    expect(COMMANDS["signup:resend"]).toBeDefined();
  });

  it("registers sign-in commands", () => {
    expect(COMMANDS.signin).toBeDefined();
    expect(COMMANDS["signin:browser"]).toBeDefined();
    expect(COMMANDS["signin:otp"]).toBeDefined();
    expect(COMMANDS["signin:otp:confirm"]).toBeDefined();
    expect(COMMANDS["signin:otp:resend"]).toBeDefined();
  });

  it("keeps reply wait flags aligned with send", () => {
    const replyCommand = COMMANDS.reply as unknown as {
      flags: Record<string, unknown>;
    };
    expect(replyCommand.flags.wait).toBeDefined();
    expect(replyCommand.flags["wait-timeout-ms"]).toBeDefined();
  });

  it("registers the normal function test alias", () => {
    expect(COMMANDS["functions:test"]).toBe(
      COMMANDS["functions:test-function"],
    );
  });

  it("registers config environment commands", () => {
    expect(COMMANDS.config).toBeDefined();
    expect(COMMANDS.config.hidden).toBe(true);
    expect(COMMANDS["config:set"]).toBeDefined();
    expect(COMMANDS["config:use"]).toBeDefined();
    expect(COMMANDS["config:list"]).toBeDefined();
    expect(COMMANDS["config:reset"]).toBeDefined();
    expect(COMMANDS["config:set"].hidden).toBeFalsy();
    expect(COMMANDS["config:use"].hidden).toBeFalsy();
    expect(COMMANDS["config:list"].hidden).toBeFalsy();
    expect(COMMANDS["config:reset"].hidden).toBeFalsy();
    for (const command of [
      COMMANDS.config,
      COMMANDS["config:set"],
      COMMANDS["config:use"],
      COMMANDS["config:list"],
      COMMANDS["config:reset"],
    ]) {
      expect(command.summary).not.toMatch(/hidden/i);
      expect(command.description ?? "").not.toMatch(/hidden/i);
    }
  });

  it("keeps the config topic out of root help", () => {
    const packageJsonPath = fileURLToPath(
      new URL("../../package.json", import.meta.url),
    );
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      oclif?: {
        topics?: Record<string, { hidden?: boolean }>;
      };
    };

    expect(packageJson.oclif?.topics?.config?.hidden).toBe(true);
  });
});
