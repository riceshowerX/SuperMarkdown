import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useDocumentsStore } from '../../stores/documents.store';
import { useUiStore } from '../../stores/ui.store';
import { exportCurrentDocument } from '../../app/actions';
import { runEditorCommand } from '../../hooks/editorCommandBus';
import { resolveTheme } from '../../theme/init';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { buildPaletteItems, groupPaletteItems, readRecent, recordRecent, type BuildItemsDeps, type RecentDoc } from './paletteItems';
import PaletteRow from './PaletteRow';

/** 命令面板（Cmd+K，UIUX-V2 §5.2）：最近使用/动作/文档搜索/格式/帮助，自建轻量版 */
export default function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);

  const documents = useDocumentsStore((s) => s.documents);
  const createDocument = useDocumentsStore((s) => s.createDocument);
  const setActiveDocId = useDocumentsStore((s) => s.setActiveDocId);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const typewriterMode = useUiStore((s) => s.typewriterMode);
  const toggleTypewriter = useUiStore((s) => s.toggleTypewriter);

  const isMobile = useMediaQuery('(max-width: 767px)');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<RecentDoc[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => setOpen(false);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setRecent(readRecent());
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  const items = useMemo(() => {
    const resolvedDark = resolveTheme(theme) === 'dark';
    const deps: BuildItemsDeps = {
      query,
      documents,
      recent,
      theme,
      resolvedDark,
      typewriterMode,
      createDocument: () => {
        close();
        void createDocument();
      },
      exportHtml: () => {
        close();
        void exportCurrentDocument('html');
      },
      exportTxt: () => {
        close();
        void exportCurrentDocument('txt');
      },
      setViewMode: (m: Parameters<typeof setViewMode>[0]) => {
        close();
        setViewMode(m);
      },
      setTheme: (t: Parameters<typeof setTheme>[0]) => {
        close();
        setTheme(t);
      },
      toggleTypewriter: () => {
        close();
        toggleTypewriter();
      },
      openShortcuts: () => {
        close();
        setShortcutsOpen(true);
      },
      openDoc: (id: string, title: string) => {
        recordRecent(id, title);
        setRecent(readRecent());
        close();
        void setActiveDocId(id);
      },
      runFormat: (cmd) => {
        runEditorCommand(cmd);
        close();
      },
    };
    return buildPaletteItems(deps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, documents, recent, theme, typewriterMode]);

  const groups = useMemo(() => groupPaletteItems(items), [items]);

  useEffect(() => {
    if (active >= items.length) setActive(Math.max(0, items.length - 1));
  }, [items.length, active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const total = Math.max(1, items.length);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % total);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a - 1 + total) % total);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setActive((a) => (e.shiftKey ? (a - 1 + total) % total : (a + 1) % total));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[active]?.onSelect();
    }
  };

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-modal flex justify-center scrim-palette ${isMobile ? 'items-end' : 'items-start pt-[15dvh]'}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="命令面板"
        className={`palette-enter flex w-full flex-col overflow-hidden bg-surface shadow-[var(--elev-popover)] ${
          isMobile ? 'max-h-[75dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]' : 'max-h-[440px] rounded-[var(--radius-lg)]'
        } ${isMobile ? '' : 'w-[560px]'}`}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4">
          <Search size={16} className="shrink-0 text-fg-2" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="搜索或输入命令…"
            aria-label="搜索命令与文档"
            role="combobox"
            aria-expanded="true"
            aria-controls="sm-palette-list"
            aria-activedescendant={items[active] ? `sm-palette-item-${items[active].id}` : undefined}
            className="h-11 min-w-0 flex-1 bg-transparent tx-base text-fg outline-none placeholder:text-fg-2"
          />
        </div>
        <div id="sm-palette-list" role="listbox" aria-label="命令结果" className="sm-scroll min-h-0 flex-1 overflow-y-auto p-1.5">
          {groups.length === 0 ? (
            <p className="px-3 py-6 text-center tx-sm text-fg-2">无匹配命令</p>
          ) : (
            groups.map((group) => (
              <div key={group.label} role="presentation">
                <p className="trk-caps px-3 pb-1 pt-2 tx-xs wt-medium text-fg-2">{group.label}</p>
                {group.items.map((item) => (
                  <PaletteRow
                    key={item.id}
                    item={item}
                    active={items[active]?.id === item.id}
                    onHover={() => setActive(items.findIndex((i) => i.id === item.id))}
                    onSelect={item.onSelect}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
