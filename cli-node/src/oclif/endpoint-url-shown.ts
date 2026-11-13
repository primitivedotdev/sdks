// How the endpoint commands print a webhook's URL. A URL's query string can
// carry a secret, such as a deployment protection bypass token, and endpoints
// take no request headers of their own, so that is where such a secret goes.
// The commands that answer with endpoints (get, list, create, update) hide the
// query string unless --show-url is passed, under --json too, and mark each
// endpoint whose URL was shortened. The scheme, host and path stay, since
// checking a route needs them.

/** The commands whose answers carry endpoints, by operation sdkName. */
export const ENDPOINT_URL_OPERATIONS: ReadonlySet<string> = new Set([
  "getEndpoint",
  "listEndpoints",
  "createEndpoint",
  "updateEndpoint",
]);

/** The commands that send a URL, whose value is checked for the placeholder. */
export const ENDPOINT_URL_WRITE_OPERATIONS: ReadonlySet<string> = new Set([
  "createEndpoint",
  "updateEndpoint",
]);

/** What a hidden query string is replaced with. */
export const HIDDEN_QUERY = "?... (query hidden)";

export const SHOW_URL_FLAG_DESCRIPTION =
  "Print each webhook URL in full, its query string included. Without it the query string is shown as ?... (query hidden), with url_query_hidden: true on the endpoint, because it can carry a secret such as a deployment protection bypass token.";

/**
 * Said when an answer had a URL shortened: on stderr without --json, and in
 * the document's summary with --json --envelope.
 */
export const HIDDEN_QUERY_NOTE =
  "A webhook URL's query string is hidden, as it can carry a secret. Pass --show-url to print it in full.";

/**
 * The URL with its query string, and anything after it, replaced by
 * HIDDEN_QUERY; null when it has no query string. A `?` after a `#` is part
 * of the fragment, not a query.
 */
export function urlWithQueryHidden(url: string): string | null {
  const query = url.indexOf("?");
  if (query < 0) return null;
  const fragment = url.indexOf("#");
  if (fragment >= 0 && fragment < query) return null;
  return `${url.slice(0, query)}${HIDDEN_QUERY}`;
}

function hideOne(endpoint: unknown): { value: unknown; hidden: boolean } {
  if (
    endpoint === null ||
    typeof endpoint !== "object" ||
    Array.isArray(endpoint)
  )
    return { value: endpoint, hidden: false };
  const url = (endpoint as { url?: unknown }).url;
  const shown = typeof url === "string" ? urlWithQueryHidden(url) : null;
  if (shown === null) return { value: endpoint, hidden: false };
  return {
    value: { ...endpoint, url: shown, url_query_hidden: true },
    hidden: true,
  };
}

/**
 * An answer's data (one endpoint, or a list of them) with each URL's query
 * string hidden, and whether any was.
 */
export function endpointsWithQueryHidden(data: unknown): {
  data: unknown;
  hidden: boolean;
} {
  if (!Array.isArray(data)) {
    const one = hideOne(data);
    return { data: one.value, hidden: one.hidden };
  }
  let hidden = false;
  const rows = data.map((row) => {
    const one = hideOne(row);
    hidden ||= one.hidden;
    return one.value;
  });
  return { data: rows, hidden };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** How deep errorWithQueryHidden looks into an error payload. */
const ERROR_DEPTH = 8;

/**
 * An error answer with the query string hidden in every `url` it names, such
 * as `details.holder.url` on a 409 for a slot another endpoint holds.
 * Anything that is not a plain object or a list is left as it is.
 */
export function errorWithQueryHidden(payload: unknown, depth = 0): unknown {
  if (depth > ERROR_DEPTH) return payload;
  if (Array.isArray(payload))
    return payload.map((entry) => errorWithQueryHidden(entry, depth + 1));
  if (!isPlainObject(payload)) return payload;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload))
    out[key] = errorWithQueryHidden(value, depth + 1);
  return hideOne(out).value;
}

/**
 * A query string as a partial copy of HIDDEN_QUERY leaves it: a terminal's
 * word selection stops at its first space, after `?...`.
 */
const HIDDEN_QUERY_START = "?...";

/**
 * The refusal for a request body whose url is a URL as these commands print
 * it with the query hidden, whole or cut at its first space, so a printed URL
 * is never written back in place of the real one; null for any other body.
 */
export function hiddenQueryUrlRefusal(body: unknown): string | null {
  if (body === null || typeof body !== "object" || Array.isArray(body))
    return null;
  const url = (body as { url?: unknown }).url;
  if (typeof url !== "string" || !url.includes(HIDDEN_QUERY_START)) return null;
  return `The url carries ${HIDDEN_QUERY_START}, the start of ${HIDDEN_QUERY}, which is how the endpoint commands print a URL with its query string hidden, not the URL itself. Pass the full URL; \`primitive endpoints get <id> --show-url\` prints a webhook's URL in full.`;
}
