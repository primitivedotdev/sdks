import { readFileSync } from "node:fs";

// Shared parsing for secret source flags used by functions:deploy,
// functions:redeploy, and functions:set-secret. Lives in its own
// module so commands share duplicate detection, dotenv parsing, and
// error copy.

// Server-side constraint on secret keys. Mirrored client-side so
// malformed input is rejected before any side-effecting API call.
export const SECRET_KEY_RE = /^[A-Z_][A-Z0-9_]*$/;

// Parsed --secret K=V pair. Exported so unit tests can build the
// same value the commands produce internally.
export type SecretFlagPair = { key: string; value: string };

type SecretInputError = { kind: "error"; message: string };

// Result of parsing raw oclif secret-source flags. Discriminated so
// the caller can decide whether to write a stderr error before touching
// the API surface.
export type ParseSecretFlagsResult =
  | { kind: "ok"; secrets: SecretFlagPair[] }
  | SecretInputError;

export type ResolveSingleSecretValueResult =
  | { kind: "ok"; value: string }
  | SecretInputError;

export type SecretSourceFlags = {
  inline?: string[];
  fromEnv?: string[];
  fromFile?: string[];
  fromEnvFile?: string[];
  fromStdin?: string;
  env?: Record<string, string | undefined>;
  readFile?: (path: string) => string;
  readStdin?: () => string;
};

export type SingleSecretValueFlags = {
  key: string;
  value?: string;
  valueFromEnv?: string;
  valueFile?: string;
  valueFromEnvFile?: string;
  stdin?: boolean;
  env?: Record<string, string | undefined>;
  readFile?: (path: string) => string;
  readStdin?: () => string;
};

// Split each `--secret KEY=VALUE` on the FIRST `=`. KEY must match
// `^[A-Z_][A-Z0-9_]*$`; VALUE may contain `=` (only the first one
// is treated as a delimiter). Duplicate KEYs are rejected: silently
// accepting two pairs with the same key would fan out to two
// setFunctionSecret writes where only the second wins, which is
// almost always a typo and never the intent.
export function parseSecretFlags(raw: string[]): ParseSecretFlagsResult {
  return resolveSecretFlags({ inline: raw });
}

export function resolveSecretFlags(
  input: SecretSourceFlags,
): ParseSecretFlagsResult {
  const secrets: SecretFlagPair[] = [];
  const seenKeys = new Set<string>();
  const env = input.env ?? process.env;
  const readFile = input.readFile ?? defaultReadFile;
  const readStdin = input.readStdin ?? defaultReadStdin;
  const envFileCache = new Map<string, Map<string, string>>();

  const reserveSecretKey = (
    key: string,
    sourceLabel: string,
  ): SecretInputError | null => {
    const keyError = validateKey(key, sourceLabel);
    if (keyError) return keyError;
    if (seenKeys.has(key)) {
      return duplicateKeyError(key);
    }
    seenKeys.add(key);
    return null;
  };

  const addSecret = (
    key: string,
    value: string,
    sourceLabel: string,
  ): ParseSecretFlagsResult | null => {
    const keyError = reserveSecretKey(key, sourceLabel);
    if (keyError) return keyError;
    secrets.push({ key, value });
    return null;
  };

  for (const entry of input.inline ?? []) {
    const parsed = parseKeyValueFlag(entry, "--secret");
    if (parsed.kind === "error") return parsed;
    const error = addSecret(parsed.key, parsed.value, "--secret");
    if (error) return error;
  }

  for (const key of input.fromEnv ?? []) {
    const keyError = reserveSecretKey(key, "--secret-from-env");
    if (keyError) return keyError;
    const value = env[key];
    if (value === undefined) {
      return {
        kind: "error",
        message: `--secret-from-env ${key} could not read ${key}: environment variable is not set.`,
      };
    }
    secrets.push({ key, value });
  }

  for (const entry of input.fromFile ?? []) {
    const parsed = parseKeyValueFlag(entry, "--secret-from-file");
    if (parsed.kind === "error") return parsed;
    const keyError = reserveSecretKey(parsed.key, "--secret-from-file");
    if (keyError) return keyError;
    const file = readSecretFile(parsed.value, "--secret-from-file", readFile);
    if (file.kind === "error") return file;
    secrets.push({ key: parsed.key, value: file.value });
  }

  for (const entry of input.fromEnvFile ?? []) {
    const parsed = parseEnvFileKeyRef(entry, "--secret-from-env-file");
    if (parsed.kind === "error") return parsed;
    const keyError = reserveSecretKey(parsed.key, "--secret-from-env-file");
    if (keyError) return keyError;
    const file = readEnvFile(parsed.path, readFile, envFileCache);
    if (file.kind === "error") return file;
    const value = file.values.get(parsed.key);
    if (value === undefined) {
      return {
        kind: "error",
        message: `--secret-from-env-file ${entry} could not read ${parsed.key}: key is not present in ${parsed.path}.`,
      };
    }
    secrets.push({ key: parsed.key, value });
  }

  if (input.fromStdin !== undefined) {
    const keyError = reserveSecretKey(input.fromStdin, "--secret-from-stdin");
    if (keyError) return keyError;
    const stdin = readSecretStdin("--secret-from-stdin", readStdin);
    if (stdin.kind === "error") return stdin;
    secrets.push({ key: input.fromStdin, value: stdin.value });
  }

  return { kind: "ok", secrets };
}

