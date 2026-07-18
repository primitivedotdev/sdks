/**
 * Lazy loaders for Node's file system modules.
 *
 * The `/api` and `/payloads` entries must bundle cleanly for Workers-style
 * targets (esbuild with `platform: "browser"` and the `worker` / `browser`
 * conditions, as scaffolded by `primitive functions init`). A top-level
 * `import ... from "node:fs"` fails that bundle outright, even when the
 * importing function is never called. These helpers defer resolution to
 * call time instead:
 *
 * - `process.getBuiltinModule` (Node 22.3+, also implemented by Bun and
 *   Deno) loads a builtin without an import statement, so bundlers never
 *   see the specifier.
 * - The dynamic-import fallback covers runtimes that predate
 *   `getBuiltinModule`. The specifier is a function argument rather than
 *   a literal, so bundlers cannot resolve it statically and leave the
 *   expression in place.
 *
 * In a runtime with neither mechanism (a Workers isolate, a browser), the
 * loader throws an error naming the operation that needed file access.
 */

type NodeFsModule = typeof import("node:fs");
type NodeFsPromisesModule = typeof import("node:fs/promises");

/**
 * Load a Node builtin at call time. Exported for direct testing of the
 * unavailable-module error path; production code goes through the typed
 * wrappers below.
 */
export async function loadBuiltin<T>(
  specifier: string,
  operation: string,
): Promise<T> {
  const builtin =
    typeof process !== "undefined" &&
    typeof process.getBuiltinModule === "function"
      ? process.getBuiltinModule(specifier)
      : undefined;
  if (builtin !== undefined) return builtin as T;
  try {
    return (await import(specifier)) as T;
  } catch (cause) {
    throw new Error(
      `${operation} requires file system access, which this runtime does not provide. Pass in-memory bytes instead of a file path when running outside Node.js.`,
      { cause },
    );
  }
}

/** `node:fs`, loaded lazily so Workers-style bundles never see the import. */
export function loadNodeFs(operation: string): Promise<NodeFsModule> {
  return loadBuiltin<NodeFsModule>("node:fs", operation);
}

/** `node:fs/promises`, loaded lazily for the same reason as {@link loadNodeFs}. */
export function loadNodeFsPromises(
  operation: string,
): Promise<NodeFsPromisesModule> {
  return loadBuiltin<NodeFsPromisesModule>("node:fs/promises", operation);
}
