import { randomUUID } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Claude Code hooks run Primitive through a small POSIX launcher instead of a
 * pinned Node binary. A version manager (nvm, n, asdf) or a package-runner
 * cache (npx) can remove the Node or CLI files a hook names at any time; the
 * launcher then falls back to another Node and another copy of the CLI, and
 * when it finds no Node at all it records a warning instead of failing
 * silently. Windows keeps hooks that name Node directly.
 */
export const HOOK_LAUNCHER_MARKER = "primitive-hook-launcher-v1";

export function hookLauncherSupported(
  platform: NodeJS.Platform = process.platform,
): boolean {
  return platform !== "win32";
}

export function hookLauncherPath(configDir: string): string {
  return join(resolve(configDir), "bin", "primitive-node");
}

/** Written by the launcher when no Node (or no CLI copy) can be found. */
export function hookLauncherWarningPath(configDir: string): string {
  return join(resolve(configDir), "bin", "primitive-node.warning");
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * The text hooks show when they cannot run. It is emitted inside a JSON string
 * by the shell script, so it must contain no double quote or backslash.
 */
/** Oldest Node major this CLI runs on (package.json `engines.node`). */
export const MIN_NODE_MAJOR = 22;

export const NO_NODE_WARNING = `Primitive wake hooks could not find Node.js ${MIN_NODE_MAJOR} or later, so new mail will not wake this session. Install it, then run \`primitive agent connect --resume\` for each connected session or \`primitive machine doctor --fix\`.`;
export const NO_CLI_WARNING =
  "Primitive wake hooks could not find the Primitive CLI (its package cache was removed and it could not be fetched again), so new mail will not wake this session. Run `npm install -g primitive`, then `primitive machine doctor --fix`.";

/** The read version of the CLI package whose bin/run.js is `entry`. */
export function cliPackageVersion(entry: string): string | null {
  try {
    const manifest = JSON.parse(
      readFileSync(join(dirname(entry), "..", "package.json"), "utf8"),
    ) as { name?: unknown; version?: unknown };
    return manifest.name === "primitive" &&
      typeof manifest.version === "string" &&
      /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version)
      ? manifest.version
      : null;
  } catch {
    return null;
  }
}

/**
 * The launcher script. It takes the hook's own arguments (the script to run,
 * then its arguments) and:
 *
 * 1. runs the pinned Node when it still exists, else the first `node` on
 *    PATH, else a sibling version of the pinned one, else a common install
 *    location;
 * 2. when the script the hook names is gone (a cleaned npx cache), runs the
 *    same script from the `primitive` on PATH, or from
 *    `npx -y -p primitive@<version>`;
 * 3. when neither can be found, writes a one-line warning, shows it once to
 *    the session through the PostToolUse hook, and exits 0 so Claude Code is
 *    never blocked.
 */
