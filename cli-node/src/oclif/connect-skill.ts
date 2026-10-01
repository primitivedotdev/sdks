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
};

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

function installedVersion(target: string): string | null {
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
  let existing: ReturnType<typeof lstatSync> | null = null;
  try {
    existing = lstatSync(target);
  } catch {
    existing = null;
  }
  const previous = existing ? installedVersion(target) : null;
  if (previous === options.bundle.version)
    return { ...base, state: "unchanged", ...copies() };
  const link = existing?.isSymbolicLink() ? readlinkSync(target) : null;
  const root = dirname(target);
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
    if (link !== null) unlinkSync(target);
    else if (existing) renameSync(target, retired);
    try {
      renameSync(staging, target);
    } catch (error) {
      if (link !== null) symlinkSync(link, target);
      else if (existing && existsSync(retired)) renameSync(retired, target);
      throw error;
    }
    rmSync(retired, { recursive: true, force: true });
    return {
      ...base,
      state: existing ? "updated" : "installed",
      ...(previous ? { previousVersion: previous } : {}),
      ...copies(),
    };
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    return {
      ...base,
      state: "failed",
      reason:
        (error as NodeJS.ErrnoException | null)?.code ?? "skill_install_failed",
      ...copies(),
    };
  }
}
