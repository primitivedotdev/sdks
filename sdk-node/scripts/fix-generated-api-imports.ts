import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const generatedRoot = resolve(scriptDir, "../src/api/generated");

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

for (const file of visit(generatedRoot)) {
  const content = readFileSync(file, "utf8");
  const updated = content
    .replace(/(from\s+['"])(\.{1,2}\/[^'"]+)(['"])/g, (_, prefix, specifier, suffix) => {
      return `${prefix}${addJsExtension(file, specifier)}${suffix}`;
    })
    .replace(/(import\(\s*['"])(\.{1,2}\/[^'"]+)(['"]\s*\))/g, (_, prefix, specifier, suffix) => {
      return `${prefix}${addJsExtension(file, specifier)}${suffix}`;
    });

  if (updated !== content) {
    writeFileSync(file, updated);
  }
}
