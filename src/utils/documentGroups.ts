/** 文档列表分组/排序纯函数（侧栏信息密度升级，UIUX-V2 §4.3；可测试、无 DOM 依赖） */

import type { Document } from '../types/models';

export type TimeGroupKey = 'today' | 'yesterday' | 'earlier';

export interface TimeGroup {
  key: TimeGroupKey;
  label: string;
  docs: Document[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** 按相对时间分组：今天 / 昨天 / 更早（以本地自然日为界） */
export function groupDocumentsByTime(docs: Document[], now: number = Date.now()): TimeGroup[] {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const todayStart = startOfToday.getTime();
  const yesterdayStart = todayStart - DAY_MS;

  const buckets: Record<TimeGroupKey, Document[]> = { today: [], yesterday: [], earlier: [] };
  for (const d of docs) {
    if (d.updatedAt >= todayStart) buckets.today.push(d);
    else if (d.updatedAt >= yesterdayStart) buckets.yesterday.push(d);
    else buckets.earlier.push(d);
  }

  const groups: TimeGroup[] = [];
  if (buckets.today.length > 0) groups.push({ key: 'today', label: '今天', docs: buckets.today });
  if (buckets.yesterday.length > 0) groups.push({ key: 'yesterday', label: '昨天', docs: buckets.yesterday });
  if (buckets.earlier.length > 0) groups.push({ key: 'earlier', label: '更早', docs: buckets.earlier });
  return groups;
}

export type DocumentSort = 'updated' | 'title';

/** 排序：最近修改（updatedAt 降序）/ 标题 A-Z */
export function sortDocuments(docs: Document[], sort: DocumentSort): Document[] {
  const arr = [...docs];
  if (sort === 'title') {
    arr.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'));
  } else {
    arr.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  return arr;
}
