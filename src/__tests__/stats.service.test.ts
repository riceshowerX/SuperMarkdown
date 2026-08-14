import { describe, it, expect } from 'vitest';
import { computeStats } from '../services/stats/stats.service';

describe('stats.service', () => {
  it('空文档全 0', () => {
    expect(computeStats('')).toEqual({ chars: 0, words: 0, lines: 0, readingMinutes: 0 });
  });

  it('英文：chars 非空白、words 按词、阅读时长按 200 词/分', () => {
    const stats = computeStats('hello world');
    expect(stats.chars).toBe(10); // 去掉空白
    expect(stats.words).toBe(2);
    expect(stats.lines).toBe(1);
    expect(stats.readingMinutes).toBe(1); // ceil(2/200) → 1
  });

  it('中文：按字计数、阅读时长按 400 字/分', () => {
    const stats = computeStats('你好世界');
    expect(stats.chars).toBe(4);
    expect(stats.words).toBe(0);
    expect(stats.lines).toBe(1);
    expect(stats.readingMinutes).toBe(1);
  });

  it('中文 400 字 → 阅读 1 分钟（混合计数）', () => {
    const cjk = '字'.repeat(400);
    const stats = computeStats(cjk);
    expect(stats.chars).toBe(400);
    expect(stats.readingMinutes).toBe(1);
  });

  it('中英混合：分钟 = ceil(中文字/400 + 英文词/200)', () => {
    const content = '字'.repeat(400) + ' ' + 'word '.repeat(200);
    const stats = computeStats(content);
    expect(stats.readingMinutes).toBe(2); // 1 + 1
  });

  it('行数计算（含末尾换行）', () => {
    expect(computeStats('a\nb\nc').lines).toBe(3);
    expect(computeStats('a\n\n\nb').lines).toBe(4);
  });
});
