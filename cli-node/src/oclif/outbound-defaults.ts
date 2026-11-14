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
  getSendFrom,
  listDomains,
  whoami,
} from "@primitivedotdev/api-core";
import { parseFromHeader } from "@primitivedotdev/sdk/parser/address";
import {
  API_ERROR_CODES,
  extractErrorCode,
  extractErrorPayload,
  formatErrorPayload,
  isGrantRefusal,
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

export type DefaultFrom = { address: string; source?: DefaultFromSource };

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
 * The code on a refusal for a send with no --from that has no default From
 * (several addresses it may send from, say), so a caller reading --json can
 * tell it from a failed request.
 */
export const NO_DEFAULT_FROM_CODE = "no_default_from";

/**
 * The code on a refusal for a credential that lists no address or domain it
 * can send from (one that lists only email rules, say): no --from helps.
 */
export const NO_SEND_ADDRESS_CODE = "no_send_address";

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
      { exit: 1, code: NO_SEND_ADDRESS_CODE },
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
  // Nothing to send from only when the grant itself lists nothing: an
  // organization-wide reach whose domains could not be read is not known to
  // be empty, and an explicit --from can still send.
  return new Errors.CLIError(`${reason} ${parts.join(" ")}`, {
    exit: 1,
    code:
      reach !== null && addresses.length === 0 && domains.length === 0
        ? NO_SEND_ADDRESS_CODE
        : NO_DEFAULT_FROM_CODE,
  });
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
    "Cannot send: CLI auth is missing or invalid (see the hint).",
    { exit: 1 },
  );
}

/**
 * The From a send uses when --from is left out. A connected agent sends as
 * its own agent address. Otherwise the API answers it (GET /v1/whoami/send-
 * from), judging every address by the send's own rules: its default, or a
 * refusal that lists what the credential may send from. Against an API that
 * does not answer it, it is worked out here, by credential:
 * - a person (a CLI login or a session) sends as their own member address,
 *   when the API would let them send from it to this recipient;
 * - a key whose grant sends from exactly one address, and no whole domain,
 *   sends from that address.
 * Anything else, including an organization-wide key, an agent_delegate and
 * a person with no member address they may send from, gets no default: the
 * command refuses, lists what the credential may send from, and asks for
 * --from. A credential whose grant has no mail:send is refused by that
 * permission instead (MissingSendPermissionError), with no --from hint. The
 * From is never an address guessed from the organization's
 * domains, such as agent@ at the first verified one. A failed answer from an
 * API that has it refuses rather than fall back.
 */
export async function resolveDefaultFrom(
  apiClient: PrimitiveApiClient,
  authFailureContext: AuthFailureContext,
  options: { to?: string; purpose?: "send" | "reply" } = {},
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
      { exit: 1, code: NO_DEFAULT_FROM_CODE },
    );
  }
  const answered = await sendFromAnswer(
    apiClient,
    authFailureContext,
    options.purpose ?? "send",
  );
  if (answered) return answered;
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

const SEND_FROM_SOURCES: Record<string, DefaultFromSource> = {
  agent_address: "agent",
  member_address: "member_address",
  granted_address: "granted_address",
};

/** What a credential without mail:send is, as /whoami/grant describes it. */
type MissingSendPermission = {
  credentialKind: string | null;
  keyId: string | null;
  replies: boolean;
};

/**
 * The refusal of a send by a credential whose grant has no mail:send, in the
 * shape the send route itself refuses it with (code grant_forbidden, details
 * naming the permission), so a script can branch on it. It names what the
 * credential lacks first, then what would fix it, never --from.
 */
export class MissingSendPermissionError extends Errors.CLIError {
  readonly details = {
    permission: "mail:send",
    reason: "permission_missing",
  } as const;

  constructor(missing: MissingSendPermission) {
    super(missingSendPermissionMessage(missing), {
      code: "grant_forbidden",
      exit: 1,
    });
  }
}

function missingSendPermissionMessage(missing: MissingSendPermission): string {
  const isKey = KEY_CREDENTIAL_KINDS.has(missing.credentialKind ?? "");
  const parts = [
    `${isKey ? "This key" : "This credential"} has no mail:send, so it cannot send new mail from any address; --from does not change that.`,
  ];
  if (missing.replies) parts.push("It can still reply to mail it received.");
  parts.push(
    missing.credentialKind === "org_key" && missing.keyId
      ? `To send, add the permission to the key (a member who manages keys runs \`primitive keys update ${missing.keyId} --add mail:send\`), or use a credential that holds mail:send.`
      : PERSON_CREDENTIAL_KINDS.has(missing.credentialKind ?? "")
        ? "To send, ask an organization admin for a role that includes mail:send."
        : "To send, use a credential that holds mail:send.",
  );
  return parts.join(" ");
}

