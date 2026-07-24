# 供应商连接、模型同步与思考等级

## 1. 一键连接

“设置 → 供应商”中的主动作是 **连接并同步模型**。输入 API Key 后，它会：

1. 校验协议、Base URL 和认证方式；
2. 使用仅存在于当前请求内存中的新密钥验证供应商；
3. 尝试读取模型目录；
4. 规范化模型 ID、显示名、默认模型、输入模态和思考等级；
5. 可选执行一次最小生成验证；
6. 成功后才把密钥写入 `.env.local`；
7. 保存非敏感模型目录到 `data/settings.local.json`；
8. 刷新所有供应商、模型和思考等级选择器。

连接失败时，新密钥不会覆盖已保存密钥。若协议、Base URL、认证方式和关键请求头未改变，界面会恢复上一份已验证模型目录与连接状态，并明确提示“原连接仍可用”。

“保存非敏感配置”仅保存名称、协议、Base URL、模型编辑和界面设置。API Key 输入值不会随普通保存或自动保存写入；服务端也拒绝绕过连接验证的直接密钥写入。只有 `/api/providers/connect` 在验证成功后可以原子替换 `.env.local` 中的 Key。

## 2. 常用字段

- **名称**：选择器中的显示名称。
- **接口协议**：OpenAI Chat、OpenAI Responses、Anthropic Messages、Gemini GenerateContent 或 Codex App Server。
- **Base URL**：供应商 API 根地址。
- **API Key**：只在“连接并同步模型”验证成功后写入 `.env.local`；普通保存不处理密钥。
- **模型**：模型 ID、可选显示名称和只读能力摘要。
- **启用**：只有连接状态为 `connected` 且存在模型的供应商才可用于生成。

## 3. 模型目录回退

部分兼容服务没有 `/models` 或模型目录不标准。此时：

- 保留手动模型编辑；
- 可使用“仅测试当前模型”；
- 若当前模型生成验证成功，可把手动模型作为 `configured_fallback` 使用；
- UI 会明确提示目录来自远程同步还是手动回退。

## 4. 思考等级

模型记录包含：

```text
reasoningEfforts
defaultReasoningEffort
reasoningSupported
capabilitySource
```

`capabilitySource` 为 `provider` 时表示上游明确声明；为 `inferred` 时表示 Thought Canvas 根据协议、供应商和模型名推断。用户选择会被限制在当前模型支持范围内，不支持的旧值回退为“自动”。

### 协议映射

- OpenAI Responses：`reasoning.effort`
- OpenAI Chat：`reasoning_effort`
- DeepSeek：`thinking` 与兼容 effort 参数
- Anthropic：adaptive thinking 与 output effort
- Gemini：`thinkingLevel` 或 2.5 系列 thinking budget
- Codex App Server：`turn/start` 的 effort

供应商若未声明且无法可靠推断，将不发送思考参数。

## 5. 认证与请求头

认证方式支持：

- `Authorization: Bearer`
- `x-api-key`
- `api-key`
- `x-goog-api-key`
- 无认证

自定义请求头必须是 JSON 对象。Authorization、Cookie 等敏感或安全边界头不会被允许覆盖本地服务认证。

## 6. 存储

- Key：`.env.local`，仅由已验证的连接流程写入；清除操作可单独执行
- 非敏感供应商、模型和能力：`data/settings.local.json`
- 项目和画布：`data/projects/*.json`

前端 API 不返回密钥明文；项目、备份和导出会递归过滤敏感字段。
