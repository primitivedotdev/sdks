// Shared file selection and hashing for the bundled primitive-connect skill.
// The skill's single source is the public skills repository. A release vendors
// one commit of it into vendor/skills, and the build copies that snapshot into
// dist/skills with a manifest. src/oclif/connect-skill.ts computes the same
// version from installed files, so the two must stay byte-for-byte identical in
// what they include and how they hash it.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const SKILL_NAME = 'primitive-connect'

/** Tests and dependency folders belong to the source repository, not to an installed skill. */
export function includedSkillFile(relativePath) {
  const parts = relativePath.split('/')
  if (parts.some((part) => part.startsWith('.') || part === 'node_modules')) return false
  return !/\.test\.[cm]?[jt]s$/.test(relativePath)
}

export function listSkillFiles(root) {
  const files = []
  const walk = (directory, prefix) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) walk(join(directory, entry.name), relative)
      else if (entry.isFile() && includedSkillFile(relative)) files.push(relative)
    }
  }
  walk(root, '')
  return files.sort()
}

export function hashSkillFiles(root, files = listSkillFiles(root)) {
  const hashes = {}
  for (const file of files)
    hashes[file] = createHash('sha256').update(readFileSync(join(root, file))).digest('hex')
  return hashes
}

/** One content version for the whole skill: sorted paths and their file hashes. */
export function skillVersion(hashes) {
  const digest = createHash('sha256')
  for (const file of Object.keys(hashes).sort()) digest.update(`${file}\0${hashes[file]}\n`)
  return digest.digest('hex').slice(0, 16)
}
