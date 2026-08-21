/** Turn harvest: keep the idea board alive without blocking the main agent. */

import { applyHarvest, similarIdea, upsertFingerprint, upsertSurface, seedCampaignIdeas, pickNextIdea, openIdeas, pruneOpenIdeas, MAX_OPEN_IDEAS } from './workspace.js'

const IDEA_PROMPT = [
  'You maintain an audit Ideas board for THIS session only. Ideas are testable hypotheses for THIS session\'s target, not observations, completed work, or another session\'s board.',
  'Good: "尝试对 /login 的 username 做 SQL 注入". Bad: "发现 8080 开放".',
  'Return ONLY JSON: {"ideas":[{"content":"...","priority":"high|medium|low","phase":"P0-P7"}],"idea_updates":[{"id":"...","status":"pending|testing|verified|failed|skipped","result":"..."}]}',
  'Respect skipped. Prefer updating existing ids over duplicating. Failed ideas must include why.',
  'At most 2 new ideas. content <= 100 chars. Chinese allowed.',
  'Prefer unknown-vulnerability hypotheses over generic scanning: name the violated assumption, concrete entry/parameter/state, paired control, observable oracle, and stop condition. Cover trust boundaries, state-machine abuse, parser differential, race/TOCTOU, hidden legacy paths, variant analysis, and safe primitive chains.',
  'Do not create an idea that merely says “继续扫描/测试逻辑漏洞”. Make it falsifiable and target-specific; one idea = one primary probe. Do not duplicate a tested hypothesis with different wording.',
  'Do not dump or repeat the whole board. Prefer updating the current testing id. Never mark more than one idea as testing.'
].join('\n')

export function eventsForTurn(session, turn) {
  const events = []
  const list = session && Array.isArray(session.events) ? session.events : []
  for (const event of list) {
    const data = event.data
    if (!data || data.turn !== turn) continue
    if (event.type === 'tool/call' || event.type === 'tool/result' || event.type === 'assistant/message' || event.type === 'user/message') {
      events.push(event)
    }
  }
  return events
}

function textFrom(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value.filter((b) => b && (b.type === 'text' || typeof b.text === 'string')).map((b) => b.text || '').join('\n')
  }
  if (typeof value === 'object' && typeof value.text === 'string') return value.text
  try { return JSON.stringify(value) } catch { return String(value) }
}

function parseArgs(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  const text = String(raw)
  try { return JSON.parse(text) } catch { return { _raw: text } }
}

