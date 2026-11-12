import { readFileSync, writeFileSync } from "node:fs";
import { Args, Command, Errors, Flags } from "@oclif/core";
import type {
  AgentSignupVerifyResult,
  ErrorResponse,
  PrimitiveOperationManifest,
  PrimitiveParameterManifest,
} from "@primitivedotdev/api-core";
import { operations } from "@primitivedotdev/api-core";
import { ANSWER_REPORT_EXTENSIONS } from "./answer-reports.js";
import { createAuthenticatedCliApiClient } from "./api-client.js";
import { cliCommandLines } from "./api-path-commands.js";
import {
  ATTACHMENT_WAIT_FLAG_DESCRIPTION,
  ATTACHMENT_WAIT_MAX_MS,
  ATTACHMENT_WAIT_OPERATIONS,
  withAttachmentWait,
} from "./attachment-wait.js";
import {
  type ResolvedCliAuth,
  resolveCliAuth,
  saveSignupCredentials,
} from "./auth.js";
import {
  AutomatedFilterUnsupportedError,
  assertAutomatedVerdict,
  automatedRejectedError,
  automatedSurfaceForOperation,
  ensureSearchReportsAutomated,
  expectedAutomatedVerdicts,
  isAutomatedRejectedError,
} from "./automated-filter.js";
import { requireDefaultLoginProfile } from "./connected-agent-profile.js";
import {
  EMAIL_RULE_OPERATION_EXTENSIONS,
  updateEmailRuleErrorHint,
} from "./email-rule-authoring.js";
import {
  emptyEmailListHint,
  listFilters,
  readCallerMailFor,
} from "./empty-mail-hint.js";
import {
  bodyHasRules,
  currentEndpointRules,
  EVENT_TYPES_FLAG_DESCRIPTION,
  EVENT_TYPES_FLAG_OPERATIONS,
  EventTypesFlagError,
  parseEventTypesFlag,
  unknownEventTypes,
  unknownEventTypesWarning,
  withEventTypes,
} from "./endpoint-event-types.js";
import {
  type ListEndpointsFn,
  maybeWriteFunctionEndpointRedirect,
} from "./endpoints-test-redirect.js";
import { withFlagSuggestion } from "./flag-suggestions.js";
import {
  assertFromVerifiedRows,
  FromVerifiedFilterUnsupportedError,
  fromVerifiedExpectation,
} from "./from-verified-filter.js";
import { writeIdempotentReplayBannerIfReplay } from "./idempotent-replay-banner.js";
import {
  inviteRefusalHint,
  readRoles,
  roleReadsAllMailWarning,
} from "./member-role-mail.js";
import type {
  OperationExtension,
  OperationReport,
} from "./operation-extension.js";
import { explainPendingMailNotFound } from "./pending-mail-miss.js";
import {
  assertAwaitingFilterRows,
  awaitingRejectedError,
  ensureSearchReportsReplyState,
  isAwaitingRejectedError,
  ReplyStateUnsupportedError,
  replyStateSurfaceForOperation,
} from "./reply-state.js";
import {
  createEndpointRuleRequestHint,
  updateEndpointRuleRequestHint,
} from "./rule-request-webhooks.js";
import { sentListOtherSendersNote } from "./sent-list-labels.js";
import {
  approveThenRerunHint,
  BROWSER_FLAG_DESCRIPTION,
  promptLine,
  STEP_UP_HEADER,
  STEP_UP_TOKEN_FLAG_DESCRIPTION,
  terminalApprovalIo,
  withApproval,
} from "./step-up-approval.js";
import { parseRetryAfter } from "./transient-retry.js";

type OperationName = keyof typeof operations;
export type ApiErrorCode = ErrorResponse["error"]["code"];

export const API_ERROR_CODES = {
  accessDenied: "access_denied",
  authorizationPending: "authorization_pending",
  expiredToken: "expired_token",
  forbidden: "forbidden",
  grantForbidden: "grant_forbidden",
  invalidDeviceCode: "invalid_device_code",
  notFound: "not_found",
  slowDown: "slow_down",
  unauthorized: "unauthorized",
} as const satisfies Record<string, ApiErrorCode>;

type OperationExecutor = (options: Record<string, unknown>) => Promise<{
  data?: Blob | File | Record<string, unknown> | Record<string, unknown>[];
  error?: unknown;
  response?: Response;
}>;

function flagName(parameterName: string): string {
  return parameterName.replace(/_/g, "-");
}

/**
 * Flag name for a request header an operation declares, such as
 * `--idempotency-key` for `Idempotency-Key`.
 */
export function headerFlagName(headerName: string): string {
  return headerName.toLowerCase().replace(/_/g, "-");
}

/**
 * True when `text` holds an ASCII control character. Header values
 * travel on the wire as given, so one (a line break above all) could
 * never be sent and is refused before the request.
 */
export function hasControlCharacter(text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Read the declared-header flags the caller passed into a header map
 * keyed by the header name the spec declares. Only flags `buildFlags`
 * registered for a header are read.
 */
export function collectHeaderFlags(
  parsedFlags: Record<string, unknown>,
  headerFlagToName: Map<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [flag, header] of headerFlagToName) {
    const value = parsedFlags[flag];
    if (value === undefined) continue;
    const text = String(value);
    if (text.trim() === "")
      throw new Errors.CLIError(`--${flag} must not be empty.`, { exit: 2 });
    if (hasControlCharacter(text))
      throw new Errors.CLIError(
        `--${flag} must not contain control characters such as line breaks.`,
        { exit: 2 },
      );
    headers[header] = text;
  }
  return headers;
}

function flagDescription(parameter: PrimitiveParameterManifest): string {
  return parameter.description ?? parameter.name;
}

// Operations the server may ask a person to approve in the browser although
// the published spec does not list the Primitive-Step-Up header for them. None
// today: every such operation declares the header. The header is sent only
// with a token the person passes or pastes from the approval page.
export const STEP_UP_OPERATIONS: ReadonlySet<string> = new Set<string>([]);

/**
 * Whether the API answers an operation only in a dashboard session, so the CLI
 * is always refused (the spec's x-primitive-person-only access `session`).
 */
export function isDashboardOnly(
  operation: Pick<PrimitiveOperationManifest, "access">,
): boolean {
  return operation.access === "session";
}

/** Added to the summary, which is what short help prints. */
export const DASHBOARD_ONLY_SUMMARY =
  " (dashboard only: the API refuses the CLI here; use the dashboard)";

export const DASHBOARD_ONLY_NOTE =
  "Dashboard only: the API answers this only in a dashboard session, so the CLI, API keys and agents are refused. Open the dashboard to do it.";

/** Whether an operation takes the browser approval token. */
export function takesStepUp(
  operation: Pick<PrimitiveOperationManifest, "headerParams" | "sdkName">,
): boolean {
  return (
    STEP_UP_OPERATIONS.has(operation.sdkName) ||
    operation.headerParams.some((p) => p.name === STEP_UP_HEADER)
  );
}

/** A path or query flag a command names or describes differently from the spec. */
export type PathFlagOverride = {
  /** The flag's name, when not the parameter's; the parameter's name stays as an alias. */
  flag?: string;
  description?: string;
};

const EMAIL_ID_NOT_SENT =
  "The id of the received email (from `primitive emails list`), not a sent email id. --id is accepted too.";

// Path flags renamed where `--id` would name a different resource from the
// rest of the topic, keyed by operation.sdkName then parameter name. No other
// email-rules command's --id is an email id (they name a rule, a request or a
// share), and the sending topic's other ids are sent emails.
export const OPERATION_PATH_FLAGS: Record<
  string,
  Record<string, PathFlagOverride>
> = {
  listEmailRuleResults: {
    id: {
      flag: "email-id",
      description:
        "The id of the email (from `primitive emails list`), not a rule id: lists what every rule you can see decided about this email, and why a rule did not run. --id is accepted too.",
    },
  },
  replyToEmail: { id: { flag: "email-id", description: EMAIL_ID_NOT_SENT } },
  signalEmail: { id: { flag: "email-id", description: EMAIL_ID_NOT_SENT } },
  stopRepeatFromEmail: {
    id: { flag: "email-id", description: EMAIL_ID_NOT_SENT },
  },
};

/** End a description with a full stop when it has no closing punctuation. */
function sentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/**
 * The path parameter a command also takes as its first argument: the only
 * one, when the operation has exactly one (`emails get <id>`). Its flag stays
 * and is no longer required on its own.
 */
export function positionalPathParameter(
  operation: Pick<PrimitiveOperationManifest, "pathParams">,
): PrimitiveParameterManifest | undefined {
  return operation.pathParams.length === 1
    ? operation.pathParams[0]
    : undefined;
}

/** The most rows a paged --limit fetches, in pages of the server's own cap. */
export const PAGED_LIMIT_MAX = 1000;

/**
 * The server's per-request cap on --limit for a list the CLI can page itself
 * (array data, a cursor in meta.cursor, a limit with a maximum), else
 * undefined. A larger --limit, up to PAGED_LIMIT_MAX, is then fetched in
 * pages of that size.
 */
export function pagedLimitMaximum(
  operation: Pick<
    PrimitiveOperationManifest,
    "headerParams" | "queryParams" | "responseSchema" | "sdkName"
  >,
): number | undefined {
  // A browser approval is for one request, so such a list is never paged.
  if (takesStepUp(operation)) return undefined;
  const limit = operation.queryParams.find((p) => p.name === "limit");
  if (!limit || typeof limit.maximum !== "number") return undefined;
  if (!pagingFlagOverride(operation, limit)) return undefined;
  return limit.maximum < PAGED_LIMIT_MAX ? limit.maximum : undefined;
}

/** The flag a path or query parameter is read from. */
export function parameterFlagName(
  sdkName: string | undefined,
  parameterName: string,
): string {
  return (
    (sdkName
      ? OPERATION_PATH_FLAGS[sdkName]?.[parameterName]?.flag
      : undefined) ?? flagName(parameterName)
  );
}

/**
 * Paging help for a list operation whose data is an array and whose next
 * cursor is meta.cursor: the page cap on --limit, and where the next cursor is
 * printed, since the --json output of such a list is the data array alone.
 * The spec's own text is kept. A list that returns its cursor inside the data
 * (next_cursor) prints it already and is left as the spec describes it.
 */
export function pagingFlagOverride(
  operation: Pick<PrimitiveOperationManifest, "queryParams" | "responseSchema">,
  parameter: PrimitiveParameterManifest,
): PathFlagOverride | undefined {
  if (!operation.queryParams.some((p) => p.name === "cursor")) return undefined;
  const data = operation.responseSchema as
    | { type?: unknown }
    | null
    | undefined;
  if (data?.type !== "array") return undefined;
  const described = flagDescription(parameter).trim().replace(/\.$/, "");
  if (parameter.name === "cursor") {
    return {
      description: `${described}. The next page's cursor is meta.cursor, null on the last page: without --json it is printed on stderr as \`next cursor: <value>\`; with --json, add --envelope to get it, since the bare --json output is the data array alone.`,
    };
  }
  if (parameter.name === "limit" && typeof parameter.maximum === "number") {
    if (parameter.maximum < PAGED_LIMIT_MAX) {
      const single = operation.queryParams.some((p) => p.name === "wait")
        ? " (not with --wait or --since)"
        : "";
      return {
        description: `${described}. The API returns at most ${parameter.maximum} per request; a larger --limit, up to ${PAGED_LIMIT_MAX}, is fetched in pages of ${parameter.maximum}${single}. For more, page with --cursor.`,
      };
    }
    const cap = described.includes(String(parameter.maximum))
      ? ""
      : ` At most ${parameter.maximum} per page;`;
    return {
      description: `${described}.${cap} for more, page with --cursor.`.replace(
        ". for more",
        ". For more",
      ),
    };
  }
  return undefined;
}

