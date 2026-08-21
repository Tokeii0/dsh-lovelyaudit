/**
 * Persistent Host half of the 黑盒/代审 workspace.
 * Ledger + audit_workspace tool + live idea harvest + auto-run kickoff.
 */

import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { emptyWorkspace, mutate, snapshot, textOf, PHASES, findingBecameReportable, canConfirmFinding, appendPhaseEvent, forkWorkspaceConfig, goalRoundsForApi } from './lib/workspace.js'
import { flushSaves, loadWorkspaceFile, scheduleSave, storeDir } from './lib/store.js'
import { harvestAfterTurn, remindIdeas } from './lib/ideas.js'
import { childAgentOptions, DEFAULT_MAX_SUBAGENTS, isSubagentToolName, loadSettingsFile, MAX_MAX_SUBAGENTS, MIN_MAX_SUBAGENTS, proxyEnv, proxyPromptText, saveSettingsFile, SETTINGS_NS } from './lib/settings.js'
import { extractReportFromEvent, extractReportFromParentRelay, extractReportFromSession, extractReportMarkdown, looksLikeFullReport, preferReportMarkdown, REPORT_OUTPUT_SCHEMA, reportWriterPrompt } from './lib/writer.js'
import { kitPromptText, listKit, pickNativeDirectory, runKitTool } from './lib/kit.js'
import { outputPromptText, writeFindingOutput } from './lib/output.js'
import { UNKNOWN_VULN_KICKOFF, UNKNOWN_VULN_SYSTEM } from './lib/unknown-vuln.js'
import { registerBundledSkills } from './lib/skills.js'

export const name = 'lovelyaudit'
export const inject = ['tools', 'systemPrompt']

const PROMPT_TEXT = [
  'This session has an Audit Workspace in the DSH sidebar labeled 黑盒/代审 (expandable footer panel).',
  'The human only fills P0: target URL, notes/cautions, optional account, optional headers/cookies, CTF mode, and whether to run as a long-lived /goal. Do not ask them to fill fingerprints, surfaces, findings, or coverage cells.',
  'You do P1–P7 automatically. Probe, fingerprint, map, audit, grade, prove, and fill the coverage matrix yourself. Write every material result into audit_workspace immediately.',
  'The Ideas board belongs only to THIS session. Never reuse, copy, or continue another session\'s ideas. Every turn execute exactly ONE idea (the injected「本轮只打」). Then update_idea. Do not mark multiple ideas testing. Full board lives in audit_workspace get — do not paste it into chat.',
  'Mapping is live: after every HTTP probe call record_surface (path, method, unauthCode, size, location, conclusion) and add_fingerprint when a product/version is known. Chat-only notes do not count as mapping.',
  'A suspected issue is a draft finding. You may report verifyStatus=verified only after closing three points (rationale, reachable, evidence). Discovery without verification stays draft.',
  'When reporting a vulnerability you MUST close three points before verifyStatus=verified: (1) rationale — why the defect is real, (2) reachable — is the entry live, (3) evidence — request/response, source snippet, or differential proof. Missing any one stays draft. Do not write 未授权可打 from white-box alone.',
  'Reporting a verified finding immediately spawns a writer subagent that produces a dedicated 源码安全审计报告 for THAT finding only (护理到家 SRC-nn style: title, CWE/OWASP, location, snippet, three-point rationale, impact, fix, and a copy-paste PoC/EXP). Do not wait until P7. Each vuln has its own report; never merge them. Writer subagents can report back to you.',
  'Follow the spiral: P0 rules → P1 fingerprint → P2 surface map → P3 black-box reachability → P4 code audit → P5 corroboration grading → P6 non-destructive proof → P7 coverage matrix.',
  'When auto-run or a goal is on, keep advancing the current phase until its goal is met, then set_phase to the next P-number. Spiral back if a new instance or boundary appears.',
  'Ideas are testable hypotheses for this session\'s target, not observations, and they are never shared across sessions. Failed ideas are valuable — record why. Respect skipped. Prefer high/low-cost pending ideas. Keep at most ~12 open ideas; add at most 2 per turn.',
  'Never claim unauthorized exploitability from white-box alone. Grade via P5: unauth / session / key / blocked / code.',
  UNKNOWN_VULN_SYSTEM,
  'Red lines are whatever the human wrote in P0. If they left redlines empty, do not invent a default read-only policy. Stay inside the authorized target and do not send secrets to third-party sites.',
  'Use provided credentials/headers only against the authorized target.',
  'Load skills audit-methodology, blackbox-testing, code-audit, vuln-coverage, unknown-vuln, audit-ideas, audit-commands when the matching stage starts.',
  'Throughout P1–P7 you MAY and SHOULD call subagent / subagent_fork for parallel probes, recon, and write-ups. Those children can talk back with report; read their reports and fold results into audit_workspace. Do not spawn more live children than the Settings cap.',
  'Subagent model, concurrency cap, the callable tools folder, and SOCKS5/HTTP proxy are set in Settings → 黑盒/代审. Prefer audit_kit to list/run scripts in that folder. If a proxy is configured, all probes must use it.',
].join('\n')

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => { chunks.push(chunk) })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (raw.trim() === '') {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(body)
}

function sessionKey(exec) {
  const id = exec?.agent?.session?.id
  if (typeof id !== 'string' || id === '') throw new Error('audit_workspace requires an owning agent session')
  return id
}

