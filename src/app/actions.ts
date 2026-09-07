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
      // SM-74：不信任 DOM——先落盘待保存内容，再以内存内容走「markdown-it → DOMPurify」净化渲染管线
      await useEditorStore.getState().flushSave();
      let bodyHtml: string | undefined;
      // 仅当文档含 mermaid 块时才取 DOM 快照（mermaid 为客户端渲染，SVG 需已在预览中烘焙），
      // 并校验快照容器确实属于当前文档（data-doc-id 由 PreviewPane 写入）
      if (/```mermaid\b/.test(doc.content)) {
        const el = document.querySelector<HTMLElement>('.markdown-body[data-doc-id]');
        if (el && el.dataset.docId === doc.id) bodyHtml = el.innerHTML;
      }
      await exportHtml(doc, bodyHtml ? { bodyHtml } : undefined);
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
