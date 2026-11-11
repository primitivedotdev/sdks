// Readable stderr reports for generated and hand-written commands whose
// answers carry something a person should not have to dig out of the JSON:
// the warnings a route write answers with, and each attempt of a webhook
// delivery with what the endpoint answered.
//
// This module does not import api-command.ts, which imports it.

import { withCliCommands } from "./api-path-commands.js";
import type { OperationExtension } from "./operation-extension.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** One line per warning a route write answers with (createRoute, updateRoute). */
export function routeWarningLines(data: unknown): string[] {
  const warnings = isRecord(data) ? data.warnings : undefined;
  if (!Array.isArray(warnings)) return [];
  return warnings.flatMap((warning) => {
    if (!isRecord(warning)) return [];
    const message =
      typeof warning.message === "string" ? warning.message.trim() : "";
    if (message) return [`Route warning: ${withCliCommands(message)}`];
    return typeof warning.code === "string" && warning.code
      ? [`Route warning: ${warning.code}`]
      : [];
  });
}

/** The longest answer body a report line shows before cutting it. */
const BODY_PREVIEW_LENGTH = 120;

function bodyPreview(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > BODY_PREVIEW_LENGTH
    ? `${flat.slice(0, BODY_PREVIEW_LENGTH - 3)}...`
    : flat;
}

/**
 * One line per attempt of a delivery (getDelivery): when, its status, and
 * what the endpoint answered: the HTTP status and the start of the body, or,
 * for an attempt that was not delivered, that no answer came back.
 */
export function deliveryAttemptLines(data: unknown): string[] {
  const attempts = isRecord(data) ? data.attempts : undefined;
  if (!Array.isArray(attempts) || attempts.length === 0) return [];
  const lines = [`Attempts (${attempts.length}):`];
  for (const attempt of attempts) {
    if (!isRecord(attempt)) continue;
    const parts = [
      typeof attempt.created_at === "string" ? attempt.created_at : "",
      typeof attempt.status === "string" ? attempt.status : "",
      typeof attempt.last_error_code === "string" && attempt.last_error_code
        ? attempt.last_error_code
        : "",
    ].filter((part) => part !== "");
    // A delivered attempt with no HTTP answer was not made over HTTP (a pull
    // endpoint), so only an undelivered one says that no answer came back.
    const answered =
      typeof attempt.response_status === "number"
        ? `, answered HTTP ${attempt.response_status}`
        : attempt.status === "delivered"
          ? ""
          : ", no answer";
    const body =
      typeof attempt.response_body === "string" && attempt.response_body.trim()
        ? `: ${bodyPreview(attempt.response_body)}`
        : "";
    const number =
      typeof attempt.attempt_count === "number"
        ? `#${attempt.attempt_count} `
        : "";
    lines.push(`  ${number}${parts.join(" ")}${answered}${body}`);
  }
  return lines;
}

const routeReport: OperationExtension = {
  flags: {},
  report: (data) => ({ lines: routeWarningLines(data) }),
};

export const ANSWER_REPORT_EXTENSIONS: Record<string, OperationExtension> = {
  createRoute: routeReport,
  updateRoute: routeReport,
  getDelivery: {
    flags: {},
    report: (data) => ({ lines: deliveryAttemptLines(data) }),
  },
};
