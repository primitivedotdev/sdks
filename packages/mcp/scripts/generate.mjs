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
// generated TypeScript, then apply a battery of postgen patches that
// the generator itself can't be configured to do for us.

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

// Resolve the locally-installed openapi-mcp-generator binary instead of
// reaching for `npx -y openapi-mcp-generator`. The latter hits the npm
// registry on every regen and the -y silently auto-installs whatever
// version the registry has at that moment; both make regen non-hermetic.
// The version we want is pinned as a devDep on this package.
const generatorBin = join(packageDir, 'node_modules', '.bin', 'openapi-mcp-generator')

const tmp = await mkdtemp(join(tmpdir(), 'primitive-mcp-gen-'))
try {
  const result = spawnSync(
    generatorBin,
    [
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
    if (result.error?.code === 'ENOENT') {
      console.error(
        `\nopenapi-mcp-generator binary not found at ${generatorBin}.\n` +
        `Run \`pnpm install\` from the repo root first so the devDep is resolved.`,
      )
    }
    process.exit(result.status ?? 1)
  }

  await copyFile(join(tmp, 'src', 'index.ts'), outPath)

  const pkgManifest = JSON.parse(
    await readFile(join(packageDir, 'package.json'), 'utf8'),
  )
  const body = await readFile(outPath, 'utf8')
  const patched = applyPostgenPatches(body, pkgManifest)
  await writeFile(outPath, patched)

  console.log(`wrote ${outPath}`)
} finally {
  await rm(tmp, { recursive: true, force: true })
}

function applyPostgenPatches(body, pkgManifest) {
  // Each patch is [description, from, to]. If a from-string is missing
  // from the generator output, the postgen pass exits non-zero so a
  // generator bump that renames any of these targets fails loudly
  // instead of silently shipping un-patched code.
  const patches = [
    [
      'strip nondeterministic Generated-on timestamp',
      / \* Generated on: [^\n]+\n/,
      ' * Generated on a stable timestamp (postgen strips the generator\'s wall-clock value)\n',
    ],
    [
      'wrap axios header value in String() so it typechecks under strict mode (openapi-mcp-generator v3.3.0 emits an index-signature union that lacks .toLowerCase)',
      "response.headers['content-type']?.toLowerCase() || ''",
      "String(response.headers['content-type'] ?? '').toLowerCase()",
    ],
    [
      'fix the server name (generator strips the @ from the scope)',
      'export const SERVER_NAME = "-primitivedotdev-mcp";',
      `export const SERVER_NAME = ${JSON.stringify(pkgManifest.name)};`,
    ],
    [
      'pin advertised version to this package, not the API spec',
      'export const SERVER_VERSION = "1.0.0";',
      `export const SERVER_VERSION = ${JSON.stringify(pkgManifest.version)};`,
    ],
    [
      'validate the API_BASE_URL override so a misconfigured client can\'t exfil the bearer token to an attacker-controlled host',
      'export const API_BASE_URL = process.env.API_BASE_URL || "https://api.primitive.dev/v1";',
      `const DEFAULT_API_BASE_URL = "https://api.primitive.dev/v1";
const PRIMITIVE_BEARER_HOST_SUFFIX = ".primitive.dev";
function resolveApiBaseUrl(): string {
    const raw = process.env.API_BASE_URL;
    if (!raw) return DEFAULT_API_BASE_URL;
    let parsed: URL;
    try { parsed = new URL(raw); }
    catch { throw new Error(\`API_BASE_URL is not a valid URL: \${JSON.stringify(raw)}\`); }
    const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1";
    if (parsed.protocol !== "https:" && !isLocal) {
        throw new Error(\`API_BASE_URL must use https (got \${parsed.protocol} on host \${parsed.hostname}). The MCP server forwards your bearer token to this host on every tool call; http to a non-local host would leak it in transit.\`);
    }
    if (!isLocal && parsed.hostname !== "primitive.dev" && !parsed.hostname.endsWith(PRIMITIVE_BEARER_HOST_SUFFIX)) {
        console.error(\`WARNING: API_BASE_URL points at \${parsed.hostname}, which is not a *.primitive.dev host. Your bearer token will be sent to this host on every tool call.\`);
    }
    return raw;
}
export const API_BASE_URL = resolveApiBaseUrl();`,
    ],
    [
      'only log API_BASE_URL when explicitly overridden (Greptile P2)',
      'console.error("API_BASE_URL is set to:", API_BASE_URL);',
      `if (process.env.API_BASE_URL) {
  console.error("API_BASE_URL overridden to:", API_BASE_URL);
}`,
    ],
    [
      'fix OAuth2 SCHEMENAME literal bug (Greptile P1) so future OAuth2 ops aren\'t silently broken',
      `        const clientId = process.env[\`OAUTH_CLIENT_ID_SCHEMENAME\`];
        const clientSecret = process.env[\`OAUTH_CLIENT_SECRET_SCHEMENAME\`];
        const scopes = process.env[\`OAUTH_SCOPES_SCHEMENAME\`];`,
      `        const clientId = process.env[\`OAUTH_CLIENT_ID_\${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}\`];
        const clientSecret = process.env[\`OAUTH_CLIENT_SECRET_\${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}\`];
        const scopes = process.env[\`OAUTH_SCOPES_\${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}\`];`,
    ],
    [
      'accept PRIMITIVE_API_KEY as an alias for the bearer readiness check',
      `                if (scheme.scheme?.toLowerCase() === 'bearer') {
                    return !!process.env[\`BEARER_TOKEN_\${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}\`];
                }`,
      `                if (scheme.scheme?.toLowerCase() === 'bearer') {
                    return !!process.env[\`BEARER_TOKEN_\${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}\`] || !!process.env.PRIMITIVE_API_KEY;
                }`,
    ],
    [
      'accept PRIMITIVE_API_KEY as an alias on bearer application',
      `                if (scheme.scheme?.toLowerCase() === 'bearer') {
                    const token = process.env[\`BEARER_TOKEN_\${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}\`];
                    if (token) {
                        headers['authorization'] = \`Bearer \${token}\`;
                        console.error(\`Applied Bearer token for '\${schemeName}'\`);
                    }
                }`,
      `                if (scheme.scheme?.toLowerCase() === 'bearer') {
                    const token = process.env[\`BEARER_TOKEN_\${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}\`] || process.env.PRIMITIVE_API_KEY;
                    if (token) {
                        headers['authorization'] = \`Bearer \${token}\`;
                    }
                }`,
    ],
    [
      'replace the silent-warn-then-401 path with a clear "no Primitive API key" error visible to the model',
      "        console.warn(`Tool '${toolName}' requires security: ${securityRequirementsString}, but no suitable credentials found.`);",
      "        throw new Error(`Tool '${toolName}' requires authentication, but no Primitive API key was found. Set PRIMITIVE_API_KEY in your MCP client config (or BEARER_TOKEN_BEARERAUTH). Get a key by running: npx -y @primitivedotdev/cli agent start-agent-signup`);",
    ],
    [
      'add additionalProperties:false to the outer sendEmail tool wrapper so typos at the top level fail loudly instead of being silently dropped by zod',
      'inputSchema: {"type":"object","properties":{"Idempotency-Key":',
      'inputSchema: {"type":"object","additionalProperties":false,"properties":{"Idempotency-Key":',
    ],
    [
      'add additionalProperties:false to the outer replyToEmail tool wrapper for the same reason',
      'inputSchema: {"type":"object","properties":{"id":{"type":"string","format":"uuid","description":"Resource UUID"},"requestBody":{"type":"object","additionalProperties":false,"description":"Body shape for `/emails/{id}/reply`',
      'inputSchema: {"type":"object","additionalProperties":false,"properties":{"id":{"type":"string","format":"uuid","description":"Resource UUID"},"requestBody":{"type":"object","additionalProperties":false,"description":"Body shape for `/emails/{id}/reply`',
    ],
  ]

  let patched = body
  const missed = []
  for (const [label, from, to] of patches) {
    const next = typeof from === 'string'
      ? patched.replace(from, to)
      : patched.replace(from, to)
    if (next === patched) missed.push(label)
    patched = next
  }
  if (missed.length > 0) {
    console.error(
      `\nERROR: postgen patches did not find their target strings. The upstream openapi-mcp-generator may have changed output between versions; each patch needs to be re-anchored before regen can proceed.\n\nMissed patches:\n  - ${missed.join('\n  - ')}\n`,
    )
    process.exit(2)
  }
  return patched
}
