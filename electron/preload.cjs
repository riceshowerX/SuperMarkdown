/**
 * SuperMarkdown Electron preload（架构 §12.2 / §12.3 最小权限白名单）
 *
 * - sandbox:true 下可用受限 require：仅 electron 子集（contextBridge/ipcRenderer 等）
 * - 只暴露白名单方法 openLocalMarkdown，不透传 ipcRenderer / node 能力
 * - 渲染进程不可直接调用原生 API，必须经此桥
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  /** 打开本地 Markdown：主进程 dialog 选文件 + fs 读取 → {title, content} | null（取消） */
  openLocalMarkdown: () => ipcRenderer.invoke('open-local-markdown'),
});
