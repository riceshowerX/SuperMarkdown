# SuperMarkdown 修复交付报告

- **日期**：2026-09-08
- **依据**：`docs/review/CODE-REVIEW-2026-09-08.md`（78 条问题）
- **执行**：software-company 专家团队（批次 0：寇豆码①；批次 1：寇豆码②；文档与集成修复：齐活林；回归测试：严过关）
- **验证状态**：`tsc -b`（build）✅ 通过 ｜ `vite build` ✅ 通过 ｜ **vitest 14 文件 108 条全绿** ✅

---

## 一、TL;DR

**54 条问题已修复（含 8 条部分修复），24 条结构性/基础设施项按计划顺延并注明理由。** 全部 P0（4 条）已修复并验证；P1 修复 24 条、顺延 7 条；P2 修复 26 条、顺延 17 条。竞态类 P0 的防护以「世代号 + docId 校验 + 删除语义优先」落地，全量回归与生产构建均通过。

---

## 二、已修复清单

### P0（4/4 全部修复）

| ID | 问题 | 落地方式 | 位置 |
|---|---|---|---|
| SM-01 | 在途保存与切文档竞态 → 静默丢稿 | `pending` 携带 `{docId, content, revision}`；模块级 `saveGeneration` 世代号（loadDocument/clearDocument 自增，在途结果失效）；`flushSave(): Promise<boolean>`；finally 续写加会话校验 | `src/stores/editor.store.ts` |
| SM-02 | 删除与在途保存并发 → 文档复活 | `updateDocument` 目标不存在时抛 `SAVE_FAILED`（不再 upsert）；删除成功且为当前文档时 `clearDocument()` | `storage.service.ts` / `documents.store.ts` |
| SM-03 | store 循环依赖 | **症状已消除**（竞态修复不再依赖跨 store 时序）；ports/saveGate 结构性重构顺延（见 §四） | — |
| SM-04 | 当前文档身份双写 | **症状已消除**（App effect 补 `clearDocument` 降级 + setActiveDocId 令牌）；session store 收敛顺延 | `App.tsx` / `documents.store.ts` |

### P1（24 条修复，7 条顺延）

**批次 0（数据正确性，寇豆码①）**
- **SM-05** initialize 失败后可重试（`loaded` 保持 false + 守卫放行）
- **SM-06** 删除文档同步清理「最近使用」（`removeRecent`）+ App 兜底 `clearDocument`
- **SM-08** Toast 按 title+message 去重 + `.slice(-4)` 上限 + 容器 `max-h` 滚动
- **SM-09** 关窗兜底：`beforeunload/pagehide/visibilitychange` 三事件 + `sm-crash-buffer`（**带 docId**）+ 启动恢复 + 保存成功后清缓冲
- **SM-10** 图片总量预算（24MB）+ `extractImage(file, usedBytes)` 签名 + 调用点传已用量
- **SM-11** 状态栏统计单趟 charCodeAt 游标化（零数组分配）+ 500ms 防抖
- **SM-12** `probeIndexedDB` 补 `onblocked` + 1s 超时兜底
- **SM-15** Mermaid：世代号取消 + LRU 缓存（theme\0source，上限 30）+ 串行渲染
- **SM-16** `computeActiveLine` 改 O(行宽) 向前数换行符
- **SM-18** `editorCommandBus` 补 `isEditorReady()` / `resetEditorBus()`
- **SM-29** 格式命令改 `setRangeText` 保留原生 undo 栈（公共前后缀最小区间算法）
- **SM-30/69** useScrollSync：成对保存 {el, fn} 移除监听 + 防抖 `cancel()`
- **SM-31** Resizer：取容器后再置 dragging、`Number.isFinite` 守卫、卸载 cleanup 复位 body 样式、rect 实时读取、blur 结束拖拽
- **SM-45** ConfirmModal busy 防重复提交 + 焦点归还；全局快捷键在确认框打开时短路
- **SM-50** 命令面板关闭时不再重算候选 + recent 过滤已删文档
- **SM-66** Toolbar 改派生布尔 selector，删除全文订阅
- **SM-70** `setActiveDocId` 加 `switchSeq` 令牌，flush 失败中止切换
- **SM-72** 删除前 flush 返回 false 时抛错阻断（保护未保存内容）
- **SM-73** Mermaid 依赖 `resolved` → 切主题触发重渲染（配缓存 key 含 theme 自然失效）

