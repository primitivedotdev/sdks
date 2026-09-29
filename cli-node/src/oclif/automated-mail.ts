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
 *     to a null sender is forbidden and would itself bounce. The API
 *     reads the envelope as smtp_mail_from ?? sender, so a stored empty
 *     MAIL FROM is the null sender even when sender holds an address.
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
 * Declared automation, from the stored `automation_headers` (absent on
 * mail received before the API captured them). RFC 5322 comments are
 * removed before a value is read, the way control-plane-core's
 * classifyAutomatedMail reads them:
 *   - auto_submitted: RFC 3834 Auto-Submitted with any keyword but
 *     "no", an empty one included; a quoted "no" is still no.
 *   - precedence: Precedence containing the word bulk, list, junk or
 *     auto_reply ("bulk (newsletter)" and "list-mail" count).
 *   - list_unsubscribe / list_id: mailing-list or newsletter mail.
 *   - auto_response_suppress: X-Auto-Response-Suppress asks for no
 *     automatic reply (All, OOF or AutoReply).
 *   - failed_recipients: X-Failed-Recipients present, even empty.
 *   - report: a delivery, feedback or disposition report, by the
 *     top-level Content-Type or by an email_kind other than regular.
 *
 * The API's public email payload does not return every one of these
 * inputs (see the CLI docs), which is why `inbox next` explains the
 * server's verdict rather than recomputing it.
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
  | "list_id"
  | "auto_response_suppress"
  | "failed_recipients"
  | "report";

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
  x_auto_response_suppress?: string | null;
  x_failed_recipients?: string | null;
  /** Top-level Content-Type, recorded by ingest only for reports. */
  content_type?: string | null;
};

export type AutomatedMailInput = {
  /**
   * SMTP envelope sender (MAIL FROM / return-path): null, empty or "<>"
   * is the null sender.
   */
  envelopeSender: string | null | undefined;
  /**
   * Where envelope addresses are read from when it differs from
   * `envelopeSender`: the API reads the null sender from
   * smtp_mail_from ?? sender but the sender addresses from the first
   * non-empty of the two. Defaults to `envelopeSender`.
   */
  envelopeAddress?: string | null;
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
  /** The stored inbound classification; absent or "regular" is a person. */
  emailKind?: string | null;
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
// JavaScript's ASCII \b spelled out, as the API's SQL rules spell it.
const AUTOMATED_PRECEDENCE =
  /(^|[^a-z0-9_])(bulk|list|junk|auto_reply)([^a-z0-9_]|$)/;
const SUPPRESS_REPLY = /(^|[^a-z0-9_])(all|oof|autoreply)([^a-z0-9_]|$)/;
const REPORT_MEDIA_TYPES = new Set([
  "multipart/report",
  "message/delivery-status",
  "message/feedback-report",
  "message/disposition-notification",
]);

/** The loop rules only: what the scaffolded handler's isLoop checks. */
export function loopReasons(input: AutomatedMailInput): AutomatedReason[] {
  const reasons: AutomatedReason[] = [];
  const envelopeSender = (input.envelopeSender ?? "").trim();
  if (envelopeSender === "" || envelopeSender === "<>") {
    reasons.push("null_envelope_sender");
  }

  const fromAddresses = [
    ...input.fromHeaders.flatMap(extractEmailAddresses),
    ...extractEmailAddresses(
      input.envelopeAddress !== undefined
        ? input.envelopeAddress
        : input.envelopeSender,
    ),
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

/** Remove RFC 5322 `(...)` comments, nested ones included. */
export function stripHeaderComments(value: string): string {
  let current = value;
  for (let previous = ""; previous !== current; ) {
    previous = current;
    current = current.replace(/\([^()]*\)/g, " ");
  }
  return current;
}

/**
 * The Auto-Submitted keyword: comments removed first, so a ";" inside
 * one cannot split the value, then the token before any ";", trimmed,
 * unquoted and lowercased.
 */
export function autoSubmittedKeyword(value: string): string {
  let keyword = (stripHeaderComments(value).split(";")[0] ?? "").trim();
  if (keyword.length >= 2 && keyword.startsWith('"') && keyword.endsWith('"')) {
    keyword = keyword.slice(1, -1).trim();
  }
  return keyword.toLowerCase();
}

function isReportKind(emailKind: string | null | undefined): boolean {
  if (typeof emailKind !== "string") return false;
  const kind = emailKind.trim().toLowerCase();
  return kind !== "" && kind !== "regular";
}

/**
 * Reasons declared by the message itself: its automation headers and,
 * for `report`, the kind the inbound classifier filed it as.
 */
export function declaredAutomationReasons(
  headers: AutomationHeaders | null | undefined,
  emailKind?: string | null,
): AutomatedReason[] {
  const reasons: AutomatedReason[] = [];
  const h: AutomationHeaders =
    headers && typeof headers === "object" ? headers : {};
  // RFC 3834: any keyword but "no", including none at all.
  if (
    typeof h.auto_submitted === "string" &&
    autoSubmittedKeyword(h.auto_submitted) !== "no"
  ) {
    reasons.push("auto_submitted");
  }
  if (
    typeof h.precedence === "string" &&
    AUTOMATED_PRECEDENCE.test(stripHeaderComments(h.precedence).toLowerCase())
  ) {
    reasons.push("precedence");
  }
  if (headerValue(h.list_unsubscribe)) reasons.push("list_unsubscribe");
  if (headerValue(h.list_id)) reasons.push("list_id");
  if (
    typeof h.x_auto_response_suppress === "string" &&
    SUPPRESS_REPLY.test(h.x_auto_response_suppress.toLowerCase())
  ) {
    reasons.push("auto_response_suppress");
  }
  // Present at all, even empty: only an MTA reporting a failure writes it.
  if (typeof h.x_failed_recipients === "string") {
    reasons.push("failed_recipients");
  }
  const mediaType =
    typeof h.content_type === "string"
      ? (stripHeaderComments(h.content_type).split(";")[0] ?? "")
          .trim()
          .toLowerCase()
      : "";
  if (REPORT_MEDIA_TYPES.has(mediaType) || isReportKind(emailKind)) {
    reasons.push("report");
  }
  return reasons;
}

export function classifyAutomatedMail(
  input: AutomatedMailInput,
): AutomatedVerdict {
  const reasons = [
    ...loopReasons(input),
    ...declaredAutomationReasons(input.automationHeaders, input.emailKind),
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
  precedence: "Precedence header says bulk, list, junk or auto_reply",
  list_unsubscribe: "List-Unsubscribe header (mailing list or newsletter)",
  list_id: "List-Id header (mailing list)",
  auto_response_suppress:
    "X-Auto-Response-Suppress header asks for no automatic reply",
  failed_recipients: "X-Failed-Recipients header (a bounce)",
  report: "a delivery, feedback or disposition report",
};
