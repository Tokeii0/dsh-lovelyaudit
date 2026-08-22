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

export function normalizePickedPath(raw) {
  const text = String(raw || '').trim().replace(/^['"]+|['"]+$/g, '')
  if (!text) return ''
  const cleaned = text.replace(/\u0000/g, '').replace(/[\r\n]+/g, '').trim()
  if (!cleaned) return ''
  try {
    return resolve(cleaned)
  } catch {
    return cleaned
  }
}

function pickWithFolderBrowser() {
  const script = [
    '$utf8 = New-Object System.Text.UTF8Encoding($false)',
    '[Console]::OutputEncoding = $utf8',
    '$OutputEncoding = $utf8',
    'Add-Type -AssemblyName System.Windows.Forms',
    '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
    '$dialog.Description = "选择文件夹"',
    '$dialog.ShowNewFolderButton = $true',
    '$dialog.RootFolder = [System.Environment+SpecialFolder]::Desktop',
    '$result = $dialog.ShowDialog()',
    'if ($result -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.SelectedPath) }',
  ].join('; ')
  return new Promise((done) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-STA', '-Command', script], {
      windowsHide: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: kitEnv(),
    })
    liveChildren.add(child)
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += String(chunk) })
    child.stderr.on('data', (chunk) => { stderr += String(chunk) })
    child.on('error', (error) => {
      liveChildren.delete(child)
      done({ ok: false, cancelled: false, path: '', error: error instanceof Error ? error.message : String(error) })
    })
    child.on('close', (code) => {
      liveChildren.delete(child)
      const path = normalizePickedPath(stdout)
      if (path) {
        done({ ok: true, cancelled: false, path, error: '' })
        return
      }
      if (code === 0) {
        done({ ok: true, cancelled: true, path: '', error: '' })
        return
      }
      done({ ok: false, cancelled: false, path: '', error: stderr.trim() || `选择文件夹失败（exit ${code}）` })
    })
  })
}

async function pickWithHost(ctx) {
  const picker = ctx && typeof ctx.get === 'function' ? ctx.get('directoryPicker') : null
  if (!picker || typeof picker.capability !== 'function') return null
  let cap
  try { cap = picker.capability() } catch {
    return null
  }
  if (!cap || cap.kind !== 'native' || typeof cap.pick !== 'function') return null
  try {
    const path = normalizePickedPath(await cap.pick(new AbortController().signal))
    if (!path) return { ok: true, cancelled: true, path: '', error: '' }
    return { ok: true, cancelled: false, path, error: '' }
  } catch (error) {
    return { ok: false, cancelled: false, path: '', error: error instanceof Error ? error.message : String(error) }
  }
}

export async function pickNativeDirectory(ctx) {
  if (process.platform === 'win32') {
    const picked = await pickWithFolderBrowser()
    if (picked.ok) return picked
    const fallback = await pickWithHost(ctx)
    if (fallback) return fallback
    return picked
  }
  const host = await pickWithHost(ctx)
  if (host) return host
  return { ok: false, cancelled: false, path: '', error: '系统文件夹选择器不可用' }
}


/**
 * Env vars a kit tool legitimately needs to run. Everything else — API keys, model
 * credentials, session secrets — stays out of processes the model can invoke with
 * model-supplied arguments.
 */
const ENV_ALLOW = [
  'PATH', 'Path', 'PATHEXT', 'COMSPEC', 'ComSpec', 'SHELL',
  'HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH',
  'SystemRoot', 'SystemDrive', 'windir', 'WINDIR',
  'TEMP', 'TMP', 'TMPDIR',
  'APPDATA', 'LOCALAPPDATA', 'ProgramData', 'ProgramFiles', 'ProgramFiles(x86)',
  'LANG', 'LC_ALL', 'LANGUAGE', 'TZ', 'TERM',
  'OS', 'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE',
  'PYTHONIOENCODING', 'PYTHONUNBUFFERED',
]

/** Build a scrubbed environment: allowlisted ambient vars plus the caller's explicit extras. */
export function kitEnv(extraEnv) {
  const env = {}
  for (const key of ENV_ALLOW) {
    if (process.env[key] !== undefined) env[key] = process.env[key]
  }
  if (extraEnv && typeof extraEnv === 'object') Object.assign(env, extraEnv)
  return env
}

/** Hard ceiling for one kit tool run. Scanners are slow, but nothing may hang the tool call forever. */
export const KIT_RUN_TIMEOUT_MS = 300_000

/** Live kit children, so plugin disposal can reach quiescence instead of leaking scanners. */
const liveChildren = new Set()

/** Kill every kit tool still running. Called on plugin dispose. */
export function killKitChildren() {
  for (const child of liveChildren) {
    try { child.kill('SIGKILL') } catch { /* already gone */ }
  }
  liveChildren.clear()
}

export function runKitTool(dir, name, args, extraEnv, timeoutMs = KIT_RUN_TIMEOUT_MS) {
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
      env: kitEnv(extraEnv),
    })
    liveChildren.add(child)
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let settled = false
    const timer = timeoutMs > 0
      ? setTimeout(() => { timedOut = true; try { child.kill('SIGKILL') } catch { /* already gone */ } }, timeoutMs)
      : null
    const settle = (value) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      liveChildren.delete(child)
      resolveRun(value)
    }
    child.stdout && child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
      if (stdout.length > MAX_OUTPUT) stdout = stdout.slice(-MAX_OUTPUT)
    })
    child.stderr && child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
      if (stderr.length > MAX_OUTPUT) stderr = stderr.slice(-MAX_OUTPUT)
    })
    child.on('error', (error) => {
      settle({ ok: false, error: error instanceof Error ? error.message : String(error), stdout, stderr, code: 1, timedOut, signal: '', name: rel })
    })
    // exitCode / signal / timedOut are independent facts — report each on its own, never
    // one nested inside another's branch.
    child.on('close', (code, signal) => {
      settle({
        ok: code === 0 && !timedOut,
        error: timedOut ? `超时终止（${Math.round(timeoutMs / 1000)}s）` : (code === 0 ? '' : `exit ${code}${signal ? ' signal ' + signal : ''}`),
        stdout,
        stderr,
        code: code == null ? 1 : code,
        signal: signal || '',
        timedOut,
        name: rel,
        dir: kit.dir,
      })
    })
  })
}
