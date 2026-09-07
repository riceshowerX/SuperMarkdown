/** HTML 转义（唯一实现：markdown.config 与 export.service 共用，SM-26） */

/**
 * 转义 HTML 特殊字符（& < > "）。
 * 使用场景均为「双引号属性 / 文本上下文」，无需转义单引号；
 * 若未来出现单引号属性上下文，请补充 &#39;。
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
