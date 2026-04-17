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
  description: string | null;
  name: string;
  required: boolean;
  type: string;
};

type PrimitiveOperationManifest = {
  binaryResponse: boolean;
  bodyRequired: boolean;
  command: string;
  description: string | null;
  hasJsonBody: boolean;
  method: Uppercase<HttpMethod>;
  operationId: string;
  path: string;
  pathParams: PrimitiveParameterManifest[];
  queryParams: PrimitiveParameterManifest[];
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
const specPath = resolve(scriptDir, "../../openapi/primitive-api.yaml");
const codegenSpecPath = resolve(scriptDir, "../../openapi/primitive-api.codegen.json");
const openapiOutputPath = resolve(scriptDir, "../src/openapi/openapi.generated.ts");
const manifestOutputPath = resolve(scriptDir, "../src/openapi/operations.generated.ts");

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
  if (contentValue && typeof contentValue === "object" && !Array.isArray(contentValue)) {
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
    throw new Error(`Resolved OpenAPI reference is not an object: ${reference}`);
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
  location: "path" | "query",
): PrimitiveParameterManifest[] {
  return parameters
    .filter((parameter) => parameter.in === location && parameter.name)
    .map((parameter) => ({
      description: parameter.description ?? null,
      name: parameter.name!,
      required: Boolean(parameter.required),
      type: parameter.schema?.type ?? "string",
    }));
}

function hasJsonBody(operation: OpenApiOperation): boolean {
  const requestBody = operation.requestBody;
  if (!requestBody?.content) {
    return false;
  }

  return Boolean(requestBody.content["application/json"]?.schema);
}

function hasBinaryResponse(operation: OpenApiOperation): boolean {
  const responses = operation.responses ?? {};

  for (const response of Object.values(responses)) {
    const content = response.content ?? {};
    for (const [contentType, mediaType] of Object.entries(content)) {
      if (contentType === OCTET_STREAM || contentType === "application/gzip" || contentType === "message/rfc822") {
        return true;
      }

      if (mediaType.schema?.format === "binary") {
        return true;
      }
    }
  }

  return false;
}

function buildManifest(doc: Record<string, unknown>): PrimitiveOperationManifest[] {
  const manifest: PrimitiveOperationManifest[] = [];

  const paths = (doc.paths ?? {}) as Record<string, OpenApiPathItem>;

  for (const [path, pathItem] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation?.operationId) {
        continue;
      }

      const parameters = mergeParameters(doc, pathItem.parameters, operation.parameters);
      const tag = operation.tags?.[0] ?? "default";

      manifest.push({
        binaryResponse: hasBinaryResponse(operation),
        bodyRequired: Boolean(operation.requestBody?.required),
        command: toKebabCase(operation.operationId),
        description: operation.description ?? null,
        hasJsonBody: hasJsonBody(operation),
        method: method.toUpperCase() as Uppercase<HttpMethod>,
        operationId: operation.operationId,
        path,
        pathParams: manifestParameters(parameters, "path"),
        queryParams: manifestParameters(parameters, "query"),
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

const rawSpec = YAML.parse(readFileSync(specPath, "utf8")) as Record<string, unknown>;
const codegenSpec = normalizeForCodegen(structuredClone(rawSpec)) as Record<string, unknown>;
codegenSpec.openapi = "3.0.3";

const manifest = buildManifest(rawSpec);

mkdirSync(dirname(openapiOutputPath), { recursive: true });

writeFileSync(codegenSpecPath, `${JSON.stringify(codegenSpec, null, 2)}\n`);
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
  description: string | null;
  name: string;
  required: boolean;
  type: string;
};

export type PrimitiveOperationManifest = {
  binaryResponse: boolean;
  bodyRequired: boolean;
  command: string;
  description: string | null;
  hasJsonBody: boolean;
  method: string;
  operationId: string;
  path: string;
  pathParams: PrimitiveParameterManifest[];
  queryParams: PrimitiveParameterManifest[];
  sdkName: string;
  summary: string | null;
  tag: string;
  tagCommand: string;
};

export const operationManifest: PrimitiveOperationManifest[] = ${JSON.stringify(manifest, null, 2)};
`,
);
