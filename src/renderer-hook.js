/**
 * Antigravity Wallpaper Engine - Renderer Hook (Frosted Glass & Canvas)
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
  let prefs = { activeId: '', opacity: 85, scale: 100, enabled: true };
  const imageCache = new Map(); // id -> HTMLImageElement

  let sheet = null, canvas = null, ctx = null;
  let host = null, shadow = null, panelOpen = false;

  function injectStyles() {
    if (document.getElementById('agy-wallpaper-style')) return;
    const style = document.createElement('style');
    style.id = 'agy-wallpaper-style';
    style.textContent = `
      body[data-custom-wallpaper] .agy-sheet {
        isolation: isolate !important;
        background: transparent !important;
      }
      body[data-custom-wallpaper] .agy-shell {
        background: rgba(10, 14, 22, 0.65) !important;
        --sidebar: rgba(12, 16, 26, 0.72) !important;
        --sidebar-secondary: rgba(16, 22, 36, 0.6) !important;
        --popover: rgba(14, 18, 30, 0.8) !important;
        --card: rgba(18, 24, 38, 0.65) !important;
        --border: rgba(255, 255, 255, 0.08) !important;
        --foreground: #eef2fa !important;
        backdrop-filter: blur(14px) !important;
      }
      body[data-custom-wallpaper] .surface-composer {
        background: rgba(20, 28, 44, 0.7) !important;
        backdrop-filter: blur(12px) !important;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25) !important;
      }
      body[data-custom-wallpaper] .md-sticky-message-bleed,
      body[data-custom-wallpaper] .md-sticky-message-bleed::before,
      body[data-custom-wallpaper] .md-sticky-message-bleed::after {
        background: transparent !important;
      }
      body[data-custom-wallpaper] .agy-sheet [class*=bottom-0][class*=pointer-events-none] {
        background-image: none !important;
      }
    `;
    document.head.append(style);
  }

  function getImgElement(item) {
    if (!item) return null;
    if (imageCache.has(item.id)) return imageCache.get(item.id);
    const img = new Image();
    imageCache.set(item.id, img);
    api.getImage(item.file).then(dataUrl => {
      if (dataUrl) {
        img.src = dataUrl;
        img.onload = () => { render(); updateThumbnails(); };
      }
    });
    return img;
  }

  function drawCover(targetCtx, img, w, h, opacity = 0.85, scale = 1.0) {
    if (!targetCtx || !img || !img.complete || !img.naturalWidth) return;
    targetCtx.save();
    targetCtx.clearRect(0, 0, w, h);
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
      drawCover(ctx, img, canvas.width, canvas.height, prefs.opacity / 100, prefs.scale / 100);
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
    const next = document.querySelector('.agy-sheet');
    if (!next) return;
    if (sheet !== next || !canvas?.isConnected) {
      canvas?.remove();
      sheet = next;
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
      sheet.prepend(canvas);
      ctx = canvas.getContext('2d', { alpha: false });
      new ResizeObserver(() => resizeCanvas()).observe(sheet);
      resizeCanvas();
    }
  }

  function applyWallpaperState() {
    if (prefs.enabled && images.length > 0) {
      document.body.setAttribute('data-custom-wallpaper', 'true');
      if (canvas) canvas.hidden = false;
    } else {
      document.body.removeAttribute('data-custom-wallpaper');
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

      btn.addEventListener('click', () => selectWallpaper(item.id));
      container.append(btn);
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
      :host { all: initial; font-family: system-ui, -apple-system, Segoe UI, sans-serif; }
      .trigger {
        position: fixed; top: 6px; right: 160px; z-index: 2147483000;
        display: flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px;
        background: rgba(25, 32, 48, 0.85); color: #eef2fa; border: 1px solid rgba(255,255,255,0.12);
        border-radius: 6px; font-size: 11px; cursor: pointer; backdrop-filter: blur(8px);
        transition: background 0.15s;
      }
      .trigger:hover { background: rgba(35, 46, 68, 0.95); }
      .panel {
        position: fixed; top: 40px; right: 160px; z-index: 2147483000; width: 340px;
        background: rgba(14, 18, 28, 0.94); color: #eef2fa; border: 1px solid rgba(255,255,255,0.14);
        border-radius: 10px; padding: 12px; box-shadow: 0 12px 36px rgba(0,0,0,0.5);
        backdrop-filter: blur(16px); display: flex; flex-direction: column; gap: 10px;
      }
      .panel[hidden] { display: none !important; }
      .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px; }
      .title { font-size: 12px; font-weight: 600; }
      .btn-group { display: flex; gap: 6px; }
      .btn {
        background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1);
        color: #eef2fa; border-radius: 5px; padding: 3px 8px; font-size: 11px; cursor: pointer;
      }
      .btn:hover { background: rgba(255,255,255,0.15); }
      .btn-add { background: #2f68e0; border-color: #437bf0; }
      .btn-add:hover { background: #3d76ee; }
      .choices { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; max-height: 200px; overflow-y: auto; }
      .choice {
        background: none; border: 2px solid transparent; border-radius: 6px; padding: 0;
        cursor: pointer; aspect-ratio: 16/10; overflow: hidden; outline: none;
      }
      .choice[aria-pressed=true] { border-color: #437bf0; box-shadow: 0 0 0 1px #437bf0; }
      .choice canvas { width: 100%; height: 100%; display: block; object-fit: cover; }
      .sliders { display: flex; flex-direction: column; gap: 6px; font-size: 11px; color: #a0aec0; }
      .slider-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .slider-row input { flex: 1; accent-color: #437bf0; cursor: pointer; }
      .val-text { min-width: 32px; text-align: right; }
    `;
    shadow.append(style);

    const trigger = document.createElement('button');
    trigger.className = 'trigger';
    trigger.innerHTML = '🖼️ <span>Wallpapers</span>';
    trigger.addEventListener('click', () => togglePanel(!panelOpen));

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
          <span>Opacity</span>
          <input type="range" class="range-opacity" min="15" max="100" step="1" value="${prefs.opacity}">
          <span class="val-text val-opacity">${prefs.opacity}%</span>
        </div>
        <div class="slider-row">
          <span>Size</span>
          <input type="range" class="range-scale" min="25" max="250" step="5" value="${prefs.scale}">
          <span class="val-text val-scale">${prefs.scale}%</span>
        </div>
      </div>
    `;

    shadow.append(trigger, panel);

    panel.querySelector('.btn-close').addEventListener('click', () => togglePanel(false));
    panel.querySelector('.btn-off').addEventListener('click', () => {
      prefs.enabled = false;
      applyWallpaperState();
    });

    panel.querySelector('.btn-add').addEventListener('click', async () => {
      const picked = await api.pickImage();
      if (!picked) return;
      images.unshift({ id: picked.id, name: picked.name, file: picked.file, ext: 'jpg' });
      const img = new Image();
      img.src = picked.dataUrl;
      imageCache.set(picked.id, img);
      updateThumbnails();
      selectWallpaper(picked.id);
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
  }

  function togglePanel(open) {
    panelOpen = open;
    if (shadow) {
      const panel = shadow.querySelector('.panel');
      if (panel) panel.hidden = !panelOpen;
    }
  }

  async function init() {
    injectStyles();
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

    new MutationObserver(() => mountCanvas()).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
