# Thought Canvas v12.5 PRD

版本：1.2.5

## 1. 产品目标

让复杂 AI 对话成为一条可确认目标、可精确分叉、可审计上下文、可提取论证、可比较分支并最终收敛为决策的本地思考流程，同时让模型接入从“手工配置参数”升级为“可信连接账号或 API Key 后立即可用”。

核心逻辑链：

```text
选择简体中文 / English / 日本語界面
→ 连接供应商或 Codex 账号
→ 选择账号实际可用模型与思考等级
→ 确认目标
→ 在具体消息时点探索分支
→ 查看模型实际上下文
→ 从原文提升观点/证据/假设
→ 建立支持、反驳与依赖关系
→ 比较分支
→ 形成可追溯决策
→ 保存版本并开放导出
```

自然对话始终是默认入口；模型能力和推理结构在需要时显性化，不强迫用户先学习配置协议或知识图谱。

## 2. 核心对象

### UiLanguage

全局非敏感设置，支持 `zh-CN / en / ja`。控制应用界面、日期数字格式和新生成请求的默认回答语言，不改写项目/用户/模型内容。

### TextEncodingMigration

项目可记录 `textEncodingRepairVersion / textEncodingRepairedAt / textEncodingRepairCount`。识别 UTF-8 被 Windows-1252 误解码的明确样本时，修复前保存原始备份；不确定时保持原文。

### ProviderProfile

保存供应商 ID、名称、协议、Base URL、认证方式、非敏感请求头、模型目录、连接状态、能力适配模式和默认模型。API Key 不在对象中保存明文。

### ModelCapability

```text
id / name
reasoningSupported
reasoningEfforts
defaultReasoningEffort
capabilitySource: provider | inferred | configured_fallback
inputModalities
```

模型能力来自上游目录、Codex `model/list` 或保守推断；UI 必须向用户暴露来源。

### ReasoningSelection

统一值：`auto / none / minimal / low / medium / high / xhigh / max`。保存于默认设置、汇总设置、节点 composer、消息和 GenerationRecord；切换模型时被限制为该模型支持值。

### Project

保存标题、目标版本、节点、边、消息、相机、Compact、不可变上下文快照、生成记录、推理对象、推理关系和恢复来源。

### Goal

AI 只能提出 `suggested`；用户采用后为 `accepted`，编辑后为 `edited`，拒绝后为 `rejected`。只有 accepted/edited 进入上下文。

### Node / Message / ContextSnapshot / ReasoningArtifact / ReasoningEdge / GenerationRecord

沿用 v12.0 定义。Message 和 GenerationRecord 增加供应商、模型与思考等级；分支记录消息截止点和当时上下文快照。

## 3. 供应商接入流程

### API Key 供应商

用户在设置中输入 Key 并点击“连接并同步模型”。系统必须一次完成：

1. 验证本地运行会话令牌；
2. 校验协议、URL、认证方式和请求头；
3. 使用候选 Key 读取模型目录；
4. 规范化模型及思考能力；
5. 必要时执行最小生成验证；
6. 成功后才保存 Key；
7. 返回无密钥的连接结果；
8. 刷新所有模型与思考选择器。

失败时必须保留已有 Key 和模型配置，并给出可行动错误。无目录的兼容服务可使用验证成功的手工模型回退。

### Codex

网页点击“连接 Codex”后由本机 Codex App Server 启动官方浏览器授权；设备码作为备用。授权成功后读取账号、套餐、动态模型和思考等级。用户点击“立即使用 Codex”后，画布切换到可用模型。退出后 Codex 模型禁用。Thought Canvas 不读取、返回或保存 OAuth Token。

## 4. 模型与思考等级体验

- 首页、当前节点、创建分支、默认回答和汇总都可选择思考等级；
- 模型和思考使用应用内菜单，不能覆盖触发器；
- 未连接供应商不可作为正常生成目标；
- 模型切换后思考选项立即刷新；
- `auto` 表示交给模型/供应商默认；
- 上游未声明能力时标记为推断；无法可靠适配时不发送参数；
- GenerationRecord 必须记录实际使用的统一思考等级。

## 5. 思考流程

### 首问与目标契约

首答完整保留为 Markdown。AI 目标建议显示为待确认，不自动成为项目事实，也不自动拆解回答。

### 精确分支与上下文审计

用户可从节点末尾或具体消息创建分支。上下文只继承截止消息及以前的本节点历史、祖先路径、当时已确认目标与 Compact。每次调用产生不可变快照，用户可查看模型看到的内容和 token 估算。

### 拆解、提炼、比较与汇总

跨 Markdown 选区必须可靠保留。拆解创建来源模块；提炼创建观点、证据、假设、问题、方案、风险、行动或决策。双节点比较不隐式调用模型。汇总创建专用快照、结果节点和决策对象。

### 生成控制

所有供应商统一输出 NDJSON。用户可停止；已收到内容持久化为部分回答；继续完成追加到同一消息。Codex 使用 App Server turn interrupt。

### 版本与导出

语义变更和最终生成状态创建恢复版本，高频中间保存不制造版本噪音。支持 Thought Canvas JSON、JSON Canvas 和 Markdown。

## 6. 多语言与编码要求

- 设置中提供简体中文、英文、日文并即时预览、持久化；
- UI 翻译与项目标题、消息、标注、推理对象隔离；
- 新请求附带所选回答语言，但用户明确语言要求拥有更高优先级；
- HTML、JavaScript、JSON、NDJSON 均显式使用 UTF-8；
- 历史项目、备份、设置、导入与上游文本边界采用保守 mojibake 修复；
- 自动修复项目时保留迁移前备份和审计元数据；
- 模糊文本不得为了“看起来正确”而强制转换。

## 7. 非功能要求

- 默认仅监听回环地址；Host、Origin、运行会话令牌保护 mutation/generation/auth；
- API Key 和 OAuth Token 不进入项目、备份、导出或浏览器响应；
- 设置页正文与输入文字可读，焦点不出现双层紫框；
- 顶部工具栏在宽窄屏均不重叠；
- 14px 点阵、3/3 用户虚线与 4/3 处理中虚线保持一致；
- 发布包不得包含本地项目、备份、密钥、运行状态、缓存、截图或嵌套归档。

## 8. 成功标准

以 `docs/GATES.md` 四个可执行 Gate 为准。工作树和干净解压包均须通过 `npm test`；真实外部网络、账号、余额和模型灰度不冒充本地自动化 PASS。
