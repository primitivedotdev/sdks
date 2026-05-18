import { describe, expect, it } from "vitest";
import { renderFishCompletion } from "../../src/oclif/fish-completion.js";

describe("renderFishCompletion", () => {
  it("includes --envelope for generated JSON commands", () => {
    const completion = renderFishCompletion("primitive");

    expect(completion).toContain(
      "complete -c primitive -n '__fish_primitive_using_operation emails list-emails' -l 'envelope'",
    );
  });

  it("does not include --envelope for generated binary commands", () => {
    const completion = renderFishCompletion("primitive");

    expect(completion).not.toContain(
      "complete -c primitive -n '__fish_primitive_using_operation emails download-raw-email' -l 'envelope'",
    );
  });
});
