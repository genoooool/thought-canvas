const p = (id, name, protocol, baseUrl, models, extra = {}) => ({
  id, name, protocol, baseUrl, models, builtIn: true, enabled: true,
  category: '官方', authMode: protocol === 'anthropic-messages' ? 'x-api-key' : protocol === 'gemini-generate-content' ? 'x-goog-api-key' : protocol === 'codex-app-server' ? 'none' : 'bearer',
  customHeaders: {}, keyOptional: protocol === 'codex-app-server', reasoningMode: 'auto', connectionStatus: 'unverified', ...extra
});
const m = (...items) => items.map(item => Array.isArray(item) ? ({ id: item[0], label: item[1] }) : ({ id: item, label: item }));

export const PROVIDER_PRESETS = [
  p('codex-cli', 'Codex · ChatGPT OAuth', 'codex-app-server', '', [], {
    category: 'OAuth / 本地', description: '通过本机 Codex App Server 连接 ChatGPT，并动态读取账号可用模型。', authMode: 'none',
    reasoningMode: 'codex', connectionStatus: 'disconnected', enabled: false
  }),
  p('openai', 'OpenAI 官方', 'openai-responses', 'https://api.openai.com/v1', m(['gpt-5.6','GPT-5.6'], ['gpt-5.5','GPT-5.5'], ['gpt-5.4','GPT-5.4'], ['gpt-5.4-mini','GPT-5.4 mini']), { description: '官方 Responses API。', reasoningMode: 'openai' }),
  p('anthropic', 'Anthropic 官方', 'anthropic-messages', 'https://api.anthropic.com', m(['claude-sonnet-5','Claude Sonnet 5'], ['claude-opus-4-8','Claude Opus 4.8'], ['claude-haiku-4-5-20251001','Claude Haiku 4.5']), { description: '官方 Messages API。', reasoningMode: 'anthropic' }),
  p('gemini', 'Google Gemini 官方', 'gemini-generate-content', 'https://generativelanguage.googleapis.com/v1beta', m(['gemini-3.6-flash','Gemini 3.6 Flash'], ['gemini-3.5-flash','Gemini 3.5 Flash'], ['gemini-3.1-pro-preview','Gemini 3.1 Pro Preview']), { description: 'Gemini generateContent API。', reasoningMode: 'gemini' }),
  p('deepseek', 'DeepSeek 官方', 'openai-chat', 'https://api.deepseek.com', m(['deepseek-v4-flash','DeepSeek V4 Flash'], ['deepseek-v4-pro','DeepSeek V4 Pro']), { description: 'OpenAI Chat Completions 兼容接口。', reasoningMode: 'deepseek' }),
  p('opencode-go', 'OpenCode Go', 'openai-chat', '', m(['model-id','填写模型 ID']), { category: '常用服务', enabled: false, templateOnly: true, description: '请按 OpenCode Go 控制台填写 Base URL 与模型 ID。' }),
  p('minimax', 'MiniMax 国际', 'openai-chat', 'https://api.minimax.io/v1', m(['MiniMax-M3','MiniMax M3'], ['MiniMax-M2.7-highspeed','MiniMax M2.7 Highspeed'], ['MiniMax-M2.7','MiniMax M2.7']), { description: 'MiniMax OpenAI 兼容接口。' }),
  p('minimax-cn', 'MiniMax 国内', 'openai-chat', 'https://api.minimaxi.com/v1', m(['MiniMax-M3','MiniMax M3'], ['MiniMax-M2.7-highspeed','MiniMax M2.7 Highspeed'], ['MiniMax-M2.7','MiniMax M2.7']), { category: '常用服务', description: 'MiniMax 国内 OpenAI 兼容接口。' }),
  p('moonshot', 'Moonshot / Kimi 官方', 'openai-chat', 'https://api.moonshot.ai/v1', m(['kimi-k3','Kimi K3'], ['kimi-k2.7','Kimi K2.7'], ['kimi-k2.6','Kimi K2.6']), { description: 'Kimi OpenAI 兼容接口。' }),
  p('dashscope', '阿里云百炼', 'openai-chat', 'https://dashscope.aliyuncs.com/compatible-mode/v1', m(['qwen-plus','Qwen Plus'], ['qwen-max','Qwen Max'], ['qwen-turbo','Qwen Turbo']), { category: '中国云 / 聚合' }),
  p('dashscope-coding', '阿里云百炼 For Coding', 'openai-chat', 'https://dashscope.aliyuncs.com/compatible-mode/v1', m(['qwen3-coder-plus','Qwen3 Coder Plus'], ['qwen3-coder-flash','Qwen3 Coder Flash']), { category: '常用服务' }),
  p('volcengine', '火山引擎 Ark', 'openai-chat', 'https://ark.cn-beijing.volces.com/api/v3', m(['your-endpoint-id','填写 Ark Endpoint ID']), { category: '中国云 / 聚合', description: '模型 ID 通常是 Ark Endpoint ID。' }),
  p('zhipu', '智谱 GLM', 'openai-chat', 'https://open.bigmodel.cn/api/paas/v4', m(['glm-5','GLM-5'], ['glm-4.6','GLM-4.6'], ['glm-4.5-flash','GLM-4.5 Flash'])),
  p('zhipu-en', '智谱 GLM 国际', 'openai-chat', 'https://api.z.ai/api/paas/v4', m(['glm-5','GLM-5'], ['glm-4.6','GLM-4.6'], ['glm-4.5-flash','GLM-4.5 Flash']), { category: '常用服务' }),
  p('stepfun', '阶跃星辰 StepFun', 'openai-chat', 'https://api.stepfun.com/v1', m(['step-3.5-flash','Step 3.5 Flash'], ['step-3','Step 3'])),
  p('stepfun-en', 'StepFun International', 'openai-chat', 'https://api.stepfun.com/v1', m(['step-3.5-flash','Step 3.5 Flash'], ['step-3','Step 3']), { category: '常用服务' }),
  p('siliconflow', 'SiliconFlow 硅基流动', 'openai-chat', 'https://api.siliconflow.cn/v1', m(['deepseek-ai/DeepSeek-V4-Flash','DeepSeek V4 Flash'], ['MiniMaxAI/MiniMax-M3','MiniMax M3']), { category: '中国云 / 聚合' }),
  p('modelscope', 'ModelScope 魔搭', 'openai-chat', 'https://api-inference.modelscope.cn/v1', m(['Qwen/Qwen3-235B-A22B-Instruct-2507','Qwen3 235B']), { category: '中国云 / 聚合' }),
  p('openrouter', 'OpenRouter', 'openai-chat', 'https://openrouter.ai/api/v1', m(['openai/gpt-5.6','OpenAI · GPT-5.6'], ['anthropic/claude-sonnet-5','Anthropic · Claude Sonnet 5'], ['google/gemini-3.5-flash','Google · Gemini 3.5 Flash'], ['deepseek/deepseek-v4-flash','DeepSeek · V4 Flash']), { category: '国际聚合' }),
  p('nvidia', 'NVIDIA NIM', 'openai-chat', 'https://integrate.api.nvidia.com/v1', m(['meta/llama-4-maverick-17b-128e-instruct','Llama 4 Maverick']), { category: '国际聚合' }),
  p('groq', 'Groq', 'openai-chat', 'https://api.groq.com/openai/v1', m(['openai/gpt-oss-120b','GPT OSS 120B']), { category: '国际聚合' }),
  p('mistral', 'Mistral 官方', 'openai-chat', 'https://api.mistral.ai/v1', m(['mistral-large-latest','Mistral Large'], ['mistral-small-latest','Mistral Small'])),
  p('together', 'Together AI', 'openai-chat', 'https://api.together.xyz/v1', m(['meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8','Llama 4 Maverick']), { category: '国际聚合' }),
  p('fireworks', 'Fireworks AI', 'openai-chat', 'https://api.fireworks.ai/inference/v1', m(['accounts/fireworks/models/llama4-maverick-instruct-basic','Llama 4 Maverick']), { category: '国际聚合' }),
  p('cerebras', 'Cerebras', 'openai-chat', 'https://api.cerebras.ai/v1', m(['llama-4-scout-17b-16e-instruct','Llama 4 Scout']), { category: '国际聚合' }),
  p('sambanova', 'SambaNova Cloud', 'openai-chat', 'https://api.sambanova.ai/v1', m(['Meta-Llama-3.3-70B-Instruct','Llama 3.3 70B']), { category: '国际聚合' }),
  p('xai', 'xAI 官方', 'openai-chat', 'https://api.x.ai/v1', m(['grok-4','Grok 4'], ['grok-4-mini','Grok 4 Mini'])),
  p('perplexity', 'Perplexity Sonar', 'openai-chat', 'https://api.perplexity.ai', m(['sonar-pro','Sonar Pro'], ['sonar','Sonar'])),
  p('novita', 'Novita AI', 'openai-chat', 'https://api.novita.ai/openai', m(['deepseek/deepseek-v3','DeepSeek V3']), { category: '国际聚合' }),
  p('ollama', 'Ollama 本地', 'openai-chat', 'http://localhost:11434/v1', m(['qwen3:8b','Qwen3 8B'], ['llama3.3','Llama 3.3']), { category: '本地', authMode: 'none', keyOptional: true }),
  p('lmstudio', 'LM Studio 本地', 'openai-chat', 'http://localhost:1234/v1', m(['local-model','当前已加载模型']), { category: '本地', authMode: 'none', keyOptional: true }),

  // CC Switch 目录里常见、但端点取决于地区/套餐/中转商的模板。默认禁用，避免给出可能过期的地址。
  ...[
    ['aihubmix','AiHubMix'], ['dmxapi','DMXAPI'], ['packycode','PackyCode'], ['zetaapi','ZetaAPI'], ['apinebula','APINebula'],
    ['pateway','PatewayAI'], ['fenno','Fenno.ai'], ['runapi','RunAPI'], ['claudeapi','ClaudeAPI'], ['code0','code0.ai'],
    ['teamorouter','TeamoRouter'], ['compshare','Compshare'], ['cubence','Cubence'], ['aigocode','AIGoCode'], ['rightcode','RightCode'],
    ['aicodemirror','AICodeMirror'], ['aicoding','AICoding'], ['crazyrouter','CrazyRouter'], ['sssaicode','SSSAiCode'], ['kat-coder','KAT-Coder'],
    ['longcat','LongCat'], ['doubao-seed','DouBao Seed'], ['bailing','BaiLing'], ['xiaomi-mimo','Xiaomi MiMo'], ['therouter','TheRouter'],
    ['ddshub','DDSHub'], ['lionccapi','LionCCAPI'], ['shengsuanyun','胜算云'], ['pipellm','PIPELLM'], ['eflowcode','E-FlowCode'],
    ['apihub','APIHub'], ['oneapi','OneAPI / NewAPI'], ['newapi','New API'], ['zenmux','ZenMux'], ['openai-compatible','通用 OpenAI 兼容'],
    ['anthropic-compatible','通用 Anthropic 兼容'], ['gemini-compatible','通用 Gemini 兼容']
  ].map(([id,name]) => p(id, `${name}（模板）`, 'openai-chat', '', m(['model-id','填写模型 ID']), {
    category: 'CC Switch 模板', enabled: false, templateOnly: true, description: '供应商模板：请从服务商控制台填写 Base URL、API Key 与模型列表。'
  }))
];

export const PROTOCOL_OPTIONS = [
  { id: 'codex-app-server', label: 'Codex App Server（ChatGPT OAuth）' },
  { id: 'openai-chat', label: 'OpenAI Chat Completions' },
  { id: 'openai-responses', label: 'OpenAI Responses' },
  { id: 'anthropic-messages', label: 'Anthropic Messages' },
  { id: 'gemini-generate-content', label: 'Gemini generateContent' }
];

export const AUTH_MODE_OPTIONS = [
  { id: 'bearer', label: 'Authorization: Bearer' },
  { id: 'x-api-key', label: 'x-api-key' },
  { id: 'api-key', label: 'api-key' },
  { id: 'x-goog-api-key', label: 'x-goog-api-key' },
  { id: 'none', label: '无需认证' }
];

export function clonePresetProfiles() { return structuredClone(PROVIDER_PRESETS); }
