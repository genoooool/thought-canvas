# OAuth 与 Codex App Server 授权设计

## 已实现：网页连接 Codex

Thought Canvas 将 Codex 视为本机受信任的模型宿主，而不是自己实现 ChatGPT Token 管理。

网页流程：

```text
连接 Codex
→ 本地 server.mjs 调用 Codex App Server account/login/start
→ 打开官方 ChatGPT 授权页或显示设备码
→ 轮询授权会话
→ account/read 读取账号状态
→ model/list 读取当前账号可用模型与思考等级
→ 模型进入 Thought Canvas 选择器
→ thread/start + turn/start 流式生成
→ turn/interrupt 停止生成
```

## 安全边界

- Thought Canvas 不读取 Codex 凭据文件；
- 不把 access token、refresh token 或 ChatGPT Cookie传给浏览器；
- 不在项目、设置、日志、备份或导出中保存 OAuth Token；
- Token 保存、刷新和退出由官方 Codex 组件处理；
- 所有开始、取消、退出和生成请求仍要求 Thought Canvas 本地运行会话令牌；
- App Server 发起的未知服务端请求默认拒绝，避免宿主应用意外授予额外能力。

## 浏览器与设备码

浏览器授权为主路径。设备码仅作为远程终端、浏览器回调受限或新窗口无法打开时的备用路径。两种流程都可取消，同一时刻只允许一个活动授权会话。

## 为什么不直接复用 ChatGPT Cookie

消费产品登录并不等于第三方网页获得通用 API 权限。截取 Cookie、搬运内部令牌或模拟私有登录流程会扩大安全和兼容性风险，因此不采用。

## 其他供应商

普通 OpenAI、Anthropic、Gemini、DeepSeek 及兼容服务通过 API Key 接入。若未来新增 OAuth，必须具备公开第三方授权规范、明确作用域、PKCE/回调规则、撤销能力和安全令牌存储方案；不能把消费订阅凭据默认为开发者 API 权限。

## 当前 Codex 权限配置

OAuth 成功只代表账号可用；每次生成还必须建立明确的本机执行权限。现代 App Server 路径启用 `experimentalApi`，调用 `permissionProfile/list(cwd)`，验证内置 `:read-only` 可用后在 `thread/start.permissions` 中选择。`turn/start` 不发送旧 `sandboxPolicy.readOnly.access`。旧 App Server 仅回退为线程级 `sandbox: "read-only"`。任何现代策略拒绝都在建线程前失败。
