import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import katexPluginImport from '@vscode/markdown-it-katex';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import bash from 'highlight.js/lib/languages/bash';
import python from 'highlight.js/lib/languages/python';
import markdown from 'highlight.js/lib/languages/markdown';

/* 按需注册语言子集（架构 §3.5：js/ts/tsx/json/css/html/bash/python） */
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('jsx', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('tsx', typescript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('css', css);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);

/* @vscode/markdown-it-katex 为 CJS（__esModule + exports.default）：
 * Vite/esbuild 自动解包 default；vitest SSR 走 Node 原生互操作可能返回命名空间对象，需兜底。 */
const katexPlugin =
  (katexPluginImport as unknown as { default?: typeof katexPluginImport }).default ??
  katexPluginImport;

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * markdown-it 实例唯一创建点（架构 §9.1 / §11.2 第一层防线）
 * - html: false → 原始 HTML 一律转义为文本
 * - KaTeX：识别 $...$（行内）/ $$...$$（块级）→ 渲染为 HTML+MathML；throwOnError:false 失败降级为错误占位
 * - Mermaid：```mermaid 代码块保持源码透传（pre code.language-mermaid），由 PreviewPane 客户端渲染为 SVG
 * - 该插件包装 fence 规则，非 math 语言委托回原 highlight 渲染器，故 mermaid 透传不受影响
 */
export function createMarkdownIt(): MarkdownIt {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: false,
    highlight(str, lang) {
      // Mermaid 源码透传：保留 language-mermaid 标记供客户端扫描，内容已转义
      if (lang === 'mermaid') {
        return `<pre class="hljs mermaid-src"><code class="language-mermaid">${escapeHtml(str)}</code></pre>`;
      }
      if (lang && hljs.getLanguage(lang)) {
        try {
          const highlighted = hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
          return `<pre class="hljs"><code class="language-${escapeHtml(lang)}">${highlighted}</code></pre>`;
        } catch {
          /* 高亮失败回退纯文本转义 */
        }
      }
      return `<pre class="hljs"><code>${escapeHtml(str)}</code></pre>`;
    },
  });
  md.use(taskLists, { enabled: true, label: false });
  md.use(katexPlugin, { throwOnError: false });
  return md;
}
