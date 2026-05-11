import type {
  CreateFunctionResult,
  FunctionDetail,
  FunctionSecretWriteResult,
} from "@primitivedotdev/sdk/api";
import { describe, expect, it, vi } from "vitest";
import {
  type DeployApiSurface,
  runDeployWithSecrets,
} from "../../src/oclif/commands/functions-deploy.js";
import { COMMANDS } from "../../src/oclif/index.js";
import { parseSecretFlags } from "../../src/oclif/secret-flags.js";

const FN_ID = "22222222-2222-4222-8222-222222222222";
const FN_NAME = "test-fn";
const BUNDLE =
  "export default { async fetch(req) { return new Response('ok'); } };";

function makeCreateResult(
  overrides: Partial<CreateFunctionResult> = {},
): CreateFunctionResult {
  return {
    deploy_status: "deployed",
    gateway_url: `https://${FN_ID}.fn.primitive.dev`,
    id: FN_ID,
    name: FN_NAME,
    ...overrides,
  };
}

function makeFunctionDetail(
  overrides: Partial<FunctionDetail> = {},
): FunctionDetail {
  return {
    code: BUNDLE,
    created_at: "2026-05-09T00:00:00.000Z",
    deploy_status: "deployed",
    gateway_url: `https://${FN_ID}.fn.primitive.dev`,
    id: FN_ID,
    name: FN_NAME,
    updated_at: "2026-05-09T00:00:00.000Z",
    ...overrides,
  };
}

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

// Build a fake API surface that records every call so a test can
// assert how runDeployWithSecrets routed its inputs. By default
// every method resolves with a successful envelope; individual tests
// override one method to simulate failures, and the override is
// invoked after the call is recorded (so call counts stay accurate
// regardless of which response shape the override returns).
function makeApi(overrides: Partial<DeployApiSurface> = {}): {
  api: DeployApiSurface;
  calls: {
    createFunction: { name: string; code: string; sourceMap?: string }[];
    setSecret: { id: string; key: string; value: string }[];
    updateFunction: { id: string; code: string; sourceMap?: string }[];
  };
} {
  const calls = {
    createFunction: [] as {
      name: string;
      code: string;
      sourceMap?: string;
    }[],
    setSecret: [] as { id: string; key: string; value: string }[],
    updateFunction: [] as {
      id: string;
      code: string;
      sourceMap?: string;
    }[],
  };

  const api: DeployApiSurface = {
    createFunction: vi.fn(
      async (params: { name: string; code: string; sourceMap?: string }) => {
        calls.createFunction.push(params);
        if (overrides.createFunction) return overrides.createFunction(params);
        return {
          data: {
            data: makeCreateResult({ name: params.name }),
          },
        };
      },
    ),
    setSecret: vi.fn(
      async (params: { id: string; key: string; value: string }) => {
        calls.setSecret.push(params);
        if (overrides.setSecret) return overrides.setSecret(params);
        return { data: { data: makeSecret({ key: params.key }) } };
      },
    ),
    updateFunction: vi.fn(
      async (params: { id: string; code: string; sourceMap?: string }) => {
        calls.updateFunction.push(params);
        if (overrides.updateFunction) return overrides.updateFunction(params);
        return { data: { data: makeFunctionDetail({ code: params.code }) } };
      },
    ),
  };

  return { api, calls };
}

describe("functions:deploy command", () => {
  it("registers in the COMMANDS map", () => {
    expect(COMMANDS["functions:deploy"]).toBeDefined();
  });
});

