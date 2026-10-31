// 集成测试：apply() 是否注册了媒体/配置路由，是否往 index 注入行里推了开屏脚本。
// 运行：node test/plugin-apply.test.mjs
import { apply } from '../lib/index.js'

const registrations = []
const effects = []
const injected = []

const child = {
  webServer: {
    register(spec) {
      registrations.push(spec)
      return () => { registrations.push('disposed') }
    },
  },
  connection: { requestRejection: () => undefined },
  effect(fn) {
    effects.push(fn())
  },
  on(name, fn) {
    if (name === 'webserver/index-inject') injected.push(fn)
    return () => {}
  },
}

const ctx = { inject(_deps, cb) { cb(child) } }

apply(ctx)

let failures = 0
const assert = (cond, msg) => {
  if (!cond) {
    failures++
    console.log('FAIL ' + msg)
  } else {
    console.log('PASS ' + msg)
  }
}

const media = registrations.find((r) => r && r.path === '/startup-cyrene/media')
const config = registrations.find((r) => r && r.path === '/startup-cyrene/config.json')
assert(registrations.length === 3, 'registers three host routes (media + config + beat)')
assert(media && media.kind === 'prefix', 'media route is prefix kind')
assert(media && typeof media.handler === 'function', 'media route has a handler')
assert(config && config.kind === 'exact', 'config route is exact kind')

function fakeRes() {
  const out = { status: 0, headers: null, body: '' }
  return {
    out,
    set statusCode(v) { out.status = v },
    get statusCode() { return out.status },
    writeHead(status, headers) { out.status = status; out.headers = headers || null },
    end(body) { out.body = body === undefined || body === null ? '' : String(body) },
    destroy() {},
  }
}

const res = fakeRes()
config.handler({ url: '/startup-cyrene/config.json', headers: {} }, res)
assert(res.out.status === 200, 'config route answers 200')
let payload = null
try { payload = JSON.parse(res.out.body) } catch (err) {}
assert(payload && payload.enabled === true, 'config payload is enabled')
assert(payload && Array.isArray(payload.segments) && payload.segments.length === 2, 'config payload carries two segments')
assert(payload && payload.segments[0].url === '/startup-cyrene/media/clip1.mp4', 'segment 1 url points at the media route')
assert(payload && payload.segments[1].url === '/startup-cyrene/media/clip2.mp4', 'segment 2 url points at the media route')
assert(payload && typeof payload.clickSkipsTo === 'number', 'config payload carries clickSkipsTo')

assert(injected.length === 1, 'subscribes to webserver/index-inject once')

const table = []
injected[0](table)
assert(table.length === 1, 'pushes exactly one injection row')
const row = table[0] || {}
assert(row.kind === 'script', 'row is a classic inline script')
assert(row.placement === 'head', 'row is placed in head')
assert(typeof row.text === 'string' && row.text.includes('cyrene-loading'), 'row text defines the overlay')
assert(row.text.includes('/startup-cyrene/media/clip1.mp4'), 'row text references clip1')
assert(row.text.includes('"clickSkipsTo"'), 'row text embeds the click target')

const again = []
injected[0](again)
assert(again.length === 1, 'each render gets its own row (no shared state)')

assert(effects.length === 4, 'registers four effects (three routes + injection)')
assert(effects.every((d) => typeof d === 'function'), 'each effect returns a disposer')

for (const dispose of effects) {
  try {
    dispose()
  } catch (err) {
    failures++
    console.log('FAIL disposer threw: ' + (err && err.message))
  }
}

console.log(failures === 0 ? '\nALL PASS' : '\n' + failures + ' FAILED')
process.exit(failures === 0 ? 0 : 1)
