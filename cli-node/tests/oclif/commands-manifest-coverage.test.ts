import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { operationManifest } from "@primitivedotdev/api-core";
import { describe, expect, it } from "vitest";
import {
  isPublicGeneratedOperation,
  operationId,
  publicOperationCommandId,
} from "../../src/oclif/command-surface.js";
import { COMMANDS, publicOperationEntries } from "../../src/oclif/index.js";

function readCliPackageJson(): {
  files?: string[];
  oclif?: {
    plugins?: string[];
    topics?: Record<string, { description?: string; hidden?: boolean }>;
    "warn-if-update-available"?: {
      frequency?: number;
      frequencyUnit?: string;
      message?: string;
      timeoutInDays?: number;
    };
  };
  scripts?: Record<string, string>;
} {
  const packageJsonPath = fileURLToPath(
    new URL("../../package.json", import.meta.url),
  );
  return JSON.parse(readFileSync(packageJsonPath, "utf8"));
}

// Regression guard for the discovery / execution surface staying in
// sync. `primitive list-operations` enumerates public generated
// operations, and the CLI's COMMANDS map auto-registers a wrapper
// command for every public entry. If a new public operation lands in
// the manifest without a matching COMMANDS entry, agents would see it
// via list-operations but get "command not found" when they invoke it.
//
// Separately, a stale static `oclif.manifest.json` shipped in the
// package would also cause this gap (oclif looks up commands via the
// static manifest before falling through to the runtime COMMANDS map,
// so any entry missing from the static file is unreachable even when
// the runtime map has it). The second assertion in this file is the
// explicit guard against that mode: the package must not ship a
// pre-built oclif manifest.
describe("COMMANDS / manifest coverage", () => {
  it("registers one canonical command for every public generated operation", () => {
    const missing = operationManifest
      .filter(isPublicGeneratedOperation)
      .map(publicOperationCommandId)
      .filter((id) => !(id in COMMANDS));

    expect(missing).toEqual([]);
  });

  it("does not register raw operation ids when a canonical name replaces them", () => {
    const duplicatedRawIds = operationManifest
      .filter(isPublicGeneratedOperation)
      .map((op) => ({
        publicId: publicOperationCommandId(op),
        rawId: operationId(op),
      }))
      .filter(({ publicId, rawId }) => publicId !== rawId && rawId in COMMANDS)
      .map(({ rawId }) => rawId);

    expect(duplicatedRawIds).toEqual([]);
  });

  it("lists only invokable generated commands for discovery", () => {
    const listedCommandIds = publicOperationEntries().map(
      (entry) => entry.cliCommandId,
    );
    const missingListedCommands = listedCommandIds.filter(
      (id) => !(id in COMMANDS),
    );
    const listedRawIds = operationManifest
      .filter(isPublicGeneratedOperation)
      .filter(
        (operation) =>
          publicOperationCommandId(operation) !== operationId(operation),
      )
      .map(operationId)
      .filter((id) => listedCommandIds.includes(id));

    expect(missingListedCommands).toEqual([]);
    expect(listedRawIds).toEqual([]);
  });

  it("does not declare a pre-built oclif.manifest.json in package files", () => {
    // A static `oclif.manifest.json` is a snapshot captured at
    // publish time. Because COMMANDS is built dynamically from the
    // bundled `@primitivedotdev/api-core` operation manifest, a stale
    // static snapshot can advertise commands the runtime can't reach
    // or, conversely, hide commands the runtime exposes. The CLI
    // resolves commands via the dynamic COMMANDS map at runtime; the
    // static manifest must not ship with the package.
    const packageJson = readCliPackageJson();

    expect(packageJson.files ?? []).not.toContain("oclif.manifest.json");
    const prepack = packageJson.scripts?.prepack ?? "";
    expect(prepack).not.toMatch(/oclif\s+manifest/);
  });

  it("keeps function logs available through the canonical command", () => {
    expect(COMMANDS["functions:logs"]).toBeDefined();
    expect(COMMANDS["functions:list-function-logs"]).toBeUndefined();
  });

  it("accepts --json on generated API commands that already emit JSON", () => {
    const domainsListCommand = COMMANDS["domains:list"] as unknown as {
      flags: Record<string, unknown>;
    };

    expect(domainsListCommand.flags.json).toBeDefined();
  });

  it("registers the top-level reply shortcut", () => {
    expect(COMMANDS.reply).toBeDefined();
  });

  it("keeps top-level chat registered with reply continuation support", () => {
    expect(COMMANDS.chat).toBeDefined();
    expect(COMMANDS["chat:reply"]).toBeDefined();
    const chatCommand = COMMANDS.chat as unknown as {
      flags: Record<string, unknown>;
    };
    const chatReplyCommand = COMMANDS["chat:reply"] as unknown as {
      flags: Record<string, unknown>;
    };
    expect(chatCommand.flags.reply).toBeDefined();
    expect(chatCommand.flags["reply-to-email-id"]).toBeDefined();
    expect(chatCommand.flags.attachment).toBeDefined();
    expect(chatCommand.flags["chat-local-id"]).toBeDefined();
    expect(chatReplyCommand.flags.id).toBeDefined();
    expect(chatReplyCommand.flags.attachment).toBeDefined();
    expect(chatReplyCommand.flags["strict-only"]).toBeDefined();
  });

  it("registers friendly thread command aliases", () => {
    expect(COMMANDS["threads:get"]).toBeDefined();
    expect(COMMANDS["threads:get-thread"]).toBeUndefined();
  });

  it("keeps top-level send registered with attachment support", () => {
    const sendCommand = COMMANDS.send as unknown as {
      flags: Record<string, { multiple?: boolean }>;
    };
    expect(sendCommand).toBeDefined();
    expect(sendCommand.flags.attachment?.multiple).toBe(true);
  });

  it("keeps whoami registered with explicit JSON output", () => {
    expect(COMMANDS.whoami).toBeDefined();
    const whoamiCommand = COMMANDS.whoami as unknown as {
      flags: Record<string, unknown>;
    };
    expect(whoamiCommand.flags.json).toBeDefined();
  });

  it("registers domain zone-file commands", () => {
    expect(COMMANDS["domains:zone-file"]).toBeDefined();
    expect(COMMANDS["domains:download-domain-zone-file"]).toBeUndefined();
    const zoneFileCommand = COMMANDS["domains:zone-file"] as unknown as {
      flags: Record<string, unknown>;
    };
    expect(zoneFileCommand.flags.id).toBeDefined();
    expect(zoneFileCommand.flags.output).toBeDefined();
    expect(zoneFileCommand.flags["outbound-only"]).toBeDefined();
  });

  it("registers inbox status commands", () => {
    expect(COMMANDS["inbox:setup"]).toBeDefined();
    expect(COMMANDS["inbox:status"]).toBeDefined();
    expect(COMMANDS["inbox:get-inbox-status"]).toBeUndefined();
    const inboxSetupCommand = COMMANDS["inbox:setup"] as unknown as {
      flags: Record<string, unknown>;
    };
    expect(inboxSetupCommand.flags.json).toBeDefined();
    const inboxStatusCommand = COMMANDS["inbox:status"] as unknown as {
      flags: Record<string, unknown>;
    };
    expect(inboxStatusCommand.flags.domain).toBeDefined();
    expect(inboxStatusCommand.flags.json).toBeDefined();
  });

  it("registers search as a top-level command", () => {
    expect(COMMANDS.search).toBeDefined();
    expect(COMMANDS["search:semantic-search"]).toBeUndefined();
    expect(COMMANDS["semantic-search"]).toBeUndefined();
    const semanticSearchCommand = COMMANDS.search as unknown as {
      flags: Record<string, unknown>;
    };
    expect(semanticSearchCommand.flags.mode).toBeDefined();
    expect(semanticSearchCommand.flags.corpus).toBeDefined();
    expect(semanticSearchCommand.flags["api-base-url"]).toBeDefined();
    expect(semanticSearchCommand.flags["api-base-url-1"]).toBeUndefined();
    expect(semanticSearchCommand.flags["api-base-url-2"]).toBeUndefined();
  });

  it("registers signup commands", () => {
    expect(COMMANDS.signup).toBeDefined();
    expect(COMMANDS["signup:confirm"]).toBeDefined();
    expect(COMMANDS["signup:interactive"]).toBeUndefined();
    expect(COMMANDS["signup:resend"]).toBeDefined();
    expect(COMMANDS["signup:status"]).toBeDefined();
    const signupStatusCommand = COMMANDS["signup:status"] as unknown as {
      flags: Record<string, unknown>;
    };
    expect(signupStatusCommand.flags.json).toBeDefined();
  });

  it("registers login commands without signin/otp duplicates", () => {
    expect(COMMANDS.login).toBeDefined();
    expect(COMMANDS["login:browser"]).toBeDefined();
    expect(COMMANDS["login:confirm"]).toBeDefined();
    expect(COMMANDS["login:resend"]).toBeDefined();
    expect(COMMANDS["login:otp"]).toBeUndefined();
    expect(COMMANDS.otp).toBeUndefined();
    expect(COMMANDS.signin).toBeUndefined();
  });

  it("keeps reply wait flags aligned with the reply API contract", () => {
    const replyCommand = COMMANDS.reply as unknown as {
      flags: Record<string, unknown>;
    };
    expect(replyCommand.flags.wait).toBeDefined();
    expect(replyCommand.flags.attachment).toBeDefined();
    expect(replyCommand.flags["wait-timeout-ms"]).toBeUndefined();
  });

  it("registers the normal function test alias", () => {
    expect(COMMANDS["functions:test"]).toBeDefined();
    expect(COMMANDS["functions:test-function"]).toBeUndefined();
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
    const packageJson = readCliPackageJson();

    expect(packageJson.oclif?.topics?.config?.hidden).toBe(true);
  });

  it("documents the friendly thread command in root help", () => {
    const packageJson = readCliPackageJson();

    expect(packageJson.oclif?.topics?.threads?.description).toContain(
      "primitive threads get --id <thread-id>",
    );
  });

  it("documents active chat replies in root help", () => {
    const packageJson = readCliPackageJson();

    expect(packageJson.oclif?.topics?.chat?.description).toContain(
      "primitive chat reply <message>",
    );
    expect(packageJson.oclif?.topics?.chat?.description).toContain(
      "primitive chat reply <id> <message>",
    );
  });

  it("distinguishes sender domains from recipient-scope send permissions", () => {
    const packageJson = readCliPackageJson();
    const description = packageJson.oclif?.topics?.sending?.description ?? "";

    expect(description).toContain("primitive domains list");
    expect(description).toContain("usable sender domains");
    expect(description).toContain("recipient-scope");
  });

  it("configures daily update warnings", () => {
    const packageJson = readCliPackageJson();
    const updateWarning = packageJson.oclif?.["warn-if-update-available"];

    expect(packageJson.oclif?.plugins ?? []).toContain(
      "@oclif/plugin-warn-if-update-available",
    );
    expect(updateWarning?.timeoutInDays).toBe(1);
    expect(updateWarning?.frequency).toBe(1);
    expect(updateWarning?.frequencyUnit).toBe("days");
    expect(updateWarning?.message).toContain(
      "npm install -g @primitivedotdev/cli@latest",
    );
  });
});
