import DOMPurify from 'dompurify';
import type MarkdownIt from 'markdown-it';
import type { RenderResult } from '../../types/models';
import { createMarkdownIt } from './markdown.config';
import { sanitizeConfig, installSanitizeHooks } from './sanitize.config';

let mdInstance: MarkdownIt | null = null;

function getMarkdownIt(): MarkdownIt {
  if (!mdInstance) {
    mdInstance = createMarkdownIt();
    installSanitizeHooks();
  }
  return mdInstance;
}

/** 提取标题文本（用于文档列表标题派生） */
export function extractHeadings(markdown: string): string[] {
  const headings: string[] = [];
  for (const line of markdown.split('\n')) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) headings.push(match[2].trim());
  }
  return headings;
}

/**
 * 渲染管线唯一入口（架构 §9.1）
 * markdown-it(html:false) → DOMPurify 白名单 → hljs 高亮
 * 渲染错误不抛异常，返回 RenderResult.error。
 */
export function renderMarkdown(markdown: string): RenderResult {
  try {
    const raw = getMarkdownIt().render(markdown);
    const clean = DOMPurify.sanitize(raw, sanitizeConfig);
    const headings = extractHeadings(markdown);
    return { html: clean, headings, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知渲染错误';
    return {
      html: '<p class="render-error">渲染失败：内容无法解析</p>',
      headings: [],
      error: message,
    };
  }
}