export function summarizeTurn(events) {
  const tools = []
  const texts = []
  let usedWorkspace = false
  for (const event of events) {
    if (event.type === 'tool/call') {
      const name = event.data.name
      const raw = String(event.data.arguments || '').slice(0, 800)
      tools.push({ name, arguments: raw })
      if (name === 'audit_workspace') usedWorkspace = true
    } else if (event.type === 'tool/result') {
      const text = textFrom(event.data.message && event.data.message.content)
      tools.push({ name: 'result', text: String(text).slice(0, 1500) })
    } else if (event.type === 'assistant/message') {
      const content = event.data.message && event.data.message.content
      if (Array.isArray(content)) {
        texts.push(content.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n'))
      }
    }
  }
  return { tools, text: texts.join('\n').slice(0, 3500), usedWorkspace }
}

function ingestProbes(workspace, summary) {
  const blob = `${summary.text}\n${summary.tools.map((t) => `${t.name} ${t.arguments || ''} ${t.text || ''}`).join('\n')}`
  const server = blob.match(/server:\s*([^\r\n]+)/i)
  const powered = blob.match(/x-powered-by:\s*([^\r\n]+)/i)
  const title = blob.match(/<title[^>]*>([^<]{2,80})<\/title>/i)
  if (server || powered || title) {
    upsertFingerprint(workspace, {
      product: (title ? title[1].trim() : '') || (server ? server[1].trim() : '') || (powered ? powered[1].trim() : 'unknown'),
      version: '',
      evidence: [server && `Server: ${server[1].trim()}`, powered && `X-Powered-By: ${powered[1].trim()}`, title && `title: ${title[1].trim()}`].filter(Boolean).join(' · '),
    })
  }
  const urls = blob.match(/https?:\/\/[^\s"'<>]+/gi) || []
  const paths = blob.match(/(?:GET|POST|HEAD|PUT|DELETE)\s+(\/[^\s"'<>]*)/gi) || []
  const candidates = new Set()
  for (const raw of urls.slice(-20)) {
    try {
      const u = new URL(raw.replace(/[),.;]+$/, ''))
      if (u.pathname && u.pathname !== '/') candidates.add(u.pathname)
    } catch {}
  }
  for (const raw of paths) {
    const path = raw.replace(/^(GET|POST|HEAD|PUT|DELETE)\s+/i, '')
    if (path) candidates.add(path.split('?')[0])
  }
  for (const path of candidates) {
    if (path.length > 180) continue
    let codeHit = null
    try {
      codeHit = blob.match(new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\n]{0,80}\\b(20\\d|30\\d|401|403|404|405|500)\\b`))
    } catch {}
    upsertSurface(workspace, {
      kind: path.includes('.') ? 'file' : 'route',
      path,
      method: 'GET',
      unauthCode: codeHit ? codeHit[1] : '',
      conclusion: codeHit ? `自动测绘 ${codeHit[1]}` : '本轮探测到路径，待补状态码',
    })
  }
}

function heuristicHarvest(workspace, summary) {
  ingestProbes(workspace, summary)
  if (workspace.ideas.length === 0) seedCampaignIdeas(workspace)
  const harvest = { ideas: [], idea_updates: [] }
  const current = pickNextIdea(workspace)
  if (current && current.status === 'testing' && /error|failed|拒绝|拦截|waf|timeout/i.test(summary.text)) {
    harvest.idea_updates.push({ id: current.id, status: 'failed', result: '本轮出现失败/拦截信号，记录以免重复盲打' })
  }
  if (current && current.status === 'pending' && /curl|Invoke-WebRequest|wget|http\//i.test(summary.tools.map((t) => t.name + t.arguments).join(' '))) {
    harvest.idea_updates.push({ id: current.id, status: 'testing', result: '本轮正在探测' })
  }
  for (const surface of workspace.surfaces.slice(-2)) {
    const content = `对 ${surface.path} 做鉴权差分与参数注入（记状态码/长度）`
    if (!workspace.ideas.some((idea) => similarIdea(idea.content, content))) {
      harvest.ideas.push({ content, priority: surface.unauthCode === '200' || surface.unauthCode === '500' ? 'high' : 'medium', phase: 'P3' })
    }
  }
  for (const fingerprint of workspace.fingerprints.slice(-3)) {
    const content = `核验 ${fingerprint.product} 的已知 CVE/默认入口是否线上可达`
    if (!workspace.ideas.some((idea) => similarIdea(idea.content, content))) {
      harvest.ideas.push({ content, priority: 'high', phase: 'P1' })
    }
  }
  for (const finding of workspace.findings.filter((f) => f.verifyStatus !== 'verified').slice(-3)) {
    const content = `闭合「${finding.title}」三点：依据/可达/证据后再 verified`
    if (!workspace.ideas.some((idea) => similarIdea(idea.content, content))) {
      harvest.ideas.push({ content, priority: 'high', phase: 'P6' })
    }
  }
  return harvest
}

function parseJsonObject(text) {
  const trimmed = String(text || '').trim()
  if (trimmed === '') return null
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    try {
      return JSON.parse(trimmed.slice(start, end + 1))
    } catch {
      return null
    }
  }
}

async function llmHarvest(ctx, agent, workspace, summary, createUserMessage, BlockAssembler) {
  const llm = ctx.get('llm')
  const provider = agent && agent.options && agent.options.provider
  const model = agent && agent.options && agent.options.model
  if (!llm || !provider || !model || !createUserMessage || !BlockAssembler) return null
  const current = pickNextIdea(workspace)
  const queue = openIdeas(workspace).filter((idea) => !current || idea.id !== current.id).slice(0, 5)
  const board = [
    current ? `CURRENT ${current.id} [${current.status}/${current.priority}/${current.phase || '-'}] ${current.content}${current.result ? ` => ${current.result}` : ''}` : 'CURRENT (none)',
    ...queue.map((idea) => `${idea.id} [${idea.status}/${idea.priority}] ${idea.content}`),
    `open ${openIdeas(workspace).length}/${MAX_OPEN_IDEAS}, total ${workspace.ideas.length}`,
  ].join('\n')
  const user = [
    `Current phase: ${workspace.phase}`,
    `Objective: ${workspace.objective || workspace.title}`,
    `Targets: ${workspace.targets.map((t) => t.url).join(', ')}`,
    `Existing ideas:\n${board || '(none)'}`,
    `Last turn tools:\n${summary.tools.map((t) => t.name + ' ' + (t.arguments || t.text || '')).join('\n').slice(0, 1200)}`,
    `Last assistant text:\n${summary.text.slice(0, 800)}`,
  ].join('\n\n')
  const assembler = new BlockAssembler()
  const options = {
    provider,
    model,
    maxTokens: 400,
    sessionId: agent.session.id,
    system: IDEA_PROMPT,
    messages: [createUserMessage({
      content: [{ type: 'text', text: user }],
      source: { kind: 'plugin', plugin: 'lovelyaudit' },
    })],
  }
  for await (const chunk of llm.stream(options)) assembler.push(chunk)
  const blocks = assembler.blocks()
  const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n')
  return parseJsonObject(text)
}

export async function harvestAfterTurn(ctx, agent, session, workspace, turn, deps) {
  let events = eventsForTurn(session, turn)
  if (events.length === 0 && session && Array.isArray(session.events)) events = session.events.slice(-12)
  if (events.length === 0) {
    if (workspace.ideas.length === 0) seedCampaignIdeas(workspace)
    return
  }
  const summary = summarizeTurn(events)
  const harvest = heuristicHarvest(workspace, summary)
  if (turn % 2 === 0 && deps && deps.createUserMessage) {
    try {
      const llmResult = await llmHarvest(ctx, agent, workspace, summary, deps.createUserMessage, deps.BlockAssembler)
      if (llmResult && typeof llmResult === 'object') {
        harvest.ideas = [...harvest.ideas, ...(Array.isArray(llmResult.ideas) ? llmResult.ideas : [])]
        harvest.idea_updates = [...harvest.idea_updates, ...(Array.isArray(llmResult.idea_updates) ? llmResult.idea_updates : [])]
      }
    } catch (error) {
      ctx.logger && ctx.logger.warn && ctx.logger.warn(`audit-ideas harvest failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  applyHarvest(workspace, harvest)
  pruneOpenIdeas(workspace)
  workspace.updatedAt = Date.now()
}

function mark(idea) {
  return idea.status === 'verified' ? 'OK' : idea.status === 'failed' ? 'NO' : idea.status === 'testing' ? '..' : idea.status === 'skipped' ? 'XX' : '  '
}

export function ideaBoardText(workspace) {
  if (!workspace.ideas.length) return '点子板为空。先根据当前阶段写下 2–3 条可验证假设，不要一次铺一长串。'
  const current = pickNextIdea(workspace)
  const open = openIdeas(workspace)
  const queue = open.filter((idea) => !current || idea.id !== current.id).slice(0, 4)
  const done = workspace.ideas.filter((idea) => idea.status === 'verified' || idea.status === 'failed').slice(-2)
  const lines = []
  if (current) {
    lines.push(`本轮只打 1 条：`)
    lines.push(`[${mark(current)}] ${current.id} (${current.status}/${current.priority}/${current.phase || '-'}) ${current.content}${current.result ? ` — ${current.result}` : ''}`)
  }
  if (queue.length) {
    lines.push('候补（不要并行，做完本轮再换）：')
    for (const idea of queue) {
      lines.push(`[${mark(idea)}] ${idea.id} (${idea.status}/${idea.priority}/${idea.phase || '-'}) ${idea.content}`)
    }
  }
  if (done.length) {
    lines.push('最近结论：')
    for (const idea of done) {
      lines.push(`[${mark(idea)}] ${idea.id} ${idea.content}${idea.result ? ` — ${idea.result}` : ''}`)
    }
  }
  const extra = Math.max(0, open.length - 1 - queue.length)
  lines.push(`队列 ${open.length} 条待办 / 全板 ${workspace.ideas.length} 条${extra ? `，另有 ${extra} 条未注入以免撑爆上下文` : ''}。完整板在 audit_workspace get，不要把全板贴进回复。`)
  return lines.join('\n')
}

export function nextIdeaHint(workspace) {
  const pick = pickNextIdea(workspace)
  if (!pick) return '没有待验证点子。本轮最多 add_idea 2 条可验证假设，再去探测其中 1 条。'
  return `本轮全局指导：只执行点子 ${pick.id}（${pick.priority}/${pick.status}）: ${pick.content}。做完立刻 update_idea。禁止同时把多条标成 testing。`
}

export function remindIdeas(workspace) {
  return [
    '点子板只属于本会话。每轮只打 1 条：读下面的「本轮只打」，执行，然后 update_idea。不要并行扫完整板。',
    '状态 pending→testing→verified|failed|skipped。同时最多 1 条 testing。失败写下原因。完整板用 audit_workspace get，不要往聊天里倾倒。',
    ideaBoardText(workspace),
    nextIdeaHint(workspace),
    workspace.ctfMode
      ? 'CTF 纪律：最高目标是读到 flag。常见路径 /flag、备份包、源码注释、注入读文件。拿到 flag 立刻 add_finding 三点闭合，不必铺满覆盖矩阵。'
      : '测绘纪律：每次 HTTP 探测结束后立刻 record_surface。识别产品立刻 add_fingerprint。不要把结果只留在聊天里。',
    '漏洞纪律：先 add_finding 且 verifyStatus=draft。必须同时有 rationale、reachable、evidence 才能 verified。闭合时补 poc/exp，报告要能直接复现。',
  ].join('\n')
}