export function resolveSingleSecretValue(
  input: SingleSecretValueFlags,
): ResolveSingleSecretValueResult {
  const sources = [
    input.value !== undefined ? "--value" : null,
    input.valueFromEnv !== undefined ? "--value-from-env" : null,
    input.valueFile !== undefined ? "--value-file" : null,
    input.valueFromEnvFile !== undefined ? "--value-from-env-file" : null,
    input.stdin === true ? "--stdin" : null,
  ].filter((v): v is string => v !== null);

  if (sources.length !== 1) {
    return {
      kind: "error",
      message:
        "Pass exactly one of --value, --value-from-env, --value-file, --value-from-env-file, or --stdin.",
    };
  }

  const env = input.env ?? process.env;
  const readFile = input.readFile ?? defaultReadFile;
  const readStdin = input.readStdin ?? defaultReadStdin;

  if (input.value !== undefined) {
    return { kind: "ok", value: input.value };
  }

  if (input.valueFromEnv !== undefined) {
    const value = env[input.valueFromEnv];
    if (value === undefined) {
      return {
        kind: "error",
        message: `--value-from-env ${input.valueFromEnv} could not read ${input.valueFromEnv}: environment variable is not set.`,
      };
    }
    return { kind: "ok", value };
  }

  if (input.valueFile !== undefined) {
    return readSecretFile(input.valueFile, "--value-file", readFile);
  }

  if (input.valueFromEnvFile !== undefined) {
    const parsed = parseSingleValueEnvFileRef(
      input.valueFromEnvFile,
      input.key,
      "--value-from-env-file",
    );
    if (parsed.kind === "error") return parsed;

    const file = readEnvFile(parsed.path, readFile, new Map());
    if (file.kind === "error") return file;
    const value = file.values.get(parsed.key);
    if (value === undefined) {
      return {
        kind: "error",
        message: `--value-from-env-file ${input.valueFromEnvFile} could not read ${parsed.key}: key is not present in ${parsed.path}.`,
      };
    }
    return { kind: "ok", value };
  }

  if (input.stdin === true) {
    return readSecretStdin("--stdin", readStdin);
  }

  return {
    kind: "error",
    message:
      "Pass exactly one of --value, --value-from-env, --value-file, --value-from-env-file, or --stdin.",
  };
}

function defaultReadFile(path: string): string {
  return readFileSync(path, "utf8");
}

function defaultReadStdin(): string {
  if (process.stdin.isTTY) {
    throw new Error(
      "stdin is a TTY; pipe a value into this command or pass a file/env source instead.",
    );
  }
  return readFileSync(0, "utf8");
}

function parseKeyValueFlag(
  entry: string,
  flagLabel: string,
): SecretInputError | { kind: "ok"; key: string; value: string } {
  const eq = entry.indexOf("=");
  if (eq === -1) {
    return {
      kind: "error",
      message: `${flagLabel} expects KEY=VALUE (got ${JSON.stringify(entry)}). Example: ${flagLabel} API_TOKEN=abc123`,
    };
  }
  const key = entry.slice(0, eq);
  const value = entry.slice(eq + 1);
  if (key.length === 0) {
    return {
      kind: "error",
      message: `${flagLabel} is missing a KEY before '=' (got ${JSON.stringify(entry)}). Example: ${flagLabel} API_TOKEN=abc123`,
    };
  }
  return { kind: "ok", key, value };
}

function validateKey(key: string, flagLabel: string): SecretInputError | null {
  if (!SECRET_KEY_RE.test(key)) {
    return {
      kind: "error",
      message: `${flagLabel} KEY ${JSON.stringify(key)} does not match ${SECRET_KEY_RE.source} (uppercase letters, digits, underscores; first character is a letter or underscore).`,
    };
  }
  return null;
}

function duplicateKeyError(key: string): SecretInputError {
  return {
    kind: "error",
    message: `Secret KEY ${JSON.stringify(key)} was passed more than once. Each key may only appear once per command.`,
  };
}

function readSecretFile(
  path: string,
  flagLabel: string,
  readFile: (path: string) => string,
): ResolveSingleSecretValueResult {
  try {
    return { kind: "ok", value: readFile(path) };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      kind: "error",
      message: `Could not read ${flagLabel} ${path}: ${detail}`,
    };
  }
}

function readSecretStdin(
  flagLabel: string,
  readStdin: () => string,
): ResolveSingleSecretValueResult {
  try {
    return { kind: "ok", value: stripOneTrailingLineEnding(readStdin()) };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      kind: "error",
      message: `Could not read ${flagLabel}: ${detail}`,
    };
  }
}

