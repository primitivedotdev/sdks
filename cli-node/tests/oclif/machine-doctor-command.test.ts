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

it("passes --profile through and requires --fix with it", async () => {
  vi.spyOn(MachineDoctorCommand.prototype, "log").mockImplementation(
    () => undefined,
  );
  mocks.runMachineDoctor.mockResolvedValue(report("ok"));
  await expect(
    MachineDoctorCommand.run(["--profile", "my-agent"], { root }),
  ).rejects.toThrow(/add --fix/);
  expect(mocks.runMachineDoctor).not.toHaveBeenCalled();
  await MachineDoctorCommand.run(
    [
      "--fix",
      "--check",
      "claude.hook.stop",
      "--profile",
      "my-agent",
      "--profile",
      "other",
    ],
    { root },
  );
  const options = mocks.runMachineDoctor.mock.calls[0]?.[0];
  expect([...options.profiles]).toEqual(["my-agent", "other"]);
});

it("prints one line per receive hook it would change or changed, capped", async () => {
  const outputs: string[] = [];
  vi.spyOn(MachineDoctorCommand.prototype, "log").mockImplementation((line) => {
    outputs.push(String(line));
  });
  const session = "11111111-1111-4111-8111-111111111111";
  const items = Array.from({ length: 12 }, (_, index) => ({
    profile: `agent-${index}`,
    session,
    hook: "Stop" as const,
    state: "missing" as const,
  }));
  mocks.runMachineDoctor.mockResolvedValue({
    ...report("fail"),
    checks: [
      {
        id: "claude.hook.stop",
        title: "Claude per-session receive hooks",
        status: "fail",
        detail: "Per-session receive hooks need cleanup.",
        fixable: true,
        items,
        changes: [
          {
            profile: null,
            session: null,
            hook: "SessionStart",
            state: "stale",
            action: "removed",
          },
          {
            profile: "my-agent",
            session,
            hook: "Stop",
            state: "outdated",
            action: "updated",
          },
        ],
      },
    ],
  });
  await MachineDoctorCommand.run([], { root });
  const lines = (outputs[0] ?? "").split("\n");
  expect(lines[0]).toBe(
    "[FAIL] claude.hook.stop: Per-session receive hooks need cleanup.",
  );
  expect(lines.slice(1, 4)).toEqual([
    "  Changed:",
    "    Removed SessionStart hook for a profile an old CLI did not record (session disconnected or removed)",
    `    Rewrote Stop hook for profile my-agent, session ${session} (old CLI path)`,
  ]);
  expect(lines[4]).toBe("  Still needing repair:");
  expect(lines[5]).toBe(
    `    Stop hook for profile agent-0, session ${session}: missing`,
  );
  expect(lines.slice(5)).toHaveLength(11);
  expect(lines.at(-1)).toBe("    and 2 more");
});

it("lists hooks excluded by --profile apart from those the run would change", async () => {
  const outputs: string[] = [];
  vi.spyOn(MachineDoctorCommand.prototype, "log").mockImplementation((line) => {
    outputs.push(String(line));
  });
  const session = "11111111-1111-4111-8111-111111111111";
  mocks.runMachineDoctor.mockResolvedValue({
    ...report("fail"),
    checks: [
      {
        id: "claude.hook.stop",
        title: "Claude per-session receive hooks",
        status: "fail",
        detail: "Per-session receive hooks need cleanup.",
        fixable: true,
        items: [
          {
            profile: "my-agent",
            session,
            hook: "Stop",
            state: "outdated",
            selected: true,
          },
          {
            profile: "test-agent",
            session,
            hook: "Stop",
            state: "missing",
            selected: false,
          },
        ],
      },
    ],
  });
  await MachineDoctorCommand.run(
    ["--fix", "--check", "claude.hook.stop", "--profile", "my-agent"],
    { root },
  );
  expect((outputs[0] ?? "").split("\n").slice(1)).toEqual([
    "  Would change:",
    `    Stop hook for profile my-agent, session ${session}: old CLI path`,
    "  Not selected (left unchanged by --profile):",
    `    Stop hook for profile test-agent, session ${session}: missing`,
  ]);
});
