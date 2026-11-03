/**
 * Antigravity Wallpaper Engine - Main Process Hook
 * Author: Vinayak Saxena (@vinayaksaxena1-maker)
 * License: MIT
 */
(() => {
  const { app, ipcMain, dialog, BrowserWindow } = require('electron');
  const fs = require('fs'), path = require('path');

  const prefFile = () => path.join(app.getPath('userData'), 'wallpaper-engine-prefs.json');
  const wpDir = () => path.join(app.getPath('userData'), 'wallpapers');

  ipcMain.handle('wallpaper:get-prefs', () => {
    try { return JSON.parse(fs.readFileSync(prefFile(), 'utf8')); }
    catch { return {}; }
  });

  ipcMain.handle('wallpaper:save-prefs', (_event, data) => {
    try {
      if (typeof data !== 'object' || data === null) return false;
      fs.writeFileSync(prefFile(), JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch { return false; }
  });

  ipcMain.handle('wallpaper:list-images', () => {
    const dir = wpDir(), exts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const list = [];
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      for (const f of fs.readdirSync(dir)) {
        const ext = path.extname(f).toLowerCase();
        if (exts.includes(ext)) {
          const name = path.basename(f, ext).replace(/[_-]/g, ' ');
          list.push({ id: f, name, file: path.join(dir, f), ext: ext.slice(1) });
        }
      }
    } catch {}
    return list;
  });

  ipcMain.handle('wallpaper:get-image', (_event, filePath) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) return null;
      const ext = path.extname(filePath).toLowerCase().replace('.', '');
      const mime = ext === 'jpg' ? 'jpeg' : ext;
      return 'data:image/' + mime + ';base64,' + fs.readFileSync(filePath).toString('base64');
    } catch { return null; }
  });

  ipcMain.handle('wallpaper:pick-image', async () => {
    try {
      const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      const res = await dialog.showOpenDialog(win, {
        title: 'Choose Wallpaper Image',
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }]
      });
      if (res.canceled || !res.filePaths || !res.filePaths.length) return null;
      const src = res.filePaths[0];
      const ext = path.extname(src).toLowerCase();
      const base = path.basename(src, ext);
      const id = base.replace(/[^a-zA-Z0-9_-]/g, '_') + '_' + Date.now().toString(36) + ext;
      const dir = wpDir();
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const dest = path.join(dir, id);
      fs.copyFileSync(src, dest);
      const mime = ext.replace('.', '') === 'jpg' ? 'jpeg' : ext.replace('.', '');
      return {
        id,
        name: base.replace(/[_-]/g, ' '),
        file: dest,
        dataUrl: 'data:image/' + mime + ';base64,' + fs.readFileSync(dest).toString('base64')
      };
    } catch { return null; }
  });
})();
