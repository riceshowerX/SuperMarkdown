/**
 * SuperMarkdown Electron 主进程（架构 §12.2 / §12.3 安全加固）
 *
 * 职责：
 * - 创建 BrowserWindow 并加载 dist/index.html（纯静态，离线可用）
 * - 强制安全基线：contextIsolation / sandbox / webSecurity，渲染进程零 Node 权限
 * - 外链拦截：setWindowOpenHandler + will-navigate（默认拒绝，SM-58）一律走系统浏览器
 * - 唯一原生能力：open-local-markdown（dialog + fs 读取，经 preload 白名单暴露）
 *
 * 安全要点（§12.3 + 批次 1 加固逐项落实）：
 * 1. 渲染进程无 Node 权限：nodeIntegration:false + sandbox:true + contextIsolation:true
 * 2. 所有原生能力经 preload 白名单 IPC（contextBridge 最小暴露）
 * 3. 禁用 webview 标签：webviewTag:false
 * 4. 本地内容走 file://，不启用 http://localhost 远程加载
 * 5. CSP 双防线：index.html meta（SM-32 补充响应头注入）
 * 6. 运行时权限全量拒绝（SM-61：setPermissionRequestHandler / setPermissionCheckHandler）
 * 7. 本地文件导入：20MB 上限 + 二进制嗅探 + 移除「所有文件」过滤器 + 错误信息脱敏（SM-33）
 */
const { app, BrowserWindow, dialog, ipcMain, session, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const nodeFs = require('node:fs');

/** 导入文件硬上限（SM-33）：防止超大文件拖垮主进程与 IndexedDB 配额 */
const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

/** 仅放行 http/https/mailto 外链，其余（file: 内导航、javascript: 等）一律拒绝 */
function isSafeExternal(url) {
  try {
    const protocol = new URL(url).protocol;
    return protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:';
  } catch {
    return false;
  }
}

/**
 * 阻止渲染进程导航到应用之外（SM-58：默认拒绝语义）。
 * 先 preventDefault，再仅对「同一 file: 文件内的跳转」（锚点/刷新）经 loadURL 放行；
 * URL 解析失败一律维持拒绝——绝不因异常路径绕过守卫。
 * 防递归：loadURL 本身会再次触发 will-navigate，同一目标 URL 短窗口内只放行一次。
 */
function attachNavigationGuard(win) {
  let lastAllowedNav = { url: '', at: 0 };

  win.webContents.on('will-navigate', (event, url) => {
    event.preventDefault(); // 默认拒绝：任何未显式放行的导航都被拦截
    try {
      const currentUrl = new URL(win.webContents.getURL());
      const targetUrl = new URL(url);
      const sameFile =
        currentUrl.protocol === 'file:' &&
        targetUrl.protocol === 'file:' &&
        targetUrl.pathname === currentUrl.pathname;
      if (!sameFile) return; // 保持拒绝
      if (isSafeExternal(url)) {
        void shell.openExternal(url);
        return;
      }
      // 防递归：500ms 内同一目标的重复导航事件不再转 loadURL
      const now = Date.now();
      if (lastAllowedNav.url === url && now - lastAllowedNav.at < 500) return;
      lastAllowedNav = { url, at: now };
      void win.loadURL(url); // 同一文件内的锚点跳转 / 刷新放行
    } catch {
      /* URL 解析失败 → 维持拒绝 */
    }
  });

  // 新窗口请求（target=_blank / window.open）一律拒绝并转系统浏览器
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternal(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
}

/** SM-32：响应头注入 CSP（与 index.html 的 meta CSP 互为冗余防线） */
function attachCspHeader() {
  const policy =
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; " +
    "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'";
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy],
      },
    });
  });
}

/** SM-61：全量拒绝渲染进程的运行时权限请求（摄像头/麦克风/地理位置/通知等） */
function attachPermissionGuards() {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    console.warn('[SuperMarkdown] denied permission request:', permission);
    callback(false);
  });
  session.defaultSession.setPermissionCheckHandler(() => false);
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

  // SM-27：构建产物缺失时给出明确错误，而非白屏
  const distIndex = path.join(__dirname, '..', 'dist', 'index.html');
  if (!nodeFs.existsSync(distIndex)) {
    dialog.showErrorBox(
      'SuperMarkdown',
      '未找到前端构建产物（dist/index.html）。\n请先执行 npm run build 后再启动桌面端。',
    );
    app.quit();
    return win;
  }

  // 生产模式：加载构建产物（file:// 协议，CSP 生效）
  void win.loadFile(distIndex);

  return win;
}

/**
 * 打开本地 .md：dialog 选文件 → fs 读取 → 返回 {title, content}；取消返回 null
 * SM-33：20MB 上限、二进制嗅探（\u0000 拒绝）、移除「所有文件」过滤器、
 * 错误信息脱敏——不把含绝对路径的 err.message 回传渲染进程。
 */
async function handleOpenLocalMarkdown() {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  const result = await dialog.showOpenDialog(win, {
    title: '打开 Markdown 文件',
    buttonLabel: '打开',
    properties: ['openFile'],
    filters: [
      { name: 'Markdown 文档', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath = result.filePaths[0];
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error('SM_NOT_A_FILE');
    if (stat.size > MAX_IMPORT_BYTES) throw new Error('SM_TOO_LARGE');

    const content = await fs.readFile(filePath, 'utf8');
    if (content.includes('\u0000')) throw new Error('SM_BINARY'); // 二进制嗅探

    const base = path.basename(filePath);
    const title = base.replace(/\.[^.]+$/, '') || base;
    return { title, content };
  } catch (err) {
    console.error('[SuperMarkdown] read local markdown failed:', err && err.code);
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'SM_TOO_LARGE') {
      throw new Error(`文件超过 ${MAX_IMPORT_BYTES / 1024 / 1024}MB 上限，已拒绝打开`);
    }
    if (msg === 'SM_BINARY') {
      throw new Error('文件似乎是二进制格式，已拒绝打开');
    }
    if (msg === 'SM_NOT_A_FILE') {
      throw new Error('所选路径不是文件');
    }
    throw new Error('读取文件失败，请确认文件可访问且不超过 20MB');
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
    attachPermissionGuards(); // SM-61
    attachCspHeader();        // SM-32
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
