import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";

// Regression guard for Workers-style bundling of the Workers-safe entries.
//
// The email-reply project scaffolded by `primitive functions init` bundles
// a handler that imports from "@primitivedotdev/sdk/api" with exactly these
// esbuild settings (see renderBuildMjs in the CLI's function-templates).
// Any top-level `import ... from "node:fs"` (or another Node builtin)
// anywhere in the entry's import graph fails that build with
// `Could not resolve "node:fs"`, which broke every scaffolded project
// out of the box. Bundling the source entries here catches the regression
// without needing a dist build or a scaffolded project.
function bundleForWorkers(entryPoint: string) {
  return build({
    bundle: true,
    conditions: ["worker", "browser"],
    entryPoints: [entryPoint],
    format: "esm",
    logLevel: "silent",
    platform: "browser",
    target: "es2022",
    write: false,
  });
}

function sourceEntry(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

describe("workers-style bundling", () => {
  it("bundles the /api entry with zero errors", async () => {
    const result = await bundleForWorkers(
      sourceEntry("../../src/api/index.ts"),
    );
    expect(result.errors).toEqual([]);
    expect(result.outputFiles?.[0]?.text.length).toBeGreaterThan(0);
  });

  it("bundles the /payloads entry with zero errors", async () => {
    const result = await bundleForWorkers(
      sourceEntry("../../src/payloads/index.ts"),
    );
    expect(result.errors).toEqual([]);
    expect(result.outputFiles?.[0]?.text.length).toBeGreaterThan(0);
  });

  it("emits no static import of a node builtin in the /api bundle", async () => {
    const result = await bundleForWorkers(
      sourceEntry("../../src/api/index.ts"),
    );
    const text = result.outputFiles?.[0]?.text ?? "";
    // A static `import ... from "node:..."` would have failed the build
    // above already; this asserts the stronger property that the output
    // carries no top-level node: specifier at all.
    expect(text).not.toMatch(/^import .*"node:/m);
  });
});
