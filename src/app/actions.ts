import type { Document } from '../types/models';
import { useDocumentsStore } from '../stores/documents.store';
import { useEditorStore } from '../stores/editor.store';
import { useUiStore } from '../stores/ui.store';
import { exportHtml, exportPlainText } from '../services/export/export.service';
import { toAppError } from '../utils/errors';

/** 基于内存最新内容组装当前文档（导出需包含未保存内容） */
export function buildCurrentDocument(): Document | null {
  const ed = useEditorStore.getState();
  if (!ed.docId) return null;
  const base = useDocumentsStore.getState().documents.find((d) => d.id === ed.docId);
  return {
    id: ed.docId,
    title: base?.title ?? '无标题文档',
    content: ed.content,
    createdAt: base?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  };
}

export async function exportCurrentDocument(kind: 'html' | 'txt'): Promise<void> {
  const doc = buildCurrentDocument();
  if (!doc) return;
  try {
    if (kind === 'html') {
      // 捕获预览区已渲染 HTML（含 Mermaid SVG + KaTeX），确保导出含图形/公式；预览未挂载时回退
      const liveHtml = typeof document !== 'undefined' ? document.querySelector('.markdown-body')?.innerHTML : undefined;
      await exportHtml(doc, liveHtml ? { bodyHtml: liveHtml } : undefined);
      useUiStore.getState().pushToast({ kind: 'success', title: '已导出 HTML', message: '文件已下载' });
    } else {
      await exportPlainText(doc);
      useUiStore.getState().pushToast({ kind: 'success', title: '已导出纯文本', message: '文件已下载' });
    }
  } catch (err) {
    const appErr = toAppError(err);
    useUiStore.getState().pushToast({ kind: 'error', title: '导出失败', message: appErr.userMessage });
  }
}

export async function exportDocumentById(id: string, kind: 'html' | 'txt'): Promise<void> {
  const doc = useDocumentsStore.getState().documents.find((d) => d.id === id);
  if (!doc) return;
  try {
    if (kind === 'html') {
      await exportHtml(doc);
      useUiStore.getState().pushToast({ kind: 'success', title: '已导出 HTML', message: '文件已下载' });
    } else {
      await exportPlainText(doc);
      useUiStore.getState().pushToast({ kind: 'success', title: '已导出纯文本', message: '文件已下载' });
    }
  } catch (err) {
    const appErr = toAppError(err);
    useUiStore.getState().pushToast({ kind: 'error', title: '导出失败', message: appErr.userMessage });
  }
}
