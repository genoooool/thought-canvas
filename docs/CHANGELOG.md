# Changelog

## 1.2.5 — interface languages and UTF-8 migration

### 多语言

- 设置通用页新增简体中文、English、日本語，并支持即时预览、保存和刷新恢复。
- 新增 `i18n.js`，覆盖静态文案、动态状态、模式化计数、占位符、ARIA 标签、日期 locale 和模型回答语言指令。
- 项目标题、消息、标注、推理对象等用户内容与 UI 翻译隔离。

### 文本编码

- 定位截图乱码为 UTF-8 被 Windows-1252/CP1252 误解码的典型签名。
- 新增 `text-encoding.js` 保守修复器，覆盖历史项目、恢复版本、全局设置、导入、请求/响应和模型输出。
- 自动修复历史项目前保存 `encoding-before-*` 原始备份，并记录迁移版本、时间和累计修复数。
- 为 HTML/JS/JSON/NDJSON UTF-8 响应头、截图样本、日文、双重误解码和正常拉丁文本增加回归。

## 1.2.4 — UX consistency and mind-map annotations

### 修复与体验

- 修复长文本、跨 Markdown 格式和按钮夺取焦点时，拆解/提炼偶发丢失选区的问题。
- 无法唯一定位 Markdown 字符范围时，保留准确可见文字并显式记录未知范围，不伪造来源偏移。
- 拆解内容模块无需先追问即可继续拆解整个模块、拆解选区和提炼选区。
- 项目、最终目标和保存状态改为独立顶部模块；搜索框与项目模块对齐。
- 统一新建分支及业务弹窗的字号、留白、字段宽度和按钮层级。
- 移除鼠标点击编辑区时的装饰性外框，同时保留键盘 `focus-visible`。
- 用视口居中的应用内确认弹窗替换浏览器原生 `confirm()` / `alert()`。

### 轻量思维导图

- 新增标注、想法、问题、风险和行动五类本地标注节点。
- 支持点击快速创建，或从节点手柄拖拽到指定位置创建；拖拽过程中显示密集虚线预览。
- 标注通过固定 3/3 虚线连接来源，可编辑、搜索、追问、分支、拆解和提炼。
- 标注不计入来源节点主分支完成度。
- 新增分支折叠/展开；搜索命中折叠后代时自动展开路径。
- 标注、手工位置和折叠状态进入保存、恢复及三种导出。

### 验证

- 新增 `selection-utils.js` 与纯函数选区测试。
- 扩展本地 API 与 Chromium E2E，覆盖范围未知拆解、递归拆解、顶部几何、弹窗、焦点、标注拖拽、折叠、搜索和导出。

## 1.2.3 — Codex permission-profile compatibility

### 修复

- 移除已被新版 Codex App Server 拒绝的 `turn/start.sandboxPolicy.readOnly.access`。
- 初始化时协商 `experimentalApi`，并通过 `permissionProfile/list` 发现权限配置。
- 现代路径要求内置 `:read-only` 存在且允许，然后在 `thread/start.permissions` 中选择。
- `turn/start` 继承线程权限，不再发送 `sandboxPolicy`。
- 旧版 App Server 回退到线程级 `sandbox: "read-only"`，仍不发送嵌套 `access`。
- 组织策略禁用 `:read-only` 时在创建线程前失败，不扩大本机访问范围。

### 验证

- 新增严格的 modern / legacy / denied App Server 替身模式。
- 替身检测到任何 `readOnly.access` 时复现用户看到的原始错误。
- 新增专用权限兼容测试，并把现代、旧版权限路径加入完整 Codex OAuth/流式回归。

## 1.2.2 — connected providers and reasoning controls

### API Key 供应商

- 新增“连接并同步模型”主流程：验证凭据、发现模型、同步能力并刷新全部选择器。
- 新密钥仅在验证成功后写入 `.env.local`；失败不会覆盖旧密钥。
- 普通“保存非敏感配置”和自动保存不再写入 API Key；服务端拒绝未经连接验证的直接密钥写入。
- 在连接关键配置未改变时，错误新 Key 或同步失败会恢复上一份已验证连接、模型目录和生成能力。
- 前端只接收 `hasKey` 状态，不接收密钥明文。
- 支持模型目录缺失时的手动配置回退。

### 模型能力与思考等级

- 新增统一模型能力结构、默认思考等级和能力来源标记。
- 首页、当前节点、分支、默认回答与汇总新增思考等级。
- 支持 OpenAI、DeepSeek、Anthropic、Gemini 和 Codex 参数映射。
- 切换模型时自动限制不支持的旧设置。

### Codex App Server

- 网页可启动浏览器或设备码 ChatGPT 授权。
- 授权完成后读取账号、套餐、实际可用模型和思考等级。
- 新增“立即使用 Codex”。
- 生成改为 App Server thread/turn 流，支持增量消息与 turn interrupt。
- Thought Canvas 不读取或保存 OAuth Token。

### UI 修复

- 修复跨 Markdown DOM 选择文字后，拆解/提炼误报“尚未选择文字”。
- 顶部项目、目标、保存状态改为统一响应式工具栏。
- 模型与思考等级使用不重叠的自定义菜单。
- 设置页字号与输入框高度提升；移除双层紫色焦点框。
- 保留 14px 点阵、3/3 用户虚线与 4/3 处理中虚线。

### 测试与交付

- 新增 provider capability、API Key connect/sync 与 fake Codex App Server 套件。
- 浏览器 E2E 覆盖选区、菜单几何、设置样式、供应商连接和 Codex 网页授权。
- 更新全部项目文档和长期 agent 记忆。

## 1.2.0 — trusted reasoning canvas

- 目标同意、消息级分叉、不可变上下文快照、推理对象与关系、分支比较、决策汇总、流式停止/续写、本地安全、版本恢复和开放导出。

## 1.1.2 — sidebar, node branch control and connector patch

- 新分支入口移到画布节点右侧；修复侧栏滚动、处理状态、弧线/虚线、响应式工具栏和回答后布局。

## 1.1.1 — v11 interaction patch

- 当前节点追问不再创建分支；新增显式分支弹窗、选区映射、安全拆解回退和供应商分组。

## 1.1.0 — file-first state machine

- 项目迁移到本地文件；增加备份、绑定消息拆解、Compact、上下文快照、布局和净化交付。
