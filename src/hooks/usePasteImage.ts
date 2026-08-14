import { useCallback, type ClipboardEvent, type DragEvent } from 'react';
import { extractImage, buildMarkdownImage, getImageWarnMessage, ImageTooLargeError } from '../services/clipboard/clipboard.service';
import { toAppError } from '../utils/errors';
import { useUiStore } from '../stores/ui.store';

/**
 * 图片粘贴/拖拽（架构 §8.4 / AC-05/06）
 * - 剪贴板/拖放含图片 → 提取 base64 → 光标处插入 ![](dataUrl)
 * - 非图片内容走浏览器默认行为
 * - >2MB 提示、>5MB 拒绝
 */
export function usePasteImage(insert: (text: string) => void) {
  const pushToast = useUiStore((s) => s.pushToast);

  const handleFile = useCallback(
    async (file: File) => {
      try {
        const dataUrl = await extractImage(file);
        insert(buildMarkdownImage(dataUrl));
        const warning = getImageWarnMessage(file.size);
        pushToast({ kind: warning ? 'info' : 'success', title: '图片已插入', message: warning ?? undefined });
      } catch (err) {
        if (err instanceof ImageTooLargeError) {
          pushToast({ kind: 'error', title: '图片过大', message: err.userMessage });
        } else {
          const appErr = toAppError(err);
          pushToast({ kind: 'error', title: '图片读取失败', message: appErr.userMessage });
        }
      }
    },
    [insert, pushToast],
  );

  const findImage = (files: FileList | null): File | null => {
    if (!files) return null;
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) return file;
    }
    return null;
  };

  const onPaste = useCallback(
    (e: ClipboardEvent<HTMLTextAreaElement>) => {
      const file = findImage(e.clipboardData?.files ?? null);
      if (!file) return; // 非图片内容走默认文本粘贴
      e.preventDefault();
      void handleFile(file);
    },
    [handleFile],
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLTextAreaElement>) => {
      const file = findImage(e.dataTransfer?.files ?? null);
      if (!file) return; // 非图片内容走默认行为
      e.preventDefault();
      void handleFile(file);
    },
    [handleFile],
  );

  return { onPaste, onDrop };
}
