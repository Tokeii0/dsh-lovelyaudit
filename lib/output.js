/** Write per-finding SRC reports into the configured output folder. */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export function safeFilePart(value, fallback = 'untitled') {
  const text = String(value || '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return text || fallback
}

export function reportFileName(finding) {
  const code = safeFilePart(finding && (finding.code || finding.id), 'SRC')
  const title = safeFilePart(finding && finding.title, '漏洞报告')
  return `${code} ${title}.md`
}

export function resolveReportRoot(outputDir, workspaceCwd) {
  const custom = typeof outputDir === 'string' ? outputDir.trim() : ''
  if (custom) return { root: resolve(custom), kind: 'custom' }
  const cwd = typeof workspaceCwd === 'string' ? workspaceCwd.trim() : ''
  if (cwd) return { root: resolve(cwd, '审计报告'), kind: 'workspace' }
  return { root: '', kind: '' }
}

export function writeFindingOutput(outputDir, workspace, finding, markdown, workspaceCwd) {
  const body = String(markdown || '')
  if (body.trim() === '') return { ok: false, skipped: false, error: '报告正文为空', path: '' }
  const resolved = resolveReportRoot(outputDir, workspaceCwd)
  if (!resolved.root) return { ok: false, skipped: true, error: '没有可写的工作区目录', path: '' }
  try {
    const project = safeFilePart(workspace && (workspace.title || workspace.sessionId), 'audit')
    const dir = resolved.kind === 'custom' ? resolve(resolved.root, project) : resolve(resolved.root, project)
    mkdirSync(dir, { recursive: true })
    const file = join(dir, reportFileName(finding))
    writeFileSync(file, body.endsWith('\n') ? body : `${body}\n`, 'utf8')
    return { ok: true, skipped: false, error: '', path: file, kind: resolved.kind }
  } catch (error) {
    return { ok: false, skipped: false, error: error instanceof Error ? error.message : String(error), path: '' }
  }
}

export function outputPromptText(settings) {
  const dir = settings && typeof settings.outputDir === 'string' ? settings.outputDir.trim() : ''
  if (!dir) return '专项报告会写入当前会话工作区「审计报告/项目名/SRC-nn 标题.md」。也可在 设置 → 黑盒/代审 指定其它输出文件夹。'
  return `报告输出地址：${dir}。每条已验证漏洞的专项报告会写成该目录下「项目名/SRC-nn 标题.md」。`
}
