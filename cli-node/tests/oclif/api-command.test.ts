import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Errors } from "@oclif/core";
import type { PrimitiveOperationManifest } from "@primitivedotdev/api-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createOperationCommand,
  EMPTY_RESULT_HINTS,
  extractErrorCode,
  extractErrorPayload,
  flagForParameter,
  formatElapsed,
  formatErrorPayload,
  isIncompleteDomainVerification,
  OPERATION_HINTS,
  OPERATION_SUCCESS_HOOKS,
  operationOutputPayload,
  readJsonBody,
  runWithTiming,
  surfaceUnauthorizedHint,
  writeErrorWithHints,
} from "../../src/oclif/api-command.js";
import {
  loadCliCredentials,
  type StoredCliCredentials,
  saveCliCredentials,
} from "../../src/oclif/auth.js";

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

  it("appends a NODE_USE_ENV_PROXY hint for ENETUNREACH network failures", () => {
    // AGX walkthrough symptom: agent's shell exports HTTPS_PROXY but
    // Node 22+ ignores it without NODE_USE_ENV_PROXY=1; the bare
    // envelope says ENETUNREACH and nothing else. The hint shortcuts
    // the right next step.
    const error = new Error("fetch failed");
    Object.assign(error, { cause: { code: "ENETUNREACH" } });

    writeErrorWithHints(error);

    expect(writes).toHaveLength(2);
    expect(writes[1]).toContain("NODE_USE_ENV_PROXY=1");
    expect(writes[1]).toContain("primitive doctor");
  });

  it("appends a connection-refused hint for ECONNREFUSED", () => {
    const error = new Error("fetch failed");
    Object.assign(error, { cause: { code: "ECONNREFUSED" } });

    writeErrorWithHints(error);

    expect(writes).toHaveLength(2);
    expect(writes[1]).toMatch(/egress|firewall|proxy/i);
  });

  it("appends a DNS hint for EAI_AGAIN", () => {
    const error = new Error("fetch failed");
    Object.assign(error, { cause: { code: "EAI_AGAIN" } });

    writeErrorWithHints(error);

    expect(writes).toHaveLength(2);
    expect(writes[1]).toMatch(/DNS/);
  });

  it("appends a connection-timeout hint for ETIMEDOUT", () => {
    const error = new Error("fetch failed");
    Object.assign(error, { cause: { code: "ETIMEDOUT" } });

    writeErrorWithHints(error);

    expect(writes).toHaveLength(2);
    expect(writes[1]).toMatch(/timed out/);
    expect(writes[1]).toMatch(/NODE_USE_ENV_PROXY=1/);
  });
});