type NumericFlagOptions = {
  max?: number;
  min?: number;
};

const numberFlag = Flags.custom<number, NumericFlagOptions>({
  async parse(input, _context, options) {
    const trimmed = input.trim();
    if (trimmed === "") {
      throw new Errors.CLIError(`Expected a number but received: ${input}`);
    }
    const value = Number(trimmed);
    if (!Number.isFinite(value)) {
      throw new Errors.CLIError(`Expected a number but received: ${input}`);
    }
    if (options.min !== undefined && value < options.min) {
      throw new Errors.CLIError(
        `Expected a number greater than or equal to ${options.min} but received: ${input}`,
      );
    }
    if (options.max !== undefined && value > options.max) {
      throw new Errors.CLIError(
        `Expected a number less than or equal to ${options.max} but received: ${input}`,
      );
    }
    return value;
  },
});

function numericFlagOptions(parameter: {
  default?: unknown;
  maximum?: number;
  minimum?: number;
}): NumericFlagOptions & { default?: number } {
  return {
    ...(typeof parameter.default === "number"
      ? { default: parameter.default }
      : {}),
    ...(typeof parameter.maximum === "number"
      ? { max: parameter.maximum }
      : {}),
    ...(typeof parameter.minimum === "number"
      ? { min: parameter.minimum }
      : {}),
  };
}

// Description of a single top-level body property, normalized
// from the JSON Schema on the operation manifest. `kind` tells the
// CLI generator whether to expose the field as an individual
// `--flag` (scalar) or leave it to `--raw-body` JSON (non-scalar).
interface BodyFieldDescriptor {
  name: string;
  description: string;
  required: boolean;
  // Pretty-printed type for help text (e.g. "string", "integer",
  // "string?", "array<string>"). Always set.
  displayType: string;
  // Either a CLI flag-able scalar kind or "complex" (array, object,
  // mixed-non-nullable, unknown). Complex fields cannot be
  // expressed as a single CLI flag and must go through --raw-body.
  kind: "string" | "integer" | "number" | "boolean" | "complex";
  maximum?: number;
  minimum?: number;
  // Restricted-string enum, when the schema had `enum: [...]` and
  // the type is string. Used to bound the generated flag.
  enumValues?: readonly string[];
}

function extractBodyFields(
  schema: Record<string, unknown> | null,
): BodyFieldDescriptor[] {
  if (!schema || typeof schema !== "object") return [];
  const properties = schema.properties;
  if (!properties || typeof properties !== "object") return [];
  const requiredArr = Array.isArray(schema.required)
    ? (schema.required as unknown[]).filter(
        (k): k is string => typeof k === "string",
      )
    : [];
  const required = new Set(requiredArr);

  const fields: BodyFieldDescriptor[] = [];
  for (const [name, raw] of Object.entries(
    properties as Record<string, unknown>,
  )) {
    const propSchema =
      raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const t = propSchema.type;

    let displayType = "any";
    let kind: BodyFieldDescriptor["kind"] = "complex";
    if (typeof t === "string") {
      displayType = t;
      if (t === "string") kind = "string";
      else if (t === "integer") kind = "integer";
      else if (t === "number") kind = "number";
      else if (t === "boolean") kind = "boolean";
      else if (t === "array") {
        const items = propSchema.items;
        if (items && typeof items === "object") {
          const itemType = (items as Record<string, unknown>).type;
          if (typeof itemType === "string") {
            displayType = `array<${itemType}>`;
          }
        }
        kind = "complex";
      } else {
        kind = "complex";
      }
    } else if (Array.isArray(t)) {
      // Nullable shorthand the codegen normalizes to e.g.
      // ["string","null"]. If exactly one non-null member, surface
      // it as that scalar with a trailing `?`.
      const nonNull = (t as unknown[]).filter((s) => s !== "null");
      if (nonNull.length === 1) {
        const single = nonNull[0];
        displayType = `${single}?`;
        if (single === "string") kind = "string";
        else if (single === "integer") kind = "integer";
        else if (single === "number") kind = "number";
        else if (single === "boolean") kind = "boolean";
        else kind = "complex";
      } else {
        displayType = nonNull.join("|");
        kind = "complex";
      }
    }

    // Pull the first paragraph of the schema description for use
    // as the CLI flag's --help string. We split on a blank line
    // (paragraph break) and then collapse any soft line wraps
    // inside that paragraph to spaces. This avoids the previous
    // bug where `split("\n")[0]` truncated wrapped prose like
    //   "Optional override for ... Defaults to\nthe inbound's..."
    // to "Optional override for ... Defaults to" - a sentence
    // ending with "to" with nothing after it, which read as
    // ellipsis truncation in --help. The remaining paragraphs
    // are intentionally dropped so multi-paragraph schemas don't
    // blow out the per-flag help block.
    const description =
      typeof propSchema.description === "string"
        ? propSchema.description
            .split(/\n\s*\n/)[0]
            .replace(/\s*\n\s*/g, " ")
            .trim()
        : "";

    const enumRaw = propSchema.enum;
    const enumValues =
      kind === "string" && Array.isArray(enumRaw)
        ? enumRaw.filter((e): e is string => typeof e === "string")
        : undefined;

    fields.push({
      name,
      description,
      required: required.has(name),
      displayType,
      kind,
      ...(enumValues && enumValues.length > 0 ? { enumValues } : {}),
      ...(typeof propSchema.maximum === "number"
        ? { maximum: propSchema.maximum }
        : {}),
      ...(typeof propSchema.minimum === "number"
        ? { minimum: propSchema.minimum }
        : {}),
    });
  }
  return fields.sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Render a "Body fields" summary for the per-command help.
 *
 * Most scalar fields are exposed as individual `--flag` flags,
 * which oclif auto-renders in the FLAGS section above. To avoid
 * duplicating that, the summary here only documents fields that
 * MUST go through `--raw-body` (complex types: arrays, objects,
 * mixed-non-nullable). When an operation has only scalars, the
 * summary is omitted entirely and oclif's FLAGS section is the
 * full story.
 *
 * For operations with mixed scalar and complex fields, we also
 * include a short header pointing the agent at the flag form so
 * the natural reading is "use the flags above; --raw-body for
 * the leftovers below."
 */
function renderRequestSchemaSummary(
  schema: Record<string, unknown> | null,
  setByFlags: readonly string[] = [],
): string | null {
  const fields = extractBodyFields(schema);
  if (fields.length === 0) return null;

  // A complex field a CLI extension's flags set is exposed as flags.
  const complex = fields.filter(
    (f) => f.kind === "complex" && !setByFlags.includes(f.name),
  );
  if (complex.length === 0) return null;

  const nameWidth = Math.min(
    24,
    Math.max(...complex.map((f) => f.name.length)),
  );
  const descMax = 78;
  const lines = [
    "Body fields requiring --raw-body JSON (these are not exposed as flags):",
  ];
  for (const f of complex) {
    const marker = f.required ? " *" : "  ";
    const padName = f.name.padEnd(nameWidth);
    const trimmedDesc =
      f.description.length > descMax
        ? `${f.description.slice(0, descMax - 3)}...`
        : f.description;
    const desc = trimmedDesc ? `  ${trimmedDesc}` : "";
    lines.push(`${marker} ${padName}  ${f.displayType}${desc}`);
  }
  lines.push(
    "(* = required. Scalar body fields are exposed as individual --flag-name flags; see FLAGS above.)",
  );
  return lines.join("\n");
}

export function flagForParameter(
  parameter: PrimitiveParameterManifest,
  override?: PathFlagOverride,
): unknown {
  const common = {
    description: override?.description ?? flagDescription(parameter),
    required: parameter.required,
    ...(override?.flag ? { aliases: [flagName(parameter.name)] } : {}),
  };

  if (parameter.type === "boolean") {
    return Flags.boolean(common);
  }

  if (parameter.type === "integer") {
    return Flags.integer({ ...common, ...numericFlagOptions(parameter) });
  }

  if (parameter.type === "number") {
    return numberFlag({ ...common, ...numericFlagOptions(parameter) });
  }

  if (parameter.enum && parameter.enum.length > 0) {
    return Flags.string({ ...common, options: parameter.enum });
  }

  return Flags.string(common);
}

function coerceParameterValue(
  parameter: PrimitiveParameterManifest,
  value: unknown,
): boolean | number | string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (parameter.type === "number") {
    if (typeof value === "number") {
      return value;
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      throw new Errors.CLIError(
        `Invalid number for --${parameter.name}: ${value}`,
      );
    }

    return parsed;
  }

  if (
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }

  throw new Errors.CLIError(`Unsupported flag value for --${parameter.name}`);
}

function cliError(message: string): Errors.CLIError {
  return new Errors.CLIError(message, { exit: 1 });
}

function parseJson(source: string, flagLabel: string): unknown {
  try {
    return JSON.parse(source);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw cliError(`${flagLabel} is not valid JSON: ${detail}`);
  }
}

export function readJsonBody(flags: Record<string, unknown>): unknown {
  const bodyFile = flags["body-file"];
  const rawBody = flags["raw-body"];

  if (bodyFile && rawBody) {
    throw cliError("Use either --raw-body or --body-file, not both");
  }

  if (typeof bodyFile === "string") {
    let contents: string;
    try {
      contents = readFileSync(bodyFile, "utf8");
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw cliError(`Could not read --body-file ${bodyFile}: ${detail}`);
    }
    return parseJson(contents, `--body-file ${bodyFile}`);
  }

  if (typeof rawBody === "string") {
    return parseJson(rawBody, "--raw-body");
  }

  return undefined;
}

// Read a UTF-8 text file off disk, mapping any failure to a CLIError
// tagged with the originating flag so the user sees which path failed
// to open. Used by hand-rolled commands that take a file-input flag
// (e.g. functions:deploy --file).
export function readTextFileFlag(path: string, flagLabel: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw cliError(`Could not read ${flagLabel} ${path}: ${detail}`);
  }
}

export function extractErrorPayload(raw: unknown): unknown {
  if (
    raw &&
    typeof raw === "object" &&
    !(raw instanceof Error) &&
    "error" in raw
  ) {
    const inner = (raw as { error: unknown }).error;
    if (inner !== null && inner !== undefined) {
      return inner;
    }
  }
  return raw;
}

function extractCauseDetails(cause: unknown): {
  code?: string;
  details: Record<string, number | string>;
} {
  const details: Record<string, number | string> = {};
  let code: string | undefined;

  if (!cause || typeof cause !== "object") {
    return { details };
  }

  for (const [key, value] of Object.entries(cause)) {
    if (typeof value === "string" || typeof value === "number") {
      details[key] = value;
      if (key === "code" && typeof value === "string") {
        code = value;
      }
    }
  }

  return { code, details };
}

