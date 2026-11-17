// `--header` and `--clear-headers` on `endpoints create` and `endpoints
// update`: the custom request headers a webhook sends on every delivery, for
// a receiver that needs a credential of its own.
//
//   primitive endpoints create --url https://... \
//     --header 'Authorization: Bearer <token>' --header 'X-Api-Key: <key>'
//
// The list given replaces the webhook's whole stored list. The API takes a
// non-empty list on an update only with the URL in the same request, so the
// values go to the receiver named; when --url is not given, the CLI reads the
// webhook's URL and sends it unchanged (see api-command.ts). A header value is
// a secret: no message here repeats one.
//
// Both commands also print the warnings the answer carries, such as a URL
// that appears to require a login, after the JSON.
//
// This module does not import api-command.ts, which imports it.

import { Errors, Flags } from "@oclif/core";
import type {
  ExtensionBodyField,
  OperationExtension,
} from "./operation-extension.js";
import { terminalLine } from "./terminal-text.js";

export const HEADER_FLAG = "header";
export const CLEAR_HEADERS_FLAG = "clear-headers";

function usageError(message: string): Errors.CLIError {
  return new Errors.CLIError(message, { exit: 2 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** True when `text` holds an ASCII control character, which a header cannot carry. */
function hasControlCharacter(text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

export type EndpointRequestHeader = { name: string; value: string };

/**
 * The headers `--header 'Name: value'` gives, in order: split at the first
 * colon, the name trimmed and the value without the spaces around it. A
 * malformed entry is refused by its place in the list, never by its text,
 * since the value is a secret. A name given twice (in any case) is refused.
 */
export function parseHeaderFlags(
  values: readonly string[],
): EndpointRequestHeader[] {
  const headers: EndpointRequestHeader[] = [];
  const seen = new Set<string>();
  values.forEach((given, index) => {
    const which = `--header ${index + 1}`;
    const colon = given.indexOf(":");
    if (colon === -1)
      throw usageError(
        `${which} has no colon: give each header as 'Name: value', such as --header 'Authorization: Bearer <token>'.`,
      );
    const name = given.slice(0, colon).trim();
    const value = given.slice(colon + 1).trim();
    if (name === "") throw usageError(`${which} has no name before its colon.`);
    if (hasControlCharacter(name) || /\s/.test(name))
      throw usageError(
        `${which}: a header name cannot hold spaces or control characters.`,
      );
    if (value === "") throw usageError(`${which} (${name}) has no value.`);
    if (hasControlCharacter(value))
      throw usageError(
        `${which} (${name}): the value cannot hold control characters such as line breaks.`,
      );
    const key = name.toLowerCase();
    if (seen.has(key))
      throw usageError(`${which}: ${name} is given more than once.`);
    seen.add(key);
    headers.push({ name, value });
  });
  return headers;
}

/** The headers body field the flags set: the list given, [] to remove them all, or none. */
export function headersBodyFields(
  flags: Record<string, unknown>,
): ExtensionBodyField[] {
  if (flags[CLEAR_HEADERS_FLAG] === true)
    return [
      { flag: `--${CLEAR_HEADERS_FLAG}`, property: "headers", value: [] },
    ];
  const given = flags[HEADER_FLAG];
  if (!Array.isArray(given) || given.length === 0) return [];
  return [
    {
      flag: `--${HEADER_FLAG}`,
      property: "headers",
      value: parseHeaderFlags(given as string[]),
    },
  ];
}

/**
 * Whether an update body sets request headers without a URL, which the API
 * refuses (headers_need_url): the CLI then sends the webhook's current URL.
 */
export function headersNeedUrl(body: unknown): boolean {
  return (
    isRecord(body) &&
    Array.isArray(body.headers) &&
    body.headers.length > 0 &&
    (body.url === undefined || body.url === null)
  );
}

/** One line per warning an endpoint create or update answers with. */
export function endpointWarningLines(data: unknown): string[] {
  const warnings = isRecord(data) ? data.warnings : undefined;
  if (!Array.isArray(warnings)) return [];
  return warnings.flatMap((warning) => {
    if (!isRecord(warning)) return [];
    const text =
      typeof warning.message === "string" && warning.message.trim() !== ""
        ? warning.message
        : typeof warning.code === "string"
          ? warning.code
          : "";
    return text
      ? [terminalLine(`Warning: ${text.replace(/\s+/g, " ").trim()}`)]
      : [];
  });
}

const HEADER_FLAG_DESCRIPTION =
  "A custom request header sent on every delivery to this webhook, as 'Name: value', for a receiver that needs a credential of its own: --header 'Authorization: Bearer <token>'. Repeat it for each header. Values are stored encrypted and never shown again. Only for webhooks.";

const UPDATE_HEADER_NOTE =
  " The headers given replace every header the webhook has, so give each one it should keep. Sent with the webhook's URL, as the API asks: --url when given, else its current URL, read first.";

function headerExtension(update: boolean): OperationExtension {
  return {
    flags: {
      [HEADER_FLAG]: Flags.string({
        description: `${HEADER_FLAG_DESCRIPTION}${update ? UPDATE_HEADER_NOTE : ""}`,
        multiple: true,
        ...(update ? { exclusive: [CLEAR_HEADERS_FLAG] } : {}),
      }),
      ...(update
        ? {
            [CLEAR_HEADERS_FLAG]: Flags.boolean({
              description:
                "Remove every custom request header from this webhook. Needs no --url. Not with --header.",
              exclusive: [HEADER_FLAG],
            }),
          }
        : {}),
    },
    bodyFields: headersBodyFields,
    bodyProperties: ["headers"],
    report: (data) => ({ lines: endpointWarningLines(data) }),
  };
}

export const ENDPOINT_HEADER_EXTENSIONS: Record<string, OperationExtension> = {
  createEndpoint: headerExtension(false),
  updateEndpoint: headerExtension(true),
};
