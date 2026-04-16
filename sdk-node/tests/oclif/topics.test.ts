import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { openapiDocument } from "../../src/openapi/index.js";

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "-");
}

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

  it("has a spec tag for every topic entry", () => {
    const packageJsonPath = fileURLToPath(
      new URL("../../package.json", import.meta.url),
    );
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      oclif: { topics: Record<string, unknown> };
    };
    const topicKeys = Object.keys(packageJson.oclif.topics);
    const normalizedSpecTags = (openapiDocument.tags as { name: string }[]).map(
      (tag) => normalize(tag.name),
    );

    const orphans = topicKeys.filter(
      (topic) => !normalizedSpecTags.includes(topic),
    );

    expect(orphans).toEqual([]);
  });
});
