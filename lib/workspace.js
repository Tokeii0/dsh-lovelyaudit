/** Per-session audit ledger: mutate, snapshot, phase progress. */

import { renderReport } from './report.js'

// `skill` stays for backward compat (older snapshots / UI); `skills` is the full per-phase set.
export const PHASES = [
  { id: 'P0', name: '交战规则', goal: '钉死授权范围、实例台账与非破坏红线', skill: 'audit-methodology', skills: ['audit-methodology'] },
  { id: 'P1', name: '指纹', goal: '识别产品/版本/技术栈与 WAF，拉取已知 CVE 候选池', skill: 'blackbox-testing', skills: ['blackbox-testing', 'language-stack-audit'] },
  { id: 'P2', name: '测绘', goal: '路由/页面/组件/残留/Source-Sink 五张清单', skill: 'blackbox-testing', skills: ['blackbox-testing', 'modern-attack-surface'] },
  { id: 'P3', name: '黑盒', goal: '可达面地图、鉴权边界行为表与角色矩阵', skill: 'blackbox-testing', skills: ['blackbox-testing', 'auth-authz-testing', 'modern-attack-surface'] },
  { id: 'P4', name: '代审', goal: '污点连线、配置根因、依赖 CVE', skill: 'code-audit', skills: ['code-audit', 'language-stack-audit', 'vuln-coverage'] },
  { id: 'P5', name: '互证', goal: '可达性叠加缺陷，证伪后诚实定级', skill: 'audit-methodology', skills: ['audit-methodology', 'audit-reporting'] },
  { id: 'P6', name: '验证', goal: '最小非破坏 PoC，尝试放大影响', skill: 'blackbox-testing', skills: ['blackbox-testing', 'unknown-vuln'] },
  { id: 'P7', name: '闭环', goal: '入口×类型矩阵与矩阵外清单无空格后收工', skill: 'vuln-coverage', skills: ['vuln-coverage', 'unknown-vuln', 'audit-reporting'] },
]
export const PHASE_IDS = PHASES.map((p) => p.id)
export const GRADES = ['unauth', 'session', 'key', 'blocked', 'code']
export const IDEA_STATUSES = ['pending', 'testing', 'verified', 'failed', 'skipped']
export const COVER_STATUSES = ['unseen', 'clean', 'hit']
export const COVER_TYPES = ['RCE', 'SQLi', '文件', 'SSRF', 'XXE', 'XSS', '越权', '认证', 'CSRF', '重定向', '密码学', '并发', '信息', '逻辑']
export const SEVERITIES = ['Critical', 'High', 'Medium', 'Low', 'Info']
export const VERIFY_STATUSES = ['draft', 'unverified', 'verified', 'blocked']
export const BOARDS = ['config', 'campaign', 'ideas', 'map', 'vulns']
export const SUBGOAL_STATUSES = ['pending', 'active', 'done']
export const LEGACY_DEFAULT_REDLINES = '允许：只读探测、响应差分、时延、字节码分析、读无害文件。禁止：写/删数据、真传 WebShell、爆破口令、DoS、破坏性利用。能用差分/时延/带外证明的，就不落地真实利用。'
export const DEFAULT_REDLINES = ''

export function emptyPhaseProgress() {
  const progress = {}
  for (const phase of PHASES) {
    progress[phase.id] = {
      status: phase.id === 'P0' ? 'active' : 'pending',
      summary: '',
      events: [],
    }
  }
  return progress
}

export function emptyWorkspace(sessionId = '') {
  return {
    sessionId: typeof sessionId === 'string' ? sessionId : '',
    title: '未命名审计',
    objective: '',
    phase: 'P0',
    viewPhase: 'P0',
    board: 'config',
    redlines: DEFAULT_REDLINES,
    notes: '',
    url: '',
    port: '',
    role: '主站',
    production: false,
    ctfMode: false,
    username: '',
    password: '',
    headers: '',
    cookies: '',
    useGoal: false,
    maxGoalRounds: 0,
    updatedAt: 0,
    seq: 1,
    targets: [],
    fingerprints: [],
    surfaces: [],
    findings: [],
    coverage: [],
    ideas: [],
    campaign: emptyCampaign(),
    phaseProgress: emptyPhaseProgress(),
    run: { status: 'idle', error: '', lastTurn: 0, startedAt: 0, stoppedAt: 0 },
    reportMarkdown: '',
    reportJob: { status: 'idle', error: '', reason: '', childId: '', findingId: '', startedAt: 0, finishedAt: 0 },
  }
}

export function emptyCampaign() {
  return { goal: '', current: '', subgoals: [] }
}

export function emptyReportJob() {
  return { status: 'idle', error: '', reason: '', childId: '', findingId: '', startedAt: 0, finishedAt: 0 }
}

export const GOAL_UNLIMITED = Number.MAX_SAFE_INTEGER

export function normalizeGoalRounds(value) {
  if (value === undefined || value === null || value === '') return 0
  const text = String(value).trim().toLowerCase()
  if (text === '0' || text === 'inf' || text === 'infinite' || text === 'unlimited' || text === '∞') return 0
  const rounds = Number(value)
  if (!Number.isSafeInteger(rounds) || rounds < 0) return 0
  return rounds
}

export function goalRoundsForApi(value) {
  const rounds = normalizeGoalRounds(value)
  return rounds === 0 ? GOAL_UNLIMITED : rounds
}

function outlineParts(code) {
  const hit = String(code || '').trim().match(/^P(\d+(?:\.\d+)*)/i)
  if (!hit) return []
  return hit[1].split('.').map((part) => Number(part))
}

export function parentCodeOf(code) {
  const raw = String(code || '').trim()
  const hit = raw.match(/^(P\d+(?:\.\d+)*)/i)
  if (!hit) return ''
  const parts = hit[1].split('.')
  if (parts.length <= 1) return ''
  return parts.slice(0, -1).join('.')
}

export function compareOutline(a, b) {
  const left = outlineParts(a)
  const right = outlineParts(b)
  const n = Math.max(left.length, right.length)
  for (let i = 0; i < n; i += 1) {
    const x = Number.isFinite(left[i]) ? left[i] : -1
    const y = Number.isFinite(right[i]) ? right[i] : -1
    if (x !== y) return x - y
  }
  return String(a || '').localeCompare(String(b || ''), 'zh')
}

function ensureSubgoalShape(item) {
  if (!item || typeof item !== 'object') return item
  if (typeof item.code !== 'string') item.code = ''
  if (typeof item.parentId !== 'string') item.parentId = ''
  if (!Number.isSafeInteger(item.indent) || item.indent < 0) item.indent = 0
  if (!item.code) {
    const hit = String(item.title || '').match(/^(P\d+(?:\.\d+)*)\b/)
    if (hit) item.code = hit[1]
  }
  return item
}

function findSubgoalByCode(workspace, code) {
  const key = String(code || '').trim()
  if (!key) return null
  return workspace.campaign.subgoals.find((item) => item.code === key) || null
}

