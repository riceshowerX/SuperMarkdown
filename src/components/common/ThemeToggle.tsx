import { Moon, Sun } from 'lucide-react';
import IconButton from '../toolbar/IconButton';
import { useTheme } from '../../hooks/useTheme';

/** 明暗切换（PAGES §2：图标表示当前模式） */
export default function ThemeToggle() {
  const { resolved, setTheme } = useTheme();
  const isDark = resolved === 'dark';
  return (
    <IconButton
      icon={isDark ? Moon : Sun}
      label={isDark ? '切换到亮色主题' : '切换到暗色主题'}
      iconSize={20}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    />
  );
}
