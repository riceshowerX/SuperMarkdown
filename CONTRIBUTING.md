# 贡献指南

感谢关注 SuperMarkdown。这份文档帮助你用最小的沟通成本提交一个能被合并的 PR。

## 开发环境

```bash
git clone https://github.com/riceshowerX/SuperMarkdown.git
cd SuperMarkdown
npm install
npm run dev        # 开发服务器 → http://localhost:5173
npm run test       # Vitest 单元测试
npm run typecheck  # TypeScript 严格检查
npm run build      # 生产构建（含 tsc -b，比 typecheck 更严格）
```

环境要求：Node.js ≥ 22.12（与 `package.json` 的 `engines` 一致）。

## 提交流程

1. Fork 仓库，从 `main` 拉出功能分支：`git checkout -b feat/your-feature`
2. 提交变更，Commit Message 遵循 Conventional Commits：`feat:` / `fix:` / `docs:` / `refactor:` / `test:` / `chore:`
3. 本地自检通过后推送并发起 Pull Request
4. CI（类型检查 / 测试 / 构建）全绿后等待 Review

## 必须遵守的架构约定

这些约定贯穿整个代码库，PR 会按此 Review：

| 约定 | 说明 |
|------|------|
| 单文件 ≤ 300 行 | 入口 `src/app/App.tsx` < 100 行，只做装配 |
| 依赖只向下 | `components → hooks → services → utils`；Service 层禁止 import React；组件不直接触碰 IndexedDB |
| 无 emoji 图标 | 图标一律 [lucide-react](https://lucide.dev) 具名导入 |
| 颜色走 Token | 禁止硬编码色值，一律引用 `src/styles/design-tokens.css` |
| 本地优先 | 新功能不得要求用户上传数据到第三方服务器 |

## 缺陷修复

修复 Bug 时请**先写一个能复现该 Bug 的测试用例**（放在 `src/__tests__/`，参考 `qa-*.test.ts` 的写法），确认它在修复前失败、修复后通过。纯函数优先，涉及异步时序的用例参考 `qa-autosave.test.ts` 的 fake timers + 可控假存储模式。

## 设计变更

影响 UI 的改动请先阅读 `docs/design/DESIGN.md` 与 `src/styles/design-tokens.css`——当前视觉真源是 DESIGN.md（v3.0「块面派」），`MASTER.md` 为已废止的历史版本。拿不准的视觉决策先开 Issue 讨论，避免大改后无法合并。

## 安全问题

**请勿通过公开 Issue 报告安全漏洞。** 上报渠道见 [SECURITY.md](SECURITY.md)。
