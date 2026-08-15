import type { Document } from '../../types/models';
import { AppError } from '../../utils/errors';
import { downloadBlob, buildExportFileName } from '../../utils/file';
import { renderMarkdown } from '../markdown/markdown.service';
import tokensCss from '../../styles/design-tokens.css?raw';
import previewCss from '../../styles/preview.css?raw';
import katexCss from 'katex/dist/katex.min.css?raw';

/** 表格分隔行：仅含 |、-、:、空格，且以 | 开头（区别于普通分隔线 ---） */
const TABLE_SEPARATOR_RE = /^\s*\|[\s:|-]*\|\s*$/gm;

const CODE_PLACEHOLDER_RE = /\u0000SM_CODE_(\d+)\u0000/g;

/**
 * Markdown 语法去除（纯函数，供测试）
 * 代码围栏先整体抽出 → 仅清洗普通文本 → 原样还原代码内容，避免破坏代码块。
 */
export function markdownToPlainText(markdown: string): string {
  // 1) 抽出代码围栏内容，替换为单行占位符
  const codeBlocks: string[] = [];
  const withoutCode = markdown.replace(/```[^\n]*\n?([\s\S]*?)\n?```/g, (_match, content: string) => {
    codeBlocks.push(content);
    return `\u0000SM_CODE_${codeBlocks.length - 1}\u0000`;
  });

  // 2) 仅对普通文本做语法清洗
  let text = withoutCode
    // 表格分隔行（代码已抽出，不会误删代码内内容）
    .replace(TABLE_SEPARATOR_RE, '')
    // 标题标记
    .replace(/^#{1,6}\s+/gm, '')
    // 引用标记
    .replace(/^>\s?/gm, '')
    // 任务列表 / 无序 / 有序前缀
    .replace(/^\s*[-*+]\s+(?:\[[ xX]\]\s+)?/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    // 分隔线
    .replace(/^\s*([-*_])(?:\s*\1){2,}\s*$/gm, '')
    // 图片 → alt
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    // 链接 → 文字
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // 行内代码
    .replace(/`([^`]*)`/g, '$1')
    // 强调/删除线
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    // 表格管道
    .replace(/^\s*\|/gm, '')
    .replace(/\|\s*$/gm, '')
    .replace(/\s*\|\s*/g, ' ');

  // 3) 还原代码块内容（原文）
  text = text.replace(CODE_PLACEHOLDER_RE, (_m, index: string) => codeBlocks[Number(index)] ?? '');

  // 4) 清理多余空行（保留至多一个连续空行）
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

/** 完整 HTML 文档组装（纯函数，供测试注入 CSS） */
export function buildExportHtml(options: {
  title: string;
  bodyHtml: string;
  tokensCss?: string;
  previewCss?: string;
  katexCss?: string;
}): string {
  const tokens = options.tokensCss ?? tokensCss;
  const preview = options.previewCss ?? previewCss;
  const katex = options.katexCss ?? katexCss;
  const title = options.title || '无标题文档';
  const toggleScript = [
    '(function(){',
    "var btn=document.getElementById('sm-theme-toggle');",
    "if(btn){btn.addEventListener('click',function(){",
    "var h=document.documentElement;",
    "var t=h.getAttribute('data-theme')==='dark'?'light':'dark';",
    "h.setAttribute('data-theme',t);",
    "var m=document.querySelector('meta[name=\"color-scheme\"]');",
    "if(m)m.setAttribute('content',t);",
    '});}',
    '})();',
  ].join('');
  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="light">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light" />
<title>${escapeHtml(title)}</title>
<style>
${tokens}
${preview}
${katex}
.sm-export-shell { min-height: 100dvh; background: var(--bg); color: var(--fg); font-family: var(--font-body); }
.sm-theme-toggle {
  position: fixed; right: var(--space-4); bottom: var(--space-4); z-index: 10;
  background: var(--surface); color: var(--fg); border: 1px solid var(--border);
  border-radius: var(--radius-md); padding: var(--space-2) var(--space-3);
  font-family: var(--font-ui); font-size: var(--text-sm); cursor: pointer;
  box-shadow: var(--elev-raised); transition: background var(--motion-fast) var(--ease-standard);
}
.sm-theme-toggle:hover { background: var(--surface-warm); }
</style>
</head>
<body>
<div class="sm-export-shell">
  <article class="markdown-body">${options.bodyHtml}</article>
  <button type="button" id="sm-theme-toggle" class="sm-theme-toggle">切换主题</button>
</div>
<script>${toggleScript}</script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * 导出 HTML（AC-10：内联样式+内嵌图片，离线可打开）
 * - bodyHtml 可选：传入预览区已渲染的 HTML（含 Mermaid SVG + KaTeX），缺省时回退 renderMarkdown。
 *   Mermaid 为客户端渲染，仅预览 DOM 中已烘焙为 SVG；未渲染时回退源码块（离线仍可读）。
 */
export async function exportHtml(doc: Document, opts?: { bodyHtml?: string }): Promise<void> {
  try {
    const html = opts?.bodyHtml ?? renderMarkdown(doc.content).html;
    const full = buildExportHtml({ title: doc.title, bodyHtml: html });
    downloadBlob(new Blob([full], { type: 'text/html;charset=utf-8' }), buildExportFileName(doc.title, 'html'));
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('EXPORT_FAILED', '导出 HTML 失败');
  }
}

/** 导出纯文本（AC-11：去除 Markdown 语法） */
export async function exportPlainText(doc: Document): Promise<void> {
  try {
    const text = markdownToPlainText(doc.content);
    downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), buildExportFileName(doc.title, 'txt'));
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('EXPORT_FAILED', '导出纯文本失败');
  }
}
