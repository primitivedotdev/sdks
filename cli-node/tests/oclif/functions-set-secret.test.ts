import type {
  FunctionDetail,
  FunctionSecretWriteResult,
} from "@primitivedotdev/api-core";
import { describe, expect, it, vi } from "vitest";
import FunctionsSetSecretCommand, {
  runSetSecret,
  type SetSecretApiSurface,
} from "../../src/oclif/commands/functions-set-secret.js";
import { COMMANDS } from "../../src/oclif/index.js";
import { resolveSingleSecretValue } from "../../src/oclif/secret-flags.js";

const FN_ID = "11111111-1111-4111-8111-111111111111";

function makeSecret(
  overrides: Partial<FunctionSecretWriteResult> = {},
): FunctionSecretWriteResult {
  return {
    created: true,
    created_at: "2026-05-10T00:00:00.000Z",
    key: "API_TOKEN",
    updated_at: "2026-05-10T00:00:00.000Z",
    ...overrides,
  };
}

function makeFunctionDetail(
  overrides: Partial<FunctionDetail> = {},
): FunctionDetail {
  return {
    code: "export default { async fetch(req, env, ctx) { return new Response('ok'); } };",
    created_at: "2026-05-09T00:00:00.000Z",
    deploy_status: "deployed",
    gateway_url: `https://${FN_ID}.fn.primitive.dev`,
    id: FN_ID,
    name: "test-fn",
    updated_at: "2026-05-09T00:00:00.000Z",
    ...overrides,
  };
}

// Build a fake API surface that records every call so a test can
// assert how runSetSecret routed its inputs. By default every
// method resolves with a successful envelope; individual tests
// override one method to simulate failures, and the override is
// invoked after the call is recorded (so call counts stay accurate
// regardless of which response shape the override returns).
function makeApi(overrides: Partial<SetSecretApiSurface> = {}): {
  api: SetSecretApiSurface;
  calls: {
    setSecret: { id: string; key: string; value: string }[];
    getFunction: { id: string }[];
    updateFunction: { id: string; code: string }[];
  };
} {
  const calls = {
    getFunction: [] as { id: string }[],
    setSecret: [] as { id: string; key: string; value: string }[],
    updateFunction: [] as { id: string; code: string }[],
  };

  const api: SetSecretApiSurface = {
    getFunction: vi.fn(async (params: { id: string }) => {
      calls.getFunction.push(params);
      if (overrides.getFunction) return overrides.getFunction(params);
      return { data: { data: makeFunctionDetail() } };
    }),
    setSecret: vi.fn(
      async (params: { id: string; key: string; value: string }) => {
        calls.setSecret.push(params);
        if (overrides.setSecret) return overrides.setSecret(params);
        return { data: { data: makeSecret() } };
      },
    ),
    updateFunction: vi.fn(async (params: { id: string; code: string }) => {
      calls.updateFunction.push(params);
      if (overrides.updateFunction) return overrides.updateFunction(params);
      return { data: { data: makeFunctionDetail() } };
    }),
  };

  return { api, calls };
}

describe("functions:set-secret command", () => {
  it("registers in the COMMANDS map", () => {
    expect(COMMANDS["functions:set-secret"]).toBeDefined();
  });

  it("documents that --redeploy preserves the current source map", () => {
    const description =
      FunctionsSetSecretCommand.flags.redeploy.description ?? "";

    expect(description).toContain("preserves the current stored source map");
    expect(description).toContain("replace or restore a map");
    expect(description).not.toContain(
      "drops any previously-uploaded source map",
    );
    expect(description).not.toContain("runtime side");
  });
});

describe("resolveSingleSecretValue", () => {
  it("uses the direct --value source", () => {
    const result = resolveSingleSecretValue({
      key: "API_TOKEN",
      value: "abc123",
    });

    expect(result).toEqual({ kind: "ok", value: "abc123" });
  });

  it("reads --value-from-env from the provided environment", () => {
    const result = resolveSingleSecretValue({
      env: { OPENAI_KEY: "sk-env" },
      key: "OPENAI_KEY",
      valueFromEnv: "OPENAI_KEY",
    });

    expect(result).toEqual({ kind: "ok", value: "sk-env" });
  });

  it("reads --value-file as exact UTF-8 text", () => {
    const result = resolveSingleSecretValue({
      key: "PRIVATE_KEY",
      readFile: () => "pem\nwith newline\n",
      valueFile: "private-key.pem",
    });

    expect(result).toEqual({ kind: "ok", value: "pem\nwith newline\n" });
  });

  it("reads --key from --value-from-env-file when no suffix is provided", () => {
    const result = resolveSingleSecretValue({
      key: "OPENAI_KEY",
      readFile: () => "OPENAI_KEY=sk-file\n",
      valueFromEnvFile: ".env.local",
    });

    expect(result).toEqual({ kind: "ok", value: "sk-file" });
  });

  it("reads an explicit key from --value-from-env-file FILE:KEY", () => {
    const result = resolveSingleSecretValue({
      key: "OPENAI_KEY",
      readFile: () => "OTHER_KEY=from-other\n",
      valueFromEnvFile: ".env.local:OTHER_KEY",
    });

    expect(result).toEqual({ kind: "ok", value: "from-other" });
  });

  it("reads --stdin as exact text", () => {
    const result = resolveSingleSecretValue({
      key: "OPENAI_KEY",
      readStdin: () => "sk-stdin\n",
      stdin: true,
    });

    expect(result).toEqual({ kind: "ok", value: "sk-stdin\n" });
  });

  it("rejects missing or ambiguous value sources", () => {
    const missing = resolveSingleSecretValue({ key: "API_TOKEN" });
    expect(missing.kind).toBe("error");

    const ambiguous = resolveSingleSecretValue({
      key: "API_TOKEN",
      stdin: true,
      value: "direct",
    });
    expect(ambiguous.kind).toBe("error");
  });

  it("reports a missing --value-from-env variable", () => {
    const result = resolveSingleSecretValue({
      env: {},
      key: "OPENAI_KEY",
      valueFromEnv: "OPENAI_KEY",
    });

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("OPENAI_KEY");
      expect(result.message).toContain("not set");
    }
  });
});

