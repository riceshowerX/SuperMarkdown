/**
 * SuperMarkdown Electron 主进程（架构 §12.2 / §12.3 安全加固）
 *
 * 职责：
 * - 创建 BrowserWindow 并加载 dist/index.html（纯静态，离线可用）
 * - 强制安全基线：contextIsolation / sandbox / webSecurity，渲染进程零 Node 权限
 * - 外链拦截：setWindowOpenHandler + will-navigate 一律走系统浏览器
 * - 唯一原生能力：open-local-markdown（dialog + fs 读取，经 preload 白名单暴露）
 *
 * 安全要点（§12.3 逐项落实）：
 * 1. 渲染进程无 Node 权限：nodeIntegration:false + sandbox:true + contextIsolation:true
 * 2. 所有原生能力经 preload 白名单 IPC（contextBridge 最小暴露）
 * 3. 禁用 webview 标签：webviewTag:false
 * 4. 本地内容走 file://，不启用 http://localhost 远程加载
 * 5. CSP 随 index.html 在 Electron 中同样生效
 */
const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

/** 仅放行 http/https/mailto 外链，其余（file: 内导航、javascript: 等）一律拒绝 */
function isSafeExternal(url) {
  try {
    const protocol = new URL(url).protocol;
    return protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:';
  } catch {
    return false;
  }
}

/** 阻止渲染进程导航到应用之外；同源 file:// 内的 hash 跳转不拦截 */
function attachNavigationGuard(win) {
  win.webContents.on('will-navigate', (event, url) => {
    const current = win.webContents.getURL();
    if (url === current) return; // 同页刷新
    const currentUrl = new URL(current);
    const targetUrl = new URL(url);
    const sameFile = currentUrl.protocol === 'file:' && targetUrl.protocol === 'file:' && targetUrl.pathname === currentUrl.pathname;
    if (sameFile) return; // 文件内锚点跳转
    event.preventDefault();
    if (isSafeExternal(url)) void shell.openExternal(url);
  });

  // 新窗口请求（target=_blank / window.open）一律拒绝并转系统浏览器
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternal(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 640,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    title: 'SuperMarkdown',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      spellcheck: false,
    },
  });

  attachNavigationGuard(win);

  // 渲染就绪再显示，避免白屏闪烁
  win.once('ready-to-show', () => win.show());

  // 生产模式：加载构建产物（file:// 协议，CSP 生效）
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  return win;
}

/** 打开本地 .md：dialog 选文件 → fs 读内容 → 返回 {title, content}；取消返回 null */
async function handleOpenLocalMarkdown() {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  const result = await dialog.showOpenDialog(win, {
    title: '打开 Markdown 文件',
    buttonLabel: '打开',
    properties: ['openFile'],
    filters: [
      { name: 'Markdown 文档', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath = result.filePaths[0];
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const base = path.basename(filePath);
    const title = base.replace(/\.[^.]+$/, '') || base;
    return { title, content };
  } catch (err) {
    console.error('[SuperMarkdown] read local markdown failed:', err);
    throw new Error(`读取文件失败：${err.message}`);
  }
}

// 单实例锁：防止多开导致 IndexedDB(file://) 并发写冲突
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    ipcMain.handle('open-local-markdown', handleOpenLocalMarkdown);
    createWindow();

    // macOS：点击 Dock 图标且无窗口时重建
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
