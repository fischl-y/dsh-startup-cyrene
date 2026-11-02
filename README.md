# dsh-startup-cyrene

A configurable **startup splash** for [DeepSeek Harness](https://github.com/deepseek-ai): at boot it plays one or
more local video segments full-screen, then fades into the workbench. Two Cyrene opening clips ship with it
(13.9 s + ~3 s).

- **Multi-segment** — 1–5 clips, played in the configured order
- **Click to jump** — clicking during playback jumps straight to a chosen segment
- **Audio** — each segment fades out at its tail; blocked autoplay falls back to muted playback
- **Fail-safes** — a 2.6 s start guard per segment plus a 60 s global release; nothing can lock the UI
- **Config re-read** — edits apply on the next client restart, no reinstall needed

---

## Install

> **Quit the client completely first** (tray → exit, or end `DeepSeek Harness.exe`).
> Installing while it runs fails with `EPERM` and can wipe the package's `assets/`.

**Option 1 — one-click script (recommended)**

```powershell
# run from the repository root; it checks the client is closed, locates dsh, then installs
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

`-DryRun` prints without executing; `-Uninstall` removes the plugin; `-Ref main` follows the newest commit
(the default is pinned to `v0.2.6`).

**Option 2 — install from the repository (pinned to a tag)**

```powershell
# primary (Gitee, fastest from mainland China)
dsh plugin --profile desktop add "git+https://gitee.com/qyb7316/deepseek-the-rise-of-cyrene.git#v0.2.6"

# mirror (GitHub, when GitHub is reachable)
dsh plugin --profile desktop add "git+https://github.com/fischl-y/dsh-startup-cyrene.git#v0.2.6"
```

`#v0.2.6` is the **version anchor**: you get exactly the code tagged `v0.2.6`, and later commits cannot
silently change it. Upgrade by switching the tag (e.g. `#v0.2.7`); drop the `#…` part to track `main`
(not recommended for sharing).

**Option 3 — local tarball**

```powershell
# the tarball lives in release/
dsh plugin --profile desktop add "file:D:\path\to\dsh-startup-cyrene-0.2.6.tgz"
```

**Restart the client afterwards — that is all; no further command is needed.**

Optional integrity check:

```powershell
Get-FileHash .\release\dsh-startup-cyrene-0.2.6.tgz -Algorithm SHA256
```

(To remove later: quit the client, then `dsh plugin --profile desktop remove dsh-startup-cyrene`.)

## Configuration

No configuration is required. To tune the splash, write `%USERPROFILE%\.dsh\startup-cyrene.json`:

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

| Field | Meaning |
| --- | --- |
| `enabled` | `false` disables the splash entirely |
| `fadeMs` | Overlay fade-out duration (ms) |
| `audioFadeMs` | Per-segment audio fade cap; the effective value is `min(this, duration × 0.3)`; `0` disables |
| `guardMs` | Per-segment start guard: if playback has not started by then, the segment counts as undecodable |
| `totalTimeoutMs` | Global hard release, no matter which segment stalls |
| `clickSkipsTo` | Segment index a click jumps to (0-based); `null` disables clicking |
| `segments[].file` | File name inside the package `assets/` (allow-listed, blocks path traversal) |
| `segments[].volume` | 0–1 |

Invalid values fall back to defaults with a console warning — the splash never blocks the UI.
`DSH_STARTUP_CYRENE_CONFIG` can point at an alternative JSON file.

### Use your own video

```powershell
# overwrite in place, keeping the same file name
copy your-opening.mp4 "%USERPROFILE%\.dsh\profiles\desktop\node_modules\dsh-startup-cyrene\assets\clip1.mp4"
```

Or point `segments[].file` at another file inside `assets/`. H.264 + AAC mp4 is the safest choice.

## Interaction with other plugins

**Better together with the balance widget (with one caveat)** — this plugin owns the *picture* only; the
greeting line belongs to `dsh-cyrene-whale-widget`:

- **Animated build**: already waits for the splash before greeting, but it ships its own splash and cannot
  coexist with this plugin;
- **No-animation build (upstream as-is)**: has **no** waiting logic and greets ~0.7 s after load, which may
  overlap this splash;
- **No-animation build + [`widget-patch/`](widget-patch/README.md)**: recognises the splash and defers the
  greeting — one command to apply.

The overlay id is `#cyrene-loading`; on finish this plugin dispatches `cyrene-loading-done` (plus
`dsh-startup-cyrene-done`) and sets `window.__cyreneLoadingDone`. Those names follow the upstream animated
widget's convention so a cooperating widget can defer its greeting. This plugin ships no widget code and calls
none of it.

⚠️ **Only one splash source may be enabled per machine** — this plugin, the animated
`dsh-cyrene-whale-widget`, and `dsh-startup-intro` all mount a full-screen overlay; enabling two stacks two.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `EPERM ... rename` during install | The client is still running — quit it completely and retry |
| Installed but no splash | Another splash plugin may own the overlay; check the client supports client plugins + index injection |
| Picture but no greeting | The greeting belongs to the balance widget and uses its own `Audio`; autoplay policy may block it (a click usually lets it play) |
| Window buttons drawn over the splash | That is Electron's native `titleBarOverlay`; DOM cannot cover it — platform limitation |

## Development

```bash
node test/splash-script.test.mjs   # client script state machine (7 cases)
node test/plugin-apply.test.mjs    # host half registration + injection (16 assertions)
```

How it works: the host half (`lib/`) reads config, serves Range-capable media routes, and injects the splash
script through the host's **structured index injection rows** (`webserver/index-inject`); the client half
(`client.js`) registers `shell.overlay` as a fallback. The two paths are mutually exclusive via
`window.__dshStartupCyrene`, so the overlay never mounts twice.

## Versioning and anchors

Every release gets a `vX.Y.Z` tag, kept in sync with `package.json`'s `version`.

| Install method | Anchor | Reproducible |
| --- | --- | --- |
| `git+…git#v0.2.6` | git tag | ✅ always the tagged code |
| `file:…dsh-startup-cyrene-0.2.6.tgz` | file contents (verify with SHA256) | ✅ |
| `git+…git` (no `#`) | repository HEAD, floating | ❌ different bytes at different times |
| local directory | your working tree | ❌ |

To upgrade, swap the tag in the command (e.g. `#v0.2.7`) and `add` again; downgrading works the same way.
`pnpm-lock.yaml` records the commit actually resolved, and `dsh plugin install` restores exactly that.

## Repository mirrors

| Remote | URL | Notes |
| --- | --- | --- |
| `origin` (primary) | `https://gitee.com/qyb7316/deepseek-the-rise-of-cyrene` | fast from mainland China; default push target |
| `github` (mirror) | `https://github.com/fischl-y/dsh-startup-cyrene` | requires GitHub reachability |

Both carry the same commits and the same `v0.2.6` tag. Maintainer sync:

```bash
git push origin main --follow-tags
git push github main --follow-tags
```

## License and media

- **Code** (`lib/`, `client.js`, config, scripts): MIT — see [LICENSE](LICENSE).
- **Video media** (`assets/*.mp4`): not covered by MIT, distributed as-is; replace freely — see
  [PROVENANCE.md](PROVENANCE.md).

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
