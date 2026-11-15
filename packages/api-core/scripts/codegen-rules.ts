/**
 * Codegen-only schema rewrites that are small enough to test on their own.
 * generate-openapi-artifacts.ts applies them while it derives
 * openapi/primitive-api.codegen.json; the published spec is unchanged.
 */

type SchemaNode = Record<string, unknown>;

function isSchemaNode(value: unknown): value is SchemaNode {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * A `oneOf` beside an object's own `properties`, whose branches are null or
 * objects that only narrow properties declared beside it (which values go
 * together), adds no shape: the properties beside it already admit every
 * branch. No generator can express the pairing, and the Go generator stops on
 * it, so the codegen document leaves it to the server. A null branch counts
 * only when the object beside it admits null. A `oneOf` with a
 * `discriminator` names its branches and is left alone. Returns the node
 * unchanged, or a copy without the `oneOf` when it only narrows.
 */
export function dropNarrowingOneOf(node: SchemaNode): SchemaNode {
  const branches = node.oneOf;
  if (
    !Array.isArray(branches) ||
    branches.length === 0 ||
    !isSchemaNode(node.properties) ||
    node.discriminator !== undefined
  ) {
    return node;
  }
  const declared = new Set(Object.keys(node.properties));
  const admitsNull =
    node.nullable === true || (Array.isArray(node.type) && node.type.includes("null"));
  const narrowsOnly = (branch: unknown): boolean => {
    if (!isSchemaNode(branch)) return false;
    if (branch.type === "null" && Object.keys(branch).length === 1) return admitsNull;
    return (
      branch.type === "object" &&
      isSchemaNode(branch.properties) &&
      Object.keys(branch).every((name) => name === "type" || name === "properties" || name === "required") &&
      Object.keys(branch.properties).every((name) => declared.has(name))
    );
  };
  if (!branches.every(narrowsOnly)) return node;
  const { oneOf: _oneOf, ...rest } = node;
  return rest;
}
