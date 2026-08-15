# SuperMarkdown DESIGN.md — C 版「块面派」(Notion 极简)

> 版本：v3.0 · 日期：2026-08-15 · 设计师：颜好看
> 基于：UIUX-V3-MINIMAL-3OPTIONS.md（用户选定 C 版深化）
> 三轴刻度：Variance=3 / Motion=2 / Density=3
> 技术栈：React 19 + Tailwind v4（@theme CSS 变量）+ CSS 变量 Token + lucide-react 唯一图标库
> 真源文件：`src/styles/design-tokens.css`（CSS 变量为运行时唯一真源）+ `design-tokens.json`（工具/参考）

---

## 1. 设计原则（Design Principles）

### 视觉主题关键词
冷净、块感、隐形、命令驱动、分层

### 氛围描述
界面像水——透明、无味、不可或缺。chrome 退到最弱（无独立强视觉工具栏/状态栏），bg 与 surface 差异极小，仅靠 1px 边框或微亮度差分层。每个 Markdown 元素是独立可操作的"块"，hover 显拖拽手柄。Cmd+K 命令面板是一切操作的统一入口。字距行高精修，暗色为冷中性灰。

### 对标品牌
Notion（块即单元 + Cmd+K + 字距精修）、Craft（chrome 退化）、Linear（冷色克制）

### C 版与 v1.1 的核心差异（5 条）

| # | v1.1 | C 版 v3.0 |
|---|------|-----------|
| 1 | 暖色系：Teal `#0F8F84` + 暖纸 `#F6F5F3` | 冷色系：焦点蓝 `#2563EB` + 冷白 `#FCFCFD` |
| 2 | chrome 常驻：appbar 48px + statusbar 30px + 暖边框 | chrome 退化：appbar 40px + statusbar 26px + 边框极淡 `#EEEEF0` |
| 3 | 暖纸暗色 `#161514`（暖炭） | 冷中性灰暗色 `#19191C` |
| 4 | 纯文本流编辑器 | 块感排版：每块可 hover 显拖拽手柄 ⋮⋮，块级操作 |
| 5 | Cmd+K 是辅助搜索入口 | Cmd+K 升格为核心交互入口（搜索+命令+文档跳转+主题切换） |

### 五条设计铁律
1. **chrome 退到最弱**——能用 1px 边框分层就不用阴影，能用亮度差就不用边框
2. **强调色每屏≤2处**——焦点蓝仅出现在 Cmd+K 选中行、光标、链接，不做装饰
3. **块即单元**——每个 Markdown 元素是独立块，可拖拽、可操作
4. **字距精修**——标题必须负字距（H1 -0.02em），ALL CAPS 必须 +0.06em
5. **冷色一以贯之**——明暗均为冷色系，绝不混入暖色（除语义色 success/warn/danger）

---

## 2. 色彩（Color Palette & Roles）

### 配色来源
`references/design-systems/color-palettes.md` 第 22 套「知识库/文档中性」基础上冷化调整。

### A1-identity（明色）

| Token | 值 | 用途 |
|-------|-----|------|
| `--bg` | `#FCFCFD` | chrome 底（冷近白，与 surface 差异极小=chrome 退化） |
| `--surface` | `#FFFFFF` | 画布（纯白） |
| `--surface-sunken` | `#F4F4F5` | 内嵌块底/选中行/代码块/骨架 |
| `--surface-raised` | `#FFFFFF` | 浮起面/分段激活（靠 ring 分层） |
| `--fg` | `#1F2024` | 主文本（冷墨，非纯黑） |
| `--muted` | `#6B7280` | 次级文本（≥4.5:1 AA） |
| `--accent` | `#2563EB` | 焦点蓝（每屏≤2处） |
| `--border` | `#EEEEF0` | 默认边框（极淡冷灰） |

### A1-identity（暗色）

