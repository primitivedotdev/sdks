/**
 * What the email rule lists leave out by default, said where a caller reads
 * them. Rule requests list only pending ones made to you, shares only live
 * ones made with you, given shares only live ones, and objections only
 * pending ones you made or to rules you wrote. A page that holds some rows
 * still reads as everything there is (one live share of seven), so the line
 * is printed on every page read with a default left in place, not only on an
 * empty one.
 *
 * The objection list's box is asked for by name, so the line stays true
 * whatever a server's own default is. A server that predates box=mine
 * refuses it; the list is then read once more with box=outgoing (objections
 * you made), and the line says so.
 */
import type { PathFlagOverride } from "./api-command.js";

/** The box the objection list asks for when --box is not given: objections you made and objections to rules you wrote. */
export const OBJECTION_BOX_DEFAULT = "mine";

/** The box asked for instead when a server refuses OBJECTION_BOX_DEFAULT: objections you made. */
export const OBJECTION_BOX_FALLBACK = "outgoing";

/** Every box the objection list takes, the CLI's default first. */
export const OBJECTION_BOXES = [
  OBJECTION_BOX_DEFAULT,
  "outgoing",
  "incoming",
  "all",
] as const;

/** --box on `email-rule-oversight list-email-rule-objections`, with the CLI's default. */
export const OBJECTION_BOX_FLAG: PathFlagOverride = {
  description:
    "mine (the default): objections you made and objections to rules you wrote, each saying which (is_objector, is_author). outgoing: only those you made. incoming: only those to rules you wrote. all: every objection you can see. On a server that does not take mine, the CLI lists only those you made by default, and says so.",
  options: OBJECTION_BOXES,
};

/** Options for the lines below. */
export type RuleListDefaultsOptions = {
  /** The server refused box=mine, so objections you made were read instead. */
  objectionBoxRefused?: boolean;
};

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

function errorBody(payload: unknown): { code?: unknown; message?: unknown } {
  if (payload === null || typeof payload !== "object") return {};
  const inner = (payload as { error?: unknown }).error;
  return inner !== null && typeof inner === "object"
    ? (inner as { code?: unknown; message?: unknown })
    : (payload as { code?: unknown; message?: unknown });
}

/**
 * True when an API error is a server that predates box=mine refusing the
 * value: a validation error whose issue for box is an unknown option, not
 * any other refusal that happens to name box.
 */
export function isObjectionBoxRefused(payload: unknown): boolean {
  const body = errorBody(payload);
  return (
    body.code === "validation_error" &&
    typeof body.message === "string" &&
    /(^|,\s*)box: Invalid (option|enum value)/.test(body.message)
  );
}

/** The error line for `--box mine` given to a server that refuses it. */
export function objectionBoxErrorHint(
  payload: unknown,
  flags: Record<string, unknown> | undefined,
): string | undefined {
  if (flags?.box !== OBJECTION_BOX_DEFAULT || !isObjectionBoxRefused(payload))
    return undefined;
  return "This server does not take --box mine: use --box outgoing for objections you made, and --box incoming for objections to rules you wrote.";
}

const widen = (flags: string[]) => `add \`${flags.join(" ")}\` to widen it`;

/** The objection list's line: what its defaults left out, and how to see more. */
function objectionsNote(
  box: boolean,
  status: boolean,
  refused: boolean,
): string | undefined {
  if (box && refused) {
    const which = status
      ? "pending objections you made"
      : "objections you made";
    return `By default this server lists only ${which}: add \`--box incoming\` for objections to rules you wrote, or \`${["--box all", ...(status ? ["--status any"] : [])].join(" ")}\` for every one you can see.`;
  }
  const phrase =
    box && status
      ? "pending objections you made and those to rules you wrote"
      : box
        ? "objections you made and those to rules you wrote"
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
  options: RuleListDefaultsOptions = {},
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
    return objectionsNote(
      unset("box"),
      unset("status"),
      options.objectionBoxRefused === true,
    );
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
  options: RuleListDefaultsOptions = {},
): string | undefined {
  if (query.cursor !== undefined) return undefined;
  const note = ruleListDefaultsNote(sdkName, query, options);
  return note ? `(no results) No ${NOUNS[sdkName]} match. ${note}` : undefined;
}
