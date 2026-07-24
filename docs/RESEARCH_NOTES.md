# 研究依据与产品决策

## CC Switch

参考项目：

- https://github.com/farion1231/cc-switch
- https://github.com/farion1231/cc-switch/blob/main/docs/user-manual/en/2-providers/2.1-add.md
- https://github.com/farion1231/cc-switch/blob/main/docs/user-manual/en/2-providers/2.3-edit.md

提炼到本产品中的机制：

- 供应商配置与聊天解耦。
- Base URL、API Key、接口协议和模型列表分别维护。
- 支持预设与自定义配置。
- 对 OpenAI 兼容供应商尝试读取 `/models`。
- 连接测试应明确使用哪个模型。

没有照搬的部分：

- 不切换本机 Claude Code、Codex 或 Gemini CLI 配置文件。
- 不代理消费订阅登录凭据。
- 不实现系统钥匙串或桌面深链，因为当前版本是本地网页 MVP。

## DeepSeek

官方文档：

- https://api-docs.deepseek.com/
- https://api-docs.deepseek.com/zh-cn/api/list-models/

当前预设：

- `https://api.deepseek.com`
- OpenAI Chat Completions
- `deepseek-v4-flash`
- `deepseek-v4-pro`

## OAuth

- OpenAI Codex Authentication：https://developers.openai.com/codex/auth
- Anthropic API Key / third-party policy：https://support.anthropic.com/
- Google OAuth for installed/web apps：https://developers.google.com/identity/protocols/oauth2
- MiniMax API docs：https://platform.minimax.io/docs

产品原则：只有官方明确允许第三方 OAuth 的场景才接入。OAuth 不是“多放一个按钮”，而是需要完整的回调、令牌保存、刷新、撤销和权限管理。
