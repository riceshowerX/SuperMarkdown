# SuperMarkdown 全面代码审查报告

- **审查日期**：2026-09-08
- **审查对象**：`C:\Users\miksz\Desktop\SuperMarkdown-main`（v1.2.0，86 源文件 / 6394 行 TS·TSX·CJS）
- **审查方式**：静态只读审查（Read / Grep / Glob），未安装依赖、未执行构建与测试
- **审查团队**：严过关（QA）· 寇豆码（工程师，两轮独立复查）· 高见远（架构师），由交付总监汇总定级
- **问题总数**：**78 条**（去重后）— P0 × 4、P1 × 31、P2 × 43
- **第二轮补充（附录 B）**：工程师独立视角复查新增 12 条，含 2 条 P1 —— `will-navigate` 守卫异常路径失效（SM-58）、预览渲染长任务阻塞输入（SM-64）
- **第三轮补充（附录 C）**：QA 独立视角复查新增 9 条，含 5 条 P1 —— 切文档竞态（SM-70）、并发删除孤儿文档（SM-71）、删除前 flush 失败丢稿（SM-72）、**切主题后 Mermaid 不重绘（SM-73）**、切档后导出上一篇（SM-74，原 SM-40 上调）
- **⚠️ 已修正**：SM-51 的正则误删用例在初稿中描述有误，已按第三轮手工回溯更正（见附录 C 末段）

---

## 一、执行摘要（TL;DR）

**一句话结论**：这个项目的**分层骨架与类型纪律好于同规模项目**（services 层零反向依赖、全项目零 `any` / 零 `@ts-ignore`、Tailwind token 映射干净），但存在 **2 条会导致静默丢稿 / 数据错乱的竞态缺陷**，**1 条可被用户操作触发的"应用永久不可用"DoS**，以及一套**"同一件事多处实现"的架构债**（命令 4 套枚举、当前文档 2 份状态、装载 3 条路径、排序 5 处、错误处理 4 种契约）。

### 最需要立刻处理的 5 件事

| # | 问题 | 一句话 |
|---|------|--------|
| 1 | **SM-01** | 切换文档会把旧文档的 `revision` 写到新文档状态上 → **新文档永久静默不保存**，界面仍显示"已保存" |
| 2 | **SM-02** | 删除文档与在途保存并发 → 存储层 upsert 把已删文档**"复活"** |
| 3 | **SM-10** | 图片无总量上限，粘贴十几张图即可打满内存与 IndexedDB 配额，进入**无法恢复**状态 |
| 4 | **SM-03 / SM-04** | 两个 store 循环依赖 + 当前文档身份双写，是上面竞态的**根因**，也压住了可测试性 |
| 5 | **SM-09** | `beforeunload` 里异步 flush，关窗口必丢最后 800ms 输入 |

### 安全侧的明确结论（重点）

**渲染链路上没有已确认可利用的 XSS。** 工程师逐条构造 payload 走读，四层防线均实际生效：

| 攻击面 | 配置与结论 |
|---|---|
| markdown-it `html` | `markdown.config.ts:51` `html: false` → 原始 HTML 全转义 ✅ |
| `[x](javascript:…)` | markdown-it 默认 `validateLink` 拦截，降级为纯文本 ✅ |
| `data:text/html` / `data:image/svg+xml` | `sanitize.config.ts:54` 只放行 `data:image/` + markdown-it `GOOD_DATA_RE` 双重拦截 ✅ |
| `<iframe>/<style>/<form>/on*` | `sanitize.config.ts:63` FORBID_TAGS 已禁 ✅ |
| Mermaid | `useMermaidRender.ts:46` `securityLevel:'strict'` + `:106` DOMPurify 二次清洗 ✅ |
| KaTeX `\href{javascript:…}` | 依赖默认 `trust:false`，**当前安全但未显式声明** ⚠️ → SM-34 |
| 反向 tabnabbing | 当前无 `target` 输出，无风险；属加固项 ⚠️ → SM-35 |

真正的风险在**可用性**而非注入：DoS（SM-10）、丢稿（SM-09）、Electron 加固收尾（SM-32/33）。

---

## 二、分级定义

| 级别 | 判定标准 |
|---|---|
| **P0 致命** | 数据丢失/数据错乱、应用永久不可用、或已产生实际功能缺口的架构缺陷（且是其他缺陷的根因） |
| **P1 严重** | 可复现的功能异常、明显卡顿、高危配置、已造成重复实现的架构债 |
| **P2 一般** | 边界场景、加固项、文档漂移、可维护性改进 |

> **定级调整说明**：架构师将「命令体系 4 套枚举」（原 ARCH-03）定为 P0，汇总时**下调为 P1（SM-23）**——它已产生实际缺口（`h3` 死命令、`table`/`hr` 面板不可达），但不导致数据丢失或不可用，且修复不阻断其他工作。反之，QA 定为 P2 的「`probeIndexedDB` 未处理 `onblocked`」（原 QA-13）**上调为 P1（SM-12）**——它会让应用永久卡在加载态。

---

## 三、P0 致命问题（4 条）

### SM-01 在途保存与切换文档竞态 → 新文档永久静默不保存

| 项 | 内容 |
|---|---|
| **分类** | 状态管理 / 竞态条件 / 数据丢失 |
| **位置** | `src/stores/editor.store.ts:100-158`（关键：106-114、119 `await`、120 `set({lastSavedRevision})`、129-130 catch）<br>关联：`src/stores/editor.store.ts:58-73`（loadDocument 归零但不作废在途保存）、`src/stores/documents.store.ts:156-164`、`src/app/App.tsx:23-30` |
| **严重级别** | **P0** |

**触发条件**
1. 在文档 A 输入 → 800ms 后自动保存启动（`saveStatus='saving'`，`pending` 已被消费为 `null`）；
2. 在 IndexedDB 写入完成**之前**切换到文档 B（含 base64 图片时 `db.documents.put()` 可达数百 ms～数秒；小文档也有几十 ms 窗口）；
3. `flushSave()` 因 `pending === null` 在 `:106` 直接 return（**不等待在途写入**）→ `setActiveDocId('B')` → `loadDocument(B)` 把 `revision=0 / lastSavedRevision=0`；
4. 在途写入返回 → `:120` 执行 `set({ saveStatus:'saved', lastSavedRevision: 5 /* A 的 revision */ })`，**落到 B 的状态上**。

**影响**：此后 B 的 `lastSavedRevision(5) > revision(0)`。用户继续输入 → `revision` 变 1、2、3… → `flushSave` 在 `:107` 判断 `pending.revision <= st.lastSavedRevision` 恒真 → 直接丢弃。**文档 B 从此再也不保存**，保存状态仍显示"已保存"，用户完全无感知，刷新即全部丢失。删除场景同理。

**修复方案**：引入「世代号」+ 让 `loadDocument/clearDocument` 作废在途保存：

```ts
let saveGen = 0;   // 模块级

loadDocument: (doc) => {
  saveGen++;                                    // 作废所有在途保存
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  pending = null; firstSaveToastSent = false;
  set({ docId: doc.id, content: doc.content, revision: 0,
        lastSavedRevision: 0, saveStatus: 'idle', failCount: 0 });
},
clearDocument: () => { saveGen++; /* 同上清理 */ },

flushSave: async () => {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  const st = get();
  if (!pending || !st.docId) return;
  if (pending.revision <= st.lastSavedRevision) { pending = null; return; }
  if (st.saveStatus === 'saving') return;
  const payload = pending, gen = saveGen, docId = st.docId;   // ← 捕获
  pending = null;
  set({ saveStatus: 'saving' });
  try {
    await (await getStorageService()).updateDocument({ id: docId, title, content: payload.content });
    if (gen !== saveGen || get().docId !== docId) return;     // ← 关键：文档已切换，丢弃结果
    set({ saveStatus: 'saved', lastSavedRevision: payload.revision, failCount: 0 });
  } catch (err) {
    if (gen !== saveGen || get().docId !== docId) return;     // ← catch 分支同样要校验
    /* ... */
  }
}
```

补充：让 `flushSave` 返回在途 Promise（`let inFlight: Promise<void> | null`），`setActiveDocId` / `deleteDocument` / `createDocument` 先 `await inFlight` 再切换，从根上消除窗口。

**验证方式**：单元测试——`loadDocument(A)` → 多次 `setContent` → 推进 800ms 触发保存（mock 的 `updateDocument` 返回永不 resolve 的 Promise）→ 立刻 `loadDocument(B)` → 手动 resolve → 断言 B 的 `lastSavedRevision === 0` 且后续 `setContent` 仍能触发 `updateDocument`。

---

### SM-02 删除文档与在途保存并发 → 已删文档"复活"

| 项 | 内容 |
|---|---|
| **分类** | 竞态条件 / 数据一致性 |
| **位置** | `src/stores/documents.store.ts:116-142`（118 `await flushSave()`、122 `deleteDocument`）<br>`src/stores/editor.store.ts:111`（在途时提前 return，不等待）<br>`src/services/storage/storage.service.ts:63-80`（read-modify-write）<br>`src/services/storage/localStorage.adapter.ts:46-55`（`idx === -1` 时 **push 插入**）<br>`src/services/storage/dexie.adapter.ts:19-21`（`put` 同样重新插入） |
| **严重级别** | **P0** |

**触发条件**：文档 A 正在写入（`saveStatus='saving'`）时，用户在 800ms 内删除 A → `flushSave()` 因在途立即返回 → `deleteDocument` 删除记录 → 在途写入随后完成 `put/upsert` → 记录被写回 → `editor.store.ts:127` 的 `refreshList()` 读回列表。

**影响**：显示"已删除"Toast 后文档又出现在侧栏，删除被静默回滚；用户以为已清理的内容仍在库里。

**修复方案**
1. 同 SM-01 引入 `inFlight` Promise，`deleteDocument` 先 `await inFlight`；
2. `StorageServiceImpl.updateDocument` 在 `existing == null` 时改为抛 `AppError('SAVE_FAILED', …)`，**不要 upsert**（删除语义优先）；
3. `deleteDocument` 删除后，若 editor store 的 `docId === id` 则调用 `clearDocument()`。

**验证方式**：mock 存储让 `updateDocument` 延迟 resolve → 触发保存 → 不等待直接 `deleteDocument(id)` → resolve 写入 → 断言 `listDocuments()` 不含该 id。

---

### SM-03 editor.store 与 documents.store 双向循环依赖 + 8 处跨 store 隐式耦合

| 项 | 内容 |
|---|---|
| **分类** | 循环依赖 / 状态边界 |
| **位置** | `src/stores/editor.store.ts:12` → `import { useDocumentsStore }`<br>`src/stores/documents.store.ts:6` → `import { useEditorStore }`<br>耦合点：`editor.store.ts:116-118`（读 documents 算标题）、`:127`（`refreshList()`）；`documents.store.ts:81, 100, 118, 133, 159, 162` |
| **严重级别** | **P0**（是 SM-01/SM-02 难以修复的根因） |

**现状与影响**
- 两个 store 互相 `import` 并在 action 内用 `getState()` 直接调用对方，**目前"能跑"只是因为跨 store 调用都发生在异步函数体内**（ESM 循环在模块求值期已绕开），属于侥幸正确。
- 任何一次自动保存（每 800ms）都触发 `refreshList()` → 全量重读 IndexedDB → 侧栏整体重渲染，写路径与列表路径被焊死（同时造成 SM-16 性能问题）。
- 想单独测 `documents.store.deleteDocument` 必须同时 mock `editor.store`；现有 `src/__tests__/editor.store.test.ts` 只能靠全模块打桩绕开，**架构直接压住了测试**（SM-53）。

