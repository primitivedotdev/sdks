import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Errors } from "@oclif/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  extractErrorCode,
  extractErrorPayload,
  flagForParameter,
  formatErrorPayload,
  readJsonBody,
  writeErrorWithHints,
} from "../../src/oclif/api-command.js";

describe("formatErrorPayload", () => {
  it("wraps a fetch TypeError into a code/message payload instead of {}", () => {
    const error = new TypeError("fetch failed");
    Object.assign(error, { cause: { code: "ENOTFOUND" } });

    const output = formatErrorPayload(error);
    const parsed = JSON.parse(output);

    expect(parsed).toEqual({
      cause: { code: "ENOTFOUND" },
      code: "ENOTFOUND",
      message: "fetch failed",
    });
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

  it("surfaces additional scalar cause details (hostname, port, syscall)", () => {
    const error = new TypeError("fetch failed");
    Object.assign(error, {
      cause: {
        address: "127.0.0.1",
        code: "ECONNREFUSED",
        errno: -61,
        hostname: "127.0.0.1",
        port: 59999,
        syscall: "connect",
      },
    });

    const parsed = JSON.parse(formatErrorPayload(error));

    expect(parsed).toEqual({
      cause: {
        address: "127.0.0.1",
        code: "ECONNREFUSED",
        errno: -61,
        hostname: "127.0.0.1",
        port: 59999,
        syscall: "connect",
      },
      code: "ECONNREFUSED",
      message: "fetch failed",
    });
  });

  it("omits the cause field entirely when cause has no scalar properties", () => {
    const error = new Error("plain error");

    const parsed = JSON.parse(formatErrorPayload(error));

    expect(parsed).not.toHaveProperty("cause");
  });
});

describe("extractErrorPayload", () => {
  it("unwraps a well-formed envelope with an inner error object", () => {
    const envelope = { error: { code: "unauthorized", message: "nope" } };

    expect(extractErrorPayload(envelope)).toEqual({
      code: "unauthorized",
      message: "nope",
    });
  });

  it("returns the whole envelope when the inner error is null", () => {
    const envelope = { error: null };

    expect(extractErrorPayload(envelope)).toBe(envelope);
  });

  it("returns the whole envelope when the inner error is undefined", () => {
    const envelope = { error: undefined };

    expect(extractErrorPayload(envelope)).toBe(envelope);
  });

  it("returns an Error instance unchanged (does not attempt to unwrap)", () => {
    const error = new TypeError("fetch failed");

    expect(extractErrorPayload(error)).toBe(error);
  });

  it("returns plain objects without an error key unchanged", () => {
    const payload = { code: "validation_error", message: "bad input" };

    expect(extractErrorPayload(payload)).toBe(payload);
  });

  it("passes through null, undefined, and primitive values", () => {
    expect(extractErrorPayload(null)).toBeNull();
    expect(extractErrorPayload(undefined)).toBeUndefined();
    expect(extractErrorPayload("oops")).toBe("oops");
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

  it("parses a valid --raw-body string", () => {
    expect(readJsonBody({ "raw-body": '{"ok":true}' })).toEqual({ ok: true });
  });

  it("parses a valid --body-file contents", () => {
    const path = join(tempDir, "body.json");
    writeFileSync(path, '{"from":"file"}');

    expect(readJsonBody({ "body-file": path })).toEqual({ from: "file" });
  });

  it("throws a friendly CLIError on invalid --raw-body JSON", () => {
    expect(() => readJsonBody({ "raw-body": "not json" })).toThrow(
      Errors.CLIError,
    );
    expect(() => readJsonBody({ "raw-body": "not json" })).toThrow(
      /--raw-body is not valid JSON/,
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

  it("rejects combining --raw-body and --body-file", () => {
    expect(() =>
      readJsonBody({ "raw-body": "{}", "body-file": "/tmp/x.json" }),
    ).toThrow(/Use either --raw-body or --body-file/);
  });

  it("ignores the legacy --body flag (no longer the JSON escape hatch)", () => {
    // Pre-0.12 the JSON escape hatch was --body. To make `primitive
    // send --body "..."` mean the message body consistently
    // everywhere, that escape hatch was renamed to --raw-body.
    // The CLI no longer reads --body as JSON; if someone passes
    // it on a generated command, it's just an unknown flag.
    expect(readJsonBody({ body: '{"ok":true}' })).toBeUndefined();
  });
});

describe("extractErrorCode", () => {
  it("reads code from a well-formed envelope", () => {
    expect(
      extractErrorCode({ error: { code: "unauthorized", message: "nope" } }),
    ).toBe("unauthorized");
  });

  it("reads code from a flat payload", () => {
    expect(extractErrorCode({ code: "validation_error" })).toBe(
      "validation_error",
    );
  });

  it("reads code from an Error's cause.code", () => {
    const error = new TypeError("fetch failed");
    Object.assign(error, { cause: { code: "ENOTFOUND" } });

    expect(extractErrorCode(error)).toBe("ENOTFOUND");
  });

  it("returns undefined when no code is present", () => {
    expect(extractErrorCode({ message: "no code here" })).toBeUndefined();
    expect(extractErrorCode(new Error("no cause"))).toBeUndefined();
  });

  it("returns undefined for null, undefined, primitives", () => {
    expect(extractErrorCode(null)).toBeUndefined();
    expect(extractErrorCode(undefined)).toBeUndefined();
    expect(extractErrorCode("oops")).toBeUndefined();
    expect(extractErrorCode(42)).toBeUndefined();
  });

  it("ignores non-string code values", () => {
    expect(extractErrorCode({ error: { code: 500 } })).toBeUndefined();
    expect(extractErrorCode({ code: 42 })).toBeUndefined();
  });

  it("prefers the envelope-inner code over a same-level one", () => {
    // `{ error: { code }, code }` is unusual but well-defined: the
    // server envelope is the source of truth.
    expect(
      extractErrorCode({
        code: "outer",
        error: { code: "inner" },
      }),
    ).toBe("inner");
  });
});

describe("writeErrorWithHints", () => {
  let writes: string[];
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writes = [];
    writeSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((chunk: unknown) => {
        writes.push(typeof chunk === "string" ? chunk : String(chunk));
        return true;
      });
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it("writes the formatted payload to stderr", () => {
    writeErrorWithHints({ code: "validation_error", message: "bad input" });

    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0] ?? "")).toEqual({
      code: "validation_error",
      message: "bad input",
    });
  });

  it("appends an unauthorized hint pointing at --api-key and whoami", () => {
    writeErrorWithHints({
      error: { code: "unauthorized", message: "Invalid API key" },
    });

    expect(writes).toHaveLength(2);
    expect(writes[1]).toContain("--api-key");
    expect(writes[1]).toContain("PRIMITIVE_API_KEY");
    expect(writes[1]).toContain("whoami");
  });

  it("does not append a hint for codes without a registered message", () => {
    writeErrorWithHints({
      error: { code: "validation_error", message: "bad input" },
    });

    expect(writes).toHaveLength(1);
  });

  it("does not append a hint when no code can be extracted", () => {
    writeErrorWithHints({ message: "mystery failure" });

    expect(writes).toHaveLength(1);
  });

  it("appends the unauthorized hint when given an Error with cause.code=unauthorized", () => {
    const error = new Error("Invalid API key");
    Object.assign(error, { cause: { code: "unauthorized" } });

    writeErrorWithHints(error);

    expect(writes).toHaveLength(2);
    expect(writes[1]).toContain("--api-key");
  });
});

describe("flagForParameter", () => {
  it("returns a string flag without options when no enum is set", () => {
    const flag = flagForParameter({
      description: "Free-form filter",
      enum: null,
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