function resolveFromProfile(spec) {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  const require = createRequire(join(home, 'profiles', 'web', 'package.json'))
  return pathToFileURL(require.resolve(spec)).href
}

function kickoffPrompt(workspace, kitText = '', proxyText = '', outputText = '') {
  const targets = workspace.targets.map((t) => `- ${t.role} ${t.url}${t.production ? ' (生产)' : ''}`).join('\n')
  const phase = PHASES.find((p) => p.id === workspace.phase) || PHASES[0]
  const creds = []
  if (workspace.username) creds.push(`账号：${workspace.username}`)
  if (workspace.password) creds.push(`密码：${workspace.password}（只用于授权目标登录，禁止爆破、禁止外传、禁止写入聊天总结）`)
  if (workspace.headers) creds.push(`额外 Header：\n${workspace.headers}`)
  if (workspace.cookies) creds.push(`Cookie：\n${workspace.cookies}`)
  return [
    '用户已完成 P0 交战配置。从现在起由你自动做 P1–P7，不要再让用户填指纹/探针/缺陷/覆盖表。',
    `标题：${workspace.title}`,
    `审计目标：${workspace.objective || '（未写：根据 URL 自行补全并 setup）'}`,
    `目标 URL：${workspace.url || '（未写）'} ${workspace.port ? '端口 ' + workspace.port : ''} ${workspace.role || ''}`.trim(),
    workspace.production ? '该目标标记为生产。若用户另写了红线，以红线为准；未写红线则按用户授权范围探测，不要自行加只读禁令。' : '',
    workspace.ctfMode
      ? 'CTF 模式已开：最高目标是拿到 flag（flag{…} / ctfshow{…} 等）。漏洞只是路径，读到 flag 立刻 add_finding 三点闭合上报，然后可以 complete。不要按企业审计慢慢铺覆盖矩阵。'
      : '',
    workspace.notes ? `注意事项：${workspace.notes}` : '',
    workspace.redlines ? `用户指定红线：${workspace.redlines}` : '用户未填写红线：不要套默认只读禁令。授权范围内按任务需要探测与复现，PoC/EXP 写进报告。',
    targets ? `实例台账：\n${targets}` : '',
    creds.length ? creds.join('\n') : '未提供账号/Header：先做未授权面，发现登录口再记录，不要猜测口令。',
    workspace.useGoal
      ? (workspace.ctfMode
        ? `已勾选 Goal 长跑（${workspace.maxGoalRounds ? '最多 ' + workspace.maxGoalRounds + ' 轮' : '不限轮数'}）。CTF：拿到 flag 就可以 complete；没拿到就继续打，不要按企业审计铺覆盖矩阵。`
        : `已勾选 Goal 长跑（${workspace.maxGoalRounds ? '最多 ' + workspace.maxGoalRounds + ' 轮' : '不限轮数'}）。漏洞探索是长期过程：每轮结束不要宣告完工，除非 P7 覆盖矩阵已无空格。用 create_goal / get_goal 维持目标；阶段完成只 set_phase，不要 complete 整个审计。`)
      : '未勾选 Goal：本轮尽量把当前阶段做完并 set_phase；用户可随时再开。',
    `当前阶段：${phase.id} ${phase.name} — ${phase.goal}`,
    `技能：先 load_skill ${phase.skill} 与 audit-ideas。`,
    '工作方式：看系统提示里的「本轮只打」那 1 条 → 实际探测 → 立刻 record_surface / add_fingerprint → update_idea。不要并行打完整板。疑点先 draft，三点闭合后再 verified。',
    workspace.ctfMode
      ? 'P1：看题面/源码注释/备份包，判断 web/misc 题型。P2/P3：打入口拿 flag。P6：flag 原文作为 evidence 上报。不必走完企业 P7 矩阵。'
      : 'P1：识别产品/版本/组件，拉 CVE 候选，写入 add_fingerprint。\nP2/P3：自己扫路径与鉴权边界，record_surface，不要等用户填表。\nP4–P6：代审、互证定级、最小非破坏证明。\nP7：按入口×类型填覆盖矩阵。漏洞一旦三点闭合上报，系统会立刻派撰写子代理为该条产出独立 SRC 报告，不必等到收工、也不要把多条漏洞写进同一份报告。',
    '每轮用 set_campaign / add_subgoal / update_subgoal 更新「目标」页。子目标编号用 P2.1、P2.2.3 这种层级；做完就把 status=done 销号（界面会划掉）。可用 parentId 挂在上一条下面。',
    'P1–P7 全过程都可派 subagent / subagent_fork，子代理用 report 把结论回传给你，你再写入 audit_workspace。写报告同样走子代理，不要自己长篇粘贴。',
    UNKNOWN_VULN_KICKOFF,
    '上报漏洞纪律：verifyStatus=verified 必须同时有 rationale、reachable、evidence。缺一不可。禁止把白盒猜测写成未授权可打。update_finding 时把可复制的 poc（HTTP/curl）和 exp（或写清 PoC 已足够）写进台账，专项报告必须能按报告复现。',
    kitText,
    proxyText,
    outputText,
    remindIdeas(workspace),
    '现在开始当前阶段。阶段目标达成后 set_phase 到下一阶段。',
  ].filter(Boolean).join('\n')
}