**修复方案**（增量 3 步）
1. 抽 `src/stores/ports.ts`，把「读文档列表 / 触发列表刷新」改为**回调注入**：editor.store 增加 `configureEditorStore({ getDocuments, onSaved })`，在 `App.tsx` 装配一次，然后**删掉 `editor.store.ts:12` 的 import**；
2. documents.store 对 editor 的依赖收敛为单一语义：新增 `src/stores/saveGate.ts` 导出 `flushPendingSave(): Promise<void>`，documents.store 只 import 它，删掉 `documents.store.ts:6`；
3. （可选，收益大）把「当前文档」提为第三个 store `session.store.ts` 持有 `activeDocId`，统一编排「切文档 → flush → loadEditor → 更新列表」，同时解决 SM-04。

**迁移成本**：**中**。集中在 2 个 store 共 8 个耦合点；`qa-autosave.test.ts`、`qa-documents-delete.test.ts`、`editor.store.test.ts` 需同步调整断言方式。不涉及 UI 与数据格式。

---

### SM-04 当前文档身份双写 + 装载逻辑分散在 3 条路径

| 项 | 内容 |
|---|---|
| **分类** | 状态边界 / 数据一致性 |
| **位置** | `src/stores/documents.store.ts:11`（`activeDocId`）、`src/stores/editor.store.ts:24`（`docId`）<br>路径 A：`src/app/App.tsx:23-30`（useEffect 桥接）<br>路径 B：`src/stores/documents.store.ts:133`（删除后自动新建时直接 `loadDocument`）<br>路径 C：`src/stores/documents.store.ts:162`（`clearDocument`）<br>`setActiveDocId` 本身不加载：`documents.store.ts:156-164` |
| **严重级别** | **P0** |

**影响**
1. **effect 依赖不全**：`useEffect(…, [activeDocId])` 内读 `getState().documents`，但 `documents` 不在依赖数组 → `activeDocId` 不变而文档对象被刷新时编辑器不同步，行为不可预测。
2. **删除-重建场景双重 load**：`documents.store.ts:133` 已 `loadDocument`，随后 `activeDocId` 变化又触发 `App.tsx:23` 再 load 一次 → `revision/lastSavedRevision/firstSaveToastSent` 被重置两次。当前幂等所以看不出来，但任何在 `loadDocument` 里加的副作用都会执行两遍。
3. `setActiveDocId(id)` 语义不完整（只改 id 不加载），调用方必须知道"还得靠 App 的 effect 兜底"——**隐式契约**。

**修复方案**
1. 从 editor.store 移除 `docId`，它只保留 `content/revision/saveState`（退化为"编辑器缓冲区"）；当前文档 id 唯一真源 = `documents.activeDocId`；
2. 收敛为单一 action：`async function activate(id)` = `await saveGate.flushPendingSave()` → `set({activeDocId})` → `doc ? editorBuffer.load(doc.content) : editorBuffer.clear()`；`setActiveDocId`、`:133`、`:162` 全部改调它；
3. **删掉 `App.tsx:23-30` 整段 useEffect**（消除"同一件事两处实现"的关键一步）；
4. `FormatToolbar.tsx:88`、`TextareaEditor.tsx:19`、`PreviewPane.tsx:14` 的 `docId` 改读 `documents.activeDocId`。

**迁移成本**：**中**。1 个 store + 1 个入口 + 4 个读取点；`qa-documents-delete.test.ts` / `qa-autosave.test.ts` 断言的是外部行为，语义等价即可基本不改。

---

## 四、P1 严重问题（正文 24 条 + 附录 B 2 条 + 附录 C 5 条 = 31 条）

### 4.1 缺陷与逻辑漏洞（6 条）

#### SM-05 初始化失败后 `loaded` 被置 true →「重试」永久失效
- **位置**：`src/stores/documents.store.ts:39-40`（`if (get().loaded || get().loading) return;`）、`:61-65`（catch 里 `set({loading:false, loaded:true, initError})`）；触发点 `src/components/layout/AppShell.tsx:52`
- **触发/影响**：首次加载存储不可用（localStorage 被禁用/配额异常）→ 进错误态 → 点「重试」→ `loaded===true` 使 `initialize` 首行直接 return，`initError` 永不清除 → **用户被永久卡在"加载失败"页**，只能手动刷新。错误处理路径形同虚设。
- **修复**：catch 改为 `set({ loading:false, loaded:false, initError })`；或新增 `retryInitialize()`：`set({loaded:false, loading:false, initError:null})` 后 `return get().initialize()`，`AppShell.onRetry` 改调它。

#### SM-06 「最近使用」不随删除清理 → 打开已删文档导致内容错写
- **位置**：`src/components/common/paletteItems.ts:38-60`（`readRecent/recordRecent` 从不校验 id 是否存在）、`src/components/common/CommandPalette.tsx:87-95`、`src/stores/documents.store.ts:156-164`、`src/app/App.tsx:25-29`（找不到就静默不做任何事）
- **合并来源**：QA-04 + SEC-10（localStorage 明文部分）
- **触发/影响**：删除文档 D → ⌘K 打开面板 → 「最近使用」仍显示 D → 回车 → `activeDocId` 指向已删文档，`App` 找不到 D 不加载 → **编辑区继续显示上一篇文档的内容**，而侧栏显示"无标题文档"且无高亮。此时输入会按上一篇的 `docId` 保存 → **用户以为在写新文档，实际在改旧文档**。
- **修复**：① `CommandPalette` 构造 recentItems 时过滤 `deps.recent.filter(r => deps.documents.some(d => d.id === r.id))`；② `deleteDocument` 成功后 `writeRecent(readRecent().filter(r => r.id !== id))`；③ `setActiveDocId` 加守卫 `if (id && !get().documents.some(d => d.id === id)) return;`；④ `App.tsx` 找不到文档时 `clearDocument()` 而非静默保留。

#### SM-07 Ctrl+Shift+T 被 ⌘⇧T 分支抢先 → 打字机模式不可达且误切主题
- **位置**：`src/hooks/useGlobalShortcuts.ts:47-59`（先判 `['meta','shift','t']` 再判 `['ctrl','shift','t']`）、`src/config/shortcuts.ts:87-94`（非 Mac 平台 `meta` 映射为 `e.ctrlKey`）
- **触发/影响**：Windows/Linux 按 Ctrl+Shift+T → `matchesShortcut(['meta','shift','t'], e)` 因 `primary = e.ctrlKey` 而**命中** → 走 `ui.setTheme(...)` 并 return，打字机分支成为**死代码**。结果是打字机模式在键盘上完全无法开启，而该键在 Chrome 里是"恢复关闭标签页"，`preventDefault` 也拦不住。
- **修复**：调换判定顺序，把字面 `['ctrl','shift','t']` 放在 `['meta','shift','t']` 之前；更彻底是在 `ShortcutDef` 增加 `platform?: 'mac'|'other'`，由 `matchesShortcut` 统一过滤。

#### SM-08 连续保存失败 Toast 无限堆积
- **位置**：`src/stores/editor.store.ts:128-151`、`src/stores/ui.store.ts:83-87`（`pushToast` 无去重无上限）、`src/components/common/Toasts.tsx:45-49`（error 永不自动消失）+ `:20-30`（容器无 max-height）
- **触发/影响**：磁盘配额满时用户继续打字 → 每次防抖保存失败 `failCount++`，`>=3` 就再 push 一条常驻错误 Toast → 十几秒堆满整屏且无法消失，遮住编辑区；`toasts` 数组无上限增长。
- **修复**：① 模块级 `backupToastSent` 标记，仅在首次超阈值时 push，切文档时重置；或按 `kind+title` 幂等去重；② `pushToast` 加上限 `.slice(-4)`；③ 容器加 `max-h` + `overflow-y-auto`。

#### SM-09 `beforeunload` 异步 flush 不可靠 → 最后 800ms 输入丢失（⚠️ 丢稿）
- **位置**：`src/hooks/useAutoSave.ts:10-19`、`src/stores/editor.store.ts:100-158`、`electron/main.cjs:132-134`（`window-all-closed` → 直接 `app.quit()`）
- **合并来源**：QA-07 + SEC-02
- **触发/影响**：输入后 800ms 内直接关闭窗口/退出应用 → `beforeunload` 处理器返回后页面立即销毁，`flushSave` 内的 IndexedDB 事务被中止 → 内容丢失。UI 与注释都声称"意外关闭不丢稿"，**验收标准与实现不符**。Electron 端更明显：主进程 `window-all-closed` 立即 `app.quit()`，没给渲染进程留 flush 时间。
- **修复**（Web + Electron 双通道）
```ts
// A. Web：同步落"崩溃缓冲"到 localStorage（同步 API 必定成功）
const onBeforeUnload = () => {
  const st = useEditorStore.getState();
  if (st.docId && st.revision > st.lastSavedRevision) {
    try { localStorage.setItem('sm-crash-buffer',
      JSON.stringify({ id: st.docId, content: st.content, ts: Date.now() })); } catch {}
    void st.flushSave();
  }
};
// 启动时（initialize 前）检测该键并提示"检测到未保存内容，是否恢复"
```
```js
// B. Electron：主进程等渲染进程确认
app.on('before-quit', (e) => { if (!flushDone) { e.preventDefault(); /* 通知 renderer flush → 'flush-done' 后 app.quit() */ } });
```
  另建议：`AUTOSAVE_DEBOUNCE_MS` 从 800ms 降到 400ms，并对 `blur` / `visibilitychange:hidden` 也触发 flush（比 `beforeunload` 可靠得多）。
- **验证**：输入后立即关闭（<800ms），重开确认内容仍在；反复 20 次丢失率应为 0。

#### SM-12 `probeIndexedDB` 未处理 `onblocked` → Promise 永不 settle，应用永久卡加载
- **位置**：`src/services/storage/storage.adapter.ts:13-35`（只绑了 `onerror` / `onsuccess`）— **由 P2 上调为 P1**
- **触发/影响**：另一标签页持有同版本 `sm-probe-db` 连接未关闭时打开新页面 → 触发 `blocked` 事件，`onerror`/`onsuccess` 均不触发 → `await probeIndexedDB()` 永久 pending → `initialize()` 永久停在 `loading:true` → **侧栏一直骨架屏、应用完全不可用且无任何错误提示**。
- **修复**：`req.onblocked = () => resolve(false);`（视为不可用，走 localStorage 兜底）；`req.onupgradeneeded = () => { try { req.result.close(); } catch {} }`；再加 1s 超时兜底 `setTimeout(() => resolve(false), 1000)`。

### 4.2 安全与可用性（1 条）

#### SM-10 图片内嵌无总量/累计上限 → 内存与存储 DoS（可致应用永久不可用）
- **位置**：`src/services/clipboard/clipboard.service.ts:83-99`、`src/config/constants.ts:10`（`IMAGE_MAX_BYTES = 5MB`）、`src/hooks/usePasteImage.ts:19`、`src/services/storage/dexie.adapter.ts:20`
- **触发/影响**：只有**单张 5MB** 硬上限，文档张数、总字符数、IndexedDB 单条记录大小**三项都无上限**。dataURL 是 base64（×1.33）且作为纯文本进入 `content`。连续粘贴 10 张 3MB 截图 → `content` ≈ 40MB；此后每次击键复制整串、每 800ms 把 40MB 结构化克隆写 IndexedDB。实测预期：**3~5 张后输入掉帧，10 张以上基本卡死**；配额打满后所有文档保存失败并触发"保存失败"死循环；**重启后加载即卡死（数据在库里，进不去应用删不掉）**。
- **修复**（三层）
```ts
// constants.ts
export const DOC_MAX_CHARS = 2_000_000;
export const DOC_MAX_IMAGE_BYTES_TOTAL = 20 * 1024 * 1024;
// clipboard.service.ts：extractImage 增加 usedBytes 入参
if (usedBytes + file.size > DOC_MAX_IMAGE_BYTES_TOTAL)
  throw new AppError('IMAGE_TOO_LARGE', '本文档图片总量已达 20MB 上限，请新建文档或改用外链');
```
  治本方案（可放 v3）：图片改独立表存储 + 文档内放 `sm-img://<id>` 占位，渲染时再注入 dataURL，不进编辑区字符串。

