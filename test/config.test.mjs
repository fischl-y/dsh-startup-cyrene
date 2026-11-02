// 素材目录解析与配置校验测试：用户目录优先、包内 assets 兜底。
// 运行：node test/config.test.mjs
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { normalizeConfig, resolveMedia, userMediaDir } from '../lib/config.js'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsc-config-'))
const assets = path.join(root, 'assets')
const user = path.join(root, 'user-media')
fs.mkdirSync(assets, { recursive: true })
fs.mkdirSync(user, { recursive: true })

const write = (dir, name, bytes) => fs.writeFileSync(path.join(dir, name), Buffer.alloc(bytes))
write(assets, 'clip1.mp4', 10)
write(assets, 'clip2.mp4', 10)
write(user, 'my-opening.mp4', 20)
write(user, 'clip1.mp4', 30) // 同名：用户目录应当优先

let failures = 0
const assert = (cond, msg) => {
  if (cond) {
    console.log('PASS ' + msg)
  } else {
    failures++
    console.log('FAIL ' + msg)
  }
}

const dirs = [user, assets]

const explicit = normalizeConfig({ segments: [{ file: 'my-opening.mp4', volume: 1 }] }, dirs)
assert(explicit.segments.length === 1, 'explicit segment resolves from the user media dir')
assert(explicit.segments[0].file === 'my-opening.mp4', 'explicit segment keeps its file name')
assert(explicit.enabled === true, 'config with a resolvable segment is enabled')

const defaults = normalizeConfig({}, dirs)
assert(defaults.segments.length === 2, 'defaults resolve from the package assets dir')
assert(defaults.segments[0].file === 'clip1.mp4' && defaults.segments[1].file === 'clip2.mp4', 'defaults are clip1 + clip2')

const precedence = resolveMedia('clip1.mp4', dirs)
assert(precedence === path.join(user, 'clip1.mp4'), 'user media dir wins over the package assets dir')
assert(resolveMedia('clip2.mp4', dirs) === path.join(assets, 'clip2.mp4'), 'falls back to the package assets dir')

const bad = normalizeConfig({ segments: [{ file: '../evil.mp4' }, { file: 'missing.mp4' }, { file: 'my-opening.mp4' }] }, dirs)
assert(bad.segments.length === 1 && bad.segments[0].file === 'my-opening.mp4', 'unsafe or missing names are skipped')

const traversal = resolveMedia('../evil.mp4', dirs)
assert(traversal === null, 'path traversal is rejected')

const emptyDir = path.join(root, 'empty')
fs.mkdirSync(emptyDir, { recursive: true })
const empty = normalizeConfig({ segments: [{ file: 'nope.mp4' }] }, [emptyDir])
assert(empty.segments.length === 0 && empty.enabled === false, 'no resolvable media disables the splash')

assert(typeof userMediaDir() === 'string' && userMediaDir().includes('.dsh'), 'userMediaDir points inside the DSH home')

fs.rmSync(root, { recursive: true, force: true })

console.log(failures === 0 ? '\nALL PASS' : '\n' + failures + ' FAILED')
process.exit(failures === 0 ? 0 : 1)
