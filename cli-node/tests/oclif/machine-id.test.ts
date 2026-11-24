import assert from "node:assert/strict";
import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, it as test } from "vitest";
import { AgentConnectionSetupError } from "../../src/oclif/connected-agent-profile.js";
import { MACHINE_ID, machineId } from "../../src/oclif/machine-id.js";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
function configDir(): string {
  const directory = mkdtempSync(join(tmpdir(), "primitive-machine-"));
  directories.push(directory);
  return join(directory, "config");
}

test("the machine id is made once, kept private, and stays the same", () => {
  const directory = configDir();
  const first = machineId(directory);
  assert.match(first, MACHINE_ID);
  assert.equal(machineId(directory), first);
  if (process.platform !== "win32")
    assert.equal(statSync(join(directory, "machine-id")).mode & 0o777, 0o600);
  assert.notEqual(machineId(configDir()), first);
});

test("an invalid machine id file is refused, never replaced", () => {
  const directory = configDir();
  machineId(directory);
  writeFileSync(join(directory, "machine-id"), "bad id\n");
  assert.throws(() => machineId(directory), AgentConnectionSetupError);
});
