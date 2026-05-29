import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { operationManifest } from "@primitivedotdev/api-core";
import { describe, expect, it } from "vitest";
import {
  isPublicGeneratedOperation,
  publicOperationCommandId,
} from "../../src/oclif/command-surface.js";

const HAND_ROLLED_VISIBLE_TOPICS = new Set([
  "chat",
  "inbox",
  "login",
  "search",
]);

describe("oclif topics", () => {
  it("has a topic entry for every public generated operation topic", () => {
    const packageJsonPath = fileURLToPath(
      new URL("../../package.json", import.meta.url),
    );
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      oclif: { topics: Record<string, unknown> };
    };
    const topicKeys = Object.keys(packageJson.oclif.topics);
    const publicGeneratedTopics = operationManifest
      .filter(isPublicGeneratedOperation)
      .map((operation) =>
        publicOperationCommandId(operation).slice(
          0,
          publicOperationCommandId(operation).indexOf(":"),
        ),
      );

    const missing = [...new Set(publicGeneratedTopics)].filter(
      (topic) => !topicKeys.includes(topic),
    );

    expect(missing).toEqual([]);
  });

  it("has a public operation or hand-rolled command for every visible topic entry", () => {
    const packageJsonPath = fileURLToPath(
      new URL("../../package.json", import.meta.url),
    );
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      oclif: { topics: Record<string, { hidden?: boolean }> };
    };
    const visibleTopicKeys = Object.entries(packageJson.oclif.topics)
      .filter(([, topic]) => !topic.hidden)
      .map(([name]) => name);
    const publicGeneratedTopics = new Set(
      operationManifest
        .filter(isPublicGeneratedOperation)
        .map((operation) =>
          publicOperationCommandId(operation).slice(
            0,
            publicOperationCommandId(operation).indexOf(":"),
          ),
        ),
    );

    const orphans = visibleTopicKeys.filter(
      (topic) =>
        !publicGeneratedTopics.has(topic) &&
        !HAND_ROLLED_VISIBLE_TOPICS.has(topic),
    );

    expect(orphans).toEqual([]);
  });
});