| Token | 值 | 用途 |
|-------|-----|------|
| `--bg` | `#19191C` | chrome 底（冷灰） |
| `--surface` | `#212125` | 画布 |
| `--surface-sunken` | `#1D1D20` | 内嵌块底 |
| `--surface-raised` | `#2A2A2E` | 浮起面 |
| `--fg` | `#E6E6E9` | 主文本（off-white 冷调） |
| `--muted` | `#8A8A92` | 次级文本 |
| `--accent` | `#3B82F6` | 焦点蓝提亮 |
| `--border` | `#2E2E32` | 默认边框 |

### A2-semantic

| Token | 明 | 暗 |
|-------|-----|-----|
| `--success` | `#16A34A` | `#4ADE80` |
| `--warn` | `#D97706` | `#FBBF24` |
| `--danger` | `#DC2626` | `#F87171` |
| `--info` | `#2563EB` | `#60A5FA` |

### B-slot 别名

| Token | 明 | 暗 | 说明 |
|-------|-----|-----|------|
| `--fg-2` | `#9CA3AF` | `#6B6B73` | 三级文本（≥14px 或装饰，小字勿用） |
| `--surface-warm` | `#F7F7F9` | `#252528` | hover 底/引用块底（名兼容，值改冷） |
| `--border-soft` | `#F4F4F5` | `#252528` | 行分隔 |
| `--accent-hover` | `#1D4ED8` | `#60A5FA` | |
| `--accent-active` | `#1E40AF` | `#93C5FD` | |
| `--accent-soft` | `rgba(37,99,235,.08)` | `rgba(59,130,246,.12)` | 选中态弱背景 |
| `--accent-line` | `rgba(37,99,235,.04)` | `rgba(59,130,246,.06)` | 光标行高亮 |
| `--on-accent` | `#FFFFFF` | `#FFFFFF` | accent 上的前景 |
| `--focus-ring` | `rgba(37,99,235,.30)` | `rgba(59,130,246,.38)` | 焦点环 |

### C-extension · 块面派专属（v3.0 新增）

| Token | 明 | 暗 | 说明 |
|-------|-----|-----|------|
| `--block-handle` | `#C5C7CC` | `#4A4A52` | 拖拽手柄 ⋮⋮ 默认色 |
| `--block-handle-active` | `#9CA3AF` | `#6B6B73` | 手柄 hover 提亮 |
| `--block-hover-bg` | `#F9FAFB` | `#252528` | 块 hover 底色 |

### 强调色使用规则
- **每屏≤2处可见 `--accent`**：Cmd+K 面板选中行 + 光标/链接
- 标题用 `--fg`（冷墨），不用 `--accent`
- 选中态用 `--accent-soft`（极淡蓝底），不用实色 `--accent`
- 任务勾选用 `--md-task-checked`（= `--accent`）

### 配色配比
- 中性色 90%（bg/surface/fg/muted/border 主导）
- 强调色 5%（accent 及派生，极克制）
- 语义色 <5%（success/warn/danger，仅状态反馈）

---

## 3. 排版（Typography）

### 字体栈
```css
--font-ui:   'Inter', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-body: 'Inter', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'SFMono-Regular', 'Cascadia Code', Consolas, monospace;
```
- Google Fonts @import：`https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap`
- 中文 fallback：`Noto Sans SC`（子集化加载，避免 1MB+ 全量）
- 等宽仅用于代码块/快捷键徽章/字数统计，正文禁用

### 字号阶梯（8 级 + 编辑/阅读专用）

| 用途 | Token | 值 | 行高 |
|------|-------|-----|------|
| 标签/徽章 | `--text-xs` | 12px | `--leading-xs` 1.5 |
| 辅助文字 | `--text-sm` | 13px | 1.5 |
| UI 正文 | `--text-base` | 14px | `--leading-body` 1.6 |
| 预览正文 | `--text-reading` | 16px | `--leading-reading` 1.75 |
| 编辑器正文 | `--text-editor` | 15px | `--leading-editor` 1.7 |
| 三级标题 | `--text-lg` | 16px | 1.5 |
| 二级标题 | `--text-xl` | 18px | 1.4 |
| 一级标题 | `--text-2xl` | 22px | `--leading-title` 1.3 |
| 大标题 | `--text-3xl` | 28px | 1.3 |
| 展示标题 | `--text-4xl` | 36px | 1.2 |