describe("parseSecretFlags", () => {
  it("returns an empty list for an empty input", () => {
    const result = parseSecretFlags([]);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.secrets).toEqual([]);
    }
  });

  it("parses a single KEY=VALUE pair", () => {
    const result = parseSecretFlags(["API_TOKEN=abc123"]);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.secrets).toEqual([{ key: "API_TOKEN", value: "abc123" }]);
    }
  });

  it("parses multiple pairs in order", () => {
    const result = parseSecretFlags(["FIRST=one", "SECOND=two", "THIRD=three"]);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.secrets).toEqual([
        { key: "FIRST", value: "one" },
        { key: "SECOND", value: "two" },
        { key: "THIRD", value: "three" },
      ]);
    }
  });

  it("only splits on the FIRST '=' so VALUE may contain '='", () => {
    const result = parseSecretFlags(["BASE64=YWJjPWRlZg=="]);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.secrets).toEqual([
        { key: "BASE64", value: "YWJjPWRlZg==" },
      ]);
    }
  });

  it("allows an empty VALUE (KEY=)", () => {
    const result = parseSecretFlags(["EMPTY="]);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.secrets).toEqual([{ key: "EMPTY", value: "" }]);
    }
  });

  it("rejects an entry with no '='", () => {
    const result = parseSecretFlags(["NO_EQUALS"]);
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("KEY=VALUE");
    }
  });

  it("rejects an entry with an empty KEY", () => {
    const result = parseSecretFlags(["=value"]);
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("KEY");
    }
  });

  it("rejects a lowercase KEY", () => {
    const result = parseSecretFlags(["lower_case=value"]);
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("lower_case");
    }
  });

  it("rejects a KEY starting with a digit", () => {
    const result = parseSecretFlags(["1KEY=value"]);
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("1KEY");
    }
  });

  it("rejects a KEY with hyphens", () => {
    const result = parseSecretFlags(["MY-KEY=value"]);
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("MY-KEY");
    }
  });

  it("accepts underscores and digits after the first character", () => {
    const result = parseSecretFlags(["_PRIVATE_KEY_2=val"]);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.secrets).toEqual([{ key: "_PRIVATE_KEY_2", value: "val" }]);
    }
  });

  it("returns the first error and stops scanning", () => {
    const result = parseSecretFlags(["GOOD=ok", "bad=nope", "ALSO_BAD"]);
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      // Should mention the lowercase key, not the missing-equals one
      // (we bail on the first failure to avoid surfacing later noise).
      expect(result.message).toContain("bad");
      expect(result.message).not.toContain("ALSO_BAD");
    }
  });

  it("rejects duplicate keys before any API call would fire", () => {
    // Silently accepting two pairs with the same key fans out to two
    // setFunctionSecret writes where only the second wins. That is
    // almost always a typo, not the intent, so we error up front.
    const result = parseSecretFlags(["API_TOKEN=first", "API_TOKEN=second"]);
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("API_TOKEN");
      expect(result.message).toContain("more than once");
    }
  });

  it("rejects duplicate keys even when other keys precede the dup", () => {
    const result = parseSecretFlags(["FIRST=one", "SECOND=two", "FIRST=three"]);
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("FIRST");
    }
  });
});

describe("runDeployWithSecrets (no --secret)", () => {
  it("creates the function and skips setSecret + updateFunction", async () => {
    const { api, calls } = makeApi();

    const outcome = await runDeployWithSecrets(api, {
      code: BUNDLE,
      name: FN_NAME,
      secrets: [],
    });

    expect(outcome.kind).toBe("ok");
    if (outcome.kind === "ok") {
      expect(outcome.result.created.id).toBe(FN_ID);
      expect(outcome.result.redeploy).toBeUndefined();
      expect(outcome.result.secrets).toBeUndefined();
    }
    expect(calls.createFunction).toEqual([{ code: BUNDLE, name: FN_NAME }]);
    expect(calls.setSecret).toEqual([]);
    expect(calls.updateFunction).toEqual([]);
  });

  it("passes sourceMap through to createFunction when provided", async () => {
    const { api, calls } = makeApi();

    await runDeployWithSecrets(api, {
      code: BUNDLE,
      name: FN_NAME,
      secrets: [],
      sourceMap: "{}",
    });

    expect(calls.createFunction).toEqual([
      { code: BUNDLE, name: FN_NAME, sourceMap: "{}" },
    ]);
  });

  it("surfaces a create error and never writes secrets or redeploys", async () => {
    const { api, calls } = makeApi({
      createFunction: async () => ({
        error: { code: "conflict", message: "name already exists" },
      }),
    });

    const outcome = await runDeployWithSecrets(api, {
      code: BUNDLE,
      name: FN_NAME,
      secrets: [{ key: "API_TOKEN", value: "abc" }],
    });

    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.stage).toBe("create");
      expect(outcome.payload).toEqual({
        code: "conflict",
        message: "name already exists",
      });
    }
    expect(calls.setSecret).toEqual([]);
    expect(calls.updateFunction).toEqual([]);
  });

  it("flags a 2xx-with-empty-data create response as a client error", async () => {
    const { api } = makeApi({
      createFunction: async () => ({ data: {} }),
    });

    const outcome = await runDeployWithSecrets(api, {
      code: BUNDLE,
      name: FN_NAME,
      secrets: [],
    });

    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.stage).toBe("create");
    }
  });
});

