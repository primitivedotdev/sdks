/**
 * Decide whether an inbound email was sent by a machine rather than a
 * person, and say why.
 *
 * Three places answer this question and must agree:
 *
 *   - the Primitive API, which decides `automated` and
 *     `automated_reasons` when an email arrives with these same rules.
 *     `primitive inbox next` filters on that verdict server-side and
 *     uses this module only to explain it (AUTOMATED_REASON_DESCRIPTIONS);
 *     the rule fixture in test-fixtures/automated-mail/cases.json is run
 *     against this module and against the API's rules;
 *   - the `isLoop` helper that `primitive functions init` scaffolds into
 *     every new Function handler (see function-templates.ts).
 *
 * The scaffolded handler is the user's own code and cannot import the
 * CLI, so it carries a rendered copy of the loop rules. This module is
 * the single definition of those rules; the functions-init tests run
 * the rendered handler against the same cases as this module so the two
 * cannot drift apart.
 *
 * Loop rules (shared with the scaffolded handler):
 *   - null_envelope_sender: RFC 5321 bounces use MAIL FROM:<>. Replying
 *     to a null sender is forbidden and would itself bounce.
 *   - no_identifiable_sender: neither the envelope nor the From header
 *     carries an address. Treated as automated rather than guessed at.
 *   - own_address: From is exactly one of the addresses the mail was
 *     delivered to (or an explicitly listed self address), so answering
 *     it would talk to ourselves. Sharing a domain is not enough: a
 *     colleague or another agent on the same domain is a person here.
 *   - mailer_daemon: From is mailer-daemon@ or postmaster@. The handler
 *     only applies this to the inbound domain (a backup for bounces
 *     with a non-empty envelope); the API applies it to any domain
 *     because a remote MTA's bounce is not a person either.
 *
 * Declared automation, from the headers the API returns in
 * `automation_headers` (absent on mail received before the API
 * captured them):
 *   - auto_submitted: RFC 3834 Auto-Submitted with any value but "no".
 *   - precedence: Precedence bulk, list, junk or auto_reply.
 *   - list_unsubscribe / list_id: mailing-list or newsletter mail.
 *
 * This is loop and noise protection, NOT sender authentication. A
 * false positive only means one email is skipped by default.
 */

export type AutomatedReason =
  | "null_envelope_sender"
  | "no_identifiable_sender"
  | "own_address"
  | "mailer_daemon"
  | "auto_submitted"
  | "precedence"
  | "list_unsubscribe"
  | "list_id";

export type AutomatedVerdict = {
  automated: boolean;
  reasons: AutomatedReason[];
  /**
   * Whether the message's automation headers were available. When false
   * (none declared, or received before the API captured them) a
   * newsletter or auto-reply with an ordinary sender cannot be told
   * apart from a person, so `automated: false` is weaker evidence.
   */
  automation_headers_known: boolean;
};

export type AutomationHeaders = {
  auto_submitted?: string | null;
  list_id?: string | null;
  list_unsubscribe?: string | null;
  precedence?: string | null;
};

export type AutomatedMailInput = {
  /** SMTP envelope sender (MAIL FROM / return-path). */
  envelopeSender: string | null | undefined;
  /** From header value, or the parsed bare From address. */
  fromHeaders: Array<string | null | undefined>;
  /** Addresses the mail was delivered to: RCPT TO and the To header. */
  inboundAddresses: Array<string | null | undefined>;
  /** Extra addresses that count as our own. */
  extraSelfAddresses?: string[];
  /**
   * Which domains a mailer-daemon/postmaster sender must come from to
   * count. "inbound" matches the scaffolded handler; "any" is what the
   * API uses.
   */
  daemonScope?: "any" | "inbound";
  automationHeaders?: AutomationHeaders | null;
};

const ADDRESS_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export function extractEmailAddresses(
  value: string | null | undefined,
): string[] {
  return (
    value?.match(ADDRESS_PATTERN)?.map((address) => address.toLowerCase()) ?? []
  );
}

export function domainPart(address: string): string | null {
  const at = address.lastIndexOf("@");
  return at === -1 ? null : address.slice(at + 1).toLowerCase();
}

