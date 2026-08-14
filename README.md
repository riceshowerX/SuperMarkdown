# SuperMarkdown

打开即写、图片自包含、数据留在本地的所见即所得 Markdown 编辑器。

- **形态**：Web 应用（MVP 先行）+ Electron 桌面版（Phase 2 封装路径，见 [双形态](#electron-桌面版封装路径)）
- **核心**：编辑区与预览区并排实时渲染 | 多文档管理（IndexedDB）| 图片自动转 base64 内嵌 | HTML/纯文本导出 | 明暗双主题 | 桌面/移动双端响应式
- **定位**：免费可及、本地优先、开箱即用（详见 `../docs/PRD.md`）

---

## 快速开始

### 环境要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | ≥ 22.12 | 已在本机验证 v22.22.2 |
| npm | 随 Node | 包管理器 |

### 安装与运行

```bash
cd supermarkdown
npm install        # 安装依赖（首次约 1-2 分钟）
npm run dev        # 启动开发服务器 → http://localhost:5173
```

### 生产构建与预览

```bash
npm run build      # 产物输出到 dist/
npm run preview    # 本地预览生产构建 → http://localhost:4173
```

### 测试

```bash
npm run test       # Vitest 单元测试（11 文件 / 73+ 用例，含 XSS 安全回归）
npm run test:watch # 监听模式
```

---

## 功能清单

| 模块 | 能力 |
|------|------|
| Markdown 编辑器 | 分屏实时预览（300ms 防抖）；支持 H1-H6、有序/无序/任务列表、粗体、斜体、链接、图片、代码块（含行内代码）、表格、引用、删除线、分隔线 |
| 实时预览 | 编辑区与预览区并排；滚动同步预留；预览区 Markdown 元素全部走 `--md-*` 设计 Token |
| 文档管理 | 新建/打开/重命名（行内编辑）/删除（确认框+切相邻）/搜索实时过滤；IndexedDB 持久化，按最近修改降序 |
| 自动保存 | 800ms 防抖自动写入；状态栏三态（保存中/已保存/保存失败+重试）；刷新/关闭不丢稿；失败保留内存副本+自动重试+3 次后提示导出备份 |
| 图片内嵌 | 粘贴/拖拽自动转 base64（≤5MB；2-5MB 提示；>5MB 拒绝；>1920px 自动压缩）；单文件自包含、离线分享不丢图 |
| 导出 | HTML（内联样式+内嵌图片，离线可打开）与纯文本（去除 Markdown 语法）；文件名 `{标题}-{时间戳}.html\|.txt` |
| 主题 | 明/暗一键切换（150ms 过渡）；localStorage 持久化；首次跟随系统偏好；挂载前初始化防闪烁 |
| 响应式 | 桌面三栏（侧边栏 240px 可折叠 + 编辑/预览 50/50 可拖拽）；<768px 单栏 Tab 切换 + 抽屉侧边栏 + 底部格式工具栏，移动端触控 ≥44px |
| 格式工具栏 | 14 个高频操作（B/I/行内代码/链接/H1-H3/引用/代码块/有序无序任务列表/表格/分隔线/图片） |
| 空状态 | 无文档时引导「创建第一个文档」+ Markdown 语法速览 |
| 存储降级 | IndexedDB 不可用时自动切换 localStorage 兜底并提示「临时存储模式」 |
| 安全 | 三层 XSS 防线（markdown-it html:false → DOMPurify 白名单 → CSP meta）；禁 eval/new Function |

---

## 项目结构

```
supermarkdown/
├── index.html                  # 入口 HTML（含严格 CSP meta）
├── package.json
├── vite.config.ts              # Vite 7 + Tailwind 4 + Vitest 装配
├── tsconfig*.json
├── docs/design/                # 设计源（MASTER.md 全局规范 / PAGES.md 页面提示词）
├── src/
│   ├── main.tsx                # 入口：主题初始化（防闪烁）+ 装配（21 行）
│   ├── app/App.tsx             # 根组件（38 行）
│   ├── components/
│   │   ├── layout/             # AppShell / SplitPane / Resizer / MobileShell
│   │   ├── sidebar/            # Sidebar / DocumentList / DocumentItem / SearchBox
│   │   ├── editor/             # EditorPane / TextareaEditor / FormatToolbar
│   │   ├── preview/            # PreviewPane / PreviewErrorBoundary
│   │   ├── toolbar/            # Toolbar / ActionButton / IconButton
│   │   └── common/             # ThemeToggle / ConfirmModal / StatusBar / Toasts
│   ├── services/
│   │   ├── markdown/           # markdown.service（渲染管线）/ config / sanitize 白名单
│   │   ├── storage/            # storage.service + dexie/localStorage 双适配器
│   │   ├── export/             # export.service（HTML/纯文本）
│   │   ├── clipboard/          # clipboard.service（图片→base64）
│   │   └── stats/              # stats.service（字数/词数/行数/阅读时长）
│   ├── stores/                 # documents / editor / ui（zustand 编排）
│   ├── hooks/                  # useDebouncedValue / useAutoSave / useTheme / usePasteImage ...
│   ├── styles/                 # design-tokens.css（设计师锁定 Token）/ preview.css / index.css
│   ├── types/ utils/ config/   # 模型 / 纯工具 / 常量
│   └── __tests__/              # 11 个测试文件（73+ 用例）
└── dist/                       # 构建产物
```

**架构约定**（违反视为不合格）：单文件 ≤ 300 行（入口 < 100）；依赖只向下（组件→Store→Service→Infra）；Service 不 import React；组件不直接触碰 Dexie/DOMPurify；图标全部 lucide-react 具名导入（禁 emoji、禁 DynamicIcon）；颜色全部引用设计 Token（禁硬编码色值）。

---

## 技术栈（版本锚定）

| 类别 | 技术 | 版本 |
|------|------|------|
| 构建 | Vite + TypeScript | ^7.1.0 / ^5.8.0 |
| 框架 | React + zustand | ^19.2.0 / ^5.0.6 |
| 解析 | markdown-it + markdown-it-task-lists | ^14.1.0 / ^2.1.1 |
| 安全 | DOMPurify | ^3.2.7 |
| 高亮 | highlight.js | ^11.11.1 |
| 存储 | Dexie | ^4.0.0 |
| 图标 | lucide-react | ^0.544.0 |
| 样式 | Tailwind CSS | ^4.1.0 |
| 测试 | Vitest + Testing Library | ^3.2.0 / ^16.0.0 |

---

## Electron 桌面版封装路径（Phase 2，本期未实现）

Web MVP 验证核心价值后按以下路径封装（前端代码零改动）：

```bash
# 1. 构建 Web 产物
npm run build                              # 产出 dist/

# 2. 新增 electron/ 目录（独立于 src/，避免混入 Web 构建）
#    electron/main.cjs:  BrowserWindow 加载 dist/index.html
#    electron/preload.cjs: 白名单 IPC（如"导出到磁盘任意路径"）
#    安全配置: contextIsolation:true / nodeIntegration:false / sandbox:true / webSecurity:true

# 3. 安装并配置打包
npm i -D electron@^38.3.0 electron-builder@^26.0.0
# electron-builder 配置 NSIS 安装包，产物输出 release/

# 4. 打包
npx electron-builder --win
```

- Electron 版本基线：`electron ^38.3.0` + `electron-builder ^26.0.0`
- 渲染进程无 Node 权限；所有原生能力经 preload 白名单 IPC；外链走系统浏览器（setWindowOpenHandler 拦截）
- 可选增强：`StorageService` 增加 `FileSystemAdapter`（复用同一接口），打通"打开本地 .md 文件"
- 体积优化路径：Tauri 2（安装包 80-150MB → <10MB），需引入 Rust，估计 2-3 人日（Phase 3 选项）

---

## 质量与验收

- **QA 独立验收**：18 条 EARS 验收标准全部 PASS（P0 缺陷归零），生产就绪评分 82/100
- **测试套件**：73+ 用例全绿，含 XSS 深度回归（javascript: 链接/双重编码注入/data URL 拒载）、自动保存时序竞态、图片 5MB 边界、删除切换相邻文档、存储降级往返、表格分隔线回归
- **P0 合规**：emoji 图标零使用（全 lucide-react）、无紫粉渐变、无空洞占位文案、无硬编码色值
- 回归集已固化（`qa-regression.table-separator.test.ts` 等），后续改动全量回归

---

## 已知限制（Backlog）

- 次要辅助按钮（搜索清除/Toast 关闭/状态栏重试）触控 28-34px < 44px（不影响核心操作）
- 生产构建单 chunk 560KB > 500KB（建议 code-split）
- 分屏滚动同步（150ms 锚点）未实现，列为后续增强
- 无回收站（删除不可恢复）、无 PDF 导出、无云同步（定位使然）

---

## 文档索引

| 文档 | 位置 |
|------|------|
| 产品需求（PRD） | `../docs/PRD.md` |
| 架构设计（ARCHITECTURE + 8 份 ADR） | `../docs/ARCHITECTURE.md`、`../docs/decisions/` |
| UI/UX 设计 | `../docs/UIUX.md` |
| 规格契约（Spec，18 条验收标准） | `../docs/SPEC.md` |
| 设计 Token（W3C JSON / CSS） | `src/styles/design-tokens.json`、`design-tokens.css` |
| 页面设计提示词 | `docs/design/PAGES.md` |
| 全局设计源 | `docs/design/MASTER.md` |

*SuperMarkdown v1.0 MVP — 由 MVP 开发专家团交付（PM 许清楚 / 架构 高见远 / 设计 颜好看 / 前端 贾思敏 / QA 严过关 / 总监 大湾区靓仔）*
