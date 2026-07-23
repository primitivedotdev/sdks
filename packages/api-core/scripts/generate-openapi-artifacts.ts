import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

type HttpMethod =
  | "delete"
  | "get"
  | "head"
  | "options"
  | "patch"
  | "post"
  | "put";

type OpenApiParameter = {
  $ref?: string;
  description?: string;
  in?: string;
  name?: string;
  required?: boolean;
  schema?: {
    default?: unknown;
    enum?: unknown[];
    format?: string;
    maxLength?: number;
    minLength?: number;
    maximum?: number;
    minimum?: number;
    pattern?: string;
    type?: string;
  };
};

type OpenApiRequestBody = {
  content?: Record<string, { schema?: Record<string, unknown> }>;
  required?: boolean;
};

type OpenApiOperation = {
  description?: string;
  operationId?: string;
  parameters?: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  responses?: Record<
    string,
    {
      content?: Record<string, { schema?: { format?: string } }>;
    }
  >;
  summary?: string;
  tags?: string[];
};

type OpenApiPathItem = {
  delete?: OpenApiOperation;
  get?: OpenApiOperation;
  head?: OpenApiOperation;
  options?: OpenApiOperation;
  parameters?: OpenApiParameter[];
  patch?: OpenApiOperation;
  post?: OpenApiOperation;
  put?: OpenApiOperation;
};

type PrimitiveParameterManifest = {
  default?: boolean | number | string;
  description: string | null;
  enum: string[] | null;
  format?: string;
  maxLength?: number;
  minLength?: number;
  maximum?: number;
  minimum?: number;
  name: string;
  pattern?: string;
  required: boolean;
  type: string;
};

type PrimitiveOperationManifest = {
  binaryResponse: boolean;
  bodyRequired: boolean;
  command: string;
  description: string | null;
  hasJsonBody: boolean;
  headerParams: PrimitiveParameterManifest[];
  method: Uppercase<HttpMethod>;
  operationId: string;
  path: string;
  pathParams: PrimitiveParameterManifest[];
  queryParams: PrimitiveParameterManifest[];
  /**
   * Resolved JSON Schema for the request body when `hasJsonBody` is
   * true. All `$ref` references into `components/schemas` and
   * `components/parameters` are inlined so the schema can be
   * inspected without re-parsing the OpenAPI document.
   *
   * This lets CLI users inspect the body shape from
   * `primitive list-operations` without probing the server with
   * deliberately malformed payloads.
   */
  requestSchema: Record<string, unknown> | null;
  /**
   * Resolved JSON Schema for the 200/201 response body's `data`
   * envelope contents. Same shape as `requestSchema`: `$ref`s
   * inlined, ready for agent consumption. Null on operations
   * without a 200/201 JSON response (binary downloads).
   */
  responseSchema: Record<string, unknown> | null;
  sdkName: string;
  summary: string | null;
  tag: string;
  tagCommand: string;
};

const HTTP_METHODS: HttpMethod[] = [
  "delete",
  "get",
  "head",
  "options",
  "patch",
  "post",
  "put",
];

const OCTET_STREAM = "application/octet-stream";
const scriptDir = dirname(fileURLToPath(import.meta.url));
// Paths are relative to packages/api-core/scripts. The shared
// OpenAPI source lives at the repo root (also consumed by sdk-python
// and sdk-go); the generated TypeScript outputs live inside the
// api-core package's own src tree.
const specPath = resolve(scriptDir, "../../../openapi/primitive-api.yaml");
const codegenSpecPath = resolve(
  scriptDir,
  "../../../openapi/primitive-api.codegen.json",
);
const openapiOutputPath = resolve(
  scriptDir,
  "../src/openapi/openapi.generated.ts",
);
const manifestOutputPath = resolve(
  scriptDir,
  "../src/openapi/operations.generated.ts",
);
const rustCliManifestOutputPath = resolve(
  scriptDir,
  "../../../cli-rust/src/operation-manifest.json",
);

