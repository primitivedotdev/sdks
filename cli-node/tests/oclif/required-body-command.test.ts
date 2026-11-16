import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../src/oclif/api-client.js", async (original) => ({
  ...(await original<typeof import("../../src/oclif/api-client.js")>()),
  createAuthenticatedCliApiClient: auth.create,
}));

import { COMMANDS } from "../../src/oclif/index.js";

const root = resolve(import.meta.dirname, "../..");
type Runnable = {
  run(argv: string[], options: { root: string }): Promise<unknown>;
};
const command = COMMANDS[
  "organizations:invite-organization-member"
] as unknown as Runnable;
const requestId = "11111111-1111-4111-8111-111111111111";
const missingEmail = { field: "email", flag: "--email", json_path: "$.email" };
const missingId = {
  field: "request_id",
  flag: "--request-id",
  json_path: "$.request_id",
};
let configDir: string;
let exitCode: typeof process.exitCode;

beforeEach(() => {
  configDir = mkdtempSync(join(tmpdir(), "primitive-required-body-"));
  vi.stubEnv("PRIMITIVE_CONFIG_DIR", configDir);
  vi.stubEnv("PRIMITIVE_AGENT_ADDRESS", undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("No request expected"))),
  );
  auth.create.mockRejectedValue(new Error("Reached authentication"));
  exitCode = process.exitCode;
  process.exitCode = undefined;
});

afterEach(() => {
  process.exitCode = exitCode;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  auth.create.mockReset();
  rmSync(configDir, { recursive: true, force: true });
});

describe("required bodies through the command registry", () => {
  it.each([
    [[], [missingId, missingEmail]],
    [["--email", "member@example.com"], [missingId]],
    [["--request-id", requestId], [missingEmail]],
  ])(
    "reports all omissions before authentication for %j",
    async (argv, missing) => {
      await expect(command.run(argv, { root })).rejects.toMatchObject({
        code: "usage_error",
        oclif: { exit: 2 },
        details: { missing },
      });
      expect(auth.create).not.toHaveBeenCalled();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    },
  );

  it.each([
    [["--raw-body", "{"], "is not valid JSON"],
    [
      ["--raw-body", "[]", "--email", "member@example.com"],
      "must be a JSON object",
    ],
  ])(
    "rejects malformed input before authentication for %j",
    async (argv, message) => {
      await expect(command.run(argv, { root })).rejects.toThrow(message);
      expect(auth.create).not.toHaveBeenCalled();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    },
  );

  it("carries structured missing fields in exactly one JSON document", async () => {
    const stdout = vi.spyOn(console, "log").mockImplementation(() => {});
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    await expect(command.run(["--json"], { root })).rejects.toMatchObject({
      oclif: { exit: 2 },
    });
    const document = JSON.parse(
      stdout.mock.calls.map((call) => call.join(" ")).join("\n"),
    );
    expect(document).toMatchObject({
      error: {
        code: "usage_error",
        details: { missing: [missingId, missingEmail] },
      },
      exit_code: 2,
    });
    expect(stderr).not.toHaveBeenCalled();
    expect(auth.create).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("merges file fields with a flag override and preserves the supplied request id", async () => {
    const file = join(configDir, "invitation.json");
    writeFileSync(
      file,
      JSON.stringify({ request_id: requestId, email: "old@example.com" }),
    );
    const sent: unknown[] = [];
    const apiClient = new PrimitiveApiClient({
      apiKey: "test-key",
      apiBaseUrl: "https://api.example.test/v1",
      fetch: async (input, init) => {
        sent.push(JSON.parse(await new Request(input, init).text()));
        return Response.json({ success: true, data: { id: requestId } });
      },
    });
    auth.create.mockResolvedValue({
      apiClient,
      auth: {},
      baseUrlOverridden: false,
    });
    vi.spyOn(console, "log").mockImplementation(() => {});
    await command.run(["--body-file", file, "--email", "member@example.com"], {
      root,
    });
    expect(sent).toEqual([
      { request_id: requestId, email: "member@example.com" },
    ]);
  });

  it("keeps optional request bodies optional", async () => {
    await expect(
      (
        COMMANDS["email-rules:accept-email-rule-request"] as unknown as Runnable
      ).run(["--id", requestId], { root }),
    ).rejects.toThrow("Reached authentication");
    expect(auth.create).toHaveBeenCalledOnce();
  });
});
