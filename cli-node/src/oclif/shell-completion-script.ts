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
 * whitespace so the caller can re-add a single newline.
 */
export function readCompletionFunction(
  cacheDir: string,
  bin: string,
  shell: FunctionFileShell,
): string {
  return readFileSync(
    completionFunctionPath(cacheDir, bin, shell),
    "utf8",
  ).trimEnd();
}
