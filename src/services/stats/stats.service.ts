import type { DocStats } from '../../types/models';

/** 中文字符（CJK 统一表意 + 扩展 A） */
const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/g;

/** 拉丁词（含数字/下划线） */
const WORD_RE = /[A-Za-z0-9_]+/g;

/** 中文 400 字/分 + 英文 200 词/分（Spec §9.5 / F2） */
export const CJK_CHARS_PER_MIN = 400;
export const WORDS_PER_MIN = 200;

/** 纯函数统计（架构 §9.5） */
export function computeStats(markdown: string): DocStats {
  if (!markdown) {
    return { chars: 0, words: 0, lines: 0, readingMinutes: 0 };
  }
  const chars = markdown.replace(/\s/g, '').length;
  const cjkChars = (markdown.match(CJK_RE) ?? []).length;
  const words = (markdown.match(WORD_RE) ?? []).length;
  const lines = markdown.split('\n').length;
  const minutes = cjkChars / CJK_CHARS_PER_MIN + words / WORDS_PER_MIN;
  const readingMinutes = Math.max(1, Math.ceil(minutes));
  return { chars, words, lines, readingMinutes };
}
