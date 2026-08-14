import { useEffect } from 'react';
import { useUiStore } from '../stores/ui.store';
import { THEME_STORAGE_KEY } from '../config/constants';
import { resolveTheme } from '../theme/init';

/** 主题桥接：应用 data-theme + 持久化 + color-scheme 同步 */
export function useTheme() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  useEffect(() => {
    const resolved = resolveTheme(theme);
    document.documentElement.dataset.theme = resolved;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* 忽略持久化失败 */
    }
    const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
    if (meta) meta.content = resolved;
  }, [theme]);

  return { theme, resolved: resolveTheme(theme), setTheme };
}
