import { searchEmails } from "@primitivedotdev/api-core";
/**
 * The server-side `automated` verdict on inbound email: `automated`
 * (boolean) and `automated_reasons` (why, in rule order), decided by
 * the API when the email arrives, and the `automated=true|false` filter
 * on GET /emails and GET /emails/search.
 *
 * A server that predates it either rejects the `automated` filter (GET
 * /emails validates its query strictly) or ignores it and returns rows
 * without the fields (GET /emails/search). Both must fail loudly: a CLI
 * that read a missing verdict as "not automated" would hand an agent
 * every bounce and newsletter as mail from a person, and one that fell
 * back to deciding it locally would re-read all unanswered automated
 * mail on every call.
 */

export const AUTOMATED_FILTER_UNSUPPORTED_CODE = "automated_filter_unsupported";

export class AutomatedFilterUnsupportedError extends Error {
  code: string = AUTOMATED_FILTER_UNSUPPORTED_CODE;

  constructor(detail: string) {
    super(
      `The server does not support the \`automated\` filter yet: ${detail} Nothing was treated as sent by a person. Upgrade to a server that returns \`automated\` and \`automated_reasons\`, or pass --include-automated.`,
    );
    this.name = "AutomatedFilterUnsupportedError";
  }
}

/** Like AutomatedFilterUnsupportedError, for a probe that failed. */
export class AutomatedFilterUnverifiedError extends AutomatedFilterUnsupportedError {
  constructor(detail: string) {
    super(detail);
    this.message = `Could not verify that the server supports the \`automated\` filter: ${detail} Nothing was treated as matching. Retry the command.`;
    this.name = "AutomatedFilterUnverifiedError";
    this.code = "automated_filter_unverified";
  }
}

export type AutomatedFields = {
  automated: boolean;
  automated_reasons: string[];
};

export function hasAutomatedVerdict(row: unknown): row is AutomatedFields {
  if (row === null || typeof row !== "object") return false;
  const candidate = row as Record<string, unknown>;
  return (
    typeof candidate.automated === "boolean" &&
    Array.isArray(candidate.automated_reasons) &&
    candidate.automated_reasons.every((reason) => typeof reason === "string")
  );
}

/**
 * Throw unless every row carries the verdict, and, when `expected` is
 * given, unless every row has that value: a server that accepted the
 * filter but did not apply it must not pass for one that did.
 */
export function assertAutomatedVerdict(
  rows: readonly unknown[],
  surface: string,
  expected?: boolean,
): void {
  const missing = rows.filter((row) => !hasAutomatedVerdict(row)).length;
  if (missing > 0) {
    throw new AutomatedFilterUnsupportedError(
      `${surface} returned ${missing} of ${rows.length} email${rows.length === 1 ? "" : "s"} without the \`automated\` and \`automated_reasons\` fields.`,
    );
  }
  if (expected === undefined) return;
  const wrong = rows.filter(
    (row) => (row as AutomatedFields).automated !== expected,
  ).length;
  if (wrong > 0) {
    throw new AutomatedFilterUnsupportedError(
      `${surface} ignored \`automated=${expected}\` and returned ${wrong} email${wrong === 1 ? "" : "s"} with \`automated=${!expected}\`.`,
    );
  }
}

/** True when a search DSL query uses the `automated:` term. */
export function queryUsesAutomated(q: string | null | undefined): boolean {
  return typeof q === "string" && /(^|[\s(])-?automated:/i.test(q);
}

function errorBody(payload: unknown): { code?: unknown; message?: unknown } {
  if (payload === null || typeof payload !== "object") return {};
  const inner = (payload as { error?: unknown }).error;
  return inner !== null && typeof inner === "object"
    ? (inner as { code?: unknown; message?: unknown })
    : (payload as { code?: unknown; message?: unknown });
}

/**
 * True when an API error is an older server rejecting the `automated`
 * query parameter or the `automated:` search term as unknown.
 */
export function isAutomatedRejectedError(payload: unknown): boolean {
  const body = errorBody(payload);
  if (body.code !== "validation_error") return false;
  const message =
    typeof body.message === "string" ? body.message : JSON.stringify(payload);
  return /automated/i.test(message) && /unrecogni[sz]ed|unknown/i.test(message);
}

export function automatedRejectedError(surface: string): Error {
  return new AutomatedFilterUnsupportedError(
    `${surface} rejected the \`automated\` filter as unknown.`,
  );
}

const AUTOMATED_SURFACES: Record<string, string> = {
  listEmails: "GET /emails",
  searchEmails: "GET /emails/search",
};

/**
 * For the generated `emails list` / `emails search` commands: the
 * surface name when this call filtered on `automated` (the parameter or
 * an `automated:` search term), else null.
 */
export function automatedSurfaceForOperation(
  sdkName: string,
  query: Record<string, unknown> | undefined,
): string | null {
  const surface = AUTOMATED_SURFACES[sdkName];
  if (!surface || !query) return null;
  const q = typeof query.q === "string" ? query.q : undefined;
  return query.automated !== undefined || queryUsesAutomated(q)
    ? surface
    : null;
}

type SearchClient = { client: unknown };

const searchSupportProbes = new WeakMap<object, Promise<void>>();

/**
 * GET /emails/search ignores unknown parameters, so an empty page for
 * `automated=...` does not show that the server applied the filter.
 * Read one unfiltered row: if it lacks the verdict the server does not
 * support it. No rows at all means the mailbox is empty, so the empty
 * answer stands. One probe per API client per process.
 */
export function ensureSearchReportsAutomated(
  apiClient: SearchClient,
): Promise<void> {
  const key = apiClient as object;
  let probe = searchSupportProbes.get(key);
  if (!probe) {
    probe = (async () => {
      const result = await searchEmails({
        client: apiClient.client as never,
        query: { limit: 1, include_facets: "false", snippet: "false" },
        responseStyle: "fields",
      });
      if (result.error) {
        throw new AutomatedFilterUnverifiedError(
          "the empty result could not be checked: reading one unfiltered row from GET /emails/search failed.",
        );
      }
      const rows = (result.data as { data?: unknown[] } | undefined)?.data;
      assertAutomatedVerdict(rows ?? [], "GET /emails/search");
    })();
    searchSupportProbes.set(key, probe);
    probe.catch(() => {
      if (searchSupportProbes.get(key) === probe)
        searchSupportProbes.delete(key);
    });
  }
  return probe;
}
