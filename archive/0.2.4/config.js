// 配置读取与校验。
// 原则：任何一项写错都只回退到默认值并打一条警告，绝不让开屏把界面锁死。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CONFIG_FILE = 'startup-cyrene.json'

export const MEDIA_EXT = Object.freeze(new Set(['.mp4', '.m4v', '.webm', '.mov']))

export const DEFAULTS = Object.freeze({
  enabled: true,
  fadeMs: 900,
  audioFadeMs: 2200,
  guardMs: 2600,
  totalTimeoutMs: 60000,
  clickSkipsTo: 1,
  // 开屏期间尝试进入全屏：Electron 的窗口按钮是原生 titleBarOverlay，
  // CSS 与 DOM 都盖不住，只有全屏能让它们消失。失败就静默忽略。
  fullscreenDuringSplash: true,
  segments: Object.freeze([
    Object.freeze({ file: 'clip1.mp4', volume: 1 }),
    Object.freeze({ file: 'clip2.mp4', volume: 1 }),
  ]),
})

export function configPath() {
  const override = String(process.env.DSH_STARTUP_CYRENE_CONFIG || '').trim()
  if (override) return path.resolve(override)
  const home = String(process.env.DSH_HOME || '').trim() || path.join(os.homedir(), '.dsh')
  return path.join(home, CONFIG_FILE)
}

function clampNumber(value, fallback, min, max) {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function readBoolean(value, fallback) {
  if (typeof value === 'boolean') return value
  if (value === 1 || value === '1' || value === 'true') return true
  if (value === 0 || value === '0' || value === 'false') return false
  return fallback
}

export function isMediaFileName(name) {
  if (typeof name !== 'string' || !name) return false
  if (name !== path.basename(name)) return false
  if (!/^[A-Za-z0-9._-]+$/.test(name)) return false
  return MEDIA_EXT.has(path.extname(name).toLowerCase())
}

function mediaExists(name, assetsDir) {
  if (!isMediaFileName(name)) return false
  try {
    return fs.statSync(path.join(assetsDir, name)).isFile()
  } catch (err) {
    return false
  }
}

function normalizeSegments(raw, assetsDir) {
  if (!Array.isArray(raw)) return null
  const out = []
  for (const item of raw.slice(0, 5)) {
    const file = item && typeof item === 'object' ? String(item.file || '').trim() : ''
    if (!mediaExists(file, assetsDir)) {
      console.warn('[dsh-startup-cyrene] 忽略不可用的片段: ' + JSON.stringify(file))
      continue
    }
    const volume = clampNumber(item.volume, 1, 0, 1)
    out.push({ file, volume })
  }
  return out.length ? out : null
}

function defaultSegments(assetsDir) {
  return DEFAULTS.segments.filter((s) => mediaExists(s.file, assetsDir)).map((s) => ({ ...s }))
}

export function normalizeConfig(raw, assetsDir) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const segments = normalizeSegments(src.segments, assetsDir) || defaultSegments(assetsDir)
  const clickSkipsTo = src.clickSkipsTo === null
    ? null
    : Math.round(clampNumber(src.clickSkipsTo, DEFAULTS.clickSkipsTo, 0, Math.max(0, segments.length - 1)))
  return {
    enabled: segments.length > 0 && readBoolean(src.enabled, DEFAULTS.enabled),
    fadeMs: Math.round(clampNumber(src.fadeMs, DEFAULTS.fadeMs, 0, 5000)),
    audioFadeMs: Math.round(clampNumber(src.audioFadeMs, DEFAULTS.audioFadeMs, 0, 10000)),
    guardMs: Math.round(clampNumber(src.guardMs, DEFAULTS.guardMs, 300, 15000)),
    totalTimeoutMs: Math.round(clampNumber(src.totalTimeoutMs, DEFAULTS.totalTimeoutMs, 3000, 600000)),
    clickSkipsTo,
    fullscreenDuringSplash: readBoolean(src.fullscreenDuringSplash, DEFAULTS.fullscreenDuringSplash),
    segments,
  }
}

export function loadConfig(assetsDir) {
  let raw = {}
  try {
    const text = fs.readFileSync(configPath(), 'utf8')
    raw = JSON.parse(text)
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      console.warn('[dsh-startup-cyrene] 读取配置失败，使用默认值: ' + (err.message || err))
    }
  }
  return normalizeConfig(raw, assetsDir)
}
