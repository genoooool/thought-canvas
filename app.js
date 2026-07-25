import { PROVIDER_PRESETS, PROTOCOL_OPTIONS, AUTH_MODE_OPTIONS, clonePresetProfiles } from './providers.js';
import {
  REASONING_EFFORT_LABELS,
  REASONING_MODE_OPTIONS,
  normalizeModelRecord,
  normalizeDiscoveredModels,
  reasoningOptionsForModel,
  resolveReasoningEffort,
  inferReasoningMode
} from './provider-capabilities.js';
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
  ARTIFACT_KIND_LABELS,
  REASONING_RELATION_LABELS,
  CONFIDENCE_STATUS_LABELS,
  makeArtifactRecord,
  makeReasoningEdge,
  makeDecisionArtifactRecord
} from './thinking-core.js';
import { resolveMarkdownSelection } from './selection-utils.js';
import { repairUtf8Mojibake, repairUtf8MojibakeDeep } from './text-encoding.js';
import {
  NODE_W,
  NODE_MIN_H,
  NODE_MAX_H,
  COLUMN_GAP,
  NODE_GAP,
  GROUP_GAP,
  computeBounds,
  layoutChildGroup,
  layoutTree,
  nearestVerticalTranslation,
  stableLayoutComparator,
  translatePositions,
  validateLayoutInvariants
} from './layout-engine.js';
import {
  DEFAULT_UI_LANGUAGE,
  UI_LANGUAGE_OPTIONS,
  normalizeUiLanguage,
  setUiLanguage,
  startUiLocalization,
  localizeUi,
  localeForIntl,
  t,
  responseLanguageInstruction
} from './i18n.js';
const APP_VERSION = '1.2.6';
const LEGACY_STORAGE_KEYS = ['thought-canvas-mvp-state-v8', 'thought-canvas-mvp-state-v7', 'thought-canvas-mvp-state-v6'];
const LEGACY_API_KEYS_KEYS = ['thought-canvas-api-keys-v8-session','thought-canvas-api-keys-v8-device','thought-canvas-api-keys-v6'];
const MERGE_CHAR_BUDGET = 48000;
const DEFAULT_COMPACT_MESSAGE_LIMIT = 12;
const ANNOTATION_TYPE_LABELS = Object.freeze({
  note: '标注',
  idea: '想法',
  question: '问题',
  risk: '风险',
  action: '行动'
});
const ANNOTATION_COLOR_STYLES = Object.freeze({
  auto: null,
  violet: {
    fill: 'rgba(169,140,255,.14)',
    border: 'rgba(207,192,255,.64)',
    accent: '#b7a6ef',
    label: '#d1c5f6',
    swatch: '#a98cff'
  },
  slate: {
    fill: 'rgba(132,150,178,.14)',
    border: 'rgba(168,187,216,.56)',
    accent: '#9eb7d7',
    label: '#c2d0e3',
    swatch: '#839ab9'
  },
  blue: {
    fill: 'rgba(98,153,218,.14)',
    border: 'rgba(139,190,244,.58)',
    accent: '#82b7e6',
    label: '#bcd9f0',
    swatch: '#6299da'
  },
  mint: {
    fill: 'rgba(102,190,156,.14)',
    border: 'rgba(133,222,186,.56)',
    accent: '#78d0ae',
    label: '#b9e5d1',
    swatch: '#66be9c'
  },
  amber: {
    fill: 'rgba(216,180,91,.15)',
    border: 'rgba(238,211,132,.58)',
    accent: '#ddbd6f',
    label: '#ead79d',
    swatch: '#d8b45b'
  },
  rose: {
    fill: 'rgba(218,125,139,.14)',
    border: 'rgba(241,165,177,.58)',
    accent: '#df8f9d',
    label: '#ecc0c7',
    swatch: '#da7d8b'
  }
});
const localSessionToken = document.querySelector('meta[name="thought-canvas-session"]')?.content || '';
const API_SESSION_HEADER = 'x-thought-canvas-session';
const API_ENCODING_REPAIR = Symbol('apiEncodingRepair');

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const now = () => new Date().toISOString();
const makeId = (prefix = 'id') => `${prefix}_${globalThis.crypto?.randomUUID?.().slice(0, 8) || Math.random().toString(36).slice(2, 10)}`;

function makeNode(overrides = {}) {
  return {
    id: makeId('node'),
    x: 0,
    y: 0,
    kind: 'answer_branch',
    origin: 'user_prompt',
    title: '待探索问题',
    question: '',
    content: '',
    summary: '',
    sourceText: '',
    sourceMessageId: '',
    sourceScope: '',
    sourceStart: -1,
    sourceEnd: -1,
    sectionOrder: 0,
    status: 'open',
    confidenceStatus: 'unverified',
    provider: '',
    model: '',
    reasoningEffort: 'auto',
    parentId: null,
    messages: [],
    decomposedMessageIds: [],
    compactSnapshots: [],
    activeCompactId: '',
    decompositions: [],
    contextSnapshotCache: {},
    confirmedSummary: '',
    contextSnapshot: null,
    contextSnapshotId: '',
    lastContextSnapshotId: '',
    branchAnchor: null,
    contextVersion: 0,
    goalVersion: 0,
    coverageIds: [],
    sourceNodeIds: [],
    decisionArtifactId: '',
    annotationType: '',
    annotationColor: 'auto',
    annotationSourceNodeId: '',
    annotationManualPosition: false,
    layoutStable: false,
    collapsed: false,
    groupId: '',
    layoutOrder: 0,
    archivedReason: '',
    preArchiveStatus: 'open',
    createdAt: now(),
    updatedAt: now(),
    ...overrides
  };
}

const defaultGoal = () => makeDefaultGoal(now());

const initialState = {
  version: APP_VERSION,
  projectId: '',
  projectTitle: '未命名项目',
  projectCreatedAt: '',
  projectUpdatedAt: '',
  restoredFromBackup: '',
  restoredAt: '',
  goal: defaultGoal(),
  constraints: [],
  uiLanguage: DEFAULT_UI_LANGUAGE,
  providers: clonePresetProfiles(),
  defaultProvider: 'deepseek',
  defaultModel: 'deepseek-v4-flash',
  defaultReasoningEffort: 'auto',
  mergeProvider: 'deepseek',
  mergeModel: 'deepseek-v4-flash',
  mergeReasoningEffort: 'auto',
  decomposePreset: 'structure',
  decomposePrompt: '',
  autoCompactEnabled: true,
  autoCompactMessageLimit: DEFAULT_COMPACT_MESSAGE_LIMIT,
  connectionShape: 'curve',
  connectionStroke: 'solid',
  contextVersionCounter: 0,
  contextSnapshots: [],
  generationRecords: [],
  modelCalls: [],
  artifacts: [],
  reasoningEdges: [],
  composerByNode: {},
  contextPreferencesByNode: {},
  providerKeyStorage: {},
  activeProviderEditorId: 'deepseek',
  showArchived: false,
  viewMode: 'all',
  sidebarWidth: 440,
  camera: { x: 145, y: 110, scale: 1 },
  selectedIds: ['root'],
  nodes: [makeNode({
    id: 'root',
    kind: 'root',
    origin: 'root',
    x: 180,
    y: 280,
    title: '从一个问题开始',
    summary: '首问会获得完整回答；是否拆解由你决定。',
    status: 'open'
  })],
  edges: []
};

let localGlobalSettings = null;
let providerSecretStatus = {};
let apiKeys = {};
let projectIndex = [];
let currentProjectId = '';
let state = structuredClone(initialState);
let projectSaveChain = Promise.resolve();
let pendingProjectSave = null;
let projectSavePumpRunning = false;
let projectSaveError = '';
let projectSaveStatus = 'saved';
let lastProjectSavedAt = '';
let projectSaveSequence = 0;
let busyIds = new Set();
let pendingMergeVisual = null;
let interactionMode = 'select';
let spacePressed = false;
let nodeDrag = null;
let canvasPan = null;
let boxSelection = null;
let sidebarResize = null;
let zoomSaveTimer = null;
let currentMergePlan = null;
let providerAutosaveTimer = null;
let providerSearchQuery = '';
let providerEditorModels = [];
let codexAuthSessionId = '';
let codexAuthPollTimer = null;
let codexAuthPopup = null;
let codexAuthOpenedUrl = '';
let codexAuthMode = 'browser';
let codexAuthSessionStatus = '';
let generalSettingsDirty = false;
let lastMessageSelection = null;
let lastSourceSelection = null;
let messageSelectionCaptureFrame = 0;
let branchDraftAnchor = null;
let lastSidebarNodeId = '';
let contextInspectorNodeId = '';
let contextInspectorMode = 'latest';
let nodeSearchQuery = '';
let searchResultIndex = -1;
let artifactDraftSource = null;
let relationSourceArtifactId = '';
let reasoningFilterKind = 'all';
let reasoningFilterConfidence = 'all';
let miniMapTransform = null;
let confirmationResolver = null;
let annotationDraftSourceId = '';
let annotationDraftPosition = null;
let annotationEditingNodeId = '';
let annotationDrag = null;
const generationControllers = new Map();
const streamingSaveTimers = new Map();
const conversationScrollByNode = new Map();
let pendingConversationScroll = null;
let pendingEncodingRepairCount = 0;
let encodingRepairNoticeShown = false;

function withEncodingRepairMetadata(source, repairs, repairedAt = '') {
  const count = Math.max(0, Number(repairs || 0));
  if (!count) return source;
  return {
    ...source,
    textEncodingRepairVersion: 1,
    textEncodingRepairedAt: repairedAt || String(source?.textEncodingRepairedAt || '') || now(),
    textEncodingRepairCount: Number(source?.textEncodingRepairCount || 0) + count
  };
}

function projectFromApiPayload(payload) {
  const repaired = repairUtf8MojibakeDeep(payload?.project || {});
  const transportRepairCount = Math.max(0, Number(payload?.[API_ENCODING_REPAIR] || 0));
  const clientRepairCount = repaired.repairs + transportRepairCount;
  const serverRepairCount = Math.max(0, Number(payload?.encodingRepair?.repairs || 0));
  pendingEncodingRepairCount += repaired.repairs + serverRepairCount;
  let project = repaired.value;
  if (clientRepairCount > 0) {
    project = withEncodingRepairMetadata(project, clientRepairCount);
  } else if (serverRepairCount > 0 && Number(project?.textEncodingRepairVersion || 0) < 1) {
    // A conforming server writes the migration metadata before returning the
    // project. Keep this fallback for older/mocked servers without double
    // counting a repair that is already represented in the project file.
    project = withEncodingRepairMetadata(project, serverRepairCount, payload?.encodingRepair?.repairedAt || '');
  }
  return project;
}

const viewport = $('#viewport');
const world = $('#world');
const nodesLayer = $('#nodesLayer');
const edgesSvg = $('#edgesSvg');
const sidebar = $('#sidebar');
const selectionRect = $('#selectionRect');
const selectionActions = $('#selectionActions');
const busyToast = $('#busyToast');

init();

async function init() {
  bindGlobalControls();
  bindCanvas();
  bindSidebarResize();
  await hydrateLocalConfig();
  setUiLanguage(localGlobalSettings?.uiLanguage || DEFAULT_UI_LANGUAGE, { localize: false });
  startUiLocalization();
  await hydrateWorkspace();
  applyUiLanguage(state.uiLanguage || localGlobalSettings?.uiLanguage || DEFAULT_UI_LANGUAGE, { rerender: false });
  applySidebarWidth();
  renderHomeModelSelectors();
  if (currentProjectId) render();
  else showHome({ persist: false });
  requestAnimationFrame(showPendingEncodingRepairNotice);
  // Detect a locally authenticated Codex CLI as soon as the app is ready.
  // This runs in the background so the first screen is not blocked while the
  // local App Server reports the account and model catalog.
  void refreshCodexOAuthStatus();
}

async function hydrateWorkspace() {
  try {
    const workspace = await apiGet('/api/workspace');
    const repairedIndex = repairUtf8MojibakeDeep(Array.isArray(workspace.projects) ? workspace.projects : []);
    projectIndex = repairedIndex.value;
    pendingEncodingRepairCount += repairedIndex.repairs;
    const activeId = String(workspace.activeProjectId || '');
    if (activeId) {
      const payload = await apiGet(`/api/projects/${encodeURIComponent(activeId)}`);
      currentProjectId = activeId;
      state = { ...structuredClone(initialState), ...loadGlobalSettings(), ...projectFromApiPayload(payload), projectId: activeId };
      normalizeState();
      return;
    }
  } catch (error) {
    showOperationError('无法读取本地项目文件', error);
  }
  currentProjectId = '';
  state = { ...structuredClone(initialState), ...loadGlobalSettings() };
  normalizeState();
}

async function hydrateLocalConfig() {
  try {
    const result = await apiGet('/api/local-config');
    const repairedSettings = repairUtf8MojibakeDeep(result.settings && typeof result.settings === 'object' ? result.settings : {});
    pendingEncodingRepairCount += repairedSettings.repairs;
    localGlobalSettings = repairedSettings.value;
    providerSecretStatus = result.secretStatus && typeof result.secretStatus === 'object' ? result.secretStatus : {};
    // Remove legacy browser-stored secrets after migration. Keys now live in .env.local only.
    for (const key of LEGACY_API_KEYS_KEYS) { try { localStorage.removeItem(key); sessionStorage.removeItem(key); } catch {} }
  } catch {
    localGlobalSettings = null;
    providerSecretStatus = {};
  }
}

function applyLocalGlobalSettings(settings) {
  if (!localGlobalSettings) return settings;
  const merged = { ...settings, ...structuredClone(localGlobalSettings) };
  merged.uiLanguage = normalizeUiLanguage(localGlobalSettings.uiLanguage || settings.uiLanguage);
  merged.providers = normalizeProviderProfiles(localGlobalSettings.providers || settings.providers);
  return merged;
}

function applyUiLanguage(language, { rerender = true } = {}) {
  const next = normalizeUiLanguage(language || DEFAULT_UI_LANGUAGE);
  state.uiLanguage = next;
  setUiLanguage(next);
  if ($('#uiLanguageSelect')) $('#uiLanguageSelect').value = next;
  if (!rerender) return next;
  renderHomeModelSelectors();
  if (currentProjectId) render();
  else showHome({ persist: false });
  localizeUi(document.documentElement);
  return next;
}


function globalSettingsFromState(source = state) {
  return {
    version: APP_VERSION,
    constraints: Array.isArray(source?.constraints) ? [...source.constraints] : [],
    uiLanguage: normalizeUiLanguage(source?.uiLanguage || DEFAULT_UI_LANGUAGE),
    providers: normalizeProviderProfiles(source?.providers || clonePresetProfiles()),
    defaultProvider: source?.defaultProvider || 'deepseek',
    defaultModel: source?.defaultModel || 'deepseek-v4-flash',
    defaultReasoningEffort: source?.defaultReasoningEffort || 'auto',
    mergeProvider: source?.mergeProvider || source?.defaultProvider || 'deepseek',
    mergeModel: source?.mergeModel || source?.defaultModel || 'deepseek-v4-flash',
    mergeReasoningEffort: source?.mergeReasoningEffort || source?.defaultReasoningEffort || 'auto',
    decomposePreset: source?.decomposePreset || 'structure',
    decomposePrompt: source?.decomposePrompt || '',
    autoCompactEnabled: source?.autoCompactEnabled !== false,
    autoCompactMessageLimit: clamp(Number(source?.autoCompactMessageLimit || DEFAULT_COMPACT_MESSAGE_LIMIT), 4, 100),
    connectionShape: source?.connectionShape === 'orthogonal' ? 'orthogonal' : 'curve',
    connectionStroke: source?.connectionStroke === 'dashed' ? 'dashed' : 'solid',
    providerKeyStorage: { ...(source?.providerKeyStorage || {}) },
    activeProviderEditorId: source?.activeProviderEditorId || 'deepseek',
    sidebarWidth: clamp(Number(source?.sidebarWidth || 440), 360, 680)
  };
}

function projectFieldsFromState(source = state) {
  return {
    version: APP_VERSION,
    textEncodingRepairVersion: Number(source.textEncodingRepairVersion || 0),
    textEncodingRepairedAt: String(source.textEncodingRepairedAt || ''),
    textEncodingRepairCount: Number(source.textEncodingRepairCount || 0),
    projectId: source.projectId,
    projectTitle: source.projectTitle,
    projectCreatedAt: source.projectCreatedAt,
    projectUpdatedAt: source.projectUpdatedAt,
    restoredFromBackup: String(source.restoredFromBackup || ''),
    restoredAt: String(source.restoredAt || ''),
    goal: structuredClone(source.goal),
    contextVersionCounter: Number(source.contextVersionCounter || 0),
    contextSnapshots: structuredClone(source.contextSnapshots || []),
    generationRecords: structuredClone(source.generationRecords || source.modelCalls || []),
    artifacts: structuredClone(source.artifacts || []),
    reasoningEdges: structuredClone(source.reasoningEdges || []),
    // Retained for backwards readers. v12 treats generationRecords as authoritative.
    modelCalls: structuredClone(source.generationRecords || source.modelCalls || []),
    composerByNode: structuredClone(source.composerByNode || {}),
    contextPreferencesByNode: structuredClone(source.contextPreferencesByNode || {}),
    showArchived: Boolean(source.showArchived),
    viewMode: source.viewMode === 'path' ? 'path' : 'all',
    camera: structuredClone(source.camera),
    selectedIds: [...(source.selectedIds || [])],
    nodes: structuredClone(source.nodes || []),
    edges: structuredClone(source.edges || [])
  };
}

function createBlankProjectState({ id = makeId('project'), title = '未命名项目', goal = '', provider = '', model = '', reasoningEffort = 'auto' } = {}) {
  const globals = loadGlobalSettings();
  const createdAt = now();
  const blank = structuredClone(initialState);
  Object.assign(blank, globals, {
    version: APP_VERSION,
    projectId: id,
    projectTitle: String(title || '未命名项目').trim().slice(0, 80) || '未命名项目',
    projectCreatedAt: createdAt,
    projectUpdatedAt: createdAt,
    goal: defaultGoal(),
    composerByNode: {},
    contextPreferencesByNode: {},
    contextSnapshots: [],
    generationRecords: [],
    modelCalls: [],
    artifacts: [],
    reasoningEdges: [],
    showArchived: false,
    viewMode: 'all',
    camera: { x: 145, y: 110, scale: 1 },
    selectedIds: ['root'],
    nodes: [makeNode({
      id: 'root', kind: 'root', origin: 'root', x: 180, y: 280,
      title: '从一个问题开始', summary: '首问会获得完整回答；是否拆解由你决定。', status: 'open'
    })],
    edges: []
  });
  if (goal) {
    blank.goal = setConfirmedUserGoal(defaultGoal(), String(goal).trim(), { id: makeId('goal'), at: createdAt });
  }
  const selectedProvider = getProviderFromList(blank.providers, provider)?.id || blank.defaultProvider;
  const selectedModel = ensureModelForProviderFromList(blank.providers, selectedProvider, model || (selectedProvider === blank.defaultProvider ? blank.defaultModel : ''));
  const selectedProfile = getProviderFromList(blank.providers, selectedProvider) || {};
  const selectedReasoning = resolveReasoningEffort(selectedProfile, selectedModel, reasoningEffort || 'auto');
  if (selectedProvider !== blank.defaultProvider || selectedModel !== blank.defaultModel || selectedReasoning !== blank.defaultReasoningEffort) {
    blank.composerByNode.root = { provider: selectedProvider, model: selectedModel, reasoningEffort: selectedReasoning };
  }
  return blank;
}

function renderHomeModelSelectors() {
  normalizeProviderSelections();
  const ready = selectableProviders();
  const provider = providerIsReady(getProvider(state.defaultProvider))
    ? state.defaultProvider
    : ready[0]?.id || state.defaultProvider || state.providers?.[0]?.id || '';
  const model = ensureModelForProvider(provider, state.defaultModel);
  const reasoningEffort = ensureReasoningForProvider(provider, model, state.defaultReasoningEffort || 'auto');
  const connected = providerIsReady(getProvider(provider));
  if ($('#homeProviderSelect')) {
    $('#homeProviderSelect').innerHTML = providerOptions(provider);
    $('#homeModelSelect').innerHTML = modelOptions(provider, model);
    $('#homeReasoningSelect').innerHTML = reasoningOptions(provider, model, reasoningEffort);
    $('#homeReasoningSelect').value = reasoningEffort;
    $('#homeProviderSelect').disabled = !ready.length;
    $('#homeModelSelect').disabled = !connected;
    $('#homeReasoningSelect').disabled = !connected || reasoningOptionsForModel(getProvider(provider) || {}, model).length <= 1;
  }
  if ($('#newProjectProviderSelect')) {
    $('#newProjectProviderSelect').innerHTML = providerOptions(provider);
    $('#newProjectModelSelect').innerHTML = modelOptions(provider, model);
    $('#newProjectReasoningSelect').innerHTML = reasoningOptions(provider, model, reasoningEffort);
    $('#newProjectReasoningSelect').value = reasoningEffort;
    $('#newProjectProviderSelect').disabled = !ready.length;
    $('#newProjectModelSelect').disabled = !connected;
    $('#newProjectReasoningSelect').disabled = !connected || reasoningOptionsForModel(getProvider(provider) || {}, model).length <= 1;
  }
  const providerName = getProvider(provider)?.name || '模型供应商';
  const hint = connected
    ? `${providerName} 已连接 · 模型与思考等级可在此覆盖`
    : '尚未连接可用模型。先用 API Key 或 ChatGPT OAuth 完成连接。';
  if ($('#homeModelConnectionHint')) $('#homeModelConnectionHint').textContent = hint;
  if ($('#newProjectModelHint')) $('#newProjectModelHint').textContent = hint;
  $('#homeConnectProviderBtn')?.classList.toggle('hidden', connected);
  $('#newProjectConnectProviderBtn')?.classList.toggle('hidden', connected);
  if ($('#homeStartBtn')) $('#homeStartBtn').disabled = !connected;
  if ($('#confirmNewProjectBtn')) $('#confirmNewProjectBtn').disabled = !connected;
}

function showHome({ persist = true } = {}) {
  if (persist && currentProjectId) saveState();
  currentProjectId = '';
  apiJson('/api/active-project', { projectId: '' }).catch(() => {});
  $('#homeView').classList.remove('hidden');
  $('#workspace').classList.add('hidden');
  $('.goal-bar').classList.add('hidden');
  $('.tool-rail').classList.add('hidden');
  $('#canvasNavigator')?.classList.add('hidden');
  $('#miniMap')?.classList.add('hidden');
  $('.project-bar').classList.add('home-mode');
  $('#topChrome')?.classList.add('home-mode');
  $('#homeBtn').classList.add('hidden');
  $('#newProjectBtn').classList.remove('hidden');
  $('.project-copy strong').textContent = 'Thought Canvas';
  $('.project-copy span').textContent = '从一个问题开始，建立可追溯的思考结构';
  renderHomeModelSelectors();
  renderRecentProjects();
  requestAnimationFrame(() => $('#homeQuestionInput')?.focus());
}

function enterWorkspace() {
  $('#homeView').classList.add('hidden');
  $('#workspace').classList.remove('hidden');
  $('.goal-bar').classList.remove('hidden');
  $('.tool-rail').classList.remove('hidden');
  $('#canvasNavigator')?.classList.remove('hidden');
  $('#miniMap')?.classList.remove('hidden');
  $('.project-bar').classList.remove('home-mode');
  $('#topChrome')?.classList.remove('home-mode');
  $('#homeBtn').classList.remove('hidden');
  $('#newProjectBtn').classList.remove('hidden');
  $('.project-copy strong').textContent = state.projectTitle || '未命名项目';
  $('.project-copy span').textContent = `${state.nodes.length} 个节点 · ${state.projectUpdatedAt ? formatProjectTime(state.projectUpdatedAt) : '刚刚更新'}`;
  if (!lastProjectSavedAt) lastProjectSavedAt = state.projectUpdatedAt || '';
  renderProjectSaveStatus();
}

function renderRecentProjects() {
  const grid = $('#recentProjectsGrid');
  $('#projectCountBadge').textContent = `${projectIndex.length} 个项目`;
  const createCard = `<button type="button" class="project-tile project-create-tile" id="projectCreateTile">
    <span class="project-create-plus">＋</span><strong>新建项目</strong><small>建立一张新的思考画布</small>
  </button>`;
  const cards = [...projectIndex].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).map(project => `
    <article class="project-tile" data-project-id="${escapeAttr(project.id)}">
      <button class="project-tile-main" data-open-project="${escapeAttr(project.id)}">
        <span class="project-preview"><i>${escapeHtml((project.title || '未').slice(0, 1))}</i><b>${Number(project.nodeCount || 1)} 节点</b></span>
        <span class="project-tile-copy"><strong>${escapeHtml(project.title || '未命名项目')}</strong><time>${escapeHtml(formatProjectTime(project.updatedAt))}</time></span>
        <span class="project-tile-summary">${escapeHtml(project.goal || project.summary || '等待继续探索')}</span>
      </button>
      <button class="project-card-delete" data-delete-project="${escapeAttr(project.id)}" title="删除项目" aria-label="删除项目">×</button>
    </article>`).join('');
  grid.innerHTML = createCard + cards;
  $('#projectCreateTile')?.addEventListener('click', openNewProjectDialog);
  $$('[data-open-project]').forEach(button => button.onclick = () => openProject(button.dataset.openProject));
  $$('[data-delete-project]').forEach(button => button.onclick = async event => {
    event.stopPropagation();
    const project = projectIndex.find(item => item.id === button.dataset.deleteProject);
    const confirmed = await requestConfirmation({
      eyebrow: '删除项目',
      title: `删除“${project?.title || '这个项目'}”？`,
      message: '项目文件及其本地版本会一起移除，该操作无法恢复。',
      confirmLabel: '删除项目',
      danger: true
    });
    if (confirmed) deleteProject(button.dataset.deleteProject);
  });
}

function openNewProjectDialog() {
  renderHomeModelSelectors();
  $('#newProjectTitleInput').value = '';
  $('#newProjectGoalInput').value = '';
  $('#newProjectDialog').showModal();
  requestAnimationFrame(() => $('#newProjectTitleInput').focus());
}

async function startProjectFromHome() {
  const question = repairUtf8Mojibake($('#homeQuestionInput').value.trim());
  if (!question) { $('#homeQuestionInput').focus(); return; }
  const provider = $('#homeProviderSelect').value || state.defaultProvider;
  const model = $('#homeModelSelect').value || ensureModelForProvider(provider, '');
  const reasoningEffort = $('#homeReasoningSelect')?.value || 'auto';
  if (!requireConnectedProvider(provider, { openSettings: true })) return;
  $('#homeQuestionInput').value = '';
  await createProject({ title: deriveTitle(question), provider, model, reasoningEffort, question });
}

function createProjectFromDialog() {
  const title = repairUtf8Mojibake($('#newProjectTitleInput').value.trim()) || '未命名项目';
  const goal = repairUtf8Mojibake($('#newProjectGoalInput').value.trim());
  const provider = $('#newProjectProviderSelect').value || state.defaultProvider;
  const model = $('#newProjectModelSelect').value || ensureModelForProvider(provider, '');
  const reasoningEffort = $('#newProjectReasoningSelect')?.value || 'auto';
  if (!requireConnectedProvider(provider, { openSettings: true })) return;
  $('#newProjectDialog').close();
  createProject({ title, goal, provider, model, reasoningEffort });
}

async function createProject({ title, goal = '', provider = '', model = '', reasoningEffort = 'auto', question = '' } = {}) {
  if (currentProjectId) await flushProjectSave();
  const id = makeId('project');
  currentProjectId = id;
  state = createBlankProjectState({ id, title, goal, provider, model, reasoningEffort });
  normalizeState();
  await persistProjectNow();
  await apiJson('/api/active-project', { projectId: id });
  applySidebarWidth();
  render();
  if (question) await sendFromNode('root', question, provider || state.defaultProvider, model || state.defaultModel, reasoningEffort);
}

async function openProject(id) {
  if (!id) return;
  if (currentProjectId) await flushProjectSave();
  try {
    const payload = await apiGet(`/api/projects/${encodeURIComponent(id)}`);
    currentProjectId = id;
    state = { ...structuredClone(initialState), ...loadGlobalSettings(), ...projectFromApiPayload(payload), projectId: id };
    normalizeState();
    await apiJson('/api/active-project', { projectId: id });
    applySidebarWidth();
    render();
    requestAnimationFrame(() => { fitView(); showPendingEncodingRepairNotice(); });
  } catch (error) {
    showOperationError('打开项目失败', error);
  }
}

async function deleteProject(id) {
  try {
    await apiDelete(`/api/projects/${encodeURIComponent(id)}`);
    projectIndex = projectIndex.filter(item => item.id !== id);
    if (currentProjectId === id) showHome({ persist: false });
    else renderRecentProjects();
  } catch (error) {
    showOperationError('删除项目失败', error);
  }
}

function updateProjectIndexEntry() {
  if (!currentProjectId) return;
  const root = getNode('root');
  const entry = {
    id: currentProjectId,
    title: state.projectTitle || root?.title || '未命名项目',
    goal: state.goal?.text || '',
    summary: root?.summary || root?.question || '',
    nodeCount: state.nodes?.length || 1,
    createdAt: state.projectCreatedAt || now(),
    updatedAt: state.projectUpdatedAt || now()
  };
  const index = projectIndex.findIndex(item => item.id === currentProjectId);
  if (index >= 0) projectIndex[index] = entry; else projectIndex.push(entry);
}


async function clearComposerOverridesInAllProjects() {
  for (const project of projectIndex) {
    try {
      const payload = await apiGet(`/api/projects/${encodeURIComponent(project.id)}`);
      const data = payload.project || {};
      data.composerByNode = {};
      await apiJson(`/api/projects/${encodeURIComponent(project.id)}`, { project: data });
    } catch {}
  }
  state.composerByNode = {};
}

function formatProjectTime(value) {
  if (!value) return t('刚刚');
  try {
    const date = new Date(value);
    const diff = Date.now() - date.getTime();
    if (diff < 60_000) return t('刚刚');
    if (diff < 3_600_000) return t(`${Math.max(1, Math.floor(diff / 60_000))} 分钟前`);
    if (diff < 86_400_000) return t(`${Math.floor(diff / 3_600_000)} 小时前`);
    return date.toLocaleDateString(localeForIntl(state.uiLanguage), { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function normalizeState() {
  const repairedState = repairUtf8MojibakeDeep(state);
  if (repairedState.repairs) {
    pendingEncodingRepairCount += repairedState.repairs;
    repairedState.value.textEncodingRepairVersion = 1;
    repairedState.value.textEncodingRepairedAt = now();
    repairedState.value.textEncodingRepairCount = Number(repairedState.value.textEncodingRepairCount || 0) + repairedState.repairs;
  }
  state = { ...structuredClone(initialState), ...repairedState.value };
  state.version = APP_VERSION;
  state.projectId = currentProjectId || state.projectId || '';
  state.projectTitle = String(state.projectTitle || '未命名项目').slice(0, 80);
  state.projectCreatedAt = state.projectCreatedAt || (currentProjectId ? now() : '');
  state.projectUpdatedAt = state.projectUpdatedAt || state.projectCreatedAt || '';
  state.uiLanguage = normalizeUiLanguage(localGlobalSettings?.uiLanguage || state.uiLanguage || DEFAULT_UI_LANGUAGE);
  state.goal = normalizeGoalState(state.goal, state.projectUpdatedAt || now());
  state.contextSnapshots = Array.isArray(state.contextSnapshots)
    ? state.contextSnapshots.filter(snapshot => snapshot && typeof snapshot === 'object' && snapshot.id).map(snapshot => structuredClone(snapshot))
    : [];
  const contextSnapshotIds = new Set(state.contextSnapshots.map(snapshot => snapshot.id));
  const registerLegacySnapshot = snapshot => {
    if (!snapshot || typeof snapshot !== 'object') return '';
    const id = String(snapshot.id || makeId('ctx'));
    if (!contextSnapshotIds.has(id)) {
      state.contextSnapshots.push({ ...structuredClone(snapshot), id, immutable: true });
      contextSnapshotIds.add(id);
    }
    return id;
  };
  state.providers = normalizeProviderProfiles(state.providers);
  state.nodes = (state.nodes || []).map(n => {
    const hasLayoutStable = Object.hasOwn(n, 'layoutStable');
    const node = makeNode(n);
    // Older projects already have intentional coordinates. Keep them fixed
    // during incremental placement; the explicit auto-layout action can still
    // reflow the whole canvas.
    node.layoutStable = hasLayoutStable ? Boolean(node.layoutStable) : true;
    if (['branch','section'].includes(node.kind) && ['auto_branch','manual_decompose','auto_decompose','selection_decompose'].includes(node.origin)) {
      node.kind = 'content_section';
      node.content = node.content || node.summary || node.question;
      node.sourceScope = node.sourceScope || 'message';
    }
    node.messages = (node.messages || []).map(message => {
      if (message.role !== 'assistant') return message;
      const normalized = { ...message, content: normalizeAssistantContent(message.content) };
      if (normalized.streaming) {
        normalized.streaming = false;
        normalized.partial = true;
        normalized.stoppedAt = normalized.stoppedAt || now();
        normalized.interruptionReason = normalized.interruptionReason || '页面重载后恢复为部分回答';
        normalized.emptyPartial = !String(normalized.content || '').trim();
      }
      return normalized;
    });
    node.compactSnapshots = Array.isArray(node.compactSnapshots) ? node.compactSnapshots : [];
    node.activeCompactId = node.activeCompactId || '';
    node.decomposedMessageIds = Array.isArray(node.decomposedMessageIds) ? node.decomposedMessageIds : [];
    node.sourceStart = Number.isFinite(node.sourceStart) ? node.sourceStart : -1;
    node.sourceEnd = Number.isFinite(node.sourceEnd) ? node.sourceEnd : -1;
    node.confidenceStatus = Object.hasOwn(CONFIDENCE_STATUS_LABELS, node.confidenceStatus) ? node.confidenceStatus : 'unverified';
    node.decisionArtifactId = String(node.decisionArtifactId || '');
    node.annotationType = Object.hasOwn(ANNOTATION_TYPE_LABELS, node.annotationType) ? node.annotationType : (node.kind === 'annotation' ? 'note' : '');
    node.annotationColor = Object.hasOwn(ANNOTATION_COLOR_STYLES, node.annotationColor) ? node.annotationColor : 'auto';
    node.annotationSourceNodeId = String(node.annotationSourceNodeId || (node.kind === 'annotation' ? node.parentId || '' : ''));
    node.annotationManualPosition = Boolean(node.annotationManualPosition);
    node.collapsed = Boolean(node.collapsed);
    if (node.contextSnapshot && !node.contextSnapshotId) node.contextSnapshotId = registerLegacySnapshot(node.contextSnapshot);
    node.contextSnapshotId = String(node.contextSnapshotId || '');
    node.lastContextSnapshotId = String(node.lastContextSnapshotId || node.contextSnapshotId || '');
    node.branchAnchor = node.branchAnchor && typeof node.branchAnchor === 'object'
      ? {
          nodeId: String(node.branchAnchor.nodeId || node.parentId || ''),
          cutoffMessageId: String(node.branchAnchor.cutoffMessageId || ''),
          contextSnapshotId: String(node.branchAnchor.contextSnapshotId || node.contextSnapshotId || '')
        }
      : null;
    const normalizedCache = {};
    for (const [fingerprint, cached] of Object.entries(node.contextSnapshotCache || {})) {
      const snapshotId = typeof cached === 'string' ? cached : registerLegacySnapshot(cached);
      if (snapshotId) normalizedCache[fingerprint] = snapshotId;
    }
    node.contextSnapshotCache = normalizedCache;
    if (node.kind === 'root' && node.messages.length) node.summary = summarizeForCard(latestAssistantText(node) || node.summary);
    return node;
  });
  if (!state.nodes.length) state.nodes = [makeNode({ id: 'root', kind: 'root', origin: 'root', x: 180, y: 280, title: '从一个问题开始', summary: '首问会获得完整回答；是否拆解由你决定。', status: 'open' })];
  const nodeIds = new Set(state.nodes.map(node => node.id));
  state.artifacts = (Array.isArray(state.artifacts) ? state.artifacts : [])
    .map(artifact => makeArtifactRecord(artifact, state.projectUpdatedAt || now()))
    .filter(artifact => artifact.id && nodeIds.has(artifact.nodeId));
  const artifactIds = new Set(state.artifacts.map(artifact => artifact.id));
  state.reasoningEdges = (Array.isArray(state.reasoningEdges) ? state.reasoningEdges : [])
    .map(edge => makeReasoningEdge(edge, state.projectUpdatedAt || now()))
    .filter(edge => edge && edge.id && artifactIds.has(edge.sourceArtifactId) && artifactIds.has(edge.targetArtifactId));
  state.edges = (Array.isArray(state.edges) ? state.edges : []).map(edge => ({ ...edge, relation: edge.relation === 'branch' ? (getNode(edge.target)?.kind === 'content_section' ? 'decomposed_from' : 'answer_to') : edge.relation }));
  state.defaultProvider = getProvider(state.defaultProvider)?.id || getProvider('deepseek')?.id || state.providers[0]?.id || '';
  state.defaultModel = ensureModelForProvider(state.defaultProvider, state.defaultModel);
  state.defaultReasoningEffort = ensureReasoningForProvider(state.defaultProvider, state.defaultModel, state.defaultReasoningEffort);
  state.mergeProvider = getProvider(state.mergeProvider)?.id || state.defaultProvider;
  state.mergeModel = ensureModelForProvider(state.mergeProvider, state.mergeModel);
  state.mergeReasoningEffort = ensureReasoningForProvider(state.mergeProvider, state.mergeModel, state.mergeReasoningEffort);
  state.decomposePreset = state.decomposePreset || 'structure';
  state.decomposePrompt = String(state.decomposePrompt || '');
  state.autoCompactEnabled = state.autoCompactEnabled !== false;
  state.autoCompactMessageLimit = clamp(Number(state.autoCompactMessageLimit || DEFAULT_COMPACT_MESSAGE_LIMIT), 4, 100);
  state.connectionShape = state.connectionShape === 'orthogonal' ? 'orthogonal' : 'curve';
  state.connectionStroke = state.connectionStroke === 'dashed' ? 'dashed' : 'solid';
  state.viewMode = state.viewMode === 'path' ? 'path' : 'all';
  state.contextVersionCounter = Number(state.contextVersionCounter || 0);
  state.generationRecords = Array.isArray(state.generationRecords) && state.generationRecords.length
    ? state.generationRecords
    : Array.isArray(state.modelCalls) ? state.modelCalls : [];
  state.modelCalls = state.generationRecords;
  state.composerByNode = state.composerByNode && typeof state.composerByNode === 'object' ? state.composerByNode : {};
  state.contextPreferencesByNode = state.contextPreferencesByNode && typeof state.contextPreferencesByNode === 'object' ? state.contextPreferencesByNode : {};
  state.providerKeyStorage = state.providerKeyStorage && typeof state.providerKeyStorage === 'object' ? state.providerKeyStorage : {};
  for (const [nodeId, selection] of Object.entries(state.composerByNode)) {
    const providerId = getProvider(selection?.provider)?.id || state.defaultProvider;
    const modelId = ensureModelForProvider(providerId, selection?.model || state.defaultModel);
    state.composerByNode[nodeId] = {
      provider: providerId,
      model: modelId,
      reasoningEffort: ensureReasoningForProvider(providerId, modelId, selection?.reasoningEffort || 'auto')
    };
  }
  normalizeProviderSelections();
  state.activeProviderEditorId = getProvider(state.activeProviderEditorId)?.id || getProvider('deepseek')?.id || state.providers[0]?.id || '';
  state.selectedIds = (state.selectedIds || []).filter(id => state.nodes.some(n => n.id === id));
  if (!state.selectedIds.length && state.nodes.length) state.selectedIds = [state.nodes[0].id];
  state.sidebarWidth = clamp(Number(state.sidebarWidth || 440), 360, 680);
  cascadeAllParentStatuses();
  if (graphHasOverlaps()) autoLayoutGraph({ persist: false, preserveExisting: false });
}


function bindGlobalControls() {
  $('#homeBtn').addEventListener('click', () => showHome());
  $('#newProjectBtn').addEventListener('click', openNewProjectDialog);
  $('#homeNewProjectBtn').addEventListener('click', openNewProjectDialog);
  $('#homeStartBtn').addEventListener('click', startProjectFromHome);
  $('#homeQuestionInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); startProjectFromHome(); }
  });
  $('#homeProviderSelect').addEventListener('change', e => {
    const providerId = e.target.value;
    const modelId = ensureModelForProvider(providerId, '');
    $('#homeModelSelect').innerHTML = modelOptions(providerId, modelId);
    $('#homeReasoningSelect').innerHTML = reasoningOptions(providerId, modelId, 'auto');
    $('#homeReasoningSelect').value = ensureReasoningForProvider(providerId, modelId, 'auto');
  });
  $('#homeModelSelect').addEventListener('change', e => {
    const providerId = $('#homeProviderSelect').value;
    $('#homeReasoningSelect').innerHTML = reasoningOptions(providerId, e.target.value, 'auto');
    $('#homeReasoningSelect').value = ensureReasoningForProvider(providerId, e.target.value, 'auto');
  });
  $('#newProjectProviderSelect').addEventListener('change', e => {
    const providerId = e.target.value;
    const modelId = ensureModelForProvider(providerId, '');
    $('#newProjectModelSelect').innerHTML = modelOptions(providerId, modelId);
    $('#newProjectReasoningSelect').innerHTML = reasoningOptions(providerId, modelId, 'auto');
    $('#newProjectReasoningSelect').value = ensureReasoningForProvider(providerId, modelId, 'auto');
  });
  $('#newProjectModelSelect').addEventListener('change', e => {
    const providerId = $('#newProjectProviderSelect').value;
    $('#newProjectReasoningSelect').innerHTML = reasoningOptions(providerId, e.target.value, 'auto');
    $('#newProjectReasoningSelect').value = ensureReasoningForProvider(providerId, e.target.value, 'auto');
  });
  $('#homeConnectProviderBtn')?.addEventListener('click', openProviderConnectionSettings);
  $('#newProjectConnectProviderBtn')?.addEventListener('click', openProviderConnectionSettings);
  $('#newProjectForm').addEventListener('submit', e => { e.preventDefault(); createProjectFromDialog(); });
  $('#cancelNewProjectBtn')?.addEventListener('click', () => $('#newProjectDialog').close());
  $('#closeSettingsBtn')?.addEventListener('click', async () => { await saveAllSettings({ render: true, silent: true }); $('#settingsDialog').close(); });
  $$('.modal-close').forEach(button => button.addEventListener('click', async () => {
    const dialog = button.closest('dialog');
    if (dialog?.id === 'settingsDialog') await saveAllSettings({ render: true, silent: true });
    dialog?.close();
  }));
  $$('.dialog-cancel').forEach(button => button.addEventListener('click', () => button.closest('dialog')?.close()));
  $('#confirmDialogForm')?.addEventListener('submit', event => {
    event.preventDefault();
    settleConfirmation(true);
  });
  $('#confirmDialogCancelBtn')?.addEventListener('click', () => settleConfirmation(false));
  $('#confirmDialogCloseBtn')?.addEventListener('click', () => settleConfirmation(false));
  $('#confirmDialog')?.addEventListener('cancel', event => {
    event.preventDefault();
    settleConfirmation(false);
  });
  $('#confirmDialog')?.addEventListener('close', () => {
    if (confirmationResolver) settleConfirmation(false, { closeDialog: false });
  });
  $('#settingsBtn').addEventListener('click', openSettings);
  $('#saveStatus')?.addEventListener('click', () => {
    if (!currentProjectId || projectSaveStatus === 'saving') return;
    persistProjectNow().catch(() => {});
  });
  $$('.settings-tab').forEach(button => button.addEventListener('click', async () => { await commitProviderEditorDraft({ silent: true, persistSecret: false }); saveGeneralSettingsDraft({ render: false }); switchSettingsTab(button.dataset.settingsTab); }));
  $('#addProviderBtn').addEventListener('click', addCustomProvider);
  $('#saveProviderBtn').addEventListener('click', saveActiveProvider);
  $('#duplicateProviderBtn').addEventListener('click', duplicateActiveProvider);
  $('#setDefaultProviderBtn').addEventListener('click', setActiveProviderAsDefault);
  $('#providerSearchInput').addEventListener('input', e => { providerSearchQuery = e.target.value.trim().toLowerCase(); renderProviderManager({ preserveEditor: true }); });
  $('#deleteProviderBtn').addEventListener('click', deleteActiveProvider);
  $('#resetProviderBtn').addEventListener('click', resetActiveProvider);
  $('#connectProviderBtn').addEventListener('click', () => connectActiveProvider({ resync: false }));
  $('#testProviderBtn').addEventListener('click', testActiveProvider);
  $('#syncModelsBtn').addEventListener('click', () => connectActiveProvider({ resync: true }));
  $('#codexDetectBtn').addEventListener('click', refreshCodexOAuthStatus);
  $('#codexBrowserLoginBtn').addEventListener('click', () => startCodexOAuth('browser'));
  $('#codexDeviceLoginBtn').addEventListener('click', () => startCodexOAuth('device'));
  $('#codexCancelLoginBtn').addEventListener('click', cancelCodexOAuth);
  $('#codexLogoutBtn').addEventListener('click', logoutCodexOAuth);
  $('#codexUseNowBtn').addEventListener('click', useCodexNow);
  document.addEventListener('selectionchange', scheduleMessageSelectionCapture);
  document.addEventListener('pointerdown', event => {
    document.body.classList.remove('keyboard-navigation');
    if (!event.target.closest('.composer-picker')) closeComposerPickers();
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Tab') document.body.classList.add('keyboard-navigation');
  }, true);
  $('#goalInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); e.currentTarget.blur(); }
  });
  $('#goalInput').addEventListener('blur', e => {
    const text = e.target.value.trim();
    if (text !== state.goal.text) setGoal(text, 'user');
  });
  $('#acceptGoalSuggestionBtn').addEventListener('click', acceptPendingGoal);
  $('#editGoalSuggestionBtn').addEventListener('click', editPendingGoal);
  $('#rejectGoalSuggestionBtn').addEventListener('click', rejectPendingGoal);
  $('#closeContextInspectorBtn').addEventListener('click', () => $('#contextInspectorDialog').close());
  $('#selectToolBtn').addEventListener('click', () => setInteractionMode('select'));
  $('#handToolBtn').addEventListener('click', () => setInteractionMode('hand'));
  $('#fitBtn').addEventListener('click', fitView);
  $('#autoLayoutBtn').addEventListener('click', () => { autoLayoutGraph({ preserveExisting: false }); fitView(); });
  $('#toggleArchiveBtn').addEventListener('click', () => { state.showArchived = !state.showArchived; saveAndRender(); });
  $('#nodeSearchInput')?.addEventListener('input', event => {
    nodeSearchQuery = event.target.value.trim();
    searchResultIndex = -1;
    renderCanvasNavigator();
    renderCanvasOnly();
  });
  $('#nodeSearchInput')?.addEventListener('keydown', handleNodeSearchKeydown);
  $('#clearNodeSearchBtn')?.addEventListener('click', clearNodeSearch);
  $('#pathViewBtn')?.addEventListener('click', () => {
    state.viewMode = state.viewMode === 'path' ? 'all' : 'path';
    saveAndRender();
    const selected = selectedNodes()[0];
    if (selected) requestAnimationFrame(() => focusNodesInView([selected.id, ...directChildren(selected.id).map(node => node.id)], { persist: false }));
  });
  $('#returnToSourceBtn')?.addEventListener('click', returnToSelectedSource);
  $('#reasoningPanelBtn')?.addEventListener('click', openReasoningLibrary);
  $('#fitMiniMapBtn')?.addEventListener('click', fitView);
  $('#historyBtn')?.addEventListener('click', openBackupDialog);
  $('#refreshBackupsBtn')?.addEventListener('click', loadProjectBackups);
  $('#exportBtn').addEventListener('click', openExportDialog);
  $$('[data-export-format]').forEach(button => button.addEventListener('click', () => exportState(button.dataset.exportFormat)));
  $('#importInput').addEventListener('change', importState);
  $('#zoomInBtn').addEventListener('click', () => zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, 1.065));
  $('#zoomOutBtn').addEventListener('click', () => zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, .939));
  $('#clearSelectionBtn').addEventListener('click', () => { state.selectedIds = []; saveAndRender(); });
  $('#mergeSelectedBtn').addEventListener('click', openMergeDialog);
  $('#compareSelectedBtn')?.addEventListener('click', openCompareDialog);
  $('#completeSelectedBtn').addEventListener('click', completeSelectedSubtrees);
  $('#archiveSelectedBtn').addEventListener('click', openArchiveDialog);

  $('#settingsForm').addEventListener('submit', async e => {
    e.preventDefault();
    const ok = await saveAllSettings();
    if (ok) $('#settingsDialog').close();
  });
  $('#settingsDialog').addEventListener('close', () => { stopCodexOAuthPolling(); });
  $('#artifactForm')?.addEventListener('submit', event => {
    event.preventDefault();
    saveArtifactFromDialog();
  });
  $('#annotationForm')?.addEventListener('submit', event => {
    event.preventDefault();
    saveAnnotationFromDialog();
  });
  $$('[data-annotation-color]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      setAnnotationColorPicker(button.dataset.annotationColor || 'auto');
    });
  });
  $('#deleteAnnotationBtn')?.addEventListener('click', deleteAnnotationFromDialog);
  $('#annotationDialog')?.addEventListener('close', event => {
    // A save can be followed by an immediate reopen before the queued close
    // event is delivered. Do not let that stale event erase the new draft.
    if (event.currentTarget.open) return;
    annotationDraftSourceId = '';
    annotationDraftPosition = null;
    annotationEditingNodeId = '';
  });
  $('#relationForm')?.addEventListener('submit', event => {
    event.preventDefault();
    saveReasoningRelation();
  });
  $('#reasoningKindFilter')?.addEventListener('change', event => { reasoningFilterKind = event.target.value; renderReasoningLibrary(); });
  $('#reasoningConfidenceFilter')?.addEventListener('change', event => { reasoningFilterConfidence = event.target.value; renderReasoningLibrary(); });
  $('#mergeForm').addEventListener('submit', e => {
    e.preventDefault();
    confirmMerge();
  });
  $('#archiveForm').addEventListener('submit', e => {
    e.preventDefault();
    archiveSelected($('#archiveReason').value.trim());
    $('#archiveDialog').close();
  });
  $('#branchComposerForm').addEventListener('submit', async e => {
    e.preventDefault();
    const content = $('#branchMessageDraft').value.trim();
    if (!content || !branchDraftAnchor?.nodeId) return;
    const provider = $('#branchProviderSelect').value;
    const model = $('#branchModelSelect').value;
    const reasoningEffort = $('#branchReasoningSelect').value || 'auto';
    if (!requireConnectedProvider(provider, { openSettings: true })) return;
    const anchor = structuredClone(branchDraftAnchor);
    branchDraftAnchor = null;
    $('#branchComposerDialog').close();
    await sendBranchFromNode(anchor.nodeId, content, provider, model, reasoningEffort, { cutoffMessageId: anchor.cutoffMessageId || '' });
  });
  $('#branchProviderSelect').addEventListener('change', e => {
    const model = ensureModelForProvider(e.target.value, '');
    $('#branchModelSelect').innerHTML = modelOptions(e.target.value, model);
    $('#branchReasoningSelect').innerHTML = reasoningOptions(e.target.value, model, 'auto');
    syncSelectTitle($('#branchProviderSelect'));
    syncSelectTitle($('#branchModelSelect'));
    syncSelectTitle($('#branchReasoningSelect'));
    updateBranchComposerMeta();
  });
  $('#branchModelSelect').addEventListener('change', e => {
    const providerId = $('#branchProviderSelect').value;
    $('#branchReasoningSelect').innerHTML = reasoningOptions(providerId, e.target.value, 'auto');
    syncSelectTitle($('#branchModelSelect'));
    syncSelectTitle($('#branchReasoningSelect'));
    updateBranchComposerMeta();
  });
  $('#branchReasoningSelect').addEventListener('change', event => {
    syncSelectTitle(event.currentTarget);
    updateBranchComposerMeta();
  });
  $('#branchMessageDraft').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      $('#branchComposerForm').requestSubmit();
    }
  });

  window.addEventListener('keydown', e => {
    if (e.key === '/' && !isTypingTarget(e.target) && !document.querySelector('dialog[open]')) {
      e.preventDefault();
      $('#nodeSearchInput')?.focus();
      return;
    }
    if (e.key === 'Escape' && nodeSearchQuery && document.activeElement === $('#nodeSearchInput')) {
      clearNodeSearch();
      return;
    }
    if (e.code === 'Space' && !isTypingTarget(e.target)) {
      spacePressed = true;
      viewport.classList.add('space-pan');
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', e => {
    if (e.code === 'Space') {
      spacePressed = false;
      viewport.classList.remove('space-pan');
    }
  });
}

function bindCanvas() {
  viewport.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const unit = e.deltaMode === 1 ? 15 : e.deltaMode === 2 ? viewport.clientHeight : 1;
    const delta = clamp(e.deltaY * unit, -58, 58);
    const factor = Math.exp(-delta * 0.00048);
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor, { persist: false });
    clearTimeout(zoomSaveTimer);
    zoomSaveTimer = setTimeout(saveState, 180);
  }, { passive: false });

  viewport.addEventListener('mousedown', e => {
    if (e.target.closest('.node') || e.target.closest('button') || e.target.closest('.selection-actions')) return;
    const rect = viewport.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (interactionMode === 'hand' || spacePressed || e.button === 1) {
      canvasPan = { startX: e.clientX, startY: e.clientY, cameraX: state.camera.x, cameraY: state.camera.y };
      viewport.classList.add('panning');
      return;
    }
    boxSelection = { startX: x, startY: y, endX: x, endY: y, additive: e.ctrlKey || e.metaKey };
    if (!boxSelection.additive) state.selectedIds = [];
    updateSelectionRect();
  });

  window.addEventListener('mousemove', e => {
    if (nodeDrag) {
      const dx = (e.clientX - nodeDrag.startX) / state.camera.scale;
      const dy = (e.clientY - nodeDrag.startY) / state.camera.scale;
      for (const id of nodeDrag.ids) {
        const node = getNode(id);
        const origin = nodeDrag.origins[id];
        if (node && origin) {
          node.x = origin.x + dx;
          node.y = origin.y + dy;
          if (Math.abs(dx) + Math.abs(dy) > 2) node.layoutStable = true;
          if (node.kind === 'annotation' && Math.abs(dx) + Math.abs(dy) > 2) node.annotationManualPosition = true;
          node.updatedAt = now();
        }
      }
      nodeDrag.moved = nodeDrag.moved || Math.abs(dx) + Math.abs(dy) > 2;
      renderCanvasOnly();
      return;
    }
    if (canvasPan) {
      state.camera.x = canvasPan.cameraX + e.clientX - canvasPan.startX;
      state.camera.y = canvasPan.cameraY + e.clientY - canvasPan.startY;
      applyCamera();
      return;
    }
    if (boxSelection) {
      const rect = viewport.getBoundingClientRect();
      boxSelection.endX = e.clientX - rect.left;
      boxSelection.endY = e.clientY - rect.top;
      updateSelectionRect();
      return;
    }
    if (sidebarResize) {
      const width = clamp(window.innerWidth - e.clientX, 360, Math.min(680, window.innerWidth * .52));
      state.sidebarWidth = width;
      applySidebarWidth();
    }
  });

  window.addEventListener('mouseup', () => {
    const completedDrag = nodeDrag;
    if (completedDrag) {
      nodeDrag = null;
      if (!completedDrag.moved && completedDrag.grouped) {
        state.selectedIds = [completedDrag.primaryId];
        saveAndRender();
      } else {
        saveState();
      }
    } else if (canvasPan || sidebarResize) {
      saveState();
    }
    canvasPan = null;
    viewport.classList.remove('panning');
    if (sidebarResize) {
      $('#sidebarResizer').classList.remove('dragging');
      sidebarResize = null;
    }
    if (boxSelection) {
      finalizeSelection();
      boxSelection = null;
      selectionRect.classList.add('hidden');
      saveAndRender();
    } else {
      renderSelectionActions();
    }
  });
}

function bindSidebarResize() {
  $('#sidebarResizer').addEventListener('mousedown', e => {
    e.preventDefault();
    sidebarResize = { startX: e.clientX, startWidth: state.sidebarWidth };
    $('#sidebarResizer').classList.add('dragging');
  });
}

function applySidebarWidth() {
  document.documentElement.style.setProperty('--sidebar-width', `${state.sidebarWidth}px`);
}

function setInteractionMode(mode) {
  interactionMode = mode;
  viewport.classList.toggle('mode-select', mode === 'select');
  viewport.classList.toggle('mode-hand', mode === 'hand');
  $('#selectToolBtn').classList.toggle('active', mode === 'select');
  $('#handToolBtn').classList.toggle('active', mode === 'hand');
}

function render() {
  if (!currentProjectId) { showHome({ persist: false }); return; }
  enterWorkspace();
  state.projectUpdatedAt = state.projectUpdatedAt || now();
  $('#goalInput').value = state.goal.text;
  const goalBadge = $('#goalBadge');
  const pendingGoal = state.goal.pending;
  goalBadge.textContent = pendingGoal
    ? '待确认'
    : state.goal.status === 'accepted'
      ? `已采用 · v${state.goal.version}`
      : state.goal.status === 'edited'
        ? `用户确认 · v${state.goal.version}`
        : '未设定';
  goalBadge.className = `goal-badge ${pendingGoal ? 'pending' : state.goal.status === 'accepted' ? 'ai' : state.goal.status === 'edited' ? 'user' : ''}`;
  $('#goalSuggestionCard').classList.toggle('hidden', !pendingGoal);
  $('#goalSuggestionText').textContent = pendingGoal?.text || '';
  $('#toggleArchiveBtn').dataset.tooltip = state.showArchived ? '隐藏归档' : '显示归档';
  renderCanvasOnly();
  renderSidebar();
  renderSelectionActions();
  updateBusyToast();
  $('#zoomValue').textContent = `${Math.round(state.camera.scale * 100)}%`;
  renderProjectSaveStatus();
}


function sourceNodeFor(node) {
  const id = sourceNodeId(node);
  return id ? getNode(id) : null;
}

function renderCanvasOnly() {
  applyCamera();
  renderEdges();
  renderNodes();
  renderCanvasNavigator();
  renderMiniMap();
}

function applyCamera() {
  world.style.transform = `translate(${state.camera.x}px, ${state.camera.y}px) scale(${state.camera.scale})`;
  updateMiniMapViewport();
}

function baseVisibleNodes() {
  return state.nodes.filter(node => state.showArchived || node.status !== 'archived');
}

function isHiddenByCollapsedAncestor(node) {
  let current = node?.parentId ? getNode(node.parentId) : null;
  while (current) {
    if (current.collapsed) return true;
    current = current.parentId ? getNode(current.parentId) : null;
  }
  return false;
}

function expandCollapsedAncestors(nodeId) {
  let current = getNode(nodeId)?.parentId ? getNode(getNode(nodeId).parentId) : null;
  let changed = false;
  while (current) {
    if (current.collapsed) {
      current.collapsed = false;
      current.updatedAt = now();
      changed = true;
    }
    current = current.parentId ? getNode(current.parentId) : null;
  }
  return changed;
}

function currentPathNodeIds() {
  if (state.viewMode !== 'path') return null;
  const selected = selectedNodes().filter(node => state.showArchived || node.status !== 'archived');
  if (!selected.length) return null;
  const ids = new Set();
  selected.forEach(node => {
    pathTo(node.id).forEach(item => ids.add(item.id));
    allDirectChildren(node.id).filter(child => state.showArchived || child.status !== 'archived').forEach(child => ids.add(child.id));
    if (['merge','merge_summary'].includes(node.kind)) (node.sourceNodeIds || []).forEach(id => ids.add(id));
  });
  return ids;
}

function visibleNodes() {
  const nodes = baseVisibleNodes().filter(node => !isHiddenByCollapsedAncestor(node));
  const pathIds = currentPathNodeIds();
  return pathIds ? nodes.filter(node => pathIds.has(node.id)) : nodes;
}

function nodeSearchHaystack(node) {
  return [
    node.title,
    node.question,
    node.summary,
    node.content,
    node.sourceText,
    ...(node.messages || []).map(message => message.content),
    ...artifactsForNode(node.id).flatMap(artifact => [artifact.title, artifact.content, ARTIFACT_KIND_LABELS[artifact.kind]])
  ].filter(Boolean).join('\n').toLocaleLowerCase('zh-CN');
}

function nodeMatchesSearch(node, query = nodeSearchQuery) {
  const terms = String(query || '').trim().toLocaleLowerCase('zh-CN').split(/\s+/).filter(Boolean);
  if (!terms.length) return false;
  const haystack = nodeSearchHaystack(node);
  return terms.every(term => haystack.includes(term));
}

function nodeKindText(node) {
  return ({
    root: '根问题',
    content_section: '讲解模块',
    organized_summary: '整理结果',
    answer_branch: '追问分支',
    conversation: '追问分支',
    merge_summary: '汇总节点',
    merge: '汇总节点',
    reasoning_artifact: '思考对象',
    annotation: ANNOTATION_TYPE_LABELS[node?.annotationType] || '标注'
  })[node?.kind] || '思考节点';
}

function searchResults() {
  if (!nodeSearchQuery) return [];
  return baseVisibleNodes()
    .filter(node => nodeMatchesSearch(node))
    .sort((a, b) => {
      const aTitle = String(a.title || '').toLocaleLowerCase('zh-CN');
      const bTitle = String(b.title || '').toLocaleLowerCase('zh-CN');
      const query = nodeSearchQuery.toLocaleLowerCase('zh-CN');
      const aRank = aTitle === query ? 0 : aTitle.startsWith(query) ? 1 : 2;
      const bRank = bTitle === query ? 0 : bTitle.startsWith(query) ? 1 : 2;
      return aRank - bRank || depthOf(a.id) - depthOf(b.id) || aTitle.localeCompare(bTitle, 'zh-CN');
    })
    .slice(0, 10);
}

function renderCanvasNavigator() {
  const navigator = $('#canvasNavigator');
  if (!navigator || !currentProjectId) return;
  const input = $('#nodeSearchInput');
  if (input && input.value !== nodeSearchQuery) input.value = nodeSearchQuery;
  $('#clearNodeSearchBtn')?.classList.toggle('hidden', !nodeSearchQuery);

  const pathButton = $('#pathViewBtn');
  const pathActive = state.viewMode === 'path';
  pathButton?.classList.toggle('active', pathActive);
  pathButton?.setAttribute('aria-pressed', String(pathActive));
  if (pathButton) pathButton.textContent = pathActive ? '显示全部' : '当前路径';

  const selected = selectedNodes()[0];
  const sourceId = selected ? sourceNodeId(selected) : '';
  const returnButton = $('#returnToSourceBtn');
  returnButton?.classList.toggle('hidden', !sourceId);
  if (returnButton && sourceId) {
    const source = getNode(sourceId);
    returnButton.textContent = source ? `返回 ${truncateInline(source.title, 10)}` : '返回来源';
    returnButton.title = source ? `返回来源节点：${source.title}` : '返回当前节点的来源';
  }

  const resultBox = $('#nodeSearchResults');
  if (!resultBox) return;
  const results = searchResults();
  if (!nodeSearchQuery) {
    resultBox.classList.add('hidden');
    resultBox.innerHTML = '';
    return;
  }
  if (searchResultIndex >= results.length) searchResultIndex = results.length - 1;
  resultBox.classList.remove('hidden');
  resultBox.innerHTML = results.length
    ? results.map((node, index) => `<button type="button" class="node-search-result" data-search-node="${escapeAttr(node.id)}" data-search-index="${index}" role="option" aria-selected="${index === searchResultIndex}">
        <strong>${highlightSearch(node.title || '未命名节点', nodeSearchQuery)}</strong>
        <span>${escapeHtml(truncateInline(node.summary || node.question || node.sourceText || '暂无摘要', 64))}</span>
        <em>${nodeKindText(node)}</em>
      </button>`).join('')
    : '<div class="node-search-empty">没有找到匹配节点</div>';

  $$('[data-search-node]').forEach(button => button.addEventListener('click', () => {
    selectAndFocusNode(button.dataset.searchNode, { keepSearch: true });
  }));
}

function highlightSearch(value, query) {
  const text = String(value || '');
  const term = String(query || '').trim().split(/\s+/)[0] || '';
  if (!term) return escapeHtml(text);
  const index = text.toLocaleLowerCase('zh-CN').indexOf(term.toLocaleLowerCase('zh-CN'));
  if (index < 0) return escapeHtml(text);
  return `${escapeHtml(text.slice(0, index))}<mark>${escapeHtml(text.slice(index, index + term.length))}</mark>${escapeHtml(text.slice(index + term.length))}`;
}

function truncateInline(value, limit = 32) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  return clean.length > limit ? `${clean.slice(0, Math.max(1, limit - 1))}…` : clean;
}

function handleNodeSearchKeydown(event) {
  const results = searchResults();
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (!results.length) return;
    event.preventDefault();
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    searchResultIndex = (searchResultIndex + direction + results.length) % results.length;
    renderCanvasNavigator();
    document.querySelector(`[data-search-index="${searchResultIndex}"]`)?.scrollIntoView({ block: 'nearest' });
    return;
  }
  if (event.key === 'Enter' && results.length) {
    event.preventDefault();
    const index = searchResultIndex >= 0 ? searchResultIndex : 0;
    selectAndFocusNode(results[index].id, { keepSearch: true });
  }
}

function clearNodeSearch() {
  nodeSearchQuery = '';
  searchResultIndex = -1;
  const input = $('#nodeSearchInput');
  if (input) input.value = '';
  renderCanvasOnly();
  input?.focus();
}

function selectAndFocusNode(nodeId, { keepSearch = false } = {}) {
  const node = getNode(nodeId);
  if (!node) return;
  expandCollapsedAncestors(nodeId);
  state.selectedIds = [nodeId];
  if (!keepSearch) nodeSearchQuery = '';
  render();
  requestAnimationFrame(() => focusNodesInView([nodeId], { persist: true, maxScale: 1.12 }));
}

function sourceNodeId(node) {
  if (!node) return '';
  return String(node.annotationSourceNodeId || node.branchAnchor?.nodeId || node.parentId || node.sourceNodeIds?.[0] || '');
}

function returnToSelectedSource() {
  const current = selectedNodes()[0];
  const sourceId = sourceNodeId(current);
  const source = getNode(sourceId);
  if (!current || !source) return;
  state.selectedIds = [source.id];
  render();
  focusNodesInView([source.id, current.id], { persist: true, maxScale: 1.05 });
}

function focusNodesInView(nodeIds, { persist = true, maxScale = 1.12, minScale = .5 } = {}) {
  const nodes = unique(nodeIds || []).map(getNode).filter(Boolean);
  if (!nodes.length || !viewport.clientWidth || !viewport.clientHeight) return;
  const minX = Math.min(...nodes.map(node => node.x));
  const minY = Math.min(...nodes.map(node => node.y));
  const maxX = Math.max(...nodes.map(node => node.x + NODE_W));
  const maxY = Math.max(...nodes.map(node => node.y + nodeHeight(node)));
  const boundsWidth = Math.max(1, maxX - minX);
  const boundsHeight = Math.max(1, maxY - minY);
  const leftPadding = 88;
  const rightPadding = 52;
  const topPadding = window.innerWidth < 1320 ? 210 : 150;
  const bottomPadding = 92;
  const usableWidth = Math.max(260, viewport.clientWidth - leftPadding - rightPadding);
  const usableHeight = Math.max(220, viewport.clientHeight - topPadding - bottomPadding);
  const scale = clamp(Math.min(usableWidth / boundsWidth, usableHeight / boundsHeight), minScale, maxScale);
  state.camera.scale = scale;
  state.camera.x = leftPadding + (usableWidth - boundsWidth * scale) / 2 - minX * scale;
  state.camera.y = topPadding + (usableHeight - boundsHeight * scale) / 2 - minY * scale;
  applyCamera();
  $('#zoomValue').textContent = `${Math.round(scale * 100)}%`;
  renderMiniMap();
  if (persist) saveState();
}

function scheduleFocus(nodeIds, options = {}) {
  const ids = unique(nodeIds || []);
  requestAnimationFrame(() => requestAnimationFrame(() => focusNodesInView(ids, options)));
}

function renderMiniMap() {
  const stage = $('#miniMapStage');
  if (!stage || !currentProjectId || $('#miniMap')?.classList.contains('hidden')) return;
  const nodes = baseVisibleNodes();
  if (!nodes.length) {
    stage.innerHTML = '';
    miniMapTransform = null;
    return;
  }
  const stageWidth = stage.clientWidth || 172;
  const stageHeight = stage.clientHeight || 100;
  const minX = Math.min(...nodes.map(node => node.x)) - 50;
  const minY = Math.min(...nodes.map(node => node.y)) - 50;
  const maxX = Math.max(...nodes.map(node => node.x + NODE_W)) + 50;
  const maxY = Math.max(...nodes.map(node => node.y + nodeHeight(node))) + 50;
  const scale = Math.min(stageWidth / Math.max(1, maxX - minX), stageHeight / Math.max(1, maxY - minY));
  miniMapTransform = { minX, minY, scale, stageWidth, stageHeight };
  const visibleIds = new Set(visibleNodes().map(node => node.id));
  stage.innerHTML = nodes.map(node => {
    const left = (node.x - minX) * scale;
    const top = (node.y - minY) * scale;
    const width = Math.max(4, NODE_W * scale);
    const height = Math.max(3, nodeHeight(node) * scale);
    const dimmed = visibleIds.has(node.id) ? '' : 'dimmed';
    return `<button type="button" class="mini-map-node ${state.selectedIds.includes(node.id) ? 'selected' : ''} ${node.status === 'resolved' ? 'resolved' : ''} ${dimmed}" data-mini-node="${escapeAttr(node.id)}" aria-label="定位到 ${escapeAttr(node.title)}" title="${escapeAttr(node.title)}" style="left:${left}px;top:${top}px;width:${width}px;height:${height}px"></button>`;
  }).join('') + '<div id="miniMapViewport" class="mini-map-viewport"></div>';
  $$('[data-mini-node]').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    selectAndFocusNode(button.dataset.miniNode);
  }));
  stage.onclick = event => {
    if (event.target !== stage && event.target.id !== 'miniMapViewport') return;
    const rect = stage.getBoundingClientRect();
    const worldX = minX + (event.clientX - rect.left) / scale;
    const worldY = minY + (event.clientY - rect.top) / scale;
    state.camera.x = viewport.clientWidth / 2 - worldX * state.camera.scale;
    state.camera.y = viewport.clientHeight / 2 - worldY * state.camera.scale;
    applyCamera();
    saveState();
  };
  updateMiniMapViewport();
}

function updateMiniMapViewport() {
  const rect = $('#miniMapViewport');
  if (!rect || !miniMapTransform || !viewport.clientWidth || !viewport.clientHeight) return;
  const { minX, minY, scale, stageWidth, stageHeight } = miniMapTransform;
  const worldLeft = -state.camera.x / state.camera.scale;
  const worldTop = -state.camera.y / state.camera.scale;
  const worldWidth = viewport.clientWidth / state.camera.scale;
  const worldHeight = viewport.clientHeight / state.camera.scale;
  const left = clamp((worldLeft - minX) * scale, 0, stageWidth);
  const top = clamp((worldTop - minY) * scale, 0, stageHeight);
  const width = clamp(worldWidth * scale, 4, Math.max(4, stageWidth - left));
  const height = clamp(worldHeight * scale, 4, Math.max(4, stageHeight - top));
  Object.assign(rect.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
}

function renderEdges() {
  const visible = new Set(visibleNodes().map(n => n.id));
  const annotationEdges = state.edges.filter(edge => visible.has(edge.source) && visible.has(edge.target) && edge.relation === 'annotation');
  const branchEdges = state.edges.filter(edge => visible.has(edge.source) && visible.has(edge.target) && !['merge','merged_from','annotation'].includes(edge.relation));
  const mergeEdges = state.edges.filter(edge => visible.has(edge.source) && visible.has(edge.target) && ['merge','merged_from'].includes(edge.relation));
  const bySource = new Map();
  branchEdges.forEach(edge => {
    if (!bySource.has(edge.source)) bySource.set(edge.source, []);
    bySource.get(edge.source).push(edge);
  });
  const paths = [];
  const strokeClass = state.connectionStroke === 'dashed' ? 'user-dashed' : 'user-solid';
  const curveMode = state.connectionShape !== 'orthogonal';
  for (const [sourceId, edges] of bySource) {
    const source = getNode(sourceId);
    const targets = edges.map(edge => getNode(edge.target)).filter(Boolean).sort((a,b)=>a.y-b.y);
    if (!source || !targets.length) continue;
    const sx = source.x + NODE_W;
    const sy = source.y + nodeHeight(source) / 2;
    if (curveMode) {
      targets.forEach(target => {
        const tx = target.x;
        const ty = target.y + nodeHeight(target) / 2;
        const bend = Math.max(68, Math.abs(tx - sx) * .46);
        const arc = Math.abs(ty - sy) < 8 ? Math.min(38, Math.max(18, Math.abs(tx - sx) * .08)) : 0;
        const processingClass = busyIds.has(target.id) ? 'processing-edge' : '';
        paths.push(`<path class="edge branch ${strokeClass} ${processingClass}" d="M ${sx} ${sy} C ${sx + bend} ${sy - arc}, ${tx - bend} ${ty - arc}, ${tx} ${ty}"></path>`);
      });
      continue;
    }
    if (targets.length === 1) {
      const target = targets[0];
      const tx = target.x;
      const ty = target.y + nodeHeight(target) / 2;
      const midX = sx + Math.max(52, (tx - sx) * .48);
      paths.push(`<path class="edge branch orthogonal ${strokeClass} ${busyIds.has(target.id) ? 'processing-edge' : ''}" d="M ${sx} ${sy} L ${midX} ${sy} L ${midX} ${ty} L ${tx} ${ty}"></path>`);
      continue;
    }
    const trunkX = sx + Math.max(72, (targets[0].x - sx) * .42);
    const centers = targets.map(target => target.y + nodeHeight(target) / 2);
    const top = Math.min(...centers), bottom = Math.max(...centers);
    const groupProcessing = targets.some(target => busyIds.has(target.id));
    paths.push(`<path class="edge branch-trunk orthogonal ${strokeClass} ${groupProcessing ? 'processing-edge' : ''}" d="M ${sx} ${sy} L ${trunkX} ${sy}"></path>`);
    paths.push(`<path class="edge branch-trunk orthogonal ${strokeClass} ${groupProcessing ? 'processing-edge' : ''}" d="M ${trunkX} ${top} L ${trunkX} ${bottom}"></path>`);
    targets.forEach(target => {
      const tx = target.x;
      const ty = target.y + nodeHeight(target) / 2;
      paths.push(`<path class="edge branch orthogonal ${strokeClass} ${busyIds.has(target.id) ? 'processing-edge' : ''}" d="M ${trunkX} ${ty} L ${tx} ${ty}"></path>`);
    });
  }
  mergeEdges.forEach(edge => {
    const source = getNode(edge.source), target = getNode(edge.target);
    if (!source || !target) return;
    const sx = source.x + NODE_W, sy = source.y + nodeHeight(source)/2;
    const tx = target.x, ty = target.y + nodeHeight(target)/2;
    const bend = Math.max(70, Math.abs(tx-sx)*.42);
    paths.push(`<path class="edge merge ${strokeClass}" d="M ${sx} ${sy} C ${sx+bend} ${sy}, ${tx-bend} ${ty}, ${tx} ${ty}"></path>`);
  });
  annotationEdges.forEach(edge => {
    const source = getNode(edge.source), target = getNode(edge.target);
    if (!source || !target) return;
    const sourceCenterX = source.x + NODE_W / 2;
    const targetCenterX = target.x + NODE_W / 2;
    const leftToRight = targetCenterX >= sourceCenterX;
    const sx = leftToRight ? source.x + NODE_W : source.x;
    const tx = leftToRight ? target.x : target.x + NODE_W;
    const sy = source.y + nodeHeight(source) / 2;
    const ty = target.y + nodeHeight(target) / 2;
    const bend = Math.max(52, Math.abs(tx - sx) * .42);
    const c1 = leftToRight ? sx + bend : sx - bend;
    const c2 = leftToRight ? tx - bend : tx + bend;
    paths.push(`<path class="edge annotation-edge" d="M ${sx} ${sy} C ${c1} ${sy}, ${c2} ${ty}, ${tx} ${ty}"></path>`);
  });
  edgesSvg.innerHTML = paths.join('');
}

function annotationColorStyle(node) {
  if (!node || node.kind !== 'annotation') return '';
  const palette = ANNOTATION_COLOR_STYLES[node.annotationColor];
  if (!palette) return '';
  return `--annotation-fill:${palette.fill};--annotation-border:${palette.border};--annotation-accent:${palette.accent};--annotation-label:${palette.label};`;
}

function annotationColorClass(node) {
  return node?.kind === 'annotation' && ANNOTATION_COLOR_STYLES[node.annotationColor] ? 'annotation-custom' : '';
}

function setAnnotationColorPicker(color = 'auto') {
  const normalized = Object.hasOwn(ANNOTATION_COLOR_STYLES, color) ? color : 'auto';
  const input = $('#annotationColorInput');
  if (input) input.value = normalized;
  $$('[data-annotation-color]').forEach(button => {
    const selected = button.dataset.annotationColor === normalized;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
  });
}

function renderNodes() {
  const kindLabel = { root: '根问题', content_section: '讲解模块', organized_summary: '整理结果', answer_branch: '追问分支', conversation: '追问分支', merge_summary: '汇总节点', merge: '汇总节点', annotation: '标注模块' };
  const statusLabel = { open: '待理解', exploring: '讨论中', resolved: '已完成', archived: '已归档' };
  const nodeMarkup = visibleNodes().map(node => {
    const activeChildren = directChildren(node.id).filter(child => child.status !== 'archived');
    const allChildren = allDirectChildren(node.id).filter(child => child.status !== 'archived');
    const resolvedChildren = activeChildren.filter(child => child.status === 'resolved').length;
    const foldedCount = node.collapsed ? allDescendantsOf(node.id).filter(child => state.showArchived || child.status !== 'archived').length : 0;
    const provider = node.provider ? `${providerLabel(node.provider)}${node.model ? ` · ${node.model}` : ''}` : '';
    const processing = busyIds.has(node.id);
    const annotationLabel = ANNOTATION_TYPE_LABELS[node.annotationType] || '标注';
    const footerLabel = processing
      ? '处理中'
      : provider || (node.kind === 'content_section' ? '来自回答拆解' : node.kind === 'annotation' ? `${annotationLabel} · 本地模块` : '');
    const annotationState = node.kind === 'annotation'
      ? '<span class="node-annotation-state">本地标注</span>'
      : `<span class="node-status ${node.status}">${statusLabel[node.status] || node.status}</span><span class="node-confidence ${node.confidenceStatus}">${escapeHtml(CONFIDENCE_STATUS_LABELS[node.confidenceStatus] || '未验证')}</span>`;
    return `<article class="node kind-${node.kind} annotation-${escapeAttr(node.annotationType || 'none')} ${annotationColorClass(node)} ${node.collapsed ? 'collapsed' : ''} ${processing ? 'processing' : ''} ${state.selectedIds.includes(node.id) ? 'selected' : ''} ${node.status === 'archived' ? 'archived' : ''} ${node.status === 'resolved' ? 'resolved' : ''} ${nodeMatchesSearch(node) ? 'search-match' : ''}" data-id="${node.id}" aria-busy="${processing ? 'true' : 'false'}" style="left:${node.x}px;top:${node.y}px;height:${nodeHeight(node)}px;${annotationColorStyle(node)}">
      <div class="node-top">
        <span class="node-kind">${node.kind === 'annotation' ? escapeHtml(annotationLabel) : kindLabel[node.kind] || '思考节点'}</span>
        <span>${annotationState}</span>
      </div>
      <h3>${escapeHtml(node.title)}</h3>
      <p>${processing ? '<span class="node-processing-copy"><i></i>AI 正在生成这个节点…</span>' : escapeHtml(node.summary || node.content || node.question || '点击后开始讨论')}</p>
      <div class="node-footer">
        <span class="node-provider">${escapeHtml(footerLabel)}</span>
        <span class="node-progress">${foldedCount ? `<strong>+${foldedCount}</strong> 已折叠` : activeChildren.length ? `<strong>${resolvedChildren}/${activeChildren.length}</strong> 子分支完成` : ''}</span>
      </div>
      ${node.status !== 'archived' ? `<div class="node-quick-actions" data-node-quick-actions>
        ${allChildren.length ? `<button type="button" class="node-collapse-trigger" data-node-collapse="${node.id}" title="${node.collapsed ? '展开后续节点' : '折叠后续节点'}" aria-label="${node.collapsed ? '展开后续节点' : '折叠后续节点'}">${node.collapsed ? '＋' : '−'}</button>` : ''}
        <button type="button" class="node-annotation-trigger" data-node-annotation="${node.id}" title="拖到画布空白处创建标注；点击快速新建" aria-label="为这个节点创建标注"><span></span></button>
        <button type="button" class="node-branch-trigger" data-node-branch="${node.id}" title="从这个节点新建分支" aria-label="从这个节点新建分支">＋</button>
      </div>` : ''}
    </article>`;
  }).join('');
  const pendingMarkup = pendingMergeVisual ? `
    <article class="node kind-merge_summary merge-pending processing" data-pending-merge="true" aria-busy="true"
      style="left:${pendingMergeVisual.x}px;top:${pendingMergeVisual.y}px;height:${nodeHeight(pendingMergeVisual)}px">
      <div class="node-top">
        <span class="node-kind">汇总节点</span>
        <span><span class="node-status exploring">讨论中</span><span class="node-confidence partial">${escapeHtml(CONFIDENCE_STATUS_LABELS.partial || '部分可信')}</span></span>
      </div>
      <h3>${escapeHtml(pendingMergeVisual.title)}</h3>
      <p><span class="node-processing-copy"><i></i>AI 正在汇总所选内容…</span></p>
      <div class="node-footer">
        <span class="node-provider">处理中</span>
        <span class="node-progress">${pendingMergeVisual.sourceCount} 个节点</span>
      </div>
    </article>` : '';
  nodesLayer.innerHTML = nodeMarkup + pendingMarkup;

  $$('[data-node-branch]').forEach(button => {
    button.addEventListener('mousedown', event => { event.preventDefault(); event.stopPropagation(); });
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const nodeId = button.dataset.nodeBranch;
      state.selectedIds = [nodeId];
      render();
      openBranchComposer(nodeId);
    });
  });

  $$('[data-node-collapse]').forEach(button => {
    button.addEventListener('mousedown', event => { event.preventDefault(); event.stopPropagation(); });
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      toggleNodeCollapse(button.dataset.nodeCollapse);
    });
  });

  $$('[data-node-annotation]').forEach(button => bindAnnotationHandle(button));

  $$('.node:not([data-pending-merge])').forEach(el => {
    el.addEventListener('mousedown', e => {
      e.stopPropagation();
      const id = el.dataset.id;
      const additive = e.ctrlKey || e.metaKey;
      const wasSelected = state.selectedIds.includes(id);
      if (additive) {
        state.selectedIds = wasSelected
          ? state.selectedIds.filter(selected => selected !== id)
          : [...state.selectedIds, id];
      } else if (!wasSelected || state.selectedIds.length <= 1) {
        state.selectedIds = [id];
      }
      const dragIds = additive
        ? (state.selectedIds.includes(id) ? [...state.selectedIds] : [])
        : (wasSelected && state.selectedIds.length > 1 ? [...state.selectedIds] : [id]);
      if (!dragIds.length) {
        render();
        return;
      }
      state.selectedIds = unique(dragIds);
      const origins = Object.fromEntries(dragIds.map(nodeId => {
        const node = getNode(nodeId);
        return [nodeId, { x: node.x, y: node.y }];
      }));
      nodeDrag = {
        ids: dragIds,
        origins,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        primaryId: id,
        grouped: !additive && wasSelected && state.selectedIds.length > 1
      };
      render();
    });
    el.addEventListener('dblclick', e => {
      e.stopPropagation();
      state.selectedIds = [el.dataset.id];
      saveAndRender();
      $('#messageDraft')?.focus();
    });
  });
}

function toggleNodeCollapse(nodeId) {
  const node = getNode(nodeId);
  if (!node || !allDirectChildren(node.id).length) return;
  node.collapsed = !node.collapsed;
  node.updatedAt = now();
  state.selectedIds = [node.id];
  saveAndRender();
  requestAnimationFrame(() => focusNodesInView([node.id], { persist: false, maxScale: 1.12 }));
}

function bindAnnotationHandle(button) {
  const nodeId = button.dataset.nodeAnnotation;
  button.addEventListener('mousedown', event => {
    event.preventDefault();
    event.stopPropagation();
  });
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const source = getNode(nodeId);
    if (!source) return;
    try { button.setPointerCapture?.(event.pointerId); } catch {}
    annotationDrag = {
      sourceId: nodeId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      worldX: source.x + NODE_W + 90,
      worldY: source.y + nodeHeight(source) / 2,
      moved: false
    };

    const move = moveEvent => {
      if (!annotationDrag || moveEvent.pointerId !== annotationDrag.pointerId) return;
      const distance = Math.hypot(moveEvent.clientX - annotationDrag.startX, moveEvent.clientY - annotationDrag.startY);
      if (distance < 6 && !annotationDrag.moved) return;
      annotationDrag.moved = true;
      const point = worldPointFromClient(moveEvent.clientX, moveEvent.clientY);
      annotationDrag.worldX = point.x;
      annotationDrag.worldY = point.y;
      renderAnnotationDragPreview(annotationDrag);
    };
    const finish = upEvent => {
      if (!annotationDrag || upEvent.pointerId !== annotationDrag.pointerId) return;
      button.removeEventListener('pointermove', move);
      button.removeEventListener('pointerup', finish);
      button.removeEventListener('pointercancel', cancel);
      const drag = annotationDrag;
      annotationDrag = null;
      clearAnnotationDragPreview();
      const position = drag.moved
        ? { x: drag.worldX - NODE_W / 2, y: drag.worldY - 80, manual: true }
        : defaultAnnotationPosition(source);
      openAnnotationDialog(drag.sourceId, { position });
    };
    const cancel = cancelEvent => {
      if (!annotationDrag || cancelEvent.pointerId !== annotationDrag.pointerId) return;
      button.removeEventListener('pointermove', move);
      button.removeEventListener('pointerup', finish);
      button.removeEventListener('pointercancel', cancel);
      annotationDrag = null;
      clearAnnotationDragPreview();
    };
    button.addEventListener('pointermove', move);
    button.addEventListener('pointerup', finish);
    button.addEventListener('pointercancel', cancel);
  });
}

function worldPointFromClient(clientX, clientY) {
  const rect = viewport.getBoundingClientRect();
  return {
    x: (clientX - rect.left - state.camera.x) / state.camera.scale,
    y: (clientY - rect.top - state.camera.y) / state.camera.scale
  };
}

function renderAnnotationDragPreview(drag) {
  const source = getNode(drag.sourceId);
  if (!source) return;
  let path = $('#annotationDraftPath');
  if (!path) {
    path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.id = 'annotationDraftPath';
    path.setAttribute('class', 'edge annotation-edge annotation-draft-edge');
    edgesSvg.appendChild(path);
  }
  let ghost = $('#annotationDraftGhost');
  if (!ghost) {
    ghost = document.createElement('div');
    ghost.id = 'annotationDraftGhost';
    ghost.className = 'annotation-draft-ghost';
    ghost.textContent = '松开创建标注';
    nodesLayer.appendChild(ghost);
  }
  const targetX = drag.worldX;
  const targetY = drag.worldY;
  const sourceCenterX = source.x + NODE_W / 2;
  const right = targetX >= sourceCenterX;
  const sx = right ? source.x + NODE_W : source.x;
  const sy = source.y + nodeHeight(source) / 2;
  const bend = Math.max(44, Math.abs(targetX - sx) * .36);
  const c1 = right ? sx + bend : sx - bend;
  const c2 = right ? targetX - bend : targetX + bend;
  path.setAttribute('d', `M ${sx} ${sy} C ${c1} ${sy}, ${c2} ${targetY}, ${targetX} ${targetY}`);
  ghost.style.left = `${targetX - 74}px`;
  ghost.style.top = `${targetY - 20}px`;
}

function clearAnnotationDragPreview() {
  $('#annotationDraftPath')?.remove();
  $('#annotationDraftGhost')?.remove();
}

function defaultAnnotationPosition(source, { excludeId = '', startOffset = 0 } = {}) {
  const height = 168;
  const verticalStep = height + 34;
  const lanes = [
    { x: source.x + NODE_W + 82, y: source.y },
    { x: source.x - NODE_W - 82, y: source.y },
    { x: source.x + 42, y: source.y + nodeHeight(source) + 82 }
  ];
  const occupied = state.nodes.filter(node => node.id !== source.id && node.id !== excludeId && node.status !== 'archived');
  let fallback = { x: lanes[0].x, y: lanes[0].y + startOffset * verticalStep, manual: false };
  for (let attempt = 0; attempt < 18; attempt += 1) {
    for (let laneIndex = 0; laneIndex < lanes.length; laneIndex += 1) {
      const lane = lanes[laneIndex];
      const candidate = {
        x: clamp(lane.x, 20, 11200),
        y: clamp(lane.y + (startOffset + attempt) * verticalStep, 20, 11200),
        manual: false
      };
      fallback = candidate;
      const collision = occupied.some(node =>
        candidate.x < node.x + NODE_W + 18 && candidate.x + NODE_W + 18 > node.x &&
        candidate.y < node.y + nodeHeight(node) + 18 && candidate.y + height + 18 > node.y
      );
      if (!collision) return candidate;
    }
  }
  return fallback;
}

function captureSidebarScroll() {
  const conversation = $('#conversation');
  if (conversation && lastSidebarNodeId) conversationScrollByNode.set(lastSidebarNodeId, conversation.scrollTop);
}

function renderSidebar() {
  const previousNodeId = lastSidebarNodeId;
  captureSidebarScroll();
  const selected = selectedNodes();
  if (selected.length !== 1) {
    renderSelectionSidebar(selected);
    return;
  }
  const node = selected[0];
  const path = pathTo(node.id);
  const ancestorTrail = path.slice(0, -1).slice(-3);
  const breadcrumb = ancestorTrail.length ? ancestorTrail.map(n => n.title).join(' / ') : '根节点';
  const breadcrumbHtml = ancestorTrail.length
    ? ancestorTrail.map(n => `<button type="button" data-path-node="${escapeAttr(n.id)}" title="定位到 ${escapeAttr(n.title)}">${escapeHtml(n.title)}</button>`).join('<span aria-hidden="true"> / </span>')
    : '<span>根节点</span>';
  const description = String(node.question || node.summary || '从这里开始提出问题。').trim();
  const showDescription = description && description.replace(/\s+/g, ' ') !== String(node.title || '').trim().replace(/\s+/g, ' ');
  const isArchived = node.status === 'archived';
  const statusOptions = isArchived
    ? '<option value="archived">已归档</option>'
    : ['open', 'exploring', 'resolved'].map(status => `<option value="${status}" ${node.status === status ? 'selected' : ''}>${({ open: '待理解', exploring: '讨论中', resolved: '已完成' })[status]}</option>`).join('');
  const confidenceOptions = Object.entries(CONFIDENCE_STATUS_LABELS).map(([status, label]) => `<option value="${status}" ${node.confidenceStatus === status ? 'selected' : ''}>${label}</option>`).join('');
  const isAnnotation = node.kind === 'annotation';
  const annotationHeaderState = isAnnotation ? '<span class="annotation-header-state">本地标注</span>' : '';
  const visibleChildren = allDirectChildren(node.id).filter(child => child.status !== 'archived');
  const canCollapse = visibleChildren.length > 0;

  sidebar.innerHTML = `<div class="sidebar-shell">
    <header class="sidebar-header">
      <div class="sidebar-header-top">
        <span class="breadcrumb" title="${escapeAttr(breadcrumb)}">${breadcrumbHtml}</span>
        <div class="header-actions">
          ${isAnnotation ? annotationHeaderState : `<select id="nodeStatusSelect" class="status-select" aria-label="工作状态" title="工作状态">${statusOptions}</select>
          <select id="nodeConfidenceSelect" class="status-select confidence-select" aria-label="可信状态" title="可信状态">${confidenceOptions}</select>`}
          ${!isArchived ? '<button id="addAnnotationBtn" class="header-secondary-action" title="添加本地标注模块">＋ 标注</button>' : ''}
          <button id="contextInspectorBtn" class="header-primary-action" title="查看本次模型上下文">上下文</button>
          <details class="node-more-menu">
            <summary aria-label="更多节点操作" title="更多节点操作">更多</summary>
            <div class="node-more-menu-popover">
              ${canCollapse ? `<button id="toggleNodeCollapseMenuBtn" type="button">${node.collapsed ? '展开后续节点' : `折叠后续节点（${visibleChildren.length}）`}</button>` : ''}
              ${isAnnotation ? '<button id="editAnnotationBtn" type="button">编辑标注</button><button id="deleteAnnotationMenuBtn" type="button" class="danger-menu-action">删除标注</button>' : ''}
              ${!isArchived && node.messages.length ? `<button id="compactNodeBtn" type="button" title="${node.activeCompactId ? '重新生成 Compact' : 'Compact 当前节点'}">${node.activeCompactId ? '重新 Compact' : 'Compact 上下文'}</button>` : ''}
              ${!isArchived && node.messages.length > 1 ? '<button id="organizeNodeBtn" type="button" title="整理本节点全部对话">整理对话</button>' : ''}
              ${isArchived
                ? '<button id="restoreNodeBtn" type="button" title="恢复节点">恢复节点</button>'
                : '<button id="archiveNodeBtn" type="button" class="danger-menu-action" title="归档节点">归档节点</button>'}
            </div>
          </details>
        </div>
      </div>
      <div class="sidebar-heading">
        <h1>${escapeHtml(node.title)}</h1>
        ${showDescription ? `<p title="${escapeAttr(description)}">${escapeHtml(description)}</p>` : ''}
      </div>
      <div class="node-context-row">
        <span class="context-chip">${isAnnotation ? escapeHtml(ANNOTATION_TYPE_LABELS[node.annotationType] || '标注') : providerLabel(node.provider || getComposerSelection(node.id).provider)}</span>
        <span class="context-chip goal-version">目标 v${node.goalVersion || confirmedGoal(state.goal).version || 0}</span>
        ${isAnnotation && node.annotationSourceNodeId ? '<span class="context-chip annotation-local">不计入主分支完成度</span>' : ''}
        ${node.coverageIds?.length ? `<span class="context-chip">覆盖 ${node.coverageIds.length} 个节点</span>` : ''}
        ${node.activeCompactId ? '<span class="context-chip compact-active">Compact 已启用</span>' : ''}
      </div>
    </header>
    <section id="conversation" class="conversation">${renderSourceContent(node)}${renderCompactPanel(node)}${renderMessages(node)}${renderNodeArtifacts(node)}</section>
    ${isArchived ? '<div class="composer-wrap"><div class="archived-note">这个节点已归档。恢复后才可以继续追问。</div></div>' : renderComposer(node)}
  </div>`;

  $$('[data-path-node]').forEach(button => button.addEventListener('click', () => {
    const target = getNode(button.dataset.pathNode);
    if (!target) return;
    state.selectedIds = [target.id];
    focusNodesInView([target.id, node.id], { persist: true });
  }));
  $('#nodeStatusSelect')?.addEventListener('change', e => changeNodeStatus(node.id, e.target.value));
  $('#nodeConfidenceSelect')?.addEventListener('change', e => changeNodeConfidence(node.id, e.target.value));
  $('#contextInspectorBtn')?.addEventListener('click', () => openContextInspector(node.id));
  $('#addAnnotationBtn')?.addEventListener('click', () => openAnnotationDialog(node.id));
  $('#toggleNodeCollapseMenuBtn')?.addEventListener('click', () => toggleNodeCollapse(node.id));
  $('#archiveNodeBtn')?.addEventListener('click', () => { state.selectedIds = [node.id]; openArchiveDialog(); });
  $('#restoreNodeBtn')?.addEventListener('click', () => restoreSubtree(node.id));
  $('#organizeNodeBtn')?.addEventListener('click', () => organizeNode(node.id));
  $('#compactNodeBtn')?.addEventListener('click', () => compactNode(node.id, { force: true }));
  $('#deleteCompactBtn')?.addEventListener('click', () => deleteCompact(node.id));
  $('#editAnnotationBtn')?.addEventListener('click', () => openAnnotationDialog(node.annotationSourceNodeId || node.parentId, { annotationNodeId: node.id }));
  $('#deleteAnnotationMenuBtn')?.addEventListener('click', () => {
    annotationEditingNodeId = node.id;
    deleteAnnotationFromDialog();
  });
  bindComposer(node);
  bindMessageActions(node);
  bindSourceContentActions(node);
  bindArtifactActions(node);
  bindRenderedContentActions();
  lastSidebarNodeId = node.id;
  requestAnimationFrame(() => {
    const conversation = $('#conversation');
    if (!conversation) return;
    const intent = pendingConversationScroll?.nodeId === node.id ? pendingConversationScroll.mode : '';
    if (intent === 'bottom') conversation.scrollTop = conversation.scrollHeight;
    else if (previousNodeId !== node.id) conversation.scrollTop = 0;
    else conversation.scrollTop = conversationScrollByNode.get(node.id) || 0;
    if (intent) pendingConversationScroll = null;
    conversation.addEventListener('scroll', () => conversationScrollByNode.set(node.id, conversation.scrollTop), { passive: true });
  });
}

function renderSelectionSidebar(selected) {
  captureSidebarScroll();
  lastSidebarNodeId = '';
  const list = selected.map(node => `<div class="selected-item"><strong>${escapeHtml(node.title)}</strong><span>${nodeStatusText(node.status)}</span></div>`).join('');
  sidebar.innerHTML = `<section class="selection-panel">
    <span class="eyebrow">批量处理</span>
    <h1>${selected.length ? `已选择 ${selected.length} 个节点` : '选择节点开始'}</h1>
    <p>${selected.length ? '汇总会先生成可检查的输入计划，结构节点、重复内容和压缩节点都会明确列出。' : '拖动画布空白处框选，或按住 Ctrl / Command 点击节点增减选择。'}</p>
    ${selected.length ? `<div class="selected-list">${list}</div>
      <div class="selection-panel-actions">
        <button id="panelMergeBtn" class="primary-action">汇总所选内容</button>
        ${selected.length === 2 ? '<button id="panelCompareBtn">比较两个分支</button>' : ''}
        <button id="panelCompleteBtn">标记完成</button>
        <button id="panelArchiveBtn" class="danger-soft">归档</button>
        <button id="panelClearBtn">取消选择</button>
      </div>` : ''}
  </section>`;
  $('#panelMergeBtn')?.addEventListener('click', openMergeDialog);
  $('#panelCompareBtn')?.addEventListener('click', openCompareDialog);
  $('#panelCompleteBtn')?.addEventListener('click', completeSelectedSubtrees);
  $('#panelArchiveBtn')?.addEventListener('click', openArchiveDialog);
  $('#panelClearBtn')?.addEventListener('click', () => { state.selectedIds = []; saveAndRender(); });
}

function renderSourceContent(node) {
  if (!node.content) return '';
  if (node.kind === 'annotation') {
    const label = ANNOTATION_TYPE_LABELS[node.annotationType] || '标注';
    return `<article class="source-content-card annotation-content-card ${annotationColorClass(node)}" data-source-content-node="${escapeAttr(node.id)}" style="${annotationColorStyle(node)}">
      <div class="source-content-head">
        <span>${escapeHtml(label)}内容</span>
        <em>本地标注 · 可编辑</em>
      </div>
      <div class="message-body rich-content" data-source-selection-body>${markdownToHtml(node.content)}</div>
      <div class="source-content-actions" aria-label="标注模块操作">
        <button type="button" class="source-action-edit" data-edit-annotation="${escapeAttr(node.id)}">编辑标注</button>
        <button type="button" class="source-action-primary" data-decompose-source="${escapeAttr(node.id)}">拆解标注内容</button>
        <button type="button" class="source-action-secondary" data-decompose-source-selection="${escapeAttr(node.id)}">拆解选中文字</button>
        <button type="button" class="source-action-secondary" data-promote-source-selection="${escapeAttr(node.id)}">提炼选中文字</button>
      </div>
    </article>`;
  }
  const sourceRange = node.sourceStart >= 0 ? `${node.sourceStart}–${node.sourceEnd}` : '可见选区 · 原文位置未定位';
  const recursiveActions = node.kind === 'content_section' ? `<div class="source-content-actions" aria-label="讲解模块操作">
      <button type="button" class="source-action-primary" data-decompose-source="${escapeAttr(node.id)}">继续拆解这个模块</button>
      <button type="button" class="source-action-secondary" data-decompose-source-selection="${escapeAttr(node.id)}">拆解选中文字</button>
      <button type="button" class="source-action-secondary" data-promote-source-selection="${escapeAttr(node.id)}">提炼选中文字</button>
    </div>` : '';
  return `<article class="source-content-card" data-source-content-node="${escapeAttr(node.id)}">
    <div class="source-content-head">
      <span>${node.sourceScope === 'selection' ? '所选文字拆解' : node.sourceScope === 'node' ? '本节点整理' : '回答内容模块'}</span>
      ${node.sourceMessageId ? `<em>来源消息 ${escapeHtml(node.sourceMessageId)} · ${escapeHtml(sourceRange)}</em>` : `<em>${escapeHtml(sourceRange)}</em>`}
    </div>
    <div class="message-body rich-content" data-source-selection-body>${markdownToHtml(node.content)}</div>
    ${recursiveActions}
    ${node.sourceText ? `<details class="source-quote"><summary>查看来源片段</summary><blockquote>${escapeHtml(node.sourceText)}</blockquote></details>` : ''}
  </article>`;
}

function renderCompactPanel(node) {
  const snapshot = (node.compactSnapshots || []).find(item => item.id === node.activeCompactId);
  if (!snapshot) return '';
  const compact = snapshot.compact || {};
  const list = (label, items) => Array.isArray(items) && items.length
    ? `<div class="compact-list"><strong>${label}</strong><ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>` : '';
  return `<details class="compact-panel">
    <summary>查看 Compact v${snapshot.version || 1} · 覆盖 ${(compact.coveredMessageIds || []).length} 条消息</summary>
    <div class="compact-body">
      <p>${escapeHtml(compact.summary || '暂无摘要')}</p>
      ${list('已确认结论', compact.confirmedConclusions)}
      ${list('被否定假设', compact.rejectedAssumptions)}
      ${list('尚未解决', compact.openQuestions)}
      ${list('用户约束', compact.importantUserConstraints)}
      <button id="deleteCompactBtn" class="danger-soft">删除当前 Compact</button>
      <small>原始消息始终完整保留。</small>
    </div>
  </details>`;
}

function openContextInspector(nodeId) {
  const node = getNode(nodeId);
  if (!node) return;
  contextInspectorNodeId = nodeId;
  contextInspectorMode = (node.lastContextSnapshotId || node.contextSnapshotId) ? 'latest' : 'preview';
  renderContextInspector();
  $('#contextInspectorDialog').showModal();
}

function renderContextInspector() {
  const node = getNode(contextInspectorNodeId);
  if (!node) return;
  const latestId = node.lastContextSnapshotId || node.contextSnapshotId || '';
  const latest = contextSnapshotById(latestId);
  if (contextInspectorMode === 'latest' && !latest) contextInspectorMode = 'preview';
  const snapshot = contextInspectorMode === 'latest'
    ? latest
    : createContextSnapshot(node, '（下一次输入尚未填写）', { purpose: 'preview', record: false });
  if (!snapshot) return;

  const isPreview = contextInspectorMode === 'preview';
  $('#contextInspectorTitle').textContent = `${node.title} · ${isPreview ? '下一次请求预览' : '最近一次请求'}`;
  $('#contextInspectorSubtitle').textContent = snapshot.branchAnchor?.cutoffMessageId
    ? `上下文截至消息 ${snapshot.branchAnchor.cutoffMessageId}；快照创建后不会被后续消息改写。`
    : '当前节点尚无消息锚点。';
  $('#contextTokenTotal').textContent = `约 ${Number(snapshot.metrics?.estimatedInputTokens || 0).toLocaleString(localeForIntl(state.uiLanguage))} tokens`;
  $('#contextSnapshotLabel').textContent = isPreview ? '预览（未保存）' : `v${snapshot.version} · ${snapshot.id}`;
  $('#contextGoalLabel').textContent = snapshot.goal?.text ? `v${snapshot.goal.version} 已确认` : '未确认 / 未包含';

  const preferences = contextPreferencesFor(node.id);
  const preferenceLabels = {
    includeSource: '原文来源',
    includeAncestors: '祖先路径',
    includeConstraints: '长期约束',
    includeGoal: '已确认目标',
    includeCompact: 'Compact'
  };
  $('#contextPreferenceControls').innerHTML = `
    <div class="context-mode-switch" role="group" aria-label="上下文查看模式">
      <button type="button" data-context-mode="latest" class="${contextInspectorMode === 'latest' ? 'active' : ''}" ${latest ? '' : 'disabled'}>最近快照</button>
      <button type="button" data-context-mode="preview" class="${contextInspectorMode === 'preview' ? 'active' : ''}">下一次预览</button>
    </div>
    <div class="context-toggle-list" aria-label="下一次请求上下文开关">
      ${Object.entries(preferenceLabels).map(([key, label]) => `<label><input type="checkbox" data-context-preference="${key}" ${preferences[key] ? 'checked' : ''} /><span>${label}</span></label>`).join('')}
    </div>`;

  $('#contextInspectorSections').innerHTML = (snapshot.metrics?.sections || []).map((section, index) => {
    const preview = contextSectionPreview(snapshot, section.key);
    return `<details class="context-section ${section.included ? '' : 'excluded'}" ${index < 2 ? 'open' : ''}>
      <summary>
        <span><strong>${escapeHtml(section.label)}</strong><small>${section.required ? '必选' : section.included ? '已包含' : '未包含'}</small></span>
        <em>${section.characters.toLocaleString(localeForIntl(state.uiLanguage))} 字符 · 约 ${section.estimatedTokens.toLocaleString(localeForIntl(state.uiLanguage))} tokens</em>
      </summary>
      <pre>${escapeHtml(preview || '这一层没有可用内容。')}</pre>
    </details>`;
  }).join('');

  $$('[data-context-mode]').forEach(button => button.addEventListener('click', () => {
    if (button.disabled) return;
    contextInspectorMode = button.dataset.contextMode;
    renderContextInspector();
  }));
  $$('[data-context-preference]').forEach(input => input.addEventListener('change', () => {
    updateContextPreference(node.id, input.dataset.contextPreference, input.checked);
    contextInspectorMode = 'preview';
    renderContextInspector();
  }));
}

function contextSectionPreview(snapshot, key) {
  if (key === 'currentQuestion') return snapshot.latestQuestion;
  if (key === 'currentMessages') return snapshot.currentNode.messages.map(message => `${message.role === 'user' ? '用户' : 'AI'}：${message.content}`).join('\n\n');
  if (key === 'source') return snapshot.currentNode.sourceText;
  if (key === 'ancestors') return snapshot.ancestors.map((item, index) => [
    `${index + 1}. ${item.title}`,
    item.question ? `问题：${item.question}` : '',
    item.confirmedSummary ? `摘要：${item.confirmedSummary}` : '',
    item.sourceText ? `来源：${item.sourceText}` : '',
    ...(item.recentMessages || []).map(message => `${message.role === 'user' ? '用户' : 'AI'}：${message.content}`)
  ].filter(Boolean).join('\n')).join('\n\n');
  if (key === 'constraints') return snapshot.constraints.map(item => `- ${item}`).join('\n');
  if (key === 'goal') return snapshot.goal?.text || '';
  if (key === 'compact') return snapshot.compact ? [
    snapshot.compact.summary || '',
    ...(snapshot.compact.confirmedConclusions || []).map(item => `已确认：${item}`),
    ...(snapshot.compact.rejectedAssumptions || []).map(item => `已否定：${item}`),
    ...(snapshot.compact.openQuestions || []).map(item => `未解决：${item}`)
  ].filter(Boolean).join('\n') : '';
  return '';
}

function renderMessages(node) {
  if (!node.messages.length) {
    const description = node.kind === 'content_section'
      ? '上方是从原回答中拆出的讲解。阅读后，可以针对不懂的地方继续追问。'
      : node.kind === 'annotation'
        ? '上方是独立标注。你可以直接编辑，也可以围绕这条标注继续追问或建立新的分支。'
      : node.kind === 'root'
        ? '输入第一个问题。AI 会先完整回答；你可以阅读、追问、换模型或手动拆解。'
        : '可在当前节点继续对话；需要平行探索时点击画布节点右侧的 +。';
    return `<div class="empty-conversation"><div><div class="empty-icon">${node.kind === 'root' ? '1' : node.kind === 'annotation' ? '✎' : '?'}</div><h2>${node.kind === 'root' ? '从一个问题开始' : node.kind === 'annotation' ? '围绕标注继续思考' : '继续理解这个模块'}</h2><p>${description}</p></div></div>`;
  }
  return node.messages.map(message => {
    const generating = Boolean(message.streaming);
    const partial = Boolean(message.partial);
    const canDecompose = message.role === 'assistant' && !generating && Boolean(message.content) && !node.decomposedMessageIds.includes(message.id) && !message.error;
    const canSelectDecompose = message.role === 'assistant' && !generating && Boolean(message.content) && !message.error;
    const canPromote = message.role === 'assistant' && !generating && Boolean(message.content) && !message.error;
    const canRetry = message.role === 'assistant' && message.error;
    const canContinue = message.role === 'assistant' && partial && !generating && !message.error;
    const decomposed = message.role === 'assistant' && node.decomposedMessageIds.includes(message.id);
    const canFork = !message.error && !generating;
    const assistantBody = normalizeAssistantContent(message.content);
    const partialState = message.streamError ? '连接中断 · 已保留部分结果' : message.interruptionReason === '页面重载后恢复为部分回答' ? '已恢复为部分回答' : '已停止 · 可继续';
    const emptyAssistant = generating
      ? '<p class="stream-placeholder">正在接收模型输出<span class="stream-caret"></span></p>'
      : partial ? '<p class="stream-placeholder stopped">尚未收到正文；可以继续生成或从这里分支。</p>' : '';
    return `<article class="message ${message.role} ${generating ? 'streaming' : ''} ${partial ? 'partial' : ''}" data-message-id="${message.id}" ${generating ? 'aria-live="polite"' : ''}>
      <div class="message-meta"><span class="message-role">${message.role === 'user' ? '你' : providerLabel(message.provider || node.provider || state.defaultProvider)}${message.model ? ` · ${escapeHtml(message.model)}` : ''}</span><span class="message-meta-end">${generating ? '<em class="message-generation-state"><i></i>正在接收</em>' : partial ? `<em class="message-generation-state stopped">${escapeHtml(partialState)}</em>` : ''}<time>${formatTime(message.createdAt)}</time></span></div>
      <div class="message-body rich-content">${message.role === 'assistant' ? (assistantBody ? markdownToHtml(assistantBody) : emptyAssistant) : escapeHtml(message.content)}</div>
      ${canFork || message.role === 'assistant' ? `<div class="message-actions">
        ${canFork ? `<button data-fork-message="${message.id}">从这里分支</button>` : ''}
        ${canRetry ? `<button data-retry-message="${message.id}">重试本次请求</button>` : ''}
        ${canContinue ? `<button class="continue-generation" data-continue-message="${message.id}">继续生成</button>` : ''}
        ${canDecompose ? `<button data-decompose-message="${message.id}">拆解这条回答</button>` : ''}${canSelectDecompose ? `<button data-decompose-selection="${message.id}">拆解选中文字</button>` : ''}
        ${canPromote ? `<button data-promote-selection="${message.id}">提炼选中文字</button>` : ''}
        ${decomposed ? '<button class="done-label">已拆解</button>' : ''}
      </div>` : ''}
    </article>`;
  }).join('');
}

function getComposerSelection(nodeId) {
  const override = state.composerByNode?.[nodeId];
  const requestedProvider = getProvider(override?.provider)?.id || state.defaultProvider;
  const providerId = providerIsReady(getProvider(requestedProvider)) ? requestedProvider : selectableProviders()[0]?.id || requestedProvider;
  const modelId = ensureModelForProvider(providerId, override?.model || (providerId === state.defaultProvider ? state.defaultModel : ''));
  const fallbackEffort = providerId === state.defaultProvider && modelId === state.defaultModel ? state.defaultReasoningEffort : 'auto';
  return {
    provider: providerId,
    model: modelId,
    reasoningEffort: ensureReasoningForProvider(providerId, modelId, override?.reasoningEffort || fallbackEffort)
  };
}

function setComposerSelection(nodeId, providerId, modelId, reasoningEffort = 'auto') {
  const normalizedProvider = getProvider(providerId)?.id || state.defaultProvider;
  const normalizedModel = ensureModelForProvider(normalizedProvider, modelId);
  const normalizedEffort = ensureReasoningForProvider(normalizedProvider, normalizedModel, reasoningEffort);
  if (normalizedProvider === state.defaultProvider && normalizedModel === state.defaultModel && normalizedEffort === state.defaultReasoningEffort) {
    delete state.composerByNode[nodeId];
  } else {
    state.composerByNode[nodeId] = { provider: normalizedProvider, model: normalizedModel, reasoningEffort: normalizedEffort };
  }
  saveState();
}

function renderComposer(node) {
  const selection = getComposerSelection(node.id);
  const busy = busyIds.has(node.id);
  const connected = providerIsReady(getProvider(selection.provider));
  const usingDefault = !state.composerByNode[node.id];
  const providerItems = selectableProviders()
    .map(profile => ({
      value: profile.id,
      label: profile.name,
      meta: profile.protocol === 'mock' ? '测试' : '已连接'
    }));
  const modelItems = (getProvider(selection.provider)?.models || [])
    .map(model => ({ value: model.id, label: model.label || model.id, meta: model.label && model.label !== model.id ? model.id : '' }));
  const reasoningItems = reasoningOptionsForModel(getProvider(selection.provider) || {}, selection.model);
  return `<div class="composer-wrap">
    <div class="composer">
      <div class="composer-input-row">
        <textarea id="messageDraft" ${busy ? 'disabled' : ''} placeholder="${busy ? '正在等待当前模型回答…' : connected ? '继续当前节点对话。Enter 发送，Shift + Enter 换行' : '请先在设置中连接模型供应商'}"></textarea>
      </div>
      <div class="composer-bottom">
        <div class="model-inline">
          ${renderComposerPicker('provider', 'composerProvider', '供应商', providerItems, selection.provider, busy || !providerItems.length)}
          ${renderComposerPicker('model', 'composerModel', '模型', modelItems, selection.model, busy || !connected)}
          ${renderComposerPicker('reasoning', 'composerReasoning', '思考等级', reasoningItems, selection.reasoningEffort, busy || !connected || reasoningItems.length <= 1)}
          <span id="composerDefaultHint" class="composer-hint">${busy ? '当前节点生成中' : !connected ? '当前模型尚未连接，请先打开设置完成连接' : usingDefault ? '发送会继续当前节点；从画布节点右侧 + 新建分支' : '当前节点使用单独模型或思考等级；从画布节点右侧 + 新建分支'}</span>
        </div>
        ${busy ? '<button id="stopGenerationBtn" class="stop-generation-button" aria-label="停止生成">停止</button>' : `<button id="sendBtn" class="send-button" aria-label="发送" ${connected ? '' : 'disabled title="请先连接模型供应商"'}>↑</button>`}
      </div>
    </div>
  </div>`;
}

function renderComposerPicker(kind, selectId, ariaLabel, items, selectedValue, disabled) {
  const selected = items.find(item => item.value === selectedValue) || items[0] || { value: '', label: '暂无可用项', meta: '' };
  const nativeOptions = items.map(item => `<option value="${escapeAttr(item.value)}" ${item.value === selected.value ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('');
  return `<div class="composer-picker composer-picker-${kind}" data-composer-picker="${kind}">
    <select id="${selectId}" class="composer-native-select" aria-label="${ariaLabel}" tabindex="-1" ${disabled ? 'disabled' : ''}>${nativeOptions}</select>
    <button type="button" class="composer-picker-trigger" data-composer-picker-trigger="${kind}" aria-haspopup="listbox" aria-expanded="false" ${disabled ? 'disabled' : ''} title="${escapeAttr(selected.label)}">
      <span class="composer-picker-value">${escapeHtml(selected.label)}</span>
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4"/></svg>
    </button>
    <div class="composer-picker-menu hidden" data-composer-picker-menu="${kind}" role="listbox" aria-label="${ariaLabel}">
      ${renderComposerPickerItems(items, selected.value)}
    </div>
  </div>`;
}

function renderComposerPickerItems(items, selectedValue) {
  if (!items.length) return '<span class="composer-picker-empty">暂无可用项</span>';
  return items.map(item => `<button type="button" role="option" aria-selected="${item.value === selectedValue}" class="${item.value === selectedValue ? 'selected' : ''}" data-composer-picker-option="${escapeAttr(item.value)}">
    <span>${escapeHtml(item.label)}</span>
    ${item.meta ? `<small>${escapeHtml(item.meta)}</small>` : ''}
    <i aria-hidden="true">${item.value === selectedValue ? '✓' : ''}</i>
  </button>`).join('');
}

function closeComposerPickers(except = null) {
  $$('[data-composer-picker]').forEach(picker => {
    if (picker === except) return;
    picker.querySelector('[data-composer-picker-menu]')?.classList.add('hidden');
    picker.querySelector('[data-composer-picker-trigger]')?.setAttribute('aria-expanded', 'false');
  });
}

function syncComposerPicker(kind, items, selectedValue) {
  const picker = document.querySelector(`[data-composer-picker="${kind}"]`);
  if (!picker) return;
  const selected = items.find(item => item.value === selectedValue) || items[0] || { value: '', label: '暂无可用项' };
  const select = picker.querySelector('.composer-native-select');
  const trigger = picker.querySelector('[data-composer-picker-trigger]');
  const value = trigger?.querySelector('.composer-picker-value');
  const menu = picker.querySelector('[data-composer-picker-menu]');
  if (select) {
    select.innerHTML = items.map(item => `<option value="${escapeAttr(item.value)}" ${item.value === selected.value ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('');
    select.value = selected.value;
    select.disabled = items.length <= 1 && kind === 'reasoning';
  }
  if (value) value.textContent = selected.label;
  if (trigger) {
    trigger.title = selected.label;
    trigger.disabled = items.length <= 1 && kind === 'reasoning';
  }
  if (menu) menu.innerHTML = renderComposerPickerItems(items, selected.value);
}

function bindComposerPicker(kind, onSelect) {
  const picker = document.querySelector(`[data-composer-picker="${kind}"]`);
  if (!picker) return;
  const trigger = picker.querySelector('[data-composer-picker-trigger]');
  const menu = picker.querySelector('[data-composer-picker-menu]');
  trigger?.addEventListener('click', event => {
    event.stopPropagation();
    if (trigger.disabled) return;
    const willOpen = menu.classList.contains('hidden');
    closeComposerPickers(willOpen ? picker : null);
    menu.classList.toggle('hidden', !willOpen);
    trigger.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) requestAnimationFrame(() => menu.querySelector('[aria-selected="true"]')?.focus());
  });
  picker.addEventListener('click', event => {
    const option = event.target.closest('[data-composer-picker-option]');
    if (!option) return;
    event.stopPropagation();
    onSelect(option.dataset.composerPickerOption);
    closeComposerPickers();
    trigger?.focus();
  });
  picker.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    closeComposerPickers();
    trigger?.focus();
  });
}

function bindComposer(node) {
  const draft = $('#messageDraft');
  if (!draft) return;
  const providerSelect = $('#composerProvider');
  const modelSelect = $('#composerModel');
  const reasoningSelect = $('#composerReasoning');
  const updateHint = () => {
    const hint = $('#composerDefaultHint');
    if (hint) hint.textContent = '当前节点使用单独模型或思考等级；从画布节点右侧 + 新建分支';
  };
  const syncReasoning = (providerId, modelId, preferred = 'auto') => {
    const items = reasoningOptionsForModel(getProvider(providerId) || {}, modelId);
    const effort = ensureReasoningForProvider(providerId, modelId, preferred);
    if (reasoningSelect) {
      reasoningSelect.innerHTML = items.map(item => `<option value="${escapeAttr(item.value)}">${escapeHtml(item.label)}</option>`).join('');
      reasoningSelect.value = effort;
    }
    syncComposerPicker('reasoning', items, effort);
    return effort;
  };
  const applyProvider = providerId => {
    const modelId = ensureModelForProvider(providerId, '');
    providerSelect.value = providerId;
    modelSelect.innerHTML = modelOptions(providerId, modelId);
    modelSelect.value = modelId;
    const effort = syncReasoning(providerId, modelId, 'auto');
    setComposerSelection(node.id, providerId, modelId, effort);
    updateHint();
    const providerItems = selectableProviders().map(profile => ({ value: profile.id, label: profile.name, meta: profile.protocol === 'mock' ? '测试' : '已连接' }));
    const modelItems = (getProvider(providerId)?.models || []).map(model => ({ value: model.id, label: model.label || model.id, meta: model.label && model.label !== model.id ? model.id : '' }));
    syncComposerPicker('provider', providerItems, providerId);
    syncComposerPicker('model', modelItems, modelId);
  };
  const applyModel = modelId => {
    modelSelect.value = modelId;
    const effort = syncReasoning(providerSelect.value, modelId, 'auto');
    setComposerSelection(node.id, providerSelect.value, modelId, effort);
    updateHint();
    const modelItems = (getProvider(providerSelect.value)?.models || []).map(model => ({ value: model.id, label: model.label || model.id, meta: model.label && model.label !== model.id ? model.id : '' }));
    syncComposerPicker('model', modelItems, modelId);
  };
  const applyReasoning = effort => {
    const normalized = ensureReasoningForProvider(providerSelect.value, modelSelect.value, effort);
    if (reasoningSelect) reasoningSelect.value = normalized;
    setComposerSelection(node.id, providerSelect.value, modelSelect.value, normalized);
    syncComposerPicker('reasoning', reasoningOptionsForModel(getProvider(providerSelect.value) || {}, modelSelect.value), normalized);
    updateHint();
  };
  providerSelect?.addEventListener('change', e => applyProvider(e.target.value));
  modelSelect?.addEventListener('change', e => applyModel(e.target.value));
  reasoningSelect?.addEventListener('change', e => applyReasoning(e.target.value));
  bindComposerPicker('provider', applyProvider);
  bindComposerPicker('model', applyModel);
  bindComposerPicker('reasoning', applyReasoning);
  const stopButton = $('#stopGenerationBtn');
  if (stopButton) {
    stopButton.addEventListener('click', () => stopGeneration(node.id));
    return;
  }
  const send = async () => {
    const content = draft.value.trim();
    if (!content || busyIds.has(node.id)) return;
    const provider = providerSelect.value;
    const model = modelSelect.value;
    const reasoningEffort = reasoningSelect?.value || 'auto';
    if (!requireConnectedProvider(provider, { openSettings: true })) return;
    draft.value = '';
    await sendInCurrentNode(node.id, content, provider, model, reasoningEffort);
  };
  $('#sendBtn')?.addEventListener('click', send);
  draft.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      send();
    }
  });
}

function bindMessageActions(node) {
  $$('[data-fork-message]').forEach(button => {
    button.addEventListener('click', () => openBranchComposer(node.id, button.dataset.forkMessage));
  });
  $$('[data-decompose-message]').forEach(button => {
    button.addEventListener('click', () => decomposeMessage(node.id, button.dataset.decomposeMessage, { scope: 'message' }));
  });
  $$('.message.assistant .message-body').forEach(body => {
    const capture = () => requestAnimationFrame(() => captureMessageSelection(node));
    body.addEventListener('pointerup', capture);
    body.addEventListener('mouseup', capture);
    body.addEventListener('keyup', capture);
  });
  $$('[data-decompose-selection]').forEach(button => {
    const messageId = button.dataset.decomposeSelection;
    if (lastMessageSelection?.messageId === messageId) markSelectionButton(button, lastMessageSelection.visibleText || lastMessageSelection.text);
    const captureBeforeAction = event => {
      captureMessageSelection(node, messageId);
      event.preventDefault();
    };
    button.addEventListener('pointerdown', captureBeforeAction);
    button.addEventListener('mousedown', captureBeforeAction);
    button.addEventListener('click', () => {
      const live = captureMessageSelection(node, messageId);
      const selected = live || (lastMessageSelection?.messageId === messageId ? lastMessageSelection : null);
      if (!selected?.text) {
        showOperationError('尚未选择文字', '请在这条回答正文中拖动选择一段文字，再点击“拆解选中文字”。');
        return;
      }
      decomposeMessage(node.id, messageId, { scope: 'selection', selectedText: selected.text, selectionStart: selected.start, selectionEnd: selected.end });
    });
  });
  $$('[data-promote-selection]').forEach(button => {
    const messageId = button.dataset.promoteSelection;
    if (lastMessageSelection?.messageId === messageId) markArtifactSelectionButton(button, lastMessageSelection.visibleText || lastMessageSelection.text);
    const captureBeforeAction = event => {
      captureMessageSelection(node, messageId);
      event.preventDefault();
    };
    button.addEventListener('pointerdown', captureBeforeAction);
    button.addEventListener('mousedown', captureBeforeAction);
    button.addEventListener('click', () => {
      const live = captureMessageSelection(node, messageId);
      const selected = live || (lastMessageSelection?.messageId === messageId ? lastMessageSelection : null);
      if (!selected?.text) {
        showOperationError('尚未选择文字', '请在这条回答正文中拖动选择一段文字，再点击“提炼选中文字”。');
        return;
      }
      openArtifactDialog(node.id, messageId, selected);
    });
  });
  $$('[data-retry-message]').forEach(button => {
    button.addEventListener('click', () => retryFailedRequest(node.id, button.dataset.retryMessage));
  });
  $$('[data-continue-message]').forEach(button => {
    button.addEventListener('click', () => continuePartialGeneration(node.id, button.dataset.continueMessage));
  });
}

function bindSourceContentActions(node) {
  if (!node || !['content_section', 'annotation'].includes(node.kind)) return;
  const card = document.querySelector(`.source-content-card[data-source-content-node="${CSS.escape(node.id)}"]`);
  const body = card?.querySelector('[data-source-selection-body]');
  if (!card || !body) return;
  const capture = () => requestAnimationFrame(() => captureSourceContentSelection(node));
  body.addEventListener('pointerup', capture);
  body.addEventListener('mouseup', capture);
  body.addEventListener('keyup', capture);

  const bindSelectionAction = (selector, action) => {
    const button = card.querySelector(selector);
    if (!button) return;
    if (lastSourceSelection?.nodeId === node.id) {
      markSourceSelectionButton(button, lastSourceSelection.visibleText || lastSourceSelection.text, action === 'promote' ? '提炼' : '拆解');
    }
    const captureBeforeAction = event => {
      captureSourceContentSelection(node);
      event.preventDefault();
    };
    button.addEventListener('pointerdown', captureBeforeAction);
    button.addEventListener('mousedown', captureBeforeAction);
    button.addEventListener('click', () => {
      const live = captureSourceContentSelection(node);
      const selected = live || (lastSourceSelection?.nodeId === node.id ? lastSourceSelection : null);
      if (!selected?.text) {
        showOperationError('尚未选择文字', `请在这个内容模块中拖动选择一段文字，再点击“${action === 'promote' ? '提炼' : '拆解'}选中文字”。`);
        return;
      }
      if (action === 'promote') openArtifactDialog(node.id, '', selected, { sourceType: 'node_content' });
      else decomposeSourceContent(node.id, { scope: 'selection', selectedText: selected.text, selectionStart: selected.start, selectionEnd: selected.end });
    });
  };

  card.querySelector('[data-decompose-source]')?.addEventListener('click', () => decomposeSourceContent(node.id, { scope: 'node' }));
  card.querySelector('[data-edit-annotation]')?.addEventListener('click', () => openAnnotationDialog(node.annotationSourceNodeId || node.parentId, { annotationNodeId: node.id }));
  bindSelectionAction('[data-decompose-source-selection]', 'decompose');
  bindSelectionAction('[data-promote-source-selection]', 'promote');
}

function scheduleMessageSelectionCapture() {
  if (messageSelectionCaptureFrame) cancelAnimationFrame(messageSelectionCaptureFrame);
  messageSelectionCaptureFrame = requestAnimationFrame(() => {
    messageSelectionCaptureFrame = 0;
    const selected = selectedNodes();
    if (selected.length !== 1) return;
    captureSourceContentSelection(selected[0]);
    captureMessageSelection(selected[0]);
  });
}

function selectionRangeWithinElement(selection, element) {
  if (!selection || selection.rangeCount < 1 || selection.isCollapsed || !element) return null;
  const original = selection.getRangeAt(0);
  try {
    if (!original.intersectsNode(element)) return null;
  } catch {
    return null;
  }
  const bounds = document.createRange();
  bounds.selectNodeContents(element);
  const range = original.cloneRange();
  try {
    if (range.compareBoundaryPoints(Range.START_TO_START, bounds) < 0) {
      range.setStart(bounds.startContainer, bounds.startOffset);
    }
    if (range.compareBoundaryPoints(Range.END_TO_END, bounds) > 0) {
      range.setEnd(bounds.endContainer, bounds.endOffset);
    }
  } catch {
    return null;
  }
  return range.collapsed ? null : range;
}

function rangeTextWithoutIgnored(range) {
  if (!range) return '';
  const fragment = range.cloneContents();
  fragment.querySelectorAll?.('[data-selection-ignore]').forEach(element => element.remove());
  return String(fragment.textContent || '').replace(/\u00a0/g, ' ');
}

function selectableTextLength(element) {
  if (!element) return 0;
  const clone = element.cloneNode(true);
  clone.querySelectorAll?.('[data-selection-ignore]').forEach(item => item.remove());
  return String(clone.textContent || '').length;
}

function captureRichTextSelection({ node, element, rawText, sourceType, messageId = '' }) {
  const selection = window.getSelection();
  const range = selectionRangeWithinElement(selection, element);
  if (!range) return null;
  const visibleText = rangeTextWithoutIgnored(range).trim();
  if (!visibleText) return null;
  const prefix = range.cloneRange();
  prefix.selectNodeContents(element);
  prefix.setEnd(range.startContainer, range.startOffset);
  const visibleStart = rangeTextWithoutIgnored(prefix).length;
  const raw = normalizeAssistantContent(rawText || '');
  const resolved = resolveMarkdownSelection(raw, visibleText, visibleStart, selectableTextLength(element));
  const located = Number.isInteger(resolved?.start) && resolved.start >= 0 && Number.isInteger(resolved?.end) && resolved.end > resolved.start;
  return {
    sourceType,
    nodeId: node.id,
    messageId,
    text: located ? resolved.text : visibleText,
    visibleText,
    start: located ? resolved.start : -1,
    end: located ? resolved.end : -1,
    located,
    capturedAt: Date.now()
  };
}

function captureMessageSelection(node, expectedMessageId = '') {
  const articles = expectedMessageId
    ? [...document.querySelectorAll(`.message.assistant[data-message-id="${CSS.escape(expectedMessageId)}"]`)]
    : [...document.querySelectorAll('.message.assistant[data-message-id]')];
  const candidates = [];
  for (const article of articles) {
    const messageId = article.dataset.messageId || '';
    const message = node.messages.find(item => item.id === messageId);
    const body = article.querySelector('.message-body');
    if (!message || !body) continue;
    const captured = captureRichTextSelection({ node, element: body, rawText: message.content, sourceType: 'message', messageId });
    if (captured) candidates.push(captured);
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.visibleText.length - a.visibleText.length || Number(b.located) - Number(a.located));
  const captured = candidates[0];
  lastMessageSelection = captured;
  const button = document.querySelector(`[data-decompose-selection="${CSS.escape(captured.messageId)}"]`);
  if (button) markSelectionButton(button, captured.visibleText);
  const promoteButton = document.querySelector(`[data-promote-selection="${CSS.escape(captured.messageId)}"]`);
  if (promoteButton) markArtifactSelectionButton(promoteButton, captured.visibleText);
  return captured;
}

function captureSourceContentSelection(node) {
  const card = document.querySelector(`.source-content-card[data-source-content-node="${CSS.escape(node.id)}"]`);
  const body = card?.querySelector('[data-source-selection-body]');
  if (!body || !node.content) return null;
  const captured = captureRichTextSelection({ node, element: body, rawText: node.content, sourceType: 'node_content' });
  if (!captured) return null;
  lastSourceSelection = captured;
  const decomposeButton = card.querySelector('[data-decompose-source-selection]');
  if (decomposeButton) markSourceSelectionButton(decomposeButton, captured.visibleText, '拆解');
  const promoteButton = card.querySelector('[data-promote-source-selection]');
  if (promoteButton) markSourceSelectionButton(promoteButton, captured.visibleText, '提炼');
  return captured;
}

function markSourceSelectionButton(button, text, action) {
  const count = [...String(text || '')].length;
  button.classList.add('has-selection');
  button.textContent = `${action}已选 ${count} 字`;
}

function markSelectionButton(button, text) {
  const count = [...String(text || '')].length;
  button.classList.add('has-selection');
  button.textContent = `拆解已选 ${count} 字`;
}

function markArtifactSelectionButton(button, text) {
  const count = [...String(text || '')].length;
  button.classList.add('has-artifact-selection');
  button.textContent = `提炼已选 ${count} 字`;
}

function artifactById(artifactId) {
  return (state.artifacts || []).find(artifact => artifact.id === artifactId) || null;
}

function artifactsForNode(nodeId) {
  return (state.artifacts || [])
    .filter(artifact => artifact.nodeId === nodeId)
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
}

function relationsForArtifact(artifactId) {
  return (state.reasoningEdges || []).filter(edge => edge.sourceArtifactId === artifactId || edge.targetArtifactId === artifactId);
}

function artifactWorkStatusLabel(status) {
  return ({ open: '待处理', resolved: '已处理', archived: '已归档' })[status] || status;
}

function artifactSourceDescription(artifact) {
  if (!artifact) return '无来源';
  const node = getNode(artifact.nodeId);
  const range = artifact.sourceStart >= 0 ? ` · 原文 ${artifact.sourceStart}–${artifact.sourceEnd}` : '';
  return `${node?.title || '未知节点'}${artifact.sourceMessageId ? ` · 消息 ${artifact.sourceMessageId}` : ''}${range}`;
}

function renderDecisionDetails(artifact) {
  const data = artifact?.decisionData;
  if (!data) return '';
  const list = (label, items, formatter = value => value) => Array.isArray(items) && items.length
    ? `<div class="decision-detail"><strong>${escapeHtml(label)}</strong><ul>${items.map(item => `<li>${escapeHtml(formatter(item))}</li>`).join('')}</ul></div>`
    : '';
  return `<div class="decision-details">
    ${list('形成依据', data.rationale)}
    ${list('支持证据', data.supportingEvidenceIds, id => artifactById(id)?.title || id)}
    ${list('未解决风险', data.unresolvedRisks)}
    ${list('下一步行动', data.nextActions)}
  </div>`;
}

function renderNodeArtifacts(node) {
  const artifacts = artifactsForNode(node.id);
  if (!artifacts.length) return '';
  const cards = artifacts.map(artifact => {
    const relationships = relationsForArtifact(artifact.id);
    const relationshipHtml = relationships.length ? `<div class="artifact-relations">${relationships.map(edge => {
      const outbound = edge.sourceArtifactId === artifact.id;
      const other = artifactById(outbound ? edge.targetArtifactId : edge.sourceArtifactId);
      const relationLabel = REASONING_RELATION_LABELS[edge.relation] || edge.relation;
      return `<div class="artifact-relation"><span>${outbound ? '→' : '←'}</span><b>${escapeHtml(relationLabel)}</b><span>${escapeHtml(other?.title || '已删除对象')}</span></div>`;
    }).join('')}</div>` : '';
    return `<article class="artifact-card" data-artifact-card="${escapeAttr(artifact.id)}">
      <div class="artifact-card-top">
        <span class="artifact-kind ${escapeAttr(artifact.kind)}">${escapeHtml(ARTIFACT_KIND_LABELS[artifact.kind] || artifact.kind)}</span>
        <h4>${escapeHtml(artifact.title)}</h4>
        <button type="button" class="artifact-source-link" data-artifact-locate="${escapeAttr(artifact.id)}" title="返回原消息">来源</button>
      </div>
      <p>${escapeHtml(artifact.content)}</p>
      <div class="artifact-card-source"><span>${escapeHtml(artifactSourceDescription(artifact))}</span><span>更新 ${escapeHtml(formatProjectTime(artifact.updatedAt))}</span></div>
      ${renderDecisionDetails(artifact)}
      <div class="artifact-card-controls">
        <select data-artifact-work="${escapeAttr(artifact.id)}" aria-label="工作状态">
          ${['open','resolved','archived'].map(status => `<option value="${status}" ${artifact.workStatus === status ? 'selected' : ''}>${artifactWorkStatusLabel(status)}</option>`).join('')}
        </select>
        <select data-artifact-confidence="${escapeAttr(artifact.id)}" aria-label="可信状态">
          ${Object.entries(CONFIDENCE_STATUS_LABELS).map(([status, label]) => `<option value="${status}" ${artifact.confidenceStatus === status ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}
        </select>
        <button type="button" data-artifact-connect="${escapeAttr(artifact.id)}">关系</button>
      </div>
      ${relationshipHtml}
    </article>`;
  }).join('');
  return `<section class="artifact-panel">
    <div class="artifact-panel-head"><div><span>结构化推理</span><strong>${artifacts.length} 个可追溯对象</strong></div><button type="button" data-open-reasoning-library>查看全部</button></div>
    ${cards}
  </section>`;
}

function bindArtifactActions() {
  $$('[data-artifact-work]').forEach(select => select.addEventListener('change', () => updateArtifactField(select.dataset.artifactWork, 'workStatus', select.value)));
  $$('[data-artifact-confidence]').forEach(select => select.addEventListener('change', () => updateArtifactField(select.dataset.artifactConfidence, 'confidenceStatus', select.value)));
  $$('[data-artifact-connect]').forEach(button => button.addEventListener('click', () => openRelationDialog(button.dataset.artifactConnect)));
  $$('[data-artifact-locate]').forEach(button => button.addEventListener('click', () => locateArtifactSource(button.dataset.artifactLocate)));
  $('[data-open-reasoning-library]')?.addEventListener('click', openReasoningLibrary);
}

function guessArtifactKind(text) {
  const value = String(text || '').trim();
  if (/[?？]$|^(为什么|如何|是否|能否|何时|哪里|what|why|how|whether)\b/i.test(value)) return 'question';
  if (/(风险|隐患|代价|失败|威胁|risk|downside|trade-?off)/i.test(value)) return 'risk';
  if (/(假设|前提|推测|预计|assum|suppose|presume)/i.test(value)) return 'assumption';
  if (/(证据|数据显示|研究表明|根据|来源|evidence|data shows|research)/i.test(value)) return 'evidence';
  if (/(行动|下一步|应当执行|需要完成|todo|next step|action)/i.test(value)) return 'action';
  if (/(方案|选项|路线|可以选择|option|approach|alternative)/i.test(value)) return 'option';
  return 'claim';
}

function artifactTitleFromText(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim().replace(/^[#>*\-\d.)\s]+/, '');
  return clean.length > 46 ? `${clean.slice(0, 45)}…` : clean || '新的推理对象';
}

function openAnnotationDialog(sourceNodeId, { position = null, annotationNodeId = '' } = {}) {
  const annotation = annotationNodeId ? getNode(annotationNodeId) : null;
  const source = getNode(annotation?.annotationSourceNodeId || annotation?.parentId || sourceNodeId);
  if (!source || (annotationNodeId && annotation?.kind !== 'annotation')) {
    return showOperationError('无法打开标注', '来源节点或标注模块已经不存在。');
  }
  annotationDraftSourceId = source.id;
  annotationDraftPosition = position || (annotation ? { x: annotation.x, y: annotation.y, manual: annotation.annotationManualPosition } : defaultAnnotationPosition(source));
  annotationEditingNodeId = annotation?.id || '';
  $('#annotationDialogTitle').textContent = annotation ? '编辑标注模块' : '新建标注模块';
  $('#annotationSourceLabel').textContent = `连接到“${source.title}”。标注不会进入来源节点的子分支完成度；需要时仍可围绕标注继续追问。`;
  $('#annotationTypeSelect').value = annotation?.annotationType || 'note';
  setAnnotationColorPicker(annotation?.annotationColor || 'auto');
  $('#annotationTitleInput').value = annotation?.title || '';
  $('#annotationContentInput').value = annotation?.content || '';
  $('#deleteAnnotationBtn').classList.toggle('hidden', !annotation);
  $('#annotationDialog').showModal();
  requestAnimationFrame(() => (annotation ? $('#annotationTitleInput') : $('#annotationContentInput'))?.focus());
}

function annotationTitleFromContent(content, type = 'note') {
  const clean = String(content || '').replace(/\s+/g, ' ').trim();
  if (clean) return clean.length > 42 ? `${clean.slice(0, 41)}…` : clean;
  return `新的${ANNOTATION_TYPE_LABELS[type] || '标注'}`;
}

function saveAnnotationFromDialog() {
  const source = getNode(annotationDraftSourceId);
  const type = Object.hasOwn(ANNOTATION_TYPE_LABELS, $('#annotationTypeSelect').value) ? $('#annotationTypeSelect').value : 'note';
  const annotationColor = Object.hasOwn(ANNOTATION_COLOR_STYLES, $('#annotationColorInput')?.value)
    ? $('#annotationColorInput').value
    : 'auto';
  const content = $('#annotationContentInput').value.trim();
  const title = $('#annotationTitleInput').value.trim() || annotationTitleFromContent(content, type);
  if (!source) return showOperationError('保存失败', '标注的来源节点已经不存在。');
  if (!content) {
    $('#annotationContentInput').focus();
    return showOperationError('保存失败', '请先填写标注内容。');
  }
  let annotation = annotationEditingNodeId ? getNode(annotationEditingNodeId) : null;
  if (annotation && annotation.kind === 'annotation') {
    annotation.annotationType = type;
    annotation.annotationColor = annotationColor;
    annotation.annotationSourceNodeId = source.id;
    annotation.parentId = source.id;
    annotation.sourceNodeIds = unique([...(annotation.sourceNodeIds || []), source.id]);
    annotation.title = title;
    annotation.question = title;
    annotation.content = content;
    annotation.sourceText = content;
    annotation.summary = summarizeForCard(content);
    annotation.updatedAt = now();
    if (!state.edges.some(edge => edge.source === source.id && edge.target === annotation.id && edge.relation === 'annotation')) {
      state.edges.push({ id: makeId('edge'), source: source.id, target: annotation.id, relation: 'annotation' });
    }
  } else {
    const position = annotationDraftPosition || defaultAnnotationPosition(source);
    annotation = makeNode({
      kind: 'annotation',
      origin: 'annotation',
      annotationType: type,
      annotationColor,
      annotationSourceNodeId: source.id,
      sourceNodeIds: [source.id],
      annotationManualPosition: Boolean(position.manual),
      layoutStable: true,
      parentId: source.id,
      x: clamp(Number(position.x || source.x + 40), 20, 11200),
      y: clamp(Number(position.y || source.y + nodeHeight(source) + 80), 20, 11200),
      title,
      question: title,
      content,
      sourceText: content,
      sourceScope: 'annotation',
      summary: summarizeForCard(content),
      status: 'open',
      confidenceStatus: type === 'risk' ? 'partial' : 'unverified',
      goalVersion: state.goal.version,
      layoutOrder: Date.now()
    });
    state.nodes.push(annotation);
    state.edges.push({ id: makeId('edge'), source: source.id, target: annotation.id, relation: 'annotation' });
  }
  annotationDraftSourceId = '';
  annotationDraftPosition = null;
  annotationEditingNodeId = '';
  $('#annotationDialog').close();
  state.selectedIds = [annotation.id];
  saveAndRender();
  requestAnimationFrame(() => focusNodesInView([source.id, annotation.id], { persist: false, maxScale: 1.06 }));
}

async function deleteAnnotationFromDialog() {
  const annotation = getNode(annotationEditingNodeId);
  if (!annotation || annotation.kind !== 'annotation') return;
  $('#annotationDialog').close();
  const confirmed = await requestConfirmation({
    eyebrow: '删除标注',
    title: `删除“${annotation.title}”？`,
    message: '标注及从它继续产生的后续节点会一起移除，来源主节点不会受到影响。',
    confirmLabel: '删除标注',
    danger: true
  });
  if (!confirmed) {
    openAnnotationDialog(annotation.annotationSourceNodeId || annotation.parentId, { annotationNodeId: annotation.id });
    return;
  }
  deleteAnnotationSubtree(annotation.id);
}

function deleteAnnotationSubtree(annotationId) {
  const annotation = getNode(annotationId);
  if (!annotation || annotation.kind !== 'annotation') return;
  const ids = new Set([annotation.id, ...allDescendantsOf(annotation.id).map(node => node.id)]);
  const sourceId = annotation.annotationSourceNodeId || annotation.parentId || '';
  const artifactIds = new Set(state.artifacts.filter(artifact => ids.has(artifact.nodeId)).map(artifact => artifact.id));
  state.nodes = state.nodes.filter(node => !ids.has(node.id));
  state.edges = state.edges.filter(edge => !ids.has(edge.source) && !ids.has(edge.target));
  state.artifacts = state.artifacts.filter(artifact => !ids.has(artifact.nodeId));
  state.reasoningEdges = state.reasoningEdges.filter(edge => !artifactIds.has(edge.sourceArtifactId) && !artifactIds.has(edge.targetArtifactId));
  state.generationRecords = state.generationRecords.filter(record => !ids.has(record.nodeId));
  state.modelCalls = state.generationRecords;
  for (const id of ids) {
    delete state.composerByNode[id];
    delete state.contextPreferencesByNode[id];
  }
  state.selectedIds = sourceId && getNode(sourceId) ? [sourceId] : ['root'].filter(id => getNode(id));
  annotationDraftSourceId = '';
  annotationDraftPosition = null;
  annotationEditingNodeId = '';
  saveAndRender();
}

function openArtifactDialog(nodeId, messageId, selection, { sourceType = 'message' } = {}) {
  const node = getNode(nodeId);
  const message = messageId ? node?.messages.find(item => item.id === messageId) : null;
  const content = String(selection?.visibleText || selection?.text || '').trim();
  if (!node || !content || (sourceType === 'message' && !message)) {
    return showOperationError('无法提炼', '来源节点、消息或所选文字已不存在，请重新选择。');
  }
  const sourceStart = Number.isFinite(selection?.start) ? selection.start : -1;
  const sourceEnd = Number.isFinite(selection?.end) ? selection.end : -1;
  artifactDraftSource = {
    nodeId,
    sourceType,
    messageId: sourceType === 'message' ? message.id : '',
    sourceStart,
    sourceEnd,
    sourceText: String(selection?.text || content).trim(),
    contextSnapshotId: node.lastContextSnapshotId || node.contextSnapshotId || node.branchAnchor?.contextSnapshotId || ''
  };
  const kind = guessArtifactKind(content);
  $('#artifactKindSelect').value = kind;
  $('#artifactConfidenceSelect').value = kind === 'evidence' ? 'partial' : 'unverified';
  $('#artifactTitleInput').value = artifactTitleFromText(content);
  $('#artifactContentInput').value = content;
  $('#artifactDialogTitle').textContent = `提炼为${ARTIFACT_KIND_LABELS[kind]}`;
  const rangeLabel = sourceStart >= 0 && sourceEnd > sourceStart ? `原文 ${sourceStart}–${sourceEnd}` : '可见选区 · 原文位置未定位';
  $('#artifactSourceLabel').textContent = sourceType === 'message'
    ? `${node.title} · 消息 ${message.id} · ${rangeLabel}`
    : `${node.title} · 内容模块 · ${rangeLabel}`;
  $('#artifactDialog').showModal();
  requestAnimationFrame(() => $('#artifactTitleInput')?.focus());
}

function saveArtifactFromDialog() {
  if (!artifactDraftSource) return;
  const node = getNode(artifactDraftSource.nodeId);
  const message = artifactDraftSource.messageId ? node?.messages.find(item => item.id === artifactDraftSource.messageId) : null;
  if (!node || (artifactDraftSource.sourceType === 'message' && !message)) {
    return showOperationError('保存失败', '来源内容已经不存在。');
  }
  const content = $('#artifactContentInput').value.trim();
  const title = $('#artifactTitleInput').value.trim() || artifactTitleFromText(content);
  if (!content) return showOperationError('保存失败', '推理对象内容不能为空。');
  const artifact = makeArtifactRecord({
    id: makeId('artifact'),
    kind: $('#artifactKindSelect').value,
    title,
    content,
    nodeId: node.id,
    sourceMessageId: message?.id || '',
    sourceStart: artifactDraftSource.sourceStart,
    sourceEnd: artifactDraftSource.sourceEnd,
    sourceText: artifactDraftSource.sourceText,
    contextSnapshotId: artifactDraftSource.contextSnapshotId,
    workStatus: 'open',
    confidenceStatus: $('#artifactConfidenceSelect').value,
    createdAt: now(),
    updatedAt: now()
  });
  state.artifacts.push(artifact);
  if (message) message.artifactIds = unique([...(message.artifactIds || []), artifact.id]);
  node.updatedAt = now();
  artifactDraftSource = null;
  $('#artifactDialog').close();
  saveAndRender();
  showOperationNotice('已保留推理对象', `${ARTIFACT_KIND_LABELS[artifact.kind]}“${artifact.title}”仍可返回来源核查。`);
}

function updateArtifactField(artifactId, key, value, { render = true } = {}) {
  const artifact = artifactById(artifactId);
  if (!artifact) return;
  if (key === 'workStatus' && !['open','resolved','archived'].includes(value)) return;
  if (key === 'confidenceStatus' && !Object.hasOwn(CONFIDENCE_STATUS_LABELS, value)) return;
  artifact[key] = value;
  artifact.updatedAt = now();
  if (render) saveAndRender(); else saveState();
  if ($('#reasoningDialog')?.open) renderReasoningLibrary();
}

async function deleteArtifact(artifactId) {
  const artifact = artifactById(artifactId);
  if (!artifact) return;
  const confirmed = await requestConfirmation({
    eyebrow: '删除推理对象',
    title: `删除“${artifact.title}”？`,
    message: '与它相连的支持、反驳或依赖关系也会一并删除。',
    confirmLabel: '删除对象',
    danger: true
  });
  if (!confirmed) return;
  state.artifacts = state.artifacts.filter(item => item.id !== artifactId);
  state.reasoningEdges = state.reasoningEdges.filter(edge => edge.sourceArtifactId !== artifactId && edge.targetArtifactId !== artifactId);
  state.nodes.forEach(node => node.messages.forEach(message => {
    if (Array.isArray(message.artifactIds)) message.artifactIds = message.artifactIds.filter(id => id !== artifactId);
  }));
  saveAndRender();
  if ($('#reasoningDialog')?.open) renderReasoningLibrary();
}

function openRelationDialog(sourceArtifactId) {
  const source = artifactById(sourceArtifactId);
  if (!source) return;
  const targets = (state.artifacts || []).filter(artifact => artifact.id !== sourceArtifactId && artifact.workStatus !== 'archived');
  if (!targets.length) return showOperationError('无法建立关系', '至少需要另一个未归档的推理对象。');
  relationSourceArtifactId = sourceArtifactId;
  $('#relationSourceLabel').textContent = `“${source.title}”连接到…`;
  $('#relationTargetSelect').innerHTML = targets.map(artifact => `<option value="${escapeAttr(artifact.id)}">${escapeHtml(ARTIFACT_KIND_LABELS[artifact.kind])} · ${escapeHtml(artifact.title)}</option>`).join('');
  $('#relationTypeSelect').value = 'supports';
  $('#relationDialog').showModal();
}

function saveReasoningRelation() {
  const sourceArtifactId = relationSourceArtifactId;
  const targetArtifactId = $('#relationTargetSelect').value;
  const relation = $('#relationTypeSelect').value;
  const edge = makeReasoningEdge({ id: makeId('reason'), sourceArtifactId, targetArtifactId, relation, createdAt: now() });
  if (!edge) return showOperationError('关系无效', '推理对象不能连接到自身。');
  const duplicate = state.reasoningEdges.some(item => item.sourceArtifactId === edge.sourceArtifactId && item.targetArtifactId === edge.targetArtifactId && item.relation === edge.relation);
  if (duplicate) return showOperationError('关系已存在', '相同方向与类型的关系不需要重复建立。');
  state.reasoningEdges.push(edge);
  relationSourceArtifactId = '';
  $('#relationDialog').close();
  saveAndRender();
  if ($('#reasoningDialog')?.open) renderReasoningLibrary();
}

function populateReasoningFilters() {
  const kind = $('#reasoningKindFilter');
  const confidence = $('#reasoningConfidenceFilter');
  if (kind && kind.options.length <= 1) {
    kind.insertAdjacentHTML('beforeend', Object.entries(ARTIFACT_KIND_LABELS).map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`).join(''));
  }
  if (confidence && confidence.options.length <= 1) {
    confidence.insertAdjacentHTML('beforeend', Object.entries(CONFIDENCE_STATUS_LABELS).map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`).join(''));
  }
}

function openReasoningLibrary() {
  populateReasoningFilters();
  renderReasoningLibrary();
  if (!$('#reasoningDialog').open) $('#reasoningDialog').showModal();
}

function renderReasoningLibrary() {
  populateReasoningFilters();
  const kindSelect = $('#reasoningKindFilter');
  const confidenceSelect = $('#reasoningConfidenceFilter');
  if (kindSelect) kindSelect.value = reasoningFilterKind;
  if (confidenceSelect) confidenceSelect.value = reasoningFilterConfidence;
  const all = [...(state.artifacts || [])].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  const visible = all.filter(artifact => (reasoningFilterKind === 'all' || artifact.kind === reasoningFilterKind) && (reasoningFilterConfidence === 'all' || artifact.confidenceStatus === reasoningFilterConfidence));
  const verified = all.filter(artifact => artifact.confidenceStatus === 'verified').length;
  const unresolved = all.filter(artifact => artifact.workStatus === 'open').length;
  $('#reasoningSummary').innerHTML = `<span>${all.length} 个对象</span><span>${state.reasoningEdges.length} 条关系</span><span>${verified} 个已验证</span><span>${unresolved} 个待处理</span>`;
  $('#reasoningArtifactList').innerHTML = visible.length ? visible.map(artifact => `<article class="reasoning-library-card" data-reasoning-artifact="${escapeAttr(artifact.id)}">
    <span class="artifact-kind ${escapeAttr(artifact.kind)}">${escapeHtml(ARTIFACT_KIND_LABELS[artifact.kind])}</span>
    <strong>${escapeHtml(artifact.title)}</strong>
    <p>${escapeHtml(truncateInline(artifact.content, 180))}<br><small>${escapeHtml(CONFIDENCE_STATUS_LABELS[artifact.confidenceStatus])} · ${escapeHtml(artifactWorkStatusLabel(artifact.workStatus))} · ${escapeHtml(artifactSourceDescription(artifact))}</small></p>
    <div class="reasoning-library-actions"><button type="button" data-reasoning-locate="${escapeAttr(artifact.id)}">定位</button><button type="button" data-reasoning-connect="${escapeAttr(artifact.id)}">关系</button><button type="button" class="danger-soft" data-reasoning-delete="${escapeAttr(artifact.id)}">删除</button></div>
  </article>`).join('') : '<div class="reasoning-empty">当前筛选下没有推理对象。选中 AI 回答文字后点击“提炼选中文字”。</div>';
  $('#reasoningRelationList').innerHTML = state.reasoningEdges.length ? state.reasoningEdges.map(edge => {
    const source = artifactById(edge.sourceArtifactId);
    const target = artifactById(edge.targetArtifactId);
    return `<div class="reasoning-relation-row"><p><strong>${escapeHtml(source?.title || '已删除对象')}</strong><br><b>${escapeHtml(REASONING_RELATION_LABELS[edge.relation] || edge.relation)}</b> → ${escapeHtml(target?.title || '已删除对象')}</p><button type="button" data-reasoning-edge-delete="${escapeAttr(edge.id)}">删除</button></div>`;
  }).join('') : '<div class="reasoning-empty">尚未建立支持、反驳或依赖关系。</div>';
  $$('[data-reasoning-locate]').forEach(button => button.addEventListener('click', () => locateArtifactSource(button.dataset.reasoningLocate)));
  $$('[data-reasoning-connect]').forEach(button => button.addEventListener('click', () => openRelationDialog(button.dataset.reasoningConnect)));
  $$('[data-reasoning-delete]').forEach(button => button.addEventListener('click', () => deleteArtifact(button.dataset.reasoningDelete)));
  $$('[data-reasoning-edge-delete]').forEach(button => button.addEventListener('click', () => deleteReasoningRelation(button.dataset.reasoningEdgeDelete)));
}

function deleteReasoningRelation(edgeId) {
  state.reasoningEdges = state.reasoningEdges.filter(edge => edge.id !== edgeId);
  saveAndRender();
  renderReasoningLibrary();
}

function locateArtifactSource(artifactId) {
  const artifact = artifactById(artifactId);
  const node = artifact && getNode(artifact.nodeId);
  if (!artifact || !node) return;
  $('#reasoningDialog')?.close();
  state.selectedIds = [node.id];
  nodeSearchQuery = '';
  saveState();
  render();
  requestAnimationFrame(() => {
    focusNodesInView([node.id], { persist: true, maxScale: 1.08 });
    requestAnimationFrame(() => {
      const selector = artifact.sourceMessageId ? `.message[data-message-id="${CSS.escape(artifact.sourceMessageId)}"]` : '.source-content-card';
      const target = document.querySelector(selector);
      if (!target) return;
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      target.classList.add('source-highlight');
      setTimeout(() => target.classList.remove('source-highlight'), 1800);
    });
  });
}

function comparisonContextFacts(node) {
  const snapshot = contextSnapshotById(node.lastContextSnapshotId || node.contextSnapshotId || node.branchAnchor?.contextSnapshotId || '');
  return {
    anchor: node.branchAnchor?.cutoffMessageId || snapshot?.branchAnchor?.cutoffMessageId || '最新消息',
    snapshotId: snapshot?.id || '无快照',
    tokenCount: Number(snapshot?.metrics?.estimatedInputTokens || 0),
    goalVersion: Number(snapshot?.goal?.version || node.goalVersion || 0),
    model: `${providerLabel(node.provider || state.defaultProvider)} / ${node.model || state.defaultModel}`
  };
}

function renderComparisonBranch(node) {
  const facts = comparisonContextFacts(node);
  const artifacts = artifactsForNode(node.id);
  const risks = artifacts.filter(artifact => artifact.kind === 'risk');
  const conclusions = artifacts.filter(artifact => ['claim','decision','option'].includes(artifact.kind));
  const output = latestAssistantText(node) || node.content || node.summary || '尚无独立回答。';
  return `<article class="compare-branch">
    <h3>${escapeHtml(node.title)}</h3>
    <p>${escapeHtml(node.question || node.summary || '未设置问题')}</p>
    <dl class="compare-facts">
      <dt>分叉锚点</dt><dd>${escapeHtml(facts.anchor)}</dd>
      <dt>模型</dt><dd>${escapeHtml(facts.model)}</dd>
      <dt>目标版本</dt><dd>v${facts.goalVersion || 0}</dd>
      <dt>上下文快照</dt><dd>${escapeHtml(facts.snapshotId)}</dd>
      <dt>预计输入</dt><dd>约 ${facts.tokenCount.toLocaleString(localeForIntl(state.uiLanguage))} tokens</dd>
      <dt>推理对象</dt><dd>${artifacts.length} 个 · 风险 ${risks.length} 个</dd>
    </dl>
    <div class="compare-output">${escapeHtml(output)}</div>
    <div class="compare-difference"><h4>已提炼的结论与风险</h4><ul>
      ${(conclusions.length ? conclusions : [{ title: '尚未提炼结论' }]).map(item => `<li>${escapeHtml(item.title)}</li>`).join('')}
      ${risks.map(item => `<li>风险：${escapeHtml(item.title)}</li>`).join('')}
    </ul></div>
  </article>`;
}

function openCompareDialog() {
  const nodes = selectedNodes();
  if (nodes.length !== 2) return showOperationError('请选择两个分支', '分支比较需要且只需要两个节点。');
  const [a, b] = nodes;
  const factsA = comparisonContextFacts(a);
  const factsB = comparisonContextFacts(b);
  const differences = [
    factsA.anchor !== factsB.anchor ? `分叉锚点不同：${factsA.anchor} / ${factsB.anchor}` : '两个分支来自相同消息锚点',
    factsA.model !== factsB.model ? `模型不同：${factsA.model} / ${factsB.model}` : '两个分支使用相同模型',
    factsA.goalVersion !== factsB.goalVersion ? `目标版本不同：v${factsA.goalVersion} / v${factsB.goalVersion}` : `目标版本一致：v${factsA.goalVersion}`,
    factsA.snapshotId !== factsB.snapshotId ? '上下文快照不同，可分别打开节点上下文核查' : '两个分支引用同一上下文快照'
  ];
  $('#compareContent').innerHTML = `<div class="compare-grid">${renderComparisonBranch(a)}${renderComparisonBranch(b)}</div><div class="compare-difference compare-shared"><h4>结构差异摘要</h4><ul>${differences.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`;
  $('#compareDialog').showModal();
}

function changeNodeConfidence(nodeId, status) {
  const node = getNode(nodeId);
  if (!node || !Object.hasOwn(CONFIDENCE_STATUS_LABELS, status)) return;
  node.confidenceStatus = status;
  node.updatedAt = now();
  saveAndRender();
}

function bindRenderedContentActions() {
  $$('.code-copy-button').forEach(button => button.addEventListener('click', async () => {
    const code = button.closest('.code-block')?.querySelector('code')?.innerText || '';
    try { await navigator.clipboard.writeText(code); button.textContent = '已复制'; }
    catch { button.textContent = '复制失败'; }
    setTimeout(() => { button.textContent = '复制'; }, 1200);
  }));
}

function isAbortError(error) {
  return error?.name === 'AbortError' || /aborted|生成已停止|停止生成/i.test(String(error?.message || error || ''));
}

function scheduleStreamingSave(nodeId) {
  clearTimeout(streamingSaveTimers.get(nodeId));
  const timer = setTimeout(() => {
    streamingSaveTimers.delete(nodeId);
    saveState();
  }, 700);
  streamingSaveTimers.set(nodeId, timer);
}

function clearStreamingSave(nodeId) {
  const timer = streamingSaveTimers.get(nodeId);
  if (timer) clearTimeout(timer);
  streamingSaveTimers.delete(nodeId);
}

function updateStreamingMessageDom(node, message) {
  const article = document.querySelector(`.message[data-message-id="${CSS.escape(message.id)}"]`);
  const body = article?.querySelector('.message-body');
  if (body) {
    body.innerHTML = message.content
      ? markdownToHtml(normalizeAssistantContent(message.content))
      : '<p class="stream-placeholder">正在接收模型输出<span class="stream-caret"></span></p>';
    bindRenderedContentActions();
  }
  const card = document.querySelector(`.node[data-id="${CSS.escape(node.id)}"] p`);
  if (card) card.textContent = message.content ? summarizeForCard(message.content) : 'AI 正在生成这个节点…';
  const conversation = $('#conversation');
  if (conversation && selectedNodes()[0]?.id === node.id) conversation.scrollTop = conversation.scrollHeight;
}

function stopGeneration(nodeId) {
  const controller = generationControllers.get(nodeId);
  if (!controller) return;
  const button = $('#stopGenerationBtn');
  if (button) {
    button.disabled = true;
    button.textContent = '正在停止…';
  }
  controller.abort();
}

async function consumeGenerationStream({ node, message, url, body, onMeta, onDelta }) {
  const controller = new AbortController();
  generationControllers.set(node.id, controller);
  let received = false;
  const metadata = {};
  try {
    await apiNdjson(url, body, {
      signal: controller.signal,
      onEvent: event => {
        if (event.type === 'delta' && event.text) {
          received = true;
          if (onDelta) onDelta(String(event.text));
          else message.content += String(event.text);
          node.summary = summarizeForCard(message.content || 'AI 正在生成这个节点…');
          node.updatedAt = now();
          updateStreamingMessageDom(node, message);
          scheduleStreamingSave(node.id);
        } else if (event.type === 'meta') {
          Object.assign(metadata, event);
          onMeta?.(event);
        }
      }
    });
    return { stopped: false, received, metadata };
  } catch (error) {
    if (isAbortError(error) || controller.signal.aborted) return { stopped: true, received, metadata };
    throw error;
  } finally {
    if (generationControllers.get(node.id) === controller) generationControllers.delete(node.id);
    clearStreamingSave(node.id);
  }
}

function markStoppedMessage(message) {
  message.streaming = false;
  message.partial = true;
  message.error = false;
  message.streamError = '';
  message.interruptionReason = '用户停止生成';
  message.stoppedAt = now();
  message.emptyPartial = !String(message.content || '').trim();
}

async function continuePartialGeneration(nodeId, messageId) {
  const node = getNode(nodeId);
  const message = node?.messages.find(item => item.id === messageId && item.role === 'assistant' && item.partial);
  if (!node || !message || busyIds.has(node.id)) return;
  const selection = getComposerSelection(node.id);
  const instruction = '继续完成上一条被停止的回答。承接已有内容，不要从头重复；直接从未完成处继续。';
  const snapshot = createContextSnapshot(node, instruction, { purpose: 'continue_partial', record: true });
  const call = startModelCall({ nodeId: node.id, provider: selection.provider, model: selection.model, reasoningEffort: selection.reasoningEffort, contextSnapshot: snapshot, purpose: 'continue_partial' });
  message.streaming = true;
  message.partial = false;
  message.error = false;
  message.streamError = '';
  message.interruptionReason = '';
  message.continuationCallIds = unique([...(message.continuationCallIds || []), call.id]);
  busyIds.add(node.id);
  pendingConversationScroll = { nodeId: node.id, mode: 'bottom' };
  saveAndRender();
  let appendedSeparator = false;
  try {
    const result = await consumeGenerationStream({
      node,
      message,
      url: '/api/generate-stream',
      body: { prompt: buildPrompt(snapshot, instruction), uiLanguage: state.uiLanguage, config: modelConfig(selection.provider, selection.model, selection.reasoningEffort) },
      onDelta: delta => {
        if (!appendedSeparator) {
          if (String(message.content || '').trim()) message.content = `${String(message.content).trimEnd()}\n\n`;
          appendedSeparator = true;
        }
        message.content += delta;
      }
    });
    if (result.stopped) {
      markStoppedMessage(message);
      finishModelCall(call, { success: false, error: '用户停止生成', responseMessageId: message.id, stopped: true, partialOutput: true });
    } else {
      message.content = normalizeAssistantContent(message.content);
      message.streaming = false;
      message.partial = false;
      message.stoppedAt = '';
      message.emptyPartial = false;
      message.interruptionReason = '';
      node.summary = summarizeForCard(message.content);
      finishModelCall(call, { success: true, responseMessageId: message.id, outputChars: message.content.length });
    }
  } catch (error) {
    if (String(message.content || '').trim()) {
      message.streaming = false;
      message.partial = true;
      message.streamError = friendlyErrorMessage(error);
      message.interruptionReason = '连接中断';
      finishModelCall(call, { success: false, error: message.streamError, responseMessageId: message.id, partialOutput: true, outputChars: message.content.length });
    } else {
      message.streaming = false;
      message.error = true;
      message.content = `请求失败：${friendlyErrorMessage(error)}`;
      finishModelCall(call, { success: false, error: friendlyErrorMessage(error), responseMessageId: message.id });
    }
  } finally {
    busyIds.delete(node.id);
    pendingConversationScroll = { nodeId: node.id, mode: 'bottom' };
    saveAndRender();
  }
}

async function sendFromNode(nodeId, content, provider, model, reasoningEffort = 'auto') {
  return sendInCurrentNode(nodeId, content, provider, model, reasoningEffort);
}

async function sendInCurrentNode(nodeId, content, provider, model, reasoningEffort = 'auto') {
  const node = getNode(nodeId);
  if (!node || node.status === 'archived' || busyIds.has(node.id)) return;
  const question = repairUtf8Mojibake(String(content || '').trim());
  if (!question) return;
  const decomposeIntent = classifyDecomposeIntent(question);
  if (!requireConnectedProvider(provider, { openSettings: true })) return;
  reasoningEffort = ensureReasoningForProvider(provider, model, reasoningEffort);
  const isFirstRootQuestion = node.id === 'root' && !node.messages.some(message => message.role === 'assistant' && !message.error);
  if (!isFirstRootQuestion) await maybeAutoCompact(node);
  const purpose = isFirstRootQuestion ? 'initial_answer' : 'current_node_follow_up';
  const snapshot = createContextSnapshot(node, question, { purpose, record: true });

  if (isFirstRootQuestion) {
    node.title = deriveTitle(question);
    if (!state.projectTitle || state.projectTitle === '未命名项目') state.projectTitle = node.title;
    node.question = question;
  }
  reopenAncestors(node.id);
  node.provider = provider;
  node.model = model;
  node.reasoningEffort = reasoningEffort;
  node.status = 'exploring';
  node.goalVersion = snapshot.goal.version;
  node.contextVersion = snapshot.version;
  const userMessage = makeMessage('user', question, { provider, model, reasoningEffort, contextVersion: snapshot.version });
  node.messages.push(userMessage);
  node.updatedAt = now();
  const call = startModelCall({ nodeId: node.id, provider, model, reasoningEffort, contextSnapshot: snapshot, purpose });
  const assistant = makeMessage('assistant', '', {
    streaming: true,
    provider,
    model,
    reasoningEffort,
    contextVersion: snapshot.version,
    callId: call.id,
    goalVersion: snapshot.goal.version,
    compactVersion: snapshot.compactVersion || 0,
    replyToMessageId: userMessage.id
  });
  node.messages.push(assistant);
  busyIds.add(node.id);
  pendingConversationScroll = { nodeId: node.id, mode: 'bottom' };
  saveAndRender();

  let goalSuggestion = '';
  let answerCompleted = false;
  try {
    const result = await consumeGenerationStream({
      node,
      message: assistant,
      url: isFirstRootQuestion ? '/api/analyze-stream' : '/api/generate-stream',
      body: isFirstRootQuestion
        ? {
            question,
            prompt: buildPrompt(snapshot, question),
            goal: confirmedGoal(state.goal).text,
            constraints: state.constraints,
            uiLanguage: state.uiLanguage,
            config: modelConfig(provider, model, reasoningEffort)
          }
        : { prompt: buildPrompt(snapshot, question), uiLanguage: state.uiLanguage, config: modelConfig(provider, model, reasoningEffort) },
      onMeta: meta => { if (meta.goalSuggestion) goalSuggestion = repairUtf8Mojibake(String(meta.goalSuggestion)); }
    });
    if (result.stopped) {
      markStoppedMessage(assistant);
      node.summary = summarizeForCard(assistant.content) || '生成已停止，可从当前部分继续。';
      finishModelCall(call, { success: false, error: '用户停止生成', responseMessageId: assistant.id, stopped: true, partialOutput: true, outputChars: assistant.content.length });
    } else {
      const cleanText = normalizeAssistantContent(assistant.content || '');
      if (!cleanText) throw new Error(`${providerLabel(provider)} 没有返回可显示的正文。`);
      assistant.content = cleanText;
      assistant.streaming = false;
      assistant.partial = false;
      assistant.stoppedAt = '';
      assistant.emptyPartial = false;
      assistant.interruptionReason = '';
      assistant.streamError = '';
      node.summary = summarizeForCard(cleanText);
      node.updatedAt = now();
      answerCompleted = true;
      finishModelCall(call, { success: true, responseMessageId: assistant.id, outputChars: cleanText.length });
      if (isFirstRootQuestion && !confirmedGoal(state.goal).text && goalSuggestion) {
        state.goal = proposeGoal(state.goal, goalSuggestion, { id: makeId('goal_suggestion'), at: now() });
      }
      if (isFirstRootQuestion) {
        autoLayoutGraph({ persist: false });
        setTimeout(fitView, 80);
      }
    }
  } catch (error) {
    const detail = friendlyErrorMessage(error);
    if (String(assistant.content || '').trim()) {
      assistant.streaming = false;
      assistant.partial = true;
      assistant.streamError = detail;
      assistant.interruptionReason = '连接中断';
      node.summary = summarizeForCard(assistant.content) || '生成中断，可继续。';
      finishModelCall(call, { success: false, error: detail, responseMessageId: assistant.id, partialOutput: true, outputChars: assistant.content.length });
    } else {
      assistant.streaming = false;
      assistant.error = true;
      assistant.content = `请求失败：${detail}`;
      node.summary = '请求失败，可检查模型设置后重试；旧消息未被修改。';
      finishModelCall(call, { success: false, error: detail, responseMessageId: assistant.id });
    }
  } finally {
    busyIds.delete(node.id);
    autoLayoutGraph({ persist: false });
    pendingConversationScroll = { nodeId: node.id, mode: 'bottom' };
    saveAndRender();
    if (answerCompleted) await maybeAutoDecomposeAnswer(node.id, assistant.id, decomposeIntent);
  }
}

async function sendBranchFromNode(parentId, content, provider, model, reasoningEffort = 'auto', { cutoffMessageId = '' } = {}) {
  const parent = getNode(parentId);
  if (!parent || parent.status === 'archived') return;
  const question = repairUtf8Mojibake(String(content || '').trim());
  if (!question) return;
  const decomposeIntent = classifyDecomposeIntent(question);
  if (!requireConnectedProvider(provider, { openSettings: true })) return;
  reasoningEffort = ensureReasoningForProvider(provider, model, reasoningEffort);
  const cutoffIsLatest = !cutoffMessageId || parent.messages.at(-1)?.id === cutoffMessageId;
  if (cutoffIsLatest) await maybeAutoCompact(parent);
  const groupId = parallelGroupId(parent.id, question);
  const snapshot = getOrCreateContextSnapshot(parent, question, groupId, { cutoffMessageId, purpose: 'new_branch' });
  reopenAncestors(parent.id);
  parent.status = parent.status === 'open' ? 'exploring' : parent.status;
  const userMessage = makeMessage('user', question, { provider, model, reasoningEffort, contextVersion: snapshot.version });
  const child = makeNode({
    kind: 'answer_branch',
    origin: 'user_prompt',
    title: deriveTitle(question),
    question,
    summary: 'AI 正在生成这个节点…',
    status: 'exploring',
    provider,
    model,
    reasoningEffort,
    parentId: parent.id,
    contextSnapshot: structuredClone(snapshot),
    contextSnapshotId: snapshot.id,
    lastContextSnapshotId: snapshot.id,
    branchAnchor: { nodeId: parent.id, cutoffMessageId: snapshot.branchAnchor.cutoffMessageId, contextSnapshotId: snapshot.id },
    contextVersion: snapshot.version,
    groupId,
    layoutOrder: nextLayoutOrder(parent.id, groupId),
    goalVersion: snapshot.goal.version,
    messages: [userMessage]
  });
  state.nodes.push(child);
  state.edges.push({ id: makeId('edge'), source: parent.id, target: child.id, relation: 'answer_to', groupId, sourceMessageId: snapshot.branchAnchor.cutoffMessageId });
  autoLayoutGraph({ persist: false });
  state.selectedIds = [child.id];
  focusNodesInView([parent.id, child.id], { persist: false, renderNow: false });
  const call = startModelCall({ nodeId: child.id, provider, model, reasoningEffort, contextSnapshot: snapshot, purpose: 'new_branch' });
  const assistant = makeMessage('assistant', '', {
    streaming: true,
    provider,
    model,
    reasoningEffort,
    contextVersion: snapshot.version,
    callId: call.id,
    goalVersion: snapshot.goal.version,
    compactVersion: snapshot.compactVersion || 0,
    replyToMessageId: userMessage.id
  });
  child.messages.push(assistant);
  busyIds.add(child.id);
  saveAndRender();
  let answerCompleted = false;
  try {
    const result = await consumeGenerationStream({
      node: child,
      message: assistant,
      url: '/api/generate-stream',
      body: { prompt: buildPrompt(snapshot, question), uiLanguage: state.uiLanguage, config: modelConfig(provider, model, reasoningEffort) }
    });
    if (result.stopped) {
      markStoppedMessage(assistant);
      child.summary = summarizeForCard(assistant.content) || '生成已停止，可从当前部分继续。';
      finishModelCall(call, { success: false, error: '用户停止生成', responseMessageId: assistant.id, stopped: true, partialOutput: true, outputChars: assistant.content.length });
    } else {
      const cleanText = normalizeAssistantContent(assistant.content || '');
      if (!cleanText) throw new Error(`${providerLabel(provider)} 没有返回可显示的正文。`);
      assistant.content = cleanText;
      assistant.streaming = false;
      assistant.partial = false;
      assistant.stoppedAt = '';
      assistant.emptyPartial = false;
      assistant.interruptionReason = '';
      assistant.streamError = '';
      child.summary = summarizeForCard(cleanText);
      child.updatedAt = now();
      answerCompleted = true;
      finishModelCall(call, { success: true, responseMessageId: assistant.id, outputChars: cleanText.length });
    }
  } catch (error) {
    const detail = friendlyErrorMessage(error);
    if (String(assistant.content || '').trim()) {
      assistant.streaming = false;
      assistant.partial = true;
      assistant.streamError = detail;
      assistant.interruptionReason = '连接中断';
      child.summary = summarizeForCard(assistant.content) || '生成中断，可继续。';
      finishModelCall(call, { success: false, error: detail, responseMessageId: assistant.id, partialOutput: true, outputChars: assistant.content.length });
    } else {
      assistant.streaming = false;
      assistant.error = true;
      assistant.content = `请求失败：${detail}`;
      child.summary = '请求失败，可检查模型设置后重试；父节点与旧分支未被修改。';
      finishModelCall(call, { success: false, error: detail, responseMessageId: assistant.id });
    }
  } finally {
    busyIds.delete(child.id);
    autoLayoutGraph({ persist: false });
    focusNodesInView([parent.id, child.id], { persist: false, renderNow: false });
    saveAndRender();
    if (answerCompleted) await maybeAutoDecomposeAnswer(child.id, assistant.id, decomposeIntent);
  }
}

function openBranchComposer(nodeId, cutoffMessageId = '') {
  const node = getNode(nodeId);
  if (!node || node.status === 'archived') return;
  const cutoff = cutoffMessageId ? node.messages.find(message => message.id === cutoffMessageId) : node.messages.at(-1);
  if (cutoffMessageId && !cutoff) return showOperationError('无法创建分支', '所选消息已不存在，请重新选择分叉位置。');
  branchDraftAnchor = { nodeId, cutoffMessageId: cutoff?.id || '' };
  const selection = getComposerSelection(nodeId);
  const anchorCopy = cutoff
    ? `${cutoff.role === 'user' ? '你的提问' : 'AI 回答'}「${summarizeForCard(cutoff.content).slice(0, 46)}」`
    : '当前节点起点';
  $('#branchComposerContext').textContent = `将从“${node.title}”中的${anchorCopy}之后分叉；更晚的消息不会进入新分支上下文。`;
  $('#branchProviderSelect').innerHTML = providerOptions(selection.provider);
  $('#branchModelSelect').innerHTML = modelOptions(selection.provider, selection.model);
  $('#branchReasoningSelect').innerHTML = reasoningOptions(selection.provider, selection.model, selection.reasoningEffort);
  syncSelectTitle($('#branchProviderSelect'));
  syncSelectTitle($('#branchModelSelect'));
  syncSelectTitle($('#branchReasoningSelect'));
  updateBranchComposerMeta();
  $('#branchMessageDraft').value = '';
  $('#branchComposerDialog').showModal();
  setTimeout(() => $('#branchMessageDraft').focus(), 30);
}

function syncSelectTitle(select) {
  if (!select) return;
  const option = select.selectedOptions?.[0];
  select.title = String(option?.textContent || select.value || '').trim();
}

function updateBranchComposerMeta() {
  const providerSelect = $('#branchProviderSelect');
  const modelSelect = $('#branchModelSelect');
  const reasoningSelect = $('#branchReasoningSelect');
  if (!providerSelect || !modelSelect || !reasoningSelect) return;
  const profile = getProvider(providerSelect.value) || {};
  const model = (profile.models || []).find(item => item.id === modelSelect.value) || {};
  const providerDetail = profile.protocol === 'codex-app-server'
    ? 'ChatGPT OAuth · 已连接'
    : profile.connectionStatus === 'connected'
      ? `${profile.protocol === 'mock' ? '本地测试' : 'API Key'} · 已连接`
      : '尚未连接';
  const modelDetail = model.id
    ? (model.label && model.label !== model.id ? model.id : `${model.id} · 当前可用`)
    : '没有可用模型';
  const effort = reasoningSelect.value || 'auto';
  const reasoningDetail = effort === 'auto'
    ? `自动使用模型默认等级${model.defaultReasoningEffort ? `（${REASONING_EFFORT_LABELS[model.defaultReasoningEffort] || model.defaultReasoningEffort}）` : ''}`
    : `${REASONING_EFFORT_LABELS[effort] || effort} · 仅影响这个新分支`;
  $('#branchProviderMeta').textContent = providerDetail;
  $('#branchModelMeta').textContent = modelDetail;
  $('#branchReasoningMeta').textContent = reasoningDetail;
  $('#branchProviderMeta').title = providerDetail;
  $('#branchModelMeta').title = modelDetail;
  $('#branchReasoningMeta').title = reasoningDetail;
}

function nextLayoutOrder(parentId, groupId) {
  const siblings = directChildren(parentId);
  const sameGroup = siblings.filter(node => node.groupId === groupId);
  if (sameGroup.length) return Math.max(...sameGroup.map(node => Number(node.layoutOrder || 0))) + 1;
  return Date.now();
}

function startModelCall({ nodeId, provider, model, reasoningEffort = 'auto', contextSnapshot, purpose }) {
  const call = {
    id: makeId('generation'), nodeId, provider, model, reasoningEffort, purpose,
    promptTemplateVersion: 'thought-canvas-context-v12.6',
    contextSnapshotId: contextSnapshot?.id || '',
    contextVersion: contextSnapshot?.version || 0,
    compactVersion: contextSnapshot?.compactVersion || 0,
    goalVersion: contextSnapshot?.goal?.version || 0,
    branchAnchor: contextSnapshot?.branchAnchor ? structuredClone(contextSnapshot.branchAnchor) : null,
    estimatedInputTokens: Number(contextSnapshot?.metrics?.estimatedInputTokens || 0),
    requestedAt: now(), success: null, error: '', responseMessageId: ''
  };
  state.generationRecords.push(call);
  state.modelCalls = state.generationRecords;
  return call;
}

function finishModelCall(call, { success, error = '', responseMessageId = '', stopped = false, partialOutput = false, outputChars = 0 }) {
  call.success = Boolean(success);
  call.error = String(error || '');
  call.responseMessageId = responseMessageId;
  call.stopped = Boolean(stopped);
  call.partialOutput = Boolean(partialOutput);
  call.outputChars = Number(outputChars || 0);
  call.completedAt = now();
}

async function retryFailedRequest(nodeId, messageId) {
  const node = getNode(nodeId);
  if (!node || busyIds.has(node.id)) return;
  const errorIndex = node.messages.findIndex(message => message.id === messageId && message.error);
  if (errorIndex < 0) return;
  const previousUser = [...node.messages.slice(0, errorIndex)].reverse().find(message => message.role === 'user');
  if (!previousUser) return;
  node.messages = node.messages.filter(message => message.id !== messageId);
  const selection = getComposerSelection(node.id);
  node.messages = node.messages.filter(message => message.id !== previousUser.id);
  await sendInCurrentNode(node.id, previousUser.content, selection.provider, selection.model, selection.reasoningEffort);
}

async function decomposeMessage(nodeId, messageId, {
  scope = 'message',
  selectedText = '',
  selectionStart = -1,
  selectionEnd = -1,
  autoMode = 'manual'
} = {}) {
  const node = getNode(nodeId);
  const message = node?.messages.find(item => item.id === messageId && item.role === 'assistant');
  if (!node) return showOperationError('拆解失败', '当前节点不存在，可能已被删除。');
  if (!message) return showOperationError('拆解失败', '这条回答已被删除，无法拆解。');
  if (scope === 'message' && node.decomposedMessageIds.includes(messageId)) return;
  const fullText = normalizeAssistantContent(message.content);
  const sourceText = scope === 'selection' ? String(selectedText || '').trim() : fullText;
  if (scope === 'selection' && !sourceText) return showOperationError('拆解失败', '尚未选择文字。');
  if (!sourceText) return showOperationError('拆解失败', '这条回答没有可拆解的正文。');
  if (scope === 'selection' && selectionStart < 0) selectionStart = fullText.indexOf(sourceText);
  if (scope === 'selection' && selectionStart >= 0 && selectionEnd < 0) selectionEnd = selectionStart + sourceText.length;
  const selectionLocated = scope !== 'selection' || (selectionStart >= 0 && selectionEnd > selectionStart);
  if (!selectionLocated) {
    selectionStart = -1;
    selectionEnd = -1;
  }

  const providerId = message.provider || node.provider || state.defaultProvider;
  if (!requireConnectedProvider(providerId, { openSettings: true })) return;

  busyIds.add(node.id);
  saveState();
  await flushProjectSave();
  render();
  try {
    const payload = await apiJson(`/api/projects/${encodeURIComponent(currentProjectId)}/nodes/${encodeURIComponent(nodeId)}/messages/${encodeURIComponent(messageId)}/decompose`, {
      question: node.question || node.title,
      scope,
      selectedText: scope === 'selection' ? sourceText : '',
      selectionStart,
      selectionEnd,
      allowUnlocatedSelection: scope === 'selection' && !selectionLocated,
      goal: state.goal.text,
      constraints: state.constraints,
      uiLanguage: state.uiLanguage,
      customInstruction: decompositionInstruction(),
      config: modelConfig(providerId, message.model || node.model || state.defaultModel, message.reasoningEffort || node.reasoningEffort || 'auto')
    });
    const boundStart = Number.isFinite(payload?.binding?.selectionStart) ? payload.binding.selectionStart : selectionStart;
    const boundEnd = Number.isFinite(payload?.binding?.selectionEnd) ? payload.binding.selectionEnd : selectionEnd;
    const sections = Array.isArray(payload.sections) ? payload.sections : [];
    const preparedSections = sections.slice(0, 8);
    if (autoMode !== 'manual' && preparedSections.length < 2) {
      showOperationNotice(t('暂不自动拆解'), t('这条回答暂时没有形成足够清晰的多个模块，已保留为单一回答节点。'));
      return;
    }
    if (autoMode === 'confirm') {
      const preview = preparedSections
        .map((section, index) => `${index + 1}. ${String(section?.title || t('内容模块 {count}', { count: index + 1 })).trim()}`)
        .join('\n');
      const confirmed = await requestConfirmation({
        eyebrow: t('识别到拆解意图'),
        title: t('准备创建 {count} 个拆解节点', { count: preparedSections.length }),
        message: t('这条问题看起来包含多个分析层面。确认后会把当前回答拆成可继续追问的内容节点。'),
        detail: preview,
        confirmLabel: t('创建 {count} 个节点', { count: preparedSections.length })
      });
      if (!confirmed) {
        showOperationNotice(t('已保留完整回答'), t('你可以稍后从回答下方手动拆解。'));
        return;
      }
    }
    const created = createContentSections(node.id, preparedSections, {
      sourceMessageId: messageId,
      origin: scope === 'selection' ? 'selection_decompose' : autoMode !== 'manual' ? 'auto_decompose' : 'manual_decompose',
      sourceScope: scope,
      selectedSourceText: sourceText,
      sourceBaseStart: scope === 'selection' ? boundStart : 0
    });
    if (!created.length) throw new Error('模型没有返回可用且能对应原文的内容模块。');
    if (payload.warning) showOperationNotice('拆解已安全完成', payload.warning);
    if (scope === 'selection' && boundStart < 0) showOperationNotice('已按可见文字拆解', '这段跨格式选区无法稳定映射到 Markdown 字符位置，系统已保留所见文字并标记为“原文位置未定位”。');
    if (scope === 'message') node.decomposedMessageIds.push(messageId);
    node.decompositions = Array.isArray(node.decompositions) ? node.decompositions : [];
    node.decompositions.push({
      id: makeId('decomposition'),
      messageId,
      scope,
      selectionStart: boundStart,
      selectionEnd: boundEnd,
      childIds: created,
      trigger: autoMode === 'manual' ? 'manual' : autoMode,
      createdAt: now()
    });
    node.status = 'exploring';
    if (autoMode === 'auto') showOperationNotice(t('已自动拆解回答'), t('已根据你的请求创建 {count} 个可继续追问的节点。', { count: created.length }));
    autoLayoutGraph({ persist: false });
    focusNodesInView([node.id, ...created], { persist: false, renderNow: false, maxScale: .96 });
  } catch (error) {
    showOperationError('拆解失败', friendlyErrorMessage(error));
  } finally {
    busyIds.delete(node.id);
    saveAndRender();
  }
}

async function decomposeSourceContent(nodeId, { scope = 'node', selectedText = '', selectionStart = -1, selectionEnd = -1 } = {}) {
  const node = getNode(nodeId);
  if (!node || !['content_section', 'annotation'].includes(node.kind)) return showOperationError('拆解失败', '当前内容模块已不存在。');
  const fullText = normalizeAssistantContent(node.content || '');
  const sourceText = scope === 'selection' ? String(selectedText || '').trim() : fullText;
  if (scope === 'selection' && !sourceText) return showOperationError('拆解失败', '尚未选择文字。');
  if (!sourceText) return showOperationError('拆解失败', '这个内容模块没有可拆解正文。');
  if (scope === 'selection' && selectionStart < 0) selectionStart = fullText.indexOf(sourceText);
  if (scope === 'selection' && selectionStart >= 0 && selectionEnd < 0) selectionEnd = selectionStart + sourceText.length;
  const localLocated = scope !== 'selection' || (selectionStart >= 0 && selectionEnd > selectionStart);
  const sourceBaseStart = node.sourceStart >= 0
    ? node.sourceStart + (scope === 'selection' && localLocated ? selectionStart : 0)
    : -1;
  const selection = getComposerSelection(node.id);
  if (!requireConnectedProvider(selection.provider, { openSettings: true })) return;

  busyIds.add(node.id);
  saveState();
  await flushProjectSave();
  render();
  try {
    const payload = await apiJson('/api/decompose', {
      question: node.question || node.title,
      scope,
      text: sourceText,
      answer: sourceText,
      goal: state.goal.text,
      constraints: state.constraints,
      uiLanguage: state.uiLanguage,
      customInstruction: decompositionInstruction(),
      config: modelConfig(selection.provider, selection.model, selection.reasoningEffort)
    });
    const created = createContentSections(node.id, payload.sections || [], {
      sourceMessageId: node.sourceMessageId || '',
      origin: scope === 'selection' ? 'selection_decompose' : 'recursive_decompose',
      sourceScope: scope,
      selectedSourceText: sourceText,
      sourceBaseStart: localLocated ? sourceBaseStart : -1
    });
    if (!created.length) throw new Error('模型没有返回可用内容模块。');
    node.decompositions = Array.isArray(node.decompositions) ? node.decompositions : [];
    node.decompositions.push({
      id: makeId('decomposition'),
      sourceNodeId: node.id,
      messageId: node.sourceMessageId || '',
      scope,
      selectionStart: localLocated ? selectionStart : -1,
      selectionEnd: localLocated ? selectionEnd : -1,
      childIds: created,
      createdAt: now()
    });
    node.status = 'exploring';
    if (payload.warning) showOperationNotice('拆解已安全完成', payload.warning);
    autoLayoutGraph({ persist: false });
    focusNodesInView([node.id, ...created], { persist: false, renderNow: false, maxScale: .96 });
  } catch (error) {
    showOperationError('拆解失败', friendlyErrorMessage(error));
  } finally {
    busyIds.delete(node.id);
    saveAndRender();
  }
}

async function organizeNode(nodeId) {
  const node = getNode(nodeId);
  if (!node || busyIds.has(node.id)) return;
  if (!node.messages.length) return showOperationError('整理失败', '当前节点没有可整理的对话。');
  const confirmed = await requestConfirmation({
    eyebrow: '整理当前节点',
    title: `整理 ${node.messages.length} 条消息？`,
    message: '原始消息会完整保留，整理结果作为新的可追溯回答加入当前节点，不会自动拆成子节点。',
    confirmLabel: '开始整理'
  });
  if (!confirmed) return;
  const selection = getComposerSelection(node.id);
  if (!requireConnectedProvider(selection.provider, { openSettings: true })) return;
  busyIds.add(node.id);
  saveState();
  await flushProjectSave();
  render();
  const call = startModelCall({ nodeId, provider: selection.provider, model: selection.model, reasoningEffort: selection.reasoningEffort, contextSnapshot: createContextSnapshot(node, '整理本节点'), purpose: 'organize' });
  try {
    const payload = await apiJson(`/api/projects/${encodeURIComponent(currentProjectId)}/nodes/${encodeURIComponent(nodeId)}/organize`, {
      includeArchivedMessages: false,
      createDecompositionAfter: false,
      question: node.question || node.title,
      goal: state.goal.text,
      constraints: state.constraints,
      uiLanguage: state.uiLanguage,
      config: modelConfig(selection.provider, selection.model, selection.reasoningEffort)
    });
    const organizedMessage = makeMessage('assistant', normalizeAssistantContent(payload.organized || ''), {
      type: 'organized_summary', provider: selection.provider, model: selection.model, reasoningEffort: selection.reasoningEffort, callId: call.id,
      organizedResult: payload.result || null
    });
    node.messages.push(organizedMessage);
    node.confirmedSummary = organizedMessage.content;
    node.summary = summarizeForCard(organizedMessage.content);
    finishModelCall(call, { success: true, responseMessageId: organizedMessage.id });
  } catch (error) {
    finishModelCall(call, { success: false, error: friendlyErrorMessage(error) });
    showOperationError('整理失败', friendlyErrorMessage(error));
  } finally {
    busyIds.delete(node.id);
    saveAndRender();
  }
}

async function compactNode(nodeId, { force = false, trigger = 'manual' } = {}) {
  const node = getNode(nodeId);
  if (!node || busyIds.has(node.id) || !node.messages.length) return false;
  const current = activeCompact(node);
  if (!force && current) {
    const covered = new Set(current.compact?.coveredMessageIds || []);
    const uncovered = node.messages.filter(message => !covered.has(message.id));
    if (uncovered.length < state.autoCompactMessageLimit) return false;
  }
  const selection = getComposerSelection(node.id);
  if (!requireConnectedProvider(selection.provider, { openSettings: force })) return false;
  busyIds.add(node.id);
  saveState();
  await flushProjectSave();
  render();
  const call = startModelCall({ nodeId, provider: selection.provider, model: selection.model, reasoningEffort: selection.reasoningEffort, contextSnapshot: createContextSnapshot(node, 'Compact 当前节点'), purpose: 'compact' });
  try {
    const payload = await apiJson(`/api/projects/${encodeURIComponent(currentProjectId)}/nodes/${encodeURIComponent(nodeId)}/compact`, {
      question: node.question || node.title,
      goal: state.goal.text,
      constraints: state.constraints,
      uiLanguage: state.uiLanguage,
      config: modelConfig(selection.provider, selection.model, selection.reasoningEffort)
    });
    const version = Math.max(0, ...(node.compactSnapshots || []).map(item => Number(item.version || 0))) + 1;
    const snapshot = {
      id: makeId('compact'), version, createdAt: now(), trigger,
      provider: selection.provider, model: selection.model, reasoningEffort: selection.reasoningEffort,
      compact: payload.compact || { summary: '', confirmedConclusions: [], openQuestions: [], rejectedAssumptions: [], importantUserConstraints: [], coveredMessageIds: [] }
    };
    node.compactSnapshots.push(snapshot);
    node.activeCompactId = snapshot.id;
    finishModelCall(call, { success: true });
    return true;
  } catch (error) {
    finishModelCall(call, { success: false, error: friendlyErrorMessage(error) });
    if (force) showOperationError('Compact 失败', friendlyErrorMessage(error));
    return false;
  } finally {
    busyIds.delete(node.id);
    saveAndRender();
  }
}

function deleteCompact(nodeId) {
  const node = getNode(nodeId);
  if (!node?.activeCompactId) return;
  const activeId = node.activeCompactId;
  node.compactSnapshots = (node.compactSnapshots || []).filter(item => item.id !== activeId);
  node.activeCompactId = '';
  saveAndRender();
}

function activeCompact(node) {
  return (node?.compactSnapshots || []).find(item => item.id === node.activeCompactId) || null;
}

async function maybeAutoCompact(node) {
  if (!state.autoCompactEnabled || !node || node.messages.length < state.autoCompactMessageLimit) return false;
  return compactNode(node.id, { force: false, trigger: 'auto' });
}

function createContentSections(parentId, sections, { sourceMessageId = '', origin = 'manual_decompose', sourceScope = 'message', selectedSourceText = '', sourceBaseStart = 0 } = {}) {
  const parent = getNode(parentId);
  if (!parent) return [];
  const clean = (sections || []).slice(0, 8).map((section, index) => {
    const sourceText = String(section?.sourceText || section?.sourceQuote || section?.content || '').trim();
    const declaredStart = Number(section?.sourceStart);
    const localStart = Number.isFinite(declaredStart) && declaredStart >= 0 ? declaredStart : String(selectedSourceText || '').indexOf(sourceText);
    const located = sourceBaseStart >= 0 && localStart >= 0;
    const sourceStart = located ? sourceBaseStart + localStart : -1;
    const declaredEnd = Number(section?.sourceEnd);
    const localEnd = Number.isFinite(declaredEnd) && declaredEnd > localStart ? declaredEnd : localStart + sourceText.length;
    return {
      title: String(section?.title || `内容模块 ${index + 1}`).trim(),
      content: sourceText,
      summary: String(section?.summary || sourceText).trim(),
      sourceText,
      sourceStart,
      sourceEnd: located ? sourceBaseStart + localEnd : -1,
      order: Number.isFinite(section?.order) ? section.order : index
    };
  }).filter(section => section.title && section.sourceText);
  const ids = [];
  const groupId = `decomposition:${parentId}:${sourceMessageId}:${makeId('group')}`;
  clean.forEach((section, index) => {
    const contentNode = makeNode({
      kind: 'content_section',
      origin,
      title: section.title.slice(0, 80),
      question: `围绕“${section.title}”继续追问。`,
      content: section.sourceText.slice(0, 12000),
      summary: summarizeForCard(section.summary || section.sourceText),
      sourceText: section.sourceText.slice(0, 12000),
      sourceStart: section.sourceStart,
      sourceEnd: section.sourceEnd,
      sourceMessageId,
      sourceScope,
      sectionOrder: section.order,
      parentId,
      groupId,
      layoutOrder: Date.now() + index,
      status: 'open',
      goalVersion: state.goal.version,
      sourceNodeIds: unique([...(parent.sourceNodeIds || []), parent.id])
    });
    state.nodes.push(contentNode);
    state.edges.push({ id: makeId('edge'), source: parentId, target: contentNode.id, relation: 'decomposed_from', sourceMessageId, groupId });
    ids.push(contentNode.id);
  });
  return ids;
}

function createBranches(parentId, branches, options = {}) {
  return createContentSections(parentId, (branches || []).map(branch => ({
    title: branch.title,
    sourceText: branch.sourceText || branch.sourceQuote || branch.content || branch.summary || branch.question,
    summary: branch.summary || branch.question,
    sourceStart: branch.sourceStart,
    sourceEnd: branch.sourceEnd
  })), options);
}

const DEFAULT_CONTEXT_PREFERENCES = Object.freeze({
  includeSource: true,
  includeAncestors: true,
  includeConstraints: true,
  includeGoal: true,
  includeCompact: true
});

function contextPreferencesFor(nodeId) {
  const stored = state.contextPreferencesByNode?.[nodeId] || {};
  return Object.fromEntries(Object.entries(DEFAULT_CONTEXT_PREFERENCES).map(([key, fallback]) => [key, stored[key] !== false ? fallback : false]));
}

function updateContextPreference(nodeId, key, enabled) {
  if (!(key in DEFAULT_CONTEXT_PREFERENCES)) return;
  state.contextPreferencesByNode[nodeId] = { ...contextPreferencesFor(nodeId), [key]: Boolean(enabled) };
  saveState();
}

function contextSnapshotById(snapshotId) {
  return (state.contextSnapshots || []).find(snapshot => snapshot.id === snapshotId) || null;
}

function compactValidForMessages(node, messages, preferences) {
  if (!preferences.includeCompact) return null;
  const compact = activeCompact(node);
  if (!compact) return null;
  const allowedIds = new Set(messages.map(message => message.id));
  const coveredIds = compact.compact?.coveredMessageIds || [];
  return coveredIds.every(id => allowedIds.has(id)) ? compact : null;
}

function getOrCreateContextSnapshot(parent, latestQuestion, groupId, { cutoffMessageId = '', purpose = 'new_branch' } = {}) {
  parent.contextSnapshotCache = parent.contextSnapshotCache && typeof parent.contextSnapshotCache === 'object' ? parent.contextSnapshotCache : {};
  const confirmed = confirmedGoal(state.goal);
  const preferences = contextPreferencesFor(parent.id);
  const sliced = sliceMessagesThrough(parent.messages, cutoffMessageId);
  if (!sliced.found) throw new Error('分叉锚点对应的消息已不存在，请重新选择分叉位置。');
  const lastMessage = sliced.messages.at(-1);
  const fingerprint = [
    groupId,
    cutoffMessageId || lastMessage?.id || 'empty',
    sliced.messages.length,
    lastMessage?.createdAt || parent.updatedAt || '',
    parent.activeCompactId || '',
    confirmed.version,
    JSON.stringify(preferences)
  ].join(':');
  const cachedId = parent.contextSnapshotCache[fingerprint];
  const cached = cachedId ? contextSnapshotById(cachedId) : null;
  if (cached) return structuredClone(cached);
  const snapshot = createContextSnapshot(parent, latestQuestion, { cutoffMessageId, purpose, record: true });
  const entries = Object.entries(parent.contextSnapshotCache).slice(-11);
  parent.contextSnapshotCache = Object.fromEntries([...entries, [fingerprint, snapshot.id]]);
  return structuredClone(snapshot);
}

function createContextSnapshot(parent, latestQuestion, { cutoffMessageId = '', purpose = 'generation', record = true } = {}) {
  const path = pathTo(parent.id);
  const sliced = sliceMessagesThrough(parent.messages, cutoffMessageId);
  if (!sliced.found) throw new Error('上下文快照无法定位所选消息，请重新选择。');
  const preferences = contextPreferencesFor(parent.id);
  const compact = compactValidForMessages(parent, sliced.messages, preferences);
  const covered = new Set(compact?.compact?.coveredMessageIds || []);
  const currentMessages = compact
    ? sliced.messages.filter(message => !covered.has(message.id)).map(messageForContext)
    : sliced.messages.map(messageForContext);
  const acceptedGoal = confirmedGoal(state.goal);
  const goal = preferences.includeGoal ? acceptedGoal : { text: '', source: 'unset', status: 'unset', version: 0 };
  const constraints = preferences.includeConstraints ? [...state.constraints] : [];
  const ancestors = preferences.includeAncestors ? path.slice(0, -1).map(node => {
    const nodeCompact = preferences.includeCompact ? activeCompact(node) : null;
    return {
      id: node.id,
      title: node.title,
      question: node.question,
      confirmedSummary: node.confirmedSummary || node.summary || '',
      sourceText: preferences.includeSource ? (node.sourceText || node.content || '') : '',
      compact: nodeCompact ? structuredClone(nodeCompact.compact) : null,
      recentMessages: node.messages.slice(-4).map(messageForContext)
    };
  }) : [];
  const currentSource = preferences.includeSource ? (parent.sourceText || parent.content || '') : '';
  const version = record ? ++state.contextVersionCounter : state.contextVersionCounter + 1;
  const snapshot = {
    id: makeId('ctx'),
    version,
    createdAt: now(),
    immutable: true,
    purpose,
    branchAnchor: {
      nodeId: parent.id,
      cutoffMessageId: cutoffMessageId || sliced.messages.at(-1)?.id || ''
    },
    preferences: structuredClone(preferences),
    goal,
    constraints,
    latestQuestion,
    compactVersion: compact?.version || 0,
    compact: compact ? structuredClone(compact.compact) : null,
    currentNode: {
      id: parent.id,
      title: parent.title,
      question: parent.question,
      sourceText: currentSource,
      sourceMessageId: currentSource ? (parent.sourceMessageId || '') : '',
      sourceStart: currentSource ? parent.sourceStart : -1,
      sourceEnd: currentSource ? parent.sourceEnd : -1,
      confirmedSummary: parent.confirmedSummary || '',
      messages: currentMessages,
      originalMessageCount: parent.messages.length,
      inheritedMessageCount: sliced.messages.length,
      cutoffMessageId: cutoffMessageId || sliced.messages.at(-1)?.id || ''
    },
    ancestors
  };
  snapshot.metrics = buildSnapshotMetrics(snapshot);
  if (record) {
    state.contextSnapshots.push(structuredClone(snapshot));
    parent.lastContextSnapshotId = snapshot.id;
  }
  return snapshot;
}

function buildSnapshotMetrics(snapshot) {
  const messageText = snapshot.currentNode.messages.map(message => `${message.role === 'user' ? '用户' : 'AI'}：${message.content}`).join('\n\n');
  const ancestorText = snapshot.ancestors.map(item => [item.title, item.question, item.confirmedSummary, item.sourceText, item.compact?.summary, ...(item.recentMessages || []).map(message => message.content)].filter(Boolean).join('\n')).join('\n\n');
  const compactText = snapshot.compact ? [
    snapshot.compact.summary,
    ...(snapshot.compact.confirmedConclusions || []),
    ...(snapshot.compact.rejectedAssumptions || []),
    ...(snapshot.compact.openQuestions || []),
    ...(snapshot.compact.importantUserConstraints || [])
  ].filter(Boolean).join('\n') : '';
  return buildContextMetrics([
    { key: 'currentQuestion', label: '当前明确问题', required: true, text: snapshot.latestQuestion },
    { key: 'currentMessages', label: `当前节点历史（继承 ${snapshot.currentNode.inheritedMessageCount} 条）`, required: true, text: messageText },
    { key: 'source', label: '当前原文来源', included: snapshot.preferences.includeSource, text: snapshot.currentNode.sourceText },
    { key: 'ancestors', label: `祖先路径（${snapshot.ancestors.length} 个节点）`, included: snapshot.preferences.includeAncestors, text: ancestorText },
    { key: 'constraints', label: `长期约束（${snapshot.constraints.length} 条）`, included: snapshot.preferences.includeConstraints, text: snapshot.constraints.join('\n') },
    { key: 'goal', label: snapshot.goal.text ? `已确认目标 v${snapshot.goal.version}` : '已确认目标（无）', included: snapshot.preferences.includeGoal, text: snapshot.goal.text },
    { key: 'compact', label: `Compact v${snapshot.compactVersion || 0}`, included: snapshot.preferences.includeCompact, text: compactText }
  ]);
}

function messageForContext(message) {
  return { id: message.id, role: message.role, content: normalizeAssistantContent(message.content), type: message.type || '', createdAt: message.createdAt };
}

function buildPrompt(snapshot, latestQuestion) {
  const constraints = snapshot.constraints.length ? snapshot.constraints.map(item => `- ${item}`).join('\n') : '无额外长期约束';
  const messageText = snapshot.currentNode.messages.length
    ? snapshot.currentNode.messages.map(message => `${message.role === 'user' ? '用户' : 'AI'}：${message.content}`).join('\n\n')
    : '当前节点暂无局部消息。';
  const compactText = snapshot.compact ? [
    `摘要：${snapshot.compact.summary || ''}`,
    `已确认结论：${(snapshot.compact.confirmedConclusions || []).join('；') || '无'}`,
    `被否定假设：${(snapshot.compact.rejectedAssumptions || []).join('；') || '无'}`,
    `未解决问题：${(snapshot.compact.openQuestions || []).join('；') || '无'}`,
    `重要约束：${(snapshot.compact.importantUserConstraints || []).join('；') || '无'}`
  ].join('\n') : '未启用 Compact，或所选分叉点早于当前 Compact。';
  const ancestors = snapshot.ancestors.length ? snapshot.ancestors.map((item, index) => [
    `${index + 1}. ${item.title}`,
    item.question ? `问题：${item.question}` : '',
    item.confirmedSummary ? `确认摘要：${item.confirmedSummary}` : '',
    item.sourceText ? `来源讲解：${item.sourceText}` : '',
    item.compact?.summary ? `祖先 Compact：${item.compact.summary}` : '',
    item.recentMessages?.length ? `最近消息：\n${item.recentMessages.map(message => `${message.role === 'user' ? '用户' : 'AI'}：${message.content}`).join('\n')}` : ''
  ].filter(Boolean).join('\n')).join('\n\n') : '无祖先节点，或本次已关闭祖先路径。';
  return [
    '你正在 Thought Canvas 的一个独立分支里回答。以下 Context Package 按固定优先级提供。',
    `1. 当前用户明确问题（最高优先级）：\n${latestQuestion}`,
    `2. 当前节点消息（截至锚点 ${snapshot.currentNode.cutoffMessageId || '最新'}）：\n${messageText}`,
    `3. 当前节点对应的原文来源：\n${snapshot.currentNode.sourceText || '无，或本次已关闭原文来源'}${snapshot.currentNode.sourceMessageId ? `\n来源消息：${snapshot.currentNode.sourceMessageId}，范围 ${snapshot.currentNode.sourceStart}–${snapshot.currentNode.sourceEnd}` : ''}`,
    `4. 祖先路径、确认摘要与最近消息：\n${ancestors}`,
    `5. 用户长期约束：\n${constraints}`,
    `6. 已确认的最终目标（AI 建议未经用户确认时不会出现在这里）：\n${snapshot.goal.text || '未设置已确认目标'}`,
    `7. Compact v${snapshot.compactVersion || 0}：\n${compactText}`,
    '要求：直接聚焦回答当前问题；继承上述明确事实和专有名词；不同分支之间不得互相引用未在 Context Package 中出现的内容；不要输出内部 JSON；不要在回答正文中输出画布节点，是否拆解由界面根据用户的拆解意图处理。',
    responseLanguageInstruction(state.uiLanguage)
  ].join('\n\n');
}

function showPendingEncodingRepairNotice() {
  if (encodingRepairNoticeShown || pendingEncodingRepairCount <= 0) return;
  encodingRepairNoticeShown = true;
  const count = pendingEncodingRepairCount;
  showOperationNotice(
    t('已修复文本编码'),
    t('检测到 {count} 处 UTF-8 文本被按 Windows-1252 解读；已恢复可读文字，并在项目保存时写回修复结果。', { count })
  );
}

function friendlyErrorMessage(error) {
  const text = String(error?.message || error || '未知错误');
  if (/Method not allowed/i.test(text)) return '当前操作接口不可用，请确认已启动 v12 服务。';
  if (/JSON|格式异常|解析/.test(text)) return '模型返回格式异常，已保留普通文本和现有数据。';
  if (/fetch|network|Failed to fetch/i.test(text)) return '无法连接本地服务，请检查 Node 服务是否仍在运行。';
  if (/readOnly\.access.*permissionProfile/i.test(text)) return '当前 Codex App Server 仍返回已废弃的只读权限字段。请升级 Codex CLI，并完全退出旧的 Thought Canvas 服务后重新运行 npm start。';
  return text.replace(/\n.*stack[\s\S]*/i, '').slice(0, 500);
}

function decompositionInstruction() {
  const presets = {
    structure: '按原回答的内容结构拆解，保持顺序，每个模块可独立阅读。',
    chapters: '按章节或主题段落拆解，避免把相邻且高度相关的内容分开。',
    arguments: '按观点、依据、边界与结论拆解，但仍要保留原文讲解。',
    steps: '按执行步骤拆解，每个模块说明该步骤的目的和方法。',
    learning: '按学习难点拆解，优先把最难理解的概念变成独立模块。',
    custom: state.decomposePrompt || ''
  };
  return [presets[state.decomposePreset] || presets.structure, state.decomposePrompt && state.decomposePreset !== 'custom' ? state.decomposePrompt : ''].filter(Boolean).join('\n');
}

function classifyDecomposeIntent(question) {
  const text = String(question || '').replace(/\s+/g, ' ').trim();
  if (!text || /(?:不要|无需|不用|不需要).{0,10}(拆解|拆分|分解)/.test(text)) return { mode: 'none', text };
  const explicit = [
    /(?:帮我|请|能否|可以|想要|我要).{0,18}(拆解|拆分|分解|拆成|分成)/,
    /(?:拆解|拆分|分解|拆成|分成).{0,24}(节点|模块|部分|问题|几个|多层)/,
    /(?:把|将).{0,60}(问题|回答|内容|这段|它).{0,18}(拆成|分成|拆解成|分解成)/
  ].some(pattern => pattern.test(text));
  if (explicit) return { mode: 'auto', text };
  const preview = [
    /从.+?(哪些|几个|不同).{0,12}(方面|角度|层面|部分)/,
    /(?:应该|可以).{0,12}(分几层|分几步|分几个部分|分成几步|分成几个节点|分成几个模块)/,
    /(?:按|按照).{0,12}(步骤|阶段|主题|观点|难点).{0,12}(分析|讲解|整理)/
  ].some(pattern => pattern.test(text));
  return { mode: preview ? 'confirm' : 'none', text };
}

async function maybeAutoDecomposeAnswer(nodeId, messageId, intent) {
  if (!intent || intent.mode === 'none') return;
  const node = getNode(nodeId);
  const message = node?.messages.find(item => item.id === messageId && item.role === 'assistant');
  if (!node || !message || message.error || message.partial || !String(message.content || '').trim()) return;
  try {
    await decomposeMessage(nodeId, messageId, { scope: 'message', autoMode: intent.mode });
  } catch (error) {
    showOperationError(t('自动拆解失败'), friendlyErrorMessage(error));
  }
}

function normalizeAssistantContent(text) {
  const raw = repairUtf8Mojibake(String(text || '').trim());
  if (!raw) return '';
  if (raw.startsWith('{') || raw.startsWith('```json')) {
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    try {
      const parsed = JSON.parse(cleaned);
      const candidate = parsed.answer ?? parsed.text ?? parsed.content ?? parsed.response;
      if (typeof candidate === 'string' && candidate.trim()) return repairUtf8Mojibake(candidate.trim());
    } catch {
      const match = cleaned.match(/"(?:answer|text|content|response)"\s*:\s*"([\s\S]*?)"\s*(?:,\s*"|}\s*$)/);
      if (match) {
        try { return repairUtf8Mojibake(JSON.parse(`"${match[1]}"`)); } catch { return repairUtf8Mojibake(match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')); }
      }
    }
  }
  return raw;
}

function openSettings() {
  generalSettingsDirty = false;
  renderGeneralModelSettings();
  $('#constraintsInput').value = state.constraints.join('\n');
  $('#decomposePresetSelect').value = state.decomposePreset || 'structure';
  $('#decomposePromptInput').value = state.decomposePrompt || '';
  if ($('#autoCompactEnabledInput')) $('#autoCompactEnabledInput').checked = state.autoCompactEnabled !== false;
  if ($('#autoCompactMessageLimitInput')) $('#autoCompactMessageLimitInput').value = state.autoCompactMessageLimit || DEFAULT_COMPACT_MESSAGE_LIMIT;
  if ($('#connectionShapeInput')) $('#connectionShapeInput').value = state.connectionShape || 'curve';
  if ($('#connectionStrokeInput')) $('#connectionStrokeInput').value = state.connectionStroke || 'solid';
  const history = [...state.goal.history].reverse();
  $('#goalHistory').innerHTML = history.length
    ? history.map(item => `<div class="goal-history-item"><strong>${item.status === 'suggested' ? '建议' : item.status === 'rejected' ? '拒绝' : `v${item.version}`}</strong><span>${escapeHtml(item.text || '清空目标')}</span><time>${({ suggested: 'AI 待确认', accepted: '已采用 AI 建议', edited: '用户确认', rejected: '未采用', unset: '已清空' })[item.status] || (item.source === 'ai' ? 'AI' : '用户')}</time></div>`).join('')
    : '<div class="goal-history-item"><span>还没有目标版本</span></div>';
  providerSearchQuery = '';
  $('#providerSearchInput').value = '';
  switchSettingsTab('general');
  renderProviderManager();
  $('#settingsDialog').showModal();
}

function renderGeneralModelSettings() {
  const languageSelect = $('#uiLanguageSelect');
  if (languageSelect) {
    languageSelect.innerHTML = UI_LANGUAGE_OPTIONS.map(option => `<option value="${escapeAttr(option.id)}">${escapeHtml(option.nativeLabel)}</option>`).join('');
    languageSelect.value = normalizeUiLanguage(state.uiLanguage);
    languageSelect.onchange = event => {
      generalSettingsDirty = true;
      applyUiLanguage(event.target.value, { rerender: true });
    };
  }
  const renderReasoningSelect = (select, providerId, modelId, selected) => {
    if (!select) return;
    select.innerHTML = reasoningOptions(providerId, modelId, selected);
    select.value = ensureReasoningForProvider(providerId, modelId, selected);
  };
  $('#settingsDefaultProvider').innerHTML = providerOptions(state.defaultProvider);
  $('#settingsDefaultModel').innerHTML = modelOptions(state.defaultProvider, state.defaultModel);
  renderReasoningSelect($('#settingsDefaultReasoning'), state.defaultProvider, state.defaultModel, state.defaultReasoningEffort);
  $('#settingsMergeProvider').innerHTML = providerOptions(state.mergeProvider);
  $('#settingsMergeModel').innerHTML = modelOptions(state.mergeProvider, state.mergeModel);
  renderReasoningSelect($('#settingsMergeReasoning'), state.mergeProvider, state.mergeModel, state.mergeReasoningEffort);
  $('#settingsDefaultProvider').onchange = e => {
    generalSettingsDirty = true;
    const providerId = e.target.value;
    const modelId = ensureModelForProvider(providerId, '');
    $('#settingsDefaultModel').innerHTML = modelOptions(providerId, modelId);
    renderReasoningSelect($('#settingsDefaultReasoning'), providerId, modelId, 'auto');
  };
  $('#settingsDefaultModel').onchange = e => {
    generalSettingsDirty = true;
    renderReasoningSelect($('#settingsDefaultReasoning'), $('#settingsDefaultProvider').value, e.target.value, 'auto');
  };
  $('#settingsDefaultReasoning').onchange = () => { generalSettingsDirty = true; };
  $('#settingsMergeProvider').onchange = e => {
    generalSettingsDirty = true;
    const providerId = e.target.value;
    const modelId = ensureModelForProvider(providerId, '');
    $('#settingsMergeModel').innerHTML = modelOptions(providerId, modelId);
    renderReasoningSelect($('#settingsMergeReasoning'), providerId, modelId, 'auto');
  };
  $('#settingsMergeModel').onchange = e => {
    generalSettingsDirty = true;
    renderReasoningSelect($('#settingsMergeReasoning'), $('#settingsMergeProvider').value, e.target.value, 'auto');
  };
  $('#settingsMergeReasoning').onchange = () => { generalSettingsDirty = true; };
  $('#constraintsInput').oninput = () => { generalSettingsDirty = true; };
  $('#decomposePresetSelect').onchange = () => { generalSettingsDirty = true; };
  $('#decomposePromptInput').oninput = () => { generalSettingsDirty = true; };
  if ($('#autoCompactEnabledInput')) $('#autoCompactEnabledInput').onchange = () => { generalSettingsDirty = true; };
  if ($('#autoCompactMessageLimitInput')) $('#autoCompactMessageLimitInput').oninput = () => { generalSettingsDirty = true; };
  if ($('#connectionShapeInput')) $('#connectionShapeInput').onchange = () => { generalSettingsDirty = true; };
  if ($('#connectionStrokeInput')) $('#connectionStrokeInput').onchange = () => { generalSettingsDirty = true; };
}

function switchSettingsTab(tab) {
  $$('.settings-tab').forEach(button => button.classList.toggle('active', button.dataset.settingsTab === tab));
  $$('[data-settings-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.settingsPanel === tab));
  if (tab === 'oauth') refreshCodexOAuthStatus();
}

function saveGeneralSettingsDraft({ render: shouldRender = false } = {}) {
  if (!$('#settingsDefaultProvider')) return;
  const nextDefaultProvider = $('#settingsDefaultProvider').value || state.defaultProvider;
  const nextDefaultModel = ensureModelForProvider(nextDefaultProvider, $('#settingsDefaultModel').value);
  const nextDefaultReasoningEffort = ensureReasoningForProvider(nextDefaultProvider, nextDefaultModel, $('#settingsDefaultReasoning')?.value || 'auto');
  const nextMergeProvider = $('#settingsMergeProvider').value || state.mergeProvider;
  const nextMergeModel = ensureModelForProvider(nextMergeProvider, $('#settingsMergeModel').value);
  const nextMergeReasoningEffort = ensureReasoningForProvider(nextMergeProvider, nextMergeModel, $('#settingsMergeReasoning')?.value || 'auto');
  const nextConstraints = $('#constraintsInput').value.split('\n').map(line => line.trim()).filter(Boolean);
  const nextDecomposePreset = $('#decomposePresetSelect')?.value || 'structure';
  const nextDecomposePrompt = $('#decomposePromptInput')?.value || '';
  const nextAutoCompactEnabled = $('#autoCompactEnabledInput')?.checked !== false;
  const nextAutoCompactMessageLimit = clamp(Number($('#autoCompactMessageLimitInput')?.value || DEFAULT_COMPACT_MESSAGE_LIMIT), 4, 100);
  const nextConnectionShape = $('#connectionShapeInput')?.value === 'orthogonal' ? 'orthogonal' : 'curve';
  const nextConnectionStroke = $('#connectionStrokeInput')?.value === 'dashed' ? 'dashed' : 'solid';
  const nextUiLanguage = normalizeUiLanguage($('#uiLanguageSelect')?.value || state.uiLanguage || DEFAULT_UI_LANGUAGE);
  const modelChanged = nextDefaultProvider !== state.defaultProvider || nextDefaultModel !== state.defaultModel || nextDefaultReasoningEffort !== state.defaultReasoningEffort;
  state.defaultProvider = nextDefaultProvider;
  state.defaultModel = nextDefaultModel;
  state.defaultReasoningEffort = nextDefaultReasoningEffort;
  state.mergeProvider = nextMergeProvider;
  state.mergeModel = nextMergeModel;
  state.mergeReasoningEffort = nextMergeReasoningEffort;
  state.constraints = nextConstraints;
  state.decomposePreset = nextDecomposePreset;
  state.decomposePrompt = nextDecomposePrompt;
  state.autoCompactEnabled = nextAutoCompactEnabled;
  state.autoCompactMessageLimit = nextAutoCompactMessageLimit;
  state.connectionShape = nextConnectionShape;
  state.connectionStroke = nextConnectionStroke;
  applyUiLanguage(nextUiLanguage, { rerender: false });
  normalizeProviderSelections();
  if (modelChanged && $('#resetComposerOverridesInput')?.checked) clearComposerOverridesInAllProjects();
  generalSettingsDirty = false;
  if (shouldRender) saveAndRender(); else saveState();
}

async function saveAllSettings({ render: shouldRender = true, silent = false } = {}) {
  const ok = await commitProviderEditorDraft({ silent: true, strict: false, persistSecret: false });
  if (!ok) return false;
  saveGeneralSettingsDraft({ render: false });
  await persistLocalConfig();
  renderHomeModelSelectors();
  if (shouldRender) render();
  if (!silent) setProviderConnectionState('success', '已保存', '非敏感供应商配置、默认模型与长期约束已写入本地配置。API Key 仅在“连接并同步模型”验证成功后保存。');
  return true;
}

async function persistLocalConfig() {
  const settings = globalSettingsFromState(state);
  delete settings.providerKeyStorage;
  try {
    await apiJson('/api/local-config', { settings });
    localGlobalSettings = structuredClone(settings);
    // 供应商配置以 data/settings.local.json 为准。
  } catch (error) {
    console.warn('保存本地配置失败', error);
    throw error;
  }
}

function renderProviderManager({ preserveEditor = false } = {}) {
  const active = getProvider(state.activeProviderEditorId) || state.providers[0];
  if (!active) return;
  state.activeProviderEditorId = active.id;
  const filtered = state.providers.filter(profile => {
    if (!providerSearchQuery) return true;
    return `${profile.name} ${profile.builtIn ? '预设' : '自定义'} ${protocolLabel(profile.protocol)} ${profile.description || ''}`.toLowerCase().includes(providerSearchQuery);
  }).sort((a, b) => Number(Boolean(b.builtIn)) - Number(Boolean(a.builtIn)) || a.name.localeCompare(b.name, localeForIntl(state.uiLanguage)));
  let lastCategory = '';
  $('#providerProfileList').innerHTML = filtered.map(profile => {
    const hasKey = Boolean(providerSecretStatus[profile.id]);
    const category = profile.builtIn ? '预设' : '自定义';
    const heading = category !== lastCategory ? `<div class="provider-category">${escapeHtml(category)}</div>` : '';
    lastCategory = category;
    return `${heading}<button type="button" class="provider-profile-item ${profile.id === active.id ? 'active' : ''}" data-provider-profile="${escapeAttr(profile.id)}">
      <span class="provider-profile-icon">${escapeHtml(profile.name.slice(0, 1).toUpperCase())}</span>
      <span><strong>${escapeHtml(profile.name)}</strong><small>${escapeHtml(protocolLabel(profile.protocol))}${profile.templateOnly ? ' · 待配置' : ''}${profile.connectionStatus === 'connected' ? ' · 已连接' : hasKey ? ' · Key 已保存' : profile.keyOptional ? ' · Key 可选' : ''}</small></span>
      <i class="provider-enabled-dot ${providerIsReady(profile) ? 'on' : ''}" title="${providerIsReady(profile) ? '已连接可用' : '尚未连接'}"></i>
    </button>`;
  }).join('') || '<div class="provider-empty">没有匹配的供应商</div>';
  $$('[data-provider-profile]').forEach(button => button.onclick = async () => {
    await commitProviderEditorDraft({ silent: true, persistSecret: false });
    state.activeProviderEditorId = button.dataset.providerProfile;
    saveState();
    renderProviderManager();
  });
  if (preserveEditor && document.activeElement?.closest?.('.provider-editor-pane')) return;
  $('#providerEditorTitle').textContent = active.name;
  $('#providerNameInput').value = active.name;
  $('#providerProtocolSelect').innerHTML = PROTOCOL_OPTIONS.map(item => `<option value="${item.id}" ${active.protocol === item.id ? 'selected' : ''}>${item.label}</option>`).join('');
  $('#providerBaseUrlInput').value = active.baseUrl || '';
  $('#providerAuthModeSelect').innerHTML = AUTH_MODE_OPTIONS.map(item => `<option value="${item.id}" ${(active.authMode || defaultAuthMode(active.protocol)) === item.id ? 'selected' : ''}>${item.label}</option>`).join('');
  $('#providerReasoningModeSelect').innerHTML = REASONING_MODE_OPTIONS.map(item => `<option value="${item.id}" ${(active.reasoningMode || 'auto') === item.id ? 'selected' : ''}>${item.label}</option>`).join('');
  $('#providerApiKeyInput').value = '';
  $('#providerApiKeyInput').placeholder = providerSecretStatus[active.id] ? '已连接；输入新 Key 后点击“连接并同步模型”可替换' : '仅用于连接验证；成功后保存到 .env.local';
  $('#providerKeyStatus').textContent = providerSecretStatus[active.id] ? '已保存到 .env.local' : active.keyOptional ? '可选' : '未保存';
  $('#providerKeyStatus').className = providerSecretStatus[active.id] ? 'has-key' : '';
  $('#clearProviderKeyBtn').disabled = !providerSecretStatus[active.id];
  $('#providerHeadersInput').value = active.customHeadersText || (active.customHeaders && Object.keys(active.customHeaders).length ? JSON.stringify(active.customHeaders, null, 2) : '');
  renderProviderModelRows(active.models || []);
  renderProviderTestModels(active.models || [], active.testModel || active.models?.[0]?.id || '');
  $('#providerEnabledInput').checked = active.enabled !== false;
  $('#deleteProviderBtn').disabled = Boolean(active.builtIn);
  $('#resetProviderBtn').disabled = !active.builtIn;
  const localAuth = active.protocol === 'codex-app-server';
  $('#providerBaseUrlInput').disabled = localAuth;
  $('#providerApiKeyInput').disabled = localAuth;
  $('#providerAuthModeSelect').disabled = localAuth;
  $('#clearProviderKeyBtn').disabled = localAuth || !providerSecretStatus[active.id];
  $('#syncModelsBtn').disabled = localAuth;
  $('#connectProviderBtn').disabled = localAuth;
  $('#setDefaultProviderBtn').textContent = state.defaultProvider === active.id ? '当前默认回答' : '设为默认回答';
  $('#setDefaultProviderBtn').disabled = state.defaultProvider === active.id || !providerIsReady(active);
  bindProviderEditorAutosave();
  if (localAuth) {
    setProviderConnectionState(active.connectionStatus === 'connected' ? 'success' : 'neutral', active.connectionStatus === 'connected' ? '已连接' : '请到 OAuth 连接', active.description || 'Codex 通过 OAuth 标签页连接。');
  } else if (active.connectionStatus === 'connected') {
    const synced = active.lastModelSyncAt ? ` · ${formatProjectTime(active.lastModelSyncAt)}同步` : '';
    setProviderConnectionState('success', '已连接', `${active.models?.length || 0} 个模型${synced}。可重新同步或仅测试当前模型。`);
  } else if (active.connectionStatus === 'error') {
    setProviderConnectionState('error', '连接失败', active.connectionDetail || '请检查 Base URL、API Key 与协议。');
  } else {
    setProviderConnectionState('neutral', providerSecretStatus[active.id] ? 'Key 已保存' : '未连接', active.description || '输入 API Key 后点击“连接并同步模型”。');
  }
}

function renderProviderModelRows(models) {
  const container = $('#providerModelRows');
  if (!container) return;
  const active = getProvider(state.activeProviderEditorId) || {};
  providerEditorModels = normalizeModels(models, active);
  container.innerHTML = providerEditorModels.map((model, index) => {
    const efforts = (model.reasoningEfforts || []).filter(item => item !== 'auto');
    const capability = efforts.length
      ? `思考：${efforts.map(item => REASONING_EFFORT_LABELS[item] || item).join(' / ')}`
      : '思考：模型未声明';
    return `<div class="provider-model-row" data-model-row="${index}">
      <input data-model-id value="${escapeAttr(model.id)}" placeholder="模型 ID" />
      <input data-model-label value="${escapeAttr(model.label && model.label !== model.id ? model.label : '')}" placeholder="显示名称（可选）" />
      <span class="provider-model-capability" title="${escapeAttr(capability)}">${escapeHtml(capability)}</span>
      <button type="button" data-remove-model="${index}" aria-label="删除模型">×</button>
    </div>`;
  }).join('');
  $$('[data-model-id], [data-model-label]').forEach(input => input.addEventListener('input', () => {
    renderProviderTestModels(readProviderModelRows(), $('#providerTestModelSelect').value);
    scheduleProviderAutosave();
  }));
  $$('[data-remove-model]').forEach(button => button.addEventListener('click', () => {
    const next = readProviderModelRows().filter((_, index) => index !== Number(button.dataset.removeModel));
    renderProviderModelRows(next);
    renderProviderTestModels(next, next[0]?.id || '');
    scheduleProviderAutosave();
  }));
}

function readProviderModelRows() {
  const active = getProvider(state.activeProviderEditorId) || {};
  return $$('.provider-model-row').map((row, index) => {
    const id = row.querySelector('[data-model-id]')?.value.trim() || '';
    const label = row.querySelector('[data-model-label]')?.value.trim() || id;
    const previous = providerEditorModels[index] || providerEditorModels.find(item => item.id === id) || {};
    return normalizeModelRecord({ ...previous, id, label }, active);
  }).filter(model => model.id);
}

function addProviderModelRow() {
  const models = readProviderModelRows();
  models.push({ id: '', label: '' });
  renderProviderModelRows(models);
  const rows = $$('.provider-model-row');
  rows.at(-1)?.querySelector('[data-model-id]')?.focus();
}

function bindProviderEditorAutosave() {
  const ids = ['providerNameInput','providerProtocolSelect','providerBaseUrlInput','providerAuthModeSelect','providerReasoningModeSelect','providerHeadersInput','providerTestModelSelect','providerEnabledInput'];
  for (const id of ids) {
    const el = $(`#${id}`);
    if (!el) continue;
    const handler = () => {
      if (id === 'providerProtocolSelect') {
        const localAuth = el.value === 'codex-app-server';
        $('#providerBaseUrlInput').disabled = localAuth;
        $('#providerApiKeyInput').disabled = localAuth;
        $('#providerAuthModeSelect').disabled = localAuth;
        $('#syncModelsBtn').disabled = localAuth;
        $('#connectProviderBtn').disabled = localAuth;
        if (!localAuth) $('#providerAuthModeSelect').value = defaultAuthMode(el.value);
      }
      scheduleProviderAutosave();
    };
    el.oninput = handler;
    el.onchange = handler;
  }
  $('#addModelRowBtn').onclick = addProviderModelRow;
  $('#clearProviderKeyBtn').onclick = clearActiveProviderSecret;
}

function scheduleProviderAutosave() {
  clearTimeout(providerAutosaveTimer);
  setProviderConnectionState('testing', '未保存', '当前供应商有修改；点击“保存配置”写入本地文件。');
  providerAutosaveTimer = setTimeout(() => commitProviderEditorDraft({ silent: true, persistSecret: false }), 360);
}

function renderProviderTestModels(models, selected) {
  const list = normalizeModels(models);
  const select = $('#providerTestModelSelect');
  if (!select) return;
  const value = list.some(item => item.id === selected) ? selected : list[0]?.id || '';
  select.innerHTML = list.length
    ? list.map(item => `<option value="${escapeAttr(item.id)}" ${item.id === value ? 'selected' : ''}>${escapeHtml(item.label || item.id)}</option>`).join('')
    : '<option value="">请先新增模型</option>';
}

async function addCustomProvider() {
  await commitProviderEditorDraft({ silent: true, persistSecret: false });
  const id = makeUniqueProviderId('custom');
  state.providers.push({
    id, name: `自定义供应商 ${state.providers.filter(item => !item.builtIn).length + 1}`, protocol: 'openai-chat', baseUrl: '', enabled: true,
    builtIn: false, keyOptional: false, category: '自定义', authMode: 'bearer', reasoningMode: 'auto', connectionStatus: 'unverified', customHeadersText: '',
    description: '填写任意 OpenAI 兼容或原生协议供应商。', models: [{ id: 'model-id', label: 'model-id' }]
  });
  state.activeProviderEditorId = id;
  saveState();
  await persistLocalConfig();
  renderProviderManager();
  $('#providerNameInput').focus();
}

async function duplicateActiveProvider() {
  await commitProviderEditorDraft({ silent: true, persistSecret: false });
  const source = getProvider(state.activeProviderEditorId);
  if (!source) return;
  const id = makeUniqueProviderId('custom');
  const clone = structuredClone(source);
  Object.assign(clone, { id, name: `${source.name} 副本`, builtIn: false, templateOnly: false, category: '自定义', updatedAt: now() });
  state.providers.push(clone);
  state.activeProviderEditorId = id;
  saveState();
  await persistLocalConfig();
  renderProviderManager();
}

async function setActiveProviderAsDefault() {
  await commitProviderEditorDraft({ silent: true, persistSecret: false });
  const profile = getProvider(state.activeProviderEditorId);
  if (!profile || !providerIsReady(profile)) {
    setProviderConnectionState('error', '尚未连接', '请先点击“连接并同步模型”，验证 API Key 并读取可用模型。');
    return;
  }
  state.defaultProvider = profile.id;
  state.defaultModel = ensureModelForProvider(profile.id, profile.testModel || profile.models?.[0]?.id || '');
  state.defaultReasoningEffort = ensureReasoningForProvider(profile.id, state.defaultModel, 'auto');
  clearComposerOverridesInAllProjects();
  normalizeProviderSelections();
  saveState();
  await persistLocalConfig();
  renderGeneralModelSettings();
  renderProviderManager();
  render();
}

async function saveActiveProvider({ silent = false } = {}) {
  const ok = await commitProviderEditorDraft({ silent, strict: true, persistSecret: false });
  if (ok) {
    await persistLocalConfig();
    renderProviderManager(); renderGeneralModelSettings(); renderHomeModelSelectors(); render();
  }
  return ok;
}

function providerConnectionFingerprint(profile = {}) {
  return JSON.stringify({
    protocol: String(profile.protocol || ''),
    baseUrl: String(profile.baseUrl || '').replace(/\/+$/, ''),
    authMode: String(profile.authMode || ''),
    reasoningMode: String(profile.reasoningMode || 'auto'),
    customHeaders: profile.customHeaders || {},
    modelIds: (profile.models || []).map(model => String(model?.id || '')).filter(Boolean).sort()
  });
}

async function commitProviderEditorDraft({ silent = false, strict = false, persistSecret = false } = {}) {
  clearTimeout(providerAutosaveTimer);
  const profile = getProvider(state.activeProviderEditorId);
  if (!profile || !$('#providerNameInput')) return true;
  const name = $('#providerNameInput').value.trim();
  const protocol = $('#providerProtocolSelect').value;
  const baseUrl = $('#providerBaseUrlInput').value.trim().replace(/\/+$/, '');
  const models = readProviderModelRows();
  let customHeaders = {};
  try { customHeaders = parseCustomHeaders($('#providerHeadersInput').value); }
  catch (error) {
    if (strict) showOperationError('供应商配置未保存', error.message);
    setProviderConnectionState('error', '未保存', error.message);
    return false;
  }
  if (strict && !name) { showOperationError('供应商配置未保存', '供应商名称不能为空。'); return false; }
  if (strict && protocol !== 'codex-app-server' && !/^https?:\/\//i.test(baseUrl)) { showOperationError('供应商配置未保存', 'Base URL 必须以 http:// 或 https:// 开头。'); return false; }
  if (strict && !models.length) { showOperationError('供应商配置未保存', '至少配置一个模型。'); return false; }
  const selectedTestModel = $('#providerTestModelSelect').value;
  const previousFingerprint = providerConnectionFingerprint(profile);
  Object.assign(profile, {
    name: name || profile.name || '未命名供应商', protocol, baseUrl,
    authMode: $('#providerAuthModeSelect').value || defaultAuthMode(protocol),
    reasoningMode: $('#providerReasoningModeSelect').value || 'auto',
    customHeadersText: $('#providerHeadersInput').value.trim(), customHeaders,
    models: models.length ? models : profile.models,
    testModel: (models.length ? models : profile.models || []).some(item => item.id === selectedTestModel) ? selectedTestModel : (models[0]?.id || profile.models?.[0]?.id || ''),
    enabled: $('#providerEnabledInput').checked, updatedAt: now()
  });
  const connectionInputsChanged = previousFingerprint !== providerConnectionFingerprint(profile);
  if (profile.protocol !== 'codex-app-server' && profile.connectionStatus === 'connected' && connectionInputsChanged) {
    profile.connectionStatus = 'unverified';
    profile.connectionDetail = '连接参数已修改，请重新执行“连接并同步模型”。';
  }
  state.defaultModel = ensureModelForProvider(state.defaultProvider, state.defaultModel);
  state.defaultReasoningEffort = ensureReasoningForProvider(state.defaultProvider, state.defaultModel, state.defaultReasoningEffort);
  state.mergeModel = ensureModelForProvider(state.mergeProvider, state.mergeModel);
  state.mergeReasoningEffort = ensureReasoningForProvider(state.mergeProvider, state.mergeModel, state.mergeReasoningEffort);
  state.decomposePreset = state.decomposePreset || 'structure';
  state.decomposePrompt = String(state.decomposePrompt || '');
  state.autoCompactEnabled = state.autoCompactEnabled !== false;
  state.autoCompactMessageLimit = clamp(Number(state.autoCompactMessageLimit || DEFAULT_COMPACT_MESSAGE_LIMIT), 4, 100);
  state.connectionShape = state.connectionShape === 'orthogonal' ? 'orthogonal' : 'curve';
  state.connectionStroke = state.connectionStroke === 'dashed' ? 'dashed' : 'solid';
  state.viewMode = state.viewMode === 'path' ? 'path' : 'all';
  state.contextVersionCounter = Number(state.contextVersionCounter || 0);
  state.modelCalls = Array.isArray(state.modelCalls) ? state.modelCalls : [];
  for (const selection of Object.values(state.composerByNode)) if (selection.provider === profile.id) { selection.model = ensureModelForProvider(profile.id, selection.model); selection.reasoningEffort = ensureReasoningForProvider(profile.id, selection.model, selection.reasoningEffort); }
  normalizeProviderSelections();
  saveState();
  if (!silent) setProviderConnectionState('success', '配置已保存', '非敏感配置已写入 data/settings.local.json。API Key 只有在连接验证成功后才会写入 .env.local。');
  return true;
}

async function clearActiveProviderSecret() {
  const profile = getProvider(state.activeProviderEditorId);
  if (!profile || !providerSecretStatus[profile.id]) return;
  const confirmed = await requestConfirmation({
    eyebrow: '清除 API Key',
    title: `断开“${profile.name}”？`,
    message: '保存在 .env.local 中的 API Key 会被清除；供应商配置和模型列表仍会保留。',
    confirmLabel: '清除并断开',
    danger: true
  });
  if (!confirmed) return;
  await apiJson('/api/provider-secret', { providerId: profile.id, clear: true });
  delete providerSecretStatus[profile.id];
  profile.connectionStatus = 'disconnected';
  profile.connectionDetail = 'API Key 已清除，请重新连接。';
  normalizeProviderSelections();
  saveState();
  await persistLocalConfig();
  renderProviderManager();
  renderGeneralModelSettings();
  renderHomeModelSelectors();
  if (currentProjectId) render();
}

async function deleteActiveProvider() {
  await commitProviderEditorDraft({ silent: true, persistSecret: false });
  const profile = getProvider(state.activeProviderEditorId);
  if (!profile || profile.builtIn) return;
  const confirmed = await requestConfirmation({
    eyebrow: '删除供应商',
    title: `删除“${profile.name}”？`,
    message: '该供应商的本地配置、模型列表和关联 API Key 会一起移除。已有节点内容不会删除。',
    confirmLabel: '删除供应商',
    danger: true
  });
  if (!confirmed) return;
  state.providers = state.providers.filter(item => item.id !== profile.id);
  if (providerSecretStatus[profile.id]) {
    try { await apiJson('/api/provider-secret', { providerId: profile.id, clear: true }); } catch {}
    delete providerSecretStatus[profile.id];
  }
  state.activeProviderEditorId = getProvider('deepseek')?.id || state.providers[0]?.id || '';
  normalizeProviderSelections();
  for (const [nodeId, selection] of Object.entries(state.composerByNode)) if (selection.provider === profile.id) delete state.composerByNode[nodeId];
  saveState(); await persistLocalConfig(); renderProviderManager(); renderGeneralModelSettings(); render();
}

async function resetActiveProvider() {
  const profile = getProvider(state.activeProviderEditorId);
  const preset = PROVIDER_PRESETS.find(item => item.id === profile?.id);
  if (!profile || !preset) return;
  const index = state.providers.findIndex(item => item.id === profile.id);
  state.providers[index] = structuredClone(preset);
  normalizeProviderSelections();
  saveState(); await persistLocalConfig(); renderProviderManager(); renderGeneralModelSettings(); render();
}

async function connectActiveProvider({ resync = false } = {}) {
  const button = resync ? $('#syncModelsBtn') : $('#connectProviderBtn');
  const originalLabel = button?.textContent || '';
  const previousProfile = structuredClone(getProvider(state.activeProviderEditorId) || null);
  const previousFingerprint = previousProfile ? providerConnectionFingerprint(previousProfile) : '';
  const previousHadStoredKey = Boolean(previousProfile && providerSecretStatus[previousProfile.id]);
  const committed = await commitProviderEditorDraft({ silent: true, strict: false, persistSecret: false });
  if (!committed) return;
  const draft = providerDraftFromEditor();
  if (!draft) return;
  if (draft.protocol === 'codex-app-server') {
    switchSettingsTab('oauth');
    return refreshCodexOAuthStatus();
  }
  const typedKey = $('#providerApiKeyInput').value.trim();
  if (!typedKey && !providerSecretStatus[draft.id] && !draft.keyOptional && draft.authMode !== 'none') {
    setProviderConnectionState('error', '缺少 API Key', '请输入 API Key，再点击“连接并同步模型”。');
    $('#providerApiKeyInput').focus();
    return;
  }
  const preferredModel = $('#providerTestModelSelect').value || draft.testModel || draft.models[0]?.id || '';
  const config = modelConfigFromDraft(draft, preferredModel, 'auto');
  setProviderConnectionState('testing', resync ? '重新同步中' : '正在连接', `正在验证 ${draft.name} 并读取模型列表…`);
  if (button) { button.disabled = true; button.textContent = resync ? '同步中…' : '连接中…'; }
  try {
    const result = await apiJson('/api/providers/connect', { config, apiKey: typedKey, verifyGeneration: !resync });
    const profile = getProvider(draft.id);
    const models = normalizeDiscoveredModels(result.models || [], { ...draft, ...(profile || {}) });
    if (!models.length) throw new Error('供应商没有返回可用模型列表。');
    Object.assign(profile, {
      models,
      enabled: true,
      connectionStatus: 'connected',
      connectionDetail: result.catalogWarning || '',
      connection: result.connection || null,
      modelCatalogSource: result.catalogSource || 'remote_catalog',
      modelCatalogWarning: result.catalogWarning || '',
      lastModelSyncAt: result.syncedAt || now(),
      testModel: models.find(item => item.isDefault)?.id || (models.some(item => item.id === preferredModel) ? preferredModel : models[0].id),
      updatedAt: now()
    });
    if (result.hasKey) providerSecretStatus[profile.id] = true;
    $('#providerApiKeyInput').value = '';
    normalizeProviderSelections();
    saveState();
    await persistLocalConfig();
    renderProviderManager();
    renderGeneralModelSettings();
    renderHomeModelSelectors();
    if (currentProjectId) render();
    const catalogCopy = result.catalogSource === 'configured_fallback' ? '供应商未提供模型目录，已验证手动配置模型。' : '模型目录已同步。';
    setProviderConnectionState('success', '已连接', `${models.length} 个模型可用${result.latencyMs ? ` · ${result.latencyMs}ms` : ''}。${catalogCopy}模型与思考等级已刷新。`);
  } catch (error) {
    const profile = getProvider(draft.id);
    const detail = friendlyErrorMessage(error);
    const connectionConfigUnchanged = Boolean(previousProfile) && previousFingerprint === providerConnectionFingerprint(draft);
    const canKeepPreviousConnection = Boolean(
      profile && previousProfile && previousHadStoredKey && providerIsReady(previousProfile) && connectionConfigUnchanged
    );
    if (canKeepPreviousConnection) {
      Object.assign(profile, {
        models: structuredClone(previousProfile.models || []),
        enabled: previousProfile.enabled,
        connectionStatus: 'connected',
        connectionDetail: previousProfile.connectionDetail || '',
        connection: previousProfile.connection || null,
        modelCatalogSource: previousProfile.modelCatalogSource || '',
        modelCatalogWarning: previousProfile.modelCatalogWarning || '',
        lastModelSyncAt: previousProfile.lastModelSyncAt || '',
        testModel: previousProfile.testModel || previousProfile.models?.[0]?.id || ''
      });
      saveState();
      setProviderConnectionState('success', resync ? '同步失败，原连接仍可用' : '新 Key 验证失败，原连接仍可用', `${detail}。已保存的 Key、模型目录与当前生成能力均未被覆盖。`);
    } else {
      if (profile) {
        profile.connectionStatus = 'error';
        profile.connectionDetail = detail;
        saveState();
      }
      setProviderConnectionState('error', '连接失败', `${detail}。若供应商不支持模型列表，可手动维护模型后使用“仅测试当前模型”。`);
    }
  } finally {
    if (button) { button.disabled = false; button.textContent = originalLabel; }
  }
}

async function testActiveProvider() {
  const committed = await commitProviderEditorDraft({ silent: true, strict: false, persistSecret: false });
  if (!committed) return;
  const draft = providerDraftFromEditor();
  if (!draft) return;
  if (draft.protocol === 'codex-app-server') {
    switchSettingsTab('oauth');
    return refreshCodexOAuthStatus();
  }
  const model = $('#providerTestModelSelect').value || draft.testModel || draft.models[0]?.id;
  const config = modelConfigFromDraft(draft, model, 'auto');
  const typedKey = $('#providerApiKeyInput').value.trim();
  if (typedKey) config.apiKey = typedKey;
  setProviderConnectionState('testing', '测试中', `正在调用 ${draft.name} / ${model}…`);
  const started = performance.now();
  try {
    const result = await apiJson('/api/test-provider', { config });
    const elapsed = Math.round(performance.now() - started);
    setProviderConnectionState('success', '测试成功', `HTTP ${result.status || 200} · ${result.latencyMs || elapsed}ms · ${result.preview || '返回正常'}。此操作不会同步模型。`);
  } catch (error) { setProviderConnectionState('error', '测试失败', friendlyErrorMessage(error)); }
}

async function syncActiveProviderModels() {
  return connectActiveProvider({ resync: true });
}

function providerDraftFromEditor() {
  const current = getProvider(state.activeProviderEditorId);
  if (!current) return null;
  let customHeaders = {};
  try { customHeaders = parseCustomHeaders($('#providerHeadersInput').value); }
  catch (error) { setProviderConnectionState('error', '配置错误', error.message); return null; }
  const draft = {
    ...current,
    name: $('#providerNameInput').value.trim() || current.name,
    protocol: $('#providerProtocolSelect').value,
    baseUrl: $('#providerBaseUrlInput').value.trim().replace(/\/+$/, ''),
    authMode: $('#providerAuthModeSelect').value || defaultAuthMode($('#providerProtocolSelect').value),
    reasoningMode: $('#providerReasoningModeSelect').value || 'auto',
    customHeadersText: $('#providerHeadersInput').value.trim(), customHeaders,
    models: readProviderModelRows(),
    enabled: $('#providerEnabledInput').checked
  };
  if (draft.protocol !== 'codex-app-server' && !/^https?:\/\//i.test(draft.baseUrl)) { setProviderConnectionState('error', '配置错误', 'Base URL 必须以 http:// 或 https:// 开头。'); return null; }
  return draft;
}

function defaultAuthMode(protocol) {
  if (protocol === 'anthropic-messages') return 'x-api-key';
  if (protocol === 'gemini-generate-content') return 'x-goog-api-key';
  if (protocol === 'codex-app-server') return 'none';
  return 'bearer';
}

function parseCustomHeaders(text) {
  if (!String(text || '').trim()) return {};
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('自定义请求头不是有效 JSON'); }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('自定义请求头必须是 JSON 对象');
  return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [String(key), String(value)]));
}

function setProviderConnectionState(kind, label, detail) {
  const stateEl = $('#providerConnectionState');
  if (!stateEl) return;
  stateEl.className = `connection-state ${kind}`;
  stateEl.textContent = label;
  const detailEl = $('#providerTestDetail');
  if (detailEl) detailEl.textContent = detail || '';
}

function modelConfigFromDraft(profile, model, reasoningEffort = 'auto') {
  return {
    providerId: profile.id, providerName: profile.name, protocol: profile.protocol,
    baseUrl: profile.baseUrl, model, apiKey: '', keyOptional: Boolean(profile.keyOptional),
    authMode: profile.authMode || defaultAuthMode(profile.protocol),
    customHeaders: profile.customHeaders || parseCustomHeaders(profile.customHeadersText || ''),
    reasoningMode: profile.reasoningMode || inferReasoningMode(profile, model),
    reasoningEffort: resolveReasoningEffort(profile, model, reasoningEffort)
  };
}


async function refreshCodexOAuthStatus() {
  const badge = $('#codexOAuthBadge');
  const detail = $('#codexOAuthDetail');
  if (!badge || !detail) return;
  badge.className = 'oauth-badge caution';
  badge.textContent = '检测中';
  setCodexOAuthControls({ installed: false, loggedIn: false, running: true, detecting: true });
  try {
    const result = await apiGet('/api/oauth/codex/status');
    await syncCodexProviderFromStatus(result);
    renderCodexOAuthStatus(result);
  } catch (error) {
    badge.className = 'oauth-badge blocked';
    badge.textContent = '不可用';
    detail.textContent = error.message;
    renderCodexAccountAndModels(null, []);
    setCodexOAuthControls({ installed: false, loggedIn: false, running: false });
  }
}

function getCodexProvider() {
  return getProvider('codex-cli') || state.providers.find(profile => profile.protocol === 'codex-app-server');
}

async function syncCodexProviderFromStatus(result, { persist = true } = {}) {
  const profile = getCodexProvider();
  if (!profile) return false;
  const previous = JSON.stringify({
    enabled: profile.enabled,
    connectionStatus: profile.connectionStatus,
    models: profile.models,
    lastModelSyncAt: profile.lastModelSyncAt
  });
  if (result?.loggedIn) {
    const models = normalizeDiscoveredModels(result.models || [], { ...profile, reasoningMode: 'codex' });
    const modelsChanged = JSON.stringify(profile.models || []) !== JSON.stringify(models);
    Object.assign(profile, {
      models,
      enabled: models.length > 0,
      connectionStatus: models.length ? 'connected' : 'error',
      connectionDetail: models.length ? '' : '账号已连接，但没有返回可在选择器中使用的模型。',
      lastModelSyncAt: result.syncedAt || (modelsChanged || !profile.lastModelSyncAt ? now() : profile.lastModelSyncAt),
      codexAccount: result.account || null,
      testModel: models.find(item => item.isDefault)?.id || models[0]?.id || '',
      updatedAt: now()
    });
  } else {
    profile.enabled = false;
    profile.connectionStatus = 'disconnected';
    profile.connectionDetail = result?.detail || '尚未连接 ChatGPT 账号。';
    profile.codexAccount = null;
    profile.models = [];
    profile.testModel = '';
  }
  normalizeProviderSelections();
  const changed = previous !== JSON.stringify({
    enabled: profile.enabled,
    connectionStatus: profile.connectionStatus,
    models: profile.models,
    lastModelSyncAt: profile.lastModelSyncAt
  });
  if (changed) {
    saveState();
    if (persist) await persistLocalConfig();
    renderHomeModelSelectors();
    renderGeneralModelSettings();
    if (currentProjectId) render();
  }
  return changed;
}

function renderCodexOAuthStatus(result) {
  const badge = $('#codexOAuthBadge');
  const detail = $('#codexOAuthDetail');
  const installed = Boolean(result.installed);
  const loggedIn = Boolean(result.loggedIn);
  const active = result.activeSession && ['running', 'cancelling'].includes(result.activeSession.status)
    ? result.activeSession
    : null;

  if (active) {
    codexAuthSessionId = active.sessionId || active.id || codexAuthSessionId;
    codexAuthMode = active.mode === 'device' ? 'device' : 'browser';
    codexAuthSessionStatus = active.status;
    badge.className = 'oauth-badge caution';
    badge.textContent = active.status === 'cancelling' ? '正在取消' : '授权中';
    updateCodexOAuthProgress(active);
    renderCodexAccountAndModels(null, []);
    setCodexOAuthControls({ installed, loggedIn: false, running: true });
    ensureCodexOAuthPolling();
    return;
  }

  codexAuthSessionStatus = '';
  badge.className = `oauth-badge ${loggedIn ? 'possible' : installed ? 'caution' : 'blocked'}`;
  badge.textContent = loggedIn ? '已连接' : installed ? '未连接' : '未安装';
  detail.textContent = installed
    ? loggedIn
      ? `${result.detail || 'Codex 已通过 ChatGPT 授权连接。'}模型与思考等级来自当前账号的 App Server model/list。`
      : result.detail || 'Codex App Server 可用。点击“连接 Codex”打开官方 ChatGPT 授权页面。'
    : result.detail || '未检测到支持 App Server 的 Codex CLI。请先安装或升级官方 Codex CLI。';
  renderCodexAccountAndModels(loggedIn ? result.account : null, loggedIn ? result.models || [] : []);
  setCodexOAuthControls({ installed, loggedIn, running: false });
}

function renderCodexAccountAndModels(account, models) {
  const accountEl = $('#codexAccountSummary');
  const modelsEl = $('#codexModelSummary');
  const list = Array.isArray(models) ? models : [];
  if (accountEl) {
    accountEl.classList.toggle('hidden', !account);
    accountEl.innerHTML = account
      ? `<span>账号</span><strong>${escapeHtml(account.email || account.type || 'ChatGPT')}</strong>${account.planType ? `<em>${escapeHtml(account.planType)}</em>` : ''}`
      : '';
  }
  if (modelsEl) {
    modelsEl.classList.toggle('hidden', !list.length);
    modelsEl.innerHTML = list.length
      ? `<div><span>可用模型</span><strong>${list.length} 个</strong></div><div class="oauth-model-chips">${list.slice(0, 12).map(raw => {
          const model = normalizeModelRecord(raw, getCodexProvider() || { protocol: 'codex-app-server' });
          const efforts = model.reasoningEfforts.filter(item => item !== 'auto').map(item => REASONING_EFFORT_LABELS[item] || item).join(' / ');
          return `<span title="${escapeAttr(efforts ? `思考等级：${efforts}` : '采用模型默认')}">${escapeHtml(model.label || model.id)}</span>`;
        }).join('')}</div>`
      : '';
  }
}

function setCodexOAuthControls({ installed, loggedIn, running, detecting = false }) {
  const browserBtn = $('#codexBrowserLoginBtn');
  const deviceBtn = $('#codexDeviceLoginBtn');
  const cancelBtn = $('#codexCancelLoginBtn');
  const detectBtn = $('#codexDetectBtn');
  const logoutBtn = $('#codexLogoutBtn');
  const useBtn = $('#codexUseNowBtn');
  const loginDisabled = detecting || !installed || loggedIn || running;
  if (browserBtn) browserBtn.disabled = loginDisabled;
  if (deviceBtn) deviceBtn.disabled = loginDisabled;
  if (detectBtn) detectBtn.disabled = detecting || running;
  if (logoutBtn) logoutBtn.disabled = detecting || running || !installed || !loggedIn;
  if (useBtn) {
    useBtn.classList.toggle('hidden', !loggedIn);
    useBtn.disabled = detecting || running || !loggedIn || !(getCodexProvider()?.models?.length);
  }
  if (cancelBtn) {
    cancelBtn.classList.toggle('hidden', !running);
    cancelBtn.disabled = detecting || codexAuthSessionStatus === 'cancelling';
    cancelBtn.textContent = codexAuthSessionStatus === 'cancelling' ? '正在取消…' : '取消授权';
  }
}

async function startCodexOAuth(mode = 'browser') {
  stopCodexOAuthPolling();
  codexAuthSessionId = '';
  codexAuthMode = mode === 'device' ? 'device' : 'browser';
  codexAuthSessionStatus = 'starting';
  codexAuthOpenedUrl = '';
  if (codexAuthPopup && !codexAuthPopup.closed) {
    try { codexAuthPopup.close(); } catch {}
  }
  try { codexAuthPopup = window.open('about:blank', 'thoughtCanvasCodexOAuth'); } catch { codexAuthPopup = null; }
  const log = $('#codexOAuthLog');
  log.classList.remove('hidden');
  log.textContent = codexAuthMode === 'device' ? '正在请求设备码…' : '正在创建 ChatGPT 授权链接…';
  $('#codexOAuthDetail').textContent = codexAuthMode === 'device'
    ? '稍后会显示一次性验证网址与设备码。'
    : '授权链接将在新窗口打开；完成后模型列表会自动刷新。';
  setCodexOAuthControls({ installed: true, loggedIn: false, running: true });
  try {
    const result = await apiJson('/api/oauth/codex/start', { mode: codexAuthMode });
    codexAuthSessionId = result.sessionId || result.id || '';
    codexAuthMode = result.mode === 'device' ? 'device' : 'browser';
    updateCodexOAuthProgress(result);
    openCodexAuthorizationUrl(result);
    if (!codexAuthSessionId || result.status === 'success') {
      stopCodexOAuthPolling();
      await refreshCodexOAuthStatus();
      return;
    }
    ensureCodexOAuthPolling();
  } catch (error) {
    codexAuthSessionStatus = 'error';
    if (codexAuthPopup && !codexAuthPopup.closed) try { codexAuthPopup.close(); } catch {}
    log.textContent = error.message;
    $('#codexOAuthDetail').textContent = error.message;
    await refreshCodexOAuthStatus();
  }
}

function openCodexAuthorizationUrl(result) {
  const url = codexAuthMode === 'device'
    ? String(result.verificationUrl || result.authUrl || '')
    : String(result.authUrl || result.verificationUrl || '');
  if (!url || url === codexAuthOpenedUrl) return;
  codexAuthOpenedUrl = url;
  try {
    if (codexAuthPopup && !codexAuthPopup.closed) codexAuthPopup.location.href = url;
    else window.open(url, '_blank', 'noopener,noreferrer');
  } catch {}
}

function ensureCodexOAuthPolling() {
  if (!codexAuthSessionId || codexAuthPollTimer) return;
  codexAuthPollTimer = setInterval(pollCodexOAuthSession, 800);
}

async function pollCodexOAuthSession() {
  if (!codexAuthSessionId) return;
  try {
    const result = await apiGet(`/api/oauth/codex/session?id=${encodeURIComponent(codexAuthSessionId)}`);
    updateCodexOAuthProgress(result);
    openCodexAuthorizationUrl(result);
    if (['success', 'error', 'cancelled'].includes(result.status)) {
      stopCodexOAuthPolling();
      if (result.status === 'success') await syncCodexProviderFromStatus({ loggedIn: true, account: result.account, models: result.models || [], detail: 'Codex 授权完成。' });
      await refreshCodexOAuthStatus();
    }
  } catch (error) {
    $('#codexOAuthLog').textContent = error.message;
    codexAuthSessionStatus = 'error';
    stopCodexOAuthPolling();
    await refreshCodexOAuthStatus();
  }
}

function updateCodexOAuthProgress(result) {
  const log = $('#codexOAuthLog');
  const detail = $('#codexOAuthDetail');
  codexAuthMode = result.mode === 'device' ? 'device' : result.mode === 'browser' ? 'browser' : codexAuthMode;
  codexAuthSessionStatus = result.status || codexAuthSessionStatus || 'running';
  const code = String(result.userCode || '');
  const url = String(result.verificationUrl || result.authUrl || '');
  log.classList.remove('hidden');
  log.textContent = result.error || result.message || result.log || (codexAuthMode === 'device' ? '等待设备码授权…' : '等待浏览器授权完成…');

  if (codexAuthSessionStatus === 'cancelling') detail.textContent = '正在取消 Codex 授权会话…';
  else if (codexAuthSessionStatus === 'cancelled') detail.textContent = '授权已取消，Thought Canvas 未保存任何 OAuth Token。';
  else if (codexAuthSessionStatus === 'error') detail.textContent = result.error || '授权未完成。请修复后重新尝试。';
  else if (codexAuthSessionStatus === 'success') detail.textContent = '授权完成，正在同步账号、模型与思考等级…';
  else if (codexAuthMode === 'device' && url) {
    detail.innerHTML = `打开 <a href="${escapeAttr(url)}" target="_blank" rel="noreferrer">设备授权页面</a>${code ? `，输入代码 <strong>${escapeHtml(code)}</strong>` : ''}。完成后状态会自动刷新。`;
  } else if (codexAuthMode === 'browser' && url) {
    detail.innerHTML = `请在新窗口完成 ChatGPT 授权。未自动打开时，可点击 <a href="${escapeAttr(url)}" target="_blank" rel="noreferrer">重新打开授权页</a>。`;
  } else detail.textContent = codexAuthMode === 'device' ? '正在获取设备码…' : '正在获取官方授权链接…';
  setCodexOAuthControls({ installed: true, loggedIn: false, running: ['starting', 'running', 'cancelling'].includes(codexAuthSessionStatus) });
}

function stopCodexOAuthPolling() {
  if (codexAuthPollTimer) clearInterval(codexAuthPollTimer);
  codexAuthPollTimer = null;
}

async function cancelCodexOAuth() {
  if (!codexAuthSessionId) return;
  codexAuthSessionStatus = 'cancelling';
  setCodexOAuthControls({ installed: true, loggedIn: false, running: true });
  try {
    const result = await apiJson('/api/oauth/codex/cancel', { sessionId: codexAuthSessionId });
    updateCodexOAuthProgress(result);
    if (['cancelled', 'error'].includes(result.status)) {
      stopCodexOAuthPolling();
      await refreshCodexOAuthStatus();
    } else ensureCodexOAuthPolling();
  } catch (error) {
    $('#codexOAuthDetail').textContent = error.message;
    await refreshCodexOAuthStatus();
  }
}

async function logoutCodexOAuth() {
  stopCodexOAuthPolling();
  try {
    const result = await apiJson('/api/oauth/codex/logout', {});
    const log = $('#codexOAuthLog');
    log.classList.remove('hidden');
    log.textContent = result.message || '已退出 Codex 登录。';
    await syncCodexProviderFromStatus({ loggedIn: false, detail: '已退出 Codex ChatGPT 登录。', models: [] });
  } catch (error) {
    $('#codexOAuthDetail').textContent = error.message;
  }
  codexAuthSessionId = '';
  codexAuthSessionStatus = '';
  await refreshCodexOAuthStatus();
}

async function useCodexNow() {
  const profile = getCodexProvider();
  if (!profile || profile.connectionStatus !== 'connected' || !profile.models?.length) return;
  state.defaultProvider = profile.id;
  state.defaultModel = profile.models.find(item => item.isDefault)?.id || profile.testModel || profile.models[0].id;
  state.defaultReasoningEffort = ensureReasoningForProvider(profile.id, state.defaultModel, profile.models.find(item => item.id === state.defaultModel)?.defaultReasoningEffort || 'auto');
  const selectedNode = selectedNodes()[0];
  if (selectedNode) setComposerSelection(selectedNode.id, profile.id, state.defaultModel, state.defaultReasoningEffort);
  saveState();
  await persistLocalConfig();
  renderHomeModelSelectors();
  renderGeneralModelSettings();
  render();
  showOperationNotice('Codex 已设为当前模型', `${profile.models.find(item => item.id === state.defaultModel)?.label || state.defaultModel} · ${REASONING_EFFORT_LABELS[state.defaultReasoningEffort] || '自动'}`);
  $('#settingsDialog')?.close();
}

function setGoal(text, source, { render = true } = {}) {
  state.goal = setConfirmedUserGoal(state.goal, text, { id: makeId('goal'), at: now() });
  if (render) saveAndRender();
}

function acceptPendingGoal() {
  if (!state.goal.pending) return;
  state.goal = acceptGoalProposal(state.goal, '', { id: makeId('goal'), at: now() });
  saveAndRender();
}

function editPendingGoal() {
  const text = String(state.goal.pending?.text || '').trim();
  if (!text) return;
  const input = $('#goalInput');
  input.value = text;
  input.focus();
  input.select();
}

function rejectPendingGoal() {
  if (!state.goal.pending) return;
  state.goal = rejectGoalProposal(state.goal, { id: makeId('goal'), at: now() });
  saveAndRender();
}

function openMergeDialog() {
  if (selectedNodes().length < 2) return;
  currentMergePlan = buildMergePlan(state.selectedIds);
  renderMergePlan();
  $('#mergeFocus').value = '';
  $('#mergeDialog').showModal();
}

function buildMergePlan(selectedIds) {
  const selected = unique(selectedIds.map(getNode).filter(Boolean).filter(node => node.status !== 'archived'));
  const selectedSet = new Set(selected.map(node => node.id));
  const selectedMerges = selected.filter(node => ['merge','merge_summary'].includes(node.kind));
  const coveredByMerge = new Map();
  for (const merge of selectedMerges) {
    for (const coveredId of merge.coverageIds || []) coveredByMerge.set(coveredId, merge);
  }

  const included = [];
  const contextOnly = [];
  const skipped = [];
  for (const node of selected) {
    const coveringMerge = coveredByMerge.get(node.id);
    if (coveringMerge && coveringMerge.id !== node.id && new Date(node.updatedAt) <= new Date(coveringMerge.createdAt)) {
      skipped.push({ node, reason: `已被所选汇总节点「${coveringMerge.title}」覆盖` });
      continue;
    }
    const selectedSubstantiveDescendant = descendantsOf(node.id).some(descendant => selectedSet.has(descendant.id) && hasSubstantiveContent(descendant));
    if (!hasSubstantiveContent(node) && selectedSubstantiveDescendant) {
      contextOnly.push({ node, reason: '仅作为后代节点的路径上下文，不重复计入正文' });
      continue;
    }
    included.push({ node, mode: hasSubstantiveContent(node) ? 'full' : 'prompt', checked: true });
  }

  if (!included.length) {
    for (const node of selected) included.push({ node, mode: 'prompt', checked: true });
  }

  let total = included.reduce((sum, item) => sum + mergeContent(item.node, 'full').length, 0);
  if (total > MERGE_CHAR_BUDGET) {
    const compressOrder = [...included].sort((a, b) => depthOf(a.node.id) - depthOf(b.node.id) || new Date(a.node.updatedAt) - new Date(b.node.updatedAt));
    for (const item of compressOrder) {
      if (total <= MERGE_CHAR_BUDGET) break;
      if (item.mode !== 'full') continue;
      const fullLength = mergeContent(item.node, 'full').length;
      const summaryLength = mergeContent(item.node, 'summary').length;
      item.mode = 'summary';
      total -= Math.max(0, fullLength - summaryLength);
    }
  }

  return { selected, included, contextOnly, skipped, totalChars: total };
}

function renderMergePlan() {
  const plan = currentMergePlan;
  if (!plan) return;
  const includedRows = plan.included.map(item => `<label class="merge-row">
    <input type="checkbox" data-merge-id="${item.node.id}" ${item.checked ? 'checked' : ''} />
    <span><strong>${escapeHtml(item.node.title)}</strong><small>${escapeHtml(item.node.question || item.node.summary || '')}</small></span>
    <em>${item.mode === 'full' ? '全文' : item.mode === 'summary' ? '摘要压缩' : '问题与摘要'}</em>
  </label>`).join('');
  const contextRows = plan.contextOnly.map(item => `<div class="merge-row context-only"><span><strong>${escapeHtml(item.node.title)}</strong><small>${escapeHtml(item.reason)}</small></span><em>上下文</em></div>`).join('');
  const skippedRows = plan.skipped.map(item => `<div class="merge-row context-only"><span><strong>${escapeHtml(item.node.title)}</strong><small>${escapeHtml(item.reason)}</small></span><em>去重</em></div>`).join('');
  $('#mergePlan').innerHTML = `
    <section class="merge-section"><h3>进入汇总的内容 <span>${plan.included.length} 个</span></h3>${includedRows}</section>
    ${contextRows ? `<section class="merge-section"><h3>只作为上下文 <span>${plan.contextOnly.length} 个</span></h3>${contextRows}</section>` : ''}
    ${skippedRows ? `<section class="merge-section"><h3>自动去重 <span>${plan.skipped.length} 个</span></h3>${skippedRows}</section>` : ''}
    <div class="merge-warning">如果内容超过上下文预算，系统会把较浅、较旧的节点压缩为问题与节点摘要，但不会静默删除节点。每一项的输入方式已标在右侧。</div>`;
}

function createMergeContextSnapshot(included, focus) {
  const sourceNodes = included.map(item => item.node);
  const acceptedGoal = confirmedGoal(state.goal);
  const branchText = included.map(item => mergeContent(item.node, item.mode)).join('\n\n---\n\n');
  const version = ++state.contextVersionCounter;
  const snapshot = {
    id: makeId('ctx'),
    version,
    createdAt: now(),
    immutable: true,
    purpose: 'merge',
    branchAnchor: null,
    preferences: structuredClone(DEFAULT_CONTEXT_PREFERENCES),
    goal: acceptedGoal,
    constraints: [...state.constraints],
    latestQuestion: focus || `汇总 ${sourceNodes.length} 个所选节点`,
    compactVersion: 0,
    compact: null,
    currentNode: {
      id: 'merge-input',
      title: '所选分支汇总输入',
      question: focus || '',
      sourceText: '',
      sourceMessageId: '',
      sourceStart: -1,
      sourceEnd: -1,
      confirmedSummary: '',
      messages: included.map(item => ({ id: item.node.id, role: 'assistant', content: mergeContent(item.node, item.mode), type: 'merge_source', createdAt: item.node.updatedAt })),
      originalMessageCount: included.length,
      inheritedMessageCount: included.length,
      cutoffMessageId: ''
    },
    ancestors: sourceNodes.map(node => ({
      id: node.id,
      title: node.title,
      question: node.question,
      confirmedSummary: node.confirmedSummary || node.summary || '',
      sourceText: node.sourceText || node.content || '',
      compact: activeCompact(node)?.compact ? structuredClone(activeCompact(node).compact) : null,
      recentMessages: node.messages.slice(-2).map(messageForContext)
    })),
    sourceNodeIds: sourceNodes.map(node => node.id)
  };
  snapshot.metrics = buildContextMetrics([
    { key: 'currentQuestion', label: '汇总焦点', required: true, text: snapshot.latestQuestion },
    { key: 'currentMessages', label: `汇总输入（${included.length} 个节点）`, required: true, text: branchText },
    { key: 'constraints', label: `长期约束（${snapshot.constraints.length} 条）`, included: true, text: snapshot.constraints.join('\n') },
    { key: 'goal', label: acceptedGoal.text ? `已确认目标 v${acceptedGoal.version}` : '已确认目标（无）', included: Boolean(acceptedGoal.text), text: acceptedGoal.text }
  ]);
  state.contextSnapshots.push(structuredClone(snapshot));
  return snapshot;
}

async function confirmMerge() {
  if (!currentMergePlan || busyIds.has('merge')) return;
  if (!requireConnectedProvider(state.mergeProvider, { openSettings: true })) return;
  const checkedIds = new Set($$('[data-merge-id]:checked').map(input => input.dataset.mergeId));
  const included = currentMergePlan.included.filter(item => checkedIds.has(item.node.id));
  if (included.length < 2) {
    showOperationError('无法汇总', '至少保留两个节点才能汇总。');
    return;
  }
  $('#mergeDialog').close();
  const focus = $('#mergeFocus').value.trim();
  const mergeSnapshot = createMergeContextSnapshot(included, focus);
  const sourceNodes = included.map(item => item.node);
  const pendingPosition = mergePosition(sourceNodes);
  pendingMergeVisual = {
    x: pendingPosition.x,
    y: pendingPosition.y,
    title: focus ? deriveTitle(focus) : '所选内容汇总',
    sourceCount: sourceNodes.length,
    kind: 'merge_summary',
    summary: 'AI 正在汇总所选内容…'
  };
  const mergeCall = startModelCall({
    nodeId: 'merge_pending',
    provider: state.mergeProvider,
    model: state.mergeModel,
    reasoningEffort: state.mergeReasoningEffort,
    contextSnapshot: mergeSnapshot,
    purpose: 'merge'
  });
  busyIds.add('merge');
  let mergeSucceeded = false;
  render();
  try {
    const payload = await apiJson('/api/synthesize', {
      mode: 'synthesis',
      goal: confirmedGoal(state.goal).text,
      constraints: state.constraints,
      uiLanguage: state.uiLanguage,
      focus,
      config: modelConfig(state.mergeProvider, state.mergeModel, state.mergeReasoningEffort),
      branches: included.map(item => ({
        id: item.node.id,
        title: item.node.title,
        provider: item.node.provider,
        model: item.node.model,
        path: pathTo(item.node.id).map(node => node.title).join(' / '),
        content: mergeContent(item.node, item.mode),
        inputMode: item.mode
      }))
    });
    const coverage = unique(sourceNodes.flatMap(node => [node.id, ...(node.coverageIds || [])]));
    const position = mergePosition(sourceNodes);
    const answerMessage = makeMessage('assistant', payload.text || '', { provider: state.mergeProvider, model: state.mergeModel, reasoningEffort: state.mergeReasoningEffort, type: 'merge_summary', callId: mergeCall.id });
    const mergeNode = makeNode({
      kind: 'merge_summary',
      origin: 'merge',
      x: position.x,
      y: position.y,
      title: focus ? deriveTitle(focus) : '所选内容汇总',
      question: focus || `汇总 ${sourceNodes.length} 个所选节点`,
      summary: summarizeForCard(payload.text || ''),
      status: 'exploring',
      confidenceStatus: 'partial',
      provider: state.mergeProvider,
      model: state.mergeModel,
      reasoningEffort: state.mergeReasoningEffort,
      messages: [answerMessage],
      goalVersion: mergeSnapshot.goal?.version || 0,
      coverageIds: coverage,
      sourceNodeIds: sourceNodes.map(node => node.id),
      contextSnapshotId: mergeSnapshot.id,
      lastContextSnapshotId: mergeSnapshot.id
    });
    const sourceArtifacts = state.artifacts.filter(artifact => coverage.includes(artifact.nodeId));
    const decisionArtifact = makeDecisionArtifactRecord({
      id: makeId('artifact'),
      title: mergeNode.title,
      content: payload.text || '',
      decision: payload.text || '',
      nodeId: mergeNode.id,
      sourceMessageId: answerMessage.id,
      sourceStart: 0,
      sourceEnd: String(payload.text || '').length,
      sourceText: payload.text || '',
      contextSnapshotId: mergeSnapshot.id,
      workStatus: 'open',
      confidenceStatus: 'partial',
      rationale: sourceNodes.map(node => node.confirmedSummary || node.summary || node.question || node.title).filter(Boolean),
      supportingEvidenceIds: sourceArtifacts.filter(artifact => artifact.kind === 'evidence' && artifact.workStatus !== 'archived').map(artifact => artifact.id),
      rejectedOptionIds: sourceArtifacts.filter(artifact => artifact.kind === 'option' && artifact.workStatus === 'archived').map(artifact => artifact.id),
      unresolvedRisks: sourceArtifacts.filter(artifact => artifact.kind === 'risk' && artifact.workStatus !== 'resolved').map(artifact => artifact.content),
      nextActions: sourceArtifacts.filter(artifact => artifact.kind === 'action' && artifact.workStatus !== 'archived').map(artifact => artifact.content),
      sourceNodeIds: sourceNodes.map(node => node.id),
      goalVersion: mergeSnapshot.goal?.version || 0,
      createdAt: now(),
      updatedAt: now()
    });
    mergeNode.decisionArtifactId = decisionArtifact.id;
    answerMessage.artifactIds = [decisionArtifact.id];
    state.nodes.push(mergeNode);
    state.artifacts.push(decisionArtifact);
    mergeCall.nodeId = mergeNode.id;
    finishModelCall(mergeCall, { success: true, responseMessageId: answerMessage.id });
    for (const source of minimalConnectionSources(sourceNodes)) {
      state.edges.push({ id: makeId('edge'), source: source.id, target: mergeNode.id, relation: 'merged_from' });
    }
    state.selectedIds = [mergeNode.id];
    autoLayoutGraph({ persist: false });
    focusNodesInView([...sourceNodes.map(node => node.id), mergeNode.id], { persist: false, renderNow: false, maxScale: .9 });
    mergeSucceeded = true;
  } catch (error) {
    finishModelCall(mergeCall, { success: false, error: friendlyErrorMessage(error) });
    showOperationError('汇总失败', friendlyErrorMessage(error));
  } finally {
    pendingMergeVisual = null;
    busyIds.delete('merge');
    updateBusyToast();
    if (mergeSucceeded) saveAndRender();
    else {
      saveState();
      render();
    }
  }
}

function mergeContent(node, mode) {
  const question = node.question || node.title;
  if (mode === 'summary' || mode === 'prompt') {
    return `节点：${node.title}\n问题：${question}\n节点摘要：${node.summary || '无'}\n输入方式：${mode === 'summary' ? '因上下文预算压缩为摘要' : '该节点尚无独立回答，仅保留问题和摘要'}`;
  }
  const messages = node.messages.map(message => `${message.role === 'user' ? '用户' : 'AI'}：${message.role === 'assistant' ? normalizeAssistantContent(message.content) : message.content}`).join('\n\n');
  return `节点：${node.title}\n路径：${pathTo(node.id).map(item => item.title).join(' / ')}\n问题：${question}\n${messages || `摘要：${node.summary}`}`;
}

function minimalConnectionSources(nodes) {
  const ids = new Set(nodes.map(node => node.id));
  return nodes.filter(node => !ancestorsOf(node.id).some(ancestor => ids.has(ancestor.id)));
}

function mergePosition(nodes) {
  const maxX = Math.max(...nodes.map(node => node.x));
  const minY = Math.min(...nodes.map(node => node.y));
  const maxY = Math.max(...nodes.map(node => node.y + nodeHeight(node)));
  return { x: maxX + COLUMN_GAP, y: (minY + maxY) / 2 - NODE_MIN_H / 2 };
}

function completeSelectedSubtrees() {
  const topLevel = minimalSelectedRoots(selectedNodes());
  for (const node of topLevel) setSubtreeStatus(node.id, 'resolved');
  for (const node of topLevel) {
    if (node.kind === 'annotation') recomputeAncestors(node.id);
    else recomputeAncestors(node.parentId);
  }
  saveAndRender();
}

function openArchiveDialog() {
  if (!selectedNodes().length) return;
  $('#archiveReason').value = '已完成或暂时不进入主线';
  $('#archiveDialog').showModal();
}

function archiveSelected(reason) {
  const topLevel = minimalSelectedRoots(selectedNodes());
  for (const node of topLevel) archiveSubtree(node.id, reason);
  state.selectedIds = [];
  autoLayoutGraph({ persist: false });
  saveAndRender();
}

function archiveSubtree(nodeId, reason) {
  for (const node of [getNode(nodeId), ...allDescendantsOf(nodeId)].filter(Boolean)) {
    if (node.status !== 'archived') node.preArchiveStatus = node.status;
    node.status = 'archived';
    node.archivedReason = reason;
    node.updatedAt = now();
  }
}

function restoreSubtree(nodeId) {
  const root = getNode(nodeId);
  for (const node of [root, ...allDescendantsOf(nodeId)].filter(Boolean)) {
    if (node.status === 'archived') node.status = node.preArchiveStatus || 'open';
    node.archivedReason = '';
    node.updatedAt = now();
  }
  if (root?.kind === 'annotation') recomputeAncestors(root.id);
  else recomputeAncestors(root?.parentId);
  autoLayoutGraph({ persist: false });
  saveAndRender();
}

function changeNodeStatus(nodeId, status) {
  const node = getNode(nodeId);
  if (!node || node.status === 'archived') return;
  if (status === 'resolved') {
    setSubtreeStatus(nodeId, 'resolved');
    if (node.kind !== 'annotation') recomputeAncestors(node.parentId);
  } else {
    node.status = status;
    node.updatedAt = now();
    if (node.kind !== 'annotation') reopenAncestors(node.parentId);
  }
  saveAndRender();
}

function setSubtreeStatus(nodeId, status) {
  for (const node of [getNode(nodeId), ...descendantsOf(nodeId)].filter(Boolean)) {
    if (node.status !== 'archived') {
      node.status = status;
      node.updatedAt = now();
    }
  }
}

function reopenAncestors(nodeId) {
  let current = getNode(nodeId);
  while (current) {
    if (current.status === 'resolved') current.status = 'exploring';
    if (current.kind === 'annotation') break;
    current = current.parentId ? getNode(current.parentId) : null;
  }
}

function recomputeAncestors(nodeId) {
  let current = getNode(nodeId);
  while (current) {
    const children = directChildren(current.id).filter(child => child.status !== 'archived');
    if (children.length && children.every(child => child.status === 'resolved')) current.status = 'resolved';
    else if (children.some(child => child.status === 'exploring' || child.status === 'resolved')) current.status = 'exploring';
    if (current.kind === 'annotation') break;
    current = current.parentId ? getNode(current.parentId) : null;
  }
}

function cascadeAllParentStatuses() {
  [...state.nodes].sort((a, b) => depthOf(b.id) - depthOf(a.id)).forEach(node => {
    if (node.status !== 'archived') recomputeAncestors(node.parentId);
  });
}

function minimalSelectedRoots(nodes) {
  const ids = new Set(nodes.map(node => node.id));
  return nodes.filter(node => !ancestorsOf(node.id).some(ancestor => ids.has(ancestor.id)));
}

function autoLayoutGraph({ persist = true, preserveExisting = true } = {}) {
  const nodes = baseVisibleNodes();
  if (!nodes.length) return;
  const stablePositions = preserveExisting
    ? new Map(nodes
      .filter(node => node.layoutStable || node.annotationManualPosition)
      .map(node => [node.id, { x: node.x, y: node.y }]))
    : null;
  const manualPositions = new Map(nodes
    .filter(node => node.annotationManualPosition)
    .map(node => [node.id, { x: node.x, y: node.y }]));
  const desiredPositions = computeFullAutoLayout(nodes);
  if (preserveExisting) {
    applyIncrementalLayout(nodes, stablePositions, desiredPositions);
  } else {
    nodes.forEach(node => {
      const position = desiredPositions.get(node.id);
      if (!position || node.status === 'archived') return;
      node.x = position.x;
      node.y = position.y;
      node.layoutStable = true;
    });
    assertFullLayoutInvariants(nodes, manualPositions);
  }
  updateWorldExtent(nodes);
  if (persist) saveAndRender(); else renderCanvasOnly();
}

function isDetachedLayoutRoot(node) {
  return node?.kind === 'annotation' || ['merge', 'merge_summary'].includes(node?.kind);
}

function buildOrdinaryChildrenMap(nodes) {
  const children = new Map(nodes.map(node => [node.id, []]));
  nodes.forEach(node => {
    if (!node.parentId || isDetachedLayoutRoot(node) || !children.has(node.parentId)) return;
    children.get(node.parentId).push(node);
  });
  children.forEach(items => items.sort(stableLayoutComparator));
  return children;
}

function collectOrdinarySubtree(rootId, byId, childrenByParent) {
  const result = [];
  const queue = [rootId];
  const seen = new Set();
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id) || !byId.has(id)) continue;
    seen.add(id);
    result.push(byId.get(id));
    queue.push(...(childrenByParent.get(id) || []).map(node => node.id));
  }
  return result;
}

function addLayoutUnit(layout, unitNodes, positions, occupied, { fixed = false, preferredDy = 0 } = {}) {
  const dy = fixed ? 0 : nearestVerticalTranslation({
    positions: layout.positions,
    nodes: unitNodes,
    occupied,
    preferredDy,
    minY: 20,
    gap: NODE_GAP,
    getHeight: nodeHeight
  });
  const translated = translatePositions(layout.positions, 0, dy);
  unitNodes.forEach(node => {
    const position = translated.get(node.id);
    if (!position) return;
    positions.set(node.id, position);
    occupied.push({ node, x: position.x, y: position.y });
  });
  return translated;
}

function computeFullAutoLayout(nodes) {
  const active = nodes.filter(node => node.status !== 'archived');
  const byId = new Map(active.map(node => [node.id, node]));
  const childrenByParent = buildOrdinaryChildrenMap(active);
  const positions = new Map();
  const occupied = [];
  const placedIds = new Set();
  const placeTree = (root, rootX, rootCenterY, options = {}) => {
    const unitNodes = collectOrdinarySubtree(root.id, byId, childrenByParent).filter(node => !placedIds.has(node.id));
    if (!unitNodes.length) return null;
    const layout = layoutTree(unitNodes, { rootId: root.id, rootX, rootCenterY, getHeight: nodeHeight });
    const translated = addLayoutUnit(layout, unitNodes, positions, occupied, options);
    unitNodes.forEach(node => placedIds.add(node.id));
    return { unitNodes, positions: translated };
  };

  // Manual annotations are immutable obstacles. Their descendants are laid
  // out from the annotation's actual x, while all automatic units avoid the
  // complete fixed subtree using vertical translation only.
  const annotations = active.filter(node => node.kind === 'annotation').sort(stableLayoutComparator);
  annotations.filter(node => node.annotationManualPosition).forEach(annotation => {
    placeTree(annotation, Number(annotation.x), Number(annotation.y) + nodeHeight(annotation) / 2, { fixed: true });
  });

  const mainRoot = byId.get('root') || active.find(node => !node.parentId && !isDetachedLayoutRoot(node));
  if (mainRoot && !placedIds.has(mainRoot.id)) {
    const centerY = Number.isFinite(Number(mainRoot.y)) ? Number(mainRoot.y) + nodeHeight(mainRoot) / 2 : 350;
    placeTree(mainRoot, 180, centerY);
  }

  active
    .filter(node => !isDetachedLayoutRoot(node) && !placedIds.has(node.id) && (!node.parentId || !byId.has(node.parentId)))
    .sort(stableLayoutComparator)
    .forEach(orphan => {
      const bottom = occupied.length ? Math.max(...occupied.map(item => item.y + nodeHeight(item.node))) : 20;
      placeTree(orphan, 180, bottom + GROUP_GAP + nodeHeight(orphan) / 2);
    });

  const annotationStacks = new Map();
  annotations.filter(node => !node.annotationManualPosition).forEach(annotation => {
    const source = byId.get(annotation.annotationSourceNodeId || annotation.parentId);
    const sourcePosition = source ? positions.get(source.id) : null;
    if (!source || !sourcePosition) return;
    const stack = annotationStacks.get(source.id) || 0;
    const preferredX = sourcePosition.x + NODE_W + 82;
    const preferredY = sourcePosition.y + stack * (nodeHeight(annotation) + 34);
    placeTree(annotation, preferredX, preferredY + nodeHeight(annotation) / 2);
    annotationStacks.set(source.id, stack + 1);
  });

  active.filter(node => ['merge', 'merge_summary'].includes(node.kind)).sort(stableLayoutComparator).forEach(merge => {
    const sources = state.edges
      .filter(edge => ['merge', 'merged_from'].includes(edge.relation) && edge.target === merge.id)
      .map(edge => byId.get(edge.source))
      .filter(Boolean);
    const sourcePositions = sources.map(source => ({ source, position: positions.get(source.id) })).filter(item => item.position);
    const rootX = sourcePositions.length
      ? Math.max(...sourcePositions.map(item => item.position.x)) + COLUMN_GAP
      : Number.isFinite(Number(merge.x)) ? Number(merge.x) : 610;
    const centerY = sourcePositions.length
      ? sourcePositions.reduce((sum, item) => sum + item.position.y + nodeHeight(item.source) / 2, 0) / sourcePositions.length
      : Number(merge.y || 280) + nodeHeight(merge) / 2;
    placeTree(merge, rootX, centerY);
  });

  // Malformed imports can contain unreachable components. Keep the fallback
  // deterministic and column-based rather than preserving stale collisions.
  active.filter(node => !placedIds.has(node.id)).sort(stableLayoutComparator).forEach(node => {
    if (placedIds.has(node.id)) return;
    const bottom = occupied.length ? Math.max(...occupied.map(item => item.y + nodeHeight(item.node))) : 20;
    placeTree(node, isDetachedLayoutRoot(node) ? Number(node.x || 180) : 180, bottom + GROUP_GAP + nodeHeight(node) / 2);
  });
  return positions;
}

function applyIncrementalLayout(nodes, stablePositions, desiredPositions) {
  const active = nodes.filter(node => node.status !== 'archived');
  const byId = new Map(active.map(node => [node.id, node]));
  const stableIds = new Set(stablePositions ? stablePositions.keys() : []);
  stableIds.forEach(id => {
    const node = byId.get(id);
    const position = stablePositions.get(id);
    if (!node || !position) return;
    node.x = position.x;
    node.y = position.y;
  });
  const pendingIds = new Set(active.filter(node => !stableIds.has(node.id)).map(node => node.id));
  const occupied = active
    .filter(node => stableIds.has(node.id))
    .map(node => ({ node, x: node.x, y: node.y }));
  const pendingChildren = new Map(active.map(node => [node.id, []]));
  active.forEach(node => {
    if (!pendingIds.has(node.id) || !pendingIds.has(node.parentId) || isDetachedLayoutRoot(node)) return;
    pendingChildren.get(node.parentId).push(node);
  });
  pendingChildren.forEach(items => items.sort(stableLayoutComparator));
  const topRoots = active.filter(node => pendingIds.has(node.id) && (!node.parentId || !pendingIds.has(node.parentId) || isDetachedLayoutRoot(node)));
  const groups = new Map();
  topRoots.forEach(root => {
    const sharedGroup = root.parentId && root.groupId && !isDetachedLayoutRoot(root);
    const key = sharedGroup ? `${root.parentId}:${root.groupId}` : root.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(root);
  });
  const collectPending = rootIds => {
    const result = [];
    const queue = [...rootIds];
    const seen = new Set();
    while (queue.length) {
      const id = queue.shift();
      if (seen.has(id) || !pendingIds.has(id) || !byId.has(id)) continue;
      seen.add(id);
      result.push(byId.get(id));
      queue.push(...(pendingChildren.get(id) || []).map(node => node.id));
    }
    return result;
  };
  const orderedGroups = [...groups.values()]
    .map(roots => roots.sort(stableLayoutComparator))
    .sort((a, b) => depthOf(a[0].id) - depthOf(b[0].id) || stableLayoutComparator(a[0], b[0]));

  orderedGroups.forEach(roots => {
    const unitNodes = collectPending(roots.map(root => root.id));
    if (!unitNodes.length) return;
    const parent = roots[0].parentId ? byId.get(roots[0].parentId) : null;
    let layout;
    if (parent && roots.every(root => root.parentId === parent.id) && roots.every(root => !isDetachedLayoutRoot(root))) {
      layout = layoutChildGroup(parent, unitNodes, {
        rootIds: roots.map(root => root.id),
        parentX: parent.x,
        parentCenterY: parent.y + nodeHeight(parent) / 2,
        getHeight: nodeHeight
      });
    } else {
      const root = roots[0];
      const preferred = desiredPositions.get(root.id) || { x: Number(root.x || 180), y: Number(root.y || 280) };
      layout = layoutTree(unitNodes, {
        rootId: root.id,
        rootX: preferred.x,
        rootCenterY: preferred.y + nodeHeight(root) / 2,
        getHeight: nodeHeight
      });
    }
    const dy = nearestVerticalTranslation({
      positions: layout.positions,
      nodes: unitNodes,
      occupied,
      preferredDy: 0,
      minY: 20,
      gap: NODE_GAP,
      getHeight: nodeHeight
    });
    const translated = translatePositions(layout.positions, 0, dy);
    unitNodes.forEach(node => {
      const position = translated.get(node.id);
      node.x = position.x;
      node.y = position.y;
      node.layoutStable = true;
      pendingIds.delete(node.id);
      occupied.push({ node, x: node.x, y: node.y });
    });
  });

  active.filter(node => pendingIds.has(node.id)).sort(stableLayoutComparator).forEach(node => {
    const parent = node.parentId ? byId.get(node.parentId) : null;
    const preferred = desiredPositions.get(node.id) || { x: Number(node.x || 180), y: Number(node.y || 280) };
    const position = findIncrementalNodePosition(node, parent, preferred, occupied);
    node.x = position.x;
    node.y = position.y;
    node.layoutStable = true;
    occupied.push({ node, x: node.x, y: node.y });
  });
}

function findIncrementalNodePosition(node, parent, preferred, occupied) {
  const x = parent ? parent.x + COLUMN_GAP : Number(preferred.x || 180);
  const y = parent
    ? parent.y + nodeHeight(parent) / 2 - nodeHeight(node) / 2
    : Number(preferred.y || 280);
  const positions = new Map([[node.id, { x, y, centerY: y + nodeHeight(node) / 2, depth: parent ? 1 : 0 }]]);
  const dy = nearestVerticalTranslation({
    positions,
    nodes: [node],
    occupied,
    preferredDy: 0,
    minY: 20,
    gap: NODE_GAP,
    getHeight: nodeHeight
  });
  return { x, y: y + dy };
}

function assertFullLayoutInvariants(nodes, manualPositions) {
  const active = nodes.filter(node => node.status !== 'archived');
  const positions = new Map(active.map(node => [node.id, { x: node.x, y: node.y }]));
  const errors = validateLayoutInvariants(active, positions, {
    getHeight: nodeHeight,
    manualPositions
  });
  if (!errors.length) return;
  console.error('Auto-layout invariant failure', errors);
  if (globalThis.__THOUGHT_CANVAS_LAYOUT_STRICT__ || globalThis.__apiState) {
    throw new Error(`自动排布违反布局不变量：${errors.join(', ')}`);
  }
}

function updateWorldExtent(nodes) {
  const active = nodes.filter(node => node.status !== 'archived');
  const positions = new Map(active.map(node => [node.id, { x: node.x, y: node.y }]));
  const bounds = computeBounds(active, positions, { getHeight: nodeHeight });
  world.style.width = `${Math.max(12000, Math.ceil(bounds.maxX + 800))}px`;
  world.style.height = `${Math.max(12000, Math.ceil(bounds.maxY + 800))}px`;
}

function graphHasOverlaps() {
  const nodes = baseVisibleNodes();
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      if (a.x < b.x + NODE_W && a.x + NODE_W > b.x && a.y < b.y + nodeHeight(b) && a.y + nodeHeight(a) > b.y) return true;
    }
  }
  return false;
}

function parallelGroupId(parentId, content) {
  const normalized = String(content || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 240);
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) hash = Math.imul(hash ^ normalized.charCodeAt(i), 16777619);
  return `parallel:${parentId}:${(hash >>> 0).toString(36)}`;
}

function fitView() {
  const nodes = visibleNodes();
  if (!nodes.length) return;
  const minX = Math.min(...nodes.map(node => node.x));
  const minY = Math.min(...nodes.map(node => node.y));
  const maxX = Math.max(...nodes.map(node => node.x + NODE_W));
  const maxY = Math.max(...nodes.map(node => node.y + nodeHeight(node)));
  const padding = 110;
  const scale = clamp(Math.min((viewport.clientWidth - padding * 2) / Math.max(1, maxX - minX), (viewport.clientHeight - padding * 2) / Math.max(1, maxY - minY)), .45, 1.25);
  state.camera.scale = scale;
  state.camera.x = (viewport.clientWidth - (maxX - minX) * scale) / 2 - minX * scale;
  state.camera.y = (viewport.clientHeight - (maxY - minY) * scale) / 2 - minY * scale;
  applyCamera();
  $('#zoomValue').textContent = `${Math.round(scale * 100)}%`;
  renderMiniMap();
  saveState();
}

function zoomAt(x, y, factor, { persist = true } = {}) {
  const oldScale = state.camera.scale;
  const newScale = clamp(oldScale * factor, .48, 1.65);
  if (newScale === oldScale) return;
  const worldX = (x - state.camera.x) / oldScale;
  const worldY = (y - state.camera.y) / oldScale;
  state.camera.scale = newScale;
  state.camera.x = x - worldX * newScale;
  state.camera.y = y - worldY * newScale;
  applyCamera();
  $('#zoomValue').textContent = `${Math.round(newScale * 100)}%`;
  if (persist) saveState();
}

function updateSelectionRect() {
  if (!boxSelection) return;
  const left = Math.min(boxSelection.startX, boxSelection.endX);
  const top = Math.min(boxSelection.startY, boxSelection.endY);
  const width = Math.abs(boxSelection.endX - boxSelection.startX);
  const height = Math.abs(boxSelection.endY - boxSelection.startY);
  Object.assign(selectionRect.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
  selectionRect.classList.remove('hidden');
}

function finalizeSelection() {
  if (!boxSelection) return;
  const left = Math.min(boxSelection.startX, boxSelection.endX);
  const right = Math.max(boxSelection.startX, boxSelection.endX);
  const top = Math.min(boxSelection.startY, boxSelection.endY);
  const bottom = Math.max(boxSelection.startY, boxSelection.endY);
  const worldLeft = (left - state.camera.x) / state.camera.scale;
  const worldRight = (right - state.camera.x) / state.camera.scale;
  const worldTop = (top - state.camera.y) / state.camera.scale;
  const worldBottom = (bottom - state.camera.y) / state.camera.scale;
  const ids = visibleNodes().filter(node => node.x < worldRight && node.x + NODE_W > worldLeft && node.y < worldBottom && node.y + nodeHeight(node) > worldTop).map(node => node.id);
  state.selectedIds = boxSelection.additive ? unique([...state.selectedIds, ...ids]) : ids;
}

function renderSelectionActions() {
  const count = state.selectedIds.length;
  if (count < 2) {
    selectionActions.classList.add('hidden');
    return;
  }
  $('#selectionLabel').textContent = `已选择 ${count} 个节点`;
  $('#compareSelectedBtn')?.classList.toggle('hidden', count !== 2);
  selectionActions.classList.remove('hidden');
}

function updateBusyToast() {
  // 生成状态只在对应节点和连接线上展示，避免画布顶部出现重复且突兀的全局提示。
  busyToast?.classList.add('hidden');
}

function openExportDialog() {
  if (!currentProjectId) return showOperationError('无法导出', '请先打开一个项目。');
  const visibleNodeCount = state.nodes.filter(node => node.status !== 'archived' || state.showArchived).length;
  $('#exportSummary').textContent = `${state.nodes.length} 个节点 · ${state.artifacts.length} 个推理对象 · 当前可见 ${visibleNodeCount} 个`;
  $('#exportDialog').showModal();
}

function exportBaseName() {
  const base = String(state.projectTitle || 'thought-canvas')
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
  return base || 'thought-canvas';
}

function stripSecretFields(value) {
  if (Array.isArray(value)) return value.map(stripSecretFields);
  if (!value || typeof value !== 'object') return value;
  const blocked = /^(?:api[_-]?key|secret|client[_-]?secret|access[_-]?token|refresh[_-]?token|session[_-]?token|password|authorization|cookie)$/i;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !blocked.test(key))
    .map(([key, item]) => [key, stripSecretFields(item)]));
}

function downloadExportFile(filename, mimeType, text) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  globalThis.__lastExportForTest = { filename, mimeType, text };
}

function nodeExportText(node) {
  const lines = [
    `# ${node.title || '未命名节点'}`,
    node.kind === 'annotation' ? `\n**标注类型**：${ANNOTATION_TYPE_LABELS[node.annotationType] || '标注'}` : '',
    node.kind === 'annotation' && (node.annotationSourceNodeId || node.parentId) ? `\n**标注来源节点**：${node.annotationSourceNodeId || node.parentId}` : '',
    `\n**折叠状态**：${node.collapsed ? '已折叠' : '展开'}`,
    node.question ? `\n**问题**\n\n${node.question}` : '',
    node.content ? `\n**内容**\n\n${node.content}` : '',
    node.sourceText ? `\n**来源原文**\n\n${node.sourceText}` : ''
  ];
  for (const message of node.messages || []) {
    const role = message.role === 'user' ? '用户' : 'AI';
    const stateLabel = message.partial ? '（部分回答）' : message.error ? '（错误）' : '';
    lines.push(`\n## ${role}${stateLabel}\n\n${message.content || ''}`);
  }
  return lines.filter(Boolean).join('\n').trim();
}

function buildJsonCanvasExport() {
  const nodes = [];
  const edges = [];
  const thoughtIds = new Set(state.nodes.map(node => node.id));
  for (const node of state.nodes) {
    nodes.push({
      id: node.id,
      type: 'text',
      x: Math.round(Number(node.x || 0)),
      y: Math.round(Number(node.y || 0)),
      width: 360,
      height: Math.max(220, Math.min(720, 190 + (node.messages || []).length * 72)),
      text: nodeExportText(node),
      ...(node.kind === 'annotation' && ANNOTATION_COLOR_STYLES[node.annotationColor]?.swatch
        ? { color: ANNOTATION_COLOR_STYLES[node.annotationColor].swatch }
        : {})
    });
  }
  for (const edge of state.edges || []) {
    if (!thoughtIds.has(edge.source) || !thoughtIds.has(edge.target)) continue;
    edges.push({
      id: edge.id || makeId('canvas_edge'),
      fromNode: edge.source,
      fromSide: 'right',
      toNode: edge.target,
      toSide: 'left',
      label: ({ answer_to: '回答', decomposed_from: '拆解自', merged_from: '汇总为', merge: '汇总为', annotation: '标注' })[edge.relation] || edge.relation || '关联'
    });
  }
  const artifactIndexByNode = new Map();
  for (const artifact of state.artifacts || []) {
    const sourceNode = getNode(artifact.nodeId) || { x: 0, y: 0 };
    const index = artifactIndexByNode.get(artifact.nodeId) || 0;
    artifactIndexByNode.set(artifact.nodeId, index + 1);
    const artifactNodeId = `artifact_${artifact.id}`;
    nodes.push({
      id: artifactNodeId,
      type: 'text',
      x: Math.round(Number(sourceNode.x || 0) + 390 + (index % 2) * 330),
      y: Math.round(Number(sourceNode.y || 0) + Math.floor(index / 2) * 190),
      width: 300,
      height: 160,
      text: `# ${ARTIFACT_KIND_LABELS[artifact.kind] || artifact.kind}\n\n${artifact.title || ''}\n\n${artifact.content || ''}\n\n状态：${artifact.workStatus || 'open'} · 可信度：${CONFIDENCE_STATUS_LABELS[artifact.confidenceStatus] || artifact.confidenceStatus || '未验证'}`
    });
    if (thoughtIds.has(artifact.nodeId)) {
      edges.push({
        id: `source_${artifact.id}`,
        fromNode: artifact.nodeId,
        fromSide: 'right',
        toNode: artifactNodeId,
        toSide: 'left',
        label: '提炼自'
      });
    }
  }
  const artifactIds = new Set((state.artifacts || []).map(artifact => artifact.id));
  for (const relation of state.reasoningEdges || []) {
    if (!artifactIds.has(relation.sourceArtifactId) || !artifactIds.has(relation.targetArtifactId)) continue;
    edges.push({
      id: relation.id || makeId('reasoning_edge'),
      fromNode: `artifact_${relation.sourceArtifactId}`,
      fromSide: 'right',
      toNode: `artifact_${relation.targetArtifactId}`,
      toSide: 'left',
      label: REASONING_RELATION_LABELS[relation.relation] || relation.relation || '关联'
    });
  }
  return { nodes, edges };
}

function oneLine(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function buildMarkdownExport() {
  const lines = [
    `# ${state.projectTitle || 'Thought Canvas 项目'}`,
    '',
    `> 导出时间：${new Date().toLocaleString(localeForIntl(state.uiLanguage))} · Thought Canvas v${APP_VERSION}`,
    '',
    '## 最终目标',
    '',
    confirmedGoal(state.goal).text || '尚未确认最终目标。'
  ];
  if (state.constraints?.length) {
    lines.push('', '## 约束', '', ...state.constraints.map(item => `- ${item}`));
  }
  const decisions = (state.artifacts || []).filter(artifact => artifact.kind === 'decision');
  if (decisions.length) {
    lines.push('', '## 决策与收敛结果');
    for (const artifact of decisions) {
      const decision = artifact.decisionData || {};
      lines.push('', `### ${artifact.title || '决策'}`, '', artifact.content || decision.decision || '');
      if (decision.rationale?.length) lines.push('', '**依据**', '', ...decision.rationale.map(item => `- ${item}`));
      if (decision.unresolvedRisks?.length) lines.push('', '**未解决风险**', '', ...decision.unresolvedRisks.map(item => `- ${item}`));
      if (decision.nextActions?.length) lines.push('', '**下一步行动**', '', ...decision.nextActions.map(item => `- ${item}`));
    }
  }
  if (state.artifacts?.length) {
    lines.push('', '## 推理对象');
    for (const artifact of state.artifacts) {
      lines.push(
        '',
        `### ${ARTIFACT_KIND_LABELS[artifact.kind] || artifact.kind}：${artifact.title || oneLine(artifact.content).slice(0, 60)}`,
        '',
        artifact.content || '',
        '',
        `- 工作状态：${artifact.workStatus || 'open'}`,
        `- 可信状态：${CONFIDENCE_STATUS_LABELS[artifact.confidenceStatus] || artifact.confidenceStatus || '未验证'}`,
        `- 来源：节点 ${artifact.nodeId || '未知'} / 消息 ${artifact.sourceMessageId || '无'} / 字符 ${Number.isFinite(artifact.sourceStart) ? artifact.sourceStart : '-'}–${Number.isFinite(artifact.sourceEnd) ? artifact.sourceEnd : '-'}`
      );
      if (artifact.sourceText) lines.push('', `> ${String(artifact.sourceText).replace(/\n/g, '\n> ')}`);
    }
  }
  if (state.reasoningEdges?.length) {
    const byId = new Map(state.artifacts.map(artifact => [artifact.id, artifact]));
    lines.push('', '## 推理关系', '');
    for (const relation of state.reasoningEdges) {
      const source = byId.get(relation.sourceArtifactId);
      const target = byId.get(relation.targetArtifactId);
      lines.push(`- ${source?.title || relation.sourceArtifactId} —${REASONING_RELATION_LABELS[relation.relation] || relation.relation}→ ${target?.title || relation.targetArtifactId}`);
    }
  }
  lines.push('', '## 画布节点');
  const orderedNodes = [...state.nodes].sort((a, b) => Number(a.x || 0) - Number(b.x || 0) || Number(a.y || 0) - Number(b.y || 0));
  for (const node of orderedNodes) {
    lines.push('', `### ${node.title || '未命名节点'}`, '', `- 节点 ID：${node.id}`, `- 类型：${node.kind === 'annotation' ? `${node.kind} / ${ANNOTATION_TYPE_LABELS[node.annotationType] || '标注'}` : node.kind}`, `- 工作状态：${node.status}`, `- 可信状态：${CONFIDENCE_STATUS_LABELS[node.confidenceStatus] || node.confidenceStatus || '未验证'}`, `- 折叠状态：${node.collapsed ? '已折叠' : '展开'}`);
    if (node.kind === 'annotation' && (node.annotationSourceNodeId || node.parentId)) lines.push(`- 标注来源节点：${node.annotationSourceNodeId || node.parentId}`);
    if (node.question) lines.push('', `**问题**：${node.question}`);
    if (node.sourceText) lines.push('', '**来源原文**', '', node.sourceText);
    for (const message of node.messages || []) {
      lines.push('', `#### ${message.role === 'user' ? '用户' : 'AI'}${message.partial ? '（部分回答）' : ''}`, '', message.content || '');
    }
  }
  return `${lines.join('\n').replace(/\n{4,}/g, '\n\n\n').trim()}\n`;
}

function exportState(format = 'native') {
  if (!currentProjectId) return showOperationError('无法导出', '请先打开一个项目。');
  const date = new Date().toISOString().slice(0, 10);
  const base = `${exportBaseName()}-${date}`;
  let filename;
  let mimeType;
  let text;
  if (format === 'canvas') {
    filename = `${base}.canvas`;
    mimeType = 'application/json';
    text = JSON.stringify(buildJsonCanvasExport(), null, 2);
  } else if (format === 'markdown') {
    filename = `${base}.md`;
    mimeType = 'text/markdown;charset=utf-8';
    text = buildMarkdownExport();
  } else {
    filename = `${base}.json`;
    mimeType = 'application/json';
    text = JSON.stringify({ ...stripSecretFields(structuredClone(state)), exportedAt: now(), exportFormat: 'thought-canvas-v12' }, null, 2);
  }
  downloadExportFile(filename, mimeType, text);
  $('#exportDialog')?.close();
  showOperationNotice('导出已创建', `${filename} 已交给浏览器保存。`);
}

function formatBackupSize(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10240 ? 1 : 0)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatBackupDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间未知';
  return date.toLocaleString(localeForIntl(state.uiLanguage), { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

async function openBackupDialog() {
  if (!currentProjectId) return showOperationError('无法查看版本', '请先打开一个项目。');
  $('#backupSummary').textContent = '正在读取本地备份…';
  $('#backupList').innerHTML = '<div class="backup-empty">正在读取版本记录…</div>';
  $('#backupDialog').showModal();
  await flushProjectSave();
  await loadProjectBackups();
}

async function loadProjectBackups() {
  if (!currentProjectId || !$('#backupDialog')?.open) return;
  const button = $('#refreshBackupsBtn');
  if (button) button.disabled = true;
  try {
    const payload = await apiGet(`/api/projects/${encodeURIComponent(currentProjectId)}/backups`);
    const backups = Array.isArray(payload.backups) ? payload.backups : [];
    $('#backupSummary').textContent = backups.length ? `保留最近 ${backups.length} 个本地版本` : '当前还没有可恢复的旧版本';
    $('#backupList').innerHTML = backups.length ? backups.map((backup, index) => `
      <article class="backup-item">
        <div class="backup-item-copy">
          <strong>${escapeHtml(backup.project?.title || state.projectTitle || '未命名项目')}</strong>
          <span><time>${escapeHtml(formatBackupDate(backup.createdAt))}</time><b>${Number(backup.project?.nodeCount || 0)} 个节点</b><b>${escapeHtml(formatBackupSize(backup.size))}</b></span>
          <em>${index === 0 ? '最近一次覆盖保存前' : `更早版本 ${index + 1}`} · 项目当时更新时间 ${escapeHtml(formatBackupDate(backup.projectUpdatedAt))}</em>
        </div>
        <button type="button" class="backup-restore-button" data-restore-backup="${escapeAttr(backup.id)}">恢复此版本</button>
      </article>`).join('') : '<div class="backup-empty">继续编辑并保存项目后，这里会出现覆盖保存前的版本。<br>项目正文、节点位置和推理关系都会一起恢复。</div>';
    $$('[data-restore-backup]').forEach(restoreButton => restoreButton.addEventListener('click', () => restoreProjectBackup(restoreButton.dataset.restoreBackup)));
  } catch (error) {
    $('#backupSummary').textContent = '读取失败';
    $('#backupList').innerHTML = `<div class="backup-empty">${escapeHtml(friendlyErrorMessage(error))}</div>`;
  } finally {
    if (button) button.disabled = false;
  }
}

async function restoreProjectBackup(backupId) {
  if (!currentProjectId || !backupId) return;
  const confirmed = await requestConfirmation({
    eyebrow: '恢复本地版本',
    title: '用所选版本替换当前画布？',
    message: '恢复前会先自动备份当前版本，因此之后仍可再次找回。',
    confirmLabel: '恢复此版本'
  });
  if (!confirmed) return;
  const buttons = $$('[data-restore-backup]');
  buttons.forEach(button => { button.disabled = true; });
  try {
    await flushProjectSave();
    const payload = await apiJson(`/api/projects/${encodeURIComponent(currentProjectId)}/restore`, { backupId });
    state = { ...structuredClone(initialState), ...loadGlobalSettings(), ...projectFromApiPayload(payload), projectId: currentProjectId };
    normalizeState();
    lastProjectSavedAt = state.projectUpdatedAt || now();
    projectSaveStatus = 'saved';
    projectSaveError = '';
    updateProjectIndexEntry();
    applySidebarWidth();
    $('#backupDialog').close();
    render();
    requestAnimationFrame(fitView);
    showOperationNotice('版本已恢复', '恢复前的当前版本也已自动加入版本记录。');
  } catch (error) {
    showOperationError('恢复失败', friendlyErrorMessage(error));
    buttons.forEach(button => { button.disabled = false; });
  }
}

async function importState(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const repairedImport = repairUtf8MojibakeDeep(parsed);
    pendingEncodingRepairCount += repairedImport.repairs;
    const imported = withEncodingRepairMetadata(repairedImport.value, repairedImport.repairs);
    const id = makeId('project');
    currentProjectId = id;
    state = { ...createBlankProjectState({ id, title: imported.projectTitle || file.name.replace(/\.json$/i, '') }), ...imported, projectId: id, projectCreatedAt: now(), projectUpdatedAt: now() };
    normalizeState();
    applySidebarWidth();
    saveAndRender();
  } catch (error) {
    showOperationError('导入失败', error.message);
  } finally {
    event.target.value = '';
  }
}

function modelConfig(providerId, model, reasoningEffort = 'auto') {
  const profile = getProvider(providerId) || getProvider('deepseek') || state.providers?.[0];
  const selectedModel = model || ensureModelForProvider(profile.id, '');
  return modelConfigFromDraft(profile, selectedModel, ensureReasoningForProvider(profile.id, selectedModel, reasoningEffort));
}

function providerIsReady(profile) {
  if (!profile || profile.enabled === false || !(profile.models || []).some(model => String(model?.id || '').trim())) return false;
  if (profile.protocol === 'mock') return true;
  return profile.connectionStatus === 'connected';
}

function selectableProviders() {
  return (state.providers || []).filter(providerIsReady);
}

function normalizeProviderSelections() {
  const ready = selectableProviders();
  const fallback = ready.find(profile => profile.id === state.defaultProvider) || ready[0] || null;
  if (fallback && !providerIsReady(getProvider(state.defaultProvider))) state.defaultProvider = fallback.id;
  const defaultProfile = getProvider(state.defaultProvider) || fallback || state.providers?.[0];
  if (defaultProfile) {
    state.defaultModel = ensureModelForProvider(defaultProfile.id, state.defaultModel);
    state.defaultReasoningEffort = ensureReasoningForProvider(defaultProfile.id, state.defaultModel, state.defaultReasoningEffort || 'auto');
  }

  if (fallback && !providerIsReady(getProvider(state.mergeProvider))) state.mergeProvider = fallback.id;
  const mergeProfile = getProvider(state.mergeProvider) || defaultProfile;
  if (mergeProfile) {
    state.mergeModel = ensureModelForProvider(mergeProfile.id, state.mergeModel);
    state.mergeReasoningEffort = ensureReasoningForProvider(mergeProfile.id, state.mergeModel, state.mergeReasoningEffort || 'auto');
  }

  for (const [nodeId, selection] of Object.entries(state.composerByNode || {})) {
    let providerId = selection?.provider;
    if (fallback && !providerIsReady(getProvider(providerId))) providerId = fallback.id;
    const profile = getProvider(providerId) || defaultProfile;
    if (!profile) {
      delete state.composerByNode[nodeId];
      continue;
    }
    const modelId = ensureModelForProvider(profile.id, selection?.model || '');
    state.composerByNode[nodeId] = {
      provider: profile.id,
      model: modelId,
      reasoningEffort: ensureReasoningForProvider(profile.id, modelId, selection?.reasoningEffort || 'auto')
    };
  }
  return ready;
}

function requireConnectedProvider(providerId, { openSettings = false } = {}) {
  const profile = getProvider(providerId);
  if (providerIsReady(profile)) return true;
  showOperationError('模型尚未连接', `${profile?.name || '当前供应商'} 还没有完成连接验证。请在设置中使用 API Key 连接并同步模型，或通过 ChatGPT OAuth 连接 Codex。`, { once: true });
  if (openSettings) setTimeout(openProviderConnectionSettings, 0);
  return false;
}

function openProviderConnectionSettings() {
  if ($('#newProjectDialog')?.open) $('#newProjectDialog').close();
  if (!$('#settingsDialog')?.open) openSettings();
  switchSettingsTab('providers');
  const current = getProvider(state.defaultProvider);
  if (current) state.activeProviderEditorId = current.id;
  renderProviderManager();
}

function providerOptions(selected) {
  const ready = selectableProviders();
  const selectedProfile = getProvider(selected);
  const options = [];
  if (selectedProfile && !providerIsReady(selectedProfile)) {
    options.push(`<option value="${escapeAttr(selectedProfile.id)}" selected disabled>${escapeHtml(selectedProfile.name)}（未连接）</option>`);
  }
  for (const profile of ready) {
    options.push(`<option value="${escapeAttr(profile.id)}" ${selected === profile.id ? 'selected' : ''}>${escapeHtml(profile.name)}</option>`);
  }
  if (!options.length) options.push('<option value="" selected disabled>请先连接模型供应商</option>');
  return options.join('');
}

function modelOptions(providerId, selected) {
  const profile = getProvider(providerId);
  const models = profile?.models || [];
  return models.map(model => `<option value="${escapeAttr(model.id)}" ${selected === model.id ? 'selected' : ''}>${escapeHtml(model.label || model.id)}</option>`).join('');
}

function reasoningOptions(providerId, modelId, selected = 'auto') {
  const profile = getProvider(providerId) || {};
  const normalized = ensureReasoningForProvider(providerId, modelId, selected);
  return reasoningOptionsForModel(profile, modelId)
    .map(item => `<option value="${escapeAttr(item.value)}" ${item.value === normalized ? 'selected' : ''}>${escapeHtml(item.label)}</option>`)
    .join('');
}

function providerLabel(providerId) {
  return getProvider(providerId)?.name || providerId || '未选择模型';
}

function protocolLabel(protocol) {
  return PROTOCOL_OPTIONS.find(item => item.id === protocol)?.label || protocol || '未知协议';
}

function getProvider(id) {
  return state.providers?.find(profile => profile.id === id);
}

function ensureModelForProvider(providerId, modelId) {
  const models = getProvider(providerId)?.models || [];
  if (models.some(model => model.id === modelId)) return modelId;
  return models.find(model => model.isDefault)?.id || models[0]?.id || '';
}

function ensureReasoningForProvider(providerId, modelId, effort = 'auto') {
  const profile = getProvider(providerId);
  return profile ? resolveReasoningEffort(profile, modelId, effort) : 'auto';
}

function normalizeProviderProfiles(existing) {
  const presets = clonePresetProfiles();
  const cleanExisting = (Array.isArray(existing) ? existing : [])
    .filter(profile => profile?.id !== 'mock' && profile?.protocol !== 'mock')
    .map(profile => ({ ...profile, protocol: profile.protocol === 'codex-cli' ? 'codex-app-server' : profile.protocol }));
  if (!cleanExisting.length) return presets.map(profile => normalizeProviderProfile(profile));
  const byId = new Map(cleanExisting.map(profile => [profile.id, profile]));
  const normalized = presets.map(preset => {
    const previous = byId.get(preset.id) || {};
    const merged = { ...preset, ...previous, protocol: previous.protocol === 'codex-cli' ? 'codex-app-server' : (previous.protocol || preset.protocol), builtIn: true };
    if (preset.id === 'codex-cli' && !previous.lastModelSyncAt && !previous.codexModelSyncAt) {
      merged.models = [];
      merged.enabled = false;
      merged.connectionStatus = 'disconnected';
    }
    return normalizeProviderProfile(merged);
  });
  for (const profile of cleanExisting) {
    if (!normalized.some(item => item.id === profile.id)) normalized.push(normalizeProviderProfile({ ...profile, builtIn: false, category: '自定义' }));
  }
  return normalized;
}

function normalizeProviderProfile(profile) {
  const normalized = {
    ...profile,
    id: String(profile?.id || ''),
    name: String(profile?.name || profile?.id || '未命名供应商'),
    protocol: profile?.protocol === 'codex-cli' ? 'codex-app-server' : String(profile?.protocol || 'openai-chat'),
    reasoningMode: String(profile?.reasoningMode || 'auto'),
    connectionStatus: String(profile?.connectionStatus || 'unverified'),
    models: []
  };
  normalized.reasoningMode = REASONING_MODE_OPTIONS.some(item => item.id === normalized.reasoningMode) ? normalized.reasoningMode : 'auto';
  normalized.models = normalizeModels(profile?.models, normalized);
  return normalized;
}

function normalizeModels(models, profile = {}) {
  return normalizeDiscoveredModels(Array.isArray(models) ? models : [], profile);
}

function makeUniqueProviderId(prefix) {
  let id = `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
  while (getProvider(id)) id = `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
  return id;
}

function pathTo(nodeId) {
  const path = [];
  let current = getNode(nodeId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? getNode(current.parentId) : null;
  }
  return path;
}

function ancestorsOf(nodeId) {
  return pathTo(nodeId).slice(0, -1);
}

function descendantsOf(nodeId) {
  const result = [];
  const queue = [...directChildren(nodeId)];
  while (queue.length) {
    const node = queue.shift();
    result.push(node);
    queue.push(...directChildren(node.id));
  }
  return result;
}

function directChildren(nodeId) {
  return state.nodes.filter(node => node.parentId === nodeId && node.kind !== 'annotation');
}

function allDirectChildren(nodeId) {
  return state.nodes.filter(node => node.parentId === nodeId);
}

function allDescendantsOf(nodeId) {
  const result = [];
  const queue = [...allDirectChildren(nodeId)];
  while (queue.length) {
    const node = queue.shift();
    result.push(node);
    queue.push(...allDirectChildren(node.id));
  }
  return result;
}

function depthOf(nodeId) {
  return Math.max(0, pathTo(nodeId).length - 1);
}

function selectedNodes() {
  return state.selectedIds.map(getNode).filter(Boolean);
}

function getNode(id) {
  return state.nodes.find(node => node.id === id);
}

function hasAssistantAnswer(node) {
  return node.messages.some(message => message.role === 'assistant' && !message.error && message.content.trim());
}

function hasSubstantiveContent(node) {
  return hasAssistantAnswer(node) || node.kind === 'merge';
}

function latestAssistantText(node) {
  return normalizeAssistantContent([...node.messages].reverse().find(message => message.role === 'assistant' && !message.error)?.content || '');
}

function makeMessage(role, content, extra = {}) {
  return { id: makeId('msg'), role, content: String(content || ''), createdAt: now(), ...extra };
}

function deriveTitle(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim().replace(/[？?。.!！]+$/, '');
  return clean.length > 24 ? `${clean.slice(0, 23)}…` : clean || '新的追问';
}

function summarizeForCard(text) {
  const clean = String(text || '').replace(/```[\s\S]*?```/g, ' ').replace(/[#*`>\-]/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.length > 122 ? `${clean.slice(0, 119)}…` : clean;
}

function markdownToHtml(markdown) {
  const source = normalizeAssistantContent(markdown).replace(/\r\n/g, '\n');
  const codeBlocks = [];
  let protectedText = source.replace(/```([^\n]*)\n([\s\S]*?)```/g, (_, language, code) => {
    const token = `@@TC_CODE_${codeBlocks.length}@@`;
    const lang = String(language || '').trim();
    codeBlocks.push(`<div class="code-block"><div class="code-block-head" data-selection-ignore><span>${escapeHtml(lang || 'code')}</span><button class="code-copy-button" data-selection-ignore type="button">复制</button></div><pre><code>${escapeHtml(code.replace(/\n$/, ''))}</code></pre></div>`);
    return `\n${token}\n`;
  });
  protectedText = escapeHtml(protectedText);
  const inline = text => text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  const lines = protectedText.split('\n');
  const out = [];
  let i=0;
  while(i<lines.length){
    const raw=lines[i], line=raw.trim();
    if(!line){i++;continue;}
    if(/^@@TC_CODE_\d+@@$/.test(line)){out.push(line);i++;continue;}
    const h=line.match(/^(#{1,4})\s+(.+)/);
    if(h){const level=Math.min(4,h[1].length+1);out.push(`<h${level}>${inline(h[2])}</h${level}>`);i++;continue;}
    if(/^---+$/.test(line)){out.push('<hr>');i++;continue;}
    if(line.startsWith('&gt;')){
      const quote=[];
      while(i<lines.length && lines[i].trim().startsWith('&gt;')){quote.push(lines[i].trim().replace(/^&gt;\s?/,''));i++;}
      const body=quote.map(inline).join('<br>');
      const callout=/^<strong>.+?<\/strong>/.test(body);
      out.push(`<blockquote class="${callout?'callout':''}">${body}</blockquote>`);continue;
    }
    const ul=line.match(/^[-*•]\s+(.+)/), ol=line.match(/^\d+[.)]\s+(.+)/);
    if(ul||ol){
      const tag=ul?'ul':'ol', items=[];
      while(i<lines.length){
        const m=tag==='ul'?lines[i].trim().match(/^[-*•]\s+(.+)/):lines[i].trim().match(/^\d+[.)]\s+(.+)/);
        if(!m)break;items.push(`<li>${inline(m[1])}</li>`);i++;
      }
      out.push(`<${tag}>${items.join('')}</${tag}>`);continue;
    }
    if(line.includes('|') && i+1<lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i+1])){
      const header=line.replace(/^\||\|$/g,'').split('|').map(x=>x.trim());i+=2;const rows=[];
      while(i<lines.length && lines[i].includes('|') && lines[i].trim()){
        rows.push(lines[i].replace(/^\||\|$/g,'').split('|').map(x=>x.trim()));i++;
      }
      out.push(`<div class="table-wrap"><table><thead><tr>${header.map(x=>`<th>${inline(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${inline(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);continue;
    }
    const para=[line];i++;
    while(i<lines.length && lines[i].trim() && !/^(#{1,4})\s+/.test(lines[i].trim()) && !/^[-*•]\s+/.test(lines[i].trim()) && !/^\d+[.)]\s+/.test(lines[i].trim()) && !lines[i].trim().startsWith('&gt;') && !/^@@TC_CODE_\d+@@$/.test(lines[i].trim())){para.push(lines[i].trim());i++;}
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  let html=out.join('');
  codeBlocks.forEach((block,index)=>{html=html.replace(`@@TC_CODE_${index}@@`,block);});
  return html;
}

function nodeHeight(node) {
  if (!node) return NODE_MIN_H;
  const title = String(node.title || '');
  const summary = String(node.summary || node.content || node.question || '');
  const titleLines = title.length > 18 ? 2 : 1;
  const summaryLines = clamp(Math.ceil(Math.max(1, summary.length) / 31), 1, node.kind === 'annotation' ? 4 : 3);
  const height = (node.kind === 'annotation' ? 104 : 112) + titleLines * 21 + summaryLines * 18;
  return clamp(height, node.kind === 'annotation' ? 158 : NODE_MIN_H, node.kind === 'annotation' ? 238 : NODE_MAX_H);
}

function nodeStatusText(status) {
  return ({ open: '待理解', exploring: '讨论中', resolved: '已完成', archived: '已归档' })[status] || status;
}

function formatTime(value) {
  try { return new Date(value).toLocaleTimeString(localeForIntl(state.uiLanguage), { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}

function saveAndRender({ createBackup = true } = {}) {
  saveState({ createBackup });
  render();
}

function setProjectSaveStatus(status, { at = '', error = '' } = {}) {
  projectSaveStatus = status;
  projectSaveError = error || '';
  if (status === 'saved' && at) lastProjectSavedAt = at;
  renderProjectSaveStatus();
}

function renderProjectSaveStatus() {
  const element = $('#saveStatus');
  if (!element) return;
  element.classList.toggle('saving', projectSaveStatus === 'saving');
  element.classList.toggle('error', projectSaveStatus === 'error');
  const label = element.querySelector('span');
  const time = element.querySelector('time');
  if (label) label.textContent = projectSaveStatus === 'saving' ? '正在保存…' : projectSaveStatus === 'error' ? '保存失败 · 点击重试' : '已保存';
  if (time) time.textContent = projectSaveStatus === 'error'
    ? (projectSaveError || '检查目录权限')
    : lastProjectSavedAt ? formatTime(lastProjectSavedAt) : '本地文件';
  element.disabled = projectSaveStatus === 'saving' || !currentProjectId;
}

function saveState({ createBackup = false } = {}) {
  if (!currentProjectId) return;
  state.projectId = currentProjectId;
  state.projectUpdatedAt = now();
  if (!state.projectCreatedAt) state.projectCreatedAt = state.projectUpdatedAt;
  updateProjectIndexEntry();
  const task = {
    projectId: currentProjectId,
    snapshot: projectFieldsFromState(state),
    createBackup: Boolean(createBackup),
    sequence: ++projectSaveSequence
  };
  setProjectSaveStatus('saving');

  // Rapid canvas edits can schedule many saves before the local file write finishes.
  // Keep the newest immutable snapshot and preserve the strongest backup request
  // instead of replaying every intermediate camera/selection state.
  if (pendingProjectSave?.projectId === task.projectId) {
    task.createBackup = task.createBackup || pendingProjectSave.createBackup;
  }
  pendingProjectSave = task;
  if (!projectSavePumpRunning) {
    projectSavePumpRunning = true;
    projectSaveChain = drainProjectSaveQueue();
  }
}

async function drainProjectSaveQueue() {
  while (pendingProjectSave) {
    const task = pendingProjectSave;
    pendingProjectSave = null;
    try {
      const response = await apiJson(`/api/projects/${encodeURIComponent(task.projectId)}`, {
        project: task.snapshot,
        createBackup: task.createBackup
      });
      if (response.project) {
        const index = projectIndex.findIndex(item => item.id === task.projectId);
        if (index >= 0) projectIndex[index] = response.project;
        else projectIndex.push(response.project);
      }
      if (task.sequence === projectSaveSequence) setProjectSaveStatus('saved', { at: task.snapshot.projectUpdatedAt });
    } catch (error) {
      if (task.sequence === projectSaveSequence) {
        setProjectSaveStatus('error', { error: error.message || String(error) });
        showOperationError('本地项目文件写入失败，请检查目录权限', error, { once: true });
      }
    }
  }
  projectSavePumpRunning = false;
  // A save may have been queued synchronously while the final task completed.
  if (pendingProjectSave) {
    projectSavePumpRunning = true;
    return drainProjectSaveQueue();
  }
}

async function persistProjectNow() {
  if (!currentProjectId) return;
  state.projectId = currentProjectId;
  state.projectUpdatedAt = now();
  if (!state.projectCreatedAt) state.projectCreatedAt = state.projectUpdatedAt;
  const savedAt = state.projectUpdatedAt;
  const sequence = ++projectSaveSequence;
  setProjectSaveStatus('saving');
  try {
    const response = await apiJson(`/api/projects/${encodeURIComponent(currentProjectId)}`, { project: projectFieldsFromState(state), createBackup: true });
    updateProjectIndexEntry();
    if (response.project) {
      const index = projectIndex.findIndex(item => item.id === currentProjectId);
      if (index >= 0) projectIndex[index] = response.project;
      else projectIndex.push(response.project);
    }
    if (sequence === projectSaveSequence) setProjectSaveStatus('saved', { at: savedAt });
  } catch (error) {
    if (sequence === projectSaveSequence) setProjectSaveStatus('error', { error: error.message || String(error) });
    showOperationError('本地项目文件写入失败，请检查目录权限', error, { once: true });
    throw error;
  }
}

async function flushProjectSave() {
  try { await projectSaveChain; } catch {}
}

function loadGlobalSettings() {
  const defaults = globalSettingsFromState(initialState);
  return localGlobalSettings ? applyLocalGlobalSettings(defaults) : defaults;
}

function getProviderFromList(providers, id) {
  return (providers || []).find(profile => profile.id === id);
}

function ensureModelForProviderFromList(providers, providerId, preferred = '') {
  const provider = getProviderFromList(providers, providerId);
  const models = provider?.models || [];
  if (preferred && models.some(model => model.id === preferred)) return preferred;
  return models[0]?.id || preferred || '';
}

function loadSession(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function apiHeaders(extra = {}) {
  return { ...(localSessionToken ? { [API_SESSION_HEADER]: localSessionToken } : {}), ...extra };
}

async function apiGet(url) {
  const response = await fetch(url, { headers: apiHeaders() });
  const payload = await response.json().catch(() => ({}));
  const repaired = repairUtf8MojibakeDeep(payload);
  pendingEncodingRepairCount += repaired.repairs;
  if (repaired.value && typeof repaired.value === 'object') {
    Object.defineProperty(repaired.value, API_ENCODING_REPAIR, { value: repaired.repairs, enumerable: false });
  }
  if (!response.ok) throw new Error(repaired.value.error || `HTTP ${response.status}`);
  return repaired.value;
}

async function apiJson(url, body) {
  const response = await fetch(url, { method: 'POST', headers: apiHeaders({ 'content-type': 'application/json' }), body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  const repaired = repairUtf8MojibakeDeep(payload);
  pendingEncodingRepairCount += repaired.repairs;
  if (repaired.value && typeof repaired.value === 'object') {
    Object.defineProperty(repaired.value, API_ENCODING_REPAIR, { value: repaired.repairs, enumerable: false });
  }
  if (!response.ok) throw new Error(repaired.value.error || `HTTP ${response.status}`);
  return repaired.value;
}

async function apiDelete(url) {
  const response = await fetch(url, { method: 'DELETE', headers: apiHeaders() });
  const payload = await response.json().catch(() => ({}));
  const repaired = repairUtf8MojibakeDeep(payload);
  pendingEncodingRepairCount += repaired.repairs;
  if (repaired.value && typeof repaired.value === 'object') {
    Object.defineProperty(repaired.value, API_ENCODING_REPAIR, { value: repaired.repairs, enumerable: false });
  }
  if (!response.ok) throw new Error(repaired.value.error || `HTTP ${response.status}`);
  return repaired.value;
}

async function apiNdjson(url, body, { signal, onEvent } = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: apiHeaders({ 'content-type': 'application/json', accept: 'application/x-ndjson' }),
    body: JSON.stringify(body),
    signal
  });
  if (!response.ok) {
    const payload = await response.json().catch(async () => ({ error: await response.text().catch(() => '') }));
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  if (!response.body?.getReader) throw new Error('当前浏览器不支持流式读取。');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      let event;
      try { event = repairUtf8MojibakeDeep(JSON.parse(line)).value; } catch { continue; }
      if (event.type === 'error') throw new Error(event.error || '生成失败');
      onEvent?.(event);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) {
    try {
      const event = repairUtf8MojibakeDeep(JSON.parse(buffer)).value;
      if (event.type === 'error') throw new Error(event.error || '生成失败');
      onEvent?.(event);
    } catch (error) {
      if (error instanceof SyntaxError) return;
      throw error;
    }
  }
}

function showOperationNotice(title, detail) {
  const toast = document.createElement('div');
  toast.className = 'operation-error-toast operation-notice-toast';
  toast.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span><button aria-label="关闭">×</button>`;
  document.body.appendChild(toast);
  toast.querySelector('button').onclick = () => toast.remove();
  setTimeout(() => toast.remove(), 5500);
}

function requestConfirmation({ eyebrow = '请确认', title = '确认操作', message = '', detail = '', confirmLabel = '确认', danger = false } = {}) {
  const dialog = $('#confirmDialog');
  if (!dialog) return Promise.resolve(false);
  if (confirmationResolver) settleConfirmation(false);
  $('#confirmDialogEyebrow').textContent = eyebrow;
  $('#confirmDialogTitle').textContent = title;
  $('#confirmDialogMessage').textContent = message;
  const detailEl = $('#confirmDialogDetail');
  detailEl.textContent = detail;
  detailEl.classList.toggle('hidden', !detail);
  const confirmButton = $('#confirmDialogConfirmBtn');
  confirmButton.textContent = confirmLabel;
  confirmButton.classList.toggle('danger-action', Boolean(danger));
  confirmButton.classList.toggle('primary-action', !danger);
  if (!dialog.open) dialog.showModal();
  requestAnimationFrame(() => $('#confirmDialogCancelBtn')?.focus());
  return new Promise(resolve => { confirmationResolver = resolve; });
}

function settleConfirmation(value, { closeDialog = true } = {}) {
  const resolve = confirmationResolver;
  confirmationResolver = null;
  const dialog = $('#confirmDialog');
  if (closeDialog && dialog?.open) dialog.close();
  resolve?.(Boolean(value));
}

function showOperationError(title, error, { once = false } = {}) {
  const detail = String(error?.message || error || '未知错误');
  if (once && document.querySelector('.operation-error-toast')) return;
  const toast = document.createElement('div');
  toast.className = 'operation-error-toast';
  toast.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span><button aria-label="关闭">×</button>`;
  document.body.appendChild(toast);
  toast.querySelector('button').onclick = () => toast.remove();
  setTimeout(() => toast.remove(), 7000);
}

function isTypingTarget(target) {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.isContentEditable;
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function unique(items) { return [...new Set(items)]; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]); }
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#096;'); }
