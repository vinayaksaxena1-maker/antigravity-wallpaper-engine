<div align="center">

# 🖼️ Antigravity Wallpaper Engine

### *Break free from boring stock layouts. Customize your IDE your way — stunning custom wallpapers, adaptive frosted glass, and rock-solid performance.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.1.0-emerald.svg)](package.json)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Electron-9cf.svg)](https://antigravity.google)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/vinayaksaxena1-maker/antigravity-wallpaper-engine/pulls)

<br/>

<img src="assets/hero-preview.png" alt="Antigravity Wallpaper Engine Preview" width="850" style="border-radius: 12px; box-shadow: 0 16px 40px rgba(0,0,0,0.6);" />

<br/>

*Antigravity IDE running live with custom wallpapers, adaptive frosted glass sidebar, and deep glass capsules.*

</div>

---

## ⚡ Why Antigravity Wallpaper Engine?

Most third-party IDE mods inject heavy procedural noise loops, continuous math recalculations, and thousands of lines of legacy bloat that waste CPU cycles and battery life.

**Antigravity Wallpaper Engine** is engineered under strict clean-room, pragmatic principles:
- **Zero Bloat:** Lightweight, modular codebase without unused dependencies.
- **0% Idle CPU:** Zero runtime background loops. Renders statically and efficiently via hardware-accelerated HTML5 Canvas.
- **Adaptive Frosted Glass (Mica Effect):** Dynamically extracts edge colors from your active wallpaper (`backdrop-filter: blur(24px)`) so sidebars and panels seamlessly melt into the art.
- **Rock-Solid Contrast & Readability:** Deep black glass capsules (`rgba(10, 14, 22, 0.88)`) with pure white high-contrast text for all code snippets, paths, and inline badges (`<code>`).
- **Automatic Light/Dark Theme Switching:** Features ITU-R BT.709 relative luminance detection — automatically switches the UI to light or dark frosted glass depending on the brightness of your chosen wallpaper.
- **Safe & Non-Destructive:** Performs automatic SHA-256 backup verification. Restore stock Antigravity anytime with 1 click.

---

## 📦 What's Inside?

Out of the box, the engine comes pre-packaged with two hand-crafted high-resolution wallpapers:
- 🌙 **`Dark.jpg`** — Deep, atmospheric samurai dusk artwork tuned for dark-mode flow states.
- ☀️ **`Light.jpg`** — Warm golden sunrise landscape tuned for bright, energetic daytime coding.

---

## ✨ Features

- 🖼️ **Any Custom Image or GIF:** Set any `.jpg`, `.jpeg`, `.png`, `.webp`, or `.gif` as your live IDE workbench background.
- 🗂️ **Native Windows File Picker (`+ Image`):** Pick wallpapers directly from any drive or folder on your PC using the native OS file dialog.
- 🔍 **Live Zoom & Scaling Slider:** Dynamically scale your wallpaper from `25%` to `250%` with auto-centering.
- 💡 **Opacity & Brightness Blending:** Adjust wallpaper visibility from `15%` to `100%` with smooth dark base fading.
- 🌓 **Theme Controls (Auto / Light / Dark):** Let the engine automatically detect wallpaper luminance, or manually force Light or Dark mode.
- 🔮 **Full-Window Frosted Glass:** Translucent, blur-filtered surfaces for the sidebar, chat composer, and floating cards.
- ⌨️ **Quick Keyboard Shortcut:** Toggle the wallpaper control panel anytime using `Ctrl + Alt + W`.
- 🔄 **1-Click Universal Installer & Rollback:** Safe batch scripts with auto Node.js path discovery.

---

## 🚀 Quick Start (Installation)

### Option 1: Automatic 1-Click Install (Recommended)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/vinayaksaxena1-maker/antigravity-wallpaper-engine.git
   cd antigravity-wallpaper-engine
   ```
2. Double-click **`install.bat`**.
3. When prompted, press `Y` to close Antigravity and patch the archive.
4. Launch Antigravity — your live wallpaper engine is active!

### Option 2: Command Line Install

```bash
node src/installer.cjs install
```

---

## 🎮 How to Use

1. Click the **Wallpapers** button in the top-right title bar of Antigravity (or press `Ctrl + Alt + W`).
2. Click **`+ Image`** to load any picture from your PC.
3. Switch between **Auto**, **Light**, or **Dark** mode to match your preferred theme.
4. Adjust the **Opacity** and **Size** sliders to your preference.
5. Click **Off** anytime to restore default dark surfaces.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Google Antigravity                       │
│                                                             │
│  ┌────────────────────────┐     ┌────────────────────────┐  │
│  │   Frosted Glass Nav    │     │  Smart Content Scrim   │  │
│  │  (Dynamic Edge Tint)   │     │  (High-Contrast Text)  │  │
│  └────────────────────────┘     └────────────────────────┘  │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  ▼ Full-Window HTML5 Canvas Layer (z-index: -1)             │
│    Auto-centered, DPI-scaled hardware-accelerated image     │
└─────────────────────────────────────────────────────────────┘
```

- **`src/main-hook.js`:** Runs in Electron's Main Process. Handles IPC requests to launch the native OS file picker and safely stream base64 image data without violating Content Security Policy (CSP).
- **`src/renderer-hook.js`:** Injected into Antigravity's preload. Dynamically mounts the isolated canvas across `.agy-shell`, analyzes image luminance, injects adaptive frosted glass tokens, and renders the settings popover inside an isolated Shadow DOM.
- **`src/installer.cjs`:** Zero-dependency ASAR patcher with SHA-256 integrity verification, automated pristine backups, and image bundle synchronization.

---

## 🔄 Uninstallation (Restore to Stock)

To restore Antigravity to 100% factory original condition:
- Double-click **`restore.bat`**, OR
- Run:
  ```bash
  node src/installer.cjs restore
  ```

---

## 📜 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

Developed with ❤️ by **[Vinayak Saxena](https://github.com/vinayaksaxena1-maker)**.
