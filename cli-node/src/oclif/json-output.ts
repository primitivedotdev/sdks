import { format } from "node:util";
import type { Command } from "@oclif/core";

/**
 * Parse-safe `--json` output.
 *
 * Agents often run commands with stderr merged into stdout (`2>&1`).
 * A command that prints a JSON document on stdout and a notice on
 * stderr then hands the caller text that is not JSON, and a delivered
 * send can look like an unknown outcome. With `--json`, every guarded
 * command therefore prints exactly one JSON document on stdout, on
 * success and on failure, and writes nothing to stderr:
 *
 * - Anything the command would have written to stderr (notices, hints,
 *   cursors, warnings) goes into the document's `warnings` array.
 * - A failure adds `error` and `exit_code` to the document. When the
 *   command printed no document of its own, the CLI builds one.
 * - A command whose `--json` output is a bare JSON array keeps that
 *   documented shape on success; its stderr notices are dropped.
 *
 * Commands that stream several documents (`listen`) are not guarded.
 */

const GUARDED = Symbol.for("primitive.cli.jsonOutputGuard");

type Restorable = {
  restore: () => void;
  stderr: string[];
  stdout: string[];
};

type WriteFn = (
  chunk: unknown,
  encoding?: unknown,
  callback?: unknown,
) => boolean;

/** True when `--json` appears before any `--` separator. */
export function jsonOutputRequested(argv: readonly string[]): boolean {
  const end = argv.indexOf("--");
  const scanned = end === -1 ? argv : argv.slice(0, end);
  return scanned.includes("--json");
}

function chunkToString(chunk: unknown, encoding: unknown): string {
  if (typeof chunk === "string") return chunk;
  if (chunk instanceof Uint8Array) {
    return Buffer.from(chunk).toString(
      typeof encoding === "string" ? (encoding as BufferEncoding) : "utf8",
    );
  }
  return String(chunk);
}

function capturingWrite(sink: string[]): WriteFn {
  return (chunk, encoding, callback) => {
    sink.push(chunkToString(chunk, encoding));
    const done = typeof encoding === "function" ? encoding : callback;
    if (typeof done === "function") (done as () => void)();
    return true;
  };
}

/**
 * Redirect stdout and stderr (both the streams and the console methods
 * that write to them) into memory until `restore` is called. Nested
 * captures restore in reverse order, so a guarded command that runs
 * another guarded command still produces one document.
 */
export function captureOutput(): Restorable {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;
  const originalConsole = {
    debug: console.debug,
    error: console.error,
    info: console.info,
    log: console.log,
    warn: console.warn,
  };
  const toStdout = (...args: unknown[]) => {
    stdout.push(`${format(...args)}\n`);
  };
  const toStderr = (...args: unknown[]) => {
    stderr.push(`${format(...args)}\n`);
  };
  process.stdout.write = capturingWrite(stdout) as typeof process.stdout.write;
  process.stderr.write = capturingWrite(stderr) as typeof process.stderr.write;
  console.log = toStdout;
  console.info = toStdout;
  console.debug = toStderr;
  console.error = toStderr;
  console.warn = toStderr;
  return {
    stderr,
    stdout,
    restore: () => {
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
      console.debug = originalConsole.debug;
      console.error = originalConsole.error;
      console.info = originalConsole.info;
      console.log = originalConsole.log;
      console.warn = originalConsole.warn;
    },
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

type StderrSummary = {
  errorPayload: Record<string, unknown> | null;
  warnings: string[];
};

/**
 * Split captured stderr into an API error payload (the JSON object the
 * CLI prints for a failed request) and plain-text warning lines.
 */
// Terminal color and cursor sequences. Built from the code point so the
// pattern carries no literal control character.
const ANSI_SEQUENCE = new RegExp(
  `${String.fromCharCode(27)}\\[[0-9;?]*[A-Za-z]`,
  "g",
);

export function stripAnsi(text: string): string {
  return text.replace(ANSI_SEQUENCE, "");
}

export function summarizeStderr(chunks: readonly string[]): StderrSummary {
  let errorPayload: Record<string, unknown> | null = null;
  const warnings: string[] = [];
  for (const chunk of chunks) {
    const trimmed = stripAnsi(chunk).trim();
    if (trimmed === "") continue;
    if (trimmed.startsWith("{")) {
      const parsed = parseJson(trimmed);
      if (parsed.ok && isPlainObject(parsed.value)) {
        if (errorPayload === null) errorPayload = parsed.value;
        else warnings.push(JSON.stringify(parsed.value));
        continue;
      }
    }
    for (const line of trimmed.split("\n")) {
      const text = line.trim();
      if (text !== "" && !warnings.includes(text)) warnings.push(text);
    }
  }
  return { errorPayload, warnings };
}

function errorExitCode(error: unknown): number | undefined {
  const exit = (error as { oclif?: { exit?: unknown } } | null)?.oclif?.exit;
  return typeof exit === "number" ? exit : undefined;
}

/** An oclif `this.exit(n)` unwinds by throwing; it is not a failure message. */
function isExitSignal(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "EEXIT";
}

function thrownErrorBody(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const body: Record<string, unknown> = { message: error.message };
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code !== "EEXIT") body.code = code;
    return body;
  }
  return { message: String(error) };
}

export type ComposeJsonDocumentInput = {
  exitCode: number;
  stderr: readonly string[];
  stdout: string;
  /** Set when the command threw. */
  thrown?: { error: unknown };
};

