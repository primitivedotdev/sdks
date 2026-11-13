import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { OPERATION_HINTS } from "../../src/oclif/api-command.js";
import { COMMANDS } from "../../src/oclif/index.js";

type Described = {
  description?: string;
  flags?: Record<string, { description?: string }>;
};

function command(id: string): Described {
  const found = (COMMANDS as Record<string, unknown>)[id];
  if (!found) throw new Error(`missing command ${id}`);
  return found as Described;
}

const topics = (
  JSON.parse(
    readFileSync(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "..",
        "..",
        "package.json",
      ),
      "utf8",
    ),
  ) as { oclif: { topics: Record<string, { description: string }> } }
).oclif.topics;

describe("where the activity and emails help points a reader", () => {
  it("says where a request or objection you made shows its decision", () => {
    expect(command("activity:asked").description).toContain(
      "Requests and objections you made are not here: `primitive activity created --kind email_rule_request,email_rule_objection` lists them",
    );
  });

  it("names the activity commands and doctor in the activity topic", () => {
    const activity = topics.activity?.description ?? "";
    for (const named of [
      "`primitive activity asked`",
      "`primitive activity concerning`",
      "`primitive activity created`",
      "`primitive doctor`",
    ])
      expect(activity).toContain(named);
  });

  it("points emails list to the one-line table", () => {
    expect(topics.emails?.description).toContain(
      "`primitive emails latest --limit 100`",
    );
    expect(OPERATION_HINTS.listEmails).toContain(
      "`primitive emails latest --limit 100`",
    );
  });
});
