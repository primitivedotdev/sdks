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
    maximum?: number;
    minimum?: number;
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
  "x-primitive-permission"?: string[];
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
  maximum?: number;
  minimum?: number;
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
  /**
   * Request headers the operation declares (for example
   * `Idempotency-Key`). `name` is the header name as the spec spells it.
   */
  headerParams: PrimitiveParameterManifest[];
  /**
   * Permissions the operation requires, all of them, from the spec's
   * `x-primitive-permission`. Null when the spec declares none.
   */
  permissions: string[] | null;
  /**
   * Resolved JSON Schema for the request body when `hasJsonBody` is
   * true. All `$ref` references into `components/schemas` and
   * `components/parameters` are inlined so the schema can be
   * inspected without re-parsing the OpenAPI document.
   *
   * Surfaced for AGX: a CLI agent walkthrough showed that without
   * this field on `list-operations`, agents have no way to learn
   * the body shape short of probing the server with deliberately-
   * malformed payloads. Now `primitive list-operations | jq '.[] |
   * select(.command == "send-email") | .requestSchema'` produces a
   * full schema dump in one call.
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
const codegenSpecPath = resolve(scriptDir, "../../../openapi/primitive-api.codegen.json");
const openapiOutputPath = resolve(scriptDir, "../src/openapi/openapi.generated.ts");
const manifestOutputPath = resolve(scriptDir, "../src/openapi/operations.generated.ts");
const permissionsOutputPath = resolve(scriptDir, "../src/openapi/permissions.generated.ts");

function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

type SchemaNode = Record<string, unknown>;

const PRIMITIVE_TYPES = new Set(["boolean", "integer", "number", "string"]);

const TYPED_STRING_FORMATS = new Set(["date", "date-time", "uri", "uuid"]);

function canonicalHeaderName(name: string): string {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("-");
}

function isSchemaNode(value: unknown): value is SchemaNode {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function jsonTypeOf(value: unknown): string | undefined {
  if (typeof value === "string") return "string";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return undefined;
}

/** The single JSON type a union branch accepts, or undefined when unknown. */
function branchType(branch: SchemaNode): string | undefined {
  if (typeof branch.type === "string") return branch.type;
  if (branch.const !== undefined) return jsonTypeOf(branch.const);
  if (isSchemaNode(branch.properties)) return "object";
  return undefined;
}

/**
 * Merge `anyOf` branches that accept the same JSON type, so every remaining
 * branch has a distinct type. The Go generator only builds a union from
 * branches it can tell apart by JSON type, and stops on any other `anyOf`;
 * the published spec keeps the precise union.
 *
 * - Primitive branches of one type become one branch: an `enum` of their
 *   values when every branch is a `const` or `enum`, the bare type otherwise.
 * - Object branches become one object with every property; a property is
 *   required only when every branch requires it, and a property spelled
 *   differently across branches becomes an `anyOf` of its spellings, merged
 *   the same way.
 * - A `{ type: "null" }` branch beside one inline branch makes that branch
 *   nullable.
 * - A union left with one branch is replaced by it.
 */
function simplifyAnyOf(node: SchemaNode): SchemaNode {
  const branches = node.anyOf;
  if (!Array.isArray(branches) || !branches.every(isSchemaNode)) return node;
  const types = branches.map(branchType);
  if (types.some((type) => type === undefined)) return node;

  const groups = new Map<string, SchemaNode[]>();
  types.forEach((type, index) => {
    const key = type as string;
    groups.set(key, [...(groups.get(key) ?? []), branches[index]]);
  });

  let changed = false;
  const merged: SchemaNode[] = [];
  for (const [type, group] of groups) {
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }
    changed = true;
    if (PRIMITIVE_TYPES.has(type)) {
      const values = group.flatMap((branch) =>
        branch.const !== undefined ? [branch.const] : Array.isArray(branch.enum) ? branch.enum : [undefined],
      );
      merged.push(
        values.includes(undefined) ? { type } : { type, enum: [...new Set(values)] },
      );
    } else if (type === "object") {
      merged.push(mergeObjectBranches(group));
    } else if (type === "null") {
      merged.push({ type: "null" });
    } else {
      // Arrays: no union here yet; keep the first spelling and an open item.
      merged.push({ type, items: {} });
    }
  }

  const nullIndex = merged.findIndex((branch) => branch.type === "null");
  const { anyOf: _anyOf, ...wrapper } = node;
  if (nullIndex !== -1 && merged.length === 2) {
    const other = merged[1 - nullIndex];
    if (typeof other.type === "string") {
      return normalizeForCodegen({ ...other, ...wrapper, nullable: true }) as SchemaNode;
    }
  }
  if (merged.length === 1) {
    return normalizeForCodegen({ ...merged[0], ...wrapper }) as SchemaNode;
  }
  return changed ? { ...wrapper, anyOf: merged } : node;
}

