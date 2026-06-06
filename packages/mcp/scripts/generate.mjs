#!/usr/bin/env node
// Regenerate src/index.ts from the shared OpenAPI codegen JSON.
//
// Why not run openapi-mcp-generator directly into this package: it
// emits a whole opinionated project (its own package.json, tsconfig,
// eslintrc, jest config, .env.example, etc.) that conflicts with the
// workspace's hand-maintained metadata. We want only the server source
// from the generator; everything else (package.json, tsconfig, README,
// bin entry, publishConfig) is owned by this package and tracked in
// git.
//
// Strategy: run the generator into a tmp dir, copy out just the
// generated TypeScript, drop everything else.

import { mkdtemp, copyFile, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const packageDir = resolve(here, '..')
const repoRoot = resolve(packageDir, '../..')
const specPath = join(repoRoot, 'openapi', 'primitive-api.codegen.json')
const outPath = join(packageDir, 'src', 'index.ts')

const tmp = await mkdtemp(join(tmpdir(), 'primitive-mcp-gen-'))
try {
  const result = spawnSync(
    'npx',
    [
      '-y',
      'openapi-mcp-generator',
      '-i', specPath,
      '-o', tmp,
      '-n', '@primitivedotdev/mcp',
      '-t', 'stdio',
      '--default-include', 'false',
      '--force',
    ],
    { stdio: 'inherit' },
  )
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }

  // We only want the generated server file. Everything else the
  // generator produces (package.json, tsconfig, .env.example, ...) is
  // hand-maintained on this package and would be silently overwritten.
  await copyFile(join(tmp, 'src', 'index.ts'), outPath)

  // Post-process: three in-place patches the generator can't be
  // configured to do for us.
  //
  // 1. openapi-mcp-generator v3.3.0 emits a line that doesn't
  //    typecheck under strict mode (axios's AxiosResponseHeaders index
  //    signature returns a union that `.toLowerCase()` doesn't resolve
  //    on). Wrap the unknown value in String() before lowercasing.
  // 2. The generator strips the @-scope from the server-name CLI arg
  //    when deriving SERVER_NAME, producing "-primitivedotdev-mcp" as
  //    the advertised MCP serverInfo.name. Force the real package
  //    name.
  // 3. The generator hardcodes SERVER_VERSION from the OpenAPI
  //    info.version (currently "1.0.0", same as the API). The
  //    advertised version should match this package's package.json
  //    version so client-side telemetry can distinguish MCP releases
  //    from API releases.
  const pkgManifest = JSON.parse(
    await readFile(join(packageDir, 'package.json'), 'utf8'),
  )
  const body = await readFile(outPath, 'utf8')
  const patches = [
    [
      "response.headers['content-type']?.toLowerCase() || ''",
      "String(response.headers['content-type'] ?? '').toLowerCase()",
    ],
    [
      'export const SERVER_NAME = "-primitivedotdev-mcp";',
      `export const SERVER_NAME = ${JSON.stringify(pkgManifest.name)};`,
    ],
    [
      'export const SERVER_VERSION = "1.0.0";',
      `export const SERVER_VERSION = ${JSON.stringify(pkgManifest.version)};`,
    ],
  ]
  let patched = body
  for (const [from, to] of patches) {
    const next = patched.replace(from, to)
    if (next === patched) {
      console.warn(
        `WARN: postgen patch target not found, upstream generator may have changed:\n  ${from.slice(0, 80)}`,
      )
    }
    patched = next
  }
  await writeFile(outPath, patched)

  console.log(`wrote ${outPath}`)
} finally {
  await rm(tmp, { recursive: true, force: true })
}