### 4.3 性能瓶颈（6 条）

> 提示：SM-11/13/14/15 在大文档下**叠加生效**。1MB 正文（约 2 万行、含 5 张图）单次击键同步开销约 **80~300ms**，已到"输入粘滞"级别；5MB 基本不可用。建议作为整体专项排期。

#### SM-11 状态栏字数统计：每键全量扫描全文 3~4 遍 + 生成百万级数组
- **位置**：`src/services/stats/stats.service.ts:14-25`、`src/components/common/StatusBar.tsx:11,17`
- **现状**：`markdown.replace(/\s/g,'')`（全量复制）+ `match(CJK_RE)`（N 元素数组）+ `match(WORD_RE)`（M 元素数组）+ `split('\n')`（L 元素数组），`useMemo` 依赖 `content` → 每键重算。
- **影响**：100 万字符中文文档 → 单次约 60~80MB 瞬时堆分配 + 30~60ms，**每次击键都来一遍**，是本项目最容易触发 GC 抖动的点。
- **修复**：改为单趟游标统计（`charCodeAt` 循环，零额外分配，`readingMinutes` 用 `cjk/CPM + words/WPM`）；`StatusBar` 改用 `useDebouncedValue(content, 500)` 后再算。
- **预期收益**：O(4n) + 3 次大数组 → O(n) 零分配；叠加防抖后每次击键省 60~80MB 瞬时堆。

#### SM-13 每次自动保存后 `refreshList()` 全量读取所有文档（含 content 全文）
- **位置**：`src/stores/editor.store.ts:127`、`src/stores/documents.store.ts:68-76`、`src/services/storage/dexie.adapter.ts:7-9`
- **影响**：100 篇 × 50KB = 5MB → 每 800ms 从 IndexedDB 结构化克隆读出 5MB 并 `set({documents})` → `DocumentList`/`CommandPalette`/`Sidebar` 全部重渲染。图片型文档下变成 100MB+，直接打满主线程。
- **修复**：① 新增 `listMeta()` 只投影 `id/title/createdAt/updatedAt`；② `flushSave` 改为「本地修补单条 meta + 5s 节流刷新」，去掉无条件全量刷新。

#### SM-14 光标行高亮镜面层：每键重渲染全文每一行为一个 `<span>`
- **位置**：`src/components/editor/ActiveLineHighlight.tsx:25,36-41`、`src/components/editor/TextareaEditor.tsx:74-80`
- **影响**：5000 行约 5~15ms/键；2 万行 40~80ms/键；5 万行 150~400ms/键（卡死）。另有 `content.split('\n')` 每次分配 N 元素数组（2 万行 ≈ 800KB 临时分配/键）。组件未 `React.memo`，`key={i}` 在行中间插入时导致后续行全部错位重渲染。
- **修复**：推荐**只渲染可视窗口 ± 缓冲行**，其余用 `paddingTop/paddingBottom` 撑起高度（`OVERSCAN=20`）；更省的做法是改为绝对定位的单个高亮条，只渲染 `activeLine` 一行；并加 `React.memo`。
- **预期收益**：2 万行下单键开销从 ~50ms 降到 <3ms，临时分配下降 90%+。

#### SM-15 Mermaid：无源码哈希缓存、无取消、无并发上限 → 每次输入重渲染全部图表
- **位置**：`src/hooks/useMermaidRender.ts:73-123`（`:98` 无并发上限、`:104` 无缓存、`:120` 只置标志位不中止已发起 render）
- **影响**：单张中等 flowchart 约 40~150ms（dagre 布局 + DOM 注入 + 二次 DOMPurify），5 张图 → 200~750ms/轮，每 300ms 一轮。用户在正文打字时图表区**持续闪白**（先被重置回 `<pre>` 再异步替换）。`cancelled` 只标志不中止，快速输入会堆积多轮 render。
- **修复**：① 源码级 LRU 缓存（key = `theme + '\0' + source`，size ≤ 30）；② 用**任务世代号** `genRef` 替代 `cancelled`，`gen !== genRef` 时丢弃结果；③ 串行化或 `p-limit(2)` 限并发；④ 渲染完成前保留旧 SVG 避免闪白。

#### SM-16 大文档下每键多处 O(n) 全量处理
- **位置**：`src/utils/editor.ts:39-42`（`computeActiveLine`：`value.slice(0,pos).split('\n')` 是 O(n) 复制 + O(行) 数组）、`src/components/editor/TextareaEditor.tsx:34-45,85-88`、`src/stores/editor.store.ts:85-88`
- **影响**：1MB 文档光标在文末时单次 `computeActiveLine` = 1MB `slice` + 约 2 万元素数组 → 5~15ms，**每次按方向键都要付一次**。
- **修复**：改为从光标位置向前数换行符（O(行宽)）；`onSelect`/`onScroll` 用 `requestAnimationFrame` 合并（方向键连按只算一次），卸载时 `cancelAnimationFrame`。
- **预期收益**：`computeActiveLine` 由 5~15ms 降到 <0.05ms。

#### SM-17 每个文档项注册一个 `document` 级监听 + 列表无虚拟化
- **位置**：`src/components/sidebar/DocumentItem.tsx:34-40`、`src/components/sidebar/DocumentList.tsx:129-146`
- **影响**：500 篇文档 → 501 个 `document` 级 `mousedown` 监听；**任意一次鼠标按下**都要同步跑 501 个回调（每个做一次 `contains()` DOM 树遍历），单次点击增加 2~8ms；同时 500 个 `DocumentItem` 常驻 DOM，首屏渲染 100~300ms。
- **修复**：删除 `DocumentItem` 内的全局监听，改为在 `DocumentList` 做**一次事件委托**（用 `data-doc-menu` 属性 + 自定义事件关闭菜单）；数量超阈值做窗口化渲染（只渲染可视区 ~30 项）。

### 4.4 架构与设计（7 条）

#### SM-18 `editorCommandBus` 是隐式全局可变单例 → 预览视图下命令静默失败
- **位置**：`src/hooks/editorCommandBus.ts:8-9`；注册方 `src/components/editor/EditorPane.tsx:19-22`；消费方 `Toolbar.tsx:18,116-117`、`CommandPalette.tsx:96-99`、`useGlobalShortcuts.ts:71`；绕过总线的第二条链：`EditorPane.tsx:29`（移动端用 `useEditorCommands()` 本地函数）
- **影响**：① `runEditorCommand` 返回 `boolean` 但 `Toolbar.tsx:116` 与 `CommandPalette.tsx:97` **都忽略返回值** → 在"仅预览"视图下（`EditorPane` 未挂载 → 总线未注册）按 ⌘B 或选"加粗"，命令**静默消失、用户零反馈**；② 无注册状态查询（`FormatToolbar.tsx:88` 用 `docId !== null` 判断，与"编辑器实例是否已注册"不是一回事）；③ 模块级单例无 `reset()`，跨测试泄漏；④ 桌面/移动两条执行链未来必然分叉。
- **修复**：总线升级为可观察对象，补 `isEditorReady()` / `onReadyChange()` / `resetEditorBus()`；消费方统一处理未就绪（`if (!runEditorCommand(cmd)) { close(); pushToast({kind:'info', title:'请先切换到编辑视图'}); }`）；移动端也改走总线，**只保留一条执行链**。

#### SM-19 分层倒置：叶子组件反向 import `app/actions`，并直连 service 内部实现
- **位置**：`components/sidebar/DocumentItem.tsx:7`、`components/toolbar/Toolbar.tsx:19`、`components/common/CommandPalette.tsx:5` → 都 import `../../app/actions`（而 `app/actions.ts:2-4` 又 import 三个 store，依赖链变成 `components → app → stores`，`app` 层退化为工具函数模块）；`StatusBar.tsx:6`、`PreviewPane.tsx:7`、`FormatToolbar.tsx:25-30`（连 `ImageTooLargeError` 都引进来）、`useMermaidRender.ts:3`（引 sanitize 内部配置）
- **影响**：① `App.tsx:12` 注释称"只装配、无业务逻辑"，但真正逻辑在被侧栏/顶栏调用的 `app/actions.ts` 里，**装配层定义被架空**；② 服务层异常类型成为 UI 契约（换错误类型要改 2 处）；③ `useMermaidRender` 与 `markdown.service.ts:12` 是 `installSanitizeHooks()` 的**两个调用点**，而 `hooksInstalled` 是模块级开关 → 行为依赖模块执行顺序（隐式时序耦合）。
- **修复**：① `app/actions.ts` 迁到 `src/hooks/useExportActions.ts`，`app/` 只留 `App.tsx`；② 各 service 加 `index.ts` 门面，只导出对外 API，`ImageTooLargeError` 改为 `AppError.code === 'IMAGE_TOO_LARGE'` 判定（顺带消灭 SM-26 的一份重复）；③ `useMermaidRender` 只从门面导入 `sanitizeMermaidSvg(svg)`，hook 安装收回 service 内部单点负责。

#### SM-20 存储适配器抽象未真正解耦 + Dexie 无迁移路径 + 反序列化零校验
- **位置**：`src/services/storage/storage.service.ts:4-6,100,103-117`（后端选择硬编码在 `getStorageService` 的 if/else）、`src/services/storage/db.ts:8-13`（只有 `version(1)`）、`src/services/storage/localStorage.adapter.ts:20-21`（`as Document[]` 无校验）
- **合并来源**：ARCH-06 + ARCH-07 + SEC-11
- **影响**：① "切换后端只需换一个实现"**不成立**——接 SQLite 或 File System Access API 必须**修改** `getStorageService` 而非新增文件；② 给 `Document` 加字段（置顶/文件夹/标签）必须记得手写 `version(2)`，否则新字段无法索引，且**没有任何迁移钩子可补救**；③ `as Document[]` 让损坏数据以"合法 Document"进入内存 → `sortDocuments` 里 `b.updatedAt - a.updatedAt` 遇 `undefined` 得 `NaN` → 列表顺序未定义、`formatRelativeTime` 显示"NaN 天前"；④ `db.ts:16` 模块级 `new SuperMarkdownDB()`（import 即 new）；⑤ 无 `fake-indexeddb` → **Dexie 主存储路径零测试覆盖**。
- **修复**：① 引入 `BackendFactory` 注册表（各适配器底部 `registerBackend({name, isAvailable, create, fallback})`），`getStorageService` 退化为一次遍历；② `db.ts` 改懒加载工厂 + 预留 `version(2).upgrade()` 模板并写入 `docs/design`；③ 抽 `src/types/guards.ts` 的 `isDocument()`，`localStorage.adapter` 改为 `parsed.filter(isDocument)`（丢弃脏数据时先备份到 `sm_docs_backup_corrupt_<ts>`）；④ 补 `fake-indexeddb` 并给 `DexieAdapter` 写对称测试。

