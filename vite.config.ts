import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';

/**
 * 仅开发模式放宽 script-src，允许 @vitejs/plugin-react 注入 React Refresh 内联前导脚本。
 * 生产构建保持严格 CSP：script-src 'self'（index.html 中锁定）。
 */
function devCspRelax(): Plugin {
  return {
    name: 'dev-csp-relax',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'");
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devCspRelax()],
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
