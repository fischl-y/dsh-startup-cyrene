// 离线状态机测试：不启动浏览器，用桩对象驱动 renderSplashScript() 生成的脚本。
// 运行：node test/splash-script.test.mjs
import vm from 'node:vm'
import { renderSplashScript } from '../lib/script.js'

const BASE = {
  fadeMs: 900,
  audioFadeMs: 2200,
  guardMs: 2600,
  totalTimeoutMs: 60000,
  clickSkipsTo: 1,
  segments: [
    { file: 'clip1.mp4', volume: 1 },
    { file: 'clip2.mp4', volume: 1 },
  ],
}

function harness(config) {
  const code = renderSplashScript(config)
  new Function(code) // 语法自检

  const events = new Map()
  const log = { src: [], loads: 0, classes: [], dispatched: [] }
  const on = (target, type, fn) => {
    const key = target + ':' + type
    if (!events.has(key)) events.set(key, [])
    events.get(key).push(fn)
  }
  const off = (target, type, fn) => {
    const arr = events.get(target + ':' + type) || []
    const i = arr.indexOf(fn)
    if (i >= 0) arr.splice(i, 1)
  }

  const video = {
    _src: '',
    volume: 1,
    muted: false,
    autoplay: true,
    playsInline: true,
    preload: '',
    readyState: 0,
    currentTime: 0,
    duration: 0,
    parentNode: null,
    addEventListener(type, fn) { on('video', type, fn) },
    removeEventListener(type, fn) { off('video', type, fn) },
    setAttribute() {},
    get src() { return this._src },
    set src(v) { this._src = v; log.src.push(v) },
    play() { return undefined },
    pause() {},
    load() { log.loads++ },
  }

  function makeDiv() {
    return {
      id: '',
      parentNode: null,
      style: { cssText: '' },
      classList: { add(c) { log.classes.push(c) } },
      addEventListener(type, fn) { on('box', type, fn) },
      removeEventListener(type, fn) { off('box', type, fn) },
      appendChild(node) { node.parentNode = this },
    }
  }
  const divs = []
  const box = makeDiv()
  divs.push(box)

  const doc = {
    head: { appendChild() {} },
    documentElement: { appendChild() {} },
    body: { appendChild(node) { node.parentNode = doc.body } },
    createElement(tag) {
      if (tag === 'style') return { textContent: '' }
      if (tag === 'div') {
        const el = makeDiv()
        divs.push(el)
        return el
      }
      if (tag === 'video') return video
      return { appendChild() {} }
    },
    addEventListener() {},
    removeEventListener() {},
  }

  const win = {
    addEventListener(type, fn) { on('window', type, fn) },
    dispatchEvent(ev) { log.dispatched.push(ev && ev.type) },
  }

  const timers = []
  const sandbox = {
    window: win,
    document: doc,
    Event: class Event { constructor(type) { this.type = type } },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length },
    clearTimeout: () => {},
    Math,
    console,
  }

  vm.runInNewContext(code, sandbox)
  const fire = (target, type) => {
    for (const fn of [...(events.get(target + ':' + type) || [])]) fn({ type })
  }
  return { video, box, win, log, fire }
}

let failures = 0
function runCase(name, config, steps) {
  const h = harness(config)
  const errs = []
  const assert = (cond, msg) => { if (!cond) errs.push(msg) }
  try {
    steps(h, assert)
  } catch (err) {
    errs.push('threw: ' + (err && err.message))
  }
  if (errs.length) {
    failures++
    console.log('FAIL ' + name)
    for (const e of errs) console.log('   - ' + e)
    return
  }
  console.log('PASS ' + name)
}

const URL1 = '/startup-cyrene/media/clip1.mp4'
const URL2 = '/startup-cyrene/media/clip2.mp4'

runCase('不点击：两段连播后结束', BASE, (h, assert) => {
  assert(h.video.src === URL1, 'first src should be clip1, got ' + h.video.src)
  h.fire('video', 'playing')
  h.fire('video', 'ended')
  assert(h.video.src === URL2, 'after clip1 ended src should be clip2, got ' + h.video.src)
  assert(h.win.__cyreneLoadingDone !== true, 'must not finish before last segment ends')
  h.fire('video', 'playing')
  h.fire('video', 'ended')
  assert(h.win.__cyreneLoadingDone === true, 'done flag should be set')
  assert(h.log.dispatched.includes('cyrene-loading-done'), 'compat event should fire')
  assert(h.log.dispatched.includes('dsh-startup-cyrene-done'), 'own event should fire')
})

runCase('第一段点击：立刻跳到第二段', BASE, (h, assert) => {
  h.fire('video', 'playing')
  h.fire('box', 'pointerdown')
  assert(h.video.src === URL2, 'click should jump to clip2, got ' + h.video.src)
  h.fire('video', 'playing')
  h.fire('box', 'pointerdown') // 第二段点击不应再跳
  assert(h.video.src === URL2, 'click on last segment must be ignored')
  h.fire('video', 'ended')
  assert(h.win.__cyreneLoadingDone === true, 'should finish after last segment')
})

runCase('第一段解码失败：跳到第二段', BASE, (h, assert) => {
  h.fire('video', 'error')
  assert(h.video.src === URL2, 'error on clip1 should advance, got ' + h.video.src)
  assert(h.win.__cyreneLoadingDone !== true, 'must not finish on first-segment error')
})

runCase('最后一段解码失败：结束而不是卡住', BASE, (h, assert) => {
  h.fire('video', 'ended')
  h.fire('video', 'error')
  assert(h.win.__cyreneLoadingDone === true, 'last-segment error must finish')
})

runCase('单段配置：播完即结束', { ...BASE, segments: [{ file: 'clip1.mp4', volume: 1 }] }, (h, assert) => {
  assert(h.video.src === URL1, 'single segment src')
  h.fire('video', 'playing')
  h.fire('video', 'ended')
  assert(h.win.__cyreneLoadingDone === true, 'single segment should finish')
  assert(h.video.src === URL1, 'no second source should load')
})

runCase('clickSkipsTo=null：点击无效', { ...BASE, clickSkipsTo: null }, (h, assert) => {
  h.fire('video', 'playing')
  h.fire('box', 'pointerdown')
  assert(h.video.src === URL1, 'click must be ignored when clickSkipsTo is null')
})

runCase('三段配置：逐段推进', {
  ...BASE,
  clickSkipsTo: 2,
  segments: [{ file: 'a.mp4', volume: 1 }, { file: 'b.mp4', volume: 1 }, { file: 'c.mp4', volume: 1 }],
}, (h, assert) => {
  assert(h.video.src === '/startup-cyrene/media/a.mp4', 'first of three')
  h.fire('video', 'playing')
  h.fire('video', 'ended')
  assert(h.video.src === '/startup-cyrene/media/b.mp4', 'second of three')
  h.fire('video', 'playing')
  h.fire('video', 'ended')
  assert(h.video.src === '/startup-cyrene/media/c.mp4', 'third of three')
  h.fire('video', 'ended')
  assert(h.win.__cyreneLoadingDone === true, 'three segments finish')
})

console.log(failures === 0 ? '\nALL PASS' : '\n' + failures + ' FAILED')
process.exit(failures === 0 ? 0 : 1)