export function relinkSubgoalTree(workspace) {
  if (!workspace.campaign || !Array.isArray(workspace.campaign.subgoals)) return
  for (const item of workspace.campaign.subgoals) ensureSubgoalShape(item)
  for (const item of workspace.campaign.subgoals) {
    const parentCode = parentCodeOf(item.code)
    if (!parentCode) {
      if (!item.parentId) item.indent = 0
      continue
    }
    const parent = findSubgoalByCode(workspace, parentCode)
    if (!parent || parent.id === item.id) continue
    item.parentId = parent.id
    item.indent = (parent.indent || 0) + 1
  }
}

function resolveSubgoalParent(workspace, parentId, code, phase) {
  if (parentId) {
    const named = workspace.campaign.subgoals.find((row) => row.id === parentId)
    if (named) return named
  }
  const byCode = findSubgoalByCode(workspace, parentCodeOf(code))
  if (byCode) return byCode
  const phaseId = textOf(phase, workspace.phase || 'P1')
  return workspace.campaign.subgoals.find((row) => row.code === phaseId)
    || workspace.campaign.subgoals.find((row) => !row.parentId && row.phase === phaseId)
    || null
}

export function nextSubgoalCode(workspace, parentId, phase) {
  const parent = parentId ? workspace.campaign.subgoals.find((item) => item.id === parentId) : null
  if (parent && parent.code) {
    const prefix = `${parent.code}.`
    let max = 0
    for (const item of workspace.campaign.subgoals) {
      if (item.parentId !== parent.id) continue
      const rest = String(item.code || '').startsWith(prefix) ? String(item.code).slice(prefix.length) : ''
      const n = Number(rest)
      if (Number.isSafeInteger(n) && n > max) max = n
    }
    return `${prefix}${max + 1}`
  }
  const phaseId = textOf(phase, workspace.phase || 'P1')
  let max = 0
  for (const item of workspace.campaign.subgoals) {
    if (item.parentId) continue
    const match = String(item.code || '').match(new RegExp(`^${phaseId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(\\d+)$`))
    if (match) {
      const n = Number(match[1])
      if (n > max) max = n
    }
  }
  return `${phaseId}.${max + 1}`
}

export function numberedSubgoalTitle(code, title) {
  const raw = String(title || '').trim()
  if (!code) return raw
  const stripped = raw.replace(/^(P\d+(?:\.\d+)*)\s+/, '')
  return `${code} ${stripped}`
}

export function clone(value) {
  return structuredClone(value)
}

export function textOf(value, fallback = '') {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed === '' ? fallback : trimmed
}

export function requireText(value, field) {
  const text = textOf(value, '')
  if (text === '') throw new Error(`${field} is required`)
  return text
}

function findIndexById(list, id) {
  return list.findIndex((item) => item.id === id)
}

function ensureProgress(workspace) {
  if (!workspace.phaseProgress) workspace.phaseProgress = emptyPhaseProgress()
  if (!workspace.run) workspace.run = { status: 'idle', error: '', lastTurn: 0, startedAt: 0, stoppedAt: 0 }
  if (!workspace.reportJob) workspace.reportJob = emptyReportJob()
  if (typeof workspace.reportJob.findingId !== 'string') workspace.reportJob.findingId = ''
  if (typeof workspace.reportMarkdown !== 'string') workspace.reportMarkdown = ''
  if (!workspace.campaign || typeof workspace.campaign !== 'object') workspace.campaign = emptyCampaign()
  if (typeof workspace.campaign.goal !== 'string') workspace.campaign.goal = ''
  if (typeof workspace.campaign.current !== 'string') workspace.campaign.current = ''
  if (!Array.isArray(workspace.campaign.subgoals)) workspace.campaign.subgoals = []
  if (!Array.isArray(workspace.findings)) workspace.findings = []
  for (const finding of workspace.findings) ensureFindingReport(finding)
  if (!workspace.viewPhase) workspace.viewPhase = workspace.phase || 'P0'
  if (!BOARDS.includes(workspace.board)) workspace.board = 'config'
  if (typeof workspace.url !== 'string') workspace.url = ''
  if (typeof workspace.port !== 'string') workspace.port = ''
  if (typeof workspace.role !== 'string' || workspace.role === '') workspace.role = '主站'
  if (typeof workspace.username !== 'string') workspace.username = ''
  if (typeof workspace.password !== 'string') workspace.password = ''
  if (typeof workspace.headers !== 'string') workspace.headers = ''
  if (typeof workspace.cookies !== 'string') workspace.cookies = ''
  if (typeof workspace.useGoal !== 'boolean') workspace.useGoal = false
  if (typeof workspace.ctfMode !== 'boolean') workspace.ctfMode = false
  if (!Number.isSafeInteger(workspace.maxGoalRounds) || workspace.maxGoalRounds < 0) workspace.maxGoalRounds = 0
  for (const item of workspace.campaign.subgoals) ensureSubgoalShape(item)
  relinkSubgoalTree(workspace)
  if (typeof workspace.sessionId !== 'string') workspace.sessionId = ''
  if (!Array.isArray(workspace.ideas)) workspace.ideas = []
  if (typeof workspace.redlines !== 'string') workspace.redlines = ''
  if (workspace.redlines === LEGACY_DEFAULT_REDLINES) workspace.redlines = ''
}

function settleJobAfterReload(job) {
  if (!job || typeof job !== 'object') return
  if (job.status === 'writing' || job.status === 'queued') {
    job.status = 'idle'
    job.error = '进程重启，撰写任务未完成'
    job.childId = ''
    job.finishedAt = Date.now()
  }
}

export function settleAfterReload(workspace) {
  ensureProgress(workspace)
  if (workspace.run && workspace.run.status === 'running') {
    workspace.run.status = 'idle'
    workspace.run.error = 'DSH 重启后自动审计已停止，台账已从磁盘恢复。需要的话再点开始。'
    workspace.run.stoppedAt = Date.now()
  }
  settleJobAfterReload(workspace.reportJob)
  for (const finding of workspace.findings || []) settleJobAfterReload(finding.reportJob)
  return workspace
}

export function serializeWorkspace(workspace) {
  ensureProgress(workspace)
  return {
    sessionId: workspace.sessionId || '',
    title: workspace.title,
    objective: workspace.objective,
    phase: workspace.phase,
    viewPhase: workspace.viewPhase,
    board: workspace.board,
    redlines: workspace.redlines,
    notes: workspace.notes,
    url: workspace.url,
    port: workspace.port,
    role: workspace.role,
    production: workspace.production === true,
    ctfMode: workspace.ctfMode === true,
    username: workspace.username,
    password: workspace.password,
    headers: workspace.headers,
    cookies: workspace.cookies,
    useGoal: workspace.useGoal === true,
    maxGoalRounds: workspace.maxGoalRounds,
    updatedAt: workspace.updatedAt,
    seq: workspace.seq,
    targets: clone(workspace.targets),
    fingerprints: clone(workspace.fingerprints),
    surfaces: clone(workspace.surfaces),
    findings: clone(workspace.findings),
    coverage: clone(workspace.coverage),
    ideas: clone(workspace.ideas),
    campaign: clone(workspace.campaign),
    phaseProgress: clone(workspace.phaseProgress),
    run: clone(workspace.run),
    reportJob: clone(workspace.reportJob),
    reportMarkdown: workspace.reportMarkdown || '',
  }
}

