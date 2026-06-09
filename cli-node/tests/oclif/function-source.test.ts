import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  CreateFunctionResult,
  FunctionDetail,
  FunctionListItem,
  FunctionSecretWriteResult,
} from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  collectSourceFiles,
  renderBuildFailure,
  runSourceDeploy,
  runSourceDeployWithSecrets,
  type SourceDeployApiSurface,
  type SourceDeployWithSecretsApiSurface,
} from "../../src/oclif/function-source.js";

const tempDirs: string[] = [];

function makeProject(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "primitive-source-"));
  tempDirs.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, content);
  }
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true });
  }
});

describe("collectSourceFiles", () => {
  it("collects package.json and everything under src/", () => {
    const dir = makeProject({
      "package.json": '{"name":"x","dependencies":{}}',
      "src/index.ts": "export default {}",
      "src/lib/util.ts": "export const x = 1;",
    });
    const result = collectSourceFiles(dir);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(Object.keys(result.files).sort()).toEqual([
      "package.json",
      "src/index.ts",
      "src/lib/util.ts",
    ]);
  });

  it("strips devDependencies from the shipped package.json", () => {
    const dir = makeProject({
      "package.json":
        '{"name":"x","dependencies":{"nanoid":"^5"},"devDependencies":{"typescript":"^5"}}',
      "src/index.ts": "export default {}",
    });
    const result = collectSourceFiles(dir);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    const pkg = JSON.parse(result.files["package.json"]);
    expect(pkg.dependencies).toEqual({ nanoid: "^5" });
    expect(pkg.devDependencies).toBeUndefined();
  });

  it("errors when package.json is missing", () => {
    const dir = makeProject({ "src/index.ts": "export default {}" });
    const result = collectSourceFiles(dir);
    expect(result.kind).toBe("error");
  });

  it("errors when package.json is not valid JSON", () => {
    const dir = makeProject({
      "package.json": "{ not json",
      "src/index.ts": "export default {}",
    });
    const result = collectSourceFiles(dir);
    expect(result.kind).toBe("error");
  });

  it("errors when there are no source files under src/", () => {
    const dir = makeProject({ "package.json": "{}" });
    const result = collectSourceFiles(dir);
    expect(result.kind).toBe("error");
  });
});

const FILES = { "package.json": "{}", "src/index.ts": "export default {}" };

function listItem(name: string, id: string): FunctionListItem {
  return {
    created_at: "2026-05-26T00:00:00Z",
    deploy_status: "deployed",
    id,
    name,
    updated_at: "2026-05-26T00:00:00Z",
  };
}

function createResult(name: string, id: string): CreateFunctionResult {
  return { deploy_status: "deployed", id, name };
}

function detail(name: string, id: string): FunctionDetail {
  return {
    code: "export default {}",
    created_at: "2026-05-26T00:00:00Z",
    deploy_status: "deployed",
    id,
    name,
    updated_at: "2026-05-26T12:00:00Z",
  };
}

describe("runSourceDeploy", () => {
  it("creates the function when no function with the name exists", async () => {
    const api: SourceDeployApiSurface = {
      createFunction: vi.fn(async () => ({
        data: { data: createResult("dev_help", "id-1") },
      })),
      listFunctions: vi.fn(async () => ({
        data: { data: [listItem("other", "id-2")] },
      })),
      updateFunction: vi.fn(),
    };
    const result = await runSourceDeploy(api, {
      files: FILES,
      name: "dev_help",
    });
    expect(result).toEqual({
      action: "created",
      kind: "ok",
      result: createResult("dev_help", "id-1"),
    });
    expect(api.createFunction).toHaveBeenCalledWith({
      files: FILES,
      name: "dev_help",
    });
    expect(api.updateFunction).not.toHaveBeenCalled();
  });

  it("redeploys by id when a function with the name exists", async () => {
    const api: SourceDeployApiSurface = {
      createFunction: vi.fn(),
      listFunctions: vi.fn(async () => ({
        data: { data: [listItem("dev_help", "id-9")] },
      })),
      updateFunction: vi.fn(async () => ({
        data: { data: detail("dev_help", "id-9") },
      })),
    };
    const result = await runSourceDeploy(api, {
      files: FILES,
      name: "dev_help",
    });
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") expect(result.action).toBe("redeployed");
    expect(api.updateFunction).toHaveBeenCalledWith({
      files: FILES,
      id: "id-9",
    });
    expect(api.createFunction).not.toHaveBeenCalled();
  });

  it("surfaces a lookup error without creating or updating", async () => {
    const api: SourceDeployApiSurface = {
      createFunction: vi.fn(),
      listFunctions: vi.fn(async () => ({ error: { code: "unauthorized" } })),
      updateFunction: vi.fn(),
    };
    const result = await runSourceDeploy(api, {
      files: FILES,
      name: "dev_help",
    });
    expect(result.kind).toBe("error");
    if (result.kind === "error") expect(result.stage).toBe("lookup");
    expect(api.createFunction).not.toHaveBeenCalled();
    expect(api.updateFunction).not.toHaveBeenCalled();
  });

  it("surfaces a build_failed create error with its payload", async () => {
    const payload = {
      error: { code: "build_failed", details: { phase: "bundle" } },
    };
    const api: SourceDeployApiSurface = {
      createFunction: vi.fn(async () => ({ error: payload })),
      listFunctions: vi.fn(async () => ({ data: { data: [] } })),
      updateFunction: vi.fn(),
    };
    const result = await runSourceDeploy(api, {
      files: FILES,
      name: "dev_help",
    });
    expect(result.kind).toBe("error");
    if (result.kind === "error") expect(result.stage).toBe("create");
  });
});

