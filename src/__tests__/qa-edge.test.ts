/**
 * QA 独立补充测试：XSS 深度边界 / 任务列表只读 / 标题派生 / 降级容错 / 纯文本残留
 * 基于 Spec §9（AC-05/06/10/11/15）与 §11 安全策略反推。
 */
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../services/markdown/markdown.service';
import { deriveTitle, nextTitle } from '../utils/title';
import { markdownToPlainText } from '../services/export/export.service';
import { LocalStorageAdapter } from '../services/storage/localStorage.adapter';
import { STORAGE_FALLBACK_KEY } from '../config/constants';
import type { Document } from '../types/models';

describe('QA: XSS 深度边界（AC-15）', () => {
  it('任务列表未勾选项也强制 disabled（只读，不可交互）', () => {
    const { html } = renderMarkdown('- [ ] 未完成\n- [x] 已完成');
    // 每个复选框都必须带 disabled
    const checks = html.match(/type="checkbox"/g) ?? [];
    expect(checks.length).toBe(2);
    expect(html).toContain('disabled');
    expect((html.match(/disabled/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('svg 图片 dataURL 被 markdown-it 协议白名单拒绝为文本（安全加分，不产生 img）', () => {
    const payload = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIG9ubG9hZD0iYWxlcnQoMSkiPjwvc3ZnPg==';
    const { html } = renderMarkdown(`![x](${payload})`);
    // markdown-it 默认仅允许 data:image/(gif|png|jpeg|webp)，svg 链接整体拒绝 → 原样文本，无 <img>、无脚本载体
    expect(html).not.toContain('<img');
    expect(html).not.toMatch(/onload|onerror/i);
    expect(html).toContain('![x]');
  });

  it('markdown-it linkify 自动链接后仍经白名单（无 javascript:）', () => {
    const { html } = renderMarkdown('访问 www.example.com 或 javascript:alert(1)');
    // linkify 默认补 http://；javascript: 文本不成为可点击链接
    expect(html).toContain('href="http://www.example.com"');
    expect(html).not.toMatch(/href="javascript:/i);
  });

  it('双重编码注入 `<img src=x onerror=alert(1)>` 文本形式不产生可执行 img', () => {
    const { html } = renderMarkdown('&lt;img src=x onerror=alert(1)&gt;');
    // 编码后文本应保持文本，不解析为 img
    expect(html).not.toMatch(/<img[^>]*onerror/i);
  });
});

describe('QA: 标题派生（Spec §6.1）', () => {
  it('deriveTitle 取首个 # 标题文本', () => {
    expect(deriveTitle('# 主标题\n## 副标题')).toBe('主标题');
    expect(deriveTitle('无标题内容')).toBe('');
    expect(deriveTitle('###  三个空格标题')).toBe('三个空格标题');
  });

  it('nextTitle：内容含标题且当前为自动标题 → 跟随首行标题', () => {
    expect(nextTitle('# 新标题\n正文', '无标题文档 1', 1)).toBe('新标题');
    expect(nextTitle('# 新标题\n正文', '', 1)).toBe('新标题');
  });

  it('nextTitle：用户手动重命名过 → 保留手动标题', () => {
    expect(nextTitle('# 新标题\n正文', '我的笔记', 1)).toBe('我的笔记');
  });

  it('nextTitle：无标题且无内容 → 无标题文档 N', () => {
    expect(nextTitle('', '', 3)).toBe('无标题文档 4');
  });
});

describe('QA: 导出纯文本残留（AC-11 完整性）', () => {
  it('图片保留 alt 文本', () => {
    expect(markdownToPlainText('![描述文字](data:image/png;base64,AAAA)')).toContain('描述文字');
  });

  // —— 以下为表格分隔线修复的独立边界验证（QA 回归集，防复发）——
  it('标准 GFM 表格：分隔线行应被完全去除（修复验证）', () => {
    const text = markdownToPlainText('| 列1 | 列2 |\n| --- | --- |\n| a | b |');
    expect(text).not.toContain('---');
    expect(text).toContain('列1');
    expect(text).toContain('a');
    expect(text).toContain('b');
  });

  it('普通水平线 ---（无管道）不应被误伤', () => {
    const text = markdownToPlainText('标题\n\n---\n\n正文');
    expect(text).toContain('标题');
    expect(text).toContain('正文');
  });

  it('代码块内的管道内容不应被破坏（占位符还原）', () => {
    const text = markdownToPlainText('```\n| a | b |\nconst x = 1;\n```');
    expect(text).toContain('| a | b |');
    expect(text).toContain('const x = 1;');
  });

  it('带对齐冒号的表格分隔线（:---:）应去除', () => {
    const text = markdownToPlainText('| A | B |\n| :---: | ---: |\n| 1 | 2 |');
    expect(text).not.toContain('---');
    expect(text).toContain('A');
    expect(text).toContain('1');
  });

  it('代码围栏语言标记行不残留围栏语法', () => {
    const text = markdownToPlainText('```ts\nconst a = 1;\n```');
    expect(text).toContain('const a = 1;');
    expect(text).not.toContain('```');
  });
});

describe('QA: localStorage 降级适配器（AC-17）', () => {
  it('写入后新实例往返读回完整内容', async () => {
    const w = new LocalStorageAdapter();
    await w.createDocument({ id: 'a', title: '持久文档', content: '# 正文', createdAt: 1, updatedAt: 1 });
    const r = new LocalStorageAdapter();
    const doc = await r.getDocument('a');
    expect(doc?.title).toBe('持久文档');
    expect(doc?.content).toBe('# 正文');
  });

  it('存储键固定为 sm_docs_backup', async () => {
    const w = new LocalStorageAdapter();
    await w.createDocument({ id: 'k', title: '键验证', content: '', createdAt: 1, updatedAt: 1 });
    expect(localStorage.getItem(STORAGE_FALLBACK_KEY)).toBeTruthy();
  });

  it('损坏 JSON 不抛错，返回空列表（容错）', async () => {
    localStorage.setItem(STORAGE_FALLBACK_KEY, '{broken json!!!');
    const a = new LocalStorageAdapter();
    expect(await a.listDocuments()).toEqual([]);
  });

  it('updateDocument 对不存在文档执行插入（upsert 语义）', async () => {
    const a = new LocalStorageAdapter();
    await a.updateDocument({ id: 'new', title: '插入', content: '', createdAt: 5, updatedAt: 5 });
    expect(await a.getDocument('new')).toBeTruthy();
  });
});

describe('QA: 数据完整性往返（Document 全字段）', () => {
  it('Document 各字段往返无丢失（id/title/content/createdAt/updatedAt）', async () => {
    const adapter = new LocalStorageAdapter();
    const original: Document = {
      id: 'full-1',
      title: '完整字段',
      content: '**加粗** 与 `code`\n\n- 列表项',
      createdAt: 123456789,
      updatedAt: 987654321,
    };
    await adapter.createDocument(original);
    const back = await new LocalStorageAdapter().getDocument('full-1');
    expect(back).toEqual(original);
  });
});
