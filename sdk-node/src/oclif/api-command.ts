import { readFileSync, writeFileSync } from "node:fs";
import { Command, Errors, Flags } from "@oclif/core";
import { operations, PrimitiveApiClient } from "../api/index.js";
import type {
  PrimitiveOperationManifest,
  PrimitiveParameterManifest,
} from "../openapi/index.js";

type OperationName = keyof typeof operations;

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

// Description of a single top-level body property, normalized
// from the JSON Schema on the operation manifest. `kind` tells the
// CLI generator whether to expose the field as an individual
// `--flag` (scalar) or leave it to `--body` JSON (non-scalar).
interface BodyFieldDescriptor {
  name: string;
  description: string;
  required: boolean;
  // Pretty-printed type for help text (e.g. "string", "integer",
  // "string?", "array<string>"). Always set.
  displayType: string;
  // Either a CLI flag-able scalar kind or "complex" (array, object,
  // mixed-non-nullable, unknown). Complex fields cannot be
  // expressed as a single CLI flag and must go through --body.
  kind: "string" | "integer" | "boolean" | "complex";
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
      else if (t === "integer" || t === "number") kind = "integer";
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
        else if (single === "integer" || single === "number") kind = "integer";
        else if (single === "boolean") kind = "boolean";
        else kind = "complex";
      } else {
        displayType = nonNull.join("|");
        kind = "complex";
      }
    }

    const description =
      typeof propSchema.description === "string"
        ? propSchema.description.split("\n")[0].trim()
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
 * MUST go through `--body` (complex types: arrays, objects,
 * mixed-non-nullable). When an operation has only scalars, the
 * summary is omitted entirely and oclif's FLAGS section is the
 * full story.
 *
 * For operations with mixed scalar and complex fields, we also
 * include a short header pointing the agent at the flag form so
 * the natural reading is "use the flags above; --body for the
 * leftovers below."
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
    "Body fields requiring --body JSON (these are not exposed as flags):",
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
    return Flags.integer(common);
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
  const body = flags.body;

  if (bodyFile && body) {
    throw cliError("Use either --body or --body-file, not both");
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

  if (typeof body === "string") {
    return parseJson(body, "--body");
  }

  return undefined;
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

// Reserved flag names the body-field expander must never overwrite.
// `--body` and `--body-file` are the JSON escape hatches.
// `--api-key`, `--base-url`, `--output` are infra. Path and query
// params get added before body fields and take precedence.
const RESERVED_FLAG_NAMES = new Set([
  "api-key",
  "base-url",
  "body",
  "body-file",
  "output",
]);

function bodyFieldFlag(field: BodyFieldDescriptor): unknown {
  // Flag descriptions cap at 80 chars so oclif's --help output
  // stays readable; the schema's full description is also visible
  // via `primitive list-operations | jq`.
  const descMax = 80;
  const trimmedDesc =
    field.description.length > descMax
      ? `${field.description.slice(0, descMax - 3)}...`
      : field.description;
  // Field-flag UX choice: do NOT mark scalar body fields as
  // required at the oclif level even when the JSON Schema marks
  // them required. Reason: a caller can satisfy the requirement
  // either via the individual flag OR via --body / --body-file.
  // Marking the flag required would force the individual-flag
  // form. The runtime body merger validates the final assembled
  // body against the same server-side schema either way.
  const common = {
    description: trimmedDesc || field.name,
  };
  if (field.kind === "boolean") return Flags.boolean(common);
  if (field.kind === "integer") return Flags.integer(common);
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
      description: "Primitive API key (defaults to PRIMITIVE_API_KEY)",
      env: "PRIMITIVE_API_KEY",
    }),
    "base-url": Flags.string({
      description: "API base URL (defaults to PRIMITIVE_API_URL or production)",
      env: "PRIMITIVE_API_URL",
    }),
  };

  for (const parameter of [...operation.pathParams, ...operation.queryParams]) {
    flags[flagName(parameter.name)] = flagForParameter(parameter);
  }

  const bodyFieldFlagToProperty = new Map<string, string>();

  if (operation.hasJsonBody) {
    flags.body = Flags.string({
      description:
        "Full request body as JSON. Prefer per-field flags (e.g. --to, --from, --body-text) when available; --body is the escape hatch for nested or complex fields.",
    });
    flags["body-file"] = Flags.string({
      description:
        "Path to a JSON file used as the request body. Same role as --body for callers passing a saved payload.",
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
    operation.description ?? `${operation.method} ${operation.path}`;
  const schemaSummary = operation.hasJsonBody
    ? renderRequestSchemaSummary(operation.requestSchema)
    : null;
  const fullDescription = schemaSummary
    ? `${baseDescription}\n\n${schemaSummary}`
    : baseDescription;

  class OperationCommand extends Command {
    static description = fullDescription;

    static flags = flags as never;

    static summary =
      operation.summary ?? `${operation.method} ${operation.path}`;

    async run(): Promise<void> {
      const { flags } = await this.parse(OperationCommand as never);
      const parsedFlags = flags as Record<string, unknown>;
      const apiClient = new PrimitiveApiClient({
        apiKey:
          typeof parsedFlags["api-key"] === "string"
            ? (parsedFlags["api-key"] as string)
            : undefined,
        baseUrl:
          typeof parsedFlags["base-url"] === "string"
            ? (parsedFlags["base-url"] as string)
            : undefined,
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
            // Caller passed --body as null, an array, or a
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
              `--body must be a JSON object when also passing per-field flags (got ${explicitKind}); supplied per-field flags: ${overrideFlags}. Either drop --body and rely on the per-field flags, or move every field into the JSON --body and drop the flags.`,
            );
          }
        } else {
          body = explicit;
        }
      }

      if (operation.bodyRequired && body === undefined) {
        throw new Errors.CLIError(
          `Operation ${operation.operationId} requires a body. Pass each field as a --flag (see --help) or supply JSON via --body / --body-file.`,
        );
      }

      const operationFn = operations[
        operation.sdkName as OperationName
      ] as unknown as OperationExecutor;
      const result = await operationFn({
        body,
        client: apiClient.client,
        parseAs: operation.binaryResponse ? "blob" : "auto",
        path: collectValues(operation.pathParams, parsedFlags),
        query: collectValues(operation.queryParams, parsedFlags),
        responseStyle: "fields",
      });

      if (result.error) {
        const errorPayload = extractErrorPayload(result.error);
        process.stderr.write(`${formatErrorPayload(errorPayload)}\n`);
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

      const envelope = result.data as
        | { data?: unknown; meta?: { cursor?: string | null } }
        | null
        | undefined;
      const cursor = envelope?.meta?.cursor;
      if (cursor) {
        process.stderr.write(`next cursor: ${cursor}\n`);
      }
      this.log(JSON.stringify(envelope?.data ?? null, null, 2));
    }
  }

  return OperationCommand;
}