export function localPart(address: string): string {
  const at = address.lastIndexOf("@");
  return at === -1 ? address.toLowerCase() : address.slice(0, at).toLowerCase();
}

const DAEMON_LOCAL_PARTS = new Set(["mailer-daemon", "postmaster"]);
const AUTOMATED_PRECEDENCE = new Set(["bulk", "list", "junk", "auto_reply"]);

/** The loop rules only: what the scaffolded handler's isLoop checks. */
export function loopReasons(input: AutomatedMailInput): AutomatedReason[] {
  const reasons: AutomatedReason[] = [];
  const envelopeSender = (input.envelopeSender ?? "").trim();
  if (envelopeSender === "" || envelopeSender === "<>") {
    reasons.push("null_envelope_sender");
  }

  const fromAddresses = [
    ...input.fromHeaders.flatMap(extractEmailAddresses),
    ...extractEmailAddresses(input.envelopeSender),
  ];
  if (fromAddresses.length === 0) {
    reasons.push("no_identifiable_sender");
    return reasons;
  }

  const inboundAddresses = new Set(
    input.inboundAddresses.flatMap(extractEmailAddresses),
  );
  const inboundDomains = new Set(
    [...inboundAddresses]
      .map(domainPart)
      .filter((domain): domain is string => domain !== null),
  );
  const extraSelfAddresses = new Set(
    (input.extraSelfAddresses ?? []).map((address) => address.toLowerCase()),
  );
  const daemonScope = input.daemonScope ?? "any";

  for (const from of fromAddresses) {
    if (
      (inboundAddresses.has(from) || extraSelfAddresses.has(from)) &&
      !reasons.includes("own_address")
    ) {
      reasons.push("own_address");
    }
    const fromDomain = domainPart(from);
    const daemonDomainMatches =
      daemonScope === "any" ||
      (fromDomain !== null && inboundDomains.has(fromDomain));
    if (
      DAEMON_LOCAL_PARTS.has(localPart(from)) &&
      daemonDomainMatches &&
      !reasons.includes("mailer_daemon")
    ) {
      reasons.push("mailer_daemon");
    }
  }
  return reasons;
}

function headerValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Reasons declared by the message's own automation headers. */
export function declaredAutomationReasons(
  headers: AutomationHeaders | null | undefined,
): AutomatedReason[] {
  if (!headers || typeof headers !== "object") return [];
  const reasons: AutomatedReason[] = [];
  const autoSubmitted = headerValue(headers.auto_submitted);
  if (autoSubmitted) {
    // RFC 3834: the value is a keyword, optionally followed by
    // parameters. Only "no" means a person sent it.
    const keyword = autoSubmitted.split(";")[0]?.trim().toLowerCase();
    if (keyword && keyword !== "no") reasons.push("auto_submitted");
  }
  const precedence = headerValue(headers.precedence);
  if (precedence && AUTOMATED_PRECEDENCE.has(precedence.toLowerCase())) {
    reasons.push("precedence");
  }
  if (headerValue(headers.list_unsubscribe)) reasons.push("list_unsubscribe");
  if (headerValue(headers.list_id)) reasons.push("list_id");
  return reasons;
}

export function classifyAutomatedMail(
  input: AutomatedMailInput,
): AutomatedVerdict {
  const reasons = [
    ...loopReasons(input),
    ...declaredAutomationReasons(input.automationHeaders),
  ];
  const headers = input.automationHeaders;
  return {
    automated: reasons.length > 0,
    reasons,
    automation_headers_known: headers !== null && typeof headers === "object",
  };
}

export const AUTOMATED_REASON_DESCRIPTIONS: Record<AutomatedReason, string> = {
  null_envelope_sender: "null envelope sender (a bounce)",
  no_identifiable_sender: "no sender address in the envelope or From header",
  own_address: "sent from the very address it was delivered to",
  mailer_daemon: "sent by mailer-daemon or postmaster",
  auto_submitted: "Auto-Submitted header marks it as machine-sent",
  precedence: "Precedence header is bulk, list, junk or auto_reply",
  list_unsubscribe: "List-Unsubscribe header (mailing list or newsletter)",
  list_id: "List-Id header (mailing list)",
};