export function apply(ctx) {
  registerBundledSkills(ctx)
  const workspaces = new Map()
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  const ledgersDir = storeDir(home)
  const persist = (workspace) => {
    if (workspace) scheduleSave(ledgersDir, workspace)
    return workspace
  }
  const getWorkspace = (key) => {
    if (typeof key !== 'string' || key === '') throw new Error('audit workspace requires a session id')
    let workspace = workspaces.get(key)
    if (!workspace) {
      workspace = loadWorkspaceFile(ledgersDir, key) || emptyWorkspace(key)
      workspace.sessionId = key
      workspaces.set(key, workspace)
    } else if (workspace.sessionId !== key) {
      workspace.sessionId = key
    }
    return workspace
  }
  const commit = (workspace, args) => {
    const view = mutate(workspace, args)
    persist(workspace)
    return view
  }
  const sessionCwd = (sessionId) => {
    const agents = ctx.get('agents')
    const agent = agents && sessionId && agents.get(sessionId)
    const cwd = agent && agent.session && agent.session.header && agent.session.header.cwd
    return typeof cwd === 'string' ? cwd : ''
  }

  const finishReport = (workspace, finding, markdown, extra = {}) => {
    const next = preferReportMarkdown(finding && finding.reportMarkdown, markdown)
    if (!next) return snapshot(workspace)
    const already = finding && looksLikeFullReport(finding.reportMarkdown) && next === finding.reportMarkdown
    const needWrite = !already || !(finding && finding.reportPath)
    const written = finding && needWrite
      ? writeFindingOutput(settings.outputDir, workspace, finding, next, sessionCwd(workspace.sessionId))
      : { ok: Boolean(finding && finding.reportPath), skipped: !needWrite, error: '', path: finding && finding.reportPath || '' }
    if (already && written.path === (finding && finding.reportPath)) return snapshot(workspace)
    return commit(workspace, {
      action: 'report_ready',
      ...extra,
      content: next,
      findingId: finding ? finding.id : extra.findingId,
      path: written.path,
      writeError: written.ok || written.skipped ? '' : written.error,
    })
  }

  const findingByWriterChild = (childId) => {
    if (!childId) return null
    for (const workspace of workspaces.values()) {
      const finding = (workspace.findings || []).find((item) => item.reportJob && item.reportJob.childId === childId)
      if (finding) return { workspace, finding }
    }
    return null
  }

  const ingestWriterMarkdown = (childId, markdown) => {
    if (!markdown) return
    const hit = findingByWriterChild(childId)
    if (!hit) return
    finishReport(hit.workspace, hit.finding, markdown, { childId, reason: hit.finding.reportJob.reason, findingId: hit.finding.id })
  }
  ctx.effect(() => () => { flushSaves(ledgersDir) })
  const settingsPath = join(home, 'local-audit-workspace.json')
  let settings = loadSettingsFile(settingsPath)
  const liveChildren = new Set()
  const reportJobs = new Map()

  const persistSettings = (next) => {
    settings = saveSettingsFile(settingsPath, next)
    return settings
  }

  const liveChildCount = () => {
    const agents = ctx.get('agents')
    if (!agents || typeof agents.list !== 'function') return liveChildren.size
    let count = 0
    for (const agent of agents.list()) {
      const header = agent && agent.session && agent.session.header
      if (header && header.parentSession) count += 1
    }
    return Math.max(count, liveChildren.size)
  }

  const rememberChild = (id) => {
    if (typeof id === 'string' && id !== '') liveChildren.add(id)
  }
  const forgetChild = (id) => {
    if (typeof id === 'string' && id !== '') liveChildren.delete(id)
  }

  const listModelChoices = async () => {
    const llm = ctx.get('llm')
    const providers = llm && typeof llm.listProviders === 'function' ? llm.listProviders() : []
    const rows = []
    for (const provider of providers) {
      let models = []
      try {
        models = llm && typeof llm.listModels === 'function' ? await llm.listModels(provider.id) : []
      } catch {
        models = []
      }
      if (!models || models.length === 0) {
        rows.push({
          id: `${provider.id}::`,
          provider: provider.id,
          providerName: provider.name || provider.id,
          model: '',
          label: `${provider.name || provider.id}（沿用当前模型）`,
        })
        continue
      }
      for (const model of models) {
        rows.push({
          id: `${provider.id}::${model.id}`,
          provider: provider.id,
          providerName: provider.name || provider.id,
          model: model.id,
          label: `${provider.name || provider.id} / ${model.name || model.id}`,
        })
      }
    }
    return rows
  }

  const pickWriterProvider = (subagents) => {
    if (!subagents) return ''
    const names = typeof subagents.list === 'function'
      ? subagents.list()
      : typeof subagents.listProviders === 'function'
        ? subagents.listProviders()
        : []
    const list = Array.isArray(names) ? names : []
    if (list.includes('spawn')) return 'spawn'
    if (list.includes('fork')) return 'fork'
    if (list[0]) return list[0]
    if (typeof subagents.getProvider === 'function') {
      if (subagents.getProvider('spawn')) return 'spawn'
      if (subagents.getProvider('fork')) return 'fork'
    }
    if (typeof subagents.start === 'function' || typeof subagents.startContinuable === 'function') return 'spawn'
    return ''
  }

  const startWriterChild = async (subagents, provider, parent, finding, workspace, reason) => {
    const options = childAgentOptions(settings, parent)
    const prompt = [{ type: 'text', text: reportWriterPrompt(workspace, finding, reason) }]
    const persona = '你只撰写这一条漏洞的审计报告 Markdown。写完后必须用 report 工具把完整 Markdown 正文放进 output（从一级标题到结论），禁止只回传「已全文回传」这类摘要。可以读台账，不要探测、不要改代码、不要把其它漏洞写进来。'
    if (typeof subagents.startContinuable === 'function') {
      const started = await subagents.startContinuable({
        provider,
        label: `${finding.code || 'SRC'} 漏洞报告`,
        request: {
          parent,
          prompt,
          ...options ? { agentOptions: options } : {},
          persona,
        },
        signal: new AbortController().signal,
      })
      return { id: started.childId, continuable: true, result: Promise.resolve({ stopReason: 'completed', output: [], structured: null }) }
    }
    const run = await subagents.start(provider, {
      label: `${finding.code || 'SRC'} 漏洞报告`,
      parent,
      prompt,
      signal: new AbortController().signal,
      ...options ? { agentOptions: options } : {},
      outputSchema: REPORT_OUTPUT_SCHEMA,
      persona,
    })
    return run
  }

  const markFindingJob = (workspace, finding, patch) => {
    if (!finding) return
    finding.reportJob = { ...(finding.reportJob || {}), ...patch, findingId: finding.id }
    workspace.reportJob = finding.reportJob
    workspace.updatedAt = Date.now()
    persist(workspace)
  }

  const queueReportWrite = (sessionId, reason, findingId) => {
    const workspace = getWorkspace(sessionId)
    const targets = findingId
      ? workspace.findings.filter((item) => item.id === findingId || item.code === findingId)
      : workspace.findings.filter((item) => canConfirmFinding(item))
    const unique = []
    const seen = new Set()
    for (const item of targets) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      unique.push(item)
    }
    if (unique.length === 0) {
      commit(workspace, { action: 'report_failed', result: '没有可撰写的漏洞（需三点闭合）', reason, findingId: findingId || '' })
      return Promise.resolve(snapshot(workspace))
    }
    let chain = Promise.resolve()
    for (const finding of unique) {
      markFindingJob(workspace, finding, { status: 'queued', error: '', reason, childId: '', startedAt: Date.now(), finishedAt: 0 })
      const key = `${sessionId}:${finding.id}`
      const previous = reportJobs.get(key)
      const job = (previous || chain).catch(() => {}).then(() => writeFindingReport(sessionId, finding.id, reason))
      reportJobs.set(key, job)
      chain = job
    }
    return chain
  }

  const writeFindingReport = async (sessionId, findingId, reason) => {
    const workspace = getWorkspace(sessionId)
    const finding = workspace.findings.find((item) => item.id === findingId)
    if (!finding) {
      commit(workspace, { action: 'report_failed', result: '漏洞不存在', reason, findingId })
      return snapshot(workspace)
    }
    const agents = ctx.get('agents')
    const parent = agents && agents.get(sessionId)
    const subagents = ctx.get('subagents')
    if (!parent || !subagents) {
      commit(workspace, { action: 'report_failed', result: '当前会话没有可驱动的 Agent 或子代理服务', reason, findingId })
      return snapshot(workspace)
    }
    if (liveChildCount() >= settings.maxSubagents) {
      commit(workspace, {
        action: 'report_failed',
        result: `子代理已达上限 ${settings.maxSubagents}，请在设置中提高上限或等现有子代理结束后再上报`,
        reason,
        findingId,
      })
      return snapshot(workspace)
    }
    const provider = pickWriterProvider(subagents)
    if (!provider) {
      commit(workspace, { action: 'report_failed', result: '没有可用的子代理 provider（host 未挂 spawn/fork）。请确认 web profile 已加载 subagent 后端后重启 DSH。', reason, findingId })
      return snapshot(workspace)
    }
    markFindingJob(workspace, finding, { status: 'writing', reason, childId: '', error: '' })
    appendPhaseEvent(workspace, workspace.phase, `派撰写子代理产出 ${finding.code || finding.id} 专项报告（${reason}）`)
    let run
    try {
      run = await startWriterChild(subagents, provider, parent, finding, workspace, reason)
    } catch (error) {
      commit(workspace, { action: 'report_failed', result: error instanceof Error ? error.message : String(error), reason, findingId })
      return snapshot(workspace)
    }
    rememberChild(run.id)
    markFindingJob(workspace, finding, { childId: run.id })
    if (run.continuable) {
      appendPhaseEvent(workspace, workspace.phase, `${finding.code || finding.id} 撰写子代理已启动，可通过 report 回传主代理`)
      persist(workspace)
      return snapshot(workspace)
    }
    try {
      const result = await run.result
      const markdown = extractReportMarkdown(result)
      if (result.stopReason !== 'completed' || markdown === '') {
        commit(workspace, {
          action: 'report_failed',
          result: result.diagnostic || `撰写子代理结束：${result.stopReason || 'unknown'}`,
          reason,
          childId: run.id,
          findingId,
        })
        return snapshot(workspace)
      }
      finishReport(workspace, finding, markdown, { reason, childId: run.id, findingId })
      return snapshot(workspace)
    } catch (error) {
      commit(workspace, {
        action: 'report_failed',
        result: error instanceof Error ? error.message : String(error),
        reason,
        childId: run.id,
        findingId,
      })
      return snapshot(workspace)
    } finally {
      forgetChild(run.id)
      try { if (typeof run.dispose === 'function') await run.dispose() } catch {}
    }
  }

  const maybeQueueReport = (sessionId, before, after, reason) => {
    const findings = after && Array.isArray(after.findings) ? after.findings : []
    const prev = before && Array.isArray(before.findings) ? before.findings : []
    const prevById = new Map(prev.map((item) => [item.id, item]))
    for (const item of findings) {
      if (findingBecameReportable(prevById.get(item.id), item)) void queueReportWrite(sessionId, reason, item.id)
    }
  }

  ctx.systemPrompt.section({
    name: 'audit:workspace',
    order: 118,
    text: PROMPT_TEXT,
  })

  ctx.systemPrompt.context({
    name: 'audit:brief',
    order: 39,
    text: (assemble) => {
      const agent = assemble && assemble.agent
      const id = agent && agent.session && agent.session.id
      if (!id) return ''
      const workspace = getWorkspace(id)
      const lines = [
        `P0 交战：${workspace.title}`,
        workspace.url ? `目标 ${workspace.url}` : '',
        workspace.objective ? `目标说明 ${workspace.objective}` : '',
        workspace.notes ? `注意 ${workspace.notes}` : '',
        workspace.username ? `账号 ${workspace.username}` : '',
        workspace.headers ? `Header ${workspace.headers}` : '',
        workspace.cookies ? `Cookie ${workspace.cookies}` : '',
        workspace.ctfMode ? 'CTF 模式：以拿到 flag 为完成条件' : '',
        workspace.useGoal ? `Goal 长跑开（${workspace.maxGoalRounds ? workspace.maxGoalRounds + ' 轮' : '不限轮数'}）当前 ${workspace.phase}` : `当前阶段 ${workspace.phase}`,
        workspace.campaign && workspace.campaign.goal ? `总目标 ${workspace.campaign.goal}` : '',
        workspace.campaign && workspace.campaign.current ? `当前子目标 ${workspace.campaign.current}` : '',
        kitPromptText(listKit(settings.toolsDir)),
        proxyPromptText(settings),
        outputPromptText(settings),
        `测绘 ${workspace.fingerprints.length} 指纹 / ${workspace.surfaces.length} 可达面；缺陷 ${workspace.findings.length}（已验证 ${workspace.findings.filter((f) => f.verifyStatus === 'verified').length}）`,
        'P1–P7 由你自动完成并写入 audit_workspace。每轮只打系统提示里的那 1 条点子，探测后立刻 record_surface。发现漏洞先 draft，三点闭合后再 verified。',
      ]
      return lines.filter(Boolean).join('\n')
    },
  })

  ctx.systemPrompt.context({
    name: 'audit:ideas',
    order: 40,
    text: (assemble) => {
      const agent = assemble && assemble.agent
      const id = agent && agent.session && agent.session.id
      if (!id) return ''
      return remindIdeas(getWorkspace(id))
    },
  })

  ctx.tools.register({
    name: 'audit_workspace',
    description:
      'Read or update the session Audit Workspace shown on the 黑盒/代审 sidebar panel. '
      + 'Use action=get at the start of a stage and after each material discovery. '
      + 'The human fills P0 only (url/notes/username/password/headers/cookies/ctfMode/useGoal). '
      + 'You must auto-write P1–P7: add_fingerprint, record_surface, add_finding, set_coverage, add_idea. '
      + 'Ideas belong only to the current session and are never shared. add_idea at start of a stage and update_idea after each probe. '
      + 'record_surface after every HTTP probe. add_finding starts as draft; verified requires rationale+reachable+evidence. Put copy-paste poc/exp on the finding so the SRC report can reproduce. '
      + 'setup stores P0 config; add_target records extra instances; '
      + 'set_phase advances the live spiral (optional notes=phase summary); view_phase only changes which tab the UI inspects. '
      + 'start_run / stop_run control auto-agent from the panel. '
      + 'A verified finding immediately queues a writer subagent for THAT finding only; write_report re-runs one (pass id) or all verified. '
      + 'set_campaign / add_subgoal / update_subgoal keep the 目标 tab (P2.1 / P2.2.3 numbered subgoals; done items are struck through). '
      + 'Subagent model and max live children are configured in Settings → 黑盒/代审.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: {
          type: 'string',
          enum: [
            'get', 'setup', 'set_phase', 'view_phase', 'view_board', 'start_run', 'stop_run',
            'add_target', 'remove_target', 'add_fingerprint', 'record_surface',
            'add_finding', 'update_finding', 'set_coverage', 'add_idea', 'update_idea',
            'set_campaign', 'add_subgoal', 'update_subgoal', 'export_report', 'write_report',
          ],
        },
        title: { type: 'string' },
        objective: { type: 'string' },
        notes: { type: 'string' },
        redlines: { type: 'string' },
        phase: { type: 'string' },
        url: { type: 'string' },
        port: { type: 'string' },
        role: { type: 'string' },
        production: { type: 'boolean' },
        ctfMode: { type: 'boolean' },
        product: { type: 'string' },
        version: { type: 'string' },
        evidence: { type: 'string' },
        cves: { type: 'string' },
        kind: { type: 'string' },
        path: { type: 'string' },
        method: { type: 'string' },
        unauthCode: { type: 'string' },
        size: { type: 'string' },
        location: { type: 'string' },
        conclusion: { type: 'string' },
        id: { type: 'string' },
        type: { type: 'string' },
        grade: { type: 'string' },
        source: { type: 'string' },
        sink: { type: 'string' },
        reachable: { type: 'string' },
        prerequisite: { type: 'string' },
        entry: { type: 'string' },
        status: { type: 'string' },
        content: { type: 'string' },
        result: { type: 'string' },
        priority: { type: 'string' },
        origin: { type: 'string' },
        board: { type: 'string' },
        username: { type: 'string' },
        password: { type: 'string' },
        headers: { type: 'string' },
        cookies: { type: 'string' },
        useGoal: { type: 'boolean' },
        maxGoalRounds: { type: 'number' },
        code: { type: 'string' },
        severity: { type: 'string' },
        verifyStatus: { type: 'string' },
        cwe: { type: 'string' },
        owasp: { type: 'string' },
        location: { type: 'string' },
        snippet: { type: 'string' },
        rationale: { type: 'string' },
        impact: { type: 'string' },
        fix: { type: 'string' },
        verifyMethod: { type: 'string' },
        verifyResult: { type: 'string' },
        poc: { type: 'string' },
        exp: { type: 'string' },
        findingId: { type: 'string' },
        goal: { type: 'string' },
        current: { type: 'string' },
        detail: { type: 'string' },
        parentId: { type: 'string' },
      },
      required: ['action'],
    },
    output: {
      schema: { type: 'object' },
      render(_args, value) {
        return [{ type: 'text', text: String(value && value.title ? value.title : 'workspace') }]
      },
    },
    execute(args, exec) {
      const sessionId = sessionKey(exec)
      const workspace = getWorkspace(sessionId)
      const action = args && typeof args.action === 'string' ? args.action : 'get'
      if (action === 'write_report') {
        void queueReportWrite(sessionId, 'manual', args && (args.findingId || args.id))
        return Promise.resolve(snapshot(workspace))
      }
      const before = (action === 'add_finding' || action === 'update_finding') ? structuredClone(workspace.findings) : null
      const view = commit(workspace, args ?? { action: 'get' })
      if (before) maybeQueueReport(sessionId, { findings: before }, view, action)
      return Promise.resolve(view)
    },
    presentCall(args) {
      return { card: 'generic', title: '审计工作区', kind: 'other', rawInput: args }
    },
  })

  ctx.tools.register({
    name: 'audit_kit',
    description:
      'List or run scripts in the 黑盒/代审 tools folder configured in Settings. '
      + 'action=list returns the folder and runnable files. action=run executes one file by relative name (optional args). '
      + 'Stay inside that folder. Prefer this over guessing script paths.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: { type: 'string', enum: ['list', 'run'] },
        name: { type: 'string' },
        args: { type: 'string' },
      },
      required: ['action'],
    },
    output: {
      schema: { type: 'object' },
      render(_args, value) {
        if (value && value.stdout) return [{ type: 'text', text: String(value.stdout).slice(0, 2000) }]
        if (value && Array.isArray(value.tools)) return [{ type: 'text', text: `${value.tools.length} tools in ${value.dir || ''}` }]
        return [{ type: 'text', text: 'audit kit' }]
      },
    },
    execute(args) {
      const action = args && args.action === 'run' ? 'run' : 'list'
      if (action === 'list') return Promise.resolve(listKit(settings.toolsDir))
      return runKitTool(settings.toolsDir, args && args.name, args && args.args, proxyEnv(settings))
    },
    presentCall(args) {
      return { card: 'generic', title: '审计工具夹', kind: 'other', rawInput: args }
    },
  })

  const stopAgentRun = (sessionId) => {
    const workspace = getWorkspace(sessionId)
    commit(workspace, { action: 'stop_run' })
    const agents = ctx.get('agents')
    const agent = agents && agents.get(sessionId)
    const goals = ctx.get('goals')
    try {
      if (agent && goals) {
        const current = goals.get(agent)
        if (current && current.phase === 'active') goals.pause(agent, { id: current.id, revision: current.revision })
      }
    } catch {}
    try { if (agent) agent.cancel({ kind: 'user' }) } catch {}
    return snapshot(workspace)
  }

  const kickoffAgent = async (agent, workspace) => {
    if (workspace.useGoal) {
      const goals = ctx.get('goals')
      if (!goals) throw new Error('Goal 服务不可用，无法开启长跑')
      const objective = workspace.ctfMode
        ? [
          `CTF 模式：拿到 ${workspace.url || workspace.title} 的 flag`,
          workspace.objective || '',
          '读到 flag{…} / ctfshow{…} 等立刻上报并可以收工。漏洞是路径不是终点。',
        ].filter(Boolean).join('。')
        : [
          `按 P0–P7 完成授权范围内的黑盒/代审：${workspace.title}`,
          workspace.url ? `目标 ${workspace.url}` : '',
          workspace.objective || '',
        ].filter(Boolean).join('。')
      const current = goals.get(agent)
      if (current && current.phase !== 'complete') {
        try { goals.clear(agent, { id: current.id, revision: current.revision }) } catch {}
      }
      goals.create(agent, { objective, maxGoalRounds: goalRoundsForApi(workspace.maxGoalRounds) })
    }
    const mod = await import(resolveFromProfile('@deepseek-ai/dsh-llm'))
    agent.followup(mod.createUserMessage({
      content: [{ type: 'text', text: kickoffPrompt(workspace, kitPromptText(listKit(settings.toolsDir)), proxyPromptText(settings), outputPromptText(settings)) }],
      source: { kind: 'plugin', plugin: name },
    }))
  }

  const startAgentRun = async (sessionId, extra = {}) => {
    const agents = ctx.get('agents')
    const agent = agents && agents.get(sessionId)
    if (!agent) throw new Error('当前会话没有可驱动的 Agent')
    const workspace = getWorkspace(sessionId)
    commit(workspace, { action: 'start_run', ...extra })
    try {
      await kickoffAgent(agent, workspace)
      persist(workspace)
      return { ...snapshot(workspace), sessionId }
    } catch (error) {
      workspace.run.status = 'idle'
      workspace.run.error = error instanceof Error ? error.message : String(error)
      persist(workspace)
      throw error
    }
  }

  const spawnAuditSession = async (sourceId, extra = {}) => {
    const agents = ctx.get('agents')
    const source = agents && agents.get(sourceId)
    if (!source) throw new Error('当前会话没有可驱动的 Agent')
    commit(getWorkspace(sourceId), { action: 'setup', ...extra })
    const sourceWs = getWorkspace(sourceId)
    if (!sourceWs.url && !sourceWs.objective && sourceWs.targets.length === 0) {
      throw new Error('先填写目标 URL，或写清审计目标')
    }
    const presets = ctx.get('agentPresets')
    let presetId = 'audit'
    if (presets) {
      try {
        presetId = (await presets.resolve('audit')).id
      } catch {
        presetId = source.session.header.agentPreset || (await presets.resolve()).id
      }
    }
    const newId = `session-${randomUUID()}`
    const cwd = source.session.header.cwd
    const createOpts = {
      sessionId: newId,
      agentOptions: {
        ...source.options && source.options.provider ? { provider: source.options.provider } : {},
        ...source.options && source.options.model ? { model: source.options.model } : {},
      },
      meta: {
        ...cwd ? { cwd } : {},
        ...presetId ? { agentPreset: presetId } : {},
      },
      setup: async (agentCtx) => {
        if (presets && presetId) await presets.mount(agentCtx, presetId)
      },
    }
    const create = () => agents.create(createOpts)
    const handle = agents.withoutInitiator ? await agents.withoutInitiator(create) : await create()
    const child = handle.agent
    workspaces.set(newId, forkWorkspaceConfig(sourceWs, newId))
    persist(workspaces.get(newId))
    const childWs = getWorkspace(newId)
    commit(childWs, { action: 'start_run' })
    try {
      const registry = ctx.get('workspaceRegistry')
      if (registry && cwd) {
        const workspace = await registry.resolveByPath(cwd)
        if (workspace) await workspace.attachSession(newId)
      }
    } catch {}
    try {
      await kickoffAgent(child, childWs)
      persist(childWs)
      return { ...snapshot(childWs), sessionId: newId }
    } catch (error) {
      childWs.run.status = 'idle'
      childWs.run.error = error instanceof Error ? error.message : String(error)
      persist(childWs)
      throw error
    }
  }

  ctx.inject(['agents'], (scope) => {
    const harvest = (session, event) => {
      if (!session || !event) return
      if (event.type === 'tool/call' || event.type === 'assistant/message') {
        ingestWriterMarkdown(session.id, extractReportFromEvent(event))
        return
      }
      if (event.type === 'user/message') {
        const relay = extractReportFromParentRelay(event)
        if (relay.childId) ingestWriterMarkdown(relay.childId, relay.markdown)
        return
      }
      if (event.type !== 'turn/end' && event.type !== 'tool/result') return
      const workspace = getWorkspace(session.id)
      if (event.type === 'tool/result') {
        const turn = event.data && event.data.turn ? event.data.turn : workspace.run.lastTurn
        void harvestAfterTurn(ctx, scope.agents.get(session.id), session, workspace, turn, {}).then(() => persist(workspace)).catch((error) => {
          ctx.logger && ctx.logger.warn && ctx.logger.warn(`audit harvest: ${error instanceof Error ? error.message : String(error)}`)
        })
        return
      }
      const turn = event.data && event.data.turn ? event.data.turn : 0
      workspace.run.lastTurn = turn
      persist(workspace)
      const agent = scope.agents.get(session.id)
      void import(resolveFromProfile('@deepseek-ai/dsh-llm')).then((mod) => harvestAfterTurn(ctx, agent, session, workspace, turn, {
        createUserMessage: mod.createUserMessage,
        BlockAssembler: mod.BlockAssembler,
      }).then(() => persist(workspace))).catch((error) => {
        ctx.logger && ctx.logger.warn && ctx.logger.warn(`audit harvest: ${error instanceof Error ? error.message : String(error)}`)
      })
    }
    scope.on('session/event', harvest)
  })

  ctx.inject(['subagents'], (scope) => {
    scope.on('subagent/start', (info) => { rememberChild(info && (info.id || info.childId)) })
    scope.on('subagent/end', (info) => {
      const childId = info && (info.id || info.childId)
      forgetChild(childId)
      if (!childId) return
      const hit = findingByWriterChild(childId)
      if (!hit) return
      const { workspace, finding } = hit
      const agents = ctx.get('agents')
      const child = agents && agents.get(childId)
      const markdown = extractReportMarkdown({
        output: info.lastAssistantMessage,
        stopReason: info.stopReason,
        structured: info.structured,
        session: child && child.session,
      }) || extractReportFromSession(child && child.session)
      if (looksLikeFullReport(markdown) || (markdown && !finding.reportMarkdown)) {
        finishReport(workspace, finding, markdown, { childId, reason: finding.reportJob.reason, findingId: finding.id })
        return
      }
      if (looksLikeFullReport(finding.reportMarkdown)) return
      if (finding.reportJob.status === 'writing' || finding.reportJob.status === 'queued') {
        commit(workspace, {
          action: 'report_failed',
          result: info.diagnostic || `撰写子代理结束：${info.stopReason || 'unknown'}（未拿到完整 Markdown）`,
          findingId: finding.id,
          childId,
          reason: finding.reportJob.reason,
        })
      }
    })
  })

  ctx.tools.guard((exec) => {
    if (!isSubagentToolName(exec && exec.name)) return undefined
    const cap = settings.maxSubagents
    if (liveChildCount() >= cap) {
      return `子代理数量已达上限 ${cap}。可在设置 → 黑盒/代审 中提高上限，或等待现有子代理结束后再派。`
    }
    return undefined
  })

  ctx.on('agent/request', async (payload, next) => {
    const config = await next()
    const header = payload && payload.agent && payload.agent.session && payload.agent.session.header
    if (!header || !header.parentSession) return config
    if (!settings.subagentModel) return config
    const nextConfig = { ...config, model: settings.subagentModel }
    if (settings.subagentProvider) nextConfig.provider = settings.subagentProvider
    return nextConfig
  })

  ctx.inject(['commands'], (scope) => {
    scope.commands.register({
      name: 'audit',
      description: 'Start or stop the 黑盒/代审 auto-agent from the current session.',
      handler: (invocation) => {
        const raw = String(invocation.rawInput || '').trim()
        const sessionId = invocation.agent.session.id
        const workspace = getWorkspace(sessionId)
        if (raw === 'stop') {
          stopAgentRun(sessionId)
          return { kind: 'success', text: '已停止自动审计。' }
        }
        return spawnAuditSession(sessionId).then((view) => ({
          kind: 'success',
          text: `已新开会话 ${view.sessionId} 启动自动审计。请打开该会话左侧边栏的「黑盒/代审」。`,
        })).catch((error) => ({ kind: 'error', text: error instanceof Error ? error.message : String(error) }))
      },
    })
  })

  ctx.inject(['webServer'], (scope) => {
    scope.effect(() => scope.webServer.register({
      kind: 'exact',
      path: '/local-audit-workspace',
      handler: async (req, res) => {
        try {
          const url = new URL(req.url || '/', 'http://dsh.local')
          if (req.method === 'GET') {
            const kind = url.searchParams.get('kind') || ''
            if (kind === 'settings') {
              sendJson(res, 200, {
                settings,
                models: await listModelChoices(),
                liveChildren: liveChildCount(),
                limits: { min: MIN_MAX_SUBAGENTS, max: MAX_MAX_SUBAGENTS, fallback: DEFAULT_MAX_SUBAGENTS },
                kit: listKit(settings.toolsDir),
                ns: SETTINGS_NS,
              })
              return
            }
            const session = url.searchParams.get('session') || ''
            if (session === '') {
              sendJson(res, 400, { error: 'session is required' })
              return
            }
            sendJson(res, 200, snapshot(getWorkspace(session)))
            return
          }
          if (req.method === 'POST') {
            const body = await readBody(req)
            if (body.action === 'save_settings') {
              const next = persistSettings(body.settings || body)
              sendJson(res, 200, {
                settings: next,
                models: await listModelChoices(),
                liveChildren: liveChildCount(),
                limits: { min: MIN_MAX_SUBAGENTS, max: MAX_MAX_SUBAGENTS, fallback: DEFAULT_MAX_SUBAGENTS },
                kit: listKit(next.toolsDir),
              })
              return
            }
            if (body.action === 'pick_directory') {
              sendJson(res, 200, await pickNativeDirectory(ctx))
              return
            }
            const session = textOf(body.session, url.searchParams.get('session') || '')
            if (session === '') {
              sendJson(res, 400, { error: 'session is required' })
              return
            }
            if (body.action === 'start_run') {
              sendJson(res, 200, await spawnAuditSession(session, body))
              return
            }
            if (body.action === 'export_report') {
              sendJson(res, 200, snapshot(getWorkspace(session)))
              return
            }
            if (body.action === 'stop_run') {
              sendJson(res, 200, stopAgentRun(session))
              return
            }
            if (body.action === 'write_report') {
              void queueReportWrite(session, 'manual', body.findingId || body.id)
              sendJson(res, 200, snapshot(getWorkspace(session)))
              return
            }
            const workspace = getWorkspace(session)
            const action = typeof body.action === 'string' ? body.action : 'get'
            const before = (action === 'add_finding' || action === 'update_finding')
              ? structuredClone(workspace.findings)
              : null
            const view = commit(workspace, body)
            if (before) maybeQueueReport(session, { findings: before }, view, action)
            sendJson(res, 200, view)
            return
          }
          res.writeHead(405)
          res.end()
        } catch (error) {
          sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    }), 'lovelyaudit: http')
  })
}