describe("surfaceUnauthorizedHint", () => {
  const credentials: StoredCliCredentials = {
    access_token: "prim_oat_stale",
    api_base_url: "https://api.primitive.dev/v1",
    auth_method: "oauth",
    created_at: "2026-05-05T00:00:00.000Z",
    expires_at: "2099-05-05T00:00:00.000Z",
    oauth_client_id: "primitive-cli",
    oauth_grant_id: "11111111-1111-4111-8111-111111111111",
    org_id: "22222222-2222-4222-8222-222222222222",
    org_name: "Acme",
    refresh_token: "prim_ort_stale",
    token_type: "Bearer",
  };

  let tempDir: string;
  let writes: string[];
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "primitive-cli-stale-auth-test-"));
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
    rmSync(tempDir, { force: true, recursive: true });
  });

  it("does NOT delete saved credentials on a 401, just prints a hint", () => {
    saveCliCredentials(tempDir, credentials);

    surfaceUnauthorizedHint({
      auth: {
        apiKey: credentials.access_token,
        apiBaseUrl: credentials.api_base_url,
        credentials,
        source: "stored",
      },
      baseUrlOverridden: false,
      configDir: tempDir,
      payload: { code: "unauthorized", message: "Invalid API key" },
    });

    expect(loadCliCredentials(tempDir)).toEqual(credentials);
    expect(writes.join("")).toContain(
      "Your saved Primitive CLI OAuth session was rejected",
    );
    expect(writes.join("")).toContain("primitive logout && primitive signin");
  });

  it("warns about overridden base URL when saved URL differs and preserves credentials", () => {
    saveCliCredentials(tempDir, credentials);

    surfaceUnauthorizedHint({
      auth: {
        apiKey: credentials.access_token,
        apiBaseUrl: "http://localhost:8787/v1",
        credentials,
        source: "stored",
      },
      baseUrlOverridden: true,
      configDir: tempDir,
      payload: { code: "unauthorized", message: "Invalid API key" },
    });

    expect(loadCliCredentials(tempDir)).toEqual(credentials);
    expect(writes.join("")).toContain("saved credential is preserved");
    expect(writes.join("")).toContain("primitive config reset");
  });

  it("ignores non-auth errors", () => {
    saveCliCredentials(tempDir, credentials);

    surfaceUnauthorizedHint({
      auth: {
        apiKey: credentials.access_token,
        apiBaseUrl: credentials.api_base_url,
        credentials,
        source: "stored",
      },
      baseUrlOverridden: false,
      configDir: tempDir,
      payload: { code: "validation_error", message: "Bad request" },
    });

    expect(loadCliCredentials(tempDir)).toEqual(credentials);
    expect(writes).toEqual([]);
  });

  it("ignores 401s when auth came from --api-key or env (not the saved file)", () => {
    saveCliCredentials(tempDir, credentials);

    surfaceUnauthorizedHint({
      auth: {
        apiKey: "prim_from_env",
        apiBaseUrl: credentials.api_base_url,
        credentials: null,
        source: "flag-or-env",
      },
      baseUrlOverridden: false,
      configDir: tempDir,
      payload: { code: "unauthorized", message: "Invalid API key" },
    });

    expect(loadCliCredentials(tempDir)).toEqual(credentials);
    expect(writes).toEqual([]);
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

  it("passes integer constraints and defaults through to oclif", () => {
    const flag = flagForParameter({
      default: 50,
      description: "Number of results per page",
      enum: null,
      maximum: 100,
      minimum: 1,
      name: "limit",
      required: false,
      type: "integer",
    }) as { default?: number; max?: number; min?: number };

    expect(flag.default).toBe(50);
    expect(flag.min).toBe(1);
    expect(flag.max).toBe(100);
  });

  it("uses a number parser for decimal parameters", async () => {
    const flag = flagForParameter({
      description: "Spam threshold",
      enum: null,
      maximum: 15,
      minimum: 0,
      name: "spam_score_lt",
      required: false,
      type: "number",
    }) as {
      max?: number;
      min?: number;
      parse: (
        input: string,
        context: unknown,
        options: unknown,
      ) => Promise<number>;
    };

    expect(flag.min).toBe(0);
    expect(flag.max).toBe(15);
    await expect(flag.parse("10.5", {}, flag)).resolves.toBe(10.5);
    await expect(flag.parse("", {}, flag)).rejects.toThrow(/Expected a number/);
    await expect(flag.parse("   ", {}, flag)).rejects.toThrow(
      /Expected a number/,
    );
    await expect(flag.parse("nope", {}, flag)).rejects.toThrow(
      /Expected a number/,
    );
    await expect(flag.parse("-1", {}, flag)).rejects.toThrow(
      /greater than or equal to 0/,
    );
    await expect(flag.parse("20", {}, flag)).rejects.toThrow(
      /less than or equal to 15/,
    );
  });
});

describe("formatElapsed", () => {
  it("formats sub-second durations with 2 decimals", () => {
    expect(formatElapsed(180)).toBe("0.18s");
    expect(formatElapsed(0)).toBe("0.00s");
  });

  it("rounds up to 1.00s at the sub-second/second boundary", () => {
    // 999ms is numerically sub-second, but toFixed(2) rounds 0.999
    // to 1.00, so the rendered string crosses the second boundary.
    // Pinned in its own test to make the rounding behavior explicit
    // rather than burying it in the sub-second group.
    expect(formatElapsed(999)).toBe("1.00s");
  });

  it("formats seconds with 2 decimals", () => {
    expect(formatElapsed(1340)).toBe("1.34s");
    expect(formatElapsed(12345)).toBe("12.35s");
  });

  it("switches to minute notation past 60s", () => {
    expect(formatElapsed(60_000)).toBe("1m 0.00s");
    expect(formatElapsed(83_500)).toBe("1m 23.50s");
    expect(formatElapsed(125_000)).toBe("2m 5.00s");
  });
});

