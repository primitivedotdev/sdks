/**
 * Rewrite openapi/primitive-api.yaml from the OpenAPI document the API
 * serves.
 *
 * Usage (from the repo root):
 *
 *   make openapi-sync SERVED=/path/to/served-openapi.json
 *
 * The served document is the source of truth for the API surface. This
 * script copies it whole and applies a fixed set of normalizations, so the
 * SDK spec is a mechanical function of the served document and a re-sync
 * is one command. Do not hand-edit primitive-api.yaml: change the served
 * document, or add a rule here.
 *
 * Normalizations (each keeps the published document valid OpenAPI 3.1):
 *
 *  1. `$schema` keys are dropped. They are JSON Schema dialect markers that
 *     the generators do not read.
 *  2. A nullable inline schema written as `anyOf` (or `oneOf`) of
 *     `[X, { type: "null" }]` becomes X with `type: [X.type, "null"]`. The
 *     wrapper's own keys (description, default, ...) are kept. A nullable
 *     `$ref` stays as `anyOf: [{ $ref }, { type: "null" }]`, which the
 *     codegen step already understands; a single-member `allOf` around that
 *     `$ref` is unwrapped first. `anyOf: [{}, { type: "null" }]` (any value,
 *     including null) becomes `{}`. Any schema whose `type` admits null,
 *     whether written that way or produced by this rule, also admits it in
 *     its value restriction: null is appended to `enum`, and a `const`
 *     becomes `enum: [const, null]`. Without that the published schema would
 *     reject the null its type allows.
 *  3. A string constrained by the lowercase UUID `pattern` gets
 *     `format: uuid` instead of the pattern, so every generator types it
 *     as a UUID.
 *  4. `additionalProperties: false` is dropped from every schema an
 *     operation response can reach. Generated clients then accept a field
 *     the API adds later instead of failing to decode the response.
 *     Request-only schemas keep it.
 *  5. The operations in SDK_OMITTED_OPERATIONS are left out, with any
 *     document-level tag only they used. The API still serves them; the
 *     SDKs do not wrap them. A notice is printed when the served document no
 *     longer has one, so the entry can be deleted.
 *  6. Components that no operation reaches (directly or through other
 *     components) are dropped, so the SDKs do not ship types for operations
 *     the API no longer serves, or that rule 5 leaves out. Security schemes
 *     are kept.
 *
 * Corrections: CORRECTIONS below lists places where the served document is
 * known to describe a response differently from what the API sends. Each one
 * checks that the defect is still present, applies a fix, and reports when
 * the served document no longer needs it, so it can be deleted. Keep this
 * list short: fix the served document instead where possible.
 *
 * Generator-specific rewrites that are not valid OpenAPI 3.1 (OpenAPI 3.0
 * `nullable`, media type aliases) live in generate-openapi-artifacts.ts,
 * which derives openapi/primitive-api.codegen.json from this file.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

const scriptDir = dirname(fileURLToPath(import.meta.url));
const specPath = resolve(scriptDir, "../../../openapi/primitive-api.yaml");

const UUID_PATTERN =
  "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$";
const HTTP_METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
];

function isObject(value: Json | undefined): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNullSchema(value: Json): boolean {
  return (
    isObject(value) && value.type === "null" && Object.keys(value).length === 1
  );
}

function isBareRef(value: Json): boolean {
  return (
    isObject(value) &&
    typeof value.$ref === "string" &&
    Object.keys(value).length === 1
  );
}

/**
 * A schema whose type now admits null must also let its value restriction
 * admit it: append null to `enum`, and turn `const` into `enum: [const, null]`.
 */
function allowNullValue(node: JsonObject): JsonObject {
  if (Array.isArray(node.enum)) {
    return node.enum.includes(null)
      ? node
      : { ...node, enum: [...node.enum, null] };
  }
  if ("const" in node) {
    const { const: value, ...rest } = node;
    return value === null
      ? { ...rest, enum: [null] }
      : { ...rest, enum: [value as Json, null] };
  }
  return node;
}