/**
 * Build the single JSON document a guarded `--json` command prints from
 * what it wrote to stdout and stderr and how it ended.
 */
export function composeJsonDocument(input: ComposeJsonDocumentInput): unknown {
  const { errorPayload, warnings: stderrLines } = summarizeStderr(input.stderr);
  const failed = input.exitCode !== 0;
  let warnings = stderrLines;
  if (!failed && errorPayload !== null) {
    warnings = [...warnings, JSON.stringify(errorPayload)];
  }
  const failure = (): Record<string, unknown> => {
    if (errorPayload !== null) return errorPayload;
    if (input.thrown && !isExitSignal(input.thrown.error)) {
      return thrownErrorBody(input.thrown.error);
    }
    return {
      message:
        warnings.at(-1) ??
        `The command failed with exit code ${input.exitCode}.`,
    };
  };

  const text = input.stdout.trim();
  let document: unknown;
  let hasDocument = false;
  if (text !== "") {
    const parsed = parseJson(text);
    document = parsed.ok ? parsed.value : { output: text };
    hasDocument = true;
  }

  if (!hasDocument) {
    if (failed) {
      return {
        error: failure(),
        exit_code: input.exitCode,
        ...(warnings.length > 0 ? { warnings } : {}),
      };
    }
    return warnings.length > 0 ? { summary: warnings.join("\n") } : {};
  }

  if (!isPlainObject(document)) {
    if (!failed) return document;
    return {
      data: document,
      error: failure(),
      exit_code: input.exitCode,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  }

  const merged: Record<string, unknown> = { ...document };
  // A summary the document already states is not repeated as a warning.
  const stated = new Set(
    [merged.outcome_message, merged.summary].filter(
      (value): value is string => typeof value === "string",
    ),
  );
  warnings = warnings.filter((warning) => !stated.has(warning));
  if (failed) {
    if (merged.error === undefined || merged.error === null) {
      merged.error = failure();
    }
    if (merged.exit_code === undefined) merged.exit_code = input.exitCode;
  }
  if (warnings.length > 0) {
    const existing = merged.warnings;
    if (existing === undefined || existing === null) {
      merged.warnings = warnings;
    } else if (Array.isArray(existing)) {
      merged.warnings = [
        ...existing,
        ...warnings.filter((warning) => !existing.includes(warning)),
      ];
    } else {
      merged.cli_warnings = warnings;
    }
  }
  return merged;
}

type RunnableCommand = Command & { argv: string[] };
type CommandClass = { prototype: Command } & Record<PropertyKey, unknown>;

/**
 * Make `cls` print one JSON document under `--json`. Idempotent per
 * class; command aliases that share a class are guarded once.
 */
export function guardJsonOutput(cls: CommandClass): void {
  const prototype = cls.prototype as unknown as Record<PropertyKey, unknown>;
  if (Object.hasOwn(prototype, GUARDED)) return;
  const originalRun = prototype._run as (this: Command) => Promise<unknown>;
  prototype[GUARDED] = true;
  prototype._run = async function guardedRun(
    this: RunnableCommand,
  ): Promise<unknown> {
    if (!jsonOutputRequested(this.argv)) return originalRun.call(this);
    const capture = captureOutput();
    let result: unknown;
    let thrown: { error: unknown } | undefined;
    try {
      result = await originalRun.call(this);
    } catch (error) {
      thrown = { error };
    } finally {
      capture.restore();
    }
    const exitCode = thrown
      ? isExitSignal(thrown.error)
        ? (errorExitCode(thrown.error) ?? 0)
        : (errorExitCode(thrown.error) ??
          (typeof process.exitCode === "number" && process.exitCode !== 0
            ? process.exitCode
            : 1))
      : typeof process.exitCode === "number"
        ? process.exitCode
        : 0;
    const document = composeJsonDocument({
      exitCode,
      stderr: capture.stderr,
      stdout: capture.stdout.join(""),
      thrown,
    });
    console.log(JSON.stringify(document, null, 2));
    if (thrown) {
      // The document above already carries the failure. Stop oclif from
      // printing it again on stderr; the exit code still applies.
      if (thrown.error !== null && typeof thrown.error === "object") {
        (
          thrown.error as { skipOclifErrorHandling?: boolean }
        ).skipOclifErrorHandling = true;
      }
      throw thrown.error;
    }
    return result;
  };
}

/** Command ids whose `--json` streams several documents over time. */
export const STREAMING_JSON_COMMAND_IDS: ReadonlySet<string> = new Set([
  "listen",
]);

/**
 * Guard every command in `commands` that accepts `--json`, except the
 * streaming ones. Called once by the command registry.
 */
export function guardJsonOutputCommands(
  commands: Record<string, unknown>,
): void {
  const streaming = new Set<unknown>();
  for (const id of STREAMING_JSON_COMMAND_IDS) {
    if (commands[id] !== undefined) streaming.add(commands[id]);
  }
  for (const command of Object.values(commands)) {
    if (streaming.has(command)) continue;
    const flags = (command as { flags?: Record<string, unknown> }).flags;
    const enableJsonFlag = (command as { enableJsonFlag?: unknown })
      .enableJsonFlag;
    if ((flags && "json" in flags) || enableJsonFlag === true) {
      guardJsonOutput(command as CommandClass);
    }
  }
}
