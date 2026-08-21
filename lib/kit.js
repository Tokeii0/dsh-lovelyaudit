/** User-configured audit tool folder: list + run scripts the agent can call. */

import { spawn } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve, sep } from 'node:path'

const RUNNABLE = new Set(['.ps1', '.py', '.js', '.mjs', '.cjs', '.sh', '.bash', '.bat', '.cmd', '.exe', '.jar', '.rb', '.pl', '.php', '.go'])
const MAX_TOOLS = 80
const MAX_DEPTH = 2
const MAX_OUTPUT = 80_000

export function listKit(dir) {
  const root = typeof dir === 'string' ? dir.trim() : ''
  if (root === '') return { dir: '', ok: false, error: '', tools: [] }
  let resolved
  try {
    resolved = resolve(root)
  } catch {
    return { dir: root, ok: false, error: '路径无效', tools: [] }
  }
  if (!existsSync(resolved)) return { dir: resolved, ok: false, error: '路径不存在', tools: [] }
  let st
  try {
    st = statSync(resolved)
  } catch (error) {
    return { dir: resolved, ok: false, error: error instanceof Error ? error.message : String(error), tools: [] }
  }
  if (!st.isDirectory()) return { dir: resolved, ok: false, error: '不是文件夹', tools: [] }
  const tools = []
  walk(resolved, resolved, 0, tools)
  tools.sort((a, b) => a.name.localeCompare(b.name))
  return { dir: resolved, ok: true, error: '', tools }
}