function secretResult(key: string): FunctionSecretWriteResult {
  return {
    created: true,
    created_at: "2026-05-26T00:00:00Z",
    key,
    updated_at: "2026-05-26T00:00:00Z",
  };
}

describe("runSourceDeployWithSecrets", () => {
  it("creates, writes each secret, then redeploys to bind them when no function exists", async () => {
    const setSecret = vi
      .fn()
      .mockResolvedValueOnce({
        data: { data: secretResult("ANTHROPIC_API_KEY") },
      })
      .mockResolvedValueOnce({ data: { data: secretResult("OWNER_EMAIL") } });
    const api: SourceDeployWithSecretsApiSurface = {
      createFunction: vi.fn(async () => ({
        data: { data: createResult("dev_help", "id-1") },
      })),
      listFunctions: vi.fn(async () => ({ data: { data: [] } })),
      setSecret,
      updateFunction: vi.fn(async () => ({
        data: { data: detail("dev_help", "id-1") },
      })),
    };
    const result = await runSourceDeployWithSecrets(api, {
      files: FILES,
      name: "dev_help",
      secrets: [
        { key: "ANTHROPIC_API_KEY", value: "sk-anth" },
        { key: "OWNER_EMAIL", value: "me@example.com" },
      ],
    });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.result.action).toBe("created");
    expect(result.result.redeploy).toEqual(detail("dev_help", "id-1"));
    expect(result.result.secrets.map((s) => s.key)).toEqual([
      "ANTHROPIC_API_KEY",
      "OWNER_EMAIL",
    ]);
    expect(setSecret).toHaveBeenCalledTimes(2);
    // The final updateFunction has to fire AFTER setSecret writes; otherwise
    // the running handler won't pick up the new bindings.
    expect(api.updateFunction).toHaveBeenCalledTimes(1);
    expect(api.updateFunction).toHaveBeenCalledWith({
      files: FILES,
      id: "id-1",
    });
  });

  it("skips an intermediate redeploy when the function already exists, then writes secrets and redeploys once", async () => {
    const setSecret = vi.fn(async () => ({
      data: { data: secretResult("ANTHROPIC_API_KEY") },
    }));
    const updateFunction = vi.fn(async () => ({
      data: { data: detail("dev_help", "id-9") },
    }));
    const api: SourceDeployWithSecretsApiSurface = {
      createFunction: vi.fn(),
      listFunctions: vi.fn(async () => ({
        data: { data: [listItem("dev_help", "id-9")] },
      })),
      setSecret,
      updateFunction,
    };
    const result = await runSourceDeployWithSecrets(api, {
      files: FILES,
      name: "dev_help",
      secrets: [{ key: "ANTHROPIC_API_KEY", value: "sk-anth" }],
    });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.result.action).toBe("redeployed");
    // updateFunction must fire EXACTLY once on the existing-function path.
    // Calling it twice would briefly run the new code with the OLD secret
    // bindings (Workers snapshot secret env at deploy time), which is the
    // race the existing-function branch is built to avoid.
    expect(updateFunction).toHaveBeenCalledTimes(1);
    expect(updateFunction).toHaveBeenCalledWith({ files: FILES, id: "id-9" });
    expect(api.createFunction).not.toHaveBeenCalled();
    expect(setSecret).toHaveBeenCalledWith({
      id: "id-9",
      key: "ANTHROPIC_API_KEY",
      value: "sk-anth",
    });
  });

  it("returns a set-secret error with succeeded and pending keys when a write fails mid-loop", async () => {
    const setSecret = vi
      .fn()
      .mockResolvedValueOnce({ data: { data: secretResult("KEY_A") } })
      .mockResolvedValueOnce({ error: { code: "rate_limit_exceeded" } });
    const updateFunction = vi.fn();
    const api: SourceDeployWithSecretsApiSurface = {
      createFunction: vi.fn(async () => ({
        data: { data: createResult("dev_help", "id-1") },
      })),
      listFunctions: vi.fn(async () => ({ data: { data: [] } })),
      setSecret,
      updateFunction,
    };
    const result = await runSourceDeployWithSecrets(api, {
      files: FILES,
      name: "dev_help",
      secrets: [
        { key: "KEY_A", value: "a" },
        { key: "KEY_B", value: "b" },
        { key: "KEY_C", value: "c" },
      ],
    });
    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.stage).toBe("set-secret");
    if (result.stage !== "set-secret") return;
    expect(result.failedKey).toBe("KEY_B");
    expect(result.succeededKeys).toEqual(["KEY_A"]);
    expect(result.pendingKeys).toEqual(["KEY_C"]);
    expect(result.functionId).toBe("id-1");
    expect(result.created).toEqual(createResult("dev_help", "id-1"));
    // updateFunction must NOT fire after a set-secret failure: only some of
    // the bindings are written and pushing the bundle now would deploy the
    // new code with a half-written secret set, which is worse than leaving
    // the running handler on the previous deploy.
    expect(updateFunction).not.toHaveBeenCalled();
  });

  it("omits `created` and populates the full discriminator on set-secret errors against an existing function", async () => {
    const setSecret = vi
      .fn()
      .mockResolvedValueOnce({ data: { data: secretResult("KEY_A") } })
      .mockResolvedValueOnce({ error: { code: "rate_limit_exceeded" } });
    const api: SourceDeployWithSecretsApiSurface = {
      createFunction: vi.fn(),
      listFunctions: vi.fn(async () => ({
        data: { data: [listItem("dev_help", "id-9")] },
      })),
      setSecret,
      updateFunction: vi.fn(),
    };
    const result = await runSourceDeployWithSecrets(api, {
      files: FILES,
      name: "dev_help",
      secrets: [
        { key: "KEY_A", value: "a" },
        { key: "KEY_B", value: "b" },
        { key: "KEY_C", value: "c" },
      ],
    });
    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.stage).toBe("set-secret");
    if (result.stage !== "set-secret") return;
    expect(result.functionId).toBe("id-9");
    // No fresh create on the existing-function path means no `created`
    // CreateFunctionResult to surface; the function id is enough.
    expect(result.created).toBeUndefined();
    // The discriminator fields the CLI uses to build its stage-specific
    // stderr hint must still be populated; only `created` differs from
    // the new-function path. Asserting all three protects callers who
    // print "[succeeded] are now staged on the function row" warnings.
    expect(result.failedKey).toBe("KEY_B");
    expect(result.succeededKeys).toEqual(["KEY_A"]);
    expect(result.pendingKeys).toEqual(["KEY_C"]);
  });

  it("returns a secret-redeploy error when the final updateFunction fails on the new-function path", async () => {
    const setSecret = vi.fn(async () => ({
      data: { data: secretResult("KEY_A") },
    }));
    const api: SourceDeployWithSecretsApiSurface = {
      createFunction: vi.fn(async () => ({
        data: { data: createResult("dev_help", "id-1") },
      })),
      listFunctions: vi.fn(async () => ({ data: { data: [] } })),
      setSecret,
      updateFunction: vi.fn(async () => ({
        error: {
          code: "build_failed",
          details: { phase: "bundle" },
        },
      })),
    };
    const result = await runSourceDeployWithSecrets(api, {
      files: FILES,
      name: "dev_help",
      secrets: [{ key: "KEY_A", value: "a" }],
    });
    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.stage).toBe("secret-redeploy");
    if (result.stage !== "secret-redeploy") return;
    expect(result.succeededKeys).toEqual(["KEY_A"]);
    expect(result.functionId).toBe("id-1");
    expect(result.created).toEqual(createResult("dev_help", "id-1"));
  });

  it("returns a secret-redeploy error without `created` when the function already existed", async () => {
    const setSecret = vi.fn(async () => ({
      data: { data: secretResult("KEY_A") },
    }));
    const api: SourceDeployWithSecretsApiSurface = {
      createFunction: vi.fn(),
      listFunctions: vi.fn(async () => ({
        data: { data: [listItem("dev_help", "id-9")] },
      })),
      setSecret,
      updateFunction: vi.fn(async () => ({
        error: { code: "build_failed", details: { phase: "bundle" } },
      })),
    };
    const result = await runSourceDeployWithSecrets(api, {
      files: FILES,
      name: "dev_help",
      secrets: [{ key: "KEY_A", value: "a" }],
    });
    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.stage).toBe("secret-redeploy");
    if (result.stage !== "secret-redeploy") return;
    // No fresh create happened on the existing-function path, so `created`
    // must be absent. The CLI uses this to decide whether the stderr hint
    // says "was created" or "already existed".
    expect(result.created).toBeUndefined();
    expect(result.functionId).toBe("id-9");
    expect(result.succeededKeys).toEqual(["KEY_A"]);
  });

  it("surfaces a real createFunction error on the new-function path with its payload", async () => {
    const setSecret = vi.fn();
    const updateFunction = vi.fn();
    const buildFailedPayload = {
      error: {
        code: "build_failed",
        details: {
          errors: [
            {
              code: "unresolved_import",
              file: "src/index.ts",
              message: 'Could not resolve "@zorbify/sdk"',
            },
          ],
          phase: "bundle",
        },
      },
    };
    const api: SourceDeployWithSecretsApiSurface = {
      createFunction: vi.fn(async () => ({ error: buildFailedPayload })),
      listFunctions: vi.fn(async () => ({ data: { data: [] } })),
      setSecret,
      updateFunction,
    };
    const result = await runSourceDeployWithSecrets(api, {
      files: FILES,
      name: "dev_help",
      secrets: [{ key: "KEY_A", value: "a" }],
    });
    expect(result.kind).toBe("error");
    if (result.kind !== "error") return;
    expect(result.stage).toBe("create");
    // The CLI's runSourceMode runs renderBuildFailure against payload to
    // render the structured per-error diagnostics. Carrying the original
    // payload through unchanged is what makes that work; replacing it with
    // a generic "create failed" envelope would silently swallow the
    // bundler's specific error rows. extractErrorPayload unwraps the outer
    // `{ error: ... }` envelope, so we assert on the inner shape.
    expect(result.payload).toMatchObject({
      code: "build_failed",
      details: {
        errors: [{ code: "unresolved_import", file: "src/index.ts" }],
        phase: "bundle",
      },
    });
    expect(setSecret).not.toHaveBeenCalled();
    expect(updateFunction).not.toHaveBeenCalled();
  });

  it("surfaces a lookup error without touching create, set-secret, or updateFunction", async () => {
    const setSecret = vi.fn();
    const updateFunction = vi.fn();
    const createFunction = vi.fn();
    const api: SourceDeployWithSecretsApiSurface = {
      createFunction,
      listFunctions: vi.fn(async () => ({ error: { code: "unauthorized" } })),
      setSecret,
      updateFunction,
    };
    const result = await runSourceDeployWithSecrets(api, {
      files: FILES,
      name: "dev_help",
      secrets: [{ key: "KEY_A", value: "a" }],
    });
    expect(result.kind).toBe("error");
    if (result.kind === "error") expect(result.stage).toBe("lookup");
    expect(createFunction).not.toHaveBeenCalled();
    expect(setSecret).not.toHaveBeenCalled();
    expect(updateFunction).not.toHaveBeenCalled();
  });
});

describe("renderBuildFailure", () => {
  it("renders phase and per-error diagnostics for a build_failed payload", () => {
    const chunks: string[] = [];
    const handled = renderBuildFailure(
      {
        error: {
          code: "build_failed",
          details: {
            errors: [
              {
                code: "unresolved_import",
                file: "src/index.ts",
                line: 3,
                message: 'Could not resolve "missing"',
              },
            ],
            phase: "bundle",
          },
        },
      },
      (chunk) => chunks.push(chunk),
    );
    const out = chunks.join("");
    expect(handled).toBe(true);
    expect(out).toContain("Build failed during bundle");
    expect(out).toContain("unresolved_import");
    expect(out).toContain("src/index.ts:3");
  });

  it("returns false for a non-build_failed payload", () => {
    const handled = renderBuildFailure(
      { error: { code: "unauthorized" } },
      () => {},
    );
    expect(handled).toBe(false);
  });
});
