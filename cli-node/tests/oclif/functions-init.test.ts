import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isValidFunctionName,
  renderHandler,
  renderPackageJson,
  scaffoldFiles,
  writeScaffold,
} from "../../src/oclif/commands/functions-init.js";
import { COMMANDS } from "../../src/oclif/index.js";

describe("functions:init command registration", () => {
  it("registers in the COMMANDS map", () => {
    expect(COMMANDS["functions:init"]).toBeDefined();
  });
});

describe("isValidFunctionName", () => {
  it("accepts simple slug-style names", () => {
    expect(isValidFunctionName("my-fn")).toBe(true);
    expect(isValidFunctionName("forwarder")).toBe(true);
    expect(isValidFunctionName("test_fn_2")).toBe(true);
    expect(isValidFunctionName("a")).toBe(true);
  });

  it("rejects uppercase, dots, spaces, slashes, and path traversal", () => {
    expect(isValidFunctionName("MyFn")).toBe(false);
    expect(isValidFunctionName("my.fn")).toBe(false);
    expect(isValidFunctionName("my fn")).toBe(false);
    expect(isValidFunctionName("my/fn")).toBe(false);
    expect(isValidFunctionName("../escape")).toBe(false);
    expect(isValidFunctionName("")).toBe(false);
  });

  it("rejects leading hyphen or underscore", () => {
    // First character must be a letter or digit so the name is safe
    // to use as a directory name and as a positional CLI argument.
    expect(isValidFunctionName("-leading")).toBe(false);
    expect(isValidFunctionName("_leading")).toBe(false);
  });
});

describe("renderHandler", () => {
  it("imports createPrimitiveClient from @primitivedotdev/sdk/api, NOT the root", () => {
    // This is the regression guard for the Run 4 footgun: importing
    // from the package root pulls in node:crypto-dependent webhook
    // helpers and breaks Workers-style bundles. The scaffolder must
    // teach the /api subpath specifically.
    const handler = renderHandler();
    expect(handler).toContain(
      'import { createPrimitiveClient } from "@primitivedotdev/sdk/api";',
    );
    expect(handler).not.toMatch(/from\s+"@primitivedotdev\/sdk"\s*;/);
  });

  it("exports a Worker-style default with async fetch(req, env)", () => {
    const handler = renderHandler();
    expect(handler).toContain("export default {");
    expect(handler).toContain("async fetch(");
  });

  it("calls client.send to demonstrate the SDK reply pattern, not raw fetch", () => {
    // The whole point of this scaffolder is to ship a handler that
    // uses the SDK rather than raw fetch against /api/v1/send-mail.
    const handler = renderHandler();
    expect(handler).toContain("client.send(");
    expect(handler).not.toContain("/api/v1/send-mail");
  });

  it("documents that PRIMITIVE_API_KEY is auto-injected by the runtime", () => {
    const handler = renderHandler();
    expect(handler).toContain("PRIMITIVE_API_KEY");
    expect(handler).toContain("auto-injected");
  });

  it("branches on event.event so future event types do not retry-loop", () => {
    // AGX feedback: handlers that assume every POST is email.received
    // start throwing the day Primitive adds another event type, which
    // Primitive then retries 6 times with backoff. A discriminator
    // guard in the scaffold defaults users into the safe shape.
    const handler = renderHandler();
    expect(handler).toContain('event.event !== "email.received"');
    expect(handler).toMatch(/skipped:\s*event\.event/);
  });

  it("wraps the body in try/catch returning 2xx on caught errors", () => {
    // AGX feedback: a thrown handler is retried up to 6 times by the
    // webhook delivery loop, which burns the invocation budget on
    // bugs that won't fix themselves. Catching and returning 2xx is
    // the safer default; the scaffold documents the tradeoff so the
    // user can flip to 5xx if they actually want retries.
    const handler = renderHandler();
    expect(handler).toContain("try {");
    expect(handler).toContain("} catch (err) {");
    expect(handler).toContain("console.error(");
    // Caught path still returns 2xx (status: 200 explicit on the
    // error branch so the intent is unmistakable).
    expect(handler).toMatch(/status:\s*200/);
  });

  it("explains the recipient gate above the SDK send call", () => {
    // The single biggest "I think the product is broken" surprise
    // across AGX runs is the outbound recipient gate. A short pointer
    // to the docs above the send() call defuses it before the handler
    // ships.
    const handler = renderHandler();
    expect(handler).toContain(
      "https://www.primitive.dev/docs/sending#who-you-can-send-to",
    );
    expect(handler).toMatch(/recipient_not_allowed/i);
  });
});

