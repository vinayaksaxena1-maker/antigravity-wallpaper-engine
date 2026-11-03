/**
 * Antigravity Wallpaper Engine - ASAR Patcher & Installer
 * Author: Vinayak Saxena (@vinayaksaxena1-maker)
 * License: MIT
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

function resolveArchive() {
  const custom = process.argv[3] || process.env.ANTIGRAVITY_ASAR;
  if (custom && fs.existsSync(custom)) return custom;
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, 'Programs', 'antigravity', 'resources', 'app.asar');
  }
  if (process.platform === 'darwin') {
    return '/Applications/Antigravity.app/Contents/Resources/app.asar';
  }
  return '';
}

const archive = resolveArchive();
const backup = archive + '.wallpaper-engine.backup';
const MARKER = '// BEGIN ANTIGRAVITY WALLPAPER ENGINE';
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

function parseAsar(bytes) {
  if (bytes.readUInt32LE(0) !== 4) throw new Error('Invalid ASAR archive format');
  const dataStart = 8 + bytes.readUInt32LE(4);
  const header = JSON.parse(bytes.subarray(16, 16 + bytes.readUInt32LE(12)).toString('utf8'));
  return { header, dataStart };
}

function repackAsar(original, preloadAddition, mainAddition) {
  const { header, dataStart } = parseAsar(original);
  const chunks = [];
  let offset = 0;

  function walk(tree, prefix = '') {
    for (const [name, item] of Object.entries(tree.files || {})) {
      const p = prefix ? prefix + '/' + name : name;
      if (item.files) {
        walk(item, p);
        continue;
      }
      if (item.unpacked || item.link) continue;

      let content = original.subarray(dataStart + Number(item.offset), dataStart + Number(item.offset) + item.size);
      if (p === 'dist/preload.js' || p === 'dist/main.js') {
        const addition = p === 'dist/preload.js' ? preloadAddition : mainAddition;
        content = Buffer.concat([content, Buffer.from('\n\n' + MARKER + '\n'), Buffer.from(addition)]);
        const blockSize = item.integrity?.blockSize || 4194304;
        const blocks = [];
        for (let i = 0; i < content.length; i += blockSize) {
          blocks.push(sha(content.subarray(i, i + blockSize)));
        }
        item.integrity = { algorithm: 'SHA256', hash: sha(content), blockSize, blocks };
      }
      item.offset = String(offset);
      item.size = content.length;
      offset += content.length;
      chunks.push(content);
    }
  }

  walk(header);
  const json = Buffer.from(JSON.stringify(header));
  const padded = Math.ceil((4 + json.length) / 4) * 4;
  const head = Buffer.alloc(8 + padded);
  head.writeUInt32LE(4 + padded, 0);
  head.writeUInt32LE(json.length, 4);
  json.copy(head, 8);
  const size = Buffer.alloc(8);
  size.writeUInt32LE(4, 0);
  size.writeUInt32LE(head.length, 4);
  return Buffer.concat([size, head, ...chunks]);
}

function syncBundledImages() {
  const wpDir = path.join(
    process.env.APPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : os.homedir()),
    'Antigravity',
    'wallpapers'
  );
  const srcDir = path.join(__dirname, '..', 'images');
  if (fs.existsSync(srcDir)) {
    if (!fs.existsSync(wpDir)) fs.mkdirSync(wpDir, { recursive: true });
    for (const f of fs.readdirSync(srcDir)) {
      try {
        fs.copyFileSync(path.join(srcDir, f), path.join(wpDir, f));
      } catch {}
    }
  }
}

function main() {
  const action = process.argv[2] || 'install';
  if (!fs.existsSync(archive)) throw new Error('Antigravity installation not found at: ' + archive);

  if (action === 'restore') {
    if (!fs.existsSync(backup)) throw new Error('No backup archive found at: ' + backup);
    fs.copyFileSync(backup, archive);
    console.log('[SUCCESS] Original Antigravity restored from backup.');
    return;
  }

  const current = fs.readFileSync(archive);
  let original = current;

  // Use existing backup as clean original if available
  if (fs.existsSync(backup)) {
    original = fs.readFileSync(backup);
  } else {
    // Save fresh pristine backup before any change
    fs.writeFileSync(backup, original);
    console.log('[BACKUP] Created safe backup at: ' + backup);
  }

  const preloadCode = fs.readFileSync(path.join(__dirname, 'renderer-hook.js'), 'utf8');
  const mainCode = fs.readFileSync(path.join(__dirname, 'main-hook.js'), 'utf8');

  syncBundledImages();

  const patched = repackAsar(original, preloadCode, mainCode);

  const tmp = archive + '.engine.tmp';
  try {
    fs.writeFileSync(tmp, patched);
    fs.renameSync(tmp, archive);
    console.log('[SUCCESS] Antigravity Wallpaper Engine installed successfully!');
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch {}
    if (['EBUSY', 'EPERM', 'EACCES'].includes(err.code)) {
      throw new Error('Antigravity is currently running. Close Antigravity and retry.');
    }
    throw err;
  }
}

try {
  main();
} catch (e) {
  console.error('[ERROR] ' + e.message);
  process.exitCode = 1;
}
