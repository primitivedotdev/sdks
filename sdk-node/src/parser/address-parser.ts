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
 * A validated RFC 5322 address. Returned by the strict parser, which
 * deliberately does not expose a display name.
 *
 * `address` is normalized to lowercase. Both the local-part and the
 * domain are lowercased: RFC 5321 §2.4 permits case-sensitive local-
 * parts, but every consumer mailbox in practice treats them as
 * case-insensitive, and a case-sensitive grant key would split
 * `Bob@x.com` from `bob@x.com` into separate rows and defeat the
 * primary-key index on lookup.
 */
export interface ValidatedAddress {
  address: string;
}

/**
 * A parsed RFC 5322 address with its display name. Returned by the
 * loose parser for display-only call sites.
 *
 * `address` is lowercased on the same rationale as
 * {@link ValidatedAddress}. The display name is preserved as provided
 * (after addressparser's quote / encoded-word handling), or null if the
 * header had no display name. Names from the loose parser are NOT
 * trustworthy for downstream mail building: addressparser's recovery
 * mode can fold trailing tokens or a second bracketed address into the
 * name field. Treat as opaque text, sanitize before re-emitting.
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
  | { ok: true; value: ValidatedAddress }
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
 * Returns ONLY the validated address, with no display name. Strict
 * exists for gating decisions, where the address is the security-
 * bearing field. Display names from addressparser are not trustworthy
 * here: weird inputs like `Name <user@x.com> <attacker@y.com>` get
 * parsed as a single entry whose `name` silently includes the second
 * address. Surfacing that as a "parsed name" would invite downstream
 * misuse, so we drop it. If you need the name, call
 * {@link parseFromHeaderLoose} alongside (it returns null on failure
 * anyway, so you can still gate on strict's Result).
 *
 * Returns a typed Result so callers can map the failure reason to
 * stable error codes without inspecting message text.
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
  const address = entry.address;
  if (address === undefined || !isEmail(address, IS_EMAIL_OPTIONS)) {
    return { ok: false, reason: "invalid_address" };
  }

  return {
    ok: true,
    value: { address: address.toLowerCase() },
  };
}

/**
 * Lenient parser for display-only call sites (inbox card "from",
 * log lines, debugging). Returns the first parseable address with its
 * display name, or null.
 *
 * Differences from {@link parseFromHeader}:
 *   - Multi-address From returns the first address instead of rejecting
 *   - Group syntax is flattened into its member addresses
 *   - Returns null instead of a typed reason on failure
 *   - Includes the parsed display name in the result
 *
 * Do not use for permission gates or any decision that grants access.
 * That is what {@link parseFromHeader} is for. Names returned here can
 * include addressparser's recovery output (trailing tokens, garbage
 * before the address); treat as opaque text for display.
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

  const parsed = addressparser(trimmed);
  for (const entry of parsed) {
    const candidates = "group" in entry ? entry.group : [entry];
    for (const candidate of candidates) {
      const address = candidate.address;
      if (address !== undefined && isEmail(address, IS_EMAIL_OPTIONS)) {
        return {
          address: address.toLowerCase(),
          name:
            candidate.name && candidate.name.length > 0 ? candidate.name : null,
        };
      }
    }
  }
  return null;
}
