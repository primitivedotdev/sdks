/**
 * Domain-Anchored Sender Trust
 *
 * `validateEmailAuth()` answers "was this email authenticated?" but not
 * "authenticated AS WHOM?". A fully authenticated email from any domain
 * returns a `legit` verdict, so a verdict check alone cannot gate actions
 * on "this really came from our domain". `isTrustedSender()` closes that
 * gap by anchoring the verdict to an expected From domain (and optionally
 * an exact sender address).
 *
 * @example
 * ```typescript
 * import { isTrustedSender } from '@primitivedotdev/sdk/api';
 *
 * const trust = isTrustedSender(event, { domain: 'example.com' });
 * if (trust.trusted) {
 *   // Authenticated mail whose From domain is example.com
 * } else if (trust.retryable) {
 *   // Transient DNS failure during DMARC evaluation; return a 5xx so
 *   // webhook redelivery retries with fresh DNS.
 * } else {
 *   console.warn('Untrusted email:', trust.reason, trust.auth.reasons);
 * }
 * ```
 *
 * @packageDocumentation
 */

import isEmail from "validator/lib/isEmail.js";
import { parseFromHeader } from "../parser/address-parser.js";
import type { EmailReceivedEvent, ValidateEmailAuthResult } from "../types.js";
import { validateEmailAuth } from "./auth.js";

// Mirrors IS_EMAIL_OPTIONS in parser/address-parser.ts. Used only to
// validate the caller-supplied `options.sender`, which must be a bare
// addr-spec (no display name), so the shared constant for header
// parsing is intentionally not reused here.
const SENDER_OPTION_EMAIL_OPTIONS = {
  allow_ip_domain: true,
  require_tld: true,
  allow_display_name: false,
  allow_utf8_local_part: true,
} as const;

/**
 * Why an email was or was not trusted. Stable machine-readable codes,
 * ordered here by the sequence in which the checks run:
 *
 * - `trusted`: every check passed.
 * - `auth-missing`: the event carries no usable `email.auth` object.
 * - `auth-suspicious`: `validateEmailAuth` returned a `suspicious`
 *   verdict (DMARC/SPF failure signals).
 * - `dmarc-temperror`: DMARC evaluation hit a temporary DNS error. The
 *   only retryable reason; the same email may verify cleanly once DNS
 *   recovers.
 * - `auth-unknown`: authenticity could not be determined and the cause
 *   is not transient (most commonly the sender domain publishes no
 *   DMARC record, or evaluation hit a permanent error).
 * - `dmarc-domain-mismatch`: the email authenticated, but the domain
 *   DMARC evaluated (the RFC 5322 From domain seen by the server) is
 *   not the expected domain.
 * - `from-header-multiple-addresses`: the From header lists more than
 *   one address, which is ambiguous as an identity.
 * - `from-header-invalid`: the From header is missing, malformed, uses
 *   group syntax, or fails address validation.
 * - `from-domain-mismatch`: the parsed From address's domain is not the
 *   expected domain.
 * - `sender-mismatch`: `options.sender` was given and the parsed From
 *   address is a different address.
 */
export type TrustReason =
  | "trusted"
  | "auth-missing"
  | "auth-suspicious"
  | "dmarc-temperror"
  | "auth-unknown"
  | "dmarc-domain-mismatch"
  | "from-header-multiple-addresses"
  | "from-header-invalid"
  | "from-domain-mismatch"
  | "sender-mismatch";

export interface TrustedSenderOptions {
  /**
   * The domain the email must be authenticated as (the RFC 5322 From
   * domain). Matched exactly, case-insensitively: mail from a subdomain
   * of `domain` does not match. Pass the subdomain itself to accept it.
   */
  domain: string;
  /**
   * Optional exact sender to require, as a bare address
   * (`user@example.com`). Compared case-insensitively against the
   * parsed From address. Note that DMARC authenticates the domain, not
   * the local part: the domain owner's infrastructure controls which
   * local parts it signs mail for.
   */
  sender?: string;
}

export interface TrustedSenderResult {
  /** True when the email is authenticated as the expected domain (and sender, if given). */
  trusted: boolean;
  /**
   * True only for transient failures (`dmarc-temperror`). Callers that
   * respond with a 5xx let webhook redelivery retry the same email
   * after DNS recovers. All other untrusted reasons are permanent for
   * this email.
   */
  retryable: boolean;
  /** Machine-readable code for the first check that failed, or `trusted`. */
  reason: TrustReason;
  /** The underlying `validateEmailAuth` result, for logging and diagnostics. */
  auth: ValidateEmailAuthResult;
}

function untrusted(
  reason: TrustReason,
  auth: ValidateEmailAuthResult,
  retryable = false,
): TrustedSenderResult {
  return { trusted: false, retryable, reason, auth };
}

