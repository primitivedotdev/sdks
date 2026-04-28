import addressparser from "nodemailer/lib/addressparser/index.js";
import isEmail from "validator/lib/isEmail.js";

// Per RFC 5322 §2.1.1, header lines are bounded at 998 octets. We measure
// in UTF-8 bytes, not JS code units, so SMTPUTF8 (RFC 6531) headers with
// multi-byte characters cannot bypass the cap by being short on chars but
// long on bytes. Reject anything beyond as malformed without parsing: a
// longer From field is either a header-injection probe or a corrupt feed.
const MAX_HEADER_LENGTH = 998;

// Options for validator's isEmail. The per-part length limits (64-octet
// local-part, 255-octet domain), dot-atom rules, hostname-label rules,
// and TLD requirement are all enforced inside isEmail. We choose:
//   allow_ip_domain: true     -- accept user@[192.168.1.1] address-literals
//   require_tld: true         -- reject user@localhost
//   allow_display_name: false -- we already extracted the address with
//                                addressparser, so isEmail only sees the
//                                bare addr-spec
//   allow_utf8_local_part: true -- accept SMTPUTF8 / EAI local-parts
const IS_EMAIL_OPTIONS = {
  allow_ip_domain: true,
  require_tld: true,
  allow_display_name: false,
  allow_utf8_local_part: true,
} as const;

/**
 * A parsed RFC 5322 address with its display name.
 *
 * `address` is normalized to lowercase. Both the local-part and the
 * domain are lowercased: RFC 5321 §2.4 permits case-sensitive local-
 * parts, but every consumer mailbox in practice treats them as
 * case-insensitive, and a case-sensitive grant key would split
 * `Bob@x.com` from `bob@x.com` into separate rows and defeat the
 * primary-key index on lookup. The display name is preserved as
 * provided (after addressparser's quote / encoded-word handling), or
 * null if the header had no display name.
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
 *   - multi-address From (RFC 5322 allows it but it is vanishingly
 *     rare and ambiguous as an identity)
 *   - group syntax ("Friends: a@b.com, c@d.com;")
 *   - any address that fails validator's isEmail check with our chosen
 *     options. That covers per-part length limits, dot-atom rules,
 *     hostname-label rules, TLD requirement, and other RFC 5321/5322
 *     conformance checks.
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
  if (Buffer.byteLength(trimmed, "utf8") > MAX_HEADER_LENGTH) {
    return { ok: false, reason: "too_long" };
  }

  // Default (no flatten) so group entries surface as { name, group: [] }
  // rather than being silently merged into the address list.
  const parsed = addressparser(trimmed);
  if (parsed.length > 1) {
    return { ok: false, reason: "multiple_addresses" };
  }

  const entry = parsed[0];
  // addressparser returns a single entry with empty `address` for raw
  // garbage rather than an empty array, so an empty result is only
  // possible for inputs that already failed our trim/empty check above.
  // The defensive fall-through maps any future regression to
  // invalid_address rather than crashing on parsed[0].
  if (entry === undefined) {
    return { ok: false, reason: "invalid_address" };
  }
  if ("group" in entry) {
    return { ok: false, reason: "group_syntax" };
  }
  if (!isEmail(entry.address, IS_EMAIL_OPTIONS)) {
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
  if (
    trimmed.length === 0 ||
    Buffer.byteLength(trimmed, "utf8") > MAX_HEADER_LENGTH
  ) {
    return null;
  }

  const parsed = addressparser(trimmed, { flatten: true });
  const entry = parsed[0];
  if (entry === undefined || !isEmail(entry.address, IS_EMAIL_OPTIONS)) {
    return null;
  }

  return {
    address: entry.address.toLowerCase(),
    name: entry.name && entry.name.length > 0 ? entry.name : null,
  };
}