export function hydrateWorkspace(raw, sessionId = '') {
  const workspace = emptyWorkspace(sessionId)
  if (!raw || typeof raw !== 'object') return settleAfterReload(workspace)
  const assign = (key) => {
    if (raw[key] !== undefined) workspace[key] = clone(raw[key])
  }
  for (const key of [
    'title', 'objective', 'phase', 'viewPhase', 'board', 'redlines', 'notes',
    'url', 'port', 'role', 'production', 'ctfMode', 'username', 'password', 'headers', 'cookies',
    'useGoal', 'maxGoalRounds', 'updatedAt', 'seq', 'targets', 'fingerprints', 'surfaces',
    'findings', 'coverage', 'ideas', 'campaign', 'phaseProgress', 'run', 'reportJob', 'reportMarkdown',
  ]) assign(key)
  workspace.sessionId = sessionId || textOf(raw.sessionId, workspace.sessionId)
  if (!Number.isSafeInteger(workspace.seq) || workspace.seq < 1) workspace.seq = 1
  // Ledgers written before severity was enforced stored every finding as Info, including
  // 未授权成立 ones. Heal them on load so existing audits stop rendering the contradiction.
  if (Array.isArray(workspace.findings)) {
    for (const item of workspace.findings) {
      if (!item || item.severity !== 'Info') continue
      if (item.grade === 'unauth' || item.grade === 'session') item.severity = GRADE_SEVERITY_FLOOR[item.grade]
    }
  }
  pruneOpenIdeas(workspace)
  return settleAfterReload(workspace)
}

export function appendPhaseEvent(workspace, phaseId, text) {
  ensureProgress(workspace)
  const row = workspace.phaseProgress[phaseId]
  if (!row) return
  row.events.push({ at: Date.now(), text: String(text).slice(0, 400) })
  if (row.events.length > 40) row.events.splice(0, row.events.length - 40)
}

export function snapshot(workspace) {
  ensureProgress(workspace)
  return {
    sessionId: workspace.sessionId || '',
    title: workspace.title,
    objective: workspace.objective,
    phase: workspace.phase,
    viewPhase: workspace.viewPhase,
    board: workspace.board,
    redlines: workspace.redlines,
    notes: workspace.notes,
    url: workspace.url,
    port: workspace.port,
    role: workspace.role,
    production: workspace.production === true,
    ctfMode: workspace.ctfMode === true,
    username: workspace.username,
    password: workspace.password,
    headers: workspace.headers,
    cookies: workspace.cookies,
    useGoal: workspace.useGoal === true,
    maxGoalRounds: workspace.maxGoalRounds,
    updatedAt: workspace.updatedAt,
    targets: clone(workspace.targets),
    fingerprints: clone(workspace.fingerprints),
    surfaces: clone(workspace.surfaces),
    findings: clone(workspace.findings),
    coverage: clone(workspace.coverage),
    ideas: clone(workspace.ideas),
    campaign: clone(workspace.campaign),
    progress: liveProgress(workspace),
    phaseProgress: clone(workspace.phaseProgress),
    run: clone(workspace.run),
    reportJob: clone(workspace.reportJob),
    reportMarkdown: workspace.reportMarkdown || '',
    reportSkeleton: renderReport(workspace),
    meta: {
      phases: PHASES,
      grades: GRADES,
      severities: SEVERITIES,
      verifyStatuses: VERIFY_STATUSES,
      ideaStatuses: IDEA_STATUSES,
      coverStatuses: COVER_STATUSES,
      coverTypes: COVER_TYPES,
    },
    stats: {
      targets: workspace.targets.length,
      fingerprints: workspace.fingerprints.length,
      surfaces: workspace.surfaces.length,
      findings: workspace.findings.length,
      ideas: workspace.ideas.length,
      ideasPending: workspace.ideas.filter((i) => i.status === 'pending' || i.status === 'testing').length,
      ideasVerified: workspace.ideas.filter((i) => i.status === 'verified').length,
      ideasFailed: workspace.ideas.filter((i) => i.status === 'failed').length,
      findingsVerified: workspace.findings.filter((f) => f.verifyStatus === 'verified').length,
      findingsReady: workspace.findings.filter((f) => f.reportJob && f.reportJob.status === 'ready').length,
      subgoals: workspace.campaign.subgoals.length,
      subgoalsDone: workspace.campaign.subgoals.filter((g) => g.status === 'done').length,
      coverageBlank: workspace.coverage.filter((c) => c.status === 'unseen').length,
      coverageHit: workspace.coverage.filter((c) => c.status === 'hit').length,
    },
  }
}

