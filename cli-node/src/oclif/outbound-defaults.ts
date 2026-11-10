// Shared helpers for outbound-send commands. `primitive send` and
// `primitive chat` both need transport defaults: the From a credential
// sends as when --from is left out (resolveDefaultFrom), and a subject.
// `chat` hides subject override from normal help, but still derives a
// subject for the underlying email.

import { Errors } from "@oclif/core";
import type { PrimitiveApiClient } from "@primitivedotdev/api-core";
import {
  checkSendability,
  getOutboundStatus,
  getOwnGrant,
  whoami,
} from "@primitivedotdev/api-core";
import { parseFromHeader } from "@primitivedotdev/sdk/parser/address";
import {
  API_ERROR_CODES,
  extractErrorCode,
  extractErrorPayload,
  formatErrorPayload,
  surfaceUnauthorizedHint,
  writeErrorWithHints,
} from "./api-command.js";
import type { ResolvedCliAuth } from "./auth.js";
import type { ConnectedAgentIdentity } from "./connected-agent-profile.js";
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

/**
 * A selected agent always sends as its own address. An explicit --from that
 * names any other address fails before anything is sent; the same address,
 * with or without a display name, is accepted.
 */
export function assertAgentFromAddress(
  from: string | undefined,
  connectedAgent: ConnectedAgentIdentity | undefined,
): void {
  if (from === undefined || !connectedAgent) return;
  const parsed = parseFromHeader(from);
  if (
    parsed.ok &&
    parsed.value.address.toLowerCase() ===
      connectedAgent.agentAddress.toLowerCase()
  )
    return;
  throw new Errors.CLIError(
    `--from ${from} is not this agent's address; omit --from to send as ${connectedAgent.agentAddress}.`,
    { exit: 1 },
  );
}

export type AuthFailureContext = {
  auth: ResolvedCliAuth;
  baseUrlOverridden: boolean;
  configDir: string;
};

/** Where a defaulted From came from, for the line that names it. */
export type DefaultFromSource = "agent" | "member_address" | "granted_address";

export type DefaultFrom = { address: string; source: DefaultFromSource };

/**
 * Credential kinds the API treats as a person acting as themself: an OAuth
 * login (the CLI's, or one an agent holds on the person's behalf) or a
 * dashboard session.
 */
const PERSON_CREDENTIAL_KINDS = new Set(["oauth", "member"]);

/**
 * Key kinds that may default to the one address their grant names. Any
 * other kind (agent_delegate, staff, internal, signed_token, or one this CLI
 * does not know) gets no default. agent_delegate is the API's label for an
 * agent's grant under a person's OAuth; its tokens are answered as `oauth`,
 * and so default to the person's member address above. Were the API ever to
 * answer `agent_delegate` itself, whether such an agent may send as the
 * person is its call, so the CLI asks for --from rather than assume it.
 */
const KEY_CREDENTIAL_KINDS = new Set(["org_key", "function_key"]);

/** The permissions that send mail; a grant with none of them cannot send. */
const SEND_PERMISSIONS = [
  "mail:send",
  "mail:send_batch",
  "mail:reply",
  "mail:signal",
  "mail:send_as_member",
];

type OwnGrant = {
  credential_kind?: string;
  permissions?: unknown;
  mail_scope?: unknown;
  send_scope?: unknown;
  scoped_permissions?: unknown;
};

/**
 * Whether a grant holds any send permission, outright or over a reach of its
 * own. A grant described without its permissions is not said to be unable.
 */
function grantSends(grant: OwnGrant): boolean {
  if (!Array.isArray(grant.permissions)) return true;
  const held = grant.permissions;
  const scoped =
    grant.scoped_permissions && typeof grant.scoped_permissions === "object"
      ? Object.keys(grant.scoped_permissions)
      : [];
  return SEND_PERMISSIONS.some(
    (permission) => held.includes(permission) || scoped.includes(permission),
  );
}

/** The addresses and whole domains a grant's sending reaches, or null for the whole organization. */
function grantSendReach(
  grant: OwnGrant,
): { addresses: string[]; domains: string[] } | null {
  const scope = grant.send_scope ?? grant.mail_scope;
  if (scope === "org") return null;
  if (
    !scope ||
    typeof scope !== "object" ||
    (scope as { direction?: unknown }).direction === "inbound"
  )
    return { addresses: [], domains: [] };
  const strings = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  return {
    addresses: strings((scope as { addresses?: unknown }).addresses),
    domains: strings((scope as { domains?: unknown }).domains),
  };
}

