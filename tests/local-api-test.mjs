import { spawn } from 'node:child_process';
import { createServer, request as httpRequest } from 'node:http';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const port = 18787;
const upstreamPort = 18788;
const configDir = await mkdtemp(path.join(os.tmpdir(), 'thought-canvas-v12-'));
const expectedKey = 'local-test-secret';
let upstreamAuth = '';
let upstreamLastBody = null;
let upstreamLastPath = '';
let upstreamRequestCount = 0;

const upstream = createServer(async (req, res) => {
  upstreamRequestCount += 1;
  upstreamAuth = String(req.headers.authorization || '');
  upstreamLastPath = new URL(req.url || '/', 'http://127.0.0.1').pathname;
  let raw = ''; for await (const chunk of req) raw += chunk;
  upstreamLastBody = raw ? JSON.parse(raw) : null;
  const authorized = upstreamAuth === `Bearer ${expectedKey}`;
  if (!authorized) {
    res.writeHead(401, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ error: { message: 'bad auth' } }));
  }
  if (req.method === 'GET' && upstreamLastPath === '/v1/models') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({
      data: [
        {
          id: 'local-model',
          label: 'Local Reasoning Model',
          supported_reasoning_efforts: ['low', 'medium', 'high'],
          default_reasoning_effort: 'medium',
          isDefault: true,
          input_modalities: ['text']
        },
        { id: 'local-basic', label: 'Local Basic Model' }
      ]
    }));
  }
  if (req.method === 'POST' && upstreamLastPath === '/v1/chat/completions') {
    res.writeHead(200, { 'content-type': 'application/json' });
    const emptyReply = raw.includes('测试空正文回退');
    const mojibakeReply = raw.includes('MOJIBAKE_REPLY');
    return res.end(JSON.stringify(emptyReply
      ? { choices: [{ message: { content: null }, finish_reason: 'length' }] }
      : mojibakeReply
        ? { choices: [{ message: { content: 'è§£é‡Š Harness é‡Œé¢ loop çš„æ¦‚å¿µã€è¿è¡Œæœºåˆ¶åŠå®žé™…åº”ç”¨' } }] }
        : { choices: [{ message: { content: 'CONNECTION_OK' } }] }));
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  return res.end(JSON.stringify({ error: { message: 'not found' } }));
});
await new Promise(resolve => upstream.listen(upstreamPort, '127.0.0.1', resolve));

