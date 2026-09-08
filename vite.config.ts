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
  // 相对路径资源：兼容 Electron 壳 file:// 加载 dist/（架构 §12.2），Web 形态任选挂载路径亦可用
  base: './',
  plugins: [react(), tailwindcss(), devCspRelax()],
  build: {
    // PERF-01：仅固定 react 运行时归属。markdown-it/katex/highlight.js 不放入 manualChunks——
    // 它们由 PreviewPane/actions 的动态 import 自然拆分为异步 chunk，静态登记反而会拉回首屏。
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
  },
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
