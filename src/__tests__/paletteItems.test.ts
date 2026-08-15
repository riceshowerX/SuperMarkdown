/**
 * C 版命令面板分组测试（PAGES §6：Cmd+K 升格为核心入口）
 * 覆盖：主题切换独立分组 / 文档跳转分组 / 分组顺序 / 搜索过滤 / 最近使用
 */
import { describe, it, expect } from 'vitest';
import {
  buildPaletteItems,
  groupPaletteItems,
  type BuildItemsDeps,
} from '../components/common/paletteItems';
import type { Document } from '../types/models';

function makeDeps(overrides?: Partial<BuildItemsDeps>): BuildItemsDeps {
  return {
    query: '',
    documents: [],
    recent: [],
    theme: 'light',
    resolvedDark: false,
    typewriterMode: false,
    createDocument: () => {},
    exportHtml: () => {},
    exportTxt: () => {},
    setViewMode: () => {},
    setTheme: () => {},
    toggleTypewriter: () => {},
    openShortcuts: () => {},
    openDoc: () => {},
    runFormat: () => {},
    ...overrides,
  };
}

const mkDoc = (id: string, title: string): Document => ({
  id,
  title,
  content: '',
  createdAt: 0,
  updatedAt: 0,
});

describe('C 版: 命令面板分组（paletteItems）', () => {
  it('主题切换命令归入「主题切换」组（非「视图」）', () => {
    const items = buildPaletteItems(makeDeps());
    const themeItem = items.find((i) => i.id === 'theme');
    expect(themeItem).toBeDefined();
    expect(themeItem!.group).toBe('主题切换');
  });

  it('文档跳转项归入「文档跳转」组', () => {
    const items = buildPaletteItems(makeDeps({ documents: [mkDoc('d1', '测试文档')] }));
    const docItem = items.find((i) => i.id === 'doc-d1');
    expect(docItem).toBeDefined();
    expect(docItem!.group).toBe('文档跳转');
  });

  it('分组顺序：最近使用 → 动作 → 视图 → 格式 → 文档跳转 → 主题切换 → 帮助', () => {
    const items = buildPaletteItems(
      makeDeps({
        documents: [mkDoc('d1', '文档A')],
        recent: [{ id: 'd2', title: '最近文档' }],
      }),
    );
    const groups = groupPaletteItems(items);
    expect(groups.map((g) => g.label)).toEqual([
      '最近使用', '动作', '视图', '格式', '文档跳转', '主题切换', '帮助',
    ]);
  });

  it('主题标签随 resolvedDark 切换（亮→暗 / 暗→亮）', () => {
    const lightItems = buildPaletteItems(makeDeps({ resolvedDark: false }));
    expect(lightItems.find((i) => i.id === 'theme')!.label).toBe('切换为暗色主题');

    const darkItems = buildPaletteItems(makeDeps({ resolvedDark: true }));
    expect(darkItems.find((i) => i.id === 'theme')!.label).toBe('切换为明亮主题');
  });

  it('搜索过滤：query 匹配文档名时仅保留命中项', () => {
    const docs = [mkDoc('d1', 'React 笔记'), mkDoc('d2', 'Vue 笔记')];
    const items = buildPaletteItems(makeDeps({ documents: docs, query: 'react' }));
    const docItems = items.filter((i) => i.group === '文档跳转');
    expect(docItems).toHaveLength(1);
    expect(docItems[0].label).toBe('React 笔记');
  });

  it('空 query 包含最近使用项', () => {
    const items = buildPaletteItems(
      makeDeps({ recent: [{ id: 'r1', title: '最近文档' }] }),
    );
    expect(items.some((i) => i.group === '最近使用')).toBe(true);
  });

  it('有 query 时不显示最近使用项（仅在空 query 展示）', () => {
    const items = buildPaletteItems(
      makeDeps({ recent: [{ id: 'r1', title: '最近文档' }], query: '文档' }),
    );
    expect(items.some((i) => i.group === '最近使用')).toBe(false);
  });

  it('动作组包含新建 / 导出 HTML / 导出纯文本', () => {
    const items = buildPaletteItems(makeDeps());
    const actionLabels = items
      .filter((i) => i.group === '动作')
      .map((i) => i.label);
    expect(actionLabels).toContain('新建文档');
    expect(actionLabels).toContain('导出 HTML');
    expect(actionLabels).toContain('导出纯文本');
  });

  it('视图组包含分屏 / 编辑 / 预览 / 打字机（不含主题）', () => {
    const items = buildPaletteItems(makeDeps());
    const viewLabels = items
      .filter((i) => i.group === '视图')
      .map((i) => i.label);
    expect(viewLabels).toContain('视图：分屏');
    expect(viewLabels).toContain('视图：仅编辑');
    expect(viewLabels).toContain('视图：仅预览');
    expect(viewLabels.some((l) => l.includes('打字机'))).toBe(true);
    // 主题已拆分到独立组
    expect(viewLabels.some((l) => l.includes('主题'))).toBe(false);
  });

  it('groupPaletteItems 跳过空组', () => {
    // 无文档 + 无最近 → 文档跳转组为空，应跳过
    const items = buildPaletteItems(makeDeps({ documents: [], recent: [] }));
    const groups = groupPaletteItems(items);
    expect(groups.map((g) => g.label)).not.toContain('文档跳转');
    expect(groups.map((g) => g.label)).not.toContain('最近使用');
  });
});
