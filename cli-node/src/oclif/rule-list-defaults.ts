/**
 * What the email rule lists leave out by default, said where a caller reads
 * them. Rule requests list only pending ones made to you, shares only live
 * ones made with you, given shares only live ones, and objections only
 * pending ones you made. A page that holds some rows still reads as
 * everything there is (one live share of seven), so the line is printed on
 * every page read with a default left in place, not only on an empty one.
 *
 * The objection list's box is asked for by name, so the line stays true
 * whatever a server's own default is.
 */

/** The box the objection list asks for when --box is not given: objections you made. */
export const OBJECTION_BOX_DEFAULT = "outgoing";

/**
 * The query to send: for the objection list read without --box, the CLI's
 * default box by name; any other query as it is.
 */
export function withDefaultObjectionBox(
  sdkName: string,
  query: Record<string, unknown>,
): Record<string, unknown> {
  return sdkName === "listEmailRuleObjections" && query.box === undefined
    ? { ...query, box: OBJECTION_BOX_DEFAULT }
    : query;
}

const widen = (flags: string[]) => `add \`${flags.join(" ")}\` to widen it`;

/** The objection list's line: what its defaults left out, and how to see more. */
function objectionsNote(box: boolean, status: boolean): string | undefined {
  const phrase =
    box && status
      ? "pending objections you made"
      : box
        ? "objections you made"
        : status
          ? "pending objections"
          : null;
  if (phrase === null) return undefined;
  return `By default this lists only ${phrase}: ${widen([
    ...(box ? ["--box all"] : []),
    ...(status ? ["--status any"] : []),
  ])}.`;
}

/**
 * What a rule request, share or objection list read with `query` (the
 * flags as given) left out by its defaults, and the flags that show more.
 * Said on any page. Undefined for any other list, or when every default was
 * overridden.
 */
export function ruleListDefaultsNote(
  sdkName: string,
  query: Record<string, unknown>,
): string | undefined {
  const unset = (name: string) => query[name] === undefined;
  const said = (phrase: string | null, flags: string[]) =>
    phrase === null
      ? undefined
      : `By default this lists only ${phrase}: ${widen(flags)}.`;
  if (sdkName === "listEmailRuleRequests") {
    const box = unset("box");
    const status = unset("status");
    const phrase =
      box && status
        ? "pending requests made to you"
        : box
          ? "requests made to you"
          : status
            ? "pending requests"
            : null;
    return said(phrase, [
      ...(box ? ["--box all"] : []),
      ...(status ? ["--status any"] : []),
    ]);
  }
  if (sdkName === "listEmailRuleShares") {
    const box = unset("box");
    const live = unset("live");
    const phrase =
      box && live
        ? "live shares made with you"
        : box
          ? "shares made with you"
          : live
            ? "live shares"
            : null;
    return said(phrase, [
      ...(box ? ["--box all"] : []),
      ...(live ? ["--live any"] : []),
    ]);
  }
  if (sdkName === "listGivenEmailRuleShares")
    return said(unset("live") ? "live shares of your mail" : null, [
      "--live any",
    ]);
  if (sdkName === "listEmailRuleObjections")
    return objectionsNote(unset("box"), unset("status"));
  return undefined;
}

const NOUNS: Record<string, string> = {
  listEmailRuleRequests: "requests",
  listEmailRuleShares: "shares",
  listGivenEmailRuleShares: "shares",
  listEmailRuleObjections: "objections",
};

/**
 * An empty first page of one of those lists: that nothing matched, then the
 * line above. Undefined for any other list, when every default was
 * overridden, or on a later page (--cursor), where the line alone is said.
 */
export function emptyRuleListHint(
  sdkName: string,
  query: Record<string, unknown>,
): string | undefined {
  if (query.cursor !== undefined) return undefined;
  const note = ruleListDefaultsNote(sdkName, query);
  return note ? `(no results) No ${NOUNS[sdkName]} match. ${note}` : undefined;
}
