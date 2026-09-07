# 安全策略

SuperMarkdown 是本地优先的编辑器：所有文档数据只存在于你的浏览器（IndexedDB / localStorage）或本机，没有后端服务器。安全设计是本项目的一等公民，负责任的披露对我们非常重要。

## 支持的版本

| 版本 | 支持状态 |
|------|----------|
| 1.2.x | 接收安全修复 |
| < 1.2 | 不再维护，请升级 |

## 如何报告漏洞

**请不要在公开 Issue / Discussion / PR 中描述安全漏洞。**

优先使用 GitHub 的私密上报通道：仓库页 → **Security** → **Report a vulnerability**（Private Vulnerability Reporting）。若该通道不可用，可通过仓库主页的邮箱联系维护者。

请尽量包含：

- 漏洞类型与影响的攻击面（渲染管线 / Electron 主进程 / 导入导出 / 存储降级 等）
- 可复现的输入（Markdown 片段 / 文件 / 操作步骤）
- 影响评估（能否执行脚本、能否访问本地数据）

## 响应承诺

- **48 小时内**确认收到
- **7 天内**给出初步评估（可利用性 / 严重级别 / 修复计划）
- 修复发布后在 CHANGELOG 中致谢报告者（除非你希望匿名）

## 当前安全设计（供评估参考）

| 层 | 措施 |
|----|------|
| 渲染管线 | markdown-it `html: false` → DOMPurify 白名单（URI 收窄到栅格图 data:）→ KaTeX `trust: false` → Mermaid `securityLevel: 'strict'` + SVG 二次净化 |
| CSP | 应用 `script-src 'self'`；导出的独立 HTML 附加 `default-src 'none'` 系 CSP |
| Electron | `contextIsolation` + `sandbox` + `nodeIntegration: false`；preload 仅暴露一个无参方法；导航默认拒绝（仅放行本地 file: 同路径）；外链经协议白名单走系统浏览器；权限请求全量拒绝；IPC 文件导入有 20MB 上限 + 二进制嗅探 |
| 存储降级 | IndexedDB 不可用时回退 localStorage，且有容量预检与脏数据隔离 |

## 已知边界

- 本地存储（IndexedDB / localStorage）遵循浏览器同源策略，同机同源的其他脚本理论上可读取——这是所有纯前端本地应用的共同边界，Web 形态请勿存放敏感凭据类内容
- Electron 形态在 `file://` 协议下运行，我们通过主进程导航守卫与 CSP 响应头收敛风险