function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function normalizeForCodegen(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeForCodegen);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const next = value as Record<string, unknown>;

  for (const [key, child] of Object.entries(next)) {
    next[key] = normalizeForCodegen(child);
  }

  const typeValue = next.type;
  if (Array.isArray(typeValue)) {
    const nonNull = typeValue.filter((item) => item !== "null");
    if (nonNull.length === 1 && nonNull.length !== typeValue.length) {
      next.type = nonNull[0];
      next.nullable = true;
    }
  }

  const contentValue = next.content;
  if (
    contentValue &&
    typeof contentValue === "object" &&
    !Array.isArray(contentValue)
  ) {
    const content = contentValue as Record<string, unknown>;
    if (content["message/rfc822"]) {
      content[OCTET_STREAM] = content["message/rfc822"];
      delete content["message/rfc822"];
    }
    if (content["application/gzip"]) {
      content[OCTET_STREAM] = content["application/gzip"];
      delete content["application/gzip"];
    }
  }

  return next;
}

function resolveLocalRef(
  doc: Record<string, unknown>,
  reference: string,
): Record<string, unknown> {
  const segments = reference.replace(/^#\//, "").split("/");
  let current: unknown = doc;

  for (const segment of segments) {
    if (!current || typeof current !== "object") {
      throw new Error(`Unable to resolve OpenAPI reference: ${reference}`);
    }

    current = (current as Record<string, unknown>)[segment];
  }

  if (!current || typeof current !== "object") {
    throw new Error(
      `Resolved OpenAPI reference is not an object: ${reference}`,
    );
  }

  return current as Record<string, unknown>;
}

function resolveParameter(
  doc: Record<string, unknown>,
  parameter: OpenApiParameter,
): OpenApiParameter {
  if (parameter.$ref) {
    return resolveLocalRef(doc, parameter.$ref) as OpenApiParameter;
  }

  return parameter;
}

function mergeParameters(
  doc: Record<string, unknown>,
  pathParameters: OpenApiParameter[] = [],
  operationParameters: OpenApiParameter[] = [],
): OpenApiParameter[] {
  const merged = new Map<string, OpenApiParameter>();

  for (const parameter of pathParameters) {
    const resolved = resolveParameter(doc, parameter);
    if (resolved.name && resolved.in) {
      merged.set(`${resolved.in}:${resolved.name}`, resolved);
    }
  }

  for (const parameter of operationParameters) {
    const resolved = resolveParameter(doc, parameter);
    if (resolved.name && resolved.in) {
      merged.set(`${resolved.in}:${resolved.name}`, resolved);
    }
  }

  return [...merged.values()];
}

function manifestParameters(
  parameters: OpenApiParameter[],
  location: "header" | "path" | "query",
): PrimitiveParameterManifest[] {
  return parameters
    .filter(
      (parameter): parameter is OpenApiParameter & { name: string } =>
        parameter.in === location &&
        typeof parameter.name === "string" &&
        parameter.name.length > 0,
    )
    .map((parameter) => {
      const enumValues = Array.isArray(parameter.schema?.enum)
        ? parameter.schema.enum.filter(
            (value): value is string => typeof value === "string",
          )
        : [];
      const scalarDefault =
        typeof parameter.schema?.default === "boolean" ||
        typeof parameter.schema?.default === "number" ||
        typeof parameter.schema?.default === "string"
          ? parameter.schema.default
          : undefined;
      return {
        ...(scalarDefault !== undefined ? { default: scalarDefault } : {}),
        description: parameter.description ?? null,
        enum: enumValues.length > 0 ? enumValues : null,
        ...(typeof parameter.schema?.format === "string"
          ? { format: parameter.schema.format }
          : {}),
        ...(typeof parameter.schema?.maxLength === "number"
          ? { maxLength: parameter.schema.maxLength }
          : {}),
        ...(typeof parameter.schema?.minLength === "number"
          ? { minLength: parameter.schema.minLength }
          : {}),
        ...(typeof parameter.schema?.maximum === "number"
          ? { maximum: parameter.schema.maximum }
          : {}),
        ...(typeof parameter.schema?.minimum === "number"
          ? { minimum: parameter.schema.minimum }
          : {}),
        name: parameter.name,
        ...(typeof parameter.schema?.pattern === "string"
          ? { pattern: parameter.schema.pattern }
          : {}),
        required: Boolean(parameter.required),
        type: parameter.schema?.type ?? "string",
      };
    });
}

function hasJsonBody(operation: OpenApiOperation): boolean {
  const requestBody = operation.requestBody;
  if (!requestBody?.content) {
    return false;
  }

  return Boolean(requestBody.content["application/json"]?.schema);
}

/**
 * Recursively inline every `$ref` in a JSON Schema fragment so the
 * result is self-contained. Cycles are broken by leaving the cyclic
 * reference as `{ $ref: "..." }` rather than infinite-recursing;
 * this is rare in practice for our spec but keeps the helper safe.
 */
function inlineSchemaRefs(
  doc: Record<string, unknown>,
  schema: unknown,
  seen: Set<string> = new Set(),
): unknown {
  if (Array.isArray(schema)) {
    return schema.map((item) => inlineSchemaRefs(doc, item, seen));
  }
  if (!schema || typeof schema !== "object") {
    return schema;
  }
  const obj = schema as Record<string, unknown>;
  const ref = typeof obj.$ref === "string" ? obj.$ref : null;
  if (ref) {
    if (seen.has(ref)) {
      return { $ref: ref };
    }
    const next = new Set(seen);
    next.add(ref);
    const resolved = resolveLocalRef(doc, ref);
    return inlineSchemaRefs(doc, resolved, next);
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    out[key] = inlineSchemaRefs(doc, value, seen);
  }
  return out;
}

function getRequestSchema(
  doc: Record<string, unknown>,
  operation: OpenApiOperation,
): Record<string, unknown> | null {
  const schema = operation.requestBody?.content?.["application/json"]?.schema;
  if (!schema) return null;
  const inlined = inlineSchemaRefs(doc, schema);
  return inlined && typeof inlined === "object"
    ? (inlined as Record<string, unknown>)
    : null;
}

/**
 * Pick the most interesting JSON Schema describing what an operation
 * returns, with `$ref`s inlined. The "interesting" part is the `data`
 * property of the 200 or 201 response envelope. The rest of the
 * envelope (`{ success: true, meta: {...} }`) is uniform across the
 * spec and adds noise.
 *
 * Spec-side, success responses are written as
 * `allOf: [SuccessEnvelope, { properties: { data: <real schema> } }]`
 * (or the same with ListEnvelope). This helper walks that shape and
 * returns the inlined `<real schema>`. If the spec ever stops using
 * the allOf+envelope idiom for an operation, the helper falls back
 * to the full inlined response schema rather than returning null,
 * since "imperfect schema" is more useful to an agent than "no
 * schema."
 *
 * The `primitive describe` command uses this field to explain
 * response field meanings without requiring users to inspect the
 * raw OpenAPI document.
 */
function getResponseSchema(
  doc: Record<string, unknown>,
  operation: OpenApiOperation,
): Record<string, unknown> | null {
  const responses = operation.responses ?? {};
  const response = responses["200"] ?? responses["201"];
  if (!response) return null;
  const schema = response.content?.["application/json"]?.schema;
  if (!schema) return null;
  const inlined = inlineSchemaRefs(doc, schema);
  if (!inlined || typeof inlined !== "object") return null;

  // The allOf+envelope idiom: try to peel off the envelope so the
  // response schema is just the data shape. Picks the first allOf
  // member that declares a `data` property and uses that property's
  // schema directly. Falls through to the full schema if no member
  // matches the pattern.
  const fragment = inlined as Record<string, unknown>;
  const allOf = fragment.allOf;
  if (Array.isArray(allOf)) {
    for (const member of allOf) {
      if (!member || typeof member !== "object") continue;
      const props = (member as Record<string, unknown>).properties;
      if (!props || typeof props !== "object") continue;
      const dataSchema = (props as Record<string, unknown>).data;
      if (dataSchema && typeof dataSchema === "object") {
        return dataSchema as Record<string, unknown>;
      }
    }
  }
  return fragment;
}

function hasBinaryResponse(operation: OpenApiOperation): boolean {
  const responses = operation.responses ?? {};

  for (const response of Object.values(responses)) {
    const content = response.content ?? {};
    for (const [contentType, mediaType] of Object.entries(content)) {
      if (
        contentType === OCTET_STREAM ||
        contentType === "application/gzip" ||
        contentType === "message/rfc822"
      ) {
        return true;
      }

      if (mediaType.schema?.format === "binary") {
        return true;
      }
    }
  }

  return false;
}

function buildManifest(
  doc: Record<string, unknown>,
): PrimitiveOperationManifest[] {
  const manifest: PrimitiveOperationManifest[] = [];

  const paths = (doc.paths ?? {}) as Record<string, OpenApiPathItem>;

  for (const [path, pathItem] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation?.operationId) {
        continue;
      }

      const parameters = mergeParameters(
        doc,
        pathItem.parameters,
        operation.parameters,
      );
      const tag = operation.tags?.[0] ?? "default";

      manifest.push({
        binaryResponse: hasBinaryResponse(operation),
        bodyRequired: Boolean(operation.requestBody?.required),
        command: toKebabCase(operation.operationId),
        description: operation.description ?? null,
        hasJsonBody: hasJsonBody(operation),
        headerParams: manifestParameters(parameters, "header"),
        method: method.toUpperCase() as Uppercase<HttpMethod>,
        operationId: operation.operationId,
        path,
        pathParams: manifestParameters(parameters, "path"),
        queryParams: manifestParameters(parameters, "query"),
        requestSchema: getRequestSchema(doc, operation),
        responseSchema: getResponseSchema(doc, operation),
        sdkName: operation.operationId,
        summary: operation.summary ?? null,
        tag,
        tagCommand: toKebabCase(tag),
      });
    }
  }

  manifest.sort((left, right) => {
    if (left.tagCommand === right.tagCommand) {
      return left.command.localeCompare(right.command);
    }

    return left.tagCommand.localeCompare(right.tagCommand);
  });

  return manifest;
}

