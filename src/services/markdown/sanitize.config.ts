import DOMPurify from 'dompurify';

/**
 * DOMPurify 白名单配置（架构 §11.2 第二层防线）
 *
 * - FORBID_TAGS：style/form/iframe/object/embed 一律删除；input 仅放行"禁用复选框"（见 hook）
 * - FORBID_ATTR：srcdoc / onerror / onload / style（on* 事件处理器 DOMPurify 默认已拦截）
 * - ALLOWED_URI_REGEXP：仅 http(s) / mailto / data:image/ / 相对地址，禁 javascript: 等
 *
 * 说明：markdown-it html:false 已把用户原始 HTML 转义，进入本层的 input 只可能来自
 * markdown-it-gfm 任务列表生成的安全复选框；hook 二次校验属性，杜绝任意 input 注入。
 */
const FORBID_TAGS = ['style', 'form', 'iframe', 'object', 'embed'];

const FORBID_ATTR = ['srcdoc', 'onerror', 'onload', 'style'];

const ALLOWED_URI_REGEXP = /^(?:(?:(?:https?|mailto):|data:image\/)|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;

export interface SanitizeConfig {
  USE_PROFILES: { html: boolean };
  FORBID_TAGS: string[];
  FORBID_ATTR: string[];
  ALLOWED_URI_REGEXP: RegExp;
}

export const sanitizeConfig: SanitizeConfig = {
  USE_PROFILES: { html: true },
  FORBID_TAGS,
  FORBID_ATTR,
  ALLOWED_URI_REGEXP,
};

let hooksInstalled = false;

/** 安装一次性的额外加固 hook（幂等） */
export function installSanitizeHooks(): void {
  if (hooksInstalled) return;
  hooksInstalled = true;

  DOMPurify.addHook('uponSanitizeElement', (node) => {
    const el = node as Element;
    if (el.tagName === 'INPUT') {
      // 仅允许任务列表复选框；其余任意 input 一律删除
      if (el.getAttribute('type') !== 'checkbox') {
        el.parentNode?.removeChild(el);
      }
    }
  });

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    // 任务列表复选框强制只读（markdown-it-task-lists 不输出 disabled）
    if (node.tagName === 'INPUT' && node.getAttribute('type') === 'checkbox') {
      node.setAttribute('disabled', '');
    }
    if (node.tagName === 'A' && node.hasAttribute('href')) {
      const href = node.getAttribute('href') ?? '';
      if (/^javascript:/i.test(href.trim())) {
        node.removeAttribute('href');
      }
    }
  });
}
