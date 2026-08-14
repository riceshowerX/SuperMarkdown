# SuperMarkdown DESIGN.md — 全局设计源（MASTER）

> 生成日期：2026-08-15 | 设计师：颜好看 | 基于：PRD v1.0 + SPEC.md + UIUX.md（Phase 2 锁定）
> 设计寄存器：Product Register（工具类应用） | 三轴刻度：Variance=4 / Motion=4 / Density=5
> 机器可读源：`../src/styles/design-tokens.json` + `design-tokens.css`（唯一真源，本文件为人类可读契约）

---

## 1. Visual Theme & Atmosphere（视觉主题与氛围）

**视觉主题关键词（4 个）**：克制（Restrained）、专注（Focused）、精准（Precise）、温暖（Warm）

**氛围描述**：以中性色为主的大面积留白，界面 chrome（工具栏/状态栏/滚动条）刻意弱化；强调色仅在选中态、焦点、保存状态等"有功能目的"处出现，每屏 ≤2 处。暗色主题采用暖灰底（非纯黑），长时间写作不刺眼。编辑区与预览区使用同一字体栈，保证"所见即所得"的视觉一致。

**对标品牌（三层）**：
- Notion — 编辑体验（克制留白、chrome 退到最弱）
- Obsidian — 暗色专注（温暖克制暗色、文件树、代码/表格/引用视觉规范）
- Linear — 交互工艺（状态反馈精准、150ms 动效收敛、焦点可见）

**设计风格**：Swiss Minimalism（主）+ Flat Design（辅）+ Micro-interactions（叠加层，10-15% 工时）
**明确排除**：Glassmorphism（性能）、Aurora UI（AI 模板味）、Neumorphism（对比度）

---

## 2. Color Palette & Roles（色彩与角色）

> 唯一真源 `design-tokens.css`。以下为契约摘要，**色值以 tokens 文件为准**（零偏差）。

**A1-identity**：`--bg` / `--surface` / `--surface-sunken` / `--fg` / `--muted` / `--accent` / `--border`
**A2-semantic**：`--success` / `--warn` / `--danger` / `--info`
**A2-structure**：`--radius-*`（sm 6/md 8/lg 12）、`--space-1..10`（4px 网格）
**B-slot**：`--fg-2` / `--surface-warm` / `--border-soft` / `--accent-hover` / `--accent-active` / `--accent-soft` / `--on-accent` / `--focus-ring`
**C-extension**：`--md-*` 系列（code/table/quote/link/hr/selection/task-checked/inline-code）

**明暗基调**：
- 明色：冷白基底（`--bg #FAFAF9`、`--surface #FFFFFF`、`--fg #1C1917`、`--accent #0D9488`）
- 暗色：暖灰基底非纯黑（`--bg #1C1917`、`--surface #26221F`、`--fg #EDEAE6`、`--accent #2DD4BF`）
- 强调色 Teal（反 AI 默认 Indigo）；文档链接独立 Blue（`--md-link`），角色不混用

**强调色规则**：每屏 ≤2 处可见 `--accent`；标题一律 `--fg` 深中性色；`--md-link` 只用于文档内链接。
**配色来源**：`color-palettes.md` 第 14 套「生产力青绿」Teal 家族 + 自研暖中性灰阶。

---

## 3. Typography（排版）

