import { mkdtempSync, rmSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { operationManifest } from "@primitivedotdev/api-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const approval = vi.hoisted(() => ({
  prompt: vi.fn<(question: string) => Promise<string>>(),
  open: vi.fn<(url: string) => void>(),
}));
vi.mock("../../src/oclif/step-up-approval.js", async (original) => ({
  ...(await original<typeof import("../../src/oclif/step-up-approval.js")>()),
  terminalApprovalIo: (options: {
    json?: boolean;
    openBrowser: boolean;
    stepUpToken?: string;
  }) => ({
    ...options,
    interactive: !options.json,
    prompt: approval.prompt,
    open: approval.open,
    write: (text: string) => process.stderr.write(text),
  }),
}));

import { createOperationCommand } from "../../src/oclif/api-command.js";
import { guardJsonOutput } from "../../src/oclif/json-output.js";
import {
  type GeneratedRetryId,
  prepareRetryIds,
  RETRY_ID_MARKER,
  retryIdFields,
} from "../../src/oclif/retry-ids.js";

const id = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const uuid = { type: "string", format: "uuid" };
const markedSchema = {
  properties: { request_id: { ...uuid, [RETRY_ID_MARKER]: true } },
};
const flagMap = new Map([["request-id", "request_id"]]);
const root = resolve(import.meta.dirname, "../..");

describe("retry ID annotation boundaries", () => {
  it("requires an explicit UUID marker, copies the body and generates only once", () => {
    const schema = {
      properties: {
        request_id: uuid,
        retry_id: { ...uuid, [RETRY_ID_MARKER]: true },
        wrong_type: {
          type: "integer",
          format: "uuid",
          [RETRY_ID_MARKER]: true,
        },
      },
    };
    const body = Object.freeze({
      request_id: id,
      nested: Object.freeze({ keep: true }),
    });
    const before = JSON.stringify(schema);
    const generate = vi.fn(() => otherId);
    const result = prepareRetryIds(
      schema,
      body,
      new Map([["retry-id", "retry_id"]]),
      generate,
    );
    expect(retryIdFields(schema)).toEqual(["retry_id"]);
    expect(result.body).toEqual({ ...body, retry_id: otherId });
    expect(result.body).not.toBe(body);
    expect(body).not.toHaveProperty("retry_id");
    expect(JSON.stringify(schema)).toBe(before);
    expect(prepareRetryIds(schema, result.body, flagMap, generate).ids).toEqual(
      [],
    );
    expect(generate).toHaveBeenCalledOnce();
  });

  it("preserves explicit values and non-object bodies instead of replacing them", () => {
    const generate = vi.fn(() => id);
    for (const value of [id, null, "invalid", undefined]) {
      const body = { request_id: value };
      const result = prepareRetryIds(markedSchema, body, flagMap, generate);
      expect(result.body).toBe(body);
      expect(Object.hasOwn(body, "request_id")).toBe(true);
      expect(body.request_id).toBe(value);
      expect(result.ids).toEqual([]);
    }
    for (const body of [null, [], false, 0, "text"])
      expect(prepareRetryIds(markedSchema, body, flagMap, generate)).toEqual({
        body,
        ids: [],
      });
    expect(
      prepareRetryIds(
        { properties: { request_id: uuid } },
        undefined,
        flagMap,
        generate,
      ),
    ).toEqual({ body: undefined, ids: [] });
    expect(generate).not.toHaveBeenCalled();
    expect(
      prepareRetryIds(markedSchema, undefined, flagMap, generate).body,
    ).toEqual({ request_id: id });
  });

  it("serializes special property names without changing the body's prototype", () => {
    const schema: unknown = JSON.parse(
      '{"properties":{"__proto__":{"type":"string","format":"uuid","x-primitive-retry-id":true}}}',
    );
    const result = prepareRetryIds(schema, {}, new Map(), () => id);
    expect(Object.getPrototypeOf(result.body)).toBe(Object.prototype);
    expect(JSON.stringify(result.body)).toBe(`{"__proto__":"${id}"}`);
    expect(result.ids[0]).toMatchObject({
      flag: null,
      json_path: "$.__proto__",
    });
  });
});

