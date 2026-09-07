import { useCallback, type ClipboardEvent, type DragEvent } from 'react';
import { extractImage, buildMarkdownImage, getImageWarnMessage, ImageTooLargeError } from '../services/clipboard/clipboard.service';
import { AppError, toAppError } from '../utils/errors';
import { useEditorStore } from '../stores/editor.store';
import { useUiStore } from '../stores/ui.store';

/**
 * 图片粘贴/拖拽（架构 §8.4 / AC-05/06）
 * - 剪贴板/拖放含图片 → 提取 base64 → 光标处插入 ![](dataUrl)
 * - 非图片内容走浏览器默认行为
 * - >2MB 提示、>5MB 拒绝
 * - SM-10：插入前估算文档内嵌图片已用量，超预算直接拒绝（防止单文档被图片撑爆存储）
 */

/** 内嵌图片总量软上限（估算）：与 IndexedDB/localStorage 可用配额保持安全距离 */
const IMAGE_DOC_BUDGET_BYTES = 24 * 1024 * 1024;

/** base64 体积相对二进制原始体积的膨胀系数 */
const BASE64_INFLATION = 4 / 3;

/** 以 dataURL 长度估算当前文档内嵌图片的已用字节数（SM-10） */
export function estimateEmbeddedImageBytes(content: string): number {
  let total = 0;
  const re = /!\[[^\]]*\]\(data:image\/[^;)]+;base64,([A-Za-z0-9+/=]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    total += Math.floor((m[1]?.length ?? 0) * 0.75); // base64 每 4 字符 ≈ 3 字节
  }
  return total;
}

/** 提取图片并做「已用量 + 新增体积」预算校验（SM-10 调用点）：
 *  兼容 extractImage 的两种签名——clipboard.service 若已扩展 usedBytes 参数则透传，否则按原签名调用。 */
export async function extractImageWithBudget(file: File): Promise<string> {
  const usedBytes = estimateEmbeddedImageBytes(useEditorStore.getState().content);
  if (usedBytes + file.size * BASE64_INFLATION > IMAGE_DOC_BUDGET_BYTES) {
    throw new AppError(
      'IMAGE_TOO_LARGE',
      `文档内嵌图片总量已达上限（约 ${Math.round(IMAGE_DOC_BUDGET_BYTES / 1024 / 1024)}MB），请先移除部分图片`,
    );
  }
  const extract = extractImage as unknown as (file: File, usedBytes?: number) => Promise<string>;
  return extract(file, usedBytes);
}

export function usePasteImage(insert: (text: string) => void) {
  const pushToast = useUiStore((s) => s.pushToast);

  const handleFile = useCallback(
    async (file: File) => {
      try {
        const dataUrl = await extractImageWithBudget(file);
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
