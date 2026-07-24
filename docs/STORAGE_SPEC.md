# v12 本地存储、版本与导出规范

## 1. 目录

```text
.env.local                          API Key，仅本机
data/settings.local.json           非敏感供应商与界面设置
data/runtime.local.json            当前活动项目 ID
data/projects/project_xxx.json      完整项目
data/backups/project_xxx.*.json     恢复版本
```

项目和设置通过同目录临时文件 + 原子 rename 写入。

## 2. 项目文件

必须持久化：

- 项目 ID、标题、创建/更新时间；
- 目标状态、版本与历史；
- 节点、边、位置、状态、归档和相机；
- 完整消息及 streaming/partial/error 元数据；
- 拆解范围、来源原文和 decomposition record；
- Compact 快照；
- 不可变上下文快照与生成记录；
- 推理对象、语义关系和决策数据；
- `restoredFromBackup` 与 `restoredAt`。

## 3. 备份策略

- 每个项目最多保留最近 20 个版本；
- 高频流式/相机持久化可发送 `createBackup: false`；
- 语义变更和生成最终状态使用 `createBackup: true`；
- 恢复前服务端无条件备份当前版本；
- 备份列表只暴露安全元数据，不返回整个项目；
- 恢复 ID 必须是同项目、无路径穿越的合法文件名；
- 恢复项目必须包含节点且不得含敏感字段。

## 4. 浏览器边界

项目持久化不依赖 Local Storage。浏览器存储可保存短期 UI 状态，但清空后项目仍能从本地文件恢复。

## 5. 密钥隔离

- 新 API Key 只由 `/api/providers/connect` 在上游验证和模型同步成功后原子写入 `.env.local`；
- `/api/provider-secret` 只允许清除已保存 Key，拒绝非清除式直接写入；
- 普通设置保存、自动保存和“保存非敏感配置”不会处理 API Key 输入值；
- 若替换 Key 或重新同步失败且连接关键配置未改变，已验证旧 Key 与上一份模型目录继续生效；
- 项目保存和恢复递归拒绝 apiKey、secret、accessToken、authorization 等敏感字段；
- 完整导出递归剔除敏感键；
- 最终 ZIP 不包含 `.env.local`、settings/runtime 本地文件、项目或备份。

## 6. 导出

### Thought Canvas JSON

包含项目业务状态及 `exportedAt / exportFormat`，用于完整迁移。不得包含密钥。

### JSON Canvas

输出 `nodes` 与 `edges`：

- 思考节点 → text node；
- 推理对象 → text node；
- 分支/拆解/汇总 → labeled edge；
- 推理对象来源 → “提炼自”；
- supports/refutes/depends_on → “支持/反驳/依赖”。

### Markdown

包含目标、约束、决策与依据、未解决风险、行动、推理对象、关系和所有画布节点消息。

## 7. 净化包

`scripts/verify-package.mjs` 严格拒绝运行时数据、缓存、截图、嵌套归档、符号链接、VCS 目录和常见密钥模式。交付包只保留 `.env.example` 与空数据目录占位。
