export const CONFIRMED_GOAL_STATUSES = new Set(['accepted', 'edited']);

function isoNow(value = '') {
  return value || new Date().toISOString();
}

export function makeDefaultGoal(at = '') {
  return {
    text: '',
    source: 'unset',
    status: 'unset',
    version: 0,
    updatedAt: isoNow(at),
    pending: null,
    history: []
  };
}

export function normalizeGoalState(value, at = '') {
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return makeDefaultGoal(at);
    const createdAt = isoNow(at);
    return {
      ...makeDefaultGoal(createdAt),
      text,
      source: 'user',
      status: 'edited',
      version: 1,
      updatedAt: createdAt,
      history: [{ id: 'legacy_goal_1', version: 1, text, source: 'user', status: 'edited', createdAt }]
    };
  }

  const raw = value && typeof value === 'object' ? value : {};
  const createdAt = isoNow(raw.updatedAt || at);
  const text = String(raw.text || '').trim();
  const source = text ? (raw.source === 'ai' ? 'ai' : 'user') : 'unset';
  let status = String(raw.status || '');
  if (!['unset', 'accepted', 'edited'].includes(status)) {
    // v11 AI goals were already used as facts. Preserve that behavior for
    // existing projects, while all new AI suggestions use `pending` instead.
    status = text ? (source === 'ai' ? 'accepted' : 'edited') : 'unset';
  }
  if (!text) status = 'unset';

  const pendingRaw = raw.pending && typeof raw.pending === 'object' ? raw.pending : null;
  const pendingText = String(pendingRaw?.text || '').trim();
  const pending = pendingText ? {
    id: String(pendingRaw.id || 'goal_suggestion_legacy'),
    text: pendingText,
    source: 'ai',
    status: 'suggested',
    createdAt: isoNow(pendingRaw.createdAt || createdAt)
  } : null;

  const history = Array.isArray(raw.history) ? raw.history.map((item, index) => {
    const itemText = String(item?.text || '').trim();
    const itemSource = item?.source === 'ai' ? 'ai' : itemText ? 'user' : 'unset';
    let itemStatus = String(item?.status || '');
    if (!['suggested', 'accepted', 'edited', 'rejected', 'unset', 'superseded'].includes(itemStatus)) {
      itemStatus = itemText ? (itemSource === 'ai' ? 'accepted' : 'edited') : 'unset';
    }
    return {
      id: String(item?.id || `goal_history_${index + 1}`),
      suggestionId: String(item?.suggestionId || ''),
      version: Number(item?.version || 0),
      text: itemText,
      source: itemSource,
      status: itemStatus,
      createdAt: isoNow(item?.createdAt || createdAt)
    };
  }) : [];

  return {
    ...makeDefaultGoal(createdAt),
    ...raw,
    text,
    source,
    status,
    version: Math.max(0, Number(raw.version || (text ? 1 : 0))),
    updatedAt: createdAt,
    pending,
    history
  };
}

export function confirmedGoal(goal) {
  const normalized = normalizeGoalState(goal);
  if (!normalized.text || !CONFIRMED_GOAL_STATUSES.has(normalized.status)) {
    return { text: '', source: 'unset', status: 'unset', version: 0 };
  }
  return {
    text: normalized.text,
    source: normalized.source,
    status: normalized.status,
    version: normalized.version
  };
}

export function proposeGoal(goal, text, { id = '', at = '' } = {}) {
  const current = normalizeGoalState(goal, at);
  const suggestion = String(text || '').trim();
  if (!suggestion) return current;
  const createdAt = isoNow(at);
  const pending = {
    id: id || `goal_suggestion_${Date.now()}`,
    text: suggestion,
    source: 'ai',
    status: 'suggested',
    createdAt
  };
  return {
    ...current,
    pending,
    updatedAt: createdAt,
    history: [...current.history, {
      id: `${pending.id}_suggested`,
      suggestionId: pending.id,
      version: current.version,
      text: suggestion,
      source: 'ai',
      status: 'suggested',
      createdAt
    }]
  };
}

