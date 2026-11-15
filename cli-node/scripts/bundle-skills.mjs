// Build step: copy each vendored skill into dist/skills with a manifest of
// per-file hashes. `primitive agent connect` and `primitive skills install`
// install from this copy, so an installed skill always matches the CLI that
// installed it.
//
//   node scripts/bundle-skills.mjs [--out <dist-dir>]
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hashSkillFiles, listSkillFiles, SKILL_NAMES, skillVersion } from './skill-files.mjs'

const cliRoot = fileURLToPath(new URL('..', import.meta.url))
const args = process.argv.slice(2)
const outIndex = args.indexOf('--out')
const distDir = outIndex === -1 ? join(cliRoot, 'dist') : resolve(args[outIndex + 1] ?? '')

// Check every skill before writing any, so a failed build leaves no partial bundle.
const skills = SKILL_NAMES.map((name) => {
  const vendorDir = join(cliRoot, 'vendor', 'skills', name)
  const source = JSON.parse(readFileSync(join(cliRoot, 'vendor', 'skills', `${name}.source.json`), 'utf8'))
  const files = listSkillFiles(vendorDir)
  const hashes = hashSkillFiles(vendorDir, files)
  const version = skillVersion(hashes)
  if (version !== source.version) {
    // stderr only: this runs in prepack, whose stdout npm pack parses.
    console.error(
      `[cli build] FATAL: vendor/skills/${name} was edited by hand (version ${version}, recorded ${source.version}). Re-vendor it from the skills repository.`,
    )
    process.exit(1)
  }
  return { name, vendorDir, source, files, hashes, version }
})

for (const { name, vendorDir, source, files, hashes, version } of skills) {
  const outDir = join(distDir, 'skills', name)
  rmSync(outDir, { recursive: true, force: true })
  for (const file of files) {
    mkdirSync(dirname(join(outDir, file)), { recursive: true })
    copyFileSync(join(vendorDir, file), join(outDir, file))
  }
  writeFileSync(
    join(distDir, 'skills', `${name}.json`),
    `${JSON.stringify({ name, version, source: { repository: source.repository, path: source.path, commit: source.commit }, files: hashes }, null, 2)}\n`,
  )
  console.error(`[cli build] bundled ${name} ${version} (${files.length} files)`)
}
