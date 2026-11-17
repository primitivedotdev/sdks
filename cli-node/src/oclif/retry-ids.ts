import { randomUUID } from "node:crypto";

export const RETRY_ID_MARKER = "x-primitive-retry-id";
export type GeneratedRetryId = {
  field: string;
  flag: string | null;
  json_path: string;
  value: string;
  source: "generated";
};

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Only explicit annotations on UUID input fields enable defaults. */
export function retryIdFields(schema: unknown): string[] {
  if (!object(schema) || !object(schema.properties)) return [];
  return Object.entries(schema.properties)
    .filter(
      ([, property]) =>
        object(property) &&
        property[RETRY_ID_MARKER] === true &&
        property.type === "string" &&
        property.format === "uuid",
    )
    .map(([name]) => name);
}

export function prepareRetryIds(
  schema: unknown,
  body: unknown,
  bodyFlagToProperty: ReadonlyMap<string, string>,
  generate: () => string = randomUUID,
): { body: unknown; ids: GeneratedRetryId[] } {
  if (body !== undefined && !object(body)) return { body, ids: [] };
  const flags = new Map(
    [...bodyFlagToProperty].map(([flag, property]) => [property, `--${flag}`]),
  );
  let prepared = body;
  const ids: GeneratedRetryId[] = [];
  for (const field of retryIdFields(schema)) {
    // Explicit values, even null or invalid ones, remain caller-owned.
    if (object(prepared) && Object.hasOwn(prepared, field)) continue;
    if (prepared === body) prepared = { ...(object(body) ? body : {}) };
    const value = generate();
    Object.defineProperty(prepared, field, {
      value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
    ids.push({
      field,
      flag: flags.get(field) ?? null,
      json_path: /^[A-Za-z_][A-Za-z0-9_]*$/.test(field)
        ? `$.${field}`
        : `$[${JSON.stringify(field)}]`,
      value,
      source: "generated",
    });
  }
  return { body: prepared, ids };
}

const generatedIds = new WeakMap<object, readonly GeneratedRetryId[]>();

/** Store metadata per invocation, never on a shared command class or alias. */
export function rememberRetryIds(
  command: object,
  ids: readonly GeneratedRetryId[],
): void {
  if (ids.length) generatedIds.set(command, ids);
  else generatedIds.delete(command);
}

export function takeRetryIds(command: object): readonly GeneratedRetryId[] {
  const ids = generatedIds.get(command) ?? [];
  generatedIds.delete(command);
  return ids;
}

export function writeRetryIdNotice(ids: readonly GeneratedRetryId[]): void {
  for (const id of ids) {
    const reference = id.flag ?? id.json_path;
    const retry = id.flag
      ? `with ${id.flag} ${id.value}`
      : `with ${id.json_path} set to this value in your JSON body`;
    process.stderr.write(
      `Retry ID (${reference}): ${id.value}\nRetry the same operation and inputs ${retry}.\n`,
    );
  }
}