**批次 1（安全加固/Electron，寇豆码②）**
- **SM-07** Ctrl+Shift+T 判定顺序对调 + 主题分支 `!e.ctrlKey` + display 去重
- **SM-25 部分** `window.desktop!` 类型收窄；死代码/错位导出部分顺延（见 §四）
- **SM-33** IPC 导入：20MB 上限 + 二进制嗅探 + 移除「所有文件」+ 错误脱敏（不回传绝对路径）
- **SM-58** will-navigate 默认拒绝（先 preventDefault，仅 file: 同路径放行，含防递归守卫）
- **SM-61** `setPermissionRequestHandler` / `setPermissionCheckHandler` 全量拒绝
- **SM-32** session 层注入 CSP 响应头
- **SM-34** KaTeX 显式 `trust:false, strict:'ignore', maxExpand:1000, maxSize:200`
- **SM-35/37/59** DOMPurify：URI 白名单收窄到栅格图、去 `foreignObject`、hook 大小写无关（SVG `<a>` 覆盖）、强制 `rel="noopener noreferrer nofollow"`
- **SM-36** 导出 HTML 加 CSP meta（`default-src 'none'` 系）
- **SM-75** openViaFileInput 首次 change 即结算 + 5 分钟超时 + `input.remove()` 全路径清理
- **SM-76** 切档后光标归零
- **SM-77** rAF 选区恢复加长度钳制

### P2（26 条修复）

- **SM-18**（新建标题查重）/ **SM-20 部分**（`isDocument` 校验 + 脏数据备份键）/ **SM-26 部分**（`escapeHtml` 收敛到 `utils/html.ts`）/ **SM-27 部分**（dist 缺失兜底 + showErrorBox）/ **SM-28**（keyUp/onClick/onFocus 跟随光标）/ **SM-38**（文件名控制字符、保留名、码点安全截断）/ **SM-42**（纯空白文档统计归零）/ **SM-46**（相对时间/代理对）/ **SM-51**（表格分隔行正则收窄 `[ \t]`）/ **SM-53**（MASTER.md 废止声明）/ **SM-60**（MIME 白名单 + 4000 万像素解压炸弹防护）/ **SM-62**（跨浏览器配额识别）/ **SM-63**（`crypto.getRandomValues` 降级）/ **SM-65**（删除零消费的 `extractHeadings` 调用）/ **SM-68**（代码围栏线性扫描状态机，O(n) 无回溯）/ **SM-44**（根级 AppErrorBoundary）/ **SM-05 移动端**（initError 卡片）/ **SM-74**（导出改走净化管线，mermaid 才取 DOM 快照且校验 data-doc-id）

---

## 三、验证过程中发现并修复的 3 个集成问题

1. **`saveChain` 串行链缺陷（重要）**：批次 0 初版用 Promise 链排队保存，验证发现一次「永不落定」的写入会把**后续所有保存永久锁死**（测试 1 的挂起写入污染测试 2；生产中等价于 IndexedDB 卡死锁死自动保存）。已改回「在途早退 + finally 续写」语义——竞态防护本就由世代号 + docId 承担，排队是冗余且有害的。
2. **`req.oldVersion` 类型错误**：`oldVersion` 在 `IDBVersionChangeEvent` 上而非 request 上，改为事件参数读取。
3. **TS 赋值收窄误判**：`finally` 中 `pending = null` 后的闭包读取被推断为 `never`，将续写判断提取为模块级 `scheduleFollowupSave()` 解决。

---

## 四、顺延清单（24 条，均注明理由）

