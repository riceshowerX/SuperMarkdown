# SuperMarkdown 页面设计提示词（PAGES.md）

> 面向前端 Agent 的直接实现提示。所有颜色/尺寸引用 `design-tokens.css` 的 Token，**禁止硬编码**。
> 图标一律 `lucide-react`（`stroke="currentColor"`，strokeWidth 1.8，尺寸 16/20/24px），**禁止 emoji**。
> 组件状态覆盖 9 态（default/hover/focus/active/disabled/loading/error/empty/success）。
> 明暗两态由 `:root[data-theme="light|dark"]` 自动切换，本文件仅标注需注意的差异点。

---

## 1. AppShell（应用外壳 · 三栏）

**路由**：`/`（桌面三栏）；`/` 移动端单栏（同一组件响应式切换）

**结构（flex 纵向）**：
```
<AppShell>                        /* height: 100vh; display: flex; flex-direction: column */
  ├─ <AppBar />                    /* height: var(--layout-appbar-h); flex-shrink: 0 */
  ├─ <MainArea />                  /* flex: 1; display: flex; min-height: 0 */
  │   ├─ <Sidebar />               /* 桌面: width var(--layout-sidebar-w); 移动: 抽屉 */
  │   ├─ <EditorPane />            /* flex: 1; min-width: var(--layout-min-pane-w) */
  │   ├─ <Divider />               /* 拖拽分隔条 width 4px; hover: var(--accent) */
  │   └─ <PreviewPane />           /* flex: 1; min-width: var(--layout-min-pane-w) */
  └─ <StatusBar />                 /* height: var(--layout-statusbar-h); flex-shrink: 0 */
```

**Token**：背景 `--bg`；边框 `--border`；分隔条 hover `--accent`
**明暗差异**：无（自动切换）
**交互**：
- 桌面 ≥768px 默认分屏（编辑+预览并排）；可拖拽分隔条（最小 320px/侧）
- 模式切换（Columns2/Pencil/Eye 图标按钮）在 AppBar：分屏 ↔ 仅编辑 ↔ 仅预览
- 移动 <768px 强制单栏：AppBar 左「菜单」开抽屉；编辑/预览顶部 Tab 切换
- 滚动同步：分屏下编辑滚动 → 预览按段落锚点对齐滚动（150ms 防抖），失败静默降级
- 空状态：无打开文档时，主区显示「创建你的第一个文档」+ Primary 按钮（`FilePlus2`）

---

## 2. AppBar（顶栏 · 高 44px）

**结构**：
```
<AppBar>                          /* height: var(--layout-appbar-h); bg: var(--bg); border-bottom: 1px solid var(--border);
                                     display: flex; align-items: center; gap: var(--space-2); padding: 0 var(--space-3) */
  ├─ [Logo] 16px                  /* 图标 + 「SuperMarkdown」--fg semibold */
  ├─ [文档标题]                    /* 可点击进入重命名态（input 行内替换，Enter 确认/Esc 取消） */
  ├─ <Spacer />                   /* flex: 1 */
  ├─ [搜索 Search]                /* 移动端隐藏，仅 Sidebar 搜索 */
  ├─ [导出 Download]              /* 无内容 disabled */
  ├─ [模式 Columns2]              /* 分屏/单栏循环 */
  └─ [主题 Sun/Moon]              /* 明暗切换 */
```

**Token**：`--bg` / `--border` / `--fg` / `--muted`；图标按钮 hover `--surface-warm`，focus `--focus-ring`
**按钮规范**：icon 20px；点击区 ≥36×36（桌面），移动 ≥44×44；hover 150ms
**明暗差异**：`Sun` 图标在明色显示（点击转暗），`Moon` 在暗色显示（点击转明）——图标表示"将切换到的模式"或"当前模式"二选一，保持一致即可（建议表示当前模式）
**交互**：
- 主题切换：`document.documentElement.dataset.theme` 切换 + `localStorage('sm-theme')` 持久化 + `<meta name="color-scheme">` 同步 + 150ms 背景/文字过渡
- 重命名：点击标题 → input（value=当前名，全选）→ Enter 提交 / Esc 还原 / 失焦提交；提交后 Toast「已重命名」

---

## 3. Sidebar（侧边栏 · 宽 240/260px，可折叠 48px）

**结构**：
```
<Sidebar>                         /* width: var(--layout-sidebar-w); bg: var(--surface); border-right: 1px solid var(--border);
                                     display: flex; flex-direction: column; overflow: hidden */
  ├─ [Search 输入框]              /* h 36px; 圆角 var(--radius-md); 聚焦 focus-ring; 实时过滤列表 */
  ├─ [新建文档 Primary 按钮]       /* FilePlus2 20px + 「新建文档」; bg var(--accent)/--on-accent */
  ├─ <DocList />                  /* flex: 1; overflow-y: auto */
  │   └─ <DocItem />              /* 高 40px; 结构: FileText 16px + 标题 sm + 修改时间 xs muted;
  │                                     hover: 显示 MoreHorizontal「⋯」菜单（重命名/导出/删除） */
  ├─ <Spacer />
  └─ [底部: 回收站 / 设置]        /* 可选；当前 MVP 可只留「回收站」占位或省略 */
```

