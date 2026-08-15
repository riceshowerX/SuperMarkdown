# SuperMarkdown PAGES.md — C 版「块面派」页面提示词

> 版本：v3.0 · 日期：2026-08-15 · 设计师：颜好看
> 基于：DESIGN.md（C 版全局设计源）+ design-tokens.css（运行时真源）
> 供前端 Agent 逐区域实现。每区域含：组件结构 / Token 引用 / 明暗两态 / 交互要点 / 9 态覆盖

---

## 区域索引

1. [AppShell — 整体外壳](#1-appshell)
2. [Toolbar — 顶栏（chrome 退化）](#2-toolbar)
3. [Sidebar — 侧边栏（纯文本行）](#3-sidebar)
4. [EditorPane — 编辑区（块感排版）](#4-editorpane)
5. [PreviewPane — 预览区](#5-previewpane)
6. [CommandPalette — Cmd+K 核心入口](#6-commandpalette)
7. [StatusBar — 状态栏（chrome 退化）](#7-statusbar)
8. [SplitPane — 分屏分隔](#8-splitpane)
9. [MobileShell — 移动端](#9-mobileshell)

---

## 1. AppShell

**组件文件**：`src/components/layout/AppShell.tsx`

**结构**：`flex h-dvh flex-col overflow-hidden` → `[Toolbar] [flex-1: Sidebar + Editor/Preview/Split] [StatusBar]`

**Token 引用**：
- `bg-bg text-fg font-body`（根容器）
- 桌面：Sidebar 常驻 + SplitPane；移动：MobileShell + 抽屉

**明暗两态**：
- 明：`--bg #FCFCFD`（冷近白），整体冷净
- 暗：`--bg #19191C`（冷中性灰），亮度递进分层

**C 版要点**：
- chrome 退化：Toolbar 高 `var(--layout-appbar-h)` 40px（v1.1=48），StatusBar 高 `var(--layout-statusbar-h)` 26px（v1.1=30）
- 侧边栏与主区**同底色**（`--bg`），仅靠 1px `--border` 右边框分层——不靠色差分层
- 整体无强阴影，浮层才用 `--elev-popover`

**9 态覆盖**：
- Loading：骨架屏 `.skeleton-line`（`--surface-sunken` + shimmer）
- Error：`InitError` 组件——`--danger` 标题 + `--muted` 描述 + 重试按钮（`--accent` 底）
- Empty：无文档时侧边栏引导"创建第一个文档"

---

## 2. Toolbar

**组件文件**：`src/components/toolbar/Toolbar.tsx`

**C 版改动**：chrome 退化——减薄至 40px + 弱化视觉

**结构**：
```
header[h:var(--layout-appbar-h)=40px] border-b[border-border]
  ├ [移动] Menu 图标按钮（打开抽屉）
  ├ 面包屑：工作区 / 文档名（点击重命名）
  ├ flex-1（弹性留白）
  ├ Cmd+K 触发胶囊（核心入口，见 §6）
  ├ 视图分段（桌面：分屏/编辑/预览）
  └ 主题切换图标
```

**Token 引用**：
- 容器：`bg-bg border-b border-border`（无阴影，1px 底边框极淡）
- 面包屑：`工作区` `tx-sm text-fg-2` → `/` `text-border` → `文档名` `tx-sm wt-medium text-fg`
- Cmd+K 胶囊：`bg-surface-sunken border-border rounded-md` → hover `bg-block-hover`
- 视图分段容器：`bg-surface-sunken rounded-sm p-0.5`；激活项 `bg-surface-raised text-accent shadow-[var(--elev-ring)]`
- 主题图标：`text-fg-2` → hover `text-fg`

**明暗两态**：
- 明：`--bg #FCFCFD` 底，`--border #EEEEF0` 极淡冷灰底线
- 暗：`--bg #19191C` 底，`--border #2E2E32` 冷灰底线

**交互要点**：
- 顶栏 40px 比 v1.1 薄 8px——chrome 退化的核心体现
- Logo 弱化：v1.1 有 `FileText` 图标 + "SuperMarkdown" 文字 → C 版缩为小圆点 + 文字（或仅面包屑，Logo 移入侧边栏）
- 导出菜单保留但弱化（`ChevronDown` 更小）

**9 态**：Loading（导出中禁用+spinner）/ Error（导出失败 toast）/ Populated / Disabled（无内容时导出灰）

---

## 3. Sidebar

**组件文件**：`src/components/sidebar/Sidebar.tsx` + `DocumentItem.tsx` + `SearchBox.tsx`

**C 版改动**：纯文本行（非卡片）+ 与主区同底

**结构**：
```
aside[w:var(--layout-sidebar-w)=232px] bg-bg border-r[border-border]
  ├ SearchBox（搜索框）
  ├ 新建文档按钮（Secondary/Ghost，非 Primary 大蓝按钮）
  ├ DocumentList（纯文本行列表）
  │   └ DocumentItem × N
  │       ├ hover: bg-block-hover + 左侧显 GripVertical 手柄区
  │       └ 选中: bg-accent-soft + 标题 wt-medium
  └ 底栏：N 篇文档 + 折叠按钮
```

**Token 引用**：
- 容器：`bg-bg border-r border-border`（与主区同底 `#FCFCFD`/`#19191C`）
- 搜索框：`bg-surface-sunken border-border rounded-md`
- 新建按钮：C 版改为 Ghost/Secondary（`text-accent border-border`），**不用 Primary 大蓝按钮**（chrome 退化，强调色克制）
- 文档行：默认 `text-fg-2 tx-sm`；hover `bg-block-hover text-fg`；选中 `bg-accent-soft text-fg wt-medium`
- 小文档图标（lucide `FileText` 14px）：`text-fg-2`

**明暗两态**：
- 明：行 hover `--block-hover-bg #F9FAFB`，选中 `--accent-soft` 极淡蓝
- 暗：行 hover `--block-hover-bg #252528`，选中 `rgba(59,130,246,0.12)`

**C 版要点**：
- **纯文本行，非卡片**——v1.1 无卡片但 v2 方案 B 有卡片；C 版回归极简文本行
- 行高 32px（紧凑），圆角 `--radius-sm` 6px（仅 hover/选中态显圆角底）
- 无阴影、无边框包裹每行——靠 hover 底色 + 选中底色分层
- 收起态：`w-[var(--layout-sidebar-w-collapsed)=48px]`，仅图标列

**9 态**：Loading（骨架行）/ Empty（"创建第一个文档"引导）/ Populated / Edge（超长标题 `truncate`）

---

## 4. EditorPane

**组件文件**：`src/components/editor/EditorPane.tsx` + `TextareaEditor.tsx` + `FormatToolbar.tsx`

**C 版改动**：块感排版（hover 显拖拽手柄）+ 编辑区纯白

**结构**：
```
section[flex-1] bg-surface
  ├ [桌面] FormatToolbar（浮动，hover 浮现）
  ├ SaveErrorBar（保存失败内联条，可选）
  ├ TextareaEditor（textarea，块感排版）
  └ [移动] FormatToolbar（底部固定）
```

**Token 引用**：
- 容器：`bg-surface`（`#FFFFFF` 明 / `#212125` 暗）
- textarea：`font-mono` 或 `font-body`（C 版编辑器用 Inter 正文）；`tx-editor` 15px；`leading-editor` 1.7
- 内容列居中：`max-w-[var(--layout-editor-max)=760px] mx-auto px-12`
- 光标行高亮：`.editor-active-line` → `var(--accent-line)` 极淡蓝（≤4%）
- 选区：`::selection` → `var(--md-selection)`

**明暗两态**：
- 明：`--surface #FFFFFF` 纯白画布，`--fg #1F2024` 冷墨正文
- 暗：`--surface #212125` 冷灰画布，`--fg #E6E6E9` off-white

**C 版块感排版（核心特征）**：
- 每个 Markdown 块（标题/段落/列表/代码）是独立可操作单元
- **hover 显拖拽手柄**：块左侧 `--block-gutter-w`(24px) 区显 `GripVertical`(lucide, 16px)
  - 手柄默认 `var(--block-handle)` `#C5C7CC`（淡，hover 前）
  - 块 hover 时手柄提亮 `var(--block-handle-active)` `#9CA3AF`
  - 块 hover 底 `var(--block-hover-bg)` `#F9FAFB`
- 拖拽手柄 → 块重排（150ms `--ease-standard`）
- **注意**：textarea 原生不支持块拖拽，此为 v3.1 增强方向；当前版本先做视觉块感（行 hover 底色 + 手柄占位），拖拽交互后续迭代

**FormatToolbar 浮动条**：
- 桌面：浮动在编辑区顶部，`hover` 区显（800ms 延迟隐藏）
- `bg-surface border-border rounded-full shadow-[var(--elev-raised)]`
- 图标：`GripVertical`/`Bold`/`Italic`/`Heading`/`List`/`Link`/`Code`/`Image`（lucide，16px，`text-fg-2` → hover `text-fg`）

**9 态**：Loading（骨架）/ Empty（"开始书写…"占位提示）/ Error（SaveErrorBar）/ Populated / Edge（超长行 wrap）

---

## 5. PreviewPane

**组件文件**：`src/components/preview/PreviewPane.tsx` + `PreviewErrorBoundary.tsx`

**结构**：`section[flex-1] bg-surface overflow-auto` → 内容列居中 `max-w-[var(--layout-preview-max)=720px]`

**Token 引用**（Markdown 渲染，全部 C-extension）：
- 正文：`tx-reading`(16px) `leading-reading`(1.75) `text-fg` `font-body`
- H1：`tx-3xl`(28px) `wt-bold`(700) `trk-h1`(`-0.02em`) `text-fg`
- H2：`tx-xl`(18px) `wt-semibold` `trk-h2`
- H3：`tx-lg`(16px) `wt-medium` `trk-h3`
- 代码块：`bg-surface-sunken` `font-mono` `tx-sm` `text-fg` `rounded-md` `border-border`
- 行内代码：`bg-md-code-bg` `text-md-inline-code-fg` `font-mono` `rounded-sm` `px-1`
- 引用：`border-l-2 border-md-quote-border` `bg-surface-warm` `text-md-quote-fg` `pl-4 italic`
- 链接：`text-md-link` → hover `text-md-link-hover` → visited `text-md-link-visited`
- 表格：`border-md-table-border`，表头 `bg-md-table-header-bg`
- 任务列表：勾选框 `bg-md-task-checked`（= `--accent` 焦点蓝）
- 分隔线：`border-md-hr`

**明暗两态**：全部 C-extension Token 有明暗两值，自动切换

**9 态**：Loading（骨架）/ Error（PreviewErrorBoundary 降级提示）/ Populated / Edge（超长代码块横向滚动）

---

## 6. CommandPalette

**组件文件**：`src/components/common/CommandPalette.tsx` + `PaletteRow.tsx` + `paletteItems.ts`

**C 版改动**：升格为核心交互入口（搜索 + 命令 + 文档跳转 + 主题切换）

**结构**：
```
fixed inset-0 z-modal（scrim + 居中面板）
  ├ scrim: rgba(0,0,0,0.03)（极淡，编辑区仍可见）
  └ 面板[560px] bg-surface rounded-lg shadow-[var(--elev-popover)] palette-enter
      ├ 搜索输入区[h:44px]：Search 图标 + input + 光标闪烁
      ├ 分隔线 border-border-soft
      ├ 结果列表（分组）：
      │   ├ 分组标签（"命令" / "文档"）tx-xs text-fg-2 trk-caps
      │   └ PaletteRow × N[h:36px]
      │       ├ 图标（16px text-fg-2）
      │       ├ 标签 tx-sm text-fg
      │       └ 快捷键徽章 kbd font-mono tx-xs text-fg-2 bg-surface-sunken
      └ 底部提示：↑↓ 选择 · ↵ 确认 · esc 关闭
```

**Token 引用**：
- 面板：`bg-surface` `rounded-[var(--radius-lg)=12px]` `shadow-[var(--elev-popover)]`
- scrim：`rgba(0,0,0,0.03)`（极淡，C 版不抢编辑区）
- 选中行：`bg-accent-soft`（`rgba(37,99,235,0.08)` 极淡蓝）
- 搜索光标：`var(--accent)` 闪烁（1.1s）
- 分组标签：`tx-xs` `text-fg-2` `trk-caps`（ALL CAPS + 0.06em）
- 快捷键徽章：`font-mono` `tx-xs` `bg-surface-sunken` `rounded-sm`

**明暗两态**：
- 明：面板 `#FFFFFF`，选中行极淡蓝，scrim 极淡黑
- 暗：面板 `#212125`，选中行 `rgba(59,130,246,0.12)`，scrim `rgba(0,0,0,0.5)`

**交互要点**：
- 打开：120ms `scale(0.98)→1` + fade（`.palette-enter`），缓动 `--ease-standard`
- 搜索：输入即筛选——同时搜索命令 + 文档名
- `↑↓` 导航，`↵` 执行，`esc` 关闭
- 选中行滚动入视（`scrollIntoView({ block: 'nearest' })`）
- **命令分组**（C 版新增）：命令（新建/导出/主题/视图）+ 文档（跳转）
- 关闭后焦点回触发元素

**9 态**：Loading（搜索中 spinner）/ Empty（"无匹配结果"）/ Populated / Edge（超长命令名 truncate）

---

## 7. StatusBar

**组件文件**：`src/components/common/StatusBar.tsx`

**C 版改动**：chrome 退化——减薄至 26px 或缩为右下角圆点

**结构**：
```
footer[h:var(--layout-statusbar-h)=26px] border-t[border-border-soft] bg-bg
  ├ 字数统计（font-mono tabular-nums text-muted）
  ├ [sm+] 词数 / 行数 / 阅读时长
  ├ 临时存储提示（fallbackMode 时 text-warn）
  ├ flex-1
  ├ 打字机开关（Focus 图标，accent-soft 选中态）
  └ 保存状态：圆点 text-success / 脉冲 text-warn / 错误条 text-danger
```

**Token 引用**：
- 容器：`bg-bg border-t border-border-soft`（顶边框极淡，比 `--border` 更淡）
- 文字：`tx-xs text-muted` `font-mono tabular-nums`
- 已保存圆点：`h-1.5 w-1.5 rounded-full bg-success`
- 打字机选中：`bg-accent-soft text-accent`

**明暗两态**：
- 明：`--bg #FCFCFD`，圆点 `--success #16A34A`
- 暗：`--bg #19191C`，圆点 `--success #4ADE80`

**C 版要点**：
- 高度 26px（v1.1=30），更薄
- **chrome 退化可选**：若进一步退化，可将状态栏内容移入顶栏右侧或缩为右下角小圆点（无独立栏）
- 当前保留独立薄栏（26px），保证字数统计可见

**9 态**：Loading（保存脉冲 `.save-pulse`）/ Error（`--danger` + 重试）/ Populated / Edge（0 字时空圆点）

---

## 8. SplitPane

**组件文件**：`src/components/layout/SplitPane.tsx` + `Resizer.tsx`

**结构**：`flex` → `[EditorPane flex-ratio] [Resizer] [PreviewPane flex-ratio]`

**Token 引用**：
- Resizer：`w-1 bg-transparent` → hover `bg-border`（极淡冷灰线）
- 拖拽中：`bg-accent`（焦点蓝，拖拽反馈）

**C 版要点**：
- 分隔线极淡——默认透明，hover 才显 `--border`，拖拽中显 `--accent`
- 无明显拖拽手柄视觉（chrome 退化）
- 最小 pane 宽：`var(--layout-min-pane-w)` 320px

**明暗两态**：明 hover `#EEEEF0`，暗 hover `#2E2E32`

---

## 9. MobileShell

**组件文件**：`src/components/layout/MobileShell.tsx`

**结构**：单栏 → 侧边栏抽屉（左滑出）+ 编辑/预览切换

**Token 引用**：
- 抽屉：`bg-bg shadow-[var(--elev-raised)]`，scrim `.scrim` `rgba(0,0,0,0.4)`
- 底部格式条：`bg-surface border-t border-border`

**C 版要点**：
- <768px 单栏，侧边栏抽屉化
- Cmd+K 面板适配：宽度 `90vw`，或底部 ActionSheet（可选）
- 格式条移至底部固定，触摸可达（≥44px 高）
- 触摸目标 ≥44×44px

**9 态**：Loading / Empty / Populated / Edge（小屏标题溢出 truncate）

---

## 给前端的实施优先级

### Phase 1：换 Token 即生效（零代码改动）
直接替换 `design-tokens.css` → 所有引用 `var(--*)` 的组件自动冷化：
- 颜色：Teal→Blue、暖纸→冷白
- 间距/圆角/字号：自动更新
- 补全 `--surface-raised`（修复未定义 bug）

### Phase 2：chrome 退化（调 Token + 微调组件）
- `--layout-appbar-h` 48→40
- `--layout-statusbar-h` 30→26
- `--layout-sidebar-w` 248→232
- Toolbar：移除强边框视觉，Logo 缩小
- Sidebar：文档行改纯文本（移除卡片阴影如有）

### Phase 3：C 版特征功能（需开发）
- CommandPalette 升格：增加命令分组 + 文档跳转 + 主题切换命令
- 块感排版（v3.1）：EditorPane hover 显 `GripVertical` 手柄（先视觉占位，拖拽交互后续）

### Phase 4：工具类补充（已完成）
- index.css 已新增：`--color-block-handle` / `--color-block-hover` / `.wt-bold` / `.trk-h1` `.trk-h2` `.trk-h3`