/**
 * The credential's own grant when it has no mail:send, outright or over a
 * reach of its own (as the API decides whether a caller may send), or null
 * when it has it or the grant cannot be read: then nothing is claimed.
 */
async function missingSendPermission(
  apiClient: PrimitiveApiClient,
): Promise<MissingSendPermission | null> {
  let own: Awaited<ReturnType<typeof getOwnGrant>>;
  try {
    own = await getOwnGrant({
      client: apiClient.client,
      responseStyle: "fields",
    });
  } catch {
    return null;
  }
  if (!own || own.error) return null;
  const data = own.data?.data as
    | { key_id?: unknown; grant?: OwnGrant | null }
    | undefined;
  const grant = data?.grant;
  if (!grant || !Array.isArray(grant.permissions)) return null;
  const holds = (permission: string) =>
    (grant.permissions as unknown[]).includes(permission) ||
    (grant.scoped_permissions !== null &&
      typeof grant.scoped_permissions === "object" &&
      Object.hasOwn(grant.scoped_permissions, permission));
  if (holds("mail:send")) return null;
  return {
    credentialKind:
      typeof grant.credential_kind === "string" ? grant.credential_kind : null,
    keyId: typeof data?.key_id === "string" ? data.key_id : null,
    replies: holds("mail:reply"),
  };
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The command that claims a member address, when whoami suggests one. */
async function claimHint(apiClient: PrimitiveApiClient): Promise<string> {
  try {
    const me = await whoami({
      client: apiClient.client,
      responseStyle: "fields",
    });
    if (me.error || me.data?.data?.member_address) return "";
    const suggestion = me.data?.data?.member_address_suggestion;
    return suggestion
      ? `You have no member address of your own; to claim one, run \`primitive account provision-member-address --address ${suggestion}\`.`
      : "";
  } catch {
    return "";
  }
}

/**
 * The default From as the API answers it (GET /v1/whoami/send-from), which
 * judges every address by the send's own rules: the default, or a refusal
 * that lists what the credential may send from. Undefined only where the API
 * does not have the answer (an older API, a Function-bound key), or for a
 * reply when it lists nothing (a reply needs no send permission), so the
 * caller works the default out as before. Any other failure, or an answer it
 * cannot read, refuses: the CLI never guesses past an answer it could not
 * read.
 */
async function sendFromAnswer(
  apiClient: PrimitiveApiClient,
  authFailureContext: AuthFailureContext,
  purpose: "send" | "reply",
): Promise<DefaultFrom | undefined> {
  let result: Awaited<ReturnType<typeof getSendFrom>>;
  try {
    result = await getSendFrom({
      client: apiClient.client,
      responseStyle: "fields",
    });
  } catch (error) {
    throw new Errors.CLIError(
      `Could not tell which address this credential may send from (${errorDetail(error)}), so --from has no default. Pass --from <address>.`,
      { exit: 1 },
    );
  }
  if (result.error) {
    const errorPayload = extractErrorPayload(result.error);
    const code = extractErrorCode(errorPayload);
    if (code === API_ERROR_CODES.unauthorized)
      throw unauthorizedRefusal(errorPayload, authFailureContext);
    if (code === "not_found" || code === "function_scope_forbidden")
      return undefined;
    throw new Errors.CLIError(
      `Could not tell which address this credential may send from, so --from has no default. Pass --from <address>. Underlying error: ${formatErrorPayload(errorPayload)}`,
      { exit: 1 },
    );
  }
  const data = result.data?.data as
    | {
        default_from?: unknown;
        default_source?: unknown;
        addresses?: unknown;
        domains?: unknown;
        reason?: unknown;
      }
    | undefined;
  // An answer it cannot read is not leave to guess: refuse, as for a failure.
  if (
    !data ||
    typeof data !== "object" ||
    !("default_from" in data) ||
    !Array.isArray(data.addresses)
  )
    throw new Errors.CLIError(
      "Could not read which address this credential may send from, so --from has no default. Pass --from <address>.",
      { exit: 1 },
    );
  if (typeof data.default_from === "string" && data.default_from) {
    const source =
      typeof data.default_source === "string" &&
      Object.hasOwn(SEND_FROM_SOURCES, data.default_source)
        ? SEND_FROM_SOURCES[data.default_source]
        : undefined;
    return { address: data.default_from, ...(source ? { source } : {}) };
  }
  const addresses = data.addresses
    .map((entry) =>
      entry && typeof entry === "object"
        ? (entry as { address?: unknown }).address
        : undefined,
    )
    .filter((address): address is string => typeof address === "string");
  const domains = Array.isArray(data.domains)
    ? data.domains.filter(
        (domain): domain is string => typeof domain === "string",
      )
    : [];
  // A reply needs no send permission: one that lists nothing to send from
  // still has its own reply rules, as before.
  if (purpose === "reply" && addresses.length === 0 && domains.length === 0)
    return undefined;
  // Nothing listed for a send: when the grant has no mail:send, say that
  // rather than ask for a --from that cannot help.
  if (addresses.length === 0 && domains.length === 0) {
    const missing = await missingSendPermission(apiClient);
    if (missing) throw new MissingSendPermissionError(missing);
  }
  const nothingListed = addresses.length === 0 && domains.length === 0;
  const reason =
    typeof data.reason === "string" && data.reason.trim()
      ? data.reason.trim().replace(/\.?$/, ".")
      : nothingListed
        ? "This credential lists no address or domain it can send from, so it cannot send."
        : "This credential has no single address to send from, so --from has no default.";
  const parts = [reason];
  if (addresses.length > 0)
    parts.push(`Addresses you may send from: ${addresses.join(", ")}.`);
  if (domains.length > 0)
    parts.push(
      `${addresses.length > 0 ? "Also any" : "Any"} address at: ${domains.join(", ")}.`,
    );
  // Only a person without a member address gets a suggestion to claim one.
  parts.push(await claimHint(apiClient));
  // With nothing listed to send from, no --from can be sent from either (a
  // key that lists only email rules, say): the server's reason says why.
  if (!nothingListed)
    parts.push("Pass the address to use with --from <address>.");
  throw new Errors.CLIError(parts.filter((part) => part).join(" "), {
    exit: 1,
    code: nothingListed ? NO_SEND_ADDRESS_CODE : NO_DEFAULT_FROM_CODE,
  });
}

/** The address of resolveDefaultFrom. */
export async function pickDefaultFromAddress(
  apiClient: PrimitiveApiClient,
  authFailureContext: AuthFailureContext,
  options: { to?: string; purpose?: "send" | "reply" } = {},
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

/**
 * The Froms CLI versions before the per-credential default could have used
 * with --from left out, worked out as they did: agent@ at the organization's
 * first active domain (every domain is tried, first active first, in case
 * the order or the active one has changed since), or, for a credential that
 * may not list domains, the one address its grant names. `none` when they
 * would have refused to send, so they cannot have left a chat behind;
 * `unauthorized` when the credential is not accepted, so nothing can send;
 * `unknown` when it cannot be read now. Only for finding a chat those
 * versions left unfinished; never sent from by default.
 */
export type LegacyDefaultFrom =
  | { kind: "addresses"; addresses: string[] }
  | { kind: "none" }
  | { kind: "unauthorized" }
  | { kind: "unknown" };

export async function legacyDefaultFromAddress(
  apiClient: PrimitiveApiClient,
): Promise<LegacyDefaultFrom> {
  try {
    const result = await listDomains({
      client: apiClient.client,
      responseStyle: "fields",
    });
    if (result.error) {
      const payload = extractErrorPayload(result.error);
      if (extractErrorCode(payload) === API_ERROR_CODES.unauthorized)
        return { kind: "unauthorized" };
      if (!isGrantRefusal(payload)) return { kind: "unknown" };
      const own = await getOwnGrant({
        client: apiClient.client,
        responseStyle: "fields",
      });
      if (own.error) return { kind: "unknown" };
      const grant = (own.data?.data?.grant ?? null) as OwnGrant | null;
      const reach = grant ? grantSendReach(grant) : null;
      return reach?.addresses.length === 1
        ? { kind: "addresses", addresses: [reach.addresses[0] as string] }
        : { kind: "none" };
    }
    const domains = (result.data as { data?: unknown } | undefined)?.data;
    const listed = Array.isArray(domains)
      ? domains.filter(
          (domain): domain is { domain: string; is_active?: unknown } =>
            typeof domain === "object" &&
            domain !== null &&
            typeof (domain as { domain?: unknown }).domain === "string",
        )
      : [];
    if (listed.length === 0) return { kind: "none" };
    const ordered = [
      ...listed.filter((domain) => domain.is_active === true),
      ...listed.filter((domain) => domain.is_active !== true),
    ];
    return {
      kind: "addresses",
      addresses: ordered.map((domain) => `agent@${domain.domain}`),
    };
  } catch {
    return { kind: "unknown" };
  }
}
