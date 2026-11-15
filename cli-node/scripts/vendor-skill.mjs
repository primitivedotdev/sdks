// Vendor one bundled skill from a checkout of the public skills repository,
// or check that the vendored copy still matches it.
//
//   node scripts/vendor-skill.mjs --skill <name> --from <skills-checkout> [--check]
//
// The checkout's HEAD commit is recorded in vendor/skills/<name>.source.json.
// --check fails when the vendored files differ from the checkout's skill
// directory, or when the recorded commit is not the checkout's HEAD.
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hashSkillFiles, listSkillFiles, SKILL_NAMES, skillVersion } from './skill-files.mjs'

const cliRoot = fileURLToPath(new URL('..', import.meta.url))

const args = process.argv.slice(2)
const option = (name) => {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}
const skillName = option('--skill')
const from = option('--from')
const check = args.includes('--check')
if (!skillName || !from) {
  console.error('Usage: node scripts/vendor-skill.mjs --skill <name> --from <skills-checkout> [--check]')
  process.exit(64)
}
if (!SKILL_NAMES.includes(skillName)) {
  console.error(`${skillName} is not a bundled skill. Bundled: ${SKILL_NAMES.join(', ')} (scripts/skill-files.mjs).`)
  process.exit(64)
}
const vendorDir = join(cliRoot, 'vendor', 'skills', skillName)
const sourceFile = join(cliRoot, 'vendor', 'skills', `${skillName}.source.json`)
const checkout = resolve(from)
const skillDir = join(checkout, 'skills', skillName)
if (!existsSync(join(skillDir, 'SKILL.md'))) {
  console.error(`No skills/${skillName}/SKILL.md under ${checkout}`)
  process.exit(1)
}
const commit = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const upstream = hashSkillFiles(skillDir)

if (check) {
  const recorded = JSON.parse(readFileSync(sourceFile, 'utf8'))
  const vendored = hashSkillFiles(vendorDir)
  const problems = []
  if (recorded.commit !== commit)
    problems.push(`recorded commit ${recorded.commit} is not the checkout HEAD ${commit}`)
  for (const file of new Set([...Object.keys(upstream), ...Object.keys(vendored)])) {
    if (!(file in vendored)) problems.push(`missing from vendor: ${file}`)
    else if (!(file in upstream)) problems.push(`not in the skills repository: ${file}`)
    else if (vendored[file] !== upstream[file]) problems.push(`differs: ${file}`)
  }
  if (recorded.version !== skillVersion(vendored))
    problems.push(`recorded version ${recorded.version} does not match the vendored files`)
  if (problems.length) {
    console.error(`Vendored ${skillName} does not match the skills repository:`)
    for (const problem of problems) console.error(`  ${problem}`)
    process.exit(1)
  }
  console.error(`Vendored ${skillName} matches ${commit} (version ${recorded.version}).`)
  process.exit(0)
}

rmSync(vendorDir, { recursive: true, force: true })
for (const file of listSkillFiles(skillDir)) {
  mkdirSync(dirname(join(vendorDir, file)), { recursive: true })
  copyFileSync(join(skillDir, file), join(vendorDir, file))
}
const version = skillVersion(hashSkillFiles(vendorDir))
writeFileSync(
  sourceFile,
  `${JSON.stringify({ repository: 'https://github.com/primitivedotdev/skills', path: `skills/${skillName}`, commit, version }, null, 2)}\n`,
)
console.error(`Vendored ${skillName} from ${commit} (version ${version}).`)
