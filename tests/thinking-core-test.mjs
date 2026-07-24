import assert from 'node:assert/strict';
import {
  makeDefaultGoal,
  normalizeGoalState,
  confirmedGoal,
  proposeGoal,
  acceptGoalProposal,
  rejectGoalProposal,
  setConfirmedUserGoal,
  sliceMessagesThrough,
  estimateTokens,
  buildContextMetrics,
  makeArtifactRecord,
  makeReasoningEdge,
  makeDecisionArtifactRecord
} from '../thinking-core.js';

const at = '2026-07-24T10:00:00.000Z';
const base = makeDefaultGoal(at);
const proposed = proposeGoal(base, '验证一个可执行方向', { id: 'suggestion_1', at });
assert.equal(proposed.pending.text, '验证一个可执行方向');
assert.equal(proposed.history.at(-1).status, 'suggested');
assert.deepEqual(confirmedGoal(proposed), { text: '', source: 'unset', status: 'unset', version: 0 }, 'pending AI proposal must not become model context');

const accepted = acceptGoalProposal(proposed, '', { id: 'goal_accept_1', at });
assert.equal(accepted.text, '验证一个可执行方向');
assert.equal(accepted.status, 'accepted');
assert.equal(accepted.version, 1);
assert.equal(confirmedGoal(accepted).text, accepted.text);

const proposedEdit = proposeGoal(accepted, 'AI 的第二个建议', { id: 'suggestion_2', at });
const edited = acceptGoalProposal(proposedEdit, '用户修订后的目标', { id: 'goal_edit_1', at });
assert.equal(edited.status, 'edited');
assert.equal(edited.source, 'user');
assert.equal(edited.version, 2);
assert.equal(confirmedGoal(edited).text, '用户修订后的目标');

const rejected = rejectGoalProposal(proposeGoal(base, '不应生效', { id: 'suggestion_3', at }), { id: 'reject_1', at });
assert.equal(rejected.pending, null);
assert.equal(confirmedGoal(rejected).text, '');
assert.equal(rejected.history.at(-1).status, 'rejected');

const direct = setConfirmedUserGoal(base, '用户直接设定', { id: 'goal_user_1', at });
assert.equal(direct.status, 'edited');
assert.equal(direct.version, 1);

const migrated = normalizeGoalState({ text: 'v11 已使用的 AI 目标', source: 'ai', version: 3, history: [] }, at);
assert.equal(migrated.status, 'accepted', 'existing v11 goal semantics must survive migration');
assert.equal(confirmedGoal(migrated).version, 3);

const messages = [
  { id: 'm1', content: '第一条' },
  { id: 'm2', content: '第二条' },
  { id: 'm3', content: '第三条不应继承' }
];
assert.deepEqual(sliceMessagesThrough(messages, 'm2').messages.map(item => item.id), ['m1', 'm2']);
assert.equal(sliceMessagesThrough(messages, 'missing').found, false);

assert.ok(estimateTokens('中文上下文与 English tokens 123') > 0);
const metrics = buildContextMetrics([
  { key: 'required', label: '必选', required: true, text: '必须包含' },
  { key: 'off', label: '关闭', included: false, text: '不应计入' }
]);
assert.ok(metrics.estimatedInputTokens > 0);
assert.equal(metrics.sections[1].estimatedTokens, 0);

const evidence = makeArtifactRecord({
  id: 'artifact_evidence', kind: 'evidence', title: '来源证据', content: '原文证据', nodeId: 'root',
  sourceMessageId: 'm2', sourceStart: 4, sourceEnd: 8, sourceText: '原文证据', confidenceStatus: 'verified'
}, at);
assert.equal(evidence.kind, 'evidence');
assert.equal(evidence.sourceStart, 4);
assert.equal(evidence.sourceEnd, 8);
assert.equal(evidence.confidenceStatus, 'verified');

assert.equal(makeReasoningEdge({ id: 'self', sourceArtifactId: 'artifact_evidence', targetArtifactId: 'artifact_evidence', relation: 'supports' }, at), null);
const relation = makeReasoningEdge({ id: 'edge_1', sourceArtifactId: 'artifact_evidence', targetArtifactId: 'artifact_claim', relation: 'refutes' }, at);
assert.equal(relation.relation, 'refutes');

const decision = makeDecisionArtifactRecord({
  id: 'artifact_decision', nodeId: 'merge_1', content: '优先验证最短闭环',
  rationale: ['证据充分', '证据充分'],
  supportingEvidenceIds: ['artifact_evidence', 'artifact_evidence'],
  rejectedOptionIds: ['option_1', 'option_1'],
  unresolvedRisks: ['客户入口仍需验证'],
  nextActions: ['访谈 5 位客户'], sourceNodeIds: ['a', 'b', 'a'], goalVersion: 2
}, at);
assert.equal(decision.kind, 'decision');
assert.deepEqual(decision.decisionData.supportingEvidenceIds, ['artifact_evidence']);
assert.deepEqual(decision.decisionData.rejectedOptionIds, ['option_1']);
assert.deepEqual(decision.decisionData.sourceNodeIds, ['a', 'b']);
assert.equal(decision.decisionData.goalVersion, 2);

console.log('PASS: goal consent, cutoff context, token metrics, traceable artifacts, semantic relations and decision records.');
