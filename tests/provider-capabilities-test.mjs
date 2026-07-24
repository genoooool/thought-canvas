import assert from 'node:assert/strict';
import {
  normalizeModelRecord,
  normalizeDiscoveredModels,
  reasoningOptionsForModel,
  resolveReasoningEffort,
  buildReasoningRequestPatch,
  mergeReasoningIntoPayload
} from '../provider-capabilities.js';

const codexProfile = { id: 'codex-app', protocol: 'codex-app-server', models: [] };
const codexModel = normalizeModelRecord({
  id: 'gpt-5.6-codex',
  displayName: 'GPT-5.6 Codex',
  supportedReasoningEfforts: [{ reasoningEffort: 'low' }, { reasoningEffort: 'medium' }, { reasoningEffort: 'high' }],
  defaultReasoningEffort: 'medium',
  inputModalities: ['text', 'image'],
  isDefault: true
}, codexProfile);
assert.deepEqual(codexModel.reasoningEfforts, ['auto', 'low', 'medium', 'high']);
assert.equal(codexModel.defaultReasoningEffort, 'medium');
assert.equal(codexModel.isDefault, true);
assert.deepEqual(codexModel.inputModalities, ['text', 'image']);

const discovered = normalizeDiscoveredModels([
  { id: 'z-model', display_name: 'Z Model' },
  { id: 'a-model', display_name: 'A Model', is_default: true },
  { id: 'a-model', display_name: 'duplicate' }
], { id: 'openai', protocol: 'openai-responses' });
assert.deepEqual(discovered.map(item => item.id), ['a-model', 'z-model']);

const deepseek = { id: 'deepseek', protocol: 'openai-chat', models: [{ id: 'deepseek-reasoner', label: 'Reasoner' }] };
assert.deepEqual(reasoningOptionsForModel(deepseek, 'deepseek-reasoner').map(item => item.value), ['auto', 'none', 'high', 'max']);
assert.equal(resolveReasoningEffort(deepseek, 'deepseek-reasoner', 'medium'), 'auto');
assert.deepEqual(buildReasoningRequestPatch({ ...deepseek, model: 'deepseek-reasoner', reasoningEffort: 'max' }), {
  thinking: { type: 'enabled' }, reasoning_effort: 'max'
});
assert.deepEqual(buildReasoningRequestPatch({ ...deepseek, model: 'deepseek-reasoner', reasoningEffort: 'none' }), {
  thinking: { type: 'disabled' }
});

assert.deepEqual(buildReasoningRequestPatch({ id: 'openai', protocol: 'openai-responses', model: 'gpt-5.6', reasoningEffort: 'high' }), {
  reasoning: { effort: 'high' }
});
assert.deepEqual(buildReasoningRequestPatch({ id: 'openai-compatible', protocol: 'openai-chat', model: 'gpt-5', reasoningEffort: 'low' }), {
  reasoning_effort: 'low'
});
assert.deepEqual(buildReasoningRequestPatch({ id: 'anthropic', protocol: 'anthropic-messages', model: 'claude-sonnet-5', reasoningEffort: 'xhigh' }), {
  thinking: { type: 'adaptive' }, output_config: { effort: 'high' }
});
assert.deepEqual(mergeReasoningIntoPayload(
  { generationConfig: { maxOutputTokens: 100 } },
  { id: 'gemini', protocol: 'gemini-generate-content', model: 'gemini-3-flash', reasoningEffort: 'minimal' }
), {
  generationConfig: { maxOutputTokens: 100, thinkingConfig: { thinkingLevel: 'minimal' } }
});

console.log('PASS: provider capability normalization and reasoning payload mapping');
