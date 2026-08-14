import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/** 预览区错误边界：渲染异常不白屏（Spec §14.2） */
export default class PreviewErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[SuperMarkdown] preview render failed:', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 text-center">
            <p className="tx-sm wt-medium text-danger">预览渲染失败</p>
            <p className="mt-1 tx-xs text-muted">编辑区内容不受影响，可继续编辑</p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="mt-3 inline-flex h-8 items-center rounded-md bg-accent px-3 tx-xs wt-medium text-on-accent hover:bg-accent-hover"
            >
              重试
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