#### SM-21 错误处理四种契约并存 + 原始错误被丢弃 + 无本地落盘
- **位置**：`documents.store.ts:73-75`（吞掉只 console）、`:90-93/:110-113/:61-65`（吞掉 + toast）、`:144-154`（抛出，由 `Toolbar.tsx:56-58` 与 `DocumentItem.tsx:53-55` 各自 catch，**同一语义两份实现**）、`:116-142`（抛出，仅 1 个调用方接住）；`storage.service.ts:32-34,57-60,76-78`（`catch (err)` 里 `err` 未使用）；`utils/errors.ts:4-14`（`AppError` 无 cause/timestamp）、`:17-21`（`toAppError` 丢弃堆栈）、`:24-31`（只 console）；`ConfirmModal.tsx:84-86`（空 catch 静默吞异常）
- **影响**：① 保存失败时用户只看到状态栏红字，DevTools 关闭后**没有任何证据留存**，无法区分 quota 满 / IndexedDB 被清 / file:// 下 Dexie open 失败；② 连续失败 3 次才提示导出备份，前两次静默；③ `ConfirmModal` 的空 catch 是个陷阱——下一个写 `openConfirm` 的人若忘了 try/catch，删除失败会表现为"弹窗消失、什么也没发生"。
- **修复**：① `AppError` 加 `ctx?: { cause, docId, op }`，`storage.service` 三处改 `throw wrap(err, 'LOAD_FAILED', '读取文档列表失败')`；② 统一契约：**store 内一律不 toast、一律抛 AppError**，toast 由调用方负责，用一个共享 `useAsyncAction()` hook 收敛；③ `ConfirmModal` 空 catch 改为 toast 后再关闭；④ 新建 `src/utils/logger.ts`：`logError(scope, err, ctx)` → 内存环形缓冲（100 条）+ `localStorage['sm-error-log']`（截断 200 条）+ 状态栏"复制诊断信息"入口；Electron 下额外由主进程写 `%APPDATA%/SuperMarkdown/logs/`。

#### SM-22 文档排序 5 处重复实现 + store 与展示层排序语义冲突
- **位置**：`localStorage.adapter.ts:32`、`documents.store.ts:86`、`documents.store.ts:107`、`documents.store.ts:151`、`utils/documentGroups.ts:44`（另 `dexie.adapter.ts:8` 第 6 处）
- **影响**：用户在侧栏选"标题 A-Z"后，800ms 一次自动保存触发 `refreshList` → 列表被按 `updatedAt` 存回 store，而展示层每次 `useMemo` 又重排 → **store 里的顺序与用户选择永远是两套**，只靠展示层掩盖。任何"直接读 `store.documents` 顺序"的需求（如键盘导航"下一篇"）都会踩坑。
- **修复**：`documentGroups.ts` 导出 `SORT_OPTIONS` 策略表（`{key,label,group,cmp}`）；**store 内三处 `.sort(...)` 全部删除**（顺序是展示层的事）；`DocumentList` 按钮列表改由 `SORT_OPTIONS.map()` 渲染。

#### SM-23 命令体系 4 套并行枚举，已产生实际功能缺口（架构师原定 P0，汇总下调为 P1）
- **位置**：`utils/editor.ts:3-17`（13 个 `EditorCommand`）、`config/shortcuts.ts:41-67`（只覆盖 11 个，缺 `h3`/`table`/`hr`）、`components/common/paletteItems.ts:97-175`（硬编码 9 条 + hint 直接写字面量 `'⌘N'`/`'⌘\\'`/`'⌘⇧T'`）、`components/editor/FormatToolbar.tsx:51-81`（`GROUPS`+`OVERFLOW_ITEMS`+`COMPACT_CMDS` 第四套）、`hooks/useGlobalShortcuts.ts:24-66`（⌘K/?/⌘N/⌘S/⌘⇧T/Ctrl+Shift+T/⌘\ 逐个硬编码，不查 SHORTCUTS）
- **已产生的实际缺口**：`h3` 命令**完全不可达**（`utils/editor.ts:9` 定义、`applyEditorCommand:98-99` 实现，但 SHORTCUTS 与工具栏都没有）→ 死代码；`table`/`hr` 只能从工具栏溢出菜单点，命令面板搜不到、无快捷键。
- **影响**：加一个新命令（如"删除线"）要同时改 4~5 处；给 ⌘N 改键要同时改 `shortcuts.ts:43`、`useGlobalShortcuts.ts:36-37`、`paletteItems.ts:101` → 三处不一致就出现"面板显示 ⌘N 但按 ⌘M 才生效"。
- **修复**：新建 `src/config/commands.ts` 单一注册表（`{id, command?, label, icon, paletteGroup, toolbarGroup, keywords, keys, display, run(ctx)}`）；`shortcuts.ts` 降级为派生视图（`COMMANDS.filter(c => c.keys)`）；`useGlobalShortcuts` 替换为一次遍历；`paletteItems` / `FormatToolbar` 从注册表派生；顺手补上 `h3` 或删除死代码（二选一，别留）。

#### SM-24 模块级可变单例遍布全项目且无复位入口 + 4 处 import 即执行副作用
- **位置**：7 处无 reset 单例 —— `editor.store.ts:16-21`、`editorCommandBus.ts:8-9`、`markdown.service.ts:7`、`sanitize.config.ts:78`、`useScrollSync.ts:10,21-23`、`useMermaidRender.ts:32-34`、`ui.store.ts:15`；4 处模块级副作用 —— `theme/init.ts:37`（模块底部直接 `initTheme()`）、`db.ts:16`、`markdown.config.ts:15-30`（16 次 `hljs.registerLanguage`）、`sanitize.config.ts:81-107`（全局 DOMPurify hook，两个入口调用）
- **影响**：① `src/__tests__/setup.ts` 只有 6 行（仅 `localStorage.clear()`），没有对上述任何单例复位 → 出现"单跑通过、全跑失败"的幽灵用例；② `resolveTheme` 明明是纯函数，却因与 `initTheme()` 同居一模块而无法在无 DOM 环境安全导入，连带 `useGlobalShortcuts`/`CommandPalette`/`useMermaidRender`/`useTheme` 4 个模块及其测试；③ `installSanitizeHooks` 双入口让"任务列表 checkbox 是否被 disabled"依赖运行顺序。
- **修复**：① **最高性价比（约 10 分钟）**：把 `theme/init.ts` 拆为 `theme/resolve.ts`（纯函数，零副作用）与 `theme/bootstrap.ts`（自执行），4 处 import 指向 `resolve.ts`，`main.tsx` 引 `bootstrap`；② 给每个单例补 `resetXxxForTest()` 并在 `setup.ts` 的 `beforeEach` 统一调用；③ `vitest` 配置加 `pool:'forks', isolate:true`。

### 4.5 可维护性（4 条）

#### SM-25 类型安全缺口 + 无 ESLint 却写 eslint-disable（真实依赖缺失被掩盖）
- **位置**：`markdown.config.ts:34-36` 与 `useMermaidRender.ts:39`（2 处 `as unknown as`）；`desktop.service.ts:25`（`window.desktop!` 非空断言）；`localStorage.adapter.ts:20-21`（`as Document[]`，见 SM-20）；`components/toolbar/ActionButton.tsx`（**全项目零 import 的死代码**）；`ConfirmModal.tsx:102-123` 导出 `SaveIndicator`（保存状态指示器放在确认对话框文件里，被 `StatusBar.tsx:7` 引用）；`CommandPalette.tsx:102`、`Toasts.tsx:54` 写了 `eslint-disable react-hooks/exhaustive-deps` 但**项目根本没有 ESLint**
- **影响**：后两条注释是死的 → `react-hooks/exhaustive-deps` 从未被检查；而 `CommandPalette.tsx:103` 的 `useMemo` 依赖数组**确实缺了 10 个自由变量**，`Toasts.tsx:55` 的 `useEffect` 也缺 `startTimer/onDismiss` —— 这是真实存在的陈旧闭包隐患。
- **修复**：① `desktop.service.ts` 改类型收窄 `const bridge = window.desktop; if (bridge?.openLocalMarkdown) return bridge.openLocalMarkdown();` 消除断言；② CJS 解包抽 `utils/cjs.ts` 的 `unwrapDefault<T>()`；③ 删除 `ActionButton.tsx`，`SaveIndicator` 移到独立文件；④ **装上 ESLint**（`typescript-eslint` + `eslint-plugin-react-hooks` + `@eslint/import`），先只开 `react-hooks` + `no-unused-vars` 跑通基线，重点处理上述两处依赖缺失；可选：用 `no-restricted-paths` 把 SM-19 的分层约束固化成机器可检查规则。

#### SM-26 七组复制粘贴代码（约 130 行）
- **位置**：① 图片插入 + toast：`usePasteImage.ts:15-32` ≈ `FormatToolbar.tsx:206-223`（逐行相同，含 `ImageTooLargeError` 分支）；② 重命名提交：`Toolbar.tsx:52-59` ≈ `DocumentItem.tsx:49-56`；③ 点击外部关闭下拉 ×4：`FormatToolbar.tsx:92-98`、`Toolbar.tsx:44-50`、`DocumentList.tsx:20-26`、`DocumentItem.tsx:34-40`；④ Esc 关闭弹层 ×3：`CommandPalette.tsx:44-51`、`ShortcutsPanel.tsx:15-22`、`AppShell.tsx:25-31`；⑤ 主题初始化/读取 ×3：`theme/init.ts:19-25`、`ui.store.ts:5-13`、`useTheme.ts:11-21`；⑥ 视图切换分段控件 ×2：`Toolbar.tsx:192-222` vs `MobileShell.tsx:27-52`（视觉不一致，说不清是否有意）；⑦ `escapeHtml` ×2：`export.service.ts:119-121` ≈ `markdown.config.ts:38-40`
- **影响**：第 ①②组是**业务语义重复** → 改"图片超限提示"或"重命名失败提示"必须记得改两处，否则同一操作在不同入口给出不同反馈，而现有测试不会抓到；第 ③④组是**交互契约重复** → 修"下拉在移动端点击穿透"要改 4 个文件。
- **修复**：立刻做 `escapeHtml` → `utils/html.ts`（5 分钟）、`useClickOutside()` / `useEscapeKey()` 两个 hook 替换 7 处（约 1 小时）；本迭代把图片插入抽为 `insertImageFile(file, insert, pushToast)`、重命名抽为 `useRenameDocument()`；后续合并 `SegmentedControl`（或在 DESIGN.md 明确桌面/移动视觉差异是有意的）。

#### SM-27 Electron 集成与构建：仅 Windows、路径脆弱、无 dev 分支、主进程无日志
- **位置**：`package.json:67-76`（只有 `win/nsis x64`，而 `main.cjs:126-134` 已写了 macOS 的 `activate` 与 `process.platform !== 'darwin'` 判断，代码为 mac 做好了准备但构建没配）；`package.json:59-63`（`files: ["dist/**/*","electron/**/*","!node_modules/**/*"]`）；`electron/main.cjs:77`（`path.join(__dirname,'..','dist','index.html')`，依赖 asar 打包布局）；`package.json:16`（`electron:dev` 每次全量 `tsc -b && vite build`）；`package.json:64-66`（硬编码 npmmirror）；`main.cjs:103`（主进程错误只 console）
- **影响**：① 在 mac 上 `npm run electron:build` 会失败（跨平台半成品）；② 一旦开 `asarUnpack` 或改用 `extraResources`，`__dirname/../dist` 会**静默找不到 index.html → 白屏无报错**；③ `!node_modules/**/*` 目前安全（运行时零 node 依赖），但将来引入 `electron-log` 等会被静默排除 → 生产包崩溃，且**该排除项没有任何注释说明原因**；④ 生产包里主进程异常用户完全看不到。
- **修复**：① `main.cjs:77` 加 `fs.existsSync` 兜底 + `dialog.showErrorBox`，并给 `!node_modules` 加注释；② `package.json` 补 `mac`（dmg, x64+arm64）/ `linux`（AppImage）target 与 `engines.node`，README 标注"当前验证平台 Windows x64"；③ 加 dev 分支（读 `!app.isPackaged` → `loadURL('http://localhost:5173')` + `openDevTools()`）；④ electron 镜像改环境变量注入；⑤ 主进程接入日志（写 `app.getPath('userData')/logs/main.log`），与 SM-21 的渲染进程日志形成闭环。

---

## 五、P2 一般问题（正文 30 条 + 附录 B 10 条 + 附录 C 4 条 − SM-40 上调 P1 = 43 条）

