import { createHash, randomUUID } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import type { AgentRuntime } from "./runtime-session.js";

export const CONNECT_SKILL_NAME = "primitive-connect";

/** A bundled skill's name is also a directory name, so it stays this plain. */
const SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function isSkillName(value: string): boolean {
  return SKILL_NAME_PATTERN.test(value);
}

/** Where one skill is installed for a runtime, user-level or in the project. */
export function skillTarget(options: {
  name: string;
  runtime: AgentRuntime;
  project?: boolean;
  cwd?: string;
  env?: Record<string, string | undefined>;
}): string {
  const env = options.env ?? process.env;
  const cwd = resolve(options.cwd ?? process.cwd());
  const root =
    options.runtime === "claude"
      ? options.project
        ? join(cwd, ".claude")
        : resolve(env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"))
      : options.project
        ? join(cwd, ".agents")
        : resolve(env.CODEX_HOME || join(homedir(), ".codex"));
  return join(root, "skills", options.name);
}

export function connectSkillTarget(options: {
  runtime: AgentRuntime;
  project?: boolean;
  cwd?: string;
  env?: Record<string, string | undefined>;
}): string {
  return skillTarget({ ...options, name: CONNECT_SKILL_NAME });
}

/** A path printed into agent instructions stays on one line. */
export function printablePath(value: string): boolean {
  if (value.length === 0 || value.length > 1024) return false;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return false;
  }
  return true;
}

function skillFileIn(directory: string | null | undefined): string | null {
  if (!directory) return null;
  const file = join(directory, "SKILL.md");
  try {
    return printablePath(file) && statSync(file).isFile() ? file : null;
  } catch {
    return null;
  }
}

/**
 * The absolute SKILL.md path of an installed primitive-connect skill, or
 * null when none is found. `installedPath` (the directory an install just
 * wrote) is preferred; otherwise the runtime's user-level and project-level
 * install locations are checked. A runtime loads its skill list when a
 * session starts, so a skill installed mid-session is reachable only by
 * reading this file.
 */
export function installedConnectSkillFile(options: {
  runtime: AgentRuntime | null;
  installedPath?: string | null;
  cwd?: string;
  env?: Record<string, string | undefined>;
}): string | null {
  const explicit = skillFileIn(options.installedPath);
  if (explicit || !options.runtime) return explicit;
  for (const project of [false, true]) {
    const file = skillFileIn(
      connectSkillTarget({
        runtime: options.runtime,
        project,
        cwd: options.cwd,
        env: options.env,
      }),
    );
    if (file) return file;
  }
  return null;
}

/** Mirrors scripts/skill-files.mjs so installed and bundled versions compare equal. */
function included(relativePath: string): boolean {
  const parts = relativePath.split("/");
  if (parts.some((part) => part.startsWith(".") || part === "node_modules"))
    return false;
  return !/\.test\.[cm]?[jt]s$/.test(relativePath);
}

function listFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (directory: string, prefix: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(join(directory, entry.name), relative);
      else if (entry.isFile() && included(relative)) files.push(relative);
    }
  };
  walk(root, "");
  return files.sort();
}

function hashFiles(root: string, files = listFiles(root)) {
  const hashes: Record<string, string> = {};
  for (const file of files)
    hashes[file] = createHash("sha256")
      .update(readFileSync(join(root, file)))
      .digest("hex");
  return hashes;
}

export function skillVersion(hashes: Record<string, string>): string {
  const digest = createHash("sha256");
  for (const file of Object.keys(hashes).sort())
    digest.update(`${file}\0${hashes[file]}\n`);
  return digest.digest("hex").slice(0, 16);
}

export type BundledSkill = {
  name: string;
  directory: string;
  version: string;
  commit: string | null;
  files: Record<string, string>;
};

