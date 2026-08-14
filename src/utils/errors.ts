import type { AppErrorCode } from '../types/models';

/** 统一业务异常（架构 §14.1/14.2） */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly userMessage: string;

  constructor(code: AppErrorCode, userMessage: string) {
    super(userMessage);
    this.name = 'AppError';
    this.code = code;
    this.userMessage = userMessage;
  }
}

/** 将任意未知错误归一为 AppError */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new AppError('UNKNOWN', message || '发生未知错误');
}

/** 全局未捕获错误记录（不静默，仅 console） */
export function setupGlobalErrorHandlers(): void {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[SuperMarkdown] unhandledrejection:', event.reason);
  });
  window.addEventListener('error', (event) => {
    console.error('[SuperMarkdown] uncaught error:', event.message, event.error);
  });
}
