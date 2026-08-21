/** Per-session audit ledger persistence under $DSH_HOME/audit-workspaces. */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { hydrateWorkspace, serializeWorkspace } from './workspace.js'

const pending = new Map()
const timers = new Map()
const DEBOUNCE_MS = 200

export function storeDir(home = process.env.DSH_HOME || join(homedir(), '.dsh')) {
  return join(home, 'audit-workspaces')
}

export function fileForSession(dir, sessionId) {
  return join(dir, `${safeSessionId(sessionId)}.json`)
}

export function safeSessionId(sessionId) {
  const raw = String(sessionId || '').trim()
  const cleaned = raw.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 180)
  return cleaned || 'unknown'
}

export function loadWorkspaceFile(dir, sessionId) {
  try {
    const raw = JSON.parse(readFileSync(fileForSession(dir, sessionId), 'utf8'))
    return hydrateWorkspace(raw, sessionId)
  } catch {
    return null
  }
}

export function saveWorkspaceFile(dir, workspace) {
  if (!workspace || typeof workspace.sessionId !== 'string' || workspace.sessionId === '') return
  mkdirSync(dir, { recursive: true })
  const target = fileForSession(dir, workspace.sessionId)
  const tmp = `${target}.${process.pid}.tmp`
  const body = `${JSON.stringify(serializeWorkspace(workspace), null, 2)}\n`
  writeFileSync(tmp, body, 'utf8')
  try {
    renameSync(tmp, target)
  } catch {
    writeFileSync(target, body, 'utf8')
    try { writeFileSync(tmp, '') } catch {}
  }
}

export function scheduleSave(dir, workspace) {
  if (!workspace || !workspace.sessionId) return
  pending.set(workspace.sessionId, workspace)
  const prev = timers.get(workspace.sessionId)
  if (prev) clearTimeout(prev)
  const timer = setTimeout(() => {
    timers.delete(workspace.sessionId)
    const latest = pending.get(workspace.sessionId)
    pending.delete(workspace.sessionId)
    if (latest) {
      try { saveWorkspaceFile(dir, latest) } catch {}
    }
  }, DEBOUNCE_MS)
  if (typeof timer.unref === 'function') timer.unref()
  timers.set(workspace.sessionId, timer)
}

export function flushSaves(dir) {
  for (const timer of timers.values()) clearTimeout(timer)
  timers.clear()
  for (const workspace of pending.values()) {
    try { saveWorkspaceFile(dir, workspace) } catch {}
  }
  pending.clear()
}
