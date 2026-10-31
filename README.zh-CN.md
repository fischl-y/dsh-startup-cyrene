# dsh-startup-cyrene

昔涟式启动开屏插件，给 [DeepSeek Harness](https://github.com/deepseek-ai) 加一个可配置的全屏开场：
按顺序播放本地视频片段，播完（或点击跳段）后淡出进工作台。

- **多段连播**：默认两段（`loading.mp4` 13.9 s → `222_1.mp4` 约 3 s），可配置 1–5 段。
- **点击跳段**：第一段播放中点击画面，立刻跳到配置的下一段；最后一段点击无效。
- **声音**：每段最后 2.2 s 音量线性淡出；自动播放被拦时静音重试，不阻塞界面。
- **兜底**：每段有 2.6 s 起播守卫（解不了就跳段/结束），整体 60 s 硬放行。
- **配置热读**：每次注入首屏时重新读配置，改完重启客户端即生效，不必重装。
- **纯 host 实现**：只注入一段脚本 + 两个视频路由，不需要客户端构建。

## 安装

先把 DeepSeek Harness **完全退出**（桌面版的插件树在启动时组装，运行中装会因目录被占用而中断）。

```bash
# 本地目录
dsh plugin --profile desktop add <本仓库绝对路径>

# 本地 tgz
dsh plugin --profile desktop add file:<...>/dsh-startup-cyrene-0.1.0.tgz

# GitHub（SSH）
dsh plugin --profile desktop add git+ssh://git@github.com/<user>/dsh-startup-cyrene.git

# GitHub（git over HTTPS 被墙时，走 codeload tarball）
dsh plugin --profile desktop add https://codeload.github.com/<user>/dsh-startup-cyrene/tar.gz/<sha>
```

装完**重启客户端**即可生效——这一步不需要再跑任何命令。

日后如果想**移除本插件**（不是必须的），先退出客户端，再：

```bash
dsh plugin --profile desktop remove dsh-startup-cyrene
```

## 配置

`~/.dsh/startup-cyrene.json`（不存在时用内置默认）：

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
| `enabled` | `false` 时完全不注入。 |
| `fadeMs` | 结束时遮罩淡出时长。 |
| `audioFadeMs` | 每段收尾时的音量淡出时长，`0` 表示不淡出。 |
| `guardMs` | 每段起播守卫；超时仍未起播就当作解不了。 |
| `totalTimeoutMs` | 整体硬放行，无论卡在哪一段都会结束。 |
| `clickSkipsTo` | 点击要跳到第几段（0 起）；`null` = 点击无效。 |
| `segments[].file` | 必须是包内 `assets/` 下真实存在的文件名（白名单，防路径穿越）。 |
| `segments[].volume` | 0–1。 |

任何字段写错都只会回退默认值并打一条 `console.warn`，不会锁白屏。
环境变量 `DSH_STARTUP_CYRENE_CONFIG` 可指向另一份 JSON（测试用）。

## 与其它插件的关系

> **搭配余额挂件使用效果更好（但有前提）。** 本插件只负责「开屏画面」，片尾没有声音。
> 那句「嗨，看见你在，真是令人开心」的问候语音属于余额挂件 `dsh-cyrene-whale-widget`：
>
> - **带动画版** `dsh-cyrene-whale-widget`：原生就会等开屏结束再问好——但它本身也带开屏，不能与本插件共存；
> - **免动画版** `dsh-cyrene-whale-widget-noanim`（上游原版）：**没有**等待逻辑，会在页面加载约 0.7 秒后
>   直接问候，可能与本开屏重叠。只有打了 `cyrene.1` 补丁的那份（识别 `#cyrene-loading` 并等
>   `cyrene-loading-done`）才会把问候推迟到开屏之后。
>
> 没装挂件也能正常用，只是少这一句问候。

- 兼容契约：本插件的遮罩 id 是 `#cyrene-loading`，结束时派发 `cyrene-loading-done`（以及
  `dsh-startup-cyrene-done`）并设置 `window.__cyreneLoadingDone`。这些名字沿用上游带动画版挂件的约定，
  目的是让「愿意配合的挂件」能把问候延后——本插件不包含、也不调用挂件的任何代码。
- 同一台机器上**只能有一个开屏来源**：本插件与带动画版 `dsh-cyrene-whale-widget`、`dsh-startup-intro`
  同时启用会叠出两层遮罩。装本插件前请先关掉/卸载另外两个。

## 素材

`assets/clip1.mp4` 来自上游 `dsh-cyrene-whale-widget`（MIT）的 2.0 开屏；`assets/clip2.mp4` 为用户提供的
`222_1.mp4`。公开分发前请确认素材授权。
