/** Markdown report in the 护理到家源码安全审计报告 shape. */

const SEVERITY_ORDER = ['Critical', 'High', 'Medium', 'Low', 'Info']

function today() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function countBy(list, key) {
  const map = {}
  for (const item of list) {
    const value = item[key] || 'Info'
    map[value] = (map[value] || 0) + 1
  }
  return map
}

function srcId(finding, index) {
  if (finding.code && /^SRC-\d+/i.test(finding.code)) return finding.code.toUpperCase()
  return `SRC-${String(index + 1).padStart(2, '0')}`
}

function gradeLabel(grade) {
  return {
    unauth: '未授权成立',
    session: '需会话',
    key: '密钥门',
    blocked: '本实例被挡',
    code: '代码缺陷（未实机）',
  }[grade] || grade || '未定级'
}

function verifyLabel(status) {
  return {
    verified: '已验证',
    unverified: '未验证',
    blocked: '验证受阻',
    draft: '草稿，不得当作已确认漏洞上报',
  }[status] || '草稿'
}

export function canConfirmFinding(finding) {
  const rationale = String(finding.rationale || '').trim()
  const evidence = String(finding.evidence || '').trim()
  const reachable = String(finding.reachable || '').trim()
  return Boolean(finding && finding.verifyStatus === 'verified' && rationale && evidence && reachable)
}

export function findingSrcId(finding, index = 0) {
  return srcId(finding, index)
}

