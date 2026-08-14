import { describe, it, expect } from 'vitest';
import { renderMarkdown, extractHeadings } from '../services/markdown/markdown.service';

describe('markdown.service', () => {
  it('渲染标题/列表/粗体/代码/表格/引用', () => {
    const md = [
      '# 一级标题',
      '',
      '- 列表项',
      '',
      '**加粗** 和 *斜体*',
      '',
      '> 引用内容',
      '',
      '```ts',
      'const a: number = 1;',
      '```',
      '',
      '| 列1 | 列2 |',
      '| --- | --- |',
      '| a | b |',
    ].join('\n');
    const { html, error } = renderMarkdown(md);
    expect(error).toBeNull();
    expect(html).toContain('<h1>一级标题</h1>');
    expect(html).toContain('<li>列表项</li>');
    expect(html).toContain('<strong>加粗</strong>');
    expect(html).toContain('<em>斜体</em>');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<table>');
    expect(html).toContain('hljs');
  });

  it('任务列表渲染复选框（只读）', () => {
    const { html } = renderMarkdown('- [x] 已完成\n- [ ] 未完成');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked');
    expect(html).toContain('disabled'); // 勾选态仅展示不可交互
  });

  it('XSS：原始 HTML 一律转义（html:false）', () => {
    const { html } = renderMarkdown('<img src=x onerror=alert(1)>');
    // 原始 HTML 被转义为文本：无 img 元素、无 onerror 属性
    expect(html).not.toContain('<img');
    expect(html).not.toMatch(/<img[^>]*onerror/i);
    expect(html).toContain('&lt;img');
  });

  it('XSS：javascript: 链接被过滤（AC-15）', () => {
    const { html } = renderMarkdown('[点击](javascript:alert(1))');
    // markdown-it 内置 validateLink 拒绝危险协议 → 不生成链接元素
    expect(html).not.toMatch(/<a[\s>]/);
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain('onerror');
    // 链接文字保留为纯文本
    expect(html).toContain('点击');
  });

  it('XSS：data:text/html 与 iframe/script 被拦截', () => {
    const { html } = renderMarkdown('<iframe src="https://evil.example"></iframe>\n\n<script>alert(1)</script>\n\n[data](data:text/html,<script>alert(1)</script>)');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('<script');
    // data: 链接不生成元素；linkify 自动链接的是转义文本中的 https 地址（安全）
    expect(html).not.toContain('href="data:');
    expect(html).not.toMatch(/href="(?:javascript|data):/i);
  });

  it('data:image/ 允许内嵌图片', () => {
    const { html } = renderMarkdown('![x](data:image/png;base64,AAAA)');
    expect(html).toContain('data:image/png;base64,AAAA');
  });

  it('提取标题', () => {
    expect(extractHeadings('# 标题A\n正文\n## 标题B')).toEqual(['标题A', '标题B']);
  });
});
