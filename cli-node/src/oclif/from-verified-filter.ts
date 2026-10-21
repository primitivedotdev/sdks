/**
 * The `from_verified` filter on GET /emails and GET /emails/search: the
 * `from_verified=true|false` parameter (`--from-verified`) and the
 * `from_verified:` search term.
 *
 * `from_verified` says whether the From domain was authenticated when the
 * email arrived. A filter on it is a trust decision, so a server that does
 * not apply it must fail loudly: rows returned for `--from-verified true`
 * that do not all carry `from_verified: true` are refused instead of being
 * printed as if they were authenticated mail.
 */

export const FROM_VERIFIED_FILTER_UNSUPPORTED_CODE =
  "from_verified_filter_unsupported";

export class FromVerifiedFilterUnsupportedError extends Error {
  code: string = FROM_VERIFIED_FILTER_UNSUPPORTED_CODE;

  constructor(detail: string) {
    super(
      `The server did not apply the \`from_verified\` filter: ${detail} Nothing was printed. Upgrade to a server that returns \`from_verified\`, or drop the filter.`,
    );
    this.name = "FromVerifiedFilterUnsupportedError";
  }
}

const FROM_VERIFIED_SURFACES: Record<string, string> = {
  listEmails: "GET /emails",
  searchEmails: "GET /emails/search",
};

const TERM = /(?:^|\s)from_verified:("?)(true|false)\1(?=\s|$)/gi;
// Quoted text is literal, never a filter: a standalone phrase, or the quoted
// value of another field (`header:"X-Note=... from_verified:true ..."`). A
// quoted `from_verified:"true"` is the filter itself, so it is kept.
const PHRASE =
  /(^|\s)(?:(?!from_verified:)[A-Za-z_][\w.-]*:)?"(?:[^"\\]|\\.)*"/gi;

/** The `from_verified:` values a search query asks for, in order. */
export function fromVerifiedTermsInQuery(
  q: string | null | undefined,
): boolean[] {
  if (typeof q !== "string") return [];
  return [...q.replace(PHRASE, "$1 ").matchAll(TERM)].map(
    (match) => match[2]?.toLowerCase() === "true",
  );
}

/**
 * For the generated `emails list` / `emails search` commands: the surface
 * name and the values every row must have when this call filtered on
 * `from_verified`, else null.
 */
export function fromVerifiedExpectation(
  sdkName: string,
  query: Record<string, unknown> | undefined,
): { surface: string; expected: boolean[] } | null {
  const surface = FROM_VERIFIED_SURFACES[sdkName];
  if (!surface || !query) return null;
  const expected = fromVerifiedTermsInQuery(
    typeof query.q === "string" ? query.q : undefined,
  );
  if (query.from_verified === "true") expected.push(true);
  if (query.from_verified === "false") expected.push(false);
  return expected.length > 0 ? { surface, expected } : null;
}

/** Throw unless every row carries `from_verified` with every expected value. */
export function assertFromVerifiedRows(
  rows: readonly unknown[],
  expectation: { surface: string; expected: readonly boolean[] },
): void {
  const wrong = rows.filter((row) => {
    if (row === null || typeof row !== "object") return true;
    const value = (row as Record<string, unknown>).from_verified;
    return (
      typeof value !== "boolean" ||
      expectation.expected.some((expected) => expected !== value)
    );
  }).length;
  if (wrong > 0) {
    throw new FromVerifiedFilterUnsupportedError(
      `${expectation.surface} returned ${wrong} of ${rows.length} email${rows.length === 1 ? "" : "s"} without the requested \`from_verified\` value.`,
    );
  }
}
