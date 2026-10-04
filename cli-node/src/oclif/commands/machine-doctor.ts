import { homedir } from "node:os";
import { Command, Flags } from "@oclif/core";
import {
  describeSessionHookChange,
  describeSessionHookItem,
} from "../claude-machine-hooks.js";
import {
  DOCTOR_CHECK_IDS,
  type DoctorCheck,
  runMachineDoctor,
} from "../machine-doctor.js";
import { MACHINE_RUNTIMES, type MachineRuntime } from "../machine-session.js";

const ITEM_LINES = 10;

/** At most `limit` indented lines, then "and N more". */
function capped(lines: string[], limit = ITEM_LINES): string[] {
  const shown = lines.slice(0, limit).map((line) => `    ${line}`);
  if (lines.length > limit) shown.push(`    and ${lines.length - limit} more`);
  return shown;
}

function renderCheck(check: DoctorCheck): string {
  const tag =
    check.status === "ok"
      ? "[OK]  "
      : check.status === "warn"
        ? "[WARN]"
        : check.status === "skip"
          ? "[SKIP]"
          : "[FAIL]";
  const fixed = check.fixed ? " (fixed)" : "";
  const lines = [`${tag} ${check.id}${fixed}: ${check.detail}`];
  if (check.changes?.length)
    lines.push(
      "  Changed:",
      ...capped(check.changes.map(describeSessionHookChange)),
    );
  if (check.status !== "ok" && check.items?.length) {
    const selected = check.items.filter((item) => item.selected !== false);
    const excluded = check.items.filter((item) => item.selected === false);
    if (selected.length)
      lines.push(
        check.changes?.length ? "  Still needing repair:" : "  Would change:",
        ...capped(selected.map(describeSessionHookItem)),
      );
    if (excluded.length)
      lines.push(
        "  Not selected (left unchanged by --profile):",
        ...capped(excluded.map(describeSessionHookItem)),
      );
  }
  return lines.join("\n");
}

export default class MachineDoctorCommand extends Command {
  static summary =
    "Check, and optionally repair, this machine's Primitive setup for coding agents";
  static description =
    "Checks everything that lets Claude Code, Codex and omp sessions on this machine register with Primitive and answer mail: the CLI install and version, the saved member login, Claude settings and Primitive's SessionStart, SessionEnd and per-session receive hooks, the managed instruction block in each runtime's global instructions file, the bundled primitive-connect skill, and saved agent profiles disconnected in Primitive. Each check reports ok, warn, fail or skip, whether it can be repaired automatically, and an action (login, install_cli, update_cli, edit_file) when only a person can fix it. --fix repairs what it safely can: it only adds, rewrites or removes Primitive-owned hooks, blocks and skill copies, backs up any existing file beside it as <file>.primitive-bak-<timestamp> before changing it, writes atomically, and changes nothing when nothing drifted, so it is safe to run on a timer. Malformed or hand-edited files it cannot parse are reported and left unchanged. Exits 0 when every check is ok or skipped, 1 otherwise.";
  static examples = [
    "<%= config.bin %> machine doctor",
    "<%= config.bin %> machine doctor --json",
    "<%= config.bin %> machine doctor --fix --json",
    "<%= config.bin %> machine doctor --fix --check claude.hook.stop --json",
    "<%= config.bin %> machine doctor --fix --check claude.hook.stop --profile my-agent",
    "<%= config.bin %> machine doctor --runtime claude,codex --min-cli-version 1.38.0 --json",
  ];
  static flags = {
    fix: Flags.boolean({
      description:
        "Repair every fixable check (or only those named with --check)",
    }),
    check: Flags.string({
      description:
        "With --fix, repair only this check; repeatable. Every check is still reported",
      multiple: true,
      options: [...DOCTOR_CHECK_IDS],
    }),
    profile: Flags.string({
      description:
        "With --fix, change per-session receive hooks only for this saved agent profile; repeatable. Naming a profile is also the only way --fix restores hooks for a profile bound to a session that already receives as another profile. Other checks are unaffected, so combine with --check claude.hook.stop to repair nothing else",
      multiple: true,
    }),
    runtime: Flags.string({
      description:
        "Comma-separated runtimes to check: claude, codex, omp. Defaults to every runtime found on this machine",
    }),
    "min-cli-version": Flags.string({
      description:
        "Report cli.version as failing when this CLI is older than the given version",
    }),
    json: Flags.boolean({ description: "Print the report as JSON" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(MachineDoctorCommand);
    let runtimes: Set<MachineRuntime> | undefined;
    if (flags.runtime) {
      const names = flags.runtime
        .split(",")
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean);
      const unknown = names.filter(
        (name) => !MACHINE_RUNTIMES.includes(name as MachineRuntime),
      );
      if (unknown.length)
        this.error(
          `Unknown runtime ${unknown.join(", ")}. Use claude, codex or omp.`,
          { exit: 2 },
        );
      runtimes = new Set(names as MachineRuntime[]);
    }
    if (flags.check?.length && !flags.fix)
      this.error("--check selects which checks --fix repairs; add --fix.", {
        exit: 2,
      });
    if (flags.profile?.length && !flags.fix)
      this.error("--profile narrows what --fix repairs; add --fix.", {
        exit: 2,
      });
    const report = await runMachineDoctor({
      fix: flags.fix,
      only: flags.check?.length ? new Set(flags.check) : undefined,
      profiles: flags.profile?.length ? new Set(flags.profile) : undefined,
      runtimes,
      configDir: this.config.configDir,
      home: homedir(),
      env: process.env,
      packageRoot: this.config.root,
      cliVersion: this.config.version,
      cliEntry: process.argv[1] ?? "",
      minCliVersion: flags["min-cli-version"],
    });
    if (flags.json) this.log(JSON.stringify(report));
    else {
      for (const check of report.checks) this.log(renderCheck(check));
      this.log(
        `${report.summary.ok} ok, ${report.summary.warn} warn, ${report.summary.fail} fail, ${report.summary.skip} skipped${report.fixedCount ? `; ${report.fixedCount} fixed` : ""}.`,
      );
      if (report.repair === "skipped_busy")
        this.log("Another repair was running, so nothing was changed.");
      else if (!flags.fix && report.checks.some((check) => check.fixable))
        this.log(
          "Run `primitive machine doctor --fix` to repair fixable checks.",
        );
    }
    if (report.summary.fail || report.summary.warn) process.exitCode = 1;
  }
}
