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
