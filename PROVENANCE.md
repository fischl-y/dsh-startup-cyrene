# 素材来源与许可范围（PROVENANCE）

本插件的**代码**按 MIT 许可（见 [`LICENSE`](LICENSE)）。`assets/` 下的**视频素材**不在 MIT 覆盖范围内，
按「原样提供（as-is）」随包分发，仅用于运行本插件。

## 一、许可范围

| 范围 | 许可 |
| --- | --- |
| `lib/`、`client.js`、`cordis.patch.yml`、`package.json`、文档 | **MIT** |
| `assets/clip1.mp4` | **不适用 MIT**：来自上游 `sailina-afk/cyrene-balance-widget`（MIT 代码）附带的开屏视频，原样转载，不授予再许可 |
| `assets/clip2.mp4` | **不适用 MIT**：由使用者自行提供的 `222_1.mp4`，对外分发前请自行确认权利状态 |

## 二、说明

- 代码部分可以明确授权；视频素材的来源与权利状态无法完整举证，因此如实标注范围，不做扩大授权。
- 下载者可以自由替换 `assets/*.mp4` 为自己的素材：只要保持文件名不变（或同步修改
  `~/.dsh/startup-cyrene.json` 里的 `segments[].file`），插件行为完全不变。
- 若你是素材权利人并认为此处使用不当，请通过仓库 issue 说明文件名与依据，会立即替换或移除。

## 三、替换素材

```bash
# 用同名文件覆盖即可，无需改代码
copy your-opening.mp4 "%USERPROFILE%\.dsh\profiles\desktop\node_modules\dsh-startup-cyrene\assets\clip1.mp4"
```

或改配置指向别的文件名（文件仍需位于包内 `assets/`）：

```json
{ "segments": [{ "file": "your-opening.mp4", "volume": 1 }] }
```
