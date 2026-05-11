/**
 * Helpers for normalizing OpenAI Responses API output shapes.
 *
 * The Responses API (`POST /v1/responses`) returns assistant text in two
 * different shapes depending on which client you used:
 *
 * - The OpenAI SDK exposes a convenience `output_text` string on the
 *   response object. Most code examples in OpenAI's own docs use this.
 * - Raw REST callers (anyone using `fetch` directly) get the underlying
 *   `output[].content[].text` structure with no `output_text` shortcut.
 *
 * Handlers that look only for `output_text` against a raw REST response
 * silently return an empty string. This is the exact footgun this helper
 * exists to prevent: it accepts either shape and throws (loudly) when it
 * can't find any usable text, rather than returning `""` and letting the
 * caller ship empty output to the next stage of their pipeline.
 *
 * The helper is intentionally OpenAI-SDK-free: it accepts an `unknown`
 * (typically the result of `await response.json()`) and walks the known
 * shapes structurally. It does not validate the wider response envelope,
 * does not depend on any OpenAI types, and adds nothing to your bundle.
 *
 * @example
 * ```typescript
 * import { extractResponsesOutputText } from '@primitivedotdev/sdk';
 *
 * const response = await fetch('https://api.openai.com/v1/responses', {
 *   method: 'POST',
 *   headers: {
 *     Authorization: `Bearer ${env.OPENAI_API_KEY}`,
 *     'Content-Type': 'application/json',
 *   },
 *   body: JSON.stringify({
 *     model: 'gpt-4o-mini',
 *     input: 'Summarize this email...',
 *   }),
 * });
 * const text = extractResponsesOutputText(await response.json());
 * ```
 *
 * @packageDocumentation
 */

/**
 * Extract the assistant text from an OpenAI Responses API result.
 *
 * Accepts either:
 * - An object with an `output_text: string` field (the SDK convenience),
 * - Or a raw REST response whose `output[]` array contains entries with
 *   `content[]` items shaped like:
 *     - `{ type: 'output_text', text: '...' }`
 *     - `{ type: 'text', text: { value: '...' } }`
 *     - `{ type: 'text', text: '...' }`
 *
 * Multiple text fragments across `output[]` and `content[]` are
 * concatenated in order with no separator, matching what the OpenAI SDK's
 * `output_text` convenience produces.
 *
 * @param response - The parsed JSON body of an OpenAI Responses API
 *   result. Typically the result of `await fetchResponse.json()`.
 * @returns The assistant text. Always non-empty on a successful return.
 * @throws {Error} If the input is not an object, or no text fragment can
 *   be located. The thrown error is intentional: returning an empty
 *   string here is almost always a downstream bug, and a thrown error
 *   surfaces the shape mismatch at the point where it can be diagnosed.
 */
export function extractResponsesOutputText(response: unknown): string {
  if (response === null || typeof response !== "object") {
    throw new Error(
      `extractResponsesOutputText: expected a parsed JSON object, got ${
        response === null ? "null" : typeof response
      }`,
    );
  }

  const obj = response as Record<string, unknown>;

  // Fast path: SDK convenience field. Only accept a non-empty string;
  // an empty `output_text` likely means the underlying output[] walk
  // would also find nothing, so fall through to the explicit error
  // rather than silently returning "".
  if (typeof obj.output_text === "string" && obj.output_text.length > 0) {
    return obj.output_text;
  }

  // Walk output[].content[].text.
  const output = obj.output;
  if (Array.isArray(output)) {
    const parts: string[] = [];
    for (const item of output) {
      if (item === null || typeof item !== "object") continue;
      const content = (item as Record<string, unknown>).content;
      if (!Array.isArray(content)) continue;
      for (const piece of content) {
        const text = extractPieceText(piece);
        if (text !== undefined && text.length > 0) {
          parts.push(text);
        }
      }
    }
    if (parts.length > 0) {
      return parts.join("");
    }
  }

  throw new Error(
    "extractResponsesOutputText: could not find assistant text in the response. " +
      "Expected `output_text` (string) or `output[].content[].text` " +
      "(string | { value: string }). The Responses API returns the SDK-style " +
      "`output_text` only when called via the OpenAI SDK; raw REST callers " +
      "get the underlying `output[].content[].text[]` structure. If you're " +
      "seeing this, the response shape did not match either form.",
  );
}

/**
 * Pull a string out of one entry in an `output[].content[]` array.
 *
 * Handles the three shapes OpenAI has shipped across response types:
 * - `{ type: 'output_text', text: '...' }` (Responses API today)
 * - `{ type: 'text', text: { value: '...' } }` (Assistants/Threads style)
 * - `{ type: 'text', text: '...' }` (older / variant)
 *
 * Returns `undefined` if nothing usable is present. The caller decides
 * whether `undefined` is an error.
 */
function extractPieceText(piece: unknown): string | undefined {
  if (piece === null || typeof piece !== "object") return undefined;
  const p = piece as Record<string, unknown>;

  const text = p.text;
  if (typeof text === "string") {
    return text;
  }
  if (text !== null && typeof text === "object") {
    const value = (text as Record<string, unknown>).value;
    if (typeof value === "string") {
      return value;
    }
  }

  return undefined;
}