export function mutate(workspace, args = {}) {
  ensureProgress(workspace)
  const action = typeof args.action === 'string' ? args.action : 'get'
  const nid = (prefix) => {
    workspace.seq += 1
    return `${prefix}-${workspace.seq}`
  }
  const touch = () => {
    workspace.seq += 1
    workspace.updatedAt = Date.now()
    return snapshot(workspace)
  }

  if (action === 'get' || action === 'export_report') {
    return snapshot(workspace)
  }

  if (action === 'setup') {
    applyConfig(workspace, args)
    if (args.phase !== undefined) applyPhase(workspace, args.phase, 'setup')
    appendPhaseEvent(workspace, 'P0', '更新交战配置')
    return touch()
  }

  if (action === 'set_phase') {
    applyPhase(workspace, args.phase, 'agent')
    if (args.notes !== undefined) {
      const row = workspace.phaseProgress[workspace.phase]
      if (row) row.summary = textOf(args.notes, '')
    }
    return touch()
  }

  if (action === 'view_phase') {
    if (!PHASE_IDS.includes(args.phase)) throw new Error('unknown phase')
    workspace.viewPhase = args.phase
    return touch()
  }

  if (action === 'view_board') {
    const board = textOf(args.board, 'config')
    if (!BOARDS.includes(board)) throw new Error('unknown board')
    workspace.board = board
    return touch()
  }

  if (action === 'start_run') {
    applyConfig(workspace, args)
    const url = textOf(workspace.url, '')
    const objective = textOf(workspace.objective, '')
    if (workspace.targets.length === 0 && url === '' && objective === '') {
      throw new Error('先填写目标 URL，或写清审计目标')
    }
    if (url !== '' && !workspace.targets.some((item) => item.url === url)) {
      workspace.targets.push({
        id: nid('tgt'),
        url,
        port: textOf(workspace.port, ''),
        role: textOf(workspace.role, '主站'),
        production: workspace.production === true,
        notes: textOf(workspace.notes, ''),
      })
    }
    if (workspace.ideas.length === 0) seedCampaignIdeas(workspace)
    seedCampaignProgress(workspace)
    workspace.run = {
      status: 'running',
      error: '',
      lastTurn: 0,
      startedAt: Date.now(),
      stoppedAt: 0,
      useGoal: workspace.useGoal === true,
    }
    const keepView = workspace.viewPhase
    if (workspace.phaseProgress.P0) workspace.phaseProgress.P0.status = 'done'
    if (workspace.phase === 'P0') {
      workspace.phase = 'P1'
      if (workspace.phaseProgress.P1 && workspace.phaseProgress.P1.status !== 'done') {
        workspace.phaseProgress.P1.status = 'active'
      }
    }
    workspace.viewPhase = keepView || 'P0'
    appendPhaseEvent(workspace, 'P0', workspace.ctfMode
      ? (workspace.useGoal ? 'P0 配置完成，CTF Goal 启动（拿 flag）' : 'P0 配置完成，CTF 自动解题启动')
      : (workspace.useGoal ? 'P0 配置完成，Goal 长跑启动' : 'P0 配置完成，自动审计启动'))
    appendPhaseEvent(workspace, workspace.phase, 'Agent 开始自动推进，无需再填表')
    return touch()
  }

  if (action === 'stop_run') {
    workspace.run.status = 'idle'
    workspace.run.stoppedAt = Date.now()
    workspace.run.error = textOf(args.result, '')
    appendPhaseEvent(workspace, workspace.phase, '自动审计已停止')
    return touch()
  }

  if (action === 'add_target') {
    workspace.targets.push({
      id: nid('tgt'),
      url: requireText(args.url, 'url'),
      port: textOf(args.port, ''),
      role: textOf(args.role, '主站'),
      production: args.production === true,
      notes: textOf(args.notes, ''),
    })
    appendPhaseEvent(workspace, 'P0', `登记实例 ${textOf(args.role, '主站')} ${args.url}`)
    return touch()
  }

  if (action === 'remove_target') {
    const idx = findIndexById(workspace.targets, requireText(args.id, 'id'))
    if (idx < 0) throw new Error('target not found')
    workspace.targets.splice(idx, 1)
    return touch()
  }

  if (action === 'add_fingerprint') {
    workspace.fingerprints.push({
      id: nid('fp'),
      product: requireText(args.product, 'product'),
      version: textOf(args.version, ''),
      evidence: textOf(args.evidence, ''),
      cves: textOf(args.cves, ''),
    })
    upsertFingerprint(workspace, args)
    appendPhaseEvent(workspace, 'P1', `指纹 ${args.product} ${textOf(args.version, '')}`.trim())
    return touch()
  }

  if (action === 'record_surface') {
    upsertSurface(workspace, args)
    appendPhaseEvent(workspace, workspace.phase === 'P2' ? 'P2' : 'P3', `可达面 ${args.path} ${textOf(args.conclusion, '')}`.trim())
    return touch()
  }

  if (action === 'add_finding') {
    const finding = buildFinding(args, nid('fnd'), workspace)
    workspace.findings.push(finding)
    appendPhaseEvent(workspace, workspace.phase, `缺陷 ${finding.code} ${finding.title} [${finding.grade}/${finding.verifyStatus}]`)
    return touch()
  }

  if (action === 'update_finding') {
    const idx = findIndexById(workspace.findings, requireText(args.id, 'id'))
    if (idx < 0) throw new Error('finding not found')
    const item = workspace.findings[idx]
    if (args.title !== undefined) item.title = requireText(args.title, 'title')
    if (args.type !== undefined) item.type = textOf(args.type, item.type)
    if (args.grade !== undefined) {
      if (!GRADES.includes(args.grade)) throw new Error('unknown grade')
      item.grade = args.grade
    }
    if (args.source !== undefined) item.source = textOf(args.source, '')
    if (args.sink !== undefined) item.sink = textOf(args.sink, '')
    if (args.reachable !== undefined) item.reachable = textOf(args.reachable, '')
    if (args.prerequisite !== undefined) item.prerequisite = textOf(args.prerequisite, '')
    if (args.evidence !== undefined) item.evidence = textOf(args.evidence, '')
    applyFindingExtras(item, args)
    appendPhaseEvent(workspace, workspace.phase, `更新缺陷 ${item.code || item.id} ${item.title} [${item.verifyStatus}]`)
    return touch()
  }

  if (action === 'set_coverage') {
    const entry = requireText(args.entry, 'entry')
    const type = requireText(args.type, 'type')
    const status = textOf(args.status, 'unseen')
    if (!COVER_STATUSES.includes(status)) throw new Error('unknown coverage status')
    const hit = workspace.coverage.findIndex((c) => c.entry === entry && c.type === type)
    if (hit >= 0) workspace.coverage[hit].status = status
    else workspace.coverage.push({ entry, type, status })
    appendPhaseEvent(workspace, 'P7', `覆盖 ${entry} × ${type} = ${status}`)
    return touch()
  }

  if (action === 'add_idea') {
    const content = requireText(args.content, 'content')
    if (workspace.ideas.some((idea) => similarIdea(idea.content, content))) {
      return snapshot(workspace)
    }
    workspace.ideas.push({
      id: nid('idea'),
      content: content.slice(0, 100),
      status: textOf(args.status, 'pending'),
      result: textOf(args.result, '').slice(0, 160),
      priority: textOf(args.priority, 'medium'),
      phase: textOf(args.phase, workspace.phase),
      origin: textOf(args.origin, 'agent'),
    })
    pruneOpenIdeas(workspace)
    appendPhaseEvent(workspace, workspace.phase, `点子 ${content}`)
    return touch()
  }

  if (action === 'update_idea') {
    const idx = findIndexById(workspace.ideas, requireText(args.id, 'id'))
    if (idx < 0) throw new Error('idea not found')
    const item = workspace.ideas[idx]
    if (item.status === 'skipped' && args.status && args.status !== 'skipped' && args.origin !== 'user') {
      throw new Error('skipped ideas are owned by the user')
    }
    if (args.content !== undefined) item.content = requireText(args.content, 'content')
    if (args.status !== undefined) {
      if (!IDEA_STATUSES.includes(args.status)) throw new Error('unknown idea status')
      item.status = args.status
    }
    if (args.result !== undefined) item.result = textOf(args.result, '').slice(0, 160)
    if (args.priority !== undefined) item.priority = textOf(args.priority, item.priority)
    if (args.phase !== undefined) item.phase = textOf(args.phase, item.phase)
    pruneOpenIdeas(workspace)
    appendPhaseEvent(workspace, item.phase || workspace.phase, `点子 ${item.status}: ${item.content}`)
    return touch()
  }

  if (action === 'harvest_ideas') {
    applyHarvest(workspace, args)
    return touch()
  }

  if (action === 'set_campaign') {
    applyCampaign(workspace, args)
    appendPhaseEvent(workspace, workspace.phase, `目标 ${workspace.campaign.current || workspace.campaign.goal || '已更新'}`)
    return touch()
  }

  if (action === 'add_subgoal') {
    const title = requireText(args.title || args.content, 'title')
    if (workspace.campaign.subgoals.some((item) => similarIdea(item.title, title))) return snapshot(workspace)
    const phaseHint = textOf(args.phase, workspace.phase)
    const requestedCode = textOf(args.code, '') || (String(title).match(/^(P\d+(?:\.\d+)*)\b/) || [])[1] || ''
    const parent = resolveSubgoalParent(workspace, textOf(args.parentId, ''), requestedCode, phaseHint)
    const phase = textOf(args.phase, parent && parent.phase ? parent.phase : phaseHint)
    const code = requestedCode || nextSubgoalCode(workspace, parent ? parent.id : '', phase)
    const linked = resolveSubgoalParent(workspace, parent ? parent.id : '', code, phase)
    const item = {
      id: nid('sg'),
      title: numberedSubgoalTitle(code, title),
      code,
      parentId: linked ? linked.id : '',
      indent: linked ? (linked.indent || 0) + 1 : 0,
      status: SUBGOAL_STATUSES.includes(textOf(args.status, 'pending')) ? textOf(args.status, 'pending') : 'pending',
      detail: textOf(args.detail || args.result, ''),
      phase,
    }
    workspace.campaign.subgoals.push(item)
    relinkSubgoalTree(workspace)
    if (!workspace.campaign.current) workspace.campaign.current = title
    appendPhaseEvent(workspace, item.phase, `子目标 ${title}`)
    return touch()
  }

  if (action === 'update_subgoal') {
    const idx = findIndexById(workspace.campaign.subgoals, requireText(args.id, 'id'))
    if (idx < 0) throw new Error('subgoal not found')
    const item = workspace.campaign.subgoals[idx]
    if (args.title !== undefined) item.title = requireText(args.title, 'title')
    if (args.content !== undefined) item.title = requireText(args.content, 'content')
    if (args.status !== undefined) {
      if (!SUBGOAL_STATUSES.includes(args.status)) throw new Error('unknown subgoal status')
      item.status = args.status
    }
    if (args.detail !== undefined) item.detail = textOf(args.detail, '')
    if (args.result !== undefined) item.detail = textOf(args.result, item.detail)
    if (args.phase !== undefined) item.phase = textOf(args.phase, item.phase)
    if (args.code !== undefined) item.code = textOf(args.code, item.code)
    if (!item.code) item.code = nextSubgoalCode(workspace, item.parentId, item.phase)
    if (args.parentId !== undefined || args.code !== undefined) {
      const parent = resolveSubgoalParent(workspace, textOf(args.parentId, item.parentId), item.code, item.phase)
      item.parentId = parent ? parent.id : textOf(args.parentId, item.parentId)
      item.indent = parent ? (parent.indent || 0) + 1 : item.indent
    }
    relinkSubgoalTree(workspace)
    item.title = numberedSubgoalTitle(item.code, item.title)
    if (item.status === 'active') workspace.campaign.current = item.title
    appendPhaseEvent(workspace, item.phase || workspace.phase, `子目标 ${item.status}: ${item.title}`)
    return touch()
  }

  if (action === 'report_ready') {
    const finding = resolveFinding(workspace, args)
    let markdown = textOf(args.content, '')
    if (finding && finding.reportMarkdown && finding.reportMarkdown.length > markdown.length && /源码安全审计报告|##\s*0\.\s*本条摘要/.test(finding.reportMarkdown)) {
      markdown = finding.reportMarkdown
    }
    if (markdown && /专项报告已全文回传|撰写任务结束/.test(markdown) && markdown.length < 400) {
      if (finding && finding.reportMarkdown && finding.reportMarkdown.length > markdown.length) markdown = finding.reportMarkdown
      else markdown = ''
    }
    if (!markdown) return snapshot(workspace)
    const job = {
      status: 'ready',
      error: '',
      reason: textOf(args.reason, finding && finding.reportJob ? finding.reportJob.reason : ''),
      childId: textOf(args.childId, ''),
      findingId: finding ? finding.id : textOf(args.findingId || args.id, ''),
      startedAt: finding && finding.reportJob && finding.reportJob.startedAt ? finding.reportJob.startedAt : Date.now(),
      finishedAt: Date.now(),
    }
    if (finding) {
      finding.reportMarkdown = markdown
      finding.reportPath = textOf(args.path, finding.reportPath || '')
      finding.reportWriteError = textOf(args.writeError, '')
      finding.reportJob = job
    }
    workspace.reportJob = job
    workspace.reportMarkdown = markdown
    const where = finding && finding.reportPath ? ` → ${finding.reportPath}` : ''
    const writeErr = finding && finding.reportWriteError ? `（写盘失败：${finding.reportWriteError}）` : ''
    appendPhaseEvent(workspace, workspace.phase, `${finding && finding.code ? finding.code : '漏洞'} 专项报告已产出${where}${writeErr}`)
    return touch()
  }

  if (action === 'report_failed') {
    const finding = resolveFinding(workspace, args)
    const job = {
      status: 'failed',
      error: textOf(args.result, '报告撰写失败'),
      reason: textOf(args.reason, finding && finding.reportJob ? finding.reportJob.reason : ''),
      childId: textOf(args.childId, ''),
      findingId: finding ? finding.id : textOf(args.findingId || args.id, ''),
      startedAt: finding && finding.reportJob && finding.reportJob.startedAt ? finding.reportJob.startedAt : Date.now(),
      finishedAt: Date.now(),
    }
    if (finding) finding.reportJob = job
    workspace.reportJob = job
    appendPhaseEvent(workspace, workspace.phase, `报告撰写失败：${job.error}`)
    return touch()
  }

  throw new Error(`unknown action: ${action}`)
}

