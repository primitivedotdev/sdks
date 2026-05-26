import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  CreateFunctionResult,
  FunctionDetail,
  FunctionListItem,
} from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  collectSourceFiles,
  renderBuildFailure,
  runSourceDeploy,
  type SourceDeployApiSurface,
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
