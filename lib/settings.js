/** Durable 黑盒/代审 subagent preferences (model + concurrency cap). */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export const SETTINGS_NS = 'local-audit-workspace'
export const DEFAULT_MAX_SUBAGENTS = 4
export const MIN_MAX_SUBAGENTS = 1
export const MAX_MAX_SUBAGENTS = 32

export function defaultSettings() {
  return {
    subagentProvider: '',
    subagentModel: '',
    maxSubagents: DEFAULT_MAX_SUBAGENTS,
    toolsDir: '',
    outputDir: '',
    proxyType: 'off',
    proxyHost: '',
    proxyPort: '',
    proxyUser: '',
    proxyPass: '',
  }
}

export function normalizeSettings(raw) {
  const base = defaultSettings()
  if (!raw || typeof raw !== 'object') return base
  const provider = typeof raw.subagentProvider === 'string' ? raw.subagentProvider.trim() : ''
  const model = typeof raw.subagentModel === 'string' ? raw.subagentModel.trim() : ''
  let max = Number(raw.maxSubagents)
  if (!Number.isSafeInteger(max)) max = DEFAULT_MAX_SUBAGENTS
  if (max < MIN_MAX_SUBAGENTS) max = MIN_MAX_SUBAGENTS
  if (max > MAX_MAX_SUBAGENTS) max = MAX_MAX_SUBAGENTS
  const toolsDir = typeof raw.toolsDir === 'string' ? raw.toolsDir.trim() : ''
  const outputDir = typeof raw.outputDir === 'string' ? raw.outputDir.trim() : ''
  const proxyType = raw.proxyType === 'socks5' || raw.proxyType === 'http' ? raw.proxyType : 'off'
  const proxyHost = typeof raw.proxyHost === 'string' ? raw.proxyHost.trim() : ''
  const proxyPort = typeof raw.proxyPort === 'string' || typeof raw.proxyPort === 'number'
    ? String(raw.proxyPort).trim()
    : ''
  const proxyUser = typeof raw.proxyUser === 'string' ? raw.proxyUser.trim() : ''
  const proxyPass = typeof raw.proxyPass === 'string' ? raw.proxyPass : ''
  return {
    subagentProvider: provider,
    subagentModel: model,
    maxSubagents: max,
    toolsDir,
    outputDir,
    proxyType,
    proxyHost,
    proxyPort,
    proxyUser,
    proxyPass,
  }
}

export function proxyUrl(settings, withAuth = true) {
  if (!settings || settings.proxyType === 'off' || !settings.proxyHost) return ''
  const scheme = settings.proxyType === 'socks5' ? 'socks5' : 'http'
  const port = settings.proxyPort || (scheme === 'socks5' ? '1080' : '8080')
  const auth = withAuth && settings.proxyUser
    ? `${encodeURIComponent(settings.proxyUser)}:${encodeURIComponent(settings.proxyPass || '')}@`
    : ''
  return `${scheme}://${auth}${settings.proxyHost}:${port}`
}

export function proxyEnv(settings) {
  const url = proxyUrl(settings, true)
  if (!url) return {}
  return {
    ALL_PROXY: url,
    all_proxy: url,
    HTTP_PROXY: url,
    HTTPS_PROXY: url,
    http_proxy: url,
    https_proxy: url,
  }
}

export function proxyPromptText(settings) {
  const url = proxyUrl(settings, true)
  if (!url) return '未配置探测代理：直连目标。需要走代理时到 设置 → 黑盒/代审 填写 HTTP 或 SOCKS5。'
  const safe = proxyUrl(settings, false)
  return [
    `黑盒探测代理已开：${safe}（类型 ${settings.proxyType}）。`,
    'HTTP 探测必须走该代理：curl --proxy 该地址；pwsh 先设 $env:ALL_PROXY / $env:HTTP_PROXY / $env:HTTPS_PROXY。',
    'audit_kit 已自动注入同样的代理环境变量。不要把代理口令写进报告或聊天总结。',
  ].join('\n')
}

export function loadSettingsFile(path) {
  try {
    return normalizeSettings(JSON.parse(readFileSync(path, 'utf8')))
  } catch {
    return defaultSettings()
  }
}

export function saveSettingsFile(path, value) {
  const next = normalizeSettings(value)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  return next
}

export function childAgentOptions(settings, parent) {
  const model = settings.subagentModel
  if (!model) return undefined
  const parentOpts = parent && parent.options ? parent.options : {}
  const provider = settings.subagentProvider || parentOpts.provider || ''
  if (!provider) return { model }
  return { provider, model }
}

export function isSubagentToolName(name) {
  return name === 'subagent' || name === 'subagent_fork'
}