type Document = {
  cli_retry_ids?: GeneratedRetryId[];
  meta?: unknown;
  error?: { code: string; details?: unknown };
  exit_code?: number;
};
type Attempt = {
  body: Record<string, unknown>;
  token: string | undefined;
  notice: string;
  path: string | undefined;
};
type Responder = (
  request: IncomingMessage,
  response: ServerResponse,
  attempt: Attempt,
) => void;
type Runnable = {
  run(argv: string[], options: { root: string }): Promise<unknown>;
};

describe("retry IDs through generated commands and real HTTP", () => {
  let config: string, base: string, server: Server, command: Runnable;
  let savedExit: typeof process.exitCode, stderr: string;
  let attempts: Attempt[], respond: Responder;
  const success: Responder = (_request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.end(
      JSON.stringify({
        success: true,
        data: { id: "accepted" },
        meta: { trace: "kept" },
      }),
    );
  };

  beforeEach(async () => {
    config = mkdtempSync(join(tmpdir(), "primitive-retry-test-"));
    for (const name of Object.keys(process.env))
      if (/^(PRIMITIVE_|CLAUDE|CODEX)/.test(name)) vi.stubEnv(name, undefined);
    vi.stubEnv("PRIMITIVE_CONFIG_DIR", config);
    vi.stubEnv("XDG_CONFIG_HOME", config);
    vi.stubEnv("NO_PROXY", "127.0.0.1,localhost");
    vi.stubEnv("no_proxy", "127.0.0.1,localhost");
    savedExit = process.exitCode;
    attempts = [];
    stderr = "";
    respond = success;
    approval.prompt.mockReset().mockResolvedValue(`pstep_${"a".repeat(64)}`);
    approval.open.mockReset();
    const original = operationManifest.find(
      (operation) => operation.sdkName === "inviteOrganizationMember",
    );
    if (!original?.requestSchema) throw new Error("Invitation schema missing");
    // The shipped contract carries the marker too; set it here so the test
    // does not depend on it.
    const requestSchema = structuredClone(original.requestSchema);
    const properties = requestSchema.properties as Record<
      string,
      Record<string, unknown>
    >;
    properties.request_id = {
      ...properties.request_id,
      [RETRY_ID_MARKER]: true,
    };
    const concrete = createOperationCommand({ ...original, requestSchema });
    guardJsonOutput(
      concrete as unknown as Parameters<typeof guardJsonOutput>[0],
    );
    command = concrete as unknown as Runnable;
    server = createServer(async (request, response) => {
      let raw = "";
      for await (const chunk of request) raw += chunk;
      const attempt = {
        body: raw ? JSON.parse(raw) : {},
        token: request.headers["primitive-step-up"] as string | undefined,
        notice: stderr,
        path: request.url,
      };
      attempts.push(attempt);
      respond(request, response, attempt);
    });
    await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Fixture not listening");
    base = `http://127.0.0.1:${address.port}/v1`;
  });

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    process.exitCode = savedExit;
    rmSync(config, { recursive: true, force: true });
  });

  async function run(args: string[], json = true) {
    const output: string[] = [];
    stderr = "";
    process.exitCode = undefined;
    const log = vi
      .spyOn(console, "log")
      .mockImplementation((...values: unknown[]) => {
        output.push(values.map(String).join(" "));
      });
    const err = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((chunk: unknown) => {
        stderr += String(chunk);
        return true;
      });
    let caught: unknown;
    try {
      await command.run(
        [
          "--api-key",
          "prim_test_only",
          "--api-base-url",
          base,
          ...args,
          ...(json ? ["--json"] : []),
        ],
        { root },
      );
    } catch (error) {
      caught = error;
    } finally {
      log.mockRestore();
      err.mockRestore();
    }
    const code =
      process.exitCode ??
      (caught
        ? ((caught as { oclif?: { exit?: number } }).oclif?.exit ?? 1)
        : 0);
    if (json) expect(stderr).toBe("");
    expect(output).toHaveLength(1);
    return {
      document: JSON.parse(output.join("\n")) as Document,
      code,
      stderr,
    };
  }

  it("reports the UUID that reached the server and never leaks it into the next invocation", async () => {
    const first = await run(["--email", "member@example.com"]);
    expect(first.code).toBe(0);
    expect(first.document.meta).toEqual({ trace: "kept" });
    expect(first.document.cli_retry_ids).toEqual([
      {
        field: "request_id",
        flag: "--request-id",
        json_path: "$.request_id",
        value: attempts[0]?.body.request_id,
        source: "generated",
      },
    ]);
    expect(attempts[0]?.body.request_id).toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27}$/);
    expect(attempts[0]?.path).toBe("/v1/organization/invitations");
    const second = await run([
      "--email",
      "member@example.com",
      "--request-id",
      id,
    ]);
    expect(second.code).toBe(0);
    expect(second.document.cli_retry_ids).toBeUndefined();
    expect(attempts[1]?.body.request_id).toBe(id);
  });

  it("retains an uncertain send's ID after a dropped response and an explicit manual retry", async () => {
    respond = (request) => request.socket.destroy();
    const failed = await run(["--email", "member@example.com"]);
    expect(failed.code).not.toBe(0);
    expect(failed.document.error).toBeDefined();
    expect(attempts).toHaveLength(1);
    const retryId = failed.document.cli_retry_ids?.[0]?.value;
    expect(retryId).toBe(attempts[0]?.body.request_id);
    expect(retryId).toBeTypeOf("string");
    respond = success;
    const retried = await run([
      "--email",
      "member@example.com",
      "--request-id",
      String(retryId),
    ]);
    expect(retried.code).toBe(0);
    expect(attempts).toHaveLength(2);
    expect(attempts[1]?.body).toEqual(attempts[0]?.body);
  });

  it("uses the same body across real approval attempts and prints the ID before dispatch", async () => {
    respond = (request, response, attempt) => {
      if (attempt.token) return success(request, response, attempt);
      response.writeHead(403, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          success: false,
          error: {
            code: "step_up_required",
            details: { step_up_url: "https://approval.example.test/confirm" },
          },
        }),
      );
    };
    const result = await run(
      ["--email", "member@example.com", "--no-browser"],
      false,
    );
    expect(result.code).toBe(0);
    expect(attempts).toHaveLength(2);
    expect(attempts[0]?.body).toEqual(attempts[1]?.body);
    expect(attempts[0]?.token).toBeUndefined();
    expect(attempts[1]?.token).toBe(`pstep_${"a".repeat(64)}`);
    expect(attempts[0]?.notice).toContain(
      `Retry ID (--request-id): ${attempts[0]?.body.request_id}`,
    );
    expect(result.stderr.match(/Retry ID \(--request-id\)/g)).toHaveLength(1);
    expect(approval.prompt).toHaveBeenCalledOnce();
    expect(approval.open).not.toHaveBeenCalled();
  });

  it.each(["credential selection", "API refusal"])(
    "keeps generated metadata on %s failure",
    async (failure) => {
      if (failure === "credential selection")
        vi.stubEnv("PRIMITIVE_CLI_ORG", "other");
      else
        respond = (_request, response) => {
          response.writeHead(400, { "Content-Type": "application/json" });
          response.end(
            JSON.stringify({
              success: false,
              error: { code: "validation_error", message: "Fixture refusal" },
            }),
          );
        };
      const result = await run(["--email", "member@example.com"]);
      expect(result.code).not.toBe(0);
      expect(result.document.error).toBeDefined();
      expect(result.document.cli_retry_ids?.[0]?.source).toBe("generated");
      expect(attempts).toHaveLength(failure === "credential selection" ? 0 : 1);
    },
  );

  it("reports missing caller inputs before auth without reporting an unused ID", async () => {
    vi.stubEnv("PRIMITIVE_CLI_ORG", "other");
    const result = await run([]);
    expect(result.code).toBe(2);
    expect(result.document.error).toMatchObject({
      code: "usage_error",
      details: {
        missing: [{ field: "email", flag: "--email", json_path: "$.email" }],
      },
    });
    expect(result.document.cli_retry_ids).toBeUndefined();
    expect(attempts).toEqual([]);
  });
});
