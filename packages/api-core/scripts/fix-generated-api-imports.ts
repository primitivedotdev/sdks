import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const generatedRoot = resolve(scriptDir, "../src/api");

function visit(directory: string, files: string[] = []): string[] {
  for (const entry of readdirSync(directory)) {
    const entryPath = join(directory, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      visit(entryPath, files);
      continue;
    }

    if (entryPath.endsWith(".ts")) {
      files.push(entryPath);
    }
  }

  return files;
}

function addJsExtension(file: string, specifier: string): string {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
    return specifier;
  }

  if (specifier.endsWith(".js") || specifier.endsWith(".json")) {
    return specifier;
  }

  const absolute = resolve(dirname(file), specifier);
  if (existsSync(absolute) && statSync(absolute).isDirectory() && existsSync(join(absolute, "index.ts"))) {
    return `${specifier}/index.js`;
  }

  if (existsSync(`${absolute}.ts`)) {
    return `${specifier}.js`;
  }

  return `${specifier}.js`;
}

// @hey-api/openapi-ts emits `headers: { 'Content-Type': 'application/json',
// ...options.headers }` on every operation that has a request body in the
// spec, regardless of whether the body is required or optional. For
// optional-body operations (testFunction, cli_logout, start_cli_login,
// search_emails) this sends the header without a payload when the caller
// omits the body, which is wrong on the wire. Wrap the header in a
// runtime check so it only fires when a body is present. Required-body
// operations are unaffected (body is always defined by the type system).
function guardOptionalBodyContentType(content: string): string {
  return content.replace(
    /(headers:\s*\{\n\s*)'Content-Type':\s*'application\/json',\n(\s*\.\.\.options\.headers\n\s*\})/g,
    "$1...(options.body !== undefined && { 'Content-Type': 'application/json' }),\n$2",
  );
}

// @hey-api/openapi-ts currently treats the OpenAPI 3.1 `type: "null"` branch
// of this recursive JSON schema as `unknown`, which widens the entire generated
// alias. Keep the public schema standards-compliant, then repair this one alias
// so downstream SDK users get the exact JSON type.
function fixMemoryJsonValueType(content: string): string {
  return content.replace(
    /export type MemoryJsonValue = [\s\S]*?;\n\n\/\*\*\n \* Memory scope\./,
    `export type MemoryJsonValue = string | number | boolean | Array<MemoryJsonValue> | {
    [key: string]: MemoryJsonValue;
} | null;

/**
 * Memory scope.`,
  );
}

for (const file of visit(generatedRoot)) {
  const content = readFileSync(file, "utf8");
  let updated = content
    .replace(/(from\s+['"])(\.{1,2}\/[^'"]+)(['"])/g, (_, prefix, specifier, suffix) => {
      return `${prefix}${addJsExtension(file, specifier)}${suffix}`;
    })
    .replace(/(import\(\s*['"])(\.{1,2}\/[^'"]+)(['"]\s*\))/g, (_, prefix, specifier, suffix) => {
      return `${prefix}${addJsExtension(file, specifier)}${suffix}`;
    });
  updated = guardOptionalBodyContentType(updated);
  updated = fixMemoryJsonValueType(updated);

  if (updated !== content) {
    writeFileSync(file, updated);
  }
}
