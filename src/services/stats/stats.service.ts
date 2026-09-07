import type { DocStats } from '../../types/models';

/** 中文 400 字/分 + 英文 200 词/分（Spec §9.5 / F2） */
export const CJK_CHARS_PER_MIN = 400;
export const WORDS_PER_MIN = 200;

/**
 * 纯函数统计（架构 §9.5）—— SM-11/42：
 * 单趟 charCodeAt 游标统计，零额外字符串/数组分配（原实现 replace+match+split
 * 会创建 4 份全文副本并物化匹配数组，大文档下每次调用都有显著 GC 压力）。
 * 纯空白/空文档返回全 0（含 readingMinutes=0）。
 */
export function computeStats(markdown: string): DocStats {
  if (markdown.trim() === '') {
    return { chars: 0, words: 0, lines: 0, readingMinutes: 0 };
  }

  let chars = 0;
  let cjkChars = 0;
  let words = 0;
  let lines = 1;
  let inWord = false;

  for (let i = 0; i < markdown.length; i++) {
    const c = markdown.charCodeAt(i);
    if (c === 10 /* \n */) {
      lines++;
      inWord = false;
      continue;
    }
    // 空白字符（空格/制表/回车/垂直制表/换页）分隔单词
    if (c === 32 || c === 9 || c === 13 || c === 11 || c === 12) {
      inWord = false;
      continue;
    }
    chars++;
    // CJK 统一表意 + 扩展 A
    if ((c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3400 && c <= 0x4dbf)) {
      cjkChars++;
      inWord = false;
      continue;
    }
    const isWordChar =
      (c >= 65 && c <= 90) /* A-Z */ ||
      (c >= 97 && c <= 122) /* a-z */ ||
      (c >= 48 && c <= 57) /* 0-9 */ ||
      c === 95 /* _ */;
    if (isWordChar) {
      if (!inWord) {
        words++;
        inWord = true;
      }
    } else {
      inWord = false;
    }
  }

  const minutes = cjkChars / CJK_CHARS_PER_MIN + words / WORDS_PER_MIN;
  return { chars, words, lines, readingMinutes: Math.max(1, Math.ceil(minutes)) };
}
