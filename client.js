/**
 * dsh-startup-cyrene —— Browser half.
 *
 * 注册 `shell.overlay`，在首屏渲染时铺一层全屏视频遮罩：
 * 按 Host 给的片段列表顺序播放，点击可跳到指定段，播完淡出。
 *
 * 为什么要有这一半：新版宿主（0.2.1+）的桌面窗口不再走 `webServer.tapIndex`
 * 注入的 HTML，字符串注入能写进响应却到不了窗口。客户端插件由宿主的模块系统
 * 加载，是官方支持的路径。
 *
 * 兼容约定：遮罩 id `#cyrene-loading`、事件 `cyrene-loading-done`，
 * 以及 `window.__cyreneLoadingDone`——`dsh-cyrene-whale-widget` 认这些标记。
 */
window.__ModuleLoader__.load({
  id: 'dsh-startup-cyrene',
  factory(require) {
    const React = require('react')
    const ReactDOM = require('react-dom')
    const h = React.createElement
    const { useCallback, useEffect, useRef, useState } = React

    const SLOT_OVERLAY = 'shell.overlay'
    const CONFIG_URL = '/startup-cyrene/config.json'
    const OVERLAY_ID = 'cyrene-loading'

    // 无 devtools 时的定位手段：每走一步给 Host 打一次卡。
    function beat(stage) {
      try {
        fetch('/startup-cyrene/beat?stage=' + encodeURIComponent(stage), { cache: 'no-store' }).catch(() => {})
      } catch (err) {}
    }

    const OVERLAY_CSS = [
      '#cyrene-loading{position:fixed;inset:0;z-index:2147483647;background:#0b0610;',
      'display:flex;align-items:center;justify-content:center;',
      'transition:opacity 900ms ease;opacity:1;cursor:pointer}',
      '#cyrene-loading.cyrene-out{opacity:0;pointer-events:none}',
      '#cyrene-loading video{width:100%;height:100%;object-fit:cover;background:#0b0610;display:block}',
    ].join('')

    function SplashOverlay() {
      const [src, setSrc] = useState(null)
      const [fading, setFading] = useState(false)
      const [hidden, setHidden] = useState(false)
      const cfgRef = useRef(null)
      const idxRef = useRef(0)
      const videoRef = useRef(null)
      const guardRef = useRef(null)
      const doneRef = useRef(false)
      const startedRef = useRef(false)

      const finish = useCallback(() => {
        if (doneRef.current) return
        doneRef.current = true
        if (guardRef.current) {
          clearTimeout(guardRef.current)
          guardRef.current = null
        }
        try {
          window.__cyreneLoadingDone = true
          window.__dshStartupCyreneDone = true
        } catch (err) {}
        try { window.dispatchEvent(new Event('cyrene-loading-done')) } catch (err) {}
        try { window.dispatchEvent(new Event('dsh-startup-cyrene-done')) } catch (err) {}
        beat('finish')
        const fadeMs = cfgRef.current && cfgRef.current.fadeMs ? cfgRef.current.fadeMs : 900
        setFading(true)
        setTimeout(() => setHidden(true), fadeMs + 150)
      }, [])

      const goTo = useCallback((next) => {
        const cfg = cfgRef.current
        if (!cfg || doneRef.current) return
        if (!cfg.segments || next >= cfg.segments.length) {
          finish()
          return
        }
        idxRef.current = next
        setSrc(cfg.segments[next].url)
      }, [finish])

      const armGuard = useCallback((index) => {
        const cfg = cfgRef.current
        if (!cfg || doneRef.current) return
        if (guardRef.current) clearTimeout(guardRef.current)
        guardRef.current = setTimeout(() => {
          guardRef.current = null
          if (doneRef.current) return
          const v = videoRef.current
          const alive = v && v.readyState >= 2 && v.currentTime > 0.02
          if (!alive) goTo(index + 1)
        }, cfg.guardMs || 2600)
      }, [goTo])

      // 1) 读取配置并起播第一段
      useEffect(() => {
        if (startedRef.current) return
        startedRef.current = true
        let cancelled = false
        fetch(CONFIG_URL, { cache: 'no-store' })
          .then((res) => (res && res.ok ? res.json() : null))
          .then((cfg) => {
            if (cancelled) return
            if (!cfg || cfg.enabled === false || !Array.isArray(cfg.segments) || !cfg.segments.length) {
              beat('bail segments=' + (cfg && cfg.segments ? cfg.segments.length : 'none'))
              setHidden(true)
              return
            }
            beat('config n=' + cfg.segments.length)
            cfgRef.current = cfg
            goTo(0)
            const total = cfg.totalTimeoutMs || 60000
            setTimeout(() => { if (!doneRef.current) finish() }, total)
          })
          .catch(() => {
            beat('config-failed')
            if (!cancelled) setHidden(true)
          })
        return () => { cancelled = true }
      }, [finish, goTo])

      // 2) 换段：设音量 → 播放 → 挂守卫
      useEffect(() => {
        if (!src || doneRef.current) return
        const cfg = cfgRef.current
        const v = videoRef.current
        if (!v) return
        const seg = cfg && cfg.segments ? cfg.segments[idxRef.current] : null
        try {
          v.muted = false
          v.volume = seg && typeof seg.volume === 'number' ? seg.volume : 1
        } catch (err) {}
        try {
          const p = v.play()
          if (p && typeof p.catch === 'function') {
            p.catch(() => {
              try { v.muted = true; v.play() } catch (err) {}
            })
          }
        } catch (err) {}
        armGuard(idxRef.current)
        beat('play idx=' + idxRef.current)
      }, [src, armGuard])

      // 3) 事件：收尾淡出、换段、点击跳段
      const onEnded = useCallback(() => goTo(idxRef.current + 1), [goTo])
      const onError = useCallback(() => goTo(idxRef.current + 1), [goTo])
      const onPlaying = useCallback(() => {
        if (guardRef.current) {
          clearTimeout(guardRef.current)
          guardRef.current = null
        }
      }, [])
      const onTimeUpdate = useCallback(() => {
        const cfg = cfgRef.current
        const v = videoRef.current
        if (!cfg || !v) return
        const configured = (cfg.audioFadeMs || 0) / 1000
        if (configured <= 0) return
        const d = v.duration
        // 元数据还没到时 duration 是 NaN/0：此时算出来的 left 是负数，
        // 会把音量直接摁到 0 并且再也回不来——这就是「声音只有一瞬间」的原因。
        if (!Number.isFinite(d) || d <= 0) return
        // 短片段（如 3 s 的第二段）按比例收尾，避免一开口就开始淡出。
        const fadeSec = Math.min(configured, Math.max(0.2, d * 0.3))
        const left = d - v.currentTime
        if (left <= 0) return
        if (left <= fadeSec) {
          try { v.volume = Math.max(0, Math.min(1, left / fadeSec)) } catch (err) {}
        }
      }, [])
      const onPress = useCallback(() => {
        const cfg = cfgRef.current
        if (!cfg || doneRef.current) return
        const target = cfg.clickSkipsTo
        if (target === null || typeof target !== 'number') return
        if (target <= idxRef.current) return
        goTo(target)
      }, [goTo])

      if (hidden) return null

      const node = h(
        'div',
        {
          id: OVERLAY_ID,
          className: fading ? 'cyrene-out' : '',
          onPointerDown: onPress,
        },
        h('style', { dangerouslySetInnerHTML: { __html: OVERLAY_CSS } }),
        src
          ? h('video', {
            ref: videoRef,
            src,
            autoPlay: true,
            playsInline: true,
            preload: 'auto',
            onEnded,
            onError,
            onPlaying,
            onTimeUpdate,
          })
          : null,
      )

      // 挂到 body 根节点：slot 容器自带层叠上下文，直接渲染会被挂件等 body 级元素压住。
      try {
        if (typeof document !== 'undefined' && document.body) {
          return ReactDOM.createPortal(node, document.body)
        }
      } catch (err) {}
      return node
    }

    const inject = ['slots']

    function apply(ctx) {
      // 若字符串注入那条老路径已经跑过（老宿主），就别再叠一层
      try {
        if (window.__dshStartupCyrene) return
        window.__dshStartupCyrene = 1
      } catch (err) {}

      ctx.slots.inject(SLOT_OVERLAY, () =>
        ctx.slots.register(
          {
            name: SLOT_OVERLAY,
            id: 'dsh-startup-cyrene',
            order: 1000,
            label: () => '启动开屏',
          },
          SplashOverlay,
        ),
      )
    }

    return { inject, apply }
  },
})