/**
 * A `oneOf` of inline objects that the Go generator cannot tell apart, because
 * some branch has no property of its own (for example branches told apart
 * only by the value of a shared `kind`), becomes one object in the codegen
 * document, merged as in `simplifyAnyOf`. A shared `kind` becomes an `enum`
 * of every branch's value.
 */
function mergeIndistinctOneOf(node: SchemaNode): SchemaNode {
  const branches = node.oneOf;
  if (!Array.isArray(branches) || branches.length < 2) return node;
  if (!branches.every((branch) => isSchemaNode(branch) && branchType(branch) === "object" && !branch.$ref)) {
    return node;
  }
  const names = (branches as SchemaNode[]).map((branch) => Object.keys((branch.properties ?? {}) as SchemaNode));
  const distinguishable = names.every((own, index) =>
    own.some((name) => names.every((other, otherIndex) => otherIndex === index || !other.includes(name))),
  );
  if (distinguishable) return node;
  const { oneOf: _oneOf, ...wrapper } = node;
  return normalizeForCodegen({ ...mergeObjectBranches(branches as SchemaNode[]), ...wrapper }) as SchemaNode;
}

function mergeObjectBranches(group: SchemaNode[]): SchemaNode {
  const properties = new Map<string, unknown[]>();
  for (const branch of group) {
    for (const [name, schema] of Object.entries((branch.properties ?? {}) as SchemaNode)) {
      properties.set(name, [...(properties.get(name) ?? []), schema]);
    }
  }
  const requiredSets = group.map(
    (branch) => new Set(Array.isArray(branch.required) ? (branch.required as string[]) : []),
  );
  const required = [...properties.keys()].filter((name) => requiredSets.every((set) => set.has(name)));

  const mergedProperties: SchemaNode = {};
  for (const [name, schemas] of properties) {
    const distinct = schemas.filter(
      (schema, index) => schemas.findIndex((other) => JSON.stringify(other) === JSON.stringify(schema)) === index,
    );
    mergedProperties[name] =
      distinct.length === 1 ? distinct[0] : normalizeForCodegen({ anyOf: distinct });
  }
  return {
    type: "object",
    properties: mergedProperties,
    ...(required.length > 0 ? { required } : {}),
  };
}

/**
 * A union that refers to itself (a JSON value whose array items and object
 * values are again JSON values) has no finite expansion, and the Go
 * generator stops at its depth limit. In the codegen document the nested
 * occurrences become `{}`, any JSON value, which is what they accept.
 */
function openSelfReferencingUnions(doc: Record<string, unknown>): void {
  const components = doc.components;
  if (!isSchemaNode(components) || !isSchemaNode(components.schemas)) return;
  const schemas = components.schemas;
  for (const [name, schema] of Object.entries(schemas)) {
    if (!isSchemaNode(schema) || !(Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf))) continue;
    const self = `#/components/schemas/${name}`;
    const replace = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(replace);
      if (!isSchemaNode(value)) return value;
      if (value.$ref === self) return {};
      return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, replace(child)]));
    };
    schemas[name] = replace(schema);
  }
}

/**
 * The served document repeats the same `security` on nearly every operation
 * and sets none at the top level. The Python generator reads a per-operation
 * requirement as "only an authenticated client may call this", but the
 * document-level default as "either client". Moving the most common
 * requirement to the document level, and dropping it from the operations that
 * repeat it, means the same thing to the API and keeps both client kinds
 * accepted where they were before.
 */
