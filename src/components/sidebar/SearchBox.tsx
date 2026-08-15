import { Search, X } from 'lucide-react';
import { useDocumentsStore } from '../../stores/documents.store';

/** 搜索框（实时过滤列表） */
export default function SearchBox() {
  const searchQuery = useDocumentsStore((s) => s.searchQuery);
  const setSearchQuery = useDocumentsStore((s) => s.setSearchQuery);

  return (
    <div className="relative">
      <Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-2" aria-hidden />
      <input
        type="search"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="搜索文档"
        aria-label="搜索文档"
        className="h-11 w-full rounded-md border border-border bg-surface-sunken pl-8 pr-8 tx-sm text-fg placeholder:text-fg-2 outline-none focus-visible:border-transparent md:h-9"
      />
      {searchQuery && (
        <button
          type="button"
          onClick={() => setSearchQuery('')}
          aria-label="清除搜索"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-2.5 text-fg-2 hover:bg-surface-warm md:p-1"
        >
          <X size={14} aria-hidden />
        </button>
      )}
    </div>
  );
}
