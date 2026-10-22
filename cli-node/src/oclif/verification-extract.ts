import { htmlToText } from "./email-compact.js";

/**
 * Pulls the one-time code or the sign-in link out of a verification email.
 * Pure: it reads the subject and bodies it is given and nothing else.
 *
 * Both extractors score every candidate and return the best one only when
 * it has real evidence (a keyword such as "code" or "verify" near it), so an
 * email without a code or link yields null rather than a guess.
 */

export type VerificationEmail = {
  subject?: string | null;
  text?: string | null;
  html?: string | null;
};

// ---------------------------------------------------------------------------
// Codes
// ---------------------------------------------------------------------------

const CODE_KEYWORD =
  /\b(?:verification|verify|verifying|one[- ]?time|otp|passcode|pass code|security code|login code|log[- ]?in code|sign[- ]?in code|access code|auth(?:entication)? code|confirmation code|confirm|code|pin|2fa|two[- ]factor|launch code)\b/i;

// Words that mark a nearby number as something other than a code.
const NOT_A_CODE =
  /\b(?:order|invoice|receipt|total|subtotal|amount|price|paid|charged|phone|tel|call|fax|mobile|ref|reference|ticket|case|account|acct|customer|member|zip|postal|suite|ste|po box|tracking|transaction|txn|item|sku|qty|quantity|street|st|ave|avenue|blvd|road|rd|floor)\b|[#$€£¥]/i;

// "zip code", "promo code" and the like name a code that is not the one the
// email is sending. They are masked as negative context before scoring.
const NON_CODE_PHRASES =
  /\b(?:zip|postal|post|area|promo(?:tional)?|discount|coupon|country|dial(?:ing)?|tracking|sort|bank|swift|product|source|referral|gift)\s+codes?\b/gi;

function lastMatchIndex(regex: RegExp, text: string): number {
  const global = new RegExp(regex.source, "gi");
  let last = -1;
  for (const match of text.matchAll(global)) last = match.index ?? last;
  return last;
}

// "3600 seconds", "10 minutes": a lifetime, never the code.
const DURATION_AFTER =
  /^\s?(?:s|secs?|seconds?|mins?|minutes?|h|hrs?|hours?|days?)\b/i;
const DURATION_GLOBAL =
  /\b\d+\s?(?:s|secs?|seconds?|mins?|minutes?|h|hrs?|hours?|days?)\b/gi;

const CURRENCY_AFTER = /^\s?(?:usd|eur|gbp|cad|aud|dollars|euros)\b/i;

// Phone numbers: optional country code, area code (with or without
// parentheses), then 3 and 4 digit groups.
const PHONE =
  /(?:\+?\d{1,3}[\s.-])?(?:\(\d{2,4}\)\s?|\d{3}[\s.-])\d{3}[\s.-]\d{4}\b/g;
const URL_IN_TEXT = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const EMAIL_ADDRESS = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

type CodeForm =
  | "digits"
  | "split-digits"
  | "spaced-digits"
  | "alnum"
  | "dashed";

type CodePattern = { form: CodeForm; regex: RegExp };

// Order matters only for overlap: a longer candidate covering a shorter one
// wins (see dropContained).
const CODE_PATTERNS: CodePattern[] = [
  // One digit per table cell, as HTML emails often render it: "9 0 5 3 1 7".
  { form: "spaced-digits", regex: /(?<![\w])\d(?: \d){3,7}(?![\w]| \d)/g },
  // "123 456", "123-456", "1234 5678".
  {
    form: "split-digits",
    regex:
      /(?<![\w$€£¥#@/]|\d[.,]|\d[ -])\d{3,4}[ -]\d{3,4}(?![\w%]|[.,]\d|[ -]\d)/g,
  },
  {
    form: "digits",
    regex: /(?<![\w$€£¥#@/]|\d[.,]|\d-)\d{4,8}(?![\w%]|[.,]\d|-\d)/g,
  },
  // Uppercase letters and digits with at least one of each: "7KQ2XP".
  {
    form: "alnum",
    regex:
      /(?<![\w#@/.-])(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{5,10}(?![\w/-])/g,
  },
  // Dashed groups: "XKP-4QZ", "ABCD-EFGH".
  {
    form: "dashed",
    regex: /(?<![\w#@/.-])[A-Z0-9]{3,4}-[A-Z0-9]{3,4}(?![\w/]|-[A-Z0-9])/g,
  },
];

type CodeCandidate = {
  value: string;
  raw: string;
  form: CodeForm;
  line: number;
  start: number;
  end: number;
  score: number;
};

function blank(match: string): string {
  return match.replace(/[^\n]/g, " ");
}

/** Normalised lines the code scan reads: subject first, then the body. */
function codeLines(subject: string | null | undefined, body: string): string[] {
  const combined = `${subject ?? ""}\n\n${body}`
    .replace(/\r\n?/g, "\n")
    .replace(NON_CODE_PHRASES, (match) => "#".repeat(match.length))
    .replace(/[   \t]/g, " ")
    // Links and addresses carry digits that are never the code.
    .replace(URL_IN_TEXT, blank)
    .replace(EMAIL_ADDRESS, blank)
    .replace(PHONE, blank);
  return combined.split("\n");
}

function previousContent(lines: string[], index: number, count: number) {
  const out: string[] = [];
  for (let i = index - 1; i >= 0 && out.length < count; i--) {
    if (lines[i].trim() !== "") out.push(lines[i]);
  }
  return out;
}

// A label on the line below a code that ends its line: "482913" then
// "is your verification code". The next line has to name a code itself;
// "For verification, contact support." does not.
const NEXT_LINE_LABEL =
  /^\s*(?:is|was|[-:=(])?\s*(?:your|the|this)?\b.{0,30}?\b(?:code|passcode|otp|pin)\b/i;

/** The next line labels the code above it and supplies no code of its own. */
function isLabelBelow(line: string | null): boolean {
  return (
    line !== null &&
    NEXT_LINE_LABEL.test(line) &&
    !/\d{4,}|\b(?=[A-Z0-9-]*\d)[A-Z0-9][A-Z0-9-]{3,}\b/.test(
      line.replace(DURATION_GLOBAL, " "),
    )
  );
}

function nextContent(lines: string[], index: number): string | null {
  for (let i = index + 1; i < lines.length; i++)
    if (lines[i].trim() !== "") return lines[i];
  return null;
}

function scoreCode(
  candidate: Omit<CodeCandidate, "score">,
  lines: string[],
  mentionsCode: boolean,
): number | null {
  const line = lines[candidate.line];
  const before = line.slice(0, candidate.start);
  const near30 = before.slice(-30);
  const after = line.slice(candidate.end);
  const near = before.slice(-40);
  let score = 0;

  // A code keyword on the same line or the two lines above is required; the
  // other signals only rank candidates that have it.
  if (CODE_KEYWORD.test(near)) score += 12;
  else if (CODE_KEYWORD.test(before)) score += 8;
  else if (CODE_KEYWORD.test(after.slice(0, 40))) score += 10;
  else if (
    previousContent(lines, candidate.line, 2).some((l) => CODE_KEYWORD.test(l))
  )
    score += 7;
  else if (
    after.trim() === "" &&
    isLabelBelow(nextContent(lines, candidate.line))
  )
    score += 7;
  else return null;
  if (mentionsCode) score += 2;

  if (line.trim() === candidate.raw) score += 4;

  const digits = candidate.value.replace(/\D/g, "").length;
  if (candidate.form === "digits" || candidate.form === "split-digits")
    score += digits === 6 ? 3 : 1;
  else if (candidate.form === "spaced-digits") score += digits === 6 ? 2 : 0;
  else if (candidate.form === "alnum") score += 1;

  // Negative context counts when it is closer to the number than any code
  // keyword: "account verification code 123456" is a code, "code sent to
  // account 123456" is not.
  const negative = lastMatchIndex(NOT_A_CODE, near30);
  if (negative >= 0 && negative > lastMatchIndex(CODE_KEYWORD, near30))
    score -= 15;
  if (CURRENCY_AFTER.test(after)) score -= 15;
  if (DURATION_AFTER.test(after)) score -= 15;
  if (candidate.form === "digits" && /^(?:19|20)\d\d$/.test(candidate.value))
    score -= 6;
  // Letter-only dashed groups ("ABC-DEF") count only right after a keyword.
  if (candidate.form === "dashed" && !/\d/.test(candidate.value) && score < 12)
    score -= 10;
  return score;
}

function dropContained(candidates: CodeCandidate[]): CodeCandidate[] {
  return candidates.filter(
    (c) =>
      !candidates.some(
        (other) =>
          other !== c &&
          other.line === c.line &&
          other.start <= c.start &&
          other.end >= c.end &&
          other.end - other.start > c.end - c.start,
      ),
  );
}

/** Below this, a candidate has no keyword evidence and is not reported. */
const MIN_CODE_SCORE = 8;

/**
 * The verification or one-time code in an email, with spaces and dashes
 * between digit groups removed ("123 456" -> "123456") and a dashed
 * letter-and-digit code kept as written ("4K7-P2Q"), or null when none is
 * found.
 */
export function extractVerificationCode(
  email: VerificationEmail,
): string | null {
  // The text part first; the HTML part when the text has no code (a text
  // part that only says "view this email in HTML").
  const fromText = email.text?.trim()
    ? codeInBody(email.subject, email.text)
    : null;
  if (fromText !== null) return fromText;
  return codeInBody(
    email.subject,
    email.html?.trim() ? htmlToText(email.html) : "",
  );
}

function codeInBody(
  subject: string | null | undefined,
  body: string,
): string | null {
  const lines = codeLines(subject, body);
  const mentionsCode = lines.some((line) => CODE_KEYWORD.test(line));
  const found: CodeCandidate[] = [];
  lines.forEach((line, index) => {
    for (const { form, regex } of CODE_PATTERNS) {
      for (const match of line.matchAll(regex)) {
        const start = match.index ?? 0;
        const raw = match[0];
        // A dashed letter-and-digit code ("4K7-P2Q") is printed as written,
        // since the dash can be part of it; digit groups are joined.
        const joined = raw.replace(/[ -]/g, "");
        const value = form === "dashed" ? raw : joined;
        if (joined.length < 4 || joined.length > 10) continue;
        found.push({
          value,
          raw,
          form,
          line: index,
          start,
          end: start + raw.length,
          score: 0,
        });
      }
    }
  });
  let best: CodeCandidate | null = null;
  for (const candidate of dropContained(found)) {
    const score = scoreCode(candidate, lines, mentionsCode);
    if (score === null) continue;
    candidate.score = score;
    if (
      candidate.score >= MIN_CODE_SCORE &&
      (best === null || candidate.score > best.score)
    )
      best = candidate;
  }
  return best?.value ?? null;
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

type LinkCandidate = { url: string; label: string };

const ANCHOR =
  /<a\b[^>]*?\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))[^>]*>([\s\S]*?)<\/a\s*>/gi;

const HREF_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&#38;": "&",
  "&#x26;": "&",
  "&quot;": '"',
  "&#34;": '"',
  "&#x22;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&#x27;": "'",
};

/** Decode the entities an href carries, in one pass so none is decoded twice. */
function decodeHref(value: string): string {
  return value
    .trim()
    .replace(
      /&(?:amp|quot|apos|#0*(?:38|34|39)|#x0*(?:26|22|27));/gi,
      (match) => {
        const key = match.toLowerCase().replace(/^&#(x?)0+/, "&#$1");
        return HREF_ENTITIES[key] ?? match;
      },
    );
}

function anchorLabel(html: string): string {
  return htmlToText(html).replace(/\s+/g, " ").trim();
}

function trimUrl(url: string): string {
  return url.replace(/[).,;:!?'"\]>]+$/, "");
}

function linkCandidates(email: VerificationEmail): LinkCandidate[] {
  const out: LinkCandidate[] = [];
  if (email.html?.trim()) {
    for (const match of email.html.matchAll(ANCHOR)) {
      const href = decodeHref(match[1] ?? match[2] ?? match[3] ?? "");
      out.push({ url: href, label: anchorLabel(match[4] ?? "") });
    }
  }
  if (email.text?.trim()) {
    const lines = email.text.replace(/\r\n?/g, "\n").split("\n");
    lines.forEach((line, index) => {
      for (const match of line.matchAll(/\bhttps?:\/\/[^\s<>"']+/gi)) {
        const url = trimUrl(match[0]);
        // A bare link's label is the sentence around it, or the line above
        // ("Click the link below to verify your email:").
        const label = [
          line.replace(match[0], " "),
          ...previousContent(lines, index, 1),
        ]
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        out.push({ url, label });
      }
    });
  }
  return out;
}

// Query keys a click-tracking redirect uses to carry its destination. OAuth
// and app parameters (redirect_uri, next, continue, return_to) are left alone:
// they are part of the link, not a wrapper around it.
const TRACKING_KEYS = [
  "url",
  "u",
  "q",
  "target",
  "redirect",
  "redirect_url",
  "dest",
  "destination",
  "link",
  "r",
];
const TRACKING_HOST =
  /(?:^|\.)(?:click|clicks|track|tracking|trk|links?|email|e|ct|t)\.|safelinks\.protection\.outlook\.com$|urldefense\.|sendgrid\.net$|mailgun\.|mandrillapp\.com$|list-manage\.com$|hubspotlinks\.com$|awstrack\.me$|mjt\.lu$|^(?:www\.)?google\.com$/i;
// A redirect endpoint: the path is, or ends in, a short click segment
// ("/c", "/ls/click", "/notifications/email/click").
const TRACKING_PATH =
  /(?:^|\/)(?:c|cl|l|r|t|click|clicks|track|redirect|url)\/?$/i;

/**
 * The destination of an obvious click-tracking redirect whose target is
 * embedded whole as a query parameter; otherwise the URL unchanged.
 */
export function unwrapTrackingRedirect(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (
    !TRACKING_HOST.test(parsed.hostname) &&
    !TRACKING_PATH.test(parsed.pathname)
  )
    return url;
  for (const key of TRACKING_KEYS) {
    const value = parsed.searchParams.get(key);
    if (value && /^https?:\/\/[^\s]+$/i.test(value)) {
      try {
        new URL(value);
        return value;
      } catch {
        return url;
      }
    }
  }
  return url;
}

const SKIP_TOKENS = new Set([
  "unsubscribe",
  "unsub",
  "optout",
  "preferences",
  "privacy",
  "terms",
  "legal",
  "help",
  "support",
  "faq",
  "feedback",
  "policy",
  "cookies",
  "abuse",
]);
const SKIP_LABEL =
  /\b(?:opt[- ]out|manage (?:your )?(?:preferences|notifications|subscriptions|email settings)|view (?:this (?:email|message) )?(?:in (?:your |a )?browser|online)|web version|contact us|report (?:this|abuse))\b/i;
const SOCIAL_HOST =
  /(?:^|\.)(?:twitter\.com|x\.com|facebook\.com|fb\.com|instagram\.com|linkedin\.com|youtube\.com|youtu\.be|tiktok\.com|pinterest\.com|threads\.net|discord\.gg|apps\.apple\.com|play\.google\.com)$/i;
const IMAGE_PATH = /\.(?:png|gif|jpe?g|svg|webp|ico)$/i;

const LABEL_POSITIVE =
  /\b(?:verify|verification|confirm|confirmation|sign[- ]?in|sign me in|log[- ]?in|magic|activate|activation|reset|validate|authenticate|authorize|accept (?:the )?invit\w*|join|get started|continue)\b/i;
const NEGATED_LABEL =
  /\b(?:did ?n[o']t|didn't|not you|wasn't you|was not you|ignore)\b/i;
const URL_POSITIVE =
  /(?:verify|verification|confirm|signin|sign-in|sign_in|login|log-in|log_in|magic|activate|activation|reset|validate|auth|callback|invite|accept)/i;

function urlTokens(parsed: URL): string[] {
  return `${parsed.hostname} ${parsed.pathname}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function scoreLink(candidate: LinkCandidate): number | null {
  const url = unwrapTrackingRedirect(candidate.url);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (SOCIAL_HOST.test(parsed.hostname)) return null;
  if (IMAGE_PATH.test(parsed.pathname)) return null;
  const labelTokens = candidate.label.toLowerCase().split(/[^a-z0-9]+/);
  if (
    urlTokens(parsed).some((t) => SKIP_TOKENS.has(t)) ||
    labelTokens.some((t) => SKIP_TOKENS.has(t)) ||
    SKIP_LABEL.test(candidate.label)
  )
    return null;

  let score = 0;
  if (LABEL_POSITIVE.test(candidate.label)) score += 6;
  // "If you did not try to sign in, visit ..." points away from the flow.
  if (NEGATED_LABEL.test(candidate.label)) score -= 4;
  if (URL_POSITIVE.test(`${parsed.pathname}${parsed.search}`)) score += 4;
  else if (URL_POSITIVE.test(parsed.hostname)) score += 2;
  // A long opaque token is what a one-time link carries.
  if (/[?&/=][A-Za-z0-9_-]{24,}/.test(`${parsed.pathname}${parsed.search}`))
    score += 1;
  if (parsed.protocol === "http:") score -= 1;
  return score;
}

/**
 * The most likely verification, sign-in, confirm or magic link in an email,
 * with an obvious click-tracking wrapper removed, or null when no link has
 * evidence of being one.
 */
export function extractVerificationLink(
  email: VerificationEmail,
): string | null {
  let best: { url: string; score: number } | null = null;
  for (const candidate of linkCandidates(email)) {
    const score = scoreLink(candidate);
    if (score === null || score < 4) continue;
    if (best === null || score > best.score)
      best = { url: unwrapTrackingRedirect(candidate.url), score };
  }
  return best?.url ?? null;
}
