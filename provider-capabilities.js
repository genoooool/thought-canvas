export const REASONING_EFFORT_ORDER = ['auto', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];

export const REASONING_EFFORT_LABELS = {
  auto: '自动',
  none: '关闭思考',
  minimal: '极简',
  low: '低',
  medium: '中',
  high: '高',
  xhigh: '很高',
  max: '最高'
};

export const REASONING_MODE_OPTIONS = [
  { id: 'auto', label: '自动识别' },
  { id: 'none', label: '不发送思考参数' },
  { id: 'openai', label: 'OpenAI reasoning effort' },
  { id: 'deepseek', label: 'DeepSeek thinking / effort' },
  { id: 'anthropic', label: 'Anthropic adaptive thinking' },
  { id: 'gemini', label: 'Gemini thinking level' },
  { id: 'codex', label: 'Codex App Server effort' }
];

const aliases = new Map([
  ['off', 'none'], ['disabled', 'none'], ['disable', 'none'], ['false', 'none'], ['0', 'none'],
  ['min', 'minimal'], ['minimum', 'minimal'], ['lowest', 'minimal'],
  ['extra_high', 'xhigh'], ['extra-high', 'xhigh'], ['very_high', 'xhigh'], ['very-high', 'xhigh'],
  ['maximum', 'max'], ['highest', 'max'], ['default', 'auto'], ['adaptive', 'auto']
]);

export function normalizeReasoningEffort(value, fallback = 'auto') {
  const raw = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  const normalized = aliases.get(raw) || raw;
  return REASONING_EFFORT_ORDER.includes(normalized) ? normalized : fallback;
}

export function normalizeReasoningEfforts(values, { includeAuto = true } = {}) {
  const source = Array.isArray(values) ? values : values == null ? [] : [values];
  const seen = new Set();
  for (const item of source) {
    const candidate = typeof item === 'object' && item
      ? item.reasoningEffort ?? item.reasoning_effort ?? item.effort ?? item.id ?? item.value ?? item.name
      : item;
    const normalized = normalizeReasoningEffort(candidate, '');
    if (normalized) seen.add(normalized);
  }
  if (includeAuto) seen.add('auto');
  return REASONING_EFFORT_ORDER.filter(item => seen.has(item));
}

function explicitEfforts(raw) {
  if (!raw || typeof raw !== 'object') return [];
  const candidates = [
    raw.reasoningEfforts,
    raw.supportedReasoningEfforts,
    raw.reasoning_efforts,
    raw.supported_reasoning_efforts,
    raw.capabilities?.reasoningEfforts,
    raw.capabilities?.reasoning_efforts,
    raw.capabilities?.reasoning?.efforts,
    raw.reasoning?.efforts
  ];
  for (const candidate of candidates) {
    const normalized = normalizeReasoningEfforts(candidate, { includeAuto: false });
    if (normalized.length) return normalized;
  }
  return [];
}

export function inferReasoningMode(profile = {}, modelId = '') {
  const explicit = String(profile.reasoningMode || '').trim().toLowerCase();
  if (REASONING_MODE_OPTIONS.some(item => item.id === explicit) && explicit !== 'auto') return explicit;
  const protocol = String(profile.protocol || '').toLowerCase();
  const providerId = String(profile.id || profile.providerId || '').toLowerCase();
  const model = String(modelId || '').toLowerCase();
  if (protocol === 'codex-app-server' || protocol === 'codex-cli' || providerId.startsWith('codex')) return 'codex';
  if (providerId.includes('deepseek') || model.includes('deepseek') || /(^|[/_-])(r1|reasoner)(?:$|[/_.-])/.test(model)) return 'deepseek';
  if (protocol === 'anthropic-messages' || providerId.includes('anthropic') || model.includes('claude')) return 'anthropic';
  if (protocol === 'gemini-generate-content' || providerId.includes('gemini') || model.includes('gemini')) return 'gemini';
  if (protocol === 'openai-responses' || providerId === 'openai') return 'openai';
  if (protocol === 'openai-chat' && /(^|[/_-])(gpt-5|o1|o3|o4)(?:$|[/_.-])/.test(model)) return 'openai';
  return 'none';
}

function inferredEfforts(profile, modelId) {
  const mode = inferReasoningMode(profile, modelId);
  const model = String(modelId || '').toLowerCase();
  if (mode === 'codex') return ['low', 'medium', 'high', 'xhigh'];
  if (mode === 'openai') return ['none', 'minimal', 'low', 'medium', 'high'];
  if (mode === 'deepseek') return ['none', 'high', 'max'];
  if (mode === 'anthropic') return ['low', 'medium', 'high', 'max'];
  if (mode === 'gemini') {
    if (model.includes('gemini-3')) return ['minimal', 'low', 'medium', 'high'];
    if (model.includes('gemini-2.5')) return ['low', 'medium', 'high'];
    return ['low', 'medium', 'high'];
  }
  return [];
}

