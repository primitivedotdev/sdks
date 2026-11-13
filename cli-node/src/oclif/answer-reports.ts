// Readable stderr reports for generated and hand-written commands whose
// answers carry something a person should not have to dig out of the JSON:
// the warnings a route write answers with, each attempt of a webhook
// delivery with what the endpoint answered, and whether each endpoint in a
// list is being sent mail.
//
// This module does not import api-command.ts, which imports it.

import { withCliCommands } from "./api-path-commands.js";
import type { OperationExtension } from "./operation-extension.js";
import { sanitizeForTerminal } from "./terminal-text.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Text from an answer, made safe and one line for a report: no terminal controls. */
function oneLine(text: string): string {
  return sanitizeForTerminal(text).replace(/\s+/g, " ").trim();
}

/** One line per warning a route write answers with (createRoute, updateRoute). */
export function routeWarningLines(data: unknown): string[] {
  const warnings = isRecord(data) ? data.warnings : undefined;
  if (!Array.isArray(warnings)) return [];
  return warnings.flatMap((warning) => {
    if (!isRecord(warning)) return [];
    const message =
      typeof warning.message === "string" ? oneLine(warning.message) : "";
    if (message) return [`Route warning: ${withCliCommands(message)}`];
    const code = typeof warning.code === "string" ? oneLine(warning.code) : "";
    return code ? [`Route warning: ${code}`] : [];
  });
}

/** The longest answer body a report line shows before cutting it, in characters. */
const BODY_PREVIEW_LENGTH = 120;

/**
 * The start of an endpoint's answer body, on one line. The body is whatever
 * came back and may echo what an outside sender wrote, so terminal controls
 * are removed before it is printed; it is cut by character, never inside one.
 */
function bodyPreview(body: string): string {
  const characters = Array.from(oneLine(body));
  return characters.length > BODY_PREVIEW_LENGTH
    ? `${characters.slice(0, BODY_PREVIEW_LENGTH - 3).join("")}...`
    : characters.join("");
}

/** Statuses of an attempt the endpoint took, so no HTTP answer means none was needed (a pull endpoint). */
const DELIVERED_STATUSES = new Set(["delivered", "header_confirmed"]);

/**
 * One line per attempt of a delivery (getDelivery): when, its status and
 * error code, and what the endpoint answered: the HTTP status and the start
 * of the body. A record of no attempt (attempt_count 0: skipped by rules,
 * held or discarded) says it was not sent; an attempt that was not delivered
 * and has no recorded answer says so.
 */
export function deliveryAttemptLines(data: unknown): string[] {
  const attempts = isRecord(data) ? data.attempts : undefined;
  if (!Array.isArray(attempts)) return [];
  const lines: string[] = [];
  for (const attempt of attempts) {
    if (!isRecord(attempt)) continue;
    const text = (value: unknown) =>
      typeof value === "string" && value ? oneLine(value) : "";
    const status = text(attempt.status);
    const parts = [
      text(attempt.created_at),
      status,
      text(attempt.last_error_code),
    ].filter((part) => part !== "");
    const notSent = attempt.attempt_count === 0;
    const answered =
      typeof attempt.response_status === "number"
        ? `, answered HTTP ${attempt.response_status}`
        : notSent
          ? ", not sent"
          : DELIVERED_STATUSES.has(status)
            ? ""
            : ", no answer recorded";
    const body =
      typeof attempt.response_body === "string"
        ? bodyPreview(attempt.response_body)
        : "";
    const number =
      typeof attempt.attempt_count === "number" && !notSent
        ? `#${attempt.attempt_count} `
        : "";
    const line = `${number}${parts.join(" ")}${answered}${body ? `: ${body}` : ""}`;
    // An entry with neither time nor status says nothing worth a line.
    if (text(attempt.created_at) || status) lines.push(`  ${line}`);
  }
  return lines.length > 0 ? [`Attempts (${lines.length}):`, ...lines] : [];
}

/**
 * What an endpoint's DELIVERING column says, from `delivery` and never from
 * `enabled`: an endpoint can be on and still be sent nothing (its owner's key
 * revoked, say). `-` for an endpoint that is not a webhook (a Function or
 * pull endpoint), which has no delivery; `unknown` for a webhook when it
 * could not be checked just now, or the server does not say.
 */
export function deliveringCell(endpoint: Record<string, unknown>): string {
  const webhook = endpoint.kind === undefined || endpoint.kind === "http";
  if (!webhook) return "-";
  const delivery = endpoint.delivery;
  if (!isRecord(delivery) || typeof delivery.delivering !== "boolean")
    return "unknown";
  if (delivery.delivering) return "yes";
  const codes = Array.isArray(delivery.reasons)
    ? delivery.reasons.flatMap((reason) =>
        isRecord(reason) && typeof reason.code === "string" && reason.code
          ? [oneLine(reason.code)]
          : [],
      )
    : [];
  return codes.length > 0 ? `no (${codes.join(", ")})` : "no";
}

/**
 * A table of an endpoints list (listEndpoints): each endpoint's id, kind,
 * whether it is on (ENABLED) and whether it is being sent mail at all
 * (DELIVERING, from `delivery`), and its name. Nothing for an empty list.
 */
export function endpointDeliveryLines(data: unknown): string[] {
  const rows = Array.isArray(data) ? data.filter(isRecord) : [];
  if (rows.length === 0) return [];
  const text = (value: unknown) =>
    typeof value === "string" && value ? oneLine(value) : "";
  const table = [
    ["ID", "KIND", "ENABLED", "DELIVERING", "NAME"],
    ...rows.map((row) => [
      text(row.id),
      text(row.kind),
      typeof row.enabled === "boolean" ? (row.enabled ? "yes" : "no") : "",
      deliveringCell(row),
      text(row.name),
    ]),
  ];
  const widths = table[0].map((_, column) =>
    Math.max(...table.map((cells) => (cells[column] ?? "").length)),
  );
  return table.map((cells) =>
    cells
      .map((cell, column) =>
        column === cells.length - 1 ? cell : cell.padEnd(widths[column] ?? 0),
      )
      .join("  ")
      .trimEnd(),
  );
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
  listEndpoints: {
    flags: {},
    report: (data) => ({ lines: endpointDeliveryLines(data) }),
  },
};
