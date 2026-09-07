import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/** 应用级错误边界（SM-44）：渲染期未捕获异常不白屏，展示错误卡片与重试入口 */
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || '发生未知错误' };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[SuperMarkdown] app render failed:', error, info.componentStack);
  }

  /** 整树重挂载（key 变化强制重建 React 子树，而非仅复位本边界状态） */
  private handleRetry = (): void => {
    this.setState({ hasError: false, message: '' });
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-dvh items-center justify-center bg-bg p-6 text-fg">
          <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 text-center">
            <p className="tx-base wt-semibold text-danger">应用出现异常</p>
            <p className="mt-1 tx-xs text-muted lh-body">{this.state.message}</p>
            <button
              type="button"
              onClick={this.handleRetry}
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 tx-sm wt-medium text-on-accent hover:bg-accent-hover"
            >
              重新加载
            </button>
            <p className="mt-3 tx-xs text-fg-2">本地数据不会丢失，重载后可继续编辑</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