describe("runSetSecret (no --redeploy)", () => {
  it("writes the secret and skips getFunction + updateFunction", async () => {
    const { api, calls } = makeApi();

    const outcome = await runSetSecret(api, {
      id: FN_ID,
      key: "API_TOKEN",
      redeploy: false,
      value: "abc123",
    });

    expect(outcome.kind).toBe("ok");
    if (outcome.kind === "ok") {
      expect(outcome.result.secret.key).toBe("API_TOKEN");
      expect(outcome.result.redeploy).toBeUndefined();
    }
    expect(calls.setSecret).toEqual([
      { id: FN_ID, key: "API_TOKEN", value: "abc123" },
    ]);
    expect(calls.getFunction).toEqual([]);
    expect(calls.updateFunction).toEqual([]);
  });

  it("surfaces a set-secret error and never touches the function", async () => {
    const { api, calls } = makeApi({
      setSecret: async () => ({
        error: { code: "unauthorized", message: "Invalid API key" },
      }),
    });

    const outcome = await runSetSecret(api, {
      id: FN_ID,
      key: "API_TOKEN",
      redeploy: false,
      value: "abc123",
    });

    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.stage).toBe("set-secret");
      // extractErrorPayload unwraps the {error: ...} envelope; we
      // pass a bare {code,message} so it should pass through.
      expect(outcome.payload).toEqual({
        code: "unauthorized",
        message: "Invalid API key",
      });
    }
    expect(calls.getFunction).toEqual([]);
    expect(calls.updateFunction).toEqual([]);
  });

  it("flags a 2xx-with-empty-data secret response as a client error", async () => {
    const { api } = makeApi({
      setSecret: async () => ({ data: {} }),
    });

    const outcome = await runSetSecret(api, {
      id: FN_ID,
      key: "API_TOKEN",
      redeploy: false,
      value: "abc123",
    });

    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.stage).toBe("set-secret");
    }
  });
});

describe("runSetSecret (--redeploy)", () => {
  it("writes the secret, fetches current code, and redeploys with the same code", async () => {
    const detail = makeFunctionDetail({
      code: "export default { fetch(req) { return new Response('hi'); } };",
    });
    const redeployedDetail = makeFunctionDetail({
      ...detail,
      deploy_status: "deployed",
      updated_at: "2026-05-10T00:00:01.000Z",
    });
    const { api, calls } = makeApi({
      getFunction: async () => ({ data: { data: detail } }),
      updateFunction: async (p) => {
        // Sanity-check that the call routed the SAME code back.
        expect(p.code).toBe(detail.code);
        return { data: { data: redeployedDetail } };
      },
    });

    const outcome = await runSetSecret(api, {
      id: FN_ID,
      key: "API_TOKEN",
      redeploy: true,
      value: "abc123",
    });

    expect(outcome.kind).toBe("ok");
    if (outcome.kind === "ok") {
      expect(outcome.result.secret.key).toBe("API_TOKEN");
      expect(outcome.result.redeploy?.updated_at).toBe(
        "2026-05-10T00:00:01.000Z",
      );
    }
    expect(calls.setSecret).toHaveLength(1);
    expect(calls.getFunction).toEqual([{ id: FN_ID }]);
  });

  it("reports a get-function error after the secret has already been written", async () => {
    const { api, calls } = makeApi({
      getFunction: async () => ({
        error: { code: "not_found", message: "function not found" },
      }),
    });

    const outcome = await runSetSecret(api, {
      id: FN_ID,
      key: "API_TOKEN",
      redeploy: true,
      value: "abc123",
    });

    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.stage).toBe("get-function");
      expect(outcome.payload).toEqual({
        code: "not_found",
        message: "function not found",
      });
    }
    // Secret was still upserted before the get-function attempt.
    expect(calls.setSecret).toHaveLength(1);
    expect(calls.updateFunction).toEqual([]);
  });

  it("reports a redeploy error so the caller can distinguish 'secret landed, deploy did not'", async () => {
    const { api, calls } = makeApi({
      updateFunction: async () => ({
        error: { code: "server_error", message: "runtime offline" },
      }),
    });

    const outcome = await runSetSecret(api, {
      id: FN_ID,
      key: "API_TOKEN",
      redeploy: true,
      value: "abc123",
    });

    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.stage).toBe("redeploy");
      expect(outcome.payload).toEqual({
        code: "server_error",
        message: "runtime offline",
      });
    }
    expect(calls.setSecret).toHaveLength(1);
    expect(calls.getFunction).toHaveLength(1);
    expect(calls.updateFunction).toHaveLength(1);
  });

  it("rejects an empty 2xx updateFunction response so we don't fake a redeploy success", async () => {
    const { api } = makeApi({
      updateFunction: async () => ({ data: {} }),
    });

    const outcome = await runSetSecret(api, {
      id: FN_ID,
      key: "API_TOKEN",
      redeploy: true,
      value: "abc123",
    });

    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.stage).toBe("redeploy");
    }
  });
});