/**
 * Check whether an inbound email is authenticated as an expected domain
 * (and optionally an exact sender address).
 *
 * `trusted` is true only when ALL of the following hold:
 *
 * 1. `validateEmailAuth(event.email.auth)` returns a `legit` verdict.
 * 2. `event.email.auth.dmarcFromDomain` (the domain the server's DMARC
 *    evaluation ran against) equals `options.domain`.
 * 3. The From header strict-parses to exactly one valid address whose
 *    domain equals `options.domain`.
 * 4. When `options.sender` is given, the parsed From address equals it
 *    exactly (case-insensitive).
 *
 * ## Why the extra checks beyond the verdict
 *
 * The verdict alone says an email was authenticated, not which domain
 * it was authenticated as: a fully authenticated email from an
 * attacker-controlled domain is `legit`. Anchoring `dmarcFromDomain`
 * closes that. The strict From parse defends the remaining gaps:
 *
 * - Naively regexing the raw From header is unsafe. A header like
 *   `From: "trusted@example.com" <x@evil.com>` plants an allowlisted
 *   address in the display name while DMARC evaluates (and passes for)
 *   `evil.com`. The strict parser extracts only the real addr-spec and
 *   rejects multi-address and group forms outright.
 * - `normalizeReceivedEmail().sender` is NOT a safe anchor for
 *   authorization: it uses a lenient parser and falls back to the SMTP
 *   envelope sender (`smtp.mail_from`), which the sender fully
 *   controls. The same goes for Reply-To (`replyTarget`). This function
 *   never consults either.
 * - An `unknown` verdict is not one thing: a DMARC temperror is
 *   transient (surfaced as `retryable: true`, respond 5xx and let
 *   webhook redelivery retry), while "no DMARC record" is permanent
 *   for the email and surfaced as non-retryable.
 *
 * Never throws for malformed event content; malformed input yields an
 * untrusted result with a reason. Throws `TypeError` only for invalid
 * `options` (programmer error).
 *
 * @param event - The verified `email.received` webhook event
 * @param options - Expected domain and optional exact sender
 * @returns Trust decision with a stable reason code and the underlying
 *   auth result
 */
export function isTrustedSender(
  event: EmailReceivedEvent,
  options: TrustedSenderOptions,
): TrustedSenderResult {
  const { domain, sender } = normalizeOptions(options);

  // Defensive guard for untyped callers: a missing or malformed auth
  // object must yield an untrusted result, not a TypeError from deep
  // inside validateEmailAuth.
  const auth = event?.email?.auth;
  if (
    auth === null ||
    typeof auth !== "object" ||
    !Array.isArray(auth.dkimSignatures)
  ) {
    return untrusted("auth-missing", {
      verdict: "unknown",
      confidence: "low",
      reasons: ["Missing or malformed email.auth on event"],
    });
  }

  const authResult = validateEmailAuth(auth);

  if (authResult.verdict === "suspicious") {
    return untrusted("auth-suspicious", authResult);
  }
  if (authResult.verdict === "unknown") {
    // Only a DMARC temperror is transient. Every other unknown (no
    // DMARC record, permerror, no auth data) is permanent for this
    // email; marking those retryable would make callers 5xx forever
    // for senders whose domain simply publishes no DMARC record.
    if (auth.dmarc === "temperror") {
      return untrusted("dmarc-temperror", authResult, true);
    }
    return untrusted("auth-unknown", authResult);
  }

  const dmarcFromDomain =
    typeof auth.dmarcFromDomain === "string"
      ? auth.dmarcFromDomain.trim().toLowerCase()
      : "";
  if (dmarcFromDomain === "" || dmarcFromDomain !== domain) {
    return untrusted("dmarc-domain-mismatch", authResult);
  }

  const parsed = parseFromHeader(event.email?.headers?.from);
  if (!parsed.ok) {
    return untrusted(
      parsed.reason === "multiple_addresses"
        ? "from-header-multiple-addresses"
        : "from-header-invalid",
      authResult,
    );
  }

  const fromAddress = parsed.value.address;
  const fromDomain = fromAddress.slice(fromAddress.lastIndexOf("@") + 1);
  if (fromDomain !== domain) {
    return untrusted("from-domain-mismatch", authResult);
  }

  if (sender !== undefined && fromAddress !== sender) {
    return untrusted("sender-mismatch", authResult);
  }

  return {
    trusted: true,
    retryable: false,
    reason: "trusted",
    auth: authResult,
  };
}

function normalizeOptions(options: TrustedSenderOptions): {
  domain: string;
  sender?: string;
} {
  if (typeof options?.domain !== "string") {
    throw new TypeError("options.domain is required");
  }
  const domain = options.domain.trim().toLowerCase();
  if (domain.length === 0) {
    throw new TypeError("options.domain must be a non-empty domain name");
  }
  if (domain.includes("@") || /\s/.test(domain)) {
    throw new TypeError(
      "options.domain must be a bare domain name without @ or whitespace",
    );
  }

  if (options.sender === undefined) {
    return { domain };
  }
  if (typeof options.sender !== "string") {
    throw new TypeError("options.sender must be a string when provided");
  }
  const sender = options.sender.trim().toLowerCase();
  if (!isEmail(sender, SENDER_OPTION_EMAIL_OPTIONS)) {
    throw new TypeError(
      "options.sender must be a single bare email address (user@example.com)",
    );
  }
  return { domain, sender };
}
