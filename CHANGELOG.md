# 变更记录

> 当前可安装包在 `release/`：`dsh-startup-cyrene-0.2.6.tgz`（开屏插件）与
> `dsh-cyrene-whale-widget-noanim-2.0.0+cyrene.1.tgz`（配合用的挂件整包）。
> 已弃用版本的源码不再随仓库保留，原因与结论都记在下面，需要复现可照条目重写。

## 镜像（文档）

- 新增 GitHub 镜像 `github.com/fischl-y/dsh-startup-cyrene`，与 Gitee 主仓库内容一致（同一批 commit 与 `v0.2.6` tag）。
- README（中英）与 `安装说明.md` 补上镜像安装命令；README 新增「仓库镜像」一节，写明两个远端与同步命令。
- 本地仓库新增 `github` 远端；`main` 的 upstream 仍是 `origin/main`（默认推送目标仍是 Gitee）。

## 版本锚点（文档 + 脚本）

- 每次发布打 `vX.Y.Z` tag，与 `package.json` 的 `version` 一致；首个 tag 为 `v0.2.6`。
- 文档里的仓库安装命令改为钉 tag：`git+…git#v0.2.6`；无 `#` 的写法会随 HEAD 漂移，已在 README 标注。
- `install.ps1` 新增 `-Ref`（默认 `v0.2.6`）：从仓库安装时默认钉 tag，`-Ref main` 可跟随最新提交。
- README（中英）新增「版本与锚点」一节，列明四种安装方式各自的可复现性。

## 仓库整理（文档，不影响版本号）

- 移除 `archive/`（0.2.4 / 0.2.5 的实验源码）与本地 `dist/`，仓库只留可发布内容。
- 重写 `README.md` / `README.zh-CN.md`：安装方式以一键脚本优先、配置表补全、常见问题独立成节、
  兼容说明（`cyrene-loading` 约定）与实际行为对齐。
- `安装说明.md` 收敛为「快速上手」单页，详细内容指向 README，避免多份文档互相漂移。

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
