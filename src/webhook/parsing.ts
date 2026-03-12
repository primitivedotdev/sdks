/**
 * JSON parsing utilities with helpful error messages.
 * @internal
 */

import { bufferToString } from "./encoding.js";
import { WebhookPayloadError } from "./errors.js";

/**
 * Parse a raw body string/Buffer into JSON with helpful error messages.
 *
 * Handles:
 * - Empty/whitespace bodies
 * - BOM (byte order mark) prefix stripping
 * - Detailed JSON syntax error messages with position
 *
 * @param rawBody - The raw request body (string or Buffer)
 * @returns The parsed JSON value
 * @throws WebhookPayloadError with helpful message on failure
 * @internal
 */
export function parseJsonBody(rawBody: string | Buffer): unknown {
  // Convert Buffer to string with UTF-8 validation
  const bodyStr =
    typeof rawBody === "string"
      ? rawBody
      : bufferToString(rawBody, "request body");

  // Handle empty/whitespace
  if (!bodyStr || bodyStr.trim() === "") {
    throw new WebhookPayloadError(
      "PAYLOAD_EMPTY_BODY",
      "Received empty request body",
      "The request body is empty. Check your web framework is correctly passing the request body.",
    );
  }

  // Try to parse JSON
  try {
    // Strip BOM if present (common issue with some text editors/systems)
    const cleanBody =
      bodyStr.charCodeAt(0) === 0xfeff ? bodyStr.slice(1) : bodyStr;
    return JSON.parse(cleanBody);
  } catch (e) {
    const jsonError = e as SyntaxError;
    const positionMatch = jsonError.message.match(/position\s*(\d+)/i);
    const position = positionMatch?.[1];

    throw new WebhookPayloadError(
      "JSON_PARSE_FAILED",
      "Failed to parse webhook body as JSON",
      position
        ? `Invalid JSON at position ${position}. Check your web framework isn't truncating the request body.`
        : `Invalid JSON: ${jsonError.message}. Check the raw request body is valid JSON.`,
      jsonError,
    );
  }
}
