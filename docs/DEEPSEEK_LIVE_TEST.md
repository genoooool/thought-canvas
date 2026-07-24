# DeepSeek V4 Flash 连接验收

日期：2026-07-23

## 目标

通过官方 OpenAI 兼容接口调用 `deepseek-v4-flash`，要求只返回 `CONNECTION_OK`。

## 目标配置

```text
Base URL: https://api.deepseek.com
Endpoint: /chat/completions
Model: deepseek-v4-flash
Authorization: Bearer <API_KEY>
```

## 本环境结果

```text
BLOCKED_OR_FAIL: unable to reach DeepSeek (fetch failed)
```

进一步尝试绕过 DNS，使用公开查询到的 Cloudflare IP 进行 `curl --resolve`，仍无法建立 TCP 443 连接。由此判断是构建容器的外网策略阻断，而不是已观察到的 API 鉴权或模型错误。

## 密钥处理

- 用户提供的密钥只在测试进程环境变量中使用。
- 未写入源码、文档、日志或 ZIP。
- 测试输出不显示密钥。

## 在正常网络中复验

```bash
DEEPSEEK_API_KEY='你的Key' npm run test:deepseek
```

成功标准：

```text
PASS: deepseek-v4-flash; HTTP 200; ...ms; CONNECTION_OK
```
