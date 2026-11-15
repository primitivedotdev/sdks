// The one printer for the notes the API puts on an email rules answer:
// scope warnings, warnings, and a note where a route keeps one. It is the
// report of every single-object answer in the Email Rules and Email Rule
// Oversight tags, printed on stderr after the JSON and only without --json.
// Every line is the server's text, kept whole, on one line, with no
// terminal controls, and with each API route it names followed by its CLI
// command.

import { withCliCommands } from "./api-path-commands.js";
import type { OperationReport } from "./operation-extension.js";
import { shownLine } from "./terminal-text.js";

/** The tags whose single-object answers get the notes printer. */
export const RULE_NOTES_TAGS: ReadonlySet<string> = new Set([
  "Email Rules",
  "Email Rule Oversight",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Server text as a report line shows it, or "" when there is none. */
function shown(value: unknown): string {
  return typeof value === "string" ? withCliCommands(shownLine(value)) : "";
}

function scopeWarningLine(warning: Record<string, unknown>): string {
  const name = shown(warning.name);
  const message = shown(warning.message);
  if (!message) return `Scope warning: ${name} (${shown(warning.reason)})`;
  return !name || message.includes(name)
    ? `Scope warning: ${message}`
    : `Scope warning: ${name}: ${message}`;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * The notes an answer carries, in order: each scope warning, each warning
 * (the answer's own or its summary's), then the answer's note, its rule's
 * note and its expectations check's note, each once.
 */
export function ruleNotesLines(answer: unknown): string[] {
  if (!isRecord(answer)) return [];
  const summary = isRecord(answer.summary) ? answer.summary : {};
  const rule = isRecord(answer.rule) ? answer.rule : {};
  const check = isRecord(answer.expectations_check)
    ? answer.expectations_check
    : {};
  const lines = [
    ...list(answer.scope_warnings).filter(isRecord).map(scopeWarningLine),
    ...[...list(answer.warnings), ...list(summary.warnings)]
      .map(shown)
      .filter(Boolean)
      .map((text) => `Warning: ${text}`),
    ...[answer.note, rule.note, check.note].map(shown).filter(Boolean),
  ];
  return lines.filter((line, i) => lines.indexOf(line) === i);
}

/** The notes printer as an operation report. */
export function ruleNotesReport(data: unknown): OperationReport {
  return { lines: ruleNotesLines(data) };
}