export function formatErrorPayload(payload: unknown): string {
  if (payload instanceof Error) {
    const { code, details } = extractCauseDetails(
      (payload as { cause?: unknown }).cause,
    );
    const body: Record<string, unknown> = {
      code: code ?? "client_error",
      message: payload.message || payload.name || String(payload),
    };
    if (Object.keys(details).length > 0) {
      body.cause = details;
    }
    return JSON.stringify(body, null, 2);
  }
  return JSON.stringify(payload, null, 2);
}

// Pull the top-level error code out of either a server response
// payload (`{ error: { code: '...' } }` or `{ code: '...' }`) or a
// thrown Error whose `cause.code` carries the value. Used to drive
// `--api-key` and similar hints in writeErrorWithHints below.
// Also exported so individual commands (send, whoami) can branch
// on auth failures and avoid surfacing misleading "fix this flag"
// guidance when the real problem is the API key.
export function extractErrorCode(payload: unknown): string | undefined {
  if (payload instanceof Error) {
    const { code } = extractCauseDetails(
      (payload as { cause?: unknown }).cause,
    );
    return code;
  }
  if (payload && typeof payload === "object") {
    const inner = (payload as { error?: { code?: unknown } }).error;
    if (inner && typeof inner === "object" && typeof inner.code === "string") {
      return inner.code;
    }
    const direct = (payload as { code?: unknown }).code;
    if (typeof direct === "string") return direct;
  }
  return undefined;
}

// Common-case actionable hints keyed by error code. The full
// JSON envelope still goes to stderr unchanged for any caller
// that wants to parse it; the hint is an extra trailing line so
// a human reading the output sees "what to actually do next."
// The AGX walkthrough flagged that an `unauthorized` envelope
// alone left the agent without context for the env var or the
// `--api-key` flag; this closes that gap without having to
// special-case every command.
const ERROR_CODE_HINTS = {
  [API_ERROR_CODES.unauthorized]:
    "Hint: run `primitive signin`, pass --api-key explicitly, or set PRIMITIVE_API_KEY in your environment. `primitive whoami` is the fastest way to verify auth is live.",
} as const satisfies Partial<Record<ApiErrorCode, string>>;

// Network-layer hints keyed by Node's `cause.code` on a fetch failure.
// Separate from ERROR_CODE_HINTS because these aren't API-server error
// codes; they are the values Node sets on the underlying system call
// that failed before the request ever hit a server. The fix is almost
// always proxy / DNS / firewall on the caller's side, and the bare
// envelope (which just says `ENETUNREACH`) tells the user nothing they
// can act on. AGX walkthroughs in restrictive container environments
// hit this enough that the hint earns the extra lookup.
const NETWORK_ERROR_HINTS: Record<string, string> = {
  ENETUNREACH:
    "Hint: the network is unreachable. If you're behind a proxy and set HTTP(S)_PROXY, re-run with NODE_USE_ENV_PROXY=1 (Node 22+ ignores those env vars by default). `primitive doctor` reports the local environment in one shot.",
  ECONNREFUSED:
    "Hint: the server refused the connection. Check that your firewall allows egress to *.primitive.dev, that your PRIMITIVE_API_BASE_URL_* overrides (if any) point at a reachable host, and re-run with NODE_USE_ENV_PROXY=1 if you're behind a proxy. `primitive doctor` reports the local environment in one shot.",
  ETIMEDOUT:
    "Hint: the connection timed out. Check egress rules and proxy configuration; if you're behind a proxy, re-run with NODE_USE_ENV_PROXY=1 and HTTPS_PROXY set. `primitive doctor` reports the local environment in one shot.",
  EAI_AGAIN:
    "Hint: DNS lookup failed. Check /etc/resolv.conf inside containers, and try `curl -v https://api.primitive.dev/v1/account` to confirm the host resolves. `primitive doctor` reports the local environment in one shot.",
};

// The API's rate-limit codes: `rate_limited` (organization-wide limiter,
// /send-mail) and `rate_limit_exceeded` (per-resource limiters and the
// abuse backstop in front of the API).
const RATE_LIMIT_CODES = new Set(["rate_limited", "rate_limit_exceeded"]);

/** When to retry a rate-limited request, from Retry-After when it was sent. */
export function rateLimitHint(response?: Response): string {
  const delay = parseRetryAfter(response?.headers.get("retry-after"));
  return delay === undefined
    ? "Hint: this request was rate limited. Wait before retrying: the API request limits use a 60 second window, and send limits can take longer to reset."
    : `Hint: this request was rate limited. Retry in ${Math.max(1, Math.ceil(delay / 1000))} s.`;
}

/**
 * True when the API refused because of the credential's grant or role. The
 * credential itself was accepted, so this is not an authentication failure.
 */
export function isGrantRefusal(payload: unknown): boolean {
  const code = extractErrorCode(payload);
  return (
    code === API_ERROR_CODES.grantForbidden ||
    code === API_ERROR_CODES.forbidden
  );
}