function hoistSharedSecurity(doc: Record<string, unknown>): void {
  if (doc.security !== undefined || !isSchemaNode(doc.paths)) return;
  const operations: SchemaNode[] = [];
  for (const pathItem of Object.values(doc.paths)) {
    if (!isSchemaNode(pathItem)) continue;
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (isSchemaNode(operation) && Array.isArray(operation.security)) operations.push(operation);
    }
  }
  const counts = new Map<string, number>();
  for (const operation of operations) {
    const key = JSON.stringify(operation.security);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const [shared] = [...counts.entries()].sort((left, right) => right[1] - left[1])[0] ?? [];
  if (shared === undefined || shared === "[]") return;
  doc.security = JSON.parse(shared);
  for (const operation of operations) {
    if (JSON.stringify(operation.security) === shared) delete operation.security;
  }
}

/**
 * The API sends its `Ratelimit-*` headers on nearly every response. The Go
 * generator turns a success response with headers into a wrapper type around
 * the body, so declaring them on every success would wrap every Go result.
 * A success response whose only declared headers are the rate-limit ones is
 * therefore generated without headers; success responses with other headers,
 * and every error response (where the SDKs surface a 429's limits), keep them.
 */
function dropRateLimitOnlySuccessHeaders(doc: Record<string, unknown>): void {
  if (!isSchemaNode(doc.paths)) return;
  for (const pathItem of Object.values(doc.paths)) {
    if (!isSchemaNode(pathItem)) continue;
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!isSchemaNode(operation) || !isSchemaNode(operation.responses)) continue;
      for (const [status, response] of Object.entries(operation.responses)) {
        if (!status.startsWith("2") || !isSchemaNode(response) || !isSchemaNode(response.headers)) continue;
        const names = Object.keys(response.headers);
        if (names.length > 0 && names.every((name) => name.toLowerCase().startsWith("ratelimit-"))) {
          delete response.headers;
        }
      }
    }
  }
}

function resolveCodegenRef(doc: Record<string, unknown>, value: unknown): unknown {
  let current = value;
  const seen = new Set<string>();
  while (isSchemaNode(current) && typeof current.$ref === "string" && !seen.has(current.$ref)) {
    seen.add(current.$ref);
    current = resolveLocalRef(doc, current.$ref);
  }
  return current;
}

/**
 * The Go generator gives every response with headers and the same body
 * schema (for example `ErrorResponse`) one shared Go type, built from the
 * headers of the first such response it meets, while each operation's
 * decoder sets the headers its own response declares. When those header sets
 * differ, the generated code does not compile. Every response that declares
 * headers therefore declares the union of the headers declared by responses
 * with the same body, each with the schema most of them use. Response headers
 * are optional, so this changes no request and accepts every response the API
 * sends. Responses without headers are left alone.
 */
function unifySharedResponseHeaders(doc: Record<string, unknown>): void {
  if (!isSchemaNode(doc.paths)) return;
  const groups = new Map<string, SchemaNode[]>();
  for (const pathItem of Object.values(doc.paths)) {
    if (!isSchemaNode(pathItem)) continue;
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!isSchemaNode(operation) || !isSchemaNode(operation.responses)) continue;
      for (const response of Object.values(operation.responses)) {
        const resolved = resolveCodegenRef(doc, response);
        if (!isSchemaNode(resolved) || !isSchemaNode(resolved.headers)) continue;
        if (Object.keys(resolved.headers).length === 0) continue;
        const content = isSchemaNode(resolved.content) ? resolved.content : {};
        const keys = Object.keys(content).sort();
        if (keys.length !== 1) continue;
        const media = content[keys[0]];
        const schema = isSchemaNode(media) ? media.schema : undefined;
        if (!isSchemaNode(schema) || typeof schema.$ref !== "string" || Object.keys(schema).length !== 1) continue;
        const key = `${keys[0]} ${schema.$ref}`;
        groups.set(key, [...(groups.get(key) ?? []), resolved]);
      }
    }
  }
  for (const responses of groups.values()) {
    const candidates = new Map<string, Map<string, { header: SchemaNode; count: number }>>();
    for (const response of responses) {
      for (const [name, header] of Object.entries(response.headers as SchemaNode)) {
        const resolved = resolveCodegenRef(doc, header);
        if (!isSchemaNode(resolved)) continue;
        const spelling = JSON.stringify(resolved.schema ?? null);
        const byName = candidates.get(name) ?? new Map();
        // Prefer a `$ref` spelling, so the shared header keeps its own name.
        const existing = byName.get(spelling);
        const representative =
          existing && typeof existing.header.$ref === "string"
            ? existing.header
            : isSchemaNode(header) && typeof header.$ref === "string"
              ? header
              : (existing?.header ?? resolved);
        const entry = { header: representative, count: existing?.count ?? 0 };
        entry.count += 1;
        byName.set(spelling, entry);
        candidates.set(name, byName);
      }
    }
    const union: SchemaNode = {};
    for (const name of [...candidates.keys()].sort()) {
      const spellings = [...(candidates.get(name) as Map<string, { header: SchemaNode; count: number }>).entries()];
      spellings.sort((left, right) => right[1].count - left[1].count || left[0].localeCompare(right[0]));
      const chosen = spellings[0][1].header;
      if (typeof chosen.$ref === "string") {
        union[name] = chosen;
      } else {
        const { required: _required, ...header } = chosen;
        union[name] = header;
      }
    }
    for (const response of responses) response.headers = structuredClone(union);
  }
}

