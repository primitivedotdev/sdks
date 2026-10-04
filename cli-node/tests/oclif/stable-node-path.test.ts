import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { stableNodePath } from "../../src/oclif/claude-machine-hooks.js";

const directories: string[] = [];
const cwd = process.cwd();
afterEach(() => {
  process.chdir(cwd);
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function linkedNode(): string {
  const root = mkdtempSync(join(tmpdir(), "stable-node-"));
  directories.push(root);
  mkdirSync(join(root, "bin"));
  symlinkSync(process.execPath, join(root, "bin", "node"));
  return root;
}

describe("stableNodePath", () => {
  it("uses an absolute PATH link to the running Node", () => {
    const root = linkedNode();
    expect(stableNodePath({ PATH: join(root, "bin") })).toBe(
      join(root, "bin", "node"),
    );
  });

  it("never returns a link found through a relative PATH entry", () => {
    const root = linkedNode();
    process.chdir(root);
    expect(stableNodePath({ PATH: "bin" })).toBe(process.execPath);
  });
});
