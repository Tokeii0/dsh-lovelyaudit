/** Prompt + extraction for the per-finding report writer subagent. */

import { findingSrcId, renderFindingReport } from './report.js'

function findingBrief(finding) {
  return {
    id: finding.id,
    code: finding.code,
    title: finding.title,
    type: finding.type,
    grade: finding.grade,
    severity: finding.severity,
    verifyStatus: finding.verifyStatus,
    location: finding.location,
    source: finding.source,
    sink: finding.sink,
    reachable: finding.reachable,
    prerequisite: finding.prerequisite,
    rationale: finding.rationale,
    evidence: finding.evidence,
    impact: finding.impact,
    fix: finding.fix,
    snippet: finding.snippet,
    cwe: finding.cwe,
    owasp: finding.owasp,
    verifyMethod: finding.verifyMethod,
    verifyResult: finding.verifyResult,
    poc: finding.poc,
    exp: finding.exp,
  }
}

export function reportWriterPrompt(workspace, finding, reason) {
  const id = findingSrcId(finding, (workspace.findings || []).indexOf(finding))
  const ledger = {
    title: workspace.title,
    url: workspace.url,
    objective: workspace.objective,
    notes: workspace.notes,
    phase: workspace.phase,
    finding: findingBrief(finding),
  }
  const skeleton = renderFindingReport(workspace, finding)
  return [
    `你是黑盒/代审的报告撰写子代理。只为漏洞 ${id}「${finding.title || ''}」写一份独立《源码安全审计报告》Markdown。`,
    '写完后必须调用 report 一次：output 必须是完整 Markdown 正文（从一级标题到结论），禁止只写「SRC-01 专项报告已全文回传」这类摘要。',
    'report 之后不要再写收工短句。那句会被误存成报告正文。',
    '报告逻辑必须对齐《护理到家业务系统 源码安全审计报告》的单条漏洞写法：标题、风险等级/CWE/OWASP、位置、代码片段、判断依据（三点闭合编号）、影响、修复。',
    '必须单独写「复现（PoC / EXP）」：前置、步骤、可复制的 HTTP/curl/python PoC、EXP（或明确写 PoC 已足够）、成功判据。读者拿报告应能直接打一遍。用户若填写了红线则遵守；未填则不要自行删减利用细节。',
    '只输出这一条漏洞的 Markdown 正文，不要把其它漏洞写进来，不要探测，不要前言后语，不要用代码围栏包住整篇报告。',
    '结构必须包含：本条摘要、漏洞详情、复现（PoC/EXP）、黑盒/代码对照、结论。缺 PoC 不准交差。',
    '已确认项必须同时具备判断依据 / 可达性 / 证据。草稿与未验证项不得写成对外已确认结论。',
    '不得编造台账中不存在的漏洞、证据或版本。可以润色行文，但事实以本条台账为准。',
    reason ? `触发：${reason}` : '',
    '',
    '## 本条台账 JSON',
    '',
    '```json',
    JSON.stringify(ledger, null, 2).slice(0, 80_000),
    '```',
    '',
    '## 骨架（必须覆盖这些章节，可润色）',
    '',
    skeleton,
  ].filter(Boolean).join('\n')
}

export const REPORT_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    markdown: { type: 'string' },
  },
  required: ['markdown'],
}

function blocksToText(blocks) {
  if (!Array.isArray(blocks)) return ''
  const parts = []
  for (const block of blocks) {
    if (block && block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
  }
  return parts.join('\n').trim()
}

function parseArgs(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try { return JSON.parse(String(raw)) } catch { return {} }
}

function unwrapMarkdown(text) {
  const raw = String(text || '').trim()
  if (raw === '') return ''
  const fenced = raw.match(/^```(?:markdown|md)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1].trim() : raw
}

export function looksLikeHandoff(text) {
  const raw = String(text || '').trim()
  if (raw === '') return true
  if (/专项报告已全文回传|撰写任务结束|report accepted|已回传主代理|Background subagent /.test(raw) && raw.length < 400) return true
  if (raw.length < 80 && !raw.includes('## ')) return true
  return false
}

export function looksLikeFullReport(text) {
  const raw = unwrapMarkdown(text)
  if (!raw || looksLikeHandoff(raw)) return false
  if (raw.length < 200) return false
  const hasBody = /源码安全审计报告|##\s*0\.\s*本条摘要|##\s*1\.\s*漏洞详情|###\s*SRC-\d+/.test(raw)
    || (raw.includes('# ') && raw.includes('## ') && raw.length > 400)
  const hasPoc = /复现|PoC|POC|EXP|```(?:http|bash|sh|python|curl)?/i.test(raw)
  return hasBody && hasPoc
}

export function preferReportMarkdown(current, next) {
  const a = unwrapMarkdown(current)
  const b = unwrapMarkdown(next)
  if (looksLikeFullReport(b) && (!looksLikeFullReport(a) || b.length >= a.length)) return b
  if (looksLikeFullReport(a)) return a
  if (b && !looksLikeHandoff(b) && b.length > a.length) return b
  return a
}

export function extractReportFromEvent(event) {
  if (!event || !event.data) return ''
  if (event.type === 'tool/call' && event.data.name === 'report') {
    const args = parseArgs(event.data.arguments)
    const fromArgs = unwrapMarkdown(args.output || args.markdown || args.content || '')
    if (fromArgs) return fromArgs
    if (typeof event.data.arguments === 'string') return unwrapMarkdown(event.data.arguments)
    return ''
  }
  if (event.type === 'assistant/message') {
    const content = event.data.message && event.data.message.content
    return unwrapMarkdown(blocksToText(content))
  }
  return ''
}

export function extractReportFromParentRelay(event) {
  const message = event && event.data && event.data.message
  const source = message && message.source
  if (!source || source.kind !== 'subagent-report') return { childId: '', markdown: '' }
  const content = Array.isArray(message.content) ? message.content : []
  const texts = []
  for (const block of content) {
    if (!block || block.type !== 'text' || typeof block.text !== 'string') continue
    if (/^Background subagent /.test(block.text)) continue
    texts.push(block.text)
  }
  return { childId: source.senderSessionId || '', markdown: unwrapMarkdown(texts.join('\n')) }
}

export function extractReportFromSession(session) {
  const events = session && Array.isArray(session.events) ? session.events : []
  let best = ''
  for (const event of events) best = preferReportMarkdown(best, extractReportFromEvent(event))
  return best
}

export function extractReportMarkdown(result) {
  const structured = result && result.structured
  if (structured && typeof structured.markdown === 'string' && structured.markdown.trim()) {
    const md = unwrapMarkdown(structured.markdown)
    if (looksLikeFullReport(md) || !looksLikeHandoff(md)) return md
  }
  const fromSession = extractReportFromSession(result && result.session)
  if (fromSession) return fromSession
  const fromOutput = unwrapMarkdown(blocksToText(result && result.output))
  if (looksLikeHandoff(fromOutput)) return ''
  return fromOutput
}
