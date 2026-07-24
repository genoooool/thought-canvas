import readline from 'node:readline';
import { readFile, rename, writeFile } from 'node:fs/promises';

const stateFile = process.env.FAKE_CODEX_STATE_FILE || `/tmp/thought-canvas-fake-codex-${process.pid}.json`;
const loginDelay = Number(process.env.FAKE_CODEX_LOGIN_DELAY || 140);
const normalTurnDelay = Number(process.env.FAKE_CODEX_TURN_DELAY || 35);
const protocolMode = String(process.env.FAKE_CODEX_PROTOCOL_MODE || 'modern');
const readOnlyProfileMode = String(process.env.FAKE_CODEX_READ_ONLY_PROFILE || (protocolMode === 'denied' ? 'denied' : 'allowed'));
const permissionsFieldMode = String(process.env.FAKE_CODEX_PERMISSIONS_FIELD || 'supported');

let state = {
  loggedIn: false,
  account: null,
  lastThread: null,
  lastTurn: null,
  initializeCapabilities: null,
  permissionProfileListCount: 0,
  protocolMode,
  readOnlyProfileMode,
  permissionsFieldMode,
  interrupted: false,
  requests: []
};
try {
  state = { ...state, ...JSON.parse(await readFile(stateFile, 'utf8')) };
} catch {}

const loginTimers = new Map();
const turns = new Map();
let nextLogin = 1;
let nextThread = 1;
let nextTurn = 1;