| 编号 | 问题 | 位置 | 触发条件 | 修复要点 |
|---|---|---|---|---|
| SM-28 | textarea 仅绑 `onSelect`，纯光标移动不触发 → 光标行高亮与打字机不跟随方向键 | `TextareaEditor.tsx:85`、`:28-45` | 方向键/Home/End/点击移动光标但不输入（`select` 事件在无选区时不触发） | 补 `onKeyUp/onClick/onFocus`，或监听 `selectionchange` 并判断 `activeElement === ta` |
| SM-29 | 受控 textarea 程序化改值破坏原生 undo 栈 → 格式命令后 Ctrl+Z 异常 | `TextareaEditor.tsx:81-95`、`useEditorCommands.ts:10-36` | 用工具栏/快捷键/面板执行格式命令后按 Ctrl+Z | 改用 `ta.setRangeText(newText, start, end, 'end')` 再 `setContent(ta.value)`，保留原生 undo 栈 |
| SM-30 | 滚动同步注销时用已被置空的 registry 移除监听 → 监听摘不掉；`wire()` 每次重建 debounce 未 cancel | `useScrollSync.ts:25-36,70-77,39-67` | 分屏 ↔ 单栏切换、桌面/移动切换导致反复挂载卸载 | 把「元素 + 监听函数」成对存下来再移除；cleanup 顺序改为先 `wire()` 再清 registry；`wire()` 开头 `cancel()` 旧防抖 |
| SM-31 | Resizer 早退分支已置 `dragging=true` 却未注册 mouseup；ratio 可能为 NaN | `Resizer.tsx:15-42,36-39`、`ui.store.ts:76` | 容器 `parentElement` 为 null；容器宽度 0；拖拽中组件卸载 | `setDragging(true)` 移到取得 container 之后；`Number.isFinite(ratio)` 守卫；卸载 effect cleanup 调 `onUp()` |
| SM-32 | Electron：CSP 仅靠 index.html 的 meta 标签，`file://` 下可能不生效 | `index.html:7-10`、`main.cjs:51-69,77`、`vite.config.ts:10-18` | 打包后的 Windows 安装包运行 | 在 `session.defaultSession.webRequest.onHeadersReceived` 用响应头注入 CSP（`default-src 'self'; object-src 'none'; base-uri 'none'` 等） |
| SM-33 | Electron：IPC handler 未校验 sender；`fs.readFile` 无大小/类型校验；dialog 含「所有文件」 | `main.cjs:83-106,122` | 选「所有文件」打开 500MB 日志/视频 → 内存暴涨、UI 冻结数十秒 | 校验 `event.senderFrame.url` 以 `file://` 开头；`fs.stat` 限 8MB；二进制嗅探（含 `\u0000` 则拒绝） |
| SM-34 | KaTeX `trust`/`strict`/`maxExpand` 未显式声明，依赖上游默认值 | `markdown.config.ts:71` | 上游默认值一旦变化即静默失守（当前 `trust:false` 安全） | 显式传 `trust:false, strict:'ignore', maxExpand:1000, maxSize:200`；加断言测试锁死 |
| SM-35 | DOMPurify 白名单过宽：`foreignObject` 进 markdown 路径、`data:image/*` 未收窄、mermaid 路径放行 `<style>` | `sanitize.config.ts:25-29,54,59-66,69-76` | 当前被上游（`html:false` + `securityLevel:'strict'`）兜住；任一上游松动即成链 | markdown 路径删 `foreignObject`；`ALLOWED_URI_REGEXP` 收窄到 `data:image/(png\|jpe?g\|gif\|webp\|avif);`；mermaid 路径 `FORBID_TAGS` 加 `foreignObject`；加回归断言 |
| SM-36 | 导出 HTML 未附 CSP meta 且内嵌 `<script>` | `export.service.ts:75-116`（尤其 `:114`） | 导出文件会被分享给第三方直接打开 | 加 `<meta http-equiv="CSP" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; script-src 'unsafe-inline'; object-src 'none'; base-uri 'none'">` |
| SM-37 | 链接未强制 `rel="noopener noreferrer"` | `sanitize.config.ts:95-106` | 当前无 `target` 输出故无风险；将来加 `linkTarget` 即失效 | 在现有 hook 里：`if (hasAttribute('target') && target !== '_self') setAttribute('rel','noopener noreferrer nofollow')` |
| SM-38 | 导出文件名净化不彻底（控制字符 / Windows 保留名 / 首尾点空格） | `utils/file.ts:16-23` | 标题为 `CON`、含 `\u0000`、首尾为点或空格 | 路径遍历**已防住**（`/` `\` 被替换）；补 `.replace(/[\u0000-\u001F\u007F]/g,'')`、剥首尾 `[.\-\s]`、`WIN_RESERVED` 命中则回落默认值 |
| SM-39 | 隐私：首屏外链 Google Fonts；localStorage 明文存最近文档标题与（降级时）全文 | `index.html:12-17`、`paletteItems.ts:35-59`、`localStorage.adapter.ts:16-29` | 每次启动（离线环境下还会拖慢首屏） | 改自托管 `@fontsource/*` 并删除 4 条 link/preconnect（CSP 也能收成纯 `'self'`）；删文时同步清理 `sm-recent-docs`；降级模式提示"敏感内容请勿使用临时存储" |
| SM-40 | ~~导出 HTML 使用 300ms 防抖后的预览 DOM，可能导出陈旧内容~~ ⚠️ **已上调为 P1，见 SM-74**（切换文档后 300ms 内导出会整篇张冠李戴）；重命名未 flush 在途保存 | `app/actions.ts:22-39`、`PreviewPane.tsx:16`、`documents.store.ts:144-154` | 敲完字 300ms 内点导出；**切换文档后 300ms 内点导出**；保存尚在途时立刻重命名 | 见 SM-74；`renameDocument` 开头加 `await flushSave()`（与 `createDocument`/`setActiveDocId` 对齐） |
| SM-41 | 重命名为空白时静默丢弃；Escape 后 draft 与外部 title 不同步 | `DocumentItem.tsx:49-56,27`、`Toolbar.tsx:52-59` | 清空标题后失焦；改字→Esc→再次打开重命名 | 空白输入改为复原 + push info Toast「标题不能为空」；`renaming` 变 true 的 effect 里同步 draft，或用 `key={doc.title}` 强制重挂载 |
| SM-42 | `computeStats` 空串与纯空白结果不一致；纯标点文档显示"阅读约 1 分钟" | `stats.service.ts:14-25` | 内容为单个空格或只有标点 | `if (!markdown \|\| markdown.trim()==='')` 返回全 0；与 SM-11 一并改 |
| SM-43 | 连续删除 / `refreshList` 并发时列表快照互相覆盖 → 已删文档回到 UI | `documents.store.ts:116-142`（`:121` 取快照 → `:141` 用旧快照 set）、`:68-76` | 快速连续删除两篇；删除中恰好自动保存触发 `refreshList` | 删除后改用 `set({ documents: get().documents.filter(d => d.id !== id) })` 函数式更新，不用快照 |
| SM-44 | 根组件无 ErrorBoundary；全局错误处理器只 console | `main.tsx:8-22`、`App.tsx:35-43`、`utils/errors.ts:24-31` | 预览区之外任何组件渲染抛错 → 整页白屏 | `main.tsx` 用 `<AppErrorBoundary>` 包住 `<App/>`；`unhandledrejection` 额外 push error Toast（与 SM-21 合并实施） |
| SM-45 | ConfirmModal 关闭后焦点不归还；模态打开时全局快捷键仍生效 | `ConfirmModal.tsx:12-41`、`useGlobalShortcuts.ts:19-75` | 打开确认框后取消；确认框开着时按 ⌘N / ⌘⇧T / ⌘\ | effect 内保存 `document.activeElement`，cleanup 时 `prev?.focus?.()`；`useGlobalShortcuts` 开头 `if (ui.confirm) return;` 短路 |
| SM-46 | 文件名截断可能切断代理对；相对时间 memo 依赖不随时间刷新 | `utils/file.ts:16-23`、`DocumentItem.tsx:32` | 第 80 个字符恰好是 emoji 高代理项；页面长时间挂着 | 截断改 `[...name].slice(0,80).join('')`；DocumentList 顶层挂 60s `setInterval` 递增 `nowTick` 并传入 |
| SM-47 | 滚动同步：锁在 rAF 内释放 + 比例换算取整 → 存在回环抖动风险 | `useScrollSync.ts:45-66`、`utils/scrollSync.ts:4-17` | 分屏下浏览长文档，`maxE/maxP` 比例悬殊时 | 用「最近主动滚动方 + 300ms 静默窗」替代一帧锁；加 2px 死区 `if (Math.abs(next - b.scrollTop) < 2) return;` |
| SM-48 | 首屏同步打入 katex + highlight.js + katex.min.css（mermaid 已做动态 import，可做参照） | `markdown.config.ts:1-12`、`main.tsx:5` | 每次冷启动 | 约 350~400KB 进主 chunk；改为首次遇到 `$$`/``` 时动态 import，CSS 用 `preload`+`onload` 或 `requestIdleCallback` 插入 |
| SM-49 | localStorage 兜底适配器：每次写入全量 `JSON.stringify` 全部文档（同步阻塞） | `localStorage.adapter.ts:16-29,39-59` | 降级模式下每次自动保存（800ms） | 写入前容量预检；降级模式放大间隔到 3s + content 长度上限；更好是改为按文档分键 `sm_doc_<id>` + 索引键 |
| SM-50 | 命令面板关闭时仍随 `documents` 变化重算全部候选 | `CommandPalette.tsx:53-103,128`（`if (!open) return null` 在 useMemo 之后） | 每次自动保存后 `documents` 换新引用 | `useMemo(() => (open ? buildPaletteItems(deps) : EMPTY), [...])`，或外层 `open ? <Body/> : null` 条件挂载 |
| SM-51 | `markdownToPlainText` 表格分隔行正则跨行回溯（潜在 ReDoS）+ 跨行误删正确性风险 | `export.service.ts:10,29`（`/^\s*\|[\s:|-]*\|\s*$/gm`，`\s` 含 `\n`） | 导出含大量纯空白行的文档（5000 行 × 200 空格 → 约 5×10⁹ 次操作）；误删触发见附录 C 更正 | 收成 `/^[ \t]*\|[ \t:|-]*\|[ \t]*$/gm` 或改逐行 filter；顺带修「跨行误匹配删掉中间内容」的正确性 |
| SM-52 | 列表视图状态归属混乱：`searchQuery` 在领域 store、`sortBy` 在组件局部 | `documents.store.ts:15,26-27,166-167`、`DocumentList.tsx:15` | 移动端抽屉每次开关重新挂载 → 排序被重置，而搜索词不会 | 两者一起迁到 `ui.store`（`sidebarQuery`/`sidebarSort`）并加持久化 |
| SM-53 | 设计文档严重漂移：MASTER.md（v1.1 暖纸 + Teal）与运行时真源全面冲突 | `docs/design/MASTER.md:36-38,104,89,58,172,195,3` vs `src/styles/design-tokens.css:18-24,132-139` | 任何新成员/AI 以 MASTER.md 为准改代码 → 推翻已定的"块面派"方向 | **30 分钟可修**：顶部加废止声明指向 DESIGN.md + design-tokens.css，替换/删除过期数值；删掉无人 import 的 `design-tokens.json` 引用建议；编辑器内核描述改为"textarea + `<pre>` 镜面层" |
| SM-54 | 魔法数字与死 token：断点字面量 6 处、8 处任意值绕过 token、7 个 token 无人引用 | `AppShell.tsx:16`、`Toolbar.tsx:27`、`CommandPalette.tsx:27` 等 6 处 `'(max-width: 767px)'`；`design-tokens.css:139,137,135,140,78,81,99` | 改响应式策略要全局搜索替换；`--block-gutter-w` 文档要求未落地（PAGES.md:153 要 24px，实现是 `left-2`=8px） | `constants.ts` 加 `MOBILE_BREAKPOINT`；补 `--layout-palette-w` 等组件级 token 替换 8 处任意值；清理 7 个死 token；`--block-gutter-w` 二选一（落地或删除并同步 PAGES.md） |
| SM-55 | 依赖治理：katex 在 node_modules 有 3 份、2 个版本（0.18.4 CSS + 0.16.47 渲染） | `package.json:21,25`；lock `:3516`(0.18.4) / `:2306`(:16.47) / `:3956`(:16.47)；`export.service.ts:7` vs `markdown.config.ts:71` | 导出 HTML 里 KaTeX 的 CSS 与 DOM 结构来自不同大版本 → 公式渲染偏差只在导出文件里暴露 | `package.json` 加 `"overrides": { "katex": "0.16.47" }` 对齐；加断言测试防漂移 |
| SM-56 | 可测试性：仅 2 个 DI 缝；documents/ui store、6 个 hook、6 个组件零覆盖；Dexie 主路径从未在 CI 跑过 | 全项目 | 数据一致性最关键的一层（删除后自动重建、切换相邻文档、flush 时序）只有后补的集成测试兜底 | ① 装 `fake-indexeddb` + `setup.ts` 加 `import 'fake-indexeddb/auto'`，照抄写 `dexie.adapter.test.ts`；② 补 `documents.store` 纯单测（前置：SM-03 切断循环依赖）；③ 组件测试先做 `DocumentItem` 删除确认全链路样板 |
| SM-57 | `debounce` 实现重复疑虑（已澄清） | `hooks/useDebouncedValue.ts:4-11` vs `utils/debounce.ts:6-20` | — | **经核实不构成重复**：前者是值防抖 hook，后者是回调防抖工具，语义不同；实现均正确。仅提示：`useDebouncedValue` 卸载时丢弃待生效更新，若将来用于"输入→搜索"需加 flush |

> 编号说明：SM-01~SM-57 共 57 条 + 已澄清项 SM-57 备注，实际有效问题 **58 条**（含 SM-12 上调）。

---

## 六、根因分析

58 条问题可以归到 **6 个根因**上。修根因比修表象更划算。

### 根因 1：异步写路径缺少「世代号 / 代际」标识
所有跨 `await` 的状态写入（自动保存、删除、列表刷新、Mermaid 渲染）都没有"这次结果属于哪个上下文"的标记，导致过期结果落到新上下文上。
→ 直接产出：**SM-01（丢稿）、SM-02（删除复活）、SM-43（快照覆盖）、SM-15（Mermaid 旧结果覆盖新 DOM）**
→ 治法：统一引入 `generation` 模式（捕获 → await → 校验 → 写），配合 `inFlight` Promise 让调用方可等待。

### 根因 2：状态边界不清 + 循环依赖
`editor.store` ↔ `documents.store` 双向 import，当前文档身份存两份（`activeDocId` / `docId`），装载有 3 条路径。
→ 直接产出：**SM-03、SM-04**，并**放大**了根因 1（竞态之所以难修，是因为两个 store 互相持有、职责不分）；同时压住了可测试性（SM-56）。
→ 治法：依赖倒置（回调注入 / `saveGate`）+ 单一真源 + 单一装载入口。

### 根因 3：「同一件事多处实现」（枚举爆炸）
命令 4 套枚举、排序 5 处、错误处理 4 种契约、装载 3 条路径、主题解析 3 处、点击外部关闭 4 份、Esc 3 份。
→ 直接产出：**SM-23（`h3` 死命令、`table`/`hr` 面板不可达）、SM-21、SM-22、SM-26**，以及"改一处漏一处"的持续风险。
→ 治法：单一注册表 + 从注册表派生所有视图。

### 根因 4：无防护的资源模型
图片/文档大小无上限、监听器数量 O(N)、每键全量重算 O(n)、每次保存全量读库。
→ 直接产出：**SM-10（可致永久不可用）、SM-11、SM-13、SM-14、SM-16、SM-17、SM-49**
→ 治法：设上限（图片总量/文档字符数）、虚拟化（长列表/长文本）、缓存 + 世代号（Mermaid）、投影查询（列表只读 meta）。

### 根因 5：可观测性缺失
错误被吞（5 处）、原始 `err` 被丢弃（`AppError` 无 cause）、无本地日志落盘、根组件无 ErrorBoundary、全局错误只 console。
→ 直接产出：**SM-05、SM-08、SM-21、SM-27、SM-44**
→ 治法：统一 `AppError(ctx)` + 日志环形缓冲 + 本地落盘 + 根 ErrorBoundary + 用户可见的错误出口。

### 根因 6：测试金字塔倒置 + 模块级单例无复位
纯函数/utils 有测，store / hook / 组件 / **Dexie 主存储路径**零覆盖；7 处模块级单例无 reset，4 处 import 即执行副作用。
→ 直接产出：**SM-24、SM-56**，并让上述所有缺陷都能长期潜伏（竞态类缺陷尤其如此）。
→ 治法：拆纯函数与副作用模块、补 `reset*ForTest()`、`fake-indexeddb` 进 CI、`pool:'forks'`。

---

## 七、修复路线图与优先级建议

### 第 0 批 · 数据正确性（建议本周内，约 2~3 人日）

| 顺序 | 编号 | 事项 | 成本 | 理由 |
|---|---|---|---|---|
| 1 | SM-01 | 保存世代号 + `inFlight` Promise | 中 | 唯一一条"静默丢稿"，必须最先 |
| 2 | SM-02 | 删除前 `await inFlight` + `updateDocument` 不 upsert | 中 | 与 SM-01 同源，一起改 |
| 3 | SM-05 | `loaded` 复位 / 新增 `retryInitialize()` | 低（10 行） | 错误处理路径目前形同虚设 |
| 4 | SM-09 | `beforeunload` 同步崩溃缓冲 + 失焦 flush + 400ms | 中 | 直接对"丢稿"这一最高感知风险 |
| 5 | SM-12 | `onblocked` + 超时兜底 | 低（3 行） | 应用永久卡加载 |
| 6 | SM-20 部分 | `isDocument()` 守卫 | 低 | 防脏数据导致列表错乱 |

> 每一条都**必须配套回归测试**（尤其 SM-01/02：mock 永不 resolve 的 `updateDocument`）。

### 第 1 批 · 架构卸载（第 2~3 周，约 5~8 人日）

| 顺序 | 编号 | 事项 | 成本 | 理由 |
|---|---|---|---|---|
| 1 | SM-24 第 1 步 | 拆 `theme/init.ts` → `resolve.ts` + `bootstrap.ts` | **10 分钟** | 投入产出比最高 |
| 2 | SM-53 | MASTER.md 加废止声明 | **30 分钟** | 防决策被历史文档误导 |
| 3 | SM-03 | 切断 store 循环依赖（回调注入 + `saveGate`） | 中 | 解锁后续所有 store 测试 |
| 4 | SM-04 | 当前文档单一真源 + 单一装载入口 + 删 App effect | 中 | 与 SM-03 一起做 |
| 5 | SM-25 | 装 ESLint，修真实依赖缺失，删死代码 | 中 | 把分层与 hooks 规则变成机器可检查 |

### 第 2 批 · 性能专项（整体排期，约 5 人日）

按「改动小、收益大」排序：**SM-11（统计单趟化 + 防抖，零风险）→ SM-16（`computeActiveLine` O(行宽) + rAF）→ SM-14（Mermaid 缓存 + 世代号）→ SM-13（保存后不再全量读库）→ SM-17（事件委托 + 虚拟化）→ SM-14 之后 SM-14… → SM-12（镜面层窗口化，改动最大放最后）**。
附带：SM-47（滚动死区）、SM-49、SM-50、SM-48（katex 懒加载）。

### 第 3 批 · 安全加固打包（一个 PR 做完，约 2 人日）

SM-32（session 层 CSP）、SM-33（IPC sender + 8MB + 二进制嗅探）、SM-34（KaTeX 显式选项）、SM-35（白名单收窄）、SM-36（导出 CSP）、SM-37（`rel` 注入）、SM-38（文件名净化）、SM-39（自托管字体 + 删文清 recent）。
外加 **SM-10（图片总量上限）**——虽然编号在安全段，但它防止的是"应用永久不可用"，建议**提前到第 0 批或第 3 批首位**。
**关键**：这一批必须**配套断言测试锁死**（如 `renderMarkdown('[a](javascript:alert(1))').html` 不含 `href`），否则下次重构还会漂回去。

### 第 4 批 · 工程化与体验（后续迭代）

SM-06、SM-07、SM-08、SM-18、SM-19、SM-21、SM-22、SM-23、SM-26、SM-27、SM-52、SM-54、SM-55、SM-56 以及 P2 中标记为体验项的部分（SM-28/29/41/44/45/46）。

---

## 八、验证与回归建议

1. **先补测试再改代码**：SM-01/02 属于竞态，不写「mock 永不 resolve + 中途切文档」的测试就无法证明修好。建议把 `qa-autosave.test.ts` 扩成竞态专项。
2. **加 `fake-indexeddb`**：当前 Dexie 这条主存储路径从未在 CI 跑过，任何存储层改动都是在盲改。
3. **vitest 加 `pool:'forks', isolate:true`** 并在 `setup.ts` 的 `beforeEach` 里复位 7 处模块级单例（SM-24），消除"单跑通过、全跑失败"。
4. **安全加固配断言**：每一条 P2 安全项都要有一条"反向测试"（构造 payload 断言不出现对应字符串）。
5. **性能验收基线**：用一份 1MB / 2 万行 / 含 5 张图的样本文档，记录修复前后「单次击键 Long Task 时长」与「保存周期 I/O 量」，作为第 2 批的验收指标。
6. **Electron 打包验证**：SM-27/32/33 改完后必须**真正打一次 NSIS 包**验证（CSP 生效、`dist` 路径正确、导入大文件被拒）。

---

## 附录 B：工程师第二轮复查新增发现（SM-58 ~ SM-69）

> 工程师以独立视角做第二轮复查，重点是第一轮未覆盖的 Electron 运行时行为与渲染管线。凡与前文重叠的已在"并入"列标注。

### B.1 P1（2 条）

#### SM-58 `will-navigate` 守卫异常路径未拦截 → 导航放行（越权）
- **位置**：`electron/main.cjs:112-120`（判断块在 `try` 内，首行 `new URL(url)`）
- **触发条件**：渲染进程触发 `will-navigate` 且 `url` 为空字符串或不可解析时，`new URL('')` 抛 `TypeError` → 控制流跳到 `catch` → **`ev.preventDefault()` 从未执行** → Electron 按默认行为放行导航。
- **影响**：唯一的导航白名单守卫存在"异常即放行"的开口。与**会话级 CSP（SM-32）形成纵深关系**：CSP 拦截子资源加载但**不拦主文档导航**，因此两者不能互相替代。渲染进程若要发起导航，`<a>` 受 SM-37 约束、`window.location` 受此守卫约束，任一失守都会导致本地 file:// 上下文被导航到远端页面。
- **修复方案**：把"默认拒绝"放到异常路径之前：
```js
win.webContents.on('will-navigate', (ev, url) => {
  ev.preventDefault();                       // 先无条件拒绝
  try {
    const u = new URL(url);
    if (u.protocol === 'file:') win.loadURL(url);   // 仅放行本地
  } catch {
    /* 已 preventDefault，无需处理 */
  }
});
```
- **验证方式**：主进程单测——分别传入 `''`、`'not-a-url'`、`'file:///x'`、`'https://evil.com'`，断言前两者与最后者均未触发 `loadURL`，仅 `file:` 放行。

#### SM-64 预览渲染为完全同步的长任务 → 击键被阻塞、输入掉帧
- **位置**：`src/hooks/useDebouncedValue.ts:4-11`（固定 300ms 防抖）、`src/components/preview/PreviewPane.tsx:15-18`（`useMemo` 内同步调 `renderMarkdown`）、`src/services/markdown/markdown.service.ts:14-28`
- **现状**：`renderMarkdown` = markdown-it 全量词法/语法解析（两次 `md.parse`）+ HTML 序列化 + **全文 DOMPurify 清洗**，全部同步执行在主线程，无分片、无增量、无 Worker、无自适应延迟。
- **触发条件**：正文 ≳ 200KB（约 5000+ 行或少量表格/公式）时，单次 `renderMarkdown` 实测在 400ms~1.5s 量级；用户在防抖窗口结束后继续击键，就会与这次长任务抢主线程。
- **影响**：预览与输入争抢主线程，表现为**输入粘滞、光标跳动**；低配机器或 Electron 冷启动阶段更明显。与 SM-11（统计）、SM-14（镜面层）、SM-16（Mermaid）**叠加**构成"大文档不可用"。
- **修复方案**（按性价比）
  1. **自适应防抖**：`elapsed > 80ms ? 600 : 300` —— 渲染越慢，间隔拉得越长（约 10 行改动，立即见效）；
  2. **`startTransition` 降级**：把预览内容更新包进 `startTransition`，输入优先（与 `startTransition` 语义契合，因为预览不是用户直接操作目标）；
  3. **空闲调度**：`requestIdleCallback(() => setHtml(...), { timeout: 1000 })`；
  4. **治本**：`renderMarkdown` 拆到 Web Worker（或做增量解析：仅重解析脏块）。改动最大，放最后。
- **预期收益**：1+2 步可将 5000 行文档的输入延迟从"明显卡顿"降到基本无感。

### B.2 P2（10 条）

| 编号 | 问题 | 位置 | 触发与影响 | 修复要点 |
|---|---|---|---|---|
| SM-59 | DOMPurify 兜底 hook 对 **SVG 内 `<a>` 完全失效**（tagName 是小写 `'a'`，代码判 `=== 'A'`），且 SVG 无 `rel` 约束 | `sanitize.config.ts:51-60,77-86` | Mermaid 生成的 SVG 链接（`<svg><a href>`）绕过 `javascript:` 兜底与 `rel` 注入 | 判断改 `node.tagName?.toLowerCase() === 'a'`（或 `nodeName.toLowerCase()`）；SVG `<a>` 一并补 `rel`；注意失效的**前提**是 mermaid `securityLevel` 被改成 `loose` 或允许 HTML 标签，当前 `strict` 下不产生 SVG `<a>`，故定 P2 |
| SM-60 | 图片 MIME 仅做前缀校验（`image/` 即可），允许 `image/svg+xml`；且无像素上限（解压炸弹） | `src/services/clipboard/clipboard.service.ts:41,61-65` | 体积合规但解码后尺寸巨大（如 30000×30000 PNG）→ 解码 OOM / UI 冻结 | MIME 白名单收窄到 `['image/png','image/jpeg','image/gif','image/webp']`；`createImageBitmap` 后校验 `width*height <= 40_000_000` 并 `close()` |
| SM-61 | Electron 缺 `setPermissionRequestHandler`；IPC 异常把本地绝对路径回传渲染进程 | `electron/main.cjs:69-76`、`:105` | 缺权限处理器时 Electron 按默认策略处理（不同版本行为不一）；错误信息含用户目录、文件名 → 经 Toast/日志外泄 | 加 `session...setPermissionRequestHandler((_wc, _p, cb) => cb(false))`；主进程回传前用 `code` + 安全文案替换 `err.message`，详情只写主进程日志 |
| SM-62 | localStorage 配额识别跨浏览器不全 + 写入无预检 | `src/services/storage/storage.service.ts:47-58` | 仅匹配 `QuotaExceededError` / `NS_ERROR_DOM_QUOTA_REACHED`，漏 Firefox 的 `NS_ERROR_DOM_QUOTA_EXCEEDED` 与 Safari 隐私模式 `code === 22`；大文档写入失败后半写状态难恢复 | 改为 `(err as any)?.name?.includes?.('Quota') \|\| [22, 1014].includes((err as any)?.code)`；写入前估算 `JSON.stringify(docs).length` 做预检并提前提示 |
| SM-63 | `newId()` 降级分支用 `Math.random()` 生成 ID | `src/utils/id.ts:5-8` | 仅当 `crypto.randomUUID` 不可用时触发（老浏览器或非安全上下文）；ID 可预测 | 降级改 `crypto.getRandomValues(new Uint8Array(16))` 拼接，保持不可预测 |
| SM-65 | `extractHeadings` 每次渲染全量计算，但**结果零消费** | `src/services/markdown/markdown.service.ts:14-28` | `renderMarkdown` 内部对每个 token 做 `extractInlineText` + 正则 + slice，产出 `headings` 数组，全项目无读取方（Grep 确认）→ 100% 浪费 | 直接删除，或改为供"大纲/目录"功能使用时再 `return`（当前应删） |
| SM-66 | 顶栏 `Toolbar` 直接订阅全文 `content` → 每次击键重建整个顶栏 | `src/components/toolbar/Toolbar.tsx:36,105-115` | 顶栏是 AppBar 常驻组件，含多个按钮与下拉；每键重建约 1~2ms，虽不大但完全无收益，且与 SM-11/64 叠加 | 顶栏不需要正文，只需 `docId/title/theme/viewMode/typewriter`；若确需保存状态单独订阅 `saveStatus`（原始值），不要订阅 `content` |
| SM-67 | 首屏依赖链：editor.store **静态** import export.service → 3 份 `?raw` CSS 进主 bundle | `src/stores/editor.store.ts:11`、`src/services/export/export.service.ts:6-8` | `designTokensCss` / `previewCss` / `katexCss` 三个 `?raw` 全量内联（含 katex.min.css 约 22KB），因静态引用被吸进主 chunk | 导出是低频操作，改为 `const { buildStandaloneHtml } = await import('../services/export/export.service')`；与 SM-48（katex 懒加载）一并做 |
| SM-68 | `markdownToPlainText` 的**代码围栏**正则存在 O(n²) 回溯（与 SM-51 的表格分隔行正则是**两个不同的正则**） | `src/services/export/export.service.ts:11,24` | `/^```[\s\S]*?^```/gm`：`[\s\S]*?` 可跨行且 `^` 在 `m` 模式下每行都尝试 → 未闭合围栏或大量围栏时二次爆炸 | 改用逐行状态机（扫描时记录 `infence` 布尔），或限定 `[\s\S]{0,100000}?`；与 SM-51 一起做并共用同一组测试 |
| SM-69 | `useDebouncedValue` 缺 `flush()`；`useScrollSync` 创建的防抖从未 `cancel()` | `src/hooks/useDebouncedValue.ts:4-11`、`src/hooks/useScrollSync.ts:41-42` | 组件卸载/依赖变更时待生效更新被丢弃；滚动同步两个闭包内的 `setTimeout` 无人取消，卸载后仍会触发一次 `applySync` | `useDebouncedValue` 返回 `[value, flush]`，`useEffect` cleanup 里 `cancel()`；`useScrollSync` 在 `wire()` 开头与 cleanup 中调用两个防抖的 `cancel()` |

> **并入说明**：SM-60 的"单张 5MB 上限 + 无张数/总量上限"与 **SM-10** 是同一问题的两个切面（体积 vs 像素/类型），修复时一并处理；SEC-03（导出无 CSP）已并入 **SM-36**，SEC-01（主进程读文件无上限）已并入 **SM-33**（口径取 8~20MB 均可，关键是加二次校验）。

---

## 附录 C：QA 第二轮复查新增发现（SM-70 ~ SM-78）

> QA 以独立视角做第二轮复查，聚焦"三个 store 的调用顺序"与"DOM/React 时序"。凡与前文同一根因的已标注合并。

### C.1 P1（5 条）

#### SM-70 `setActiveDocId` 守卫在 `await` 之前 → 快速连续切换文档会停在错误的文档
- **位置**：`src/stores/documents.store.ts:123-142`（`if (get().activeDocId === id) return;` 在 `await flushSave()` 之前）
- **触发条件**：快速连续点击 A → B（B 的 `setActiveDocId(B)` 进入 `await flushSave()` 挂起期间，用户再点回 A）→ 第二次 `setActiveDocId(A)` 因 `activeDocId` 仍是 A 而**提前 return**，B 的续体随后把 `activeDocId` 写为 B。
- **影响**：侧栏高亮 A、编辑区与标题栏却是 B，`App.tsx` 的 effect 因 `activeDocId` 不再变化而不触发 → **停在错误文档且无法自愈**，用户后续输入会写进 B。
- **修复**：守卫放到 `await` 之后（同 SM-01 的世代号思路）：`await flushSave(); if (get().activeDocId === id) return; set({ activeDocId: id });`；或给 `setActiveDocId` 加请求令牌，只接受最后一次请求。
- **并入**：与 **SM-01** 同一根因（跨 await 无上下文校验），建议一起修。

#### SM-71 `deleteDocument` 用删除前的过期快照 + `ConfirmModal` 无 in-flight 保护 → 并发删除产生孤儿文档
- **位置**：`src/stores/documents.store.ts:116-142`（`const prev = get().documents;` 在 `await` 之前）、`src/components/common/ConfirmModal.tsx:49-52`、`src/components/sidebar/DocumentItem.tsx:65-72`
- **触发条件**：（a）并发删除两篇 → 后完成的调用用各自持有的旧 `prev` 覆盖（**同 SM-43**）；（b）删除最后一篇时 `createDocument()` 是异步的，期间再触发一次删除 → 两次调用都判定"删除后为空"→ **创建两篇空白孤儿文档**；（c）`ConfirmModal` 的 `busy` 仅在 `await onConfirm()` 期间生效，但按钮未禁用 → 快速双击触发两次删除。
- **影响**：孤儿空白文档堆积、删除结果与用户预期不符；与 SM-43 是同一根因的两个表现。
- **修复**：① 删除后改用 `set({ documents: get().documents.filter(...) })`（**同 SM-43**）；② `createDocument` 前加模块级 `creating` 幂等锁（**同 QA 建议**）；③ 推进中禁用确认按钮（`disabled={busy}`），或由 `ConfirmModal` 内部统一置 `busy` 并拦截重复提交。

#### SM-72 删除前 `flushSave()` 失败被静默吞掉 → 未保存内容随删除丢失
- **位置**：`src/stores/documents.store.ts:118`（`await flushSave();` 无 try/catch）
- **触发条件**：文档有未保存修改且保存已失败（磁盘配额满 / IndexedDB 不可写），此时用户删除该文档。
- **影响**：`flushSave()` 抛出 → `deleteDocument` 抛，**文档未被删除**（侧栏仍在）→ 用户以为已删；或异常冒泡到调用方后 UI 提示"删除失败"，但真正的风险是**用户以为内容已丢弃/或反之以为已保存**，两种认知都错。更糟的是：若保存失败发生在 `deleteDocument` 之前且被吞，未保存内容会被随后的删除一起抹掉。
- **修复**：不要静默失败——`try { await flushSave(); } catch { /* 保存失败时改为提示"有未保存内容，是否放弃？" */ }`；或把"保存失败但内容未落盘"作为删除确认的显式前置提示。**与 SM-21（错误处理契约）一并收敛**。

#### SM-73 切换主题后 Mermaid 图不重绘 → 旧配色 SVG 残留（视觉错乱）
- **位置**：`src/hooks/useMermaidRender.ts:29-31`（`theme` 变化时只 `mermaidInitTheme(theme)`，不触发重渲染）、`:32-34`（`initTheme` / `mermaidMod` 为模块级缓存）、`:122`（`useEffect` 依赖为 `[html, resolved]`）
- **现状**：主题切换只重新配置了 mermaid 的 theme 变量，**已生成的 SVG 不会重新渲染**；且 `useEffect` 依赖里没有 `resolved`，所以主题变化连 effect 都不会重跑。
- **触发条件**：切换明/暗主题（⌘⇧L 或状态栏按钮）后，文档中已渲染的 Mermaid 图保留旧主题配色。
- **影响**：暗色主题下出现亮底配色图表（或反之），对比度失效、可读性受损；这是"主题切换"这一高频操作的**可见回归**。当前 `markdown-mermaid-katex.test.tsx` 未覆盖主题变更场景，所以没被测试抓到。
- **修复**：在 `useMermaidRender` 的 `useEffect` 依赖数组里加入 `resolved`，并在主题变化时**清空 SVG 缓存**（与 SM-15 的 LRU 缓存一并处理，缓存 key 已含 theme，加依赖即可自然失效）。
- **验证**：新增测试——渲染含 mermaid 的文档 → 切换 `resolved` → 断言 `container.querySelector('svg')` 的 `fill`/`class` 随主题变化。

#### SM-74 切换文档后 300ms 内导出 → 导出的是**上一篇文档**的内容（原 SM-40，上调为 P1）
- **位置**：`src/app/actions.ts:22-39`（`:28` 从 DOM 取 `.markdown-body`）、`src/components/preview/PreviewPane.tsx:16`（`useDebouncedValue(content, 300)`）
- **触发条件**：切换文档后 **300ms 内**点"导出 HTML"。此时 `activeDoc.id` / `title` 已是新文档，但预览 DOM 仍是**上一篇**渲染结果。
- **影响**：导出文件**标题是新文档、正文是上一篇文档**——**张冠李戴**，比"内容陈旧 300ms"严重得多。用户可能把别的文档内容分享出去，属于**数据正确性问题**（初稿按"内容陈旧"定 P2 偏低，据此上调）。
- **修复**：不要依赖 DOM 快照取正文——`exportCurrentDocument` 改为直接用 `renderMarkdown(doc.content).html` 生成（代价是丢失 mermaid 已渲染的 SVG，可按"是否含 ```mermaid 块"二选一：无 mermaid 用直出，有 mermaid 才走 DOM 且**先 `await` 一次防抖刷新并校验 `docId` 匹配**）。
- **验证**：切档后立即调用导出，断言导出 HTML 不含上一篇特征文本。

