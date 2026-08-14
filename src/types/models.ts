/** 文档模型（Spec §6.1 锁定） */
export interface Document {
  /** crypto.randomUUID() */
  id: string;
  /** 首行标题（# 之后）或"无标题文档 N"，可被用户手动重命名 */
  title: string;
  /** Markdown 原文 */
  content: string;
  /** epoch ms */
  createdAt: number;
  /** epoch ms */
  updatedAt: number;
}

export type Theme = 'light' | 'dark' | 'system';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** 桌面视图模式；移动端为单栏 Tab（见 ui.store.mobileMode） */
export type ViewMode = 'split' | 'edit' | 'preview';

export type MobileMode = 'edit' | 'preview';

/** 统一错误码（架构 §14.1） */
export type AppErrorCode =
  | 'STORAGE_UNAVAILABLE'
  | 'STORAGE_QUOTA_EXCEEDED'
  | 'SAVE_FAILED'
  | 'LOAD_FAILED'
  | 'DELETE_FAILED'
  | 'RENDER_FAILED'
  | 'EXPORT_FAILED'
  | 'IMAGE_TOO_LARGE'
  | 'IMAGE_READ_FAILED'
  | 'UNKNOWN';

/** Markdown 渲染结果（架构 §9.1） */
export interface RenderResult {
  /** 已 sanitize 的 HTML */
  html: string;
  /** 提取的标题文本（用于文档列表标题派生） */
  headings: string[];
  /** 渲染错误信息（不允许抛异常穿透） */
  error: null | string;
}

/** 字数统计（架构 §9.5） */
export interface DocStats {
  /** 非空白字符数 */
  chars: number;
  /** 英文词数 */
  words: number;
  /** 行数 */
  lines: number;
  /** 阅读时长（分钟） */
  readingMinutes: number;
}

/** Toast 消息 */
export interface ToastItem {
  id: number;
  kind: 'success' | 'error' | 'info';
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** 确认对话框状态 */
export interface ConfirmState {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}