/** `details` of a refusal, whether the payload is the error or its envelope. */
export function refusalDetails(payload: unknown): Record<string, unknown> {
  const outer =
    payload && typeof payload === "object"
      ? (payload as { details?: unknown; error?: unknown })
      : {};
  const inner =
    outer.error && typeof outer.error === "object"
      ? (outer.error as { details?: unknown })
      : {};
  const details = outer.details ?? inner.details;
  return details && typeof details === "object"
    ? (details as Record<string, unknown>)
    : {};
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

/**
 * The hint for a `403 grant_forbidden`: which permission the credential's
 * grant lacks, and how to check a credential before using it.
 */
export function grantForbiddenHint(payload: unknown): string {
  const record = refusalDetails(payload);
  const permission = nonEmptyString(record.permission);
  const reason = nonEmptyString(record.reason);
  const missing = nonEmptyString(record.missing);
  const what = permission
    ? `This credential's grant does not include ${missing ?? permission}${reason ? ` (${reason})` : ""}.`
    : "This credential's grant does not allow this operation.";
  const check = permission
    ? ` Check a credential with \`primitive whoami --check ${missing ?? permission}\`.`
    : "";
  return `Hint: ${what} Use a credential whose grant includes it, or ask an owner or admin to widen it.${check}`;
}

/**
 * The hint for a `403 forbidden` that names a permission, or null when it does
 * not (a dashboard-only route, say, explains itself in its message). Unlike
 * `grant_forbidden`, this refusal can come from a route closed to keys and the
 * CLI altogether, so it never promises that a wider credential opens it.
 */
export function forbiddenHint(payload: unknown): string | null {
  const record = refusalDetails(payload);
  const permission = nonEmptyString(record.permission);
  if (!permission || record.reason !== "permission_missing") return null;
  return `Hint: This operation needs ${permission}, which this credential does not have. Some operations stay closed to keys and the CLI even with it. Check a credential with \`primitive whoami --check ${permission}\`.`;
}

// Write a server / SDK error to stderr in the canonical envelope
// shape, plus an actionable hint when the code is one we know how
// to advise on. Replaces the bare
// `process.stderr.write(${formatErrorPayload(p)}\n)` dance every
// command was doing.
export function writeErrorWithHints(
  payload: unknown,
  response?: Response,
  /** codeHint false leaves out the hint for the error code, where the operation's own hint says what applies. */
  options: { codeHint?: boolean } = {},
): void {
  const formatted = formatErrorPayload(payload);
  process.stderr.write(`${formatted}\n`);
  // A route the error names, given as the command that calls it.
  for (const line of cliCommandLines(formatted)) {
    process.stderr.write(`${line}\n`);
  }
  const code = extractErrorCode(payload);
  if (
    response?.status === 429 ||
    (code !== undefined && RATE_LIMIT_CODES.has(code))
  ) {
    process.stderr.write(`${rateLimitHint(response)}\n`);
    return;
  }
  if (!code || options.codeHint === false) return;
  if (code === "grant_forbidden") {
    process.stderr.write(`${grantForbiddenHint(payload)}\n`);
    return;
  }
  if (code === API_ERROR_CODES.forbidden) {
    const hint = forbiddenHint(payload);
    if (hint) process.stderr.write(`${hint}\n`);
    return;
  }
  if (code in ERROR_CODE_HINTS) {
    const hint = ERROR_CODE_HINTS[code as keyof typeof ERROR_CODE_HINTS];
    process.stderr.write(`${hint}\n`);
    return;
  }
  if (code in NETWORK_ERROR_HINTS) {
    process.stderr.write(`${NETWORK_ERROR_HINTS[code]}\n`);
  }
}

/**
 * Surface a user-facing hint when a request comes back unauthorized.
 *
 * Deliberately does NOT mutate the saved credentials.json. Auto-
 * deleting on any 401 made transient rejections look like permanent
 * credential failures and forced unnecessary re-login cycles; we
 * surface a hint and let the user decide whether to re-authenticate.
 *
 * The one legitimate auto-delete case lives in `primitive login`'s
 * `checkExistingLogin`: the user has explicitly asked to log in,
 * existing credentials are probed, and if they fail we clean up
 * before minting a new key. That path calls `deleteCliCredentials`
 * directly rather than going through this function.
 */
export function surfaceUnauthorizedHint(params: {
  auth: ResolvedCliAuth;
  baseUrlOverridden: boolean;
  configDir: string;
  payload: unknown;
}): void {
  if (
    extractErrorCode(params.payload) !== API_ERROR_CODES.unauthorized ||
    params.auth.source !== "stored"
  ) {
    return;
  }

  const baseUrlDiffersFromSaved =
    params.baseUrlOverridden &&
    params.auth.credentials !== null &&
    params.auth.apiBaseUrl !== params.auth.credentials.api_base_url;

  if (baseUrlDiffersFromSaved) {
    // API URL overrides are intentionally hidden from --help because
    // they are for internal staging/local testing. Keep this hint as
    // the visible recovery path when an override rejects saved creds.
    process.stderr.write(
      "Saved Primitive CLI credentials were rejected by the overridden API base URL. The saved credential is preserved; unset PRIMITIVE_API_BASE_URL, run `primitive config reset` to clear configured URL overrides, or run `primitive logout` to remove the stored credential.\n",
    );
    return;
  }

  process.stderr.write(
    "Your saved Primitive CLI OAuth session was rejected. If the command was working a moment ago, please retry; brief retries often clear transient rejections. If it keeps failing, run `primitive logout && primitive signin` to mint a fresh session.\n",
  );
}

// Format milliseconds as a short human-readable wall-clock duration.
// Sub-second uses 2 decimal places (e.g. `0.18s`); seconds use 2
// decimals up to 60s (`12.34s`); minute-plus uses `Mm SS.SSs`.
// Display-only; the underlying ms value is what the caller computed.
export function formatElapsed(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds - minutes * 60;
  return `${minutes}m ${rem.toFixed(2)}s`;
}

// Run `fn` and, when `enabled` is true, write a one-line wall-clock
// timing report to stderr after it completes. Stderr keeps the row
// data on stdout grep/jq-friendly. The timer captures the full
// duration of the function (HTTPS round trip, server-side gate +
// agent + delivery, polling, etc.), not just the API call's
// server-side processing.
//
// Used by every `--time` callsite across the CLI: generated
// operation commands and hand-coded shortcuts (send, whoami,
// emails:latest, describe). Pulled out as a helper so timing is
// uniform across commands and a single render-format change
// propagates everywhere.
export async function runWithTiming<T>(
  enabled: boolean | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  if (!enabled) return fn();
  const start = Date.now();
  try {
    return await fn();
  } finally {
    process.stderr.write(`[time: ${formatElapsed(Date.now() - start)}]\n`);
  }
}

// Shared `--time` flag definition every CLI command spreads into its
// own static flags. Lives here so the flag's description and short
// name stay consistent across the hand-coded and generated commands.
export const TIME_FLAG_DESCRIPTION =
  "Print the wall-clock duration of this command to stderr after it completes (e.g. `[time: 1.34s]`). Useful for measuring `--wait` send latency, comparing CLI overhead, or capturing timing in scripts.";

// Shared description text for the api-base-url override flags. Keeps
// the wording identical across every command that includes them. The
// flags themselves are hidden from --help (internal staging/local-only).
export const API_BASE_URL_FLAG_DESCRIPTION =
  "Override the API base URL. Internal testing only; not documented to customers.";

// Helper: was the API base URL override set by the caller? Used by
// surfaceUnauthorizedHint to decide whether to
// preserve the saved credential when a 401 comes back.
export function baseUrlOverriddenFromFlags(
  flags: Record<string, unknown>,
): boolean {
  return typeof flags["api-base-url"] === "string";
}

// Helper: resolve auth from a parsed-flags bag. Mirrors what every CLI
// command does inline so the api-base-url mapping
// stays in one place as we add more migration knobs.
export function resolveCliAuthFromFlags(
  flags: Record<string, unknown>,
  configDir: string,
): ResolvedCliAuth {
  return resolveCliAuth({
    apiKey:
      typeof flags["api-key"] === "string"
        ? (flags["api-key"] as string)
        : undefined,
    apiBaseUrl:
      typeof flags["api-base-url"] === "string"
        ? (flags["api-base-url"] as string)
        : undefined,
    configDir,
  });
}

// Reserved flag names the body-field expander must never overwrite.
// `--raw-body` and `--body-file` are the JSON escape hatches.
// `--api-key`, `--api-base-url`, `--output` are
// infra. Path and query params get added before body fields and take
// precedence.
//
// Note: `--body` is intentionally NOT reserved here. The naive
// agent expectation (per AGX walkthrough) is that --body means
// "the message body content," which collides with the JSON
// escape-hatch meaning we used pre-0.12. The escape hatch is now
// `--raw-body`; --body is free to be claimed by per-field flag
// expansion as the kebab-cased version of a `body` schema field
// (e.g. on a future `body: { ... }` schema). For send-mail today,
// the body-text field is `body_text` -> `--body-text`, and there
// is no top-level `body` field, so --body remains unclaimed at
// the generated-command level. The agent shortcut `primitive
// send` defines its own --body for the message text.
const RESERVED_FLAG_NAMES = new Set([
  "api-key",
  "api-base-url",
  "raw-body",
  "body-file",
  "envelope",
  "output",
]);

function bodyFieldFlag(
  field: BodyFieldDescriptor,
  aliases?: string[],
): unknown {
  // Pass the full first-line description through. oclif's --help
  // renderer wraps long values across multiple lines on its own,
  // so a fixed character cap here just produces ellipsis-truncated
  // sentences ("body_html is required. Th...") that mislead the
  // reader. extractBodyFields already normalizes by taking only
  // the first paragraph of the schema description, so multi-
  // paragraph fields don't blow out the help.
  //
  // Field-flag UX choice: do NOT mark scalar body fields as
  // required at the oclif level even when the JSON Schema marks
  // them required. Reason: a caller can satisfy the requirement
  // either via the individual flag OR via --raw-body / --body-file.
  // Marking the flag required would force the individual-flag
  // form. The runtime body merger validates the final assembled
  // body against the same server-side schema either way.
  const common = {
    description: field.description || field.name,
    ...(aliases && aliases.length > 0 ? { aliases } : {}),
  };
  if (field.kind === "boolean")
    return Flags.boolean({ ...common, allowNo: true });
  if (field.kind === "integer") {
    return Flags.integer({ ...common, ...numericFlagOptions(field) });
  }
  if (field.kind === "number") {
    return numberFlag({ ...common, ...numericFlagOptions(field) });
  }
  if (field.enumValues) {
    return Flags.string({ ...common, options: field.enumValues });
  }
  return Flags.string(common);
}

function buildFlags(operation: PrimitiveOperationManifest): {
  flags: Record<string, unknown>;
  // Map of flag-name (kebab-case) -> body field name (snake_case)
  // for the body fields that buildFlags actually registered as
  // standalone flags. Used by the run() handler to safely collect
  // overrides without misreading values from a colliding path or
  // query param flag with the same kebab-cased name.
  bodyFieldFlagToProperty: Map<string, string>;
  // Map of flag-name -> header name for the request headers the
  // operation declares, such as `idempotency-key` -> `Idempotency-Key`.
  headerFlagToName: Map<string, string>;
} {
  const flags: Record<string, unknown> = {
    "api-key": Flags.string({
      description:
        "Primitive API key override (defaults to PRIMITIVE_API_KEY or saved OAuth login credentials)",
      env: "PRIMITIVE_API_KEY",
    }),
    // Hidden override knob for staging/local testing. Production users
    // should not override; the default routes correctly.
    "api-base-url": Flags.string({
      description:
        "Override the API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL",
      hidden: true,
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  if (!operation.binaryResponse) {
    flags.json = Flags.boolean({
      description:
        "Print exactly one JSON document on stdout, on success and on failure, and nothing on stderr. Stdout keeps its usual shape: the data payload, or with --envelope the full response envelope (data plus meta, including meta.cursor, and empty-result hints in summary). The next-cursor line is not printed; use --envelope to page. A failure prints the error with exit_code. Without --json, the cursor and notices go to stderr.",
    });
    flags.envelope = Flags.boolean({
      description:
        "Print the full response envelope, including pagination metadata such as meta.cursor. Defaults to printing only the data payload for backward compatibility.",
    });
  }

  const positional = positionalPathParameter(operation);
  const pageMaximum = pagedLimitMaximum(operation);
  for (const parameter of [...operation.pathParams, ...operation.queryParams]) {
    const override = OPERATION_PATH_FLAGS[operation.sdkName]?.[parameter.name];
    flags[parameterFlagName(operation.sdkName, parameter.name)] =
      flagForParameter(
        parameter === positional
          ? { ...parameter, required: false }
          : pageMaximum !== undefined && parameter.name === "limit"
            ? { ...parameter, maximum: PAGED_LIMIT_MAX }
            : parameter,
        override ?? pagingFlagOverride(operation, parameter),
      );
  }

  const bodyFieldFlagToProperty = new Map<string, string>();

  if (operation.hasJsonBody) {
    flags["raw-body"] = Flags.string({
      description:
        "Full request body as raw JSON. Escape hatch for nested or complex fields (e.g. arrays); prefer per-field flags (e.g. --to, --from, --body-text) when available.",
    });
    flags["body-file"] = Flags.string({
      description:
        "Path to a JSON file used as the request body. Same role as --raw-body for callers passing a saved payload.",
    });

    // Expand top-level scalar body fields into individual flags so
    // `primitive sending:send-email --to alice@x --from support@x
    // --body-text "hi"` works without constructing JSON. Driven by
    // the requestSchema embedded on the manifest. Skip flags that
    // collide with reserved names or with path/query params already
    // added above; those collisions fall back to --body.
    //
    // Collisions are tracked in the returned map so the run()
    // handler doesn't misread a path/query param's value as a
    // body-field override. (A naive "look up parsedFlags[name]"
    // pass would happily pick up the path param's value and
    // silently write it into the body.)
    const bodyFields = extractBodyFields(operation.requestSchema);
    const aliasesForOperation = OPERATION_FLAG_ALIASES[operation.sdkName];
    for (const field of bodyFields) {
      if (field.kind === "complex") continue;
      const name = flagName(field.name);
      if (RESERVED_FLAG_NAMES.has(name)) continue;
      if (flags[name] !== undefined) continue;
      flags[name] = bodyFieldFlag(field, aliasesForOperation?.[field.name]);
      bodyFieldFlagToProperty.set(name, field.name);
    }

    // CLI-only body flags for fields the request schema does not
    // declare. A generated flag of the same name wins, so once the
    // field lands in the schema this entry becomes inert.
    const extraFlags = OPERATION_EXTRA_BODY_FLAGS[operation.sdkName] ?? {};
    for (const [name, extra] of Object.entries(extraFlags)) {
      if (RESERVED_FLAG_NAMES.has(name)) continue;
      if (flags[name] !== undefined) continue;
      flags[name] = Flags.boolean({ description: extra.description });
      bodyFieldFlagToProperty.set(name, extra.property);
    }
  }

  // Declared request headers become flags too, so a generated command
  // can send what the spec lets a caller send, such as an
  // Idempotency-Key on send-email. A name already taken by another flag
  // keeps its existing meaning.
  const headerFlagToName = new Map<string, string>();
  // An operation the person may be asked to approve in the browser takes
  // the approval token as --step-up-token (--primitive-step-up, the
  // header's own flag name, still works), and --no-browser.
  if (takesStepUp(operation)) {
    // Flags taken already would mean the spec added a field of that name;
    // refuse to build rather than send it with a default value.
    for (const name of ["step-up-token", "browser"]) {
      if (flags[name] !== undefined)
        throw new Error(
          `${operation.sdkName}: --${name} is both a parameter and the approval flag`,
        );
    }
    flags["step-up-token"] = Flags.string({
      description: STEP_UP_TOKEN_FLAG_DESCRIPTION,
      aliases: [headerFlagName(STEP_UP_HEADER)],
    });
    flags.browser = Flags.boolean({
      allowNo: true,
      default: true,
      description: BROWSER_FLAG_DESCRIPTION,
    });
    headerFlagToName.set("step-up-token", STEP_UP_HEADER);
  }
  for (const parameter of operation.headerParams) {
    if (parameter.name === STEP_UP_HEADER) continue;
    const name = headerFlagName(parameter.name);
    if (RESERVED_FLAG_NAMES.has(name)) continue;
    if (flags[name] !== undefined) continue;
    flags[name] = flagForParameter(parameter);
    headerFlagToName.set(name, parameter.name);
  }

  if (EVENT_TYPES_FLAG_OPERATIONS.has(operation.sdkName)) {
    flags["event-types"] = Flags.string({
      description: EVENT_TYPES_FLAG_DESCRIPTION,
      multiple: true,
    });
  }

  if (operation.binaryResponse) {
    flags.output = Flags.string({
      description: "Write binary response bytes to a file",
    });
  }

  if (ATTACHMENT_WAIT_OPERATIONS.has(operation.sdkName)) {
    flags.wait = Flags.boolean({
      allowNo: true,
      default: true,
      description: ATTACHMENT_WAIT_FLAG_DESCRIPTION,
    });
  }

  // A flag an extension adds would change meaning if the spec gained a
  // parameter of the same name; refuse to build rather than guess.
  const extension = OPERATION_EXTENSIONS[operation.sdkName];
  // A confirmation is skipped only by --yes, so the command must have it.
  if (extension?.confirm && !("yes" in extension.flags))
    throw new Error(
      `${operation.sdkName}: a CLI extension that asks for confirmation must add --yes`,
    );
  for (const [name, flag] of Object.entries(extension?.flags ?? {})) {
    if (flags[name] !== undefined)
      throw new Error(
        `${operation.sdkName}: --${name} is both a generated flag and a CLI extension flag`,
      );
    flags[name] = flag;
  }

  return { flags, bodyFieldFlagToProperty, headerFlagToName };
}

// Pull body field values out of the parsed CLI flags. Returns
// only fields the user actually supplied (omits undefined). Used
// to override / extend the JSON --body when both forms are
// present (per-field flags take precedence on key conflicts).
//
// The `bodyFieldFlagToProperty` allowlist comes from buildFlags and
// records ONLY the flags actually registered as body-field flags.
// Without it, this function would naively read parsedFlags by
// kebab-cased field name and pick up values from a colliding path
// or query param flag, silently writing them into the body under
// the body-field key. The allowlist keeps the merge honest: only
// flags this CLI generator owns end up in the body.
function collectBodyFieldFlags(
  parsedFlags: Record<string, unknown>,
  bodyFieldFlagToProperty: Map<string, string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [flag, property] of bodyFieldFlagToProperty) {
    const value = parsedFlags[flag];
    if (value === undefined) continue;
    result[property] = value;
  }
  return result;
}

// Fold `--event-types` into the request body's rules.event_types. On update
// it starts from the endpoint's current rules unless the body already carries
// rules, because PATCH replaces rules as a whole.
async function applyEventTypesFlag(params: {
  body: unknown;
  values: string[];
  endpointId: string | undefined;
  listEndpoints: ListEndpointsFn;
  quiet: boolean;
}): Promise<Record<string, unknown>> {
  try {
    const eventTypes = parseEventTypesFlag(params.values);
    const unknown = unknownEventTypes(eventTypes);
    if (unknown.length > 0 && !params.quiet) {
      process.stderr.write(unknownEventTypesWarning(unknown));
    }
    const baseRules =
      params.endpointId !== undefined && !bodyHasRules(params.body)
        ? await currentEndpointRules(params.endpointId, params.listEndpoints)
        : {};
    return withEventTypes(params.body, eventTypes, baseRules);
  } catch (error) {
    if (error instanceof EventTypesFlagError) {
      throw new Errors.CLIError(error.message);
    }
    throw error;
  }
}

function collectValues(
  parameters: PrimitiveParameterManifest[],
  flags: Record<string, unknown>,
  sdkName?: string,
): Record<string, boolean | number | string> {
  const values: Record<string, boolean | number | string> = {};

  for (const parameter of parameters) {
    const value = coerceParameterValue(
      parameter,
      flags[parameterFlagName(sdkName, parameter.name)],
    );
    if (value !== undefined) {
      values[parameter.name] = value;
    }
  }

  return values;
}

type OperationResponseEnvelope =
  | { data?: unknown; meta?: { cursor?: string | null } }
  | null
  | undefined;

export function operationOutputPayload(
  envelope: OperationResponseEnvelope,
  includeEnvelope: boolean,
): unknown {
  return includeEnvelope ? (envelope ?? null) : (envelope?.data ?? null);
}

/**
 * The `--json` document for a generated command: the full response
 * envelope, so pagination metadata travels with the data, plus any
 * notes the command would otherwise print on stderr.
 */
export function operationJsonDocument(
  envelope: OperationResponseEnvelope,
  summary: readonly string[] = [],
): Record<string, unknown> {
  const document: Record<string, unknown> =
    envelope !== null && typeof envelope === "object"
      ? { ...envelope }
      : { data: null };
  if (summary.length > 0) document.summary = summary.join("\n");
  return document;
}

// Record statuses that need no change before verification can pass.
const SETTLED_DNS_RECORD_STATUSES = new Set(["found", "legacy"]);

/**
 * The hint for a failed domain verification: the API answers 400
 * `dns_verification_failed` with every expected record, each with its
 * `status`, in `error.details.records`. Lists the records that still need
 * work, then how to finish.
 */
export function domainVerificationFailedHint(payload: unknown): string {
  // Commands pass the error object already unwrapped from its envelope.
  const body = (
    payload !== null && typeof payload === "object" ? payload : {}
  ) as {
    details?: { records?: unknown };
    error?: { details?: { records?: unknown } };
  };
  const records = body.details?.records ?? body.error?.details?.records;
  const pending = (Array.isArray(records) ? records : []).filter(
    (record): record is Record<string, unknown> =>
      record !== null &&
      typeof record === "object" &&
      !SETTLED_DNS_RECORD_STATUSES.has(
        String((record as { status?: unknown }).status),
      ),
  );
  const lines = pending.map((record) => {
    const name = record.fqdn ?? record.name ?? "?";
    return `  ${String(record.type ?? "?")} ${String(name)} ${String(record.value ?? "")} (${String(record.status ?? "unknown")})`;
  });
  return [
    "Domain verification is incomplete.",
    ...(lines.length > 0 ? ["Records to add or fix:", ...lines] : []),
    "Add or fix those DNS records, or run `primitive domains zone-file --id <domain-id>` to download the complete zone file, then retry `primitive domains verify --id <domain-id>`.",
  ].join("\n");
}

// Discoverability hints for generated commands: a hand-rolled ergonomic
// shortcut, or a behaviour of the command an agent should know before it
// runs it (deleteEmailRule asks for confirmation). Keyed by the manifest's
// `sdkName` (camelCase, matches the generated SDK function). The
// hint is appended to the operation's --help description so an
// agent reading `<command> --help` finds the shortcut without
// having to enumerate the full command list. AGX walkthrough:
// an agent reached for `functions:update-function` to redeploy
// (which forces a JSON-stringified `code` body) when
// `functions:redeploy --file <bundle>` was the intended path.
//
// Add an entry here whenever a hand-rolled shortcut shadows a
// generated operation; the COMMANDS map in `index.ts` is the
// authoritative list of shortcuts.
export const OPERATION_HINTS: Record<string, string> = {
  deleteEmailRule:
    "Asks for confirmation first in a terminal. Pass --yes (-y) to delete without a prompt; without a terminal, or with --json, it is required.",
  addDomain:
    "Tip: after this returns a domain id, run `primitive domains zone-file --id <domain-id> --output <domain>.zone` when the user wants an importable DNS zone file.",
  verifyDomain:
    "Tip: if DNS is still missing, run `primitive domains zone-file --id <domain-id> --output <domain>.zone` to give the user an importable DNS zone file.",
  downloadDomainZoneFile:
    "Tip: prefer `primitive domains zone-file --id <domain-id> --output <domain>.zone` for CLI-friendly file output.",
  getInboxStatus:
    "Tip: prefer `primitive inbox status` for a compact readiness summary and next-step commands.",
  getSendPermissions:
    "Tip: this command answers where you may send mail to. To find usable sender domains for --from, run `primitive domains list` or `primitive inbox status` and use an address at an active verified domain.",
  sendEmail:
    "Tip: prefer `primitive send --to <address> --body <text> --attachment <file>` for file attachments. This raw command exists for callers passing JSON.",
  createFunction:
    "Tip: prefer `primitive functions deploy --name <name> --file <bundle>` for file-input ergonomics. This raw command exists for callers passing JSON.",
  updateFunction:
    "Tip: prefer `primitive functions redeploy --id <id> --file <bundle>` for file-input ergonomics. This raw command exists for callers passing JSON.",
  createFunctionSecret:
    "Tip: prefer `primitive functions set-secret --id <id> --key <KEY> --value <value> [--redeploy]` for secret writes that also push the binding live. This raw command exists for callers passing JSON.",
  setFunctionSecret:
    "Tip: prefer `primitive functions set-secret --id <id> --key <KEY> --value <value> [--redeploy]` for secret writes that also push the binding live. This raw command exists for callers passing JSON.",
  setMemory:
    "Tip: prefer `primitive memories set <key> <json-value> [--function <function-id>]` for JSON value parsing and scope flags. This raw command exists for callers passing full request JSON.",
  getMemory:
    "Tip: prefer `primitive memories get <key> [--function <function-id>]` for the common read path.",
  deleteMemory:
    "Tip: prefer `primitive memories delete <key> [--function <function-id>]` for the common delete path.",
  searchMemories:
    "Tip: prefer `primitive memories search [prefix] [--metadata-only] [--function <function-id>]` for the common search path.",
  startAgentSignup:
    "Tip: pass --terms-accepted. Capture the signup_token from the response and feed it to `primitive agent verify-agent-signup --signup-token <token> --verification-code <6-digit-code>` (the verify flag accepts --code as an alias). The high-level `primitive signup <email>` command walks an interactive user through both steps with friendlier prompts.",
  testEmailRule:
    "Tip: --expect-match and --expect-no-match (or --expect-file) set expect, the emails the rule must match and must not. When no expect is sent, by these flags or in the body, a saved rule's saved expectations are judged instead. Either way, the answer reports the expectations it judged in expectations: passed, counts and per-email results. (create-email-rule and update-email-rule instead judge the rule's saved expectations on the version they save, in expectations_check: passed, decided, failed and undecided.) The exit code follows that report: 1 when one failed; 1 when one is undecided and testing again will not decide it (its email cannot be found or read, cannot be classified, or cannot be tested: skipped); 3 when the only undecided ones can be decided later (not classified yet, or a question unanswered), so test again later. Exit 1 also means the request failed. With --json, error.code tells these apart: expectations_failed, expectations_unresolvable, expectations_undecided (exit 3), or the API's own code. Without --json a readable report follows the JSON on stderr: warnings, how each condition held, the expectations, and the values each email that did not match was compared on.",
  verifyAgentSignup:
    "Tip: pass --verification-code <code> (or --code; both work). The response carries OAuth tokens but not your assigned inbox domain; run `primitive domains list` (or `primitive whoami`) after success to see the managed *.primitive.email address that routes to this account.",
};

// Per-operation flag aliases keyed by operation.sdkName and body
// field property name (the snake_case key in the request schema).
// The generated flag is the kebab-case form (e.g. `verification-code`);
// listing aliases here adds shorter / more natural forms that oclif
// accepts on the command line and renders in --help.
//
// Add an entry whenever an agent or human reading the API field name
// would reach for something shorter than the literal field. Don't
// over-use; each alias is a name to maintain forever.
export const OPERATION_FLAG_ALIASES: Record<
  string,
  Record<string, string[]>
> = {
  verifyAgentSignup: { verification_code: ["code"] },
};

export const MAIL_RELAY_FLAG_DESCRIPTION =
  "Keep your existing mailbox provider: the domain's MX points at a Primitive mail relay, which forwards mail to your mailboxes and stores a copy in Primitive. Requires mail relay to be enabled for your account. Google Workspace only for now.";

// CLI-only boolean body flags keyed by operation.sdkName, then by
// kebab-case flag name. Each flag, when passed, sets `property` to
// true in the request body. Use for request fields the server accepts
// but the published request schema does not declare yet, so the flag
// does not show up in the generated SDK types.
export const OPERATION_EXTRA_BODY_FLAGS: Record<
  string,
  Record<string, { property: string; description: string }>
> = {
  addDomain: {
    "mail-relay": {
      property: "mail_relay",
      description: MAIL_RELAY_FLAG_DESCRIPTION,
    },
  },
};

// CLI additions to generated commands keyed by operation.sdkName: flags that
// set request body fields, a confirmation asked before the request, and a
// stderr report and exit code read from the answer. See operation-extension.ts.
export const OPERATION_EXTENSIONS: Record<string, OperationExtension> = {
  ...EMAIL_RULE_OPERATION_EXTENSIONS,
  ...ANSWER_REPORT_EXTENSIONS,
};

export const MAIL_RELAY_NOT_ENABLED_MESSAGE =
  "Mail relay is not enabled for this account, so the domain was not added. Retry without --mail-relay to point the domain's MX at Primitive directly, or ask Primitive to enable mail relay for your account.";
export const MAIL_RELAY_UNAVAILABLE_MESSAGE =
  "No mail relay is available on this API server right now, so the domain was not added. Retry later, or retry without --mail-relay to point the domain's MX at Primitive directly.";

// Per-operation error explanations keyed by operation.sdkName. Called
// with the error code, the request body that was sent, the error payload
// and the path parameters; returns a line to print after the error
// envelope, or undefined for none.
export const OPERATION_ERROR_HINTS: Record<
  string,
  (
    code: string | undefined,
    body: unknown,
    payload?: unknown,
    path?: Record<string, unknown>,
    flags?: Record<string, unknown>,
  ) => string | undefined
> = {
  inviteOrganizationMember: (code, body, payload) =>
    inviteRefusalHint(code, body, payload),
  createEndpoint: (code, body, payload) =>
    createEndpointRuleRequestHint(code, body, payload),
  updateEndpoint: (code, body, payload) =>
    updateEndpointRuleRequestHint(code, body, payload),
  updateEmailRule: (code, body, payload, path, flags) =>
    updateEmailRuleErrorHint(code, payload, path?.id, body, flags),
  verifyDomain: (code, _body, payload) =>
    code === "dns_verification_failed"
      ? domainVerificationFailedHint(payload)
      : undefined,
  addDomain: (code, body) => {
    if (code === "mail_relay_unavailable")
      return MAIL_RELAY_UNAVAILABLE_MESSAGE;
    const mailRelay =
      body !== null &&
      typeof body === "object" &&
      (body as { mail_relay?: unknown }).mail_relay === true;
    if (code === "feature_disabled" && mailRelay)
      return MAIL_RELAY_NOT_ENABLED_MESSAGE;
    return undefined;
  },
};

// Operations whose error hint, when it applies, stands in for the generic
// hint for the error code: inviting with Member (where members read all
// mail) or a role above it is refused with grant_forbidden, whose generic
// advice (widen the credential's grant) no CLI request can follow.
export const OPERATION_ERROR_HINTS_REPLACING_CODE_HINT: ReadonlySet<string> =
  new Set(["inviteOrganizationMember"]);

// Per-operation post-success hooks keyed by operation.sdkName. Fires
// AFTER the API call returns a non-error response and BEFORE the
// auto-gen command prints the JSON output, so a hook can run a side
// effect and surface a stderr notice next to the response body.
//
// Use sparingly: the auto-gen path is supposed to be a thin wrapper
// over the API. Hook only when the same response would otherwise force
// every caller to repeat the same downstream work (e.g. persisting
// OAuth tokens that the server just minted).
//
// Hooks MUST be best-effort. A throwing hook prints a warning to
// stderr and lets the response JSON through so the caller still has
// the raw payload to act on. The catch is centralized in run() below.
export type OperationSuccessHookParams = {
  envelope: { data?: unknown } | null | undefined;
  configDir: string;
  apiBaseUrl: string;
  writeStderr: (chunk: string) => void;
};
export const OPERATION_SUCCESS_HOOKS: Record<
  string,
  (params: OperationSuccessHookParams) => void
> = {
  // verifyAgentSignup just minted OAuth tokens for the caller. Persist
  // them through the same path the human `signup` command uses, so
  // `primitive whoami` works on the very next call. Without this, an
  // agent that signs up via the bare API command gets tokens in the
  // response JSON but no credentials.json, and the next CLI call
  // returns "not authenticated" even though the tokens are still
  // valid. The original AGX walkthrough caught this and worked around
  // it by writing the tokens to a project-local .env.local; this hook
  // is the cure.
  verifyAgentSignup: ({ envelope, configDir, apiBaseUrl, writeStderr }) => {
    const data = envelope?.data as AgentSignupVerifyResult | undefined;
    if (!data?.access_token || !data?.refresh_token) return;
    saveSignupCredentials({ apiBaseUrl, configDir, signup: data });
    writeStderr(
      "Credentials saved to the CLI config; `primitive whoami` will work on the next call.\n",
    );
  },
};

export function createOperationCommand(
  operation: PrimitiveOperationManifest,
): typeof Command {
  const { flags, bodyFieldFlagToProperty, headerFlagToName } =
    buildFlags(operation);

  // Append a "Body fields" summary to the description so agents
  // running `<command> --help` learn the JSON shape immediately.
  // Without this, `--help` only said "JSON request body" and agents
  // had to probe the server with malformed payloads to discover
  // required fields. (CLI agent walkthrough surfaced this.)
  const dashboardOnly = isDashboardOnly(operation);
  const baseDescription = `${dashboardOnly ? `${DASHBOARD_ONLY_NOTE}\n\n` : ""}${
    operation.description !== null && operation.description !== undefined
      ? canonicalizeCliReferences(operation.description)
      : `${operation.method} ${operation.path}`
  }`;
  const schemaSummary = operation.hasJsonBody
    ? renderRequestSchemaSummary(
        operation.requestSchema,
        OPERATION_EXTENSIONS[operation.sdkName]?.bodyProperties,
      )
    : null;
  const hint = OPERATION_HINTS[operation.sdkName];
  const descriptionWithSchema = schemaSummary
    ? `${baseDescription}\n\n${schemaSummary}`
    : baseDescription;
  const fullDescription = hint
    ? `${descriptionWithSchema}\n\n${hint}`
    : descriptionWithSchema;

  const flagNames = Object.keys(flags);
  const extension = OPERATION_EXTENSIONS[operation.sdkName];
  const positional = positionalPathParameter(operation);
  const positionalFlag = positional
    ? parameterFlagName(operation.sdkName, positional.name)
    : undefined;
  class OperationCommand extends Command {
    static description = fullDescription;

    static flags = flags as never;

    // The only path parameter can come first, as an argument, or as its flag.
    static args = (
      positional && positionalFlag
        ? {
            [positionalFlag]: Args.string({
              description: `${sentence(OPERATION_PATH_FLAGS[operation.sdkName]?.[positional.name]?.description ?? positional.description ?? positional.name)} The same as --${positionalFlag}; give one of the two.`,
              required: false,
            }),
          }
        : {}
    ) as never;

    static summary = `${
      operation.summary ?? `${operation.method} ${operation.path}`
    }${dashboardOnly ? DASHBOARD_ONLY_SUMMARY : ""}`;

    async run(): Promise<void> {
      const { args, flags } = await this.parse(OperationCommand as never).catch(
        (error: unknown) => {
          throw withFlagSuggestion(error, flagNames);
        },
      );
      const parsedFlags = flags as Record<string, unknown>;
      if (positionalFlag) {
        const fromArgument = (args as Record<string, unknown>)[positionalFlag];
        const fromFlag = parsedFlags[positionalFlag];
        if (
          fromArgument !== undefined &&
          fromFlag !== undefined &&
          String(fromArgument) !== String(fromFlag)
        ) {
          throw new Errors.CLIError(
            `Give the ${positionalFlag} once: as the first argument or with --${positionalFlag}, not both with different values.`,
            { exit: 2 },
          );
        }
        const value = fromFlag ?? fromArgument;
        if (value === undefined || value === "") {
          throw new Errors.CLIError(
            `Missing the ${positionalFlag}: pass it as the first argument or with --${positionalFlag}.`,
            { exit: 2 },
          );
        }
        parsedFlags[positionalFlag] = value;
      }
      // A request that cannot be undone is confirmed first, before any
      // credential is read: in a terminal by asking, otherwise only by --yes.
      const confirm = extension?.confirm;
      if (confirm && parsedFlags.yes !== true) {
        if (
          parsedFlags.json === true ||
          !(process.stdin.isTTY && process.stderr.isTTY)
        ) {
          throw new Errors.CLIError(confirm.noTerminal, { exit: 2 });
        }
        const answer = await promptLine(confirm.question(parsedFlags));
        if (!/^y(es)?$/i.test(answer.trim())) {
          process.stderr.write(`${confirm.cancelled}\n`);
          process.exitCode = 1;
          return;
        }
      }
      const headers = collectHeaderFlags(parsedFlags, headerFlagToName);
      if (
        [
          "startAgentSignup",
          "verifyAgentSignup",
          "resendAgentSignupVerification",
        ].includes(operation.operationId)
      ) {
        requireDefaultLoginProfile();
      }
      await runWithTiming(parsedFlags.time === true, async () => {
        const { apiClient, auth, baseUrlOverridden } =
          await createAuthenticatedCliApiClient({
            apiKey:
              typeof parsedFlags["api-key"] === "string"
                ? (parsedFlags["api-key"] as string)
                : undefined,
            apiBaseUrl:
              typeof parsedFlags["api-base-url"] === "string"
                ? (parsedFlags["api-base-url"] as string)
                : undefined,
            configDir: this.config.configDir,
          });

        // Two body sources, merged: explicit JSON via --body /
        // --body-file (the base) plus per-field flags (the
        // overrides). Per-field flag values take precedence on key
        // conflicts so a caller can pass a base payload via --body
        // and override one field on the command line.
        let body: unknown;
        if (operation.hasJsonBody) {
          const explicit = readJsonBody(parsedFlags);
          const overrides = collectBodyFieldFlags(
            parsedFlags,
            bodyFieldFlagToProperty,
          );
          // Fields an extension's flags set, merged like the per-field
          // flags. Named by the flag that set them in the error below.
          const extensionFlagFor = new Map<string, string>();
          for (const field of extension?.bodyFields?.(parsedFlags) ?? []) {
            overrides[field.property] = field.value;
            extensionFlagFor.set(field.property, field.flag);
          }

          if (Object.keys(overrides).length > 0) {
            if (explicit === undefined) {
              body = overrides;
            } else if (
              explicit !== null &&
              typeof explicit === "object" &&
              !Array.isArray(explicit)
            ) {
              body = { ...(explicit as Record<string, unknown>), ...overrides };
            } else {
              // Caller passed --raw-body as null, an array, or a
              // primitive AND also passed per-field flags. We can't
              // merge per-field overrides into a non-object body
              // shape, and silently dropping either source would
              // leave the caller's actual intent unclear. Refuse
              // loudly so the next attempt is unambiguous.
              const explicitKind =
                explicit === null
                  ? "null"
                  : Array.isArray(explicit)
                    ? "array"
                    : typeof explicit;
              const overrideFlags = Object.keys(overrides)
                .map((p) => extensionFlagFor.get(p) ?? `--${flagName(p)}`)
                .join(", ");
              throw new Errors.CLIError(
                `--raw-body must be a JSON object when also passing per-field flags (got ${explicitKind}); supplied per-field flags: ${overrideFlags}. Either drop --raw-body and rely on the per-field flags, or move every field into the JSON --raw-body and drop the flags.`,
              );
            }
          } else {
            body = explicit;
          }
        }

        if (
          EVENT_TYPES_FLAG_OPERATIONS.has(operation.sdkName) &&
          Array.isArray(parsedFlags["event-types"])
        ) {
          body = await applyEventTypesFlag({
            body,
            values: parsedFlags["event-types"] as string[],
            endpointId:
              operation.sdkName === "updateEndpoint" &&
              typeof parsedFlags.id === "string"
                ? parsedFlags.id
                : undefined,
            listEndpoints: () =>
              operations.listEndpoints({
                client: apiClient.client,
                responseStyle: "fields",
              }) as ReturnType<ListEndpointsFn>,
            quiet: parsedFlags.json === true,
          });
        }

        if (operation.bodyRequired && body === undefined) {
          throw new Errors.CLIError(
            `Operation ${operation.operationId} requires a body. Pass each field as a --flag (see --help) or supply JSON via --raw-body / --body-file.`,
          );
        }

        const operationFn = operations[
          operation.sdkName as OperationName
        ] as unknown as OperationExecutor;
        const query = collectValues(
          operation.queryParams,
          parsedFlags,
          operation.sdkName,
        );
        // Set when this list or search call asked for reply state, so an
        // older server that lacks it fails loudly instead of returning
        // unfiltered mail that looks filtered.
        const replyStateSurface = replyStateSurfaceForOperation(
          operation.sdkName,
          query,
        );
        // Same for the `automated` filter.
        const automatedSurface = automatedSurfaceForOperation(
          operation.sdkName,
          query,
        );
        // And for `from_verified`, a trust filter: rows without the
        // requested value are refused, never printed.
        const fromVerified = fromVerifiedExpectation(operation.sdkName, query);
        const callOperation = (
          stepUpToken?: string,
          pageQuery: Record<string, unknown> = query,
        ) => {
          const sent = stepUpToken
            ? { ...headers, [STEP_UP_HEADER]: stepUpToken }
            : headers;
          return operationFn({
            body,
            client: apiClient.client,
            ...(Object.keys(sent).length > 0 ? { headers: sent } : {}),
            parseAs: operation.binaryResponse ? "blob" : "auto",
            path: collectValues(
              operation.pathParams,
              parsedFlags,
              operation.sdkName,
            ),
            query: pageQuery,
            responseStyle: "fields",
          });
        };
        // Attachment content can be briefly not ready after an email
        // arrives. Wait for it rather than making the caller poll. The
        // note goes to stderr: stdout carries only the downloaded bytes.
        // An operation the person may be asked to approve: on
        // step_up_required, show the link, wait for the token and send it
        // once more. The token from --step-up-token is sent from the start.
        let stepUpUrl: string | undefined;
        const callWithApproval = async () => {
          const approved = await withApproval(
            async (token) => {
              const attempt = await callOperation(token);
              return {
                ok: !attempt.error,
                payload: attempt.error
                  ? extractErrorPayload(attempt.error)
                  : undefined,
                attempt,
              };
            },
            terminalApprovalIo({
              stepUpToken:
                typeof parsedFlags["step-up-token"] === "string"
                  ? (parsedFlags["step-up-token"] as string)
                  : undefined,
              openBrowser: parsedFlags.browser !== false,
              json: parsedFlags.json === true,
            }),
          );
          stepUpUrl = approved.stepUpUrl;
          return approved.attempt;
        };
        // A --limit above the API's per-request cap is fetched in pages of
        // that cap and printed as one list, with the cursor of the last page.
        // A long-poll --wait and a forward --since tail stay one request.
        const pageMaximum = pagedLimitMaximum(operation);
        const wanted = typeof query.limit === "number" ? query.limit : 0;
        const paged = pageMaximum !== undefined && wanted > pageMaximum;
        if (paged) {
          const single =
            typeof query.wait === "number" && query.wait > 0
              ? "--wait"
              : query.since !== undefined
                ? "--since"
                : undefined;
          if (single)
            throw new Errors.CLIError(
              `${single} takes a --limit of at most ${pageMaximum}, since it reads one page; a larger --limit is fetched in several requests.`,
              { exit: 2 },
            );
        }
        // Set when the request budget ends paging before --limit is reached.
        let pagingNote: string | undefined;
        const callPaged = async () => {
          const max = pageMaximum ?? wanted;
          const rows: unknown[] = [];
          let sentCursor = query.cursor;
          let last = await callOperation(undefined, {
            ...query,
            limit: Math.min(max, wanted),
          });
          // Only a null cursor ends a list: a page can come back short, even
          // empty, with more to read. Bound the requests anyway, and say so
          // when the bound is what stopped it.
          const budget = Math.ceil(wanted / max) + 20;
          for (let requests = 1; ; requests += 1) {
            if (last.error) return last;
            const envelope = last.data as OperationResponseEnvelope;
            const page = Array.isArray(envelope?.data) ? envelope.data : [];
            rows.push(...page);
            const cursor = envelope?.meta?.cursor ?? undefined;
            const exhausted =
              Boolean(cursor) &&
              cursor !== sentCursor &&
              rows.length < wanted &&
              requests >= budget;
            if (exhausted)
              pagingNote = `Stopped after ${requests} requests with ${rows.length} of ${wanted}; more may remain. Continue with --cursor ${cursor}.`;
            if (
              !cursor ||
              cursor === sentCursor ||
              rows.length >= wanted ||
              exhausted
            ) {
              return {
                ...last,
                data: {
                  ...(envelope ?? {}),
                  data: rows,
                  meta: {
                    ...(envelope?.meta ?? {}),
                    limit: wanted,
                    cursor: cursor ?? null,
                  },
                },
              };
            }
            sentCursor = cursor;
            last = await callOperation(undefined, {
              ...query,
              cursor,
              limit: Math.min(max, wanted - rows.length),
            });
          }
        };
        // Giving someone a role that reads every mailbox says so first, so
        // the person approving the change sees it before the step-up link.
        // Under --json the guard carries it in the document's warnings, on
        // success and on failure (a step-up answer included).
        if (operation.sdkName === "setMemberRole") {
          const role =
            body && typeof body === "object"
              ? (body as { role?: unknown }).role
              : undefined;
          const warning =
            typeof role === "string"
              ? roleReadsAllMailWarning(role, await readRoles(apiClient.client))
              : null;
          if (warning) process.stderr.write(`${warning}\n`);
        }
        const result = paged
          ? await callPaged()
          : takesStepUp(operation)
            ? await callWithApproval()
            : ATTACHMENT_WAIT_OPERATIONS.has(operation.sdkName)
              ? await withAttachmentWait(callOperation, {
                  wait: parsedFlags.wait !== false,
                  errorCode: (error) =>
                    extractErrorCode(extractErrorPayload(error)),
                  onFirstWait: () => {
                    process.stderr.write(
                      `Attachment content is not ready yet; waiting up to ${ATTACHMENT_WAIT_MAX_MS / 1000}s. Pass --no-wait to return immediately.\n`,
                    );
                  },
                })
              : await callOperation();

        if (result.error) {
          const errorPayload = extractErrorPayload(result.error);
          const operationErrorHint = OPERATION_ERROR_HINTS[operation.sdkName]?.(
            extractErrorCode(errorPayload),
            body,
            errorPayload,
            collectValues(operation.pathParams, parsedFlags, operation.sdkName),
            parsedFlags,
          );
          writeErrorWithHints(errorPayload, result.response, {
            codeHint: !(
              operationErrorHint &&
              OPERATION_ERROR_HINTS_REPLACING_CODE_HINT.has(operation.sdkName)
            ),
          });
          if (operationErrorHint) {
            process.stderr.write(`${operationErrorHint}\n`);
          }
          if (stepUpUrl) process.stderr.write(approveThenRerunHint(stepUpUrl));
          if (replyStateSurface && isAwaitingRejectedError(errorPayload)) {
            process.stderr.write(
              `${awaitingRejectedError(replyStateSurface).message}\n`,
            );
          }
          if (automatedSurface && isAutomatedRejectedError(errorPayload)) {
            process.stderr.write(
              `${automatedRejectedError(automatedSurface).message}\n`,
            );
          }
          surfaceUnauthorizedHint({
            auth,
            baseUrlOverridden,
            configDir: this.config.configDir,
            payload: errorPayload,
          });
          // Function-endpoint redirect. POST /endpoints/{id}/test on a
          // function-kind endpoint returns `not_found` even though the
          // same id IS visible in `endpoints:list-endpoints`. The hook
          // looks the id up via listEndpoints; if it matches a
          // function-kind row, it prints a redirect to
          // `functions:test-function` (with the function id) so the
          // caller does not have to translate the id themselves.
          // No-op for any other operation, any other error code, or
          // when the lookup misses or fails.
          const listClient = apiClient.client;
          const listEndpointsFn: ListEndpointsFn = () =>
            operations.listEndpoints({
              client: listClient,
              responseStyle: "fields",
            }) as ReturnType<ListEndpointsFn>;
          await maybeWriteFunctionEndpointRedirect({
            sdkName: operation.sdkName,
            errorCode: extractErrorCode(errorPayload),
            endpointId:
              typeof parsedFlags.id === "string" ? parsedFlags.id : undefined,
            listEndpoints: listEndpointsFn,
            writeStderr: (chunk) => {
              process.stderr.write(chunk);
            },
          });
          // A wake names one profile's email; read under another profile
          // it is not_found. Say which profile holds it, or drop a notice
          // that its own profile can no longer read.
          if (
            operation.sdkName === "getEmail" &&
            extractErrorCode(errorPayload) === "not_found" &&
            typeof parsedFlags.id === "string"
          )
            await explainPendingMailNotFound(
              this.config.configDir,
              parsedFlags.id,
            );
          // A hook never turns a failed request into exit 0.
          process.exitCode = extension?.errorExitCode?.(errorPayload) || 1;
          return;
        }

        if (operation.binaryResponse) {
          const blob = result.data as Blob | File;
          const bytes = Buffer.from(await blob.arrayBuffer());
          const output = parsedFlags.output;

          if (typeof output === "string") {
            writeFileSync(output, bytes);
            return;
          }

          process.stdout.write(bytes);
          return;
        }

        const envelope = result.data as OperationResponseEnvelope;
        if (replyStateSurface) {
          try {
            const rows = Array.isArray(envelope?.data) ? envelope.data : [];
            assertAwaitingFilterRows(rows, replyStateSurface);
            // Search ignores unknown parameters, so an empty page alone
            // does not show the filter was applied. List rejects them.
            if (rows.length === 0 && operation.sdkName === "searchEmails") {
              await ensureSearchReportsReplyState(apiClient);
            }
          } catch (error) {
            if (!(error instanceof ReplyStateUnsupportedError)) throw error;
            process.stderr.write(`${error.message}\n`);
            process.exitCode = 1;
            return;
          }
        }
        if (automatedSurface) {
          try {
            const rows = Array.isArray(envelope?.data) ? envelope.data : [];
            const expected = expectedAutomatedVerdicts(
              query?.automated === "true"
                ? true
                : query?.automated === "false"
                  ? false
                  : undefined,
              typeof query?.q === "string" ? query.q : undefined,
            );
            assertAutomatedVerdict(rows, automatedSurface, expected);
            if (rows.length === 0 && operation.sdkName === "searchEmails") {
              await ensureSearchReportsAutomated(apiClient);
            }
          } catch (error) {
            if (!(error instanceof AutomatedFilterUnsupportedError))
              throw error;
            process.stderr.write(`${error.message}\n`);
            process.exitCode = 1;
            return;
          }
        }
        if (fromVerified) {
          try {
            const rows = Array.isArray(envelope?.data) ? envelope.data : [];
            assertFromVerifiedRows(rows, fromVerified);
          } catch (error) {
            if (!(error instanceof FromVerifiedFilterUnsupportedError))
              throw error;
            process.stderr.write(`${error.message}\n`);
            process.exitCode = 1;
            return;
          }
        }
        // With --json stdout keeps its usual shape (the data payload, or
        // the full envelope with --envelope, where meta.cursor travels) and
        // stderr stays empty, so a merged stream parses as one document.
        const jsonOutput = parsedFlags.json === true;
        const withEnvelope = parsedFlags.envelope === true;
        const cursor = envelope?.meta?.cursor;
        if (cursor && !jsonOutput) {
          process.stderr.write(`next cursor: ${cursor}\n`);
        }
        if (pagingNote && !jsonOutput) process.stderr.write(`${pagingNote}\n`);
        const summary: string[] = [];

        // Empty-result hint. When a list-style operation returns
        // an empty array, emit an operation-specific note to
        // stderr so a naive caller can distinguish "nothing here"
        // from "something isn't set up." Stdout still gets the
        // raw `[]` so machine-readable output is unchanged. The
        // AGX walkthrough flagged this: `list-deliveries` returning
        // `[]` left the agent unsure whether they had an empty
        // delivery log or no endpoints configured at all.
        // Under --json the hint rides in the envelope's summary when one is
        // printed; a bare data payload has nowhere to carry it, so nothing
        // more is read for it.
        if (
          Array.isArray(envelope?.data) &&
          envelope.data.length === 0 &&
          (!jsonOutput || withEnvelope)
        ) {
          // An empty email list says what was asked and what this
          // credential reads, not that the account has no mail.
          // A --since tail is polled, so its empty pages do not each read
          // the grant too, and nor does a page with more to read.
          const tail = query.since !== undefined;
          const more = envelope?.meta?.cursor ?? null;
          const hint =
            operation.sdkName === "listEmails"
              ? emptyEmailListHint({
                  filterFlags: listFilters(query).map(
                    (name) => `--${parameterFlagName(operation.sdkName, name)}`,
                  ),
                  ...(tail
                    ? { pastFlag: "--since" as const }
                    : query.cursor !== undefined
                      ? { pastFlag: "--cursor" as const }
                      : {}),
                  // A tail is caught up whatever cursor it carries: --since and --cursor do not mix.
                  nextCursor: tail ? null : more,
                  caller:
                    tail || more
                      ? null
                      : await readCallerMailFor(auth, apiClient.client),
                })
              : (emptyRuleListHint(operation.sdkName, query) ??
                EMPTY_RESULT_HINTS[operation.sdkName]);
          if (hint && jsonOutput) summary.push(hint);
          else if (hint) process.stderr.write(`${hint}\n`);
        }

        // A connected address's sent list also carries delivered sends
        // other addresses made to it. Say so, so they are not read as this
        // address's own sends.
        if (operation.sdkName === "listSentEmails") {
          const note = sentListOtherSendersNote(
            envelope?.data,
            auth.connectedAgent?.agentAddress,
          );
          if (note && jsonOutput) {
            if (withEnvelope) summary.push(note);
          } else if (note) process.stderr.write(`${note}\n`);
        }

        // Idempotent-replay banner. Send-mail (and any future
        // operation that might surface this flag) carries
        // `idempotent_replay: true` when the server short-circuited
        // and returned a cached row. The helper is a no-op for
        // responses without the flag so we can call it
        // unconditionally without per-operation gating.
        writeIdempotentReplayBannerIfReplay(envelope?.data, {
          write: (chunk) => {
            process.stderr.write(chunk);
          },
        });

        // Per-operation post-success hook. See OPERATION_SUCCESS_HOOKS
        // for the contract. A throwing hook never blocks the response
        // JSON from reaching stdout: we catch, surface a warning to
        // stderr, and let this.log run, so the caller still has the
        // raw payload to act on manually.
        const successHook = OPERATION_SUCCESS_HOOKS[operation.sdkName];
        if (successHook) {
          try {
            successHook({
              envelope,
              configDir: this.config.configDir,
              apiBaseUrl: auth.apiBaseUrl,
              writeStderr: (chunk) => {
                process.stderr.write(chunk);
              },
            });
          } catch (hookError) {
            const detail =
              hookError instanceof Error
                ? hookError.message
                : String(hookError);
            process.stderr.write(
              `Warning: ${operation.sdkName} succeeded but its post-success hook threw (${detail}). The response below is still valid; act on it manually.\n`,
            );
          }
        }

        // An extension's reading of the answer: lines for stderr after the
        // JSON, and an exit code. Under --json the lines are left out, and a
        // non-zero exit code's reason travels in the document's `error`. Like
        // a success hook, a report that throws never costs the JSON: one
        // warning line is printed in its place.
        let report: OperationReport | undefined;
        let reportError: string | undefined;
        try {
          report = extension?.report?.(envelope?.data, {
            body,
            path: collectValues(
              operation.pathParams,
              parsedFlags,
              operation.sdkName,
            ),
            flags: parsedFlags,
          });
        } catch (error) {
          reportError = error instanceof Error ? error.message : String(error);
          let fallback: number | undefined;
          try {
            fallback = extension?.fallbackExitCode?.(envelope?.data, {
              body,
              flags: parsedFlags,
            });
          } catch {
            fallback = 1;
          }
          if (fallback)
            report = {
              lines: [],
              exitCode: fallback,
              error: {
                code: "expectations_not_passed",
                message:
                  "The answer's expectations were not all shown to pass; read their result in the answer.",
              },
            };
        }
        let printed =
          jsonOutput && withEnvelope
            ? operationJsonDocument(envelope, summary)
            : operationOutputPayload(envelope, withEnvelope);
        if (
          jsonOutput &&
          report?.exitCode &&
          report.error &&
          printed !== null &&
          typeof printed === "object" &&
          !Array.isArray(printed)
        ) {
          printed = { ...printed, error: report.error };
        }
        this.log(JSON.stringify(printed, null, 2));
        if (reportError !== undefined) {
          process.stderr.write(
            `Warning: ${operation.sdkName} succeeded but its report could not be built (${reportError}). The JSON above is the full answer; read it rather than the exit code.\n`,
          );
        }
        if (report && !jsonOutput) {
          for (const line of report.lines) process.stderr.write(`${line}\n`);
        }
        if (reportError !== undefined && report?.exitCode && !jsonOutput) {
          process.stderr.write(
            `The answer's expectations were not all shown to pass, so the command exits ${report.exitCode}.\n`,
          );
        }
        if (report?.exitCode) process.exitCode = report.exitCode;
      });
    }
  }

  return OperationCommand;
}

// Empty-state hints for list-style operations whose empty result
// would otherwise leave the caller wondering "is this empty
// because there's nothing to list, or because something earlier
// in the setup chain isn't done?" Keys are the manifest's
// `sdkName` for the operation. Operations without an entry fall
// back to no hint (silent empty array, same as before).
export const EMPTY_RESULT_HINTS: Record<string, string> = {
  listDeliveries:
    "(no results) No webhook deliveries logged yet. If you have an endpoint configured but expected to see test fires here: test deliveries from `primitive endpoints test` are NOT logged in this list, they're synchronous and visible only in the test-endpoint command's response. Real deliveries are logged when an event fans out to your endpoints: an inbound `email.received`, or a `sent_email.*` event for an endpoint that lists it in rules.event_types (they arrive within a few minutes of the result). If you have no endpoints, run `primitive endpoints list` to check.",
  listEndpoints:
    "(no results) No webhook endpoints configured. Add one with `primitive endpoints create --url <your-url>`.",
  listDomains:
    "(no results) No domains on this account. Add one with `primitive domains add --domain <yourdomain.example>`.",
  listFilters: "(no results) No filter rules configured.",
  listFunctions:
    "(no results) No Functions configured yet. Start with `primitive functions templates`, then `primitive functions init --template <template>` and `primitive functions deploy --name <name> --file <bundle>`.",
};

/**
 * An empty rule request, share or objection list, read by the filters the
 * call left at their defaults: each list shows only part of what you can see
 * by default (pending requests made to you; live shares made with you;
 * pending objections you made), so an empty answer says which flags widen
 * it. Undefined for any other list, when every filter was given, or on a
 * later page (--cursor), which is empty only past the end.
 */
export function emptyRuleListHint(
  sdkName: string,
  query: Record<string, unknown>,
): string | undefined {
  if (query.cursor !== undefined) return undefined;
  const unset = (name: string) => query[name] === undefined;
  const said = (noun: string, phrase: string | null, flags: string[]) =>
    phrase === null
      ? undefined
      : `(no results) No ${noun} match. By default this lists only ${phrase}: add \`${flags.join(" ")}\` to widen it.`;
  if (sdkName === "listEmailRuleRequests") {
    const box = unset("box");
    const status = unset("status");
    const phrase =
      box && status
        ? "pending requests made to you"
        : box
          ? "requests made to you"
          : status
            ? "pending requests"
            : null;
    return said("requests", phrase, [
      ...(box ? ["--box all"] : []),
      ...(status ? ["--status any"] : []),
    ]);
  }
  if (sdkName === "listEmailRuleShares") {
    const box = unset("box");
    const live = unset("live");
    const phrase =
      box && live
        ? "live shares made with you"
        : box
          ? "shares made with you"
          : live
            ? "live shares"
            : null;
    return said("shares", phrase, [
      ...(box ? ["--box all"] : []),
      ...(live ? ["--live any"] : []),
    ]);
  }
  if (sdkName === "listGivenEmailRuleShares")
    return said("shares", unset("live") ? "live shares of your mail" : null, [
      "--live any",
    ]);
  if (sdkName === "listEmailRuleObjections") {
    const box = unset("box");
    const status = unset("status");
    const phrase =
      box && status
        ? "pending objections you made"
        : box
          ? "objections you made"
          : status
            ? "pending objections"
            : null;
    return said("objections", phrase, [
      ...(box ? ["--box all"] : []),
      ...(status ? ["--status any"] : []),
    ]);
  }
  return undefined;
}

function canonicalizeCliReferences(description: string): string {
  return description
    .replaceAll("`primitive emails:latest`", "`primitive emails latest`")
    .replaceAll(
      "`primitive describe emails:get-email | jq '.responseSchema.properties'`",
      "`primitive describe emails:get | jq '.responseSchema.properties'`",
    );
}
