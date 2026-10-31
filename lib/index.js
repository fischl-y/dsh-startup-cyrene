// Host 半：配置读取、视频流路由、以及往首屏注入开屏脚本。
//
// 注入走的是宿主的「结构化注入行」（webserver/index-inject）：这些行会被
// renderIndex() 渲染进真正的窗口 HTML。反例是老的 tapIndex 字符串改写——
// 在新版桌面窗口上服务端写了、浏览器却拿不到，所以不再使用。
//
// 只读插件：不写任何文件，不注册写接口。媒体路由带 Range 支持，且只允许读取
// 包内 assets/ 下、扩展名在白名单里的文件。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MEDIA_EXT, loadConfig } from './config.js'
import { renderSplashScript } from './script.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PACKAGE_ROOT = path.dirname(HERE)
const ASSETS_DIR = path.join(PACKAGE_ROOT, 'assets')
const MEDIA_PREFIX = '/startup-cyrene/media/'
const CONFIG_PATH = '/startup-cyrene/config.json'
const BEAT_PATH = '/startup-cyrene/beat'
// 诊断日志：默认开启；设 DSH_STARTUP_CYRENE_TRACE=0 关闭。
const TRACE_FILE = path.join(os.tmpdir(), 'dsh-startup-cyrene-trace.log')

function trace(line) {
  if (String(process.env.DSH_STARTUP_CYRENE_TRACE || '1') === '0') return
  try {
    fs.appendFileSync(TRACE_FILE, new Date().toISOString() + ' ' + line + '\n')
  } catch (err) {}
}

export const name = 'dsh-startup-cyrene'
export const inject = ['webServer']

const MIME_BY_EXT = Object.freeze({
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
})

function safeMediaName(raw) {
  let name = String(raw || '').trim()
  try { name = decodeURIComponent(name) } catch (err) { return null }
  if (!name || name !== path.basename(name)) return null
  if (!/^[A-Za-z0-9._-]+$/.test(name)) return null
  if (!MEDIA_EXT.has(path.extname(name).toLowerCase())) return null
  return name
}

function resolveMediaPath(reqUrl) {
  let pathname = String(reqUrl || '/')
  const q = pathname.indexOf('?')
  if (q >= 0) pathname = pathname.slice(0, q)
  // prefix 路由可能带前缀也可能已剥掉，两种都兼容
  const cut = pathname.indexOf(MEDIA_PREFIX)
  if (cut >= 0) pathname = pathname.slice(cut + MEDIA_PREFIX.length)
  else if (pathname.startsWith('/')) pathname = pathname.slice(1)
  const fileName = safeMediaName(pathname)
  if (!fileName) return null
  return path.join(ASSETS_DIR, fileName)
}

function serveMedia(req, res, file) {
  let total
  try {
    total = fs.statSync(file).size
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('startup-cyrene: media not found')
    return
  }
  const type = MIME_BY_EXT[path.extname(file).toLowerCase()] || 'application/octet-stream'
  const range = req.headers && req.headers.range
  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(String(range)) : null
  try {
    if (m) {
      const start = m[1] === '' ? 0 : Number(m[1])
      const end = m[2] === '' ? total - 1 : Math.min(Number(m[2]), total - 1)
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= total) {
        res.writeHead(416, { 'Content-Range': 'bytes */' + total })
        res.end()
        return
      }
      res.writeHead(206, {
        'Content-Type': type,
        'Content-Length': String(end - start + 1),
        'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
      })
      const stream = fs.createReadStream(file, { start, end })
      stream.on('error', () => { try { res.destroy() } catch (err) {} })
      stream.pipe(res)
      return
    }
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': String(total),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    })
    const stream = fs.createReadStream(file)
    stream.on('error', () => { try { res.destroy() } catch (err) {} })
    stream.pipe(res)
  } catch (err) {
    try { res.destroy() } catch (e) {}
  }
}