export function acceptGoalProposal(goal, editedText = '', { id = '', at = '' } = {}) {
  const current = normalizeGoalState(goal, at);
  if (!current.pending) return current;
  const createdAt = isoNow(at);
  const proposed = current.pending.text;
  const text = String(editedText || proposed).trim();
  if (!text) return rejectGoalProposal(current, { id, at: createdAt });
  const edited = text !== proposed;
  const version = current.version + 1;
  const source = edited ? 'user' : 'ai';
  const status = edited ? 'edited' : 'accepted';
  return {
    ...current,
    text,
    source,
    status,
    version,
    pending: null,
    updatedAt: createdAt,
    history: [...current.history, {
      id: id || `${current.pending.id}_${status}`,
      suggestionId: current.pending.id,
      version,
      text,
      source,
      status,
      createdAt
    }]
  };
}

export function rejectGoalProposal(goal, { id = '', at = '' } = {}) {
  const current = normalizeGoalState(goal, at);
  if (!current.pending) return current;
  const createdAt = isoNow(at);
  const pending = current.pending;
  return {
    ...current,
    pending: null,
    updatedAt: createdAt,
    history: [...current.history, {
      id: id || `${pending.id}_rejected`,
      suggestionId: pending.id,
      version: current.version,
      text: pending.text,
      source: 'ai',
      status: 'rejected',
      createdAt
    }]
  };
}

export function setConfirmedUserGoal(goal, text, { id = '', at = '' } = {}) {
  const current = normalizeGoalState(goal, at);
  const normalizedText = String(text || '').trim();
  if (normalizedText === current.text && current.status === (normalizedText ? 'edited' : 'unset') && !current.pending) return current;
  const createdAt = isoNow(at);
  const version = current.version + 1;
  const status = normalizedText ? 'edited' : 'unset';
  return {
    ...current,
    text: normalizedText,
    source: normalizedText ? 'user' : 'unset',
    status,
    version,
    pending: null,
    updatedAt: createdAt,
    history: [...current.history, {
      id: id || `goal_user_${Date.now()}`,
      suggestionId: current.pending?.id || '',
      version,
      text: normalizedText,
      source: normalizedText ? 'user' : 'unset',
      status,
      createdAt
    }]
  };
}

export function sliceMessagesThrough(messages, cutoffMessageId = '') {
  const list = Array.isArray(messages) ? messages : [];
  if (!cutoffMessageId) return { messages: [...list], found: true, cutoffIndex: list.length - 1 };
  const cutoffIndex = list.findIndex(message => message?.id === cutoffMessageId);
  if (cutoffIndex < 0) return { messages: [], found: false, cutoffIndex: -1 };
  return { messages: list.slice(0, cutoffIndex + 1), found: true, cutoffIndex };
}