/**
 * The domains the organization may send From right now, or [] when the
 * credential cannot ask or the answer does not come. Only ever listed in a
 * refusal, never used as a default.
 */
async function sendableDomains(
  apiClient: PrimitiveApiClient,
): Promise<string[]> {
  let result: Awaited<ReturnType<typeof getOutboundStatus>>;
  try {
    result = await getOutboundStatus({
      client: apiClient.client,
      responseStyle: "fields",
    });
  } catch {
    return [];
  }
  const domains = result.error
    ? undefined
    : result.data?.data?.sendable_domains;
  return Array.isArray(domains)
    ? domains.filter((domain): domain is string => typeof domain === "string")
    : [];
}

/**
 * The refusal for a credential with no From to default to: why, the
 * addresses and domains it may send from as far as the CLI can tell, and how
 * to pass --from. Never a guess: the CLI does not pick one of them.
 */
async function noDefaultFrom(
  apiClient: PrimitiveApiClient,
  grant: OwnGrant,
  reason: string,
  options: { exclude?: string; example?: boolean } = {},
): Promise<Errors.CLIError> {
  if (!grantSends(grant))
    return new Errors.CLIError(
      "This credential cannot send mail from any address, so --from has no default.",
      { exit: 1 },
    );
  const { exclude } = options;
  const reach = grantSendReach(grant);
  const addresses = (reach?.addresses ?? []).filter(
    (address) => address.toLowerCase() !== exclude?.toLowerCase(),
  );
  const domains = reach ? reach.domains : await sendableDomains(apiClient);
  const parts: string[] = [];
  if (addresses.length > 0)
    parts.push(`Addresses you may send from: ${addresses.join(", ")}.`);
  if (domains.length > 0)
    parts.push(
      `${addresses.length > 0 ? "Also any" : "Any"} address at: ${domains.join(", ")}.`,
    );
  // A placeholder for a domain, never a sendable-looking address; and no
  // example for a person, whose listed addresses can be their agents'.
  const example =
    options.example === false
      ? null
      : (addresses[0] ?? (domains[0] ? `<name>@${domains[0]}` : null));
  parts.push(
    example
      ? `Pass the one to use with --from, for example --from ${example}.`
      : "Pass the address to send from with --from <address>.",
  );
  return new Errors.CLIError(`${reason} ${parts.join(" ")}`, { exit: 1 });
}

/**
 * Why the API would refuse a send from `from` to `to`, or null when it would
 * not refuse the From (or cannot say, in which case the send decides). Asked
 * of POST /v1/sendability, which judges the From by the send's own rule.
 */
async function fromRefusal(
  apiClient: PrimitiveApiClient,
  from: string,
  to: string,
): Promise<string | null> {
  let result: Awaited<ReturnType<typeof checkSendability>>;
  try {
    result = await checkSendability({
      client: apiClient.client,
      body: { to, from },
      responseStyle: "fields",
    });
  } catch {
    return null;
  }
  if (!result.error) return null;
  const payload = extractErrorPayload(result.error);
  const code = extractErrorCode(payload);
  const details = (payload as { details?: { rule?: unknown } } | null)?.details;
  // Only the From refusals: the send's From rule, or a From domain that
  // cannot send. Any other refusal (of the check itself, say) is not about
  // the From, so the send decides.
  const refusesFrom =
    code === "cannot_send_from_domain" ||
    (code === "grant_forbidden" && details?.rule === "send_from");
  if (!refusesFrom) return null;
  const message = (payload as { message?: unknown } | null)?.message;
  return typeof message === "string" && message.trim()
    ? message.trim()
    : formatErrorPayload(payload);
}

function unauthorizedRefusal(
  errorPayload: unknown,
  authFailureContext: AuthFailureContext,
): Errors.CLIError {
  writeErrorWithHints(errorPayload);
  surfaceUnauthorizedHint({ ...authFailureContext, payload: errorPayload });
  // exit: 1 to match the unauthorized path elsewhere; oclif's CLIError
  // defaults to 2 otherwise, which breaks callers that branch on exit code.
  return new Errors.CLIError(
    "Cannot send: CLI auth is missing or invalid (see hint above).",
    { exit: 1 },
  );
}

/**
 * The From a send uses when --from is left out, by credential:
 * - a connected agent sends as its own agent address;
 * - a person (a CLI login or a session) sends as their own member address,
 *   when the API would let them send from it to this recipient;
 * - a key whose grant sends from exactly one address, and no whole domain,
 *   sends from that address.
 * Anything else, including an organization-wide key, an agent_delegate and
 * a person with no member address they may send from, gets no default: the
 * command refuses, lists what the credential may send from, and asks for
 * --from. The From is never an address guessed from the organization's
 * domains, such as agent@ at the first verified one.
 */