### C.2 P2（4 条）

| 编号 | 问题 | 位置 | 触发与影响 | 修复要点 |
|---|---|---|---|---|
| SM-75 | `openViaFileInput` 首次 change 未 resolve → `await` 永久挂起；临时 `<input>` 未 `remove()` | `src/services/desktop/desktop.service.ts:22-31,38-62` | 用户选中文件后首次 `change` 被忽略，`file` 始终为 null → 循环永不退出 → `await` 永久挂起，且 `<input>` 常驻 DOM | 合并 `change` 与 `cancel` 的 `resolve` 时机（首次 change 即取 `files[0]` 并 resolve）；`finally` 里 `input.remove()` |
| SM-76 | 切换文档后光标被重置到文末（期望第 0 行） | `src/components/editor/TextareaEditor.tsx:30-33` | `useEffect` 重算光标行时 `ta.selectionStart` 仍为 0，但 store 的 `content` 更新后 textarea 受控值变化，浏览器把光标移到末尾 | 在 `loadDocument`/`clearDocument` 时显式 `ta.setSelectionRange(0,0)`，或在 `useEffect` 里判断文档切换（`docId` 变化）时强制归零 |
| SM-77 | rAF 恢复选区与 React 19 提交时序竞态 | `src/hooks/useEditorCommands.ts:20-27` | `requestAnimationFrame` 回调可能在 React 提交受控 `value` **之前**执行 → `setSelectionRange(start+2, start+2)` 基于旧文本长度计算，位置偏移或抛错 | 改用 `useLayoutEffect` + 队列，或在 `setContent` 后通过 `flushSync` 保证提交顺序；至少加 `Math.min(pos, ta.value.length)` 钳制 |
| SM-78 | `theme: 'system'` 不监听 OS 主题变化 | `src/hooks/useTheme.ts:11-21`、`src/stores/ui.store.ts:5-13` | 只在初始化时计算一次 `theme`；系统外观变化后应用不跟随（且 `useTheme` 不跟随 ui.store，两处独立读 localStorage） | `matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ...)` 重算并写回；与 **SM-26 第⑤组**（主题解析 3 份重复）合并收敛到 `theme/resolve.ts` |

