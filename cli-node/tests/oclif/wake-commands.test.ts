import { describe, expect, it } from "vitest";
import { COMMANDS } from "../../src/oclif/index.js";

// The wake commands are thin wrappers over the generated api-core functions;
// the contract worth guarding here is that every command is registered under
// its expected key so oclif can resolve `primitive wake ...`.
const WAKE_COMMAND_KEYS = [
  "wake:schedules:list",
  "wake:schedules:create",
  "wake:schedules:get",
  "wake:schedules:update",
  "wake:schedules:delete",
  "wake:schedules:run",
  "wake:authorizations:list",
  "wake:authorizations:create",
  "wake:authorizations:update",
  "wake:authorizations:delete",
  "wake:dispatches:list",
];

describe("wake commands", () => {
  it.each(WAKE_COMMAND_KEYS)("registers %s in the COMMANDS map", (key) => {
    expect(COMMANDS[key]).toBeDefined();
  });

  it("exposes a description on every wake command", () => {
    for (const key of WAKE_COMMAND_KEYS) {
      const command = COMMANDS[key] as { description?: string };
      expect(command.description, key).toBeTruthy();
    }
  });
});
