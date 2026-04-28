import addressparser from "nodemailer/lib/addressparser/index.js";

// Per RFC 5322 §2.1.1, header lines are bounded at 998 octets. Reject
// anything beyond that as malformed without parsing — a longer From
// field is either a header-injection probe or a corrupt feed.
const MAX_HEADER_LENGTH = 998;

// Per RFC 5321 §4.5.3.1, the local-part is at most 64 octets and the
// domain at most 255, so the addr-spec is at most 320 (plus the '@').
// We use 320 as the cap on the address portion only; the display name
// can use the rest of the 998.
const MAX_ADDRESS_LENGTH = 320;

/**
 * A parsed RFC 5322 address with its display name.
 *
 * `address` is normalized to lowercase. The display name is preserved as
 * provided (after addressparser's quote/encoded-word handling), or null
 * if the header had no display name.
 */
export interface ParsedAddress {
  address: string;
  name: string | null;
}

/**
 * Reason a strict From-header parse rejected the input. Stable enum so
 * callers can branch on the reason without parsing message text.
 */
export type ParseFromHeaderFailureReason =
  | "empty"
  | "too_long"
  | "unparseable"
  | "multiple_addresses"
  | "group_syntax"
  | "invalid_address";

export type ParseFromHeaderResult =
  | { ok: true; value: ParsedAddress }
  | { ok: false; reason: ParseFromHeaderFailureReason };

/**
 * Strict parser for RFC 5322 From-style headers in security-bearing
 * contexts (allowlist gates, permission grants).
 *
 * Rejects, without falling back to a "best guess":
 *   - empty / whitespace-only input
 *   - inputs longer than RFC 5322's 998-octet line limit
 *   - inputs that addressparser cannot extract any address from
 *   - multi-address From (RFC 5322 allows it but it is vanishingly
 *     rare and ambiguous as an identity)
 *   - group syntax ("Friends: a@b.com, c@d.com;")
 *   - addresses without exactly one '@', with empty halves, or with a
 *     domain that lacks a dot / starts or ends with '.' / contains '..'
 *   - addresses whose addr-spec exceeds 320 octets
 *
 * Returns a typed Result so callers can map the failure reason to
 * stable error codes without inspecting message text.
 *
 * For display-only use cases (inbox UI, log lines), prefer
 * {@link parseFromHeaderLoose}.
 */
export function parseFromHeader(
  header: string | null | undefined,
): ParseFromHeaderResult {
  if (header === null || header === undefined) {
    return { ok: false, reason: "empty" };
  }
  const trimmed = header.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "empty" };
  }
  if (trimmed.length > MAX_HEADER_LENGTH) {
    return { ok: false, reason: "too_long" };
  }

  // Default (no flatten) so group entries surface as { name, group: [] }
  // rather than being silently merged into the address list.
  const parsed = addressparser(trimmed);
  if (parsed.length === 0) {
    return { ok: false, reason: "unparseable" };
  }
  if (parsed.length > 1) {
    return { ok: false, reason: "multiple_addresses" };
  }

  const entry = parsed[0];
  if ("group" in entry) {
    return { ok: false, reason: "group_syntax" };
  }
  if (!isValidAddress(entry.address)) {
    return { ok: false, reason: "invalid_address" };
  }

  return {
    ok: true,
    value: {
      address: entry.address.toLowerCase(),
      name: entry.name && entry.name.length > 0 ? entry.name : null,
    },
  };
}

/**
 * Lenient parser for display-only call sites (inbox card "from",
 * log lines, debugging). Returns the first parseable address or null.
 *
 * Differences from {@link parseFromHeader}:
 *   - Multi-address From returns the first address instead of rejecting
 *   - Group syntax is flattened into its member addresses
 *   - Returns null instead of a typed reason on failure
 *
 * Do not use for permission gates or any decision that grants access.
 * That is what {@link parseFromHeader} is for.
 */
export function parseFromHeaderLoose(
  header: string | null | undefined,
): ParsedAddress | null {
  if (header === null || header === undefined) {
    return null;
  }
  const trimmed = header.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_HEADER_LENGTH) {
    return null;
  }

  const parsed = addressparser(trimmed, { flatten: true });
  if (parsed.length === 0) {
    return null;
  }

  const entry = parsed[0];
  if (!isValidAddress(entry.address)) {
    return null;
  }

  return {
    address: entry.address.toLowerCase(),
    name: entry.name && entry.name.length > 0 ? entry.name : null,
  };
}

function isValidAddress(address: string): boolean {
  if (address.length === 0 || address.length > MAX_ADDRESS_LENGTH) {
    return false;
  }
  const at = address.indexOf("@");
  if (at < 0 || at !== address.lastIndexOf("@")) {
    return false;
  }
  const local = address.slice(0, at);
  const domain = address.slice(at + 1);
  if (local.length === 0 || domain.length === 0) {
    return false;
  }
  if (
    !domain.includes(".") ||
    domain.startsWith(".") ||
    domain.endsWith(".") ||
    domain.includes("..")
  ) {
    return false;
  }
  return true;
}
