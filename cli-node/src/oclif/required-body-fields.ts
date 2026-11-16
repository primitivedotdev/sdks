import { Errors } from "@oclif/core";

export type MissingBodyField = {
  field: string;
  /** Null when this property must be supplied in JSON. */
  flag: string | null;
  json_path: string;
};

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function jsonPath(parts: readonly (string | number)[]): string {
  return parts.reduce<string>(
    (path, part) =>
      typeof part === "number" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(part)
        ? `${path}[${JSON.stringify(part)}]`
        : `${path}.${part}`,
    "$",
  );
}

/** Only exclude a union branch when a supplied literal contradicts it. */
function compatible(schema: unknown, value: unknown): boolean {
  if (!object(schema) || !object(value)) return true;
  const properties = object(schema.properties) ? schema.properties : {};
  for (const [name, property] of Object.entries(properties)) {
    if (!Object.hasOwn(value, name) || !object(property)) continue;
    const literal = value[name];
    if (
      literal === undefined ||
      (literal !== null && typeof literal === "object")
    )
      continue;
    if (
      Object.hasOwn(property, "const") &&
      !object(property.const) &&
      !Array.isArray(property.const) &&
      property.const !== literal
    )
      return false;
    if (Array.isArray(property.enum) && !property.enum.includes(literal))
      return false;
  }
  return true;
}

/**
 * Report missing properties, not type or permission failures. Alternative
 * schemas contribute only omissions shared by every still-possible branch.
 */
export function missingBodyFields(
  schema: unknown,
  body: unknown,
  flags: ReadonlyMap<string, string>,
  required: boolean,
): MissingBodyField[] {
  if (body === undefined && !required) return [];

  function visit(
    node: unknown,
    value: unknown,
    path: readonly (string | number)[],
  ): MissingBodyField[] {
    if (!object(node)) return [];
    const missing: MissingBodyField[] = [];
    if (object(value)) {
      const names = Array.isArray(node.required) ? node.required : [];
      for (const name of names) {
        if (typeof name !== "string") continue;
        if (Object.hasOwn(value, name) && value[name] !== undefined) continue;
        missing.push({
          field: name,
          flag: path.length === 0 ? (flags.get(name) ?? null) : null,
          json_path: jsonPath([...path, name]),
        });
      }
      if (object(node.properties)) {
        for (const [name, property] of Object.entries(node.properties)) {
          if (Object.hasOwn(value, name) && value[name] !== undefined)
            missing.push(...visit(property, value[name], [...path, name]));
        }
      }
    } else if (Array.isArray(value)) {
      for (const [index, item] of value.entries())
        missing.push(...visit(node.items, item, [...path, index]));
    }
    if (Array.isArray(node.allOf)) {
      for (const branch of node.allOf)
        missing.push(...visit(branch, value, path));
    }
    for (const union of [node.oneOf, node.anyOf]) {
      if (!Array.isArray(union)) continue;
      const branches = union
        .filter((branch) => compatible(branch, value))
        .map((branch) => visit(branch, value, path));
      if (branches.length === 0) continue;
      missing.push(
        ...branches[0].filter((field) =>
          branches.every((branch) =>
            branch.some((other) => other.json_path === field.json_path),
          ),
        ),
      );
    }
    return missing;
  }

  const missing = visit(schema, body === undefined ? {} : body, []);
  return [
    ...new Map(missing.map((field) => [field.json_path, field])).values(),
  ];
}

export function assertRequiredBodyFields(
  schema: unknown,
  body: unknown,
  flags: ReadonlyMap<string, string>,
  required: boolean,
): void {
  const missing = missingBodyFields(schema, body, flags, required);
  if (missing.length === 0 && (!required || body !== undefined)) return;
  const fields = missing.length
    ? missing
    : [{ field: "body", flag: null, json_path: "$" }];
  const message = `Missing required fields: ${fields
    .map((field) => field.flag ?? field.json_path)
    .join(
      ", ",
    )}. Supply the fields as flags where available, or use --raw-body / --body-file JSON.`;
  throw Object.assign(new Errors.CLIError(message, { exit: 2 }), {
    code: "usage_error",
    details: { missing: fields },
  });
}