function stripOneTrailingLineEnding(value: string): string {
  if (!value.endsWith("\n")) return value;
  const withoutLf = value.slice(0, -1);
  return withoutLf.endsWith("\r") ? withoutLf.slice(0, -1) : withoutLf;
}

function parseEnvFileKeyRef(
  entry: string,
  flagLabel: string,
): SecretInputError | { kind: "ok"; path: string; key: string } {
  const sep = entry.lastIndexOf(":");
  if (sep <= 0 || sep === entry.length - 1) {
    return {
      kind: "error",
      message: `${flagLabel} expects FILE:KEY (got ${JSON.stringify(entry)}). Example: ${flagLabel} .env.local:OPENAI_KEY`,
    };
  }
  const path = entry.slice(0, sep);
  const key = entry.slice(sep + 1);
  const keyError = validateKey(key, flagLabel);
  if (keyError) return keyError;
  return { kind: "ok", key, path };
}

function parseSingleValueEnvFileRef(
  entry: string,
  fallbackKey: string,
  flagLabel: string,
): SecretInputError | { kind: "ok"; path: string; key: string } {
  const sep = entry.lastIndexOf(":");
  if (sep === -1) {
    return { kind: "ok", key: fallbackKey, path: entry };
  }
  if (sep <= 0 || sep === entry.length - 1) {
    return {
      kind: "error",
      message: `${flagLabel} expects FILE or FILE:KEY (got ${JSON.stringify(entry)}). Example: ${flagLabel} .env.local or ${flagLabel} .env.local:OPENAI_KEY`,
    };
  }
  const path = entry.slice(0, sep);
  const key = entry.slice(sep + 1);
  const keyError = validateKey(key, flagLabel);
  if (keyError) return keyError;
  return { kind: "ok", key, path };
}

function readEnvFile(
  path: string,
  readFile: (path: string) => string,
  cache: Map<string, Map<string, string>>,
):
  | { kind: "ok"; values: Map<string, string> }
  | { kind: "error"; message: string } {
  const cached = cache.get(path);
  if (cached) return { kind: "ok", values: cached };

  let contents: string;
  try {
    contents = readFile(path);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      kind: "error",
      message: `Could not read env file ${path}: ${detail}`,
    };
  }

  const values = parseEnvFile(contents);
  cache.set(path, values);
  return { kind: "ok", values };
}

function parseEnvFile(contents: string): Map<string, string> {
  const values = new Map<string, string>();
  const normalized = contents.replace(/^\uFEFF/, "");
  for (const rawLine of normalized.split(/\r?\n/)) {
    let line = rawLine.trimStart();
    if (line.length === 0 || line.startsWith("#")) continue;
    if (line.startsWith("export ")) {
      line = line.slice("export ".length).trimStart();
    }

    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    values.set(match[1], parseEnvValue(match[2] ?? ""));
  }
  return values;
}

function parseEnvValue(raw: string): string {
  const value = raw.trimStart();
  if (value.startsWith("'")) {
    const end = value.indexOf("'", 1);
    return end === -1 ? value.slice(1) : value.slice(1, end);
  }
  if (value.startsWith('"')) {
    return parseDoubleQuotedEnvValue(value);
  }
  return value.replace(/\s+#.*$/, "").trimEnd();
}

function parseDoubleQuotedEnvValue(value: string): string {
  let out = "";
  let escaped = false;
  for (let i = 1; i < value.length; i++) {
    const ch = value[i];
    if (escaped) {
      if (ch === "n") out += "\n";
      else if (ch === "r") out += "\r";
      else if (ch === "t") out += "\t";
      else out += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') break;
    out += ch;
  }
  if (escaped) out += "\\";
  return out;
}

// Shared flag-description copy so both functions:deploy and
// functions:redeploy advertise the same security caveat and KEY
// constraints. The shell-history note is the load-bearing piece:
// CLI flag values land in ~/.bash_history, `ps aux`, and
// /proc/[pid]/cmdline, so callers handling sensitive values should
// use one of the non-argv sources below.
export const SECRET_FLAG_SECURITY_NOTE =
  "Note: values passed on the command line are visible in shell history (e.g. ~/.bash_history) and to other users via `ps aux` / /proc/[pid]/cmdline. For sensitive values prefer --secret-from-env, --secret-from-file, --secret-from-env-file, or --secret-from-stdin.";

export const SECRET_SOURCE_FLAGS_DESCRIPTION =
  "Safe sources: --secret-from-env KEY reads process.env[KEY], --secret-from-file KEY=PATH reads the full UTF-8 file contents, --secret-from-env-file FILE:KEY reads KEY from a dotenv-style file, and --secret-from-stdin KEY reads the value from stdin.";

export const SINGLE_SECRET_VALUE_SOURCE_DESCRIPTION =
  "Instead of --value, use --value-from-env ENV_VAR, --value-file PATH, --value-from-env-file FILE[:KEY], or --stdin to avoid putting the secret value in shell history or process argv. If KEY is omitted from --value-from-env-file, the command's --key is used.";
