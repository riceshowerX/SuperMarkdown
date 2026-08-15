import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Focus } from 'lucide-react';
import { useEditorStore } from '../../stores/editor.store';
import { useDocumentsStore } from '../../stores/documents.store';
import { useUiStore } from '../../stores/ui.store';
import { computeStats } from '../../services/stats/stats.service';
import { SaveIndicator } from './ConfirmModal';

/** 状态栏（C 版高 26px chrome 退化；PAGES §7）：字数统计 + 打字机开关 + 保存状态 + 临时存储提示 */
export default function StatusBar() {
  const content = useEditorStore((s) => s.content);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const retrySave = useEditorStore((s) => s.retrySave);
  const fallbackMode = useDocumentsStore((s) => s.fallbackMode);
  const typewriterMode = useUiStore((s) => s.typewriterMode);
  const toggleTypewriter = useUiStore((s) => s.toggleTypewriter);
  const stats = useMemo(() => computeStats(content), [content]);

  // 已保存后淡为圆点（2s 由 store 转 idle 后仍保留小圆点）
  const [savedOnce, setSavedOnce] = useState(false);
  useEffect(() => {
    if (saveStatus === 'saved') setSavedOnce(true);
    if (saveStatus === 'saving' || saveStatus === 'error') setSavedOnce(false);
  }, [saveStatus]);

  return (
    <footer className="flex h-[var(--layout-statusbar-h)] shrink-0 items-center gap-4 border-t border-border-soft bg-bg px-3 tx-xs text-muted">
      <span className="font-mono tabular-nums">{stats.chars.toLocaleString()} 字</span>
      <span className="hidden sm:inline">{stats.words} 词</span>
      <span className="hidden sm:inline">{stats.lines} 行</span>
      <span className="hidden md:inline">阅读约 {stats.readingMinutes} 分钟</span>
      {fallbackMode && (
        <span className="inline-flex items-center gap-1 text-warn" title="浏览器不支持 IndexedDB，数据可能丢失">
          临时存储模式
        </span>
      )}
      <div className="flex-1" />
      <button
        type="button"
        onClick={toggleTypewriter}
        aria-pressed={typewriterMode}
        aria-label={typewriterMode ? '关闭打字机模式' : '开启打字机模式'}
        title={`打字机模式 ${typewriterMode ? '开' : '关'}（Ctrl+Shift+T）`}
        className={`inline-flex h-7 items-center gap-1 rounded px-1.5 transition-colors duration-150 ${
          typewriterMode ? 'bg-accent-soft text-accent' : 'text-fg-2 hover:bg-surface-warm hover:text-fg'
        }`}
      >
        <Focus size={12} aria-hidden />
        {typewriterMode && <span>打字机</span>}
      </button>
      {saveStatus === 'error' ? (
        <span className="inline-flex items-center gap-1 text-danger" role="alert">
          <AlertCircle size={12} aria-hidden />
          保存失败
          <button
            type="button"
            onClick={() => void retrySave()}
            className="ml-1 inline-flex h-7 items-center rounded px-1.5 tx-xs wt-medium text-danger hover:bg-surface-warm"
          >
            重试
          </button>
        </span>
      ) : saveStatus === 'saved' || saveStatus === 'saving' ? (
        <SaveIndicator status={saveStatus} />
      ) : savedOnce ? (
        <span className="flex items-center" aria-label="已保存" title="已保存">
          <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
        </span>
      ) : null}
    </footer>
  );
}