export function renderFindingReport(workspace, finding) {
  const findings = Array.isArray(workspace.findings) ? workspace.findings : []
  const index = Math.max(0, findings.findIndex((item) => item && finding && item.id === finding.id))
  const id = srcId(finding || {}, index)
  const title = finding && finding.title ? finding.title : '未命名缺陷'
  const project = workspace.title && workspace.title !== '未命名审计' ? workspace.title : '源码安全审计'
  const target = workspace.url || workspace.objective || '（未写目标）'
  const confirmed = canConfirmFinding(finding)
  const lines = []

  lines.push(`# 《${project} ${id} 源码安全审计报告》`)
  lines.push('')
  lines.push('> 配套文档：黑盒/代审工作区按漏洞单独产出')
  lines.push(`> 审计对象：\`${target}\``)
  if (workspace.notes) lines.push(`> 注意事项：${workspace.notes}`)
  lines.push(`> 审计日期：${today()}`)
  lines.push('> 方法：OWASP Code Review Guide + 定向数据流追踪（以黑盒阶段的假设为线索）')
  lines.push(`> 本报告只覆盖 **${id}**，不与其它漏洞混写。`)
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 0. 本条摘要')
  lines.push('')
  lines.push(`**${id}　${title}**`)
  lines.push('')
  lines.push(`**风险等级**：**${(finding && finding.severity) || 'Info'}**　**${(finding && finding.cwe) || ''}**　**${(finding && finding.owasp) || ''}**${(finding && finding.cvss) ? '　`' + finding.cvss + '`' : ''}`.replace(/　+/g, '　').trim())
  lines.push('')
  if (!confirmed) {
    lines.push('本条**尚未三点闭合**（判断依据 / 可达 / 证据）。下文是台账草稿，不得当作已确认漏洞上报。')
  } else {
    lines.push(`${gradeLabel(finding.grade)}。${String((finding && (finding.impact || finding.rationale)) || '').slice(0, 280)}`)
  }
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 1. 漏洞详情')
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push(`### ${id}　${title}`)
  lines.push('')
  lines.push(`**风险等级**：**${(finding && finding.severity) || 'Info'}**　**${(finding && finding.cwe) || ''}**　**${(finding && finding.owasp) || ''}**${(finding && finding.cvss) ? '　`' + finding.cvss + '`' : ''}`.replace(/　+/g, '　').trim())
  lines.push('')
  if (finding && finding.location) {
    lines.push(`**位置**：\`${finding.location}\``)
    lines.push('')
  }
  if (finding && finding.snippet) {
    lines.push('```')
    lines.push(String(finding.snippet).slice(0, 4000))
    lines.push('```')
    lines.push('')
  }
  lines.push('**判断依据（三点闭合）**：')
  lines.push('')
  if (finding && finding.rationale) {
    String(finding.rationale).split(/\n+/).forEach((line, i) => {
      const text = line.replace(/^\d+\.\s*/, '').trim()
      if (text) lines.push(`${i + 1}. ${text}`)
    })
  } else {
    lines.push('1. （缺判断依据）')
  }
  lines.push('')
  lines.push(`- 可达性：${(finding && finding.reachable) || '未写'}`)
  lines.push(`- 前置：${(finding && finding.prerequisite) || '无 / 未写'}`)
  lines.push(`- P5 定级：${gradeLabel(finding && finding.grade)}`)
  if (finding && (finding.source || finding.sink)) lines.push(`- Source → Sink：${finding.source || '?'} → ${finding.sink || '?'}`)
  lines.push(`- 验证：${verifyLabel(finding && finding.verifyStatus)} — ${[(finding && finding.verifyMethod) || '', (finding && finding.verifyResult) || ''].join(' ').trim()}`)
  lines.push('')
  lines.push('**影响**：')
  lines.push('')
  lines.push((finding && (finding.impact || finding.evidence)) || '（未写）')
  lines.push('')
  if (finding && finding.evidence) {
    lines.push('**证据**：')
    lines.push('')
    lines.push(finding.evidence)
    lines.push('')
  }
  lines.push('**修复**：')
  lines.push('')
  lines.push((finding && finding.fix) || '（待补）')
  lines.push('')
  if (finding && finding.rootCause) {
    lines.push('**根因**（修根因可一次解决同源多条）：')
    lines.push('')
    lines.push(finding.rootCause)
    lines.push('')
  }
  lines.push('**变体清单**（同一模式的其它位置——只修本条等于没修）：')
  lines.push('')
  lines.push((finding && finding.variants) || '（未做变体分析）')
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 2. 复现（PoC / EXP）')
  lines.push('')
  lines.push('读者应能按本节独立复现。用户填写了红线则遵守；未填则给出完整可复制 PoC/EXP。')
  lines.push('')
  lines.push('**前置**：')
  lines.push('')
  lines.push((finding && finding.prerequisite) || '无（未授权即可打）')
  lines.push('')
  lines.push('**复现步骤**：')
  lines.push('')
  lines.push((finding && finding.verifyMethod) || '1. 对入口发送下方 PoC\n2. 对照成功判据')
  lines.push('')
  lines.push('**PoC**（可直接复制执行）：')
  lines.push('')
  if (finding && finding.poc) {
    const poc = String(finding.poc).trim()
    if (/^```/.test(poc)) {
      lines.push(poc)
    } else {
      lines.push('```http')
      lines.push(poc)
      lines.push('```')
    }
  } else {
    lines.push('```http')
    lines.push((finding && finding.evidence) || '（缺 PoC：补完整 HTTP/curl 请求，含方法、路径、关键参数与预期响应）')
    lines.push('```')
  }
  lines.push('')
  lines.push('**EXP**（扩大影响 / 一键利用）：')
  lines.push('')
  if (finding && finding.exp) {
    const exp = String(finding.exp).trim()
    if (/^```/.test(exp)) {
      lines.push(exp)
    } else {
      lines.push('```')
      lines.push(exp)
      lines.push('```')
    }
  } else {
    lines.push('```')
    lines.push('（缺 EXP：至少给出可复用的 curl / python / sqlmap 命令；没有利用链就写「PoC 已足够复现，无需 EXP」）')
    lines.push('```')
  }
  lines.push('')
  lines.push('**成功判据**：')
  lines.push('')
  lines.push((finding && finding.verifyResult) || '响应出现可区分回显 / 差分 / 时延 / flag，与正常请求不同。')
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 3. 黑盒/代码对照')
  lines.push('')
  lines.push('| 编号 | 标题 | 入口 / 位置 | 验证结果 |')
  lines.push('|---|---|---|---|')
  lines.push(`| ${id} | ${title} | ${(finding && (finding.type || '')) || ''} ${(finding && finding.location) || ''} | ${confirmed ? `证实 → ${gradeLabel(finding.grade)}` : verifyLabel(finding && finding.verifyStatus)} |`)
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 4. 结论')
  lines.push('')
  if (!confirmed) {
    lines.push('本条未闭合，禁止写入对外已确认结论。继续补齐判断依据、可达性与证据。')
  } else if (finding && finding.severity === 'Critical') {
    lines.push(`**${id} 为已验证 Critical。** 在本条整改与复测完成前，不得把该入口当作已通过安全审计。`)
  } else {
    lines.push(`**${id} 已三点闭合。** 按上文修复后复测；其它漏洞见各自独立报告，不在此混写。`)
  }
  lines.push('')
  lines.push(`*${id} 专项审计报告 — ${today()}*`)
  lines.push('')
  return lines.join('\n')
}