**Token**：`--surface` / `--border` / `--fg` / `--muted` / `--fg-2` / `--surface-sunken` / `--accent-soft` / `--accent` / `--radius-md` / `--focus-ring`
**DocItem 三态**：
- default：透明底，`--fg` 标题 + `--muted` 时间
- hover：`--surface-sunken` 底
- selected：`--accent-soft` 底 + `box-shadow: inset 3px 0 0 var(--accent)`（左竖线）+ 标题 `--weight-medium`
**明暗差异**：无（自动）
**交互**：
- 新建：创建「未命名文档」→ 进入编辑态 → 标题自动聚焦；Toast「已创建」
- 打开：点击加载内容；当前项 accent 高亮
- 删除：确认对话框（`--danger` 主按钮「删除」+ 次级「取消」）→ 删除后跳转相邻文档 → Toast「已删除 · 撤销」5s 可恢复
- 搜索：输入实时过滤，命中片段高亮 `--accent-soft`
- 空状态：无文档时显示「创建第一个文档」引导文案 + Primary 按钮
- 折叠：桌面可折叠为 48px（仅图标列）；移动端收为抽屉（`PanelLeftClose`/`PanelLeft`）

---

## 4. 编辑器区（EditorPane）

**结构**：
```
<EditorPane>                      /* flex: 1; min-width: var(--layout-min-pane-w); bg: var(--surface-sunken);
                                     display: flex; flex-direction: column; position: relative */
  ├─ <FormatToolbar />            /* 悬浮胶囊: position absolute/sticky top 8px; bg var(--surface); box-shadow var(--elev-ring);
                                     圆角 var(--radius-lg); 按钮 32×32; 滚动时淡出 opacity .4 → hover 1 */
  └─ <Editor />                   /* flex: 1; overflow-y: auto; padding: var(--space-8) var(--space-6);
                                     font: var(--font-body) var(--text-base)/var(--leading-body); color: var(--fg);
                                     ::selection { background: var(--md-selection) } */
```

**Token**：`--surface-sunken` / `--surface` / `--elev-ring` / `--fg` / `--muted` / `--md-selection` / `--accent-soft`（光标行）
**工具栏按钮**（lucide-react，16px）：
- 标题：`Heading1` `Heading2` `Heading3`
- 行内：`Bold` `Italic`
- 块级：`Quote` `Code2`（代码块）`Code`（行内）`Table` `List` `ListOrdered` `ListChecks` `ImagePlus` `Link` `Minus`（分隔线）
- 分组：组间距 8px，组间 4px `--border-soft` 竖分隔
**明暗差异**：无（自动）；暗色下编辑器 `--surface-sunken #171412` 与预览 `--bg #1C1917` 层次分明
**交互**：
- 输入实时触发预览渲染（防抖 150ms）
- 光标行高亮（Focus Mode）：当前行 `background: var(--accent-soft)` 弱高亮（可开关）
- 图片粘贴：Clipboard API 检测 image → <2MB 转 base64 内嵌 / >2MB Toast 提示转存 → 光标处插入 `![](描述)` → Toast「图片已插入」
- 格式按钮插入 Markdown 语法包裹选中区；全部操作配快捷键（Ctrl/Cmd+B 等，`?` 唤起快捷键面板）
- 自动保存：输入停 800ms 防抖 → 写盘
- 空文档：显示轻量引导「用 Markdown 开始写作」+ 语法速览（不打断输入）
- Edge：>1000 行虚拟化；超长行软换行不横向滚动

---

## 5. 预览区（PreviewPane）

**结构**：
```
<PreviewPane>                     /* flex: 1; min-width: var(--layout-min-pane-w); bg: var(--bg);
                                     overflow-y: auto; display: flex; justify-content: center */
  └─ <Article />                  /* width: 100%; max-width: var(--layout-content-max); padding: var(--space-8) var(--space-6);
                                     font: var(--font-body) var(--text-lg)/var(--leading-body); color: var(--fg) */
```

**Markdown 元素样式**（全部用 `--md-*`，见 MASTER.md §9 表）：
- 标题：`--text-3xl/2xl/xl` + `--weight-semibold` + `--tracking-title` + `--leading-title`；段前距 `--space-6`，段后 `--space-3`
- 段落：段距 `--space-2`~`--space-3`
- 代码块：`--md-code-bg` + 1px `--md-code-border` + `--radius-md` + `--font-mono` 13px + `--leading-code`；顶部语言标签 xs `--muted`
- 行内代码：`--md-code-bg` + `--md-inline-code-fg` + `--radius-sm` + padding 0 `--space-1`
- 表格：表头 `--md-table-header-bg` + `--weight-medium`；行分隔 `--md-table-border`；单元格 padding `--space-2`
- 引用：`border-left: 3px solid var(--md-quote-border)` + `--surface-warm` 底 + `--md-quote-fg` + `--radius-md` + padding `--space-3` `--space-4`
- 链接：`--md-link` + underline；hover `--md-link-hover`；visited `--md-link-visited`
- 任务列表：checkbox 勾选 `--md-task-checked`；`ListChecks` 语义
- 分隔线：`border-top: 1px solid var(--md-hr)`
**明暗差异**：无（自动）；暗色代码块 `--md-code-bg #171412` 与预览底 `#1C1917` 靠 1px 边框区分
**交互**：
- 实时渲染（150ms 防抖）；滚动同步锚点对齐编辑区
- 图片懒加载 + 点击放大（lightbox）
- 长文：可选阅读进度条（顶部 2px `--accent`）