function nextFindingCode(workspace) {
  const used = new Set(workspace.findings.map((item) => String(item.code || '')))
  let n = workspace.findings.length + 1
  let code = `SRC-${String(n).padStart(2, '0')}`
  while (used.has(code)) {
    n += 1
    code = `SRC-${String(n).padStart(2, '0')}`
  }
  return code
}

function applyFindingExtras(item, args) {
  if (args.code !== undefined) item.code = textOf(args.code, item.code)
  if (args.severity !== undefined) {
    item.severity = resolveSeverity(args.severity, item.grade)
  }
  if (args.verifyStatus !== undefined) {
    const status = textOf(args.verifyStatus, item.verifyStatus || 'draft')
    if (!VERIFY_STATUSES.includes(status)) throw new Error('unknown verifyStatus')
    item.verifyStatus = status
  }
  if (args.cwe !== undefined) item.cwe = textOf(args.cwe, '')
  if (args.owasp !== undefined) item.owasp = textOf(args.owasp, '')
  if (args.cvss !== undefined) item.cvss = textOf(args.cvss, '')
  if (args.location !== undefined) item.location = textOf(args.location, '')
  if (args.snippet !== undefined) item.snippet = textOf(args.snippet, '')
  if (args.rationale !== undefined) item.rationale = textOf(args.rationale, '')
  if (args.impact !== undefined) item.impact = textOf(args.impact, '')
  if (args.fix !== undefined) item.fix = textOf(args.fix, '')
  if (args.variants !== undefined) item.variants = textOf(args.variants, '')
  if (args.rootCause !== undefined) item.rootCause = textOf(args.rootCause, '')
  if (args.verifyMethod !== undefined) item.verifyMethod = textOf(args.verifyMethod, '')
  if (args.verifyResult !== undefined) item.verifyResult = textOf(args.verifyResult, '')
  if (args.poc !== undefined) item.poc = textOf(args.poc, '')
  if (args.exp !== undefined) item.exp = textOf(args.exp, '')
  // A grade change can leave a legacy/implicit `Info` sitting on a finding that is now
  // real and reachable. Lift it to the grade's floor so 未授权成立 · Info never renders.
  if (item.severity === 'Info' && (item.grade === 'unauth' || item.grade === 'session')) {
    item.severity = GRADE_SEVERITY_FLOOR[item.grade]
  }
  if (item.verifyStatus === 'verified') {
    if (!item.rationale || !item.evidence || !item.reachable) {
      item.verifyStatus = 'draft'
    }
  }
}