/** Names of the skills shipped in this CLI package, sorted. */
export function bundledSkillNames(packageRoot: string): string[] {
  const skillsDir = join(packageRoot, "dist", "skills");
  let entries: string[];
  try {
    entries = readdirSync(skillsDir);
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => entry.slice(0, -".json".length))
    .filter((name) => {
      if (!isSkillName(name)) return false;
      try {
        return statSync(join(skillsDir, name)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();
}

/** Read one skill shipped in this CLI package and refuse one that does not match its manifest. */
export function readBundledSkill(
  packageRoot: string,
  name: string,
): BundledSkill {
  if (!isSkillName(name)) throw new Error(`Not a skill name: ${name}`);
  const skillsDir = join(packageRoot, "dist", "skills");
  const directory = join(skillsDir, name);
  const manifest = JSON.parse(
    readFileSync(join(skillsDir, `${name}.json`), "utf8"),
  ) as {
    name?: unknown;
    version?: unknown;
    files?: unknown;
    source?: { commit?: unknown };
  };
  const expected =
    manifest.files &&
    typeof manifest.files === "object" &&
    !Array.isArray(manifest.files)
      ? (manifest.files as Record<string, string>)
      : null;
  const actual = hashFiles(directory);
  if (
    manifest.name !== name ||
    !expected ||
    typeof manifest.version !== "string" ||
    skillVersion(actual) !== manifest.version ||
    skillVersion(expected) !== manifest.version
  )
    throw new Error("The bundled skill does not match its manifest.");
  return {
    name,
    directory,
    version: manifest.version,
    commit:
      typeof manifest.source?.commit === "string"
        ? manifest.source.commit
        : null,
    files: actual,
  };
}

export function readBundledConnectSkill(packageRoot: string): BundledSkill {
  return readBundledSkill(packageRoot, CONNECT_SKILL_NAME);
}

export type SkillInstall = {
  state: "installed" | "updated" | "unchanged" | "skipped" | "failed";
  runtime: AgentRuntime | null;
  path: string | null;
  version: string | null;
  previousVersion?: string;
  reason?: string;
  /** Other directories in the same skills folder that declare this skill name. */
  otherCopies?: string[];
  /** A copy left by an interrupted refresh was moved back into place first. */
  recovered?: boolean;
  /** A symlink at the skill path was replaced by a real directory. */
  replacedLink?: boolean;
  /** Installed helper dependencies were kept, or must be reinstalled. */
  dependencies?: "kept" | "reinstall_needed";
};

/** Two skill copies declare the same helper dependencies. */
function sameDependencies(a: string, b: string): boolean {
  const digest = (path: string) => {
    try {
      return createHash("sha256").update(readFileSync(path)).digest("hex");
    } catch {
      return null;
    }
  };
  return ["package.json", "package-lock.json"].every(
    (file) => digest(join(a, file)) === digest(join(b, file)),
  );
}

/** Leftovers younger than this may belong to a refresh still in progress. */
const STALE_LEFTOVER_MS = 60_000;

/**
 * A refresh moves the old copy aside just before moving the new one in. If a
 * process stopped between those renames, put the old copy back so the skill
 * path is never left empty, and remove abandoned staging and retired copies.
 */
function recoverInterruptedInstall(
  root: string,
  target: string,
  name: string,
): boolean {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return false;
  }
  const stale = (entry: string) => {
    try {
      return (
        Date.now() - lstatSync(join(root, entry)).mtimeMs > STALE_LEFTOVER_MS
      );
    } catch {
      return false;
    }
  };
  const retired = entries
    .filter((entry) => entry.startsWith(`.${name}.retired-`))
    .filter(stale)
    .sort(
      (a, b) =>
        lstatSync(join(root, b)).mtimeMs - lstatSync(join(root, a)).mtimeMs,
    );
  let recovered = false;
  let missing = false;
  try {
    lstatSync(target);
  } catch {
    missing = true;
  }
  if (missing && retired[0]) {
    try {
      renameSync(join(root, retired[0]), target);
      recovered = true;
      retired.shift();
    } catch {
      /* Leave it for the next run; installing fresh still restores the path. */
    }
  }
  // A refresh interrupted after its new copy was in place leaves the helper
  // dependencies in the retired copy; carry them over when they still match.
  // Never through a symlink: its target is not ours to change.
  let realDirectory = false;
  try {
    realDirectory = lstatSync(target).isDirectory();
  } catch {
    realDirectory = false;
  }
  for (const copy of retired) {
    const deps = join(root, copy, "node_modules");
    if (
      realDirectory &&
      existsSync(deps) &&
      !existsSync(join(target, "node_modules")) &&
      sameDependencies(join(root, copy), target)
    ) {
      try {
        renameSync(deps, join(target, "node_modules"));
      } catch {
        /* Reinstalling with npm ci restores them. */
      }
    }
  }
  for (const leftover of [
    ...retired,
    ...entries
      .filter((entry) => entry.startsWith(`.${name}.staging-`))
      .filter(stale),
  ])
    rmSync(join(root, leftover), { recursive: true, force: true });
  return recovered;
}

function declaresSkill(directory: string, name: string): boolean {
  try {
    const text = readFileSync(join(directory, "SKILL.md"), "utf8");
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? "";
    return new RegExp(`^name:\\s*["']?${name}["']?\\s*$`, "m").test(
      frontmatter,
    );
  } catch {
    return false;
  }
}

function otherCopies(target: string, name: string): string[] {
  const root = dirname(target);
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter(
        (entry) =>
          !entry.name.startsWith(".") &&
          entry.name !== name &&
          (entry.isDirectory() || entry.isSymbolicLink()),
      )
      .map((entry) => join(root, entry.name))
      .filter((directory) => declaresSkill(directory, name))
      .sort();
  } catch {
    return [];
  }
}

/** Version of an installed copy, or null when absent or unreadable. */
export function installedVersion(target: string): string | null {
  try {
    if (!statSync(target).isDirectory()) return null;
    return skillVersion(hashFiles(target));
  } catch {
    return null;
  }
}

/**
 * Install or refresh the bundled skill for one runtime. The same version is
 * left untouched. A different copy is replaced in one rename, never beside a
 * second directory, and a symlink is replaced without touching its target.
 */
export function installSkill(options: {
  bundle: BundledSkill;
  runtime: AgentRuntime;
  project?: boolean;
  cwd?: string;
  env?: Record<string, string | undefined>;
}): SkillInstall {
  const name = options.bundle.name;
  const target = skillTarget({ ...options, name });
  const base = {
    runtime: options.runtime,
    path: target,
    version: options.bundle.version,
  };
  const copies = () => {
    const found = otherCopies(target, name);
    return found.length ? { otherCopies: found } : {};
  };
  const root = dirname(target);
  const recovered = recoverInterruptedInstall(root, target, name);
  let existing: ReturnType<typeof lstatSync> | null = null;
  try {
    existing = lstatSync(target);
  } catch {
    existing = null;
  }
  const previous = existing ? installedVersion(target) : null;
  // A symlinked copy can change independently of this CLI, so it is always
  // replaced by a real directory, even when its current content matches.
  const link = existing?.isSymbolicLink() ? readlinkSync(target) : null;
  const notes = {
    ...(recovered ? { recovered: true } : {}),
    ...(link !== null ? { replacedLink: true } : {}),
  };
  if (link === null && previous === options.bundle.version)
    return { ...base, state: "unchanged", ...notes, ...copies() };
  const staging = join(root, `.${name}.staging-${randomUUID()}`);
  const retired = join(root, `.${name}.retired-${randomUUID()}`);
  try {
    mkdirSync(root, { recursive: true });
    for (const file of Object.keys(options.bundle.files)) {
      mkdirSync(dirname(join(staging, file)), { recursive: true });
      copyFileSync(join(options.bundle.directory, file), join(staging, file));
    }
    if (skillVersion(hashFiles(staging)) !== options.bundle.version)
      throw new Error("Copied skill files do not match the bundle.");
    // Helper dependencies an agent installed with npm ci survive a refresh
    // when the lockfile is unchanged; otherwise the result says to reinstall.
    // They only ever live inside a complete copy (the old one until the new
    // one is in place), so an interruption at any point leaves them
    // recoverable by the next run.
    let dependencies: "kept" | "reinstall_needed" | undefined;
    if (
      link === null &&
      existing?.isDirectory() &&
      existsSync(join(target, "node_modules"))
    )
      dependencies = sameDependencies(target, staging)
        ? "kept"
        : "reinstall_needed";
    if (link !== null) unlinkSync(target);
    else if (existing) renameSync(target, retired);
    try {
      renameSync(staging, target);
    } catch (error) {
      if (link !== null) symlinkSync(link, target);
      else if (existing && existsSync(retired)) renameSync(retired, target);
      throw error;
    }
    if (dependencies === "kept") {
      try {
        renameSync(join(retired, "node_modules"), join(target, "node_modules"));
      } catch {
        dependencies = "reinstall_needed";
      }
    }
    rmSync(retired, { recursive: true, force: true });
    return {
      ...base,
      state: existing ? "updated" : "installed",
      ...(previous && previous !== options.bundle.version
        ? { previousVersion: previous }
        : {}),
      ...(dependencies ? { dependencies } : {}),
      ...notes,
      ...copies(),
    };
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    return {
      ...base,
      state: "failed",
      reason:
        (error as NodeJS.ErrnoException | null)?.code ?? "skill_install_failed",
      ...notes,
      ...copies(),
    };
  }
}
