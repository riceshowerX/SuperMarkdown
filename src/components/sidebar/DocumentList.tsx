import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, FileText, FilePlus2, X } from 'lucide-react';
import { useDocumentsStore } from '../../stores/documents.store';
import { groupDocumentsByTime, sortDocuments, type DocumentSort } from '../../utils/documentGroups';
import DocumentItem from './DocumentItem';

/** 文档列表：loading 骨架 / 空态引导 / 时间分组 + 排序菜单 + 过滤结果（UIUX-V2 §4.3） */
export default function DocumentList({ onNavigate }: { onNavigate?: () => void }) {
  const documents = useDocumentsStore((s) => s.documents);
  const searchQuery = useDocumentsStore((s) => s.searchQuery);
  const resetSearch = useDocumentsStore((s) => s.resetSearch);
  const loading = useDocumentsStore((s) => s.loading);
  const createDocument = useDocumentsStore((s) => s.createDocument);

  const [sortBy, setSortBy] = useState<DocumentSort>('updated');
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // 键盘导航：↑↓ 切换文档项，Enter 打开（UIUX-V2 §8 批次3）
  const onNavKeyDown = (e: React.KeyboardEvent) => {
    const items = Array.from(navRef.current?.querySelectorAll<HTMLElement>('[data-doc-id]') ?? []);
    if (items.length === 0) return;
    const idx = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[Math.min(items.length - 1, idx + 1)]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[Math.max(0, idx - 1)]?.focus();
    } else if (e.key === 'Enter' && idx >= 0) {
      e.preventDefault();
      (document.activeElement as HTMLElement).click();
    }
  };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((d) => d.title.toLowerCase().includes(q));
  }, [documents, searchQuery]);

  const sorted = useMemo(() => sortDocuments(filtered, sortBy), [filtered, sortBy]);
  const groups = useMemo(() => (sortBy === 'updated' ? groupDocumentsByTime(sorted) : []), [sorted, sortBy]);

  if (loading) {
    return (
      <div className="flex-1 space-y-2 overflow-y-auto p-3" aria-busy="true" aria-label="加载中">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton-line h-9 w-full" />
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
        <FileText size={24} className="text-fg-2" aria-hidden />
        <p className="tx-sm text-muted lh-body">
          {documents.length === 0 ? '创建第一个文档，开始写作' : searchQuery.trim() ? '没有匹配的文档' : '还没有文档'}
        </p>
        {documents.length === 0 ? (
          <button
            type="button"
            onClick={() => void createDocument()}
            className="inline-flex h-11 items-center gap-1.5 rounded-md bg-accent px-3 tx-sm wt-medium text-on-accent transition-colors duration-150 hover:bg-accent-hover md:h-9"
          >
            <FilePlus2 size={16} strokeWidth={1.8} aria-hidden />
            新建文档
          </button>
        ) : (
          <button
            type="button"
            onClick={resetSearch}
            className="inline-flex h-11 items-center gap-1.5 rounded-md border border-border bg-surface px-3 tx-sm wt-medium text-fg transition-colors duration-150 hover:bg-surface-sunken md:h-9"
          >
            <X size={14} strokeWidth={1.8} aria-hidden />
            清除搜索
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 列表头：排序菜单 */}
      <div className="flex items-center justify-end px-3 pb-1">
        <div ref={sortRef} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={sortOpen}
            onClick={() => setSortOpen((v) => !v)}
            className="inline-flex h-8 items-center gap-1 rounded-md px-1.5 tx-xs text-fg-2 transition-colors duration-150 hover:bg-surface-sunken hover:text-fg"
          >
            <ArrowUpDown size={12} strokeWidth={1.8} aria-hidden />
            {sortBy === 'updated' ? '最近修改' : '标题 A-Z'}
          </button>
          {sortOpen && (
            <div
              role="menu"
              aria-label="排序方式"
              className="absolute right-0 top-full z-dropdown mt-1 w-32 rounded-[var(--radius-lg)] bg-surface-raised p-1 shadow-[var(--elev-popover)]"
            >
              <SortItem label="最近修改" active={sortBy === 'updated'} onClick={() => { setSortBy('updated'); setSortOpen(false); }} />
              <SortItem label="标题 A-Z" active={sortBy === 'title'} onClick={() => { setSortBy('title'); setSortOpen(false); }} />
            </div>
          )}
        </div>
      </div>

      <nav
        ref={navRef}
        tabIndex={0}
        onKeyDown={onNavKeyDown}
        aria-label="文档列表（↑↓ 切换，Enter 打开）"
        className="sm-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2 outline-none"
      >
        {sortBy === 'updated' ? (
          groups.map((group) => (
            <section key={group.key} aria-label={group.label}>
              <h3 className="trk-caps px-2 pb-1 pt-2 tx-xs wt-medium text-fg-2">{group.label}</h3>
              <div className="space-y-0.5">
                {group.docs.map((doc) => (
                  <DocumentItem key={doc.id} doc={doc} onNavigate={onNavigate} />
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="space-y-0.5">
            {sorted.map((doc) => (
              <DocumentItem key={doc.id} doc={doc} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </nav>
    </div>
  );
}

function SortItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      className={`flex min-h-11 w-full items-center rounded-md px-2 py-2.5 tx-sm transition-colors duration-150 md:min-h-0 md:py-1.5 ${
        active ? 'bg-accent-soft wt-medium text-accent' : 'text-fg hover:bg-surface-sunken'
      }`}
    >
      {label}
    </button>
  );
}