function walk(root, current, depth, tools) {
  if (tools.length >= MAX_TOOLS) return
  let entries
  try {
    entries = readdirSync(current, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (tools.length >= MAX_TOOLS) return
    if (!entry.name || entry.name.startsWith('.')) continue
    const full = join(current, entry.name)
    if (entry.isDirectory()) {
      if (depth < MAX_DEPTH) walk(root, full, depth + 1, tools)
      continue
    }
    if (!entry.isFile()) continue
    const ext = extname(entry.name).toLowerCase()
    let size = 0
    try { size = statSync(full).size } catch {}
    tools.push({
      name: relative(root, full).split(sep).join('/'),
      ext,
      size,
      runnable: RUNNABLE.has(ext),
    })
  }
}

export function kitPromptText(kit) {
  if (!kit || !kit.dir) return ''
  if (!kit.ok) return `工具文件夹已配置但不可用：${kit.dir}（${kit.error || '无法读取'}）。到 设置 → 黑盒/代审 改路径。`
  const runnable = kit.tools.filter((item) => item.runnable)
  const lines = [
    `审计工具文件夹：${kit.dir}`,
    '需要专用脚本时优先用 audit_kit：action=list 看清单，action=run 且 name=相对路径 调用。也可以 pwsh/python 在该目录执行，但不要跑目录外的文件。',
  ]
  if (runnable.length === 0) {
    lines.push('该文件夹目前没有可执行脚本（.ps1/.py/.js/.exe/.bat 等）。')
  } else {
    lines.push('可调用：')
    for (const item of runnable.slice(0, 40)) lines.push(`- ${item.name}`)
    if (runnable.length > 40) lines.push(`- …共 ${runnable.length} 个`)
  }
  return lines.join('\n')
}

function withinRoot(root, candidate) {
  const base = root.endsWith(sep) ? root : root + sep
  return candidate === root || candidate.startsWith(base)
}

function runnerFor(full, ext, extraArgs) {
  const args = Array.isArray(extraArgs) ? extraArgs : []
  if (ext === '.ps1') return { command: 'pwsh', args: ['-NoProfile', '-File', full, ...args] }
  if (ext === '.py') return { command: 'python', args: [full, ...args] }
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') return { command: 'node', args: [full, ...args] }
  if (ext === '.bat' || ext === '.cmd') return { command: 'cmd.exe', args: ['/c', full, ...args] }
  if (ext === '.sh' || ext === '.bash') return { command: 'bash', args: [full, ...args] }
  if (ext === '.jar') return { command: 'java', args: ['-jar', full, ...args] }
  if (ext === '.rb') return { command: 'ruby', args: [full, ...args] }
  if (ext === '.pl') return { command: 'perl', args: [full, ...args] }
  if (ext === '.php') return { command: 'php', args: [full, ...args] }
  if (ext === '.exe') return { command: full, args }
  return null
}

function splitArgs(raw) {
  if (Array.isArray(raw)) return raw.map((item) => String(item))
  const text = typeof raw === 'string' ? raw.trim() : ''
  if (text === '') return []
  const out = []
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g
  let hit
  while ((hit = re.exec(text))) out.push(hit[1] || hit[2] || hit[3])
  return out
}

export async function pickNativeDirectory(ctx) {
  const picker = ctx && typeof ctx.get === 'function' ? ctx.get('directoryPicker') : null
  if (!picker || typeof picker.capability !== 'function') {
    return { ok: false, cancelled: false, path: '', error: '系统文件夹选择器不可用' }
  }
  let cap
  try { cap = picker.capability() } catch (error) {
    return { ok: false, cancelled: false, path: '', error: error instanceof Error ? error.message : String(error) }
  }
  if (!cap || cap.kind !== 'native' || typeof cap.pick !== 'function') {
    return { ok: false, cancelled: false, path: '', error: '当前环境没有系统文件夹对话框' }
  }
  try {
    const path = await cap.pick(new AbortController().signal)
    if (!path) return { ok: true, cancelled: true, path: '', error: '' }
    return { ok: true, cancelled: false, path: String(path), error: '' }
  } catch (error) {
    return { ok: false, cancelled: false, path: '', error: error instanceof Error ? error.message : String(error) }
  }
}

export function runKitTool(dir, name, args, extraEnv) {
  const kit = listKit(dir)
  if (!kit.ok) return Promise.resolve({ ok: false, error: kit.error || '未配置工具文件夹', stdout: '', stderr: '', code: 1 })
  const rel = String(name || '').trim().replace(/\\/g, '/')
  if (rel === '' || rel.includes('..')) return Promise.resolve({ ok: false, error: 'name 必须是工具文件夹内的相对路径', stdout: '', stderr: '', code: 1 })
  const full = resolve(kit.dir, rel)
  if (!withinRoot(kit.dir, full) || !existsSync(full)) {
    return Promise.resolve({ ok: false, error: `找不到工具 ${rel}`, stdout: '', stderr: '', code: 1 })
  }
  const ext = extname(full).toLowerCase()
  const spec = runnerFor(full, ext, splitArgs(args))
  if (!spec) {
    return Promise.resolve({ ok: false, error: `不支持直接运行 ${ext || '无扩展名'}，请用 pwsh 自行调用`, stdout: '', stderr: '', code: 1 })
  }
  return new Promise((resolveRun) => {
    const child = spawn(spec.command, spec.args, {
      cwd: kit.dir,
      windowsHide: true,
      env: extraEnv && typeof extraEnv === 'object' ? { ...process.env, ...extraEnv } : process.env,
    })
    let stdout = ''
    let stderr = ''
    child.stdout && child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
      if (stdout.length > MAX_OUTPUT) stdout = stdout.slice(-MAX_OUTPUT)
    })
    child.stderr && child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
      if (stderr.length > MAX_OUTPUT) stderr = stderr.slice(-MAX_OUTPUT)
    })
    child.on('error', (error) => {
      resolveRun({ ok: false, error: error instanceof Error ? error.message : String(error), stdout, stderr, code: 1, name: rel })
    })
    child.on('close', (code) => {
      resolveRun({
        ok: code === 0,
        error: code === 0 ? '' : `exit ${code}`,
        stdout,
        stderr,
        code: code == null ? 1 : code,
        name: rel,
        dir: kit.dir,
      })
    })
  })
}