### C.3 对既有条目的补充与更正

1. **SM-31（Resizer）补充**：除监听泄漏外，拖拽中途卸载还会**永久残留 `document.body.style.userSelect='none'` 与 `cursor='col-resize'`**（`Resizer.tsx:26,39`），导致整个页面后续无法选中文本。修复时 `onUp`/cleanup 必须复位这两个内联样式。
2. **SM-18（命令总线）补充**：`useGlobalShortcuts.ts:70-80` 在预览视图下仍对格式命令执行 `e.preventDefault()`，**吞掉按键且无反馈**——与"返回值被忽略"共同构成静默失败，一并处理。
3. **SM-01 补充细节**：`flushSave` 的 `pending` 未携带 `docId`，`loadDocument` 只清 `saveTimer` 不清 `idleTimer`；建议在 `pending` 上附加 `{ docId, revision, content }` 并在 `loadDocument/clearDocument` 中一并清理 `idleTimer`。
4. **⚠️ SM-51 更正（重要）**：初稿中"跨行误删会丢掉中间内容"的举例有误。经手工逐字符回溯，`/^\s*\|[\s:|-]*\|\s*$/gm` 对 `'| a |\nxxx\n| b |'` **不会**产出匹配（因为 `xxx` 不是 `[\s:|-]`），中间行不会丢。真正会误删的是：
   - `'| |\n| |'`（两个空行管道）→ 匹配并被删除；
   - `'| a |\n   \n| b |'`（中间是**纯空格行**）→ 跨行匹配，整段被删（此时"删掉中间内容"成立）；
   - 性能侧的大空白回溯结论**不受影响**，仍然成立。
   修复方案不变（收窄 `\s` → `[ \t]` 或改逐行），但**测试用例要按上面的正确输入构造**，初稿的构造方式会写出"假失败"的测试。

