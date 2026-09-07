/** Blob 下载与文件命名工具（架构 utils/file.ts） */

/** 触发浏览器下载 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Windows 保留设备名（含带扩展名形态，如 CON.txt） */
const WIN_RESERVED_NAME_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** 去除文件名非法字符（Windows: \ / : * ? " < > |），并做加固（SM-38/46）：
 *  剥离控制字符与首尾的 `.` / `-` / 空格（防 ".."、隐藏文件、尾点截断问题）；
 *  截断按 Unicode 码点进行（不劈开代理对）；Windows 保留设备名追加 `_` 回落。空则回退默认名。 */
export function sanitizeFileName(name: string, fallback = '无标题文档'): string {
  const cleaned = name
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[.\- ]+/, '')
    .replace(/[.\- ]+$/, '');
  // 按码点截断，避免把 surrogate pair 劈成半截产生乱码
  const truncated = [...cleaned].slice(0, 80).join('');
  if (!truncated) return fallback;
  // 保留设备名以「首个点之前的主名」判定（CON.txt 同样被 Windows 拒绝）
  const base = truncated.split('.')[0] ?? truncated;
  return WIN_RESERVED_NAME_RE.test(base) ? `_${truncated}` : truncated;
}

/** 时间戳 yyyyMMdd-HHmmss */
export function formatDateTimeStamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

/** 导出文件名：{sanitizedTitle}-{yyyyMMdd-HHmmss}.{ext} */
export function buildExportFileName(title: string, ext: 'html' | 'txt', date: Date = new Date()): string {
  return `${sanitizeFileName(title)}-${formatDateTimeStamp(date)}.${ext}`;
}

/** 相对时间（列表项显示） */
export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - timestamp);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  const d = new Date(timestamp);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}