async function persist() {
  const tempFile = `${stateFile}.${process.pid}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await rename(tempFile, stateFile);
}
await persist();

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function result(id, value = {}) {
  send({ id, result: value });
}

function failure(id, message, code = -32000) {
  send({ id, error: { code, message } });
}

function notify(method, params = {}) {
  send({ method, params });
}

function accountPayload() {
  return state.loggedIn
    ? { type: 'chatgpt', email: 'codex.tester@example.com', planType: 'plus', credentialSource: 'codex-cli' }
    : null;
}

function modelCatalog() {
  return [
    {
      id: 'gpt-5.6-codex',
      displayName: 'GPT-5.6 Codex',
      supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
      defaultReasoningEffort: 'high',
      inputModalities: ['text', 'image'],
      isDefault: true
    },
    {
      id: 'gpt-5.5-codex-mini',
      displayName: 'GPT-5.5 Codex Mini',
      supported_reasoning_efforts: ['low', 'medium', 'high'],
      default_reasoning_effort: 'medium',
      input_modalities: ['text']
    }
  ];
}

function promptText(params = {}) {
  return (params.input || []).map(item => item?.text || '').join('\n');
}

function completeTurn(turn) {
  if (!turn || turn.finished) return;
  turn.finished = true;
  const finalText = `Codex App Server reply: ${turn.prompt.slice(0, 96)}`;
  notify('item/completed', {
    threadId: turn.threadId,
    turnId: turn.turnId,
    item: { id: `item-${turn.turnId}`, type: 'agentMessage', text: finalText, turnId: turn.turnId }
  });
  notify('turn/completed', {
    threadId: turn.threadId,
    turnId: turn.turnId,
    turn: { id: turn.turnId, threadId: turn.threadId, status: 'completed' }
  });
  turns.delete(turn.turnId);
}

function scheduleTurn(turn) {
  const chunks = ['Codex ', 'App Server ', `reply: ${turn.prompt.slice(0, 96)}`];
  const delay = turn.prompt.includes('SLOW_INTERRUPT') ? 220 : normalTurnDelay;
  const emitAt = index => {
    if (turn.finished) return;
    if (index >= chunks.length) return completeTurn(turn);
    notify('item/agentMessage/delta', {
      threadId: turn.threadId,
      turnId: turn.turnId,
      itemId: `item-${turn.turnId}`,
      delta: chunks[index]
    });
    turn.timer = setTimeout(() => emitAt(index + 1), delay);
  };
  turn.timer = setTimeout(() => emitAt(0), Math.min(40, delay));
}

async function handle(message) {
  if (!message || typeof message !== 'object') return;
  if (message.method === 'initialized' && message.id == null) return;
  const id = message.id;
  const method = String(message.method || '');
  const params = message.params || {};
  state.requests.push({ method, params, at: Date.now() });
  state.requests = state.requests.slice(-80);
  await persist();

  if (id == null) return;
  if (method === 'initialize') {
    state.initializeCapabilities = params.capabilities || null;
    state.protocolMode = protocolMode;
    await persist();
    if (protocolMode === 'legacy' && params.capabilities) {
      return failure(id, 'unknown field `capabilities`', -32602);
    }
    return result(id, {
      serverInfo: { name: 'fake-codex-app-server', version: protocolMode === 'legacy' ? '0.legacy-test' : '0.modern-test' },
      capabilities: { account: true, models: true, threads: true }
    });
  }
  if (method === 'account/read') {
    return result(id, { account: accountPayload(), requiresOpenaiAuth: !state.loggedIn });
  }
  if (method === 'account/login/start') {
    const loginId = `login-${nextLogin++}`;
    const device = params.type === 'chatgptDeviceCode';
    const response = device
      ? {
          type: 'chatgptDeviceCode', loginId,
          verificationUrl: 'https://auth.openai.com/codex/device',
          userCode: 'TEST-1234'
        }
      : {
          type: 'chatgpt', loginId,
          authUrl: `https://auth.openai.com/oauth/authorize?client_id=fake&login_id=${loginId}`
        };
    result(id, response);
    const timer = setTimeout(async () => {
      loginTimers.delete(loginId);
      state.loggedIn = true;
      state.account = accountPayload();
      await persist();
      notify('account/login/completed', { loginId, success: true });
      notify('account/updated', { authMode: 'chatgpt', account: state.account });
    }, loginDelay);
    loginTimers.set(loginId, timer);
    return;
  }
  if (method === 'account/login/cancel') {
    const loginId = String(params.loginId || '');
    const timer = loginTimers.get(loginId);
    if (timer) clearTimeout(timer);
    loginTimers.delete(loginId);
    result(id, {});
    notify('account/login/completed', { loginId, success: false, error: 'cancelled' });
    return;
  }
  if (method === 'account/logout') {
    for (const timer of loginTimers.values()) clearTimeout(timer);
    loginTimers.clear();
    state.loggedIn = false;
    state.account = null;
    await persist();
    result(id, {});
    notify('account/updated', { authMode: null, account: null });
    return;
  }
  if (method === 'model/list') {
    if (!state.loggedIn) return failure(id, 'not authenticated', 401);
    return result(id, { data: modelCatalog(), nextCursor: null });
  }
  if (method === 'permissionProfile/list') {
    if (protocolMode === 'legacy') return failure(id, 'method not found: permissionProfile/list', -32601);
    if (!state.initializeCapabilities?.experimentalApi) {
      return failure(id, 'permissionProfile/list requires experimentalApi capability', -32602);
    }
    state.permissionProfileListCount = Number(state.permissionProfileListCount || 0) + 1;
    await persist();
    const data = [
      { id: ':workspace', description: 'Built-in workspace profile', allowed: true }
    ];
    if (readOnlyProfileMode !== 'missing') {
      data.unshift({
        id: ':read-only',
        description: 'Built-in read-only profile',
        allowed: readOnlyProfileMode !== 'denied'
      });
    }
    return result(id, { data, nextCursor: null });
  }
  if (method === 'thread/start') {
    if (!state.loggedIn) return failure(id, 'not authenticated', 401);
    if (params.permissions && params.sandbox) return failure(id, 'permissions and sandbox cannot be combined', -32602);
    if (protocolMode === 'legacy') {
      if (params.permissions) return failure(id, 'unknown field `permissions`', -32602);
      if (params.sandbox !== 'read-only') return failure(id, 'legacy fake requires sandbox=read-only', -32602);
    } else if (permissionsFieldMode === 'unsupported') {
      if (params.permissions) return failure(id, 'unknown field `permissions`', -32602);
      if (params.sandbox !== 'read-only') return failure(id, 'transition fake requires legacy sandbox=read-only after permissions rejection', -32602);
    } else {
      if (readOnlyProfileMode === 'denied') return failure(id, ':read-only is not allowed', -32602);
      if (readOnlyProfileMode === 'missing') return failure(id, ':read-only profile is missing', -32602);
      if (params.permissions !== ':read-only') return failure(id, 'modern fake requires permissions=:read-only', -32602);
    }
    const threadId = `thread-${nextThread++}`;
    state.lastThread = {
      threadId,
      model: String(params.model || ''),
      cwd: String(params.cwd || ''),
      permissions: params.permissions || null,
      sandbox: params.sandbox || null,
      approvalPolicy: params.approvalPolicy || null,
      ephemeral: Boolean(params.ephemeral)
    };
    await persist();
    return result(id, { thread: { id: threadId, model: params.model } });
  }
  if (method === 'turn/start') {
    if (params.permissions && params.sandboxPolicy) return failure(id, 'permissions and sandboxPolicy cannot be combined', -32602);
    if (params.sandboxPolicy?.type === 'readOnly' && params.sandboxPolicy?.access) {
      return failure(id, 'Invalid request: readOnly.access is no longer supported; use permissionProfile for restricted reads', -32602);
    }
    const turnId = `turn-${nextTurn++}`;
    const turn = {
      turnId,
      threadId: String(params.threadId || ''),
      model: String(params.model || ''),
      effort: String(params.effort || 'auto'),
      prompt: promptText(params),
      finished: false,
      timer: null
    };
    state.lastTurn = {
      threadId: turn.threadId,
      turnId,
      model: turn.model,
      effort: turn.effort,
      prompt: turn.prompt,
      permissions: params.permissions || null,
      sandboxPolicy: params.sandboxPolicy || null
    };
    state.interrupted = false;
    await persist();
    turns.set(turnId, turn);
    result(id, { turn: { id: turnId, threadId: turn.threadId, status: 'inProgress' } });
    scheduleTurn(turn);
    return;
  }
  if (method === 'turn/interrupt') {
    const turnId = String(params.turnId || '');
    const turn = turns.get(turnId);
    if (turn && !turn.finished) {
      turn.finished = true;
      if (turn.timer) clearTimeout(turn.timer);
      turns.delete(turnId);
      state.interrupted = true;
      await persist();
      notify('turn/completed', {
        threadId: turn.threadId,
        turnId,
        turn: { id: turnId, threadId: turn.threadId, status: 'interrupted' }
      });
    }
    return result(id, {});
  }
  if (method === 'thread/unsubscribe' || method === 'thread/delete') return result(id, {});
  return failure(id, `unsupported fake method: ${method}`, -32601);
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', line => {
  const value = String(line || '').trim();
  if (!value) return;
  let message;
  try { message = JSON.parse(value); }
  catch { return; }
  void handle(message).catch(error => {
    if (message?.id != null) failure(message.id, error?.message || String(error));
    else process.stderr.write(`${error?.stack || error}\n`);
  });
});

async function shutdown() {
  for (const timer of loginTimers.values()) clearTimeout(timer);
  for (const turn of turns.values()) if (turn.timer) clearTimeout(turn.timer);
  await persist().catch(() => {});
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