describe("runDeployWithSecrets (--secret K=V)", () => {
  it("creates, writes each secret in order, then redeploys with the same bundle", async () => {
    const redeployedDetail = makeFunctionDetail({
      updated_at: "2026-05-10T00:00:01.000Z",
    });
    const { api, calls } = makeApi({
      updateFunction: async (p) => {
        // The redeploy must reuse the same bundle so the running
        // handler picks up the new bindings without changing
        // behavior.
        expect(p.code).toBe(BUNDLE);
        return { data: { data: redeployedDetail } };
      },
    });

    const outcome = await runDeployWithSecrets(api, {
      code: BUNDLE,
      name: FN_NAME,
      secrets: [
        { key: "FIRST", value: "1" },
        { key: "SECOND", value: "2" },
      ],
    });

    expect(outcome.kind).toBe("ok");
    if (outcome.kind === "ok") {
      // Final payload is the redeployed detail, not the create
      // result, because that's the state the user actually
      // deployed.
      expect(outcome.result.redeploy?.updated_at).toBe(
        "2026-05-10T00:00:01.000Z",
      );
      expect(outcome.result.secrets).toHaveLength(2);
    }
    expect(calls.createFunction).toHaveLength(1);
    expect(calls.setSecret).toEqual([
      { id: FN_ID, key: "FIRST", value: "1" },
      { id: FN_ID, key: "SECOND", value: "2" },
    ]);
    expect(calls.updateFunction).toHaveLength(1);
  });

  it("reports a set-secret error after the function was created, with succeeded keys so far", async () => {
    const { api, calls } = makeApi({
      setSecret: async (p) => {
        if (p.key === "SECOND") {
          return {
            error: { code: "validation", message: "value too long" },
          };
        }
        return { data: { data: makeSecret({ key: p.key }) } };
      },
    });

    const outcome = await runDeployWithSecrets(api, {
      code: BUNDLE,
      name: FN_NAME,
      secrets: [
        { key: "FIRST", value: "1" },
        { key: "SECOND", value: "2" },
        { key: "THIRD", value: "3" },
      ],
    });

    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error" && outcome.stage === "set-secret") {
      expect(outcome.failedKey).toBe("SECOND");
      expect(outcome.succeededKeys).toEqual(["FIRST"]);
      expect(outcome.created.id).toBe(FN_ID);
      expect(outcome.payload).toEqual({
        code: "validation",
        message: "value too long",
      });
    }
    // The third secret must never be attempted after the second
    // failed; updateFunction must not fire.
    expect(calls.setSecret.map((c) => c.key)).toEqual(["FIRST", "SECOND"]);
    expect(calls.updateFunction).toEqual([]);
  });

  it("reports a redeploy error after every secret was written", async () => {
    const { api, calls } = makeApi({
      updateFunction: async () => ({
        error: { code: "server_error", message: "runtime offline" },
      }),
    });

    const outcome = await runDeployWithSecrets(api, {
      code: BUNDLE,
      name: FN_NAME,
      secrets: [
        { key: "FIRST", value: "1" },
        { key: "SECOND", value: "2" },
      ],
    });

    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error" && outcome.stage === "redeploy") {
      expect(outcome.succeededKeys).toEqual(["FIRST", "SECOND"]);
      expect(outcome.created.id).toBe(FN_ID);
    }
    expect(calls.setSecret).toHaveLength(2);
    expect(calls.updateFunction).toHaveLength(1);
  });

  it("rejects an empty 2xx setSecret response so we don't fake a write success", async () => {
    const { api, calls } = makeApi({
      setSecret: async () => ({ data: {} }),
    });

    const outcome = await runDeployWithSecrets(api, {
      code: BUNDLE,
      name: FN_NAME,
      secrets: [{ key: "API_TOKEN", value: "abc" }],
    });

    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.stage).toBe("set-secret");
    }
    expect(calls.updateFunction).toEqual([]);
  });

  it("rejects an empty 2xx updateFunction response so we don't fake a redeploy", async () => {
    const { api } = makeApi({
      updateFunction: async () => ({ data: {} }),
    });

    const outcome = await runDeployWithSecrets(api, {
      code: BUNDLE,
      name: FN_NAME,
      secrets: [{ key: "API_TOKEN", value: "abc" }],
    });

    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.stage).toBe("redeploy");
    }
  });
});