### 字距精修（C 版签名，对标 Notion 设计系统）

| 场景 | Token | 值 |
|------|-------|-----|
| 正文（14-16px） | `--tracking-body` | `0` |
| 小字/ALL CAPS | `--tracking-caps` | `0.06em` |
| 次标题 | `--tracking-title` | `-0.01em` |
| H1（≥28px） | `--tracking-h1` | `-0.02em` |
| H2 | `--tracking-h2` | `-0.015em` |
| H3 | `--tracking-h3` | `-0.01em` |

> 工具类：`.trk-h1` / `.trk-h2` / `.trk-h3` / `.trk-title` / `.trk-caps`（已加入 index.css）

### 字重三级 + 块标题
- Regular `400` — 正文、说明
- Medium `510` — 次标题、按钮、表头
- Semibold `590` — 主标题
- Bold `700`（C 版新增 `--weight-bold`） — 块标题（块感更强，对标 Notion H1=700）

---

## 4. 布局（Layout & Spacing）

### 间距系统（4px 网格）
`--space-1`(4) / `--space-2`(8) / `--space-3`(12) / `--space-4`(16) / `--space-5`(20) / `--space-6`(24) / `--space-8`(32) / `--space-10`(40) / `--space-12`(48)

### 圆角阶梯
| Token | 值 | 用途 |
|-------|-----|------|
| `--radius-sm` | 6px | 按钮、输入框、徽章 |
| `--radius-md` | 8px | 卡片、下拉 |
| `--radius-lg` | 12px | 弹窗、Cmd+K 面板 |
| `--radius-full` | 9999px | 胶囊、圆点 |

> C 版圆角比 v1.1 略收（lg 14→12），块面感更利落。卡片上限 12px，禁止 ≥24px 过度圆角。

### 容器与栅格
- 编辑内容列：`--layout-editor-max: 760px`（居中）
- 预览内容列：`--layout-preview-max: 720px`
- 侧边栏：`--layout-sidebar-w: 232px`（纯文本行，非卡片，更紧凑）
- 侧边栏收起：`--layout-sidebar-w-collapsed: 48px`
- 块拖拽手柄区：`--block-gutter-w: 24px`（块左侧留白，hover 显手柄）

### chrome 退化（C 版核心）
| 区域 | v1.1 | C 版 | 策略 |
|------|------|------|------|
| 顶栏 | 48px | `--layout-appbar-h: 40px` | 减薄，仅面包屑+主题+更多 |
| 状态栏 | 30px | `--layout-statusbar-h: 26px` | 减薄，或缩为右下角圆点 |
| 侧边栏边框 | `--border` 暖灰 | `--border` 极淡冷灰 `#EEEEF0` | 1px 边框分层，无阴影 |
| 分屏分隔 | Resizer 可见 | 极淡 1px 线 | 弱化拖拽手柄视觉 |

### 响应式断点
- `sm` 640px / `md` 768px / `lg` 1024px / `xl` 1280px
- <768px：侧边栏变抽屉，编辑单列，Cmd+K 适配底部 ActionSheet

---

## 5. 组件（Components）

### 按钮
| 类型 | 背景 | 文字 | 圆角 | 内边距 |
|------|------|------|------|--------|
| Primary | `var(--accent)` | `var(--on-accent)` | `--radius-sm` | 8px 16px |
| Secondary | 透明 + 1px `--border` | `var(--accent)` | `--radius-sm` | 8px 16px |
| Ghost | 透明 | `var(--fg)` | `--radius-sm` | 舒适 |
| 状态 | default / hover(`--accent-hover`) / focus(`--focus-ring`) / active / disabled(opacity .4) | | | |

