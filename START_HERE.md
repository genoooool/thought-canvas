# START HERE — Thought Canvas v12.6

## 1. 启动

需要 Node.js 18 或更高版本。

```bash
npm start
```

当前 `npm start` 等价于：

```bash
node server.mjs
```

浏览器打开：

```text
http://127.0.0.1:8787
```

## 2. 从旧版本保留数据

先停止旧服务，再把旧目录中存在的以下内容复制到 v12.6 对应位置：

```text
.env.local
data/settings.local.json
data/runtime.local.json
data/projects/
data/backups/
```

这些文件可能包含 API Key 或私人项目，只应在本机复制，不要分享。

v12.6 首次读取历史项目或设置时，会保守检查 UTF-8/Windows-1252 乱码。项目发生自动修复前会在 `data/backups/` 创建 `encoding-before-*` 备份。

## 3. 语言切换人工验收

1. 打开右上角 **设置**；
2. 在 **通用 → 界面语言** 依次选择 `English` 和 `日本語`；
3. 确认设置标题、页签、按钮、提示和常用弹窗立即切换；
4. 确认项目标题、用户消息、模型回答和标注正文保持原语言；
5. 点击 **保存全部设置**；
6. 刷新页面，确认语言仍然保持；
7. 切回 `简体中文` 并保存。

所选语言也会作为新生成请求的回答语言指令；用户在问题中明确要求其他语言时，模型仍可遵从用户要求。

## 4. 乱码修复人工验收

截图中 `è§£é‡Š` 一类文本是 UTF-8 字节被 Windows-1252/CP1252 解读后的典型乱码。v12.6 会在可信入口自动修复并提示“已修复文本编码”。

推荐验证方式：

1. 备份旧项目目录；
2. 启动 v12.6 并打开曾出现乱码的项目；
3. 确认项目标题、目标和消息恢复为可读文字；
4. 确认出现一次非阻塞修复提示；
5. 做一次普通编辑并等待“已保存”；
6. 检查项目 JSON 已写回可读文字；
7. 检查 `data/backups/` 中存在对应的 `encoding-before-*` 文件。

正常中文、日文、英文、模型 ID 和常见拉丁文本不应被改变。转换不够确定时，系统会保留原文。

## 5. 其他关键人工验收

### API Key 模型

1. 设置 → 供应商；
2. 填写 Base URL、API Key 和测试模型；
3. 点击 **连接并同步模型**；
4. 确认模型目录和思考等级进入所有选择器；
5. 在画布发送一条短消息。

### Codex

1. 设置 → OAuth；
2. 点击 **连接 Codex**；
3. 完成 ChatGPT 授权；
4. 确认账号、套餐和动态模型列表出现；
5. 点击 **立即使用 Codex**；
6. 选择模型和思考等级，发送一条短消息。

### 复杂选区与标注

1. 在包含 Markdown 标题、列表或链接的回答中跨格式选中文字；
2. 使用 **提炼选中文字** 和 **拆解选中文字**；
3. 选择拆解模块，确认仍能继续拆解和提炼；
4. 从节点右侧标注手柄拖出一个标注；
5. 确认 3/3 密集虚线、位置保存、搜索和折叠恢复。

## 6. 自动验证

完整回归：

```bash
npm test
```

单独验证语言与编码：

```bash
npm run test:i18n
npm run test:encoding
npm run test:local
npm run test:browser
```

发布扫描：

```bash
npm run verify:package
```

更详细的 Gate 与证据见：

```text
docs/GATES.md
docs/TEST_REPORT.md
docs/KNOWN_LIMITATIONS.md
```