/**
 * A nullable object component makes the Python generator build its inline
 * nested models once per reference, and it drops the component when two
 * references produce the same model name. The component is therefore made
 * non-nullable and every reference to it becomes a nullable reference
 * (`allOf: [{ $ref }]` with `nullable: true`), which accepts the same values.
 */
function moveComponentNullabilityToReferences(doc: Record<string, unknown>): void {
  const components = doc.components;
  if (!isSchemaNode(components) || !isSchemaNode(components.schemas)) return;
  const moved = new Set<string>();
  for (const [name, schema] of Object.entries(components.schemas)) {
    if (isSchemaNode(schema) && schema.nullable === true && schema.type === "object") {
      delete schema.nullable;
      moved.add(`#/components/schemas/${name}`);
    }
  }
  if (moved.size === 0) return;
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (!isSchemaNode(value)) return value;
    const [only] = Array.isArray(value.allOf) && value.allOf.length === 1 ? value.allOf : [];
    if (value.nullable === true && isSchemaNode(only) && typeof only.$ref === "string" && moved.has(only.$ref)) {
      return value;
    }
    if (typeof value.$ref === "string" && moved.has(value.$ref)) {
      const { $ref, ...rest } = value;
      return { ...rest, allOf: [{ $ref }], nullable: true };
    }
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, visit(child)]));
  };
  for (const key of Object.keys(doc)) {
    doc[key] = visit(doc[key]);
  }
}

