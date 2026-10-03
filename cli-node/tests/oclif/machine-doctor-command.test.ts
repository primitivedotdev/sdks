import { resolve } from "node:path";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ runMachineDoctor: vi.fn() }));
vi.mock("../../src/oclif/machine-doctor.js", async (original) => ({
  ...(await original<typeof import("../../src/oclif/machine-doctor.js")>()),
  runMachineDoctor: mocks.runMachineDoctor,
}));

import MachineDoctorCommand from "../../src/oclif/commands/machine-doctor.js";

const root = resolve(import.meta.dirname, "../..");

function report(status: "ok" | "fail") {
  return {
    version: 1,
    cliVersion: "1.40.0",
    checks: [
      {
        id: "cli.version",
        title: "Primitive CLI version",
        status,
        detail: status === "ok" ? "1.40.0 is current." : "Too old.",
        fixable: false,
      },
    ],
    summary: {
      ok: status === "ok" ? 1 : 0,
      warn: 0,
      fail: status === "fail" ? 1 : 0,
      skip: 0,
    },
    fixedCount: 0,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  process.exitCode = undefined;
});

it("passes --fix, repeated --check, --runtime and --min-cli-version through and prints one JSON report", async () => {
  const outputs: string[] = [];
  vi.spyOn(MachineDoctorCommand.prototype, "log").mockImplementation((line) => {
    outputs.push(String(line));
  });
  mocks.runMachineDoctor.mockResolvedValue(report("fail"));
  await MachineDoctorCommand.run(
    [
      "--fix",
      "--check",
      "claude.hook.stop",
      "--check",
      "skill.claude",
      "--runtime",
      "claude, codex",
      "--min-cli-version",
      "1.50.0",
      "--json",
    ],
    { root },
  );
  const options = mocks.runMachineDoctor.mock.calls[0]?.[0];
  expect(options.fix).toBe(true);
  expect([...options.only]).toEqual(["claude.hook.stop", "skill.claude"]);
  expect([...options.runtimes]).toEqual(["claude", "codex"]);
  expect(options.minCliVersion).toBe("1.50.0");
  expect(outputs).toHaveLength(1);
  expect(JSON.parse(outputs[0] ?? "").summary.fail).toBe(1);
  expect(process.exitCode).toBe(1);
});

it("exits 0 when every check is ok", async () => {
  vi.spyOn(MachineDoctorCommand.prototype, "log").mockImplementation(
    () => undefined,
  );
  mocks.runMachineDoctor.mockResolvedValue(report("ok"));
  await MachineDoctorCommand.run(["--json"], { root });
  expect(mocks.runMachineDoctor.mock.calls[0]?.[0].only).toBeUndefined();
  expect(process.exitCode).toBeUndefined();
});

it("rejects unknown checks and runtimes, and --check without --fix", async () => {
  await expect(
    MachineDoctorCommand.run(["--fix", "--check", "bogus.check"], { root }),
  ).rejects.toThrow(/Expected --check=bogus.check to be one of/);
  await expect(
    MachineDoctorCommand.run(["--runtime", "claude,cursor"], { root }),
  ).rejects.toThrow(/Unknown runtime cursor/);
  await expect(
    MachineDoctorCommand.run(["--check", "skill.claude"], { root }),
  ).rejects.toThrow(/add --fix/);
  expect(mocks.runMachineDoctor).not.toHaveBeenCalled();
});
