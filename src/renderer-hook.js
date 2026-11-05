/**
 * Antigravity Wallpaper Engine - Renderer Hook (Frosted Glass & Dynamic Themes)
 * Author: Vinayak Saxena (@vinayaksaxena1-maker)
 * License: MIT
 */
(() => {
  'use strict';
  if (window.__agyWallpaperEngineInstalled) return;
  window.__agyWallpaperEngineInstalled = true;

  const ipc = typeof electron_1 !== 'undefined' ? electron_1.ipcRenderer : null;
  const api = {
    getPrefs: () => ipc ? ipc.invoke('wallpaper:get-prefs') : Promise.resolve({}),
    savePrefs: (data) => ipc ? ipc.invoke('wallpaper:save-prefs', data) : Promise.resolve(false),
    listImages: () => ipc ? ipc.invoke('wallpaper:list-images') : Promise.resolve([]),
    getImage: (file) => ipc ? ipc.invoke('wallpaper:get-image', file) : Promise.resolve(null),
    pickImage: () => ipc ? ipc.invoke('wallpaper:pick-image') : Promise.resolve(null)
  };

  let images = [];
  let currentImageId = '';
  let prefs = { activeId: '', opacity: 85, scale: 100, enabled: true, themeMode: 'auto', userMsgStyle: 'light', aiTextStyle: 'auto' };
  const imageCache = new Map();
  const lumCache = new Map();
  const edgeColorCache = new Map();
  const modeNodes = new Map();

  let sheet = null, canvas = null, ctx = null, resizeObserver = null;
  let host = null, shadow = null, panelOpen = false;

  function detectLuminance(img) {
    if (!img || !img.complete || !img.naturalWidth) return false;
    if (lumCache.has(img.src)) return lumCache.get(img.src);
    try {
      const c = document.createElement('canvas');
      c.width = 40;
      c.height = 25;
      const cx = c.getContext('2d', { willReadFrequently: true });
      cx.drawImage(img, 0, 0, 40, 25);
      const data = cx.getImageData(0, 0, 40, 25).data;
      let totalLum = 0;
      const count = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        totalLum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
      }
      const avgLum = totalLum / (count * 255);
      const isLight = avgLum > 0.48;
      lumCache.set(img.src, isLight);
      return isLight;
    } catch {
      return false;
    }
  }

  function sampleEdgeColor(img, isLight) {
    if (!img || !img.complete || !img.naturalWidth) {
      return isLight ? 'rgba(248, 250, 252, 0.65)' : 'rgba(10, 13, 20, 0.65)';
    }
    const cacheKey = img.src + '_' + (isLight ? 'L' : 'D');
    if (edgeColorCache.has(cacheKey)) return edgeColorCache.get(cacheKey);

    try {
      const c = document.createElement('canvas');
      c.width = 10;
      c.height = 40;
      const cx = c.getContext('2d', { willReadFrequently: true });
      const sampleW = Math.max(1, Math.round(img.naturalWidth * 0.18));
      cx.drawImage(img, 0, 0, sampleW, img.naturalHeight, 0, 0, 10, 40);
      const data = cx.getImageData(0, 0, 10, 40).data;
      let rSum = 0, gSum = 0, bSum = 0;
      const count = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        rSum += data[i];
        gSum += data[i + 1];
        bSum += data[i + 2];
      }
      let r = Math.round(rSum / count);
      let g = Math.round(gSum / count);
      let b = Math.round(bSum / count);

      if (isLight) {
        r = Math.min(255, Math.round(r * 0.45 + 255 * 0.55));
        g = Math.min(255, Math.round(g * 0.45 + 255 * 0.55));
        b = Math.min(255, Math.round(b * 0.45 + 255 * 0.55));
      } else {
        r = Math.round(r * 0.4);
        g = Math.round(g * 0.4);
        b = Math.round(b * 0.4);
      }
      const alpha = isLight ? 0.65 : 0.70;
      const color = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      edgeColorCache.set(cacheKey, color);
      return color;
    } catch {
      return isLight ? 'rgba(248, 250, 252, 0.65)' : 'rgba(10, 13, 20, 0.65)';
    }
  }

  function resolveIsLight() {
    if (prefs.themeMode === 'light') return true;
    if (prefs.themeMode === 'dark') return false;
    const current = images.find(img => img.id === currentImageId) || images[0];
    if (!current) return false;
    const img = getImgElement(current);
    return detectLuminance(img);
  }

  function setMode(isLight, off) {
    const names = ['dark', 'light', 'dark-theme', 'light-theme', 'theme-dark', 'theme-light'];
    if (off) {
      for (const [e, old] of modeNodes) {
        if (e.isConnected) {
          e.classList.remove(...names);
          e.classList.add(...old);
        }
      }
      modeNodes.clear();
      return;
    }
    const nodes = [document.body, ...document.querySelectorAll('#root, #root .dark, #root .light')];
    for (const e of nodes) {
      if (!modeNodes.has(e)) modeNodes.set(e, names.filter(c => e.classList.contains(c)));
      e.classList.remove(...names);
      e.classList.add(isLight ? 'light' : 'dark');
      if (e === document.body) {
        e.classList.add(isLight ? 'light-theme' : 'dark-theme', isLight ? 'theme-light' : 'theme-dark');
      }
    }
  }

  function injectStyles(isLight, sidebarBg) {
    let style = document.getElementById('agy-wallpaper-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'agy-wallpaper-style';
      document.head.append(style);
    }

    const darkTokens = {
      background: '#0a0d14',
      foreground: '#f0f3fa',
      secondary: '#161d2c',
      'secondary-foreground': '#9aa5b8',
      muted: '#161d2c',
      'muted-foreground': '#9aa5b8',
      card: '#161d2c',
      'card-border': '#2a354c',
      border: '#2a354c',
      sidebar: sidebarBg || 'rgba(10, 13, 20, 0.65)',
      'sidebar-muted': 'rgba(22, 29, 44, 0.45)',
      'sidebar-secondary': 'rgba(14, 18, 28, 0.5)',
      primary: '#64a0f0',
      'primary-foreground': '#f0f3fa',
      'cta-foreground': '#ffffff',
      popover: '#0e121c',
      'popover-foreground': '#f0f3fa',
      accent: '#161d2c',
      'accent-foreground': '#f0f3fa',
      input: '#2a354c',
      ring: '#64a0f0'
    };

    const lightTokens = {
      background: '#f1f5f9',
      foreground: '#0f172a',
      secondary: '#e2e8f0',
      'secondary-foreground': '#475569',
      muted: '#f1f5f9',
      'muted-foreground': '#475569',
      card: '#ffffff',
      'card-border': '#cbd5e1',
      border: '#cbd5e1',
      sidebar: sidebarBg || 'rgba(248, 250, 252, 0.65)',
      'sidebar-muted': 'rgba(241, 245, 249, 0.5)',
      'sidebar-secondary': 'rgba(226, 232, 240, 0.5)',
      primary: '#2563eb',
      'primary-foreground': '#ffffff',
      'cta-foreground': '#ffffff',
      popover: '#ffffff',
      'popover-foreground': '#0f172a',
      accent: '#f1f5f9',
      'accent-foreground': '#0f172a',
      input: '#cbd5e1',
      ring: '#2563eb'
    };

    const tokens = isLight ? lightTokens : darkTokens;
    const declarations = Object.entries(tokens)
      .flatMap(([k, v]) => [`--${k}:${v}!important`, `--color-${k}:${v}!important`])
      .join(';');

    const editor = isLight
      ? `--editor-code-block-background:#f8fafc!important;--code-foreground:#875632!important;--editor-selection-background:#538da52e!important;--color-selection-background:#538da52e!important;--glass-border:#cbd5e1!important;--focus-ring-color:#2563eb!important;--editor-line-number-foreground:#64748b!important;--color-editorLineNumber-foreground:#64748b!important;`
      : `--editor-code-block-background:#0e121c!important;--code-foreground:#e7c59e!important;--editor-selection-background:#538da52e!important;--color-selection-background:#538da52e!important;--glass-border:#2a354c!important;--focus-ring-color:#64a0f0!important;--editor-line-number-foreground:#9aa5b8!important;--color-editorLineNumber-foreground:#9aa5b8!important;`;

    const fgColor = isLight ? '#0f172a' : '#f0f3fa';
    let aiColor = isLight ? '#0f172a' : '#f0f3fa';
    if (prefs.aiTextStyle === 'white') aiColor = '#f8fafc';
    if (prefs.aiTextStyle === 'dark') aiColor = '#0f172a';

    const isUserDark = prefs.userMsgStyle === 'dark';
    const userMsgBg = isUserDark ? 'rgba(16, 22, 34, 0.90)' : 'rgba(255, 255, 255, 0.94)';
    const userMsgBorder = isUserDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.12)';
    const userMsgColor = isUserDark ? '#ffffff' : '#000000';
    const userMsgShadow = isUserDark ? '0 4px 16px rgba(0, 0, 0, 0.35)' : '0 4px 16px rgba(0, 0, 0, 0.12)';
    const composerTextColor = isLight ? '#0f172a' : '#f8fafc';
    const composerCaretColor = isLight ? '#2563eb' : '#64a0f0';
    const composerPlaceholder = isLight ? '#64748b' : '#94a3b8';

    const textGlow = isLight
      ? '0 0 2px #ffffff, 0 0 6px #ffffff, 0 0 12px #ffffff'
      : '0 1px 2px rgba(0,0,0,0.95), 0 0 6px rgba(10,13,20,0.85), 0 0 14px rgba(10,13,20,0.75)';
    const sheetBackground = isLight
      ? 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.20) 70%, transparent 100%)'
      : 'radial-gradient(ellipse at center, rgba(10, 13, 20, 0.50) 0%, rgba(10, 13, 20, 0.25) 70%, transparent 100%)';
    const composerBg = isLight
      ? 'color-mix(in srgb, #ffffff 88%, transparent)'
      : 'color-mix(in srgb, #2a354c 60%, transparent)';
    const composerCardBg = isLight
      ? 'color-mix(in srgb, #ffffff 95%, transparent)'
      : 'color-mix(in srgb, #161d2c 92%, transparent)';

    style.textContent = `
      body[data-custom-wallpaper],
      body[data-custom-wallpaper] #root .dark,
      body[data-custom-wallpaper] #root .light,
      body[data-custom-wallpaper] .agy-shell {
        ${declarations};
        ${editor}
        color-scheme: ${isLight ? 'light' : 'dark'} !important;
      }
      body[data-custom-wallpaper] .agy-shell {
        position: relative !important;
        isolation: isolate !important;
        background: transparent !important;
        --max-conversation-width: min(60rem, 50vw) !important;
      }
      @media (max-width: 900px) {
        body[data-custom-wallpaper] .agy-shell {
          --max-conversation-width: 100% !important;
        }
      }
      body[data-custom-wallpaper] .agy-sheet {
        isolation: isolate !important;
        background: ${sheetBackground} !important;
        text-shadow: none !important;
        color: ${aiColor};
      }
      body[data-custom-wallpaper] aside,
      body[data-custom-wallpaper] [class*="sidebar"]:not(.agy-sidebar-row),
      body[data-custom-wallpaper] nav {
        backdrop-filter: blur(24px) !important;
        -webkit-backdrop-filter: blur(24px) !important;
        background: ${sidebarBg} !important;
        border-right: 1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'} !important;
      }
      body[data-custom-wallpaper] .agy-sidebar-row {
        --row-bg: transparent !important;
      }
      body[data-custom-wallpaper] .agy-sidebar-row:hover {
        background: ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'} !important;
        border-radius: 6px !important;
      }
      body[data-custom-wallpaper] aside [class*="bg-white"],
      body[data-custom-wallpaper] aside [class*="bg-foreground"],
      body[data-custom-wallpaper] aside [class*="bg-primary"],
      body[data-custom-wallpaper] aside [data-active="true"],
      body[data-custom-wallpaper] aside [aria-selected="true"],
      body[data-custom-wallpaper] aside [class*="active"],
      body[data-custom-wallpaper] .agy-sidebar-row[data-active="true"],
      body[data-custom-wallpaper] .agy-sidebar-row[aria-selected="true"],
      body[data-custom-wallpaper] .agy-sidebar-row.active {
        background: ${isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.12)'} !important;
        border: 1px solid ${isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.18)'} !important;
        border-radius: 6px !important;
        color: ${isLight ? '#0f172a' : '#f8fafc'} !important;
        backdrop-filter: blur(8px) !important;
      }
      body[data-custom-wallpaper] aside [class*="bg-white"] *,
      body[data-custom-wallpaper] aside [class*="bg-foreground"] *,
      body[data-custom-wallpaper] aside [class*="bg-primary"] *,
      body[data-custom-wallpaper] aside [data-active="true"] *,
      body[data-custom-wallpaper] aside [aria-selected="true"] *,
      body[data-custom-wallpaper] aside [class*="active"] *,
      body[data-custom-wallpaper] .agy-sidebar-row[data-active="true"] *,
      body[data-custom-wallpaper] .agy-sidebar-row[aria-selected="true"] *,
      body[data-custom-wallpaper] .agy-sidebar-row.active * {
        color: ${isLight ? '#0f172a' : '#f8fafc'} !important;
      }
      body[data-custom-wallpaper] .surface-composer {
        background: ${composerBg} !important;
        backdrop-filter: blur(16px) !important;
        -webkit-backdrop-filter: blur(16px) !important;
        box-shadow: 0 10px 26px rgba(0,0,0,${isLight ? '0.08' : '0.25'}) !important;
        color: ${composerTextColor} !important;
        caret-color: ${composerCaretColor} !important;
        text-shadow: none !important;
      }
      body[data-custom-wallpaper] .surface-composer-card {
        background: ${composerCardBg} !important;
        backdrop-filter: blur(12px) !important;
        -webkit-backdrop-filter: blur(12px) !important;
        color: ${composerTextColor} !important;
      }
      body[data-custom-wallpaper] .surface-composer textarea,
      body[data-custom-wallpaper] .surface-composer input,
      body[data-custom-wallpaper] .surface-composer [contenteditable],
      body[data-custom-wallpaper] .surface-composer-card textarea,
      body[data-custom-wallpaper] .surface-composer-card input,
      body[data-custom-wallpaper] textarea,
      body[data-custom-wallpaper] input:not([type="range"]) {
        color: ${composerTextColor} !important;
        caret-color: ${composerCaretColor} !important;
        text-shadow: none !important;
      }
      body[data-custom-wallpaper] textarea::placeholder,
      body[data-custom-wallpaper] input::placeholder,
      body[data-custom-wallpaper] [contenteditable]::placeholder {
        color: ${composerPlaceholder} !important;
        opacity: 0.85 !important;
      }
      /* Sent User Message & Right-Aligned Turn Bubbles */
      body[data-custom-wallpaper] [class*="justify-end"] [class*="rounded"],
      body[data-custom-wallpaper] [class*="items-end"] [class*="rounded"],
      body[data-custom-wallpaper] [class*="self-end"],
      body[data-custom-wallpaper] [class*="ml-auto"],
      body[data-custom-wallpaper] .md-sticky-message-bleed,
      body[data-custom-wallpaper] [class*="sticky-message"],
      body[data-custom-wallpaper] [class*="UserMessage"],
      body[data-custom-wallpaper] [class*="user-message"],
      body[data-custom-wallpaper] [class*="userMessage"],
      body[data-custom-wallpaper] [class*="userPrompt"],
      body[data-custom-wallpaper] [class*="user-prompt"],
      body[data-custom-wallpaper] [data-role="user"],
      body[data-custom-wallpaper] [data-author="user"],
      body[data-custom-wallpaper] [data-message-author-role="user"],
      body[data-custom-wallpaper] [data-is-user="true"] {
        background: ${userMsgBg} !important;
        backdrop-filter: blur(14px) !important;
        -webkit-backdrop-filter: blur(14px) !important;
        border-radius: 9999px !important;
        border: 1px solid ${userMsgBorder} !important;
        color: ${userMsgColor} !important;
        box-shadow: ${userMsgShadow} !important;
        text-shadow: none !important;
      }
      body[data-custom-wallpaper] [class*="justify-end"] [class*="rounded"] *,
      body[data-custom-wallpaper] [class*="items-end"] [class*="rounded"] *,
      body[data-custom-wallpaper] [class*="self-end"] *,
      body[data-custom-wallpaper] [class*="ml-auto"] *,
      body[data-custom-wallpaper] .md-sticky-message-bleed *,
      body[data-custom-wallpaper] [class*="sticky-message"] *,
      body[data-custom-wallpaper] [class*="UserMessage"] *,
      body[data-custom-wallpaper] [class*="user-message"] *,
      body[data-custom-wallpaper] [class*="userMessage"] *,
      body[data-custom-wallpaper] [class*="userPrompt"] *,
      body[data-custom-wallpaper] [class*="user-prompt"] *,
      body[data-custom-wallpaper] [data-role="user"] *,
      body[data-custom-wallpaper] [data-author="user"] *,
      body[data-custom-wallpaper] [data-message-author-role="user"] *,
      body[data-custom-wallpaper] [data-is-user="true"] * {
        color: ${userMsgColor} !important;
        text-shadow: none !important;
      }
      body[data-custom-wallpaper] .md-sticky-message-bleed::before,
      body[data-custom-wallpaper] .md-sticky-message-bleed::after {
        display: none !important;
      }
      body[data-custom-wallpaper] .agy-sheet [class*=bottom-0][class*=pointer-events-none] {
        background-image: none !important;
      }
      body[data-custom-wallpaper] :not(pre) > code,
      body[data-custom-wallpaper] a > code {
        background: ${isLight ? 'rgba(0, 0, 0, 0.07)' : 'rgba(10, 14, 22, 0.88)'} !important;
        color: ${isLight ? '#0f172a' : '#ffffff'} !important;
        border: 1px solid ${isLight ? 'rgba(0, 0, 0, 0.14)' : 'rgba(255, 255, 255, 0.16)'} !important;
        border-radius: 4px !important;
        padding: 1.5px 6px !important;
        font-size: 0.9em !important;
        font-weight: 500 !important;
        text-shadow: none !important;
        backdrop-filter: blur(8px) !important;
        -webkit-backdrop-filter: blur(8px) !important;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
        box-decoration-break: clone !important;
        -webkit-box-decoration-break: clone !important;
      }
      body[data-custom-wallpaper] :not(pre) > code:hover,
      body[data-custom-wallpaper] a:hover > code {
        background: ${isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(18, 24, 38, 0.95)'} !important;
        color: ${isLight ? '#0f172a' : '#ffffff'} !important;
      }
      body[data-custom-wallpaper] a {
        color: ${isLight ? '#2563eb' : '#60a5fa'} !important;
      }
      body[data-custom-wallpaper][data-custom-theme="light"] pre,
      body[data-custom-wallpaper][data-custom-theme="light"] code {
        --syntax-string: #477148;
        --syntax-keyword: #795498;
        --syntax-comment: #627b72;
      }
    `;
  }

  function getImgElement(item) {
    if (!item) return null;
    if (imageCache.has(item.id)) return imageCache.get(item.id);
    const img = new Image();
    imageCache.set(item.id, img);
    api.getImage(item.file).then(dataUrl => {
      if (dataUrl) {
        img.src = dataUrl;
        img.onload = () => {
          if (item.id === currentImageId) {
            applyWallpaperState();
          }
          render();
          updateThumbnails();
        };
      }
    });
    return img;
  }

  function drawCover(targetCtx, img, w, h, opacity = 0.85, scale = 1.0, isLight = false) {
    if (!targetCtx || !img || !img.complete || !img.naturalWidth) return;
    targetCtx.save();
    targetCtx.fillStyle = isLight ? '#f1f5f9' : '#0a0d14';
    targetCtx.fillRect(0, 0, w, h);
    targetCtx.globalAlpha = opacity;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const canvasRatio = w / h;
    let baseW, baseH;
    if (canvasRatio > imgRatio) {
      baseW = w;
      baseH = w / imgRatio;
    } else {
      baseW = h * imgRatio;
      baseH = h;
    }
    const s = Math.max(0.2, scale);
    const renderW = baseW * s, renderH = baseH * s;
    const renderX = (w - renderW) / 2, renderY = (h - renderH) / 2;
    targetCtx.drawImage(img, renderX, renderY, renderW, renderH);
    targetCtx.restore();
  }

  function render() {
    if (!ctx || !canvas || canvas.hidden || !prefs.enabled) return;
    const current = images.find(img => img.id === currentImageId) || images[0];
    if (current) {
      const img = getImgElement(current);
      const isLight = resolveIsLight();
      drawCover(ctx, img, canvas.width, canvas.height, 0.15 + 0.85 * (prefs.opacity / 100), (prefs.scale || 100) / 100, isLight);
    }
  }

  function resizeCanvas() {
    if (!sheet || !canvas || !ctx) return;
    const r = sheet.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }

  function mountCanvas() {
    const shell = document.querySelector('.agy-shell');
    const target = shell || document.querySelector('.agy-sheet');
    if (!target) return;
    if (sheet !== target || !canvas?.isConnected) {
      if (resizeObserver) resizeObserver.disconnect();
      canvas?.remove();
      sheet = target;
      canvas = document.createElement('canvas');
      canvas.id = 'agy-wallpaper-canvas';
      Object.assign(canvas.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        zIndex: '-1',
        pointerEvents: 'none'
      });
      target.prepend(canvas);
      ctx = canvas.getContext('2d', { alpha: false });
      resizeObserver = new ResizeObserver(() => resizeCanvas());
      resizeObserver.observe(target);
      resizeCanvas();
    }
  }

  function applyWallpaperState() {
    if (prefs.enabled && images.length > 0) {
      document.body.setAttribute('data-custom-wallpaper', 'true');
      const isLight = resolveIsLight();
      document.body.setAttribute('data-custom-theme', isLight ? 'light' : 'dark');
      if (host) host.setAttribute('data-theme', isLight ? 'light' : 'dark');

      const current = images.find(img => img.id === currentImageId) || images[0];
      const img = current ? getImgElement(current) : null;
      const sidebarBg = sampleEdgeColor(img, isLight);

      injectStyles(isLight, sidebarBg);
      setMode(isLight, false);
      if (canvas) canvas.hidden = false;
      enforceContrast();
    } else {
      document.body.removeAttribute('data-custom-wallpaper');
      document.body.removeAttribute('data-custom-theme');
      if (host) host.removeAttribute('data-theme');
      setMode(false, true);
      const style = document.getElementById('agy-wallpaper-style');
      if (style) style.textContent = '';
      if (canvas) canvas.hidden = true;
    }
    render();
    api.savePrefs(prefs);
  }

  function selectWallpaper(id) {
    currentImageId = id;
    prefs.activeId = id;
    prefs.enabled = true;
    applyWallpaperState();
    if (shadow) {
      shadow.querySelectorAll('.choice').forEach(b => {
        b.setAttribute('aria-pressed', String(b.dataset.id === id));
      });
    }
  }

  function updateThumbnails() {
    if (!shadow) return;
    const container = shadow.querySelector('.choices');
    if (!container) return;
    container.innerHTML = '';
    for (const item of images) {
      const btn = document.createElement('button');
      btn.className = 'choice';
      btn.type = 'button';
      btn.dataset.id = item.id;
      btn.setAttribute('aria-pressed', String(item.id === currentImageId));
      btn.title = item.name;

      const thumb = document.createElement('canvas');
      thumb.width = 160;
      thumb.height = 100;
      btn.append(thumb);

      const img = getImgElement(item);
      const draw = () => drawCover(thumb.getContext('2d'), img, 160, 100, 1.0, 1.0);
      if (img.complete) draw(); else img.onload = draw;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectWallpaper(item.id);
      });
      container.append(btn);
    }
  }

  function updateThemeButtons() {
    if (!shadow) return;
    const mode = prefs.themeMode || 'auto';
    shadow.querySelectorAll('.btn-theme').forEach(btn => {
      btn.setAttribute('aria-pressed', String(btn.dataset.mode === mode));
    });
    const userMsg = prefs.userMsgStyle || 'light';
    shadow.querySelectorAll('.btn-user-msg').forEach(btn => {
      btn.setAttribute('aria-pressed', String(btn.dataset.style === userMsg));
    });
    const aiText = prefs.aiTextStyle || 'auto';
    shadow.querySelectorAll('.btn-ai-text').forEach(btn => {
      btn.setAttribute('aria-pressed', String(btn.dataset.style === aiText));
    });
  }

  function positionTrigger() {
    if (!shadow) return;
    const trigger = shadow.querySelector('.trigger');
    if (!trigger) return;
    const candidates = document.querySelectorAll('button, a, [role="button"], div');
    let anchor = null;
    for (const el of candidates) {
      if (/Open\s+IDE/i.test(el.textContent || '') && (el.textContent || '').trim().length < 30) {
        const r = el.getBoundingClientRect();
        if (r.top >= 0 && r.top < 60 && r.left > 50 && r.width > 10 && r.height > 10) {
          anchor = el.closest('button, a, [role="button"]') || el;
          break;
        }
      }
    }
    if (anchor) {
      const r = anchor.getBoundingClientRect();
      trigger.style.right = Math.round(window.innerWidth - r.left + 8) + 'px';
      const targetTop = Math.round(r.top + (r.height - 25) / 2);
      if (targetTop >= 0 && targetTop < 40) trigger.style.top = targetTop + 'px';
    } else {
      trigger.style.right = '160px';
      trigger.style.top = '5px';
    }
  }

  function buildUI() {
    if (host) return;
    host = document.createElement('div');
    host.id = 'agy-wallpaper-ui';
    document.body.append(host);
    shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host {
        all: initial;
        position: fixed;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
        z-index: 2147483000;
        pointer-events: none;
        font-family: system-ui, -apple-system, Segoe UI, sans-serif;
      }
      * { box-sizing: border-box; }
      .trigger {
        position: fixed;
        top: 5px;
        right: 160px;
        z-index: 2147483000;
        pointer-events: auto !important;
        -webkit-app-region: no-drag !important;
        display: flex;
        align-items: center;
        gap: 6px;
        height: 25px;
        padding: 0 10px;
        background: rgba(22, 28, 44, 0.9);
        color: #f0f3fa;
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 5px;
        font-size: 11px;
        cursor: pointer;
        backdrop-filter: blur(8px);
        transition: background 0.15s, color 0.15s;
      }
      .trigger:hover { background: rgba(35, 46, 68, 0.95); }
      :host([data-theme="light"]) .trigger {
        background: rgba(248, 250, 252, 0.92);
        color: #0f172a;
        border-color: rgba(0, 0, 0, 0.15);
      }
      :host([data-theme="light"]) .trigger:hover {
        background: rgba(235, 240, 248, 0.95);
      }
      .panel {
        position: fixed;
        top: 40px;
        right: 160px;
        z-index: 2147483000;
        width: 320px;
        pointer-events: auto !important;
        -webkit-app-region: no-drag !important;
        background: rgba(14, 18, 28, 0.96);
        color: #f0f3fa;
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 10px;
        padding: 12px;
        box-shadow: 0 12px 36px rgba(0,0,0,0.6);
        backdrop-filter: blur(16px);
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      :host([data-theme="light"]) .panel {
        background: rgba(255, 255, 255, 0.96);
        color: #0f172a;
        border-color: rgba(0, 0, 0, 0.12);
        box-shadow: 0 12px 36px rgba(0,0,0,0.15);
      }
      .panel[hidden] { display: none !important; }
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        padding-bottom: 8px;
      }
      :host([data-theme="light"]) .header {
        border-bottom-color: rgba(0,0,0,0.08);
      }
      .title { font-size: 12px; font-weight: 600; color: #f0f3fa; }
      :host([data-theme="light"]) .title { color: #0f172a; }
      .btn-group { display: flex; gap: 5px; }
      .btn {
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.12);
        color: #f0f3fa;
        border-radius: 4px;
        padding: 3px 8px;
        font-size: 11px;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
      }
      .btn:hover { background: rgba(255,255,255,0.18); }
      :host([data-theme="light"]) .btn {
        background: rgba(0,0,0,0.06);
        border-color: rgba(0,0,0,0.12);
        color: #0f172a;
      }
      :host([data-theme="light"]) .btn:hover {
        background: rgba(0,0,0,0.12);
      }
      .btn-add { background: #2b6cb0; border-color: #3182ce; font-weight: 500; }
      .btn-add:hover { background: #3182ce; }
      .btn-theme[aria-pressed="true"],
      .btn-user-msg[aria-pressed="true"],
      .btn-ai-text[aria-pressed="true"] {
        background: #2b6cb0;
        border-color: #3182ce;
        color: #ffffff;
        font-weight: 600;
      }
      .choices {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
        max-height: 180px;
        overflow-y: auto;
        padding: 2px;
      }
      .choice {
        background: none;
        border: 2px solid transparent;
        border-radius: 6px;
        padding: 0;
        cursor: pointer;
        aspect-ratio: 16/10;
        overflow: hidden;
        outline: none;
      }
      .choice:hover { border-color: rgba(255,255,255,0.4); }
      :host([data-theme="light"]) .choice:hover { border-color: rgba(0,0,0,0.4); }
      .choice[aria-pressed=true] { border-color: #64a0f0; box-shadow: 0 0 0 1px #64a0f0; }
      :host([data-theme="light"]) .choice[aria-pressed=true] { border-color: #2563eb; box-shadow: 0 0 0 1px #2563eb; }
      .choice canvas { width: 100%; height: 100%; display: block; object-fit: cover; }
      .sliders { display: flex; flex-direction: column; gap: 8px; font-size: 11px; color: #a0aec0; }
      :host([data-theme="light"]) .sliders { color: #475569; }
      .slider-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .slider-row input { flex: 1; accent-color: #64a0f0; cursor: pointer; }
      :host([data-theme="light"]) .slider-row input { accent-color: #2563eb; }
      .val-text { min-width: 32px; text-align: right; font-variant-numeric: tabular-nums; }
    `;
    shadow.append(style);

    const trigger = document.createElement('button');
    trigger.className = 'trigger';
    trigger.innerHTML = '🖼️ <span>Wallpapers</span>';
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      togglePanel(!panelOpen);
    });

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.hidden = true;

    panel.innerHTML = `
      <div class="header">
        <span class="title">Wallpapers</span>
        <div class="btn-group">
          <button type="button" class="btn btn-add">+ Image</button>
          <button type="button" class="btn btn-off">Off</button>
          <button type="button" class="btn btn-close">✕</button>
        </div>
      </div>
      <div class="choices"></div>
      <div class="sliders">
        <div class="slider-row">
          <span>Theme</span>
          <div class="btn-group">
            <button type="button" class="btn btn-theme" data-mode="auto">Auto</button>
            <button type="button" class="btn btn-theme" data-mode="light">Light</button>
            <button type="button" class="btn btn-theme" data-mode="dark">Dark</button>
          </div>
        </div>
        <div class="slider-row">
          <span>User Msg</span>
          <div class="btn-group">
            <button type="button" class="btn btn-user-msg" data-style="light">Light Card</button>
            <button type="button" class="btn btn-user-msg" data-style="dark">Dark Glass</button>
          </div>
        </div>
        <div class="slider-row">
          <span>AI Text</span>
          <div class="btn-group">
            <button type="button" class="btn btn-ai-text" data-style="auto">Auto</button>
            <button type="button" class="btn btn-ai-text" data-style="white">White</button>
            <button type="button" class="btn btn-ai-text" data-style="dark">Dark</button>
          </div>
        </div>
        <div class="slider-row">
          <span>Opacity</span>
          <input type="range" class="range-opacity" min="15" max="100" step="1" value="${prefs.opacity}">
          <span class="val-text val-opacity">${prefs.opacity}%</span>
        </div>
        <div class="slider-row">
          <span>Size</span>
          <input type="range" class="range-scale" min="25" max="250" step="5" value="${prefs.scale || 100}">
          <span class="val-text val-scale">${prefs.scale || 100}%</span>
        </div>
      </div>
    `;

    shadow.append(trigger, panel);

    panel.querySelector('.btn-close').addEventListener('click', (e) => {
      e.stopPropagation();
      togglePanel(false);
    });

    panel.querySelector('.btn-off').addEventListener('click', (e) => {
      e.stopPropagation();
      prefs.enabled = false;
      applyWallpaperState();
    });

    panel.querySelector('.btn-add').addEventListener('click', async (e) => {
      e.stopPropagation();
      const picked = await api.pickImage();
      if (!picked) return;
      images.unshift({ id: picked.id, name: picked.name, file: picked.file, ext: 'jpg' });
      const img = new Image();
      img.src = picked.dataUrl;
      imageCache.set(picked.id, img);
      updateThumbnails();
      selectWallpaper(picked.id);
    });

    panel.querySelectorAll('.btn-theme').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        prefs.themeMode = btn.dataset.mode;
        updateThemeButtons();
        api.savePrefs(prefs);
        applyWallpaperState();
      });
    });

    panel.querySelectorAll('.btn-user-msg').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        prefs.userMsgStyle = btn.dataset.style;
        updateThemeButtons();
        api.savePrefs(prefs);
        applyWallpaperState();
      });
    });

    panel.querySelectorAll('.btn-ai-text').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        prefs.aiTextStyle = btn.dataset.style;
        updateThemeButtons();
        api.savePrefs(prefs);
        applyWallpaperState();
      });
    });

    const opRange = panel.querySelector('.range-opacity');
    const opText = panel.querySelector('.val-opacity');
    opRange.addEventListener('input', () => {
      prefs.opacity = Number(opRange.value);
      opText.textContent = prefs.opacity + '%';
      render();
    });
    opRange.addEventListener('change', () => api.savePrefs(prefs));

    const scRange = panel.querySelector('.range-scale');
    const scText = panel.querySelector('.val-scale');
    scRange.addEventListener('input', () => {
      prefs.scale = Number(scRange.value);
      scText.textContent = prefs.scale + '%';
      render();
    });
    scRange.addEventListener('change', () => api.savePrefs(prefs));

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.code === 'KeyW') {
        e.preventDefault();
        togglePanel(!panelOpen);
      }
      if (e.key === 'Escape' && panelOpen) {
        togglePanel(false);
      }
    });

    document.addEventListener('pointerdown', (e) => {
      if (panelOpen && !e.composedPath().includes(host)) {
        togglePanel(false);
      }
    });

    updateThumbnails();
    updateThemeButtons();
    positionTrigger();
  }

  function togglePanel(open) {
    panelOpen = open;
    if (shadow) {
      const panel = shadow.querySelector('.panel');
      if (panel) {
        panel.hidden = !panelOpen;
        if (panelOpen) {
          const trigger = shadow.querySelector('.trigger');
          if (trigger) {
            const r = trigger.getBoundingClientRect();
            panel.style.top = (r.bottom + 6) + 'px';
            panel.style.right = Math.max(16, window.innerWidth - r.right) + 'px';
          }
        }
      }
    }
  }

  function enforceContrast() {
    if (!prefs.enabled) return;
    const isUserDark = prefs.userMsgStyle === 'dark';
    const userTargetBg = isUserDark ? 'rgba(16, 22, 34, 0.90)' : 'rgba(255, 255, 255, 0.95)';
    const userTargetColor = isUserDark ? '#ffffff' : '#000000';
    const userTargetBorder = isUserDark ? '1px solid rgba(255, 255, 255, 0.16)' : '1px solid rgba(0, 0, 0, 0.12)';

    // 1. Scan for user message bubbles in chat (.agy-sheet, .agy-shell, or main)
    const sheetEl = document.querySelector('.agy-sheet') || document.querySelector('.agy-shell');
    if (sheetEl) {
      const wrappers = sheetEl.querySelectorAll('[class*="justify-end"], [class*="items-end"], [class*="ml-auto"], [class*="self-end"]');
      wrappers.forEach(wrap => {
        const bubble = wrap.querySelector('[class*="rounded"]') || wrap;
        bubble.style.setProperty('background', userTargetBg, 'important');
        bubble.style.setProperty('color', userTargetColor, 'important');
        bubble.style.setProperty('border', userTargetBorder, 'important');
        bubble.style.setProperty('text-shadow', 'none', 'important');
        bubble.querySelectorAll('*').forEach(c => {
          c.style.setProperty('color', userTargetColor, 'important');
          c.style.setProperty('text-shadow', 'none', 'important');
        });
      });
    }

    // 2. Scan sidebar active items (remove solid white fill, make clean frosted glass)
    const sidebars = document.querySelectorAll('aside, nav, [class*="sidebar"]');
    sidebars.forEach(sb => {
      sb.querySelectorAll('[class*="bg-white"], [class*="active"], [aria-selected="true"], [data-active="true"]').forEach(activeEl => {
        activeEl.style.setProperty('background', 'rgba(255, 255, 255, 0.12)', 'important');
        activeEl.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.18)', 'important');
        activeEl.style.setProperty('color', '#f8fafc', 'important');
        activeEl.querySelectorAll('*').forEach(c => c.style.setProperty('color', '#f8fafc', 'important'));
      });
    });

    // 3. Fallback: Any element anywhere in sheetEl whose computed background is near-white
    if (sheetEl) {
      const candidates = sheetEl.querySelectorAll('div, span, p');
      for (let i = 0; i < candidates.length; i++) {
        const el = candidates[i];
        if (el.children.length > 2) continue;
        const bg = window.getComputedStyle(el).backgroundColor;
        if (bg && bg.startsWith('rgb')) {
          const m = bg.match(/\d+/g);
          if (m && m.length >= 3) {
            const r = Number(m[0]), g = Number(m[1]), b = Number(m[2]);
            const a = m[3] !== undefined ? Number(m[3]) : 1;
            if (a > 0.4 && (r + g + b) > 650) {
              if (isUserDark && el.closest('[class*="justify-end"], [class*="ml-auto"]')) {
                el.style.setProperty('background', userTargetBg, 'important');
                el.style.setProperty('color', '#ffffff', 'important');
              } else {
                el.style.setProperty('color', '#000000', 'important');
              }
              el.style.setProperty('text-shadow', 'none', 'important');
            }
          }
        }
      }
    }
  }

  async function init() {
    try {
      const saved = await api.getPrefs();
      if (saved && typeof saved === 'object') {
        prefs = Object.assign(prefs, saved);
      }
      images = await api.listImages();
      if (images.length > 0) {
        currentImageId = prefs.activeId || images[0].id;
      }
    } catch {}

    buildUI();
    mountCanvas();
    applyWallpaperState();

    new MutationObserver(() => {
      mountCanvas();
      positionTrigger();
      enforceContrast();
    }).observe(document.body, { childList: true, subtree: true });

    window.addEventListener('resize', () => {
      positionTrigger();
      resizeCanvas();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
