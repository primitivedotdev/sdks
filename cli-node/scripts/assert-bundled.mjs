// Guard: the published CLI must NOT contain a runtime reference to
// @primitivedotdev/sdk. The SDK is bundled inline (tsdown deps.alwaysBundle)
// because the tarball-isolation check forbids it as a runtime dependency. If
// sdk-node's dist is missing when tsdown runs (e.g. a publish flow that did not
// build the SDK first), tsdown silently leaves the import EXTERNAL, and the
// shipped CLI then dies at load with `Cannot find package
// '@primitivedotdev/sdk'`. That exact regression shipped in 1.6.0. Fail the
// build loudly here so it can never publish again.
//
// Scans EVERY emitted dist chunk (not just the primary entry) so a future
// code-split build cannot hide an external reference in a secondary chunk. For
// the static `import ... from "@pkg"` form, only the chunk head is checked,
// because bundlers hoist static imports to the top of each chunk and the rest of
// the bundle contains code-sample strings (scaffold templates) that legitimately
// mention the package and must not false-positive. The dynamic `import("@pkg")`
// and `require("@pkg")` forms are checked across the whole file, since those
// never appear in the sample strings.
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const PKG = '@primitivedotdev/sdk'
const escaped = PKG.replace(/[/]/g, '\\/')
const HEAD_BYTES = 64_000
const STATIC = new RegExp(`\\bfrom\\s*["'\`]${escaped}(\\/[^"'\`]*)?["'\`]`)
const DYNAMIC = new RegExp(`\\b(?:import|require)\\s*\\(\\s*["'\`]${escaped}(\\/[^"'\`]*)?["'\`]`)

const distDir = fileURLToPath(new URL('../dist/', import.meta.url))

function* jsFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}${entry.name}`
    if (entry.isDirectory()) yield* jsFiles(`${full}/`)
    else if (entry.name.endsWith('.js')) yield full
  }
}

const failures = []
for (const file of jsFiles(distDir)) {
  const src = readFileSync(file, 'utf8')
  const headHit = src.slice(0, HEAD_BYTES).match(STATIC)
  const dynamicHit = src.match(DYNAMIC)
  const hit = headHit ?? dynamicHit
  if (hit) failures.push(`${file.replace(distDir, 'dist/')}: ${hit[0]}`)
}

if (failures.length) {
  console.error(`[cli build] FATAL: the bundle has unbundled ${PKG} references:`)
  for (const f of failures) console.error(`  ${f}`)
  console.error(
    `[cli build] sdk-node must be built before the CLI so tsdown can inline it (the build script does this; check the publish flow).`,
  )
  process.exit(1)
}
// stderr, never stdout: this runs in `prepack`, and the tarball-isolation check
// parses `npm pack`'s stdout as JSON, so any stdout here corrupts that parse.
console.error(`[cli build] bundle check OK: ${PKG} is inlined across all chunks`)
