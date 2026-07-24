# Thought Canvas v12.5 技术架构

## 1. 运行形态

Thought Canvas 是依赖较少的本地网页应用，前端使用原生 HTML/CSS/JavaScript，无构建步骤。

- `server.mjs`：Node HTTP 静态服务、本地文件存储、安全边界、供应商连接、模型代理、版本恢复和导出相关 API；
- `index.html`：首页、工作区、顶部工具栏、侧栏与设置/OAuth/上下文/比较/版本/导出对话框；
- `styles.css`：画布、独立顶部模块、统一弹窗、标注节点、折叠状态、菜单和焦点视觉；
- `app.js`：客户端状态机、画布渲染、选区保留、标注与折叠、上下文构建、模型/思考选择器、流消费、供应商连接和持久化编排；
- `selection-utils.js`：把渲染后的 Markdown 可见选区映射回原始 Markdown，并提供范围不确定时的保守回退；
- `i18n.js`：中/英/日 UI 词典、动态模式、DOM 增量本地化、locale 与模型回答语言指令；
- `text-encoding.js`：识别 UTF-8 被 Windows-1252 误解码的文本，执行保守单次/双次修复与深层对象迁移；
- `thinking-core.js`：目标同意、截止消息、token 指标、推理对象/关系/决策的纯逻辑；
- `providers.js`：供应商预设、协议、认证方式及迁移默认值；
- `provider-capabilities.js`：模型能力规范化、思考等级约束和各协议请求参数映射；
- `codex-app-server.mjs`：受管理的 `codex app-server` JSONL 客户端。

## 2. 状态分层

### 项目持久状态

项目 JSON 保存节点、消息、位置、目标、Compact、不可变上下文快照、生成记录、推理对象、关系、决策、恢复来源、标注类型/来源/手工位置、折叠状态，以及节点/消息级模型与思考等级。

### 全局非敏感设置

供应商配置、已发现模型与能力、连接状态、默认供应商/模型/思考等级、汇总供应商/模型/思考等级、界面语言和画布偏好等写入 `data/settings.local.json`。

### 密钥与 OAuth

- API Key 仅写入 `.env.local`；前端只得到 `hasKey`，不读取明文；
- 新 API Key 在连接验证成功前只存在于单次请求内存中；
- Codex OAuth 凭据由官方 Codex 组件保存和刷新，Thought Canvas 不读取 Token 文件，也不写入项目或设置。生成权限单独通过 `permissionProfile/list` 与 `thread/start.permissions = ":read-only"` 协商。

### 页面运行态

AbortController、当前弹窗、选区快照、拖拽、滚动位置、OAuth 弹窗句柄、授权轮询和搜索索引只存在于当前页面。

## 3. 界面语言架构

`i18n.js` 以简体中文作为稳定源文案，英文和日文作为目标词典。静态文本、动态状态、占位符、ARIA 标签和模式化计数通过同一 `t()`/DOM 本地化层处理。

```text
设置选择语言
→ normalizeUiLanguage
→ setUiLanguage / document.lang
→ MutationObserver 增量翻译新增 UI
→ 保存 uiLanguage 到 data/settings.local.json
→ 新请求附加 responseLanguageInstruction
```

用户内容通过 `data-no-i18n` 与受保护选择器隔离，包括项目标题、消息正文、节点标题、目标建议、标注、推理对象和比较输出。输入框的用户 value 不参与 DOM 文案翻译。界面语言变化不会改写项目 JSON 正文。

## 4. 文本编码诊断与迁移

服务静态文件与 JSON/NDJSON 均显式使用 UTF-8。`text-encoding.js` 只在源文本具有足够的 mojibake 信号、且按 Windows-1252 反向编码后重新以 UTF-8 解码能显著降低信号时接受修复。

```text
历史项目/设置/备份/导入/供应商输出
→ repairUtf8MojibakeDeep
→ 信号改善不足：保持原文
→ 信号改善明确：恢复文本
→ 项目迁移元数据 + encoding-before 原始备份
→ 后续原子保存写回
```

项目迁移字段：

```text
textEncodingRepairVersion
textEncodingRepairedAt
textEncodingRepairCount
```

浏览器和服务端都进行边界修复：服务端负责磁盘及上游边界，浏览器负责兼容旧/同构服务或历史页面响应。浏览器将传输阶段的修复计数以不可枚举 Symbol 传递到项目迁移层，避免修复完成后丢失审计元数据。

## 5. API Key 供应商连接流

```text
用户输入 Key 并点击“连接并同步模型”
→ POST /api/providers/connect（本地运行会话令牌）
→ 校验协议、Base URL、认证头与输入
→ 用请求内存中的候选 Key 请求模型目录
→ 规范化模型、能力、默认思考等级
→ 可选执行最小生成验证
→ 全部成功后才原子写入 .env.local
→ 保存非敏感供应商/模型元数据
→ 前端刷新首页、节点、分支、默认与汇总选择器
```

兼容服务无模型目录时，可在最小生成验证成功后把手工配置模型标记为 `configured_fallback`；失败的候选 Key 不覆盖旧 Key。

## 6. 模型能力与思考等级

每个模型规范化为稳定记录，至少包含：

```text
id / name
reasoningSupported
reasoningEfforts
defaultReasoningEffort
capabilitySource
inputModalities
```