/** Rules 1 to 3: applied to every node of the document. */
export function normalizeNode(value: Json): Json {
  if (Array.isArray(value)) {
    return value.map(normalizeNode);
  }
  if (!isObject(value)) {
    return value;
  }

  let node: JsonObject = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "$schema") continue;
    node[key] = normalizeNode(child);
  }

  for (const key of ["anyOf", "oneOf"] as const) {
    const branches = node[key];
    if (!Array.isArray(branches) || branches.length !== 2) continue;
    const nullIndex = branches.findIndex(isNullSchema);
    if (nullIndex === -1) continue;
    const candidate = branches[1 - nullIndex];
    if (!isObject(candidate)) continue;
    let other: JsonObject = candidate;

    // `allOf: [{ $ref }]` alone is the same schema as `{ $ref }`.
    if (
      Object.keys(other).length === 1 &&
      Array.isArray(other.allOf) &&
      other.allOf.length === 1
    ) {
      const [only] = other.allOf;
      if (isObject(only) && isBareRef(only)) other = only;
    }

    const { [key]: _branches, ...wrapper } = node;
    if (isBareRef(other)) {
      node = { ...wrapper, [key]: [other, { type: "null" }] };
      continue;
    }
    if (Object.keys(other).length === 0) {
      node = wrapper;
      continue;
    }
    const otherType = other.type;
    if (typeof otherType === "string" || Array.isArray(otherType)) {
      const types = Array.isArray(otherType) ? otherType : [otherType];
      node = {
        ...other,
        ...wrapper,
        type: types.includes("null") ? types : [...types, "null"],
      };
    }
  }

  if (Array.isArray(node.type) && node.type.includes("null")) {
    node = allowNullValue(node);
  }

  if (node.pattern === UUID_PATTERN) {
    const { pattern: _pattern, ...rest } = node;
    node = { ...rest, format: "uuid" };
  }

  return node;
}

function collectRefs(value: Json, into: Set<string>): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, into);
  } else if (isObject(value)) {
    if (typeof value.$ref === "string") into.add(value.$ref);
    for (const child of Object.values(value)) collectRefs(child, into);
  }
  return into;
}

function resolvePointer(doc: JsonObject, ref: string): Json | undefined {
  if (!ref.startsWith("#/")) return undefined;
  let current: Json | undefined = doc;
  for (const raw of ref.slice(2).split("/")) {
    const segment = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    if (!isObject(current)) return undefined;
    current = current[segment];
  }
  return current;
}

function stripClosedObjects(value: Json): Json {
  if (Array.isArray(value)) return value.map(stripClosedObjects);
  if (!isObject(value)) return value;
  const node: JsonObject = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "additionalProperties" && child === false) continue;
    node[key] = stripClosedObjects(child);
  }
  return node;
}

/**
 * Rule 5: operations the API serves that the SDKs leave out, by
 * operationId, each with the reason.
 */
export const SDK_OMITTED_OPERATIONS: Readonly<Record<string, string>> = {
  getHealth:
    "An unauthenticated service health check for monitors, not part of the API an application calls.",
  askGet:
    "Served from the web origin, not the API base URL the generated clients call, so a generated call would answer 404.",
  ask: "Served from the web origin, not the API base URL the generated clients call, so a generated call would answer 404.",
};

function omitOperations(doc: JsonObject): void {
  const paths = isObject(doc.paths) ? doc.paths : {};
  const found = new Set<string>();
  const omittedTags = new Set<string>();
  for (const [path, pathItem] of Object.entries(paths)) {
    if (!isObject(pathItem)) continue;
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!isObject(operation) || typeof operation.operationId !== "string")
        continue;
      if (!Object.hasOwn(SDK_OMITTED_OPERATIONS, operation.operationId))
        continue;
      found.add(operation.operationId);
      if (Array.isArray(operation.tags)) {
        for (const tag of operation.tags)
          if (typeof tag === "string") omittedTags.add(tag);
      }
      delete pathItem[method];
    }
    if (!HTTP_METHODS.some((method) => isObject(pathItem[method]))) {
      delete paths[path];
    }
  }
  for (const id of Object.keys(SDK_OMITTED_OPERATIONS)) {
    if (!found.has(id)) {
      console.warn(
        `omitted operation not in the served document, remove it from SDK_OMITTED_OPERATIONS: ${id}`,
      );
    }
  }
  // A tag only the omitted operations used would name an empty group.
  for (const pathItem of Object.values(paths)) {
    if (!isObject(pathItem)) continue;
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (isObject(operation) && Array.isArray(operation.tags)) {
        for (const tag of operation.tags)
          if (typeof tag === "string") omittedTags.delete(tag);
      }
    }
  }
  if (Array.isArray(doc.tags)) {
    doc.tags = doc.tags.filter(
      (tag) =>
        !(isObject(tag) && typeof tag.name === "string" && omittedTags.has(tag.name)),
    );
  }
}

/** Rule 6: drop components that nothing outside `components` reaches. */
function dropUnreachableComponents(doc: JsonObject): string[] {
  const { components, ...rest } = doc;
  if (!isObject(components)) return [];
  const pending = [...collectRefs(rest, new Set())];
  const seen = new Set<string>();
  while (pending.length > 0) {
    const ref = pending.pop() as string;
    if (seen.has(ref)) continue;
    seen.add(ref);
    const target = resolvePointer(doc, ref);
    if (target === undefined) {
      throw new Error(`unresolved reference in served document: ${ref}`);
    }
    pending.push(...collectRefs(target, new Set()));
  }
  const dropped: string[] = [];
  for (const [section, group] of Object.entries(components)) {
    if (section === "securitySchemes" || !isObject(group)) continue;
    for (const name of Object.keys(group)) {
      const ref = `#/components/${section}/${name.replace(/~/g, "~0").replace(/\//g, "~1")}`;
      if (!seen.has(ref)) {
        delete group[name];
        dropped.push(`${section}/${name}`);
      }
    }
    if (Object.keys(group).length === 0) delete components[section];
  }
  return dropped;
}