### 卡片 / 块容器
- C 版**不用卡片盒子**包裹编辑内容——块本身就是内容，靠 hover 底色分层
- 块 hover：`background: var(--block-hover-bg)`，150ms 过渡
- 弹窗/面板：`--radius-lg: 12px` + `--elev-popover`（ring + 模糊阴影）

### 输入框
- 背景 `var(--surface)`，边框 `var(--border)`，圆角 `--radius-sm`
- focus：`box-shadow: 0 0 0 3px var(--focus-ring)`，边框转 `var(--accent)`
- error：边框 `var(--danger)`，helper text 近字段

### 命令面板（Cmd+K）— C 版核心组件
- 居中浮层，`width: 520px`，`--radius-lg: 12px`，`--elev-popover` 阴影
- 搜索输入区（高 44px）+ 分组结果列表（行高 36px）+ 底部快捷键提示
- 选中行：`background: var(--accent-soft)`，文字 `var(--fg)`，右侧显快捷键徽章
- 搜索光标：`var(--accent)` 闪烁
- scrim：`rgba(0,0,0,0.03)`（极淡，不抢编辑区）

### 分段控件（视图模式）
- 容器：`background: var(--surface-sunken)`，`--radius-sm`，padding 2px
- 激活项：`background: var(--surface-raised)` + `var(--accent)` 图标 + `--elev-ring`
- 非激活：`var(--fg-2)` 图标，hover → `var(--fg)`

### 状态矩阵（9 态覆盖）
| 状态 | 设计要求 |
|------|----------|
| Loading | 骨架屏 `.skeleton-line`（`--surface-sunken` + shimmer） |
| Empty | 引导文案 + CTA（"创建第一个文档"） |
| Error | `--danger` 内联条 + 重试按钮 |
| Populated | 正常展示 |
| Edge | 超长标题 truncate、零结果空态 |
| Default/Hover/Focus/Active/Disabled | 见按钮表 |

---

## 6. 图标（Icon System）

### 锁定图标库
**lucide-react**（项目已锁定，`package.json` 已安装 `^0.544.0`，唯一图标库，全项目统一不混用）

### 尺寸规范
| 场景 | 尺寸 | 用法 |
|------|------|------|
| 行内 | 16px | 状态栏图标、徽章 |
| 按钮内 | 20px | 工具栏、侧边栏操作 |
| 独立图标 | 24px | 空状态引导、大按钮 |

### 描边与颜色
- `strokeWidth={1.8}`（默认），保持统一
- 颜色继承父元素 `text-*`，不硬编码
- `aria-hidden` 装饰图标，`aria-label` 功能图标

### C 版关键图标映射
| 功能 | lucide 图标 | 尺寸 |
|------|------------|------|
| 新建文档 | `FilePlus2` | 20px |
| 搜索/命令面板 | `Search` | 16/20px |
| 主题切换 | `Sun` / `Moon` | 20px |
| 视图分屏 | `Columns2` | 16px |
| 视图编辑 | `PencilLine` | 16px |
| 视图预览 | `Eye` | 16px |
| 导出 | `Download` | 18px |
| 块拖拽手柄 | `GripVertical`（⋮⋮） | 16px |
| 侧边栏开关 | `PanelLeftClose` / `PanelLeftOpen` | 20px |
| 打字机 | `Focus` | 12px |
| 重试 | `RotateCcw` | 14px |

> **禁止 emoji 作功能图标**。所有图标来自 lucide-react，SVG 矢量可缩放。

---

## 7. 交互（Interaction）

### 动效精规（Motion=2，极静）

