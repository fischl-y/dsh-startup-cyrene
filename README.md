# dsh-startup-cyrene

A configurable Cyrene-style startup splash for [DeepSeek Harness](https://github.com/deepseek-ai): plays an
ordered list of local video segments at boot, lets a click jump ahead, then fades into the workbench.

- **Multi-segment** — two clips by default (`loading.mp4`, 13.9 s → `222_1.mp4`, ~3 s); 1–5 configurable.
- **Click to skip ahead** — clicking during an early segment jumps straight to the configured target;
  clicks on the last segment are ignored.
- **Audio** — each segment fades out over its last 2.2 s; blocked autoplay falls back to muted playback
  instead of a frozen screen.
- **Fail-safes** — a 2.6 s start guard per segment and a global 60 s hard release.
- **Host-only** — one injected script plus a Range-capable media route; no client build step.

## Install

Quit DeepSeek Harness **completely** first (the desktop app composes its plugin tree at boot; installing while
it runs can fail with `EPERM` on the plugin directory).

```bash
# local directory
dsh plugin --profile desktop add <absolute path to this repo>

# local tarball
dsh plugin --profile desktop add file:<...>/dsh-startup-cyrene-0.1.0.tgz

# GitHub over SSH
dsh plugin --profile desktop add git+ssh://git@github.com/<user>/dsh-startup-cyrene.git

# GitHub when git over HTTPS is blocked (codeload tarball)
dsh plugin --profile desktop add https://codeload.github.com/<user>/dsh-startup-cyrene/tar.gz/<sha>
```

Restart the client afterwards — that is all; no further command is needed.

If you later want to **remove** the plugin (optional), quit the client first and run:

```bash
dsh plugin --profile desktop remove dsh-startup-cyrene
```

## Configuration

`~/.dsh/startup-cyrene.json` (built-in defaults apply when the file is missing):

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
| `enabled` | `false` disables the splash entirely. |
| `fadeMs` | Overlay fade-out duration. |
| `audioFadeMs` | Per-segment audio fade length; `0` disables it. |
| `guardMs` | Per-segment start guard before the segment counts as undecodable. |
| `totalTimeoutMs` | Global hard release, no matter which segment stalls. |
| `clickSkipsTo` | Segment index a click jumps to (0-based); `null` disables click. |
| `segments[].file` | Must be an existing file in the package `assets/` (allow-list, blocks path traversal). |
| `segments[].volume` | 0–1. |

Invalid values fall back to defaults with a `console.warn`; the splash never blocks the UI.
`DSH_STARTUP_CYRENE_CONFIG` can point at an alternative JSON file (handy for testing).

## Interaction with other plugins

> **Better together with the balance widget.** This plugin only owns the *picture*; there is no audio at the end.
> The greeting line ("嗨，看见你在，真是令人开心") belongs to the balance widget `dsh-cyrene-whale-widget`
> (use the no-animation build `dsh-cyrene-whale-widget-noanim`): it detects `#cyrene-loading`, waits for the
> splash to finish, then plays the greeting 2.5 s later. Without the widget everything still works — you just
> miss that one sentence.
>
> ⚠️ The greeting uses its own `Audio` element, which some environments silently block under the browser's
> autoplay policy (a click on the page usually lets it play). "Picture but no greeting" is that policy, not a
> broken splash.

The overlay uses `#cyrene-loading` and dispatches `cyrene-loading-done` (plus `dsh-startup-cyrene-done`) while
setting `window.__cyreneLoadingDone`, so `dsh-cyrene-whale-widget` (no-animation build) waits for the splash
before playing its greeting.

**Only one splash source may be enabled per machine** — this plugin, the animated `dsh-cyrene-whale-widget`,
and `dsh-startup-intro` all mount a full-screen overlay, and enabling two of them stacks two overlays.

## Media

`assets/clip1.mp4` comes from the upstream `dsh-cyrene-whale-widget` (MIT) 2.0 opening; `assets/clip2.mp4` is
user-provided (`222_1.mp4`). Confirm redistribution rights before publishing.