export function normalizeModelRecord(raw, profile = {}) {
  const source = typeof raw === 'string' ? { id: raw, label: raw } : (raw && typeof raw === 'object' ? raw : {});
  let id = String(source.id || source.model || source.slug || source.name || '').trim();
  if (profile.protocol === 'gemini-generate-content') id = id.replace(/^models\//, '');
  const label = String(source.label || source.displayName || source.display_name || source.title || id).trim() || id;
  const declared = explicitEfforts(source);
  const inferred = declared.length ? declared : inferredEfforts(profile, id);
  const reasoningEfforts = normalizeReasoningEfforts(inferred, { includeAuto: true });
  const requestedDefault = source.defaultReasoningEffort
    ?? source.default_reasoning_effort
    ?? source.defaultEffort
    ?? source.default_effort
    ?? source.reasoning?.default;
  let defaultReasoningEffort = normalizeReasoningEffort(requestedDefault, 'auto');
  if (!reasoningEfforts.includes(defaultReasoningEffort)) defaultReasoningEffort = 'auto';
  const inputModalities = [...new Set((Array.isArray(source.inputModalities)
    ? source.inputModalities
    : Array.isArray(source.input_modalities)
      ? source.input_modalities
      : []).map(item => String(item).trim().toLowerCase()).filter(Boolean))];
  const result = {
    id,
    label,
    reasoningEfforts,
    defaultReasoningEffort,
    reasoningSupported: reasoningEfforts.some(item => item !== 'auto'),
    capabilitySource: String(source.capabilitySource || source.capability_source || (declared.length ? 'provider' : 'inferred'))
  };
  if (inputModalities.length) result.inputModalities = inputModalities;
  if (source.isDefault === true || source.is_default === true) result.isDefault = true;
  const contextWindow = Number(source.contextWindow || source.context_window || source.contextWindowTokens || source.context_window_tokens);
  if (Number.isFinite(contextWindow) && contextWindow > 0) result.contextWindow = contextWindow;
  return result;
}

export function normalizeDiscoveredModels(rawModels, profile = {}) {
  const seen = new Set();
  const result = [];
  for (const raw of Array.isArray(rawModels) ? rawModels : []) {
    const model = normalizeModelRecord(raw, profile);
    if (!model.id || seen.has(model.id)) continue;
    seen.add(model.id);
    result.push(model);
  }
  return result.sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;
    return a.label.localeCompare(b.label, 'zh-CN', { numeric: true, sensitivity: 'base' });
  });
}

export function reasoningOptionsForModel(profile = {}, modelId = '') {
  const model = (profile.models || []).find(item => item?.id === modelId);
  const normalized = normalizeModelRecord(model || { id: modelId, label: modelId }, profile);
  return normalized.reasoningEfforts.map(value => ({
    value,
    label: REASONING_EFFORT_LABELS[value] || value,
    meta: value === 'auto'
      ? normalized.defaultReasoningEffort === 'auto'
        ? '采用模型默认'
        : `采用${REASONING_EFFORT_LABELS[normalized.defaultReasoningEffort] || '模型默认'}`
      : ''
  }));
}

export function resolveReasoningEffort(profile = {}, modelId = '', requested = 'auto') {
  const model = (profile.models || []).find(item => item?.id === modelId);
  const normalized = normalizeModelRecord(model || { id: modelId, label: modelId }, profile);
  const value = normalizeReasoningEffort(requested, 'auto');
  return normalized.reasoningEfforts.includes(value) ? value : 'auto';
}

function clampEffort(value, allowed, fallback) {
  if (allowed.includes(value)) return value;
  if (['max', 'xhigh'].includes(value) && allowed.includes('high')) return 'high';
  if (value === 'minimal' && allowed.includes('low')) return 'low';
  return fallback;
}

export function buildReasoningRequestPatch(config = {}) {
  const effort = normalizeReasoningEffort(config.reasoningEffort, 'auto');
  if (effort === 'auto') return {};
  const mode = inferReasoningMode(config, config.model);
  if (mode === 'none' || mode === 'codex') return {};
  if (mode === 'openai') {
    if (config.protocol === 'openai-responses') return { reasoning: { effort } };
    return { reasoning_effort: effort };
  }
  if (mode === 'deepseek') {
    if (effort === 'none') return { thinking: { type: 'disabled' } };
    const mapped = ['max', 'xhigh'].includes(effort) ? 'max' : 'high';
    return { thinking: { type: 'enabled' }, reasoning_effort: mapped };
  }
  if (mode === 'anthropic') {
    if (effort === 'none') return {};
    return {
      thinking: { type: 'adaptive' },
      output_config: { effort: clampEffort(effort, ['low', 'medium', 'high', 'max'], 'medium') }
    };
  }
  if (mode === 'gemini') {
    const model = String(config.model || '').toLowerCase();
    if (model.includes('gemini-2.5')) {
      const budgets = { none: 0, minimal: 512, low: 1024, medium: 8192, high: -1, xhigh: -1, max: -1 };
      return { generationConfig: { thinkingConfig: { thinkingBudget: budgets[effort] ?? -1 } } };
    }
    if (effort === 'none') return {};
    return {
      generationConfig: {
        thinkingConfig: { thinkingLevel: clampEffort(effort, ['minimal', 'low', 'medium', 'high'], 'medium') }
      }
    };
  }
  return {};
}

export function mergeReasoningIntoPayload(payload, config = {}) {
  const patch = buildReasoningRequestPatch(config);
  if (!patch.generationConfig) return { ...payload, ...patch };
  return {
    ...payload,
    ...patch,
    generationConfig: {
      ...(payload.generationConfig || {}),
      ...(patch.generationConfig || {}),
      thinkingConfig: {
        ...(payload.generationConfig?.thinkingConfig || {}),
        ...(patch.generationConfig?.thinkingConfig || {})
      }
    }
  };
}
