import { describe, it, expect, vi } from 'vitest';
import {
  extractImage,
  buildMarkdownImage,
  getImageWarnMessage,
  ImageTooLargeError,
} from '../services/clipboard/clipboard.service';
import { IMAGE_MAX_BYTES, IMAGE_WARN_BYTES } from '../config/constants';

/** 1x1 透明 PNG */
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function pngFile(bytes: number): File {
  const buf = new Uint8Array(Math.max(bytes, PNG_BASE64.length));
  for (let i = 0; i < PNG_BASE64.length; i++) buf[i] = PNG_BASE64.charCodeAt(i);
  return new File([buf], 'img.png', { type: 'image/png' });
}

describe('clipboard.service', () => {
  it('extractImage 返回 dataURL（data:image/ 前缀）', async () => {
    const file = pngFile(100);
    const dataUrl = await extractImage(file);
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('非图片文件抛 IMAGE_READ_FAILED', async () => {
    const file = new File(['text'], 'note.txt', { type: 'text/plain' });
    await expect(extractImage(file)).rejects.toMatchObject({ code: 'IMAGE_READ_FAILED' });
  });

  it('>5MB 拒绝并抛 ImageTooLargeError（AC-06）', async () => {
    const big = pngFile(IMAGE_MAX_BYTES + 1);
    const promise = extractImage(big);
    await expect(promise).rejects.toBeInstanceOf(ImageTooLargeError);
    await expect(promise).rejects.toMatchObject({ code: 'IMAGE_TOO_LARGE' });
  });

  it('2-5MB 提示体积较大（AC-06）', () => {
    const mid = IMAGE_WARN_BYTES + 1024;
    expect(getImageWarnMessage(mid)).toContain('体积较大');
    expect(getImageWarnMessage(1024)).toBeNull();
    expect(getImageWarnMessage(IMAGE_MAX_BYTES + 1)).toBeNull(); // 已超上限走拒绝
  });

  it('buildMarkdownImage 组装 ![](dataUrl)', () => {
    const url = 'data:image/png;base64,AAAA';
    expect(buildMarkdownImage(url)).toBe(`![](${url})`);
    expect(buildMarkdownImage(url, '描述')).toBe(`![描述](${url})`);
  });

  it('extractImage 压缩失败静默降级为原图（不抛错）', async () => {
    // jsdom 无 canvas/解码，走超时降级路径 → 返回原 dataURL
    const file = pngFile(IMAGE_WARN_BYTES + 1024);
    const dataUrl = await extractImage(file);
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
  }, 5000);

  it('FileReader 读取失败路径抛出可识别错误', async () => {
    vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementationOnce(function (this: FileReader) {
      this.dispatchEvent(new Event('error'));
    });
    const file = pngFile(100);
    await expect(extractImage(file)).rejects.toMatchObject({ code: 'IMAGE_READ_FAILED' });
  });
});
