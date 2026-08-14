import { describe, it, expect } from 'vitest';
import { applyEditorCommand, insertText, type EditorCommand } from '../utils/editor';

describe('editor utils', () => {
  it('bold 包裹选区', () => {
    const r = applyEditorCommand('hello world', 0, 5, 'bold');
    expect(r.value).toBe('**hello** world');
    expect(r.start).toBe(2);
    expect(r.end).toBe(7);
  });

  it('bold 无选区时插入占位并选中', () => {
    const r = applyEditorCommand('ab', 1, 1, 'bold');
    expect(r.value).toBe('a**加粗文字**b');
    expect(r.start).toBe(3); // 光标在 index1，** 从 index1 起
    expect(r.end).toBe(7); // 3 + 占位长度 4
  });

  it('h1 行前缀（可切换）', () => {
    const r1 = applyEditorCommand('标题', 0, 2, 'h1');
    expect(r1.value).toBe('# 标题');
    const r2 = applyEditorCommand('# 标题', 0, 5, 'h1');
    expect(r2.value).toBe('标题'); // 再次点击移除
  });

  it('quote 给光标所在行添加前缀', () => {
    const r = applyEditorCommand('line1\nline2', 6, 6, 'quote');
    expect(r.value).toBe('line1\n> line2'); // 光标在第二行
    const r2 = applyEditorCommand('line1\nline2', 2, 2, 'quote');
    expect(r2.value).toBe('> line1\nline2'); // 光标在第一行
  });

  it('codeBlock 包裹', () => {
    const r = applyEditorCommand('code here', 0, 9, 'codeBlock');
    expect(r.value).toBe('```\ncode here\n```');
    expect(r.start).toBe(3);
    expect(r.end).toBe(12);
  });

  it('table 在行首插入表格模板', () => {
    const r = applyEditorCommand('before\ncontent', 7, 7, 'table');
    expect(r.value).toContain('| 列 1 | 列 2 | 列 3 |');
    expect(r.value).toContain('before\n');
  });

  it('hr 插入分隔线', () => {
    const r = applyEditorCommand('abc', 1, 1, 'hr');
    expect(r.value).toContain('---\nabc');
  });

  it('insertText 光标处插入并定位', () => {
    const r = insertText('hello', 2, 2, 'XY');
    expect(r.value).toBe('heXYllo');
    expect(r.start).toBe(4);
    expect(r.end).toBe(4);
  });

  it('所有命令返回合法结构（不抛错）', () => {
    const cmds: EditorCommand[] = ['bold', 'italic', 'inlineCode', 'link', 'h1', 'h2', 'h3', 'quote', 'codeBlock', 'ul', 'ol', 'task', 'table', 'hr'];
    for (const cmd of cmds) {
      const r = applyEditorCommand('sample text', 3, 7, cmd);
      expect(typeof r.value).toBe('string');
      expect(r.start).toBeGreaterThanOrEqual(0);
      expect(r.end).toBeGreaterThanOrEqual(r.start);
    }
  });
});
