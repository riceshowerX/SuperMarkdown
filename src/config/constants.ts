/** 全局常量（架构 §8.1 / §7.6 锁定值） */

/** 自动保存防抖：停止输入 800ms 后写盘（Spec 裁定） */
export const AUTOSAVE_DEBOUNCE_MS = 800;

/** 预览渲染防抖：300ms（Spec 裁定） */
export const RENDER_DEBOUNCE_MS = 300;

/** 图片内嵌硬上限 5MB（>5MB 拒绝） */
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** 图片体积提示阈值 2MB（2-5MB 插入但提示） */
export const IMAGE_WARN_BYTES = 2 * 1024 * 1024;

/** 压缩最长边 */
export const IMAGE_MAX_DIMENSION = 1920;

/** 压缩 JPEG 质量 */
export const IMAGE_JPEG_QUALITY = 0.8;

/** 连续保存失败超过该次数提示导出备份 */
export const MAX_SAVE_RETRIES = 3;

/** localStorage 兜底键 */
export const STORAGE_FALLBACK_KEY = 'sm_docs_backup';

/** 主题偏好 localStorage 键 */
export const THEME_STORAGE_KEY = 'sm-theme';

/** 已保存状态停留时长（随后淡为 idle） */
export const SAVED_IDLE_MS = 2000;

/** 成功 Toast 自动消失时长 */
export const TOAST_DURATION_MS = 5000;

/** 单文档图片累计内嵌上限 20MB（SM-10：只有单张 5MB 上限会累积出不可用的大文档） */
export const DOC_MAX_IMAGE_BYTES_TOTAL = 20 * 1024 * 1024;

/** 图片解码像素硬上限（SM-60：约 6300×6300，防解压炸弹撑爆 canvas） */
export const IMAGE_MAX_PIXELS = 40_000_000;

/** 关窗兜底缓冲 localStorage 键（SM-09：内容必须带 docId） */
export const CRASH_BUFFER_KEY = 'sm-crash-buffer';

/** localStorage 兜底库损坏数据备份键前缀（SM-20：丢弃脏条目前先留底） */
export const STORAGE_CORRUPT_PREFIX = 'sm_docs_backup_corrupt_';