---

## 6. 状态栏（StatusBar · 高 28px）

**结构**：
```
<StatusBar>                       /* height: var(--layout-statusbar-h); bg: var(--bg); border-top: 1px solid var(--border-soft);
                                     display: flex; align-items: center; gap: var(--space-4); padding: 0 var(--space-3);
                                     font-size: var(--text-xs); color: var(--muted) */
  ├─ [字数统计]                   /* 「1,234 字」--font-mono 数字 */
  ├─ [行/列]                      /* 「L12 C34」（可选） */
  ├─ <Spacer />
  └─ [保存状态]                   /* 三态指示器，见下 */
```

**保存状态三态**（自动保存反馈核心）：
| 状态 | 触发 | 视觉 |
|---|---|---|
| 保存中 | 输入停 800ms 后、写入中 | `CloudUpload` 12px + `--warn`「保存中」 |
| 已保存 | 写入完成 | `CheckCircle2` 12px + `--success`「已保存」（2s 后淡为仅图标） |
| 保存失败 | 写入失败 | `AlertCircle` 12px + `--danger`「保存失败」常驻 + Toast「重试」按钮 |

**明暗差异**：无（自动）
**交互**：
- 失败态不打断输入：内容保留内存，下次输入重新触发保存
- 字数统计含中英文混合计数（中文按字、英文按词计为 1）
- 移动端：状态栏信息并入 AppBar 右侧（空间有限），仅保留保存状态 + 字数

---

## 7. 移动端单栏（<768px 覆盖）

**结构**：
```
<MobileShell>                     /* height: 100dvh; flex column */
  ├─ <AppBar>                     /* 高 44px: [菜单] [文档标题]  [主题] */
  ├─ <ModeTabs>                   /* 高 44px: [编辑 Pencil] [预览 Eye] — 选中项 --accent 下划线 2px */
  ├─ <Pane>                       /* flex: 1: 编辑 或 预览（全宽单栏） */
  ├─ <FormatBar>                  /* 仅编辑模式显示: 底部条 h 52px; bg var(--surface); border-top var(--border);
                                     按钮 44×44: Bold Italic Heading1 Heading2 Quote Code2 (+ 溢出「+」菜单) */
  └─ <SafeArea>                   /* padding-bottom: env(safe-area-inset-bottom) */
```

**Token**：`--bg` / `--surface` / `--border` / `--accent` / `--surface-sunken`
**明暗差异**：无（自动）
**交互**：
- 侧边栏：AppBar 左「菜单」→ 抽屉（左侧滑入，宽 85vw 上限 320px，遮罩 `rgba(0,0,0,.4)`，点遮罩/Esc 关闭）
- 编辑/预览：顶部 Tab 切换；滚动位置各自保持
- 格式工具栏：底部条拇指可达（44×44 点击区）；滚动编辑时自动隐藏、触碰编辑区唤回
- 图片粘贴：移动端同样支持（Clipboard API）
- 触摸：所有交互 ≥44×44；禁 hover-only 交互
- 删除/导出等低频操作收进文档「⋯」菜单

---

## 8. 组件状态覆盖清单（全项目共用）

| 组件 | Loading | Empty | Error | Populated | Edge |
|---|---|---|---|---|---|
| 文档列表 | 骨架行 ×3（`--surface-sunken` 微光） | 「创建第一个文档」引导 | 加载失败「重试」 | 正常列表 | 超长标题截断 |
| 编辑器 | 骨架（首次打开） | 「用 Markdown 开始写作」 | 保存失败状态栏+Toast | 正常编辑 | >1000 行虚拟化 |
| 预览区 | 骨架 | 空文档提示 | 渲染失败降级源码 | 正常渲染 | 图片加载失败占位 |
| 导出 | spinner | disabled（无内容） | Toast 失败+重试 | 正常导出 | 大文档进度条 |
| 删除 | — | — | 删除失败 Toast | 确认对话框 | 删除后撤销 5s |

---

## 附：与 SPEC.md 的对接点（供前端核对）

- 图标包：`lucide-react`（架构师 Spec 已锁定，与 UIUX.md 建议一致）
- 编辑器内核：textarea + CodeMirror 6 / Monaco（架构师定）；本页样式均以外部容器 Token 描述，内核无关
- 数据流：文档状态（列表/当前/草稿）由架构师状态管理方案提供；UI 只消费状态与回调
- 主题初始化：读取 `localStorage('sm-theme')` → `prefers-color-scheme` fallback，在 React 挂载前设置 `data-theme` 防闪烁