export function renderReport(workspace) {
  const findings = Array.isArray(workspace.findings) ? workspace.findings : []
  const confirmed = findings.filter((f) => f.verifyStatus === 'verified' && canConfirmFinding(f))
  const blocked = findings.filter((f) => f.verifyStatus === 'blocked' || f.verifyStatus === 'unverified' || !canConfirmFinding(f))
  const bySev = countBy(confirmed, 'severity')
  const title = workspace.title && workspace.title !== '未命名审计' ? workspace.title : '源码安全审计报告'
  const target = workspace.url || workspace.objective || '（未写目标）'
  const lines = []

  lines.push(`# 《${title}》`)
  lines.push('')
  lines.push(`> 配套文档：黑盒/代审工作区自动产出`)
  lines.push(`> 审计对象：\`${target}\``)
  if (workspace.notes) lines.push(`> 注意事项：${workspace.notes}`)
  lines.push(`> 审计日期：${today()}`)
  lines.push('> 方法：P0–P7 螺旋（指纹 → 测绘 → 黑盒可达 → 代审 → 互证定级 → 非破坏验证 → 覆盖矩阵）')
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 0. 执行摘要')
  lines.push('')
  if (confirmed.length === 0) {
    lines.push('当前**没有通过三点闭合验证的已确认缺陷**。草稿与未验证项列在后文，不得当作已确认漏洞上报。')
  } else {
    lines.push(`共确认 **${confirmed.length}** 项缺陷（仅统计 verifyStatus=verified 且具备判断依据 / 可达性 / 证据）。`)
  }
  lines.push('')
  lines.push('### 风险统计')
  lines.push('')
  lines.push('| 风险等级 | 数量 | 编号 |')
  lines.push('|---|--:|---|')
  for (const sev of SEVERITY_ORDER) {
    const rows = confirmed.filter((f, i) => (f.severity || 'Info') === sev)
    const ids = rows.map((f, i) => srcId(f, findings.indexOf(f))).join('、') || '—'
    lines.push(`| **${sev}** | **${bySev[sev] || 0}** | ${ids} |`)
  }
  lines.push(`| **合计** | **${confirmed.length}** | |`)
  lines.push('')
  lines.push('### 最重要的几点')
  lines.push('')
  const top = confirmed.slice(0, 5)
  if (top.length === 0) lines.push('1. 尚无已验证结论。')
  else top.forEach((f, i) => {
    lines.push(`${i + 1}. **${srcId(f, findings.indexOf(f))} ${f.title}** — ${gradeLabel(f.grade)}。${String(f.impact || f.evidence || '').slice(0, 180)}`)
  })
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 1. 漏洞详情')
  lines.push('')

  confirmed.forEach((f, i) => {
    const id = srcId(f, findings.indexOf(f))
    lines.push(`### ${id}　${f.title}`)
    lines.push('')
    lines.push(`**风险等级**：${f.severity || 'Info'}　**${f.cwe || ''}**　**${f.owasp || ''}**`.replace(/\s+/g, ' ').trim())
    lines.push('')
    if (f.location) {
      lines.push(`**位置**：\`${f.location}\``)
      lines.push('')
    }
    if (f.snippet) {
      lines.push('```')
      lines.push(String(f.snippet).slice(0, 2500))
      lines.push('```')
      lines.push('')
    }
    lines.push('**判断依据（三点闭合）**：')
    lines.push('')
    lines.push(f.rationale || '（缺判断依据，本条不应出现在已确认列表）')
    lines.push('')
    lines.push(`- 可达性：${f.reachable || '未写'}`)
    lines.push(`- 前置：${f.prerequisite || '未写'}`)
    lines.push(`- P5 定级：${gradeLabel(f.grade)}`)
    if (f.source || f.sink) lines.push(`- Source → Sink：${f.source || '?'} → ${f.sink || '?'}`)
    lines.push(`- 验证：${verifyLabel(f.verifyStatus)} — ${f.verifyMethod || ''} ${f.verifyResult || ''}`.trim())
    lines.push('')
    lines.push('**影响**：')
    lines.push('')
    lines.push(f.impact || f.evidence || '（未写）')
    lines.push('')
    if (f.evidence) {
      lines.push('**证据**：')
      lines.push('')
      lines.push(f.evidence)
      lines.push('')
    }
    lines.push('**修复**：')
    lines.push('')
    lines.push(f.fix || '（待补）')
    lines.push('')
    lines.push('---')
    lines.push('')
  })

  lines.push('## 2. 黑盒结论的源码/实机校验对照')
  lines.push('')
  lines.push('| 编号 | 标题 | 黑盒/代码判断 | 验证结果 |')
  lines.push('|---|---|---|---|')
  findings.forEach((f, i) => {
    const id = srcId(f, i)
    const verdict = f.verifyStatus === 'verified' && canConfirmFinding(f)
      ? `证实 → ${gradeLabel(f.grade)}`
      : verifyLabel(f.verifyStatus)
    lines.push(`| ${id} | ${f.title} | ${f.type || ''} ${f.location || ''} | ${verdict} |`)
  })
  if (findings.length === 0) lines.push('| — | 尚无缺陷 | — | — |')
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 3. 本次未能完成的验证')
  lines.push('')
  const pending = blocked.length ? blocked : findings.filter((f) => f.verifyStatus !== 'verified')
  if (pending.length === 0) {
    lines.push('无。已确认项均具备判断依据、可达性与证据。')
  } else {
    lines.push('| # | 待验证项 | 验证方法 | 优先级 |')
    lines.push('|---|---|---|:--:|')
    pending.forEach((f, i) => {
      lines.push(`| ${i + 1} | ${f.title} | ${f.verifyMethod || '差分/时延/只读复现'} | ${f.severity === 'Critical' || f.severity === 'High' ? '高' : '中'} |`)
    })
  }
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 4. 整改优先级')
  lines.push('')
  lines.push('| # | 动作 | 对应 |')
  lines.push('|---|---|---|')
  confirmed
    .slice()
    .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity || 'Info') - SEVERITY_ORDER.indexOf(b.severity || 'Info'))
    .forEach((f, i) => {
      lines.push(`| ${i + 1} | ${String(f.fix || f.title).replace(/\n/g, ' ').slice(0, 120)} | ${srcId(f, findings.indexOf(f))} |`)
    })
  if (confirmed.length === 0) lines.push('| — | 先完成验证再出整改单 | — |')
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 5. 结论')
  lines.push('')
  if (confirmed.some((f) => f.severity === 'Critical')) {
    lines.push('存在已验证的 Critical 缺陷。在整改与复测完成前，不得把本系统当作已通过安全审计。')
  } else if (confirmed.length > 0) {
    lines.push(`已验证 ${confirmed.length} 项缺陷。按整改优先级修复后复测。草稿与未验证项不得写入对外结论。`)
  } else {
    lines.push('尚无三点闭合的已确认漏洞。继续 P3–P6，禁止把代码猜测写成「未授权可打」。')
  }
  lines.push('')
  lines.push(`*审计报告 — ${today()}*`)
  lines.push('')
  return lines.join('\n')
}
