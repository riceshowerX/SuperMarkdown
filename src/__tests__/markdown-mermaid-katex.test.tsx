/**
 * Mermaid + KaTeX 渲染管线测试（架构 §9.1 / §11.2）
 * 覆盖：Mermaid 代码块透传 / 客户端渲染成功与失败 / KaTeX 行内与块级 / XSS 防线 / 回归
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { renderMarkdown } from '../services/markdown/markdown.service';
import { useMermaidRender } from '../hooks/useMermaidRender';
import type { Theme } from '../types/models';

/* Mermaid 动态导入模拟（vi.hoisted 保证 vi.mock 工厂可引用） */
const { renderMock, initializeMock } = vi.hoisted(() => ({
  renderMock: vi.fn(),
  initializeMock: vi.fn(),
}));
vi.mock('mermaid', () => ({
  default: { initialize: initializeMock, render: renderMock },
}));

function Harness({ html, theme = 'light' as Theme }: { html: string; theme?: Theme }) {
  const ref = useRef<HTMLDivElement>(null);
  useMermaidRender(ref, html, theme);
  return <div ref={ref} className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />;
}

describe('Mermaid 代码块识别（renderMarkdown 透传）', () => {
  it('```mermaid 透传为 pre code.language-mermaid，源码转义、不在服务端渲染 SVG', () => {
    const { html } = renderMarkdown('```mermaid\ngraph TD\nA-->B\n```');
    expect(html).toContain('language-mermaid');
    expect(html).toContain('graph TD');
    expect(html).toContain('A--&gt;B');
    expect(html).not.toContain('<svg');
  });
});

describe('KaTeX 公式（renderMarkdown 服务端渲染）', () => {
  it('行内 $E=mc^2$ 解析为 katex HTML（含 MathML）', () => {
    const { html } = renderMarkdown('行内 $E=mc^2$ 公式');
    expect(html).toContain('katex');
    expect(html).toContain('<math');
    expect(html).toContain('msup');
  });

  it('块级 $$\\int_0^1 x\\,dx$$ 解析为 katex-display', () => {
    const { html } = renderMarkdown('$$\\int_0^1 x\\,dx$$');
    expect(html).toContain('katex-display');
    expect(html).toContain('katex-block');
    expect(html).toContain('<math');
  });
});

describe('XSS 防线', () => {
  it('$<img onerror>$ 不生成 img/script 元素与 on* 属性（katex 降级为文本）', () => {
    const { html } = renderMarkdown('$<img src=x onerror=alert(1)>$');
    const div = document.createElement('div');
    div.innerHTML = html;
    expect(div.querySelector('img')).toBeNull();
    expect(div.querySelector('script')).toBeNull();
    expect(div.querySelector('[onerror]')).toBeNull();
    expect(div.querySelector('[onload]')).toBeNull();
  });

  it('mermaid 块内恶意 <script> 被转义（源码透传，无可执行脚本）', () => {
    const { html } = renderMarkdown('```mermaid\ngraph TD\nA["<script>alert(1)</script>"]-->B\n```');
    const div = document.createElement('div');
    div.innerHTML = html;
    expect(div.querySelector('script')).toBeNull();
    expect(div.querySelector('pre code.language-mermaid')).not.toBeNull();
  });
});

describe('回归：普通 Markdown 语法不受影响', () => {
  it('标题/粗体/代码/列表/表格 正常', () => {
    const { html, error } = renderMarkdown('# 标题\n\n**粗体** `code`\n\n- 项\n\n| a | b |\n| - | - |\n| 1 | 2 |');
    expect(error).toBeNull();
    expect(html).toContain('<h1>标题</h1>');
    expect(html).toContain('<strong>粗体</strong>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('<li>项</li>');
    expect(html).toContain('<table>');
  });
});

describe('useMermaidRender：客户端渲染', () => {
  beforeEach(() => {
    renderMock.mockReset();
  });

  it('渲染成功：SVG 替换 pre，<script> 被 DOMPurify 清洗', async () => {
    renderMock.mockResolvedValue({
      svg: '<svg viewBox="0 0 100 100"><script>alert(1)</script><path d="M0 0 L100 100" stroke="black" fill="none"/></svg>',
    });
    const html = renderMarkdown('```mermaid\ngraph TD\nA-->B\n```').html;
    const { container } = render(<Harness html={html} />);

    await waitFor(() => {
      expect(container.querySelector('.mermaid svg')).not.toBeNull();
    });
    expect(container.querySelector('code.language-mermaid')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('.mermaid svg path')).not.toBeNull();
  });

  it('渲染失败：显示错误占位，不抛异常', async () => {
    renderMock.mockRejectedValue(new Error('Parse error'));
    const html = renderMarkdown('```mermaid\nbad syntax\n```').html;
    const { container } = render(<Harness html={html} />);

    await waitFor(() => {
      expect(container.querySelector('.mermaid-error')).not.toBeNull();
    });
    expect(container.querySelector('.mermaid-error')?.textContent).toContain('图表渲染失败');
    expect(container.querySelector('code.language-mermaid')).toBeNull();
  });

  it('主题跟随明暗：theme=dark 时 initialize 以 dark 主题调用', async () => {
    renderMock.mockResolvedValue({ svg: '<svg><path d="M0 0"/></svg>' });
    const html = renderMarkdown('```mermaid\ngraph TD\nA-->B\n```').html;
    render(<Harness html={html} theme="dark" />);
    await waitFor(() => {
      expect(renderMock).toHaveBeenCalled();
    });
    expect(
      initializeMock.mock.calls.some((c) => (c[0] as { theme?: string }).theme === 'dark'),
    ).toBe(true);
  });
});