let child;
let sessionToken = '';
const base = `http://127.0.0.1:${port}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function startServer() {
  child = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port), THOUGHT_CANVAS_CONFIG_DIR: configDir },
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

async function stopServer() {
  if (!child) return;
  child.kill('SIGTERM');
  await sleep(120);
  child = null;
}

async function waitForServer() {
  for (let i = 0; i < 80; i++) {
    try { const response = await fetch(`${base}/api/health`); if (response.ok) return; } catch {}
    await sleep(80);
  }
  throw new Error('server did not start');
}

async function refreshSessionToken() {
  const response = await fetch(`${base}/`);
  const html = await response.text();
  const match = html.match(/name=\"thought-canvas-session\" content=\"([^\"]+)\"/);
  assert.ok(match?.[1], 'runtime session token must be injected into index.html');
  sessionToken = match[1];
  return sessionToken;
}

async function request(route, { method = 'GET', body, expectStatus, headers = {}, includeToken = true } = {}) {
  const mutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
  const response = await fetch(base + route, {
    method,
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(includeToken && mutation && sessionToken ? { 'x-thought-canvas-session': sessionToken } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (expectStatus !== undefined) assert.equal(response.status, expectStatus, `${route}: ${JSON.stringify(payload)}`);
  else assert.equal(response.ok, true, `${route}: ${JSON.stringify(payload)}`);
  return payload;
}

async function requestStream(route, body, { signal } = {}) {
  const response = await fetch(base + route, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/x-ndjson',
      'x-thought-canvas-session': sessionToken
    },
    body: JSON.stringify(body),
    signal
  });
  assert.equal(response.ok, true, `${route}: HTTP ${response.status}`);
  const raw = await response.text();
  return raw.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
}

async function requestWithHostHeader(hostHeader) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/health',
      method: 'GET',
      headers: { Host: hostHeader }
    }, res => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        let payload = {};
        try { payload = JSON.parse(raw); } catch {}
        resolve({ status: res.statusCode, payload });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

try {
  startServer();
  await waitForServer();
  await refreshSessionToken();

  const health = await request('/api/health');
  assert.equal(health.version, '1.2.5');
  assert.equal(health.host, '127.0.0.1');
  const htmlResponse = await fetch(`${base}/`);
  assert.match(String(htmlResponse.headers.get('content-type') || ''), /^text\/html;\s*charset=utf-8$/i);
  assert.match(await htmlResponse.text(), /<meta charset="UTF-8"/i);
  const scriptResponse = await fetch(`${base}/app.js`);
  assert.match(String(scriptResponse.headers.get('content-type') || ''), /^text\/javascript;\s*charset=utf-8$/i);
  assert.match(await scriptResponse.text(), /const APP_VERSION = '1\.2\.5'/);
  const hostileHost = await requestWithHostHeader('malicious.example');
  assert.equal(hostileHost.status, 403);
  assert.match(hostileHost.payload.error, /回环地址/);
  const missingSession = await request('/api/active-project', {
    method: 'POST', body: { projectId: '' }, includeToken: false, expectStatus: 401
  });
  assert.equal(missingSession.code, 'SESSION_REQUIRED');
  const invalidSession = await request('/api/active-project', {
    method: 'POST', body: { projectId: '' }, headers: { 'x-thought-canvas-session': 'invalid-session' }, includeToken: false, expectStatus: 401
  });
  assert.equal(invalidSession.code, 'SESSION_REQUIRED');
  const crossOriginWrite = await request('/api/active-project', {
    method: 'POST', body: { projectId: '' }, headers: { origin: 'https://malicious.example' }, expectStatus: 403
  });
  assert.match(crossOriginWrite.error, /其他来源/);
  const initialWorkspace = await request('/api/workspace');
  assert.deepEqual(initialWorkspace.projects, []);
  assert.equal(initialWorkspace.storage.projectsDir, 'data/projects');
  assert.equal(initialWorkspace.storage.backupsDir, 'data/backups');

  // Historical project files may already contain UTF-8 text that was decoded as
  // Windows-1252. Reading such a project must repair it, preserve a pre-repair
  // backup, and persist explicit migration metadata.
  const mojibakeSample = 'è§£é‡Š Harness é‡Œé¢ loop çš„æ¦‚å¿µã€è¿è¡Œæœºåˆ¶åŠå®žé™…åº”ç”¨';
  const repairedSample = '解释 Harness 里面 loop 的概念、运行机制及实际应用';
  const encodingProjectPath = path.join(configDir, 'data', 'projects', 'project_encoding.json');
  const rawEncodingProject = {
    version: '1.2.4',
    projectId: 'project_encoding',
    projectTitle: mojibakeSample,
    projectCreatedAt: '2026-07-20T10:00:00.000Z',
    projectUpdatedAt: '2026-07-20T10:00:00.000Z',
    goal: { text: mojibakeSample, source: 'user', status: 'edited', version: 1, history: [] },
    nodes: [{
      id: 'root', kind: 'root', title: mojibakeSample, question: mojibakeSample,
      summary: mojibakeSample, messages: [{ id: 'msg_encoding', role: 'assistant', content: mojibakeSample }]
    }],
    edges: []
  };
  await writeFile(encodingProjectPath, JSON.stringify(rawEncodingProject, null, 2) + '\n', 'utf8');
  const migratedEncodingProject = await request('/api/projects/project_encoding');
  assert.equal(migratedEncodingProject.project.projectTitle, repairedSample);
  assert.equal(migratedEncodingProject.project.goal.text, repairedSample);
  assert.equal(migratedEncodingProject.project.nodes[0].messages[0].content, repairedSample);
  assert.ok(migratedEncodingProject.encodingRepair?.repairs >= 5);
  assert.equal(migratedEncodingProject.encodingRepair?.backupCreated, true);
  assert.equal(migratedEncodingProject.project.textEncodingRepairVersion, 1);
  assert.ok(migratedEncodingProject.project.textEncodingRepairedAt);
  const persistedEncodingProject = JSON.parse(await readFile(encodingProjectPath, 'utf8'));
  assert.equal(persistedEncodingProject.projectTitle, repairedSample);
  assert.ok(persistedEncodingProject.textEncodingRepairCount >= 5);
  const encodingBackups = (await readdir(path.join(configDir, 'data', 'backups'))).filter(name => name.startsWith('project_encoding.encoding-before-'));
  assert.equal(encodingBackups.length, 1);
  const preRepairBackup = JSON.parse(await readFile(path.join(configDir, 'data', 'backups', encodingBackups[0]), 'utf8'));
  assert.equal(preRepairBackup.projectTitle, mojibakeSample);
  await request('/api/projects/project_encoding', { method: 'DELETE' });

  // Corrupted text arriving through a current save request is repaired before it
  // reaches disk and still records migration metadata.
  const incomingEncodingProject = {
    ...structuredClone(rawEncodingProject),
    projectId: 'project_encoding_post',
    projectTitle: mojibakeSample,
    nodes: [{ ...structuredClone(rawEncodingProject.nodes[0]), id: 'root' }]
  };
  const incomingEncodingSave = await request('/api/projects/project_encoding_post', {
    method: 'POST', body: { project: incomingEncodingProject, createBackup: false }
  });
  assert.ok(incomingEncodingSave.encodingRepair?.repairs >= 1);
  const incomingEncodingStored = JSON.parse(await readFile(path.join(configDir, 'data', 'projects', 'project_encoding_post.json'), 'utf8'));
  assert.equal(incomingEncodingStored.projectTitle, repairedSample);
  assert.equal(incomingEncodingStored.textEncodingRepairVersion, 1);
  assert.ok(incomingEncodingStored.textEncodingRepairCount >= 1);
  await request('/api/projects/project_encoding_post', { method: 'DELETE' });

  // A historical recovery file can carry the same corruption. Restore must
  // repair it before becoming the active project and record the migration.
  const restoreEncodingProject = {
    ...structuredClone(rawEncodingProject),
    version: '1.2.5',
    projectId: 'project_encoding_restore',
    projectTitle: '恢复前的干净项目',
    goal: { text: '恢复前目标', source: 'user', status: 'edited', version: 1, history: [] },
    nodes: [{ ...structuredClone(rawEncodingProject.nodes[0]), id: 'root', title: '恢复前根节点', messages: [] }]
  };
  await request('/api/projects/project_encoding_restore', {
    method: 'POST', body: { project: restoreEncodingProject, createBackup: false }
  });
  const corruptRestoreBackupId = 'project_encoding_restore.2026-07-24T10-00-00-000Z.json';
  await writeFile(
    path.join(configDir, 'data', 'backups', corruptRestoreBackupId),
    JSON.stringify({ ...structuredClone(rawEncodingProject), projectId: 'project_encoding_restore' }, null, 2) + '\n',
    'utf8'
  );
  const repairedRestore = await request('/api/projects/project_encoding_restore/restore', {
    method: 'POST', body: { backupId: corruptRestoreBackupId }
  });
  assert.equal(repairedRestore.project.projectTitle, repairedSample);
  assert.equal(repairedRestore.project.textEncodingRepairVersion, 1);
  assert.ok(repairedRestore.project.textEncodingRepairCount >= 5);
  assert.ok(repairedRestore.encodingRepair?.repairs >= 5);
  await request('/api/projects/project_encoding_restore', { method: 'DELETE' });

  const directSecretWrite = await request('/api/provider-secret', {
    method: 'POST',
    body: { providerId: 'custom-local', apiKey: 'bypass-key' },
    expectStatus: 400
  });
  assert.match(directSecretWrite.error, /只能通过.*连接并同步模型/);

  const connectConfig = {
    providerId: 'custom-local',
    providerName: '本地代理',
    protocol: 'openai-chat',
    baseUrl: `http://127.0.0.1:${upstreamPort}/v1`,
    model: 'local-model',
    authMode: 'bearer',
    reasoningMode: 'openai'
  };
  const connectWithoutSession = await request('/api/providers/connect', {
    method: 'POST',
    body: { config: connectConfig, apiKey: expectedKey },
    includeToken: false,
    expectStatus: 401
  });
  assert.equal(connectWithoutSession.code, 'SESSION_REQUIRED');
  const connectedProvider = await request('/api/providers/connect', {
    method: 'POST',
    body: { config: connectConfig, apiKey: expectedKey }
  });
  assert.equal(connectedProvider.ok, true);
  assert.equal(connectedProvider.hasKey, true);
  assert.equal(connectedProvider.preferredModel, 'local-model');
  assert.equal(connectedProvider.models.length, 2);
  assert.deepEqual(connectedProvider.models[0].reasoningEfforts, ['auto', 'low', 'medium', 'high']);
  assert.equal(connectedProvider.models[0].defaultReasoningEffort, 'medium');
  assert.equal(connectedProvider.models[0].isDefault, true);
  assert.equal(JSON.stringify(connectedProvider).includes(expectedKey), false, 'connect response must never echo the API key');
  assert.equal(upstreamLastPath, '/v1/chat/completions');
  assert.equal(upstreamAuth, `Bearer ${expectedKey}`);

  const envAfterConnect = await readFile(path.join(configDir, '.env.local'), 'utf8');
  assert.ok(envAfterConnect.includes(expectedKey), 'successful connect must persist the key');
  const failedReconnect = await request('/api/providers/connect', {
    method: 'POST',
    body: { config: connectConfig, apiKey: 'wrong-key' },
    expectStatus: 502
  });
  assert.match(failedReconnect.error, /bad auth|HTTP 401/i);
  const envAfterFailedReconnect = await readFile(path.join(configDir, '.env.local'), 'utf8');
  assert.ok(envAfterFailedReconnect.includes(expectedKey), 'failed connect must not overwrite the stored key');
  assert.equal(envAfterFailedReconnect.includes('wrong-key'), false);

  const generatedWithReasoning = await request('/api/generate', {
    method: 'POST',
    body: { prompt: '验证思考等级透传', uiLanguage: 'en', config: { ...connectConfig, reasoningEffort: 'high' } }
  });
  assert.equal(generatedWithReasoning.text, 'CONNECTION_OK');
  assert.equal(upstreamLastBody.reasoning_effort, 'high');
  assert.equal(upstreamLastBody.model, 'local-model');
  assert.match(JSON.stringify(upstreamLastBody.messages), /Response language: English/);
  assert.ok(upstreamRequestCount >= 4);

  const mockConfig = { providerId: 'mock', providerName: 'Mock', protocol: 'mock', model: 'mock-thought' };
  const analyze = await request('/api/analyze', { method: 'POST', body: { question: '测试问题', prompt: '测试问题', config: mockConfig } });
  assert.ok(analyze.answer);
  assert.ok(analyze.goalSuggestion);
  assert.equal('sections' in analyze, false, '首问不得自动拆解');

  const streamEvents = await requestStream('/api/generate-stream', { prompt: '验证流式输出', config: mockConfig });
  assert.equal(streamEvents[0].type, 'start');
  assert.ok(streamEvents.some(event => event.type === 'delta'));
  assert.equal(streamEvents.at(-1).type, 'done');
  const streamedText = streamEvents.filter(event => event.type === 'delta').map(event => event.text).join('');
  assert.match(streamedText, /我理解你的追问|聚焦回答/);

  const analyzeStreamEvents = await requestStream('/api/analyze-stream', { question: '测试流式分析', prompt: '测试流式分析', config: mockConfig });
  assert.ok(analyzeStreamEvents.some(event => event.type === 'meta' && event.goalSuggestion));
  assert.equal(analyzeStreamEvents.at(-1).type, 'done');

  const answerText = '## 第一部分\n\n测试项目的代号是“北极星17”。这一事实必须被后续分支继承。\n\n## 第二部分\n\n这是第二部分的完整讲解，不能被改写成一个新问题。\n\n## 第三部分\n\n这是第三部分的完整讲解，用于验证选中文字拆解。';
  const project = {
    version: '1.2.5', projectId: 'project_gate', projectTitle: 'Gate 项目',
    projectCreatedAt: new Date().toISOString(), projectUpdatedAt: new Date().toISOString(),
    goal: { text: '验证 v12 状态机', source: 'user', status: 'edited', version: 1, history: [] },
    contextVersionCounter: 2,
    contextSnapshots: [{ id: 'ctx_gate', version: 2, immutable: true, purpose: 'generation', createdAt: new Date().toISOString() }],
    generationRecords: [{ id: 'generation_gate', nodeId: 'root', purpose: 'generation', contextSnapshotId: 'ctx_gate', success: true }],
    modelCalls: [], composerByNode: {}, showArchived: false,
    artifacts: [
      { id: 'artifact_claim', kind: 'claim', title: '项目代号必须被继承', content: '后续分支必须继承北极星17。', nodeId: 'root', sourceMessageId: 'msg_answer', sourceStart: 0, sourceEnd: 12, sourceText: '项目代号是北极星17', contextSnapshotId: 'ctx_gate', workStatus: 'open', confidenceStatus: 'partial', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'artifact_evidence', kind: 'evidence', title: '原文给出项目代号', content: '测试项目的代号是北极星17。', nodeId: 'root', sourceMessageId: 'msg_answer', sourceStart: 8, sourceEnd: 26, sourceText: '测试项目的代号是“北极星17”。', contextSnapshotId: 'ctx_gate', workStatus: 'resolved', confidenceStatus: 'verified', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ],
    reasoningEdges: [{ id: 'reason_gate', sourceArtifactId: 'artifact_evidence', targetArtifactId: 'artifact_claim', relation: 'supports', createdAt: new Date().toISOString() }],
    camera: { x: 120, y: 80, scale: 0.9 }, selectedIds: ['root'],
    nodes: [{
      id: 'root', kind: 'root', origin: 'root', title: 'Gate 根节点', question: '项目代号是什么？',
      summary: '测试', x: 180, y: 280, status: 'exploring', parentId: null,
      messages: [
        { id: 'msg_user', role: 'user', content: '请记住项目代号。', createdAt: new Date().toISOString() },
        { id: 'msg_answer', role: 'assistant', content: answerText, provider: 'mock', model: 'mock-thought', createdAt: new Date().toISOString() }
      ],
      decomposedMessageIds: [], compactSnapshots: [], activeCompactId: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    }],
    edges: []
  };

  await request('/api/projects/project_gate', { method: 'POST', body: { project } });
  await request('/api/active-project', { method: 'POST', body: { projectId: 'project_gate' } });
  const workspace = await request('/api/workspace');
  assert.equal(workspace.activeProjectId, 'project_gate');
  assert.equal(workspace.projects[0].nodeCount, 1);

  const storedText = await readFile(path.join(configDir, 'data', 'projects', 'project_gate.json'), 'utf8');
  assert.ok(storedText.includes('北极星17'));
  assert.ok(storedText.includes('artifact_evidence'));
  assert.ok(storedText.includes('reason_gate'));
  assert.equal(/api[_-]?key/i.test(storedText), false);

  const rejectedSecretProject = structuredClone(project);
  rejectedSecretProject.nodes[0].apiKey = 'must-not-be-saved';
  rejectedSecretProject.nodes[0].clientSecret = 'also-must-not-be-saved';
  rejectedSecretProject.nodes[0].cookie = 'session=blocked';
  const secretRejection = await request('/api/projects/project_secret', { method: 'POST', body: { project: rejectedSecretProject }, expectStatus: 400 });
  assert.match(secretRejection.error, /密钥字段/);

  const blockedTarget = path.join(configDir, 'data', 'projects', 'project_blocked.json');
  await mkdir(blockedTarget, { recursive: true });
  const writeFailure = await request('/api/projects/project_blocked', { method: 'POST', body: { project: { ...project, projectId: 'project_blocked' } }, expectStatus: 500 });
  assert.match(writeFailure.error, /本地项目文件写入失败/);
  await rm(blockedTarget, { recursive: true, force: true });
  const intactAfterFailure = await request('/api/projects/project_gate');
  assert.ok(intactAfterFailure.project.nodes[0].messages.some(message => message.id === 'msg_answer'));

  const fullDecompose = await request('/api/projects/project_gate/nodes/root/messages/msg_answer/decompose', {
    method: 'POST', body: { scope: 'message', question: '测试', config: mockConfig }
  });
  assert.ok(fullDecompose.sections.length >= 3);
  assert.ok(fullDecompose.sections.every(section => answerText.slice(section.sourceStart, section.sourceEnd) === section.sourceText));
  assert.ok(fullDecompose.sections.every(section => !/[？?]$/.test(section.title)));

  const selectedText = '## 第二部分\n\n这是第二部分的完整讲解，不能被改写成一个新问题。';
  const selection = await request('/api/projects/project_gate/nodes/root/messages/msg_answer/decompose/', {
    method: 'POST', body: { scope: 'selection', selectedText, config: mockConfig }
  });
  assert.ok(selection.sections.length >= 1);
  assert.ok(selection.sections.every(section => selectedText.includes(section.sourceText)));
  assert.equal(selection.sections.some(section => section.sourceText.includes('第一部分')), false);
  assert.equal(selection.sections.some(section => section.sourceText.includes('第三部分')), false);

  const formattedVisibleSelection = '第二部分\n这是第二部分的完整讲解，不能被改写成一个新问题。';
  const unlocatedSelection = await request('/api/projects/project_gate/nodes/root/messages/msg_answer/decompose', {
    method: 'POST',
    body: {
      scope: 'selection',
      selectedText: formattedVisibleSelection,
      selectionStart: -1,
      selectionEnd: -1,
      allowUnlocatedSelection: true,
      config: mockConfig
    }
  });
  assert.ok(unlocatedSelection.sections.length >= 1);
  assert.equal(unlocatedSelection.binding.selectionStart, -1);
  assert.equal(unlocatedSelection.binding.selectionEnd, -1);
  assert.equal(unlocatedSelection.binding.selectionLocated, false);
  assert.ok(unlocatedSelection.sections.every(section => formattedVisibleSelection.includes(section.sourceText)));

  const missingSelection = await request('/api/projects/project_gate/nodes/root/messages/msg_answer/decompose', {
    method: 'POST', body: { scope: 'selection', selectedText: '', config: mockConfig }, expectStatus: 400
  });
  assert.equal(missingSelection.error, '尚未选择文字。');

  const missingMessage = await request('/api/projects/project_gate/nodes/root/messages/deleted_message/decompose', {
    method: 'POST', body: { scope: 'message', config: mockConfig }, expectStatus: 404
  });
  assert.match(missingMessage.error, /已被删除/);

  const organized = await request('/api/projects/project_gate/nodes/root/organize/', {
    method: 'POST', body: { includeArchivedMessages: false, createDecompositionAfter: false, question: '测试', config: mockConfig }
  });
  assert.ok(organized.organized.includes('当前讨论'));
  assert.ok(organized.result);
  assert.equal('sections' in organized, false, '整理默认不得自动拆节点');

  const compact = await request('/api/projects/project_gate/nodes/root/compact', {
    method: 'POST', body: { question: '测试', config: mockConfig }
  });
  assert.ok(compact.compact.summary.includes('北极星17'));
  assert.deepEqual(compact.compact.coveredMessageIds, ['msg_user', 'msg_answer']);

  project.nodes[0].x = 444;
  project.nodes[0].messages.push({ id: 'msg_follow', role: 'user', content: '继续验证持久化', createdAt: new Date().toISOString() });
  project.projectUpdatedAt = new Date().toISOString();
  await request('/api/projects/project_gate', { method: 'POST', body: { project } });
  const backups = await readdir(path.join(configDir, 'data', 'backups'));
  assert.ok(backups.some(name => name.startsWith('project_gate.')));
  const backupListing = await request('/api/projects/project_gate/backups');
  assert.ok(backupListing.backups.length >= 1);
  assert.ok(backupListing.backups[0].id.startsWith('project_gate.'));
  const restoredBackup = await request('/api/projects/project_gate/restore', {
    method: 'POST', body: { backupId: backupListing.backups[0].id }
  });
  assert.equal(restoredBackup.project.nodes[0].x, 180, 'restore should load the pre-overwrite project version');
  assert.equal(restoredBackup.project.restoredFromBackup, backupListing.backups[0].id);
  await request('/api/projects/project_gate', { method: 'POST', body: { project } });
  const afterRestoreListing = await request('/api/projects/project_gate/backups');
  assert.ok(afterRestoreListing.backups.length >= backupListing.backups.length);
  const invalidRestore = await request('/api/projects/project_gate/restore', {
    method: 'POST', body: { backupId: '../outside.json' }, expectStatus: 400
  });
  assert.match(invalidRestore.error, /备份标识无效/);

  const disposable = { ...structuredClone(project), projectId: 'project_disposable', projectTitle: '可删除项目' };
  await request('/api/projects/project_disposable', { method: 'POST', body: { project: disposable, createBackup: false } });
  disposable.projectTitle = '瞬态更新不建版本';
  await request('/api/projects/project_disposable', { method: 'POST', body: { project: disposable, createBackup: false } });
  assert.equal((await request('/api/projects/project_disposable/backups')).backups.length, 0, 'transient saves must not create recovery versions');
  disposable.projectTitle = '语义更新建立版本';
  await request('/api/projects/project_disposable', { method: 'POST', body: { project: disposable, createBackup: true } });
  assert.equal((await request('/api/projects/project_disposable/backups')).backups.length, 1, 'semantic saves should create a recovery version');
  await request('/api/projects/project_disposable', { method: 'DELETE' });
  const remainingDisposableBackups = (await readdir(path.join(configDir, 'data', 'backups'))).filter(name => name.startsWith('project_disposable.'));
  assert.deepEqual(remainingDisposableBackups, [], 'deleting a project must remove orphaned recovery files');
  await request('/api/projects/project_disposable', { expectStatus: 404 });

  const localSettings = {
    defaultProvider: 'custom-local', defaultModel: 'local-model', defaultReasoningEffort: 'high',
    mergeProvider: 'custom-local', mergeModel: 'local-model', mergeReasoningEffort: 'medium',
    constraints: ['本地测试'], activeProviderEditorId: 'custom-local', sidebarWidth: 440,
    autoCompactEnabled: true, autoCompactMessageLimit: 12, connectionShape: 'curve', connectionStroke: 'dashed', uiLanguage: 'ja',
    providers: [{
      id: 'custom-local', name: '本地代理', protocol: 'openai-chat', reasoningMode: 'openai',
      baseUrl: `http://127.0.0.1:${upstreamPort}/v1`, models: connectedProvider.models,
      enabled: true, builtIn: false, authMode: 'bearer', connectionStatus: 'connected'
    }]
  };
  await request('/api/local-config', { method: 'POST', body: { settings: localSettings } });
  const localConfig = await request('/api/local-config');
  assert.equal(localConfig.settings.defaultProvider, 'custom-local');
  assert.equal(localConfig.settings.defaultReasoningEffort, 'high');
  assert.equal(localConfig.settings.mergeReasoningEffort, 'medium');
  assert.deepEqual(localConfig.settings.providers[0].models[0].reasoningEfforts, ['auto', 'low', 'medium', 'high']);
  assert.equal(localConfig.settings.autoCompactEnabled, true);
  assert.equal(localConfig.settings.autoCompactMessageLimit, 12);
  assert.equal(localConfig.settings.connectionShape, 'curve');
  assert.equal(localConfig.settings.connectionStroke, 'dashed');
  assert.equal(localConfig.settings.uiLanguage, 'ja');
  assert.equal(localConfig.secretStatus['custom-local'], true);
  assert.equal(JSON.stringify(localConfig).includes(expectedKey), false);

  const envText = await readFile(path.join(configDir, '.env.local'), 'utf8');
  const settingsText = await readFile(path.join(configDir, 'data', 'settings.local.json'), 'utf8');
  assert.ok(envText.includes(expectedKey));
  assert.equal(settingsText.includes(expectedKey), false);

  const remoteConfig = {
    providerId: 'custom-local', providerName: '本地代理', protocol: 'openai-chat',
    baseUrl: `http://127.0.0.1:${upstreamPort}/v1`, model: 'local-model', authMode: 'bearer',
    customHeaders: { Authorization: 'Bearer must-not-override', Cookie: 'blocked=1', 'X-Trace-Label': 'allowed' }
  };
  const connection = await request('/api/test-provider', { method: 'POST', body: { config: remoteConfig } });
  assert.equal(connection.ok, true);
  assert.equal(upstreamAuth, `Bearer ${expectedKey}`);

  const repairedProviderReply = await request('/api/generate', {
    method: 'POST',
    body: { prompt: 'MOJIBAKE_REPLY', uiLanguage: 'ja', config: remoteConfig }
  });
  assert.equal(repairedProviderReply.text, '解释 Harness 里面 loop 的概念、运行机制及实际应用');
  assert.match(JSON.stringify(upstreamLastBody.messages), /回答言語：日本語/);

  const malformedStructured = await request('/api/projects/project_gate/nodes/root/messages/msg_answer/decompose', {
    method: 'POST', body: { scope: 'message', question: '测试异常结构回退', config: remoteConfig }
  });
  assert.match(malformedStructured.warning, /格式异常/);
  assert.ok(malformedStructured.sections.length >= 1);
  assert.ok(malformedStructured.sections.every(section => answerText.slice(section.sourceStart, section.sourceEnd) === section.sourceText));

  const emptyProviderReply = await request('/api/projects/project_gate/nodes/root/messages/msg_answer/decompose', {
    method: 'POST', body: { scope: 'message', question: '测试空正文回退', config: remoteConfig }
  });
  assert.match(emptyProviderReply.warning, /没有返回可读取正文|原文结构/);
  assert.ok(emptyProviderReply.sections.length >= 1);
  assert.ok(emptyProviderReply.sections.every(section => answerText.slice(section.sourceStart, section.sourceEnd) === section.sourceText));

  // Startup also repairs historical local settings without changing the chosen
  // interface language. This covers settings files created by older builds or
  // external copy/import tools.
  const settingsBeforeRestart = JSON.parse(await readFile(path.join(configDir, 'data', 'settings.local.json'), 'utf8'));
  settingsBeforeRestart.constraints = [mojibakeSample];
  await writeFile(path.join(configDir, 'data', 'settings.local.json'), JSON.stringify(settingsBeforeRestart, null, 2) + '\n', 'utf8');

  const previousSessionToken = sessionToken;
  await stopServer();
  startServer();
  await waitForServer();
  const staleSession = await request('/api/active-project', {
    method: 'POST', body: { projectId: 'project_gate' }, headers: { 'x-thought-canvas-session': previousSessionToken }, includeToken: false, expectStatus: 401
  });
  assert.equal(staleSession.code, 'SESSION_REQUIRED');
  await refreshSessionToken();
  assert.notEqual(sessionToken, previousSessionToken);
  const restartedLocalConfig = await request('/api/local-config');
  assert.equal(restartedLocalConfig.settings.uiLanguage, 'ja');
  assert.deepEqual(restartedLocalConfig.settings.constraints, [repairedSample]);
  const restartedSettingsText = await readFile(path.join(configDir, 'data', 'settings.local.json'), 'utf8');
  assert.equal(restartedSettingsText.includes(mojibakeSample), false);
  assert.ok(restartedSettingsText.includes(repairedSample));
  const restored = await request('/api/projects/project_gate');
  assert.equal(restored.project.nodes[0].x, 444);
  assert.ok(restored.project.nodes[0].messages.some(message => message.id === 'msg_follow'));
  assert.deepEqual(restored.project.artifacts, project.artifacts);
  assert.deepEqual(restored.project.reasoningEdges, project.reasoningEdges);
  assert.equal(restored.project.contextSnapshots[0].immutable, true);
  const restoredWorkspace = await request('/api/workspace');
  assert.equal(restoredWorkspace.activeProjectId, 'project_gate');

  console.log('PASS: v12.5 language persistence/instructions, UTF-8 mojibake migration and backups, provider-response repair, API-key connect/sync, reasoning forwarding, local storage, session-token isolation, NDJSON generation, traceable decomposition, Compact, backup restore and restart recovery.');
} finally {
  await stopServer();
  await new Promise(resolve => upstream.close(resolve));
  await rm(configDir, { recursive: true, force: true });
}
