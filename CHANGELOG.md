# 变更记录

> 已弃用版本的 tgz 以清理掉了，但决定性的源码（`client.js` / `config.js` / `script.js`）留在
> `archive/0.2.4/` 与 `archive/0.2.5/`，想看当时的实现不用重打整包。
> 当前可安装包只有 `dist/dsh-startup-cyrene-0.2.3.tgz`。

## 0.2.5 —— 已弃用（观感被否决）

- 遮罩顶部加 40px 黑条 + 36px 渐变，让 Electron 原生窗口按钮（`titleBarOverlay`，高 40px）落在同色黑条上。
- 实测观感「太怪」：黑条与视频之间的分界比原生按钮本身更显眼，用户决定回滚。

## 0.2.4 —— 已弃用（不可行）

- 开屏期间尝试 `document.documentElement.requestFullscreen()`，指望全屏隐藏原生窗口按钮。
- 结论：原生按钮由 Electron 主进程以 `titleBarOverlay` 绘制，DOM/CSS 无法覆盖；全屏是唯一杠杆，但启动时无用户手势，被策略拒绝是常态，且窗口状态突变体验差。已回滚。

## 0.2.3 —— 当前版本

- 修：元数据未就绪时 `duration` 为 `NaN`，淡出计算把音量直接压到 0，导致「声音只响一瞬」。
- 淡出改为 `min(audioFadeMs, 时长 × 0.3)`，短片段（3 s）不再一开口就变小声。
- 客户端遮罩改用 `ReactDOM.createPortal` 挂到 `body`，不再被 slot 层叠上下文压住（余额挂件曾盖在开屏上）。

## 0.2.2

- 修：pnpm 安装被 `EPERM` 中断时 `assets/` 被清空，客户端读到 0 个片段后静默退出（表现为「开屏消失」）。
- 新增 `beat` 打卡路由（`config` / `play` / `finish`），便于无 devtools 时定位。

## 0.2.1

- 注入从 `tapIndex` 字符串改写改为结构化注入行（`webserver/index-inject`）——新版桌面窗口只吃行表，不吃 tap。

## 0.2.0

- 首次可用：新增客户端半（`shell.overlay` 注册）+ `/startup-cyrene/config.json`。

## 0.1.x —— 已弃用（注入路径不生效）

- 纯 host 半，靠 `tapIndex` 往 HTML 里塞 `<script>`；服务端写入成功，但窗口并不加载被改写的 HTML，因此始终不显示。
