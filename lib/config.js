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

// 用户自己的素材目录：放在 profile 之外，更新/重装插件都不会清掉它。
export function userMediaDir() {
  const home = String(process.env.DSH_HOME || '').trim() || path.join(os.homedir(), '.dsh')
  return path.join(home, 'startup-cyrene-media')
}

// 让调用方既能传单个目录（向后兼容），也能传目录数组（用户目录优先）。
function mediaDirs(input) {
  if (Array.isArray(input)) return input.filter((d) => typeof d === 'string' && d)
  return input ? [input] : []
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

export function mediaExists(name, dirs) {
  if (!isMediaFileName(name)) return false
  for (const dir of mediaDirs(dirs)) {
    try {
      if (fs.statSync(path.join(dir, name)).isFile()) return true
    } catch (err) {}
  }
  return false
}

// 找到实际文件路径：用户目录优先，其次包内 assets。
export function resolveMedia(name, dirs) {
  if (!isMediaFileName(name)) return null
  for (const dir of mediaDirs(dirs)) {
    const file = path.join(dir, name)
    try {
      if (fs.statSync(file).isFile()) return file
    } catch (err) {}
  }
  return null
}

function normalizeSegments(raw, dirs) {
  if (!Array.isArray(raw)) return null
  const out = []
  for (const item of raw.slice(0, 5)) {
    const file = item && typeof item === 'object' ? String(item.file || '').trim() : ''
    if (!mediaExists(file, dirs)) {
      console.warn('[dsh-startup-cyrene] 忽略不可用的片段: ' + JSON.stringify(file))
      continue
    }
    const volume = clampNumber(item.volume, 1, 0, 1)
    out.push({ file, volume })
  }
  return out.length ? out : null
}

function defaultSegments(dirs) {
  return DEFAULTS.segments.filter((s) => mediaExists(s.file, dirs)).map((s) => ({ ...s }))
}

export function normalizeConfig(raw, dirs) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const segments = normalizeSegments(src.segments, dirs) || defaultSegments(dirs)
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
    segments,
  }
}

export function loadConfig(dirs) {
  let raw = {}
  try {
    const text = fs.readFileSync(configPath(), 'utf8')
    raw = JSON.parse(text)
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      console.warn('[dsh-startup-cyrene] 读取配置失败，使用默认值: ' + (err.message || err))
    }
  }
  return normalizeConfig(raw, dirs)
}
