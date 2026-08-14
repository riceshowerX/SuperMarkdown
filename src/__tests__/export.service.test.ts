import { describe, it, expect } from 'vitest';
import { markdownToPlainText, buildExportHtml } from '../services/export/export.service';
import { buildExportFileName, sanitizeFileName, formatDateTimeStamp } from '../utils/file';

describe('export.service', () => {
  it('markdownToPlainText 去除 Markdown 语法', () => {
    const md = [
      '# 标题',
      '',
      '**加粗** 和 *斜体* 和 ~~删除~~',
      '',
      '> 引用',
      '',
      '- [x] 任务项',
      '- 无序项',
      '1. 有序项',
      '',
      '[链接文字](https://example.com)',
      '',
      '行内 `code` 与图片 ![alt](https://example.com/a.png)',
      '',
      '| 列1 | 列2 |',
      '| --- | --- |',
      '| a | b |',
      '',
      '```js',
      'const x = 1;',
      '```',
    ].join('\n');
    const text = markdownToPlainText(md);
    expect(text).toContain('标题');
    expect(text).toContain('加粗 和 斜体 和 删除');
    expect(text).toContain('引用');
    expect(text).toContain('任务项');
    expect(text).toContain('无序项');
    expect(text).toContain('有序项');
    expect(text).toContain('链接文字');
    expect(text).toContain('行内 code 与图片 alt');
    expect(text).toContain('a b');
    expect(text).toContain('const x = 1;');
    expect(text).not.toContain('**');
    expect(text).not.toContain('# 标题');
    expect(text).not.toContain('|');
    expect(text).not.toContain('```');
  });

  it('markdownToPlainText 去除表格分隔行（QA 回归）', () => {
    const md = '| 列1 | 列2 |\n| --- | --- |\n| a | b |';
    const text = markdownToPlainText(md);
    expect(text).not.toContain('---');
    expect(text).not.toContain('|');
    expect(text).toContain('列1 列2');
    expect(text).toContain('a b');
  });

  it('markdownToPlainText 不误删普通分隔线 ---（QA 回归）', () => {
    const text = markdownToPlainText('上\n\n---\n\n下');
    expect(text).not.toContain('---'); // hr 应被既有规则移除（空行保留）
    expect(text).toContain('上');
    expect(text).toContain('下');
  });

  it('markdownToPlainText 代码围栏内表格行保留（QA 回归）', () => {
    const md = '```\n| --- | --- |\n```';
    const text = markdownToPlainText(md);
    expect(text).toContain('| --- | --- |'); // 围栏内内容不被破坏
  });

  it('markdownToPlainText 对齐分隔行也移除（QA 回归）', () => {
    const text = markdownToPlainText('| a | b |\n| :--- | ---: |\n| 1 | 2 |');
    expect(text).not.toContain(':---');
    expect(text).not.toContain('---');
    expect(text).toContain('1 2');
  });

  it('buildExportHtml 内联 token 样式与主题切换', () => {
    const html = buildExportHtml({
      title: '测试文档',
      bodyHtml: '<h1>你好</h1>',
      tokensCss: ':root{--bg:#FAFAF9}',
      previewCss: '.markdown-body{color:var(--fg)}',
    });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>测试文档</title>');
    expect(html).toContain('<h1>你好</h1>');
    expect(html).toContain(':root{--bg:#FAFAF9}');
    expect(html).toContain('.markdown-body{color:var(--fg)}');
    expect(html).toContain('data-theme="light"');
    expect(html).toContain('sm-theme-toggle');
  });

  it('buildExportHtml 转义标题防注入', () => {
    const html = buildExportHtml({ title: '<script>alert(1)</script>', bodyHtml: '' });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('导出文件名：sanitize + 时间戳', () => {
    const date = new Date(2026, 7, 15, 9, 30, 5); // 2026-08-15 09:30:05
    expect(buildExportFileName('我的文档/测试:v1', 'html', date)).toBe('我的文档-测试-v1-20260815-093005.html');
    expect(buildExportFileName('', 'txt', date)).toBe('无标题文档-20260815-093005.txt');
  });

  it('sanitizeFileName 去除非法字符', () => {
    expect(sanitizeFileName('a/b\\c:d*e?f"g<h>i|j')).toBe('a-b-c-d-e-f-g-h-i-j');
    expect(sanitizeFileName('   ')).toBe('无标题文档');
  });

  it('formatDateTimeStamp 格式', () => {
    expect(formatDateTimeStamp(new Date(2026, 0, 2, 3, 4, 5))).toBe('20260102-030405');
  });
});