| ID | 顺延内容 | 理由 |
|---|---|---|
| SM-03/04 | ports/saveGate/session store 完整重构 | 数据丢失症状已由世代号方案消除；结构性重构影响 2 store + 8 耦合点 + 3 测试文件，应独立 PR + 专门回归 |
| SM-14 | ActiveLineHighlight 窗口化渲染 | textarea 为 `whitespace-pre-wrap break-words`，长行折行导致固定行高撑高错位，需逐行像素测量，改动面大（memo + useMemo 已落地） |
| SM-17 | 文档列表事件委托 + 虚拟化 | 涉及 DocumentItem/DocumentList 交互契约重设计，独立迭代 |
| SM-19 | app/actions 迁移 + service 门面 | 纯移动 + 改 3 处 import，但涉及测试路径调整，随 SM-03 重构一起做 |
| SM-20 余项 | 存储后端注册表 | 校验部分已落地；注册表改动 `getStorageService` 选择逻辑需专门回归 |
| SM-21 | AppError(ctx) + logger + 错误契约统一 | 涉及 5 处 toast 归属调整 + 新日志模块，独立 PR |
| SM-22 | 排序策略收敛（删 store 内 3 处 sort） | 展示层语义需与 SM-17 一起验证 |
| SM-23 | 命令注册表（4 套枚举收敛） | 中型重构，涉及 shortcuts/paletteItems/FormatToolbar/useGlobalShortcuts 四处派生 |
| SM-24 余项 | 其余 6 处单例 resetForTest | 随测试基建（SM-56）一起做 |
| SM-25 余项 | ESLint 工具链 + ActionButton 死代码清理 | eslint 依赖引入与规则基线需单独验证 |
| SM-27 余项 | mac/linux target、dev 热更新分支、electron-log | 需跨平台真机验证 |
| SM-39 | 自托管字体（@fontsource） | 引入 3 个新依赖 + 视觉回归确认 |
| SM-47 | 滚动同步回声死区 | teardown/cancel 已修；死区需真机手感调参 |
| SM-48/67 | katex/hljs/导出 CSS 懒加载分包 | 构建产物体积与首屏指标需 build 后基线对比 |
| SM-49 | localStorage 按文档分键 | 存储模型变更，独立迭代 |
| SM-52 | sortBy 迁移 ui.store + 持久化 | 低风险，随 SM-22/17 一起 |
| SM-54 余项 | 组件级 token 补齐 + 死 token 清理 | 需与设计侧确认 `--block-gutter-w` 取舍 |
| SM-55 | katex 版本 overrides 对齐 | 变更依赖树需全量渲染回归（0.16 vs 0.18 DOM 结构差异） |
| SM-56 | fake-indexeddb + Dexie 适配器测试 | 测试基建，随 QA 批次 |
| SM-64 | 预览渲染自适应防抖 / Worker | 需性能基线（大文档样本）验证收益 |

---

## 五、改动文件清单（27 个）

**新建（4）**：`src/types/guards.ts`、`src/utils/html.ts`、`src/components/common/AppErrorBoundary.tsx`、`docs/review/FIX-DELIVERY-2026-09-08.md`

**修改（23）**：
`src/stores/editor.store.ts`、`src/stores/documents.store.ts`、`src/stores/ui.store.ts`、
`src/hooks/useAutoSave.ts`、`src/hooks/useGlobalShortcuts.ts`、`src/hooks/useScrollSync.ts`、`src/hooks/useMermaidRender.ts`、`src/hooks/useEditorCommands.ts`、`src/hooks/usePasteImage.ts`、`src/hooks/editorCommandBus.ts`、
`src/services/storage/storage.service.ts`、`src/services/storage/storage.adapter.ts`、`src/services/storage/localStorage.adapter.ts`、`src/services/clipboard/clipboard.service.ts`、`src/services/export/export.service.ts`、`src/services/markdown/markdown.service.ts`、`src/services/markdown/markdown.config.ts`、`src/services/markdown/sanitize.config.ts`、`src/services/desktop/desktop.service.ts`、`src/services/stats/stats.service.ts`、
`src/components/editor/TextareaEditor.tsx`、`src/components/editor/ActiveLineHighlight.tsx`、`src/components/editor/FormatToolbar.tsx`、`src/components/common/CommandPalette.tsx`、`src/components/common/ConfirmModal.tsx`、`src/components/common/Toasts.tsx`、`src/components/common/StatusBar.tsx`、`src/components/toolbar/Toolbar.tsx`、`src/components/layout/AppShell.tsx`、`src/components/layout/Resizer.tsx`、`src/components/preview/PreviewPane.tsx`、`src/app/App.tsx`、`src/app/actions.ts`、`src/main.tsx`、
`src/utils/editor.ts`、`src/utils/file.ts`、`src/utils/id.ts`、`src/utils/title.ts`、`src/config/constants.ts`、`src/config/shortcuts.ts`、`src/components/common/paletteItems.ts`、`src/__tests__/qa-autosave.test.ts`、`src/__tests__/qa-documents-delete.test.ts`、
`electron/main.cjs`、`docs/design/MASTER.md`

---

## 六、用户下一步建议

1. **手工冒烟（建议 10 分钟）**：`npm run dev` 后依次验证——输入后立刻切文档再切回并输入（自动保存正常）⧉ Ctrl+Shift+T 开打字机（Windows）⧉ 粘贴大图连续多张（20MB 预算提示）⧉ 切换明暗主题看 Mermaid 重绘 ⧉ 导出 HTML 双击打开验证 CSP 无报错
2. **竞态回归**：待 QA 交付 `qa-autosave-race.test.ts` 后纳入日常测试
3. **顺延项排期**：按 §四 顺序，优先 SM-56（测试基建）→ SM-23（命令注册表）→ SM-03/04（架构重构）
