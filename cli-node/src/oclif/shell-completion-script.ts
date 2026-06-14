import { readFileSync } from "node:fs";
import path from "node:path";

export type FunctionFileShell = "bash" | "zsh";

/**
 * Path to the sourceable completion *function* file that
 * `@oclif/plugin-autocomplete` writes under the CLI cache dir when its cache is
 * built. This is the artifact a shell is meant to source -- a package manager
 * dropping a file into `bash_completion.d/` or zsh's `site-functions/` wants
 * this, NOT the human-readable setup instructions printed by
 * `<bin> autocomplete <shell>`. The layout mirrors the plugin's own
 * `Create.bashCompletionFunctionPath` / `zshCompletionFunctionPath` getters:
 *   <cacheDir>/autocomplete/functions/bash/<bin>.bash
 *   <cacheDir>/autocomplete/functions/zsh/_<bin>
 *
 * This couples to a private path layout in `@oclif/plugin-autocomplete`
 * (pinned `^3.2.45` in package.json). If a major bump reorganises that cache
 * dir, `readCompletionFunction` will fail even after a successful
 * `--refresh-cache`; re-verify this layout when bumping the plugin.
 */
export function completionFunctionPath(
  cacheDir: string,
  bin: string,
  shell: FunctionFileShell,
): string {
  const functionsDir = path.join(cacheDir, "autocomplete", "functions", shell);
  const fileName = shell === "bash" ? `${bin}.bash` : `_${bin}`;
  return path.join(functionsDir, fileName);
}

/**
 * Read the generated completion function script, trimmed of trailing
 * whitespace so the caller can re-add a single newline. Throws an actionable
 * error (rather than a bare `ENOENT`) if the cached script is missing -- e.g.
 * the cache build failed, or the plugin changed its path layout.
 */
export function readCompletionFunction(
  cacheDir: string,
  bin: string,
  shell: FunctionFileShell,
): string {
  const filePath = completionFunctionPath(cacheDir, bin, shell);
  try {
    return readFileSync(filePath, "utf8").trimEnd();
  } catch (cause) {
    throw new Error(
      `Could not read the generated ${shell} completion script at ${filePath}. ` +
        `Run \`${bin} autocomplete ${shell} --refresh-cache\` and try again.`,
      { cause },
    );
  }
}