export function canConfirmFinding(finding) {
  return Boolean(
    finding
    && String(finding.rationale || '').trim()
    && String(finding.evidence || '').trim()
    && String(finding.reachable || '').trim()
    && finding.verifyStatus === 'verified',
  )
}

export function findingBecameReportable(before, after) {
  return canConfirmFinding(after) && !canConfirmFinding(before)
}

/**
 * Severity floor implied by a P5 grade. `Info` means "not a vulnerability", so anything the
 * audit judged real and reachable can never sit there. Silently defaulting to Info was
 * mislabelling every finding the model reported without an explicit severity.
 */
const GRADE_SEVERITY_FLOOR = {
  unauth: 'High',
  session: 'Medium',
  key: 'Medium',
  blocked: 'Low',
  code: 'Low',
}

/**
 * Resolve a finding's severity against its grade.
 * Omitted → derive a floor from the grade. Explicitly contradictory → throw, so the model
 * fixes it rather than having a wrong level silently rewritten underneath it.
 */
export function resolveSeverity(value, grade) {
  const given = textOf(value, '')
  if (given === '') return GRADE_SEVERITY_FLOOR[grade] || 'Info'
  if (!SEVERITIES.includes(given)) {
    throw new Error(`unknown severity「${given}」，只能是 ${SEVERITIES.join(' / ')}`)
  }
  if (given === 'Info' && (grade === 'unauth' || grade === 'session')) {
    throw new Error(`grade=${grade} 表示缺陷真实且线上可达，与 severity=Info（非漏洞）矛盾。按实际影响给 Critical / High / Medium / Low。`)
  }
  return given
}

function buildFinding(args, id, workspace) {
  const grade = textOf(args.grade, 'code')
  if (!GRADES.includes(grade)) throw new Error('unknown grade')
  const item = {
    id,
    code: textOf(args.code, nextFindingCode(workspace)),
    title: requireText(args.title, 'title'),
    type: textOf(args.type, '逻辑'),
    grade,
    severity: resolveSeverity(args.severity, grade),
    verifyStatus: 'draft',
    source: textOf(args.source, ''),
    sink: textOf(args.sink, ''),
    reachable: textOf(args.reachable, ''),
    prerequisite: textOf(args.prerequisite, ''),
    evidence: textOf(args.evidence, ''),
    cwe: '',
    owasp: '',
    cvss: '',
    location: '',
    snippet: '',
    rationale: '',
    impact: '',
    fix: '',
    variants: '',
    rootCause: '',
    verifyMethod: '',
    verifyResult: '',
    poc: '',
    exp: '',
    reportMarkdown: '',
    reportPath: '',
    reportWriteError: '',
    reportJob: emptyReportJob(),
  }
  applyFindingExtras(item, args)
  return item
}

function ensureFindingReport(finding) {
  if (!finding || typeof finding !== 'object') return finding
  if (typeof finding.reportMarkdown !== 'string') finding.reportMarkdown = ''
  if (typeof finding.reportPath !== 'string') finding.reportPath = ''
  if (typeof finding.reportWriteError !== 'string') finding.reportWriteError = ''
  if (!finding.reportJob || typeof finding.reportJob !== 'object') finding.reportJob = emptyReportJob()
  if (typeof finding.reportJob.findingId !== 'string') finding.reportJob.findingId = finding.id || ''
  if (typeof finding.poc !== 'string') finding.poc = ''
  if (typeof finding.exp !== 'string') finding.exp = ''
  return finding
}

function resolveFinding(workspace, args) {
  const id = textOf(args.findingId, textOf(args.id, ''))
  if (id) {
    const hit = workspace.findings.find((item) => item.id === id || item.code === id)
    if (hit) return ensureFindingReport(hit)
  }
  return null
}

function applyCampaign(workspace, args) {
  if (args.goal !== undefined) workspace.campaign.goal = textOf(args.goal, '')
  if (args.current !== undefined) workspace.campaign.current = textOf(args.current, '')
  if (args.title !== undefined && !args.goal) workspace.campaign.goal = textOf(args.title, workspace.campaign.goal)
  if (Array.isArray(args.subgoals)) {
    for (const row of args.subgoals) {
      const title = textOf(row && (row.title || row.content), '')
      if (title === '') continue
      const existing = workspace.campaign.subgoals.find((item) => similarIdea(item.title, title) || (row.id && item.id === row.id))
      if (existing) {
        if (row.status && SUBGOAL_STATUSES.includes(row.status)) existing.status = row.status
        if (row.detail !== undefined || row.result !== undefined) existing.detail = textOf(row.detail || row.result, existing.detail)
        if (existing.status === 'active') workspace.campaign.current = existing.title
        continue
      }
      workspace.seq += 1
      const phaseHint = textOf(row.phase, workspace.phase)
      const requestedCode = textOf(row.code, '') || (String(title).match(/^(P\d+(?:\.\d+)*)\b/) || [])[1] || ''
      const parent = resolveSubgoalParent(workspace, textOf(row.parentId, ''), requestedCode, phaseHint)
      const phase = textOf(row.phase, parent && parent.phase ? parent.phase : phaseHint)
      const code = requestedCode || nextSubgoalCode(workspace, parent ? parent.id : '', phase)
      const linked = resolveSubgoalParent(workspace, parent ? parent.id : '', code, phase)
      const item = {
        id: `sg-${workspace.seq}`,
        title: numberedSubgoalTitle(code, title),
        code,
        parentId: linked ? linked.id : '',
        indent: linked ? (linked.indent || 0) + 1 : 0,
        status: row.status && SUBGOAL_STATUSES.includes(row.status) ? row.status : 'pending',
        detail: textOf(row.detail || row.result, ''),
        phase,
      }
      workspace.campaign.subgoals.push(item)
      if (item.status === 'active') workspace.campaign.current = item.title
    }
  }
  relinkSubgoalTree(workspace)
}