| 场景 | 时长 | 缓动 |
|------|------|------|
| 即时反馈（按钮按下） | 100ms | `--ease-standard` |
| 状态确认（hover/选中） | 150ms | `--ease-standard` |
| 内容进入（下拉/Toast） | 200ms | `--ease-standard` |
| 跨屏过渡（面板/抽屉） | 300ms | `--ease-emphasized` |
| Cmd+K 面板打开 | 120ms | `--ease-standard`（scale 0.98→1） |

- 禁止弹跳缓动、禁止 >1s 动画、禁止同时 >3 元素动画
- 必须 `@media (prefers-reduced-motion: reduce)` 降级（已兜底）

### C 版核心交互

**① 块感排版（拖拽手柄）**
- 鼠标进入块区域 → 块底显 `var(--block-hover-bg)` + 左侧 `--block-gutter-w` 区显 `GripVertical` 手柄
- 手柄默认 `var(--block-handle)`（淡），hover 提亮 `var(--block-handle-active)`
- 拖拽手柄 → 块重排（150ms 过渡）
- 移动端：无拖拽手柄（触摸长按替代）

**② Cmd+K 升格为核心入口**
- `Cmd+K` 打开居中浮层面板
- 搜索框：输入即筛选——命令（新建/导出/主题/视图切换）+ 文档跳转
- `↑↓` 选择，`↵` 确认，`esc` 关闭
- 选中行 `var(--accent-soft)` 底 + 右侧快捷键徽章
- 面板打开 120ms scale 入场，关闭 100ms fade 出场
- scrim 极淡 `rgba(0,0,0,0.03)`，编辑区仍可见

**③ chrome 退化**
- 顶栏 40px：仅面包屑（`工作区 / 文档名`）+ 主题图标 + 更多（⋯）
- 状态栏 26px：或缩为右下角已保存圆点（无独立栏，chrome 退到最弱）
- 侧边栏与主区同底（仅 1px `--border` 右边框分层）
- 分屏 Resizer：极淡 1px 线，hover 显拖拽指示

**④ 主题切换**
- `Cmd+K` → "切换主题" 或顶栏 `Sun`/`Moon` 图标
- 300ms `--ease-emphasized` 过渡，`body` 加 `.theme-transition` class
- 冷白 ↔ 冷中性灰

**⑤ 保存反馈**
- 保存中：状态栏 `--warn` 脉冲 `.save-pulse`（或右下角圆点）
- 已保存：`--success` 圆点，2s 后缩为小圆点常驻
- 失败：`--danger` 内联条 + 重试按钮（不打断输入）

---

## 8. 无障碍（Accessibility）

### 对比度（WCAG AA+）
- 正文 `--fg` on `--surface`：`#1F2024` on `#FFFFFF` = 16.3:1（AAA）
- 次级 `--muted` on `--bg`：`#6B7280` on `#FCFCFD` = 4.6:1（AA）
- `--fg-2` `#9CA3AF`：**仅 ≥14px 或装饰性**（2.8:1，小字不达标，禁用于正文）
- `--on-accent` `#FFFFFF` on `--accent` `#2563EB`：8.6:1（AAA）
- 暗色 `--fg` `#E6E6E9` on `--surface` `#212125`：12.1:1（AAA）

### 键盘导航
- `:focus-visible` → `box-shadow: 0 0 0 3px var(--focus-ring)`（焦点蓝环）
- Tab 顺序：侧边栏 → 编辑区 → 工具栏 → 状态栏
- `Cmd+K` 全局可达，`esc` 关闭面板/抽屉
- 块操作：`↑↓` 块间导航（可选增强）

### 屏幕阅读器
- 图标 `aria-hidden`（装饰）或 `aria-label`（功能）
- 命令面板 `role="dialog"` + `aria-label="命令面板"`
- 视图分段 `role="group"` + `aria-pressed`
- 保存状态 `role="status"` / 错误 `role="alert"`

### 触摸目标
- 最小 44×44px（WCAG 2.5.5）
- 按钮间距 ≥8px
- 移动端格式条底部固定，触摸可达

