import { AppError } from '../../utils/errors';
import { IMAGE_MAX_BYTES, IMAGE_WARN_BYTES, IMAGE_MAX_DIMENSION, IMAGE_JPEG_QUALITY } from '../../config/constants';

/** 图片超限异常（>5MB 拒绝） */
export class ImageTooLargeError extends AppError {
  constructor(_size: number) {
    super('IMAGE_TOO_LARGE', `图片超过 ${Math.round(IMAGE_MAX_BYTES / 1024 / 1024)}MB 上限，已拒绝插入`);
  }
}

/** 图片体积提示（2-5MB 返回提示语，否则 null） */
export function getImageWarnMessage(size: number): string | null {
  if (size <= IMAGE_MAX_BYTES && size > IMAGE_WARN_BYTES) {
    return `图片约 ${(size / 1024 / 1024).toFixed(1)}MB，体积较大，已内嵌（建议压缩后使用）`;
  }
  return null;
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new AppError('IMAGE_READ_FAILED', '图片读取失败，请重试'));
    reader.readAsDataURL(file);
  });
}

/** 无需压缩的格式（gif 保留动图；svg 保持原样） */
function canCompress(mime: string): boolean {
  return mime === 'image/png' || mime === 'image/jpeg' || mime === 'image/webp';
}

/** 超过 1920px 最长边时压缩（canvas/解码不可用或超时则返回原图，静默降级） */
async function compressImage(dataUrl: string, mime: string): Promise<string> {
  let settled = false;
  return new Promise((resolve) => {
    const finish = (out: string) => {
      if (!settled) {
        settled = true;
        resolve(out);
      }
    };
    // 解码兜底：某些环境（jsdom/隐私模式）不触发 onload/onerror，超时返回原图
    const timer = setTimeout(() => finish(dataUrl), 800);
    const img = new Image();
    img.onload = () => {
      clearTimeout(timer);
      try {
        const { width, height } = img;
        if (width <= IMAGE_MAX_DIMENSION && height <= IMAGE_MAX_DIMENSION) {
          finish(dataUrl);
          return;
        }
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(width, height));
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          finish(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const out = canvas.toDataURL(mime === 'image/png' ? 'image/png' : 'image/jpeg', IMAGE_JPEG_QUALITY);
        finish(out);
      } catch {
        finish(dataUrl);
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      finish(dataUrl);
    };
    img.src = dataUrl;
  });
}

/**
 * 读取图片 → dataURL（架构 §9.4）
 * >5MB 抛 ImageTooLargeError；2-5MB 返回 dataURL（调用方据 getImageWarnMessage 提示）；
 * 大尺寸图片自动压缩到最长边 1920px。
 */
export async function extractImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new AppError('IMAGE_READ_FAILED', '不是图片文件');
  }
  if (file.size > IMAGE_MAX_BYTES) {
    throw new ImageTooLargeError(file.size);
  }
  const raw = await readAsDataURL(file);
  if (file.size > IMAGE_WARN_BYTES && canCompress(file.type)) {
    try {
      return await compressImage(raw, file.type);
    } catch {
      return raw; // 压缩失败保留原图，不阻塞插入
    }
  }
  return raw;
}

/** 组装 Markdown 图片语法：![](dataUrl) */
export function buildMarkdownImage(dataUrl: string, alt = ''): string {
  const safeAlt = alt.replace(/[[\]]/g, ' ').trim();
  return `![${safeAlt}](${dataUrl})`;
}