const rawSpec = YAML.parse(readFileSync(specPath, "utf8")) as Record<
  string,
  unknown
>;
const codegenSpec = normalizeForCodegen(structuredClone(rawSpec)) as Record<
  string,
  unknown
>;
codegenSpec.openapi = "3.0.3";

const manifest = buildManifest(rawSpec);

mkdirSync(dirname(openapiOutputPath), { recursive: true });
mkdirSync(dirname(rustCliManifestOutputPath), { recursive: true });

writeFileSync(codegenSpecPath, `${JSON.stringify(codegenSpec, null, 2)}\n`);
writeFileSync(
  rustCliManifestOutputPath,
  `${JSON.stringify(manifest, null, 2)}\n`,
);
writeFileSync(
  openapiOutputPath,
  `/**
 * OpenAPI document for the Primitive API.
 *
 * AUTO-GENERATED - DO NOT EDIT
 * Run \`pnpm generate:openapi\` to regenerate.
 */

export const openapiDocument: Record<string, unknown> = ${JSON.stringify(rawSpec, null, 2)};
`,
);
writeFileSync(
  manifestOutputPath,
  `/**
 * Generated operation metadata for the Primitive API CLI and SDK tooling.
 *
 * AUTO-GENERATED - DO NOT EDIT
 * Run \`pnpm generate:openapi\` to regenerate.
 */

export type PrimitiveParameterManifest = {
  default?: boolean | number | string;
  description: string | null;
  enum: string[] | null;
  format?: string;
  maxLength?: number;
  minLength?: number;
  maximum?: number;
  minimum?: number;
  name: string;
  pattern?: string;
  required: boolean;
  type: string;
};

export type PrimitiveOperationManifest = {
  binaryResponse: boolean;
  bodyRequired: boolean;
  command: string;
  description: string | null;
  hasJsonBody: boolean;
  headerParams: PrimitiveParameterManifest[];
  method: string;
  operationId: string;
  path: string;
  pathParams: PrimitiveParameterManifest[];
  queryParams: PrimitiveParameterManifest[];
  /**
   * Resolved JSON Schema for the request body when \`hasJsonBody\` is
   * true. \`$ref\`s into the OpenAPI components are inlined.
   */
  requestSchema: Record<string, unknown> | null;
  /**
   * Resolved JSON Schema for the 200/201 response body's \`data\`
   * envelope contents. Same shape as \`requestSchema\`: \`$ref\`s
   * inlined. Null on operations without a 200/201 JSON response.
   */
  responseSchema: Record<string, unknown> | null;
  sdkName: string;
  summary: string | null;
  tag: string;
  tagCommand: string;
};

export const operationManifest: PrimitiveOperationManifest[] = ${JSON.stringify(manifest, null, 2)};
`,
);
