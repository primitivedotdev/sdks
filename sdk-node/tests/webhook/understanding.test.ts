import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { matchedRules as matchedRulesFromApi } from "../../src/api/index.js";
import {
  type EmailReceivedEvent,
  matchedRules,
  type UnderstandingRule,
} from "../../src/index.js";
import { matchedRules as matchedRulesFromWebhook } from "../../src/webhook/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEvent(): EmailReceivedEvent {
  return JSON.parse(
    readFileSync(
      join(
        __dirname,
        "../../../test-fixtures/webhook/valid-email-received.json",
      ),
      "utf8",
    ),
  ) as EmailReceivedEvent;
}

// A Functions handler reads its event from `await req.json()` without
// validating it, so the rules array can hold anything.
function withUnvalidatedRules(rules: unknown): EmailReceivedEvent {
  const event = loadEvent();
  event.email.analysis = {
    understanding: { version: 1, status: "ready", rules },
  } as unknown as EmailReceivedEvent["email"]["analysis"];
  return event;
}

describe("matchedRules", () => {
  it("is exported from the root, /webhook and /api entry points", () => {
    expect(matchedRulesFromWebhook).toBe(matchedRules);
    expect(matchedRulesFromApi).toBe(matchedRules);
  });

  it("keeps only entries with a string rule id", () => {
    const rule: UnderstandingRule = { id: "rule_1", name: "Applicants" };
    const event = withUnvalidatedRules([
      null,
      "rule_0",
      { name: "No id" },
      { id: 7, name: "Numeric id" },
      { id: "", name: "Empty id" },
      rule,
    ]);

    expect(matchedRules(event)).toEqual([rule]);
    expect(matchedRules(event, "rule_1")).toEqual([rule]);
  });

  it("treats a null rule id as no filter", () => {
    const rules: UnderstandingRule[] = [{ id: "rule_1" }, { id: "rule_2" }];
    const event = withUnvalidatedRules(rules);

    expect(matchedRules(event, null)).toEqual(rules);
    expect(matchedRules(event, undefined)).toEqual(rules);
    expect(matchedRules(event, "rule_2")).toEqual([{ id: "rule_2" }]);
  });

  it("returns an empty array when rules is not an array", () => {
    expect(matchedRules(withUnvalidatedRules({ id: "rule_1" }))).toEqual([]);
  });

  it("returns an empty array when the event has no analysis", () => {
    const event = loadEvent();
    delete (event.email as { analysis?: unknown }).analysis;

    expect(matchedRules(event)).toEqual([]);
  });

  it("returns a new array rather than the event's own", () => {
    const rule: UnderstandingRule = { id: "rule_1" };
    const event = withUnvalidatedRules([rule]);
    const matched = matchedRules(event);

    matched.pop();

    expect(event.email.analysis.understanding?.rules).toEqual([rule]);
  });
});