**字体栈**（Google Fonts @import）：
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+SC:wght@400;500;700&display=swap');
```
- `--font-ui` / `--font-body`：Inter + Noto Sans SC（编辑/预览同栈，WYSIWYG 一致）
- `--font-mono`：JetBrains Mono（代码块/行内代码/数字统计）

**字号阶梯（8 级）**：xs 12 / sm 13 / base 14（编辑器正文）/ lg 16（预览正文）/ xl 18 / 2xl 22 / 3xl 28 / 4xl 36
**字重三级**：Regular 400（正文）/ Medium 510（按钮、表头、小标题）/ Semibold 590（大标题、当前文档名）
**行高**：正文 1.6 / 标题 1.3 / 小字 1.5 / 代码 1.6
**字距**：正文 0 / ALL CAPS ≥0.06em / 标题 -0.01em
**排版要点**：预览正文 16px 行高 1.6，段距 8-12px，内容区 max 720px 居中；每行中文约 30-35 字。
**来源**：`typography-pairings.md` 第 5 套「Minimal Swiss」+ 第 7 套「Developer Mono」+ 中文强制叠加 Noto Sans SC。

---

## 4. Components（组件规范）

> 9 态矩阵完整版见 UIUX.md §6.1；本节为关键实现约束。

**按钮（Icon Button 32×32 / Text Button 高 36-40）**
- 状态：default / hover（`--surface-warm` 底）/ focus-visible（`0 0 0 3px var(--focus-ring)`）/ active / disabled（opacity 0.4）
- Primary（新建文档）：`--accent` 底 + `--on-accent` 字；hover `--accent-hover`；active `--accent-active`
- Ghost（工具栏/导出/主题）：透明底；hover `--surface-warm`；active `--accent-soft`

**文档列表项（高 40px）**
- default：透明 / hover：`--surface-sunken` / selected：`--accent-soft` 底 + 左侧 3px `--accent` 竖线
- 结构：图标 16px + 标题 sm 单行截断 + hover 显示「⋯」菜单

**格式工具栏（悬浮胶囊）**
- 容器：`--surface` 底 + `--elev-ring`；按钮 32×32；组间距 8px，组间 4px 分隔线 `--border-soft`

**编辑器**
- 底 `--surface-sunken`（与预览区 `--bg` 区分）；正文 `--text-base`；光标行 Focus Mode 弱高亮 `--accent-soft`
- 选区 `::selection` 用 `--md-selection`；滚动条弱化（透明 → hover 显示）

**预览区**
- 底 `--bg`；内容 max 720px 居中；Markdown 元素用 `--md-*` 系列（见 §9 前端提示）
- 引用块：`--md-quote-border` 3px 左竖线 + `--surface-warm` 底 + `--md-quote-fg` 字
- 表格：表头 `--md-table-header-bg`、分隔线 `--md-table-border`、表头字重 medium
- 代码块：`--md-code-bg` 底 + `--md-code-border` 1px 边框 + `--radius-md` + `--font-mono` 13px

**状态栏（高 28px）**
- 字号 xs、色 `--muted`、`--border-soft` 顶部分隔线；保存状态指示器用语义色

**确认对话框 / Toast**
- 对话框：`--surface` + `--elev-raised` + `--radius-lg` + `--z-modal`；危险主按钮 `--danger`
- Toast：`--surface` + `--elev-raised` + `--radius-md` + `--z-toast`；右下角；三态语义色图标；失败常驻 + 重试

**图标**：lucide-react 统一 SVG，`stroke="currentColor"`；尺寸 16（行内）/20（按钮内）/24（独立）全项目一致；**禁用 emoji 图标**。

---

## 5. Layout & Spacing（布局与间距）

**间距基准**：4px 网格（`--space-1` 4 / `-2` 8 / `-3` 12 / `-4` 16 / `-5` 20 / `-6` 24 / `-8` 32 / `-10` 40）
**圆角阶梯**：sm 6 / md 8 / lg 12（卡片、对话框 ≤12px，禁止 ≥24px 过度圆角）
**布局常量**：AppBar 44 / StatusBar 28 / Sidebar 240（xl 260，折叠 48）/ 内容区 max 720 / 分屏最小窗 320
**断点**：xs <640 / sm 640-1023 / md 768-1023 / lg ≥1024 / xl ≥1280
**z-index**：base 0 / dropdown 1000 / sticky 1100 / modal 1200 / toast 1300
**桌面三栏**：Sidebar + 编辑 50% + 预览 50%（可拖拽分隔条，最小 320px）；移动单栏 Tab 切换。
**网格**：非营销页，无 12 列网格需求；以 flex/grid 布局三栏为主。

---

## 6. Depth & Elevation（深度与阴影）

- **明色**：`--elev-flat` none / `--elev-ring` 0 0 0 1px var(--border) / `--elev-raised` 0 1px 2px rgba(0,0,0,.04), 0 4px 8px rgba(0,0,0,.05)
- **暗色**：`--elev-flat` none / `--elev-ring` 0 0 0 1px var(--border) / `--elev-raised` 0 0 0 1px var(--border), 0 8px 24px rgba(0,0,0,.35)
- 暗色以**亮度递进**表达层级（bg → surface → surface-sunken），阴影退位
- 禁止装饰性毛玻璃（backdrop-filter 仅限有功能目的场景）

---

## 7. Do's & Don'ts（设计守则）

**应该做**：
1. 所有颜色/尺寸引用 Token（`var(--*)`），唯一例外 `#fff`/`#000` 受控使用
2. 每屏强调色 ≤2 处；标题用 `--fg` 深中性色
3. 编辑区与预览区同字体栈；内容 max 720px 保证阅读舒适
4. 状态反馈（保存中/已保存/失败）在状态栏弱化呈现
5. 键盘可达：focus-visible 焦点环、快捷键、Tab 顺序
6. 空状态给引导（「创建第一个文档」+ 主操作按钮）
7. 移动端触摸目标 ≥44×44px
8. 图标统一 lucide-react，16/20/24px，`currentColor`

