import { useMemo } from 'react';
import { FileText, FilePlus2 } from 'lucide-react';
import { useDocumentsStore } from '../../stores/documents.store';
import DocumentItem from './DocumentItem';

/** 文档列表：loading 骨架 / 空态引导 / 过滤结果（PAGES §3） */
export default function DocumentList({ onNavigate }: { onNavigate?: () => void }) {
  const documents = useDocumentsStore((s) => s.documents);
  const searchQuery = useDocumentsStore((s) => s.searchQuery);
  const loading = useDocumentsStore((s) => s.loading);
  const createDocument = useDocumentsStore((s) => s.createDocument);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((d) => d.title.toLowerCase().includes(q));
  }, [documents, searchQuery]);

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
          {documents.length === 0 ? '创建第一个文档，开始写作' : '没有匹配的文档'}
        </p>
        {documents.length === 0 && (
          <button
            type="button"
            onClick={() => void createDocument()}
            className="inline-flex h-11 items-center gap-1.5 rounded-md bg-accent px-3 tx-sm wt-medium text-on-accent transition-colors duration-150 hover:bg-accent-hover md:h-9"
          >
            <FilePlus2 size={16} strokeWidth={1.8} aria-hidden />
            新建文档
          </button>
        )}
      </div>
    );
  }

  return (
    <nav className="sm-scroll flex-1 space-y-0.5 overflow-y-auto px-2 pb-2" aria-label="文档列表">
      {filtered.map((doc) => (
        <DocumentItem key={doc.id} doc={doc} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}
