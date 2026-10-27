import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const script = fileURLToPath(new URL("./assert-tarball-isolation.mjs", import.meta.url));
const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });

test("explicit reuse avoids prepack and retains dependency isolation", () => {
  const dir = mkdtempSync(join(tmpdir(), "tarball isolation "));
  try {
    const pkg = { name: "isolation-fixture", version: "1.0.0", files: ["dist"], scripts: { prepack: "node build.cjs" } };
    writeFileSync(join(dir, "package.json"), JSON.stringify(pkg));
    writeFileSync(join(dir, "build.cjs"), `const fs=require('node:fs'); fs.mkdirSync('dist',{recursive:true}); fs.writeFileSync('dist/index.js','module.exports = 1;'); fs.appendFileSync('build-count','1');`);
    const missing = run("--already-built", dir);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /missing dist/);
    const built = run(dir);
    assert.equal(built.status, 0, built.stderr);
    assert.equal(readFileSync(join(dir, "build-count"), "utf8"), "1");
    const reused = run("--already-built", dir);
    assert.equal(reused.status, 0, reused.stderr);
    assert.equal(readFileSync(join(dir, "build-count"), "utf8"), "1");
    pkg.dependencies = { "@primitivedotdev/api-core": "1.0.0" };
    writeFileSync(join(dir, "package.json"), JSON.stringify(pkg));
    const forbidden = run("--already-built", dir);
    assert.notEqual(forbidden.status, 0);
    assert.match(forbidden.stderr, /Tarball isolation check FAILED/);
    pkg.dependencies = { "forbidden-package": "1.0.0" };
    writeFileSync(join(dir, "package.json"), JSON.stringify(pkg));
    assert.notEqual(run("--already-built", dir, "forbidden-package").status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
