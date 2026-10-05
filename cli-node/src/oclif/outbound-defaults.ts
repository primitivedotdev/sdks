// Shared helpers for outbound-send commands. `primitive send` and
// `primitive chat` both need sensible transport defaults so callers
// don't have to look up their own verified domain. `chat` hides
// subject override from normal help, but still derives a subject for
// the underlying email.

import { Errors } from "@oclif/core";
import type {
  Domain,
  ListDomainsResponse,
  PrimitiveApiClient,
  VerifiedDomain,
} from "@primitivedotdev/api-core";
import { listDomains } from "@primitivedotdev/api-core";
import {
  API_ERROR_CODES,
  extractErrorCode,
  extractErrorPayload,
  formatErrorPayload,
  surfaceUnauthorizedHint,
  writeErrorWithHints,
} from "./api-command.js";
import type { ResolvedCliAuth } from "./auth.js";
import { isConnectedChatCredential } from "./scoped-chat.js";

// 200 chars is a generous cap that almost never trips on natural
// first-line subjects (a sentence is typically <120 chars). The
// previous 70-char limit was tight enough that legitimate one-line
// bodies routinely produced ellipsis-truncated subjects in inbox
// listings. Real spam scoring engines don't penalize subjects under
// ~200 chars, so 200 is both more useful and still well under the
// practical wire limit.
const SUBJECT_MAX_LENGTH = 200;

export function deriveSubject(body: string): string {
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    return trimmed.length > SUBJECT_MAX_LENGTH
      ? `${trimmed.slice(0, SUBJECT_MAX_LENGTH - 3)}...`
      : trimmed;
  }
  return "Message";
}

const CHAT_SUBJECT_MAX_LENGTH = 60;

// Titles and abbreviations that introduce what follows (often a
// capitalized name: "Dr. Smith", "e.g. Node") practically never end a
// sentence, so their period never does.
const TITLES = new Set([
  "dr",
  "mr",
  "mrs",
  "ms",
  "prof",
  "sr",
  "jr",
  "st",
  "vs",
  "e.g",
  "i.e",
  "approx",
  "fig",
]);
// These also end sentences ("No. Cancel it.", "pens, etc. Then"), so their
// period is skipped only when the text continues in lowercase or a digit.
const ABBREVIATIONS = new Set(["etc", "inc", "ltd", "co", "no"]);

/**
 * The line up to its first sentence end: `.`, `?` or `!` followed by
 * whitespace or the line end. A period after a title-like abbreviation or
 * a single letter (an initial) does not end the sentence, nor does one
 * after another abbreviation when the text continues in lowercase or a
 * digit.
 */
function firstSentence(line: string): string {
  const end = /[.?!](?=\s|$)/g;
  for (let match = end.exec(line); match; match = end.exec(line)) {
    if (match[0] === ".") {
      const word = /(\S+)$/.exec(line.slice(0, match.index))?.[1] ?? "";
      const bare = word.replace(/^[("'[]+/, "").toLowerCase();
      if (TITLES.has(bare) || /^[a-z]$/.test(bare)) continue;
      const next = /^\s+(\S)/.exec(line.slice(match.index + 1))?.[1] ?? "";
      if (ABBREVIATIONS.has(bare) && /[a-z0-9]/.test(next)) continue;
    }
    return line.slice(0, match.index + 1);
  }
  return line;
}

/**
 * A short subject for a chat message, whose body is usually one long line
 * or a short paragraph: the first sentence of the first non-empty line,
 * cut at a word boundary to at most CHAT_SUBJECT_MAX_LENGTH characters.
 * The body is sent unchanged; replies thread on headers, not the subject.
 */
export function deriveChatSubject(body: string): string {
  const line = deriveSubject(body);
  const sentence = firstSentence(line);
  if (sentence.length <= CHAT_SUBJECT_MAX_LENGTH) return sentence;
  const room = sentence.slice(0, CHAT_SUBJECT_MAX_LENGTH - 3);
  const space = room.lastIndexOf(" ");
  const cut = (
    space >= CHAT_SUBJECT_MAX_LENGTH / 2 ? room.slice(0, space) : room
  ).replace(/[\s,;:.!?-]+$/, "");
  return `${cut}...`;
}

function isVerifiedDomain(domain: Domain): domain is VerifiedDomain {
  return (domain as VerifiedDomain).is_active === true;
}

export type AuthFailureContext = {
  auth: ResolvedCliAuth;
  baseUrlOverridden: boolean;
  configDir: string;
};

// Pick a sensible default --from address when the caller didn't pass
// one. Local-part is "agent" because any local-part is accepted on
// managed *.primitive.email subdomains and the auto-issued domain
// pool routes back to the sending account. Customers with BYO
// domains and their own MX should pass --from explicitly.
//
// If the underlying listDomains call fails on auth, we surface the
// auth hint and bail rather than wrapping it as a generic "couldn't
// resolve --from" error: the actual send would 401 with the same
// hint anyway, and rewriting the message obscures the real fix.
export async function pickDefaultFromAddress(
  apiClient: PrimitiveApiClient,
  authFailureContext: AuthFailureContext,
): Promise<string> {
  if (authFailureContext.auth.connectedAgent) {
    return authFailureContext.auth.connectedAgent.agentAddress;
  }
  if (isConnectedChatCredential(authFailureContext.auth.apiKey)) {
    throw new Errors.CLIError(
      "Connected agents must pass --from with their connected email address.",
      { exit: 1 },
    );
  }
  const result = await listDomains({
    client: apiClient.client,
    responseStyle: "fields",
  });
  if (result.error) {
    const errorPayload = extractErrorPayload(result.error);
    if (extractErrorCode(errorPayload) === API_ERROR_CODES.unauthorized) {
      writeErrorWithHints(errorPayload);
      surfaceUnauthorizedHint({
        ...authFailureContext,
        payload: errorPayload,
      });
      // exit: 1 to match the unauthorized path elsewhere; oclif's
      // CLIError defaults to 2 otherwise, which breaks callers that
      // branch on exit code.
      throw new Errors.CLIError(
        "Cannot send: CLI auth is missing or invalid (see hint above).",
        { exit: 1 },
      );
    }
    throw new Errors.CLIError(
      `Could not look up your verified domains to default --from. Pass --from explicitly. Underlying error: ${formatErrorPayload(errorPayload)}`,
    );
  }
  const envelope = result.data as ListDomainsResponse | undefined;
  const first = envelope?.data?.find(isVerifiedDomain);
  if (!first) {
    throw new Errors.CLIError(
      "No active verified outbound domain found on this account; pass --from explicitly. To set up outbound, claim a domain via `primitive domains add` and verify it.",
    );
  }
  return `agent@${first.domain}`;
}
