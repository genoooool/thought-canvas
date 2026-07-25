# Thought Canvas v1.2.6 自动排布修复报告

日期：2026-07-25

## 1. 结论

本次重构满足任务合同的布局验收标准：同次拆解节点同列竖排，普通后代从实际父节点右侧一列继续，密集及递归分支无矩形重叠，增量新增不移动无关稳定节点，手动标注保持坐标，连续两次完整自动排布的世界坐标完全一致。

最终脱敏包：`thought-canvas-mvp-v1.2.6-layout-fix.zip`

SHA-256：`5650d3375b3f69ae4f9bfcca7431460656a6ccbb76123da2bfd191aecf5e92d8`

## 2. 输入、基线与审计

- 本次没有随任务提供原始项目 ZIP，因此无法计算“原始 ZIP SHA-256”；以 `/Users/geno/Documents/thought-canvas-mvp` 当前工作目录作为明确基线，没有伪造哈希。
- 基线 Git commit：`811ffef1202cbc3c9b52f40ae845b49efec98399`。
- 基线 branch：`main`。
- 基线为 dirty：`app.js`、`i18n.js`、`index.html`、`server.mjs`、`styles.css`、`tests/browser_e2e.py` 与 `docs/ai/{DECISIONS,HANDOFF,TASKS}.md` 已包含此前用户要求的标注、多选移动、自动拆解及初版排布修改；这些工作被完整保留。
- 基线 `npm run check`：退出码 0。
- 基线 `npm run test:node`：退出码 0。
- 基线 `npm run test:browser`：退出码 1，系统 Python 缺少 `playwright` 模块。随后在 `/tmp` 创建隔离测试 venv 并安装 Playwright 1.61.0，未向项目增加依赖；所有最终浏览器测试均使用本机 Google Chrome 运行。
- 旧实现和文档把 `decomposition:*` 解释为横向序列，碰撞时优先尝试后续列，并可能逐节点拆散逻辑子树；浏览器断言也按 x 顺序验证拆解模块。

## 3. 根因

1. 拆解组被当作横向 sequential group，模块数量直接放大画布宽度。
2. 部分后代 x 由根起点和抽象深度推导，父节点被碰撞算法右移后可能出现回折。
3. 增量与全局碰撞优先搜索额外横向列，宽度由碰撞次数而非语义深度决定。
4. 碰撞单元没有稳定包含完整后代子树，可能把同一逻辑分支的父、子、孙节点分别推开。
5. 不同高度节点仅靠局部矩形补丁，无法同时保证紧凑、无重叠和第二次排布不漂移。

## 4. 新布局规则与算法

- 新增纯模块 `layout-engine.js`，核心计算不读取 DOM 或全局 `state`。
- 所有普通父子关系严格满足 `child.x = parent.x + 430`。
- 同一 `decomposition:*` 组共享 x，按 `layoutOrder → sectionOrder → createdAt → id` 竖排。
- 单一子节点与父节点中心 Y 对齐；多个子节点使用首尾直接子节点中心的中点对齐父节点。
- 每棵局部子树维护逐深度上下轮廓；兄弟子树只在真正重合的语义列计算最小下移量，避免深分支把其他模块推到极端位置。
- 主树、孤立树、merge/summary 和 annotation 作为完整子树单元。单元间碰撞通过合并“禁用 dy 区间”选择最近合法纵移；不增加额外列、不逐节点撕开。
- 增量排布固定无关 `layoutStable` 节点，对一次新增的 `parentId + groupId` 及其新后代先做局部布局，再整体纵向避让。
- `annotationManualPosition` 根节点保持用户坐标；其后代从标注实际 x 向右。merge 根位于最右来源节点的下一列，其后代从 merge 实际 x 向右。
- 完整排布结束后执行不变量检查；测试环境发现重叠、回折、列偏移、顺序或中心对齐错误会直接抛出包含节点 ID 的异常。
- 世界尺寸按最终整体 bounds 扩展，不再逐节点独立截断坐标。

## 5. 修改文件

### 核心实现

- `layout-engine.js`：确定性轮廓布局、稳定排序、局部子组布局、整体平移、最近纵向避让、bounds 与不变量验证。
- `app.js`：完整/增量布局接入；删除向右试探额外列和逐节点全局碰撞补丁；修复来源聚焦时序与标注弹窗快速重开竞态。
- `package.json`：版本升级至 1.2.6，新增 `test:layout` 并纳入 `test:node` / `check`。
- `server.mjs`：应用版本升级至 1.2.6。
- `scripts/verify-package.mjs`：把布局引擎及其测试加入发布包必需文件。

### 测试

