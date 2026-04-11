/**
 * Buffer encoding utilities
 */

import { WebhookPayloadError } from "./errors.js";

// TextDecoder with fatal mode throws on invalid UTF-8 sequences
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

/**
 * Convert a Buffer to string with strict UTF-8 validation.
 * Throws if the buffer contains invalid UTF-8 sequences.
 *
 * Uses TextDecoder with `fatal: true` for robust validation that catches
 * all invalid UTF-8 sequences, not just those that produce replacement characters.
 *
 * @param buffer - The buffer to convert
 * @param label - Label for error messages (e.g., "request body")
 * @returns The UTF-8 decoded string
 * @throws WebhookPayloadError if the buffer contains invalid UTF-8
 */
export function bufferToString(buffer: Buffer, label: string): string {
  try {
    return utf8Decoder.decode(buffer);
  } catch (err) {
    throw new WebhookPayloadError(
      "INVALID_ENCODING",
      `${label} contains invalid UTF-8 bytes`,
      `Ensure the ${label} is valid UTF-8 encoded text. If the data is binary, it should be base64 encoded first.`,
      err instanceof Error ? err : undefined,
    );
  }
}
