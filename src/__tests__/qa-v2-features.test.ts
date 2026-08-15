/**
 * v1.1 改版新增纯函数测试（UIUX-V2 §5.1/§5.2/§5.3/§4.3）
 * 覆盖：快捷键匹配 / 文档时间分组与排序 / 滚动同步比例换算 / 光标行号计算
 */
import { describe, it, expect } from 'vitest';
import { getCommandShortcut, matchesShortcut } from '../config/shortcuts';
import { groupDocumentsByTime, sortDocuments } from '../utils/documentGroups';
import { clampScrollRatio, scrollTopFromRatio } from '../utils/scrollSync';
import { computeActiveLine } from '../utils/editor';
import type { Document } from '../types/models';

function ev(partial: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    key: '',
    ...partial,
  } as KeyboardEvent;
}

describe('v1.1: 快捷键（shortcuts）', () => {
  it('getCommandShortcut 返回格式命令的展示快捷键（平台无关）', () => {
    const bold = getCommandShortcut('bold');
    expect(bold).toBeDefined();
    expect(bold?.display).toMatch(/B$/); // ⌘B / Ctrl+B
    const h1 = getCommandShortcut('h1');
    expect(h1?.display).toMatch(/1$/);
    expect(h1?.display).toContain('Shift');
    expect(getCommandShortcut('table')).toBeUndefined();
  });

  it('meta 主修饰键：非 mac 平台（jsdom）映射到 Ctrl', () => {
    expect(matchesShortcut(['meta', 'k'], ev({ ctrlKey: true, key: 'k' }))).toBe(true);
    expect(matchesShortcut(['meta', 'k'], ev({ key: 'k' }))).toBe(false);
  });

  it('ctrl 字面量：跨平台一致（打字机 Ctrl+Shift+T）', () => {
    expect(matchesShortcut(['ctrl', 'shift', 't'], ev({ ctrlKey: true, shiftKey: true, key: 't' }))).toBe(true);
    expect(matchesShortcut(['ctrl', 'shift', 't'], ev({ ctrlKey: true, key: 't' }))).toBe(false); // 缺 Shift
  });

  it('? 帮助键需 Shift 且不允许 Ctrl/⌘', () => {
    expect(matchesShortcut(['shift', '?'], ev({ shiftKey: true, key: '?' }))).toBe(true);
    expect(matchesShortcut(['shift', '?'], ev({ shiftKey: true, ctrlKey: true, key: '?' }))).toBe(false);
  });

  it('按键不匹配返回 false', () => {
    expect(matchesShortcut(['meta', 'b'], ev({ metaKey: true, key: 'x' }))).toBe(false);
    expect(matchesShortcut(['meta', 'shift', '1'], ev({ metaKey: true, key: '1' }))).toBe(false);
  });
});

describe('v1.1: 侧栏分组与排序（documentGroups）', () => {
  const now = new Date('2026-08-14T12:00:00').getTime();
  const mk = (id: string, title: string, updatedAt: number): Document => ({
    id,
    title,
    content: '',
    createdAt: now,
    updatedAt,
  });

  it('按今天/昨天/更早分组（本地自然日）', () => {
    const groups = groupDocumentsByTime(
      [
        mk('a', '今天文档', now - 1000),
        mk('b', '昨天文档', now - 24 * 3600 * 1000 - 1000),
        mk('c', '更早文档', now - 7 * 24 * 3600 * 1000),
      ],
      now,
    );
    expect(groups.map((g) => g.label)).toEqual(['今天', '昨天', '更早']);
    expect(groups[0].docs[0].id).toBe('a');
  });

  it('空列表返回空分组', () => {
    expect(groupDocumentsByTime([], now)).toEqual([]);
  });

  it('排序：标题 A-Z 与最近修改降序', () => {
    const docs = [mk('a', 'Beta', 1), mk('b', 'Alpha', 3), mk('c', 'Gamma', 2)];
    expect(sortDocuments(docs, 'title').map((d) => d.title)).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(sortDocuments(docs, 'updated').map((d) => d.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('v1.1: 滚动同步比例换算（scrollSync）', () => {
  it('clampScrollRatio 边界与除零保护', () => {
    expect(clampScrollRatio(0, 200, 50)).toBe(0);
    expect(clampScrollRatio(150, 200, 50)).toBe(1);
    expect(clampScrollRatio(75, 200, 50)).toBe(0.5);
    expect(clampScrollRatio(50, 100, 100)).toBe(0); // 无可滚动空间
    expect(clampScrollRatio(Number.NaN, 200, 50)).toBe(0); // NaN 防护
  });

  it('scrollTopFromRatio 换算并取整', () => {
    expect(scrollTopFromRatio(0.5, 200, 50)).toBe(75);
    expect(scrollTopFromRatio(1.2, 200, 50)).toBe(150);
    expect(scrollTopFromRatio(0.5, 100, 100)).toBe(0);
  });
});

describe('v1.1: 光标行号计算（computeActiveLine）', () => {
  it('按 selectionStart 计算 0 起行号', () => {
    expect(computeActiveLine('abc', 0)).toBe(0);
    expect(computeActiveLine('line1\nline2', 6)).toBe(1);
    expect(computeActiveLine('a\nb\nc', 3)).toBe(1); // 第 2 行开头
    expect(computeActiveLine('abc', 999)).toBe(0); // 越界钳制
    expect(computeActiveLine('abc', -1)).toBe(0);
  });
});
