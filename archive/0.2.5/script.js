// 生成注入到首屏 <head> 的客户端脚本。
//
// 兼容性约定（与 src 里的旧挂件实现保持一致，方便其它插件协作）：
//   - 遮罩 id:            #cyrene-loading
//   - 淡出 class:         .cyrene-out
//   - 结束事件:           cyrene-loading-done（另发 dsh-startup-cyrene-done）
//   - 结束标记:           window.__cyreneLoadingDone / window.__dshStartupCyreneDone
// 因此 dsh-cyrene-whale-widget（免动画版）会等这个事件后再问好，不会和开屏抢声音。
//
// 环境限制：这段字符串会被当 JS 源码执行，CSS 里不能出现双引号，
// 所有内容必须是转义安全的单引号 JS 字面量。

const MEDIA_PREFIX = '/startup-cyrene/media/'

export function renderSplashScript(config) {
  const payload = {
    segments: (config.segments || []).map((s) => ({
      url: MEDIA_PREFIX + encodeURIComponent(s.file),
      volume: typeof s.volume === 'number' ? s.volume : 1,
    })),
    fadeMs: config.fadeMs,
    audioFadeMs: config.audioFadeMs,
    guardMs: config.guardMs,
    totalTimeoutMs: config.totalTimeoutMs,
    clickSkipsTo: config.clickSkipsTo,
    titlebarHeight: typeof config.titlebarHeight === 'number' ? config.titlebarHeight : 40,
  }
  const json = JSON.stringify(payload)

  return [
    '(function(){try{',
    'if(window.__dshStartupCyrene)return;',
    'var CFG=' + json + ';',
    'var SEG=CFG.segments||[];if(!SEG.length)return;',
    'if(!document||!document.createElement)return;',
    'window.__dshStartupCyrene=1;',
    'var st=document.createElement("style");',
    'st.textContent="#cyrene-loading{position:fixed;inset:0;z-index:2147483647;background:#0b0610;',
    'display:flex;align-items:center;justify-content:center;transition:opacity "+(CFG.fadeMs||0)+"ms ease;',
    'opacity:1;cursor:pointer}',
    '#cyrene-loading.cyrene-out{opacity:0;pointer-events:none}',
    '#cyrene-loading video{width:100%;height:100%;object-fit:cover;background:#0b0610;display:block}";',
    '(document.head||document.documentElement).appendChild(st);',
    'var box=document.createElement("div");box.id="cyrene-loading";',
    'var v=document.createElement("video");v.autoplay=true;v.playsInline=true;',
    'v.setAttribute("playsinline","");v.preload="auto";',
    'box.appendChild(v);',
    // 顶栏留黑：窗口按钮是原生 titleBarOverlay，盖不住，就让它们落在同色黑条上。
    'var th=(typeof CFG.titlebarHeight==="number")?CFG.titlebarHeight:40;',
    'if(th>0){var bar=document.createElement("div");',
    'bar.style.cssText="position:absolute;left:0;right:0;top:0;height:"+th+"px;background:#0b0610;z-index:2;pointer-events:none";',
    'box.appendChild(bar);var fade=document.createElement("div");',
    'fade.style.cssText="position:absolute;left:0;right:0;top:"+th+"px;height:36px;z-index:2;pointer-events:none;background:linear-gradient(#0b0610,rgba(11,6,16,0))";',
    'box.appendChild(fade);}',
    '(document.body||document.documentElement).appendChild(box);',
    // <head> 里执行时 <body> 还不存在，先挂到 documentElement；DOM 解析完必须搬进 body，
    // 否则元素挂在 <html> 下，Chromium 不一定把它渲染成全屏遮罩。
    'function attach(){try{if(document.body&&box.parentNode!==document.body)document.body.appendChild(box)}catch(e){}}',
    'if(document.readyState==="loading"){try{document.addEventListener("DOMContentLoaded",attach)}catch(e){}}',
    'else{attach()}',
    'var idx=0,done=false,guard=null,bound=false;',
    'function clearGuard(){if(guard){clearTimeout(guard);guard=null}}',
    'function armGuard(){clearGuard();guard=setTimeout(function(){guard=null;',
    'try{if(v.readyState<2||v.currentTime<0.02)advance()}catch(e){advance()}},CFG.guardMs||2600)}',
    'function play(){try{var p=v.play();if(p&&p.catch)p.catch(function(){try{v.muted=true;',
    'v.play().catch(function(){})}catch(e){}});return true}catch(e){return false}}',
    'function finish(){if(done)return;done=true;clearGuard();unbind();',
    'try{window.__dshStartupCyreneDone=true}catch(e){}',
    'try{window.__cyreneLoadingDone=true}catch(e){}',
    'try{v.pause()}catch(e){}try{box.classList.add("cyrene-out")}catch(e){}',
    'try{window.dispatchEvent(new Event("cyrene-loading-done"))}catch(e){}',
    'try{window.dispatchEvent(new Event("dsh-startup-cyrene-done"))}catch(e){}',
    'setTimeout(function(){try{v.pause()}catch(e){}if(box.parentNode)box.parentNode.removeChild(box)},',
    '(CFG.fadeMs||0)+150)}',
    'function advance(){if(done)return;var n=idx+1;if(n>=SEG.length){finish();return}load(n)}',
    'function load(n){if(done)return;idx=n;var s=SEG[n]||{};clearGuard();',
    'try{v.muted=false;v.volume=typeof s.volume==="number"?s.volume:1}catch(e){}',
    'try{v.src=s.url}catch(e){finish();return}',
    'try{v.load();v.currentTime=0}catch(e){}',
    'if(!play()){finish();return}',
    'armGuard()}',
    'function onPress(){try{if(done)return;var t=CFG.clickSkipsTo;',
    'if(t===null||typeof t!=="number")return;if(t<=idx)return;if(t>=SEG.length)return;load(t)}catch(e){}}',
    'function unbind(){if(!bound)return;bound=false;try{box.removeEventListener("pointerdown",onPress)}catch(e){}}',
    'function bind(){if(bound)return;bound=true;',
    'try{box.addEventListener("pointerdown",onPress,{passive:true})}catch(e){}}',
    'v.addEventListener("playing",function(){clearGuard()});',
    'v.addEventListener("ended",function(){try{advance()}catch(e){finish()}});',
    'v.addEventListener("error",function(){try{advance()}catch(e){finish()}});',
    'v.addEventListener("timeupdate",function(){try{var d=v.duration;',
    'if(!isFinite(d)||d<=0)return;var cfgF=(CFG.audioFadeMs||0)/1000;if(cfgF<=0)return;',
    'var f=Math.min(cfgF,Math.max(0.2,d*0.3));var left=d-v.currentTime;if(left<=0)return;',
    'if(left<=f)v.volume=Math.max(0,Math.min(1,left/f))}catch(e){}});',
    'bind();',
    'setTimeout(function(){if(!done)finish()},CFG.totalTimeoutMs||60000);',
    'load(0);',
    '}catch(e){}})()',
  ].join('')
}
