import type {
  FunctionDetail,
  FunctionSecretWriteResult,
} from "@primitivedotdev/sdk/api";
import { describe, expect, it, vi } from "vitest";
import {
  type RedeployApiSurface,
  runRedeployWithSecrets,
} from "../../src/oclif/commands/functions-redeploy.js";
import { COMMANDS } from "../../src/oclif/index.js";

const FN_ID = "33333333-3333-4333-8333-333333333333";
const FN_NAME = "test-fn";
const BUNDLE =
  "export default { async fetch(req) { return new Response('ok'); } };";

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

// Build a fake API surface that records every call. Same shape as
// the functions-deploy fake but without createFunction since the
// function already exists in the redeploy flow.
function makeApi(overrides: Partial<RedeployApiSurface> = {}): {
  api: RedeployApiSurface;
  calls: {
    setSecret: { id: string; key: string; value: string }[];
    updateFunction: { id: string; code: string; sourceMap?: string }[];
  };
} {
  const calls = {
    setSecret: [] as { id: string; key: string; value: string }[],
    updateFunction: [] as {
      id: string;
      code: string;
      sourceMap?: string;
    }[],
  };

  const api: RedeployApiSurface = {
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

describe("functions:redeploy command", () => {
  it("registers in the COMMANDS map", () => {
    expect(COMMANDS["functions:redeploy"]).toBeDefined();
  });
});

describe("runRedeployWithSecrets (no --secret)", () => {
  it("calls updateFunction once and skips setSecret entirely", async () => {
    const { api, calls } = makeApi();

    const outcome = await runRedeployWithSecrets(api, {
      code: BUNDLE,
      id: FN_ID,
      secrets: [],
    });

    expect(outcome.kind).toBe("ok");
    if (outcome.kind === "ok") {
      expect(outcome.result.redeploy.id).toBe(FN_ID);
      expect(outcome.result.secrets).toBeUndefined();
    }
    expect(calls.setSecret).toEqual([]);
    expect(calls.updateFunction).toEqual([{ code: BUNDLE, id: FN_ID }]);
  });

  it("passes sourceMap through to updateFunction when provided", async () => {
    const { api, calls } = makeApi();

    await runRedeployWithSecrets(api, {
      code: BUNDLE,
      id: FN_ID,
      secrets: [],
      sourceMap: "{}",
    });

    expect(calls.updateFunction).toEqual([
      { code: BUNDLE, id: FN_ID, sourceMap: "{}" },
    ]);
  });

  it("surfaces an updateFunction error", async () => {
    const { api, calls } = makeApi({
      updateFunction: async () => ({
        error: { code: "not_found", message: "function not found" },
      }),
    });

    const outcome = await runRedeployWithSecrets(api, {
      code: BUNDLE,
      id: FN_ID,
      secrets: [],
    });

    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error" && outcome.stage === "redeploy") {
      expect(outcome.succeededKeys).toEqual([]);
      expect(outcome.payload).toEqual({
        code: "not_found",
        message: "function not found",
      });
    }
    expect(calls.setSecret).toEqual([]);
    expect(calls.updateFunction).toHaveLength(1);
  });

  it("flags a 2xx-with-empty-data update response as a client error", async () => {
    const { api } = makeApi({
      updateFunction: async () => ({ data: {} }),
    });

    const outcome = await runRedeployWithSecrets(api, {
      code: BUNDLE,
      id: FN_ID,
      secrets: [],
    });

    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.stage).toBe("redeploy");
    }
  });
});

describe("runRedeployWithSecrets (--secret K=V)", () => {
  it("writes every secret BEFORE the updateFunction call", async () => {
    const { api, calls } = makeApi();

    const outcome = await runRedeployWithSecrets(api, {
      code: BUNDLE,
      id: FN_ID,
      secrets: [
        { key: "FIRST", value: "1" },
        { key: "SECOND", value: "2" },
      ],
    });

    expect(outcome.kind).toBe("ok");
    if (outcome.kind === "ok") {
      expect(outcome.result.redeploy.id).toBe(FN_ID);
      expect(outcome.result.secrets).toHaveLength(2);
    }
    expect(calls.setSecret).toEqual([
      { id: FN_ID, key: "FIRST", value: "1" },
      { id: FN_ID, key: "SECOND", value: "2" },
    ]);
    expect(calls.updateFunction).toHaveLength(1);
    // Sanity: updateFunction received the same bundle the caller
    // provided. The redeploy must not pull a different code body.
    expect(calls.updateFunction[0]?.code).toBe(BUNDLE);
  });

  it("reports a set-secret error with succeeded keys so far and skips the redeploy", async () => {
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

    const outcome = await runRedeployWithSecrets(api, {
      code: BUNDLE,
      id: FN_ID,
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
      expect(outcome.payload).toEqual({
        code: "validation",
        message: "value too long",
      });
    }
    expect(calls.setSecret.map((c) => c.key)).toEqual(["FIRST", "SECOND"]);
    expect(calls.updateFunction).toEqual([]);
  });

  it("reports a redeploy error after every secret was written", async () => {
    const { api, calls } = makeApi({
      updateFunction: async () => ({
        error: { code: "server_error", message: "runtime offline" },
      }),
    });

    const outcome = await runRedeployWithSecrets(api, {
      code: BUNDLE,
      id: FN_ID,
      secrets: [
        { key: "FIRST", value: "1" },
        { key: "SECOND", value: "2" },
      ],
    });

    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error" && outcome.stage === "redeploy") {
      expect(outcome.succeededKeys).toEqual(["FIRST", "SECOND"]);
    }
    expect(calls.setSecret).toHaveLength(2);
    expect(calls.updateFunction).toHaveLength(1);
  });

  it("rejects an empty 2xx setSecret response so we don't fake a write success", async () => {
    const { api, calls } = makeApi({
      setSecret: async () => ({ data: {} }),
    });

    const outcome = await runRedeployWithSecrets(api, {
      code: BUNDLE,
      id: FN_ID,
      secrets: [{ key: "API_TOKEN", value: "abc" }],
    });

    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.stage).toBe("set-secret");
    }
    expect(calls.updateFunction).toEqual([]);
  });
});
