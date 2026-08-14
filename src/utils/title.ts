/** 文档标题派生（Spec §6.1：首行标题或"无标题文档 N"） */

/** 从内容提取首个标题文本（# 之后），无标题返回空串 */
export function deriveTitle(content: string): string {
  const firstLine = content.split('\n').find((line) => /^#{1,6}\s+\S/.test(line));
  if (!firstLine) return '';
  return firstLine.replace(/^#{1,6}\s+/, '').trim();
}

/** 自动标题模式（未手动重命名） */
const AUTO_TITLE_RE = /^无标题文档\s*\d*$/;

/**
 * 计算下一次保存使用的标题：
 * - 内容含标题且当前仍是自动标题 → 跟随首行标题；
 * - 用户手动重命名过 → 保留手动标题；
 * - 无标题 → "无标题文档 N"。
 */
export function nextTitle(content: string, currentTitle: string, docCount: number): string {
  const derived = deriveTitle(content);
  const isAuto = !currentTitle || AUTO_TITLE_RE.test(currentTitle);
  if (derived && isAuto) return derived;
  if (!currentTitle) return `无标题文档 ${docCount + 1}`;
  return currentTitle;
}
