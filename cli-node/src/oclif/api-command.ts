import { readFileSync, writeFileSync } from "node:fs";
import { Command, Errors, Flags } from "@oclif/core";
import type {
  ErrorResponse,
  PrimitiveOperationManifest,
  PrimitiveParameterManifest,
} from "@primitivedotdev/api-core";
import { operations } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "./api-client.js";
import {
  deleteCliCredentials,
  type ResolvedCliAuth,
  resolveCliAuth,
} from "./auth.js";
import {
  type ListEndpointsFn,
  maybeWriteFunctionEndpointRedirect,
} from "./endpoints-test-redirect.js";
import { writeIdempotentReplayBannerIfReplay } from "./idempotent-replay-banner.js";

type OperationName = keyof typeof operations;
export type ApiErrorCode = ErrorResponse["error"]["code"];

export const API_ERROR_CODES = {
  accessDenied: "access_denied",
  authorizationPending: "authorization_pending",
  expiredToken: "expired_token",
  invalidDeviceCode: "invalid_device_code",
  notFound: "not_found",
  slowDown: "slow_down",
  unauthorized: "unauthorized",
} as const satisfies Record<string, ApiErrorCode>;

type OperationExecutor = (options: Record<string, unknown>) => Promise<{
  data?: Blob | File | Record<string, unknown> | Record<string, unknown>[];
  error?: unknown;
}>;

function flagName(parameterName: string): string {
  return parameterName.replace(/_/g, "-");
}

function flagDescription(parameter: PrimitiveParameterManifest): string {
  return parameter.description ?? parameter.name;
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
): string | null {
  const fields = extractBodyFields(schema);
  if (fields.length === 0) return null;

  const complex = fields.filter((f) => f.kind === "complex");
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
): unknown {
  const common = {
    description: flagDescription(parameter),
    required: parameter.required,
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
    "Hint: run `primitive login`, pass --api-key explicitly, or set PRIMITIVE_API_KEY in your environment. `primitive whoami` is the fastest way to verify a key is live.",
} as const satisfies Partial<Record<ApiErrorCode, string>>;

// Network-layer hints keyed by Node's `cause.code` on a fetch failure.
// Separate from ERROR_CODE_HINTS because these aren't API-server error
// codes — they're the values Node sets on the underlying system call
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
    "Hint: DNS lookup failed. Check /etc/resolv.conf inside containers, and try `curl -v https://www.primitive.dev/api/v1/account` to confirm the host resolves. `primitive doctor` reports the local environment in one shot.",
};

// Write a server / SDK error to stderr in the canonical envelope
// shape, plus an actionable hint when the code is one we know how
// to advise on. Replaces the bare
// `process.stderr.write(${formatErrorPayload(p)}\n)` dance every
// command was doing.
export function writeErrorWithHints(payload: unknown): void {
  process.stderr.write(`${formatErrorPayload(payload)}\n`);
  const code = extractErrorCode(payload);
  if (!code) return;
  if (code in ERROR_CODE_HINTS) {
    const hint = ERROR_CODE_HINTS[code as keyof typeof ERROR_CODE_HINTS];
    process.stderr.write(`${hint}\n`);
    return;
  }
  if (code in NETWORK_ERROR_HINTS) {
    process.stderr.write(`${NETWORK_ERROR_HINTS[code]}\n`);
  }
}

export function removeStaleSavedCredentialOnUnauthorized(params: {
  auth: ResolvedCliAuth;
  baseUrlOverridden: boolean;
  configDir: string;
  payload: unknown;
}): boolean {
  if (
    extractErrorCode(params.payload) !== API_ERROR_CODES.unauthorized ||
    params.auth.source !== "stored"
  ) {
    return false;
  }

  const baseUrlDiffersFromSaved =
    params.baseUrlOverridden &&
    params.auth.credentials !== null &&
    params.auth.apiBaseUrl1 !== params.auth.credentials.api_base_url_1;

  if (baseUrlDiffersFromSaved) {
    // API URL overrides are intentionally hidden from --help because
    // they are for internal staging/local testing. Keep this hint as
    // the visible recovery path when an override rejects saved creds.
    process.stderr.write(
      "Saved Primitive CLI credentials were rejected by the overridden API base URL. The local credential was not removed; unset PRIMITIVE_API_BASE_URL_1, run `primitive config reset` to clear configured URL overrides, or run `primitive logout` to remove the stored credential.\n",
    );
    return false;
  }

  deleteCliCredentials(params.configDir);
  process.stderr.write(
    "Removed saved Primitive CLI credentials because the backing API key is no longer valid. Run `primitive login` to create a new one.\n",
  );
  return true;
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
export const API_BASE_URL_1_FLAG_DESCRIPTION =
  "Override the primary API base URL. Internal testing only; not documented to customers.";
export const API_BASE_URL_2_FLAG_DESCRIPTION =
  "Override the attachments-supporting send host base URL. Internal testing only; not documented to customers.";

// Helper: was either api-base-url override set by the caller? Used by
// removeStaleSavedCredentialOnUnauthorized to decide whether to
// preserve the saved credential when a 401 comes back.
export function baseUrlOverriddenFromFlags(
  flags: Record<string, unknown>,
): boolean {
  return (
    typeof flags["api-base-url-1"] === "string" ||
    typeof flags["api-base-url-2"] === "string"
  );
}

// Helper: resolve auth from a parsed-flags bag. Mirrors what every CLI
// command does inline so the api-base-url-1 / api-base-url-2 mapping
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
    apiBaseUrl1:
      typeof flags["api-base-url-1"] === "string"
        ? (flags["api-base-url-1"] as string)
        : undefined,
    apiBaseUrl2:
      typeof flags["api-base-url-2"] === "string"
        ? (flags["api-base-url-2"] as string)
        : undefined,
    configDir,
  });
}