describe("runWithTiming", () => {
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

  it("returns the function value when timing disabled and writes nothing", async () => {
    const result = await runWithTiming(false, async () => 42);
    expect(result).toBe(42);
    expect(writes).toHaveLength(0);
  });

  it("returns the function value when timing flag is undefined", async () => {
    const result = await runWithTiming(undefined, async () => "ok");
    expect(result).toBe("ok");
    expect(writes).toHaveLength(0);
  });

  it("writes a single timing line to stderr when enabled", async () => {
    const result = await runWithTiming(true, async () => "done");
    expect(result).toBe("done");
    expect(writes).toHaveLength(1);
    // Pattern accepts both second-format (`0.18s`) and minute-format
    // (`1m 23.50s`); tests run in milliseconds so the minute branch
    // is essentially unreachable, but matching it future-proofs the
    // assertion against any future format change.
    expect(writes[0]).toMatch(/^\[time: (?:\d+m )?\d+\.\d{2}s\]\n$/);
  });

  it("writes the timing line even if the function throws (so errors are still timed)", async () => {
    await expect(
      runWithTiming(true, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(writes).toHaveLength(1);
    // Pattern accepts both second-format (`0.18s`) and minute-format
    // (`1m 23.50s`); tests run in milliseconds so the minute branch
    // is essentially unreachable, but matching it future-proofs the
    // assertion against any future format change.
    expect(writes[0]).toMatch(/^\[time: (?:\d+m )?\d+\.\d{2}s\]\n$/);
  });
});

describe("operationOutputPayload", () => {
  it("keeps generated command stdout backward-compatible by default", () => {
    expect(
      operationOutputPayload(
        { data: [{ id: "email-1" }], meta: { cursor: "next" } },
        false,
      ),
    ).toEqual([{ id: "email-1" }]);
  });

  it("returns the full envelope when --envelope is requested", () => {
    const envelope = { data: [{ id: "email-1" }], meta: { cursor: "next" } };

    expect(operationOutputPayload(envelope, true)).toEqual(envelope);
  });
});

describe("isIncompleteDomainVerification", () => {
  it("treats verified false from verifyDomain as an incomplete CLI result", () => {
    expect(
      isIncompleteDomainVerification(
        {
          binaryResponse: false,
          bodyRequired: false,
          command: "verify",
          description: "Verify domain",
          hasJsonBody: false,
          method: "POST",
          operationId: "verifyDomain",
          path: "/domains/{id}/verify",
          pathParams: [],
          queryParams: [],
          requestSchema: null,
          responseSchema: null,
          sdkName: "verifyDomain",
          summary: "Verify domain",
          tag: "Domains",
          tagCommand: "domains",
        },
        { data: { verified: false } },
      ),
    ).toBe(true);
  });
});

describe("OPERATION_HINTS", () => {
  // The hint set is small and curated. Pin each entry to a known
  // shortcut command so a typo or accidental rename in
  // api-command.ts surfaces here instead of as a silently broken
  // hint in --help output. Add a row whenever a new shortcut is
  // introduced; the matching keys in the index.ts COMMANDS map are
  // the authoritative shortcut surface.
  it("points each generated op at its hand-rolled shortcut command", () => {
    expect(OPERATION_HINTS.addDomain).toContain("domains zone-file");
    expect(OPERATION_HINTS.verifyDomain).toContain("domains zone-file");
    expect(OPERATION_HINTS.downloadDomainZoneFile).toContain(
      "domains zone-file",
    );
    expect(OPERATION_HINTS.getInboxStatus).toContain("inbox status");
    expect(OPERATION_HINTS.getSendPermissions).toContain("where you may send");
    expect(OPERATION_HINTS.getSendPermissions).toContain("domains list");
    expect(OPERATION_HINTS.sendEmail).toContain("primitive send");
    expect(OPERATION_HINTS.sendEmail).toContain("--attachment");
    expect(OPERATION_HINTS.createFunction).toContain("functions deploy");
    expect(OPERATION_HINTS.updateFunction).toContain("functions redeploy");
    expect(OPERATION_HINTS.createFunctionSecret).toContain(
      "functions set-secret",
    );
    expect(OPERATION_HINTS.setFunctionSecret).toContain("functions set-secret");
  });
});

describe("EMPTY_RESULT_HINTS", () => {
  it("guides an empty functions list toward setup commands", () => {
    expect(EMPTY_RESULT_HINTS.listFunctions).toContain("functions templates");
    expect(EMPTY_RESULT_HINTS.listFunctions).toContain("functions init");
    expect(EMPTY_RESULT_HINTS.listFunctions).toContain("functions deploy");
  });
});

describe("createOperationCommand description", () => {
  // Helper: minimal manifest entry so the description rendering is
  // exercised in isolation. createOperationCommand reads only the
  // fields touched here; the rest of the manifest shape is only
  // needed by run(), which the test never invokes.
  function makeOperation(
    overrides: Partial<PrimitiveOperationManifest> = {},
  ): PrimitiveOperationManifest {
    const base: PrimitiveOperationManifest = {
      binaryResponse: false,
      bodyRequired: false,
      command: "fake-op",
      description: "Fake operation",
      hasJsonBody: false,
      method: "GET",
      operationId: "fakeOp",
      path: "/fake",
      pathParams: [],
      queryParams: [],
      requestSchema: null,
      responseSchema: null,
      sdkName: "fakeOp",
      summary: "Fake operation",
      tag: "Fake",
      tagCommand: "fake",
    };
    return { ...base, ...overrides };
  }

  it("appends the hint to the description when sdkName matches OPERATION_HINTS", () => {
    const op = makeOperation({
      description: "Update and redeploy a function",
      sdkName: "updateFunction",
    });
    const Cmd = createOperationCommand(op) as unknown as {
      description: string;
    };
    expect(Cmd.description).toContain("Update and redeploy a function");
    expect(Cmd.description).toContain("functions redeploy --id");
  });

  it("leaves the description untouched for operations without a hint", () => {
    const op = makeOperation({
      description: "No-shortcut operation",
      sdkName: "someOtherOperation",
    });
    const Cmd = createOperationCommand(op) as unknown as {
      description: string;
    };
    expect(Cmd.description).toBe("No-shortcut operation");
  });

  it("renders canonical command names in generated descriptions", () => {
    const op = makeOperation({
      description:
        "Use `primitive emails:latest` and `primitive describe emails:get-email | jq '.responseSchema.properties'`.",
    });
    const Cmd = createOperationCommand(op) as unknown as {
      description: string;
    };
    expect(Cmd.description).toContain("`primitive emails latest`");
    expect(Cmd.description).toContain("`primitive describe emails:get | jq");
    expect(Cmd.description).not.toContain("emails:latest");
    expect(Cmd.description).not.toContain("emails:get-email");
  });

  it("carries numeric constraints into generated decimal body flags", async () => {
    const op = makeOperation({
      hasJsonBody: true,
      method: "PATCH",
      requestSchema: {
        properties: {
          spam_threshold: {
            description: "Spam threshold",
            maximum: 15,
            minimum: 0,
            type: ["number", "null"],
          },
        },
        type: "object",
      },
    });
    const Cmd = createOperationCommand(op) as unknown as {
      flags: Record<string, unknown>;
    };
    const flag = Cmd.flags["spam-threshold"] as {
      max?: number;
      min?: number;
      parse: (
        input: string,
        context: unknown,
        options: unknown,
      ) => Promise<number>;
    };

    expect(flag.min).toBe(0);
    expect(flag.max).toBe(15);
    await expect(flag.parse("10.5", {}, flag)).resolves.toBe(10.5);
    await expect(flag.parse("20", {}, flag)).rejects.toThrow(
      /less than or equal to 15/,
    );
  });

  it("carries numeric constraints into generated integer body flags", () => {
    const op = makeOperation({
      hasJsonBody: true,
      method: "POST",
      requestSchema: {
        properties: {
          wait_timeout_ms: {
            description: "Wait timeout",
            maximum: 30000,
            minimum: 1000,
            type: "integer",
          },
        },
        type: "object",
      },
    });
    const Cmd = createOperationCommand(op) as unknown as {
      flags: Record<string, unknown>;
    };
    const flag = Cmd.flags["wait-timeout-ms"] as {
      max?: number;
      min?: number;
    };

    expect(flag.min).toBe(1000);
    expect(flag.max).toBe(30000);
  });

  it("allows generated boolean body flags to be negated", () => {
    const op = makeOperation({
      hasJsonBody: true,
      method: "PATCH",
      requestSchema: {
        properties: {
          enabled: {
            description: "Enable or disable the filter",
            type: "boolean",
          },
        },
        required: ["enabled"],
        type: "object",
      },
    });
    const Cmd = createOperationCommand(op) as unknown as {
      flags: Record<string, unknown>;
    };
    const flag = Cmd.flags.enabled as {
      allowNo?: boolean;
    };

    expect(flag.allowNo).toBe(true);
  });

  it("adds --envelope to non-binary generated commands", () => {
    const Cmd = createOperationCommand(makeOperation()) as unknown as {
      flags: Record<string, unknown>;
    };

    expect(Cmd.flags.envelope).toBeDefined();
  });

  it("does not add --envelope to binary download commands", () => {
    const Cmd = createOperationCommand(
      makeOperation({ binaryResponse: true }),
    ) as unknown as {
      flags: Record<string, unknown>;
    };

    expect(Cmd.flags.envelope).toBeUndefined();
  });
});

describe("OPERATION_SUCCESS_HOOKS.verifyAgentSignup", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "primitive-cli-verify-hook-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  // Mirrors the AgentSignupVerifyResult shape on the wire. Only the
  // fields saveSignupCredentials reads are included; everything else
  // is irrelevant to the hook's contract.
  const SIGNUP_RESPONSE = {
    access_token: "prim_oat_test_access",
    refresh_token: "prim_ort_test_refresh",
    token_type: "Bearer" as const,
    expires_in: 3600,
    auth_method: "oauth" as const,
    oauth_client_id: "client-test",
    oauth_grant_id: "00000000-0000-0000-0000-000000000001",
    org_id: "00000000-0000-0000-0000-000000000002",
    org_name: "test workspace",
    api_key: "prim_test_api_key",
    key_id: "00000000-0000-0000-0000-000000000003",
    key_prefix: "prim_test",
    orgs: [
      {
        id: "00000000-0000-0000-0000-000000000002",
        name: "test workspace",
      },
    ],
  };

  it("persists OAuth tokens to credentials.json so whoami works on the next call", () => {
    const stderr: string[] = [];
    OPERATION_SUCCESS_HOOKS.verifyAgentSignup({
      envelope: { data: SIGNUP_RESPONSE },
      configDir: tempDir,
      apiBaseUrl: "https://api.primitive.dev",
      writeStderr: (chunk) => stderr.push(chunk),
    });

    const persisted = loadCliCredentials(tempDir);
    expect(persisted).not.toBeNull();
    expect(persisted?.access_token).toBe(SIGNUP_RESPONSE.access_token);
    expect(persisted?.refresh_token).toBe(SIGNUP_RESPONSE.refresh_token);
    expect(persisted?.api_base_url).toBe("https://api.primitive.dev");
    expect(persisted?.org_id).toBe(SIGNUP_RESPONSE.org_id);
    expect(persisted?.auth_method).toBe("oauth");
    expect(stderr.join("")).toContain("Credentials saved to the CLI config");
  });

  it("is a defensive no-op when the response envelope has no token fields", () => {
    // verifyAgentSignup is supposed to always return tokens on success,
    // but the hook is best-effort and must not throw when the response
    // shape is unexpected (e.g. a future API change, a server-side
    // partial response). Confirm it writes nothing rather than
    // bringing the whole command down.
    const stderr: string[] = [];
    OPERATION_SUCCESS_HOOKS.verifyAgentSignup({
      envelope: { data: { unrelated: "shape" } },
      configDir: tempDir,
      apiBaseUrl: "https://api.primitive.dev",
      writeStderr: (chunk) => stderr.push(chunk),
    });

    expect(loadCliCredentials(tempDir)).toBeNull();
    expect(stderr.join("")).toBe("");
  });
});
