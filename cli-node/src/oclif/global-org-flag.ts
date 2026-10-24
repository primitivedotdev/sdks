/**
 * The global `--org <org>` flag. bin/run.js takes it out of argv before oclif
 * parses the command, so every command accepts it, and passes it on as
 * PRIMITIVE_CLI_ORG. Only a saved `primitive login` made as yourself can switch
 * organizations; every other credential refuses a different organization.
 *
 * No oclif import here: this runs before oclif loads.
 */

/** Selects the organization for one command. */
export const ORG_SELECTION_ENV = "PRIMITIVE_CLI_ORG";

export type GlobalOrgFlag =
  | { ok: true; argv: string[]; org: string | null }
  | { ok: false; message: string };

/** Split `--org <value>` and `--org=<value>` out of argv, before any `--`. */
export function extractGlobalOrgFlag(argv: readonly string[]): GlobalOrgFlag {
  const separator = argv.indexOf("--");
  const head = separator === -1 ? [...argv] : argv.slice(0, separator);
  const tail = separator === -1 ? [] : argv.slice(separator);
  // `memories` has its own boolean --org (organization-scoped memories). Select
  // an organization for it with PRIMITIVE_CLI_ORG instead.
  const command = head[0] ?? "";
  if (command === "memories" || command.startsWith("memories:")) {
    return { ok: true, argv: [...argv], org: null };
  }
  const kept: string[] = [];
  let org: string | null = null;
  for (let index = 0; index < head.length; index += 1) {
    const arg = head[index] as string;
    if (arg === "--org") {
      const value = head[index + 1];
      if (value === undefined || value.startsWith("-") || !value.trim()) {
        return {
          ok: false,
          message:
            "--org needs an organization id or name, for example `--org acme`.",
        };
      }
      org = value.trim();
      index += 1;
      continue;
    }
    if (arg.startsWith("--org=")) {
      const value = arg.slice("--org=".length).trim();
      if (!value) {
        return {
          ok: false,
          message:
            "--org needs an organization id or name, for example `--org=acme`.",
        };
      }
      org = value;
      continue;
    }
    kept.push(arg);
  }
  return { ok: true, argv: [...kept, ...tail], org };
}

/**
 * Apply the flag to this process: strip it from `process.argv` and set
 * PRIMITIVE_CLI_ORG. Returns an error message for a malformed flag.
 */
export function applyGlobalOrgFlag(
  processArgv: string[] = process.argv,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const parsed = extractGlobalOrgFlag(processArgv.slice(2));
  if (!parsed.ok) return parsed.message;
  if (parsed.org !== null) {
    processArgv.splice(2, processArgv.length - 2, ...parsed.argv);
    env[ORG_SELECTION_ENV] = parsed.org;
  }
  return null;
}

/**
 * `env` without an organization selection, for a child that acts as a
 * connected agent profile: the profile acts in its own organization.
 */
export function withoutOrgSelection(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const next = { ...env };
  delete next[ORG_SELECTION_ENV];
  return next;
}
