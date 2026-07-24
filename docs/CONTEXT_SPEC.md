# v12 上下文包规范

## 1. 目标同意规则

AI 推测目标只进入 `goal.pending`。`confirmedGoal()` 仅返回 `accepted` 或 `edited` 目标。待确认、拒绝或空目标不得进入 Prompt。

目标更新时产生新版本；旧生成记录继续引用当时的目标版本，不被当前目标静默改写。

## 2. Context Package 顺序

一次生成的逻辑区块为：

1. 当前用户明确问题；
2. 当前节点消息，必要时截止到 `cutoffMessageId`；
3. 当前内容模块的完整 `sourceText`；
4. 根到当前节点的祖先路径及确认摘要；
5. 用户长期约束；
6. 当前已确认目标和版本；
7. 当前有效 Compact；
8. 分叉锚点与来源说明。

上下文检查器按同样区块展示字符数、估算 token 和内容预览。估算用于可理解性与预算提示，不宣称等于供应商精确 tokenizer。

## 3. 消息级分叉

```json
{
  "branchAnchor": {
    "nodeId": "node_parent",
    "cutoffMessageId": "msg_answer_2",
    "contextSnapshotId": "ctx_123"
  }
}
```

创建分支时：

- 当前节点历史只保留截止消息及之前的消息；
- 更晚消息不进入新分支；
- 祖先路径保留；
- 兄弟分支内容不进入；
- 当时的目标与 Compact 通过快照冻结。

## 4. 不可变快照

每个 ContextSnapshot 至少保存：

- ID、版本、目的、创建时间；
- 当前问题；
- 分区内容及 token 指标；
- 目标文本/状态/版本；
- Compact ID/版本；
- branch anchor；
- 来源节点和祖先节点列表。

节点可以缓存指纹到快照 ID 的映射，但不得覆盖已有快照对象。

## 5. 生成审计

每个 GenerationRecord 保存：

- `purpose`：initial/follow-up/new_branch/continue_partial/compact/organize/merge 等；
- provider/model；
- contextSnapshotId；
- goalVersion、compactVersion、branchAnchor；
- estimatedInputTokens；
- responseMessageId；
- success/error/stopped/partialOutput/outputChars。

## 6. Compact

Compact 只替代发送给模型的部分历史，不删除项目消息。上下文检查器必须标明使用的 Compact 版本；删除 Compact 后原消息仍可用于后续上下文。

## 7. 来源对象

内容模块和推理对象的 `sourceMessageId + sourceStart + sourceEnd + sourceText` 是来源链。模型上下文可使用这些原文，但不得把来源原文误标为用户已确认结论。
