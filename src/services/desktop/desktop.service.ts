/**
 * 本地 .md 打开服务（架构 §12.2 增强：Electron IPC / Web 优雅降级）
 *
 * 双形态策略：
 * - Electron：preload 白名单桥 window.desktop.openLocalMarkdown() → 主进程 dialog + fs 直读
 * - Web：<input type="file"> 读取（FileReader，UTF-8），能力等价、零依赖
 *
 * 服务层纯逻辑：不 import React；不触碰 StorageService（数据落库由 store 负责）。
 */

export interface LocalFileResult {
  /** 由文件名去扩展名派生（如 readme.md → readme），空则回退文件名 */
  title: string;
  content: string;
}

/** 是否运行在 Electron 桌面形态（preload 已注入白名单桥） */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && !!window.desktop?.openLocalMarkdown;
}

/** 打开本地 Markdown 文件；用户取消返回 null */
export async function openLocalMarkdown(): Promise<LocalFileResult | null> {
  if (isDesktop()) {
    return window.desktop!.openLocalMarkdown();
  }
  return openViaFileInput();
}

/** 由文件名派生标题：去最后一个扩展名；无扩展名则用原文件名 */
function titleFromName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '') || fileName;
}

/** Web 形态降级：原生文件选择器读取文本（UTF-8） */
function openViaFileInput(): Promise<LocalFileResult | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.mdown,.mkd,.txt,text/markdown,text/plain';
    input.style.display = 'none';
    document.body.appendChild(input);

    let settled = false;
    const done = (result: LocalFileResult | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const cleanup = () => {
      input.remove();
      window.removeEventListener('focus', onWindowFocus);
    };

    // 取消兜底：Firefox 触发 cancel 事件；Chrome 无事件，靠窗口重新聚焦检测
    const onWindowFocus = () => {
      setTimeout(() => {
        if (!input.files?.length) done(null);
      }, 300);
    };
    input.addEventListener('cancel', () => done(null));
    window.addEventListener('focus', onWindowFocus);

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        done(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => done({ title: titleFromName(file.name), content: String(reader.result ?? '') });
      reader.onerror = () => done(null);
      reader.readAsText(file, 'utf-8');
    });

    input.click();
  });
}
