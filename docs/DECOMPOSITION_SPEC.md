# 回答拆解规范

## 1. 定义

拆解是把一条已有 AI 回答切成多个可独立阅读的内容模块，不是生成延伸问题。

## 2. 明确绑定

消息级接口：

```http
POST /api/projects/:projectId/nodes/:nodeId/messages/:messageId/decompose
```

前端按钮永久绑定 `projectId + nodeId + messageId`，不能依赖“最后一条回答”或内存临时变量。

## 3. 全文与选区

全文拆解读取该 message 的完整正文。

选区拆解同时提交并保存：

- `messageId`；
- `selectionStart`；
- `selectionEnd`；
- `selectedText`。

没有选中文字时不发起拆解，并显示“尚未选择文字”。

## 4. 内容节点

每个 `content_section` 至少保存：

```json
{
  "sourceMessageId": "msg_xxx",
  "sourceStart": 230,
  "sourceEnd": 680,
  "sourceText": "完整原文",
  "content": "完整原文",
  "title": "模块标题",
  "summary": "简短概括",
  "sectionOrder": 2
}
```

字符范围相对于来源 AI 消息；选区拆解返回的局部范围会换算回原消息绝对范围。

## 5. Prompt 硬规则

默认 Prompt 明确要求：只拆原文已有内容、不生成问题、不改变结论、保存完整讲解、保持顺序、不遗漏关键段落，并返回标题、起止位置、完整原文与概括。

结构化返回异常时先尝试宽松修复；仍失败则按原文标题/段落生成保真回退节点。内部 JSON 不显示给用户。

## 6. 共存

同一消息可记录多次拆解；不同消息的拆解使用独立 decomposition record 和 groupId。新拆解只追加节点与连线，不覆盖旧节点。
