import { describe, expect, it } from "vitest";
import FunctionsTestFunctionCommand from "../../src/oclif/commands/functions-test-function.js";
import { COMMANDS } from "../../src/oclif/index.js";

// Smoke tests for the hand-rolled functions:test-function command.
// Verifies that the override is registered (so the auto-generated
// wrapper does not shadow it) and that the expected --wait /
// --show-sends / --timeout flags are present. The polling behavior
// itself is exercised via the existing emails-poll helpers, which
// have their own coverage in emails-poll.test.ts.

describe("functions:test-function command registration", () => {
  it("registers the hand-rolled command at the functions:test-function id", () => {
    expect(COMMANDS["functions:test-function"]).toBe(
      FunctionsTestFunctionCommand,
    );
  });

  it("exposes the --wait flag described as blocking", () => {
    const flags = FunctionsTestFunctionCommand.flags as Record<
      string,
      { description?: string }
    >;
    expect(flags.wait).toBeDefined();
    expect(flags.wait.description).toMatch(/block/i);
  });

  it("exposes the --show-sends flag that implies --wait", () => {
    const flags = FunctionsTestFunctionCommand.flags as Record<
      string,
      { description?: string }
    >;
    expect(flags["show-sends"]).toBeDefined();
    expect(flags["show-sends"].description).toMatch(/--wait|imply|implies/i);
  });

  it("exposes the --timeout flag with a sane default", () => {
    const flags = FunctionsTestFunctionCommand.flags as Record<
      string,
      { default?: number }
    >;
    expect(flags.timeout).toBeDefined();
    expect(typeof flags.timeout.default).toBe("number");
    expect(flags.timeout.default).toBeGreaterThan(0);
  });

  it("requires --id", () => {
    const flags = FunctionsTestFunctionCommand.flags as Record<
      string,
      { required?: boolean }
    >;
    expect(flags.id.required).toBe(true);
  });

  it("includes the wait + show-sends combo in static examples", () => {
    const examples = FunctionsTestFunctionCommand.examples as string[];
    const joined = examples.join("\n");
    expect(joined).toMatch(/--wait/);
    expect(joined).toMatch(/--show-sends/);
  });
});
