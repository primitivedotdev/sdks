export type PresenceDisposition = "ordinary" | "quiet" | "pending";
type Projection = {
  status: "verified" | "pending" | "rejected";
  valid_for_ms: number;
};
export function readPresenceProjection(detail: unknown): Projection | null {
  if (!detail || typeof detail !== "object") return null;
  const value = (detail as Record<string, unknown>).presence_control;
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value))
    return { status: "pending", valid_for_ms: 0 };
  const row = value as Record<string, unknown>;
  if (
    !["verified", "pending", "rejected"].includes(String(row.status)) ||
    typeof row.valid_for_ms !== "number" ||
    !Number.isSafeInteger(row.valid_for_ms) ||
    row.valid_for_ms < 0 ||
    row.valid_for_ms > 600_000
  )
    return { status: "pending", valid_for_ms: 0 };
  return row as Projection;
}

/** Only the authenticated detail projection identifies control mail. */
export function presenceDisposition(detail: unknown): PresenceDisposition {
  const proof = readPresenceProjection(detail);
  return !proof || proof.status === "rejected"
    ? "ordinary"
    : proof.status === "verified"
      ? "quiet"
      : "pending";
}
