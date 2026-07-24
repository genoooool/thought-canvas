import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CodexAppServerClient } from '../codex-app-server.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fake = path.join(root, 'tests', 'fake-codex.sh');
const configDir = await mkdtemp(path.join(os.tmpdir(), 'thought-canvas-codex-v12-'));
const stateFile = path.join(configDir, 'fake-codex-state.json');
const port = 19000 + (process.pid % 1000);
let child;
let stderr = '';
const base = `http://127.0.0.1:${port}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let sessionToken = '';

function startServer() {
  child = spawn(process.execPath, ['server.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      CODEX_BIN: fake,
      THOUGHT_CANVAS_CONFIG_DIR: configDir,
      FAKE_CODEX_STATE_FILE: stateFile,
      FAKE_CODEX_LOGIN_DELAY: '280',
      FAKE_CODEX_TURN_DELAY: '35'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stderr.on('data', chunk => { stderr += String(chunk); });
}

async function stopServer() {
  if (!child || child.exitCode != null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill('SIGTERM');
  await Promise.race([exited, sleep(2500)]);
  if (child.exitCode == null) child.kill('SIGKILL');
}

async function waitServer() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
    } catch {}
    if (child?.exitCode != null) throw new Error(`server exited early: ${stderr}`);
    await sleep(60);
  }
  throw new Error(`server start timeout: ${stderr}`);
}

async function refreshSessionToken() {
  const html = await (await fetch(`${base}/`)).text();
  const match = html.match(/name="thought-canvas-session" content="([^"]+)"/);
  assert.ok(match?.[1]);
  sessionToken = match[1];
}

async function requestJson(pathname, { method = 'GET', body, token = sessionToken } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers['x-thought-canvas-session'] = token;
  const response = await fetch(base + pathname, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function post(pathname, body = {}) {
  const { response, payload } = await requestJson(pathname, { method: 'POST', body });
  assert.equal(response.ok, true, `${pathname}: ${JSON.stringify(payload)}\n${stderr}`);
  return payload;
}

async function waitSession(sessionId, expected = ['success', 'error', 'cancelled']) {
  let session;
  for (let i = 0; i < 100; i += 1) {
    ({ payload: session } = await requestJson(`/api/oauth/codex/session?id=${encodeURIComponent(sessionId)}`));
    if (expected.includes(session.status)) return session;
    await sleep(45);
  }
  throw new Error(`Codex session timeout: ${sessionId} ${JSON.stringify(session)}\n${stderr}`);
}

async function requestStream(prompt, { reasoningEffort = 'xhigh', signal } = {}) {
  const response = await fetch(`${base}/api/generate-stream`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/x-ndjson',
      'x-thought-canvas-session': sessionToken
    },
    body: JSON.stringify({
      prompt,
      config: {
        providerId: 'codex-cli',
        providerName: 'Codex',
        protocol: 'codex-app-server',
        model: 'gpt-5.6-codex',
        reasoningMode: 'codex',
        reasoningEffort
      }
    }),
    signal
  });
  assert.equal(response.ok, true, `stream HTTP ${response.status}`);
  const raw = await response.text();
  return raw.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
}

async function abortAfterFirstDelta() {
  const controller = new AbortController();
  const response = await fetch(`${base}/api/generate-stream`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/x-ndjson',
      'x-thought-canvas-session': sessionToken
    },
    body: JSON.stringify({
      prompt: 'SLOW_INTERRUPT 验证停止生成',
      config: {
        providerId: 'codex-cli',
        providerName: 'Codex',
        protocol: 'codex-app-server',
        model: 'gpt-5.6-codex',
        reasoningMode: 'codex',
        reasoningEffort: 'medium'
      }
    }),
    signal: controller.signal
  });
  assert.equal(response.ok, true);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let sawDelta = false;
  try {
    while (!sawDelta) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === 'delta') {
          sawDelta = true;
          controller.abort();
          break;
        }
      }
    }
  } catch (error) {
    assert.ok(error.name === 'AbortError' || controller.signal.aborted, error.message);
  }
  assert.equal(sawDelta, true, 'stream must emit a delta before interruption');
  for (let i = 0; i < 60; i += 1) {
    const state = JSON.parse(await readFile(stateFile, 'utf8'));
    if (state.interrupted) return state;
    await sleep(50);
  }
  throw new Error(`turn/interrupt was not observed: ${await readFile(stateFile, 'utf8')}\n${stderr}`);
}

try {
  startServer();
  await waitServer();
  await refreshSessionToken();

  let { payload: status } = await requestJson('/api/oauth/codex/status');
  assert.equal(status.installed, true);
  assert.equal(status.loggedIn, false);
  assert.equal(status.activeSession, null);
  assert.equal(status.models.length, 0);

  const unauthenticatedStart = await requestJson('/api/oauth/codex/start', {
    method: 'POST', body: { mode: 'browser' }, token: ''
  });
  assert.equal(unauthenticatedStart.response.status, 401);
  assert.equal(unauthenticatedStart.payload.code, 'SESSION_REQUIRED');

  const browserStarted = await post('/api/oauth/codex/start', { mode: 'browser' });
  assert.ok(browserStarted.sessionId);
  assert.equal(browserStarted.mode, 'browser');
  assert.equal(browserStarted.status, 'running');
  assert.match(browserStarted.authUrl, /auth\.openai\.com\/oauth\/authorize/);

  const parallel = await requestJson('/api/oauth/codex/start', { method: 'POST', body: { mode: 'device' } });
  assert.equal(parallel.response.status, 409);
  assert.equal(parallel.payload.session.sessionId, browserStarted.sessionId);

  ({ payload: status } = await requestJson('/api/oauth/codex/status'));
  assert.equal(status.activeSession.sessionId, browserStarted.sessionId);

  const browserSession = await waitSession(browserStarted.sessionId);
  assert.equal(browserSession.status, 'success');
  assert.equal(browserSession.mode, 'browser');
  assert.equal(browserSession.account.email, 'codex.tester@example.com');
  assert.equal(browserSession.models.length, 2);

  ({ payload: status } = await requestJson('/api/oauth/codex/status'));
  assert.equal(status.loggedIn, true);
  assert.equal(status.activeSession, null);
  assert.equal(status.account.planType, 'plus');
  assert.equal(status.models[0].id, 'gpt-5.6-codex');
  assert.equal(status.models[0].isDefault, true);
  assert.deepEqual(status.models[0].reasoningEfforts, ['auto', 'low', 'medium', 'high', 'xhigh']);
  assert.equal(status.models[0].defaultReasoningEffort, 'high');

  const streamEvents = await requestStream('验证 Codex App Server 流式生成', { reasoningEffort: 'xhigh' });
  assert.equal(streamEvents[0].type, 'start');
  assert.ok(streamEvents.some(event => event.type === 'delta'));
  assert.equal(streamEvents.at(-1).type, 'done');
  const streamText = streamEvents.filter(event => event.type === 'delta').map(event => event.text).join('');
  assert.match(streamText, /Codex App Server reply/);
  let fakeState = JSON.parse(await readFile(stateFile, 'utf8'));
  assert.equal(fakeState.initializeCapabilities.experimentalApi, true);
  assert.ok(fakeState.permissionProfileListCount >= 1);
  assert.equal(fakeState.lastThread.permissions, ':read-only');
  assert.equal(fakeState.lastThread.sandbox, null);
  assert.equal(fakeState.lastTurn.model, 'gpt-5.6-codex');
  assert.equal(fakeState.lastTurn.effort, 'xhigh');
  assert.equal(fakeState.lastTurn.permissions, null);
  assert.equal(fakeState.lastTurn.sandboxPolicy, null);
  assert.equal(fakeState.requests.some(request => request?.params?.sandboxPolicy?.access), false);

  fakeState = await abortAfterFirstDelta();
  assert.equal(fakeState.interrupted, true);
  assert.equal(fakeState.lastTurn.effort, 'medium');

  const logoutWithoutToken = await requestJson('/api/oauth/codex/logout', { method: 'POST', body: {}, token: '' });
  assert.equal(logoutWithoutToken.response.status, 401);
  await post('/api/oauth/codex/logout');
  ({ payload: status } = await requestJson('/api/oauth/codex/status'));
  assert.equal(status.loggedIn, false);
  assert.deepEqual(status.models, []);

  const deviceStarted = await post('/api/oauth/codex/start', { mode: 'device' });
  assert.equal(deviceStarted.mode, 'device');
  assert.match(deviceStarted.verificationUrl, /auth\.openai\.com\/codex\/device/);
  assert.equal(deviceStarted.userCode, 'TEST-1234');
  const deviceSession = await waitSession(deviceStarted.sessionId);
  assert.equal(deviceSession.status, 'success');
  assert.equal(deviceSession.models.length, 2);

  await post('/api/oauth/codex/logout');
  const cancelStarted = await post('/api/oauth/codex/start', { mode: 'browser' });
  const unauthenticatedCancel = await requestJson('/api/oauth/codex/cancel', {
    method: 'POST', body: { sessionId: cancelStarted.sessionId }, token: ''
  });
  assert.equal(unauthenticatedCancel.response.status, 401);
  const cancelling = await post('/api/oauth/codex/cancel', { sessionId: cancelStarted.sessionId });
  assert.ok(['cancelling', 'cancelled'].includes(cancelling.status));
  const cancelled = await waitSession(cancelStarted.sessionId, ['cancelled', 'error']);
  assert.equal(cancelled.status, 'cancelled');

  ({ payload: status } = await requestJson('/api/oauth/codex/status'));
  assert.equal(status.loggedIn, false);
  assert.equal(status.activeSession, null);

  const invalidMode = await requestJson('/api/oauth/codex/start', {
    method: 'POST', body: { mode: 'cookie-copy' }
  });
  assert.equal(invalidMode.response.status, 400);

  const legacyStateFile = path.join(configDir, 'fake-codex-legacy-state.json');
  await writeFile(legacyStateFile, `${JSON.stringify({
    loggedIn: true,
    account: { type: 'chatgpt', email: 'legacy@example.com', planType: 'plus' }
  })}
