# Thought Canvas v12.6 — 多语言、编码与布局可验证 Gate

本次按照 `agentic-project-continuation` 的 **Complex continuation** 执行。每个 Gate 先定义可验证条件，再实现和回归；全部通过后才构建净化 ZIP。

执行日期：2026-07-24  
总体验收命令：`npm test`

## Gate 1 — 中英日界面语言：PASS

### 验收条件

- 设置通用页提供 `简体中文 / English / 日本語` 三个选项；
- 切换后无需刷新即可预览，保存后进入本机全局设置，重新加载仍保持；
- 页面根节点 `lang`、日期和数字格式随语言变化；
- 静态 UI、动态按钮、状态、常用弹窗、占位符、ARIA 标签和模式化计数均可切换；
- 项目标题、用户输入、模型回答、标注、推理对象和其他用户内容不自动翻译；
- 即使用户内容恰好等于 UI 词条（例如“设置”），也保持原样；
- 新生成请求附带所选回答语言指令，用户明确指定其他语言时允许覆盖。

### 自动证据

- `tests/i18n-test.mjs`：语言标准化、静态词典、动态模式、日期 locale 和回答语言指令；
- `tests/local-api-test.mjs`：语言设置持久化、重启恢复、英文/日文指令转发；
- `tests/browser_e2e.py`：真实 Chromium 即时切换、用户内容隔离、保存及重载。

## Gate 2 — UTF-8 乱码诊断、修复与迁移：PASS

### 诊断结论

截图中的 `è§£é‡Š` 与 `é‡Œé¢` 是 UTF-8 多字节文本被 Windows-1252/CP1252 解读后的典型 mojibake。当前静态页面和服务端响应本身已经声明 UTF-8，因此该截图更符合历史项目、复制/导入链路或上游文本边界曾经发生误解码的表现。仅凭截图无法证明最早入口，系统不把未经证实的单一入口写成事实。

### 验收条件

- HTML、JavaScript、JSON 和 NDJSON 响应明确使用 UTF-8；
- 保守修复器支持中文、日文和双重误解码样本；
- 正常中文、日文、英文、模型 ID 和常见拉丁文本不被误改；
- 历史项目读取时修复标题、目标、节点、消息及嵌套字段；
- 修复前保存 `encoding-before-*` 原始备份；
- 项目写回迁移版本、修复时间和累计修复数；
- 当前保存请求、恢复版本、全局设置、JSON 导入、API 响应、普通供应商与 Codex 输出都经过同一保守边界；
- 无法显著降低乱码特征时保持原文；
- UI 显示一次非阻塞修复提示，英文和日文界面下提示同步本地化。

### 自动证据

- `tests/text-encoding-test.mjs`：截图样本、日文、双重误解码、混合文本、正常拉丁文本和深层对象；
- `tests/local-api-test.mjs`：UTF-8 响应头、历史项目备份/迁移、当前保存、乱码恢复版本、设置重启修复和供应商响应；
- `tests/browser_e2e.py`：项目索引、目标和消息在浏览器端恢复，用户界面保持英文，并在后续保存写入迁移元数据。

## Gate 3 — 既有工作流完整回归：PASS

### 验收条件

- 复杂 Markdown 选区、可见文字回退和递归拆解/提炼继续通过；
- 顶部独立模块、搜索对齐、分支弹窗、统一弹窗和焦点行为不回退；
- 标注拖拽、3/3 密集虚线、状态隔离、折叠和搜索自动展开不回退；
- 目标确认、消息级分叉、不可变上下文、推理对象、比较、决策、Compact、版本与导出不回退；
- API Key 连接、模型同步、思考等级、Codex OAuth、命名 `:read-only` 权限、流式和中断不回退；
- 本地 Host、Origin、会话令牌、密钥隔离和备份恢复不回退。

### 自动证据

```text
npm run check
npm run test:selection
npm run test:encoding
npm run test:i18n
npm run test:capabilities
npm run test:core
npm run test:local
npm run test:codex
npm run test:browser
```

以上全部 PASS。

## Gate 4 — 文档、净化交付与干净解压：PASS

### 验收条件

- 版本号、README、启动文档、架构、限制、测试报告和 `docs/ai` 项目记忆同步到 1.2.6；
- staging 不包含 `.git`、`.env.local`、运行时设置、项目、备份、缓存、截图、嵌套归档或符号链接；
- 新增 `i18n.js`、`text-encoding.js` 及对应测试列入发布必需文件；
- `npm run verify:package` 通过；
- ZIP 完整性检查通过；
- 最终 ZIP 干净解压后再次通过严格扫描和完整 `npm test`。

最终文件数与测试耗时记录在 `docs/TEST_REPORT.md`；ZIP 大小和 SHA-256 在交付消息中给出，避免归档哈希自引用。

## 结果边界

自动化使用本地假上游和严格 Codex App Server JSONL 替身，不等同于真实云账号、组织策略、网络、额度或模型灰度。乱码签名可以确定为 Windows-1252 误解码，但原始错误入口若要精确归因，仍需当时的原始文件或上游原始响应日志。
