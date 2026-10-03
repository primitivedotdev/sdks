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

export const CONNECT_SKILL_NAME = "primitive-connect";

export type AgentRuntime = "claude" | "codex";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The runtime whose tool environment names this exact session. A session ID
 * that matches neither runtime's variable has no detectable runtime.
 */
export function detectAgentRuntime(
  session: string,
  env: Record<string, string | undefined> = process.env,
): AgentRuntime | null {
  const wanted = session.toLowerCase();
  const claude = env.CLAUDE_CODE_SESSION_ID?.trim().toLowerCase();
  // The loaded Codex thread is the receiving identity; the process session
  // ID is only a fallback when no thread ID is exposed.
  const codex = (
    env.CODEX_THREAD_ID?.trim() || env.CODEX_SESSION_ID?.trim()
  )?.toLowerCase();
  if (!UUID.test(wanted)) return null;
  if (claude === wanted && codex !== wanted) return "claude";
  if (codex === wanted && claude !== wanted) return "codex";
  return null;
}

export function connectSkillTarget(options: {
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
  return join(root, "skills", CONNECT_SKILL_NAME);
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

export function connectSkillVersion(hashes: Record<string, string>): string {
  const digest = createHash("sha256");
  for (const file of Object.keys(hashes).sort())
    digest.update(`${file}\0${hashes[file]}\n`);
  return digest.digest("hex").slice(0, 16);
}

export type BundledConnectSkill = {
  directory: string;
  version: string;
  commit: string | null;
  files: Record<string, string>;
};

/** Read the copy shipped in this CLI package and refuse one that does not match its manifest. */
export function readBundledConnectSkill(
  packageRoot: string,
): BundledConnectSkill {
  const skillsDir = join(packageRoot, "dist", "skills");
  const directory = join(skillsDir, CONNECT_SKILL_NAME);
  const manifest = JSON.parse(
    readFileSync(join(skillsDir, `${CONNECT_SKILL_NAME}.json`), "utf8"),
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
    manifest.name !== CONNECT_SKILL_NAME ||
    !expected ||
    typeof manifest.version !== "string" ||
    connectSkillVersion(actual) !== manifest.version ||
    connectSkillVersion(expected) !== manifest.version
  )
    throw new Error("The bundled skill does not match its manifest.");
  return {
    directory,
    version: manifest.version,
    commit:
      typeof manifest.source?.commit === "string"
        ? manifest.source.commit
        : null,
    files: actual,
  };
}

export type ConnectSkillInstall = {
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
function recoverInterruptedInstall(root: string, target: string): boolean {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return false;
  }
  const stale = (name: string) => {
    try {
      return (
        Date.now() - lstatSync(join(root, name)).mtimeMs > STALE_LEFTOVER_MS
      );
    } catch {
      return false;
    }
  };
  const retired = entries
    .filter((name) => name.startsWith(`.${CONNECT_SKILL_NAME}.retired-`))
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
  for (const name of retired) {
    const deps = join(root, name, "node_modules");
    if (
      realDirectory &&
      existsSync(deps) &&
      !existsSync(join(target, "node_modules")) &&
      sameDependencies(join(root, name), target)
    ) {
      try {
        renameSync(deps, join(target, "node_modules"));
      } catch {
        /* Reinstalling with npm ci restores them. */
      }
    }
  }
  for (const name of [
    ...retired,
    ...entries
      .filter((entry) => entry.startsWith(`.${CONNECT_SKILL_NAME}.staging-`))
      .filter(stale),
  ])
    rmSync(join(root, name), { recursive: true, force: true });
  return recovered;
}

function declaresConnectSkill(directory: string): boolean {
  try {
    const text = readFileSync(join(directory, "SKILL.md"), "utf8");
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? "";
    return /^name:\s*["']?primitive-connect["']?\s*$/m.test(frontmatter);
  } catch {
    return false;
  }
}

function otherCopies(target: string): string[] {
  const root = dirname(target);
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter(
        (entry) =>
          !entry.name.startsWith(".") &&
          entry.name !== CONNECT_SKILL_NAME &&
          (entry.isDirectory() || entry.isSymbolicLink()),
      )
      .map((entry) => join(root, entry.name))
      .filter(declaresConnectSkill)
      .sort();
  } catch {
    return [];
  }
}

/** Version of an installed copy, or null when absent or unreadable. */
export function installedVersion(target: string): string | null {
  try {
    if (!statSync(target).isDirectory()) return null;
    return connectSkillVersion(hashFiles(target));
  } catch {
    return null;
  }
}

/**
 * Install or refresh the bundled skill for one runtime. The same version is
 * left untouched. A different copy is replaced in one rename, never beside a
 * second directory, and a symlink is replaced without touching its target.
 */
export function installConnectSkill(options: {
  bundle: BundledConnectSkill;
  runtime: AgentRuntime;
  project?: boolean;
  cwd?: string;
  env?: Record<string, string | undefined>;
}): ConnectSkillInstall {
  const target = connectSkillTarget(options);
  const base = {
    runtime: options.runtime,
    path: target,
    version: options.bundle.version,
  };
  const copies = () => {
    const found = otherCopies(target);
    return found.length ? { otherCopies: found } : {};
  };
  const root = dirname(target);
  const recovered = recoverInterruptedInstall(root, target);
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
  const staging = join(root, `.${CONNECT_SKILL_NAME}.staging-${randomUUID()}`);
  const retired = join(root, `.${CONNECT_SKILL_NAME}.retired-${randomUUID()}`);
  try {
    mkdirSync(root, { recursive: true });
    for (const file of Object.keys(options.bundle.files)) {
      mkdirSync(dirname(join(staging, file)), { recursive: true });
      copyFileSync(join(options.bundle.directory, file), join(staging, file));
    }
    if (connectSkillVersion(hashFiles(staging)) !== options.bundle.version)
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
