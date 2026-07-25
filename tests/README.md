# Tests — Thought Canvas v12.6

## 全量

```bash
npm test
```

先执行 Chromium E2E，再执行语法、Markdown 选区、文本编码、界面语言、模型能力、核心逻辑、本地 HTTP/API Key 和 Codex App Server。

## 套件

### `selection-utils-test.mjs`

验证渲染 Markdown 选区映射到源 Markdown：标题、列表、引用、强调、链接、表格、代码块、重复文本、超长选区和无法可靠映射时返回 `null`。

```bash
npm run test:selection
```

### `text-encoding-test.mjs`

验证 UTF-8 被 Windows-1252/CP1252 误解码后的保守恢复：截图中文样本、日文、双重误解码、混合文本、深层对象，以及正常中文、日文、英文、模型 ID 和拉丁文本不被误改。

```bash
npm run test:encoding
```

### `i18n-test.mjs`

验证简体中文、英文、日文语言标准化，静态词典、动态计数模式、日期 locale、回答语言指令和 Node 无 DOM 环境兼容。

```bash
npm run test:i18n
```

### `provider-capabilities-test.mjs`

验证模型能力字段规范化、能力推断、默认/支持思考等级、过期选择限制，以及 OpenAI Responses/Chat、DeepSeek、Anthropic、Gemini 请求体映射。

```bash
npm run test:capabilities
```

### `thinking-core-test.mjs`

验证目标同意、截止消息上下文、token 指标、可追踪推理对象、语义关系和决策记录。

```bash
npm run test:core
```

### `local-api-test.mjs`

启动真实临时 Node 服务和假上游，验证：

- HTML、JavaScript、JSON 和 NDJSON UTF-8 边界；
- 历史项目乱码修复、迁移元数据和 `encoding-before-*` 原始备份；
- 当前保存、乱码恢复版本、全局设置重启修复和供应商输出修复；
- 中英日语言持久化与英文/日文模型回答指令；
- Host / Origin / 运行会话令牌；
- API Key 验证、模型发现、成功后持久化和失败保护；
- 浏览器响应与设置中无密钥明文；
- 模型能力持久化和思考等级转发；
- 项目文件、NDJSON、拆解、Compact、备份恢复和重启恢复。

```bash
npm run test:local
```

### `codex-permissions-test.mjs`

验证新版 App Server 的 `permissionProfile/list` + `:read-only`，旧版无实验能力的 thread-level read-only 回退、任何请求均不含 `readOnly.access`，以及权限策略拒绝时在创建线程前 fail closed。

### `codex-bridge-test.mjs`

通过 `fake-codex.sh` 启动 `fake-codex-app-server.mjs`，不访问真实账号。覆盖 initialize、账号、浏览器/设备码授权、分页模型发现、思考等级、命名只读权限、流式消息、停止中断、临时目录清理和输出编码修复。

```bash
npm run test:codex
```

### `browser_e2e.py`

加载真实 HTML/CSS/JS 和 Chromium，并使用与 v12.6 路由同构的页面内 API。覆盖：

- 中/英/日即时切换、保存、重载和用户内容隔离；
- 浏览器侧历史乱码恢复、英文修复提示和保存迁移元数据；
- 跨 Markdown 选区、过度选区回收、范围未知回退和递归拆解/提炼；
- 标注点击/拖拽、密集虚线、编辑、状态隔离、折叠、搜索展开和三种导出；
- 应用内居中项目删除确认，且不调用浏览器原生 `confirm()`；
- 顶部宽窄屏布局、模型/思考菜单几何和隐藏 select 同步；
- 设置字号、输入框高度和单层中性焦点；
- API Key 一键连接、动态模型/能力刷新和无明文状态；
- Codex 浏览器/设备码授权、账号/套餐、动态模型、立即使用、取消和退出；
- 流式停止/续写、上下文、分支、推理对象、比较、Compact、版本和导出。

```bash
npm run test:browser
```

可用 `CHROMIUM=/path/to/chromium` 指定浏览器。调试时：

```bash
TC_E2E_DEBUG=1 npm run test:browser
```

浏览器构建环境禁止访问 localhost，因此真实 HTTP、文件、密钥和 Codex JSONL 行为由 Node 集成测试覆盖；UI 套件只替换传输层，不替换产品前端代码。

## 发布验证

在发布 staging 和解压副本内分别运行：

```bash
node scripts/verify-package.mjs .
npm test
```

ZIP 还需通过：

```bash
unzip -t thought-canvas-mvp-v1.2.6-layout-fix.zip
```