export function estimateTokens(value) {
  const text = String(value || '');
  if (!text) return 0;
  const cjk = (text.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
  const latinWords = (text.match(/[A-Za-z0-9_]+(?:[-./][A-Za-z0-9_]+)*/g) || []).length;
  const punctuation = (text.match(/[^\sA-Za-z0-9_\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
  return Math.max(1, Math.ceil(cjk / 1.55 + latinWords * 1.25 + punctuation * 0.25));
}

export function buildContextMetrics(sections) {
  const normalized = (Array.isArray(sections) ? sections : []).map(section => {
    const text = String(section?.text || '');
    const included = section?.included !== false;
    return {
      key: String(section?.key || ''),
      label: String(section?.label || section?.key || ''),
      included,
      required: Boolean(section?.required),
      text,
      characters: text.length,
      estimatedTokens: included ? estimateTokens(text) : 0
    };
  });
  return {
    sections: normalized,
    estimatedInputTokens: normalized.reduce((sum, section) => sum + section.estimatedTokens, 0)
  };
}

export const ARTIFACT_KIND_LABELS = Object.freeze({
  claim: '观点',
  evidence: '证据',
  assumption: '假设',
  question: '问题',
  option: '方案',
  risk: '风险',
  action: '行动',
  decision: '决策'
});

export const REASONING_RELATION_LABELS = Object.freeze({
  supports: '支持',
  refutes: '反驳',
  depends_on: '依赖'
});

export const CONFIDENCE_STATUS_LABELS = Object.freeze({
  unverified: '未验证',
  partial: '部分证据',
  verified: '已验证',
  contested: '有争议'
});

export function makeArtifactRecord(input = {}, at = '') {
  const kind = Object.hasOwn(ARTIFACT_KIND_LABELS, input.kind) ? input.kind : 'claim';
  const content = String(input.content || input.sourceText || '').trim();
  const createdAt = isoNow(input.createdAt || at);
  const start = Number.isFinite(input.sourceStart) ? Number(input.sourceStart) : -1;
  const end = Number.isFinite(input.sourceEnd) ? Number(input.sourceEnd) : start >= 0 ? start + content.length : -1;
  return {
    id: String(input.id || ''),
    kind,
    title: String(input.title || content.split(/\n/)[0] || ARTIFACT_KIND_LABELS[kind]).trim().slice(0, 120),
    content,
    nodeId: String(input.nodeId || ''),
    sourceMessageId: String(input.sourceMessageId || ''),
    sourceStart: start,
    sourceEnd: end,
    sourceText: String(input.sourceText || content),
    contextSnapshotId: String(input.contextSnapshotId || ''),
    workStatus: ['open', 'resolved', 'archived'].includes(input.workStatus) ? input.workStatus : 'open',
    confidenceStatus: Object.hasOwn(CONFIDENCE_STATUS_LABELS, input.confidenceStatus) ? input.confidenceStatus : 'unverified',
    decisionData: input.decisionData && typeof input.decisionData === 'object' ? structuredClone(input.decisionData) : null,
    createdAt,
    updatedAt: isoNow(input.updatedAt || createdAt)
  };
}

export function makeReasoningEdge(input = {}, at = '') {
  const relation = Object.hasOwn(REASONING_RELATION_LABELS, input.relation) ? input.relation : 'supports';
  const sourceArtifactId = String(input.sourceArtifactId || '');
  const targetArtifactId = String(input.targetArtifactId || '');
  if (!sourceArtifactId || !targetArtifactId || sourceArtifactId === targetArtifactId) return null;
  return {
    id: String(input.id || ''),
    sourceArtifactId,
    targetArtifactId,
    relation,
    createdAt: isoNow(input.createdAt || at)
  };
}

export function makeDecisionArtifactRecord(input = {}, at = '') {
  const decisionData = {
    decision: String(input.decision || input.content || '').trim(),
    rationale: Array.isArray(input.rationale) ? input.rationale.map(String).filter(Boolean) : [],
    supportingEvidenceIds: Array.isArray(input.supportingEvidenceIds) ? [...new Set(input.supportingEvidenceIds.map(String).filter(Boolean))] : [],
    rejectedOptionIds: Array.isArray(input.rejectedOptionIds) ? [...new Set(input.rejectedOptionIds.map(String).filter(Boolean))] : [],
    unresolvedRisks: Array.isArray(input.unresolvedRisks) ? input.unresolvedRisks.map(String).filter(Boolean) : [],
    nextActions: Array.isArray(input.nextActions) ? input.nextActions.map(String).filter(Boolean) : [],
    sourceNodeIds: Array.isArray(input.sourceNodeIds) ? [...new Set(input.sourceNodeIds.map(String).filter(Boolean))] : [],
    goalVersion: Math.max(0, Number(input.goalVersion || 0)),
    contextSnapshotId: String(input.contextSnapshotId || '')
  };
  return makeArtifactRecord({
    ...input,
    kind: 'decision',
    content: decisionData.decision,
    decisionData,
    confidenceStatus: input.confidenceStatus || 'partial'
  }, at);
}
