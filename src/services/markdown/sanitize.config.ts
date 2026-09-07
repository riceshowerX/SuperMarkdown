import DOMPurify from 'dompurify';

/**
 * DOMPurify 白名单配置（架构 §11.2 第二层防线）
 *
 * 双配置策略：
 * - sanitizeConfig       → markdown-it 输出（含 KaTeX HTML/MathML）：`<style>` 标签仍禁用，
 *                          `style` 属性放行（KaTeX 内联定位依赖），MathML 标签精细放行。
 * - mermaidSanitizeConfig → Mermaid 客户端渲染的 SVG：放行 `<style>` 标签（主题着色依赖）
 *                          + SVG 标签/属性，仍 FORBID script/iframe/object/embed/form/on*。
 *
 * 安全前提：markdown-it html:false 已把用户原始 HTML/CSS 一律转义，进入本层的
 * `<style>`/`style` 只可能来自受信插件（KaTeX/Mermaid strict 模式），不构成用户侧注入面。
 * - FORBID_TAGS：script/iframe/object/embed/form 全局禁用；input 仅放行任务列表复选框（见 hook）
 * - FORBID_ATTR：srcdoc/onerror/onload 禁用；on* 事件属性 DOMPurify 默认已拦截
 * - ALLOWED_URI_REGEXP：仅 http(s)/mailto/data:image 位图(png/jpeg/gif/webp/avif)/相对地址/片段(#)，
 *   禁 javascript:/vbscript:/data:image/svg+xml 等（SM-37）
 */

/* ── MathML（KaTeX 输出）+ SVG（Mermaid 输出）标签白名单 ── */
const MATHML_TAGS = [
  'math', 'mrow', 'msup', 'msub', 'msubsup', 'mfrac', 'mi', 'mo', 'mn', 'mtext',
  'mspace', 'mtable', 'mtr', 'mtd', 'munder', 'mover', 'munderover', 'mstyle',
  'menclose', 'merror', 'mfenced', 'msqrt', 'mroot', 'annotation', 'semantics',
];
/* SM-35：不含 foreignObject——mermaid strict 模式不产出，且它是 HTML-in-SVG 的注入面 */
const SVG_TAGS = [
  'svg', 'g', 'path', 'circle', 'rect', 'line', 'text', 'polygon', 'polyline',
  'ellipse', 'defs', 'marker', 'tspan', 'use', 'clipPath',
  'linearGradient', 'radialGradient', 'stop', 'filter', 'title', 'desc', 'pattern',
];

/* ── 属性白名单：MathML + SVG 语义属性（style 属性放行，CSS 由 DOMPurify 清洗） ── */
const EXT_ATTR = [
  // MathML（KaTeX）
  'mathvariant', 'aria-hidden', 'displaystyle', 'scriptlevel', 'columnalign', 'rowalign',
  'columnspacing', 'rowspacing', 'columnlines', 'rowlines', 'frame', 'framespacing',
  'equalrows', 'equalcolumns', 'lspace', 'rspace', 'stretchy', 'symmetric', 'movablelimits',
  'accent', 'accentunder', 'fence', 'separator', 'form', 'notation', 'open', 'close',
  'separators', 'bevelled', 'denomalign', 'numalign', 'stackalign', 'side', 'crossout',
  'longdivstyle', 'location', 'position', 'shift', 'height', 'depth', 'width', 'voffset',
  'minsize', 'maxsize', 'largeop', 'linebreak', 'lineleading',
  // SVG（Mermaid）
  'class', 'style', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity', 'fill-opacity', 'opacity', 'd',
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'transform',
  'marker-end', 'marker-start', 'marker-mid', 'viewBox', 'preserveAspectRatio', 'points',
  'text-anchor', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-decoration',
  'color', 'display', 'visibility', 'offset', 'stop-color', 'stop-opacity', 'gradientUnits',
  'gradientTransform', 'spreadMethod', 'clip-path', 'clip-rule', 'fill-rule', 'id', 'href',
  'xlink:href', 'refX', 'refY', 'markerWidth', 'markerHeight', 'orient', 'patternUnits',
  'patternTransform', 'filter', 'filterUnits', 'stdDeviation', 'result', 'in', 'in2', 'dx', 'dy',
];

const FORBID_ATTR = ['srcdoc', 'onerror', 'onload'];
/* SM-37：data: 收窄为位图 MIME（不允许 svg+xml 等——后者在部分上下文有历史绕过面） */
const ALLOWED_URI_REGEXP =
  /^(?:(?:(?:https?|mailto):|data:image\/(?:png|jpe?g|gif|webp|avif);)|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;

const BASE_PROFILES = { html: true, mathMl: true, svg: true, svgFilters: true } as const;

/** markdown-it 输出 sanitize（含 KaTeX）：`<style>` 标签禁用，style 属性放行 */
export const sanitizeConfig = {
  USE_PROFILES: BASE_PROFILES,
  ADD_TAGS: [...MATHML_TAGS, ...SVG_TAGS],
  ADD_ATTR: EXT_ATTR,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'style'],
  FORBID_ATTR,
  ALLOWED_URI_REGEXP,
};

/** Mermaid SVG sanitize：放行 `<style>` 标签（主题着色），仍禁 script/iframe/object/embed/form */
export const mermaidSanitizeConfig = {
  USE_PROFILES: BASE_PROFILES,
  ADD_TAGS: [...MATHML_TAGS, ...SVG_TAGS, 'style'],
  ADD_ATTR: EXT_ATTR,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR,
  ALLOWED_URI_REGEXP,
};

let hooksInstalled = false;

/** 安装一次性的额外加固 hook（幂等，全局生效于所有 sanitize 调用） */
export function installSanitizeHooks(): void {
  if (hooksInstalled) return;
  hooksInstalled = true;

  DOMPurify.addHook('uponSanitizeElement', (node) => {
    const el = node as Element;
    // 大小写无关比较（HTML 元素 tagName 大写、SVG 元素小写）
    if (el.tagName?.toLowerCase() === 'input') {
      // 仅允许任务列表复选框；其余任意 input 一律删除
      if (el.getAttribute('type') !== 'checkbox') {
        el.parentNode?.removeChild(el);
      }
    }
  });

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    const el = node as Element;
    const tag = el.tagName?.toLowerCase() ?? '';
    // 任务列表复选框强制只读（markdown-it-task-lists 不输出 disabled）
    if (tag === 'input' && el.getAttribute('type') === 'checkbox') {
      el.setAttribute('disabled', '');
    }
    // SM-59：锚点兜底覆盖 HTML <a>('A') 与 SVG <a>('a')——统一小写比较
    if (tag === 'a') {
      const href = `${el.getAttribute('href') ?? ''}${el.getAttribute('xlink:href') ?? ''}`.trim();
      if (/^(javascript|vbscript|data):/i.test(href)) {
        el.removeAttribute('href');
        el.removeAttribute('xlink:href');
      }
      // 反向 tabnabbing 加固：带 href 的链接强制 rel
      if (el.hasAttribute('href')) {
        el.setAttribute('rel', 'noopener noreferrer nofollow');
      }
    }
  });
}
