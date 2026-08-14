/**
 * QA 已知缺陷回归用例：纯文本导出残留表格分隔线（P2，AC-11 完整性）
 *
 * 证据（2026-08-15 QA 独立验证）：
 *   markdownToPlainText('| 列1 | 列2 |\n| --- | --- |\n| a | b |')
 *   → '列1 列2 \n --- --- \n a b'
 *   表格分隔线语法 `--- ---` 未去除，残留为纯文本噪声。
 *
 * 期望：分隔线行（| --- | --- |）应整体去除，不残留裸 `-` 语法。
 * 建议修复：markdownToPlainText 增加对表格分隔线行的清理
 *   （如 .replace(/^\s*\|?[\s:|-]+\|?\s*$/gm, '') 或识别 ^\s*\|?\s*:?-{2,}:?(\s*\|...)*\s*$）。
 *
 * 本用例保持红，作为缺陷回归证据，不 skip、不弱化断言。
 * 修复后应转绿。
 */
import { describe, it, expect } from 'vitest';
import { markdownToPlainText } from '../services/export/export.service';

describe('Regression: 纯文本导出表格分隔线残留（AC-11）', () => {
  it('表格分隔线不应残留在纯文本中', () => {
    const md = ['| 列1 | 列2 |', '| --- | --- |', '| a | b |'].join('\n');
    const text = markdownToPlainText(md);
    // 表头与数据行可保留为纯文本，分隔线行（---）必须去除
    expect(text).not.toMatch(/^\s*-{2,}\s*-{2,}/m);
    expect(text).not.toMatch(/---/);
  });
});
