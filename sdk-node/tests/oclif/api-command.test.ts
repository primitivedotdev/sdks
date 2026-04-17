import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Errors } from "@oclif/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  flagForParameter,
  formatErrorPayload,
  readJsonBody,
} from "../../src/oclif/api-command.js";

describe("formatErrorPayload", () => {
  it("wraps a fetch TypeError into a code/message payload instead of {}", () => {
    const error = new TypeError("fetch failed");
    Object.assign(error, { cause: { code: "ENOTFOUND" } });

    const output = formatErrorPayload(error);
    const parsed = JSON.parse(output);

    expect(parsed).toEqual({ code: "ENOTFOUND", message: "fetch failed" });
  });

  it("falls back to client_error when no cause code is present", () => {
    const error = new Error("something went wrong");

    const parsed = JSON.parse(formatErrorPayload(error));

    expect(parsed).toEqual({
      code: "client_error",
      message: "something went wrong",
    });
  });

  it("preserves existing plain-object error envelopes", () => {
    const payload = { code: "unauthorized", message: "Invalid API key" };

    const parsed = JSON.parse(formatErrorPayload(payload));

    expect(parsed).toEqual(payload);
  });
});

describe("readJsonBody", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "primitive-cli-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  it("returns undefined when neither flag is provided", () => {
    expect(readJsonBody({})).toBeUndefined();
  });

  it("parses a valid --body string", () => {
    expect(readJsonBody({ body: '{"ok":true}' })).toEqual({ ok: true });
  });

  it("parses a valid --body-file contents", () => {
    const path = join(tempDir, "body.json");
    writeFileSync(path, '{"from":"file"}');

    expect(readJsonBody({ "body-file": path })).toEqual({ from: "file" });
  });

  it("throws a friendly CLIError on invalid --body JSON", () => {
    expect(() => readJsonBody({ body: "not json" })).toThrow(Errors.CLIError);
    expect(() => readJsonBody({ body: "not json" })).toThrow(
      /--body is not valid JSON/,
    );
  });

  it("throws a friendly CLIError when --body-file does not exist", () => {
    const path = join(tempDir, "does-not-exist.json");
    expect(() => readJsonBody({ "body-file": path })).toThrow(Errors.CLIError);
    expect(() => readJsonBody({ "body-file": path })).toThrow(
      /Could not read --body-file/,
    );
  });

  it("throws a friendly CLIError when --body-file contains invalid JSON", () => {
    const path = join(tempDir, "bad.json");
    writeFileSync(path, "{not json");

    expect(() => readJsonBody({ "body-file": path })).toThrow(Errors.CLIError);
    expect(() => readJsonBody({ "body-file": path })).toThrow(
      /is not valid JSON/,
    );
  });

  it("rejects combining --body and --body-file", () => {
    expect(() =>
      readJsonBody({ body: "{}", "body-file": "/tmp/x.json" }),
    ).toThrow(/Use either --body or --body-file/);
  });
});

describe("flagForParameter", () => {
  it("returns a string flag without options when no enum is set", () => {
    const flag = flagForParameter({
      description: "Free-form filter",
      name: "search",
      required: false,
      type: "string",
    }) as { options?: readonly string[] };

    expect(flag.options).toBeUndefined();
  });

  it("surfaces enum values as oclif options for client-side validation", () => {
    const flag = flagForParameter({
      description: "Filter by email status",
      enum: ["pending", "accepted", "completed", "rejected"],
      name: "status",
      required: false,
      type: "string",
    }) as { options?: readonly string[] };

    expect(flag.options).toEqual([
      "pending",
      "accepted",
      "completed",
      "rejected",
    ]);
  });

  it("ignores empty enum arrays", () => {
    const flag = flagForParameter({
      description: "Unused",
      enum: [],
      name: "noop",
      required: false,
      type: "string",
    }) as { options?: readonly string[] };

    expect(flag.options).toBeUndefined();
  });
});
