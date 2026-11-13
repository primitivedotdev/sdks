import path from "node:path";
import { fileURLToPath } from "node:url";
import { Config } from "@oclif/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import VersionCommand from "../../src/oclif/commands/version.js";
import PrimitiveHelp from "../../src/oclif/help.js";
import { COMMANDS } from "../../src/oclif/index.js";

const pkgRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

function captureLog(): string[] {
  const output: string[] = [];
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    output.push(args.map(String).join(" "));
  });
  return output;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("primitive version", () => {
  it("is registered as a root command", () => {
    expect(COMMANDS.version).toBe(VersionCommand);
  });

  it("prints exactly what --version prints, with no login and no request", async () => {
    vi.stubEnv("PRIMITIVE_API_KEY", "");
    vi.stubEnv("PRIMITIVE_AGENT_PROFILE", "");
    const fetch = vi.spyOn(globalThis, "fetch");
    const config = await Config.load(pkgRoot);
    const output = captureLog();
    await VersionCommand.run([], pkgRoot);
    // oclif's --version prints config.userAgent; the CLI smoke test also
    // compares the two commands' output on the packed CLI.
    expect(output).toEqual([config.userAgent]);
    expect(config.userAgent).toBe(
      `primitive/${config.version} ${config.platform}-${config.arch} node-${process.version}`,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("prints version, platform, arch and node with --json", async () => {
    const config = await Config.load(pkgRoot);
    const output = captureLog();
    await VersionCommand.run(["--json"], pkgRoot);
    expect(JSON.parse(output.join("\n"))).toEqual({
      version: config.version,
      platform: config.platform,
      arch: config.arch,
      node: process.versions.node,
    });
  });

  it("is listed in the root help", async () => {
    const config = await Config.load(pkgRoot);
    const output = captureLog();
    await new PrimitiveHelp(config).showHelp([]);
    const help = output.join("\n");
    expect(help).toMatch(/^ {2}version\b/m);
    expect(help).toContain("Print the CLI version");
  });
});
