import type { FunctionDetail } from "@primitivedotdev/api-core";
import { describe, expect, it, vi } from "vitest";
import {
  type GetFunctionForDeployWait,
  validateDeployWaitFlags,
  waitForFunctionDeploy,
} from "../../src/oclif/function-deploy-wait.js";

const FN_ID = "44444444-4444-4444-8444-444444444444";

function makeFunction(overrides: Partial<FunctionDetail> = {}): FunctionDetail {
  return {
    code: "export default { fetch() { return new Response('ok'); } };",
    created_at: "2026-05-18T00:00:00.000Z",
    deploy_error: null,
    deploy_status: "pending",
    gateway_url: `https://functions-gateway.primitive.dev/${FN_ID}`,
    id: FN_ID,
    name: "wait-test",
    updated_at: "2026-05-18T00:00:00.000Z",
    ...overrides,
  };
}

describe("validateDeployWaitFlags", () => {
  it("rejects negative timeouts and non-positive poll intervals", () => {
    expect(
      validateDeployWaitFlags({ pollIntervalSeconds: 1, timeoutSeconds: -1 }),
    ).toContain("--timeout");
    expect(
      validateDeployWaitFlags({ pollIntervalSeconds: 0, timeoutSeconds: 60 }),
    ).toContain("--poll-interval");
    expect(
      validateDeployWaitFlags({ pollIntervalSeconds: 1, timeoutSeconds: 0 }),
    ).toBeNull();
  });
});

describe("waitForFunctionDeploy", () => {
  it("returns immediately when the initial deploy state is already terminal", async () => {
    const getFunction = vi.fn();
    const sleep = vi.fn();

    const result = await waitForFunctionDeploy({
      getFunction,
      id: FN_ID,
      initial: makeFunction({ deploy_status: "deployed" }),
      pollIntervalSeconds: 2,
      sleep,
      timeoutSeconds: 60,
    });

    expect(result.kind).toBe("ok");
    expect(getFunction).not.toHaveBeenCalled();
    expect(sleep).not.toHaveBeenCalled();
  });

  it("polls pending deploys until they become deployed", async () => {
    const writes: string[] = [];
    const getFunction = vi.fn<GetFunctionForDeployWait>(async () => ({
      data: { data: makeFunction({ deploy_status: "deployed" }) },
    }));
    const sleep = vi.fn(async () => undefined);

    const result = await waitForFunctionDeploy({
      getFunction,
      id: FN_ID,
      initial: makeFunction({ deploy_status: "pending" }),
      pollIntervalSeconds: 2,
      sleep,
      timeoutSeconds: 60,
      writeStderr: (chunk) => writes.push(chunk),
    });

    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.function).not.toHaveProperty("code");
    }
    expect(getFunction).toHaveBeenCalledWith({ id: FN_ID });
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(writes.join("")).toContain("current status: pending");
    expect(writes.join("")).toContain("deploy status: deployed");
  });

  it("returns failed with deploy_error when the deploy terminally fails", async () => {
    const getFunction = vi.fn<GetFunctionForDeployWait>(async () => ({
      data: {
        data: makeFunction({
          deploy_error: "bundle syntax error",
          deploy_status: "failed",
        }),
      },
    }));

    const result = await waitForFunctionDeploy({
      getFunction,
      id: FN_ID,
      initial: makeFunction({ deploy_status: "pending" }),
      pollIntervalSeconds: 1,
      sleep: async () => undefined,
      timeoutSeconds: 60,
      writeStderr: () => undefined,
    });

    expect(result.kind).toBe("failed");
    if (result.kind === "failed") {
      expect(result.function.deploy_error).toBe("bundle syntax error");
    }
  });

  it("returns timeout with the last observed function when polling never reaches terminal state", async () => {
    const getFunction = vi.fn<GetFunctionForDeployWait>(async () => ({
      data: { data: makeFunction({ deploy_status: "pending" }) },
    }));
    const nowValues = [0, 0, 2000, 2000];
    const now = vi.fn(() => nowValues.shift() ?? 2000);

    const result = await waitForFunctionDeploy({
      getFunction,
      id: FN_ID,
      initial: makeFunction({ deploy_status: "pending" }),
      now,
      pollIntervalSeconds: 1,
      sleep: async () => undefined,
      timeoutSeconds: 1,
      writeStderr: () => undefined,
    });

    expect(result.kind).toBe("timeout");
    if (result.kind === "timeout") {
      expect(result.elapsedSeconds).toBe(2);
      expect(result.lastFunction?.deploy_status).toBe("pending");
    }
  });

  it("caps sleep to the remaining timeout and does not poll past the deadline", async () => {
    let currentTimeMs = 0;
    const getFunction = vi.fn<GetFunctionForDeployWait>(async () => ({
      data: { data: makeFunction({ deploy_status: "deployed" }) },
    }));
    const sleep = vi.fn(async (ms: number) => {
      currentTimeMs += ms;
    });

    const result = await waitForFunctionDeploy({
      getFunction,
      id: FN_ID,
      initial: makeFunction({ deploy_status: "pending" }),
      now: () => currentTimeMs,
      pollIntervalSeconds: 60,
      sleep,
      timeoutSeconds: 1,
      writeStderr: () => undefined,
    });

    expect(result.kind).toBe("timeout");
    if (result.kind === "timeout") {
      expect(result.elapsedSeconds).toBe(1);
      expect(result.lastFunction?.deploy_status).toBe("pending");
    }
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(getFunction).not.toHaveBeenCalled();
  });

  it("returns an extracted API error payload when getFunction fails", async () => {
    const result = await waitForFunctionDeploy({
      getFunction: async () => ({
        error: { code: "not_found", message: "function not found" },
      }),
      id: FN_ID,
      initial: makeFunction({ deploy_status: "pending" }),
      pollIntervalSeconds: 1,
      sleep: async () => undefined,
      timeoutSeconds: 60,
      writeStderr: () => undefined,
    });

    expect(result).toEqual({
      kind: "error",
      payload: { code: "not_found", message: "function not found" },
    });
  });
});