export async function resolveDefaultFrom(
  apiClient: PrimitiveApiClient,
  authFailureContext: AuthFailureContext,
  options: { to?: string } = {},
): Promise<DefaultFrom> {
  if (authFailureContext.auth.connectedAgent) {
    return {
      address: authFailureContext.auth.connectedAgent.agentAddress,
      source: "agent",
    };
  }
  if (isConnectedChatCredential(authFailureContext.auth.apiKey)) {
    throw new Errors.CLIError(
      "Connected agents must pass --from with their connected email address.",
      { exit: 1 },
    );
  }
  const own = await getOwnGrant({
    client: apiClient.client,
    responseStyle: "fields",
  });
  if (own.error) {
    const errorPayload = extractErrorPayload(own.error);
    if (extractErrorCode(errorPayload) === API_ERROR_CODES.unauthorized)
      throw unauthorizedRefusal(errorPayload, authFailureContext);
    throw new Errors.CLIError(
      `Could not tell which addresses this credential may send from, so --from has no default. Pass --from <address>. Underlying error: ${formatErrorPayload(errorPayload)}`,
      { exit: 1 },
    );
  }
  const grant = (own.data?.data?.grant ?? null) as OwnGrant | null;
  if (!grant) {
    throw new Errors.CLIError(
      "This credential has no grant the API could describe, so --from has no default. Pass --from <address>.",
      { exit: 1 },
    );
  }

  if (PERSON_CREDENTIAL_KINDS.has(grant.credential_kind ?? "")) {
    const me = await whoami({
      client: apiClient.client,
      responseStyle: "fields",
    });
    if (me.error) {
      throw new Errors.CLIError(
        `Could not read your member address, so --from has no default. Pass --from <address>. Underlying error: ${formatErrorPayload(extractErrorPayload(me.error))}`,
        { exit: 1 },
      );
    }
    const member = me.data?.data?.member_address?.address ?? null;
    if (!member) {
      const suggestion = me.data?.data?.member_address_suggestion ?? null;
      const claim = suggestion
        ? ` To claim one, run \`primitive account provision-member-address --address ${suggestion}\`.`
        : "";
      throw await noDefaultFrom(
        apiClient,
        grant,
        `You have no member address of your own to send from, so --from has no default.${claim}`,
        { example: false },
      );
    }
    const to = options.to?.trim();
    const refused = to ? await fromRefusal(apiClient, member, to) : null;
    if (refused) {
      throw await noDefaultFrom(
        apiClient,
        grant,
        `Your member address ${member} cannot send this message, so --from has no default. ${refused.replace(/\.?$/, ".")}`,
        { exclude: member, example: false },
      );
    }
    return { address: member, source: "member_address" };
  }

  const reach = grantSendReach(grant);
  if (
    KEY_CREDENTIAL_KINDS.has(grant.credential_kind ?? "") &&
    grantSends(grant) &&
    reach &&
    reach.addresses.length === 1 &&
    reach.domains.length === 0
  ) {
    return { address: reach.addresses[0] as string, source: "granted_address" };
  }
  const isKey = KEY_CREDENTIAL_KINDS.has(grant.credential_kind ?? "");
  throw await noDefaultFrom(
    apiClient,
    grant,
    !isKey
      ? "Only your own login, a connected agent, or an organization or Function key naming one address has a default From, so --from has no default."
      : reach === null
        ? "This credential may send from any address at the organization's sending domains, so --from has no default."
        : "This credential's grant does not name one address to send from, so --from has no default.",
    isKey ? {} : { example: false },
  );
}

/** The address of resolveDefaultFrom. */
export async function pickDefaultFromAddress(
  apiClient: PrimitiveApiClient,
  authFailureContext: AuthFailureContext,
  options: { to?: string } = {},
): Promise<string> {
  return (await resolveDefaultFrom(apiClient, authFailureContext, options))
    .address;
}

/** The line a send prints to say which From it used, and where a default came from. */
export function fromLine(address: string, source?: DefaultFromSource): string {
  switch (source) {
    case "agent":
      return `From: ${address} (this agent's address).`;
    case "member_address":
      return `From: ${address} (your member address; pass --from to send from another address you may use).`;
    case "granted_address":
      return `From: ${address} (the one address this credential may send from).`;
    default:
      return `From: ${address}.`;
  }
}
