import type { EmailDetail } from "@primitivedotdev/api-core";

/**
 * A fixture's parsed content. `parsed` is null when the API withholds the
 * content, which no fixture that reaches for it intends.
 */
export function parsedOf(
  detail: EmailDetail,
): NonNullable<EmailDetail["parsed"]> {
  if (detail.parsed === null) throw new Error("fixture has no parsed content");
  return detail.parsed;
}