/** Rule 4: open every schema an operation response can reach. */
function openResponseSchemas(doc: JsonObject): void {
  const paths = isObject(doc.paths) ? doc.paths : {};
  const pending: string[] = [];

  for (const pathItem of Object.values(paths)) {
    if (!isObject(pathItem)) continue;
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!isObject(operation) || !isObject(operation.responses)) continue;
      operation.responses = stripClosedObjects(operation.responses);
      pending.push(...collectRefs(operation.responses, new Set()));
    }
  }

  const seen = new Set<string>();
  while (pending.length > 0) {
    const ref = pending.pop() as string;
    if (seen.has(ref)) continue;
    seen.add(ref);
    const target = resolvePointer(doc, ref);
    if (target === undefined) {
      throw new Error(`unresolved reference in served document: ${ref}`);
    }
    pending.push(...collectRefs(target, new Set()));
  }

  // Replace each reached component in place so references stay valid.
  for (const ref of seen) {
    const match = /^#\/components\/([^/]+)\/([^/]+)$/.exec(ref);
    if (!match) continue;
    const [, section, rawName] = match;
    const name = rawName.replace(/~1/g, "/").replace(/~0/g, "~");
    const components = doc.components;
    if (!isObject(components)) continue;
    const group = components[section];
    if (!isObject(group) || group[name] === undefined) continue;
    group[name] = stripClosedObjects(group[name]);
  }
}

type Correction = {
  description: string;
  /** Applies the fix and returns true, or returns false when not needed. */
  apply: (doc: JsonObject) => boolean;
};

const CORRECTIONS: Correction[] = [];

export function syncOpenApi(served: JsonObject): JsonObject {
  if (typeof served.openapi !== "string" || !served.openapi.startsWith("3.1")) {
    throw new Error(
      `expected an OpenAPI 3.1 document, got openapi: ${String(served.openapi)}`,
    );
  }
  if (!isObject(served.paths) || Object.keys(served.paths).length === 0) {
    throw new Error("served document has no paths");
  }
  const doc = normalizeNode(structuredClone(served)) as JsonObject;
  for (const correction of CORRECTIONS) {
    if (!correction.apply(doc)) {
      console.warn(
        `correction no longer needed, remove it from sync-openapi.ts: ${correction.description}`,
      );
    }
  }
  omitOperations(doc);
  const dropped = dropUnreachableComponents(doc);
  if (dropped.length > 0) {
    console.log(`dropped ${dropped.length} components no operation uses`);
  }
  openResponseSchemas(doc);
  return doc;
}

// Line breaks to a YAML 1.1 parser (PyYAML), though not to this library. A
// string holding one is double-quoted, with the character escaped.
const YAML_11_BREAKS = /[\u0085\u2028\u2029]/;

// Plain words a YAML 1.1 parser reads as a boolean or null, though YAML 1.2
// reads them as strings: a key or value spelled so is double-quoted.
const YAML_11_WORDS =
  /^(?:y|Y|yes|Yes|YES|n|N|no|No|NO|on|On|ON|off|Off|OFF|true|True|TRUE|false|False|FALSE|null|Null|NULL|~)$/;

/** The document as YAML that YAML 1.1 and 1.2 parsers read the same way. */
export function renderYaml(doc: JsonObject): string {
  const document = new YAML.Document(doc, { aliasDuplicateObjects: false });
  YAML.visit(document, {
    Scalar(_key, node) {
      if (
        typeof node.value === "string" &&
        (YAML_11_BREAKS.test(node.value) || YAML_11_WORDS.test(node.value))
      ) {
        node.type = "QUOTE_DOUBLE";
      }
    },
  });
  return document
    .toString({ lineWidth: 0 })
    .replace(/\u0085/g, "\\N")
    .replace(/\u2028/g, "\\L")
    .replace(/\u2029/g, "\\P");
}

function main(): void {
  const input = process.argv[2];
  if (!input) {
    console.error("usage: sync-openapi <served-openapi.json>");
    process.exit(2);
  }
  const served = JSON.parse(readFileSync(resolve(input), "utf8")) as JsonObject;
  const doc = syncOpenApi(served);
  const header =
    "# Generated from the OpenAPI document the API serves.\n" +
    "# Do not edit by hand: run `make openapi-sync SERVED=<path>` (see RELEASE.md).\n";
  writeFileSync(specPath, header + renderYaml(doc));
  const operations = Object.values(doc.paths as JsonObject).reduce<number>(
    (count, item) =>
      count +
      (isObject(item)
        ? HTTP_METHODS.filter((method) => isObject(item[method])).length
        : 0),
    0,
  );
  console.log(`wrote ${specPath} (${operations} operations)`);
}

// Run only as a script, so the test can import the functions above.
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