export function liveProgress(workspace) {
  ensureProgress(workspace)
  const phase = PHASES.find((item) => item.id === workspace.phase) || PHASES[0]
  const currentIdea = workspace.ideas.find((item) => item.status === 'testing') || workspace.ideas.find((item) => item.status === 'pending')
  const activeSub = workspace.campaign.subgoals.find((item) => item.status === 'active')
  const current = workspace.campaign.current
    || (activeSub && activeSub.title)
    || (currentIdea && currentIdea.content)
    || phase.goal
  const done = workspace.campaign.subgoals.filter((item) => item.status === 'done').length
  const total = workspace.campaign.subgoals.length
  return {
    phase: workspace.phase,
    phaseName: phase.name,
    goal: workspace.campaign.goal || workspace.objective || workspace.title,
    current,
    detail: (activeSub && activeSub.detail) || (currentIdea && currentIdea.result) || '',
    subgoals: clone(workspace.campaign.subgoals),
    done,
    total,
    idea: currentIdea ? { id: currentIdea.id, content: currentIdea.content, status: currentIdea.status } : null,
    run: workspace.run.status,
  }
}

function applyConfig(workspace, args) {
  if (args.title !== undefined) workspace.title = textOf(args.title, workspace.title)
  if (args.objective !== undefined) workspace.objective = textOf(args.objective, '')
  if (args.notes !== undefined) workspace.notes = textOf(args.notes, '')
  if (args.redlines !== undefined) workspace.redlines = textOf(args.redlines, '')
  if (args.url !== undefined) workspace.url = textOf(args.url, '')
  if (args.port !== undefined) workspace.port = textOf(args.port, '')
  if (args.role !== undefined) workspace.role = textOf(args.role, '主站')
  if (args.production !== undefined) workspace.production = args.production === true
  if (args.ctfMode !== undefined) workspace.ctfMode = args.ctfMode === true
  if (args.username !== undefined) workspace.username = textOf(args.username, '')
  if (args.password !== undefined) workspace.password = textOf(args.password, '')
  if (args.headers !== undefined) workspace.headers = textOf(args.headers, '')
  if (args.cookies !== undefined) workspace.cookies = textOf(args.cookies, '')
  if (args.useGoal !== undefined) workspace.useGoal = args.useGoal === true
  if (args.maxGoalRounds !== undefined) workspace.maxGoalRounds = normalizeGoalRounds(args.maxGoalRounds)
}

function applyPhase(workspace, phase, source) {
  if (!PHASE_IDS.includes(phase)) throw new Error('unknown phase')
  const prev = workspace.phase
  workspace.phase = phase
  if (source === 'setup') workspace.viewPhase = phase
  const prevRow = workspace.phaseProgress[prev]
  const nextRow = workspace.phaseProgress[phase]
  if (prevRow && prev !== phase && prevRow.status === 'active') prevRow.status = 'done'
  if (nextRow && nextRow.status !== 'done') nextRow.status = 'active'
  for (const item of workspace.campaign.subgoals) {
    if (item.phase === prev && item.status === 'active') item.status = 'done'
    if (item.phase === phase && item.status !== 'done') {
      item.status = 'active'
      workspace.campaign.current = item.title
    }
  }
  appendPhaseEvent(workspace, phase, source === 'setup' ? `进入 ${phase}` : `推进到 ${phase}`)
}

export function upsertFingerprint(workspace, args) {
  const product = requireText(args.product, 'product')
  const version = textOf(args.version, '')
  const existing = workspace.fingerprints.find((item) => item.product === product && item.version === version)
  if (existing) {
    if (args.evidence) existing.evidence = textOf(args.evidence, existing.evidence)
    if (args.cves) existing.cves = textOf(args.cves, existing.cves)
    return existing
  }
  const row = {
    id: `fp-${workspace.seq + 1}`,
    product,
    version,
    evidence: textOf(args.evidence, ''),
    cves: textOf(args.cves, ''),
  }
  workspace.seq += 1
  workspace.fingerprints.push(row)
  return row
}

export function upsertSurface(workspace, args) {
  const path = requireText(args.path, 'path')
  const method = textOf(args.method, 'GET') || 'GET'
  const existing = workspace.surfaces.find((item) => item.path === path && item.method === method)
  if (existing) {
    if (args.kind) existing.kind = textOf(args.kind, existing.kind)
    if (args.unauthCode !== undefined) existing.unauthCode = textOf(args.unauthCode, existing.unauthCode)
    if (args.size !== undefined) existing.size = textOf(args.size, existing.size)
    if (args.location !== undefined) existing.location = textOf(args.location, existing.location)
    if (args.conclusion !== undefined) existing.conclusion = textOf(args.conclusion, existing.conclusion)
    return existing
  }
  const row = {
    id: `sfc-${workspace.seq + 1}`,
    kind: requireText(args.kind, 'kind'),
    path,
    method,
    unauthCode: textOf(args.unauthCode, ''),
    size: textOf(args.size, ''),
    location: textOf(args.location, ''),
    conclusion: textOf(args.conclusion, ''),
  }
  workspace.seq += 1
  workspace.surfaces.push(row)
  return row
}

export function forkWorkspaceConfig(source, sessionId) {
  const next = emptyWorkspace(sessionId)
  if (!source || typeof source !== 'object') return next
  next.title = textOf(source.title, next.title)
  next.objective = textOf(source.objective, '')
  next.redlines = textOf(source.redlines, next.redlines)
  next.notes = textOf(source.notes, '')
  next.url = textOf(source.url, '')
  next.port = textOf(source.port, '')
  next.role = textOf(source.role, '主站')
  next.production = source.production === true
  next.ctfMode = source.ctfMode === true
  next.username = textOf(source.username, '')
  next.password = typeof source.password === 'string' ? source.password : ''
  next.headers = textOf(source.headers, '')
  next.cookies = textOf(source.cookies, '')
  next.useGoal = source.useGoal === true
  next.maxGoalRounds = normalizeGoalRounds(source.maxGoalRounds)
  next.targets = clone(Array.isArray(source.targets) ? source.targets : [])
  next.ideas = []
  next.campaign = emptyCampaign()
  next.campaign.goal = source.ctfMode === true
    ? `拿到 ${textOf(source.url, '本题')} 的 flag`
    : textOf(source.objective, textOf(source.title, ''))
  return next
}