export function hookLauncherScript(params: {
  node: string;
  version: string | null;
  configDir: string;
  /** Tests turn this off: it searches nvm, Homebrew, /usr and Volta installs. */
  commonLocations?: boolean;
}): string {
  const warning = hookLauncherWarningPath(params.configDir);
  const common =
    params.commonLocations === false
      ? ""
      : ` "$nvm_root/current/bin/node" "$nvm_root"/versions/node/*/bin/node /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node "$HOME/.volta/bin/node"`;
  return `#!/bin/sh
# ${HOOK_LAUNCHER_MARKER}
# Written by the Primitive CLI. Claude Code hooks run Primitive through this
# file so they keep working when the Node.js or CLI copy they were installed
# with is removed. \`primitive agent connect --resume\` and
# \`primitive machine doctor --fix\` rewrite it.
pinned_node=${shellQuote(params.node)}
pinned_version=${shellQuote(params.version ?? "")}
warning_file=${shellQuote(warning)}

# Record why hooks cannot run, show it once to each session through its
# PostToolUse hook (the session id is the hook's sixth argument), and exit 0
# so Claude Code is never blocked.
fail_open() {
  mkdir -p "\${warning_file%/*}" 2>/dev/null
  printf '%s\\n' "$1" > "$warning_file" 2>/dev/null
  case "\${hook_script##*/}" in
    claude-pending-mail.mjs)
      session=$hook_session
      case "$session" in
        '' | *[!0-9A-Fa-f-]*) session=unknown ;;
      esac
      # mkdir is atomic, so of several hooks running at once only one
      # shows the warning.
      if mkdir "$warning_file.shown-$session" 2>/dev/null; then
        printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"%s"}}' "$1"
      fi
      ;;
  esac
  exit 0
}

# A fallback Node must be new enough to run this CLI.
supported() {
  [ -x "$1" ] && "$1" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= ${MIN_NODE_MAJOR} ? 0 : 1)' >/dev/null 2>&1
}

pick_node() {
  if [ -x "$pinned_node" ]; then node=$pinned_node; return 0; fi
  node=$(command -v node 2>/dev/null)
  if [ -n "$node" ] && supported "$node"; then return 0; fi
  versions=\${pinned_node%/*/bin/node}
  nvm_root=\${NVM_DIR:-$HOME/.nvm}
  for node in "$versions"/*/bin/node${common}; do
    if supported "$node"; then return 0; fi
  done
  node=
  return 1
}

package_dir() {
  "$node" -e 'process.stdout.write(require("path").dirname(require("fs").realpathSync(process.argv[1])))' "$1" 2>/dev/null
}

# A CLI copy whose bin directory holds both the hook script and run.js.
complete_copy() {
  [ -n "$1" ] && [ -f "$1/$name" ] && [ -f "$1/run.js" ]
}

hook_script=$1
hook_session=$6
pick_node || fail_open ${shellQuote(NO_NODE_WARNING)}
PATH=\${node%/*}:$PATH
export PATH

# The hook names a script and, after it, the CLI's run.js. When either is
# gone (a cleaned npx cache), both come from another copy of the CLI.
need_cli=
if [ $# -ge 1 ] && [ ! -f "$1" ]; then need_cli=1; fi
if [ $# -ge 2 ] && [ "\${2##*/}" = run.js ] && [ ! -f "$2" ]; then need_cli=1; fi
if [ -n "$need_cli" ]; then
  name=\${1##*/}
  dir=
  if [ -f "$1" ] && complete_copy "\${1%/*}"; then dir=\${1%/*}; fi
  if ! complete_copy "$dir"; then
    found=$(command -v primitive 2>/dev/null)
    if [ -n "$found" ]; then dir=$(package_dir "$found"); fi
  fi
  if ! complete_copy "$dir" && [ -n "$pinned_version" ]; then
    npx=\${node%/*}/npx
    [ -x "$npx" ] || npx=$(command -v npx 2>/dev/null)
    if [ -n "$npx" ]; then
      found=$("$npx" -y -p "primitive@$pinned_version" -c 'command -v primitive' 2>/dev/null | tail -n 1)
      if [ -n "$found" ]; then dir=$(package_dir "$found"); fi
    fi
  fi
  complete_copy "$dir" || fail_open ${shellQuote(NO_CLI_WARNING)}
  shift
  if [ $# -ge 1 ] && [ "\${1##*/}" = run.js ] && [ ! -f "$1" ]; then
    shift
    set -- "$dir/$name" "$dir/run.js" "$@"
  else
    set -- "$dir/$name" "$@"
  fi
fi

if [ -f "$warning_file" ]; then rm -rf "$warning_file" "$warning_file".shown-* 2>/dev/null; fi
exec "$node" "$@"
`;
}

/**
 * Write the launcher when its content differs, atomically and executable.
 * Returns true when the file changed. Throws when it cannot be written.
 */
export function writeHookLauncher(path: string, content: string): boolean {
  try {
    if (readFileSync(path, "utf8") === content) return false;
  } catch {
    /* Absent or unreadable: write it. */
  }
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, content, { mode: 0o755 });
    chmodSync(temporary, 0o755);
    renameSync(temporary, path);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
  return true;
}

/** The warning the launcher last wrote, or null when it found what it needed. */
export function readHookLauncherWarning(configDir: string): string | null {
  try {
    const text = readFileSync(
      hookLauncherWarningPath(configDir),
      "utf8",
    ).trim();
    return text || null;
  } catch {
    return null;
  }
}