### 动效降级
- `@media (prefers-reduced-motion: reduce)` 全局降级为 0.01ms（已兜底）

---

## 9. Token 使用规范（Agent Implementation Guide）

### Token 引用铁律
1. **业务代码零硬编码颜色**——全部 `var(--*)` 或 Tailwind 语义类（`bg-bg` / `text-fg` / `border-border`）
2. **唯一例外**：`#fff` / `#000`（但 C 版用 `var(--on-accent)` / `var(--fg)` 替代）
3. **间距全 4px 整数倍**——`var(--space-*)` 或 Tailwind spacing
4. **字号用工具类**——`.tx-*`（`.tx-sm` / `.tx-base` / `.tx-editor` / `.tx-reading`）
5. **字重用工具类**——`.wt-regular` / `.wt-medium` / `.wt-semibold` / `.wt-bold`
6. **字距用工具类**——`.trk-h1` / `.trk-h2` / `.trk-h3` / `.trk-title` / `.trk-caps`

### Tailwind v4 @theme 映射（index.css）
```css
@theme {
  --color-bg / --color-surface / --color-surface-sunken / --color-surface-raised
  --color-fg / --color-fg-2 / --color-muted / --color-accent / --color-accent-hover
  --color-accent-active / --color-accent-soft / --color-on-accent
  --color-border / --color-border-soft / --color-surface-warm
  --color-success / --color-warn / --color-danger / --color-info
  /* C 版块面派专属 */
  --color-block-handle / --color-block-handle-active / --color-block-hover
}
```
→ 生成 Tailwind 工具类：`bg-bg` `bg-surface` `text-fg` `text-muted` `border-border` `bg-block-hover` `text-block-handle` 等

### 前端实施要点

**只需改 Token 值（零代码改动）的组件：**
- 所有引用 `var(--*)` 的组件——换 CSS 即生效（颜色/间距/圆角/字号全部自动更新）
- 包括：`TextareaEditor`、`PreviewPane`、`DocumentItem`、`SearchBox`、`Toasts`、`ConfirmModal`

**需结构调整的组件（C 版块面派特征）：**

| 组件 | 改动 | 说明 |
|------|------|------|
| `Toolbar.tsx` | 减薄至 40px + 弱化 | 移除强边框，仅面包屑+主题+更多；Logo 缩小 |
| `StatusBar.tsx` | 减薄至 26px 或缩为圆点 | chrome 退化；字数统计保留但更淡 |
| `Sidebar.tsx` | 纯文本行（非卡片）+ 同底 | 移除卡片阴影，文档项改为文本行 + hover 底 |
| `CommandPalette.tsx` | 升格为核心入口 | 增加命令分组 + 文档跳转 + 主题切换命令 |
| `EditorPane.tsx` | 块感排版（可选增强） | hover 显 `GripVertical` 拖拽手柄（v3.1 增强） |
| `index.css` | 新增块 Token 映射 | 已完成（block-handle / block-hover / wt-bold / trk-h*） |

**已知坑提醒：**
- `--surface-raised` 在 v1.1 未定义但 index.css 已引用 → C 版已补全（明 `#FFFFFF` / 暗 `#2A2A2E`）
- `--fg-2` `#9CA3AF` 对比度仅 2.8:1 → **仅 ≥14px 或装饰性使用**，小字用 `--muted` `#6B7280`
- Noto Sans SC 全量加载 1MB+ → 子集化或按需加载
- Tailwind v4 用 `@theme` 非 `tailwind.config.js` → 主题在 `index.css` 的 `@theme` 块定义

### 变更记录

| 日期 | 版本 | 变更 | 原因 |
|------|------|------|------|
| 2026-08-15 | v3.0 | 全量冷化：Teal→Blue、暖纸→冷白、chrome 退化、新增块 Token、补全 surface-raised | 用户选定 C 版块面派 |
| 2026-08-15 | v1.1 | 暖纸 + Teal + 画布反转 | 已废弃 |