**禁止做**：
1. 禁止 emoji 作为功能图标（P0）
2. 禁止紫色→粉色渐变及 Indigo→Pink 组合（P0）
3. 禁止空洞占位文案（"Welcome to"/"Lorem ipsum"）（P0）
4. 禁止业务代码硬编码颜色值（P0，唯一例外 #fff/#000）
5. 禁止渐变文字（background-clip:text）与侧条纹边框
6. 禁止过度圆角（卡片 ≥24px）
7. 禁止装饰性动效；所有动效 ≤200ms 且支持 prefers-reduced-motion
8. 禁止 3+ 高饱和色同屏、纯黑纯白直出（#000/#fff 受控除外）
9. 禁止相同卡片网格无限重复（文档列表用分隔线而非卡片堆叠）
10. 行业反模式：编辑器类产品禁 Hero 模板、禁大数字指标装饰

---

## 8. Responsive & Accessibility（响应式与无障碍）

**响应式策略**：mobile-first
| 断点 | 布局 | 侧边栏 | 编辑/预览 |
|---|---|---|---|
| xs <640 | 单栏 | 抽屉 | Tab 切换 |
| sm 640-1023 | 单栏/窄分屏 | 抽屉（可常驻） | Tab 切换（可并排） |
| md 768-1023 | 双栏 | 可折叠 | 并排 40/60 |
| lg ≥1024 | 三栏 | 常驻 240 | 并排 50/50 可拖拽 |
| xl ≥1280 | 三栏 | 常驻 260 | 并排 50/50 可拖拽 |

**无障碍**：
- 对比度：正文 `--muted` ≥4.5:1；暗色 `--on-accent #042F2E` on `#2DD4BF` ≈ 8.9:1 达标
- 键盘：全组件 focus-visible 焦点环（3px `--focus-ring`）、可 Tab 顺序、Enter/Space 触发
- 触摸：最小 44×44px
- 动效：`prefers-reduced-motion` 全局降级（tokens.css 已内置）
- 语义：icon 按钮必有 aria-label；颜色不单独传达状态（配图标/文字）
- 5 态覆盖：Loading（骨架/spinner）/ Empty（引导）/ Error（重试）/ Populated / Edge（截断、长文档虚拟化）

---

## 9. Agent Implementation Guide（实现指南）

**引用方式**：
- CSS：`@import '../styles/design-tokens.css';` 或构建链注入
- JS/TS：`import tokens from '../styles/design-tokens.json'`（tokens.color.light.accent.$value 等）

**主题切换实现**（前端）：
```ts
// 初始：document.documentElement.dataset.theme =
//   localStorage.getItem('sm-theme') ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
// 切换：set dataset.theme + localStorage.setItem('sm-theme', theme)
// 同步：<meta name="color-scheme" content={theme}>
// 过渡：color/background 150ms var(--ease-standard)
```

**Markdown 渲染样式（预览区必须用 `--md-*`，禁裸色）**：
| 元素 | 样式 |
|---|---|
| 代码块 | `bg: var(--md-code-bg); border: 1px solid var(--md-code-border); radius: var(--radius-md); font: var(--font-mono) var(--text-sm); leading: var(--leading-code)` |
| 行内代码 | `bg: var(--md-code-bg); color: var(--md-inline-code-fg); radius: var(--radius-sm); padding: 0 var(--space-1)` |
| 表格 | `th: bg var(--md-table-header-bg), weight medium; border-bottom: 1px solid var(--md-table-border)` |
| 引用 | `border-left: 3px solid var(--md-quote-border); bg: var(--surface-warm); color: var(--md-quote-fg); padding: var(--space-3) var(--space-4); radius: var(--radius-md)` |
| 链接 | `color: var(--md-link); hover: var(--md-link-hover); visited: var(--md-link-visited); underline` |
| 任务勾选 | `color: var(--md-task-checked)` |
| 分隔线 | `border-color: var(--md-hr)` |
| 选区 | `::selection { background: var(--md-selection) }` |

**编辑区内核提示**：textarea + 语法高亮（推荐 CodeMirror 6 或 Monaco）时，外部容器用 `--surface-sunken`；contenteditable 方案需自行处理选区与 `--md-selection`。
**图标**：`npm i lucide-react`；封装 `<Icon>` 统一 strokeWidth={1.8}、size 16/20/24。
**已知坑**：
- 勿在业务代码复制 tokens.css 里的色值（改主题会不同步）
- 深色下 `--elev-raised` 已含 1px 边框环，勿重复加 border
- 长文档（>1000 行）列表需虚拟化，避免整页 DOM
- 移动端禁 backdrop-filter 大面积模糊（性能）

---

## 变更记录

| 日期 | 变更 | 原因 | 影响范围 |
|---|---|---|---|
| 2026-08-15 | v1.0 创建（Phase 2 锁定） | UIUX.md 方向落地为机器可读 Token | 全局 |
