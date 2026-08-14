// 主题初始化必须在 React 挂载前执行（防闪烁）——保持首个 import
import './theme/init';
import './styles/design-tokens.css';
import './styles/preview.css';
import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { setupGlobalErrorHandlers } from './utils/errors';

setupGlobalErrorHandlers();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('root element not found');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
