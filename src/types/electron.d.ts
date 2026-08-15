/** Electron preload 注入的桌面桥类型（Web 形态下 window.desktop 不存在，须判空） */

export interface DesktopBridge {
  /** 打开本地 Markdown：主进程 dialog 选文件 + fs 读取；用户取消返回 null */
  openLocalMarkdown(): Promise<{ title: string; content: string } | null>;
}

declare global {
  interface Window {
    /** Electron 桌面形态注入；Web 形态为 undefined（走 <input type=file> 降级） */
    desktop?: DesktopBridge;
  }
}

export {};
