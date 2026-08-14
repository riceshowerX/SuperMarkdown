import { useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import { useEditorStore } from '../../stores/editor.store';
import { useDocumentsStore } from '../../stores/documents.store';
import { computeStats } from '../../services/stats/stats.service';
import { SaveIndicator } from './ConfirmModal';

/** 状态栏（高 28px）：字数统计 + 保存状态（含失败重试）+ 临时存储提示（PAGES §6） */
export default function StatusBar() {
  const content = useEditorStore((s) => s.content);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const retrySave = useEditorStore((s) => s.retrySave);
  const fallbackMode = useDocumentsStore((s) => s.fallbackMode);
  const stats = useMemo(() => computeStats(content), [content]);

  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-border-soft bg-bg px-3 tx-xs text-muted">
      <span className="font-mono tabular-nums">{stats.chars.toLocaleString()} 字</span>
      <span className="hidden sm:inline">{stats.words} 词</span>
      <span className="hidden sm:inline">{stats.lines} 行</span>
      <span>阅读约 {stats.readingMinutes} 分钟</span>
      {fallbackMode && (
        <span className="inline-flex items-center gap-1 text-warn" title="浏览器不支持 IndexedDB，数据可能丢失">
          临时存储模式
        </span>
      )}
      <div className="flex-1" />
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
      ) : (
        <SaveIndicator status={saveStatus} />
      )}
    </footer>
  );
}
