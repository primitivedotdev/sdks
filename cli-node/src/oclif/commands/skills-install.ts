import { Args, Command, Flags } from "@oclif/core";
import {
  bundledSkillNames,
  installSkill,
  readBundledSkill,
  type SkillInstall,
} from "../connect-skill.js";
import { JSON_OUTPUT_FLAG } from "../json-output.js";
import type { AgentRuntime } from "../runtime-session.js";

export type InstalledSkill = SkillInstall & { name: string };

/**
 * Install every skill bundled in the CLI package at `packageRoot`, or only
 * `name`, for one runtime. Returns null when `name` is not bundled.
 */
export function installBundledSkills(options: {
  packageRoot: string;
  name?: string;
  runtime: AgentRuntime;
  project?: boolean;
  cwd?: string;
  env?: Record<string, string | undefined>;
}): InstalledSkill[] | null {
  const bundled = bundledSkillNames(options.packageRoot);
  if (options.name !== undefined && !bundled.includes(options.name))
    return null;
  const names = options.name === undefined ? bundled : [options.name];
  return names.map((name) => {
    let bundle: ReturnType<typeof readBundledSkill>;
    try {
      bundle = readBundledSkill(options.packageRoot, name);
    } catch {
      return {
        name,
        state: "failed",
        runtime: options.runtime,
        path: null,
        version: null,
        reason: "bundle_unreadable",
      };
    }
    return {
      name,
      ...installSkill({
        bundle,
        runtime: options.runtime,
        project: options.project,
        cwd: options.cwd,
        env: options.env,
      }),
    };
  });
}

function describe(skill: InstalledSkill): string {
  const version = skill.version ? ` ${skill.version}` : "";
  const where = skill.path ? ` at ${skill.path}` : "";
  if (skill.state === "failed")
    return `${skill.name}: not installed${where} (${skill.reason ?? "skill_install_failed"})`;
  const previous = skill.previousVersion
    ? ` (was ${skill.previousVersion})`
    : "";
  return `${skill.name}${version}: ${skill.state}${where}${previous}`;
}

export default class SkillsInstallCommand extends Command {
  static summary = "Install the skills bundled with this CLI";
  static description =
    "Copies the skills bundled in this CLI package into a runtime's skills folder: every bundled skill, or only the one named. Claude Code skills go to ~/.claude/skills (or $CLAUDE_CONFIG_DIR/skills), Codex skills to ~/.codex/skills (or $CODEX_HOME/skills); with --project, to .claude/skills or .agents/skills in the current directory. A skill already at the bundled version is left unchanged, a different copy is replaced in one rename, and a symlink is replaced by a real directory without touching its target. Reports each skill's path and content version. A runtime loads skills when a session starts, so start a new session to use one. Exits 1 when a skill could not be installed.";
  static examples = [
    "<%= config.bin %> skills install --runtime claude",
    "<%= config.bin %> skills install primitive-connect --runtime codex --json",
    "<%= config.bin %> skills install --runtime claude --project",
  ];
  static args = {
    name: Args.string({
      description: "Install only this bundled skill",
      required: false,
    }),
  };
  static flags = {
    runtime: Flags.string({
      description: "Runtime whose skills folder receives the skills",
      options: ["claude", "codex"],
      required: true,
    }),
    project: Flags.boolean({
      description:
        "Install into the current directory's project skills folder instead of the user's",
    }),
    json: JSON_OUTPUT_FLAG,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SkillsInstallCommand);
    const skills = installBundledSkills({
      packageRoot: this.config.root,
      name: args.name,
      runtime: flags.runtime as AgentRuntime,
      project: flags.project,
    });
    if (skills === null) {
      const bundled = bundledSkillNames(this.config.root);
      this.error(
        `${args.name} is not bundled with this CLI. Bundled skills: ${bundled.join(", ") || "none"}.`,
        { exit: 2 },
      );
    }
    if (skills.length === 0)
      this.error("This CLI package has no bundled skills.", { exit: 1 });
    if (flags.json) this.log(JSON.stringify({ skills }, null, 2));
    else for (const skill of skills) this.log(describe(skill));
    if (skills.some((skill) => skill.state === "failed")) process.exitCode = 1;
  }
}