export function seedCampaignProgress(workspace) {
  if (!workspace.campaign.goal) {
    workspace.campaign.goal = workspace.ctfMode
      ? `拿到 ${textOf(workspace.url, '本题')} 的 flag`
      : (textOf(workspace.objective, textOf(workspace.title, '')) || textOf(workspace.url, '授权审计'))
  }
  if (workspace.campaign.subgoals.length === 0) {
    for (const phase of PHASES) {
      if (phase.id === 'P0') continue
      workspace.seq += 1
      workspace.campaign.subgoals.push({
        id: `sg-${workspace.seq}`,
        title: numberedSubgoalTitle(phase.id, `${phase.name}：${phase.goal}`),
        code: phase.id,
        parentId: '',
        indent: 0,
        status: phase.id === workspace.phase ? 'active' : 'pending',
        detail: '',
        phase: phase.id,
      })
    }
  }
  relinkSubgoalTree(workspace)
  const active = workspace.campaign.subgoals.find((item) => item.phase === workspace.phase)
    || workspace.campaign.subgoals.find((item) => item.status === 'active')
  if (active) {
    active.status = 'active'
    workspace.campaign.current = active.title
  }
}

export function seedCampaignIdeas(workspace) {
  const host = textOf(workspace.url, workspace.targets[0] ? workspace.targets[0].url : '')
  if (host === '') return
  const ideas = workspace.ctfMode
    ? [
      { content: `抓 ${host} 首页头/标题/源码注释，识别题型与提示`, priority: 'high', phase: 'P1' },
      { content: `探测 /flag /robots.txt /www.zip /web.zip /.git/ 与常见备份包`, priority: 'high', phase: 'P1' },
      { content: `枚举登录、上传、文件包含、命令执行入口`, priority: 'high', phase: 'P2' },
      { content: `对可疑参数做 SQLi/SSTI/文件读/命令注入，目标是读到 flag`, priority: 'high', phase: 'P3' },
      { content: `拿到 flag 后立刻 add_finding 并三点闭合上报`, priority: 'high', phase: 'P6' },
    ]
    : [
      { content: `抓 ${host} 首页头/标题/Cookie，识别产品与版本`, priority: 'high', phase: 'P1' },
      { content: `探测 /robots.txt /favicon.ico /.git/ /.svn/ 与常见备份包`, priority: 'high', phase: 'P1' },
      { content: `枚举登录、管理后台、swagger、druid、actuator、upload`, priority: 'high', phase: 'P2' },
      { content: `未授权打一遍入口，记状态码/跳转/长度，找过滤器盲区`, priority: 'high', phase: 'P3' },
      { content: `对登录与检索参数做 SQLi/XSS 差分（短时延，不 dump）`, priority: 'medium', phase: 'P3' },
      { content: `发现疑点先 draft 登记，三点闭合后再 verified 上报`, priority: 'high', phase: 'P6' },
    ]
  applyHarvest(workspace, { idea_updates: [], ideas })
}

export function similarIdea(a, b) {
  const left = String(a || '').trim().toLowerCase()
  const right = String(b || '').trim().toLowerCase()
  if (left === '' || right === '') return false
  if (left === right) return true
  return left.includes(right) || right.includes(left)
}

export const MAX_OPEN_IDEAS = 12
export const MAX_TESTING_IDEAS = 1
export const MAX_HARVEST_NEW = 2

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 }

export function openIdeas(workspace) {
  return (workspace.ideas || []).filter((idea) => idea.status === 'pending' || idea.status === 'testing')
}

function rankOpen(workspace, a, b) {
  const phase = workspace.phase
  const testingA = a.status === 'testing' ? 0 : 1
  const testingB = b.status === 'testing' ? 0 : 1
  if (testingA !== testingB) return testingA - testingB
  const phaseA = a.phase === phase ? 0 : 1
  const phaseB = b.phase === phase ? 0 : 1
  if (phaseA !== phaseB) return phaseA - phaseB
  const priA = PRIORITY_RANK[a.priority] ?? 3
  const priB = PRIORITY_RANK[b.priority] ?? 3
  if (priA !== priB) return priA - priB
  return String(a.id).localeCompare(String(b.id))
}

export function pickNextIdea(workspace) {
  const open = openIdeas(workspace)
  if (open.length === 0) return null
  return open.slice().sort((a, b) => rankOpen(workspace, a, b))[0]
}

export function pruneOpenIdeas(workspace) {
  if (!workspace || !Array.isArray(workspace.ideas)) return
  const testing = workspace.ideas.filter((idea) => idea.status === 'testing')
  if (testing.length > MAX_TESTING_IDEAS) {
    const keep = testing.slice().sort((a, b) => rankOpen(workspace, a, b))[0]
    for (const idea of testing) {
      if (keep && idea.id === keep.id) continue
      idea.status = 'pending'
      if (idea.result === '本轮正在探测') idea.result = ''
    }
  }
  const open = openIdeas(workspace)
  if (open.length <= MAX_OPEN_IDEAS) return
  const ranked = open.slice().sort((a, b) => rankOpen(workspace, a, b))
  const keepIds = new Set(ranked.slice(0, MAX_OPEN_IDEAS).map((idea) => idea.id))
  for (const idea of open) {
    if (keepIds.has(idea.id)) continue
    idea.status = 'skipped'
    idea.result = idea.result || '队列过长，自动归档以免撑爆上下文'
  }
}

export function applyHarvest(workspace, harvest) {
  const updates = Array.isArray(harvest.idea_updates) ? harvest.idea_updates : Array.isArray(harvest.updates) ? harvest.updates : []
  const ideas = Array.isArray(harvest.ideas) ? harvest.ideas : []
  for (const update of updates) {
    if (!update || typeof update !== 'object') continue
    const idx = findIndexById(workspace.ideas, String(update.id || ''))
    if (idx < 0) continue
    const item = workspace.ideas[idx]
    if (item.status === 'skipped') continue
    if (update.status && IDEA_STATUSES.includes(update.status)) item.status = update.status
    if (typeof update.result === 'string') item.result = update.result.trim().slice(0, 160)
  }
  let added = 0
  for (const idea of ideas) {
    if (added >= MAX_HARVEST_NEW) break
    const content = textOf(idea && idea.content, '')
    if (content === '') continue
    if (workspace.ideas.some((existing) => similarIdea(existing.content, content))) continue
    workspace.seq += 1
    workspace.ideas.push({
      id: `idea-${workspace.seq}`,
      content: content.slice(0, 100),
      status: 'pending',
      result: '',
      priority: textOf(idea.priority, 'medium'),
      phase: textOf(idea.phase, workspace.phase),
      origin: 'harvest',
    })
    added += 1
  }
  pruneOpenIdeas(workspace)
}
