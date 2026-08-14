import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
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

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * markdown-it 实例唯一创建点（架构 §9.1 / §11.2 第一层防线）
 * html: false → 原始 HTML 一律转义为文本
 * GFM：表格/删除线为 markdown-it 核心能力，任务列表由 markdown-it-task-lists 提供
 */
export function createMarkdownIt(): MarkdownIt {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: false,
    highlight(str, lang) {
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
  return md;
}
