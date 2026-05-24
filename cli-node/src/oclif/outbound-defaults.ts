// Shared helpers for outbound-send commands. `primitive send` and
// `primitive chat` both want sensible defaults for --from and
// --subject so callers don't have to look up their own verified
// domain or hand-pick a subject for one-line bodies. Centralized here
// so the two commands stay bit-identical in defaulting behavior.

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

// 200 chars is a generous cap that almost never trips on natural
// first-line subjects (a sentence is typically <120 chars). The
// previous 70-char limit was tight enough that legitimate one-line
// bodies routinely produced ellipsis-truncated subjects in inbox
// listings. Real spam scoring engines don't penalize subjects under
// ~200 chars, so 200 is both more useful and still well under the
// practical wire limit.
export const SUBJECT_MAX_LENGTH = 200;

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

export function isVerifiedDomain(domain: Domain): domain is VerifiedDomain {
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
        "Cannot send: API key is missing or invalid (see hint above).",
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