// Operations that route to the attachments-supporting host
// (apiBaseUrl2) instead of the primary API host. Internal to the CLI:
// as more operations migrate to host 2 over time, add their generated
// sdkName here. Today it is just /send-mail.
const HOST_2_OPERATIONS = new Set<string>(["sendEmail"]);

// Reserved flag names the body-field expander must never overwrite.
// `--raw-body` and `--body-file` are the JSON escape hatches.
// `--api-key`, `--api-base-url-1`, `--api-base-url-2`, `--output` are
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
  "api-base-url-1",
  "api-base-url-2",
  "raw-body",
  "body-file",
  "envelope",
  "output",
]);

function bodyFieldFlag(field: BodyFieldDescriptor): unknown {
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
  };
  if (field.kind === "boolean") return Flags.boolean(common);
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
} {
  const flags: Record<string, unknown> = {
    "api-key": Flags.string({
      description:
        "Primitive API key (defaults to PRIMITIVE_API_KEY or saved `primitive login` credentials)",
      env: "PRIMITIVE_API_KEY",
    }),
    // Two override knobs for the dual-host setup. Hidden because they
    // are for internal staging/local testing only. Production users
    // should not override; the defaults route correctly. Env vars
    // PRIMITIVE_API_BASE_URL_1 and PRIMITIVE_API_BASE_URL_2 carry the
    // same semantics. Both are intentionally absent from --help output.
    "api-base-url-1": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL_1",
      hidden: true,
    }),
    "api-base-url-2": Flags.string({
      description:
        "Override the attachments-supporting send host base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL_2",
      hidden: true,
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  if (!operation.binaryResponse) {
    flags.envelope = Flags.boolean({
      description:
        "Print the full response envelope, including pagination metadata such as meta.cursor. Defaults to printing only the data payload for backward compatibility.",
    });
  }

  for (const parameter of [...operation.pathParams, ...operation.queryParams]) {
    flags[flagName(parameter.name)] = flagForParameter(parameter);
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
    for (const field of bodyFields) {
      if (field.kind === "complex") continue;
      const name = flagName(field.name);
      if (RESERVED_FLAG_NAMES.has(name)) continue;
      if (flags[name] !== undefined) continue;
      flags[name] = bodyFieldFlag(field);
      bodyFieldFlagToProperty.set(name, field.name);
    }
  }

  if (operation.binaryResponse) {
    flags.output = Flags.string({
      description: "Write binary response bytes to a file",
    });
  }

  return { flags, bodyFieldFlagToProperty };
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

function collectValues(
  parameters: PrimitiveParameterManifest[],
  flags: Record<string, unknown>,
): Record<string, boolean | number | string> {
  const values: Record<string, boolean | number | string> = {};

  for (const parameter of parameters) {
    const value = coerceParameterValue(
      parameter,
      flags[flagName(parameter.name)],
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

// Discoverability hints for generated commands that have a
// hand-rolled ergonomic shortcut. Keyed by the manifest's
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
  createFunction:
    "Tip: prefer `primitive functions deploy --name <name> --file <bundle>` for file-input ergonomics. This raw command exists for callers passing JSON.",
  updateFunction:
    "Tip: prefer `primitive functions redeploy --id <id> --file <bundle>` for file-input ergonomics. This raw command exists for callers passing JSON.",
  createFunctionSecret:
    "Tip: prefer `primitive functions set-secret --id <id> --key <KEY> --value <value> [--redeploy]` for secret writes that also push the binding live. This raw command exists for callers passing JSON.",
  setFunctionSecret:
    "Tip: prefer `primitive functions set-secret --id <id> --key <KEY> --value <value> [--redeploy]` for secret writes that also push the binding live. This raw command exists for callers passing JSON.",
};

export function createOperationCommand(
  operation: PrimitiveOperationManifest,
): typeof Command {
  const { flags, bodyFieldFlagToProperty } = buildFlags(operation);

  // Append a "Body fields" summary to the description so agents
  // running `<command> --help` learn the JSON shape immediately.
  // Without this, `--help` only said "JSON request body" and agents
  // had to probe the server with malformed payloads to discover
  // required fields. (CLI agent walkthrough surfaced this.)
  const baseDescription =
    operation.description !== null && operation.description !== undefined
      ? canonicalizeCliReferences(operation.description)
      : `${operation.method} ${operation.path}`;
  const schemaSummary = operation.hasJsonBody
    ? renderRequestSchemaSummary(operation.requestSchema)
    : null;
  const hint = OPERATION_HINTS[operation.sdkName];
  const descriptionWithSchema = schemaSummary
    ? `${baseDescription}\n\n${schemaSummary}`
    : baseDescription;
  const fullDescription = hint
    ? `${descriptionWithSchema}\n\n${hint}`
    : descriptionWithSchema;

  class OperationCommand extends Command {
    static description = fullDescription;

    static flags = flags as never;

    static summary =
      operation.summary ?? `${operation.method} ${operation.path}`;

    async run(): Promise<void> {
      const { flags } = await this.parse(OperationCommand as never);
      const parsedFlags = flags as Record<string, unknown>;
      await runWithTiming(parsedFlags.time === true, async () => {
        const { apiClient, auth, baseUrlOverridden } =
          createAuthenticatedCliApiClient({
            apiKey:
              typeof parsedFlags["api-key"] === "string"
                ? (parsedFlags["api-key"] as string)
                : undefined,
            apiBaseUrl1:
              typeof parsedFlags["api-base-url-1"] === "string"
                ? (parsedFlags["api-base-url-1"] as string)
                : undefined,
            apiBaseUrl2:
              typeof parsedFlags["api-base-url-2"] === "string"
                ? (parsedFlags["api-base-url-2"] as string)
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
                .map((p) => `--${flagName(p)}`)
                .join(", ");
              throw new Errors.CLIError(
                `--raw-body must be a JSON object when also passing per-field flags (got ${explicitKind}); supplied per-field flags: ${overrideFlags}. Either drop --raw-body and rely on the per-field flags, or move every field into the JSON --raw-body and drop the flags.`,
              );
            }
          } else {
            body = explicit;
          }
        }

        if (operation.bodyRequired && body === undefined) {
          throw new Errors.CLIError(
            `Operation ${operation.operationId} requires a body. Pass each field as a --flag (see --help) or supply JSON via --raw-body / --body-file.`,
          );
        }

        const operationFn = operations[
          operation.sdkName as OperationName
        ] as unknown as OperationExecutor;
        // Operations in HOST_2_OPERATIONS route to the attachments-
        // supporting send host (apiBaseUrl2). Today that's only
        // sendEmail; the list grows as we migrate more endpoints.
        const targetClient = HOST_2_OPERATIONS.has(operation.sdkName)
          ? apiClient._sendClient
          : apiClient.client;
        const result = await operationFn({
          body,
          client: targetClient,
          parseAs: operation.binaryResponse ? "blob" : "auto",
          path: collectValues(operation.pathParams, parsedFlags),
          query: collectValues(operation.queryParams, parsedFlags),
          responseStyle: "fields",
        });

        if (result.error) {
          const errorPayload = extractErrorPayload(result.error);
          writeErrorWithHints(errorPayload);
          removeStaleSavedCredentialOnUnauthorized({
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
          process.exitCode = 1;
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
        const cursor = envelope?.meta?.cursor;
        if (cursor) {
          process.stderr.write(`next cursor: ${cursor}\n`);
        }

        // Empty-result hint. When a list-style operation returns
        // an empty array, emit an operation-specific note to
        // stderr so a naive caller can distinguish "nothing here"
        // from "something isn't set up." Stdout still gets the
        // raw `[]` so machine-readable output is unchanged. The
        // AGX walkthrough flagged this: `list-deliveries` returning
        // `[]` left the agent unsure whether they had an empty
        // delivery log or no endpoints configured at all.
        if (Array.isArray(envelope?.data) && envelope.data.length === 0) {
          const hint = EMPTY_RESULT_HINTS[operation.sdkName];
          if (hint) process.stderr.write(`${hint}\n`);
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

        this.log(
          JSON.stringify(
            operationOutputPayload(envelope, parsedFlags.envelope === true),
            null,
            2,
          ),
        );
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
const EMPTY_RESULT_HINTS: Record<string, string> = {
  listDeliveries:
    "(no results) No webhook deliveries logged yet. If you have an endpoint configured but expected to see test fires here: test deliveries from `primitive endpoints test` are NOT logged in this list, they're synchronous and visible only in the test-endpoint command's response. Real deliveries are logged when an inbound `email.received` event fans out to your endpoints. If you have no endpoints, run `primitive endpoints list` to check.",
  listEndpoints:
    "(no results) No webhook endpoints configured. Add one with `primitive endpoints create --url <your-url>`.",
  listEmails:
    "(no results) No inbound emails received yet on this account. Send one to a verified domain to populate this list. For a compact view, prefer `primitive emails latest`.",
  listDomains:
    "(no results) No domains on this account. Add one with `primitive domains add --domain <yourdomain.example>`.",
  listFilters: "(no results) No filter rules configured.",
};

function canonicalizeCliReferences(description: string): string {
  return description
    .replaceAll("`primitive emails:latest`", "`primitive emails latest`")
    .replaceAll(
      "`primitive describe emails:get-email | jq '.responseSchema.properties'`",
      "`primitive describe emails:get | jq '.responseSchema.properties'`",
    );
}