`provider-capabilities.js` 负责：

1. 合并上游声明和兼容字段；
2. 必要时基于协议/供应商/模型名进行保守推断；
3. 将旧的或不支持的用户值限制为模型可用值；
4. 把统一思考等级映射为 OpenAI Responses/Chat、DeepSeek、Anthropic、Gemini 的请求字段；
5. Codex 的 effort 交给 App Server `turn/start`。

`auto` 是安全默认值；当上游不声明且无法可靠推断时，不发送思考参数。

## 7. Codex App Server 集成

`codex-app-server.mjs` 启动并维护一个 JSONL 子进程：

```text
spawn codex app-server
→ initialize / initialized
→ account/read
→ account/login/start（browser 或 device）
→ account/login/completed / account/updated
→ model/list（支持分页）
→ thread/start
→ turn/start(model, effort, input)
→ item/agentMessage/delta*
→ turn/completed
```

停止生成调用 `turn/interrupt`。每次生成使用独立临时工作目录，结束后清理。未知的服务端主动请求默认拒绝，避免宿主应用意外授予能力。服务退出时关闭 App Server 并清理等待中的请求。

## 8. 对话、上下文与审计流

```text
用户操作
→ 解析当前供应商 / 模型 / 思考等级
→ 创建或引用 ContextSnapshot
→ 调用 /api/analyze-stream 或 /api/generate-stream
→ NDJSON start → delta* → meta? → done
→ 增量更新同一条 assistant message
→ 写入 GenerationRecord（含 reasoningEffort）
→ 排队保存项目 JSON
→ server.mjs 原子写入
```

- `contextSnapshots` 创建后不覆盖；
- `generationRecords` 每次模型动作独立记录；
- `branchAnchor` 保存来源节点、截止消息和上下文快照；
- 停止或断线后已收到文本成为可持久化的 `partial` 回答；
- “继续完成”追加到同一条 assistant message。

## 9. 选区可靠性

页面通过 `selectionchange` 持续缓存消息选区，并在操作按钮的 `pointerdown/mousedown` 阶段抢先保存。跨 Markdown 标题、列表、引用、粗体等多个 DOM 元素的可见选区会映射回原始 Markdown UTF-16 字符范围；映射不明确时保留准确可见文本而不是误报“尚未选择文字”。

## 10. 标注与折叠状态

- 标注是 `kind: "annotation"` 的一等本地节点，通过 `relation: "annotation"` 的边连接来源；
- 标注的 `parentId` 保留路径关系，但主分支完成度计算使用排除 annotation 的 `directChildren()`；
- `allDirectChildren()` / `allDescendantsOf()` 用于折叠、删除、归档、恢复和导出，避免辅助节点从数据操作中丢失；
- 手工拖拽落点通过 `annotationManualPosition` 保留，自动布局只重排未手工定位的标注；
- `collapsed` 只影响渲染可见性，搜索会展开命中节点的折叠祖先；
- JSON Canvas 以带标签虚线边导出标注关系，Markdown 显式记录标注类型。

## 11. 本地安全边界

- 默认监听 `127.0.0.1`；
- 非回环 Host 被拒绝；
- 写入和生成请求校验 Origin；
- 每次服务启动生成随机会话令牌并注入 HTML meta；
- mutation、generation、provider connect、OAuth、restore 必须携带 `x-thought-canvas-session`；
- 项目写入、恢复与导出递归拒绝或剔除敏感字段；
- 自定义 Authorization/Cookie 等头不能覆盖本地安全认证；
- 日志和 OAuth 状态对常见 Token、Bearer、Cookie、授权码模式脱敏。

## 12. 版本、恢复与导出

- 语义保存可创建旧项目快照，每项目最多保留 20 个；
- 高频流式和相机保存使用 `createBackup: false`，避免版本噪音；
- 恢复前强制备份当前状态，并持久化 `restoredFromBackup / restoredAt`；
- Thought Canvas JSON 是无损格式；JSON Canvas 和 Markdown 是迁移/阅读导出层。

## 13. 测试边界

- `selection-utils-test.mjs`：标题、列表、链接、表格、代码、重复文本和长选区映射；
- `provider-capabilities-test.mjs`：能力规范化与协议请求映射；
- `thinking-core-test.mjs`：纯状态逻辑；
- `local-api-test.mjs`：真实本地 HTTP、文件、安全、API Key 连接、模型发现与思考参数；
- `codex-permissions-test.mjs`：现代命名权限、旧版回退、废弃字段与策略拒绝；
- `codex-bridge-test.mjs` + fake App Server：Codex JSONL 生命周期、OAuth、模型、权限、流式和中断；
- `browser_e2e.py`：真实 UI 代码、复杂选区、递归拆解、独立顶部模块、分支弹窗、标注点击/拖拽、折叠/搜索、统一确认、供应商连接、模型/思考菜单和 Codex 网页流程；
- 最终交付：严格净化扫描、ZIP 完整性，以及解压副本全量 `npm test`。

### Codex 权限兼容

现代路径不得发送 `sandboxPolicy.readOnly.access`。客户端协商实验能力，发现并验证 `:read-only`，在 thread 层选择命名配置；turn 继承该权限。旧版仅可使用 thread 层 `sandbox: "read-only"`，不得扩大到可写或完全访问。