describe("renderPackageJson", () => {
  it("is valid JSON and substitutes the function name into the package name", () => {
    const raw = renderPackageJson("test-fn");
    const parsed = JSON.parse(raw) as {
      name: string;
      type: string;
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(parsed.name).toBe("test-fn");
    expect(parsed.type).toBe("module");
    expect(parsed.dependencies["@primitivedotdev/sdk"]).toMatch(/^\^/);
    expect(parsed.devDependencies.esbuild).toMatch(/^\^/);
  });

  it("ships the same @primitivedotdev/sdk version range the CLI itself depends on", () => {
    // Regression guard: scaffolded projects must use the same SDK
    // version range that this CLI was built and tested against.
    // Lockstep avoids generating handlers that target an SDK release
    // we haven't actually exercised.
    const cliPkgPath = resolve(__dirname, "../../package.json");
    const cliPkg = JSON.parse(readFileSync(cliPkgPath, "utf8")) as {
      dependencies: Record<string, string>;
    };
    const scaffolded = JSON.parse(renderPackageJson("test-fn")) as {
      dependencies: Record<string, string>;
    };
    expect(scaffolded.dependencies["@primitivedotdev/sdk"]).toBe(
      cliPkg.dependencies["@primitivedotdev/sdk"],
    );
  });

  it("substitutes the function name into the deploy script", () => {
    const raw = renderPackageJson("forwarder");
    const parsed = JSON.parse(raw) as { scripts: Record<string, string> };
    expect(parsed.scripts.deploy).toContain("--name forwarder");
    expect(parsed.scripts.deploy).toContain("./dist/handler.js");
  });

  it("uses PRIMITIVE_FUNCTION_ID in the redeploy script for cross-shell portability", () => {
    const raw = renderPackageJson("forwarder");
    const parsed = JSON.parse(raw) as { scripts: Record<string, string> };
    expect(parsed.scripts.redeploy).toContain("$PRIMITIVE_FUNCTION_ID");
  });
});

describe("scaffoldFiles", () => {
  it("lists all six expected files in stable order", () => {
    const files = scaffoldFiles("my-fn").map((f) => f.relativePath);
    expect(files).toEqual([
      "handler.ts",
      "package.json",
      "build.mjs",
      "tsconfig.json",
      ".gitignore",
      "README.md",
    ]);
  });
});

describe("writeScaffold", () => {
  let workRoot: string;

  beforeEach(() => {
    workRoot = mkdtempSync(join(tmpdir(), "primitive-functions-init-"));
  });

  afterEach(() => {
    rmSync(workRoot, { force: true, recursive: true });
  });

  it("writes the expected files with the expected substitutions into a fresh dir", () => {
    const outDir = resolve(workRoot, "test-fn");
    writeScaffold({ name: "test-fn", outDir });

    const entries = readdirSync(outDir).sort();
    expect(entries).toEqual(
      [
        ".gitignore",
        "README.md",
        "build.mjs",
        "handler.ts",
        "package.json",
        "tsconfig.json",
      ].sort(),
    );

    const handler = readFileSync(resolve(outDir, "handler.ts"), "utf8");
    expect(handler).toContain(
      'import { createPrimitiveClient } from "@primitivedotdev/sdk/api";',
    );

    const pkg = JSON.parse(
      readFileSync(resolve(outDir, "package.json"), "utf8"),
    ) as { name: string; scripts: Record<string, string> };
    expect(pkg.name).toBe("test-fn");
    expect(pkg.scripts.deploy).toContain("--name test-fn");

    const buildMjs = readFileSync(resolve(outDir, "build.mjs"), "utf8");
    expect(buildMjs).toContain('conditions: ["worker", "browser"]');
    // Backlog item 20: the docs example referenced "workerd" which is
    // not in the SDK package.json's exports conditions. Make sure we
    // don't accidentally re-introduce the dead condition here.
    expect(buildMjs).not.toContain("workerd");

    const tsconfig = JSON.parse(
      readFileSync(resolve(outDir, "tsconfig.json"), "utf8"),
    ) as {
      compilerOptions: { types: string[]; lib: string[] };
    };
    expect(tsconfig.compilerOptions.types).toEqual([]);
    expect(tsconfig.compilerOptions.lib).toContain("WebWorker");

    const gitignore = readFileSync(resolve(outDir, ".gitignore"), "utf8");
    expect(gitignore).toContain("node_modules");
    expect(gitignore).toContain("dist");

    const readme = readFileSync(resolve(outDir, "README.md"), "utf8");
    expect(readme).toContain("# test-fn");
    expect(readme).toContain("npm run deploy");
  });

  it("refuses to overwrite an existing directory and leaves it untouched", () => {
    const outDir = resolve(workRoot, "already-here");
    // Pre-create the target with a sentinel file so we can verify the
    // scaffolder didn't trample it.
    writeScaffold({ name: "already-here", outDir });
    const sentinelBefore = readFileSync(resolve(outDir, "handler.ts"), "utf8");

    expect(() => writeScaffold({ name: "already-here", outDir })).toThrow(
      /already exists/,
    );

    // The pre-existing handler must be exactly as it was before the
    // second call: no partial overwrite, no half-rolled-back state.
    const sentinelAfter = readFileSync(resolve(outDir, "handler.ts"), "utf8");
    expect(sentinelAfter).toBe(sentinelBefore);
  });

  it("rejects an invalid function name and writes nothing", () => {
    const outDir = resolve(workRoot, "bad");
    expect(() => writeScaffold({ name: "Bad Name", outDir })).toThrow(
      /Invalid function name/,
    );

    // The outDir was never created because we bail before touching
    // the filesystem.
    expect(() => readdirSync(outDir)).toThrow();
  });
});