`, { mode: 0o600 });
  const legacyClient = new CodexAppServerClient({
    command: fake,
    cwd: root,
    version: '1.2.5',
    env: {
      ...process.env,
      FAKE_CODEX_STATE_FILE: legacyStateFile,
      FAKE_CODEX_PROTOCOL_MODE: 'legacy',
      FAKE_CODEX_TURN_DELAY: '10'
    }
  });
  try {
    const deltas = [];
    const legacyResult = await legacyClient.generate({
      model: 'gpt-5.5-codex-mini',
      effort: 'medium',
      prompt: '验证旧版 App Server 的只读回退',
      onDelta: delta => deltas.push(delta)
    });
    assert.match(legacyResult.text, /Codex App Server reply/);
    assert.equal(legacyResult.permissionMode, 'legacySandbox');
    assert.ok(deltas.length > 0);
    const legacyState = JSON.parse(await readFile(legacyStateFile, 'utf8'));
    assert.equal(legacyState.initializeCapabilities, null);
    assert.equal(legacyState.permissionProfileListCount, 0);
    assert.equal(legacyState.lastThread.permissions, null);
    assert.equal(legacyState.lastThread.sandbox, 'read-only');
    assert.equal(legacyState.lastTurn.sandboxPolicy, null);
    assert.equal(legacyState.requests.some(request => request?.params?.sandboxPolicy?.access), false);
  } finally {
    await legacyClient.close();
  }

  console.log('PASS: Codex App Server OAuth/models/streaming plus modern permissionProfile and legacy read-only fallback without deprecated readOnly.access.');
} finally {
  await stopServer();
  await rm(configDir, { recursive: true, force: true }).catch(() => {});
}