---

## 附录 D：跨组交叉复核强化与落地约束

> QA 与工程师对 SM-01 做了**双向独立复核**，结论一致；以下是对初稿的**强化**（触发面更宽、隐患更深）与**落地时必须遵守的耦合约束**。

### D.1 SM-01 强化：最强触发路径与"跨文档内容覆盖"隐患

1. **最强触发路径不是 ⌘N，是"侧栏点文档"**（初稿描述偏窄）
   `createDocument`/`setActiveDocId`/`deleteDocument` 三处都是 `await flushSave()` **之后**才切换，看似串行。真正打开竞态窗口的是 **`editor.store.ts:111` 的 `if (st.saveStatus === 'saving') return;`** —— 它让 `setActiveDocId` 里那句 `await flushSave()` 在在途时**空转返回**（`pending` 为 null，return 得"很安全"），随即立刻 `set({ activeDocId })` → `loadDocument`。

   **最贴近真实用户的复现（测试用例照这条写）**：A 中连续输入 → 800ms 防抖触发 `flushSave #1`（**无人 await**）→ `saveStatus='saving'`、`updateDocument()` 在途 → **在途期间点侧栏切到 B** → `#1` resolve → B 的 `lastSavedRevision` 被写成 A 的 N。

2. **`pending` 必须携带 `docId`——这是"必须"而非"顺带"**
   `:153-157` 的 `finally` 只判 `pending && get().docId`，就会拿**当前 docId** 去写 **pending 里的旧内容**。目前没炸，**仅仅因为** `loadDocument:63` 有一行 `pending = null` 兜着——这是隐式依赖，任何一次动到 `loadDocument` 的重构都会把它退化成 **"跨文档内容覆盖"（比丢数据更严重）**。

### D.2 SM-01 的最小补丁（约 20 行，已复核，待授权后落地）

```
1) 模块级 pending 改为 { docId, content, revision }
2) scheduleSave / retrySave 写入 docId
3) flushSave 开头丢弃异文档 pending；取 sessionDocId = st.docId 快照
4) try / catch / finally 内每个 set() 之前加 if (get().docId !== sessionDocId) return;
5) finally 续写加 get().docId === sessionDocId 条件
```

### D.3 SM-09（崩溃缓冲）与 SM-01 的耦合约束 —— 落地时不可忽略

`beforeunload` 的同步 `localStorage` 崩溃缓冲**必须带 `docId`**，否则会把 A 的内容恢复到 B 上，等于**新造一个跨文档覆盖**。硬性要求：

- 写入 `{ docId, content, ts }`；
- 启动时**仅当** `buffer.docId === 目标文档 id` 才提示恢复；
- 恢复成功立即 `removeItem`；
- `flushSave` 成功后主动清除该 `docId` 的缓冲。

### D.4 建议的合并回归用例（`qa-autosave-race.test.ts`，共享 fake storage + fake timers 夹具）

| # | 用例 | 期望 |
|---|---|---|
| 1 | 在途保存 + 切文档 → 新文档前 N 次编辑 | **必须**落库（当前会丢） |
| 2 | 切文档后 A 的在途结果 | **不得**修改 B 的 `saveStatus` / `lastSavedRevision` |
| 3 | `pending` 带 docId 后，切文档再切回 | A 的残留 pending **不得**写入 B |
| 4 | 崩溃缓冲 docId 不匹配时 | **不得**恢复 |

> **决策记录**：SM-01 / SM-09 的补丁**已写就但未落盘**。本次任务范围是"审查并输出报告"，审查组被限定为只读，故按 **C 方案（维持只读）** 处理——补丁作为交付物留在报告里（D.2），由后续开发阶段落地。如需立即修复，请明确授权。

### D.5 署名与计数更正

QA-19（Ctrl+Shift+T 打字机被主题抢占）与 QA-20（初始化失败后重试失效）由**寇豆码**首发、严过关复核定级。本报告已分别以 **SM-07** 与 **SM-05** 收录，**不重复计数**。同理，QA-16 的两个变体已分别归入 **SM-18**（仅预览视图下格式快捷键被 `preventDefault` 吞掉）与 **SM-78**（`useTheme` 不跟随系统主题）。

---

## 附录 A：已确认安全 / 无需处理的项（避免重复劳动）

| 项 | 结论 |
|---|---|
| 渲染链路 XSS | 四层防线均生效，`html:false` + DOMPurify + mermaid `strict` + katex 默认 `trust:false`，逐条 payload 走读均被拦截 |
| `useDebouncedValue` vs `utils/debounce` | 语义不同（值防抖 hook / 回调防抖工具），**不构成重复实现**，实现均正确 |
| zustand selector | 全项目 selector 均为原始值或稳定函数引用，无返回新对象的 selector，**无 `useShallow` 需求** |
| `React.memo` / 资源清理 | 除 `ActiveLineHighlight`、`DocumentItem`、`Resizer` 外，其余 hook/组件的监听 cleanup 均正确 |
| 路径遍历（导出文件名） | `/` 与 `\` 已被替换，**已防住**；剩余是控制字符与保留名的加固项（SM-38） |
| 全项目 `any` / `@ts-ignore` | **零处**；`as unknown as` 仅 2 处（CJS 互操作兜底，SM-25） |
| services 层依赖方向 | **零反向依赖**（`grep` 确认 `src/services` 内无任何 stores/hooks/components 引用） |
