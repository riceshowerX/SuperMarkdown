import { AppError } from '../../utils/errors';
import {
  IMAGE_MAX_BYTES,
  IMAGE_WARN_BYTES,
  IMAGE_MAX_DIMENSION,
  IMAGE_JPEG_QUALITY,
  DOC_MAX_IMAGE_BYTES_TOTAL,
  IMAGE_MAX_PIXELS,
} from '../../config/constants';

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
  return new Promise((resolve, reject) => {
    const finish = (out: string) => {
      if (!settled) {
        settled = true;
        resolve(out);
      }
    };
    // 像素超限等不可恢复错误：拒绝插入而非降级为原图
    const fail = (err: unknown) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    };
    // 解码兜底：某些环境（jsdom/隐私模式）不触发 onload/onerror，超时返回原图
    const timer = setTimeout(() => finish(dataUrl), 800);
    const img = new Image();
    img.onload = () => {
      clearTimeout(timer);
      // SM-60：解码炸弹防护——像素超限直接拒绝，不进 canvas（避免 OOM / 长时间卡死）
      if (img.naturalWidth * img.naturalHeight > IMAGE_MAX_PIXELS) {
        fail(new AppError('IMAGE_TOO_LARGE', '图片像素过大（超过 4000 万像素），已拒绝插入'));
        return;
      }
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

/** 允许内嵌的图片 MIME 白名单（SM-10：拒绝 image/svg+xml——SVG 可携带脚本，且 markdown-it 链接层本就拦它） */
const ALLOWED_IMAGE_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/avif',
]);

/**
 * 读取图片 → dataURL（架构 §9.4）
 * >5MB 抛 ImageTooLargeError；2-5MB 返回 dataURL（调用方据 getImageWarnMessage 提示）；
 * 大尺寸图片自动压缩到最长边 1920px；
 * SM-10：MIME 白名单 + 单文档图片累计上限（usedBytes 由调用方统计，默认 0 保持向后兼容）。
 */
export async function extractImage(file: File, usedBytes = 0): Promise<string> {
  if (!ALLOWED_IMAGE_MIME.has(file.type)) {
    throw new AppError('IMAGE_READ_FAILED', '不支持的图片格式（仅支持 PNG/JPEG/GIF/WebP/BMP/AVIF）');
  }
  if (file.size > IMAGE_MAX_BYTES) {
    throw new ImageTooLargeError(file.size);
  }
  if (usedBytes + file.size > DOC_MAX_IMAGE_BYTES_TOTAL) {
    throw new AppError('IMAGE_TOO_LARGE', '本文档图片总量已达 20MB 上限，请新建文档或压缩后再插入');
  }
  const raw = await readAsDataURL(file);
  if (file.size > IMAGE_WARN_BYTES && canCompress(file.type)) {
    try {
      return await compressImage(raw, file.type);
    } catch (err) {
      // 像素超限必须拒绝；其余压缩失败保留原图，不阻塞插入
      if (err instanceof AppError && err.code === 'IMAGE_TOO_LARGE') throw err;
      return raw;
    }
  }
  return raw;
}

/** 组装 Markdown 图片语法：![](dataUrl) */
export function buildMarkdownImage(dataUrl: string, alt = ''): string {
  const safeAlt = alt.replace(/[[\]]/g, ' ').trim();
  return `![${safeAlt}](${dataUrl})`;
}
