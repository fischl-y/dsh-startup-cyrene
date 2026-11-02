# dsh-startup-cyrene

给 **DeepSeek Harness** 加一段可配置的启动开屏：启动时全屏播放本地视频片段，播完淡出进工作台。
默认自带两段昔涟开场（13.9 s + 约 3 s）。

- **多段连播**：1–5 段，按配置顺序播放
- **点击跳段**：播放中点一下画面，立刻跳到指定段
- **声音**：每段收尾自动淡出；自动播放被拦时静音重试，不阻塞界面
- **兜底**：每段 2.6 s 起播守卫 + 整体 60 s 硬放行，任何异常都不会把界面锁死
- **配置热读**：改完配置重启客户端即生效，不必重装

---

## 安装

> **先完全退出客户端**（托盘图标右键退出，或任务管理器结束 `DeepSeek Harness.exe`）。
> 运行中安装会因文件占用失败（`EPERM`），严重时会把包的 `assets/` 清空。

**方式一：一键脚本（推荐）**

```powershell
# 在仓库根目录执行；它会先检查客户端是否已退出，再找 dsh 并安装
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

`-DryRun` 只打印不执行，`-Uninstall` 卸载，`-Ref main` 可跟随最新提交（默认钉在 `v0.2.6`）。

**方式二：直接从仓库安装（钉在 tag 上）**

```powershell
dsh plugin --profile desktop add "git+https://gitee.com/qyb7316/deepseek-the-rise-of-cyrene.git#v0.2.6"
```

`#v0.2.6` 是**版本锚点**：装上的一定是打这个 tag 的那份代码，不会随仓库后续提交漂移。
想升级就换 tag（如 `#v0.2.7`），想跟着 `main` 走可以去掉 `#` 后面那段（不推荐用于分享）。

**方式三：本地 tgz**

```powershell
# tgz 在 release/ 目录下；路径按实际位置改
dsh plugin --profile desktop add "file:D:\你的目录\dsh-startup-cyrene-0.2.6.tgz"
```

**装完重启客户端即可生效，不需要再执行任何命令。**

可选校验：

```powershell
Get-FileHash .\release\dsh-startup-cyrene-0.2.6.tgz -Algorithm SHA256
```

（卸载：先退出客户端，再 `dsh plugin --profile desktop remove dsh-startup-cyrene`。）

## 配置

默认无需配置。需要调整时写 `%USERPROFILE%\.dsh\startup-cyrene.json`：

```json
{
  "enabled": true,
  "fadeMs": 900,
  "audioFadeMs": 2200,
  "guardMs": 2600,
  "totalTimeoutMs": 60000,
  "clickSkipsTo": 1,
  "segments": [
    { "file": "clip1.mp4", "volume": 1 },
    { "file": "clip2.mp4", "volume": 1 }
  ]
}
```

| 字段 | 说明 |
| --- | --- |
| `enabled` | `false` 关闭开屏 |
| `fadeMs` | 结束时淡出时长（毫秒） |
| `audioFadeMs` | 每段收尾音量淡出上限；实际取 `min(该值, 时长 × 0.3)`，`0` 表示不淡出 |
| `guardMs` | 每段起播守卫：超时仍未起播就当作解不了 |
| `totalTimeoutMs` | 整体硬放行，无论卡在哪一段都会结束 |
| `clickSkipsTo` | 点击跳到第几段（0 起）；`null` = 点击无效 |
| `segments[].file` | 包内 `assets/` 下的文件名（白名单校验，防路径穿越） |
| `segments[].volume` | 0–1 |

写错只会回退默认值并在控制台留一条警告，不会白屏。`DSH_STARTUP_CYRENE_CONFIG` 可指向另一份 JSON。

### 换成自己的视频

```powershell
# 同名覆盖（保持文件名不变最省事）
copy your-opening.mp4 "%USERPROFILE%\.dsh\profiles\desktop\node_modules\dsh-startup-cyrene\assets\clip1.mp4"
```

也可以改配置里的 `segments[].file` 指向 `assets/` 下的其他文件名。建议 H.264 + AAC 的 mp4。

## 与其它插件的关系

**搭配余额挂件使用效果更好（但有前提）**：本插件只管画面，片尾没有配音；那句问候语音属于
`dsh-cyrene-whale-widget`：

- **带动画版**：原生会等开屏结束再问好，但它自带开屏，不能与本插件共存；
- **免动画版**（上游原版）：**没有**等待逻辑，会在页面加载约 0.7 s 后直接问候，可能与开屏重叠；
- **免动画版 + [`widget-patch/`](widget-patch/README.md)**：识别开屏并延后问候，一键打补丁。

本插件的遮罩 id 是 `#cyrene-loading`，结束时派发 `cyrene-loading-done`（以及 `dsh-startup-cyrene-done`）
并设置 `window.__cyreneLoadingDone`。这些名字沿用上游带动画版的约定，方便愿意配合的挂件延后问候——
本插件不包含、也不调用挂件的任何代码。

⚠️ **同一台机器只能有一个开屏来源**：本插件、带动画版 `dsh-cyrene-whale-widget`、`dsh-startup-intro`
都会挂全屏遮罩，同时启用会叠出两层。

## 常见问题

| 现象 | 原因与处理 |
| --- | --- |
| 安装报 `EPERM ... rename` | 客户端还在运行，先完全退出再重试 |
| 装了但没开屏 | 是否还有别的开屏插件在跑；客户端版本是否支持客户端插件与首屏注入 |
| 只有画面没有问候 | 问候属于余额挂件，且走独立 `Audio`，可能被自动播放策略拦下（点一下画面常能补播） |
| 右上角窗口按钮压在画面上 | 那是 Electron 原生 `titleBarOverlay`，DOM 盖不住，属平台限制 |

## 开发

```bash
node test/splash-script.test.mjs   # 客户端脚本状态机（7 例）
node test/plugin-apply.test.mjs    # 宿主半注册与注入（16 项断言）
```

实现要点：宿主半（`lib/`）负责读配置、提供带 Range 的媒体路由，并通过宿主的**结构化首屏注入行**
（`webserver/index-inject`）把脚本写进窗口 HTML；客户端半（`client.js`）注册 `shell.overlay` 作为后备。
两条路径用 `window.__dshStartupCyrene` 互斥，不会叠两层。

## 版本与锚点

每次发布都会打一个 `vX.Y.Z` tag，`package.json` 的 `version` 与 tag 保持一致。

| 安装方式 | 锚点 | 可复现 |
| --- | --- | --- |
| `git+…git#v0.2.6` | git tag | ✅ 拿到的一定是该 tag 的代码 |
| `file:…dsh-startup-cyrene-0.2.6.tgz` | 文件内容（可用 SHA256 校验） | ✅ |
| `git+…git`（无 `#`） | 仓库 HEAD，浮动 | ❌ 不同时间装到不同内容 |
| 本地目录 | 你的工作区 | ❌ |

升级：把命令里的 tag 换成新的（如 `#v0.2.7`）重新 `add` 即可；降级同理。
`pnpm-lock.yaml` 会记住实际解析到的 commit，`dsh plugin install` 会按它还原。

## 许可与素材

- **代码**（`lib/`、`client.js`、配置、脚本）：MIT，见 [LICENSE](LICENSE)。
- **视频素材**（`assets/*.mp4`）：不适用 MIT，按 as-is 随包分发，可自行替换，详见 [PROVENANCE.md](PROVENANCE.md)。

## 变更记录

见 [CHANGELOG.md](CHANGELOG.md)。
