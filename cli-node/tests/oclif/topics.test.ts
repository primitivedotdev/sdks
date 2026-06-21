import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { openapiDocument } from "@primitivedotdev/api-core";
import { describe, expect, it } from "vitest";
import { CANONICAL_OPERATION_ALIASES } from "../../src/oclif/index.js";

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "-");
}

const HAND_ROLLED_VISIBLE_TOPICS = new Set([
  "chat",
  "login",
  "otp",
  "signin",
  // Hand-rolled org-level secret commands; /v1/org/secrets is not a generated
  // operation, so these topics have no spec tag.
  "org",
  "org:secrets",
]);

describe("oclif topics", () => {
  it("has a topic entry for every spec tag", () => {
    const packageJsonPath = fileURLToPath(
      new URL("../../package.json", import.meta.url),
    );
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      oclif: { topics: Record<string, unknown> };
    };
    const topicKeys = Object.keys(packageJson.oclif.topics);
    const specTags = (openapiDocument.tags as { name: string }[]).map(
      (tag) => tag.name,
    );

    const missing = specTags
      .map((tag) => normalize(tag))
      .filter((normalizedTag) => !topicKeys.includes(normalizedTag));

    expect(missing).toEqual([]);
  });

  it("has a spec tag or canonical alias for every topic entry", () => {
    const packageJsonPath = fileURLToPath(
      new URL("../../package.json", import.meta.url),
    );
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      oclif: { topics: Record<string, { hidden?: boolean }> };
    };
    const visibleTopicKeys = Object.entries(packageJson.oclif.topics)
      .filter(([, topic]) => !topic.hidden)
      .map(([name]) => name);
    const normalizedSpecTags = (openapiDocument.tags as { name: string }[]).map(
      (tag) => normalize(tag.name),
    );
    const aliasTopics = new Set(
      Object.keys(CANONICAL_OPERATION_ALIASES).map((alias) =>
        alias.slice(0, alias.indexOf(":")),
      ),
    );

    const orphans = visibleTopicKeys.filter(
      (topic) =>
        !normalizedSpecTags.includes(topic) &&
        !aliasTopics.has(topic) &&
        !HAND_ROLLED_VISIBLE_TOPICS.has(topic),
    );

    expect(orphans).toEqual([]);
  });
});
