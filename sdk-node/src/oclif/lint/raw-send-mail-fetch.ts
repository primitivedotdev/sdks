// Deploy-time lint for `functions:deploy --file <bundle>` and
// `functions:redeploy --file <bundle>`. Looks for a raw
// `fetch("...primitive.dev/.../send-mail", ...)` call in the bundle
// text and, on a match, emits a stderr warning telling the author
// to prefer `createPrimitiveClient` from `@primitivedotdev/sdk/api`.
//
// Why: a recurring pattern in agent-assisted Function deploys is to
// copy the REST snippet from the docs and call `fetch` directly
// against the Primitive send-mail endpoint, even after the docs
// switched to leading with the SDK and `functions:init` ships a
// scaffold that uses `createPrimitiveClient`. The SDK already
// handles dual-host routing, error envelopes, and send-permission
// gate denials; raw `fetch` re-discovers each of those by hand. The
// warning is the catch-net at deploy time: the deploy still
// proceeds.
//
// Scope by design:
// - We only flag the empirically observed footgun: `/send-mail`.
//   Not arbitrary calls to api.primitive.dev. Other endpoints have
//   not surfaced the same pattern.
// - We require the URL string literal to immediately follow the
//   `fetch(` token (allowing whitespace) so we don't trip on a
//   comment that merely mentions the URL. esbuild strips most
//   comments anyway, but anchoring on `fetch(` keeps the rule
//   honest without trying to parse JS.
// - We only look at the bundle text passed in. Source maps and
//   sibling files are not scanned.
// - Variable-URL cases (`fetch(url, ...)` where `url` was assembled
//   elsewhere) are accepted false negatives. The value here is
//   catching the obvious inline-literal case, not full taint
//   analysis.

// Match `fetch(` then a string literal (single, double, or backtick)
// whose contents include `primitive.dev` and end with `/send-mail`
// (optionally with a query string or trailing path boundary). Examples
// matched:
//   fetch("https://api.primitive.dev/v1/send-mail", {...})
//   fetch(`https://www.primitive.dev/api/v1/send-mail`, {...})
//   fetch('https://primitive.dev/api/v1/send-mail?wait=1')
//
// The `[^`'"]*` inside the literal forbids the closing quote
// character itself so we can't accidentally span across two adjacent
// string literals. The trailing `(?![A-Za-z0-9_-])` forbids any
// letter, digit, underscore, or hyphen immediately after `send-mail`
// so `/send-mail-template-preview` does not trip the rule. (Plain
// `\b` does not help here because `-` is itself a non-word character,
// so `mail\b` still matches `mail-...`.)
const RAW_SEND_MAIL_FETCH_REGEX =
  /fetch\s*\(\s*[`'"][^`'"]*primitive\.dev[^`'"]*\/send-mail(?![A-Za-z0-9_-])/g;

export interface RawSendMailFetchFinding {
  // True when the bundle contains at least one raw fetch call that
  // matches the pattern. False otherwise.
  found: boolean;
  // A short excerpt around the first match, suitable for echoing
  // back to the user so they can locate it in their bundle. Null
  // when nothing was found.
  sampleSnippet: string | null;
}

// How much surrounding text to include on either side of the match
// when building the sample snippet. Kept short on purpose: bundles
// are minified and a 120-char window is enough to spot the call
// without flooding stderr.
const SNIPPET_PADDING = 60;

export function detectRawSendMailFetch(
  bundleText: string,
): RawSendMailFetchFinding {
  // Reset lastIndex defensively: this regex is module-scoped with
  // the /g flag, so a prior call's state would skip the next match.
  RAW_SEND_MAIL_FETCH_REGEX.lastIndex = 0;
  const match = RAW_SEND_MAIL_FETCH_REGEX.exec(bundleText);
  if (!match) {
    return { found: false, sampleSnippet: null };
  }

  const start = Math.max(0, match.index - SNIPPET_PADDING);
  const end = Math.min(
    bundleText.length,
    match.index + match[0].length + SNIPPET_PADDING,
  );
  const raw = bundleText.slice(start, end);
  // Collapse newlines and runs of whitespace so the snippet is one
  // readable line on stderr regardless of how the bundle was
  // formatted.
  const sampleSnippet = raw.replace(/\s+/g, " ").trim();

  return { found: true, sampleSnippet };
}

// The stderr warning copy. Three beats: name the issue, name the
// SDK alternative, link the docs. Plus a one-line "deploy proceeds"
// reassurance. Kept punctuation simple (commas, periods, line
// breaks) so it doesn't trip the no-em-dashes hook and so the lines
// wrap predictably in a terminal.
export const RAW_SEND_MAIL_FETCH_WARNING_LINES = [
  "warning: this bundle calls fetch(...) against /send-mail directly.",
  "The Primitive SDK exposes createPrimitiveClient from",
  "@primitivedotdev/sdk/api which handles host routing, error envelopes,",
  "and gate denials for you. See https://www.primitive.dev/docs/functions",
  "for the recommended in-handler pattern. Continuing with deploy.",
] as const;

export function formatRawSendMailFetchWarning(
  finding: RawSendMailFetchFinding,
): string {
  const lines: string[] = [...RAW_SEND_MAIL_FETCH_WARNING_LINES];
  if (finding.sampleSnippet) {
    lines.push(`  found: ${finding.sampleSnippet}`);
  }
  return `${lines.join("\n")}\n`;
}

// Convenience: run the detector and, on a match, write the warning
// to a stderr-shaped writer. Pulled out so both deploy and redeploy
// share one code path and so the unit tests can pass a fake writer.
export function emitRawSendMailFetchWarning(
  bundleText: string,
  write: (chunk: string) => void,
): RawSendMailFetchFinding {
  const finding = detectRawSendMailFetch(bundleText);
  if (finding.found) {
    write(formatRawSendMailFetchWarning(finding));
  }
  return finding;
}
