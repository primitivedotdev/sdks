// Guard: the published CLI must NOT contain a runtime import of
// @primitivedotdev/sdk. The SDK is bundled inline (tsdown deps.alwaysBundle)
// because the tarball-isolation check forbids it as a runtime dependency. If
// sdk-node's dist is missing when tsdown runs (e.g. a publish flow that did not
// build the SDK first), tsdown silently leaves the import EXTERNAL, and the
// shipped CLI then dies at load with `Cannot find package
// '@primitivedotdev/sdk'`. That exact regression shipped in 1.6.0. Fail the
// build loudly here so it can never publish again.
import { readFileSync } from 'node:fs'

const ENTRY = new URL('../dist/oclif/index.js', import.meta.url)
const src = readFileSync(ENTRY, 'utf8')

// Real ESM imports are hoisted to the top of the bundle; check the head so a
// code-sample string deeper in the file (e.g. a scaffold template) can't
// false-positive. Match `import ... from "@primitivedotdev/sdk..."` and the
// dynamic/`require` forms.
const head = src.slice(0, 20_000)
const patterns = [
  /\bfrom\s*["']@primitivedotdev\/sdk(\/[^"']*)?["']/,
  /\b(?:import|require)\(\s*["']@primitivedotdev\/sdk(\/[^"']*)?["']\s*\)/,
]
const hit = patterns.map((re) => head.match(re)).find(Boolean)
if (hit) {
  console.error(
    `[cli build] FATAL: the bundle has an unbundled @primitivedotdev/sdk import: ${hit[0]}`,
  )
  console.error(
    '[cli build] sdk-node must be built before the CLI so tsdown can inline it (the build script does this; check the publish flow).',
  )
  process.exit(1)
}
// Write to stderr, never stdout: this runs in `prepack`, and the
// tarball-isolation check parses `npm pack`'s stdout as JSON, so any stdout
// here corrupts that parse.
console.error('[cli build] bundle check OK: @primitivedotdev/sdk is inlined')
