# widget-patch —— 让余额挂件的问候等开屏结束

`dsh-cyrene-whale-widget-noanim`（上游免动画版余额挂件）在页面加载约 0.7 秒后就会播问候语音，
和 `dsh-startup-cyrene` 的开屏重叠。这里提供一个**十来行的兼容补丁**：检测到 `#cyrene-loading`
（本插件的遮罩）就等 `cyrene-loading-done` 事件，再延后 2.5 秒才问好；没有开屏时行为不变。

## 目录内容

| 文件 | 说明 |
| --- | --- |
| `whale-widget.cyrene.1.js` | 打过补丁的 `assets/whale-widget.js`（1.1 MB，直接覆盖用） |
| `patch.ps1` | 一键应用 / 回滚补丁的脚本 |
| 同仓库 `release/dsh-cyrene-whale-widget-noanim-2.0.0+cyrene.1.tgz` | 已经打好补丁的**整包**，不想手动打补丁就装这个 |

## 方式一：脚本打补丁（推荐）

```powershell
# 先完全退出客户端
powershell -ExecutionPolicy Bypass -File .\widget-patch\patch.ps1

# 看一眼不做改动
powershell -ExecutionPolicy Bypass -File .\widget-patch\patch.ps1 -DryRun

# 还原
powershell -ExecutionPolicy Bypass -File .\widget-patch\patch.ps1 -Uninstall
```

需要非默认 profile 时加 `-Profile <名字>`；挂件装在其他路径时用 `-Path <目录>`。

脚本会先把原文件备份成 `whale-widget.js.bak-cyrene`，再覆盖；重复运行会识别「已打过补丁」并跳过。

## 方式二：装打好补丁的整包

```powershell
# 先完全退出客户端
dsh plugin --profile desktop add "file:<...>/dsh-cyrene-whale-widget-noanim-2.0.0+cyrene.1.tgz"
```

（这会替换现有的挂件包；和 `dsh-cyrene-whale-widget` 带动画版互斥，同一时间只能留一个。）

## 改了什么

在 `cyreneGreeting()` 里，把原本「加载后 0.7 秒直接问好」拆成 `start()` 函数，并加一段门控：

```js
var loadingEl = document.getElementById('cyrene-loading')
if (loadingEl) {
  window.addEventListener('cyrene-loading-done', () => setTimeout(start, 2500), { once: true })
  setTimeout(() => { /* 兜底 45 s */ setTimeout(start, 2500) }, 45000)
  return
}
setTimeout(start, 700)   // 没有开屏时保持原样
```

除这一处外，挂件其余行为、素材、路由都没有改动。

## 注意

- 这是对**第三方包内部文件**的修改：重新安装/升级挂件会把它覆盖回去，需要重新打补丁（整包方式则不会）。
- 上游是 MIT 代码、素材按 as-is 分发；本补丁只改行为、不改素材，也不重新授权任何素材。
- 如果上游以后自己支持了这个约定，直接卸掉补丁即可。
