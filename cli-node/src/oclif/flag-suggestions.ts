/**
 * "Did you mean" hints for unknown flags. oclif reports an unknown flag as
 * `Nonexistent flag: --query` and prints the full help; this adds the
 * closest valid flag to that message so the fix is on the first line.
 */

/** Common names for a free-text query, mapped onto the `q` flag. */
const FREE_TEXT_ALIASES = new Set([
  "query",
  "search",
  "text",
  "term",
  "terms",
  "keyword",
  "keywords",
  "filter",
]);

function editDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 0; i < left.length; i += 1) {
    const current = [i + 1];
    for (let j = 0; j < right.length; j += 1)
      current[j + 1] = Math.min(
        (current[j] ?? 0) + 1,
        (previous[j + 1] ?? 0) + 1,
        (previous[j] ?? 0) + (left[i] === right[j] ? 0 : 1),
      );
    previous = current;
  }
  return previous[right.length] ?? Number.POSITIVE_INFINITY;
}

/**
 * The valid flag closest to `unknown` (both without leading dashes), or
 * null when nothing is close enough to be a likely typo.
 */
export function suggestFlag(
  unknown: string,
  valid: readonly string[],
): string | null {
  const name = unknown.replace(/^-+/, "").split("=")[0]?.toLowerCase() ?? "";
  if (!name) return null;
  if (FREE_TEXT_ALIASES.has(name) && valid.includes("q")) return "q";
  let best: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of valid) {
    const distance = editDistance(name, candidate.toLowerCase());
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  // A typo, not a different word: at most a third of the name may change.
  return best !== null &&
    bestDistance <= Math.max(1, Math.floor(name.length / 3))
    ? best
    : null;
}

/**
 * When `error` is oclif's unknown-flag parse error, add the closest valid
 * flag to its message. Any other error is returned unchanged.
 */
export function withFlagSuggestion(
  error: unknown,
  valid: readonly string[],
): unknown {
  const flags: unknown =
    error instanceof Error ? (error as { flags?: unknown }).flags : undefined;
  if (
    !(error instanceof Error) ||
    !error.message.startsWith("Nonexistent flag") ||
    !Array.isArray(flags)
  )
    return error;
  const hints = flags
    .filter((flag): flag is string => typeof flag === "string")
    .flatMap((flag) => {
      const match = suggestFlag(flag, valid);
      return match
        ? [
            `${flag.split("=")[0]} is not a flag here; did you mean --${match}${match === "q" ? " (the free-text query)" : ""}?`,
          ]
        : [];
    });
  if (hints.length === 0) return error;
  const [first, ...rest] = error.message.split("\n");
  error.message = [first, ...hints, ...rest].join("\n");
  return error;
}