export function apply(ctx) {
  trace('apply() called')
  ctx.inject(['webServer', 'connection'], (child) => {
    child.effect(
      () => child.webServer.register({
        kind: 'prefix',
        path: '/startup-cyrene/media',
        handler: (req, res) => {
          let rejected = false
          try {
            const join = child.connection && typeof child.connection.requestRejection === 'function'
              ? child.connection.requestRejection(req)
              : undefined
            if (join !== undefined && join !== null) {
              rejected = true
              res.statusCode = join
              res.end()
            }
          } catch (err) {}
          if (rejected) {
            trace('media ' + String(req.url) + ' -> rejected ' + res.statusCode)
            return
          }
          const file = resolveMediaPath(req.url)
          trace('media ' + String(req.url) + ' -> ' + (file ? 'serve ' + path.basename(file) : 'unknown'))
          if (!file) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
            res.end('startup-cyrene: unknown media')
            return
          }
          serveMedia(req, res, file)
        },
      }),
      'dsh-startup-cyrene: media route',
    )

    // 客户端插件（client.js）的后备数据源：片段地址、时长、点击跳段目标。
    child.effect(
      () => child.webServer.register({
        kind: 'exact',
        path: CONFIG_PATH,
        handler: (req, res) => {
          trace('config requested')
          try {
            const config = loadConfig(ASSETS_DIR)
            const payload = {
              enabled: config.enabled,
              fadeMs: config.fadeMs,
              audioFadeMs: config.audioFadeMs,
              guardMs: config.guardMs,
              totalTimeoutMs: config.totalTimeoutMs,
              clickSkipsTo: config.clickSkipsTo,
              segments: config.segments.map((s) => ({
                url: MEDIA_PREFIX + encodeURIComponent(s.file),
                volume: s.volume,
              })),
            }
            const body = JSON.stringify(payload)
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-store',
              'Content-Length': String(Buffer.byteLength(body)),
            })
            res.end(body)
          } catch (err) {
            trace('config failed: ' + (err && err.message ? err.message : err))
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
            res.end('startup-cyrene: config unavailable')
          }
        },
      }),
      'dsh-startup-cyrene: config route',
    )

    // 真正的注入通路：结构化行会被渲染进窗口 HTML 的 <head>，在应用界面之前执行。
    // 订阅点两个都挂上（ctx 与注入后的 child），行内去重，避免重复播放。
    child.effect(() => {
      const listener = (table) => {
        try {
          if (!Array.isArray(table)) return
          if (table.some((row) => row && typeof row.text === 'string' && row.text.indexOf('cyrene-loading') !== -1)) return
          const config = loadConfig(ASSETS_DIR)
          if (!config.enabled || !config.segments.length) return
          table.push({ kind: 'script', placement: 'head', text: renderSplashScript(config) })
          trace('row injected segments=' + config.segments.length)
        } catch (err) {
          trace('row injection failed: ' + (err && err.message ? err.message : err))
        }
      }
      const disposers = []
      try {
        const d = ctx.on('webserver/index-inject', listener)
        if (typeof d === 'function') disposers.push(d)
      } catch (err) {}
      try {
        const d = child.on('webserver/index-inject', listener)
        if (typeof d === 'function') disposers.push(d)
      } catch (err) {}
      trace('index-inject subscriptions=' + disposers.length)
      return () => {
        for (const d of disposers) {
          try { d() } catch (err) {}
        }
      }
    }, 'dsh-startup-cyrene: structured index injection')

    // 诊断用：客户端组件每走到一步就打一次卡，便于在没有 devtools 的情况下定位。
    child.effect(
      () => child.webServer.register({
        kind: 'exact',
        path: BEAT_PATH,
        handler: (req, res) => {
          trace('beat ' + String(req.url))
          res.writeHead(204, { 'Cache-Control': 'no-store' })
          res.end()
        },
      }),
      'dsh-startup-cyrene: beat route',
    )
  })
}
