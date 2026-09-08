// 主题初始化必须在 React 挂载前执行（防闪烁）——保持首个 import
import './theme/init';
import './styles/design-tokens.css';
import './styles/preview.css';
import './index.css';

/* PERF-08：字体自托管（@fontsource），替代 index.html 外链 Google Fonts——
 * 零外部请求、离线可用、首屏不再被字体 CSS 阻塞。
 * 采用静态字重版而非 variable 版：variable 包注册的 family 名为
 * "Inter Variable"/"JetBrains Mono Variable"，与 design-tokens.css 现有字体栈
 * （'Inter' / 'JetBrains Mono'）不匹配；静态版 family 名完全一致，零 CSS 改动。 */
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/noto-sans-sc/400.css';
import '@fontsource/noto-sans-sc/500.css';
import '@fontsource/noto-sans-sc/700.css';

/* PERF-02：katex.min.css 已迁移至 markdown.service.ts（随动态渲染链按需加载） */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import AppErrorBoundary from './components/common/AppErrorBoundary';
import { setupGlobalErrorHandlers } from './utils/errors';

setupGlobalErrorHandlers();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('root element not found');

createRoot(rootEl).render(
  <StrictMode>
    {/* SM-44：应用级错误边界——渲染期未捕获异常不白屏 */}
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
