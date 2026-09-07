<!-- 标题格式：<类型>: <一句话概括>，类型取 feat / fix / docs / refactor / test / chore -->

## 变更说明

<!-- 做了什么，为什么这么做。涉及 UI 变化请附截图（前后对比更佳） -->

## 变更类型

- [ ] 新功能（feat）
- [ ] 缺陷修复（fix）
- [ ] 文档（docs）
- [ ] 重构（refactor，不改变行为）
- [ ] 测试（test）
- [ ] 构建/工程化（chore）

## 自查清单

- [ ] `npm run typecheck` 通过
- [ ] `npm run test` 全绿（修复 Bug 时附带了可复现该 Bug 的测试用例）
- [ ] `npm run build` 通过
- [ ] 无 emoji 图标（图标一律 lucide-react 具名导入）
- [ ] 无硬编码色值（颜色一律引用 `src/styles/design-tokens.css` 的 Token）
- [ ] 新增/修改文件遵守单文件 ≤ 300 行的架构约定
- [ ] 未引入与「本地优先、零配置」原则冲突的依赖

## 关联 Issue

<!-- 例：Closes #12 -->
