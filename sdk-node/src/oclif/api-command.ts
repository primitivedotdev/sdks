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

/**
 * Render a one-shot description of a JSON Schema's top-level
 * properties so an agent reading `<command> --help` can build a
 * valid `--body` payload without probing the server. Pulled from
 * the resolved request schema embedded on the manifest.
 *
 * Format prioritizes scanability over completeness: required
 * fields first, each line is `<name> <type> [- description]`
 * truncated to a reasonable width. Callers who need the full
 * schema can run `primitive list-operations | jq` and read
 * `requestSchema` directly.
 */
function renderRequestSchemaSummary(
  schema: Record<string, unknown> | null,
): string | null {
  if (!schema || typeof schema !== "object") return null;
  const properties = schema.properties;
  if (!properties || typeof properties !== "object") return null;
  const requiredArr = Array.isArray(schema.required)
    ? (schema.required as unknown[]).filter(
        (k): k is string => typeof k === "string",
      )
    : [];
  const required = new Set(requiredArr);

  const entries = Object.entries(properties as Record<string, unknown>)
    .map(([name, raw]) => {
      const propSchema =
        raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      let type = "any";
      const t = propSchema.type;
      if (typeof t === "string") {
        type = t;
        if (type === "array") {
          const items = propSchema.items;
          if (items && typeof items === "object") {
            const itemType = (items as Record<string, unknown>).type;
            if (typeof itemType === "string") {
              type = `array<${itemType}>`;
            }
          }
        }
      } else if (Array.isArray(t)) {
        // Nullable shorthand the codegen normalizes to e.g. ["string","null"].
        const nonNull = (t as unknown[]).filter((s) => s !== "null");
        type = nonNull.length === 1 ? `${nonNull[0]}?` : nonNull.join("|");
      }
      const description =
        typeof propSchema.description === "string"
          ? propSchema.description.split("\n")[0].trim()
          : "";
      return {
        name,
        type,
        description,
        required: required.has(name),
      };
    })
    .sort((a, b) => {
      if (a.required !== b.required) return a.required ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  if (entries.length === 0) return null;

  const nameWidth = Math.min(
    24,
    Math.max(...entries.map((e) => e.name.length)),
  );
  const lines = ["Body fields (JSON --body):"];
  const descMax = 78;
  for (const e of entries) {
    const flag = e.required ? " *" : "  ";
    const padName = e.name.padEnd(nameWidth);
    const trimmedDesc =
      e.description.length > descMax
        ? `${e.description.slice(0, descMax - 3)}...`
        : e.description;
    const desc = trimmedDesc ? `  ${trimmedDesc}` : "";
    lines.push(`${flag} ${padName}  ${e.type}${desc}`);
  }
  lines.push("(* = required)");
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

function buildFlags(
  operation: PrimitiveOperationManifest,
): Record<string, unknown> {
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

  if (operation.hasJsonBody) {
    flags.body = Flags.string({ description: "JSON request body" });
    flags["body-file"] = Flags.string({
      description: "Path to a JSON file used as the request body",
    });
  }

  if (operation.binaryResponse) {
    flags.output = Flags.string({
      description: "Write binary response bytes to a file",
    });
  }

  return flags;
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
  const flags = buildFlags(operation) as Record<string, unknown>;

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

      const body = operation.hasJsonBody
        ? readJsonBody(parsedFlags)
        : undefined;
      if (operation.bodyRequired && body === undefined) {
        throw new Errors.CLIError(
          `Operation ${operation.operationId} requires --body or --body-file`,
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
