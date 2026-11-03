# Antigravity Wallpaper Engine 🖼️

A lightweight, modern, and high-performance custom wallpaper engine for the [Google Antigravity](https://antigravity.google) desktop IDE.

---

## ✨ Features

- **Custom Image & GIF Support:** Set any `.jpg`, `.png`, `.webp`, or `.gif` as your live workbench background.
- **Modern Glassmorphism (Frosted Glass):** Soft, adaptive transparency on the sidebar, composer, and panels with native background blur.
- **In-App Picker (`+ Image`):** Choose any wallpaper file directly from your computer via native Windows File Explorer.
- **Live Scaling & Opacity:**
  - **Zoom / Size Control:** Scale from `25%` to `250%` with auto-centering.
  - **Opacity / Brightness:** Tune background visibility from `15%` to `100%`.
- **Zero Bloat & Zero CPU Overhead:** Built entirely with lightweight HTML5 Canvas and CSS variables (~180 lines total). 0% CPU consumption when idle.
- **Keyboard Shortcut:** Toggle wallpaper picker anytime with `Ctrl + Alt + W`.
- **1-Click Safe Installer & Restore:** Automatic verified backup before any modification.

---

## 🚀 Quick Start (Installation)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/vinayaksaxena1-maker/antigravity-wallpaper-engine.git
   ```
2. Close **Antigravity**.
3. Double-click **`install.bat`** (or run `node src/installer.cjs install`).
4. Re-open Antigravity!

---

## 🎨 How to Use

1. Click the **Wallpapers** button at the top-right of Antigravity (or press `Ctrl + Alt + W`).
2. Click **`+ Image`** to pick any photo from your PC.
3. Use the **Opacity** and **Size** sliders to adjust brightness and zoom to your liking.

---

## 🔄 Uninstallation / Restore Stock

1. Close Antigravity.
2. Double-click **`restore.bat`** (or run `node src/installer.cjs restore`).
3. Your original, unmodified Antigravity is restored instantly.

---

## 📜 License

MIT License © 2026 Vinayak Saxena ([@vinayaksaxena1-maker](https://github.com/vinayaksaxena1-maker))
