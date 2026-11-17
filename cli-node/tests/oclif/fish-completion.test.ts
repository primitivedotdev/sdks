import { describe, expect, it } from "vitest";
import { renderFishCompletion } from "../../src/oclif/fish-completion.js";
import { COMMANDS } from "../../src/oclif/index.js";

describe("renderFishCompletion", () => {
  it("uses canonical command paths, nested org commands, and distinct sample flags", () => {
    const completion = renderFishCompletion("primitive", COMMANDS);
    expect(completion).toContain(
      "__fish_primitive_using_operation email-rules create",
    );
    expect(completion).toContain("__fish_primitive_using_operation org list");
    expect(completion).toContain("-l 'scope'");
    expect(completion).toContain("-l 'samples-file'");
    expect(completion).toContain("-l 'add-samples-file'");
    expect(completion).toContain("-l 'expect-samples-file'");
    for (const retired of [
      "create-email-rule",
      "get-email",
      "orgs",
      "evaluation-scope",
      "expectation-samples-file",
      "add-expectation-samples-file",
    ])
      expect(completion).not.toContain(`'${retired}'`);
  });

  it("limits parent flags to the parent when a registered child is selected", () => {
    const completion = renderFishCompletion("primitive", COMMANDS);
    const rows = completion.split("\n");
    for (const [parent, child, parentFlag] of [
      ["listen", "listen init", "background"],
      ["signup", "signup confirm", "accept-terms"],
    ]) {
      const parentRows = rows.filter((row) =>
        row.includes(`-n '__fish_primitive_using_operation ${parent};`),
      );
      expect(parentRows.length, parent).toBeGreaterThan(0);
      for (const row of parentRows)
        expect(row, parent).toContain(
          `; and not __fish_primitive_using_operation ${child}`,
        );
      expect(
        parentRows.some((row) => row.includes(`-l '${parentFlag}'`)),
        parent,
      ).toBe(true);
      const childRows = rows.filter((row) =>
        row.includes(`-n '__fish_primitive_using_operation ${child}'`),
      );
      expect(childRows.length, child).toBeGreaterThan(0);
      expect(
        childRows.some((row) => row.includes(`-l '${parentFlag}'`)),
        child,
      ).toBe(false);
    }
  });

  it("does not advertise the hidden config root through its visible descendants", () => {
    const completion = renderFishCompletion("primitive", COMMANDS, [
      { name: "config", hidden: true },
    ]);
    expect(completion).not.toContain(
      "-n '__fish_primitive_needs_command' -a 'config'",
    );
    expect(completion).toContain(
      "__fish_primitive_topic_needs_subcommand config",
    );
  });

  it("includes --json without a removed --envelope flag for generated JSON commands", () => {
    const completion = renderFishCompletion("primitive", COMMANDS);

    expect(completion).toContain(
      "complete -c primitive -n '__fish_primitive_using_operation emails list' -l 'json'",
    );
    expect(completion).not.toContain("-l 'envelope'");
  });

  it("does not include --envelope for generated binary commands", () => {
    const completion = renderFishCompletion("primitive", COMMANDS);

    expect(completion).not.toContain(
      "complete -c primitive -n '__fish_primitive_using_operation emails download-raw' -l 'envelope'",
    );
  });

  it("completes declared request headers such as --idempotency-key", () => {
    const completion = renderFishCompletion("primitive", COMMANDS);

    expect(completion).toContain(
      "complete -c primitive -n '__fish_primitive_using_operation sending send' -l 'idempotency-key' -r",
    );
  });
});