- `tests/layout-engine-test.mjs`：六类固定 fixture。
- `tests/browser_e2e.py`：世界坐标断言、8 个顶层拆解模块、递归拆解、唯一分支中心对齐、普通父子固定列、零重叠、完整排布幂等、增量稳定、汇总分支和手动标注稳定。
- `tests/local-api-test.mjs`、`tests/codex-*.mjs`：版本一致性更新。

### 文档与版本

- `docs/LAYOUT_SPEC.md`、`docs/ai/DECISIONS.md`、`docs/ai/HANDOFF.md`、`docs/ai/TASKS.md`、`docs/ai/SYSTEM_OVERVIEW.md`、`docs/ai/PLAN.md`。
- `CHANGELOG.md`、`docs/CHANGELOG.md`、README、START_HERE、架构/设计/交互/PRD/Gates/测试/限制文档。
- 此前已在工作树中的标注背景色、多选移动、自动拆解等修改一并保留，没有回滚用户工作。

## 6. 新增回归覆盖

1. 6 个不同高度拆解节点：同列、稳定顺序、最小间距、父中心对齐、无重叠。
2. 4 个拆解模块各带 3 层单链：每层恰好右移一列、中心 Y 对齐、无回折。
3. 7 个顶层模块、多个不均匀分支和 4 项嵌套拆解：轮廓紧凑、宽度只由真实深度决定。
4. 相同输入连续布局：所有 x/y/depth 精确相等。
5. 稳定旧图上增量新增拆解组：旧坐标不变，新单元只沿 Y 避让。
6. merge 与手动 annotation：根锚点和后代方向正确。
7. Chromium 密集工作流：项目世界坐标与真实 DOM 矩形同时验证，覆盖完整产品回归。

## 7. 测试证据

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| `npm run check` | PASS，退出码 0 | 10 个 JavaScript/MJS 入口语法检查，含 `layout-engine.js` |
| `npm run test:layout` | PASS，退出码 0 | 6 组固定布局 fixture |
| `npm run test:node` | PASS，退出码 0 | check、layout、selection、encoding、i18n、capabilities、core、local API、2 个 Codex 套件 |
| `npm run test:browser` | PASS，退出码 0 | 真实 HTML/CSS/JS + Google Chrome 的完整 UI 工作流 |
| `npm test`（工作树第 1 次） | PASS，退出码 0 | browser + 全部 Node 套件 |
| `npm test`（工作树第 2 次） | PASS，退出码 0 | 连续重复完整回归 |
| staging `npm run verify:package` | PASS，退出码 0 | 63 文件，无运行数据、缓存、截图、归档、符号链接或可识别密钥 |
| `unzip -t` | PASS，退出码 0 | `No errors detected in compressed data` |
| clean extract `npm run verify:package` | PASS，退出码 0 | 全新解压目录再次扫描 63 文件 |
| clean extract `npm test` | PASS，退出码 0 | 全新解压目录完整 browser + Node 回归 |

完整日志位于 `/Users/geno/Downloads/thought-canvas-v1.2.6-layout-fix-logs/`：

- `full-test-run-1.log`
- `full-test-run-2.log`
- `package-scan.log`
- `zip-integrity.log`
- `clean-extract-package-scan.log`
- `clean-extract-full-test.log`

## 8. 布局不变量验证

- 拆解同列：纯测试与 Chromium 世界坐标均为严格相等。
- 向右延伸：普通父子 x 差严格为 430px；未发现回折。
- 无重叠：纯引擎不变量、Chromium DOM 两两矩形检查和真实 27 节点项目烟测均为 0 重叠。
- 幂等：浏览器连续点击两次自动排布，全部未归档节点世界坐标完全相同。
- 增量稳定：新增节点前后所有无关稳定节点坐标完全相同；新节点不跳额外列。
- 分支整体：merge、annotation、孤立树和 pending group 均以完整后代单元纵向避让。
- 手动标注：完整自动排布前后 x/y 完全相同。

## 9. 脱敏与未验证事项

最终 ZIP 不包含 `.env.local`、本地设置/运行状态、用户项目、backups、`.git`、`node_modules`、缓存、日志、截图、嵌套归档或系统元数据；示例配置和空数据目录 `.gitkeep` 保留。

未验证事项：本次没有原始 ZIP，无法提供原始 ZIP 哈希；自动化没有调用真实第三方模型 API 或真实 Codex 账号，相关协议由本地集成替身覆盖。布局、保存、导出及 UI 行为没有其他未验证项。

## 10. 最终 Git diff 摘要

本次提交包含纯布局引擎、完整/增量排布接入、布局与浏览器回归、1.2.6 版本同步、项目记忆和发布扫描更新，并保留进入本任务前已有的用户修改。最终 commit hash 在交付回复中给出。
