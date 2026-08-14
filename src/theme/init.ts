import type { Theme } from '../types/models';
import { THEME_STORAGE_KEY } from '../config/constants';

/** 解析最终主题（system → prefers-color-scheme） */
export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') return theme;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/**
 * 挂载前初始化主题，防止明暗闪烁（Spec §8 / PAGES 附）
 * 在 main.tsx 中作为第一个 import 执行。
 */
export function initTheme(): void {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    /* 忽略 */
  }
  const theme: Theme = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  const resolved = resolveTheme(theme);
  document.documentElement.dataset.theme = resolved;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'color-scheme';
    document.head.appendChild(meta);
  }
  meta.content = resolved;
}

initTheme();
