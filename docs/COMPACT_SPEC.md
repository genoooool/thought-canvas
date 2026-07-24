# Compact 规范

## 1. 目的

Compact 只减少发送给模型的历史正文长度，不删除或改写本地原始消息。

## 2. 快照结构

```json
{
  "id": "compact_xxx",
  "version": 1,
  "summary": "...",
  "confirmedConclusions": [],
  "openQuestions": [],
  "rejectedAssumptions": [],
  "importantUserConstraints": [],
  "coveredMessageIds": [],
  "createdAt": "..."
}
```

## 3. 操作

- 手动 Compact；
- 自动 Compact；
- 查看当前 Compact；
- 重新生成；
- 删除当前 Compact；
- 在设置中禁用自动 Compact；
- 配置消息数量阈值。

自动 Compact 以可配置消息数量为实际触发条件，同时保留 70% 上下文预算作为产品规则。当前版本没有为每个供应商内置精确 tokenizer，因此预算判断使用字符估算。

## 4. 必须保留

真实目标、长期约束、确认事实、确认结论、观点变化、被否定假设、未解决问题、重要数字与节点关系。

## 5. 禁止行为

Compact 不得删除消息、把不确定判断写成事实、自动改变目标、自动完成节点或覆盖来源原文。
