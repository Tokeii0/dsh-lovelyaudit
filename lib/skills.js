/** Register the plugin-bundled audit skills into ctx.skills so any install has them. */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SKILLS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills')
const PROVIDER = 'lovelyaudit'

function parseSkillFile(path) {
  const raw = readFileSync(path, 'utf8')
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw)
  if (!match) return null
  const front = match[1]
  const body = match[2].trim()
  const get = (key) => {
    const line = front.split(/\r?\n/).find((l) => l.startsWith(key + ':'))
    if (!line) return ''
    return line.slice(key.length + 1).trim().replace(/^['"]|['"]$/g, '')
  }
  const name = get('name')
  const description = get('description')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || !description || !body) return null
  return { name, description, content: body }
}

export function registerBundledSkills(ctx) {
  const skills = ctx && typeof ctx.get === 'function' ? ctx.get('skills') : (ctx && ctx.skills)
  if (!skills || typeof skills.register !== 'function') return { registered: 0, error: 'skills service unavailable' }
  if (!existsSync(SKILLS_DIR)) return { registered: 0, error: 'no bundled skills dir' }
  let registered = 0
  for (const entry of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const file = join(SKILLS_DIR, entry.name, 'SKILL.md')
    if (!existsSync(file)) continue
    let skill
    try {
      skill = parseSkillFile(file)
    } catch {
      continue
    }
    if (!skill) continue
    ctx.effect(() => skills.register({
      name: skill.name,
      description: skill.description,
      content: skill.content,
      source: 'bundled',
      provider: PROVIDER,
      path: file,
      resourceBase: { kind: 'directory', path: join(SKILLS_DIR, entry.name) },
    }))
    registered += 1
  }
  return { registered, error: '' }
}
