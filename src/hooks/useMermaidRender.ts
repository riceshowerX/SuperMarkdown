import { useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { mermaidSanitizeConfig, installSanitizeHooks } from '../services/markdown/sanitize.config';
import { resolveTheme } from '../theme/init';
import type { Theme } from '../types/models';

/* Mermaid 客户端渲染（架构 §9.1 第三层：markdown-it 透传源码 → 客户端 mermaid.render → SVG）
 * - 动态导入 mermaid：单独 chunk，首屏不加载（mermaid ~2.8MB）
 * - securityLevel:'strict'：禁用 HTML 标签 / 点击绑定 / foreignObject，输出经 DOMPurify 二次清洗
 * - 主题跟随明暗：theme 变化时重新 initialize + 重渲染
 * - SM-15/73：源码级 LRU 缓存（内容未变的图零成本）+ 世代号取消（替代布尔 cancelled，
 *   每个 await 后校验，防止快速输入时的渲染风暴）+ 串行渲染（替代 Promise.all 并发挤压主线程）
 * - 失败降级为错误占位，不白屏、不抛异常 */

type MermaidApi = {
  initialize: (cfg: Record<string, unknown>) => void;
  render: (id: string, text: string) => Promise<{ svg: string }>;
};

/** 渲染结果缓存：key = theme + '\u0000' + source；LRU 上限 30（SM-15/73 ②） */
const SVG_CACHE_LIMIT = 30;
const svgCache = new Map<string, string>();

function cacheGet(key: string): string | undefined {
  const hit = svgCache.get(key);
  if (hit !== undefined) {
    // LRU 触碰：删除后重插，保持最新项在尾部
    svgCache.delete(key);
    svgCache.set(key, hit);
  }
  return hit;
}

function cacheSet(key: string, svg: string): void {
  if (svgCache.has(key)) svgCache.delete(key);
  else if (svgCache.size >= SVG_CACHE_LIMIT) {
    const oldest = svgCache.keys().next().value;
    if (oldest !== undefined) svgCache.delete(oldest);
  }
  svgCache.set(key, svg);
}

/**
 * 渲染前源码预处理：修复 mermaid 11.16.1 对「无 title 的 pie」崩溃的 bug
 * （`pie` 无 title 行时 mermaid 内部读 null.firstChild 抛错）。
 * 检测到 pie 图表且首行无 title 时，自动补默认 title，保持数据行不变。
 */
function preprocessSource(src: string): string {
  const trimmed = src.trim();
  if (!/^pie\b/i.test(trimmed)) return src; // 非 pie 图表不处理
  const firstLine = trimmed.split('\n')[0] ?? '';
  if (/^pie\s+title\b/i.test(firstLine.trim())) return src; // 已有 title 不处理
  const rest = trimmed.replace(/^pie\s*\n?/i, '');
  return `pie title 饼图\n${rest}`;
}

let mermaidMod: MermaidApi | null = null;
let initTheme: 'light' | 'dark' | null = null;
let idSeq = 0;

async function loadMermaid(theme: 'light' | 'dark'): Promise<MermaidApi> {
  if (!mermaidMod) {
    const mod = await import('mermaid');
    mermaidMod = (mod.default ?? (mod as unknown as MermaidApi)) as MermaidApi;
    installSanitizeHooks();
  }
  if (initTheme !== theme) {
    mermaidMod.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'strict',
      fontFamily: 'inherit',
    });
    initTheme = theme;
  }
  return mermaidMod;
}

function makeErrorNode(message: string): HTMLElement {
  const div = document.createElement('div');
  div.className = 'mermaid mermaid-error';
  div.setAttribute('role', 'img');
  div.textContent = '图表渲染失败：' + message;
  return div;
}

/** 包裹净化后的 SVG（与 makeErrorNode 对称的替换节点） */
function wrapSvg(svg: string): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'mermaid';
  wrapper.innerHTML = svg;
  return wrapper;
}

/**
 * 扫描容器内 pre code.language-mermaid，渲染为 SVG 并替换。
 * 依赖 html（内容变化重扫）与 resolved 主题（切换重渲染，SM-15/73 ①）。
 */
export function useMermaidRender(
  containerRef: React.RefObject<HTMLElement | null>,
  html: string,
  theme: Theme,
): void {
  const resolved = resolveTheme(theme);
  // 世代号（SM-15/73 ③）：effect 重跑即自增；异步回调里每个 await 后校验，
  // 落后于当前世代的结果一律丢弃——比布尔 cancelled 更可靠（可多次失效）
  const genRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const blocks = Array.from(
      container.querySelectorAll<HTMLElement>('pre code.language-mermaid'),
    );
    if (blocks.length === 0) return;

    const gen = ++genRef.current;
    const isStale = () => gen !== genRef.current;

    // 每个 code 的父级 pre 即待替换节点；去重以防嵌套异常
    const preMap = Array.from(
      new Set(blocks.map((code) => code.parentElement).filter((p): p is HTMLPreElement => p instanceof HTMLPreElement)),
    );

    void (async () => {
      let api: MermaidApi;
      try {
        api = await loadMermaid(resolved);
      } catch {
        if (isStale()) return;
        preMap.forEach((pre) => pre.replaceWith(makeErrorNode('图表引擎加载失败')));
        return;
      }
      if (isStale()) return;

      // SM-15/73 ④：串行渲染——mermaid.render 是重 CPU 操作，并发只会挤占主线程形成长任务
      for (const pre of preMap) {
        if (isStale()) return;
        const code = pre.querySelector('code');
        const source = preprocessSource(code?.textContent ?? '');
        const cacheKey = `${resolved}\u0000${source}`;
        const cached = cacheGet(cacheKey);
        if (cached !== undefined) {
          pre.replaceWith(wrapSvg(cached));
          continue; // 内容未变的图直接复用，零渲染成本
        }
        const id = `mmd-svg-${++idSeq}`;
        try {
          const { svg } = await api.render(id, source);
          if (isStale()) return;
          const clean = DOMPurify.sanitize(svg, mermaidSanitizeConfig);
          cacheSet(cacheKey, clean);
          pre.replaceWith(wrapSvg(clean));
        } catch (err) {
          if (isStale()) return;
          const msg = err instanceof Error ? err.message : '语法无法解析';
          pre.replaceWith(makeErrorNode(msg));
        }
      }
    })();

    return () => {
      /* 世代号自增即作废所有在飞渲染，无需额外清理 */
    };
  }, [containerRef, html, resolved]);
}
