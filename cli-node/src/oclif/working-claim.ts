/** The address note that holds an agent's current work claim. */
export const WORKING_NOTE_NAME = "AGENT_WORKING";

/** Default claim lifetime when --until is omitted. */
export const DEFAULT_CLAIM_MS = 4 * 60 * 60 * 1000;

export const CLAIM_MAX_LENGTH = 500;

export type WorkingClaimValue = { claim: string; until: string };

export type WorkingClaimView =
  | { state: "none"; claim: null; until: null }
  | { state: "expired"; claim: string; until: string }
  | { state: "active"; claim: string; until: string }
  | { state: "legacy"; claim: string; until: null };

/** Validate the claim text and expiry and build the stored note value. */
export function buildWorkingClaim(params: {
  claim: string;
  until?: string;
  now?: number;
}): WorkingClaimValue {
  const claim = params.claim.trim();
  if (claim === "") throw new Error("The claim must not be empty.");
  if (/[\r\n]/.test(claim))
    throw new Error(
      "Keep the claim to one line naming the task and the files or areas being changed.",
    );
  if (claim.length > CLAIM_MAX_LENGTH)
    throw new Error(
      `The claim must be at most ${CLAIM_MAX_LENGTH} characters.`,
    );
  const now = params.now ?? Date.now();
  let untilMs = now + DEFAULT_CLAIM_MS;
  if (params.until !== undefined) {
    untilMs = parseIsoTime(params.until);
    if (Number.isNaN(untilMs))
      throw new Error(
        "--until must be an ISO 8601 time with a timezone, such as 2026-10-01T18:00:00Z.",
      );
    if (untilMs <= now) throw new Error("--until must be in the future.");
  }
  return { claim, until: new Date(untilMs).toISOString() };
}

/**
 * Interpret a stored AGENT_WORKING value. A JSON claim (stored as an
 * object, or as text holding that object) has an expiry; any other text
 * is a legacy value shown as-is with no expiry.
 */
export function readWorkingClaim(
  value: unknown,
  now: number = Date.now(),
): WorkingClaimView {
  let structured: unknown = value;
  if (typeof value === "string") {
    try {
      structured = JSON.parse(value);
    } catch {
      structured = value;
    }
  }
  if (
    structured &&
    typeof structured === "object" &&
    !Array.isArray(structured)
  ) {
    const row = structured as Record<string, unknown>;
    if (typeof row.claim === "string" && typeof row.until === "string") {
      const untilMs = parseIsoTime(row.until);
      if (!Number.isNaN(untilMs))
        return {
          state: untilMs > now ? "active" : "expired",
          claim: row.claim,
          until: new Date(untilMs).toISOString(),
        };
    }
  }
  if (value === null || value === undefined || value === "")
    return { state: "none", claim: null, until: null };
  return {
    state: "legacy",
    claim: typeof value === "string" ? value : JSON.stringify(value),
    until: null,
  };
}

/** One line for terminal output: the claim, or "none". */
export function formatWorkingClaim(view: WorkingClaimView): string {
  if (view.state === "active") return `${view.claim} (until ${view.until})`;
  if (view.state === "legacy") return view.claim;
  return "none";
}

// ISO 8601 date-time with an explicit timezone. Date.parse alone accepts
// many loose forms and treats zoneless times as local time.
function parseIsoTime(value: string): number {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(
      value,
    )
  )
    return Number.NaN;
  return Date.parse(value);
}