function normalizeForCodegen(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeForCodegen);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  let next = value as Record<string, unknown>;

  for (const [key, child] of Object.entries(next)) {
    next[key] = normalizeForCodegen(child);
  }

  // A `const` with no `type` (for example `success: { const: true }`) is
  // typed from its value, so generators do not fall back to `any`.
  if (next.const !== undefined && next.type === undefined) {
    const constType = jsonTypeOf(next.const);
    if (constType) next.type = constType;
  }

  // OpenAPI 3.0 has no `const`; its spelling is a one-value `enum`, which the
  // generators type as that literal value instead of the bare type.
  if (
    (typeof next.const === "string" || typeof next.const === "number") &&
    next.enum === undefined
  ) {
    next.enum = [next.const];
    delete next.const;
  }

  // `oneOf` / `anyOf` branches that only say which properties must or must
  // not be present (`required`, `not`) constrain the object beside them; they
  // do not describe alternative shapes. No generator can express that, and
  // the Go generator stops on it, so the codegen document leaves it to the
  // server.
  for (const key of ["anyOf", "oneOf"] as const) {
    const branches = next[key];
    if (
      Array.isArray(branches) &&
      branches.length > 0 &&
      isSchemaNode(next.properties) &&
      branches.every(
        (branch) =>
          isSchemaNode(branch) && Object.keys(branch).every((name) => name === "required" || name === "not"),
      )
    ) {
      delete next[key];
    }
  }

  // The Go generator has no array or object defaults. The server applies
  // them, so a client that leaves the field out gets the same result.
  if (next.default !== null && typeof next.default === "object") {
    delete next.default;
  }

  // An `allOf` whose inline members both define a property is the same
  // property twice to the Python generator, which then drops the schema. Keep
  // the last definition, the most specific one.
  if (Array.isArray(next.allOf)) {
    const members = next.allOf;
    const seen = new Set<string>();
    for (let index = members.length - 1; index >= 0; index -= 1) {
      const member = members[index];
      if (!isSchemaNode(member) || !isSchemaNode(member.properties)) continue;
      const properties = member.properties;
      for (const name of Object.keys(properties)) {
        if (seen.has(name)) delete properties[name];
        else seen.add(name);
      }
    }
  }

  // A date-time header is sent as its string form; the Python generator does
  // not accept a typed value in a header.
  if (next.in === "header" && isSchemaNode(next.schema) && next.schema.format === "date-time") {
    delete next.schema.format;
  }

  // A string the generators type as a date, UUID or URL is already checked
  // by that type; the Go generator cannot apply a pattern or length to it.
  if (typeof next.format === "string" && TYPED_STRING_FORMATS.has(next.format)) {
    delete next.pattern;
    delete next.minLength;
    delete next.maxLength;
  }

  // Response header names are case-insensitive. Writing them in canonical
  // form keeps the Go generator from renaming each one with a warning.
  if (
    typeof next.description === "string" &&
    isSchemaNode(next.headers) &&
    Object.values(next.headers).every(
      (header) => isSchemaNode(header) && (header.schema !== undefined || typeof header.$ref === "string"),
    )
  ) {
    next.headers = Object.fromEntries(
      Object.entries(next.headers).map(([name, header]) => [canonicalHeaderName(name), header]),
    );
  }

  next = simplifyAnyOf(next);
  next = mergeIndistinctOneOf(next);

  // `anyOf: [{ $ref }, { type: "null" }]` (or the same with `oneOf`) is the
  // OpenAPI 3.1 spelling of a nullable reference. The generators read it as
  // `X | unknown`, so for them it becomes `allOf: [{ $ref }]` with
  // `nullable: true`, which they type as `X | null`. The published spec keeps
  // the explicit null branch.
  for (const key of ["anyOf", "oneOf"] as const) {
    const branches = next[key];
    if (!Array.isArray(branches) || branches.length !== 2) continue;
    const isObject = (item: unknown): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item);
    const ref = branches.find(
      (item) => isObject(item) && typeof item.$ref === "string" && Object.keys(item).length === 1,
    );
    const nullBranch = branches.find(
      (item) => isObject(item) && item.type === "null" && Object.keys(item).length === 1,
    );
    if (ref && nullBranch) {
      delete next[key];
      next.allOf = [ref];
      next.nullable = true;
    }
  }

  // OpenAPI 3.1 writes an exclusive bound as a number. The codegen document
  // is OpenAPI 3.0, where it is a boolean beside `minimum` / `maximum`.
  for (const [exclusive, inclusive] of [
    ["exclusiveMinimum", "minimum"],
    ["exclusiveMaximum", "maximum"],
  ] as const) {
    const bound = next[exclusive];
    if (typeof bound === "number") {
      next[inclusive] = bound;
      next[exclusive] = true;
    }
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
  location: "header" | "path" | "query",
): PrimitiveParameterManifest[] {
  return parameters
    .filter((parameter) => parameter.in === location && parameter.name)
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
        ...(typeof parameter.schema?.maximum === "number"
          ? { maximum: parameter.schema.maximum }
          : {}),
        ...(typeof parameter.schema?.minimum === "number"
          ? { minimum: parameter.schema.minimum }
          : {}),
        name: parameter.name!,
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
 * Surfaced for AGX: the `primitive describe` command advertises
 * itself as the place to look up response field meanings (e.g.
 * "which of `sender`, `from_email`, `from_header`, `smtp_mail_from`
 * to read"). That promise was not delivered before this field
 * existed; describe printed the manifest entry verbatim and the
 * manifest had no response schema at all.
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
  // The same envelope written inline: `{ success, data }` as one object.
  const ownProperties = fragment.properties;
  if (ownProperties && typeof ownProperties === "object") {
    const { data, success } = ownProperties as Record<string, unknown>;
    if (success !== undefined && data && typeof data === "object") {
      return data as Record<string, unknown>;
    }
  }
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

function hasBinaryResponse(doc: Record<string, unknown>, operation: OpenApiOperation): boolean {
  const responses = operation.responses ?? {};

  for (const response of Object.values(responses)) {
    const resolved = inlineSchemaRefs(doc, response) as typeof response;
    const content = resolved.content ?? {};
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

function operationPermissions(operation: OpenApiOperation): string[] | null {
  const raw = operation["x-primitive-permission"];
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw.map((value) => {
    if (typeof value !== "string" || !/^[a-z][a-z0-9_.]*:[a-z][a-z0-9_]*$/.test(value)) {
      throw new Error(`${operation.operationId}: x-primitive-permission entry ${JSON.stringify(value)} is not a permission`);
    }
    return value;
  });
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
        binaryResponse: hasBinaryResponse(doc, operation),
        bodyRequired: Boolean(operation.requestBody?.required),
        command: toKebabCase(operation.operationId),
        description: operation.description ?? null,
        hasJsonBody: hasJsonBody(operation),
        method: method.toUpperCase() as Uppercase<HttpMethod>,
        operationId: operation.operationId,
        path,
        pathParams: manifestParameters(parameters, "path"),
        queryParams: manifestParameters(parameters, "query"),
        headerParams: manifestParameters(parameters, "header"),
        permissions: operationPermissions(operation),
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

const rawSpec = YAML.parse(readFileSync(specPath, "utf8")) as Record<string, unknown>;
const codegenSpec = normalizeForCodegen(structuredClone(rawSpec)) as Record<string, unknown>;
openSelfReferencingUnions(codegenSpec);
moveComponentNullabilityToReferences(codegenSpec);
hoistSharedSecurity(codegenSpec);
dropRateLimitOnlySuccessHeaders(codegenSpec);
unifySharedResponseHeaders(codegenSpec);
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
  default?: boolean | number | string;
  description: string | null;
  enum: string[] | null;
  maximum?: number;
  minimum?: number;
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
  /**
   * Request headers the operation declares (for example
   * \`Idempotency-Key\`). \`name\` is the header name as the spec spells it.
   */
  headerParams: PrimitiveParameterManifest[];
  /**
   * Permissions the operation requires, all of them, from the spec's
   * \`x-primitive-permission\`. Null when the spec declares none.
   */
  permissions: string[] | null;
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

const permissionSet = new Set<string>();
const operationPermissionEntries: Array<[string, string[]]> = [];
for (const operation of manifest) {
  if (!operation.permissions) continue;
  operationPermissionEntries.push([operation.operationId, operation.permissions]);
  for (const permission of operation.permissions) permissionSet.add(permission);
}
const permissionList = [...permissionSet].sort();

const builtinRoleSchema = (
  (rawSpec.components as { schemas?: Record<string, { enum?: unknown }> } | undefined)?.schemas ?? {}
).BuiltinRoleKey;
if (!Array.isArray(builtinRoleSchema?.enum) || !builtinRoleSchema.enum.every((value) => typeof value === "string")) {
  throw new Error("components.schemas.BuiltinRoleKey must be a string enum");
}
const builtinRoleKeys = builtinRoleSchema.enum as string[];
operationPermissionEntries.sort(([left], [right]) => left.localeCompare(right));

writeFileSync(
  permissionsOutputPath,
  `/**
 * Permissions and built-in role keys declared by the Primitive API, from
 * the spec's \`x-primitive-permission\` extension and its \`BuiltinRoleKey\`
 * schema.
 *
 * AUTO-GENERATED - DO NOT EDIT
 * Run \`pnpm generate:openapi\` to regenerate.
 */

/** Every permission an operation in this API version requires. */
export const PERMISSIONS = ${JSON.stringify(permissionList, null, 2)} as const;

/** A permission an operation can require, such as \`mail:send\`. */
export type Permission = (typeof PERMISSIONS)[number];

/** The permissions each operation requires, all of them, by operation id. */
export const OPERATION_PERMISSIONS: Readonly<Record<string, readonly Permission[]>> = ${JSON.stringify(Object.fromEntries(operationPermissionEntries), null, 2)};

/**
 * The keys of the built-in roles, from the spec's \`BuiltinRoleKey\`.
 * Template and custom roles use other keys.
 */
export const BUILTIN_ROLE_KEYS = ${JSON.stringify(builtinRoleKeys, null, 2)} as const;
`,
);
