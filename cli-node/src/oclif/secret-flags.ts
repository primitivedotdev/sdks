// Shared parsing for the `--secret KEY=VALUE` flag used by both
// functions:deploy and functions:redeploy. Lives in its own module so
// neither command implicitly depends on the other's file path.

// Server-side constraint on secret keys. Mirrored client-side so
// malformed input is rejected before any side-effecting API call.
export const SECRET_KEY_RE = /^[A-Z_][A-Z0-9_]*$/;

// Parsed --secret K=V pair. Exported so unit tests can build the
// same value the commands produce internally.
export type SecretFlagPair = { key: string; value: string };

// Result of parsing the raw oclif --secret strings. Discriminated
// so the caller can decide whether to write a stderr error before
// touching the API surface.
export type ParseSecretFlagsResult =
  | { kind: "ok"; secrets: SecretFlagPair[] }
  | { kind: "error"; message: string };

// Split each `--secret KEY=VALUE` on the FIRST `=`. KEY must match
// `^[A-Z_][A-Z0-9_]*$`; VALUE may contain `=` (only the first one
// is treated as a delimiter). Duplicate KEYs are rejected: silently
// accepting two pairs with the same key would fan out to two
// setFunctionSecret writes where only the second wins, which is
// almost always a typo and never the intent.
export function parseSecretFlags(raw: string[]): ParseSecretFlagsResult {
  const secrets: SecretFlagPair[] = [];
  const seenKeys = new Set<string>();
  for (const entry of raw) {
    const eq = entry.indexOf("=");
    if (eq === -1) {
      return {
        kind: "error",
        message: `--secret expects KEY=VALUE (got ${JSON.stringify(entry)}). Example: --secret API_TOKEN=abc123`,
      };
    }
    const key = entry.slice(0, eq);
    const value = entry.slice(eq + 1);
    if (key.length === 0) {
      return {
        kind: "error",
        message: `--secret is missing a KEY before '=' (got ${JSON.stringify(entry)}). Example: --secret API_TOKEN=abc123`,
      };
    }
    if (!SECRET_KEY_RE.test(key)) {
      return {
        kind: "error",
        message: `--secret KEY ${JSON.stringify(key)} does not match ${SECRET_KEY_RE.source} (uppercase letters, digits, underscores; first character is a letter or underscore).`,
      };
    }
    if (seenKeys.has(key)) {
      return {
        kind: "error",
        message: `--secret KEY ${JSON.stringify(key)} was passed more than once. Each key may only appear once per command.`,
      };
    }
    seenKeys.add(key);
    secrets.push({ key, value });
  }
  return { kind: "ok", secrets };
}

// Shared flag-description copy so both functions:deploy and
// functions:redeploy advertise the same security caveat and KEY
// constraints. The shell-history note is the load-bearing piece:
// CLI flag values land in ~/.bash_history, `ps aux`, and
// /proc/[pid]/cmdline, so callers handling sensitive values
// should set them via a shell variable (ideally read via `read -s`
// or piped from a secrets manager) and reference the variable on
// the command line. The variable still appears in `ps`-visible
// argv, but at least the literal value does not get archived in
// the user's shell history.
export const SECRET_FLAG_SECURITY_NOTE =
  'Note: values passed on the command line are visible in shell history (e.g. ~/.bash_history) and to other users via `ps aux` / /proc/[pid]/cmdline. For sensitive values prefer `--secret KEY="$VAR"` where `$VAR` is set out-of-band (read -s, a secrets manager, etc.).';
